// Open Alberta Physician Billing Fetcher
// Downloads AHCIP physician billing statistical reports from Open Alberta
// and writes PHYSICIAN_SPECIALTY_BILLING to data-spending.json.
//
// Source: https://open.alberta.ca/opendata?tags=Physician+Billing
// The datasets are published as CSV/Excel on Open Alberta (CKAN).

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';

const SPENDING_FILE = path.join(process.cwd(), 'data-spending.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Open Alberta CKAN dataset search for physician billing
const CKAN_SEARCH_URL = 'https://open.alberta.ca/api/3/action/package_search';
const BILLING_TAG_QUERY = 'physician billing';

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
    headers: { 'User-Agent': USER_AGENT },
  });
  return Buffer.from(response.data);
}

// Search Open Alberta CKAN for physician billing datasets
async function findBillingResourceUrls(): Promise<string[]> {
  try {
    const response = await axios.get(CKAN_SEARCH_URL, {
      params: { q: BILLING_TAG_QUERY, rows: 20 },
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT },
    });
    const results = response.data?.result?.results ?? [];
    const urls: string[] = [];
    for (const pkg of results) {
      const resources = pkg.resources ?? [];
      for (const res of resources) {
        const format = (res.format ?? '').toLowerCase();
        const url = res.url as string;
        if (url && (format.includes('xlsx') || format.includes('csv') || format.includes('excel'))) {
          urls.push(url);
        }
      }
    }
    return urls;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OpenAlbertaBilling] CKAN search failed: ${msg}`);
    return [];
  }
}

// Parse a billing workbook/CSV into PhysicianPaymentSpecialty records
function parseBillingData(buffer: Buffer, url: string): PhysicianPaymentSpecialty[] {
  const isCsv = url.toLowerCase().endsWith('.csv');
  let workbook: XLSX.WorkBook;
  try {
    if (isCsv) {
      workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    }
  } catch {
    return [];
  }

  const out: PhysicianPaymentSpecialty[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    if (rows.length < 2) continue;

    // Find header row with specialty/count/payments columns
    let headerIdx = -1;
    let specialtyCol = -1;
    let countCol = -1;
    let paymentsCol = -1;
    let avgPaymentCol = -1;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const header = rows[i];
      if (!header) continue;
      for (let j = 0; j < header.length; j++) {
        const cell = asString(header[j])?.toLowerCase() ?? '';
        if (cell.includes('specialty') || cell.includes('specialization') || cell.includes('practice type')) {
          specialtyCol = j;
        }
        if (cell.includes('count') || cell.includes('number of physicians') || cell.includes('physician count')) {
          countCol = j;
        }
        if (cell.includes('total payment') || cell.includes('total billing') || cell.includes('payments')) {
          paymentsCol = j;
        }
        if (cell.includes('average') || cell.includes('avg') || cell.includes('mean payment')) {
          avgPaymentCol = j;
        }
      }
      if (specialtyCol >= 0 && (countCol >= 0 || paymentsCol >= 0)) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx < 0 || specialtyCol < 0) continue;

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const specialty = asString(row[specialtyCol]);
      if (!specialty || specialty.toLowerCase().includes('total') || specialty.toLowerCase().includes('all')) continue;
      const count = asNumber(row[countCol]) ?? 0;
      const payments = asNumber(row[paymentsCol]);
      const avgPayment = asNumber(row[avgPaymentCol]);

      // Skip rows with no useful data
      if (count === 0 && payments === undefined && avgPayment === undefined) continue;

      out.push({
        specialtyGroup: specialty,
        physicianCount: count,
        totalPaymentsMillions: payments !== undefined ? Math.round(payments * 10) / 10 : 0,
        averagePaymentGross: avgPayment ?? 0,
        servicesPerPatient: 0,
      });
    }
  }
  return out;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[OpenAlbertaBilling] Starting physician billing fetch');

  try {
    const urls = await findBillingResourceUrls();
    if (urls.length === 0) {
      console.warn('[OpenAlbertaBilling] No billing datasets found on Open Alberta — leaving data-spending.json unchanged.');
      return {
        domain: 'spending',
        pipeline: 'openAlbertaBillingFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No physician billing datasets found on Open Alberta CKAN',
      };
    }

    let allRecords: PhysicianPaymentSpecialty[] = [];
    for (const url of urls) {
      try {
        console.log(`[OpenAlbertaBilling] Downloading: ${url}`);
        const buffer = await downloadBuffer(url);
        const records = parseBillingData(buffer, url);
        allRecords = allRecords.concat(records);
        await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenAlbertaBilling] Failed to download/parse ${url}: ${msg}`);
      }
    }

    if (allRecords.length === 0) {
      console.warn('[OpenAlbertaBilling] No billing records extracted — leaving data-spending.json unchanged.');
      return {
        domain: 'spending',
        pipeline: 'openAlbertaBillingFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No physician billing records matched the expected shape',
      };
    }

    // Merge into data-spending.json, preserving all other arrays
    const existingJson = loadJsonFile(SPENDING_FILE);
    const merged = { ...existingJson, PHYSICIAN_SPECIALTY_BILLING: allRecords };
    fs.writeFileSync(SPENDING_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    console.log(
      `[OpenAlbertaBilling] Complete. fetched=${allRecords.length} written=${allRecords.length} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'spending',
      pipeline: 'openAlbertaBillingFetcher',
      status: 'success',
      recordsFetched: allRecords.length,
      recordsWritten: allRecords.length,
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
