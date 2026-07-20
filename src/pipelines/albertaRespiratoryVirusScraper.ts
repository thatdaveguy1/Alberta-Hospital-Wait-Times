// Alberta Respiratory Virus Dashboard Scraper
// Scrapes the Alberta Respiratory Virus Dashboard
// (https://www.alberta.ca/stats/dashboard/respiratory-virus-dashboard.htm)
// for respiratory virus surveillance data including wastewater history,
// laboratory percent positivity, case counts, influenza season overlays,
// and immunization doses.
//
// The dashboard is an R-generated static HTML page with embedded Plotly data.
// We fetch each tab's HTML, extract every parseable Plotly `"data":[` trace
// array via extractAllPlotlyDataArrays, and parse them into structured data.
//
// Writes to data-public-health.json:
//   - WASTEWATER_TIME_SERIES   — full COVID wastewater history (~2023-07+)
//   - WASTEWATER_SIGNALS       — latest COVID-only snapshot (8 sites)
//   - RVD_RESPIRATORY_CASE_COUNTS — influenza subtypes + RSV + COVID
//   - RVD_INFLUENZA_SEASON_COUNTS — season-overlay widget (2009+)
//   - RVD_LAB_TEST_POSITIVITY  — % tests positive (+ optional Total tests)
//   - RVD_IMMUNIZATION_DOSES   — influenza immunization doses by epi-week
//
// The page uses ?data= query params to select different data views:
//   ?data=wastewater-surveillance  — wastewater viral loads by site
//   ?data=summary                  — case summaries + influenza seasons
//   ?data=laboratory-testing       — test positivity
//   ?data=immunizations            — immunization doses

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
  applyWithheldPayloadGuard,
} from './metadataHelpers';
import type {
  WastewaterSignal,
  WastewaterTimeSeriesPoint,
  RvdRespiratoryCaseCount,
  RvdInfluenzaSeasonCount,
  RvdLabTestPositivity,
  RvdImmunizationDose,
} from '../publicHealthData';

const OUTPUT_FILE = path.join(process.cwd(), 'data-public-health.json');

const RVD_BASE_URL = 'https://www.alberta.ca/stats/dashboard/respiratory-virus-dashboard.htm';
const RVD_WASTEWATER_URL = `${RVD_BASE_URL}?data=wastewater-surveillance`;
const RVD_SUMMARY_URL = `${RVD_BASE_URL}?data=summary`;
const RVD_LAB_URL = `${RVD_BASE_URL}?data=laboratory-testing`;
const RVD_IMMUNIZATIONS_URL = `${RVD_BASE_URL}?data=immunizations`;

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

function extractDataAsOf(html: string): string | undefined {
  const match = html.match(/up-to-date as of ([A-Za-z]+ \d{1,2}, \d{4})/i);
  if (!match) return undefined;
  const dateMatch = match[1].match(/^([A-Za-z]+) (\d{1,2}), (\d{4})$/);
  if (!dateMatch) return undefined;
  const monthNames: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
  };
  const month = monthNames[dateMatch[1]];
  const day = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  if (month === undefined || Number.isNaN(day) || Number.isNaN(year)) return undefined;
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

// Normalize short RVD site names to existing display names used in the app.
const SITE_DISPLAY_NAMES: Record<string, string> = {
  Edmonton: 'Edmonton (Gold Bar Plant)',
  Calgary: 'Calgary (Bonnybrook Plant)',
  'Grande Prairie': 'Grande Prairie Plant',
  'Red Deer': 'Red Deer Wastewater Plant',
  Lethbridge: 'Lethbridge Wastewater Plant',
};

const SITE_TO_ZONE: Record<string, WastewaterSignal['zone']> = {
  Edmonton: 'Edmonton Zone',
  'Edmonton (Gold Bar Plant)': 'Edmonton Zone',
  'Fort Saskatchewan': 'Edmonton Zone',
  'Fort McMurray': 'North Zone',
  'Grande Prairie': 'North Zone',
  'Grande Prairie Plant': 'North Zone',
  'Red Deer': 'Central Zone',
  'Red Deer Wastewater Plant': 'Central Zone',
  Calgary: 'Calgary Zone',
  'Calgary (Bonnybrook Plant)': 'Calgary Zone',
  'Medicine Hat': 'South Zone',
  Lethbridge: 'South Zone',
  'Lethbridge Wastewater Plant': 'South Zone',
  Jasper: 'Edmonton Zone',
  Banff: 'Calgary Zone',
};

const DEPRECATED_SITES: Record<string, true> = { Jasper: true, Banff: true };

function normalizeSiteName(raw: string): string {
  return SITE_DISPLAY_NAMES[raw] ?? raw;
}

/** Extract one Plotly `"data":[` array starting at markerPos (index of `"data":`). */
function tryParsePlotlyDataArrayAt(html: string, markerPos: number): unknown[] | null {
  const marker = '"data":[';
  if (html.substring(markerPos, markerPos + marker.length) !== marker) return null;

  const arrStart = markerPos + marker.length - 1; // include the [
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = arrStart; i < html.length; i++) {
    const c = html[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
    }
    if (!inString) {
      if (c === '[') {
        depth++;
      } else if (c === ']') {
        depth--;
        if (depth === 0) {
          const jsonStr = html.substring(arrStart, i + 1);
          try {
            const parsed = JSON.parse(jsonStr) as unknown;
            return Array.isArray(parsed) ? parsed : null;
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

interface PlotlyBlock {
  traces: unknown[];
  /** HTML preceding this `"data":[` marker (for layout/section title inference). */
  precedingHtml: string;
}

/**
 * Find every parseable Plotly `"data":[` trace array in the HTML.
 * Returns only arrays that successfully JSON.parse.
 */
function extractAllPlotlyDataArrays(html: string): unknown[][] {
  return extractAllPlotlyBlocks(html).map((b) => b.traces);
}

function extractAllPlotlyBlocks(html: string): PlotlyBlock[] {
  const marker = '"data":[';
  const blocks: PlotlyBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < html.length) {
    const pos = html.indexOf(marker, searchFrom);
    if (pos === -1) break;

    const traces = tryParsePlotlyDataArrayAt(html, pos);
    if (traces) {
      const contextStart = Math.max(0, pos - 4000);
      blocks.push({
        traces,
        precedingHtml: html.substring(contextStart, pos),
      });
      // Advance past this marker; the array body may contain nested `[` but we
      // already consumed a full balanced array — jump forward by marker length
      // so the next search can find subsequent top-level `"data":[` markers.
      searchFrom = pos + marker.length;
      // Also skip past the parsed array to avoid re-scanning its interior.
      // Re-parse bounds cheaply: find matching `]` again from arrStart.
      const arrStart = pos + marker.length - 1;
      let depth = 0;
      let inString = false;
      let escape = false;
      let end = arrStart + 1;
      for (let i = arrStart; i < html.length; i++) {
        const c = html[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') inString = !inString;
        if (!inString) {
          if (c === '[') depth++;
          else if (c === ']') {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
      }
      searchFrom = end;
    } else {
      searchFrom = pos + marker.length;
    }
  }

  return blocks;
}

function flattenPlotlyTraces(html: string): unknown[] {
  return extractAllPlotlyDataArrays(html).flat();
}

function inferBlankVirusName(precedingHtml: string): string | undefined {
  if (/COVID-19 cases/i.test(precedingHtml)) return 'COVID-19';
  if (/RSV cases/i.test(precedingHtml) || /Respiratory Syncytial/i.test(precedingHtml)) {
    return 'RSV';
  }
  return undefined;
}

function isSeasonOverlayName(name: string): boolean {
  return /^\d{4}-\d{4}$/.test(name);
}

// ---------------------------------------------------------------------------
// Wastewater
// ---------------------------------------------------------------------------

function parseWastewaterTimeSeries(traces: unknown[]): WastewaterTimeSeriesPoint[] {
  const points: WastewaterTimeSeriesPoint[] = [];

  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const rawName = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!rawName || DEPRECATED_SITES[rawName]) continue;

    const site = normalizeSiteName(rawName);
    const zone = SITE_TO_ZONE[site] ?? SITE_TO_ZONE[rawName] ?? 'North Zone';
    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y) || x.length === 0 || y.length === 0) continue;

    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
      const sampleDate = typeof x[i] === 'string' ? (x[i] as string) : '';
      const covidSignal = typeof y[i] === 'number' ? (y[i] as number) : null;
      if (!sampleDate || covidSignal === null) continue;
      points.push({
        site,
        zone,
        sampleDate,
        covidSignal,
        source: 'alberta-rvd',
      });
    }
  }

  // Stable sort for deterministic diffs
  points.sort((a, b) => {
    const siteCmp = a.site.localeCompare(b.site);
    if (siteCmp !== 0) return siteCmp;
    return a.sampleDate.localeCompare(b.sampleDate);
  });

  return points;
}

function trendFromHistory(values: number[]): WastewaterSignal['trend'] {
  const recent = values.slice(-5);
  const prev = values.slice(-10, -5);
  let trend: WastewaterSignal['trend'] = 'Stable';
  if (prev.length > 0 && recent.length > 0) {
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avgRecent > avgPrev * 1.2) trend = 'Increasing';
    else if (avgRecent < avgPrev * 0.8) trend = 'Decreasing';
  }
  return trend;
}

function activityLevelFromValue(latestValue: number): WastewaterSignal['activityLevel'] {
  if (latestValue > 0.05) return 'Very High';
  if (latestValue > 0.01) return 'High';
  if (latestValue > 0.003) return 'Moderate';
  return 'Low';
}

/** Derive the latest COVID-only WASTEWATER_SIGNALS snapshot from the full series. */
function deriveWastewaterSignals(
  series: WastewaterTimeSeriesPoint[],
  existing: WastewaterSignal[],
): WastewaterSignal[] {
  const bySite = new Map<string, WastewaterTimeSeriesPoint[]>();
  for (const p of series) {
    const list = bySite.get(p.site) ?? [];
    list.push(p);
    bySite.set(p.site, list);
  }

  const existingBySite = new Map(existing.map((s) => [s.site.toLowerCase(), s]));
  const signals: WastewaterSignal[] = [];

  for (const [site, points] of bySite) {
    if (points.length === 0) continue;
    const sorted = [...points].sort((a, b) => a.sampleDate.localeCompare(b.sampleDate));
    const latest = sorted[sorted.length - 1];
    const values = sorted.map((p) => p.covidSignal);

    let prev: WastewaterSignal | undefined;
    const siteLower = site.toLowerCase();
    for (const [key, sig] of existingBySite) {
      if (key === siteLower || key.includes(siteLower) || siteLower.includes(key)) {
        prev = sig;
        break;
      }
    }

    // COVID only — intentionally omit fluASignal / rsvSignal.
    signals.push({
      site,
      zone: latest.zone,
      populationServed: prev?.populationServed ?? 0,
      covidSignal: latest.covidSignal,
      activityLevel: activityLevelFromValue(latest.covidSignal),
      trend: trendFromHistory(values),
      sampleDate: latest.sampleDate,
    });
  }

  signals.sort((a, b) => a.site.localeCompare(b.site));
  return signals;
}

// ---------------------------------------------------------------------------
// Summary: case counts + influenza season overlays
// ---------------------------------------------------------------------------

function parseSummaryBlocks(
  blocks: PlotlyBlock[],
  dataAsOf: string | undefined,
): {
  caseCounts: RvdRespiratoryCaseCount[];
  seasonCounts: RvdInfluenzaSeasonCount[];
} {
  // Prefer longest series per virus / season name.
  const bestCaseByVirus = new Map<string, RvdRespiratoryCaseCount[]>();
  const bestSeasonByName = new Map<string, RvdInfluenzaSeasonCount[]>();

  for (const block of blocks) {
    const inferred = inferBlankVirusName(block.precedingHtml);

    // Group case-count rows produced by this block's named (or inferred) traces
    // so "prefer longest" compares whole series lengths.
    const caseSeriesInBlock = new Map<string, RvdRespiratoryCaseCount[]>();
    const seasonSeriesInBlock = new Map<string, RvdInfluenzaSeasonCount[]>();

    for (const trace of block.traces) {
      if (!isRecord(trace)) continue;
      let name = typeof trace['name'] === 'string' ? trace['name'].trim() : '';
      if (!name && inferred) name = inferred;
      if (!name) continue;

      const x = trace['x'];
      const y = trace['y'];
      if (!Array.isArray(x) || !Array.isArray(y)) continue;

      // Skip decorative season-boundary markers (x length 2 vertical lines).
      if (x.length <= 2 && !isSeasonOverlayName(name)) continue;

      if (isSeasonOverlayName(name)) {
        const seasonStart = parseInt(name.slice(0, 4), 10);
        if (Number.isNaN(seasonStart) || seasonStart < 2009) continue;

        const rows: RvdInfluenzaSeasonCount[] = [];
        for (let i = 0; i < Math.min(x.length, y.length); i++) {
          const weekEnding = typeof x[i] === 'string' ? (x[i] as string) : '';
          const count = typeof y[i] === 'number' ? (y[i] as number) : null;
          if (!weekEnding || count === null) continue;
          if (dataAsOf && weekEnding > dataAsOf) continue;
          rows.push({ season: name, weekEnding, count });
        }
        if (rows.length > 0) {
          const prev = seasonSeriesInBlock.get(name);
          if (!prev || rows.length > prev.length) seasonSeriesInBlock.set(name, rows);
        }
        continue;
      }

      // Regular virus case counts (named subtypes or inferred RSV/COVID).
      const rows: RvdRespiratoryCaseCount[] = [];
      for (let i = 0; i < Math.min(x.length, y.length); i++) {
        const weekEnding = typeof x[i] === 'string' ? (x[i] as string) : '';
        const count = typeof y[i] === 'number' ? (y[i] as number) : null;
        if (!weekEnding || count === null) continue;
        if (dataAsOf && weekEnding > dataAsOf) continue;
        rows.push({ virus: name, weekEnding, count });
      }
      if (rows.length > 0) {
        const prev = caseSeriesInBlock.get(name);
        if (!prev || rows.length > prev.length) caseSeriesInBlock.set(name, rows);
      }
    }

    for (const [virus, rows] of caseSeriesInBlock) {
      const prev = bestCaseByVirus.get(virus);
      if (!prev || rows.length > prev.length) bestCaseByVirus.set(virus, rows);
    }
    for (const [season, rows] of seasonSeriesInBlock) {
      const prev = bestSeasonByName.get(season);
      if (!prev || rows.length > prev.length) bestSeasonByName.set(season, rows);
    }
  }

  // Flatten + dedupe (virus, weekEnding) / (season, weekEnding)
  const caseMap = new Map<string, RvdRespiratoryCaseCount>();
  for (const rows of bestCaseByVirus.values()) {
    for (const row of rows) {
      caseMap.set(`${row.virus}|${row.weekEnding}`, row);
    }
  }
  const caseCounts = Array.from(caseMap.values()).sort((a, b) => {
    const v = a.virus.localeCompare(b.virus);
    if (v !== 0) return v;
    return a.weekEnding.localeCompare(b.weekEnding);
  });

  const seasonMap = new Map<string, RvdInfluenzaSeasonCount>();
  for (const rows of bestSeasonByName.values()) {
    for (const row of rows) {
      seasonMap.set(`${row.season}|${row.weekEnding}`, row);
    }
  }
  const seasonCounts = Array.from(seasonMap.values()).sort((a, b) => {
    const s = a.season.localeCompare(b.season);
    if (s !== 0) return s;
    return a.weekEnding.localeCompare(b.weekEnding);
  });

  return { caseCounts, seasonCounts };
}

// ---------------------------------------------------------------------------
// Laboratory testing
// ---------------------------------------------------------------------------

function parseLabTestPositivity(
  traces: unknown[],
  dataAsOf: string | undefined,
): RvdLabTestPositivity[] {
  // virus -> weekEnding -> { percentPositive?, totalTests? }
  const byVirusWeek = new Map<string, { percentPositive?: number; totalTests?: number }>();

  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const name = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!name) continue;

    const positiveMatch = name.match(/^%\s*(.+?)\s*tests positive$/i);
    const totalMatch = name.match(/^Total\s+(.+?)\s*tests$/i);
    if (!positiveMatch && !totalMatch) continue;

    const virus = (positiveMatch?.[1] ?? totalMatch?.[1] ?? '').trim();
    if (!virus) continue;

    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y)) continue;

    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const weekEnding = typeof x[i] === 'string' ? (x[i] as string) : '';
      const value = typeof y[i] === 'number' ? (y[i] as number) : null;
      if (!weekEnding || value === null) continue;
      if (dataAsOf && weekEnding > dataAsOf) continue;

      const key = `${virus}|${weekEnding}`;
      const entry = byVirusWeek.get(key) ?? {};
      if (positiveMatch) entry.percentPositive = value;
      if (totalMatch) entry.totalTests = value;
      byVirusWeek.set(key, entry);
    }
  }

  const rows: RvdLabTestPositivity[] = [];
  for (const [key, entry] of byVirusWeek) {
    if (typeof entry.percentPositive !== 'number') continue;
    const [virus, weekEnding] = key.split('|');
    const row: RvdLabTestPositivity = {
      virus,
      weekEnding,
      percentPositive: entry.percentPositive,
    };
    if (typeof entry.totalTests === 'number') row.totalTests = entry.totalTests;
    rows.push(row);
  }

  rows.sort((a, b) => {
    const v = a.virus.localeCompare(b.virus);
    if (v !== 0) return v;
    return a.weekEnding.localeCompare(b.weekEnding);
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Immunizations (keep working with extract-all)
// ---------------------------------------------------------------------------

function parseImmunizationTraces(
  traces: unknown[],
  dataAsOf: string | undefined,
): RvdImmunizationDose[] {
  // Prefer longest series per season name (influenza chart precedes COVID).
  const bestBySeason = new Map<string, RvdImmunizationDose[]>();
  let currentStartYear: number | undefined;

  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const season = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!season) continue;

    const seasonStartMatch = season.match(/^(\d{4})-\d{4}$/);
    if (!seasonStartMatch) continue;
    const seasonStartYear = parseInt(seasonStartMatch[1], 10);

    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y)) continue;

    if (currentStartYear === undefined && typeof x[0] === 'string') {
      const firstDate = x[0] as string;
      const yearMatch = firstDate.match(/^(\d{4})/);
      if (yearMatch) currentStartYear = parseInt(yearMatch[1], 10);
    }
    if (currentStartYear === undefined) continue;

    const yearDelta = currentStartYear - seasonStartYear;
    const rows: RvdImmunizationDose[] = [];

    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const weekEndingRaw = x[i];
      const weekEnding = typeof weekEndingRaw === 'string' ? weekEndingRaw : '';
      const doses = typeof y[i] === 'number' ? y[i] : null;
      if (!weekEnding || doses === null) continue;

      const parsed = new Date(`${weekEnding}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) continue;
      parsed.setFullYear(parsed.getFullYear() - yearDelta);
      const adjusted = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;

      if (dataAsOf && adjusted > dataAsOf) continue;
      rows.push({ season, weekEnding: adjusted, doses: doses as number });
    }

    if (rows.length === 0) continue;
    const prev = bestBySeason.get(season);
    // Prefer longer series; on ties keep the first (influenza chart).
    if (!prev || rows.length > prev.length) bestBySeason.set(season, rows);
  }

  const entries = Array.from(bestBySeason.values()).flat();
  entries.sort((a, b) => {
    const s = a.season.localeCompare(b.season);
    if (s !== 0) return s;
    return a.weekEnding.localeCompare(b.weekEnding);
  });
  return entries;
}

// ---------------------------------------------------------------------------
// Metadata helpers
// ---------------------------------------------------------------------------

function deriveDateRange(weekEndings: string[]): string {
  const dates = weekEndings.filter((d) => typeof d === 'string' && d.length > 0).sort();
  if (dates.length === 0) return 'Alberta RVD dashboard (latest weekly data)';
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

function deriveWastewaterSourceVintage(
  signals: WastewaterSignal[] | WastewaterTimeSeriesPoint[],
): string {
  const sampleDates = signals
    .map((s) => ('sampleDate' in s ? s.sampleDate : undefined))
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort();
  if (sampleDates.length === 0) return 'Unavailable';
  const first = sampleDates[0];
  const last = sampleDates[sampleDates.length - 1];
  return first === last ? first : `${first} to ${last}`;
}

function deriveImmunizationSourceVintage(entries: RvdImmunizationDose[]): string {
  const seasons = Array.from(new Set(entries.map((e) => e.season))).sort();
  if (seasons.length === 0) return 'Alberta RVD immunizations (no seasons parsed)';

  const range = deriveDateRange(entries.map((e) => e.weekEnding));
  const seasonRange =
    seasons.length === 1
      ? seasons[0]
      : `${seasons[0]} to ${seasons[seasons.length - 1]}`;

  return `Influenza immunization doses by epidemiological week; seasons ${seasonRange}; week-ending range ${range}`;
}

function deriveSeasonSourceVintage(entries: RvdInfluenzaSeasonCount[]): string {
  const seasons = Array.from(new Set(entries.map((e) => e.season))).sort();
  if (seasons.length === 0) return 'Alberta RVD influenza seasons (none parsed)';
  const seasonRange =
    seasons.length === 1
      ? seasons[0]
      : `${seasons[0]} to ${seasons[seasons.length - 1]}`;
  const range = deriveDateRange(entries.map((e) => e.weekEnding));
  return `Influenza season overlays ${seasonRange}; week-ending range ${range}`;
}

async function fetchHtml(url: string, label: string): Promise<string> {
  console.log(`[AlbertaRVDScraper] Fetching ${label} page HTML...`);
  const response = await axios.get<string>(url, {
    timeout: 60000,
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    responseType: 'text',
  });
  await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
  console.log(`[AlbertaRVDScraper] ${label} page: ${response.data.length} bytes`);
  return response.data;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AlbertaRVDScraper] Starting Alberta Respiratory Virus Dashboard scrape');

  try {
    // === 1. Wastewater surveillance ===
    const wwHtml = await fetchHtml(RVD_WASTEWATER_URL, 'wastewater');
    const dataAsOf = extractDataAsOf(wwHtml);
    console.log(`[AlbertaRVDScraper] Dashboard as-of date: ${dataAsOf ?? 'not found'}`);

    const wwTraces = flattenPlotlyTraces(wwHtml);
    console.log(
      `[AlbertaRVDScraper] Found ${extractAllPlotlyDataArrays(wwHtml).length} wastewater Plotly arrays / ${wwTraces.length} traces`,
    );
    const wwSeries = parseWastewaterTimeSeries(wwTraces);
    console.log(`[AlbertaRVDScraper] Parsed ${wwSeries.length} wastewater time-series points`);

    // === 2. Summary (case counts + influenza season overlays) ===
    const sumHtml = await fetchHtml(RVD_SUMMARY_URL, 'summary');
    const sumDataAsOf = extractDataAsOf(sumHtml) ?? dataAsOf;
    const sumBlocks = extractAllPlotlyBlocks(sumHtml);
    console.log(`[AlbertaRVDScraper] Found ${sumBlocks.length} summary Plotly arrays`);
    const { caseCounts: summaryEntries, seasonCounts } = parseSummaryBlocks(sumBlocks, sumDataAsOf);
    console.log(
      `[AlbertaRVDScraper] Parsed ${summaryEntries.length} case-count rows, ${seasonCounts.length} season-overlay rows`,
    );

    // === 3. Laboratory testing ===
    const labHtml = await fetchHtml(RVD_LAB_URL, 'laboratory-testing');
    const labDataAsOf = extractDataAsOf(labHtml) ?? dataAsOf;
    const labTraces = flattenPlotlyTraces(labHtml);
    console.log(
      `[AlbertaRVDScraper] Found ${extractAllPlotlyDataArrays(labHtml).length} lab Plotly arrays / ${labTraces.length} traces`,
    );
    const labEntries = parseLabTestPositivity(labTraces, labDataAsOf);
    console.log(`[AlbertaRVDScraper] Parsed ${labEntries.length} lab positivity rows`);

    // === 4. Immunizations ===
    const immHtml = await fetchHtml(RVD_IMMUNIZATIONS_URL, 'immunizations');
    const immDataAsOf = extractDataAsOf(immHtml) ?? dataAsOf;
    const immTraces = flattenPlotlyTraces(immHtml);
    console.log(
      `[AlbertaRVDScraper] Found ${extractAllPlotlyDataArrays(immHtml).length} immunization Plotly arrays / ${immTraces.length} traces`,
    );
    const immEntries = parseImmunizationTraces(immTraces, immDataAsOf);
    console.log(`[AlbertaRVDScraper] Parsed ${immEntries.length} immunization entries`);

    if (
      wwSeries.length === 0 &&
      summaryEntries.length === 0 &&
      seasonCounts.length === 0 &&
      labEntries.length === 0 &&
      immEntries.length === 0
    ) {
      console.warn('[AlbertaRVDScraper] No data parsed from any RVD tab — leaving data files unchanged.');
      return {
        domain: 'public-health',
        pipeline: 'albertaRespiratoryVirusScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No plotly traces found in any RVD tab',
      };
    }

    // Load existing data and merge all
    const existing = loadJsonFile(OUTPUT_FILE);
    // Force withheld public-health residual arrays empty so RMW never reintroduces them.
    existing.RESPIRATORY_VIRUS_SURVEILLANCE = [];
    existing.CHILDHOOD_IMMUNIZATION_COVERAGE = [];
    existing.NOTIFIABLE_DISEASE_INCIDENCE = [];
    existing.ENVIRONMENTAL_ADVISORIES = [];
    existing.OUTBREAK_PROTOCOLS = {};

    const existingSignals = Array.isArray(existing.WASTEWATER_SIGNALS)
      ? (existing.WASTEWATER_SIGNALS as WastewaterSignal[])
      : [];
    const existingSeries = Array.isArray(existing.WASTEWATER_TIME_SERIES)
      ? (existing.WASTEWATER_TIME_SERIES as WastewaterTimeSeriesPoint[])
      : [];
    const existingCaseCounts = Array.isArray(existing.RVD_RESPIRATORY_CASE_COUNTS)
      ? (existing.RVD_RESPIRATORY_CASE_COUNTS as RvdRespiratoryCaseCount[])
      : [];
    const existingSeasonCounts = Array.isArray(existing.RVD_INFLUENZA_SEASON_COUNTS)
      ? (existing.RVD_INFLUENZA_SEASON_COUNTS as RvdInfluenzaSeasonCount[])
      : [];
    const existingLab = Array.isArray(existing.RVD_LAB_TEST_POSITIVITY)
      ? (existing.RVD_LAB_TEST_POSITIVITY as RvdLabTestPositivity[])
      : [];
    const existingImmDoses = Array.isArray(existing.RVD_IMMUNIZATION_DOSES)
      ? (existing.RVD_IMMUNIZATION_DOSES as RvdImmunizationDose[])
      : [];

    const mergedSignals =
      wwSeries.length > 0 ? deriveWastewaterSignals(wwSeries, existingSignals) : existingSignals;

    for (const p of mergedSignals) {
      console.log(
        `  ${p.site}: value=${p.covidSignal.toFixed(6)}, date=${p.sampleDate ?? '?'}, trend=${p.trend}, activity=${p.activityLevel}`,
      );
    }

    const output: Record<string, unknown> = { ...existing };
    if (wwSeries.length > 0) {
      output.WASTEWATER_TIME_SERIES = wwSeries;
      output.WASTEWATER_SIGNALS = mergedSignals;
    }
    if (summaryEntries.length > 0) {
      output.RVD_RESPIRATORY_CASE_COUNTS = summaryEntries;
    }
    if (seasonCounts.length > 0) {
      output.RVD_INFLUENZA_SEASON_COUNTS = seasonCounts;
    }
    if (labEntries.length > 0) {
      output.RVD_LAB_TEST_POSITIVITY = labEntries;
    }
    if (immEntries.length > 0) {
      output.RVD_IMMUNIZATION_DOSES = immEntries;
    }

    const existingMeta = isRecord(existing._dataMetadata)
      ? (existing._dataMetadata as DataMetadata)
      : undefined;
    const ownedMetadata: DataMetadata = {};
    const contentChangedKeys: string[] = [];

    const wwSeriesChanged =
      wwSeries.length > 0 && JSON.stringify(wwSeries) !== JSON.stringify(existingSeries);
    const wwSignalsChanged =
      wwSeries.length > 0 && JSON.stringify(mergedSignals) !== JSON.stringify(existingSignals);

    if (wwSeries.length > 0) {
      ownedMetadata.WASTEWATER_TIME_SERIES = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard wastewater',
        sourceVintage: deriveWastewaterSourceVintage(wwSeries),
        lastUpdated: timestamp,
        previous: existingMeta?.WASTEWATER_TIME_SERIES,
        contentChanged: wwSeriesChanged,
      });
      if (wwSeriesChanged) contentChangedKeys.push('WASTEWATER_TIME_SERIES');

      ownedMetadata.WASTEWATER_SIGNALS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard wastewater',
        sourceVintage: deriveWastewaterSourceVintage(mergedSignals),
        lastUpdated: timestamp,
        previous: existingMeta?.WASTEWATER_SIGNALS,
        contentChanged: wwSignalsChanged,
      });
      if (wwSignalsChanged) contentChangedKeys.push('WASTEWATER_SIGNALS');
    }

    const caseCountsContentChanged =
      summaryEntries.length > 0 &&
      JSON.stringify(summaryEntries) !== JSON.stringify(existingCaseCounts);
    if (summaryEntries.length > 0) {
      ownedMetadata.RVD_RESPIRATORY_CASE_COUNTS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard summary',
        sourceVintage: deriveDateRange(summaryEntries.map((e) => e.weekEnding)),
        lastUpdated: timestamp,
        previous: existingMeta?.RVD_RESPIRATORY_CASE_COUNTS,
        contentChanged: caseCountsContentChanged,
      });
      if (caseCountsContentChanged) contentChangedKeys.push('RVD_RESPIRATORY_CASE_COUNTS');
    }

    const seasonContentChanged =
      seasonCounts.length > 0 &&
      JSON.stringify(seasonCounts) !== JSON.stringify(existingSeasonCounts);
    if (seasonCounts.length > 0) {
      ownedMetadata.RVD_INFLUENZA_SEASON_COUNTS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard summary seasons',
        sourceVintage: deriveSeasonSourceVintage(seasonCounts),
        lastUpdated: timestamp,
        previous: existingMeta?.RVD_INFLUENZA_SEASON_COUNTS,
        contentChanged: seasonContentChanged,
      });
      if (seasonContentChanged) contentChangedKeys.push('RVD_INFLUENZA_SEASON_COUNTS');
    }

    const labContentChanged =
      labEntries.length > 0 && JSON.stringify(labEntries) !== JSON.stringify(existingLab);
    if (labEntries.length > 0) {
      ownedMetadata.RVD_LAB_TEST_POSITIVITY = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard laboratory-testing',
        sourceVintage: deriveDateRange(labEntries.map((e) => e.weekEnding)),
        lastUpdated: timestamp,
        previous: existingMeta?.RVD_LAB_TEST_POSITIVITY,
        contentChanged: labContentChanged,
      });
      if (labContentChanged) contentChangedKeys.push('RVD_LAB_TEST_POSITIVITY');
    }

    const immContentChanged =
      immEntries.length > 0 && JSON.stringify(immEntries) !== JSON.stringify(existingImmDoses);
    if (immEntries.length > 0) {
      ownedMetadata.RVD_IMMUNIZATION_DOSES = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard immunizations',
        sourceVintage: deriveImmunizationSourceVintage(immEntries),
        lastUpdated: timestamp,
        previous: existingMeta?.RVD_IMMUNIZATION_DOSES,
        contentChanged: immContentChanged,
      });
      if (immContentChanged) contentChangedKeys.push('RVD_IMMUNIZATION_DOSES');
    }

    output._dataMetadata = mergeDataMetadata(existingMeta, ownedMetadata, contentChangedKeys);

    const anyContentChanged = contentChangedKeys.length > 0;
    if (anyContentChanged) {
      applyWithheldPayloadGuard(output);
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
    } else {
      console.log('[AlbertaRVDScraper] No content changes; data files left unchanged.');
    }

    const totalFetched =
      wwSeries.length +
      summaryEntries.length +
      seasonCounts.length +
      labEntries.length +
      immEntries.length;
    const totalWritten =
      (wwSeriesChanged ? wwSeries.length : 0) +
      (wwSignalsChanged ? mergedSignals.length : 0) +
      (caseCountsContentChanged ? summaryEntries.length : 0) +
      (seasonContentChanged ? seasonCounts.length : 0) +
      (labContentChanged ? labEntries.length : 0) +
      (immContentChanged ? immEntries.length : 0);

    console.log(
      `[AlbertaRVDScraper] Complete. fetched=${totalFetched} written=${totalWritten} ` +
        `(wwSites=${mergedSignals.length}, wwSeries=${wwSeries.length}) in ${Date.now() - startTime}ms`,
    );
    console.log(`[AlbertaRVDScraper] contentChangedKeys=${contentChangedKeys.join(',') || '(none)'}`);

    return {
      domain: 'public-health',
      pipeline: 'albertaRespiratoryVirusScraper',
      status: anyContentChanged ? 'success' : 'partial',
      recordsFetched: totalFetched,
      recordsWritten: totalWritten,
      durationMs: Date.now() - startTime,
      timestamp,
      error: anyContentChanged
        ? undefined
        : 'Parsed RVD data identical to existing; no writes performed.',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AlbertaRVDScraper] FAILED:', errorMsg);
    return {
      domain: 'public-health',
      pipeline: 'albertaRespiratoryVirusScraper',
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
