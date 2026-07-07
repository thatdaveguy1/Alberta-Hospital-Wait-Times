// HQCA FOCUS + CIHI Continuing Care Fetcher
// Downloads HQCA FOCUS CSV files for placement-within-30-days and
// placed-in-preferred-living-option metrics, plus the CIHI XLSX data table
// for potentially inappropriate antipsychotic use in long-term care, then
// merges the parsed records into data-continuing-care.json while preserving
// the HOME_CARE_EXPERIENCE and CONTINUING_CARE_COMPLIANCE arrays.
//
// The HQCA CSVs publish Type A / All / Yearly rows for the 30-days metric.
// The preferred-living-option CSV only carries quarterly rows, so quarterly
// values are aggregated into fiscal-year averages. The CIHI workbook's
// 'Table 1' sheet has an inflated range (A1:XFD7273), so cells are read
// directly rather than via sheet_to_json to avoid scanning 16 K columns.
//
// All failures are caught and returned as SyncResult — run() never throws.

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
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  HomeCareContinuity,
  CareFacilityCompliance,
} from '../continuingCareData';

const HQCA_30_DAYS_URL =
  'https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/data/continuing_care/A_B_delivery_of_care/A_B_placed_within_30_days.csv';
const HQCA_PREFERRED_URL =
  'https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/data/continuing_care/A_B_delivery_of_care/A_B_placed_in_preferred_living_option.csv';
const CIHI_ANTIPSYCHOTICS_URL =
  'https://www.cihi.ca/sites/default/files/document/data-file/drg01pub-potentially-inappropriate-use-of-antipyschotics-in-long-term-care-data-table-en.xlsx';
const CONTINUING_CARE_FILE = path.join(process.cwd(), 'data-continuing-care.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// HQCA zone label → PlacementMetric zone.
const ZONE_MAP: Record<string, PlacementMetric['zone']> = {
  Calgary: 'Calgary Zone',
  Edmonton: 'Edmonton Zone',
  Central: 'Central Zone',
  North: 'North Zone',
  South: 'South Zone',
  '': 'Alberta',
};

const METRIC_NAME = 'Inappropriate Antipsychotic Use';

// ---- Utilities ------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : value == null ? undefined : String(value);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace('%', '').trim());
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

// Map a HQCA fiscal-year label ("2022/23") to a calendar year ("2023").
function mapFiscalYear(fy: string): string | undefined {
  const match = fy.match(/^(\d{2,4})\/(\d{2,4})$/);
  if (!match) return undefined;
  const end = match[2];
  return end.length === 4 ? end : `20${end}`;
}

// Map a CIHI time-frame label ("2023–2024", en dash) to the end calendar year.
function mapCihiTimeFrame(tf: string): string | undefined {
  const parts = tf.split(/[–-]/).map((p) => p.trim());
  if (parts.length < 2) return undefined;
  const end = parts[1];
  return end.length === 4 ? end : `20${end}`;
}

// Derive a HQCA fiscal-year label from a quarterly period label.
//   "Apr-Jun 2018" → "2018/19", "Jan-Mar 2019" → "2018/19"
function quarterlyToFiscalYear(period: string): string | undefined {
  const m = period.match(/^([A-Za-z]{3})[-\s]/);
  if (!m) return undefined;
  const yrMatch = period.match(/(\d{4})/);
  if (!yrMatch) return undefined;
  const year = Number.parseInt(yrMatch[1], 10);
  const month = m[1].toLowerCase();
  // Apr, Jul, Oct → fiscal year starts this calendar year
  // Jan → fiscal year started previous calendar year
  if (month === 'jan') {
    const start = year - 1;
    const end = (start + 1) % 100;
    return `${start}/${end.toString().padStart(2, '0')}`;
  }
  const end = (year + 1) % 100;
  return `${year}/${end.toString().padStart(2, '0')}`;
}

// Parse a single CSV line into fields, handling double-quoted values with
// embedded commas and escaped quotes.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  let current = '';
  let inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      current += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      fields.push(current);
      current = '';
      i++;
      continue;
    }
    current += ch;
    i++;
  }
  fields.push(current);
  return fields;
}

// ---- HQCA CSV parsing -----------------------------------------------------

interface PlacementRaw {
  year: string;
  zone: PlacementMetric['zone'];
  pct: number;
}

// Parse a HQCA CSV text blob into placement records.
// For the 30-days CSV (which has a "Time period" column), only Yearly rows
// are kept. For the preferred-living-option CSV (which lacks that column),
// quarterly rows are aggregated into fiscal-year averages.
function parseHqcaCsv(text: string, hasTimePeriodColumn: boolean): PlacementRaw[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => {
    colIdx[h] = i;
  });

  const settingCol = colIdx['setting'];
  const zoneCol = colIdx['zone'];
  const placedFromCol = colIdx['placed from'];
  const fiscalYearCol = colIdx['fiscal year'];
  const timePeriodCol = colIdx['time period'];
  const resultCol = colIdx['result'];
  if (
    settingCol === undefined ||
    zoneCol === undefined ||
    placedFromCol === undefined ||
    fiscalYearCol === undefined ||
    resultCol === undefined
  ) {
    return [];
  }

  if (hasTimePeriodColumn) {
    // Filter for Yearly rows.
    const yearly: PlacementRaw[] = [];
    for (let li = 1; li < lines.length; li++) {
      const f = parseCsvLine(lines[li]);
      if (f[settingCol]?.trim() !== 'Type A') continue;
      if (f[placedFromCol]?.trim() !== 'All') continue;
      if (timePeriodCol !== undefined && f[timePeriodCol]?.trim() !== 'Yearly') continue;
      const zoneRaw = f[zoneCol]?.trim() ?? '';
      const zone = ZONE_MAP[zoneRaw];
      if (!zone) continue;
      const year = mapFiscalYear(f[fiscalYearCol]?.trim() ?? '');
      if (!year) continue;
      const pct = asNumber(f[resultCol]);
      if (pct === undefined) continue;
      yearly.push({ year, zone, pct });
    }
    return yearly;
  }

  // No Time period column — aggregate quarterly rows by fiscal year.
  const buckets = new Map<string, number[]>();
  for (let li = 1; li < lines.length; li++) {
    const f = parseCsvLine(lines[li]);
    if (f[settingCol]?.trim() !== 'Type A') continue;
    if (f[placedFromCol]?.trim() !== 'All') continue;
    const zoneRaw = f[zoneCol]?.trim() ?? '';
    const zone = ZONE_MAP[zoneRaw];
    if (!zone) continue;
    const periodLabel = f[fiscalYearCol]?.trim() ?? '';
    const fy = quarterlyToFiscalYear(periodLabel);
    if (!fy) continue;
    const year = mapFiscalYear(fy);
    if (!year) continue;
    const pct = asNumber(f[resultCol]);
    if (pct === undefined) continue;
    const key = `${year}|${zone}`;
    const arr = buckets.get(key);
    if (arr) arr.push(pct);
    else buckets.set(key, [pct]);
  }

  const aggregated: PlacementRaw[] = [];
  for (const [key, values] of buckets) {
    const [yearStr, zoneStr] = key.split('|');
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    aggregated.push({
      year: yearStr,
      zone: zoneStr as PlacementMetric['zone'],
      pct: Math.round(avg * 10) / 10,
    });
  }
  return aggregated;
}

// ---- CIHI XLSX parsing ----------------------------------------------------

interface CihiRateRow {
  year: string;
  rate: number;
}

// Extract National and Alberta province-level antipsychotic rates from the
// CIHI 'Table 1' sheet. Cells are read directly (4 per row) to avoid the
// performance cost of materialising the sheet's inflated 16 K-column range.
function extractAntipsychoticRates(workbook: XLSX.WorkBook): {
  alberta: CihiRateRow[];
  canada: CihiRateRow[];
} {
  const sheet = workbook.Sheets['Table 1'];
  if (!sheet) return { alberta: [], canada: [] };

  // Column indices (0-based): B=1 (Reporting level), G=6 (Province),
  // K=10 (Time frame), L=11 (Risk-adjusted rate).
  const COL_LEVEL = 1;
  const COL_PROV = 6;
  const COL_TIME = 10;
  const COL_RATE = 11;

  // Determine the row range from the sheet ref, but cap at a reasonable limit
  // since the National + Province/territory data sits in the first ~45 rows.
  const ref = sheet['!ref'] ?? 'A1:L100';
  const decoded = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(decoded.e.r, 200);

  const alberta: CihiRateRow[] = [];
  const canada: CihiRateRow[] = [];

  for (let r = 2; r <= maxRow; r++) {
    const levelCell = sheet[XLSX.utils.encode_cell({ r, c: COL_LEVEL })];
    const level = asString(levelCell?.v)?.trim();
    if (!level) continue;

    if (level === 'National') {
      const tfCell = sheet[XLSX.utils.encode_cell({ r, c: COL_TIME })];
      const rateCell = sheet[XLSX.utils.encode_cell({ r, c: COL_RATE })];
      const tf = asString(tfCell?.v)?.trim();
      const rate = asNumber(rateCell?.v);
      if (!tf || rate === undefined) continue;
      const year = mapCihiTimeFrame(tf);
      if (!year) continue;
      canada.push({ year, rate });
    } else if (level === 'Province/territory') {
      const provCell = sheet[XLSX.utils.encode_cell({ r, c: COL_PROV })];
      const prov = asString(provCell?.v)?.trim();
      if (prov !== 'Alberta') continue;
      const tfCell = sheet[XLSX.utils.encode_cell({ r, c: COL_TIME })];
      const rateCell = sheet[XLSX.utils.encode_cell({ r, c: COL_RATE })];
      const tf = asString(tfCell?.v)?.trim();
      const rate = asNumber(rateCell?.v);
      if (!tf || rate === undefined) continue;
      const year = mapCihiTimeFrame(tf);
      if (!year) continue;
      alberta.push({ year, rate });
    }
  }

  return { alberta, canada };
}

// ---- JSON merge -----------------------------------------------------------

interface ContinuingCareJson {
  CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[];
  RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[];
  HOME_CARE_EXPERIENCE: HomeCareContinuity[];
  CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[];
  _dataMetadata?: DataMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceJson(raw: unknown): ContinuingCareJson {
  const base: ContinuingCareJson = {
    CONTINUING_CARE_PLACEMENT_STATS: [],
    RESIDENT_QUALITY_OUTCOMES: [],
    HOME_CARE_EXPERIENCE: [],
    CONTINUING_CARE_COMPLIANCE: [],
  };
  if (isRecord(raw)) {
    if (Array.isArray(raw.CONTINUING_CARE_PLACEMENT_STATS))
      base.CONTINUING_CARE_PLACEMENT_STATS = raw.CONTINUING_CARE_PLACEMENT_STATS as PlacementMetric[];
    if (Array.isArray(raw.RESIDENT_QUALITY_OUTCOMES))
      base.RESIDENT_QUALITY_OUTCOMES = raw.RESIDENT_QUALITY_OUTCOMES as ResidentOutcomeQuality[];
    if (Array.isArray(raw.HOME_CARE_EXPERIENCE))
      base.HOME_CARE_EXPERIENCE = raw.HOME_CARE_EXPERIENCE as HomeCareContinuity[];
    if (Array.isArray(raw.CONTINUING_CARE_COMPLIANCE))
      base.CONTINUING_CARE_COMPLIANCE = raw.CONTINUING_CARE_COMPLIANCE as CareFacilityCompliance[];
    if (isRecord(raw._dataMetadata)) base._dataMetadata = raw._dataMetadata as DataMetadata;
  }
  return base;
}

function loadExisting(): ContinuingCareJson {
  try {
    const text = fs.readFileSync(CONTINUING_CARE_FILE, 'utf8');
    return coerceJson(JSON.parse(text));
  } catch {
    return {
      CONTINUING_CARE_PLACEMENT_STATS: [],
      RESIDENT_QUALITY_OUTCOMES: [],
      HOME_CARE_EXPERIENCE: [],
      CONTINUING_CARE_COMPLIANCE: [],
    };
  }
}

// Merge fetched placement data into the existing array by (year, zone) key.
// Existing records that match keep their daysWaitingP50/P90 fields; the two
// percentage fields are updated from the fresh CSV data. Records only in the
// new data are appended with zeroed wait-day fields.
function mergePlacementStats(
  existing: PlacementMetric[],
  fetched: Map<string, { within30: number; preferred: number }>,
): PlacementMetric[] {
  const byKey = new Map<string, PlacementMetric>();
  for (const row of existing) {
    byKey.set(`${row.year}|${row.zone}`, { ...row });
  }
  for (const [key, vals] of fetched) {
    const prev = byKey.get(key);
    if (prev) {
      prev.pctPlacedWithin30Days = vals.within30;
      prev.pctPlacedPreferredOption = vals.preferred;
    } else {
      const [year, zone] = key.split('|');
      byKey.set(key, {
        year,
        zone: zone as PlacementMetric['zone'],
        pctPlacedWithin30Days: vals.within30,
        pctPlacedPreferredOption: vals.preferred,
        daysWaitingP50: 0,
        daysWaitingP90: 0,
      });
    }
  }
  return Array.from(byKey.values());
}

// Merge fetched antipsychotic outcomes into the existing array by year key,
// replacing only the "Inappropriate Antipsychotic Use" metric rows and
// preserving all other metric rows (Falls, Restraints, etc.).
function mergeResidentOutcomes(
  existing: ResidentOutcomeQuality[],
  fetched: Map<string, { alberta: number; canada: number }>,
): ResidentOutcomeQuality[] {
  const preserved = existing.filter((r) => r.metric !== METRIC_NAME);
  const added: ResidentOutcomeQuality[] = [];
  for (const [year, vals] of fetched) {
    added.push({
      year,
      metric: METRIC_NAME,
      albertaRatePct: vals.alberta,
      canadaRatePct: vals.canada,
      directionIsLowerBetter: true,
    });
  }
  return [...preserved, ...added];
}

// ---- Main run -------------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[HQCAContinuingCare] Starting HQCA FOCUS + CIHI fetch');

  try {
    // 1. Download the 30-days CSV.
    console.log('[HQCAContinuingCare] Downloading placed-within-30-days CSV...');
    let within30Raw: PlacementRaw[] = [];
    try {
      const resp30 = await axios.get(HQCA_30_DAYS_URL, {
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000,
      });
      within30Raw = parseHqcaCsv(resp30.data as string, true);
      console.log(`[HQCAContinuingCare] Parsed ${within30Raw.length} yearly 30-day rows.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[HQCAContinuingCare] 30-days CSV download/parse failed: ${msg}`);
    }

    await sleep(RATE_LIMIT_MS);

    // 2. Download the preferred-living-option CSV.
    console.log('[HQCAContinuingCare] Downloading preferred-living-option CSV...');
    let preferredRaw: PlacementRaw[] = [];
    try {
      const respPref = await axios.get(HQCA_PREFERRED_URL, {
        responseType: 'text',
        headers: { 'User-Agent': USER_AGENT },
        timeout: 30000,
      });
      preferredRaw = parseHqcaCsv(respPref.data as string, false);
      console.log(`[HQCAContinuingCare] Parsed ${preferredRaw.length} aggregated preferred-option rows.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[HQCAContinuingCare] preferred CSV download/parse failed: ${msg}`);
    }

    await sleep(RATE_LIMIT_MS);

    // 3. Download the CIHI XLSX.
    console.log('[HQCAContinuingCare] Downloading CIHI antipsychotics XLSX...');
    let albertaRates: CihiRateRow[] = [];
    let canadaRates: CihiRateRow[] = [];
    try {
      const respXlsx = await axios.get(CIHI_ANTIPSYCHOTICS_URL, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': USER_AGENT },
        timeout: 60000,
        maxContentLength: 80 * 1024 * 1024,
      });
      const workbook = XLSX.read(Buffer.from(respXlsx.data as ArrayBuffer), { type: 'buffer' });
      const rates = extractAntipsychoticRates(workbook);
      albertaRates = rates.alberta;
      canadaRates = rates.canada;
      console.log(
        `[HQCAContinuingCare] Parsed ${albertaRates.length} Alberta + ${canadaRates.length} Canada rate rows.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[HQCAContinuingCare] CIHI XLSX download/parse failed: ${msg}`);
    }

    // 4. Build the merged placement-stats map.
    const placementMap = new Map<string, { within30: number; preferred: number }>();
    for (const r of within30Raw) {
      const key = `${r.year}|${r.zone}`;
      const entry = placementMap.get(key);
      if (entry) entry.within30 = r.pct;
      else placementMap.set(key, { within30: r.pct, preferred: 0 });
    }
    for (const r of preferredRaw) {
      const key = `${r.year}|${r.zone}`;
      const entry = placementMap.get(key);
      if (entry) entry.preferred = r.pct;
      else placementMap.set(key, { within30: 0, preferred: r.pct });
    }

    // 5. Build the merged resident-outcomes map (by year).
    const outcomeMap = new Map<string, { alberta: number; canada: number }>();
    const canadaByYear = new Map<string, number>();
    for (const c of canadaRates) canadaByYear.set(c.year, c.rate);
    for (const a of albertaRates) {
      const canada = canadaByYear.get(a.year);
      if (canada === undefined) continue;
      outcomeMap.set(a.year, { alberta: a.rate, canada });
    }

    const recordsFetched = placementMap.size + outcomeMap.size;
    if (recordsFetched === 0) {
      console.warn('[HQCAContinuingCare] No records extracted — leaving data file unchanged.');
      return {
        domain: 'continuing-care',
        pipeline: 'hqcaContinuingCareFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No placement stats or antipsychotic rates extracted from sources',
      };
    }

    // 6. Merge into data-continuing-care.json, preserving other arrays.
    const existing = loadExisting();
    const mergedPlacement = mergePlacementStats(
      existing.CONTINUING_CARE_PLACEMENT_STATS,
      placementMap,
    );
    const mergedOutcomes = mergeResidentOutcomes(
      existing.RESIDENT_QUALITY_OUTCOMES,
      outcomeMap,
    );

    const mergedMetadata = mergeDataMetadata(existing._dataMetadata, {
      CONTINUING_CARE_PLACEMENT_STATS: buildMetadataEntry({
        updateType: 'auto',
        source: 'HQCA FOCUS continuing-care CSVs',
        sourceVintage: '2021–latest HQCA reporting period',
        lastUpdated: timestamp,
      }),
      RESIDENT_QUALITY_OUTCOMES: buildMetadataEntry({
        updateType: 'auto',
        source: 'HQCA FOCUS continuing-care CSVs + CIHI LTCC indicators',
        sourceVintage: '2021–latest HQCA/CIHI reporting period',
        lastUpdated: timestamp,
      }),
    });

    const merged: ContinuingCareJson = {
      ...existing,
      CONTINUING_CARE_PLACEMENT_STATS: mergedPlacement,
      RESIDENT_QUALITY_OUTCOMES: mergedOutcomes,
      _dataMetadata: mergedMetadata,
    };

    fs.writeFileSync(CONTINUING_CARE_FILE, JSON.stringify(merged, null, 2), 'utf8');
    const recordsWritten = placementMap.size + outcomeMap.size;

    console.log(
      `[HQCAContinuingCare] Complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'continuing-care',
      pipeline: 'hqcaContinuingCareFetcher',
      status: 'success',
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[HQCAContinuingCare] FAILED:', errorMsg);
    return {
      domain: 'continuing-care',
      pipeline: 'hqcaContinuingCareFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point: tsx src/pipelines/hqcaContinuingCareFetcher.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}
