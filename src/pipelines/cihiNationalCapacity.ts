/**
 * CIHI national capacity metrics for NATIONAL_SPENDING_COMPARE:
 * - bedsPer100k from indicator 877 (acute care beds) + NHEX Table O.1 implied population
 * - costPerStandardStay from HOSPITAL_EFFICIENCY_TREND (Alberta CSHS trend) when no province workbook
 */

import axios from 'axios';
import * as XLSX from 'xlsx';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const CIHI_ACUTE_BEDS_XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/data-file/877-number-of-acute-care-beds-data-table-en.xlsx';

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

/** Sum facility-level acute beds by province for the latest fiscal year in the workbook. */
export async function fetchAcuteBedsByProvince(
  latestTimeFrame?: string,
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
    if (rows.length < 3) return out;

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
      const level = String(r[idxLevel] ?? '');
      if (level !== 'Facility' && level !== 'Corporation') continue;
      const tf = String(r[idxFrame] ?? '');
      if (tf) frames.add(tf);
    }
    const sortedFrames = [...frames].sort();
    const targetFrame =
      latestTimeFrame ??
      sortedFrames[sortedFrames.length - 1] ??
      '2024–2025';

    for (let i = 2; i < rows.length; i++) {
      const r = rows[i] as unknown[];
      const level = String(r[idxLevel] ?? '');
      if (level !== 'Facility') continue;
      const prov = String(r[idxProv] ?? '').trim();
      const tf = String(r[idxFrame] ?? '');
      if (tf !== targetFrame && tf.replace(/-/g, '–') !== targetFrame) continue;
      const beds = Number(String(r[idxBeds] ?? '').replace(/,/g, ''));
      if (!prov || Number.isNaN(beds)) continue;
      out.set(prov, (out.get(prov) ?? 0) + beds);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CIHIDownloader] Acute beds XLSX fetch/parse failed: ${msg}`);
  }
  return out;
}

export function bedsPer100k(beds: number, population: number): number | null {
  if (population <= 0 || beds < 0) return null;
  return Math.round((beds / population) * 100000 * 10) / 10;
}

/** Latest Alberta standard stay cost from HOSPITAL_EFFICIENCY_TREND (CIHI CSHS-aligned series). */
export function albertaCshsFromEfficiencyTrend(
  trend: { fiscalYear: string; standardStayCost: number }[],
): number | null {
  if (!trend.length) return null;
  const sorted = [...trend].sort((a, b) => a.fiscalYear.localeCompare(b.fiscalYear));
  const latest = sorted[sorted.length - 1];
  return latest.standardStayCost > 0 ? Math.round(latest.standardStayCost) : null;
}