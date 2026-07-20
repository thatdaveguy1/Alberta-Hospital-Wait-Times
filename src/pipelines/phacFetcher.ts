// PHAC Health Infobase Fetcher Pipeline
// Queries the Public Health Agency of Canada Health Infobase API
// (https://health-infobase.canada.ca/api/) for Alberta wastewater time series
// and writes only PHAC_WASTEWATER_TIME_SERIES into data-public-health.json.
//
// Primary source: wastewater_daily (all Alberta locations/measures).
// Legacy extension: wastewater Edmonton rows with Date < earliest daily
// Edmonton sample (extends COVID toward 2020 when upstream still publishes it).
//
// Fail-closed: this pipeline never rewrites WASTEWATER_SIGNALS (RVD-owned) or
// hand-authored residual public-health panels. Sibling RVD arrays are left
// untouched. Withheld keys are forced empty via applyWithheldPayloadGuard.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
  applyWithheldPayloadGuard,
} from './metadataHelpers';
import type { SyncResult } from './types';
import type { PhacWastewaterTimeSeriesPoint } from '../publicHealthData';

const PHAC_API_BASE = 'https://health-infobase.canada.ca/api';
/** Infobase mounts multiple wastewater tables under this API path. */
const WASTEWATER_API = 'wastewater';
const WASTEWATER_DAILY_TABLE = 'wastewater_daily';
const WASTEWATER_LEGACY_TABLE = 'wastewater';
const ALBERTA_PRUID = '48';

const EDMONTON_SITE_KEY = 'Edmonton (Gold Bar Plant)';
const OUTPUT_FILE = path.join(process.cwd(), 'data-public-health.json');

/** PHAC Location → dashboard display site. */
const LOCATION_TO_SITE: Record<string, string> = {
  'Edmonton Goldbar': EDMONTON_SITE_KEY,
  'Calgary Bonnybrook WWTP': 'Calgary (Bonnybrook Plant)',
  'Calgary Fish Creek': 'Calgary (Fish Creek)',
  'Calgary Pine Creek': 'Calgary (Pine Creek)',
};

const MEASURE_TO_PATHOGEN: Record<string, PhacWastewaterTimeSeriesPoint['pathogen']> = {
  covN2: 'covid',
  fluA: 'fluA',
  fluB: 'fluB',
  rsv: 'rsv',
};

// Rate limit: minimum 2 seconds between upstream requests.
const REQUEST_INTERVAL_MS = 2000;
let lastRequestTime = 0;

async function rateLimitedDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  const remaining = REQUEST_INTERVAL_MS - elapsed;
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
  lastRequestTime = Date.now();
}

// ---------------------------------------------------------------------------
// Type guards for PHAC API responses (no `any` — everything is `unknown`).
// ---------------------------------------------------------------------------

interface PhacWastewaterRow {
  Date: string;
  Location: string;
  region: string;
  measureid: string;
  fractionid: string;
  viral_load: number | string;
  seven_day_rolling_avg: number | string;
  pruid: number | string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isWastewaterRow(value: unknown): value is PhacWastewaterRow {
  if (!isRecord(value)) return false;
  return typeof value['measureid'] === 'string' && typeof value['Date'] === 'string';
}

function isWastewaterArray(value: unknown): value is PhacWastewaterRow[] {
  return Array.isArray(value) && value.every(isWastewaterRow);
}

function loadExistingData(): Record<string, unknown> | null {
  try {
    if (!fs.existsSync(OUTPUT_FILE)) return null;
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PHAC wastewater fetch + parse.
// ---------------------------------------------------------------------------

async function queryWastewaterTable(sql: string): Promise<PhacWastewaterRow[]> {
  const url = `${PHAC_API_BASE}/${WASTEWATER_API}/query`;
  await rateLimitedDelay();
  const response = await axios.get<unknown>(url, {
    params: { q: sql },
    headers: { 'User-Agent': 'AlbertaHospitals-Pipeline/1.0' },
    // Full Alberta history is ~700KB / a few thousand rows — allow headroom.
    timeout: 60000,
  });
  if (!isWastewaterArray(response.data)) {
    throw new Error(`PHAC wastewater API returned an unexpected shape for query: ${sql}`);
  }
  return response.data;
}

/** Full Alberta daily history — all locations and measures, no tiny LIMIT. */
async function fetchAlbertaWastewaterDaily(): Promise<PhacWastewaterRow[]> {
  const query =
    `SELECT * FROM ${WASTEWATER_DAILY_TABLE} WHERE "pruid" = "${ALBERTA_PRUID}"`;
  return queryWastewaterTable(query);
}

/**
 * Legacy Edmonton rows strictly before the earliest daily Edmonton sample date.
 * Extends COVID toward 2020 when Infobase still publishes those rows.
 */
async function fetchLegacyEdmontonBefore(earliestDailyDate: string): Promise<PhacWastewaterRow[]> {
  const query =
    `SELECT * FROM ${WASTEWATER_LEGACY_TABLE} WHERE "pruid" = "${ALBERTA_PRUID}" ` +
    `AND "Location" LIKE "%Edmonton%" AND "Date" < "${earliestDailyDate}"`;
  return queryWastewaterTable(query);
}

function displaySiteForLocation(locationRaw: string): string | null {
  const mapped = LOCATION_TO_SITE[locationRaw];
  if (mapped) return mapped;
  // Fallback: keep a clear Calgary/Edmonton label if Location is unrecognized.
  const lower = locationRaw.toLowerCase();
  if (lower.includes('edmonton')) return EDMONTON_SITE_KEY;
  if (lower.includes('bonnybrook')) return 'Calgary (Bonnybrook Plant)';
  if (lower.includes('fish creek')) return 'Calgary (Fish Creek)';
  if (lower.includes('pine creek')) return 'Calgary (Pine Creek)';
  if (lower.includes('calgary')) return locationRaw;
  return null;
}

function mapRowToPoint(
  row: PhacWastewaterRow,
  source: PhacWastewaterTimeSeriesPoint['source'],
): PhacWastewaterTimeSeriesPoint | null {
  const locationRaw = asString(row.Location);
  if (!locationRaw) return null;

  const site = displaySiteForLocation(locationRaw);
  if (!site) return null;

  const pathogen = MEASURE_TO_PATHOGEN[asString(row.measureid)];
  if (!pathogen) return null;

  const sampleDate = asString(row.Date);
  if (!/^\d{4}-\d{2}-\d{2}/.test(sampleDate)) return null;

  const viralLoad = asNumber(row.viral_load);
  if (viralLoad === null) return null;

  const sevenDayAvg = asNumber(row.seven_day_rolling_avg);

  const point: PhacWastewaterTimeSeriesPoint = {
    site,
    locationRaw,
    sampleDate: sampleDate.slice(0, 10),
    pathogen,
    viralLoad,
    source,
  };
  if (sevenDayAvg !== null) point.sevenDayAvg = sevenDayAvg;
  return point;
}

function pointKey(p: PhacWastewaterTimeSeriesPoint): string {
  return `${p.site}|${p.sampleDate}|${p.pathogen}|${p.source}`;
}

function buildTimeSeries(
  dailyRows: PhacWastewaterRow[],
  legacyRows: PhacWastewaterRow[],
): PhacWastewaterTimeSeriesPoint[] {
  const byKey = new Map<string, PhacWastewaterTimeSeriesPoint>();

  for (const row of dailyRows) {
    const point = mapRowToPoint(row, 'phac-wastewater-daily');
    if (!point) continue;
    byKey.set(pointKey(point), point);
  }

  for (const row of legacyRows) {
    const point = mapRowToPoint(row, 'phac-wastewater-legacy');
    if (!point) continue;
    // Prefer daily when a key somehow collides; legacy is only Date < daily floor.
    if (!byKey.has(pointKey(point))) byKey.set(pointKey(point), point);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.sampleDate !== b.sampleDate) return a.sampleDate < b.sampleDate ? -1 : 1;
    if (a.site !== b.site) return a.site < b.site ? -1 : 1;
    if (a.pathogen !== b.pathogen) return a.pathogen < b.pathogen ? -1 : 1;
    return a.source < b.source ? -1 : 1;
  });
}

function earliestEdmontonDailyDate(dailyRows: PhacWastewaterRow[]): string | null {
  let earliest: string | null = null;
  for (const row of dailyRows) {
    const loc = asString(row.Location);
    if (!loc.toLowerCase().includes('edmonton')) continue;
    const date = asString(row.Date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (earliest === null || date < earliest) earliest = date;
  }
  return earliest;
}

function derivePhacSourceVintage(points: PhacWastewaterTimeSeriesPoint[]): string {
  const dates = points
    .map((p) => p.sampleDate)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length === 0) return 'Unavailable';
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

// ---------------------------------------------------------------------------
// Pipeline entry point.
// ---------------------------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const pipeline = 'phacFetcher';

  try {
    const existing = loadExistingData();
    if (!existing) {
      return {
        domain: 'public-health',
        pipeline,
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error:
          'No existing data-public-health.json to merge into; refusing to overwrite hand-authored baseline.',
        timestamp,
      };
    }

    console.log(
      '[PhacFetcher] Querying PHAC wastewater_daily for Alberta (all locations/measures)...',
    );
    const dailyRows = await fetchAlbertaWastewaterDaily();
    console.log(`[PhacFetcher] wastewater_daily rows: ${dailyRows.length}`);

    const earliestEdmonton = earliestEdmontonDailyDate(dailyRows);
    let legacyRows: PhacWastewaterRow[] = [];
    if (earliestEdmonton) {
      console.log(
        `[PhacFetcher] Fetching legacy Edmonton wastewater before ${earliestEdmonton}...`,
      );
      legacyRows = await fetchLegacyEdmontonBefore(earliestEdmonton);
      console.log(`[PhacFetcher] legacy Edmonton extension rows: ${legacyRows.length}`);
    } else {
      console.warn(
        '[PhacFetcher] No Edmonton rows in wastewater_daily; skipping legacy extension.',
      );
    }

    const series = buildTimeSeries(dailyRows, legacyRows);
    if (series.length === 0) {
      return {
        domain: 'public-health',
        pipeline,
        status: 'skipped',
        recordsFetched: dailyRows.length + legacyRows.length,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error: 'PHAC wastewater API returned no usable Alberta time-series rows.',
        timestamp,
      };
    }

    const priorSeries = Array.isArray(existing['PHAC_WASTEWATER_TIME_SERIES'])
      ? (existing['PHAC_WASTEWATER_TIME_SERIES'] as unknown[])
      : [];
    const contentChanged = JSON.stringify(series) !== JSON.stringify(priorSeries);

    const existingMeta = isRecord(existing['_dataMetadata'])
      ? (existing['_dataMetadata'] as DataMetadata)
      : undefined;
    const priorPhacMeta = existingMeta?.PHAC_WASTEWATER_TIME_SERIES;

    const ownedMetadata: DataMetadata = {
      PHAC_WASTEWATER_TIME_SERIES: buildMetadataEntry({
        updateType: 'auto',
        source: 'PHAC Health Infobase wastewater_daily (+ legacy Edmonton extension)',
        sourceVintage: derivePhacSourceVintage(series),
        lastUpdated: timestamp,
        previous: priorPhacMeta,
        contentChanged,
      }),
    };

    // Preserve all sibling keys (including RVD-owned WASTEWATER_SIGNALS /
    // WASTEWATER_TIME_SERIES / RVD_*). Only replace PHAC_WASTEWATER_TIME_SERIES.
    const output: Record<string, unknown> = {
      ...existing,
      PHAC_WASTEWATER_TIME_SERIES: series,
      _dataMetadata: mergeDataMetadata(existingMeta, ownedMetadata),
    };

    if (contentChanged || !priorPhacMeta) {
      applyWithheldPayloadGuard(output);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf-8');
    }

    return {
      domain: 'public-health',
      pipeline,
      status: contentChanged ? 'success' : 'partial',
      recordsFetched: dailyRows.length + legacyRows.length,
      recordsWritten: contentChanged ? series.length : 0,
      durationMs: Date.now() - startTime,
      error: contentChanged
        ? undefined
        : 'PHAC wastewater fetch succeeded but time-series content unchanged; sibling arrays not re-stamped.',
      timestamp,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      domain: 'public-health',
      pipeline,
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: message,
      timestamp,
    };
  }
}
