// Open Alberta Physician Billing Fetcher
// Downloads the AHCIP Statistical Supplement combined workbook from Open Alberta
// and writes PHYSICIAN_SPECIALTY_BILLING to data-spending.json.
//
// Source: https://open.alberta.ca/dataset/ahcip-statistical-supplement
// The AHCIP Statistical Supplement is published as a single combined XLSX
// workbook on Open Alberta (CKAN) containing all supplement tables.
//
// PHYSICIAN_SPECIALTY_BILLING is assembled by joining four tables, all keyed
// by physician specialty and the latest service-year column:
//   Table 2.12 A — Number of fee-for-service physicians by specialty
//   Table 2.12 B — Average gross payment by specialty
//   Table 2.12 D — Number of services by specialty
//   Table 2.3    — Total payments by program and specialty (FFS+BCP+RRNP+MEDR)
// `servicesPerPatient` is derived from Table 2.14 (FTE physicians and
// registered persons per FTE) where available:
//   services / (FTE physicians × registered persons per FTE).
// Pathology and Radiology are excluded from Table 2.14 by the source, so
// their `servicesPerPatient` is null (never zero-filled as measured).

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

const SPENDING_FILE = path.join(process.cwd(), 'data-spending.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// AHCIP Statistical Supplement combined workbook (all tables in one XLSX).
// Resolved at runtime via CKAN package_show on the supplement package.
const AHCIP_SUPPLEMENT_PACKAGE_ID = '670bf4ce-386d-4bc4-b7f5-7a74edcec722';
const CKAN_PACKAGE_SHOW_URL = `https://open.alberta.ca/api/3/action/package_show?id=${AHCIP_SUPPLEMENT_PACKAGE_ID}`;

interface PhysicianPaymentSpecialty {
  specialtyGroup: string;
  physicianCount: number;
  totalPaymentsMillions: number;
  averagePaymentGross: number;
  servicesPerPatient: number;
}

interface LoadedJson {
  [key: string]: unknown;
}

function loadJsonFile(file: string): LoadedJson {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value).trim();
}

function asNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
    },
    maxRedirects: 5,
    maxContentLength: 30 * 1024 * 1024,
  });
  return Buffer.from(response.data);
}

interface CkanResource {
  url: string;
  format: string;
  name: string;
}

// Locate the combined AHCIP Statistical Supplement workbook resource URL.
// Prefer the XLSX whose download filename contains "combined-tables"; otherwise
// the XLSX resource with the highest fiscal-year token in its name.
async function findSupplementWorkbookUrl(): Promise<string | undefined> {
  try {
    const response = await axios.get(CKAN_PACKAGE_SHOW_URL, {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
      },
    });
    const resources = response.data?.result?.resources;
    if (!Array.isArray(resources)) return undefined;

    const xlsxResources: { url: string; name: string; urlLower: string }[] = [];
    for (const res of resources as CkanResource[]) {
      const format = (res.format ?? '').toLowerCase();
      const url = res.url ?? '';
      const name = res.name ?? '';
      if (!url || !format.includes('xlsx')) continue;
      if (!extractYear(name) && !url.toLowerCase().includes('combined-tables')) continue;
      xlsxResources.push({ url, name, urlLower: url.toLowerCase() });
    }
    if (xlsxResources.length === 0) return undefined;

    const combined = xlsxResources.filter((r) => r.urlLower.includes('combined-tables'));
    const pool = combined.length > 0 ? combined : xlsxResources;
    pool.sort((a, b) => {
      const ya = extractYear(a.name) ?? 0;
      const yb = extractYear(b.name) ?? 0;
      return yb - ya;
    });
    return pool[0].url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OpenAlbertaBilling] CKAN package_show failed: ${msg}`);
    return undefined;
  }
}

function extractYear(name: string): number | undefined {
  const match = name.match(/(20\d{2})/g);
  if (!match) return undefined;
  return Math.max(...match.map(Number));
}

// Normalize a specialty label for cross-table joins: lowercase, collapse
// whitespace, unify ampersand/and, strip trailing punctuation.
function normalizeSpecialty(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  s = s.replace(/&/g, 'and');
  s = s.replace(/\.$/, '');
  return s.toLowerCase();
}

// A small alias map reconciling labels that differ between Table 2.3 and the
// 2.12 series. Keys are the Table 2.3 spelling; values the canonical 2.12
// spelling. Applied after normalization.
const SPECIALTY_ALIASES: Record<string, string> = {
  'psychiatry designated specialty': 'psychiatry',
};

function canonicalSpecialty(raw: string): string {
  const n = normalizeSpecialty(raw);
  return SPECIALTY_ALIASES[n] ?? n;
}

// Read a 2.12-style sheet (header on row 5, year columns 2..6, data from row 7)
// and return a map of canonical specialty -> value for the latest year column.
function parseYearSeriesSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
): Map<string, number> {
  const sheet = workbook.Sheets[sheetName];
  const out = new Map<string, number>();
  if (!sheet) return out;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  if (rows.length < 7) return out;

  // Header row 5 (index 4) holds the metric name; row 6 (index 5) holds year
  // labels. The latest year is the last non-empty cell in row 6.
  const yearRow = rows[5] ?? [];
  let latestCol = -1;
  for (let j = yearRow.length - 1; j >= 1; j--) {
    if (asString(yearRow[j])) {
      latestCol = j;
      break;
    }
  }
  if (latestCol < 0) return out;

  let started = false;
  for (let i = 6; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = asString(row[0]);
    if (!label) continue;
    const low = label.toLowerCase();
    if (low.includes('physicians by specialty')) {
      started = true;
      continue;
    }
    if (low.startsWith('total: all physicians')) {
      started = true;
      continue;
    }
    if (!started) continue;
    if (
      low.startsWith('note:') ||
      low.startsWith('(') ||
      low.startsWith('subtotal') ||
      low.startsWith('total') ||
      low.startsWith('all physicians') ||
      low.startsWith('all specialists')
    ) {
      continue;
    }
    // Stop at the trailing percentage-change sub-table.
    if (low.startsWith('table 2.12')) break;
    // Skip indented sub-rows (leading whitespace or dash).
    if (label.startsWith(' ') || label.startsWith('-')) continue;
    const value = asNumber(row[latestCol]);
    if (value === undefined) continue;
    out.set(canonicalSpecialty(label), value);
  }
  return out;
}

// Read Table 2.3 (single-year, four program columns) and return a map of
// canonical specialty -> total payments (sum of FFS+BCP+RRNP+MEDR).
function parsePaymentsBySpecialty(workbook: XLSX.WorkBook): Map<string, number> {
  const sheet = workbook.Sheets['Table_2.3'];
  const out = new Map<string, number>();
  if (!sheet) return out;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  // Header row 5 (index 4): col 0 = specialty, cols 1-4 = program payments.
  // Data starts row 11 (index 10) after the subtotal block.
  for (let i = 10; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = asString(row[0]);
    if (!label) continue;
    const low = label.toLowerCase();
    if (
      low.startsWith('note:') ||
      low.startsWith('(') ||
      low.startsWith('subtotal') ||
      low.startsWith('total') ||
      low.startsWith('all physicians') ||
      low.startsWith('all specialists')
    ) {
      continue;
    }
    if (label.startsWith(' ') || label.startsWith('-')) continue;
    const vals = [1, 2, 3, 4].map((c) => asNumber(row[c])).filter((n): n is number => n !== undefined);
    if (vals.length === 0) continue;
    out.set(canonicalSpecialty(label), vals.reduce((a, b) => a + b, 0));
  }
  return out;
}

// Read Table 2.14 (single-year, FTE physicians + registered persons per FTE)
// and return a map of canonical specialty -> registered persons (FTE × per-FTE).
function parseRegisteredPersons(workbook: XLSX.WorkBook): Map<string, number> {
  const sheet = workbook.Sheets['Table_2.14'];
  const out = new Map<string, number>();
  if (!sheet) return out;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  // Header row 5 (index 4). Data from row 7 (index 6).
  // Col layout: 0=specialty, 3=#physicians, 4=#FTE, 9=registered persons per FTE.
  for (let i = 6; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const label = asString(row[0]);
    if (!label) continue;
    const low = label.toLowerCase();
    if (
      low.startsWith('note:') ||
      low.startsWith('(') ||
      low.startsWith('subtotal') ||
      low.startsWith('total') ||
      low.startsWith('all physicians') ||
      low.startsWith('all specialists') ||
      low.startsWith('definition') ||
      low.startsWith('step')
    ) {
      continue;
    }
    if (label.startsWith(' ') || label.startsWith('-')) continue;
    const fte = asNumber(row[4]);
    const perFte = asNumber(row[9]);
    if (fte && perFte) {
      out.set(canonicalSpecialty(label), Math.round(fte * perFte));
    }
  }
  return out;
}

// Build a display label from the canonical normalized key: title-case the
// common specialty names so the UI shows readable groups.
function displayLabel(canonical: string): string {
  const GP = 'general/family physicians (gp/fps)';
  if (canonical === GP) return 'General/Family Physicians (GP/FPs)';
  // Title-case words, preserving hyphens and slashes.
  return canonical
    .split(' ')
    .map((w) => {
      if (w.includes('-')) {
        return w
          .split('-')
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join('-');
      }
      if (w.includes('/')) {
        return w
          .split('/')
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join('/');
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

function buildRecords(
  counts: Map<string, number>,
  avgPayments: Map<string, number>,
  services: Map<string, number>,
  payments: Map<string, number>,
  registeredPersons: Map<string, number>,
): PhysicianPaymentSpecialty[] {
  const keys = [...counts.keys()].filter(
    (k) => avgPayments.has(k) && services.has(k) && payments.has(k),
  );
  const records: PhysicianPaymentSpecialty[] = [];
  for (const key of keys) {
    const physicianCount = counts.get(key)!;
    const averagePaymentGross = Math.round(avgPayments.get(key)!);
    const totalPayments = payments.get(key)!;
    const serviceCount = services.get(key)!;
    const registered = registeredPersons.get(key);
    const servicesPerPatient =
      registered && registered > 0
        ? Math.round((serviceCount / registered) * 100) / 100
        : null;
    records.push({
      specialtyGroup: displayLabel(key),
      physicianCount,
      totalPaymentsMillions: Math.round((totalPayments / 1_000_000) * 10) / 10,
      averagePaymentGross,
      // Cast: interface still types number; runtime null marks unavailable.
      servicesPerPatient: servicesPerPatient as unknown as number,
    });
  }
  // Sort by total payments descending so the most material specialties lead.
  records.sort((a, b) => b.totalPaymentsMillions - a.totalPaymentsMillions);
  return records;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[OpenAlbertaBilling] Starting physician billing fetch');

  try {
    const url = await findSupplementWorkbookUrl();
    if (!url) {
      console.warn(
        '[OpenAlbertaBilling] AHCIP Statistical Supplement workbook not found — leaving data-spending.json unchanged.',
      );
      return {
        domain: 'spending',
        pipeline: 'openAlbertaBillingFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'AHCIP Statistical Supplement combined workbook not found on Open Alberta CKAN',
      };
    }

    console.log(`[OpenAlbertaBilling] Downloading: ${url}`);
    const buffer = await downloadBuffer(url);
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAlbertaBilling] Failed to parse workbook: ${msg}`);
      return {
        domain: 'spending',
        pipeline: 'openAlbertaBillingFetcher',
        status: 'failed',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `Failed to parse AHCIP Statistical Supplement workbook: ${msg}`,
      };
    }

    const counts = parseYearSeriesSheet(workbook, 'Table_2.12 A');
    const avgPayments = parseYearSeriesSheet(workbook, 'Table_2.12 B');
    const services = parseYearSeriesSheet(workbook, 'Table_2.12 D');
    const payments = parsePaymentsBySpecialty(workbook);
    const registeredPersons = parseRegisteredPersons(workbook);

    const records = buildRecords(counts, avgPayments, services, payments, registeredPersons);

    if (records.length === 0) {
      console.warn(
        '[OpenAlbertaBilling] No billing records extracted from workbook — leaving data-spending.json unchanged.',
      );
      return {
        domain: 'spending',
        pipeline: 'openAlbertaBillingFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No physician billing records matched the expected table shape',
      };
    }

    // Merge into data-spending.json, preserving measured arrays. Stamp
    // _dataMetadata for PHYSICIAN_SPECIALTY_BILLING; sibling entries (e.g.
    // NATIONAL_SPENDING_COMPARE) are preserved via mergeDataMetadata.
    // HOSPITAL_EFFICIENCY_TREND is withheld and forced empty on write.
    const existingJson = loadJsonFile(SPENDING_FILE);
    // Never reintroduce scrubbed hospital-efficiency estimates via RMW.
    existingJson.HOSPITAL_EFFICIENCY_TREND = [];
    const ownedMetadata: DataMetadata = {
      PHYSICIAN_SPECIALTY_BILLING: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta AHCIP Statistical Supplement (combined workbook)',
        sourceVintage: 'AHCIP Statistical Supplement — latest release (Tables 2.3, 2.12 A/B/D, 2.14)',
        lastUpdated: timestamp,
        verification:
          'Physician count, average gross payment, and service counts are joined from AHCIP Statistical Supplement Tables 2.12 A/B/D (latest service year). Total payments sum FFS+BCP+RRNP+MEDR from Table 2.3. servicesPerPatient = services / registered persons from Table 2.14 when present; otherwise null (Pathology/Radiology excluded by source — never zero-filled).',
      }),
    };
    const merged = {
      ...existingJson,
      PHYSICIAN_SPECIALTY_BILLING: records,
      HOSPITAL_EFFICIENCY_TREND: [],
      _dataMetadata: mergeDataMetadata(
        existingJson._dataMetadata as DataMetadata | undefined,
        ownedMetadata,
      ),
    };
    applyWithheldPayloadGuard(merged);
    fs.writeFileSync(SPENDING_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    console.log(
      `[OpenAlbertaBilling] Complete. fetched=${records.length} written=${records.length} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'spending',
      pipeline: 'openAlbertaBillingFetcher',
      status: 'success',
      recordsFetched: records.length,
      recordsWritten: records.length,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAlbertaBilling] FAILED:', errorMsg);
    return {
      domain: 'spending',
      pipeline: 'openAlbertaBillingFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point
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
