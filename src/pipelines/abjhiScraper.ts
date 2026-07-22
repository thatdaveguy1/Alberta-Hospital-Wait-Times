// Alberta Bone & Joint Health Institute / IIHO (iiho.ca) Scraper
// Fetches https://iiho.ca/wait-times/ for orthopedic hip & knee wait times
// by geography. Historically this page exposed hidden HTML tables driven by
// geography <select>s. As of mid-2026 the public page only has empty selects
// and unpopulated Google Charts stubs — no parseable metrics. When tables are
// missing we clear ORTHOPEDIC_SPECIALTY_RECORDS so the UI cannot show stale
// numbers as current. If IIHO restores tables (or publishes another feed),
// the existing parsers still apply.
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { JointWaitRecord } from '../surgicalData';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type { SyncResult } from './types';

const ABJHI_URL = 'https://iiho.ca/wait-times/';
const SURGICAL_FILE = path.join(process.cwd(), 'data-surgical.json');
const RATE_LIMIT_MS = 2000;
const WEEKS_TO_DAYS = 7;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type Procedure = 'Hip Replacement' | 'Knee Replacement';

interface RawTableMetrics {
  longest10Weeks: number | null;
  averageWeeks: number | null;
  shortest25Weeks: number | null;
  count: number | null;
  quarter: string | null;
}

interface ConsultMetrics {
  longest10Weeks: number | null;
  count: number | null;
}

interface SurgeryMetrics extends RawTableMetrics {
  procedure: Procedure;
  geography: string;
}

// Parse a cell value that may be numeric, "n/a (N=1)", empty, or a negative number.
// Returns null for non-numeric values so callers can fall back to existing data.
function parseCellNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^n\/a/i.test(trimmed) || trimmed === '-' || trimmed === '—') {
    return null;
  }
  // Extract the first numeric token (handles "-11.7", "82.4", "1,302").
  const match = trimmed.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Given a parsed table, find the rightmost column that has both a quarter header
// and valid data in the metric rows. Returns the column index or -1 if none found.
function findLastValidColumn(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
  headerCells: cheerio.Cheerio<AnyNode>,
): number {
  const colCount = headerCells.length - 1; // first column is row label
  for (let col = colCount - 1; col >= 0; col--) {
    const headerText = $(headerCells.get(col + 1)).text().trim();
    if (!headerText) continue;
    // Check if at least one data row has a numeric value in this column.
    let hasData = false;
    $table.find('tbody tr').each((_, tr) => {
      const $cells = $(tr).find('td');
      if ($cells.length < col + 2) return;
      const val = parseCellNumber($($cells.get(col + 1)).text());
      if (val !== null) hasData = true;
    });
    if (hasData) return col;
  }
  return -1;
}

// Parse a hidden wait-times table and extract the most recent quarter's metrics.
function parseTableMetrics(
  $: cheerio.CheerioAPI,
  $table: cheerio.Cheerio<AnyNode>,
): RawTableMetrics | null {
  const $headerCells = $table.find('thead th');
  if ($headerCells.length < 2) return null;

  const lastCol = findLastValidColumn($, $table, $headerCells);
  if (lastCol < 0) return null;

  const quarter = $($headerCells.get(lastCol + 1)).text().trim() || null;

  const metrics: RawTableMetrics = {
    longest10Weeks: null,
    averageWeeks: null,
    shortest25Weeks: null,
    count: null,
    quarter,
  };

  $table.find('tbody tr').each((_, tr) => {
    const $cells = $(tr).find('td');
    if ($cells.length < lastCol + 2) return;
    const label = $($cells.get(0))
      .text()
      .toLowerCase()
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const value = parseCellNumber($($cells.get(lastCol + 1)).text());

    if (label === 'average') {
      metrics.averageWeeks = value;
    } else if (
      /longest\s*10%\s*(?:\(?\s*90t?h?\s*percentile\s*\)?)?/i.test(label)
    ) {
      metrics.longest10Weeks = value;
    } else if (/shortest\s*25%/i.test(label)) {
      metrics.shortest25Weeks = value;
    } else if (
      /(?:consult|surgery)\s*count/i.test(label) ||
      /surgeries\s*\(#\)/i.test(label) ||
      /surgeon\s*consults?\s*\(#\)/i.test(label)
    ) {
      metrics.count = value;
    }
  });

  if (metrics.longest10Weeks === null && metrics.averageWeeks === null) {
    return null;
  }

  return metrics;
}
// Parse the "Wait for Surgeon Consult" section. Each select option points to a
// hidden table container. Returns a map of geography → consult metrics.
function parseConsultSection(
  $: cheerio.CheerioAPI,
): Map<string, ConsultMetrics> {
  const consultData = new Map<string, ConsultMetrics>();

  $('#wait-surgeon-consult-select option').each((_, optionEl) => {
    const $option = $(optionEl);
    const value = $option.attr('value')?.trim();
    const geography = $option.text().trim();
    if (!value || !geography) return;

    const $table = $(`#wait-surgeon-consult-${value}-container.waittimes.wait-surgeon-consult table`).first();
    if ($table.length === 0) return;

    const metrics = parseTableMetrics($, $table);
    if (!metrics) return;

    consultData.set(geography, {
      longest10Weeks: metrics.longest10Weeks,
      count: metrics.count,
    });
  });

  return consultData;
}

// Parse the "Wait for Surgery" section. Hip and knee each have a select whose
// options map to hidden table containers. Returns an array of surgery metrics
// tagged with procedure type and geography.
function parseSurgerySection(
  $: cheerio.CheerioAPI,
): SurgeryMetrics[] {
  const results: SurgeryMetrics[] = [];

  const parseFamily = (
    selectId: string,
    containerClass: string,
    procedure: Procedure,
  ) => {
    $(`#${selectId} option`).each((_, optionEl) => {
      const $option = $(optionEl);
      const value = $option.attr('value')?.trim();
      const geography = $option.text().trim();
      if (!value || !geography) return;

      const $table = $(`#${containerClass}-${value}-container.waittimes.${containerClass} table`).first();
      if ($table.length === 0) return;

      const metrics = parseTableMetrics($, $table);
      if (!metrics) return;

      results.push({ ...metrics, procedure, geography });
    });
  };

  parseFamily('wait-surgery-hip-select', 'wait-surgery-hip', 'Hip Replacement');
  parseFamily('wait-surgery-knee-select', 'wait-surgery-knee', 'Knee Replacement');

  return results;
}

// Build JointWaitRecord[] by merging consult data with surgery data by geography.
// Consult wait (90th percentile) is shared across hip and knee for a given geography.
// If a geography has no consult data, fall back to the provincial consult value.
function buildJointRecords(
  surgeryMetrics: SurgeryMetrics[],
  consultData: Map<string, ConsultMetrics>,
): JointWaitRecord[] {
  const provincialConsult = consultData.get('Alberta');
  const records: JointWaitRecord[] = [];

  for (const surgery of surgeryMetrics) {
    const consult = consultData.get(surgery.geography) ?? provincialConsult;
    const consultWaitDays = consult?.longest10Weeks !== null
      ? Math.round((consult!.longest10Weeks ?? 0) * WEEKS_TO_DAYS)
      : 0;
    const surgeryWaitDays = surgery.longest10Weeks !== null
      ? Math.round(surgery.longest10Weeks * WEEKS_TO_DAYS)
      : 0;
    const shortest25Days = surgery.shortest25Weeks !== null
      ? Math.round(surgery.shortest25Weeks * WEEKS_TO_DAYS)
      : 0;
    const averageDays = surgery.averageWeeks !== null
      ? Math.round(surgery.averageWeeks * WEEKS_TO_DAYS)
      : 0;

    records.push({
      geography: surgery.geography === 'Alberta' ? 'Alberta (Provincial)' : surgery.geography,
      procedure: surgery.procedure,
      count_completed: surgery.count ?? 0,
      consult_wait_days_90th: consultWaitDays,
      surgery_wait_days_90th: surgeryWaitDays,
      shortest_25_days: shortest25Days,
      average_days: averageDays,
      longest_10_days: surgeryWaitDays,
    });
  }

  return records;
}

const QUARTER_END_MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Pick the most recent quarter label (e.g. "2026 Jan-Mar") from parsed surgery tables. */
function deriveLatestQuarter(metrics: SurgeryMetrics[]): string | undefined {
  let best: { label: string; end: number } | undefined;
  for (const metric of metrics) {
    const q = metric.quarter;
    if (!q) continue;
    const match = q.trim().match(/^(\d{4})\s+([a-z]{3})-([a-z]{3})$/i);
    if (!match) continue;
    const year = Number(match[1]);
    const endMonth = QUARTER_END_MONTHS[match[3].toLowerCase()];
    if (!Number.isFinite(year) || endMonth === undefined) continue;
    const end = new Date(year, endMonth + 1, 0).getTime();
    if (!best || end > best.end) best = { label: q, end };
  }
  return best?.label;
}

// Load existing data-surgical.json and merge new orthopedic records into
// ORTHOPEDIC_SPECIALTY_RECORDS, replacing records with matching geography+procedure.
function mergeAndWrite(
  newRecords: JointWaitRecord[],
  timestamp: string,
  latestQuarter?: string,
): number {
  type SurgicalJson = Record<string, unknown>;
  let existing: SurgicalJson = {};
  try {
    existing = JSON.parse(fs.readFileSync(SURGICAL_FILE, 'utf8')) as SurgicalJson;
  } catch {
    // File doesn't exist yet — start fresh.
  }

  const existingOrtho = Array.isArray(existing.ORTHOPEDIC_SPECIALTY_RECORDS)
    ? (existing.ORTHOPEDIC_SPECIALTY_RECORDS as JointWaitRecord[])
    : [];

  const key = (r: JointWaitRecord) => `${r.geography}|${r.procedure}`;
  const mergedByKey = new Map<string, JointWaitRecord>();
  for (const record of existingOrtho) {
    mergedByKey.set(key(record), record);
  }
  for (const record of newRecords) {
    mergedByKey.set(key(record), record);
  }

  const mergedOrtho = Array.from(mergedByKey.values());
  existing.ORTHOPEDIC_SPECIALTY_RECORDS = mergedOrtho;

  // Refresh _dataMetadata for ORTHOPEDIC_SPECIALTY_RECORDS; preserve all other
  // entries (sibling writers' and hand-authored arrays) via mergeDataMetadata.
  const quarterLabel = latestQuarter ?? 'latest quarter';
  const ownedMetadata: DataMetadata = {
    ORTHOPEDIC_SPECIALTY_RECORDS: buildMetadataEntry({
      updateType: 'auto',
      source: 'Alberta Bone & Joint Health Institute / IIHO wait times page',
      sourceVintage: `ABJHI / IIHO orthopedic hip & knee wait times — ${quarterLabel}`,
      lastUpdated: timestamp,
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
    ['ORTHOPEDIC_SPECIALTY_RECORDS'],
  );

  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(SURGICAL_FILE, JSON.stringify(existing, null, 2), 'utf8');
  return mergedOrtho.length;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AbjhiScraper] Fetching ABJHI wait times page...');

  try {
    const response = await axios.get(ABJHI_URL, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 25000,
    });

    const $ = cheerio.load(response.data);
    const consultData = parseConsultSection($);
    console.log(`[AbjhiScraper] Parsed ${consultData.size} consult geographies`);

    // Section 2: "Wait for Surgery" — hip and knee hidden tables.
    const surgeryMetrics = parseSurgerySection($);
    console.log(`[AbjhiScraper] Parsed ${surgeryMetrics.length} surgery records`);

    if (surgeryMetrics.length === 0) {
      // Source withdrawn / empty page — fail closed by clearing stale rows.
      const cleared = clearOrthopedicRecords(
        timestamp,
        'IIHO wait-times page has no geography tables or metrics (empty selects / unpopulated charts). Public ABJHI/IIHO hip & knee specialty series is unavailable.',
      );
      const durationMs = Date.now() - startTime;
      console.warn(
        `[AbjhiScraper] No surgery metrics on page — cleared ${cleared} stale orthopedic rows (${durationMs}ms)`,
      );
      return {
        domain: 'surgical',
        pipeline: 'abjhiScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs,
        timestamp,
        error:
          'IIHO/ABJHI wait-times page no longer publishes parseable geography tables; ORTHOPEDIC_SPECIALTY_RECORDS cleared',
      };
    }

    const latestQuarter = deriveLatestQuarter(surgeryMetrics);
    const jointRecords = buildJointRecords(surgeryMetrics, consultData);
    const totalWritten = mergeAndWrite(jointRecords, timestamp, latestQuarter);

    const durationMs = Date.now() - startTime;
    console.log(
      `[AbjhiScraper] Complete. ${jointRecords.length} new records, ${totalWritten} total orthopedic records. ${durationMs}ms`,
    );

    return {
      domain: 'surgical',
      pipeline: 'abjhiScraper',
      status: 'success',
      recordsFetched: jointRecords.length,
      recordsWritten: totalWritten,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AbjhiScraper] FAILED:', errorMsg);

    // Transport/parse crash: clear specialty rows so a half-broken page cannot
    // leave last quarter's numbers looking current.
    try {
      clearOrthopedicRecords(
        timestamp,
        `ABJHI/IIHO scrape failed: ${errorMsg}. Orthopedic specialty rows cleared; not treated as current.`,
      );
    } catch (metaErr) {
      console.warn('[AbjhiScraper] Could not clear orthopedic records after failure:', metaErr);
    }

    return {
      domain: 'surgical',
      pipeline: 'abjhiScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

/** Empty ORTHOPEDIC_SPECIALTY_RECORDS and stamp unavailable metadata. */
function clearOrthopedicRecords(timestamp: string, verification: string): number {
  if (!fs.existsSync(SURGICAL_FILE)) return 0;
  const existing = JSON.parse(fs.readFileSync(SURGICAL_FILE, 'utf8')) as Record<string, unknown>;
  const prior = Array.isArray(existing.ORTHOPEDIC_SPECIALTY_RECORDS)
    ? (existing.ORTHOPEDIC_SPECIALTY_RECORDS as unknown[]).length
    : 0;
  existing.ORTHOPEDIC_SPECIALTY_RECORDS = [];
  const ownedMetadata: DataMetadata = {
    ORTHOPEDIC_SPECIALTY_RECORDS: buildMetadataEntry({
      updateType: 'manual',
      source: 'Alberta Bone & Joint Health Institute / IIHO wait times page',
      sourceVintage: 'Unavailable — IIHO no longer publishes public geography wait-time tables',
      lastUpdated: timestamp,
      verification,
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
    ['ORTHOPEDIC_SPECIALTY_RECORDS'],
  );
  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(SURGICAL_FILE, JSON.stringify(existing, null, 2), 'utf8');
  return prior;
}

// Re-export for rate-limited orchestration — callers that need to respect
// the 2-second minimum between requests can await this before calling run().
export { RATE_LIMIT_MS };

// CLI entry point: tsx src/pipelines/abjhiScraper.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'success' || result.status === 'skipped' ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

