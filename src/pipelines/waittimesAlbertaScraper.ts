// Alberta Wait Times Reporting Scraper (waittimes.alberta.ca)
// Scrapes the legacy JSP-based wait times reporting site for surgical and
// diagnostic wait time data. The site uses POST forms to AccessGoalChart.do
// with procedure category IDs (rcatID) and returns HTML with wait time tables.
// Writes merged results to data-surgical.json and data-diagnostic.json.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { SurgicalRecord } from '../surgicalData';
import type {
  FacilityImagingWait,
  ImagingWaitTrend,
} from '../diagnosticData';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type { SyncResult } from './types';

const BASE_URL = 'https://waittimes.alberta.ca/';
const PROCEDURE_OVERVIEW_URL = `${BASE_URL}ProcedureOverview.jsp`;
const CHART_ENDPOINT = `${BASE_URL}AccessGoalChart.do`;
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Surgical procedure categories to scrape from waittimes.alberta.ca.
// Maps the site's rcatID to the normalized procedure_group/procedure_name
// used in the SurgicalRecord shape.
const SURGICAL_CATEGORIES: ReadonlyArray<{
  rcatId: string;
  procedureGroup: string;
  procedureName: string;
}> = [
  { rcatId: '10', procedureGroup: 'Hip Replacement', procedureName: 'Total Hip Arthroplasty' },
  { rcatId: '11', procedureGroup: 'Knee Replacement', procedureName: 'Total Knee Arthroplasty' },
  { rcatId: '3', procedureGroup: 'Cataract Surgery', procedureName: 'Cataract Surgery 1st Eye' },
  { rcatId: '16', procedureGroup: 'Cardiac Surgery', procedureName: 'Coronary Artery Bypass Graft' },
  { rcatId: '34', procedureGroup: 'Cardiac Surgery', procedureName: 'Heart Valve Surgery' },
  { rcatId: '7', procedureGroup: 'General Surgery', procedureName: 'Gall Bladder Removal' },
  { rcatId: '55', procedureGroup: 'General Surgery', procedureName: 'Hernia Repair' },
  { rcatId: '52', procedureGroup: 'Gynaecological Surgery', procedureName: 'Hysterectomy' },
];

// Diagnostic imaging categories — CT and MRI scans.
const DIAGNOSTIC_CATEGORIES: ReadonlyArray<{
  rcatId: string;
  modality: 'CT Scan' | 'MRI Scan';
}> = [
  { rcatId: '19', modality: 'CT Scan' },
  { rcatId: '18', modality: 'MRI Scan' },
];

// Alberta health zones used by the site.
const ZONES = ['Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'] as const;

interface ParsedWaitTime {
  geographyName: string;
  metricName: SurgicalRecord['metric_name'];
  metricValue: number;
  unit: SurgicalRecord['unit'];
  reportingPeriod: string;
}

// Sleep for the rate-limit interval. Uses Promise.withResolvers per project rules.
function rateLimitDelay(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, RATE_LIMIT_MS);
  return promise;
}

// Parse a numeric value from a cell that may contain "weeks", "days", "%", or "N/A".
function parseMetricValue(raw: string): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /n\/a|unavailable|not available/i.test(trimmed)) return null;
  const match = trimmed.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Infer the unit from cell text or metric label.
function inferUnit(text: string): SurgicalRecord['unit'] {
  const lower = text.toLowerCase();
  if (lower.includes('week')) return 'weeks';
  if (lower.includes('day')) return 'days';
  if (lower.includes('%') || lower.includes('percent') || lower.includes('within')) return 'percent';
  return 'weeks'; // default for wait times
}

// Map a metric label from the site to the normalized metric_name enum.
function normalizeMetricName(label: string): SurgicalRecord['metric_name'] | null {
  const lower = label.toLowerCase();
  if (lower.includes('90th') || lower.includes('90 %') || lower.includes('longest 10')) return '90th percentile';
  if (lower.includes('median') || lower.includes('50th') || lower.includes('50 %')) return 'Median wait';
  if (lower.includes('average') || lower.includes('avg')) return 'Average wait';
  if (lower.includes('within') || lower.includes('benchmark') || lower.includes('ftp')) return '% within benchmark';
  if (lower.includes('volume') || lower.includes('count') || lower.includes('number') || lower.includes('completed')) return 'Volume';
  return null;
}

// Parse the reporting period from a header cell like "JAN-MAR 2026" or "2026 Q1".
// Returns start/end ISO dates for the quarter.
function parseReportingPeriod(headerText: string): { start: string; end: string } | null {
  const trimmed = headerText.trim();
  if (!trimmed) return null;

  // Format: "MMM-MMM YYYY" e.g. "JAN-MAR 2026"
  const quarterMatch = trimmed.match(/([A-Z]{3})-([A-Z]{3})\s+(\d{4})/i);
  if (quarterMatch) {
    const [, startMon, endMon, yearStr] = quarterMatch;
    const year = parseInt(yearStr, 10);
    const monthMap: Record<string, number> = {
      JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
      JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
    };
    const startMonth = monthMap[startMon.toUpperCase()];
    const endMonth = monthMap[endMon.toUpperCase()];
    if (startMonth && endMonth) {
      const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endDay = new Date(year, endMonth, 0).getDate();
      const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
      return { start, end };
    }
  }

  // Format: "YYYY" — annual data
  const yearMatch = trimmed.match(/^(\d{4})$/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }

  return null;
}

// Build the POST form body for an AccessGoalChart.do request.
// Requests provincial-level data (all zones, all facilities) for a given
// procedure category with combined urgency and all percentile metrics.
function buildFormBody(rcatId: string): string {
  const params: Array<[string, string]> = [
    ['rcatID', rcatId],
    ['command', 'goToAccessGoals'],
    ['doSearch', 'true'],
    ['checkBoxRegion', 'All'],
    ['checkBoxFacility', '-9'],
    ['chartTypeRadio', 'trend'],
    ['personTypeCheckBox', 'served'],
    ['chartUrgencySelection', '8'], // combined urgency
    ['timeTypeCheckBox', '90'],    // 90th percentile
    ['timeTypeCheckBox', '50'],    // median
    ['timeTypeCheckBox', 'AVERAGE'],
    ['timeTypeCheckBox', 'FTP'],   // % within benchmark
    ['ifDisplayFacility', 'false'],
    ['ifDisplayPhysician', 'false'],
    ['anchor', 'WaitTimeInfo'],
  ];

  return params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// Parse wait time data from the HTML response of AccessGoalChart.do.
// The response may contain data tables with wait time metrics by zone/quarter,
// or chart images with underlying data in JavaScript/JSON blobs.
function parseWaitTimeTables(
  $: cheerio.CheerioAPI,
  procedureGroup: string,
  procedureName: string,
): SurgicalRecord[] {
  const records: SurgicalRecord[] = [];
  const sourceName = 'Alberta Wait Times Reporting';

  // Look for data tables in the response. The site renders wait time data
  // in tables with class "dataTable" or generic tables in the content area.
  const $tables = $('table.dataTable, table#waitTimeTable, .waitTimeTable table, #content table');

  $tables.each((_, tableEl) => {
    const $table = $(tableEl);
    const $headerCells = $table.find('thead th, tr:first-child th');

    // Find reporting period columns from header cells.
    const periodColumns: Array<{ col: number; period: { start: string; end: string } }> = [];
    $headerCells.each((i, th) => {
      const headerText = $(th).text().trim();
      const period = parseReportingPeriod(headerText);
      if (period) {
        periodColumns.push({ col: i, period });
      }
    });

    if (periodColumns.length === 0) return;

    // Parse data rows — each row represents a geography + metric combination.
    $table.find('tbody tr, tr').each((_, tr) => {
      const $row = $(tr);
      const $cells = $row.find('td');
      if ($cells.length === 0) return;

      // First cell is typically the geography or metric label.
      const firstCellText = $cells.first().text().trim();

      // Determine geography from the first cell.
      let geographyType: SurgicalRecord['geography_type'] = 'Province';
      let geographyName = 'Alberta';

      if (firstCellText.toLowerCase().includes('alberta') || firstCellText === 'All') {
        geographyType = 'Province';
        geographyName = 'Alberta';
      } else {
        for (const zone of ZONES) {
          if (firstCellText.includes(zone.replace(' Zone', ''))) {
            geographyType = 'Zone';
            geographyName = zone;
            break;
          }
        }
        if (geographyType === 'Province' && firstCellText && firstCellText !== 'All') {
          geographyType = 'Zone';
          geographyName = firstCellText;
        }
      }

      // Check if the first cell or second cell is a metric label.
      let metricLabel = '';
      let dataStartCol = 0;

      // If second cell contains a metric label, use it.
      if ($cells.length > 1) {
        const secondCellText = $($cells.get(1)).text().trim();
        const metric = normalizeMetricName(secondCellText);
        if (metric) {
          metricLabel = secondCellText;
          dataStartCol = 2;
        }
      }

      if (!metricLabel) {
        const metric = normalizeMetricName(firstCellText);
        if (metric) {
          metricLabel = firstCellText;
          dataStartCol = 1;
        }
      }

      const metricName = normalizeMetricName(metricLabel);
      if (!metricName) return;

      // Extract values from period columns.
      for (const { col, period } of periodColumns) {
        const dataCol = col + dataStartCol;
        if (dataCol >= $cells.length) continue;
        const rawValue = $($cells.get(dataCol)).text().trim();
        const value = parseMetricValue(rawValue);
        if (value === null) continue;

        const unit = inferUnit(rawValue + ' ' + metricLabel);

        records.push({
          id: `rec_${procedureGroup.toLowerCase().replace(/\s+/g, '_')}_${geographyName.toLowerCase().replace(/\s+/g, '_')}_${metricName.toLowerCase().replace(/\s+/g, '_')}_${period.start}`,
          source_name: sourceName,
          source_url: BASE_URL,
          reporting_period_start: period.start,
          reporting_period_end: period.end,
          geography_type: geographyType,
          geography_name: geographyName,
          procedure_group: procedureGroup,
          procedure_name: procedureName,
          wait_segment: 'Decision-to-surgery',
          metric_name: metricName,
          metric_value: value,
          unit,
        });
      }
    });
  });

  return records;
}

// Parse diagnostic imaging wait time data from the response.
// Maps CT/MRI scan data to FacilityImagingWait and ImagingWaitTrend shapes.
function parseDiagnosticTables(
  $: cheerio.CheerioAPI,
  modality: 'CT Scan' | 'MRI Scan',
): { facilities: FacilityImagingWait[]; trends: ImagingWaitTrend[] } {
  const facilities: FacilityImagingWait[] = [];
  const trends: ImagingWaitTrend[] = [];

  // Parse facility-level tables for P50/P90 wait days.
  const $tables = $('table.dataTable, table#waitTimeTable, .waitTimeTable table, #content table');

  $tables.each((_, tableEl) => {
    const $table = $(tableEl);
    const $rows = $table.find('tbody tr, tr');

    $rows.each((_, tr) => {
      const $cells = $(tr).find('td');
      if ($cells.length < 4) return;

      const firstCell = $cells.first().text().trim();

      // Try to parse as a facility row: name, P50, P90, volume.
      const facilityName = firstCell;
      if (!facilityName || facilityName === 'All' || /n\/a/i.test(facilityName)) return;

      // Look for P50 and P90 values in the row.
      const values: number[] = [];
      $cells.each((i, td) => {
        if (i === 0) return;
        const val = parseMetricValue($(td).text());
        if (val !== null) values.push(val);
      });

      if (values.length >= 2) {
        const p50 = values[0];
        const p90 = values[1];
        const volume = values.length >= 3 ? Math.round(values[2]) : 0;

        const facilityId = `FAC-${facilityName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const existing = facilities.find((f) => f.facilityId === facilityId);

        if (existing) {
          // Update the appropriate modality fields.
          if (modality === 'MRI Scan') {
            existing.mriP50WaitDays = p50;
            existing.mriP90WaitDays = p90;
            existing.annualCompletedExamsCount = volume || existing.annualCompletedExamsCount;
          } else {
            existing.ctP50WaitDays = p50;
            existing.ctP90WaitDays = p90;
            existing.annualCompletedExamsCount = volume || existing.annualCompletedExamsCount;
          }
        } else {
          const base: FacilityImagingWait = {
            facilityId,
            facilityName,
            city: '',
            zone: '',
            mriP50WaitDays: 0,
            mriP90WaitDays: 0,
            ctP50WaitDays: 0,
            ctP90WaitDays: 0,
            annualCompletedExamsCount: volume,
            scannerUtilizationPct: 0,
          };
          if (modality === 'MRI Scan') {
            base.mriP50WaitDays = p50;
            base.mriP90WaitDays = p90;
          } else {
            base.ctP50WaitDays = p50;
            base.ctP90WaitDays = p90;
          }
          facilities.push(base);
        }
      }
    });
  });

  // Parse trend tables — rows with year + P50/P90 for Alberta and Canada.
  $tables.each((_, tableEl) => {
    const $table = $(tableEl);
    const $rows = $table.find('tbody tr, tr');

    $rows.each((_, tr) => {
      const $cells = $(tr).find('td');
      if ($cells.length < 3) return;

      const yearText = $cells.first().text().trim();
      const yearMatch = yearText.match(/(\d{4})/);
      if (!yearMatch) return;
      const year = yearMatch[1];

      const values: number[] = [];
      $cells.each((i, td) => {
        if (i === 0) return;
        const val = parseMetricValue($(td).text());
        if (val !== null) values.push(val);
      });

      if (values.length >= 2) {
        trends.push({
          year,
          modality,
          albertaP50Days: values[0],
          albertaP90Days: values[1],
          canadaP50Days: values.length >= 3 ? values[2] : 0,
          canadaP90Days: values.length >= 4 ? values[3] : 0,
        });
      }
    });
  });

  return { facilities, trends };
}

// Merge new surgical records into existing data-surgical.json, replacing
// records with matching id and preserving all other top-level keys.
function mergeSurgicalData(newRecords: SurgicalRecord[], timestamp: string): number {
  type SurgicalJson = Record<string, unknown>;
  let existing: SurgicalJson = {};
  try {
    existing = JSON.parse(fs.readFileSync(SURGICAL_FILE, 'utf8')) as SurgicalJson;
  } catch {
    // File doesn't exist yet.
  }

  const existingRecords = Array.isArray(existing.SURGICAL_RECORDS)
    ? (existing.SURGICAL_RECORDS as SurgicalRecord[])
    : [];

  const byId = new Map<string, SurgicalRecord>();
  for (const record of existingRecords) {
    byId.set(record.id, record);
  }
  for (const record of newRecords) {
    byId.set(record.id, record);
  }

  const merged = Array.from(byId.values());
  existing.SURGICAL_RECORDS = merged;

  // Refresh _dataMetadata for SURGICAL_RECORDS; preserve all other entries
  // (sibling writers' and hand-authored arrays) via mergeDataMetadata.
  const ownedMetadata: DataMetadata = {
    SURGICAL_RECORDS: buildMetadataEntry({
      updateType: 'auto',
      source: 'Alberta Wait Times Reporting (waittimes.alberta.ca)',
      sourceVintage: 'Live provincial wait-times tables',
      lastUpdated: timestamp,
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
  );
  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(SURGICAL_FILE, JSON.stringify(existing, null, 2), 'utf8');
  return merged.length;
}

// Merge new diagnostic data into existing data-diagnostic.json.
function mergeDiagnosticData(
  newFacilities: FacilityImagingWait[],
  newTrends: ImagingWaitTrend[],
): { facilitiesWritten: number; trendsWritten: number } {
  type DiagnosticJson = Record<string, unknown>;
  let existing: DiagnosticJson = {};
  try {
    existing = JSON.parse(fs.readFileSync(DIAGNOSTIC_FILE, 'utf8')) as DiagnosticJson;
  } catch {
    // File doesn't exist yet.
  }

  // Merge facility imaging waits by facilityId.
  const existingFacilities = Array.isArray(existing.FACILITY_IMAGING_WAITS)
    ? (existing.FACILITY_IMAGING_WAITS as FacilityImagingWait[])
    : [];

  const facilityById = new Map<string, FacilityImagingWait>();
  for (const f of existingFacilities) {
    facilityById.set(f.facilityId, f);
  }
  for (const f of newFacilities) {
    const prev = facilityById.get(f.facilityId);
    if (prev) {
      facilityById.set(f.facilityId, {
        ...prev,
        ...f,
        mriP50WaitDays: f.mriP50WaitDays || prev.mriP50WaitDays,
        mriP90WaitDays: f.mriP90WaitDays || prev.mriP90WaitDays,
        ctP50WaitDays: f.ctP50WaitDays || prev.ctP50WaitDays,
        ctP90WaitDays: f.ctP90WaitDays || prev.ctP90WaitDays,
        annualCompletedExamsCount: f.annualCompletedExamsCount || prev.annualCompletedExamsCount,
      });
    } else {
      facilityById.set(f.facilityId, f);
    }
  }

  const mergedFacilities = Array.from(facilityById.values());
  existing.FACILITY_IMAGING_WAITS = mergedFacilities;

  // Merge imaging wait trends by year+modality.
  const existingTrends = Array.isArray(existing.IMAGING_WAIT_TRENDS)
    ? (existing.IMAGING_WAIT_TRENDS as ImagingWaitTrend[])
    : [];

  const trendByKey = new Map<string, ImagingWaitTrend>();
  for (const t of existingTrends) {
    trendByKey.set(`${t.year}|${t.modality}`, t);
  }
  for (const t of newTrends) {
    trendByKey.set(`${t.year}|${t.modality}`, t);
  }

  const mergedTrends = Array.from(trendByKey.values());
  existing.IMAGING_WAIT_TRENDS = mergedTrends;

  // Stamp metadata for the arrays this writer refreshes, preserving sibling
  // entries (LAB_LOCATION_WAITS, TEST_TURNAROUND_METRICS, PRIORITY_TARGET_COMPLIANCE,
  // CIHI_DIAGNOSTIC_WAIT_TIMES) owned by other diagnostic writers.
  const timestamp = new Date().toISOString();
  const ownedMetadata: DataMetadata = {
    FACILITY_IMAGING_WAITS: buildMetadataEntry({
      updateType: 'auto',
      source: 'waittimes.alberta.ca (AccessGoalChart.do)',
      sourceVintage: 'Live data',
      lastUpdated: timestamp,
      verification: 'CT/MRI facility wait times scraped from waittimes.alberta.ca per-zone tables.',
    }),
    IMAGING_WAIT_TRENDS: buildMetadataEntry({
      updateType: 'auto',
      source: 'waittimes.alberta.ca (AccessGoalChart.do)',
      sourceVintage: 'Live data',
      lastUpdated: timestamp,
      verification: 'CT/MRI wait-time trends scraped from waittimes.alberta.ca per-quarter tables.',
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
  );
  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(DIAGNOSTIC_FILE, JSON.stringify(existing, null, 2), 'utf8');
  return { facilitiesWritten: mergedFacilities.length, trendsWritten: mergedTrends.length };
}

// Fetch a procedure category's wait time data via POST to AccessGoalChart.do.
async function fetchCategoryData(rcatId: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const response = await axios.post(CHART_ENDPOINT, buildFormBody(rcatId), {
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': PROCEDURE_OVERVIEW_URL,
      },
      timeout: 20000,
      // The site may redirect or return chart frames.
      maxRedirects: 5,
    });

    if (!response.data || typeof response.data !== 'string') {
      return null;
    }
    return cheerio.load(response.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[WaitTimesScraper] Category ${rcatId} fetch failed: ${msg}`);
    return null;
  }
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[WaitTimesScraper] Starting waittimes.alberta.ca scrape...');

  try {
    // Step 1: Fetch the procedure overview page to verify the site is reachable.
    const overviewResponse = await axios.get(PROCEDURE_OVERVIEW_URL, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
      maxRedirects: 5,
    });

    if (!overviewResponse.data || typeof overviewResponse.data !== 'string') {
      throw new Error('Empty response from ProcedureOverview.jsp');
    }

    console.log('[WaitTimesScraper] Site reachable. Fetching surgical categories...');

    // Step 2: Fetch surgical procedure categories.
    const allSurgicalRecords: SurgicalRecord[] = [];
    for (const category of SURGICAL_CATEGORIES) {
      await rateLimitDelay();
      console.log(`[WaitTimesScraper] Fetching ${category.procedureGroup} (${category.procedureName})...`);

      const $ = await fetchCategoryData(category.rcatId);
      if (!$) continue;

      const records = parseWaitTimeTables($, category.procedureGroup, category.procedureName);
      console.log(`[WaitTimesScraper]   Parsed ${records.length} records`);
      allSurgicalRecords.push(...records);
    }

    // Step 3: Fetch diagnostic imaging categories (CT, MRI).
    const allDiagnosticFacilities: FacilityImagingWait[] = [];
    const allDiagnosticTrends: ImagingWaitTrend[] = [];

    for (const category of DIAGNOSTIC_CATEGORIES) {
      await rateLimitDelay();
      console.log(`[WaitTimesScraper] Fetching ${category.modality}...`);

      const $ = await fetchCategoryData(category.rcatId);
      if (!$) continue;

      const { facilities, trends } = parseDiagnosticTables($, category.modality);
      console.log(`[WaitTimesScraper]   Parsed ${facilities.length} facilities, ${trends.length} trends`);
      allDiagnosticFacilities.push(...facilities);
      allDiagnosticTrends.push(...trends);
    }

    // Step 4: Merge and write data.
    const surgicalWritten = allSurgicalRecords.length > 0
      ? mergeSurgicalData(allSurgicalRecords, timestamp)
      : 0;

    const diagnosticResult = allDiagnosticFacilities.length > 0 || allDiagnosticTrends.length > 0
      ? mergeDiagnosticData(allDiagnosticFacilities, allDiagnosticTrends)
      : { facilitiesWritten: 0, trendsWritten: 0 };

    const totalFetched = allSurgicalRecords.length + allDiagnosticFacilities.length + allDiagnosticTrends.length;
    const durationMs = Date.now() - startTime;

    // Determine status — if we got some data, it's success; if none, partial.
    const status: SyncResult['status'] = totalFetched > 0 ? 'success' : 'partial';

    console.log(
      `[WaitTimesScraper] Complete. ${allSurgicalRecords.length} surgical, ${allDiagnosticFacilities.length} diagnostic facilities, ${allDiagnosticTrends.length} trends. ${durationMs}ms`,
    );

    return {
      domain: 'surgical',
      pipeline: 'waittimesAlbertaScraper',
      status,
      recordsFetched: totalFetched,
      recordsWritten: surgicalWritten + diagnosticResult.facilitiesWritten + diagnosticResult.trendsWritten,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[WaitTimesScraper] FAILED:', errorMsg);

    return {
      domain: 'surgical',
      pipeline: 'waittimesAlbertaScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Re-export for rate-limited orchestration.
export { RATE_LIMIT_MS };
