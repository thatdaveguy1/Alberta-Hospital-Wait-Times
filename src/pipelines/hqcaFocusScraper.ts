// HQCA FOCUS on Healthcare Scraper
// Scrapes the HQCA FOCUS on Healthcare interactive dashboard
// (https://focus.hqca.ca/) for zone-level primary care metrics.
//
// The dashboard is a React app that loads CSV data files from:
//   https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/data/{category}/{filename}.csv
//
// Each chart page has a JS config at:
//   https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/reports/{category}/{chart_name}.js
// which contains `reportDataUrl: 'data/{category}/{filename}.csv'`
//
// Writes to:
//   - data-primary-care.json: CONTINUITY_SATISFACTION_HQCA (from visits_to_one_family_doctor.csv)

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';

const PRIMARY_CARE_FILE = path.join(process.cwd(), 'data-primary-care.json');

const HQCA_DATA_BASE =
  'https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/data';
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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


// Parse CSV text into rows (simple parser — handles quoted fields)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some((f) => f.trim() !== '')) rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.trim() !== '')) rows.push(currentRow);
  }
  return rows;
}

// Fetch a CSV data file from HQCA FOCUS
async function fetchCsv(category: string, filename: string): Promise<string[][] | null> {
  try {
    const url = `${HQCA_DATA_BASE}/${category}/${filename}`;
    console.log(`[HqcaFocus] Fetching: ${url}`);
    const response = await axios.get<string>(url, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/csv' },
      responseType: 'text',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    return parseCsv(response.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[HqcaFocus] CSV fetch failed (${category}/${filename}): ${msg}`);
    return null;
  }
}

// Parse continuity satisfaction data from CSV
// Format: Fiscal Yr,Zone,PCN Name,Continuity to Family Doctor
interface ContinuityRecord {
  fiscalYear: string;
  zone: string;
  pcnName: string;
  continuityPct: number | null;
}

function parseContinuitySatisfaction(rows: string[][]): ContinuityRecord[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const yrIdx = headers.findIndex((h) => h.toLowerCase().includes('fiscal') || h.toLowerCase().includes('year'));
  const zoneIdx = headers.findIndex((h) => h.toLowerCase() === 'zone');
  const pcnIdx = headers.findIndex((h) => h.toLowerCase().includes('pcn'));
  const valIdx = headers.findIndex((h) => h.toLowerCase().includes('continuity'));
  if (yrIdx === -1 || zoneIdx === -1 || valIdx === -1) return [];

  const records: ContinuityRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;
    const fiscalYear = row[yrIdx]?.trim() ?? '';
    const zone = row[zoneIdx]?.trim() ?? '';
    const pcnName = pcnIdx >= 0 ? (row[pcnIdx]?.trim() ?? '') : '';
    const valStr = row[valIdx]?.trim() ?? '';
    const val = valStr ? parseFloat(valStr) : NaN;
    records.push({
      fiscalYear,
      zone,
      pcnName,
      continuityPct: Number.isFinite(val) ? val * 100 : null, // CSV stores 0-1, convert to %
    });
  }
  return records;
}

function deriveContinuitySourceVintage(records: ContinuityRecord[]): string {
  const years = [...new Set(records.map((r) => r.fiscalYear).filter(Boolean))].sort((a, b) => {
    const ay = parseInt(a.split('/')[0], 10) || 0;
    const by = parseInt(b.split('/')[0], 10) || 0;
    return ay - by;
  });
  if (years.length === 0) return 'HQCA FOCUS primary care continuity survey';
  if (years.length === 1) return `Fiscal year ${years[0]}`;
  return `Fiscal years ${years[0]} to ${years[years.length - 1]}`;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[HqcaFocus] Starting HQCA FOCUS dashboard scrape');

  try {
    let totalRecords = 0;

    // 1. Fetch continuity satisfaction (primary care)
    const continuityCsv = await fetchCsv('pc_measures', 'visits_to_one_family_doctor.csv');
    let continuityRecords: ContinuityRecord[] = [];
    if (continuityCsv) {
      continuityRecords = parseContinuitySatisfaction(continuityCsv);
      console.log(`[HqcaFocus] Parsed ${continuityRecords.length} continuity records`);
      totalRecords += continuityRecords.length;
    }

    // 2. Fetch clinic continuity
    const clinicCsv = await fetchCsv('pc_measures', 'visits_to_one_clinic.csv');
    let clinicRecords: ContinuityRecord[] = [];
    if (clinicCsv) {
      clinicRecords = parseContinuitySatisfaction(clinicCsv);
      console.log(`[HqcaFocus] Parsed ${clinicRecords.length} clinic continuity records`);
      totalRecords += clinicRecords.length;
    }

    // 3. Fetch screening tests
    const screeningCsv = await fetchCsv('pc_measures', 'screening_tests.csv');
    let screeningRecords: ContinuityRecord[] = [];
    if (screeningCsv) {
      screeningRecords = parseContinuitySatisfaction(screeningCsv);
      console.log(`[HqcaFocus] Parsed ${screeningRecords.length} screening records`);
      totalRecords += screeningRecords.length;
    }

    if (totalRecords === 0) {
      console.warn('[HqcaFocus] No records extracted — leaving data files unchanged.');
      return {
        domain: 'primary-care',
        pipeline: 'hqcaFocusScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'HQCA FOCUS CSV endpoints returned no parseable records',
      };
    }

    // Merge into primary-care file (continuity satisfaction)
    let recordsWritten = 0;
    if (continuityRecords.length > 0) {
      const existing = loadJsonFile(PRIMARY_CARE_FILE);
      // Convert to the format expected by the dashboard
      const satisfactionData = continuityRecords
        .filter((r) => r.pcnName === '' && r.continuityPct !== null) // Zone-level only
        .map((r) => ({
          zone: r.zone,
          fiscalYear: r.fiscalYear,
          continuityPct: r.continuityPct,
        }));
      const ownedMetadata: DataMetadata = {
        CONTINUITY_SATISFACTION_HQCA: buildMetadataEntry({
          updateType: 'auto',
          source: 'HQCA FOCUS Primary Healthcare Experience',
          sourceVintage: deriveContinuitySourceVintage(continuityRecords),
        }),
      };
      const merged = {
        ...existing,
        CONTINUITY_SATISFACTION_HQCA: satisfactionData,
        _dataMetadata: mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          ownedMetadata,
        ),
      };
      applyWithheldPayloadGuard(merged as Record<string, unknown>);
      fs.writeFileSync(PRIMARY_CARE_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      recordsWritten = satisfactionData.length;
    }

    console.log(
      `[HqcaFocus] Complete. fetched=${totalRecords} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'primary-care',
      pipeline: 'hqcaFocusScraper',
      status: 'success',
      recordsFetched: totalRecords,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[HqcaFocus] FAILED:', errorMsg);
    return {
      domain: 'primary-care',
      pipeline: 'hqcaFocusScraper',
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
