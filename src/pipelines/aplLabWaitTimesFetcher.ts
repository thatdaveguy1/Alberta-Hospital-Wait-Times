// APL Lab Wait Times Fetcher Pipeline
// Fetches live lab location wait times from the APL QMe REST API every 10 minutes.
// The API returns 153 community lab locations with real-time WaitTime and SaveMyPlace fields.
//
// Endpoint: GET https://qmeapi.albertaprecisionlabs.ca/api/location
// No auth, no captcha, open CORS. Returns { Sites: [...] }.
//
// This replaces the hand-authored LAB_LOCATION_WAITS array (52 sites) with 153 live API sites.
// The other 5 diagnostic sub-datasets (CIHI imaging, turnaround, etc.) are untouched —
// they're annual/static and stay on the daily orchestrator.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import { parseAplWaitTime } from '../lib/labWait';
import type { SyncResult } from './types';
const APL_API_URL = 'https://qmeapi.albertaprecisionlabs.ca/api/location';
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');
const LAB_SNAPSHOTS_FILE = path.join(process.cwd(), 'data-lab-snapshots.json');

// Snapshot shape for historical lab wait trends — numeric waits only.
// Sentinel values ('Appointments Only' / 'Closed' / 'Not Available') are NOT
// logged so trend charts stay purely numeric, mirroring the ER fetcher's
// waitTime >= 0 guard.
export interface LabWaitSnapshot {
  labId: string;
  waitTime: number;
  timestamp: string;
}

// In-memory snapshot store — shared with server.ts via getLabSnapshots().
let currentLabSnapshots: LabWaitSnapshot[] = [];

export function getLabSnapshots(): LabWaitSnapshot[] {
  return currentLabSnapshots;
}

function loadLabSnapshotsFromDisk(): LabWaitSnapshot[] {
  try {
    if (fs.existsSync(LAB_SNAPSHOTS_FILE)) {
      const data = fs.readFileSync(LAB_SNAPSHOTS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed as LabWaitSnapshot[];
      console.warn('[AplLabWaitTimesFetcher] lab snapshots file is not an array — starting fresh.');
    }
  } catch (err) {
    console.error('[AplLabWaitTimesFetcher] Error loading lab snapshots:', err);
  }
  return [];
}
// API site shape — matches the raw JSON from qmeapi.albertaprecisionlabs.ca
interface AplSite {
  Id: number;
  Name: string;
  Code: string;
  Address: string;
  City: string;
  Province: string;
  PostalCode: string;
  AdditionalInfo: string;
  Phone: string;
  Fax: string;
  Hours: string;
  Region: string;
  WaitTime: string;
  Latitude: string;
  Longitude: string;
  SaveMyPlace: boolean;
}

// Derive walkInAvailable and appointmentRequired from the API's free-text fields.
function deriveWalkIn(site: AplSite): boolean {
  const text = `${site.AdditionalInfo} ${site.Hours}`.toLowerCase();
  return /walk.?in/.test(text);
}

function deriveAppointmentRequired(site: AplSite): boolean {
  const text = `${site.AdditionalInfo} ${site.Hours}`.toLowerCase();
  const mentionsAppt = /appointment\s*only|by appointment/i.test(text);
  const walkIn = deriveWalkIn(site);
  // If walk-in is available, appointment is not strictly required.
  // Some sites are walk-in M-F but appointment-only Saturdays — treat as not-required
  // since walk-in is an option on most days.
  return mentionsAppt && !walkIn;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AplLabWaitTimesFetcher] Fetching live APL lab wait times...');
  // Load existing snapshots from disk on first run
  if (currentLabSnapshots.length === 0) {
    currentLabSnapshots = loadLabSnapshotsFromDisk();
  }

  try {
    const response = await axios.get(APL_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });

    if (!response.data || !response.data.Sites || !Array.isArray(response.data.Sites)) {
      throw new Error('Invalid API response: missing Sites array');
    }

    const sites = response.data.Sites as AplSite[];
    console.log(`[AplLabWaitTimesFetcher] Received ${sites.length} sites from APL API`);

    // Map API sites to LabLocationWait shape
    const labLocations = sites.map(site => ({
      id: `APL-${site.Code}`,
      name: site.Name,
      code: site.Code,
      address: site.Address,
      city: site.City,
      region: site.Region as 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone',
      waitTimeMin: parseAplWaitTime(site.WaitTime),
      saveMyPlaceAvailable: site.SaveMyPlace,
      appointmentRequired: deriveAppointmentRequired(site),
      walkInAvailable: deriveWalkIn(site),
      latitude: parseFloat(site.Latitude) || 0,
      longitude: parseFloat(site.Longitude) || 0,
      // dailyVolume / peakHours are not provided by the QMe API — omit rather than invent zeros.
    }));

    // Read existing data-diagnostic.json, replace only LAB_LOCATION_WAITS, preserve everything else
    let existingData: Record<string, unknown>;
    try {
      const raw = fs.readFileSync(DIAGNOSTIC_FILE, 'utf8');
      existingData = JSON.parse(raw);
    } catch (err) {
      console.error('[AplLabWaitTimesFetcher] Failed to read existing data-diagnostic.json:', err);
      return {
        domain: 'diagnostic',
        pipeline: 'aplLabWaitTimesFetcher',
        status: 'failed',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error: `Failed to read data file: ${err instanceof Error ? err.message : String(err)}`,
        timestamp,
      };
    }

    existingData.LAB_LOCATION_WAITS = labLocations;

    // Stamp metadata for LAB_LOCATION_WAITS, preserving sibling entries owned
    // by other diagnostic writers (TEST_TURNAROUND_METRICS, IMAGING_WAIT_TRENDS,
    // FACILITY_IMAGING_WAITS, PRIORITY_TARGET_COMPLIANCE, CIHI_DIAGNOSTIC_WAIT_TIMES).
    const ownedMetadata: DataMetadata = {
      LAB_LOCATION_WAITS: buildMetadataEntry({
        updateType: 'auto',
        source: 'APL QMe REST API (qmeapi.albertaprecisionlabs.ca/api/location)',
        sourceVintage: 'Live point-in-time wait estimate, refreshed every 10 minutes',
        lastUpdated: timestamp,
        verification: 'Live wait times from APL public location API. 153 sites. WaitTime parsed from string to minutes.',
      }),
    };
    // Live QMe poll always rewrites LAB_LOCATION_WAITS — declare the key so
    // mergeDataMetadata bumps lastUpdated (otherwise prior Jul stamps stick forever).
    existingData._dataMetadata = mergeDataMetadata(
      existingData._dataMetadata as DataMetadata | undefined,
      ownedMetadata,
      ['LAB_LOCATION_WAITS'],
    );

    // Write back (guard withheld residual arrays before RMW serialize)
    applyWithheldPayloadGuard(existingData);
    fs.writeFileSync(DIAGNOSTIC_FILE, JSON.stringify(existingData, null, 2), 'utf8');
    console.log(`[AplLabWaitTimesFetcher] Wrote ${labLocations.length} lab locations to data-diagnostic.json`);
    // Append numeric-only wait snapshots for historical trend charting.
    // Sentinel values ('Appointments Only' / 'Closed' / 'Not Available') are skipped.
    for (const lab of labLocations) {
      if (typeof lab.waitTimeMin === 'number' && lab.waitTimeMin >= 0) {
        currentLabSnapshots.push({
          labId: lab.id,
          waitTime: lab.waitTimeMin,
          timestamp,
        });
      }
    }

    // Retain only last 90 days of lab snapshots.
    // 90 days keeps seasonal trend visibility without unbounded growth.
    // Scheduler runs every 10 minutes (same cadence as ER waits).
    const retentionCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    currentLabSnapshots = currentLabSnapshots.filter(s => new Date(s.timestamp).getTime() > retentionCutoff);

    // Persist lab snapshots
    fs.writeFileSync(LAB_SNAPSHOTS_FILE, JSON.stringify(currentLabSnapshots, null, 2), 'utf8');
    console.log(`[AplLabWaitTimesFetcher] Persisted ${currentLabSnapshots.length} lab wait snapshots`);

    return {
      domain: 'diagnostic',
      pipeline: 'aplLabWaitTimesFetcher',
      status: 'success',
      recordsFetched: labLocations.length,
      recordsWritten: labLocations.length,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AplLabWaitTimesFetcher] Failed:', errorMsg);
    return {
      domain: 'diagnostic',
      pipeline: 'aplLabWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp,
    };
  }
}

// CLI entry point: tsx src/pipelines/aplLabWaitTimesFetcher.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch(err => {
      console.error('[AplLabWaitTimesFetcher] CLI fatal:', err);
      process.exit(1);
    });
}
