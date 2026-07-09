/**
 * CIHI national capacity metrics for NATIONAL_SPENDING_COMPARE:
 * - bedsPer100k: indicator 877 (acute care beds staffed & in operation, CMDB) +
 *   NHEX Table O.1 implied population. Rolls up Facility rows; uses Corporation
 *   totals when higher (Ontario/Quebec under-report at facility level).
 * - costPerStandardStay: indicator 823 (CSHS) at Province/territory reporting level.
 */

import axios from 'axios';
import * as XLSX from 'xlsx';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const CIHI_ACUTE_BEDS_XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/data-file/877-number-of-acute-care-beds-data-table-en.xlsx';

export const CIHI_CSHS_XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/data-file/823-cost-of-a-standard-hospital-stay-data-table-en.xlsx';

export interface TableO1Row {
  year: string;
  province: string;
  sector: string;
  useOfFunds: string;
  currentDollars: number | undefined;
  perCapita: number | undefined;
}

const SECTOR_PUBLIC = 'Public';
const SECTOR_PRIVATE = 'Private';
const UOF_TOTAL = 'Total';

const PROVINCE_ALIASES: Record<string, string> = {
  'Prince Edward Island': 'Prince Edward Island',
  PEI: 'Prince Edward Island',
};

function normalizeProvince(name: string): string {
  const t = name.trim();
  return PROVINCE_ALIASES[t] ?? t;
}

/** Implied population from NHEX total spending (current $) / per-capita total. */
export function impliedPopulationFromO1(
  tableRows: TableO1Row[],
  province: string,
  year: string,
): number | undefined {
  let totalDollars = 0;
  let perCap = 0;
  let foundD = false;
  let foundP = false;
  for (const r of tableRows) {
    if (r.year !== year || r.province !== province || r.useOfFunds !== UOF_TOTAL) continue;
    if (r.sector !== SECTOR_PUBLIC && r.sector !== SECTOR_PRIVATE) continue;
    if (r.currentDollars !== undefined) {
      totalDollars += r.currentDollars;
      foundD = true;
    }
    if (r.perCapita !== undefined) {
      perCap += r.perCapita;
      foundP = true;
    }
  }
  if (!foundD || !foundP || perCap <= 0) return undefined;
  return totalDollars / perCap;
}

type IndicatorSheet = {
  idxLevel: number;
  idxProv: number;
  idxFrame: number;
  idxValue: number;
};

function parseIndicatorHeader(rows: unknown[][]): IndicatorSheet | null {
  if (rows.length < 2) return null;
  const header = rows[1] as unknown[];
  const col = (name: string) =>
    header.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
  const idxLevel = col('Reporting level');
  const idxProv = col('Province/Territory');
  const idxFrame = col('Time frame');
  if (idxProv < 0) return null;
  return { idxLevel, idxProv, idxFrame, idxValue: -1 };
}

function latestTimeFrame(frames: string[]): string | undefined {
  if (!frames.length) return undefined;
  return [...frames].sort().at(-1);
}

/** Acute care beds by province (877). Uses max(Facility sum, Corporation sum) per province. */
export async function fetchAcuteBedsByProvince(
  targetTimeFrame?: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const response = await axios.get(CIHI_ACUTE_BEDS_XLSX_URL, {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.cihi.ca/' },
      maxContentLength: 50 * 1024 * 1024,
    });
    const wb = XLSX.read(Buffer.from(response.data as ArrayBuffer), { type: 'buffer' });
    const sheetName = wb.SheetNames.find((n) => n.includes('Table')) ?? wb.SheetNames[1];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    const header = rows[1] as unknown[];
    const col = (name: string) =>
      header.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
    const idxLevel = col('Reporting level');
    const idxProv = col('Province/Territory');
    const idxFrame = col('Time frame');
    const idxBeds = header.findIndex((c) =>
      String(c).toLowerCase().includes('number of acute care beds'),
    );
    if (idxProv < 0 || idxBeds < 0) return out;

    const frames = new Set<string>();
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const tf = String(r[idxFrame] ?? '');
      if (tf) frames.add(tf);
    }
    const targetFrame = targetTimeFrame ?? latestTimeFrame([...frames]) ?? '2024–2025';

    const facility = new Map<string, number>();
    const corporation = new Map<string, number>();
    const normTf = (tf: string) => tf.replace(/-/g, '–');

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const level = String(r[idxLevel] ?? '');
      const prov = normalizeProvince(String(r[idxProv] ?? ''));
      const tf = String(r[idxFrame] ?? '');
      if (normTf(tf) !== normTf(targetFrame)) continue;
      const beds = Number(String(r[idxBeds] ?? '').replace(/,/g, ''));
      if (!prov || Number.isNaN(beds)) continue;
      if (level === 'Facility') {
        facility.set(prov, (facility.get(prov) ?? 0) + beds);
      } else if (level === 'Corporation') {
        corporation.set(prov, (corporation.get(prov) ?? 0) + beds);
      }
    }

    const allProvs = new Set([...facility.keys(), ...corporation.keys()]);
    for (const prov of allProvs) {
      const f = facility.get(prov) ?? 0;
      const c = corporation.get(prov) ?? 0;
      const total = Math.max(f, c);
      if (total > 0) out.set(prov, total);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CIHIDownloader] Acute beds XLSX fetch/parse failed: ${msg}`);
  }
  return out;
}

/** Province/territory CSHS ($) from indicator 823 — latest fiscal year per province. */
export async function fetchCshsByProvince(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const response = await axios.get(CIHI_CSHS_XLSX_URL, {
      responseType: 'arraybuffer',
      timeout: 90000,
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://www.cihi.ca/' },
      maxContentLength: 50 * 1024 * 1024,
    });
    const wb = XLSX.read(Buffer.from(response.data as ArrayBuffer), { type: 'buffer' });
    const sheetName = wb.SheetNames.find((n) => n.includes('Table')) ?? wb.SheetNames[1];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    });
    const header = rows[1] as unknown[];
    const col = (name: string) =>
      header.findIndex((c) => String(c).trim().toLowerCase() === name.toLowerCase());
    const idxLevel = col('Reporting level');
    const idxProv = col('Province/Territory');
    const idxFrame = col('Time frame');
    const idxCshs = header.findIndex((c) => String(c).trim().toUpperCase() === 'CSHS');
    if (idxLevel < 0 || idxProv < 0 || idxCshs < 0) return out;

    const byProvFrames = new Map<string, Map<string, number>>();

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const level = String(r[idxLevel] ?? '').toLowerCase();
      if (level !== 'province/territory') continue;
      const prov = normalizeProvince(String(r[idxProv] ?? ''));
      const tf = String(r[idxFrame] ?? '');
      const v = Number(String(r[idxCshs] ?? '').replace(/,/g, ''));
      if (!prov || Number.isNaN(v)) continue;
      if (!byProvFrames.has(prov)) byProvFrames.set(prov, new Map());
      byProvFrames.get(prov)!.set(tf, Math.round(v));
    }

    for (const [prov, frames] of byProvFrames) {
      const latest = latestTimeFrame([...frames.keys()]);
      if (latest) out.set(prov, frames.get(latest)!);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CIHIDownloader] CSHS XLSX fetch/parse failed: ${msg}`);
  }
  return out;
}

export function bedsPer100k(beds: number, population: number): number | null {
  if (population <= 0 || beds < 0) return null;
  return Math.round((beds / population) * 100000 * 10) / 10;
}

/** @deprecated Use fetchCshsByProvince; kept for Alberta-only fallback. */
export function albertaCshsFromEfficiencyTrend(
  trend: { fiscalYear: string; standardStayCost: number }[],
): number | null {
  if (!trend.length) return null;
  const sorted = [...trend].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
  const latest = sorted[sorted.length - 1];
  return latest.standardStayCost > 0 ? Math.round(latest.standardStayCost) : null;
}