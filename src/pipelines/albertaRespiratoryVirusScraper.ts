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
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';
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

// Population estimates for wastewater sites
const SITE_POPULATION: Record<string, number> = {
  'Edmonton': 1100000,
  'Fort Saskatchewan': 27000,
  'Fort McMurray': 76000,
  'Grande Prairie': 70000,
  'Red Deer': 110000,
  'Calgary': 1500000,
  'Medicine Hat': 65000,
  'Lethbridge': 110000,
  'Jasper': 5000,
  'Banff': 8000,
};

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

    // Get latest value
    const latestIdx = y.length - 1;
    const latestValue = typeof y[latestIdx] === 'number' ? (y[latestIdx] as number) : 0;
    const latestDate = typeof x[latestIdx] === 'string' ? (x[latestIdx] as string) : '';

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

// Map parsed signals to existing WastewaterSignal entries by site name
function mergeWastewaterSignals(
  existing: WastewaterSignal[],
  parsed: ParsedSignal[],
): WastewaterSignal[] {
  const merged = [...existing];
  const usedParsed = new Set<number>();

  // Match by site name (case-insensitive partial match)
  for (let i = 0; i < merged.length; i++) {
    const existingSite = merged[i].site.toLowerCase();
    for (let j = 0; j < parsed.length; j++) {
      if (usedParsed.has(j)) continue;
      const parsedSite = parsed[j].site.toLowerCase();
      // Match if one contains the other
      if (existingSite.includes(parsedSite) || parsedSite.includes(existingSite)) {
        merged[i] = {
          ...merged[i],
          covidSignal: parsed[j].covidSignal,
          trend: parsed[j].trend,
          activityLevel: parsed[j].activityLevel,
        };
        usedParsed.add(j);
        break;
      }
    }
  }

  // Add any parsed signals that didn't match existing entries
  for (let j = 0; j < parsed.length; j++) {
    if (usedParsed.has(j)) continue;
    const zone = SITE_TO_ZONE[parsed[j].site] ?? 'North Zone';
    const pop = SITE_POPULATION[parsed[j].site] ?? 50000;
    merged.push({
      site: parsed[j].site,
      zone,
      populationServed: pop,
      covidSignal: parsed[j].covidSignal,
      fluASignal: 0,
      rsvSignal: 0,
      activityLevel: parsed[j].activityLevel,
      trend: parsed[j].trend,
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

// Parse summary page traces (respiratory virus case counts by type)
function parseSummaryTraces(traces: unknown[]): RespiratoryVirusEntry[] {
  const entries: RespiratoryVirusEntry[] = [];
  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const virus = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!virus) continue;
    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y)) continue;
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const weekEnding = typeof x[i] === 'string' ? (x[i] as string) : '';
      const count = typeof y[i] === 'number' ? (y[i] as number) : null;
      if (weekEnding && count !== null) {
        entries.push({ virus, weekEnding, count });
      }
    }
  }
  return entries;
}

function parseImmunizationTraces(traces: unknown[]): ImmunizationEntry[] {
  const entries: ImmunizationEntry[] = [];
  for (const trace of traces) {
    if (!isRecord(trace)) continue;
    const season = typeof trace['name'] === 'string' ? trace['name'] : '';
    if (!season) continue;
    const x = trace['x'];
    const y = trace['y'];
    if (!Array.isArray(x) || !Array.isArray(y)) continue;
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const weekEnding = typeof x[i] === 'string' ? (x[i] as string) : '';
      const doses = typeof y[i] === 'number' ? (y[i] as number) : null;
      if (weekEnding && doses !== null) {
        entries.push({ season, weekEnding, doses });
      }
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
    const summaryEntries = parseSummaryTraces(sumTraces);
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
    const immEntries = parseImmunizationTraces(immTraces);
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
    const existingSignals = Array.isArray(existing.WASTEWATER_SIGNALS)
      ? (existing.WASTEWATER_SIGNALS as WastewaterSignal[])
      : [];
    const mergedSignals = parsed.length > 0 ? mergeWastewaterSignals(existingSignals, parsed) : existingSignals;
    const newCount = mergedSignals.length - existingSignals.length;

    const output: Record<string, unknown> = {
      ...existing,
      WASTEWATER_SIGNALS: mergedSignals,
    };
    if (summaryEntries.length > 0) {
      output.RVD_RESPIRATORY_CASE_COUNTS = summaryEntries;
    }
    if (immEntries.length > 0) {
      output.RVD_IMMUNIZATION_DOSES = immEntries;
    }

    // Stamp _dataMetadata for the arrays this scraper refreshes; preserve
    // hand-authored entries (RESPIRATORY_VIRUS_SURVEILLANCE, immunization
    // coverage, notifiable disease, advisories, outbreak protocols) via merge.
    const existingMeta = isRecord(existing._dataMetadata)
      ? (existing._dataMetadata as DataMetadata)
      : undefined;
    const ownedMetadata: DataMetadata = {};
    if (parsed.length > 0) {
      ownedMetadata.WASTEWATER_SIGNALS = buildMetadataEntry({
        updateType: 'auto',
        source: 'PHAC Health Infobase wastewater API + Alberta RVD',
        sourceVintage: 'Live weekly wastewater signals',
        lastUpdated: timestamp,
      });
    }
    if (summaryEntries.length > 0) {
      ownedMetadata.RVD_RESPIRATORY_CASE_COUNTS = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard summary',
        sourceVintage: deriveDateRange(summaryEntries.map((e) => e.weekEnding)),
        lastUpdated: timestamp,
      });
    }
    if (immEntries.length > 0) {
      ownedMetadata.RVD_IMMUNIZATION_DOSES = buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Respiratory Virus Dashboard immunizations',
        sourceVintage: deriveDateRange(immEntries.map((e) => e.weekEnding)),
        lastUpdated: timestamp,
      });
    }
    // Keep seasonal curated table's last scrape aligned with RVD run time when present.
    const seasonalExisting = existingMeta?.RESPIRATORY_VIRUS_SURVEILLANCE;
    if (seasonalExisting && (summaryEntries.length > 0 || immEntries.length > 0 || parsed.length > 0)) {
      ownedMetadata.RESPIRATORY_VIRUS_SURVEILLANCE = {
        ...seasonalExisting,
        lastUpdated: timestamp,
      };
    }
    output._dataMetadata = mergeDataMetadata(existingMeta, ownedMetadata);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');

    const totalFetched = parsed.length + summaryEntries.length + immEntries.length;
    const totalWritten = mergedSignals.length + summaryEntries.length + immEntries.length;
    console.log(
      `[AlbertaRVDScraper] Complete. fetched=${totalFetched} written=${totalWritten} (new wastewater: ${newCount}) in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'public-health',
      pipeline: 'albertaRespiratoryVirusScraper',
      status: 'success',
      recordsFetched: totalFetched,
      recordsWritten: totalWritten,
      durationMs: Date.now() - startTime,
      timestamp,
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
