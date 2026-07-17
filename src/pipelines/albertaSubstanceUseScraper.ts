// Alberta Substance Use Surveillance Scraper
// Scrapes the Alberta Substance Use Surveillance System
// (https://www.alberta.ca/substance-use-surveillance-data)
// for opioid poisoning deaths, EMS responses, and substance harm trends.
//
// The surveillance system publishes quarterly PDF reports on Open Alberta.
// We download the latest PDF, extract text with pdftotext, and parse
// key metrics (apparent deaths, EMS responses, hospitalizations).
//
// Writes to:
//   - data-mental-health.json: SUBSTANCE_HARM_TRENDS (updates with latest year data)
//
// If the PDF is unavailable or parsing fails, the run is reported as 'skipped'
// and existing hand-authored data is preserved.

import axios from 'axios';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { SyncResult } from './types';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';

const OUTPUT_FILE = path.join(process.cwd(), 'data-mental-health.json');

const SUBSTANCE_USE_PAGE_URL = 'https://www.alberta.ca/substance-use-surveillance-data';
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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

// Extract the latest PDF report URL from the substance use surveillance page
async function findLatestPdfUrl(): Promise<string | null> {
  try {
    const response = await axios.get<string>(SUBSTANCE_USE_PAGE_URL, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      responseType: 'text',
    });

    // Find all PDF links — the most recent report is typically the first one listed
    const pdfUrls: string[] = [];
    const regex = /href="(https:\/\/open\.alberta\.ca\/dataset\/[^"]*\/download\/[^"]*\.pdf)"/gi;
    let match;
    while ((match = regex.exec(response.data)) !== null) {
      pdfUrls.push(match[1]);
    }

    if (pdfUrls.length === 0) return null;

    // Sort by year in URL descending — most recent first
    pdfUrls.sort((a, b) => {
      const yearA = parseInt(a.match(/20\d\d/)?.[0] ?? '0', 10);
      const yearB = parseInt(b.match(/20\d\d/)?.[0] ?? '0', 10);
      return yearB - yearA;
    });

    return pdfUrls[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AlbertaSubstanceUse] Failed to find PDF URL: ${msg}`);
    return null;
  }
}

// Download a PDF and extract text using pdftotext (poppler)
async function downloadAndExtractPdf(url: string): Promise<string | null> {
  const tmpDir = os.tmpdir();
  const pdfPath = path.join(tmpDir, `alberta-sus-${Date.now()}.pdf`);

  try {
    const response = await axios.get<Buffer>(url, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT },
      maxContentLength: 50 * 1024 * 1024,
    });
    fs.writeFileSync(pdfPath, Buffer.from(response.data));

    // Extract text with pdftotext
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf-8',
      timeout: 30000,
    });

    return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[AlbertaSubstanceUse] PDF extraction failed: ${msg}`);
    return null;
  } finally {
    try {
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    } catch {
      // ignore cleanup errors
    }
  }
}

// Parse substance harm trends from PDF text
// The reports contain tables with annual/quarterly counts
interface ParsedSubstanceData {
  year: string;
  apparentDeaths: number | null;
  emsResponses: number | null;
  hospitalizations: number | null;
  albertaRatePer100k: number | null;
  canadaRatePer100k: number | null;
}

function parseSubstanceDataFromPdf(text: string): ParsedSubstanceData[] {
  const results: ParsedSubstanceData[] = [];
  const lines = text.split('\n').map(l => l.trim());

  // Look for lines with year and death/apparent death counts
  // The PDFs typically have tables like:
  //   2024   1,234   45.6   ...
  //   2023   1,456   50.2   ...

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match year patterns (2020-2026)
    const yearMatch = line.match(/\b(20[2-3]\d)\b/);
    if (!yearMatch) continue;

    const year = yearMatch[1];

    // Look for apparent/opioid-related deaths on this line or nearby
    const deathMatch = line.match(/(\d{1,3}(?:,\d{3})*)\s*(?:apparent|death|opioid)/i);
    const emsMatch = line.match(/(\d{1,3}(?:,\d{3})*)\s*(?:ems|response|overdose)/i);
    const hospMatch = line.match(/(\d{1,3}(?:,\d{3})*)\s*(?:hospitaliz|admission)/i);
    const rateMatch = line.match(/(\d+\.?\d*)\s*(?:per\s*100|rate|100k)/i);

    const parseNum = (s: string | undefined): number | null => {
      if (!s) return null;
      const n = parseInt(s.replace(/,/g, ''), 10);
      return Number.isFinite(n) ? n : null;
    };

    const parseFloat = (s: string | undefined): number | null => {
      if (!s) return null;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    // Only add if we found at least one meaningful metric
    const deaths = parseNum(deathMatch?.[1]);
    const ems = parseNum(emsMatch?.[1]);
    const hosp = parseNum(hospMatch?.[1]);
    const rate = parseFloat(rateMatch?.[1]);

    if (deaths !== null || ems !== null || hosp !== null) {
      // Avoid duplicates — check if we already have this year
      if (!results.some(r => r.year === year)) {
        results.push({
          year,
          apparentDeaths: deaths,
          emsResponses: ems,
          hospitalizations: hosp,
          albertaRatePer100k: rate,
          canadaRatePer100k: null,
        });
      }
    }
  }

  return results;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AlbertaSubstanceUse] Starting Alberta Substance Use Surveillance scrape');

  try {
    // Find the latest PDF report URL
    console.log('[AlbertaSubstanceUse] Finding latest PDF report URL...');
    const pdfUrl = await findLatestPdfUrl();
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    if (!pdfUrl) {
      console.warn('[AlbertaSubstanceUse] No PDF report found — leaving data files unchanged.');
      return {
        domain: 'mental-health',
        pipeline: 'albertaSubstanceUseScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No PDF report URL found on substance use surveillance page',
      };
    }

    console.log(`[AlbertaSubstanceUse] Latest PDF: ${pdfUrl}`);

    // Download and extract PDF text
    console.log('[AlbertaSubstanceUse] Downloading and extracting PDF text...');
    const pdfText = await downloadAndExtractPdf(pdfUrl);
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    if (!pdfText) {
      console.warn('[AlbertaSubstanceUse] PDF text extraction failed — leaving data files unchanged.');
      return {
        domain: 'mental-health',
        pipeline: 'albertaSubstanceUseScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'PDF text extraction returned empty (pdftotext may not be installed)',
      };
    }

    console.log(`[AlbertaSubstanceUse] Extracted ${pdfText.length} chars from PDF`);

    // Parse substance data from PDF text
    const parsed = parseSubstanceDataFromPdf(pdfText);
    console.log(`[AlbertaSubstanceUse] Parsed ${parsed.length} year records from PDF`);

    if (parsed.length === 0) {
      console.warn('[AlbertaSubstanceUse] No records parsed from PDF — leaving data files unchanged.');
      return {
        domain: 'mental-health',
        pipeline: 'albertaSubstanceUseScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'PDF text parsing returned no substance harm records',
      };
    }

    // Fail closed: only write rows with complete source-backed core metrics.
    // Incomplete parses must not merge into (or stamp auto over) hand residuals.
    // canadaRatePer100k is optional (often absent from provincial PDFs).
    const completeRows = parsed
      .filter(
        (p) =>
          p.apparentDeaths !== null &&
          p.emsResponses !== null &&
          p.hospitalizations !== null &&
          p.albertaRatePer100k !== null,
      )
      .map((p) => ({
        year: p.year,
        substanceType: 'All Substances' as const,
        apparentDeaths: p.apparentDeaths as number,
        hospitalizations: p.hospitalizations as number,
        emsOverdoseResponses: p.emsResponses as number,
        albertaRatePer100k: p.albertaRatePer100k as number,
        // Keep 0 only as typed placeholder when Canada rate is not in the PDF —
        // UI should treat missing national comparator carefully if rate is 0 and
        // canada was null in parse. Prefer storing null when type allows; interface
        // currently requires number so 0 means "not reported".
        canadaRatePer100k: p.canadaRatePer100k ?? 0,
      }));

    if (completeRows.length === 0) {
      console.warn(
        '[AlbertaSubstanceUse] No complete source-backed rows — leaving data files unchanged.',
      );
      return {
        domain: 'mental-health',
        pipeline: 'albertaSubstanceUseScraper',
        status: 'skipped',
        recordsFetched: parsed.length,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error:
          'Parsed PDF rows incomplete (need deaths, EMS, hospitalizations, AB rate); SUBSTANCE_HARM_TRENDS left unavailable',
      };
    }

    const existing = loadJsonFile(OUTPUT_FILE);
    const ownedMetadata: DataMetadata = {
      SUBSTANCE_HARM_TRENDS: buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Substance Use Surveillance',
        sourceVintage: `PDF-derived complete years (${completeRows.map((r) => r.year).join(', ')})`,
        verification:
          'Only complete rows (deaths+EMS+hospitalizations+AB rate) written; no hand merge.',
        lastUpdated: timestamp,
      }),
    };
    const output = {
      ...existing,
      SUBSTANCE_HARM_TRENDS: completeRows,
      // Withheld residuals — never rehydrate scrubbed MH burden arrays.
      COMMUNITY_MH_WAITS: [],
      HOSPITAL_MHSU_BURDEN: [],
      _dataMetadata: mergeDataMetadata(
        existing._dataMetadata as DataMetadata | undefined,
        ownedMetadata,
      ),
    };
    applyWithheldPayloadGuard(output);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

    console.log(
      `[AlbertaSubstanceUse] Complete. fetched=${parsed.length} written=${completeRows.length} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'mental-health',
      pipeline: 'albertaSubstanceUseScraper',
      status: 'success',
      recordsFetched: parsed.length,
      recordsWritten: completeRows.length,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AlbertaSubstanceUse] FAILED:', errorMsg);
    return {
      domain: 'mental-health',
      pipeline: 'albertaSubstanceUseScraper',
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
