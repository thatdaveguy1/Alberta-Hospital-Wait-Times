// AHS Cancer Centres Scraper — Alberta cancer centre directory
// Scrapes the AHS "Cancer Centre Information" page (Page16313.aspx) for the
// full list of Alberta cancer centres, parses each centre's name, city, and
// type from the directory table, maps the city to its AHS zone, derives a
// service profile from the centre type, and merges the result into
// data-cancer.json as ALBERTA_CANCER_CENTRES while preserving all other
// cancer datasets (CANCER_BURDEN_STATS, CANCER_SCREENING_RATES,
// CANCER_SURGERY_WAIT_TRENDS, RADIATION_THERAPY_WAIT_TRENDS).
//
// The AHS directory page lists 17 cancer centres in a single HTML table. Each
// row bundles the centre name, a "Location: <city>" tag, and a "Type:
// <Tertiary|Regional|Community>" tag in one description cell. The page does
// not publish street addresses, coordinates, or per-centre service lists, so
// for centres already present in data-cancer.json we preserve the curated
// address, coordinates, services, and therapy flags; for newly discovered
// centres we derive a service profile from the type and leave address/coords
// empty until a curator fills them in.

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type {
  CancerCentreLocation,
  CancerBurdenItem,
  CancerScreeningZoneRate,
  CancerSurgeryWaitTrend,
  RadiationTherapyCompliance,
} from '../cancerData';

const AHS_CANCER_CENTRES_URL =
  'https://www.albertahealthservices.ca/cancer/Page16313.aspx';
const CANCER_FILE = path.join(process.cwd(), 'data-cancer.json');
const RATE_LIMIT_MS = 2000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type CentreType = CancerCentreLocation['type'];
type Zone = CancerCentreLocation['zone'];

// AHS directory "Type" tag → canonical centre type label.
const TYPE_BY_TAG: Record<string, CentreType> = {
  Tertiary: 'Tertiary Cancer Centre',
  Regional: 'Regional Cancer Centre',
  Community: 'Community Cancer Centre',
};

// City → AHS zone mapping. AHS divides the province into five operational
// zones; this lookup assigns each centre city to its zone based on AHS
// facility catchments.
const CITY_TO_ZONE: Record<string, Zone> = {
  Calgary: 'Calgary Zone',
  'High River': 'Calgary Zone',
  Canmore: 'Calgary Zone',
  Edmonton: 'Edmonton Zone',
  Barrhead: 'Edmonton Zone',
  'Drayton Valley': 'Edmonton Zone',
  'Red Deer': 'Central Zone',
  Camrose: 'Central Zone',
  Drumheller: 'Central Zone',
  Lloydminster: 'Central Zone',
  'Grande Prairie': 'North Zone',
  'Fort McMurray': 'North Zone',
  'Peace River': 'North Zone',
  Hinton: 'North Zone',
  Bonnyville: 'North Zone',
  Lethbridge: 'South Zone',
  'Medicine Hat': 'South Zone',
};

// Default service profile, therapy flags, and placeholder address/coords for
// a centre of a given type. Used only for centres not already present in
// data-cancer.json — existing curated records keep their own values.
const DEFAULT_SERVICES_BY_TYPE: Record<CentreType, string[]> = {
  'Tertiary Cancer Centre': [
    'Radiation Therapy',
    'Systemic Chemotherapy',
    'Surgical Oncology',
    'Central Clinical Trials',
    'Inpatient Cancer Beds',
  ],
  'Regional Cancer Centre': [
    'Linear Accelerator Radiation',
    'Outpatient Chemotherapy',
    'Cancer Navigation Support',
  ],
  'Community Cancer Centre': [
    'Local Chemotherapy Administration',
    'Tele-Oncology Reviews',
    'Cancer Navigation Support',
  ],
};

const DEFAULT_FLAGS_BY_TYPE: Record<
  CentreType,
  {
    systemicTherapyAvailable: boolean;
    radiationTherapyAvailable: boolean;
    surgicalOncologyAvailable: boolean;
  }
> = {
  'Tertiary Cancer Centre': {
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: true,
  },
  'Regional Cancer Centre': {
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: false,
  },
  'Community Cancer Centre': {
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: false,
    surgicalOncologyAvailable: false,
  },
};

interface CancerJson {
  CANCER_BURDEN_STATS: CancerBurdenItem[];
  CANCER_SCREENING_RATES: CancerScreeningZoneRate[];
  CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[];
  RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[];
  ALBERTA_CANCER_CENTRES: CancerCentreLocation[];
  // Preserved unknown keys (e.g. CIHI_CANCER_WAIT_TIMES, _dataMetadata) so
  // the read-modify-write cycle does not clobber sibling writers' data.
  [key: string]: unknown;
  _dataMetadata?: DataMetadata;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceCancerJson(raw: unknown): CancerJson {
  const base: CancerJson = {
    CANCER_BURDEN_STATS: [],
    CANCER_SCREENING_RATES: [],
    CANCER_SURGERY_WAIT_TRENDS: [],
    RADIATION_THERAPY_WAIT_TRENDS: [],
    ALBERTA_CANCER_CENTRES: [],
  };
  if (isRecord(raw)) {
    // Preserve every unknown key (e.g. CIHI_CANCER_WAIT_TIMES, _dataMetadata)
    // so sibling writers' data survives this read-modify-write cycle.
    for (const [key, value] of Object.entries(raw)) {
      if (!(key in base)) base[key] = value;
    }
    if (Array.isArray(raw.CANCER_BURDEN_STATS))
      base.CANCER_BURDEN_STATS = raw.CANCER_BURDEN_STATS as CancerBurdenItem[];
    if (Array.isArray(raw.CANCER_SCREENING_RATES))
      base.CANCER_SCREENING_RATES = raw.CANCER_SCREENING_RATES as CancerScreeningZoneRate[];
    if (Array.isArray(raw.CANCER_SURGERY_WAIT_TRENDS))
      base.CANCER_SURGERY_WAIT_TRENDS = raw.CANCER_SURGERY_WAIT_TRENDS as CancerSurgeryWaitTrend[];
    if (Array.isArray(raw.RADIATION_THERAPY_WAIT_TRENDS))
      base.RADIATION_THERAPY_WAIT_TRENDS = raw.RADIATION_THERAPY_WAIT_TRENDS as RadiationTherapyCompliance[];
    if (Array.isArray(raw.ALBERTA_CANCER_CENTRES))
      base.ALBERTA_CANCER_CENTRES = raw.ALBERTA_CANCER_CENTRES as CancerCentreLocation[];
  }
  return base;
}

function loadExistingCancerData(): CancerJson {
  try {
    const text = fs.readFileSync(CANCER_FILE, 'utf8');
    return coerceCancerJson(JSON.parse(text));
  } catch {
    return {
      CANCER_BURDEN_STATS: [],
      CANCER_SCREENING_RATES: [],
      CANCER_SURGERY_WAIT_TRENDS: [],
      RADIATION_THERAPY_WAIT_TRENDS: [],
      ALBERTA_CANCER_CENTRES: [],
    };
  }
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// Parse the AHS directory table. Each data row's first cell bundles the
// centre name followed by link labels ("Getting to Know Your Cancer Centre",
// "Location Details", ...) and then "Location: <city>" and "Type: <tag>".
// We pull the name from the first non-empty line and the city/type via regex.
function parseCancerCentres($: cheerio.CheerioAPI): CancerCentreLocation[] {
  const results: CancerCentreLocation[] = [];
  const usedIds = new Set<string>();

  // The directory renders a single table; skip the header row.
  $('table tr').each((_, row) => {
    const $row = $(row);
    const $cells = $row.find('td');
    if ($cells.length === 0) return; // header row

    const $descCell = $cells.first();
    const cellText = $descCell.text() ?? '';
    if (!cellText.includes('Location:') || !cellText.includes('Type:')) return;

    // The centre name is the leading text in the description cell, before
    // the first link label ("Getting to Know Your Cancer Centre"). The cell
    // bundles name + link labels + "Location:"/"Type:" tags as one text
    // blob, so we take the first non-empty trimmed line as the name.
    const nameText = cellText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';

    if (!nameText) return;

    const locMatch = cellText.match(/Location:\s*([^\n]+)/i);
    const typeMatch = cellText.match(/Type:\s*([^\n]+)/i);
    const city = (locMatch?.[1] ?? '').trim();
    const typeTag = (typeMatch?.[1] ?? '').trim();
    const type = TYPE_BY_TAG[typeTag];
    if (!city || !type) return;

    const zone = CITY_TO_ZONE[city];
    if (!zone) return;

    // Stable id: CC-### by scrape order.
    let seq = results.length + 1;
    let id = `CC-${String(seq).padStart(3, '0')}`;
    while (usedIds.has(id)) {
      seq += 1;
      id = `CC-${String(seq).padStart(3, '0')}`;
    }
    usedIds.add(id);

    const defaults = DEFAULT_FLAGS_BY_TYPE[type];
    results.push({
      id,
      name: nameText,
      type,
      city,
      zone,
      address: '',
      services: DEFAULT_SERVICES_BY_TYPE[type],
      systemicTherapyAvailable: defaults.systemicTherapyAvailable,
      radiationTherapyAvailable: defaults.radiationTherapyAvailable,
      surgicalOncologyAvailable: defaults.surgicalOncologyAvailable,
      latitude: 0,
      longitude: 0,
    });
  });

  return results;
}

// Merge scraped centres into the existing ALBERTA_CANCER_CENTRES list.
// Centres already present (matched by name) keep their curated address,
// coordinates, services, and therapy flags; their type/city/zone are
// refreshed from the scrape. New centres are appended with type-derived
// defaults. Centres no longer listed on the AHS page are dropped so the
// dataset tracks the live directory.
function mergeCentres(
  existing: CancerCentreLocation[],
  scraped: CancerCentreLocation[],
): CancerCentreLocation[] {
  const existingByName = new Map<string, CancerCentreLocation>();
  for (const centre of existing) {
    existingByName.set(centre.name, centre);
  }

  const merged: CancerCentreLocation[] = [];
  for (const fresh of scraped) {
    const prior = existingByName.get(fresh.name);
    if (prior) {
      merged.push({
        ...prior,
        type: fresh.type,
        city: fresh.city,
        zone: fresh.zone,
      });
    } else {
      merged.push(fresh);
    }
  }
  return merged;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AhsCancerCentresScraper] Fetching AHS cancer centre directory...');

  try {
    const response = await axios.get(AHS_CANCER_CENTRES_URL, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
    });
    const $ = cheerio.load(response.data as string);

    const scrapedCentres = parseCancerCentres($);
    await sleep(RATE_LIMIT_MS);

    if (scrapedCentres.length === 0) {
      const durationMs = Date.now() - startTime;
      console.warn(
        '[AhsCancerCentresScraper] No cancer centres could be parsed from page.',
      );
      return {
        domain: 'cancer',
        pipeline: 'ahsCancerCentresScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs,
        error:
          'No cancer centres could be parsed from the AHS directory page.',
        timestamp,
      };
    }

    const existing = loadExistingCancerData();
    const mergedCentres = mergeCentres(
      existing.ALBERTA_CANCER_CENTRES,
      scrapedCentres,
    );

    const merged: CancerJson = {
      ...existing,
      ALBERTA_CANCER_CENTRES: mergedCentres,
    };

    // Stamp freshness for the array this scraper owns; preserve all other
    // _dataMetadata entries (manual arrays + sibling CIHI writers) via merge.
    const ownedMetadata: DataMetadata = {
      ALBERTA_CANCER_CENTRES: buildMetadataEntry({
        updateType: 'auto',
        source: 'AHS Cancer Centre directory',
        sourceVintage: 'Live AHS directory',
        lastUpdated: timestamp,
      }),
    };
    merged._dataMetadata = mergeDataMetadata(existing._dataMetadata, ownedMetadata);

    fs.writeFileSync(CANCER_FILE, JSON.stringify(merged, null, 2), 'utf8');

    const durationMs = Date.now() - startTime;
    console.log(
      `[AhsCancerCentresScraper] Complete. ${scrapedCentres.length} centres parsed, ${mergedCentres.length} written. ${durationMs}ms`,
    );

    return {
      domain: 'cancer',
      pipeline: 'ahsCancerCentresScraper',
      status: 'success',
      recordsFetched: scrapedCentres.length,
      recordsWritten: mergedCentres.length,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AhsCancerCentresScraper] FAILED:', errorMsg);

    return {
      domain: 'cancer',
      pipeline: 'ahsCancerCentresScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}
export async function scrapeAhsCancerCentres(): Promise<SyncResult> {
  return run();
}

// CLI entry point: tsx src/pipelines/ahsCancerCentresScraper.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'success' ? 0 : 1);
  });
}
