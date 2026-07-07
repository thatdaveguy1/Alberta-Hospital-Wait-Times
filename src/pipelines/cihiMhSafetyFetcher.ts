// CIHI Mental Health & Clinical Safety Fetcher
// Fetches mental health and clinical safety indicators from CIHI's
// indicator library data tables.
//
// Sources:
//   - 30-Day Readmission for Mental Health and Substance Use:
//     https://www.cihi.ca/sites/default/files/document/data-file/803-30-day-readmission-for-mental-health-and-substance-use-data-table-en.xlsx
//
// Writes to:
//   - data-mental-health.json: CIHI_MH_READMISSION_RATES
//   - data-patient-experience.json: CIHI_CLINICAL_SAFETY_INDICATORS

import axios from 'axios';
import fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';
import type { SyncResult } from './types';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';

const MENTAL_HEALTH_FILE = path.join(process.cwd(), 'data-mental-health.json');
const PATIENT_EXPERIENCE_FILE = path.join(process.cwd(), 'data-patient-experience.json');
const SYSTEM_FLOW_FILE = path.join(process.cwd(), 'data-system-flow.json');
const SPENDING_FILE = path.join(process.cwd(), 'data-spending.json');
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const PRIMARY_CARE_FILE = path.join(process.cwd(), 'data-primary-care.json');

const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// CIHI indicator data table URLs
const INDICATOR_URLS: { url: string; domain: string; key: string }[] = [
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/803-30-day-readmission-for-mental-health-and-substance-use-data-table-en.xlsx',
    domain: 'mental-health',
    key: 'CIHI_MH_READMISSION_RATES',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/827-all-patients-readmitted-to-hospital-data-table-en.xlsx',
    domain: 'patient-experience',
    key: 'CIHI_ALL_READMISSION_RATES',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/832-ambulatory-care-sensitive-conditions-hospitalizations-data-table-en.xlsx',
    domain: 'patient-experience',
    key: 'CIHI_ACSC_HOSPITALIZATIONS',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/878-average-acute-occupancy-rate-data-table-en.xlsx',
    domain: 'system-flow',
    key: 'CIHI_OCCUPANCY_RATES',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/818-average-acute-care-resource-use-intensity-data-table-en.xlsx',
    domain: 'spending',
    key: 'CIHI_RESOURCE_USE_INTENSITY',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/879-age-adjusted-public-spending-per-person-data-table-en.xlsx',
    domain: 'spending',
    key: 'CIHI_SPENDING_PER_PERSON',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/884-annual-change-in-surgical-volumes-since-start-of-covid-19-pandemic-data-table-en.xlsx',
    domain: 'surgical',
    key: 'CIHI_SURGICAL_VOLUME_TRENDS',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/889-canadians-who-were-satisfied-with-the-wait-time-to-see-a-health-provider-data-table-en.xlsx',
    domain: 'patient-experience',
    key: 'CIHI_WAIT_TIME_SATISFACTION',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/888-canadians-with-same-day-or-next-day-access-to-a-health-provider-data-table-en.xlsx',
    domain: 'primary-care',
    key: 'CIHI_SAME_DAY_ACCESS',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/843-joint-replacement-wait-times-data-table-en.xlsx',
    domain: 'surgical',
    key: 'CIHI_JOINT_REPLACEMENT_WAITS',
  },
  {
    url: 'https://www.cihi.ca/sites/default/files/document/data-file/811-emergency-department-wait-time-for-physician-initial-assessment-data-table-en.xlsx',
    domain: 'system-flow',
    key: 'CIHI_ED_WAIT_INITIAL_ASSESSMENT',
  },
];

// _dataMetadata entries this writer owns, grouped by domain data file. Only
// the keys actually refreshed in a given run are stamped (see run()), and
// sibling writers' entries are preserved via mergeDataMetadata.
const DOMAIN_METADATA_BUILDERS: Record<
  string,
  Record<string, (ts: string) => DataMetadata[string]>
> = {
  'system-flow': {
    CIHI_OCCUPANCY_RATES: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI indicator XLSX (878 average acute occupancy rate)',
        sourceVintage: 'CIHI indicator data table (latest available)',
        verification: 'Auto-fetched and parsed from CIHI indicator XLSX data table.',
        lastUpdated: ts,
      }),
    CIHI_ED_WAIT_INITIAL_ASSESSMENT: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI indicator XLSX (811 ED wait time for physician initial assessment)',
        sourceVintage: 'CIHI indicator data table (latest available)',
        verification: 'Auto-fetched and parsed from CIHI indicator XLSX data table.',
        lastUpdated: ts,
      }),
  },
  'mental-health': {
    CIHI_MH_READMISSION_RATES: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI 30-day mental-health readmission data table',
        sourceVintage: 'CIHI latest release',
        lastUpdated: ts,
      }),
  },
  'patient-experience': {
    CIHI_ALL_READMISSION_RATES: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI all-patients readmitted data table',
        sourceVintage: 'CIHI latest release',
        lastUpdated: ts,
      }),
    CIHI_ACSC_HOSPITALIZATIONS: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI ambulatory-care-sensitive-conditions hospitalizations',
        sourceVintage: 'CIHI latest release',
        lastUpdated: ts,
      }),
    CIHI_WAIT_TIME_SATISFACTION: (ts) =>
      buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI wait-time satisfaction data table',
        sourceVintage: 'CIHI latest release',
        lastUpdated: ts,
      }),
  },
};

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

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, '').replace(/%/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Download and parse a CIHI indicator XLSX file
async function fetchIndicatorXlsx(url: string): Promise<Record<string, unknown>[]> {
  try {
    console.log(`[CihiMhSafety] Downloading: ${url}`);
    const response = await axios.get<Buffer>(url, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT },
      maxContentLength: 50 * 1024 * 1024,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    const buffer = Buffer.from(response.data);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Find the data sheet (usually "Table 1")
    const dataSheetName = workbook.SheetNames.find((n) => n.includes('Table'));
    if (!dataSheetName) {
      console.warn(`[CihiMhSafety] No data table sheet found in ${url}`);
      return [];
    }

    const sheet = workbook.Sheets[dataSheetName];
    const ref = sheet['!ref'];
    if (ref) {
      const decoded = XLSX.utils.decode_range(ref);
      // Clamp columns — CIHI workbooks have XFD ranges
      if (decoded.e.c > 20) decoded.e.c = 20;
      sheet['!ref'] = XLSX.utils.encode_range(decoded);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    // The first row contains the real column names as values
    // Build normalized records from row 1 onward
    if (rows.length < 2) return [];

    // Get column mapping from first row
    const headerRow = rows[0];
    const columnMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(headerRow)) {
      const colName = asString(value);
      if (colName) {
        columnMap[key] = colName;
      }
    }

    const records: Record<string, unknown>[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const colName = columnMap[key] || key;
        record[colName] = value;
      }

      // Only include rows that have a Province/Territory value
      const province = asString(record['Province/Territory']);
      if (province) {
        // Filter to Alberta
        if (province.includes('Alberta') || province === 'AB') {
          record['Province/Territory'] = 'Alberta';
          records.push(record);
        }
      }
    }

    return records;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CihiMhSafety] Fetch failed: ${msg}`);
    return [];
  }
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  try {
    let totalRecords = 0;
    const updates: Record<string, Record<string, unknown[]>> = {};

    for (const indicator of INDICATOR_URLS) {
      const records = await fetchIndicatorXlsx(indicator.url);
      console.log(`[CihiMhSafety] Fetched ${records.length} Alberta records for ${indicator.key}`);

      if (records.length === 0) continue;

      totalRecords += records.length;
      const domain = indicator.domain;
      if (!updates[domain]) updates[domain] = {};
      updates[domain][indicator.key] = records;
    }

    if (totalRecords === 0) {
      console.warn('[CihiMhSafety] No records extracted — leaving data files unchanged.');
      return {
        domain: 'mental-health',
        pipeline: 'cihiMhSafetyFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'CIHI indicator XLSX downloads returned no Alberta records',
      };
    }

    // Write updates to domain-specific files
    const domainFiles: Record<string, string> = {
      'mental-health': MENTAL_HEALTH_FILE,
      'patient-experience': PATIENT_EXPERIENCE_FILE,
      'system-flow': SYSTEM_FLOW_FILE,
      'spending': SPENDING_FILE,
      'surgical': SURGICAL_FILE,
      'primary-care': PRIMARY_CARE_FILE,
    };

    for (const [domain, file] of Object.entries(domainFiles)) {
      const domainUpdates = updates[domain];
      if (!domainUpdates || Object.keys(domainUpdates).length === 0) continue;
      const existing = loadJsonFile(file);
      const merged: LoadedJson = { ...existing, ...domainUpdates };

      // Refresh _dataMetadata for the owned arrays actually updated this run
      // for any domain this writer stamps, preserving entries owned by sibling
      // writers (e.g. acuteCareScraper, ahsWeeklyEdLosScraper for system-flow,
      // goodcaringScraper/hqcaFocusScraper for patient-experience).
      const domainBuilders = DOMAIN_METADATA_BUILDERS[domain];
      if (domainBuilders) {
        const ownedMetadata: DataMetadata = {};
        for (const key of Object.keys(domainUpdates)) {
          const builder = domainBuilders[key];
          if (builder) {
            ownedMetadata[key] = builder(timestamp);
          }
        }
        if (Object.keys(ownedMetadata).length > 0) {
          merged._dataMetadata = mergeDataMetadata(
            existing._dataMetadata as DataMetadata | undefined,
            ownedMetadata,
          );
        }
      }

      fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log(`[CihiMhSafety] Wrote ${Object.keys(domainUpdates).length} keys to ${path.basename(file)}`);
    }

    console.log(
      `[CihiMhSafety] Complete. fetched=${totalRecords} written=${totalRecords} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'mental-health',
      pipeline: 'cihiMhSafetyFetcher',
      status: 'success',
      recordsFetched: totalRecords,
      recordsWritten: totalRecords,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CihiMhSafety] FAILED:', errorMsg);
    return {
      domain: 'mental-health',
      pipeline: 'cihiMhSafetyFetcher',
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
