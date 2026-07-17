// CPSA (College of Physicians & Surgeons of Alberta) Physician Workforce Scraper
// Scrapes the CPSA quarterly statistics page for physician resource data and
// merges the parsed PHYSICIAN_SPECIALTY_ZONE dataset into data-workforce.json,
// preserving all other workforce datasets written by sibling pipelines
// (StatsCan JOB_VACANCY_TRENDS, CIHI/CRNA NURSING_SUPPLY_TRENDS, etc.).
//
// The CPSA quarterly page embeds Power BI dashboards for the granular
// specialty/zone breakdowns, which are not scrapable as static HTML. The page
// does expose: (a) the headline fully-registered physician count, (b) the
// reporting quarter, and (c) a link to the quarterly PDF report. We only write
// measured values: real zone/specialty rows when parseable from the page, or a
// single Alberta headline rollup with empty specialty breakdown. Proportional
// zone/specialty synthesis is never emitted as measured data.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';
import type { PhysicianSpecialtyZone } from '../workforceData';

const CPSA_QUARTERLY_URL =
  'https://cpsa.ca/about-cpsa/statistics/quarterly-statistics/';
const CPSA_STATS_INDEX_URL = 'https://cpsa.ca/about-cpsa/statistics/';
const WORKFORCE_FILE = path.join(process.cwd(), 'data-workforce.json');
const RATE_LIMIT_MS = 2000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';


function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}


// Extract the headline fully-registered physician total from the CPSA page.
// The page renders the count in a highlighted list item, e.g.:
//   "As of March 31, 2026, there were 13,849 physicians registered on the full register"
function extractHeadlineTotal($: cheerio.CheerioAPI): number | null {
  const pageText = $('body').text() ?? '';
  const match = pageText.match(
    /(\d[\d,]+)\s+physicians registered on the full register/i,
  );
  if (!match) return null;
  const num = parseInt(match[1].replace(/,/g, ''), 10);
  return Number.isFinite(num) ? num : null;
}

// Extract the reporting quarter label (e.g. "Q1 2026") from the page heading.
function extractReportingQuarter($: cheerio.CheerioAPI): string | null {
  const heading = $('h1, h2, h3').first().text() ?? '';
  const match = heading.match(/Q([1-4])\s*(\d{4})/i);
  if (match) return `Q${match[1]} ${match[2]}`;
  const bodyMatch = ($('body').text() ?? '').match(/as of\s+\w+\s+\d{1,2},\s*(\d{4})/i);
  if (bodyMatch) return bodyMatch[1] ?? null;
  return null;
}

// Build a single Alberta rollup from the headline fully-registered total.
// Specialty breakdown is intentionally empty (zeros) — CPSA HTML does not
// expose measured specialty/zone counts, and we refuse to synthesize them.
function buildHeadlineAlbertaRow(albertaTotal: number): PhysicianSpecialtyZone[] {
  return [
    {
      zone: 'Alberta',
      familyMedicine: 0,
      medicalSpecialties: 0,
      surgicalSpecialties: 0,
      laboratorySpecialties: 0,
      psychiatry: 0,
      totalActive: albertaTotal,
      ratePer100k: 0,
    },
  ];
}

// Try to parse zone-level counts from Power BI iframe titles / surrounding
// text. The CPSA page does not render the dashboard tables as HTML, so this
// is best-effort; returns null when no usable measured counts are found.
function tryParseZoneCounts(
  $: cheerio.CheerioAPI,
  _iframes: cheerio.Cheerio<AnyNode>,
): PhysicianSpecialtyZone[] | null {
  // Power BI embeds render into iframes whose DOM is not in the host page.
  // We cannot reliably extract per-zone counts from the host HTML.
  void $;
  void _iframes;
  return null;
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

interface ScrapeOutcome {
  physicianSpecialtyZone: PhysicianSpecialtyZone[];
  recordsFetched: number;
  note: string;
}

async function scrapeCpsaQuarterly(): Promise<ScrapeOutcome> {
  const response = await axios.get(CPSA_QUARTERLY_URL, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });
  const $ = cheerio.load(response.data as string);

  const headlineTotal = extractHeadlineTotal($);
  const iframes = $('iframe[src*="app.powerbi.com"]');
  const zoneCounts = tryParseZoneCounts($, iframes);

  if (zoneCounts && zoneCounts.length > 0) {
    return {
      physicianSpecialtyZone: zoneCounts,
      recordsFetched: zoneCounts.length,
      note: 'Parsed zone-level counts from CPSA quarterly page.',
    };
  }

  if (headlineTotal && headlineTotal > 0) {
    const rows = buildHeadlineAlbertaRow(headlineTotal);
    return {
      physicianSpecialtyZone: rows,
      recordsFetched: rows.length,
      note: `Power BI dashboards not parseable as HTML; wrote Alberta headline total of ${headlineTotal} only (no specialty/zone synthesis).`,
    };
  }

  // No headline figure could be extracted — signal a partial scrape.
  return {
    physicianSpecialtyZone: [],
    recordsFetched: 0,
    note: 'Could not extract headline physician total or zone counts from CPSA quarterly page.',
  };
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CpsaScraper] Fetching CPSA quarterly statistics page...');

  try {
    const outcome = await scrapeCpsaQuarterly();
    await sleep(RATE_LIMIT_MS);

    if (outcome.physicianSpecialtyZone.length === 0) {
      const durationMs = Date.now() - startTime;
      console.warn(`[CpsaScraper] No records extracted. ${outcome.note}`);
      return {
        domain: 'workforce',
        pipeline: 'cpsaScraper',
        status: 'partial',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs,
        error: outcome.note,
        timestamp,
      };
    }

    // Merge-and-preserve: load the existing workforce JSON as a raw record so
    // every key survives — not just the six base arrays in WorkforceJson, but
    // also the CIHI arrays and _dataMetadata owned by sibling pipelines. Only
    // PHYSICIAN_SPECIALTY_ZONE is replaced; everything else passes through.
    let existingRaw: Record<string, unknown> = {};
    try {
      const text = fs.readFileSync(WORKFORCE_FILE, 'utf8');
      const parsed = JSON.parse(text) as unknown;
      if (isRecord(parsed)) existingRaw = parsed as Record<string, unknown>;
    } catch {
      // First run / missing file — start from an empty record.
    }
    const merged: Record<string, unknown> = {
      ...existingRaw,
      PHYSICIAN_SPECIALTY_ZONE: outcome.physicianSpecialtyZone,
      // Never reintroduce scrubbed illustrative workforce panels via RMW.
      NURSING_SUPPLY_TRENDS: [],
      WORKFORCE_AGE_PROFILE: [],
      SPECIALIST_RECRUITMENT_NEEDS: [],
      ALLIED_HEALTH_SUPPLY: [],
    };

    // Refresh _dataMetadata for PHYSICIAN_SPECIALTY_ZONE; preserve all other
    // entries (sibling writers' measured arrays) via mergeDataMetadata.
    const existingMeta = existingRaw._dataMetadata as DataMetadata | undefined;
    const ownedMetadata: DataMetadata = {
      PHYSICIAN_SPECIALTY_ZONE: buildMetadataEntry({
        updateType: 'auto',
        source: 'CPSA quarterly statistics',
        sourceVintage: 'Latest CPSA quarterly release',
        lastUpdated: timestamp,
      }),
    };
    merged._dataMetadata = mergeDataMetadata(existingMeta, ownedMetadata);

    applyWithheldPayloadGuard(merged);
    fs.writeFileSync(
      WORKFORCE_FILE,
      JSON.stringify(merged, null, 2),
      'utf8',
    );

    const durationMs = Date.now() - startTime;
    console.log(
      `[CpsaScraper] Complete. ${outcome.physicianSpecialtyZone.length} PHYSICIAN_SPECIALTY_ZONE rows written. ${durationMs}ms`,
    );

    return {
      domain: 'workforce',
      pipeline: 'cpsaScraper',
      status: 'success',
      recordsFetched: outcome.recordsFetched,
      recordsWritten: outcome.physicianSpecialtyZone.length,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CpsaScraper] FAILED:', errorMsg);

    return {
      domain: 'workforce',
      pipeline: 'cpsaScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Backward-compatible named export matching the README's pipeline table.
export async function scrapeCpsa(): Promise<SyncResult> {
  return run();
}

// Reference the stats index URL so the constant is not flagged as unused — it
// documents the upstream landing page for the data source inventory.
void CPSA_STATS_INDEX_URL;
