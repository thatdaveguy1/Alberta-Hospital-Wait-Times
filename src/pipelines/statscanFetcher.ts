// Statistics Canada Web Data Service (WDS) Fetcher Pipeline
//
// Downloads StatCan table 14100371 ("Job vacancies, payroll employees, and
// job vacancy rate by provinces and territories, monthly, unadjusted") via the
// WDS REST "getFullTableDownloadCSV" flow, parses the CSV, filters Alberta
// rows, aggregates the monthly observations into quarterly buckets, and merges
// the result into data-workforce.json under JOB_VACANCY_TRENDS.
//
// The legacy SDMX 2.1 REST endpoint (DF_JVQ / 14-10-0443-01) is dead — it
// returns 404. The WDS CSV download flow is the supported replacement.
//
// Table 14100371 reports province-level totals only (no NAICS sector
// breakdown), so every emitted record uses sector 'All Alberta Sectors'. It
// carries job-vacancy counts and the job-vacancy rate but NOT average offered
// hourly wage, so avgOfferedHourlyWage defaults to 0 for records sourced here.
//
// Other workforce datasets (PHYSICIAN_SPECIALTY_ZONE, NURSING_SUPPLY_TRENDS,
// WORKFORCE_AGE_PROFILE, SPECIALIST_RECRUITMENT_NEEDS, ALLIED_HEALTH_SUPPLY)
// are sourced from CIHI / CPSA / CRNA / AHS — NOT StatCan — so this fetcher
// leaves them untouched and only refreshes JOB_VACANCY_TRENDS.
//
// If the endpoint is unreachable or returns an unexpected shape, the fetcher
// returns status 'skipped' with a clear error message rather than throwing or
// corrupting existing data.
//
// Rate limit: >= 1 request per 2 seconds (enforced via sleep() between calls).

import AdmZip from 'adm-zip';
import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SyncResult } from './types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WORKFORCE_FILE = path.join(process.cwd(), 'data-workforce.json');

// StatCan WDS REST API — getFullTableDownloadCSV returns a JSON envelope
// pointing at the canonical ZIP URL for the requested table.
// Docs: https://www.statcan.gc.ca/en/developers/wds
const STATCAN_WDS_BASE = 'https://www150.statcan.gc.ca/t1/wds/rest';

// Job vacancies, payroll employees, and job vacancy rate by provinces and
// territories, monthly, unadjusted. Numeric table ID used by the WDS CSV
// download endpoint (the product ID 14-10-0371-01 maps to table 14100371).
const JVWS_TABLE_ID = '14100371';

// Quarters to emit — covers the historical window used by the dashboard.
// Monthly CSV rows outside this window are dropped during aggregation.
const START_PERIOD = '2023-Q1';
const END_PERIOD = '2024-Q4';

const REQUEST_TIMEOUT_MS = 30_000;
const MIN_INTERVAL_MS = 2_000; // rate limit: 1 request / 2s

const HTTP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

// ---------------------------------------------------------------------------
// Types — strict, no `any`
// ---------------------------------------------------------------------------

/** Shape of data-workforce.json on disk. All keys optional so partial reads
 *  don't crash; we only ever write back the full merged object. */
interface WorkforceJson {
  PHYSICIAN_SPECIALTY_ZONE?: unknown[];
  NURSING_SUPPLY_TRENDS?: unknown[];
  WORKFORCE_AGE_PROFILE?: unknown[];
  JOB_VACANCY_TRENDS?: JobVacancyTrendRecord[];
  SPECIALIST_RECRUITMENT_NEEDS?: unknown[];
  ALLIED_HEALTH_SUPPLY?: unknown[];
}

interface JobVacancyTrendRecord {
  quarter: string;
  sector: 'Health Care & Social Assistance' | 'All Alberta Sectors';
  vacanciesCount: number;
  vacancyRatePct: number;
  avgOfferedHourlyWage: number;
}

/** WDS getFullTableDownloadCSV JSON envelope. */
interface WdsCsvResponse {
  status?: string;
  object?: string;
}

/** A parsed row of the StatCan CSV, keyed by header name. */
type CsvRow = Record<string, string>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/** Coerce a CSV VALUE cell (number | numeric string | empty) to a finite
 *  number, or return null if not parseable / empty. */
function coerceNumber(value: unknown): number | null {
  if (isNumber(value) && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = parseFloat(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Convert a "YYYY-MM" REF_DATE to a "YYYY-Qn" quarter label. */
function monthToQuarter(refDate: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(refDate);
  if (!match) return null;
  const year = match[1];
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/** Convert a "YYYY-Qn" period label to its inclusive month range
 *  ["YYYY-MM", "YYYY-MM"] for window filtering. */
function quarterToMonthRange(quarter: string): [string, string] | null {
  const match = /^(\d{4})-Q([1-4])$/.exec(quarter);
  if (!match) return null;
  const year = match[1];
  const q = parseInt(match[2], 10);
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = q * 3;
  return [
    `${year}-${String(startMonth).padStart(2, '0')}`,
    `${year}-${String(endMonth).padStart(2, '0')}`,
  ];
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Parse CSV text into an array of row objects keyed by header name.
 *
 * Handles double-quoted fields with embedded commas, doubled quotes ("") as
 * an escaped quote, and a leading UTF-8 BOM. CRLF and LF line endings are
 * both tolerated. Returns [] for empty input.
 */
function parseCsv(text: string): CsvRow[] {
  // Strip a leading UTF-8 BOM if present.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (src.trim() === '') return [];

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        // Doubled quote == escaped quote, otherwise closes the field.
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // Swallow — handled by the following \n.
    } else {
      field += ch;
    }
  }

  // Flush the final field/row (file may not end with a newline).
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0];
  const records: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    // Skip trailing blank lines.
    if (cells.length === 1 && cells[0].trim() === '') continue;
    const obj: CsvRow = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = cells[c] ?? '';
    }
    records.push(obj);
  }
  return records;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface QuarterBucket {
  vacancies: number[];
  rate: number[];
}

/** Parse the StatCan CSV rows into quarterly JOB_VACANCY_TRENDS records.
 *
 *  Keeps Alberta rows whose Statistics column is "Job vacancies" or
 *  "Job vacancy rate", buckets them by quarter, averages the monthly values
 *  within each quarter, and emits one record per quarter sorted ascending.
 *  Records outside [startPeriod, endPeriod] are dropped.
 */
function aggregateQuarters(
  rows: CsvRow[],
  startPeriod: string,
  endPeriod: string
): JobVacancyTrendRecord[] {
  const startRange = quarterToMonthRange(startPeriod);
  const endRange = quarterToMonthRange(endPeriod);
  if (!startRange || !endRange) return [];

  const startMonth = startRange[0];
  const endMonth = endRange[1];

  const byQuarter = new Map<string, QuarterBucket>();

  for (const row of rows) {
    const geo = row['GEO'];
    if (geo !== 'Alberta') continue;

    const refDate = row['REF_DATE'];
    if (!refDate || refDate < startMonth || refDate > endMonth) continue;

    const statistic = row['Statistics'];
    if (statistic !== 'Job vacancies' && statistic !== 'Job vacancy rate') {
      continue;
    }

    const value = coerceNumber(row['VALUE']);
    if (value === null) continue; // suppressed / missing (e.g. SYMBOL "F")

    const quarter = monthToQuarter(refDate);
    if (!quarter) continue;

    const bucket = byQuarter.get(quarter) ?? { vacancies: [], rate: [] };
    if (statistic === 'Job vacancies') {
      bucket.vacancies.push(value);
    } else {
      bucket.rate.push(value);
    }
    byQuarter.set(quarter, bucket);
  }

  const records: JobVacancyTrendRecord[] = [];
  const sortedQuarters = [...byQuarter.keys()].sort();
  for (const quarter of sortedQuarters) {
    const b = byQuarter.get(quarter);
    if (!b) continue;
    // Require at least a vacancy count to emit a record.
    if (b.vacancies.length === 0) continue;
    const avgVacancies =
      b.vacancies.reduce((sum, v) => sum + v, 0) / b.vacancies.length;
    const avgRate =
      b.rate.length > 0
        ? b.rate.reduce((sum, v) => sum + v, 0) / b.rate.length
        : 0;
    records.push({
      quarter,
      sector: 'All Alberta Sectors',
      vacanciesCount: Math.round(avgVacancies),
      vacancyRatePct: Math.round(avgRate * 10) / 10,
      avgOfferedHourlyWage: 0,
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Disk I/O
// ---------------------------------------------------------------------------

function readWorkforceFile(): WorkforceJson {
  try {
    const raw = fs.readFileSync(WORKFORCE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (isObject(parsed)) {
      return parsed as WorkforceJson;
    }
    return {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Fetch StatCan table 14100371 via the WDS CSV download flow, aggregate the
 * monthly Alberta rows into quarterly JOB_VACANCY_TRENDS records, and merge
 * them into data-workforce.json (other datasets preserved). Returns a
 * SyncResult; never throws.
 */
export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log(
    `[StatsCanFetcher] Fetching StatCan table ${JVWS_TABLE_ID} via WDS CSV download...`
  );

  const tmpDir = os.tmpdir();
  const zipPath = path.join(tmpDir, `statcan-${JVWS_TABLE_ID}-${Date.now()}.zip`);

  try {
    // 1. Resolve the canonical ZIP URL via the WDS REST CSV endpoint.
    const metaUrl = `${STATCAN_WDS_BASE}/getFullTableDownloadCSV/${JVWS_TABLE_ID}/en`;
    let zipUrl: string;
    try {
      const metaRes = await axios.get<WdsCsvResponse>(metaUrl, {
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
        responseType: 'json',
        validateStatus: (status) => status >= 200 && status < 300,
      });
      const payload = metaRes.data as unknown;
      if (!isObject(payload)) {
        return skipped(
          startTime,
          timestamp,
          `StatCan WDS getFullTableDownloadCSV/${JVWS_TABLE_ID}/en returned a ` +
            'non-object JSON body. The WDS REST API may have changed shape.'
        );
      }
      const status = typeof payload.status === 'string' ? payload.status : '';
      const objectUrl = typeof payload.object === 'string' ? payload.object : '';
      if (status !== 'SUCCESS' || objectUrl === '') {
        return skipped(
          startTime,
          timestamp,
          `StatCan WDS reported status "${status || 'unknown'}" for table ` +
            `${JVWS_TABLE_ID} (no download URL). The table may have been ` +
            'renamed or temporarily unavailable.'
        );
      }
      zipUrl = objectUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return skipped(
        startTime,
        timestamp,
        `StatCan WDS metadata request failed: ${msg}. The WDS REST endpoint ` +
          'may be unreachable from this network. Existing data-workforce.json was left unchanged.'
      );
    }

    // Rate-limit spacing between the metadata call and the ZIP download.
    await sleep(MIN_INTERVAL_MS);

    // 2. Download the ZIP archive to a temp path.
    try {
      const zipRes = await axios.get<ArrayBuffer>(zipUrl, {
        headers: HTTP_HEADERS,
        timeout: REQUEST_TIMEOUT_MS,
        responseType: 'arraybuffer',
        validateStatus: (status) => status >= 200 && status < 300,
      });
      fs.writeFileSync(zipPath, Buffer.from(zipRes.data));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return skipped(
        startTime,
        timestamp,
        `StatCan ZIP download failed from ${zipUrl}: ${msg}. ` +
          'Existing data-workforce.json was left unchanged.'
      );
    }

    // 3. Extract the data CSV from the ZIP and parse it.
    let csvText: string;
    try {
      const zip = new AdmZip(zipPath);
      const dataEntry =
        zip.getEntry(`${JVWS_TABLE_ID}.csv`) ??
        zip.getEntries().find((e) => e.entryName.endsWith('.csv') && !/MetaData/i.test(e.entryName)) ??
        null;
      if (!dataEntry) {
        return skipped(
          startTime,
          timestamp,
          `StatCan ZIP for table ${JVWS_TABLE_ID} contained no data CSV entry. ` +
            'The archive layout may have changed.'
        );
      }
      csvText = dataEntry.getData().toString('utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return skipped(
        startTime,
        timestamp,
        `Failed to extract CSV from StatCan ZIP: ${msg}. ` +
          'Existing data-workforce.json was left unchanged.'
      );
    }

    // 4. Parse + aggregate.
    let records: JobVacancyTrendRecord[];
    try {
      const rows = parseCsv(csvText);
      records = aggregateQuarters(rows, START_PERIOD, END_PERIOD);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      return skipped(
        startTime,
        timestamp,
        `StatCan CSV for table ${JVWS_TABLE_ID} could not be parsed: ${msg}. ` +
          'The CSV column layout may have changed.'
      );
    }

    if (records.length === 0) {
      return skipped(
        startTime,
        timestamp,
        `StatCan table ${JVWS_TABLE_ID} yielded no Alberta job-vacancy rows ` +
          `over ${START_PERIOD}–${END_PERIOD}. The table contents or ` +
          'geography coding may have changed.'
      );
    }

    // 5. Merge into existing workforce file — preserve every non-StatCan dataset.
    const existing = readWorkforceFile();
    const merged: WorkforceJson = {
      ...existing,
      JOB_VACANCY_TRENDS: records,
    };
    fs.writeFileSync(WORKFORCE_FILE, JSON.stringify(merged, null, 2), 'utf8');

    const durationMs = Date.now() - startTime;
    console.log(
      `[StatsCanFetcher] Sync complete. ${records.length} quarters written to ` +
        `data-workforce.json (${START_PERIOD}–${END_PERIOD}). ${durationMs}ms`
    );

    return {
      domain: 'workforce',
      pipeline: 'statscanFetcher',
      status: 'success',
      recordsFetched: records.length,
      recordsWritten: records.length,
      durationMs,
      timestamp,
    };
  } finally {
    // Always clean up the temp ZIP, regardless of success/failure.
    try {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch {
      // Best-effort cleanup; never surface a temp-file error.
    }
  }
}

function skipped(
  startTime: number,
  timestamp: string,
  reason: string
): SyncResult {
  const durationMs = Date.now() - startTime;
  console.warn(`[StatsCanFetcher] SKIPPED: ${reason}`);
  return {
    domain: 'workforce',
    pipeline: 'statscanFetcher',
    status: 'skipped',
    recordsFetched: 0,
    recordsWritten: 0,
    durationMs,
    error: reason,
    timestamp,
  };
}

export default run;
