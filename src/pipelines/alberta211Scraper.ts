// Alberta 211 Directory Scraper
// Queries the 211 Alberta directory (https://ab.211.ca/) for helpline listings
// and writes SUPPORT_HELPLINES to data-mental-health.json and
// ADJACENT_HELPLINES to data-virtual-care.json.
//
// 211 Alberta is a service directory operated by 211 Alberta Partnership.
// The directory has a search API at https://ab.211.ca/api/ that returns JSON.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';

const MENTAL_HEALTH_FILE = path.join(process.cwd(), 'data-mental-health.json');
const VIRTUAL_CARE_FILE = path.join(process.cwd(), 'data-virtual-care.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 211 Alberta search API
const SEARCH_API = 'https://ab.211.ca/api/v1/search';
const HELPLINE_KEYWORDS = [
  'mental health helpline',
  'addiction helpline',
  'crisis line',
  'suicide prevention',
  'distress line',
  'poison control',
  'health link',
  '811',
];

interface SupportHelpline {
  name: string;
  phoneNumber: string;
  availability: string;
  scope: string;
  description: string;
}

interface AdjacentHelplineVolume {
  lineName: string;
  annualCalls: number;
  clinicalType: string;
  availability: string;
}

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

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

// Query the 211 Alberta API for helpline listings
async function search211(keyword: string): Promise<unknown[]> {
  try {
    const response = await axios.get(SEARCH_API, {
      params: { q: keyword, per_page: 20, page: 1 },
      timeout: 30000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    // The API may return results in different shapes
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.records && Array.isArray(data.records)) return data.records;
    return [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Alberta211] Search "${keyword}" failed: ${msg}`);
    return [];
  }
}

// Map a 211 record to a SupportHelpline
function mapToHelpline(record: Record<string, unknown>): SupportHelpline | null {
  const name = asString(record.name || record.title || record.service_name);
  if (!name) return null;
  const phone = asString(record.phone || record.phoneNumber || record.phone_number || record.contact_phone);
  const hours = asString(record.hours || record.schedule || record.availability);
  const description = asString(record.description || record.service_description || record.summary);
  const scope = asString(record.service_type || record.category || record.scope);

  return {
    name,
    phoneNumber: phone || 'Not listed',
    availability: hours || '24/7 — verify on 211 directory',
    scope: scope || 'Provincial',
    description: description || 'Contact 211 Alberta for details.',
  };
}

// Map a 211 record to an AdjacentHelplineVolume
function mapToAdjacentHelpline(record: Record<string, unknown>): AdjacentHelplineVolume | null {
  const name = asString(record.name || record.title || record.service_name);
  if (!name) return null;
  const hours = asString(record.hours || record.schedule || record.availability);
  const clinicalType = asString(record.service_type || record.category || record.type);

  return {
    lineName: name,
    annualCalls: 0, // 211 directory does not publish call volumes
    clinicalType: clinicalType || 'Helpline',
    availability: hours || '24/7 — verify on 211 directory',
  };
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[Alberta211] Starting helpline directory scrape');

  try {
    const allRecords: Record<string, unknown>[] = [];
    const seenNames = new Set<string>();

    for (const keyword of HELPLINE_KEYWORDS) {
      console.log(`[Alberta211] Searching: "${keyword}"`);
      const results = await search211(keyword);
      for (const record of results) {
        const rec = record as Record<string, unknown>;
        const name = asString(rec.name || rec.title || rec.service_name);
        if (name && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          allRecords.push(rec);
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
    }

    if (allRecords.length === 0) {
      console.warn(
        '[Alberta211] No helpline records — API may be behind Cloudflare (check.search211.ca). Preserving hand-authored helplines.',
      );
      return {
        domain: 'mental-health',
        pipeline: 'alberta211Scraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: '211 API returned no records (Cloudflare verification or empty search)',
      };
    }

    // Map to SupportHelplines for mental-health
    const helplines: SupportHelpline[] = allRecords
      .map(mapToHelpline)
      .filter((h): h is SupportHelpline => h !== null);

    // Map to AdjacentHelplines for virtual-care
    const adjacentHelplines: AdjacentHelplineVolume[] = allRecords
      .map(mapToAdjacentHelpline)
      .filter((h): h is AdjacentHelplineVolume => h !== null);

    const mhJson = loadJsonFile(MENTAL_HEALTH_FILE);
    const mhOwnedMetadata: DataMetadata = {
      SUPPORT_HELPLINES: buildMetadataEntry({
        updateType: 'auto',
        source: 'AHS Mental Health helplines + 211 Alberta directory',
        sourceVintage: 'Live helpline directories',
        verification: 'Auto-scraped from AHS helplines page and 211 Alberta API.',
        lastUpdated: timestamp,
      }),
    };
    const mhMerged = {
      ...mhJson,
      SUPPORT_HELPLINES: helplines,
      _dataMetadata: mergeDataMetadata(
        mhJson._dataMetadata as DataMetadata | undefined,
        mhOwnedMetadata,
      ),
    };
    fs.writeFileSync(MENTAL_HEALTH_FILE, JSON.stringify(mhMerged, null, 2) + '\n', 'utf8');

    // Merge into virtual-care data. Refresh _dataMetadata for
    // ADJACENT_HELPLINES (the array this scraper owns in this file); preserve
    // sibling entries (HEALTH_LINK_VOLUMES, VIRTUAL_MD_COHORT_STUDY,
    // VIRTUAL_MD_DISPOSITIONS, EMS_811_DIVERSION_DATA) via mergeDataMetadata.
    // The existing entry is the source of truth for
    // source/sourceVintage/updateType/verification; only lastUpdated is
    // refreshed.
    const vcJson = loadJsonFile(VIRTUAL_CARE_FILE);
    const vcExistingMeta = vcJson._dataMetadata as DataMetadata | undefined;
    const vcOwnedMetadata: DataMetadata = {};
    const adjExisting = vcExistingMeta?.ADJACENT_HELPLINES;
    if (adjExisting) {
      vcOwnedMetadata.ADJACENT_HELPLINES = buildMetadataEntry({
        updateType: adjExisting.updateType,
        source: adjExisting.source,
        sourceVintage: adjExisting.sourceVintage,
        verification: adjExisting.verification,
        lastUpdated: timestamp,
      });
    }
    const vcMerged = {
      ...vcJson,
      ADJACENT_HELPLINES: adjacentHelplines,
      _dataMetadata: mergeDataMetadata(vcExistingMeta, vcOwnedMetadata),
    };
    fs.writeFileSync(VIRTUAL_CARE_FILE, JSON.stringify(vcMerged, null, 2) + '\n', 'utf8');

    const recordsWritten = helplines.length + adjacentHelplines.length;
    console.log(
      `[Alberta211] Complete. fetched=${allRecords.length} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'mental-health',
      pipeline: 'alberta211Scraper',
      status: 'success',
      recordsFetched: allRecords.length,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isAccessBlocked =
      /403|429|status code 403|status code 429|rate limit|cloudflare|forbidden/i.test(errorMsg);
    console.error(`[Alberta211] ${isAccessBlocked ? 'BLOCKED' : 'FAILED'}:`, errorMsg);
    return {
      domain: 'mental-health',
      pipeline: 'alberta211Scraper',
      status: isAccessBlocked ? 'skipped' : 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: isAccessBlocked
        ? `211 Alberta API blocked or rate-limited — ${errorMsg}`
        : errorMsg,
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
