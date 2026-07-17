// AHS Weekly ED LOS PDF Scraper
// Downloads and parses the two AHS weekly ED LOS PDF reports (Edmonton + Calgary)
// to extract real facility-level weekly throughput data.
//
// The PDFs are published at:
//   https://www.albertahealthservices.ca/assets/about/data/ahs-data-er-wait-times-edmonton.pdf
//   https://www.albertahealthservices.ca/assets/about/data/ahs-data-er-wait-times-calgary.pdf
//
// Each PDF contains two data tables (Discharged Patients, Admitted Patients) with:
//   - Facility Name (alphabetical order)
//   - Number of Visits
//   - % of visits discharged within 4 hours / admitted within 8 hours
//
// We use pdftotext (poppler) for text extraction. The PDF text fragments facility
// names across lines, and splits comma-formatted numbers (e.g., "1,314" → "1,\n314").
// We pre-process to join split numbers, then scan for (number, pct) pairs.

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
import type { WeeklyEDLOS } from '../systemFlowData';

const EDMONTON_PDF_URL =
  'https://www.albertahealthservices.ca/assets/about/data/ahs-data-er-wait-times-edmonton.pdf';
const CALGARY_PDF_URL =
  'https://www.albertahealthservices.ca/assets/about/data/ahs-data-er-wait-times-calgary.pdf';

const SYSTEM_FLOW_FILE = path.join(process.cwd(), 'data-system-flow.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const MIN_REQUEST_INTERVAL_MS = 2000;
let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const remaining = MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  lastRequestTime = Date.now();
}

async function downloadPdf(url: string): Promise<Buffer> {
  await rateLimit();
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000,
    maxRedirects: 5,
  });
  return Buffer.from(res.data);
}

// Parse PDF to text using pdftotext (poppler).
function pdfToText(pdfBuffer: Buffer): string {
  const tmpDir = os.tmpdir();
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpPdf = path.join(tmpDir, `ahs-edlos-${stamp}.pdf`);
  const tmpTxt = path.join(tmpDir, `ahs-edlos-${stamp}.txt`);
  try {
    fs.writeFileSync(tmpPdf, pdfBuffer);
    execFileSync('pdftotext', [tmpPdf, tmpTxt], { timeout: 15000 });
    return fs.readFileSync(tmpTxt, 'utf8');
  } catch {
    return '';
  } finally {
    try { fs.unlinkSync(tmpPdf); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpTxt); } catch { /* ignore */ }
  }
}

// The only hospitals AHS includes in the weekly ED LOS PDFs.
const EDMONTON_FACILITIES = [
  'Grey Nuns Community Hospital',
  'Misericordia Community Hospital',
  'Royal Alexandra Hospital',
  "Stollery Children's Hospital",
  'University of Alberta Hospital',
];

const CALGARY_FACILITIES = [
  "Alberta Children's Hospital",
  'Foothills Medical Centre',
  'Peter Lougheed Centre',
  'Rockyview General Hospital',
  'South Health Campus',
];

// Extract the week ending date from raw PDF text.
// The text is fragmented but "through June 13, 2026" is parseable
// after collapsing whitespace.
function extractWeekEnding(rawText: string): string {
  const collapsed = rawText.replace(/\s+/g, '');
  const match = collapsed.match(/through([A-Z][a-z]+)(\d+),(\d{4})/);
  if (match) {
    return `${match[1]} ${match[2]}, ${match[3]}`;
  }
  return '';
}

// Extract hospital data from raw pdftotext output.
// The PDF text has numbers and percentages on separate lines:
//   <fragmented facility name>
//   763
//   12%
//   <next facility name>
//   177
//   14%
// Pairs are interleaved: discharged, admitted, discharged, admitted, ...
// Comma-formatted numbers like "1,314" are split as "1,\n314" and must be joined.
function extractFacilityData(
  rawText: string,
  facilities: string[],
  city: string,
  weekEnding: string,
): WeeklyEDLOS[] {
  const rawLines = rawText.split('\n').map(l => l.trim());

  // Pre-process: join lines ending with a comma (e.g., "1,") to the next
  // non-blank line (e.g., "314") to reconstruct comma-formatted numbers.
  const lines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].match(/^\d{1,3},$/) && i + 1 < rawLines.length) {
      for (let j = i + 1; j < rawLines.length; j++) {
        if (rawLines[j] !== '') {
          lines.push(rawLines[i] + rawLines[j]);
          i = j;
          break;
        }
      }
    } else {
      lines.push(rawLines[i]);
    }
  }

  // A number line: just a number with optional comma (e.g., "763" or "1,314")
  const numberLine = /^\d{1,3}(?:,\d{3})$|^\d{2,4}$/;
  // A percentage line: just a number followed by % (e.g., "12%" or "51%")
  const pctLine = /^(\d{1,3})%$/;

  // Collect (visits, pct) pairs where a number line is followed (after
  // skipping blank lines) by a percentage line.
  const pairs: { visits: number; pct: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const numMatch = lines[i].match(numberLine);
    if (!numMatch) continue;
    const visits = parseInt(lines[i].replace(/,/g, ''), 10);
    if (visits < 10 || visits > 9999) continue;

    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      if (lines[j] === '') continue;
      const pctMatch = lines[j].match(pctLine);
      if (pctMatch) {
        const pct = parseInt(pctMatch[1], 10);
        if (pct >= 0 && pct <= 100) {
          pairs.push({ visits, pct });
        }
      }
      break;
    }
  }

  const n = facilities.length;
  if (pairs.length < n * 2) {
    console.warn(`[AHSWeeklyEdLos] Expected ${n * 2} data pairs, found ${pairs.length}`);
  }

  // Pairs are interleaved: even indices = discharged, odd indices = admitted.
  const dischargedPairs = pairs.filter((_, i) => i % 2 === 0).slice(0, n);
  const admittedPairs = pairs.filter((_, i) => i % 2 === 1).slice(0, n);

  const results: WeeklyEDLOS[] = [];
  for (let i = 0; i < n; i++) {
    const discharged = dischargedPairs[i] ?? { visits: 0, pct: 0 };
    const admitted = admittedPairs[i] ?? { visits: 0, pct: 0 };
    results.push({
      facilityId: facilities[i].toLowerCase().replace(/[^a-z0-9]/g, '-'),
      facilityName: facilities[i],
      city,
      weekEnding,
      dischargedCount: discharged.visits,
      pctDischargedWithin4h: discharged.pct,
      admittedCount: admitted.visits,
      pctAdmittedWithin8h: admitted.pct,
    });
  }

  return results;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const errors: string[] = [];
  let recordsFetched = 0;
  let updated = false;

  console.log('[AHSWeeklyEdLos] Starting AHS weekly ED LOS PDF scrape...');

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(SYSTEM_FLOW_FILE, 'utf8')) as Record<string, unknown>;
    // Never reintroduce scrubbed historical estimates via RMW.
    data.HISTORICAL_FLOW_TIMELINES = [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`read: ${msg}`);
    console.error('[AHSWeeklyEdLos] Failed to read system flow JSON:', msg);
    return {
      domain: 'system-flow',
      pipeline: 'ahsWeeklyEdLosScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errors.join('; '),
      timestamp,
    };
  }

  const scrapedRecords: WeeklyEDLOS[] = [];

  for (const [city, url, facilities] of [
    ['Edmonton', EDMONTON_PDF_URL, EDMONTON_FACILITIES],
    ['Calgary', CALGARY_PDF_URL, CALGARY_FACILITIES],
  ] as const) {
    try {
      console.log(`[AHSWeeklyEdLos] Downloading ${city} PDF...`);
      const pdfBuffer = await downloadPdf(url);

      const rawText = pdfToText(pdfBuffer);
      if (!rawText) {
        throw new Error('pdftotext extraction returned empty text');
      }

      const weekEnding = extractWeekEnding(rawText);
      console.log(`[AHSWeeklyEdLos] ${city} week ending: ${weekEnding}`);

      const facilityData = extractFacilityData(rawText, facilities, city, weekEnding);
      console.log(`[AHSWeeklyEdLos] ${city}: extracted ${facilityData.length} facilities`);
      for (const f of facilityData) {
        console.log(`  ${f.facilityName}: discharged=${f.dischargedCount} (${f.pctDischargedWithin4h}%), admitted=${f.admittedCount} (${f.pctAdmittedWithin8h}%)`);
      }
      scrapedRecords.push(...facilityData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${city}: ${msg}`);
      console.error(`[AHSWeeklyEdLos] ${city} PDF parse failed:`, msg);
    }
  }

  if (scrapedRecords.length > 0) {
    const existing = (data.AHS_WEEKLY_ED_LOS as WeeklyEDLOS[]) ?? [];

    // Match by normalized facility name so hand-authored records (e.g.
    // "uah-edmonton") merge with PDF-scraped records (e.g.
    // "university-of-alberta-hospital") for the same site.
    const norm = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const scrapedByNormName = new Map<string, WeeklyEDLOS>();
    for (const r of scrapedRecords) {
      scrapedByNormName.set(norm(r.facilityName), r);
    }

    // Keep only scraped rows with a real weekEnding. Empty-week stubs are
    // fabricated placeholders and must not survive the write.
    const merged: WeeklyEDLOS[] = [];
    const seenNorm = new Set<string>();
    for (const scraped of scrapedRecords) {
      if (!scraped.weekEnding || !String(scraped.weekEnding).trim()) continue;
      const n = norm(scraped.facilityName);
      const prior = existing.find((e) => norm(e.facilityName) === n);
      merged.push({ ...scraped, facilityId: prior?.facilityId ?? scraped.facilityId });
      seenNorm.add(n);
    }
    // Also keep any prior real rows not replaced this run (other cities / weeks).
    for (const e of existing) {
      if (!e.weekEnding || !String(e.weekEnding).trim()) continue;
      const n = norm(e.facilityName);
      if (seenNorm.has(n)) continue;
      merged.push(e);
      seenNorm.add(n);
    }

    data.AHS_WEEKLY_ED_LOS = merged;
    updated = true;
    recordsFetched = scrapedRecords.length;
  }

  // Refresh _dataMetadata for this writer's owned array (AHS_WEEKLY_ED_LOS).
  // The rest of `data` (including other writers' _dataMetadata entries) is
  // preserved because we write the whole read-modify-write object back.
  if (updated) {
    const existingMeta = data._dataMetadata as DataMetadata | undefined;
    const ownedMetadata: DataMetadata = {
      AHS_WEEKLY_ED_LOS: buildMetadataEntry({
        updateType: 'auto',
        source: 'AHS Weekly ED Performance Reports (Edmonton + Calgary PDFs)',
        sourceVintage: 'AHS weekly ED LOS PDFs (week ending per report)',
        verification: 'Auto-parsed from AHS weekly ED wait/throughput PDFs via pdftotext. Only rows with a non-empty weekEnding are retained; empty stubs are dropped.',
        lastUpdated: timestamp,
      }),
    };
    data._dataMetadata = mergeDataMetadata(existingMeta, ownedMetadata);
  }

  let recordsWritten = 0;
  if (updated) {
    try {
      applyWithheldPayloadGuard(data);
      fs.writeFileSync(SYSTEM_FLOW_FILE, JSON.stringify(data, null, 2), 'utf8');
      recordsWritten = (data.AHS_WEEKLY_ED_LOS as WeeklyEDLOS[]).length;
      console.log(`[AHSWeeklyEdLos] Wrote ${recordsWritten} records to data-system-flow.json`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`write: ${msg}`);
      console.error('[AHSWeeklyEdLos] Failed to write:', msg);
    }
  }

  const durationMs = Date.now() - startTime;

  let status: SyncResult['status'];
  if (errors.length > 0 && recordsFetched > 0) {
    status = 'partial';
  } else if (errors.length > 0 && recordsFetched === 0) {
    status = 'failed';
  } else if (recordsFetched === 0) {
    status = 'skipped';
  } else {
    status = 'success';
  }

  console.log(
    `[AHSWeeklyEdLos] Complete. status=${status} fetched=${recordsFetched} written=${recordsWritten} ${durationMs}ms`,
  );

  return {
    domain: 'system-flow',
    pipeline: 'ahsWeeklyEdLosScraper',
    status,
    recordsFetched,
    recordsWritten,
    durationMs,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    timestamp,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'failed' ? 1 : 0);
  });
}
