// PHAC Health Infobase Fetcher Pipeline
// Queries the Public Health Agency of Canada Health Infobase API
// (https://health-infobase.canada.ca/api/) for Alberta wastewater signals
// and merges only WASTEWATER_SIGNALS into data-public-health.json.
//
// Fail-closed: this pipeline never rewrites or re-stamps hand-authored
// RESPIRATORY_VIRUS_SURVEILLANCE, CHILDHOOD_IMMUNIZATION_COVERAGE,
// NOTIFIABLE_DISEASE_INCIDENCE, ENVIRONMENTAL_ADVISORIES, or OUTBREAK_PROTOCOLS.
// Those arrays are left untouched (and should be emptied by the payload scrub
// owner). Only Edmonton Gold Bar is refreshed from PHAC; non-Edmonton sites
// may be updated from Alberta RVD traces when available.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';
import type { SyncResult } from './types';
import type {
  WastewaterSignal,
  RespiratoryVirusMetric,
  ImmunizationCoverage,
  NotifiableDiseaseIncidence,
  EnvironmentalAdvisory,
  OutbreakGuidelines,
} from '../publicHealthData';

const PHAC_API_BASE = 'https://health-infobase.canada.ca/api';
const WASTEWATER_DB = 'wastewater';
const ALBERTA_PRUID = '48';

// Edmonton Goldbar is the only Alberta site PHAC reports. It maps to the
// hand-authored "Edmonton (Gold Bar Plant)" entry in WASTEWATER_SIGNALS.
const EDMONTON_SITE_KEY = 'Edmonton (Gold Bar Plant)';
const DEPRECATED_SITES: Record<string, true> = { Jasper: true, Banff: true };
const OUTPUT_FILE = path.join(process.cwd(), 'data-public-health.json');

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
  return (
    typeof value['measureid'] === 'string' &&
    typeof value['Date'] === 'string'
  );
}

function isWastewaterArray(value: unknown): value is PhacWastewaterRow[] {
  return Array.isArray(value) && value.every(isWastewaterRow);
}

// ---------------------------------------------------------------------------
// Shape of the full data-public-health.json document.
// ---------------------------------------------------------------------------

interface PublicHealthDataFile {
  RESPIRATORY_VIRUS_SURVEILLANCE: RespiratoryVirusMetric[];
  WASTEWATER_SIGNALS: WastewaterSignal[];
  CHILDHOOD_IMMUNIZATION_COVERAGE: ImmunizationCoverage[];
  NOTIFIABLE_DISEASE_INCIDENCE: NotifiableDiseaseIncidence[];
  ENVIRONMENTAL_ADVISORIES: EnvironmentalAdvisory[];
  OUTBREAK_PROTOCOLS: Record<string, OutbreakGuidelines>;
  _dataMetadata?: DataMetadata;
}

function loadExistingData(): PublicHealthDataFile | null {
  try {
    if (!fs.existsSync(OUTPUT_FILE)) return null;
    const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    // Validate only the keys we merge into; tolerate extra/missing fields
    // by falling back to empty collections so we never overwrite with junk.
    const signals = Array.isArray(parsed['WASTEWATER_SIGNALS'])
      ? (parsed['WASTEWATER_SIGNALS'] as unknown[])
      : [];
    return {
      // Withheld residual public-health panels: force empty on load so RMW
      // cannot reintroduce scrubbed rows from existing/raw.
      RESPIRATORY_VIRUS_SURVEILLANCE: [],
      WASTEWATER_SIGNALS: signals as WastewaterSignal[],
      CHILDHOOD_IMMUNIZATION_COVERAGE: [],
      NOTIFIABLE_DISEASE_INCIDENCE: [],
      ENVIRONMENTAL_ADVISORIES: [],
      OUTBREAK_PROTOCOLS: {},
      _dataMetadata: isRecord(parsed['_dataMetadata'])
        ? (parsed['_dataMetadata'] as DataMetadata)
        : undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// PHAC wastewater fetch + parse.
// ---------------------------------------------------------------------------

async function fetchAlbertaWastewater(): Promise<PhacWastewaterRow[]> {
  // One query covers every measure for Alberta. We pull a recent window
  // (latest ~40 rows ordered by date desc) so we can compute both the
  // latest signal and a trend per measure.
  const query =
    `SELECT * FROM ${WASTEWATER_DB} WHERE "pruid" = "${ALBERTA_PRUID}" ` +
    `ORDER BY "Date" DESC LIMIT 40`;
  const url = `${PHAC_API_BASE}/${WASTEWATER_DB}/query`;
  await rateLimitedDelay();
  const response = await axios.get<unknown>(url, {
    params: { q: query },
    headers: { 'User-Agent': 'AlbertaHospitals-Pipeline/1.0' },
    timeout: 20000,
  });
  if (!isWastewaterArray(response.data)) {
    throw new Error('PHAC wastewater API returned an unexpected shape');
  }
  return response.data;
}

// Alberta Respiratory Virus Dashboard — wastewater data is embedded as Plotly
// JSON traces in the static HTML page (R-generated flexdashboard).
const ALBERTA_RVD_WASTEWATER_URL =
  'https://www.alberta.ca/stats/dashboard/respiratory-virus-dashboard.htm?data=wastewater-surveillance';

// Extract the Plotly "data":[...] array from embedded HTML.
function extractPlotlyDataFromHtml(html: string): unknown[] {
  const marker = '"data":[';
  const pos = html.indexOf(marker);
  if (pos === -1) return [];
  const arrStart = pos + marker.length - 1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"') { inString = !inString; }
    if (!inString) {
      if (c === '[') depth++;
      else if (c === ']') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(html.substring(arrStart, i + 1)) as unknown[]; }
          catch { return []; }
        }
      }
    }
  }
  return [];
}

// Fetch non-Edmonton wastewater signals from the Alberta RVD HTML page.
// The page embeds Plotly traces with site names, dates (x), and viral loads (y).
// We parse the traces and match them to existing WastewaterSignal entries.
async function fetchNonEdmontonWastewater(existing: WastewaterSignal[]): Promise<WastewaterSignal[]> {
  try {
    await rateLimitedDelay();
    const response = await axios.get<string>(ALBERTA_RVD_WASTEWATER_URL, {
      headers: { 'User-Agent': 'AlbertaHospitals-Pipeline/1.0', Accept: 'text/html' },
      timeout: 30000,
      responseType: 'text',
    });

    const traces = extractPlotlyDataFromHtml(response.data);
    if (traces.length === 0) {
      console.warn('[PhacFetcher] No Plotly traces found in RVD wastewater page');
      return [];
    }
    console.log(`[PhacFetcher] Found ${traces.length} Plotly traces in RVD page`);

    const updated: WastewaterSignal[] = [];
    const existingBySite = new Map(existing.map(s => [s.site.toLowerCase(), s]));

    for (const trace of traces) {
      if (!isRecord(trace)) continue;
      const siteName = typeof trace['name'] === 'string' ? trace['name'] : '';
      if (!siteName || DEPRECATED_SITES[siteName]) continue;

      const x = trace['x'];
      const y = trace['y'];
      if (!Array.isArray(x) || !Array.isArray(y) || x.length === 0 || y.length === 0) continue;

      // Get latest non-null value and date
      let latestIdx = y.length - 1;
      while (latestIdx >= 0 && typeof y[latestIdx] !== 'number') {
        latestIdx--;
      }
      if (latestIdx === -1) continue;
      const covidSignalRaw = y[latestIdx];
      if (typeof covidSignalRaw !== 'number') continue;
      const covidSignal = covidSignalRaw;

      // Match to existing entry by site name (case-insensitive partial)
      const siteLower = siteName.toLowerCase();
      let prev: WastewaterSignal | undefined;
      for (const [key, sig] of existingBySite) {
        if (key.includes(siteLower) || siteLower.includes(key)) {
          prev = sig;
          break;
        }
      }
      if (!prev) continue; // Only update existing entries
      if (prev.site === EDMONTON_SITE_KEY) continue; // RVD non-Edmonton path should not clobber PHAC Edmonton


      // Compute trend from last 5 vs previous 5 values
      const recent = y.slice(-5).filter((v): v is number => typeof v === 'number');
      const prev5 = y.slice(-10, -5).filter((v): v is number => typeof v === 'number');
      let trend: WastewaterSignal['trend'] = 'Stable';
      if (prev5.length > 0 && recent.length > 0) {
        const avgR = recent.reduce((a, b) => a + b, 0) / recent.length;
        const avgP = prev5.reduce((a, b) => a + b, 0) / prev5.length;
        if (avgR > avgP * 1.2) trend = 'Increasing';
        else if (avgR < avgP * 0.8) trend = 'Decreasing';
      }

      const sampleDateRaw = x[latestIdx];
      const sampleDate = typeof sampleDateRaw === 'string' ? sampleDateRaw : undefined;
      const isEdmonton = prev.site === EDMONTON_SITE_KEY;
      updated.push({
        ...prev,
        covidSignal,
        trend,
        activityLevel: deriveActivityLevel(covidSignal),
        sampleDate,
        fluASignal: isEdmonton ? prev.fluASignal : undefined,
        rsvSignal: isEdmonton ? prev.rsvSignal : undefined,
      });
    }

    return updated;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[PhacFetcher] Non-Edmonton wastewater fetch failed: ${msg}`);
    return [];
  }
}

interface MeasureSummary {
  signal: number;
  trend: WastewaterSignal['trend'];
  date?: string;
}

function summarizeMeasure(rows: PhacWastewaterRow[], measureId: string): MeasureSummary | null {
  // Rows arrive newest-first from the ORDER BY DESC query.
  const measureRows = rows
    .filter((r) => r.measureid === measureId)
    .sort((a, b) => (a.Date < b.Date ? 1 : -1));
  if (measureRows.length === 0) return null;

  const latest = asNumber(measureRows[0].seven_day_rolling_avg);
  if (latest === null) return null;

  const latestDate = typeof measureRows[0].Date === 'string' ? measureRows[0].Date : undefined;

  let trend: WastewaterSignal['trend'] = 'Stable';
  if (measureRows.length > 1) {
    const prev = asNumber(measureRows[1].seven_day_rolling_avg);
    if (prev !== null && prev > 0) {
      const deltaPct = ((latest - prev) / prev) * 100;
      if (deltaPct > 5) trend = 'Increasing';
      else if (deltaPct < -5) trend = 'Decreasing';
    }
  }
  return { signal: latest, trend, date: latestDate };
}

function deriveActivityLevel(covidSignal: number): WastewaterSignal['activityLevel'] {
  if (covidSignal >= 85) return 'Very High';
  if (covidSignal >= 65) return 'High';
  if (covidSignal >= 40) return 'Moderate';
  return 'Low';
}

// Build the Edmonton (Gold Bar Plant) wastewater signal from PHAC rows,
// preserving the hand-authored populationServed when present.
function buildEdmontonSignal(
  rows: PhacWastewaterRow[],
  existing: WastewaterSignal[],
): WastewaterSignal | null {
  const covid = summarizeMeasure(rows, 'covN2');
  const fluA = summarizeMeasure(rows, 'fluA');
  const rsv = summarizeMeasure(rows, 'rsv');
  if (!covid) return null; // COVID signal is the anchor; without it, skip.

  const prior = existing.find((s) => s.site === EDMONTON_SITE_KEY);
  const populationServed = prior?.populationServed ?? 0;
  // Trend follows the COVID signal (the dominant respiratory indicator).
  const trend = covid.trend;

  return {
    site: EDMONTON_SITE_KEY,
    zone: 'Edmonton Zone',
    populationServed,
    covidSignal: Number(covid.signal.toFixed(2)),
    fluASignal: fluA ? Number(fluA.signal.toFixed(2)) : 0,
    rsvSignal: rsv ? Number(rsv.signal.toFixed(2)) : 0,
    sampleDate: covid.date,
    activityLevel: deriveActivityLevel(covid.signal),
    trend,
  };
}
function deriveWastewaterSourceVintage(signals: WastewaterSignal[]): string {
  const sampleDates = signals
    .map((s) => s.sampleDate)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort();
  if (sampleDates.length === 0) return 'Unavailable';
  const first = sampleDates[0];
  const last = sampleDates[sampleDates.length - 1];
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
        error: 'No existing data-public-health.json to merge into; refusing to overwrite hand-authored baseline.',
        timestamp,
      };
    }

    console.log('[PhacFetcher] Querying PHAC wastewater API for Alberta (Edmonton Goldbar)...');
    const rows = await fetchAlbertaWastewater();
    const edmontonSignal = buildEdmontonSignal(rows, existing.WASTEWATER_SIGNALS);

    if (!edmontonSignal) {
      return {
        domain: 'public-health',
        pipeline,
        status: 'skipped',
        recordsFetched: rows.length,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error: 'PHAC wastewater API returned no usable Alberta COVID signal for Edmonton Goldbar.',
        timestamp,
      };
    }

    // Merge: replace the Edmonton entry, preserve every other hand-authored entry.
    let mergedSignals: WastewaterSignal[] = [];
    let replaced = false;
    for (const sig of existing.WASTEWATER_SIGNALS) {
      if (sig.site === EDMONTON_SITE_KEY) {
        mergedSignals.push(edmontonSignal);
        replaced = true;
      } else {
        mergedSignals.push(sig);
      }
    }
    if (!replaced) mergedSignals.push(edmontonSignal);

    // Attempt to refresh non-Edmonton sites from Alberta Respiratory Virus Dashboard
    console.log('[PhacFetcher] Attempting non-Edmonton wastewater fetch from Alberta RVD...');
    const nonEdmontonUpdates = await fetchNonEdmontonWastewater(mergedSignals);
    if (nonEdmontonUpdates.length > 0) {
      const updateBySite = new Map(nonEdmontonUpdates.map((u) => [u.site, u]));
      for (let i = 0; i < mergedSignals.length; i++) {
        const updated = updateBySite.get(mergedSignals[i].site);
        if (updated) mergedSignals[i] = updated;
      }
      console.log(`[PhacFetcher] Updated ${nonEdmontonUpdates.length} non-Edmonton wastewater sites.`);
    }

    // Drop any deprecated/stale sites (e.g. Jasper, Banff) from the preserved set.
    mergedSignals = mergedSignals.filter((s) => !DEPRECATED_SITES[s.site]);

    // Stamp only WASTEWATER_SIGNALS. Do not re-write or re-timestamp manual arrays.
    const priorWwMeta = existing._dataMetadata?.WASTEWATER_SIGNALS;
    const contentChanged =
      JSON.stringify(mergedSignals) !== JSON.stringify(existing.WASTEWATER_SIGNALS);
    const ownedMetadata: DataMetadata = {
      WASTEWATER_SIGNALS: buildMetadataEntry({
        updateType: 'auto',
        source: 'PHAC Health Infobase wastewater API + Alberta RVD',
        sourceVintage: deriveWastewaterSourceVintage(mergedSignals),
        lastUpdated: timestamp,
        previous: priorWwMeta,
        contentChanged,
      }),
    };

    // Preserve genuine upstream keys; force withheld residual public-health panels empty.
    const output: PublicHealthDataFile = {
      ...existing,
      RESPIRATORY_VIRUS_SURVEILLANCE: [],
      CHILDHOOD_IMMUNIZATION_COVERAGE: [],
      NOTIFIABLE_DISEASE_INCIDENCE: [],
      ENVIRONMENTAL_ADVISORIES: [],
      OUTBREAK_PROTOCOLS: {},
      WASTEWATER_SIGNALS: mergedSignals,
      _dataMetadata: mergeDataMetadata(existing._dataMetadata, ownedMetadata),
    };

    // Only write when wastewater content actually changed, or first stamp needed.
    if (contentChanged || !priorWwMeta) {
      applyWithheldPayloadGuard(output as unknown as Record<string, unknown>);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf-8');
    }

    return {
      domain: 'public-health',
      pipeline,
      status: contentChanged ? 'success' : 'partial',
      recordsFetched: rows.length,
      recordsWritten: contentChanged ? mergedSignals.length : 0,
      durationMs: Date.now() - startTime,
      error: contentChanged
        ? undefined
        : 'PHAC wastewater fetch succeeded but signal content unchanged; manual arrays not re-stamped.',
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
