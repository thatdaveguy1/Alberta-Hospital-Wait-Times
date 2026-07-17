// HQCA FOCUS on Healthcare Scraper
// Scrapes the HQCA FOCUS on Healthcare interactive dashboard
// (https://focus.hqca.ca/) for zone-level patient experience metrics.
//
// The dashboard is a React app that loads CSV data files from:
//   https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/data/{category}/{filename}.csv
//
// Each chart page has a JS config at:
//   https://focus.hqa.ca/wp-content/themes/hcqa-focus/chart-test/reports/{category}/{chart_name}.js
// which contains `reportDataUrl: 'data/{category}/{filename}.csv'`
//
// Writes to:
//   - data-primary-care.json: CONTINUITY_SATISFACTION (from visits_to_one_family_doctor.csv)
//   - data-patient-experience.json: INPATIENT_EXPERIENCE_TRENDS (from px_overall.csv)

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
const PATIENT_EXPERIENCE_FILE = path.join(process.cwd(), 'data-patient-experience.json');

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

// Parse patient experience data from CSV
// Format: Year,Zone,Rating,Percentage
interface ExperienceRecord {
  year: string;
  zone: string;
  rating: number;
  percentage: number;
}

function parsePatientExperience(rows: string[][]): ExperienceRecord[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim());
  const yrIdx = headers.findIndex((h) => h.toLowerCase().includes('year'));
  const zoneIdx = headers.findIndex((h) => h.toLowerCase() === 'zone');
  const ratingIdx = headers.findIndex((h) => h.toLowerCase().includes('rating'));
  const pctIdx = headers.findIndex((h) => h.toLowerCase().includes('percentage') || h.toLowerCase().includes('pct'));
  if (yrIdx === -1 || zoneIdx === -1 || ratingIdx === -1 || pctIdx === -1) return [];

  const records: ExperienceRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 4) continue;
    const year = row[yrIdx]?.trim() ?? '';
    const zone = row[zoneIdx]?.trim() ?? '';
    const rating = parseInt(row[ratingIdx]?.trim() ?? '0', 10);
    const percentage = parseFloat(row[pctIdx]?.trim() ?? '0');
    if (year && Number.isFinite(rating) && Number.isFinite(percentage)) {
      records.push({ year, zone, rating, percentage });
    }
  }
  return records;
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

    // 2. Fetch patient experience overall rating
    const experienceCsv = await fetchCsv('patient_experience', 'px_overall.csv');
    let experienceRecords: ExperienceRecord[] = [];
    if (experienceCsv) {
      experienceRecords = parsePatientExperience(experienceCsv);
      console.log(`[HqcaFocus] Parsed ${experienceRecords.length} patient experience records`);
      totalRecords += experienceRecords.length;
    }

    // 3. Fetch clinic continuity
    const clinicCsv = await fetchCsv('pc_measures', 'visits_to_one_clinic.csv');
    let clinicRecords: ContinuityRecord[] = [];
    if (clinicCsv) {
      clinicRecords = parseContinuitySatisfaction(clinicCsv);
      console.log(`[HqcaFocus] Parsed ${clinicRecords.length} clinic continuity records`);
      totalRecords += clinicRecords.length;
    }

    // 4. Fetch screening tests
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
        domain: 'patient-experience',
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
          sourceVintage: 'HQCA FOCUS primary care continuity survey',
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
    }

    // Merge into patient-experience file
    if (experienceRecords.length > 0) {
      const existing = loadJsonFile(PATIENT_EXPERIENCE_FILE);
      // Convert to the format expected by the dashboard
      const experienceData = experienceRecords.map((r) => ({
        year: r.year,
        zone: r.zone,
        rating: r.rating,
        percentage: r.percentage,
      }));
      const ownedMetadata: DataMetadata = {
        INPATIENT_EXPERIENCE_TRENDS_HQCA: buildMetadataEntry({
          updateType: 'auto',
          source: 'HQCA FOCUS patient experience CSV',
          sourceVintage: 'Apr 2021 onward',
          lastUpdated: timestamp,
        }),
      };
      const merged = {
        ...existing,
        INPATIENT_EXPERIENCE_TRENDS_HQCA: experienceData,
        // Withheld non-HQCA trends must not reappear from existing.
        INPATIENT_EXPERIENCE_TRENDS: [],
        ED_EXPERIENCE_TRENDS: [],
        CLINICAL_SAFETY_TRENDS: [],
        PATIENT_COMPLAINTS: [],
        _dataMetadata: mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          ownedMetadata,
        ),
      };
      applyWithheldPayloadGuard(merged as Record<string, unknown>);
      fs.writeFileSync(PATIENT_EXPERIENCE_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    }

    console.log(
      `[HqcaFocus] Complete. fetched=${totalRecords} written=${totalRecords} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'patient-experience',
      pipeline: 'hqcaFocusScraper',
      status: 'success',
      recordsFetched: totalRecords,
      recordsWritten: totalRecords,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[HqcaFocus] FAILED:', errorMsg);
    return {
      domain: 'patient-experience',
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
