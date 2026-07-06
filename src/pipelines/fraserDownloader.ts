// Fraser Institute PDF Downloader & Parser
// Downloads Fraser Institute health-spending / wait-time PDF reports, extracts
// text with pdf-parse, and merges any confidently-matched Alberta spending
// figures into data-spending.json.
//
// Fraser report layouts vary widely and change year to year, so extraction uses
// regex heuristics over the raw PDF text. When no confident matches are found,
// the existing data-spending.json is left untouched and a 'skipped' SyncResult
// is returned. run() never throws — all failures are caught and returned.

import axios from 'axios';
import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SyncResult } from './types';
import type { NationalSpendingCompare } from '../spendingData';

const FRASER_LANDING_URL = 'https://www.fraserinstitute.org/studies/health-care';
const SPENDING_FILE = path.join(process.cwd(), 'data-spending.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function asNumber(text: string): number | undefined {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// Discover absolute PDF download URLs linked from the Fraser landing page.
async function discoverPdfUrls(landingUrl: string): Promise<string[]> {
  const response = await axios.get(landingUrl, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });
  const html = typeof response.data === 'string' ? response.data : String(response.data);
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\.pdf$/i.test(href)) {
      try {
        urls.add(new URL(href, landingUrl).toString());
      } catch {
        /* ignore malformed hrefs */
      }
    }
  });
  return [...urls];
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': USER_AGENT },
    timeout: 60000,
    maxContentLength: 80 * 1024 * 1024,
  });
  return Buffer.from(response.data as ArrayBuffer);
}

// Extract Alberta per-capita health spending figures from PDF text.
// Looks for lines mentioning Alberta alongside a dollar-per-capita figure and
// optionally a % of GDP figure. Returns a partial NationalSpendingCompare.
function extractAlbertaSpending(text: string): Partial<NationalSpendingCompare> | null {
  const lines = text.split(/\r?\n/);
  let spendingPerCapita: number | undefined;
  let spendingAsPercentGdp: number | undefined;

  for (const line of lines) {
    if (!/alberta/i.test(line)) continue;

    // "$X,XXX per capita" or "per capita ... $X,XXX"
    if (spendingPerCapita === undefined) {
      const perCapitaMatch = line.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:per\s*capita|\/\s*capita)/i);
      if (perCapitaMatch) {
        spendingPerCapita = asNumber(perCapitaMatch[1]);
      } else {
        const reverse = line.match(/per\s*capita[^\d$]{0,20}\$\s*([\d,]+(?:\.\d+)?)/i);
        if (reverse) spendingPerCapita = asNumber(reverse[1]);
      }
    }

    // "X.X% of GDP"
    if (spendingAsPercentGdp === undefined) {
      const gdpMatch = line.match(/([\d.]+)\s*%\s*of\s*gdp/i);
      if (gdpMatch) spendingAsPercentGdp = asNumber(gdpMatch[1]);
    }

    if (spendingPerCapita !== undefined && spendingAsPercentGdp !== undefined) break;
  }

  if (spendingPerCapita === undefined && spendingAsPercentGdp === undefined) {
    return null;
  }
  return {
    province: 'Alberta',
    spendingPerCapita,
    spendingAsPercentGdp,
  };
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

// Merge an updated Alberta row into the existing NATIONAL_SPENDING_COMPARE
// array, preserving all other provinces. Returns the number of records written.
function mergeAlbertaSpending(file: string, update: Partial<NationalSpendingCompare>): number {
  const existing = loadJsonFile(file);
  const arr = Array.isArray(existing['NATIONAL_SPENDING_COMPARE'])
    ? (existing['NATIONAL_SPENDING_COMPARE'] as NationalSpendingCompare[])
    : [];

  const merged: NationalSpendingCompare[] = arr.map((row) => {
    if (row.province === 'Alberta') {
      return {
        ...row,
        ...update,
      } as NationalSpendingCompare;
    }
    return row;
  });

  if (!merged.some((row) => row.province === 'Alberta') && update.spendingPerCapita !== undefined) {
    merged.push({
      province: 'Alberta',
      spendingPerCapita: update.spendingPerCapita,
      spendingAsPercentGdp: update.spendingAsPercentGdp ?? 0,
      hospitalSpendingPerCapita: 0,
      physicianSpendingPerCapita: 0,
      drugSpendingPerCapita: 0,
      bedsPer100k: 0,
      costPerStandardStay: 0,
    });
  }

  existing['NATIONAL_SPENDING_COMPARE'] = merged;
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), 'utf8');
  return merged.length;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fraser-'));
  console.log('[FraserDownloader] Starting Fraser PDF download + parse');

  try {
    const pdfUrls = await discoverPdfUrls(FRASER_LANDING_URL);
    if (pdfUrls.length === 0) {
      console.warn('[FraserDownloader] No .pdf links found on landing page — skipping.');
      return {
        domain: 'spending',
        pipeline: 'fraserDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No PDF download links discovered on Fraser landing page',
      };
    }
    console.log(`[FraserDownloader] Discovered ${pdfUrls.length} PDF link(s).`);

    let bestUpdate: Partial<NationalSpendingCompare> | null = null;
    let recordsFetched = 0;

    for (let i = 0; i < pdfUrls.length; i++) {
      const url = pdfUrls[i];
      if (i > 0) await sleep(RATE_LIMIT_MS);
      console.log(`[FraserDownloader] Downloading (${i + 1}/${pdfUrls.length}): ${url}`);
      let buffer: Buffer;
      try {
        buffer = await downloadBuffer(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[FraserDownloader] Download failed for ${url}: ${msg}`);
        continue;
      }

      const tempPath = path.join(tempDir, `fraser-${i}.pdf`);
      try {
        fs.writeFileSync(tempPath, buffer);
        const parser = new PDFParse({ data: buffer });
        try {
          const result = await parser.getText();
          const extracted = extractAlbertaSpending(result.text);
          if (extracted) {
            recordsFetched += 1;
            // Prefer the extraction with the most fields populated.
            if (
              !bestUpdate ||
              (extracted.spendingPerCapita !== undefined && extracted.spendingAsPercentGdp !== undefined)
            ) {
              bestUpdate = extracted;
            }
          }
        } finally {
          await parser.destroy().catch(() => {
            /* ignore destroy errors */
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[FraserDownloader] Parse failed for ${url}: ${msg}`);
      } finally {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }

    if (!bestUpdate || recordsFetched === 0) {
      console.warn('[FraserDownloader] No Alberta spending figures extracted — leaving data-spending.json unchanged.');
      return {
        domain: 'spending',
        pipeline: 'fraserDownloader',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No Alberta spending figures matched in any Fraser PDF',
      };
    }

    const recordsWritten = mergeAlbertaSpending(SPENDING_FILE, bestUpdate);
    console.log(
      `[FraserDownloader] Complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'spending',
      pipeline: 'fraserDownloader',
      status: 'success',
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isBlocked = errorMsg.includes('403') || errorMsg.includes('status code 403');
    console.error(`[FraserDownloader] ${isBlocked ? 'BLOCKED' : 'FAILED'}:`, errorMsg);
    return {
      domain: 'spending',
      pipeline: 'fraserDownloader',
      status: isBlocked ? 'skipped' : 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: isBlocked ? 'Fraser Institute blocks automated access (403) — relying on CIHI/Open Alberta for spending data' : errorMsg,
      timestamp: new Date().toISOString(),
    };
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup errors */
    }
  }
}
