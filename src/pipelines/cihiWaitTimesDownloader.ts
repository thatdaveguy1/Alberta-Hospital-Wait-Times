// CIHI Wait Times Priority Procedures Downloader & Parser
// Downloads the CIHI "Wait Times for Priority Procedures in Canada" data-tables
// XLSX workbook, parses it with SheetJS (xlsx), and merges the extracted records
// into data-diagnostic.json (CT/MRI wait trends) and data-cancer.json (cancer
// surgery wait trends + radiation therapy compliance).
//
// The workbook is a single long-format 'Table 1' worksheet with columns:
//   Reporting level | Province | Region | Indicator | Metric | Data year |
//   Unit of measurement | Indicator result
// We filter by Indicator / Metric / Province, pivot the long-format rows into
// the wide shapes consumed by the dashboard, and merge into the existing JSON
// files (preserving all other arrays). All failures are caught and returned as
// SyncResult — run() / runCancer() never throw.
//
// Two exports are provided so the orchestrator can register one pipeline per
// domain while only downloading + parsing the workbook once per process:
//   - run()       -> domain 'diagnostic' (writes IMAGING_WAIT_TRENDS)
//   - runCancer() -> domain 'cancer'      (writes CANCER_SURGERY_WAIT_TRENDS +
//                                           RADIATION_THERAPY_WAIT_TRENDS)

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type { ImagingWaitTrend } from '../diagnosticData';
import type {
  CancerSurgeryWaitTrend,
  RadiationTherapyCompliance,
} from '../cancerData';

const XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/wait-times-priority-procedures-in-canada-2008-2025-data-tables-en.xlsx';
const LANDING_URL = 'https://www.cihi.ca/en/wait-times-in-canada-2026';
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const CANCER_FILE = path.join(process.cwd(), 'data-cancer.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const IMAGING_INDICATORS: Record<string, true> = { 'CT Scan': true, 'MRI Scan': true };
const IMAGING_METRICS: Record<string, true> = { '50th percentile': true, '90th percentile': true };
const SURGERY_INDICATOR_TO_TYPE: Record<string, CancerSurgeryWaitTrend['cancerType']> = {
  'Bladder Cancer Surgery': 'Bladder',
  'Breast Cancer Surgery': 'Breast',
  'Colorectal Cancer Surgery': 'Colorectal',
  'Lung Cancer Surgery': 'Lung',
  'Prostate Cancer Surgery': 'Prostate',
};
const SURGERY_METRICS: Record<string, true> = {
  '50th percentile': true,
  '90th percentile': true,
  Volume: true,
};
const RADIATION_INDICATOR = 'Radiation Therapy';
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

interface ParsedWorkbook {
  imaging: ImagingWaitTrend[];
  cancerSurgery: CancerSurgeryWaitTrend[];
  radiation: RadiationTherapyCompliance[];
  provincialComparators: ProvincialComparator[];
  historicalWaitTrends: HistoricalWaitTrend[];
}

// Module-level cache so run() and runCancer() share a single download + parse
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

  if (province < 0 || indicator < 0 || metric < 0 || year < 0 || result < 0) {
    return null;
  }
  return { province, indicator, metric, year, result };
}

interface LongRow {
  province: string;
  indicator: string;
  metric: string;
  year: string;
  result: number;
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
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const province = asString(row[map.province]);
    const indicator = asString(row[map.indicator]);
    const metric = asString(row[map.metric]);
    const year = normaliseYear(row[map.year]);
    const result = asNumber(row[map.result]);
    if (!province || !indicator || !metric || !year || result === undefined) continue;
    out.push({ province, indicator, metric, year, result });
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

    const key = `${r.year}|${r.indicator}`;
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

// Pivot long-format cancer-surgery rows into CANCER_SURGERY_WAIT_TRENDS.
function buildCancerSurgeryTrends(rows: LongRow[]): CancerSurgeryWaitTrend[] {
  interface Acc {
    cancerType: CancerSurgeryWaitTrend['cancerType'];
    albertaP50?: number;
    albertaP90?: number;
    canadaP50?: number;
    canadaP90?: number;
    albertaVolume?: number;
    canadaVolume?: number;
  }
  const accMap = new Map<string, Acc>();

  for (const r of rows) {
    const cancerType = SURGERY_INDICATOR_TO_TYPE[r.indicator];
    if (!cancerType) continue;
    if (!(r.metric in SURGERY_METRICS)) continue;
    if (!(r.province in PROVINCES)) continue;

    const key = `${r.year}|${cancerType}`;
    let acc = accMap.get(key);
    if (!acc) {
      acc = { cancerType };
      accMap.set(key, acc);
    }
    if (r.metric === 'Volume') {
      if (r.province === 'Alberta') acc.albertaVolume = r.result;
      else if (r.province === 'Canada') acc.canadaVolume = r.result;
    } else {
      const isP50 = r.metric === '50th percentile';
      if (r.province === 'Alberta') {
        if (isP50) acc.albertaP50 = r.result;
        else acc.albertaP90 = r.result;
      } else if (r.province === 'Canada') {
        if (isP50) acc.canadaP50 = r.result;
        else acc.canadaP90 = r.result;
      }
    }
  }

  const out: CancerSurgeryWaitTrend[] = [];
  for (const [key, acc] of accMap) {
    const year = key.split('|')[0];
    // Wait-day percentiles are required; volume falls back to Alberta then Canada.
    if (
      acc.albertaP50 === undefined ||
      acc.albertaP90 === undefined ||
      acc.canadaP50 === undefined ||
      acc.canadaP90 === undefined
    ) {
      continue;
    }
    const completedVolume = acc.albertaVolume ?? acc.canadaVolume ?? 0;
    out.push({
      year,
      cancerType: acc.cancerType,
      albertaP50Days: acc.albertaP50,
      albertaP90Days: acc.albertaP90,
      canadaP50Days: acc.canadaP50,
      canadaP90Days: acc.canadaP90,
      completedVolume,
    });
  }
  out.sort((a, b) =>
    a.year === b.year
      ? a.cancerType.localeCompare(b.cancerType)
      : a.year.localeCompare(b.year),
  );
  return out;
}

// Pivot long-format radiation-therapy rows into RADIATION_THERAPY_WAIT_TRENDS.
function buildRadiationTrends(rows: LongRow[]): RadiationTherapyCompliance[] {
  interface Acc {
    albertaP50?: number;
    albertaP90?: number;
    albertaPct?: number;
    canadaPct?: number;
  }
  const accMap = new Map<string, Acc>();

  for (const r of rows) {
    if (r.indicator !== RADIATION_INDICATOR) continue;
    const metricNorm = r.metric.toLowerCase().includes('benchmark')
      ? 'benchmark'
      : r.metric;
    if (metricNorm !== 'benchmark' && !(r.metric in IMAGING_METRICS)) continue;
    if (!(r.province in PROVINCES)) continue;

    let acc = accMap.get(r.year);
    if (!acc) {
      acc = {};
      accMap.set(r.year, acc);
    }
    if (metricNorm === 'benchmark') {
      if (r.province === 'Alberta') acc.albertaPct = r.result;
      else if (r.province === 'Canada') acc.canadaPct = r.result;
    } else if (r.metric === '50th percentile') {
      if (r.province === 'Alberta') acc.albertaP50 = r.result;
    } else if (r.metric === '90th percentile') {
      if (r.province === 'Alberta') acc.albertaP90 = r.result;
    }
  }

  const out: RadiationTherapyCompliance[] = [];
  for (const [year, acc] of accMap) {
    if (
      acc.albertaPct === undefined ||
      acc.canadaPct === undefined ||
      acc.albertaP50 === undefined ||
      acc.albertaP90 === undefined
    ) {
      continue;
    }
    out.push({
      year,
      albertaPctWithinBenchmark: acc.albertaPct,
      canadaPctWithinBenchmark: acc.canadaPct,
      albertaP50WaitDays: acc.albertaP50,
      albertaP90WaitDays: acc.albertaP90,
    });
  }
  out.sort((a, b) => a.year.localeCompare(b.year));
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

function buildProvincialComparators(rows: LongRow[]): ProvincialComparator[] {
  // CIHI uses "% within benchmark" metric for hip/knee/cataract
  // and "50th percentile" for MRI median wait days
  const accMap = new Map<string, { hip?: number; knee?: number; cataract?: number; mri?: number }>();
  for (const row of rows) {
    if (!PROVINCE_COMPARATOR_NAMES[row.province]) continue;
    const isWithinBenchmark = row.metric.includes('% within benchmark') || row.metric.includes('within benchmark');
    const isMedian = row.metric.includes('50th percentile') || row.metric.includes('median');
    if (!isWithinBenchmark && !isMedian) continue;

    let acc = accMap.get(row.province);
    if (!acc) { acc = {}; accMap.set(row.province, acc); }

    if (row.indicator.toLowerCase().includes('hip') && isWithinBenchmark) acc.hip = row.result;
    else if (row.indicator.toLowerCase().includes('knee') && isWithinBenchmark) acc.knee = row.result;
    else if (row.indicator.toLowerCase().includes('cataract') && isWithinBenchmark) acc.cataract = row.result;
    else if (row.indicator.toLowerCase().includes('mri') && isMedian) acc.mri = row.result;
  }

  const out: ProvincialComparator[] = [];
  for (const [province, acc] of accMap) {
    if (acc.hip === undefined && acc.knee === undefined && acc.cataract === undefined && acc.mri === undefined) continue;
    out.push({
      province: province === 'Canada' ? 'National Average' : province,
      hip_within_benchmark: acc.hip ?? 0,
      knee_within_benchmark: acc.knee ?? 0,
      cataract_within_benchmark: acc.cataract ?? 0,
      mri_median_wait_days: acc.mri ?? 0,
    });
  }
  return out;
}

// Historical wait trends: yearly median wait days for hip/knee/cataract/MRI/CT
interface HistoricalWaitTrend {
  year: string;
  procedure: string;
  medianWaitDays: number;
}

function buildHistoricalWaitTrends(rows: LongRow[]): HistoricalWaitTrend[] {
  const PROCEDURES: Record<string, string> = {
    'hip': 'Hip Replacement',
    'knee': 'Knee Replacement',
    'cataract': 'Cataract Surgery',
    'mri': 'MRI Scan',
    'ct': 'CT Scan',
  };
  const seen = new Set<string>();
  const out: HistoricalWaitTrend[] = [];
  for (const row of rows) {
    if (row.province !== 'Alberta') continue;
    if (!row.metric.includes('50th percentile') && !row.metric.includes('median')) continue;
    const indicatorLower = row.indicator.toLowerCase();
    for (const [key, label] of Object.entries(PROCEDURES)) {
      if (indicatorLower.includes(key)) {
        const dedupKey = `${row.year}-${label}`;
        if (seen.has(dedupKey)) break;
        seen.add(dedupKey);
        out.push({ year: row.year, procedure: label, medianWaitDays: row.result });
        break;
      }
    }
  }
  out.sort((a, b) => a.year.localeCompare(b.year) || a.procedure.localeCompare(b.procedure));
  return out;
}

function parseWorkbook(workbook: XLSX.WorkBook): ParsedWorkbook {
  const rows = extractLongRows(workbook);
  return {
    imaging: buildImagingTrends(rows),
    cancerSurgery: buildCancerSurgeryTrends(rows),
    radiation: buildRadiationTrends(rows),
    provincialComparators: buildProvincialComparators(rows),
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
// lifetime of the process so run() and runCancer() share a single network call.
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
      `[CIHIWaitTimes] Parsed: imaging=${parsed.imaging.length} surgery=${parsed.cancerSurgery.length} radiation=${parsed.radiation.length}`,
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
        );
      }
    }
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

    const recordsWritten = mergeAndWrite(DIAGNOSTIC_FILE, {
      IMAGING_WAIT_TRENDS: parsed.imaging,
    });
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

// Cancer domain: cancer surgery wait trends + radiation therapy compliance.
export async function runCancer(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CIHIWaitTimes] Starting cancer (surgery + radiation) pipeline');

  try {
    const parsed = await getParsedWorkbook();
    const recordsFetched = parsed.cancerSurgery.length + parsed.radiation.length;
    if (recordsFetched === 0) {
      console.warn('[CIHIWaitTimes] No cancer surgery/radiation rows extracted — leaving data-cancer.json unchanged.');
      return {
        domain: 'cancer',
        pipeline: 'cihiWaitTimesDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No cancer surgery / radiation therapy rows matched the expected shape',
      };
    }

    const recordsWritten = mergeAndWrite(
      CANCER_FILE,
      {
        CANCER_SURGERY_WAIT_TRENDS: parsed.cancerSurgery,
        RADIATION_THERAPY_WAIT_TRENDS: parsed.radiation,
      },
      {
        CANCER_SURGERY_WAIT_TRENDS: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: '2013–2025',
          lastUpdated: timestamp,
        }),
        RADIATION_THERAPY_WAIT_TRENDS: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: '2010–2025',
          lastUpdated: timestamp,
        }),
      },
    );
    const status: SyncResult['status'] = recordsWritten > 0 ? 'success' : 'skipped';
    console.log(
      `[CIHIWaitTimes] Cancer complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'cancer',
      pipeline: 'cihiWaitTimesDownloader',
      status,
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CIHIWaitTimes] Cancer FAILED:', errorMsg);
    cachedParse = null;
    return {
      domain: 'cancer',
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
    const recordsWritten = mergeAndWrite(SURGICAL_FILE, newPartial);
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

// CLI entry point: run all domains when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  Promise.all([run(), runCancer(), runSurgical()])
    .then(([diag, cancer, surgical]) => {
      console.log('[CIHIWaitTimes] CLI results:', { diagnostic: diag, cancer, surgical });
    })
    .catch((err) => {
      console.error('[CIHIWaitTimes] CLI fatal:', err);
      process.exit(1);
    });
}
