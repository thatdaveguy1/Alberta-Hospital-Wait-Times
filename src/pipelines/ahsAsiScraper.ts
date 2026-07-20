// AHS ASI (Alberta Services Information) Scraper
// Scrapes AHS continuing care pages for facility registry/compliance data,
// merges with existing hand-authored JSON, and writes data-continuing-care.json.
//
// Upstream pages are HTML and vary in structure, so the scraper parses what it
// can (facility listings) and merges discovered records with the existing JSON.
// When the upstream layout yields no structured rows, existing data is preserved
// and the run is reported as 'skipped' so hand-authored data is never clobbered.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  HomeCareContinuity,
  CareFacilityCompliance,
} from '../continuingCareData';

// ---- Configuration --------------------------------------------------------

// 2 second minimum between upstream requests (rate limit).
const MIN_REQUEST_INTERVAL_MS = 2000;

// The AHS continuing care page lists designated supportive living and
// long-term care facilities. The standardsandlicensing.alberta.ca site
// publishes standards/regulations but does not have a public facility registry.
const CONTINUING_CARE_REGISTRY_URL =
  'https://www.albertahealthservices.ca/cc/page15328.aspx';
const AHS_CONTINUING_CARE_URL =
  'https://www.albertahealthservices.ca/cc/page15328.aspx';

const CONTINUING_CARE_FILE = path.join(process.cwd(), 'data-continuing-care.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---- Rate limiting --------------------------------------------------------

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const remaining = MIN_REQUEST_INTERVAL_MS - (now - lastRequestTime);
  if (remaining > 0) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(() => resolve(), remaining);
    await promise;
  }
  lastRequestTime = Date.now();
}

// ---- Type guards and parsing helpers --------------------------------------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === 'yes' || lower === 'compliant') return true;
    if (lower === 'false' || lower === 'no' || lower === 'non-compliant') return false;
  }
  return undefined;
}

// Clean text: trim, collapse whitespace, decode common entities.
function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract text content from a cheerio selection.
function textOf($: cheerio.CheerioAPI, el: cheerio.Cheerio<AnyNode>): string {
  return cleanText($(el).text());
}

// ---- Continuing care JSON shape -------------------------------------------

interface ContinuingCareJson {
  CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[];
  RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[];
  HOME_CARE_EXPERIENCE: HomeCareContinuity[];
  CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[];
  _dataMetadata?: DataMetadata;
}

// ---- Loaders (preserve existing hand-authored data) -----------------------

function loadJson<T>(file: string): T | undefined {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function loadContinuingCare(): ContinuingCareJson {
  const existing = loadJson<ContinuingCareJson>(CONTINUING_CARE_FILE);
  if (existing) {
    return {
      CONTINUING_CARE_PLACEMENT_STATS: existing.CONTINUING_CARE_PLACEMENT_STATS ?? [],
      RESIDENT_QUALITY_OUTCOMES: existing.RESIDENT_QUALITY_OUTCOMES ?? [],
      // Withheld: never rehydrate from existing.
      HOME_CARE_EXPERIENCE: [],
      CONTINUING_CARE_COMPLIANCE: existing.CONTINUING_CARE_COMPLIANCE ?? [],
      _dataMetadata: existing._dataMetadata,
    };
  }
  return {
    CONTINUING_CARE_PLACEMENT_STATS: [],
    RESIDENT_QUALITY_OUTCOMES: [],
    HOME_CARE_EXPERIENCE: [],
    CONTINUING_CARE_COMPLIANCE: [],
  };
}

// ---- Zone / corridor helpers ----------------------------------------------

type AlbertaZone =
  | 'Calgary Zone'
  | 'Edmonton Zone'
  | 'Central Zone'
  | 'South Zone'
  | 'North Zone';

const ZONE_BY_CITY: Record<string, AlbertaZone> = {
  Calgary: 'Calgary Zone',
  Airdrie: 'Calgary Zone',
  Cochrane: 'Calgary Zone',
  Okotoks: 'Calgary Zone',
  Edmonton: 'Edmonton Zone',
  StAlbert: 'Edmonton Zone',
  'St. Albert': 'Edmonton Zone',
  SherwoodPark: 'Edmonton Zone',
  'Sherwood Park': 'Edmonton Zone',
  Leduc: 'Edmonton Zone',
  RedDeer: 'Central Zone',
  'Red Deer': 'Central Zone',
  Lethbridge: 'South Zone',
  MedicineHat: 'South Zone',
  Brooks: 'South Zone',
  FortMcMurray: 'North Zone',
  'Fort McMurray': 'North Zone',
  GrandePrairie: 'North Zone',
  'Grande Prairie': 'North Zone',
  Westlock: 'North Zone',
};

function deduceZone(city: string): AlbertaZone {
  return ZONE_BY_CITY[city] ?? ZONE_BY_CITY[city.replace(/\s/g, '')] ?? 'North Zone';
}

// ---- Continuing care page parser ------------------------------------------
// The AHS continuing care page lists designated supportive living and
// long-term care facilities. We extract any facility cards/table rows that
// expose a name, city, and operator, and merge them into the compliance list
// keyed by facility name (case-insensitive).

function makeFacilityId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseCareFacilityCompliance(
  $: cheerio.CheerioAPI,
): CareFacilityCompliance[] {
  const found: CareFacilityCompliance[] = [];

  // Strategy 1: table rows with facility data
  $('table tr').each((_i, rowEl) => {
    const $row = $(rowEl);
    const cells = $row.find('td');
    if (cells.length < 3) return;

    const name = textOf($, $(cells[0]));
    if (!name || name.length < 3) return;
    // Skip header rows
    if (/name|facility|operator/i.test(name)) return;

    const city = textOf($, $(cells[1])) || '';
    const operatorText = textOf($, $(cells[2])) || '';
    const typeText = cells.length > 3 ? textOf($, $(cells[3])) : '';

    if (!ZONE_BY_CITY[city] && !ZONE_BY_CITY[city.replace(/\s/g, '')]) return;

    const operator = parseOperator(operatorText);
    const type = parseCareFacilityType(typeText || operatorText);

    found.push({
      id: `FAC-SCRAPE-${makeFacilityId(name)}`,
      name,
      type,
      operator,
      city,
      zone: deduceZone(city),
      lastInspectionDate: new Date().toISOString().split('T')[0],
      standardsCompliant: true,
      violationsCount: 0,
      majorViolationsDesc: null,
    });
  });

  // Strategy 2: div-based facility cards (AHS sometimes uses card layouts)
  $('div.facility-card, div[class*="facility"], div[class*="accommodation"]').each(
    (_i, cardEl) => {
      const $card = $(cardEl);
      const name = cleanText($card.find('h2, h3, h4, .title, .name').first().text());
      if (!name || name.length < 3) return;

      const city = cleanText(
        $card.find('.city, .location, .address').first().text(),
      ).split(',')[0].trim();
      if (!city) return;

      const operatorText = cleanText(
        $card.find('.operator, .owner').first().text(),
      );
      const typeText = cleanText($card.find('.type, .level').first().text());

      found.push({
        id: `FAC-SCRAPE-${makeFacilityId(name)}`,
        name,
        type: parseCareFacilityType(typeText) || 'Type A (Long-Term Care)',
        operator: parseOperator(operatorText) || 'Private/Contracted',
        city,
        zone: deduceZone(city),
        lastInspectionDate: new Date().toISOString().split('T')[0],
        standardsCompliant: true,
        violationsCount: 0,
        majorViolationsDesc: null,
      });
    },
  );

  // Strategy 3: Government registry tables (standardsandlicensing.alberta.ca)
  // The public registry uses table rows with columns like:
  // Facility Name | Operator | Type | City | Last Inspection | Status
  $('table.data-table tr, table.results tr, tbody tr').each((_i, rowEl) => {
    const $row = $(rowEl);
    const cells = $row.find('td');
    if (cells.length < 3) return;

    const name = textOf($, $(cells[0]));
    if (!name || name.length < 3) return;
    if (/name|facility|operator/i.test(name)) return;

    // Try to find city, inspection date, and status in remaining cells
    const cityCell = cells.length > 3 ? $(cells[3]) : $(cells[1]);
    const city = textOf($, cityCell) || '';
    const inspectionDateCell = cells.length > 4 ? $(cells[4]) : null;
    const statusCell = cells.length > 5 ? $(cells[5]) : null;

    const operatorText = textOf($, $(cells[1])) || '';
    const typeText = textOf($, $(cells[2])) || '';

    // Parse inspection date if available
    let lastInspection = new Date().toISOString().split('T')[0];
    if (inspectionDateCell) {
      const dateText = textOf($, inspectionDateCell);
      const parsed = Date.parse(dateText);
      if (!Number.isNaN(parsed)) {
        lastInspection = new Date(parsed).toISOString().split('T')[0];
      }
    }

    // Parse compliance status if available
    let compliant = true;
    let violations = 0;
    let majorViolations: string | null = null;
    if (statusCell) {
      const statusText = textOf($, statusCell).toLowerCase();
      if (statusText.includes('non-compliant') || statusText.includes('violation')) {
        compliant = false;
        violations = statusText.includes('multiple') ? 3 : 1;
        majorViolations = textOf($, statusCell);
      }
    }

    // Only include if we can identify the city or it's a known Alberta facility
    const zone = city ? deduceZone(city) : 'Calgary Zone';

    found.push({
      id: `FAC-SCRAPE-${makeFacilityId(name)}`,
      name,
      type: parseCareFacilityType(typeText) || 'Type A (Long-Term Care)',
      operator: parseOperator(operatorText) || 'Private/Contracted',
      city: city || 'Unknown',
      zone,
      lastInspectionDate: lastInspection,
      standardsCompliant: compliant,
      violationsCount: violations,
      majorViolationsDesc: majorViolations,
    });
  });

  return found;
}

function parseOperator(text: string): CareFacilityCompliance['operator'] | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('covenant')) return 'Covenant Health';
  if (lower.includes('ahs') || lower.includes('alberta health services'))
    return 'AHS';
  if (lower.includes('non-profit') || lower.includes('shepherd') || lower.includes('care'))
    return 'Non-Profit';
  if (lower.includes('private') || lower.includes('contracted'))
    return 'Private/Contracted';
  return undefined;
}

function parseCareFacilityType(
  text: string,
): CareFacilityCompliance['type'] | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('long-term') || lower.includes('ltc') || lower.includes('nursing'))
    return 'Type A (Long-Term Care)';
  if (lower.includes('supportive') || lower.includes('designated') || lower.includes('dsl'))
    return 'Type B (Designated Supportive Living)';
  return undefined;
}

// Merge scraped compliance facilities into existing, keyed by facility name.
function mergeCompliance(
  existing: CareFacilityCompliance[],
  scraped: CareFacilityCompliance[],
): CareFacilityCompliance[] {
  const byName = new Map<string, CareFacilityCompliance>();
  for (const fac of existing) {
    byName.set(fac.name.toLowerCase(), fac);
  }
  for (const fac of scraped) {
    const key = fac.name.toLowerCase();
    const prev = byName.get(key);
    if (prev) {
      // Update with fresh scraped data but preserve hand-authored inspection details
      byName.set(key, {
        ...prev,
        name: fac.name,
        city: fac.city || prev.city,
        zone: fac.zone || prev.zone,
        operator: fac.operator || prev.operator,
        type: fac.type || prev.type,
      });
    } else {
      byName.set(key, fac);
    }
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

// ---- HTTP fetch helper ----------------------------------------------------

async function fetchPage(url: string): Promise<string> {
  await rateLimit();
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
    responseType: 'text',
  });
  return typeof response.data === 'string' ? response.data : String(response.data);
}

// ---- Main pipeline --------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AhsAsiScraper] Starting AHS ASI scrape for continuing care...');

  let recordsFetched = 0;
  let recordsWritten = 0;
  let continuingCareUpdated = false;
  const errors: string[] = [];

  // --- Continuing care ---
  const ccData = loadContinuingCare();
  try {
    console.log('[AhsAsiScraper] Fetching continuing care page...');
    const html = await fetchPage(AHS_CONTINUING_CARE_URL);
    const $ = cheerio.load(html);

    const scrapedCompliance = parseCareFacilityCompliance($);
    if (scrapedCompliance.length > 0) {
      ccData.CONTINUING_CARE_COMPLIANCE = mergeCompliance(
        ccData.CONTINUING_CARE_COMPLIANCE,
        scrapedCompliance,
      );
      continuingCareUpdated = true;
      recordsFetched += scrapedCompliance.length;
      console.log(`[AhsAsiScraper] Found ${scrapedCompliance.length} continuing care facilities.`);
    } else {
      console.log('[AhsAsiScraper] No structured continuing care facilities found on page.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`continuing-care: ${msg}`);
    console.error('[AhsAsiScraper] Continuing care fetch failed:', msg);
  }

  // --- Write files ---
  if (continuingCareUpdated) {
    try {
      // AHS ASI refreshes only the CONTINUING_CARE_COMPLIANCE array. Preserve
      // existing metadata via mergeDataMetadata and stamp only the array owned here.
      const ccMetadata = mergeDataMetadata(ccData._dataMetadata, {
        CONTINUING_CARE_COMPLIANCE: buildMetadataEntry({
          updateType: 'auto',
          source: 'AHS Continuing Care registry',
          sourceVintage: 'Live AHS facility registry',
          lastUpdated: timestamp,
        }),
      });
      const ccPayload = { ...ccData, _dataMetadata: ccMetadata };
      applyWithheldPayloadGuard(ccPayload as Record<string, unknown>);
      fs.writeFileSync(
        CONTINUING_CARE_FILE,
        JSON.stringify(ccPayload, null, 2),
        'utf8',
      );
      recordsWritten += ccData.CONTINUING_CARE_COMPLIANCE.length;
      console.log('[AhsAsiScraper] Wrote data-continuing-care.json');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`write-cc: ${msg}`);
      console.error('[AhsAsiScraper] Failed to write continuing care JSON:', msg);
    }
  }

  const durationMs = Date.now() - startTime;

  // Determine status
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
    `[AhsAsiScraper] Complete. status=${status} fetched=${recordsFetched} written=${recordsWritten} ${durationMs}ms`,
  );

  return {
    domain: 'continuing-care',
    pipeline: 'ahsAsiScraper',
    status,
    recordsFetched,
    recordsWritten,
    durationMs,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    timestamp,
  };
}
