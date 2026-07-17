// CIHI Priority Procedures Wait Times Fetcher
// Fetches wait times for priority procedures (including cancer surgeries,
// joint replacements, diagnostic imaging) from CIHI's comprehensive
// 2008-2025 data tables XLSX.
//
// Source:
//   https://www.cihi.ca/sites/default/files/document/wait-times-priority-procedures-in-canada-2008-2025-data-tables-en.xlsx
//
// Writes to:
//   - data-cancer.json: CIHI_CANCER_WAIT_TIMES
//   - data-surgical.json: CIHI_PRIORITY_PROCEDURE_WAITS
//   - data-diagnostic.json: CIHI_DIAGNOSTIC_WAIT_TIMES

import axios from 'axios';
import fs from 'fs';
import * as XLSX from 'xlsx';
import path from 'path';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type { SyncResult } from './types';

const CANCER_FILE = path.join(process.cwd(), 'data-cancer.json');
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');

const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const WAIT_TIMES_URL =
  'https://www.cihi.ca/sites/default/files/document/wait-times-priority-procedures-in-canada-2008-2025-data-tables-en.xlsx';

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

interface WaitTimeRecord {
  reportingLevel: string;
  province: string;
  region: string;
  indicator: string;
  metric: string;
  dataYear: string;
  unit: string;
  result: string;
}

// Classify an indicator into a domain
function classifyIndicator(indicator: string): 'cancer' | 'surgical' | 'diagnostic' {
  const lower = indicator.toLowerCase();
  if (lower.includes('cancer') || lower.includes('mammog') || lower.includes('screen')) {
    return 'cancer';
  }
  if (lower.includes('mri') || lower.includes('ct') || lower.includes('imaging') || lower.includes('ultrasound')) {
    return 'diagnostic';
  }
  return 'surgical';
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CihiWaitTimesPriority] Starting CIHI priority procedures wait times fetch');

  try {
    console.log(`[CihiWaitTimesPriority] Downloading: ${WAIT_TIMES_URL}`);
    const response = await axios.get<Buffer>(WAIT_TIMES_URL, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT },
      maxContentLength: 50 * 1024 * 1024,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    const buffer = Buffer.from(response.data);
    console.log(`[CihiWaitTimesPriority] XLSX size: ${buffer.length} bytes`);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const dataSheetName = workbook.SheetNames.find((n) => n.includes('Table'));
    if (!dataSheetName) {
      console.warn('[CihiWaitTimesPriority] No data table sheet found');
      return {
        domain: 'surgical',
        pipeline: 'cihiWaitTimesPriorityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No data table sheet found in XLSX',
      };
    }

    const sheet = workbook.Sheets[dataSheetName];
    const ref = sheet['!ref'];
    if (ref) {
      const decoded = XLSX.utils.decode_range(ref);
      // Clamp columns — CIHI workbooks have XFD ranges
      if (decoded.e.c > 10) decoded.e.c = 10;
      sheet['!ref'] = XLSX.utils.encode_range(decoded);
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    if (rows.length < 2) {
      console.warn('[CihiWaitTimesPriority] No data rows found');
      return {
        domain: 'surgical',
        pipeline: 'cihiWaitTimesPriorityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No data rows in XLSX',
      };
    }

    // Build column mapping from first row
    const headerRow = rows[0];
    const columnMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(headerRow)) {
      const colName = String(value).trim();
      if (colName) {
        // Normalize column names
        if (colName.includes('Reporting level')) columnMap[key] = 'reportingLevel';
        else if (colName === 'Province') columnMap[key] = 'province';
        else if (colName === 'Region') columnMap[key] = 'region';
        else if (colName === 'Indicator') columnMap[key] = 'indicator';
        else if (colName === 'Metric') columnMap[key] = 'metric';
        else if (colName.includes('Data year')) columnMap[key] = 'dataYear';
        else if (colName.includes('Unit')) columnMap[key] = 'unit';
        else if (colName.includes('Indicator result')) columnMap[key] = 'result';
        else columnMap[key] = colName;
      }
    }

    // Parse rows, filter to Alberta
    const cancerRecords: WaitTimeRecord[] = [];
    const surgicalRecords: WaitTimeRecord[] = [];
    const diagnosticRecords: WaitTimeRecord[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const record: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const colName = columnMap[key] || key;
        record[colName] = value;
      }

      const province = String(record['province'] || '').trim();
      if (!province.includes('Alberta') && province !== 'AB') continue;

      const indicator = String(record['indicator'] || '').trim();
      if (!indicator) continue;

      const waitRecord: WaitTimeRecord = {
        reportingLevel: String(record['reportingLevel'] || '').trim(),
        province: 'Alberta',
        region: String(record['region'] || '').trim(),
        indicator,
        metric: String(record['metric'] || '').trim(),
        dataYear: String(record['dataYear'] || '').trim(),
        unit: String(record['unit'] || '').trim(),
        result: String(record['result'] || '').trim(),
      };

      const domain = classifyIndicator(indicator);
      if (domain === 'cancer') cancerRecords.push(waitRecord);
      else if (domain === 'diagnostic') diagnosticRecords.push(waitRecord);
      else surgicalRecords.push(waitRecord);
    }

    console.log(`[CihiWaitTimesPriority] Alberta records: cancer=${cancerRecords.length}, surgical=${surgicalRecords.length}, diagnostic=${diagnosticRecords.length}`);

    const totalRecords = cancerRecords.length + surgicalRecords.length + diagnosticRecords.length;
    if (totalRecords === 0) {
      console.warn('[CihiWaitTimesPriority] No Alberta records found');
      return {
        domain: 'surgical',
        pipeline: 'cihiWaitTimesPriorityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No Alberta records in XLSX',
      };
    }

    // Write to domain files
    if (cancerRecords.length > 0) {
      const existing = loadJsonFile(CANCER_FILE);
      const ownedMetadata: DataMetadata = {
        CIHI_CANCER_WAIT_TIMES: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: '2008–2025',
          lastUpdated: timestamp,
        }),
      };
      const merged = {
        ...existing,
        CIHI_CANCER_WAIT_TIMES: cancerRecords,
        _dataMetadata: mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          ownedMetadata,
        ),
      };
      applyWithheldPayloadGuard(merged);
      fs.writeFileSync(CANCER_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log(`[CihiWaitTimesPriority] Wrote ${cancerRecords.length} cancer records to data-cancer.json`);
    }

    if (surgicalRecords.length > 0) {
      const existing = loadJsonFile(SURGICAL_FILE);
      const ownedMetadata: DataMetadata = {
        CIHI_PRIORITY_PROCEDURE_WAITS: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: '2008–2025',
          lastUpdated: timestamp,
        }),
      };
      const merged = {
        ...existing,
        CIHI_PRIORITY_PROCEDURE_WAITS: surgicalRecords,
        _dataMetadata: mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          ownedMetadata,
        ),
      };
      applyWithheldPayloadGuard(merged);
      fs.writeFileSync(SURGICAL_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log(`[CihiWaitTimesPriority] Wrote ${surgicalRecords.length} surgical records to data-surgical.json`);
    }

    if (diagnosticRecords.length > 0) {
      const existing = loadJsonFile(DIAGNOSTIC_FILE);
      const ownedMetadata: DataMetadata = {
        CIHI_DIAGNOSTIC_WAIT_TIMES: buildMetadataEntry({
          updateType: 'auto',
          source: 'CIHI Wait Times Priority Procedures in Canada',
          sourceVintage: '2008–2025',
          lastUpdated: timestamp,
        }),
      };
      const merged = {
        ...existing,
        CIHI_DIAGNOSTIC_WAIT_TIMES: diagnosticRecords,
        _dataMetadata: mergeDataMetadata(
          existing._dataMetadata as DataMetadata | undefined,
          ownedMetadata,
        ),
      };
      applyWithheldPayloadGuard(merged);
      fs.writeFileSync(DIAGNOSTIC_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
      console.log(`[CihiWaitTimesPriority] Wrote ${diagnosticRecords.length} diagnostic records to data-diagnostic.json`);
    }

    console.log(
      `[CihiWaitTimesPriority] Complete. fetched=${totalRecords} written=${totalRecords} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'surgical',
      pipeline: 'cihiWaitTimesPriorityFetcher',
      status: 'success',
      recordsFetched: totalRecords,
      recordsWritten: totalRecords,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CihiWaitTimesPriority] FAILED:', errorMsg);
    return {
      domain: 'surgical',
      pipeline: 'cihiWaitTimesPriorityFetcher',
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
