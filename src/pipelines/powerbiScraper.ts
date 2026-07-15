// Power BI Scraper — extracts surgical wait times, volumes, and facility data
// from the Alberta Health System Dashboard (Power BI embedded report).
//
// waittimes.alberta.ca was shut down in January 2026 and replaced by:
//   https://www.alberta.ca/health-system-dashboard
// which embeds a Power BI report:
//   https://app.powerbi.com/view?r=eyJrIjoiMjUzNjc1MWQtYjcxZC00NTMzLWIwNDctZTA0ZTNiMWQzODBl...
//
// Power BI renders data via JavaScript canvas elements — not scrapable via HTTP.
// This scraper uses Puppeteer to load the report, intercept the querydata API
// responses, and parse the DAX Serialized Results (DSR) format.
//
// Runs as a standalone process (spawned by the orchestrator) because Puppeteer
// is ESM-only and the server bundles as CJS.

import fs from 'fs';
import path from 'path';
import puppeteer, { type Browser, type Page, type HTTPResponse } from 'puppeteer';
import type { SurgicalRecord } from '../surgicalData';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';

const POWERBI_REPORT_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiMjUzNjc1MWQtYjcxZC00NTMzLWIwNDctZTA0ZTNiMWQzODBlIiwidCI6IjJiYjUxYzA2LWFmOWItNDJjNS04YmY1LTNjM2I3YjEwODUwYiJ9';

const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// --- DSR (DAX Serialized Results) parser ---

interface DsrRow {
  S?: Array<{ N: string; T: number }>;
  C?: unknown[];
  G0?: string;
  G1?: string;
  X?: DsrRow[];
  M0?: number;
  M1?: number;
  I?: number;
}

interface DsrData {
  dsr?: {
    DS?: Array<{
      PH?: Array<Record<string, DsrRow[]>>;
    }>;
  };
  descriptor?: {
    Select?: Array<{ Kind: number; Name: string; Value: string }>;
  };
}

interface QueryResult {
  data?: DsrData;
}

interface QueryResponse {
  results?: Array<{ result?: QueryResult }>;
}

/** Extract rows from a DSR PH[0].DM0 array, mapping schema names to values. */
function parseDsrRows(dsrData: DsrData): Array<Record<string, unknown>> {
  const ph = dsrData.dsr?.DS?.[0]?.PH?.[0];
  if (!ph) return [];
  const dm0 = ph.DM0;
  if (!dm0) return [];

  // Get schema from first entry's S array
  const schemaEntry = dm0.find((r: DsrRow) => r.S);
  const schema = schemaEntry?.S?.map((s: { N: string }) => s.N) ?? [];

  const rows: Array<Record<string, unknown>> = [];
  for (const entry of dm0) {
    const cells = entry.C;
    if (!cells || cells.length === 0) continue;
    const row: Record<string, unknown> = {};
    schema.forEach((key: string, i: number) => {
      row[key] = cells[i];
    });
    rows.push(row);
  }
  return rows;
}

/** Extract hierarchical data from DSR with G0 (group) and X (nested measures). */
function parseDsrHierarchical(dsrData: DsrData): Array<{ group: string; values: number[] }> {
  const ph = dsrData.dsr?.DS?.[0]?.PH?.[0];
  if (!ph) return [];
  const dm0 = ph.DM0;
  if (!dm0) return [];

  const results: Array<{ group: string; values: number[] }> = [];
  for (const entry of dm0) {
    const group = entry.G0;
    if (!group) continue;
    const values: number[] = [];
    if (entry.X) {
      for (const x of entry.X) {
        if (x.M0 !== undefined) values.push(x.M0);
      }
    }
    results.push({ group, values });
  }
  return results;
}

// --- Data extraction from intercepted responses ---

interface SurgicalWaitData {
  procedureType: string;
  waitWeeks: number;
}

interface SurgicalVolumeData {
  procedureType: string;
  volume: number;
  pctInTarget: number;
}

interface FacilityData {
  site: string;
  longitude: number;
  latitude: number;
  volumes: number[];
}

/** Parse a querydata response and classify it by entity type. */
function classifyResponse(data: DsrData): {
  waitTimes?: SurgicalWaitData[];
  volumes?: SurgicalVolumeData[];
  facilities?: FacilityData[];
  periodLabel?: string;
} {
  const selectNames = data.descriptor?.Select?.map((s) => s.Name) ?? [];
  const selectStr = selectNames.join('|');

  // SurgWait_v2 — wait times by procedure type
  if (selectStr.includes('SurgWait_v2.Type') && selectStr.includes('Wait_viz')) {
    const rows = parseDsrRows(data);
    const waitTimes: SurgicalWaitData[] = rows.map((r) => ({
      procedureType: String(r.G0 ?? ''),
      waitWeeks: Number(r.M0 ?? 0),
    }));
    return { waitTimes };
  }

  // SurgVolPctCombined — volumes and % in target
  if (selectStr.includes('SurgVolPctCombined.Type') && selectStr.includes('Volume_viz')) {
    const rows = parseDsrRows(data);
    const volumes: SurgicalVolumeData[] = rows.map((r) => ({
      procedureType: String(r.G0 ?? ''),
      volume: Number(r.M0 ?? 0),
      pctInTarget: 0,
    }));
    return { volumes };
  }

  if (selectStr.includes('SurgVolPctCombined.Type') && selectStr.includes('PctInTarget_viz')) {
    const rows = parseDsrRows(data);
    const volumes: SurgicalVolumeData[] = rows.map((r) => ({
      procedureType: String(r.G0 ?? ''),
      volume: 0,
      pctInTarget: Number(r.M0 ?? 0),
    }));
    return { volumes };
  }

  // SurgMap_v2 — facility-level data with coordinates
  if (selectStr.includes('SurgMap_v2.SITE')) {
    const rows = parseDsrRows(data);
    const facilities: FacilityData[] = rows
      .filter((r) => r.G0 && typeof r.G0 === 'string')
      .map((r) => ({
        site: String(r.G0),
        longitude: Number(r.M1 ?? 0),
        latitude: Number(r.M2 ?? 0),
        volumes: [],
      }));
    return { facilities };
  }

  // Period label — capture title_period_label (display text like "April 2026"),
  // NOT period_label (which is a numeric ID like 74, 152, 21553).
  // Both dim_period and dim_period_surg have title_period_label fields.
  if (
    selectStr.includes('title_period_label') &&
    !selectStr.includes('period_label|')
  ) {
    const rows = parseDsrRows(data);
    // title_period_label is a measure (M0), not a group (G0)
    const label = rows.length > 0 ? String(rows[0].M0 ?? rows[0].G0 ?? '') : '';
    // Only accept if it looks like a text label, not a number
    if (label && isNaN(Number(label))) {
      return { periodLabel: label };
    }
  }

  return {};
}

// --- Main scrape logic ---

interface ScrapedData {
  waitTimes: SurgicalWaitData[];
  volumes: SurgicalVolumeData[];
  facilities: FacilityData[];
  periodLabel: string;
}

/** Launch Chrome, navigate to the Power BI report, click Surgery tab, intercept data. */
async function scrapePowerBISurgeryData(): Promise<ScrapedData> {
  const browser: Browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page: Page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const allWaitTimes: SurgicalWaitData[] = [];
    const allVolumes: SurgicalVolumeData[] = [];
    const allFacilities: FacilityData[] = [];
    let periodLabel = '';
    let queryDataCount = 0;

    // Intercept querydata responses
    page.on('response', async (response: HTTPResponse) => {
      const url = response.url();
      if (!url.includes('querydata') || response.status() !== 200) return;

      queryDataCount++;
      try {
        const text = await response.text();
        const parsed: QueryResponse = JSON.parse(text);
        for (const result of parsed.results ?? []) {
          const data = result.result?.data;
          if (!data) continue;
          const selectNames = data.descriptor?.Select?.map((s) => s.Name) ?? [];
          console.log(`[PowerBIScraper] querydata #${queryDataCount}: ${selectNames.join(', ')}`);
          const classified = classifyResponse(data);
          if (classified.waitTimes) {
            allWaitTimes.push(...classified.waitTimes);
            console.log(`[PowerBIScraper]   → ${classified.waitTimes.length} wait times`);
          }
          if (classified.volumes) {
            allVolumes.push(...classified.volumes);
            console.log(`[PowerBIScraper]   → ${classified.volumes.length} volume records`);
          }
          if (classified.facilities) {
            allFacilities.push(...classified.facilities);
            console.log(`[PowerBIScraper]   → ${classified.facilities.length} facilities`);
          }
          if (classified.periodLabel) {
            periodLabel = classified.periodLabel;
            console.log(`[PowerBIScraper]   → period: "${periodLabel}"`);
          }
        }
      } catch (err) {
        console.log(`[PowerBIScraper] querydata #${queryDataCount} parse error: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    // Navigate to the Power BI report
    console.log('[PowerBIScraper] Navigating to Power BI report...');
    await page.goto(POWERBI_REPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('[PowerBIScraper] Page loaded, waiting for initial render...');
    await new Promise((r) => setTimeout(r, 15000));

    // Click the "Surgery" tab
    console.log('[PowerBIScraper] Looking for Surgery tab button...');
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const surgBtn = buttons.find((b) => b.textContent.trim() === 'Surgery');
      if (surgBtn) {
        (surgBtn as HTMLElement).click();
        return true;
      }
      // Try span elements too (Power BI may use spans inside buttons)
      const spans = Array.from(document.querySelectorAll('span'));
      const surgSpan = spans.find((s) => s.textContent.trim() === 'Surgery');
      if (surgSpan) {
        const parent = surgSpan.closest('button');
        if (parent) {
          (parent as HTMLElement).click();
          return true;
        }
        (surgSpan as HTMLElement).click();
        return true;
      }
      return false;
    });
    console.log(`[PowerBIScraper] Surgery tab click: ${clicked ? 'success' : 'NOT FOUND'}`);

    if (!clicked) {
      const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500));
      console.log(`[PowerBIScraper] Page text preview: ${bodyText?.slice(0, 200)}`);
    }

    // Wait for Surgery tab data queries to complete
    console.log('[PowerBIScraper] Waiting for Surgery tab data queries...');
    await new Promise((r) => setTimeout(r, 15000));

    // Extract period label from DOM text (more reliable than DSR for text labels).
    // The Surgery page displays text like "April 2026" or "April 2026 — 28,111 surgeries".
    if (!periodLabel) {
      periodLabel = await page.evaluate(() => {
        const bodyText = document.body?.innerText ?? '';
        // Match month + year pattern (e.g. "April 2026", "March 2026")
        const match = bodyText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}/);
        return match ? match[0] : '';
      });
      if (periodLabel) {
        console.log(`[PowerBIScraper] Extracted period from DOM: "${periodLabel}"`);
      }
    }

    console.log(
      `[PowerBIScraper] Total querydata responses: ${queryDataCount}, ` +
        `waitTimes: ${allWaitTimes.length}, volumes: ${allVolumes.length}, ` +
        `facilities: ${allFacilities.length}, period: "${periodLabel}"`,
    );

    return {
      waitTimes: allWaitTimes,
      volumes: allVolumes,
      facilities: allFacilities,
      periodLabel,
    };
  } finally {
    await browser.close();
  }
}

// --- Map scraped data to SurgicalRecord shape ---

const PROCEDURE_MAP: Record<string, { group: string; name: string }> = {
  Bariatric: { group: 'Bariatric Surgery', name: 'Bariatric Surgery' },
  CABG: { group: 'Cardiac Surgery', name: 'Coronary Artery Bypass Graft' },
  Cataract: { group: 'Cataract Surgery', name: 'Cataract Surgery 1st Eye' },
  Hip: { group: 'Hip Replacement', name: 'Total Hip Arthroplasty' },
  Knee: { group: 'Knee Replacement', name: 'Total Knee Arthroplasty' },
  'Bladder cancer': { group: 'Cancer Surgery', name: 'Bladder Cancer Surgery' },
  'Breast cancer': { group: 'Cancer Surgery', name: 'Breast Cancer Surgery' },
  'Colorectal cancer': { group: 'Cancer Surgery', name: 'Colorectal Cancer Surgery' },
  'Lung cancer': { group: 'Cancer Surgery', name: 'Lung Cancer Surgery' },
  'Prostate cancer': { group: 'Cancer Surgery', name: 'Prostate Cancer Surgery' },
};

function buildSurgicalRecords(data: ScrapedData): SurgicalRecord[] {
  const records: SurgicalRecord[] = [];
  const period = data.periodLabel || 'Latest month';
  const sourceUrl = 'https://www.alberta.ca/health-system-dashboard';

  // Deduplicate wait times by procedure type (multiple queries return same data)
  const waitTimeMap = new Map<string, number>();
  for (const wt of data.waitTimes) {
    if (wt.procedureType && wt.waitWeeks > 0) {
      waitTimeMap.set(wt.procedureType, wt.waitWeeks);
    }
  }

  // Wait times (median wait in weeks)
  for (const [procedureType, waitWeeks] of waitTimeMap) {
    const proc = PROCEDURE_MAP[procedureType];
    if (!proc) continue;
    records.push({
      id: `powerbi-${proc.group}-wait-${period}`.replace(/\s+/g, '-').toLowerCase(),
      source_name: 'Alberta Health System Dashboard (Power BI)',
      source_url: sourceUrl,
      reporting_period_start: period,
      reporting_period_end: period,
      geography_type: 'Province',
      geography_name: 'Alberta',
      procedure_group: proc.group,
      procedure_name: proc.name,
      wait_segment: 'Referral-to-treatment',
      metric_name: 'Median wait',
      metric_value: waitWeeks,
      unit: 'weeks',
      method_note: 'Power BI Health System Dashboard — median wait weeks by procedure type',
    });
  }

  // Volumes and % in target — deduplicate by procedure type via Map
  const volumeMap = new Map<string, SurgicalVolumeData>();
  for (const v of data.volumes) {
    const existing = volumeMap.get(v.procedureType);
    if (existing) {
      if (v.volume > 0) existing.volume = v.volume;
      if (v.pctInTarget > 0) existing.pctInTarget = v.pctInTarget;
    } else {
      volumeMap.set(v.procedureType, { ...v });
    }
  }

  for (const [, v] of volumeMap) {
    const proc = PROCEDURE_MAP[v.procedureType];
    if (!proc) continue;

    if (v.volume > 0) {
      records.push({
        id: `powerbi-${proc.group}-volume-${period}`.replace(/\s+/g, '-').toLowerCase(),
        source_name: 'Alberta Health System Dashboard (Power BI)',
        source_url: sourceUrl,
        reporting_period_start: period,
        reporting_period_end: period,
        geography_type: 'Province',
        geography_name: 'Alberta',
        procedure_group: proc.group,
        procedure_name: proc.name,
        wait_segment: 'Referral-to-treatment',
        metric_name: 'Volume',
        metric_value: v.volume,
        unit: 'count',
        method_note: 'Power BI Health System Dashboard — monthly surgery volume',
      });
    }

    if (v.pctInTarget > 0) {
      records.push({
        id: `powerbi-${proc.group}-pct-target-${period}`.replace(/\s+/g, '-').toLowerCase(),
        source_name: 'Alberta Health System Dashboard (Power BI)',
        source_url: sourceUrl,
        reporting_period_start: period,
        reporting_period_end: period,
        geography_type: 'Province',
        geography_name: 'Alberta',
        procedure_group: proc.group,
        procedure_name: proc.name,
        wait_segment: 'Referral-to-treatment',
        metric_name: '% within benchmark',
        metric_value: Math.round(v.pctInTarget * 100),
        unit: 'percent',
        method_note: 'Power BI Health System Dashboard — % completed within recommended time',
      });
    }
  }

  // Facility-level data — deduplicate by site name
  const facilityMap = new Map<string, FacilityData>();
  for (const f of data.facilities) {
    if (f.site) facilityMap.set(f.site, f);
  }

  for (const [, f] of facilityMap) {
    records.push({
      id: `powerbi-facility-${f.site}`.replace(/\s+/g, '-').toLowerCase(),
      source_name: 'Alberta Health System Dashboard (Power BI)',
      source_url: sourceUrl,
      reporting_period_start: period,
      reporting_period_end: period,
      geography_type: 'Facility',
      geography_name: 'Alberta',
      facility_name: f.site,
      procedure_group: 'All Surgeries',
      procedure_name: 'All Surgeries',
      wait_segment: 'Referral-to-treatment',
      metric_name: 'Volume',
      metric_value: f.volumes.reduce((a, b) => a + b, 0),
      unit: 'count',
      method_note: 'Power BI Health System Dashboard — facility-level surgery volume',
    });
  }

  return records;
}

// --- Merge into data-surgical.json ---

interface SurgicalJson {
  SURGICAL_RECORDS: SurgicalRecord[];
  ORTHOPEDIC_SPECIALTY_RECORDS: unknown[];
  SURGICAL_FACILITIES: unknown[];
  SPECIALISTS_LIST: unknown[];
  CIHI_PROVINCIAL_COMPARATORS: unknown[];
  STATSCAN_SATISFACTION_STATS: unknown[];
  _dataMetadata?: DataMetadata;
}
function deriveSurgicalRecordsSourceVintage(records: SurgicalRecord[], periodLabel: string): string {
  const isoEnds = records
    .map((r) => r.reporting_period_end)
    .filter((end): end is string => typeof end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(end));
  if (isoEnds.length > 0) {
    const maxEnd = isoEnds.reduce((a, b) => (a > b ? a : b));
    return `Reporting period ending ${maxEnd}`;
  }
  return periodLabel || 'Live data';
}


function mergeSurgicalRecords(filePath: string, newRecords: SurgicalRecord[], periodLabel: string): number {
  if (!fs.existsSync(filePath)) {
    console.warn(`[PowerBIScraper] ${filePath} not found — creating new file`);
    const sourceVintage = deriveSurgicalRecordsSourceVintage(newRecords, periodLabel);
    const surgicalMeta = buildMetadataEntry({
      updateType: 'auto',
      source: 'Alberta Wait Times Reporting (Power BI scraper)',
      sourceVintage,
    });
    const data: SurgicalJson = {
      SURGICAL_RECORDS: newRecords,
      ORTHOPEDIC_SPECIALTY_RECORDS: [],
      SURGICAL_FACILITIES: [],
      SPECIALISTS_LIST: [],
      CIHI_PROVINCIAL_COMPARATORS: [],
      STATSCAN_SATISFACTION_STATS: [],
      _dataMetadata: { SURGICAL_RECORDS: surgicalMeta },
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return newRecords.length;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as SurgicalJson;

  // Remove old Power BI records, keep records from other sources
  const otherRecords = parsed.SURGICAL_RECORDS.filter(
    (r) => r.source_name !== 'Alberta Health System Dashboard (Power BI)',
  );

  parsed.SURGICAL_RECORDS = [...otherRecords, ...newRecords];
  const sourceVintage = deriveSurgicalRecordsSourceVintage(parsed.SURGICAL_RECORDS, periodLabel);
  const surgicalMeta = buildMetadataEntry({
    updateType: 'auto',
    source: 'Alberta Wait Times Reporting (Power BI scraper)',
    sourceVintage,
  });
  // Stamp SURGICAL_RECORDS freshness; preserve other _dataMetadata entries.
  parsed._dataMetadata = mergeDataMetadata(parsed._dataMetadata, {
    SURGICAL_RECORDS: surgicalMeta,
  });
  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2));
  return newRecords.length;
}

// --- Exported run function ---

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    console.log('[PowerBIScraper] Launching headless Chrome to scrape Power BI report...');
    const scraped = await scrapePowerBISurgeryData();

    console.log(
      `[PowerBIScraper] Scraped: ${scraped.waitTimes.length} wait times, ` +
        `${scraped.volumes.length} volume records, ${scraped.facilities.length} facilities, ` +
        `period: "${scraped.periodLabel}"`,
    );

    if (scraped.waitTimes.length === 0 && scraped.facilities.length === 0) {
      return {
        domain: 'surgical',
        pipeline: 'powerbiScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No surgical data extracted from Power BI report',
      };
    }

    const records = buildSurgicalRecords(scraped);
    const written = mergeSurgicalRecords(SURGICAL_FILE, records, scraped.periodLabel);

    console.log(
      `[PowerBIScraper] Complete. ${records.length} records built, ${written} written to data-surgical.json in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'surgical',
      pipeline: 'powerbiScraper',
      status: 'success',
      recordsFetched: records.length,
      recordsWritten: written,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[PowerBIScraper] FAILED:', errorMsg);
    return {
      domain: 'surgical',
      pipeline: 'powerbiScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp,
    };
  }
}

// CLI entry point: tsx src/pipelines/powerbiScraper.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
