// CIHI Indicator Library — Primary Care Attachment fetcher.
// Downloads the CIHI "indicator-library-all-indicator-data-en.xlsx" workbook
// (~73 MB, contains every CIHI indicator), locates the Shared Health Priorities
// sheet, filters rows for the "regular health care provider" / "attachment"
// indicator, and merges Alberta + Canada + AHS-zone attachment rates into
// data-primary-care.json. All failures are caught and returned as a SyncResult
// — run() never throws.

import axios from 'axios';
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SyncResult } from './types';
import type { AttachmentRate } from '../primaryCareData';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

const INDICATOR_XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/indicator-library-all-indicator-data-en.xlsx';
const DATA_FILE = path.join(process.cwd(), 'data-primary-care.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SOURCE_NAME = 'CIHI Shared Health Priorities';
const SOURCE_URL =
  'https://www.cihi.ca/en/dashboards/shared-health-priorities-primary-health-care';

// 73 MB workbook — allow headroom.
const MAX_BYTES = 120 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const PYTHON_SCRIPT = path.join(process.cwd(), 'scripts', 'extract_cihi_attachment.py');
const PYTHON_TIMEOUT_MS = 600_000; // 10 min for 822K-row workbook

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

// Merge the ATTACHMENT_RATES array into the existing JSON, preserving genuine
// upstream keys (ACCEPTING_PROVIDERS, etc.). Force withheld primary-care residual
// arrays empty so RMW never reintroduces them. Dedupe by id, preferring the
// freshly fetched rows. Returns the number of records written.
function mergeAndWrite(file: string, newRates: AttachmentRate[]): number {
  if (newRates.length === 0) return 0;
  const existing = loadJsonFile(file);

  // Force primary-care withheld residual arrays empty so RMW never reintroduces them.
  existing.PCN_CAPACITY = [];
  existing.ED_RELIANCE_BY_CONTINUITY = [];
  existing.CONTINUITY_SATISFACTION = [];

  const prevRaw = existing['ATTACHMENT_RATES'];
  const prev: AttachmentRate[] = Array.isArray(prevRaw)
    ? (prevRaw as unknown[]).filter(
        (r): r is AttachmentRate =>
          typeof r === 'object' && r !== null && typeof (r as Record<string, unknown>).id === 'string',
      )
    : [];

  const byId = new Map<string, AttachmentRate>();
  for (const r of prev) byId.set(r.id, r);
  for (const r of newRates) byId.set(r.id, r);

  const merged = Array.from(byId.values());
  existing['ATTACHMENT_RATES'] = merged;

  const ownedMetadata: DataMetadata = {
    ATTACHMENT_RATES: buildMetadataEntry({
      updateType: 'auto',
      source: SOURCE_NAME,
      sourceVintage: 'CIHI Shared Health Priorities Primary Health Care dashboard',
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
  );

  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
  return merged.length;
}


// Run the Python extraction script against a local workbook file.
// Returns parsed AttachmentRate[] or throws on error.
function runPythonExtraction(xlsxPath: string): Promise<AttachmentRate[]> {
  const { promise, resolve, reject } = Promise.withResolvers<AttachmentRate[]>();
  execFile(
    'python3',
    [PYTHON_SCRIPT, xlsxPath],
    { timeout: PYTHON_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024, env: process.env },
    (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Python extraction failed: ${err.message}${stderr ? `\n${stderr}` : ''}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as { rates: AttachmentRate[]; error: string | null };
        if (parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve(parsed.rates.map(r => ({
          ...r,
          source_name: SOURCE_NAME,
          source_url: SOURCE_URL,
          unit: 'percent' as const,
        })));
      } catch (parseErr) {
        reject(new Error(`Python JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`));
      }
    },
  );
  return promise;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[PrimaryCareFetcher] Starting CIHI Indicator Library download + parse');

  try {
    const { promise: delayPromise, resolve: delayResolve } = Promise.withResolvers<void>();
    setTimeout(delayResolve, RATE_LIMIT_MS);
    await delayPromise;

    console.log(`[PrimaryCareFetcher] Downloading ${INDICATOR_XLSX_URL}`);
    let buffer: Buffer;
    try {
      const response = await axios.get(INDICATOR_XLSX_URL, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': USER_AGENT },
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxContentLength: MAX_BYTES,
        maxRedirects: 5,
      });
      buffer = Buffer.from(response.data as ArrayBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[PrimaryCareFetcher] Download failed: ${msg}`);
      return {
        domain: 'primary-care',
        pipeline: 'primaryCareFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `XLSX download failed: ${msg}`,
      };
    }

    console.log(`[PrimaryCareFetcher] Downloaded ${Math.round(buffer.length / 1024 / 1024)} MB`);

    // Write to temp file for Python/openpyxl to stream-read.
    const tmpPath = path.join(os.tmpdir(), `cihi-indicator-library-${Date.now()}.xlsx`);
    try {
      fs.writeFileSync(tmpPath, buffer);
      console.log(`[PrimaryCareFetcher] Wrote temp workbook to ${tmpPath}`);

      const rates = await runPythonExtraction(tmpPath);
      if (rates.length === 0) {
        console.warn('[PrimaryCareFetcher] No attachment-rate rows matched — leaving data file unchanged.');
        return {
          domain: 'primary-care',
          pipeline: 'primaryCareFetcher',
          status: 'skipped',
          recordsFetched: 0,
          recordsWritten: 0,
          durationMs: Date.now() - startTime,
          timestamp,
          error: 'No Shared Health Priorities attachment rows found in workbook',
        };
      }

      const written = mergeAndWrite(DATA_FILE, rates);
      const status: SyncResult['status'] = written > 0 ? 'success' : 'skipped';
      console.log(
        `[PrimaryCareFetcher] Complete. fetched=${rates.length} written=${written} in ${Date.now() - startTime}ms`,
      );

      return {
        domain: 'primary-care',
        pipeline: 'primaryCareFetcher',
        status,
        recordsFetched: rates.length,
        recordsWritten: written,
        durationMs: Date.now() - startTime,
        timestamp,
      };
    } finally {
      try { fs.unlinkSync(tmpPath); } catch { /* temp file cleanup best-effort */ }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[PrimaryCareFetcher] FAILED:', errorMsg);
    return {
      domain: 'primary-care',
      pipeline: 'primaryCareFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'failed' ? 1 : 0);
  });
}
