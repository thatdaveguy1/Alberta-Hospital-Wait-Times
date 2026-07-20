// CIHI Wait Times Priority Procedures Downloader & Parser
// Downloads the CIHI "Wait Times for Priority Procedures in Canada" data-tables
// XLSX workbook, parses it with SheetJS (xlsx), and merges the extracted records
// into data-diagnostic.json (CT/MRI wait trends) and data-surgical.json
// (provincial comparators + historical wait trends).
//
// The workbook is a single long-format 'Table 1' worksheet with columns:
//   Reporting level | Province | Region | Indicator | Metric | Data year |
//   Unit of measurement | Indicator result
// We filter by Indicator / Metric / Province, pivot the long-format rows into
// the wide shapes consumed by the dashboard, and merge into the existing JSON
// files (preserving all other arrays). All failures are caught and returned as
// SyncResult — run() / runSurgical() never throw.
//
// Two exports are provided so the orchestrator can register one pipeline per
// domain while only downloading + parsing the workbook once per process:
//   - run()         -> domain 'diagnostic' (writes IMAGING_WAIT_TRENDS)
//   - runSurgical() -> domain 'surgical'   (writes CIHI_PROVINCIAL_COMPARATORS +
//                                           HISTORICAL_WAIT_TRENDS)

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type { ImagingWaitTrend } from '../diagnosticData';

const XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/wait-times-priority-procedures-in-canada-2008-2025-data-tables-en.xlsx';
const LANDING_URL = 'https://www.cihi.ca/en/wait-times-in-canada-2026';
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const IMAGING_INDICATORS: Record<string, true> = { 'CT Scan': true, 'MRI Scan': true };
const IMAGING_METRICS: Record<string, true> = { '50th percentile': true, '90th percentile': true };
const PROVINCES: Record<string, true> = { Alberta: true, Canada: true };

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const s = String(value).trim().replace(/[, ]/g, '');
  if (s.length === 0) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

// Extract the first 4-digit calendar year from a data-year cell
// (CIHI sometimes labels fiscal years as "2023-24"; we normalise to "2023").
function normaliseYear(raw: unknown): string | undefined {
  const s = asString(raw);
  if (!s) return undefined;
  const match = s.match(/\d{4}/);
  return match ? match[0] : s;
}

function deriveYearRange(years: (string | undefined)[]): string {
  const valid = years
    .filter((y): y is string => typeof y === 'string' && y.length > 0)
    .sort();
  if (valid.length === 0) return 'unknown';
  const first = valid[0];
  const last = valid[valid.length - 1];
  return first === last ? first : `${first}\u2013${last}`;
}

interface ParsedWorkbook {
  imaging: ImagingWaitTrend[];
  provincialComparators: ProvincialComparator[];
  comparatorYears: string[];
  historicalWaitTrends: HistoricalWaitTrend[];
}

// Module-level cache so run() and runSurgical() share a single download + parse
// per process. Reset on failure so a retry re-fetches.
let cachedParse: ParsedWorkbook | null = null;

// Read a worksheet into a 2D array of cell values (first row = row 1).
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  // CIHI workbooks can have a !ref spanning 16K+ columns (e.g. A1:XFC20511)
  // even though only the first 8 columns carry data. sheet_to_json iterates
  // every cell in the range, so we clamp the range to the first 10 columns
  // to avoid a 336-million-cell scan that hangs indefinitely.
  const originalRef = sheet['!ref'];
  if (originalRef) {
    const decoded = XLSX.utils.decode_range(originalRef);
    if (decoded.e.c > 9) {
      decoded.e.c = 9; // clamp to columns A–J
      sheet['!ref'] = XLSX.utils.encode_range(decoded);
    }
  }
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
}

// Find the index of the first row that looks like the long-format header row.
function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = rows[i].map((c) => asString(c)?.toLowerCase() ?? '');
    const joined = cells.join('|');
    if (
      joined.includes('indicator') &&
      joined.includes('metric') &&
      (joined.includes('data year') || joined.includes('year')) &&
      (joined.includes('province') || joined.includes('region'))
    ) {
      return i;
    }
  }
  return -1;
}

interface ColumnMap {
  province: number;
  indicator: number;
  metric: number;
  year: number;
  result: number;
  /** Present only when the sheet has a Reporting level column. */
  reportingLevel?: number;
}

function buildColumnMap(header: unknown[]): ColumnMap | null {
  const lowers = header.map((c) => asString(c)?.toLowerCase() ?? '');
  const find = (fragments: string[]): number =>
    lowers.findIndex((h) => fragments.every((f) => h.includes(f)));

  const province = find(['province']);
  const indicator = find(['indicator']);
  const metric = find(['metric']);
  const year = find(['year']);
  const result = find(['result']);
  const reportingLevelIdx = find(['reporting', 'level']);

  if (province < 0 || indicator < 0 || metric < 0 || year < 0 || result < 0) {
    return null;
  }
  const map: ColumnMap = { province, indicator, metric, year, result };
  if (reportingLevelIdx >= 0) map.reportingLevel = reportingLevelIdx;
  return map;
}

interface LongRow {
  province: string;
  indicator: string;
  metric: string;
  /** Raw data-year cell — not collapsed via normaliseYear (keeps 2019FY / 2019Q3Q4 distinct). */
  year: string;
  result: number;
  /**
   * Set only when the sheet has a Reporting level column (empty cell → '').
   * Absent entirely when the column is missing so builders can keep province-only behaviour.
   */
  reportingLevel?: string;
}

const CALENDAR_YEAR_RE = /^\d{4}$/;

function isCalendarYear(year: string): boolean {
  return CALENDAR_YEAR_RE.test(year);
}

/** Values containing "provincial" or "province" (e.g. Provincial, Province/territory). */
function isProvincialReportingLevel(level: string): boolean {
  const lower = level.toLowerCase();
  return lower.includes('provincial') || lower.includes('province');
}

/** True when extract captured a Reporting level column on the sheet. */
function sheetHasReportingLevel(rows: LongRow[]): boolean {
  return rows.some((r) => r.reportingLevel !== undefined);
}

function isProvincialRow(row: LongRow, reportingLevelAvailable: boolean): boolean {
  if (!reportingLevelAvailable) return true;
  return isProvincialReportingLevel(row.reportingLevel ?? '');
}

/** Comparator geographies: provinces must be provincial; Canada/national rows are national-level. */
function isComparatorGeographyRow(row: LongRow, reportingLevelAvailable: boolean): boolean {
  if (!reportingLevelAvailable) return true;
  if (row.province === 'Canada') {
    const lower = (row.reportingLevel ?? '').toLowerCase();
    return (
      lower.includes('canada') ||
      lower.includes('national') ||
      lower.length === 0 ||
      isProvincialReportingLevel(row.reportingLevel ?? '')
    );
  }
  return isProvincialReportingLevel(row.reportingLevel ?? '');
}

function isWithinBenchmarkMetric(metric: string): boolean {
  const lower = metric.toLowerCase();
  return (
    lower.includes('% meeting benchmark') ||
    lower.includes('meeting benchmark') ||
    lower.includes('% within benchmark') ||
    lower.includes('within benchmark')
  );
}

function isMedianMetric(metric: string): boolean {
  const lower = metric.toLowerCase();
  return lower.includes('50th percentile') || lower.includes('median');
}

/** Exact / full CIHI indicator labels — avoids bare "ct"/"hip" substring hazards. */
const HISTORICAL_PROCEDURES: { match: string; label: string }[] = [
  { match: 'Hip Replacement', label: 'Hip Replacement' },
  { match: 'Knee Replacement', label: 'Knee Replacement' },
  { match: 'Cataract Surgery', label: 'Cataract Surgery' },
  { match: 'MRI Scan', label: 'MRI Scan' },
  { match: 'CT Scan', label: 'CT Scan' },
];

function matchHistoricalProcedure(indicator: string): string | undefined {
  const lower = indicator.trim().toLowerCase();
  for (const { match, label } of HISTORICAL_PROCEDURES) {
    if (lower === match.toLowerCase()) return label;
  }
  return undefined;
}

function extractLongRows(workbook: XLSX.WorkBook): LongRow[] {
  // Prefer a sheet named like 'Table 1'; otherwise scan every sheet and use the
  // first one whose header row resolves to the expected column set.
  const sheetNames = workbook.SheetNames;
  let chosen: XLSX.WorkSheet | null = null;
  for (const name of sheetNames) {
    if (/table\s*1/i.test(name)) {
      chosen = workbook.Sheets[name];
      break;
    }
  }
  if (!chosen) {
    for (const name of sheetNames) {
      const rows = sheetToRows(workbook.Sheets[name]);
      const headerIdx = findHeaderRow(rows);
      if (headerIdx >= 0 && buildColumnMap(rows[headerIdx])) {
        chosen = workbook.Sheets[name];
        break;
      }
    }
  }
  if (!chosen) return [];

  const rows = sheetToRows(chosen);
  const headerIdx = findHeaderRow(rows);
  if (headerIdx < 0) return [];
  const map = buildColumnMap(rows[headerIdx]);
  if (!map) return [];

  const out: LongRow[] = [];
  const hasReportingLevelCol = map.reportingLevel !== undefined;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const province = asString(row[map.province]);
    const indicator = asString(row[map.indicator]);
    const metric = asString(row[map.metric]);
    // Preserve the raw year string so FY/Q3Q4 rows are not collapsed into calendar keys.
    const year = asString(row[map.year]);
    const result = asNumber(row[map.result]);
    if (!province || !indicator || !metric || !year || result === undefined) continue;
    const longRow: LongRow = { province, indicator, metric, year, result };
    if (hasReportingLevelCol) {
      longRow.reportingLevel = asString(row[map.reportingLevel!]) ?? '';
    }
    out.push(longRow);
  }
  return out;
}

// Pivot long-format imaging rows into IMAGING_WAIT_TRENDS.
function buildImagingTrends(rows: LongRow[]): ImagingWaitTrend[] {
  interface Acc {
    modality: 'CT Scan' | 'MRI Scan';
    albertaP50?: number;
    albertaP90?: number;
    canadaP50?: number;
    canadaP90?: number;
  }
  const accMap = new Map<string, Acc>();

  for (const r of rows) {
    if (!(r.indicator in IMAGING_INDICATORS)) continue;
    if (!(r.metric in IMAGING_METRICS)) continue;
    if (!(r.province in PROVINCES)) continue;
    // Imaging trends still collapse fiscal-style labels (e.g. 2023-24 → 2023).
    const year = normaliseYear(r.year);
    if (!year) continue;

    const key = `${year}|${r.indicator}`;
    let acc = accMap.get(key);
    if (!acc) {
      acc = { modality: r.indicator as 'CT Scan' | 'MRI Scan' };
      accMap.set(key, acc);
    }
    const isP50 = r.metric === '50th percentile';
    if (r.province === 'Alberta') {
      if (isP50) acc.albertaP50 = r.result;
      else acc.albertaP90 = r.result;
    } else if (r.province === 'Canada') {
      if (isP50) acc.canadaP50 = r.result;
      else acc.canadaP90 = r.result;
    }
  }

  const out: ImagingWaitTrend[] = [];
  for (const [key, acc] of accMap) {
    const year = key.split('|')[0];
    if (
      acc.albertaP50 === undefined ||
      acc.albertaP90 === undefined ||
      acc.canadaP50 === undefined ||
      acc.canadaP90 === undefined
    ) {
      continue; // skip incomplete groups — never write partial/garbage rows
    }
    out.push({
      year,
      modality: acc.modality,
      albertaP50Days: acc.albertaP50,
      albertaP90Days: acc.albertaP90,
      canadaP50Days: acc.canadaP50,
      canadaP90Days: acc.canadaP90,
    });
  }
  out.sort((a, b) =>
    a.year === b.year ? a.modality.localeCompare(b.modality) : a.year.localeCompare(b.year),
  );
  return out;
}

// Provincial comparators: hip/knee/cataract within-benchmark % + MRI median wait days
interface ProvincialComparator {
  province: string;
  hip_within_benchmark: number;
  knee_within_benchmark: number;
  cataract_within_benchmark: number;
  mri_median_wait_days: number;
}

const PROVINCE_COMPARATOR_NAMES: Record<string, true> = {
  'Alberta': true, 'British Columbia': true, 'Saskatchewan': true,
  'Manitoba': true, 'Ontario': true, 'Quebec': true, 'Canada': true,
};
function buildProvincialComparators(rows: LongRow[]): { comparators: ProvincialComparator[]; comparatorYears: string[] } {
  type Acc = {
    hip?: number; hipYear?: string;
    knee?: number; kneeYear?: string;
    cataract?: number; cataractYear?: string;
    mri?: number; mriYear?: string;
  };
  const accMap = new Map<string, Acc>();
  const reportingLevelAvailable = sheetHasReportingLevel(rows);

  const takeLatest = (
    acc: Acc,
    valueKey: 'hip' | 'knee' | 'cataract' | 'mri',
    yearKey: 'hipYear' | 'kneeYear' | 'cataractYear' | 'mriYear',
    row: LongRow,
  ): void => {
    const prevYear = acc[yearKey];
    if (prevYear !== undefined && row.year <= prevYear) return;
    acc[valueKey] = row.result;
    acc[yearKey] = row.year;
  };

  for (const row of rows) {
    if (!PROVINCE_COMPARATOR_NAMES[row.province]) continue;
    if (!isComparatorGeographyRow(row, reportingLevelAvailable)) continue;
    if (!isCalendarYear(row.year)) continue; // ignore 2019FY / 2019Q3Q4 etc.

    const withinBenchmark = isWithinBenchmarkMetric(row.metric);
    const median = isMedianMetric(row.metric);
    if (!withinBenchmark && !median) continue;

    let acc = accMap.get(row.province);
    if (!acc) { acc = {}; accMap.set(row.province, acc); }

    const indicator = row.indicator.trim().toLowerCase();
    if (indicator === 'hip replacement' && withinBenchmark) takeLatest(acc, 'hip', 'hipYear', row);
    else if (indicator === 'knee replacement' && withinBenchmark) takeLatest(acc, 'knee', 'kneeYear', row);
    else if (indicator === 'cataract surgery' && withinBenchmark) takeLatest(acc, 'cataract', 'cataractYear', row);
    else if (indicator === 'mri scan' && median) takeLatest(acc, 'mri', 'mriYear', row);
  }

  const out: ProvincialComparator[] = [];
  const comparatorYears = new Set<string>();
  for (const [province, acc] of accMap) {
    if (acc.hip === undefined && acc.knee === undefined && acc.cataract === undefined && acc.mri === undefined) continue;
    if (acc.hip !== undefined && acc.hipYear) comparatorYears.add(acc.hipYear);
    if (acc.knee !== undefined && acc.kneeYear) comparatorYears.add(acc.kneeYear);
    if (acc.cataract !== undefined && acc.cataractYear) comparatorYears.add(acc.cataractYear);
    if (acc.mri !== undefined && acc.mriYear) comparatorYears.add(acc.mriYear);
    out.push({
      province: province === 'Canada' ? 'National Average' : province,
      hip_within_benchmark: acc.hip ?? 0,
      knee_within_benchmark: acc.knee ?? 0,
      cataract_within_benchmark: acc.cataract ?? 0,
      mri_median_wait_days: acc.mri ?? 0,
    });
  }
  return { comparators: out, comparatorYears: Array.from(comparatorYears).sort() };
}

// Historical wait trends: yearly median wait days for hip/knee/cataract/MRI/CT
interface HistoricalWaitTrend {
  year: string;
  procedure: string;
  medianWaitDays: number;
}

function buildHistoricalWaitTrends(rows: LongRow[]): HistoricalWaitTrend[] {
  const seen = new Set<string>();
  const out: HistoricalWaitTrend[] = [];
  const reportingLevelAvailable = sheetHasReportingLevel(rows);

  for (const row of rows) {
    if (row.province !== 'Alberta') continue;
    if (!isProvincialRow(row, reportingLevelAvailable)) continue;
    if (!isMedianMetric(row.metric)) continue;
    // Require pure calendar years — do not let FY/Q3Q4 collapse into calendar keys.
    if (!isCalendarYear(row.year)) continue;

    const label = matchHistoricalProcedure(row.indicator);
    if (!label) continue;

    const dedupKey = `${row.year}-${label}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    out.push({ year: row.year, procedure: label, medianWaitDays: row.result });
  }
  out.sort((a, b) => a.year.localeCompare(b.year) || a.procedure.localeCompare(b.procedure));
  return out;
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedWorkbook {
  const rows = extractLongRows(workbook);
  const { comparators, comparatorYears } = buildProvincialComparators(rows);
  return {
    imaging: buildImagingTrends(rows),
    provincialComparators: comparators,
    comparatorYears,
    historicalWaitTrends: buildHistoricalWaitTrends(rows),
  };
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': USER_AGENT },
    timeout: 60000,
    maxContentLength: 80 * 1024 * 1024,
  });
  return Buffer.from(response.data as ArrayBuffer);
}

// Download (rate-limited) + parse the workbook once, caching the result for the
// lifetime of the process so run() and runSurgical() share a single network call.
async function getParsedWorkbook(): Promise<ParsedWorkbook> {
  if (cachedParse) return cachedParse;
  await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
  console.log('[CIHIWaitTimes] Downloading priority procedures workbook');
  const buffer = await downloadBuffer(XLSX_URL);
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const parsed = parseWorkbook(workbook);
    cachedParse = parsed;
    console.log(
      `[CIHIWaitTimes] Parsed: imaging=${parsed.imaging.length} comparators=${parsed.provincialComparators.length} historical=${parsed.historicalWaitTrends.length}`,
    );
    return parsed;
  } finally {
    // No temp file to clean up — XLSX.read parses directly from buffer
  }
}

interface LoadedJson {
  [key: string]: unknown;
}

function loadJsonFile(file: string): LoadedJson {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LoadedJson;
    }
  } catch {
    /* file missing or invalid — start empty */
  }
  return {};
}
// Merge new arrays into an existing JSON object, only overwriting keys that
// carry non-empty new data. When `ownedMetadata` is supplied, stamp those
// entries into `_dataMetadata` (preserving sibling writers' entries via
// mergeDataMetadata) for every array actually refreshed this run. Returns the
// number of records written.
function mergeAndWrite(
  file: string,
  newPartial: LoadedJson,
  ownedMetadata?: DataMetadata,
): number {
  const existing = loadJsonFile(file);
  let written = 0;
  const refreshedKeys: string[] = [];
  for (const [key, value] of Object.entries(newPartial)) {
    if (Array.isArray(value) && value.length > 0) {
      existing[key] = value;
      written += value.length;
      refreshedKeys.push(key);
    }
  }
  if (written > 0) {
    if (ownedMetadata) {
      // Only stamp metadata for arrays actually refreshed this run.
      const stamped: DataMetadata = {};
      for (const key of refreshedKeys) {
        if (key in ownedMetadata) stamped[key] = ownedMetadata[key];
      }
      if (Object.keys(stamped).length > 0) {
        existing._dataMetadata = mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          stamped,
          refreshedKeys,
        );
      }
    }
    applyWithheldPayloadGuard(existing);
    fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
  }
  return written;
}

// Diagnostic domain: CT/MRI wait-time trends.
export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CIHIWaitTimes] Starting diagnostic (CT/MRI) pipeline');

  try {
    const parsed = await getParsedWorkbook();
    const recordsFetched = parsed.imaging.length;
    if (recordsFetched === 0) {
      console.warn('[CIHIWaitTimes] No CT/MRI rows extracted — leaving data-diagnostic.json unchanged.');
      return {
        domain: 'diagnostic',
        pipeline: 'cihiWaitTimesDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No CT/MRI wait-time rows matched the expected shape',
      };
    }

    const imagingYearRange = deriveYearRange(parsed.imaging.map((r) => r.year));
    const recordsWritten = mergeAndWrite(
      DIAGNOSTIC_FILE,
      {
        IMAGING_WAIT_TRENDS: parsed.imaging,
      },
      {
        IMAGING_WAIT_TRENDS: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: imagingYearRange,
          lastUpdated: timestamp,
        }),
      },
    );
    const status: SyncResult['status'] = recordsWritten > 0 ? 'success' : 'skipped';
    console.log(
      `[CIHIWaitTimes] Diagnostic complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'diagnostic',
      pipeline: 'cihiWaitTimesDownloader',
      status,
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CIHIWaitTimes] Diagnostic FAILED:', errorMsg);
    cachedParse = null; // allow retry on next call
    return {
      domain: 'diagnostic',
      pipeline: 'cihiWaitTimesDownloader',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Surgical domain: provincial comparators + historical wait trends.
export async function runSurgical(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CIHIWaitTimes] Starting surgical (comparators + historical) pipeline');

  try {
    const parsed = await getParsedWorkbook();
    const recordsFetched = parsed.provincialComparators.length + parsed.historicalWaitTrends.length;
    if (recordsFetched === 0) {
      console.warn('[CIHIWaitTimes] No surgical comparator/historical rows extracted — leaving data-surgical.json unchanged.');
      return {
        domain: 'surgical',
        pipeline: 'cihiWaitTimesDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No provincial comparator / historical wait trend rows matched the expected shape',
      };
    }

    const newPartial: LoadedJson = {};
    if (parsed.provincialComparators.length > 0) {
      newPartial.CIHI_PROVINCIAL_COMPARATORS = parsed.provincialComparators;
    }
    if (parsed.historicalWaitTrends.length > 0) {
      newPartial.HISTORICAL_WAIT_TRENDS = parsed.historicalWaitTrends;
    }
    const ownedMetadata: DataMetadata = {};
    if (parsed.provincialComparators.length > 0) {
      ownedMetadata.CIHI_PROVINCIAL_COMPARATORS = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Wait Times Priority Procedures in Canada',
        sourceVintage: `${parsed.comparatorYears.join(', ') || 'unknown'} (CIHI priority-procedure comparator years; annual)`,
        lastUpdated: timestamp,
      });
    }
    if (parsed.historicalWaitTrends.length > 0) {
      const historicalRange = deriveYearRange(parsed.historicalWaitTrends.map((r) => r.year));
      ownedMetadata.HISTORICAL_WAIT_TRENDS = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Wait Times Priority Procedures in Canada',
        sourceVintage: historicalRange,
        lastUpdated: timestamp,
      });
    }
    const recordsWritten = mergeAndWrite(SURGICAL_FILE, newPartial, ownedMetadata);
    const status: SyncResult['status'] = recordsWritten > 0 ? 'success' : 'skipped';
    console.log(
      `[CIHIWaitTimes] Surgical complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'surgical',
      pipeline: 'cihiWaitTimesDownloader',
      status,
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CIHIWaitTimes] Surgical FAILED:', errorMsg);
    cachedParse = null;
    return {
      domain: 'surgical',
      pipeline: 'cihiWaitTimesDownloader',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Landing page reference (documented source; not scraped — XLSX URL is stable).
export const LANDING_PAGE_URL = LANDING_URL;

// CLI entry point: run diagnostic + surgical when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.all([run(), runSurgical()])
    .then(([diag, surgical]) => {
      console.log('[CIHIWaitTimes] CLI results:', { diagnostic: diag, surgical });
    })
    .catch((err) => {
      console.error('[CIHIWaitTimes] CLI fatal:', err);
      process.exit(1);
    });
}
