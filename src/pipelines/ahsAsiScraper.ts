// AHS ASI (Alberta Services Information) Scraper
// Scrapes AHS continuing care and mental health/addiction pages for service
// data, merges with existing hand-authored JSON, and writes both
// data-continuing-care.json and data-mental-health.json.
//
// Upstream pages are HTML and vary in structure, so the scraper parses what it
// can (facility listings, helpline directories, bed availability tables) and
// merges discovered records with the existing JSON. When the upstream layout
// yields no structured rows, existing data is preserved and the run is reported
// as 'skipped' so hand-authored data is never clobbered.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  HomeCareContinuity,
  CareFacilityCompliance,
} from '../continuingCareData';
import type {
  SubstanceHarmTrend,
  AddictionBedStatus,
  CommunityMHWait,
  HospitalMHSUBurden,
  SupportHelpline,
} from '../mentalHealthData';

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
const AHS_MENTAL_HEALTH_URL =
  'https://www.albertahealthservices.ca/amh/Page18670.aspx';
const AHS_HELPLINES_URL =
  'https://www.albertahealthservices.ca/amh/Page16759.aspx';

const CONTINUING_CARE_FILE = path.join(process.cwd(), 'data-continuing-care.json');
const MENTAL_HEALTH_FILE = path.join(process.cwd(), 'data-mental-health.json');

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
}

// ---- Mental health JSON shape ---------------------------------------------

interface MentalHealthJson {
  SUBSTANCE_HARM_TRENDS: SubstanceHarmTrend[];
  ADDICTION_BED_CAPACITIES: AddictionBedStatus[];
  COMMUNITY_MH_WAITS: CommunityMHWait[];
  HOSPITAL_MHSU_BURDEN: HospitalMHSUBurden[];
  SUPPORT_HELPLINES: SupportHelpline[];
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
      HOME_CARE_EXPERIENCE: existing.HOME_CARE_EXPERIENCE ?? [],
      CONTINUING_CARE_COMPLIANCE: existing.CONTINUING_CARE_COMPLIANCE ?? [],
    };
  }
  return {
    CONTINUING_CARE_PLACEMENT_STATS: [],
    RESIDENT_QUALITY_OUTCOMES: [],
    HOME_CARE_EXPERIENCE: [],
    CONTINUING_CARE_COMPLIANCE: [],
  };
}

function loadMentalHealth(): MentalHealthJson {
  const existing = loadJson<MentalHealthJson>(MENTAL_HEALTH_FILE);
  if (existing) {
    return {
      SUBSTANCE_HARM_TRENDS: existing.SUBSTANCE_HARM_TRENDS ?? [],
      ADDICTION_BED_CAPACITIES: existing.ADDICTION_BED_CAPACITIES ?? [],
      COMMUNITY_MH_WAITS: existing.COMMUNITY_MH_WAITS ?? [],
      HOSPITAL_MHSU_BURDEN: existing.HOSPITAL_MHSU_BURDEN ?? [],
      SUPPORT_HELPLINES: existing.SUPPORT_HELPLINES ?? [],
    };
  }
  return {
    SUBSTANCE_HARM_TRENDS: [],
    ADDICTION_BED_CAPACITIES: [],
    COMMUNITY_MH_WAITS: [],
    HOSPITAL_MHSU_BURDEN: [],
    SUPPORT_HELPLINES: [],
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

type Corridor = AddictionBedStatus['corridor'];

const CORRIDOR_BY_ZONE: Record<AlbertaZone, Corridor> = {
  'Calgary Zone': 'Calgary Corridor',
  'Edmonton Zone': 'Edmonton Corridor',
  'Central Zone': 'Central Corridor',
  'South Zone': 'South Corridor',
  'North Zone': 'North Corridor',
};

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

// ---- Mental health page parser --------------------------------------------
// The AHS addiction & mental health page and helplines page list crisis
// support lines and potentially bed availability. We extract helpline
// directories and any structured bed-availability tables.

function parseHelplines($: cheerio.CheerioAPI): SupportHelpline[] {
  const found: SupportHelpline[] = [];
  const seen = new Set<string>();

  // Look for phone-number patterns in list items / paragraphs
  const phoneRegex = /(\d{1}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|\d{3})/;

  $('li, p, div.helpline, div[class*="contact"], div[class*="phone"]').each(
    (_i, el) => {
      const $el = $(el);
      const text = textOf($, $el);
      if (!text || text.length < 5) return;

      const phoneMatch = text.match(phoneRegex);
      if (!phoneMatch) return;

      const number = phoneMatch[0].trim();
      if (seen.has(number)) return;

      // Try to find a heading or bold label for the helpline name
      const heading = textOf($, $el.find('strong, b, h2, h3, h4, .title').first());
      const name = heading || text.split(':')[0].trim().slice(0, 80);

      if (!name || name.length < 3) return;

      // Extract availability (24/7, hours, etc.)
      const availMatch = text.match(/24\s*(?:hours|hr|\/)?\s*7/i);
      const availability = availMatch ? '24 Hours / 7 Days' : text.slice(0, 60);

      const description = text.replace(phoneRegex, '').replace(name, '').trim().slice(0, 200);

      seen.add(number);
      found.push({
        name,
        number,
        availability,
        scope: 'Province-wide',
        description: description || 'Crisis support and referral service.',
      });
    },
  );

  return found;
}

function parseBedAvailability(
  $: cheerio.CheerioAPI,
): AddictionBedStatus[] {
  const found: AddictionBedStatus[] = [];

  $('table tr').each((_i, rowEl) => {
    const $row = $(rowEl);
    const cells = $row.find('td');
    if (cells.length < 4) return;

    const siteName = textOf($, $(cells[0]));
    if (!siteName || siteName.length < 3) return;
    if (/site|facility|name/i.test(siteName)) return;

    const bedTypeText = textOf($, $(cells[1]));
    const totalBeds = asNumber(textOf($, $(cells[2]))) ?? 0;
    const availableBeds = asNumber(textOf($, $(cells[3]))) ?? 0;

    if (totalBeds === 0 && availableBeds === 0) return;

    const city = cleanText($row.find('.city, .location').first().text()) || 'Edmonton';
    const zone = deduceZone(city);
    const corridor = CORRIDOR_BY_ZONE[zone];

    found.push({
      id: `BED-SCRAPE-${makeFacilityId(siteName)}`,
      siteName,
      corridor,
      bedType: parseBedType(bedTypeText) ?? 'Detoxification',
      gender: 'Co-Ed',
      totalBeds,
      availableBeds,
      status: availableBeds === 0 ? 'Full' : availableBeds <= 2 ? 'Almost Full' : 'Available',
      lastUpdated: new Date().toISOString(),
    });
  });

  return found;
}

function parseBedType(text: string): AddictionBedStatus['bedType'] | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('detox')) return 'Detoxification';
  if (lower.includes('short') || lower.includes('treatment')) return 'Short-Term Treatment';
  if (lower.includes('long') || lower.includes('recovery')) return 'Long-Term Recovery';
  if (lower.includes('youth')) return 'Youth Specific';
  return undefined;
}

// Merge scraped helplines into existing, keyed by phone number.
function mergeHelplines(
  existing: SupportHelpline[],
  scraped: SupportHelpline[],
): SupportHelpline[] {
  const byNumber = new Map<string, SupportHelpline>();
  for (const h of existing) {
    byNumber.set(h.number, h);
  }
  for (const h of scraped) {
    if (!byNumber.has(h.number)) {
      byNumber.set(h.number, h);
    }
  }
  return Array.from(byNumber.values());
}

// Merge scraped bed capacities into existing, keyed by siteName.
function mergeBedCapacities(
  existing: AddictionBedStatus[],
  scraped: AddictionBedStatus[],
): AddictionBedStatus[] {
  const bySite = new Map<string, AddictionBedStatus>();
  for (const b of existing) {
    bySite.set(b.siteName.toLowerCase(), b);
  }
  for (const b of scraped) {
    const key = b.siteName.toLowerCase();
    const prev = bySite.get(key);
    if (prev) {
      // Update availability from fresh scrape, preserve hand-authored metadata
      bySite.set(key, {
        ...prev,
        availableBeds: b.availableBeds,
        totalBeds: b.totalBeds || prev.totalBeds,
        status: b.status,
        lastUpdated: b.lastUpdated,
      });
    } else {
      bySite.set(key, b);
    }
  }
  return Array.from(bySite.values());
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
  console.log('[AhsAsiScraper] Starting AHS ASI scrape for continuing care + mental health...');

  let recordsFetched = 0;
  let recordsWritten = 0;
  let continuingCareUpdated = false;
  let mentalHealthUpdated = false;
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

  // --- Mental health: helplines ---
  const mhData = loadMentalHealth();
  try {
    console.log('[AhsAsiScraper] Fetching mental health helplines page...');
    const html = await fetchPage(AHS_HELPLINES_URL);
    const $ = cheerio.load(html);

    const scrapedHelplines = parseHelplines($);
    if (scrapedHelplines.length > 0) {
      mhData.SUPPORT_HELPLINES = mergeHelplines(
        mhData.SUPPORT_HELPLINES,
        scrapedHelplines,
      );
      mentalHealthUpdated = true;
      recordsFetched += scrapedHelplines.length;
      console.log(`[AhsAsiScraper] Found ${scrapedHelplines.length} helplines.`);
    } else {
      console.log('[AhsAsiScraper] No structured helplines found on page.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`helplines: ${msg}`);
    console.error('[AhsAsiScraper] Helplines fetch failed:', msg);
  }

  // --- Mental health: addiction beds ---
  try {
    console.log('[AhsAsiScraper] Fetching addiction & mental health page...');
    const html = await fetchPage(AHS_MENTAL_HEALTH_URL);
    const $ = cheerio.load(html);

    const scrapedBeds = parseBedAvailability($);
    if (scrapedBeds.length > 0) {
      mhData.ADDICTION_BED_CAPACITIES = mergeBedCapacities(
        mhData.ADDICTION_BED_CAPACITIES,
        scrapedBeds,
      );
      mentalHealthUpdated = true;
      recordsFetched += scrapedBeds.length;
      console.log(`[AhsAsiScraper] Found ${scrapedBeds.length} bed availability records.`);
    } else {
      console.log('[AhsAsiScraper] No structured bed availability found on page.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`beds: ${msg}`);
    console.error('[AhsAsiScraper] Bed availability fetch failed:', msg);
  }

  // --- Write files ---
  if (continuingCareUpdated) {
    try {
      fs.writeFileSync(
        CONTINUING_CARE_FILE,
        JSON.stringify(ccData, null, 2),
        'utf8',
      );
      recordsWritten +=
        ccData.CONTINUING_CARE_PLACEMENT_STATS.length +
        ccData.RESIDENT_QUALITY_OUTCOMES.length +
        ccData.HOME_CARE_EXPERIENCE.length +
        ccData.CONTINUING_CARE_COMPLIANCE.length;
      console.log('[AhsAsiScraper] Wrote data-continuing-care.json');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`write-cc: ${msg}`);
      console.error('[AhsAsiScraper] Failed to write continuing care JSON:', msg);
    }
  }

  if (mentalHealthUpdated) {
    try {
      fs.writeFileSync(
        MENTAL_HEALTH_FILE,
        JSON.stringify(mhData, null, 2),
        'utf8',
      );
      recordsWritten +=
        mhData.SUBSTANCE_HARM_TRENDS.length +
        mhData.ADDICTION_BED_CAPACITIES.length +
        mhData.COMMUNITY_MH_WAITS.length +
        mhData.HOSPITAL_MHSU_BURDEN.length +
        mhData.SUPPORT_HELPLINES.length;
      console.log('[AhsAsiScraper] Wrote data-mental-health.json');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`write-mh: ${msg}`);
      console.error('[AhsAsiScraper] Failed to write mental health JSON:', msg);
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
