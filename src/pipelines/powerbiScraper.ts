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
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

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
  waitValue: number;
  measureKind: 'Wait_viz' | 'Wait_viz2';
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

  // SurgWait_v2 — non-cancer wait times in weeks (Wait_viz, exact match)
  // Wait_viz has format 0.0 (decimal weeks). Three separate queries return
  // the 10th, 50th (median), and 90th percentile values respectively.
  if (selectStr.includes('SurgWait_v2.Type') && selectNames.includes('SurgWait_v2.Wait_viz')) {
    const rows = parseDsrRows(data);
    const waitTimes: SurgicalWaitData[] = rows.map((r) => ({
      procedureType: String(r.G0 ?? ''),
      waitValue: Number(r.M0 ?? 0),
      measureKind: 'Wait_viz' as const,
    }));
    return { waitTimes };
  }

  // SurgWait_v2 — cancer wait times in days (Wait_viz2)
  // Wait_viz2 has format 0 (integer days). Three separate queries return
  // the 10th, 50th (median), and 90th percentile values respectively.
  if (selectStr.includes('SurgWait_v2.Type') && selectNames.includes('SurgWait_v2.Wait_viz2')) {
    const rows = parseDsrRows(data);
    const waitTimes: SurgicalWaitData[] = rows.map((r) => ({
      procedureType: String(r.G0 ?? ''),
      waitValue: Number(r.M0 ?? 0),
      measureKind: 'Wait_viz2' as const,
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

  // SurgMap_v2 — full All-Surgeries facility map with coordinates + volume.
  // Require FACILITY_LONGITUDE so we only accept the unfiltered coordinate map
  // (complete site list, typically ~90). The Surgery Type breakdown query uses
  // hierarchical G0/X rows without lon/lat and must not feed facility volumes.
  if (
    selectStr.includes('SurgMap_v2.SITE') &&
    selectStr.includes('FACILITY_LONGITUDE') &&
    !selectStr.includes('Surgery Type')
  ) {
    const rows = parseDsrRows(data);
    const facilities: FacilityData[] = rows
      .filter((r) => r.G0 && typeof r.G0 === 'string')
      .map((r) => {
        const volume = Number(r.M0 ?? 0);
        return {
          site: String(r.G0),
          longitude: Number(r.M1 ?? 0),
          latitude: Number(r.M2 ?? 0),
          volumes: Number.isFinite(volume) && volume > 0 ? [Math.round(volume)] : [],
        };
      });
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

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function buildSurgicalRecords(data: ScrapedData): SurgicalRecord[] {
  const records: SurgicalRecord[] = [];
  const period = data.periodLabel || 'Latest month';
  const periodSlug = slugify(period);
  const sourceUrl = 'https://www.alberta.ca/health-system-dashboard';

  // Collect ALL wait values per procedure type. The Power BI report sends
  // three separate queries per measure (10th, 50th, 90th percentile) with
  // identical select names. The previous code deduplicated via Map.set (last
  // wins), which captured only one percentile and mislabeled it "Median wait".
  // Now we collect all values, sort them ascending, and assign percentile
  // labels: lowest = 10th, middle = 50th (median), highest = 90th.
  const waitValuesByProc = new Map<string, number[]>();
  for (const wt of data.waitTimes) {
    if (wt.procedureType && wt.waitValue > 0) {
      const arr = waitValuesByProc.get(wt.procedureType) ?? [];
      arr.push(wt.waitValue);
      waitValuesByProc.set(wt.procedureType, arr);
    }
  }

  const PERCENTILE_LABELS = ['10th percentile', 'Median wait', '90th percentile'] as const;

  for (const [procedureType, values] of waitValuesByProc) {
    const proc = PROCEDURE_MAP[procedureType];
    if (!proc) continue;
    const isCancer = proc.group === 'Cancer Surgery';
    const unit = isCancer ? 'days' : 'weeks';
    const sorted = [...values].sort((a, b) => a - b);

    // Expect 10th / median / 90th; ignore any unexpected extra values so
    // metric_name stays within the SurgicalRecord union.
    for (let i = 0; i < Math.min(sorted.length, PERCENTILE_LABELS.length); i++) {
      const label = PERCENTILE_LABELS[i];
      records.push({
        id: `powerbi-${slugify(proc.name)}-${slugify(label)}-${periodSlug}`,
        source_name: 'Alberta Health System Dashboard (Power BI)',
        source_url: sourceUrl,
        reporting_period_start: period,
        reporting_period_end: period,
        geography_type: 'Province',
        geography_name: 'Alberta',
        procedure_group: proc.group,
        procedure_name: proc.name,
        wait_segment: 'Decision-to-surgery',
        metric_name: label,
        metric_value: sorted[i],
        unit,
        method_note: `Power BI Health System Dashboard — ${label} RTT (Wait 2, ready-to-treat to surgery) in ${unit}`,
      });
    }
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
        id: `powerbi-${slugify(proc.name)}-volume-${periodSlug}`,
        source_name: 'Alberta Health System Dashboard (Power BI)',
        source_url: sourceUrl,
        reporting_period_start: period,
        reporting_period_end: period,
        geography_type: 'Province',
        geography_name: 'Alberta',
        procedure_group: proc.group,
        procedure_name: proc.name,
        wait_segment: 'Decision-to-surgery',
        metric_name: 'Volume',
        metric_value: v.volume,
        unit: 'count',
        method_note: 'Power BI Health System Dashboard — monthly surgery volume',
      });
    }

    if (v.pctInTarget > 0) {
      records.push({
        id: `powerbi-${slugify(proc.name)}-pct-target-${periodSlug}`,
        source_name: 'Alberta Health System Dashboard (Power BI)',
        source_url: sourceUrl,
        reporting_period_start: period,
        reporting_period_end: period,
        geography_type: 'Province',
        geography_name: 'Alberta',
        procedure_group: proc.group,
        procedure_name: proc.name,
        wait_segment: 'Decision-to-surgery',
        metric_name: '% within benchmark',
        metric_value: Math.round(v.pctInTarget * 100),
        unit: 'percent',
        method_note: 'Power BI Health System Dashboard — % completed within recommended time',
      });
    }
  }

  // Facility-level data — deduplicate by site name. Prefer non-zero volumes so
  // Surgery Type (or other filtered) map queries cannot zero out M0 totals.
  const facilityMap = new Map<string, FacilityData>();
  for (const f of data.facilities) {
    if (!f.site) continue;
    const existing = facilityMap.get(f.site);
    if (!existing) {
      facilityMap.set(f.site, {
        site: f.site,
        longitude: f.longitude,
        latitude: f.latitude,
        volumes: [...f.volumes],
      });
      continue;
    }
    const newVol = f.volumes.reduce((a, b) => a + b, 0);
    const oldVol = existing.volumes.reduce((a, b) => a + b, 0);
    if (newVol > 0 && (oldVol === 0 || newVol >= oldVol)) {
      existing.volumes = [...f.volumes];
    }
    if (f.longitude) existing.longitude = f.longitude;
    if (f.latitude) existing.latitude = f.latitude;
  }

  for (const [, f] of facilityMap) {
    const volume = f.volumes.reduce((a, b) => a + b, 0);
    if (!(volume > 0)) continue;
    records.push({
      id: `powerbi-facility-${slugify(f.site)}`,
      source_name: 'Alberta Health System Dashboard (Power BI)',
      source_url: sourceUrl,
      reporting_period_start: period,
      reporting_period_end: period,
      geography_type: 'Facility',
      geography_name: 'Alberta',
      facility_name: f.site,
      procedure_group: 'All Surgeries',
      procedure_name: 'All Surgeries',
      wait_segment: 'Decision-to-surgery',
      metric_name: 'Volume',
      metric_value: volume,
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
  FRASER_MEDIAN_WEEKS_2025?: unknown[];
  _dataMetadata?: DataMetadata;
}
const MONTH_NAME_TO_END_ISO: Record<string, { year: number; month: number }> = {
  january: { year: 0, month: 1 },
  february: { year: 0, month: 2 },
  march: { year: 0, month: 3 },
  april: { year: 0, month: 4 },
  may: { year: 0, month: 5 },
  june: { year: 0, month: 6 },
  july: { year: 0, month: 7 },
  august: { year: 0, month: 8 },
  september: { year: 0, month: 9 },
  october: { year: 0, month: 10 },
  november: { year: 0, month: 11 },
  december: { year: 0, month: 12 },
};

/** Convert a Power BI month-year label (e.g. "April 2026") to an ISO end-of-month date. */
function monthYearLabelToEndDate(label: string): string | undefined {
  const parts = label.trim().toLowerCase().split(/\s+/);
  if (parts.length !== 2) return undefined;
  const month = MONTH_NAME_TO_END_ISO[parts[0]];
  if (!month) return undefined;
  const year = Number(parts[1]);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return undefined;
  const d = new Date(year, month.month, 0);
  return d.toISOString().slice(0, 10);
}

function deriveSurgicalRecordsSourceVintage(records: SurgicalRecord[], periodLabel: string): string {
  const parsedEnds: number[] = [];
  for (const end of records.map((r) => r.reporting_period_end)) {
    if (typeof end !== 'string') continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      parsedEnds.push(new Date(end).getTime());
    } else {
      const iso = monthYearLabelToEndDate(end);
      if (iso) parsedEnds.push(new Date(iso).getTime());
    }
  }
  if (parsedEnds.length > 0) {
    const minEnd = new Date(Math.min(...parsedEnds));
    const maxEnd = new Date(Math.max(...parsedEnds));
    const minIso = minEnd.toISOString().slice(0, 10);
    const maxIso = maxEnd.toISOString().slice(0, 10);
    if (minIso === maxIso) {
      return `Reporting period ending ${maxIso}`;
    }
    return `Reporting period ${minIso} to ${maxIso} (mixed sources: monthly AHS Power BI, quarterly waittimes.alberta.ca, annual CIHI)`;
  }
  return periodLabel || 'Live data';
}


function mergeSurgicalRecords(filePath: string, newRecords: SurgicalRecord[], periodLabel: string): number {
  const fraserSource = 'Fraser Institute — Waiting Your Turn';
  const deriveFraserSourceVintage = (records: unknown[]): string => {
    if (!Array.isArray(records) || records.length === 0) {
      return 'Unavailable — Fraser Institute specialty wait-time data not currently scraped';
    }
    const first = records.find((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);
    const year = first && 'year' in first ? String(first.year) : '2025';
    return `${year} data (annual Fraser Institute physician survey)`;
  };

  if (!fs.existsSync(filePath)) {
    console.warn(`[PowerBIScraper] ${filePath} not found — creating new file`);
    const sourceVintage = deriveSurgicalRecordsSourceVintage(newRecords, periodLabel);
    const surgicalMeta = buildMetadataEntry({
      updateType: 'auto',
      source: 'Alberta Wait Times Reporting (Power BI scraper)',
      sourceVintage,
    });
    const fraserMeta = buildMetadataEntry({
      updateType: 'manual',
      source: fraserSource,
      sourceVintage: deriveFraserSourceVintage([]),
    });
    const data: SurgicalJson = {
      SURGICAL_RECORDS: newRecords,
      ORTHOPEDIC_SPECIALTY_RECORDS: [],
      SURGICAL_FACILITIES: [],
      SPECIALISTS_LIST: [],
      CIHI_PROVINCIAL_COMPARATORS: [],
      STATSCAN_SATISFACTION_STATS: [],
      FRASER_MEDIAN_WEEKS_2025: [],
      _dataMetadata: { SURGICAL_RECORDS: surgicalMeta, FRASER_MEDIAN_WEEKS_2025: fraserMeta },
    };
    applyWithheldPayloadGuard(data as unknown as Record<string, unknown>);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return newRecords.length;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as SurgicalJson;
  // Force withheld facility panels empty so stale RMW copies cannot survive.
  parsed.SURGICAL_FACILITIES = [];

  // Stale upstream sources superseded by Power BI (waittimes.alberta.ca shut
  // down Jan 2026; CIHI priority rows here are outdated duplicates).
  const STALE_SURGICAL_SOURCES = new Set([
    'Alberta Wait Times Reporting',
    'CIHI priority procedures',
  ]);

  // Remove old Power BI records and purge stale sources; keep other sources.
  const otherRecords = (parsed.SURGICAL_RECORDS ?? []).filter(
    (r) =>
      r.source_name !== 'Alberta Health System Dashboard (Power BI)' &&
      !STALE_SURGICAL_SOURCES.has(r.source_name),
  );

  parsed.SURGICAL_RECORDS = [...otherRecords, ...newRecords];
  const sourceVintage = deriveSurgicalRecordsSourceVintage(parsed.SURGICAL_RECORDS, periodLabel);
  const surgicalMeta = buildMetadataEntry({
    updateType: 'auto',
    source: 'Alberta Wait Times Reporting (Power BI scraper)',
    sourceVintage,
  });
  const fraserMeta = buildMetadataEntry({
    updateType: 'manual',
    source: fraserSource,
    sourceVintage: deriveFraserSourceVintage(parsed.FRASER_MEDIAN_WEEKS_2025 ?? []),
    previous: parsed._dataMetadata?.FRASER_MEDIAN_WEEKS_2025,
    contentChanged: false,
  });
  // Stamp SURGICAL_RECORDS freshness; preserve other _dataMetadata entries.
  parsed._dataMetadata = mergeDataMetadata(parsed._dataMetadata, {
    SURGICAL_RECORDS: surgicalMeta,
    FRASER_MEDIAN_WEEKS_2025: fraserMeta,
  }, ['SURGICAL_RECORDS']);
  applyWithheldPayloadGuard(parsed as unknown as Record<string, unknown>);
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
