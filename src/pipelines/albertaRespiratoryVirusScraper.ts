// Alberta Respiratory Virus Dashboard Scraper
// Scrapes the Alberta Respiratory Virus Dashboard
// (https://www.alberta.ca/stats/dashboard/respiratory-virus-dashboard.htm)
// for respiratory virus surveillance data including wastewater, test positivity,
// and case counts by zone.
//
// The dashboard is an R-generated static HTML page with embedded Plotly data.
// We fetch the HTML, extract the embedded Plotly JSON traces, and parse them
// into structured data.
//
// Writes to:
//   - data-public-health.json: WASTEWATER_SIGNALS (updates non-Edmonton sites)
//
// The page uses ?data= query params to select different data views:
//   ?data=wastewater-surveillance  — wastewater viral loads by site
//   ?data=summary                  — case summaries
//   ?data=laboratory-testing       — test positivity

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';
import type { WastewaterSignal } from '../publicHealthData';

const OUTPUT_FILE = path.join(process.cwd(), 'data-public-health.json');

const RVD_BASE_URL = 'https://www.alberta.ca/stats/dashboard/respiratory-virus-dashboard.htm';
const RVD_WASTEWATER_URL = `${RVD_BASE_URL}?data=wastewater-surveillance`;
const RVD_SUMMARY_URL = `${RVD_BASE_URL}?data=summary`;
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


// Zone mapping for Alberta wastewater sites
const SITE_TO_ZONE: Record<string, WastewaterSignal['zone']> = {
  'Edmonton': 'Edmonton Zone',
  'Fort Saskatchewan': 'Edmonton Zone',
  'Fort McMurray': 'North Zone',
  'Grande Prairie': 'North Zone',
  'Red Deer': 'Central Zone',
  'Calgary': 'Calgary Zone',
  'Medicine Hat': 'South Zone',
  'Lethbridge': 'South Zone',
  'Jasper': 'Edmonton Zone',
  'Banff': 'Calgary Zone',
};
const DEPRECATED_SITES: Record<string, true> = { Jasper: true, Banff: true };
const EDMONTON_SITE_KEY = 'Edmonton (Gold Bar Plant)';


// Population served is not published in RVD traces — leave 0 (never invent).

// Extract the Plotly data array from embedded HTML
function extractPlotlyData(html: string): unknown[] {
  // The data is embedded as JSON in the HTML: "data":[...]
  const marker = '"data":[';
  const pos = html.indexOf(marker);
  if (pos === -1) return [];

  const arrStart = pos + marker.length - 1; // include the [
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
            return JSON.parse(jsonStr) as unknown[];
          } catch {
            return [];
          }
        }
      }
    }
  }
  return [];
}

// Parse plotly traces into wastewater signal updates
interface ParsedSignal {
  site: string;
  covidSignal: number;
  latestDate: string;
  trend: WastewaterSignal['trend'];
  activityLevel: WastewaterSignal['activityLevel'];
}

function parseWastewaterTraces(traces: unknown[]): ParsedSignal[] {
  const signals: ParsedSignal[] = [];

  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const name = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!name) continue;

    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y) || x.length === 0 || y.length === 0) continue;
    if (x.length !== y.length) continue;

    // Get latest non-null value
    let latestIdx = y.length - 1;
    while (latestIdx >= 0 && (typeof y[latestIdx] !== 'number' || y[latestIdx] === null)) {
      latestIdx--;
    }
    if (latestIdx === -1) continue;
    const latestValueRaw = y[latestIdx];
    if (typeof latestValueRaw !== 'number') continue;
    const latestValue = latestValueRaw;
    const latestDateRaw = x[latestIdx];
    const latestDate = typeof latestDateRaw === 'string' ? latestDateRaw : '';

    // Compute trend from last 5 vs previous 5 values
    const recent = (y as number[]).slice(-5);
    const prev = (y as number[]).slice(-10, -5);
    let trend: WastewaterSignal['trend'] = 'Stable';
    if (prev.length > 0) {
      const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
      const avgPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
      if (avgRecent > avgPrev * 1.2) trend = 'Increasing';
      else if (avgRecent < avgPrev * 0.8) trend = 'Decreasing';
    }

    // Determine activity level
    let activityLevel: WastewaterSignal['activityLevel'] = 'Low';
    if (latestValue > 0.05) activityLevel = 'Very High';
    else if (latestValue > 0.01) activityLevel = 'High';
    else if (latestValue > 0.003) activityLevel = 'Moderate';

    signals.push({
      site: name,
      covidSignal: latestValue,
      latestDate,
      trend,
      activityLevel,
    });
  }

  return signals;
}

function mergeWastewaterSignals(
  existing: WastewaterSignal[],
  parsed: ParsedSignal[],
): WastewaterSignal[] {
  const merged: WastewaterSignal[] = [];
  const existingBySite = new Map(existing.map((s) => [s.site.toLowerCase(), s]));

  for (const p of parsed) {
    // Official RVD note: "Data from Jasper and Banff National Parks will not be
    // updated after April 2025." Do not surface stale national-park sites as live.
    if (DEPRECATED_SITES[p.site]) continue;

    const parsedSite = p.site.toLowerCase();
    let prev: WastewaterSignal | undefined;
    for (const [site, sig] of existingBySite) {
      if (site.includes(parsedSite) || parsedSite.includes(site)) {
        prev = sig;
        break;
      }
    }

    // COVID is the only verified RVD wastewater trace. Do not carry forward
    // prior fluA/rsv values as current measurements.
    const isEdmonton = prev ? prev.site === EDMONTON_SITE_KEY : false;
    const base = prev ?? {
      site: p.site,
      zone: SITE_TO_ZONE[p.site] ?? 'North Zone',
      populationServed: 0,
      covidSignal: 0,
      activityLevel: 'Low' as const,
      trend: 'Stable' as const,
    };
    const fluASignal = isEdmonton ? prev!.fluASignal : undefined;
    const rsvSignal = isEdmonton ? prev!.rsvSignal : undefined;

    merged.push({
      ...base,
      site: base.site,
      covidSignal: p.covidSignal,
      trend: p.trend,
      activityLevel: p.activityLevel,
      sampleDate: p.latestDate,
      fluASignal,
      rsvSignal,
    });
  }

  return merged;
}

interface RespiratoryVirusEntry {
  virus: string;
 weekEnding: string;
 count: number;
}

interface ImmunizationEntry {
  season: string;
 weekEnding: string;
 doses: number;
}

function parseSummaryTraces(traces: unknown[], dataAsOf: string | undefined): RespiratoryVirusEntry[] {
  const entries: RespiratoryVirusEntry[] = [];
  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const virus = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!virus) continue;
    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y)) continue;
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const weekEndingRaw = x[i];
      const weekEnding = typeof weekEndingRaw === 'string' ? weekEndingRaw : '';
      const count = typeof y[i] === 'number' ? y[i] : null;
      if (weekEnding && count !== null) {
        if (dataAsOf && weekEnding > dataAsOf) continue;
        entries.push({ virus, weekEnding, count });
      }
    }
  }
  return entries;
}

function parseImmunizationTraces(traces: unknown[], dataAsOf: string | undefined): ImmunizationEntry[] {
  const entries: ImmunizationEntry[] = [];
  let currentStartYear: number | undefined;

  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const season = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!season) continue;

    const seasonStartMatch = season.match(/^(\d{4})/);
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
      entries.push({ season, weekEnding: adjusted, doses });
    }
  }
  return entries;
}
// Build a "YYYY-MM-DD to YYYY-MM-DD" vintage label from the week-ending dates
// present in a scraped array. Falls back to a descriptive label when empty.
function deriveDateRange(weekEndings: string[]): string {
  const dates = weekEndings.filter((d) => typeof d === 'string' && d.length > 0).sort();
  if (dates.length === 0) return 'Alberta RVD dashboard (latest weekly data)';
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? first : `${first} to ${last}`;
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

function deriveImmunizationSourceVintage(entries: ImmunizationEntry[]): string {
  const seasons = Array.from(new Set(entries.map((e) => e.season))).sort();
  if (seasons.length === 0) return 'Alberta RVD immunizations (no seasons parsed)';

  const range = deriveDateRange(entries.map((e) => e.weekEnding));
  const seasonRange =
    seasons.length === 1
      ? seasons[0]
      : `${seasons[0]} to ${seasons[seasons.length - 1]}`;

  return `Influenza immunization doses by epidemiological week; seasons ${seasonRange}; week-ending range ${range}`;
}



export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AlbertaRVDScraper] Starting Alberta Respiratory Virus Dashboard scrape');

  try {
    // === 1. Wastewater surveillance ===
    console.log('[AlbertaRVDScraper] Fetching wastewater page HTML...');
    const wwResponse = await axios.get<string>(RVD_WASTEWATER_URL, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      responseType: 'text',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    const wwHtml = wwResponse.data;
    const dataAsOf = extractDataAsOf(wwHtml);
    console.log(`[AlbertaRVDScraper] Dashboard as-of date: ${dataAsOf ?? 'not found'}`);
    console.log(`[AlbertaRVDScraper] Wastewater page: ${wwHtml.length} bytes`);
    const wwTraces = extractPlotlyData(wwHtml);
    console.log(`[AlbertaRVDScraper] Found ${wwTraces.length} wastewater traces`);
    const parsed = parseWastewaterTraces(wwTraces);
    console.log(`[AlbertaRVDScraper] Parsed ${parsed.length} wastewater signals`);
    for (const p of parsed) {
      console.log(`  ${p.site}: value=${p.covidSignal.toFixed(6)}, date=${p.latestDate}, trend=${p.trend}, activity=${p.activityLevel}`);
    }

    // === 2. Summary (respiratory virus case counts) ===
    console.log('[AlbertaRVDScraper] Fetching summary page HTML...');
    const sumResponse = await axios.get<string>(RVD_SUMMARY_URL, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      responseType: 'text',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    const sumHtml = sumResponse.data;
    const sumTraces = extractPlotlyData(sumHtml);
    const summaryEntries = parseSummaryTraces(sumTraces, dataAsOf);
    console.log(`[AlbertaRVDScraper] Parsed ${summaryEntries.length} respiratory virus summary entries`);

    // === 3. Immunizations ===
    console.log('[AlbertaRVDScraper] Fetching immunizations page HTML...');
    const immResponse = await axios.get<string>(RVD_IMMUNIZATIONS_URL, {
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      responseType: 'text',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    const immHtml = immResponse.data;
    const immTraces = extractPlotlyData(immHtml);
    const immEntries = parseImmunizationTraces(immTraces, dataAsOf);
    console.log(`[AlbertaRVDScraper] Parsed ${immEntries.length} immunization entries`);

    if (parsed.length === 0 && summaryEntries.length === 0 && immEntries.length === 0) {
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
    const mergedSignals = parsed.length > 0 ? mergeWastewaterSignals(existingSignals, parsed) : existingSignals;

    const existingCaseCounts = Array.isArray(existing.RVD_RESPIRATORY_CASE_COUNTS)
      ? existing.RVD_RESPIRATORY_CASE_COUNTS
      : [];
    const existingImmDoses = Array.isArray(existing.RVD_IMMUNIZATION_DOSES)
      ? existing.RVD_IMMUNIZATION_DOSES
      : [];

    const output: Record<string, unknown> = { ...existing };
    if (parsed.length > 0) {
      output.WASTEWATER_SIGNALS = mergedSignals;
    }
    if (summaryEntries.length > 0) {
      output.RVD_RESPIRATORY_CASE_COUNTS = summaryEntries;
    }
    if (immEntries.length > 0) {
      output.RVD_IMMUNIZATION_DOSES = immEntries;
    }

    const existingMeta = isRecord(existing._dataMetadata)
      ? (existing._dataMetadata as DataMetadata)
      : undefined;
    const ownedMetadata: DataMetadata = {};
    const contentChangedKeys: string[] = [];

    const wwContentChanged =
      parsed.length > 0 && JSON.stringify(mergedSignals) !== JSON.stringify(existingSignals);
    if (parsed.length > 0) {
      const prior = existingMeta?.WASTEWATER_SIGNALS;
      ownedMetadata.WASTEWATER_SIGNALS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard wastewater',
        sourceVintage: deriveWastewaterSourceVintage(mergedSignals),
        lastUpdated: timestamp,
        previous: prior,
        contentChanged: wwContentChanged,
      });
      if (wwContentChanged) contentChangedKeys.push('WASTEWATER_SIGNALS');
    }

    const caseCountsContentChanged =
      summaryEntries.length > 0 && JSON.stringify(summaryEntries) !== JSON.stringify(existingCaseCounts);
    if (summaryEntries.length > 0) {
      const prior = existingMeta?.RVD_RESPIRATORY_CASE_COUNTS;
      ownedMetadata.RVD_RESPIRATORY_CASE_COUNTS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard summary',
        sourceVintage: deriveDateRange(summaryEntries.map((e) => e.weekEnding)),
        lastUpdated: timestamp,
        previous: prior,
        contentChanged: caseCountsContentChanged,
      });
      if (caseCountsContentChanged) contentChangedKeys.push('RVD_RESPIRATORY_CASE_COUNTS');
    }

    const immContentChanged =
      immEntries.length > 0 && JSON.stringify(immEntries) !== JSON.stringify(existingImmDoses);
    if (immEntries.length > 0) {
      const prior = existingMeta?.RVD_IMMUNIZATION_DOSES;
      ownedMetadata.RVD_IMMUNIZATION_DOSES = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard immunizations',
        sourceVintage: deriveImmunizationSourceVintage(immEntries),
        lastUpdated: timestamp,
        previous: prior,
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

    const totalFetched = parsed.length + summaryEntries.length + immEntries.length;
    const totalWritten =
      (wwContentChanged ? mergedSignals.length : 0) +
      (caseCountsContentChanged ? summaryEntries.length : 0) +
      (immContentChanged ? immEntries.length : 0);
    console.log(
      `[AlbertaRVDScraper] Complete. fetched=${totalFetched} written=${totalWritten} (new wastewater: ${mergedSignals.length - existingSignals.length}) in ${Date.now() - startTime}ms`,
    );
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
