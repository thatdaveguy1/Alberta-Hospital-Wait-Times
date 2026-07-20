// CIHI NHEX 2025 Downloader & Parser
// Downloads the NHEX 2025 full data tables ZIP from CIHI, extracts the XLSX
// workbooks, and parses them with SheetJS (xlsx) to populate data-spending.json.
//
// Published Nov 27, 2025 — contains finalized 2023 actuals + preliminary 2024/2025 forecasts.
// This pipeline excludes forecast-category rows and never preserves hand-authored
// hospital activity / efficiency / GDP fields from prior JSON payloads.
//
// Extracted datasets:
//   NATIONAL_SPENDING_COMPARE      — from Table O.1 (per-capita spending by province)
//   bedsPer100k                    — CIHI indicator 877 + NHEX-implied population
//   costPerStandardStay            — CIHI indicator 823 (CSHS), Province/territory level
//   ALBERTA_USE_OF_FUNDS           — from series-d1 Alberta sheet (amounts + shares)
//   ALBERTA_ACTIVITY_VOLUME_TREND  — NHEX Alberta total spending by year only
//                                    (unsupported volume fields left empty/null)
//   PROVINCIAL_SPENDING_TREND      — multi-year province × year per-capita series (O.1)
//   PROVINCIAL_USE_OF_FUNDS        — latest-year public UOF mix by province (O.1)

import AdmZip from 'adm-zip';
import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { applyWithheldPayloadGuard, buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';
import type {
  ActivityVolumeTrend,
  NationalSpendingCompare,
  ProvincialSpendingTrend,
  ProvincialUseOfFunds,
  SpendingByUseOfFunds,
} from '../spendingData';
import {
  bedsPer100k as computeBedsPer100k,
  fetchAcuteBedsByProvince,
  fetchCshsByProvince,
  impliedPopulationFromO1,
  type TableO1Row,
} from './cihiNationalCapacity';

const NHEX_ZIP_URL =
  'https://www.cihi.ca/sites/default/files/document/nhex-2025-full-data-tables-en.zip';
const SPENDING_FILE = path.join(process.cwd(), 'data-spending.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// XLSX filenames inside the ZIP that we need.
const OPEN_DATA_FILE = 'nhex-open-data-2025-en.xlsx';
const SERIES_D1_FILE = 'nhex-series-d1-2025-en.xlsx';

// Provinces / national rollups we recognise in CIHI workbooks.
const PROVINCE_NAMES = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
  'Canada',
] as const;

// NHEX Table O.1 use-of-funds categories that map to NationalSpendingCompare fields.
const UOF_HOSPITALS = 'Hospitals';
const UOF_PHYSICIANS = 'Physicians';
const UOF_DRUGS = 'Drugs';
const UOF_TOTAL = 'Total';

// NHEX Table O.1 sectors.
const SECTOR_PUBLIC = 'Public';
const SECTOR_PRIVATE = 'Private';

// Use-of-funds categories extracted from series-d1, mapped to friendly labels
// matching the existing ALBERTA_USE_OF_FUNDS shape.
const USE_OF_FUNDS_MAP: Record<string, string> = {
  Hospitals: 'Hospitals & Acute Care',
  Physicians: 'Physician Payments',
  Drugs: 'Drugs & Therapeutics',
  'Other Institutions': 'Long-Term & Continuing Care',
  'Public Health': 'Public Health & Prevention',
  Administration: 'Administration & Infrastructure',
  'Other Professionals': 'Allied & Other Professionals',
  'Other Health Spending: Net of HCC': 'Other Health Spending',
};

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,%\s]/g, '');
    if (cleaned === '' || cleaned === '—' || cleaned === '..') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
// Map a NHEX calendar year to its fiscal-year label (e.g. 2023 -> '2023-2024').
function nhexToFiscal(year: string): string {
  const y = Number(year);
  if (!Number.isFinite(y)) return year;
  return `${y}-${y + 1}`;
}

// Read a worksheet into a 2D array of cell values (first row = row 1).
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
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
    // Never reintroduce scrubbed hospital-efficiency estimates via RMW.
    existing.HOSPITAL_EFFICIENCY_TREND = [];
    applyWithheldPayloadGuard(existing);
    fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
  }
  return written;
}

// ---------------------------------------------------------------------------
// Table O.1 extraction (nhex-open-data-2025-en.xlsx)
// ---------------------------------------------------------------------------

// Table O.1 column layout (header at row 2, 0-indexed):
//   0: Year
//   1: Forecast Category
//   2: Province
//   3: Sector
//   4: Use of Funds
//   5: Current dollars
//   6: Current dollars per capita
//   7: Constant 2010 dollars
//   8: Constant 2010 dollars per capita

const COL_YEAR = 0;
const COL_FORECAST_CATEGORY = 1;
const COL_PROVINCE = 2;
const COL_SECTOR = 3;
const COL_UOF = 4;
const COL_CURRENT_DOLLARS = 5;
const COL_PER_CAPITA = 6;

// Keep only source-backed non-forecast rows. Preliminary actuals are retained;
// explicit Forecast category rows are excluded.
function isForecastCategory(value: unknown): boolean {
  const s = asString(value)?.toLowerCase() ?? '';
  if (!s) return false;
  return s.includes('forecast');
}

// Parse Table O.1 into typed row objects (forecast rows dropped).
function parseTableO1(rows: unknown[][]): TableO1Row[] {
  const result: TableO1Row[] = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    if (isForecastCategory(r[COL_FORECAST_CATEGORY])) continue;
    const year = asString(r[COL_YEAR]);
    if (!year || !/^\d{4}$/.test(year)) continue;
    const province = asString(r[COL_PROVINCE]);
    const sector = asString(r[COL_SECTOR]);
    const useOfFunds = asString(r[COL_UOF]);
    if (!province || !sector || !useOfFunds) continue;
    result.push({
      year,
      province,
      sector,
      useOfFunds,
      currentDollars: asNumber(r[COL_CURRENT_DOLLARS]),
      perCapita: asNumber(r[COL_PER_CAPITA]),
    });
  }
  return result;
}

// Base NATIONAL_SPENDING_COMPARE from Table O.1 (NHEX per-capita only).
function extractNationalSpending(tableRows: TableO1Row[]): NationalSpendingCompare[] {
  if (tableRows.length === 0) return [];

  const latestYear = tableRows.reduce((max, r) => (r.year > max ? r.year : max), '0');

  const perCapByProv = new Map<string, Map<string, Map<string, number>>>();
  for (const r of tableRows) {
    if (r.year !== latestYear) continue;
    if (r.perCapita === undefined) continue;
    if (r.sector !== SECTOR_PUBLIC && r.sector !== SECTOR_PRIVATE) continue;
    let bySector = perCapByProv.get(r.province);
    if (!bySector) {
      bySector = new Map();
      perCapByProv.set(r.province, bySector);
    }
    let byUof = bySector.get(r.sector);
    if (!byUof) {
      byUof = new Map();
      bySector.set(r.sector, byUof);
    }
    byUof.set(r.useOfFunds, r.perCapita);
  }

  const records: NationalSpendingCompare[] = [];
  for (const province of PROVINCE_NAMES) {
    const bySector = perCapByProv.get(province);
    if (!bySector) continue;

    const sumPerCap = (uof: string): number => {
      let total = 0;
      let found = false;
      for (const sector of [SECTOR_PUBLIC, SECTOR_PRIVATE]) {
        const byUof = bySector.get(sector);
        if (!byUof) continue;
        const val = byUof.get(uof);
        if (val !== undefined) {
          total += val;
          found = true;
        }
      }
      return found ? total : 0;
    };

    const spendingPerCapita = sumPerCap(UOF_TOTAL);
    if (spendingPerCapita === 0) continue;

    records.push({
      province,
      spendingPerCapita,
      spendingAsPercentGdp: null,
      hospitalSpendingPerCapita: sumPerCap(UOF_HOSPITALS),
      physicianSpendingPerCapita: sumPerCap(UOF_PHYSICIANS),
      drugSpendingPerCapita: sumPerCap(UOF_DRUGS),
      bedsPer100k: null,
      costPerStandardStay: null,
    });
  }
  return records;
}

async function enrichNationalSpendingCompare(
  base: NationalSpendingCompare[],
  tableRows: TableO1Row[],
  _existing: NationalSpendingCompare[],
): Promise<NationalSpendingCompare[]> {
  if (base.length === 0) return base;

  const latestYear = tableRows.reduce((max, r) => (r.year > max ? r.year : max), '0');
  const bedsByProv = await fetchAcuteBedsByProvince();
  const cshsByProv = await fetchCshsByProvince();
  // Intentionally ignore prior JSON GDP / beds / CSHS hand-authored leave-behinds.
  void _existing;

  return base.map((row) => {
    let bedsPer100k: number | null = null;
    const bedCount = bedsByProv.get(row.province);
    const pop = impliedPopulationFromO1(tableRows, row.province, latestYear);
    if (bedCount !== undefined && pop !== undefined) {
      bedsPer100k = computeBedsPer100k(bedCount, pop);
    }

    const costPerStandardStay: number | null = cshsByProv.get(row.province) ?? null;

    // GDP share is not present in NHEX Table O.1 — always null (never preserve prior seed).
    return {
      ...row,
      spendingAsPercentGdp: null,
      bedsPer100k: bedsPer100k && bedsPer100k > 0 ? bedsPer100k : null,
      costPerStandardStay:
        costPerStandardStay != null && costPerStandardStay > 0
          ? costPerStandardStay
          : null,
    };
  });
}

// Extract ALBERTA_ACTIVITY_VOLUME_TREND: Alberta total spending by year (in
// billions CAD) from NHEX only. Unsupported activity/volume fields are left
// empty (null) — never preserved from hand-authored prior JSON.
function extractActivityVolume(
  tableRows: TableO1Row[],
  _existing: ActivityVolumeTrend[],
): ActivityVolumeTrend[] {
  void _existing;
  if (tableRows.length === 0) return [];

  // Collect Alberta total current-dollars by year (Public + Private combined).
  const totalByYear = new Map<string, number>();
  for (const r of tableRows) {
    if (r.province !== 'Alberta') continue;
    if (r.useOfFunds !== UOF_TOTAL) continue;
    if (r.currentDollars === undefined) continue;
    if (r.sector !== SECTOR_PUBLIC && r.sector !== SECTOR_PRIVATE) continue;
    totalByYear.set(r.year, (totalByYear.get(r.year) ?? 0) + r.currentDollars);
  }


  const records: ActivityVolumeTrend[] = [];
  for (const [year, totalDollars] of totalByYear) {
    const fiscalYear = nhexToFiscal(year);
    const totalExpenseBillions = Math.round((totalDollars / 1_000_000_000) * 10) / 10;
    records.push({
      fiscalYear,
      totalExpenseBillions,
      // Not sourced from NHEX — leave empty rather than invent or preserve seeds.
      surgeriesCount: null as unknown as number,
      ctExamsCount: null as unknown as number,
      labTestsMillions: null as unknown as number,
      edVisitsMillions: null as unknown as number,
      hospitalAdmissions: null as unknown as number,
      physiciansCount: null as unknown as number,
    });
  }

  return records.sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
}

/** Friendly label for Table O.1 use-of-funds categories (falls back to raw label). */
function friendlyUof(raw: string): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  return USE_OF_FUNDS_MAP[normalized] ?? normalized;
}

/**
 * Multi-year provincial per-capita trends from Table O.1.
 * Public + private combined for Total / Hospitals / Physicians / Drugs.
 */
function extractProvincialSpendingTrend(tableRows: TableO1Row[]): ProvincialSpendingTrend[] {
  if (tableRows.length === 0) return [];

  // province -> year -> uof -> { public, private }
  type SectorVals = { public?: number; private?: number };
  const nest = new Map<string, Map<string, Map<string, SectorVals>>>();

  for (const r of tableRows) {
    if (r.perCapita === undefined) continue;
    if (r.sector !== SECTOR_PUBLIC && r.sector !== SECTOR_PRIVATE) continue;
    if (r.useOfFunds !== UOF_TOTAL && r.useOfFunds !== UOF_HOSPITALS && r.useOfFunds !== UOF_PHYSICIANS && r.useOfFunds !== UOF_DRUGS) continue;
    if (!(PROVINCE_NAMES as readonly string[]).includes(r.province)) continue;

    let byYear = nest.get(r.province);
    if (!byYear) {
      byYear = new Map();
      nest.set(r.province, byYear);
    }
    let byUof = byYear.get(r.year);
    if (!byUof) {
      byUof = new Map();
      byYear.set(r.year, byUof);
    }
    let vals = byUof.get(r.useOfFunds);
    if (!vals) {
      vals = {};
      byUof.set(r.useOfFunds, vals);
    }
    if (r.sector === SECTOR_PUBLIC) vals.public = r.perCapita;
    else vals.private = r.perCapita;
  }

  const sumSectors = (vals: SectorVals | undefined): number => {
    if (!vals) return 0;
    return (vals.public ?? 0) + (vals.private ?? 0);
  };

  const records: ProvincialSpendingTrend[] = [];
  for (const province of PROVINCE_NAMES) {
    const byYear = nest.get(province);
    if (!byYear) continue;
    for (const [year, byUof] of byYear) {
      const totalVals = byUof.get(UOF_TOTAL);
      const spendingPerCapita = Math.round(sumSectors(totalVals));
      if (spendingPerCapita <= 0) continue;
      const publicPart = totalVals?.public;
      const privatePart = totalVals?.private;
      let publicSharePct: number | null = null;
      if (publicPart !== undefined && (publicPart + (privatePart ?? 0)) > 0) {
        publicSharePct = Math.round((publicPart / (publicPart + (privatePart ?? 0))) * 1000) / 10;
      }
      records.push({
        province,
        year,
        fiscalYear: nhexToFiscal(year),
        spendingPerCapita,
        hospitalSpendingPerCapita: Math.round(sumSectors(byUof.get(UOF_HOSPITALS))),
        physicianSpendingPerCapita: Math.round(sumSectors(byUof.get(UOF_PHYSICIANS))),
        drugSpendingPerCapita: Math.round(sumSectors(byUof.get(UOF_DRUGS))),
        publicSharePct,
      });
    }
  }

  return records.sort((a, b) =>
    a.year === b.year ? a.province.localeCompare(b.province) : a.year.localeCompare(b.year),
  );
}

/**
 * Latest-year public-sector use-of-funds composition by province from Table O.1.
 * Share is % of that province's public Total current dollars.
 */
function extractProvincialUseOfFunds(tableRows: TableO1Row[]): ProvincialUseOfFunds[] {
  if (tableRows.length === 0) return [];
  const latestYear = tableRows.reduce((max, r) => (r.year > max ? r.year : max), '0');

  // province -> category -> { dollars, perCapita }
  const byProv = new Map<string, Map<string, { dollars: number; perCapita: number }>>();
  const totals = new Map<string, number>();

  for (const r of tableRows) {
    if (r.year !== latestYear) continue;
    if (r.sector !== SECTOR_PUBLIC) continue;
    if (!(PROVINCE_NAMES as readonly string[]).includes(r.province)) continue;
    if (r.currentDollars === undefined) continue;

    if (r.useOfFunds === UOF_TOTAL) {
      totals.set(r.province, r.currentDollars);
      continue;
    }

    // Skip rollup / subtotal rows — they dominate stacked shares.
    const rawUof = r.useOfFunds.replace(/\s+/g, ' ').trim().toLowerCase();
    if (rawUof.includes('sub-total') || rawUof.includes('subtotal') || rawUof === 'total') continue;

    const label = friendlyUof(r.useOfFunds);
    let cats = byProv.get(r.province);
    if (!cats) {
      cats = new Map();
      byProv.set(r.province, cats);
    }
    cats.set(label, {
      dollars: r.currentDollars,
      perCapita: r.perCapita ?? 0,
    });
  }

  const records: ProvincialUseOfFunds[] = [];
  for (const province of PROVINCE_NAMES) {
    const cats = byProv.get(province);
    const total = totals.get(province);
    if (!cats || !total || total <= 0) continue;
    for (const [category, vals] of cats) {
      if (vals.dollars <= 0) continue;
      records.push({
        province,
        category,
        amountBillions: Math.round((vals.dollars / 1_000_000_000) * 100) / 100,
        percentageShare: Math.round((vals.dollars / total) * 1000) / 10,
        perCapita: Math.round(vals.perCapita),
      });
    }
  }

  return records.sort((a, b) =>
    a.province === b.province
      ? b.percentageShare - a.percentageShare
      : a.province.localeCompare(b.province),
  );
}

// ---------------------------------------------------------------------------
// Series D1 extraction (nhex-series-d1-2025-en.xlsx, Alberta sheet)
// ---------------------------------------------------------------------------

// Series D1 Alberta sheet has 3 tables:
//   Table D.1.9.1.a — amounts in millions of current dollars (header row 2)
//   Table D.1.9.2.a — percentage distribution (header row 112)
//   Table D.1.9.3.a — per capita (header row 222)
// We use table 1 for amounts (millions -> billions) and table 2 for shares.

// Find the header row and latest data row for a table starting after the given
// title row. Returns { headerRow, dataRows }.
function findD1Table(
  rows: unknown[][],
  titleFragment: string,
): { headerIdx: number; yearRows: { year: string; values: number[] }[] } | null {
  // Find the title row.
  let titleIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r && r[0] && asString(r[0])?.includes(titleFragment)) {
      titleIdx = i;
      break;
    }
  }
  if (titleIdx === -1) return null;

  // Header is the row after the title.
  const headerIdx = titleIdx + 1;
  const headerRow = rows[headerIdx];
  if (!headerRow) return null;

  // Collect data rows (year in col 0, numeric values in cols 1+).
  // Year cells may carry a trailing "f" forecast marker — those rows are skipped.
  const yearRows: { year: string; values: number[] }[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const yearStr = asString(r[0]);
    if (!yearStr || !/^\d{4}/.test(yearStr)) {
      // Stop when we hit a non-year row (notes, source, etc.)
      if (yearRows.length > 0) break;
      continue;
    }
    // Exclude forecast-marked years (e.g. "2025 f", "2025f").
    if (/\bf\b/i.test(yearStr) || /forecast/i.test(yearStr) || /\d{4}\s*f/i.test(yearStr)) {
      continue;
    }
    const year = yearStr.replace(/\s*f.*$/i, '').trim();
    const values: number[] = [];
    for (let c = 1; c < headerRow.length; c++) {
      const n = asNumber(r[c]);
      // Preserve missing cells as NaN so callers can skip rather than zero-fill.
      values.push(n === undefined ? Number.NaN : n);
    }
    yearRows.push({ year, values });
  }

  return { headerIdx, yearRows };
}

// Extract ALBERTA_USE_OF_FUNDS from the Alberta sheet of series-d1.
// Uses the latest non-forecast year's amounts (millions -> billions) and percentage
// shares from the percentage-distribution table.
function extractUseOfFunds(sheet: XLSX.WorkSheet) {
  const rows = sheetToRows(sheet);

  // Table 1: amounts in millions of current dollars.
  const amountsTable = findD1Table(rows, 'Table D.1.9.1.a');
  // Table 2: percentage distribution.
  const sharesTable = findD1Table(rows, 'Table D.1.9.2.a');
  if (!amountsTable || !sharesTable) return { records: [], year: undefined };

  const headerRow = rows[amountsTable.headerIdx];
  if (!headerRow) return { records: [], year: undefined };

  // Build category column index from header labels. Header cells in CIHI
  // workbooks often contain embedded newlines (e.g. "Other\nInstitutions"),
  // so we normalize whitespace before lookup.
  const categoryCols: { col: number; label: string }[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const h = asString(headerRow[c]);
    if (!h) continue;
    const normalized = h.replace(/\s+/g, ' ').trim();
    const friendly = USE_OF_FUNDS_MAP[normalized];
    if (friendly) {
      categoryCols.push({ col: c, label: friendly });
    }
  }
  if (categoryCols.length === 0) return { records: [], year: undefined };

  // Use the latest non-forecast year from the amounts table.
  const latestAmounts = amountsTable.yearRows[amountsTable.yearRows.length - 1];
  const latestShares = sharesTable.yearRows[sharesTable.yearRows.length - 1];
  if (!latestAmounts) return { records: [], year: undefined };

  const records: SpendingByUseOfFunds[] = [];
  for (const { col, label } of categoryCols) {
    const amountMillions = latestAmounts.values[col - 1];
    const share = latestShares ? latestShares.values[col - 1] : Number.NaN;
    if (amountMillions == null || Number.isNaN(amountMillions)) continue;
    if (amountMillions === 0 && (share == null || Number.isNaN(share) || share === 0)) continue;
    records.push({
      category: label,
      amountBillions: Math.round((amountMillions / 1000) * 100) / 100,
      percentageShare:
        share != null && !Number.isNaN(share) ? Math.round(share * 10) / 10 : 0,
    });
  }
  const useOfFundsYear = latestAmounts?.year;
  return { records, year: useOfFundsYear };
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CIHIDownloader] Starting NHEX 2025 ZIP download + parse');

  try {
    // 1. Rate-limit before download.
    await sleep(RATE_LIMIT_MS);

    // 2. Download the NHEX 2025 full data tables ZIP.
    console.log(`[CIHIDownloader] Downloading: ${NHEX_ZIP_URL}`);
    let zipBuffer: Buffer;
    try {
      const response = await axios.get(NHEX_ZIP_URL, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': USER_AGENT },
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
      });
      zipBuffer = Buffer.from(response.data as ArrayBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CIHIDownloader] ZIP download failed: ${msg}`);
      return {
        domain: 'spending',
        pipeline: 'cihiDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `ZIP download failed: ${msg}`,
      };
    }

    // 3. Extract ZIP and locate the two workbooks we need.
    let zip: AdmZip;
    try {
      zip = new AdmZip(zipBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CIHIDownloader] ZIP parse failed: ${msg}`);
      return {
        domain: 'spending',
        pipeline: 'cihiDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `ZIP parse failed: ${msg}`,
      };
    }

    const openDataEntry = zip.getEntries().find((e) => e.entryName === OPEN_DATA_FILE);
    const seriesD1Entry = zip.getEntries().find((e) => e.entryName === SERIES_D1_FILE);

    if (!openDataEntry) {
      console.warn(`[CIHIDownloader] ${OPEN_DATA_FILE} not found in ZIP — skipping.`);
      return {
        domain: 'spending',
        pipeline: 'cihiDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `${OPEN_DATA_FILE} not found in ZIP`,
      };
    }

    // 4. Parse open-data workbook (Table O.1) directly from the ZIP entry buffer.
    const openDataWb = XLSX.read(openDataEntry.getData(), { type: 'buffer' });
    const tableO1Sheet = openDataWb.Sheets['Table O.1'];
    if (!tableO1Sheet) {
      console.warn('[CIHIDownloader] Table O.1 sheet not found — skipping.');
      return {
        domain: 'spending',
        pipeline: 'cihiDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'Table O.1 sheet not found in open-data workbook',
      };
    }

    const tableO1Rows = parseTableO1(sheetToRows(tableO1Sheet));
    const existingData = loadJsonFile(SPENDING_FILE);
    const existingNational = Array.isArray(existingData.NATIONAL_SPENDING_COMPARE)
      ? (existingData.NATIONAL_SPENDING_COMPARE as NationalSpendingCompare[])
      : [];
    const nationalSpendingBase = extractNationalSpending(tableO1Rows);
    const nationalSpending = await enrichNationalSpendingCompare(
      nationalSpendingBase,
      tableO1Rows,
      existingNational,
    );
    console.log(
      `[CIHIDownloader] Table O.1: ${nationalSpending.length} national-spending records, ${tableO1Rows.length} total rows parsed.`,
    );

    // 5. Parse series-d1 workbook (Alberta sheet) for use-of-funds.
    let useOfFunds: SpendingByUseOfFunds[] = [];
    let useOfFundsYear: string | undefined;
    if (seriesD1Entry) {
      const seriesD1Wb = XLSX.read(seriesD1Entry.getData(), { type: 'buffer' });
      const albertaSheet = seriesD1Wb.Sheets['Alta.'];
      if (albertaSheet) {
        const useOfFundsResult = extractUseOfFunds(albertaSheet);
        useOfFunds = useOfFundsResult.records;
        useOfFundsYear = useOfFundsResult.year;
        console.log(`[CIHIDownloader] Series D1 Alberta: ${useOfFunds.length} use-of-funds records.`);
      } else {
        console.warn('[CIHIDownloader] Alberta sheet not found in series-d1 workbook.');
      }
    } else {
      console.warn(`[CIHIDownloader] ${SERIES_D1_FILE} not found in ZIP.`);
    }

    const existingActivityVolume = Array.isArray(existingData.ALBERTA_ACTIVITY_VOLUME_TREND)
      ? (existingData.ALBERTA_ACTIVITY_VOLUME_TREND as ActivityVolumeTrend[])
      : [];
    const activityVolume = extractActivityVolume(tableO1Rows, existingActivityVolume);
    const provincialTrend = extractProvincialSpendingTrend(tableO1Rows);
    const provincialUseOfFunds = extractProvincialUseOfFunds(tableO1Rows);
    console.log(
      `[CIHIDownloader] Provincial trend: ${provincialTrend.length} rows; provincial UOF: ${provincialUseOfFunds.length} rows.`,
    );
    const nationalSpendingYear = tableO1Rows.length > 0 ? [...tableO1Rows.map((r) => r.year)].sort().pop() ?? 'unknown' : 'unknown';
    const activityYears = activityVolume.map((r) => r.fiscalYear).sort();
    const activityMinYear = activityYears[0] ?? 'unknown';
    const activityMaxYear = activityYears[activityYears.length - 1] ?? 'unknown';
    const trendYears = provincialTrend.map((r) => r.year).sort();
    const trendMinYear = trendYears[0] ?? 'unknown';
    const trendMaxYear = trendYears[trendYears.length - 1] ?? 'unknown';
    const useOfFundsFiscalYear = useOfFundsYear ? nhexToFiscal(useOfFundsYear) : 'unknown';

    const recordsFetched =
      nationalSpending.length +
      useOfFunds.length +
      activityVolume.length +
      provincialTrend.length +
      provincialUseOfFunds.length;

    if (recordsFetched === 0) {
      console.warn(
        '[CIHIDownloader] No matching records extracted — leaving data-spending.json unchanged.',
      );
      return {
        domain: 'spending',
        pipeline: 'cihiDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No workbook rows matched the expected NHEX 2025 shapes',
      };
    }

    // 7. Merge into data-spending.json, preserving PHYSICIAN_SPECIALTY_BILLING.
    //    HOSPITAL_EFFICIENCY_TREND is withheld and forced empty on write.
    //    Stamp _dataMetadata for the arrays refreshed this run; sibling entries
    //    (e.g. CIHI_RESOURCE_USE_INTENSITY, CIHI_SPENDING_PER_PERSON) are
    //    preserved via mergeDataMetadata.
    const ownedMetadata: DataMetadata = {
      NATIONAL_SPENDING_COMPARE: buildMetadataEntry({
        updateType: 'auto',
        source:
          'CIHI NHEX 2025 Table O.1 (non-forecast rows); bedsPer100k from CIHI indicator 877 + NHEX population; costPerStandardStay from CIHI indicator 823 (CSHS)',
        sourceVintage: `${nationalSpendingYear} calendar year (NHEX 2025 Table O.1 latest non-forecast year; GDP share not sourced)`,
        lastUpdated: timestamp,
      }),
      ALBERTA_USE_OF_FUNDS: buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI NHEX 2025 full data tables (Series D1, Alberta sheet, non-forecast years)',
        sourceVintage: `Fiscal year ${useOfFundsFiscalYear} (NHEX 2025 Series D1 Alberta use of funds, latest non-forecast year)`,
        lastUpdated: timestamp,
      }),
      ALBERTA_ACTIVITY_VOLUME_TREND: buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI NHEX 2025 Table O.1 Alberta total health expenditure only',
        sourceVintage: `Fiscal years ${activityMinYear} to ${activityMaxYear} (NHEX 2025 Table O.1; forecast-marked rows excluded where present; activity/volume fields not sourced)`,
        lastUpdated: timestamp,
      }),
      PROVINCIAL_SPENDING_TREND: buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI NHEX 2025 Table O.1 (public + private per-capita by province/year)',
        sourceVintage: `Calendar years ${trendMinYear} to ${trendMaxYear} (NHEX 2025 Table O.1 non-forecast rows)`,
        lastUpdated: timestamp,
      }),
      PROVINCIAL_USE_OF_FUNDS: buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI NHEX 2025 Table O.1 public-sector use of funds by province',
        sourceVintage: `${nationalSpendingYear} calendar year (public sector shares of provincial public total)`,
        lastUpdated: timestamp,
      }),
    };
    const recordsWritten = mergeAndWrite(
      SPENDING_FILE,
      {
        NATIONAL_SPENDING_COMPARE: nationalSpending,
        ALBERTA_USE_OF_FUNDS: useOfFunds,
        ALBERTA_ACTIVITY_VOLUME_TREND: activityVolume,
        PROVINCIAL_SPENDING_TREND: provincialTrend,
        PROVINCIAL_USE_OF_FUNDS: provincialUseOfFunds,
      },
      ownedMetadata,
    );

    const status: SyncResult['status'] = recordsWritten > 0 ? 'success' : 'skipped';
    console.log(
      `[CIHIDownloader] Complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'spending',
      pipeline: 'cihiDownloader',
      status,
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CIHIDownloader] FAILED:', errorMsg);
    return {
      domain: 'spending',
      pipeline: 'cihiDownloader',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'failed' ? 1 : 0);
  });
}
