// ER Wait Times Fetcher Pipeline
// Fetches live ER wait times from the AHS JSON API every 10 minutes.
// Extracted from server.ts fetchAndSyncWaitTimes() into a proper pipeline module.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { Hospital, WaitTimeSnapshot, ServiceDisruption } from '../types';
import type { SyncResult } from './types';
import { writeFileAtomicSync } from '../lib/atomicFile';

const AHS_JSON_URL = 'https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en';
const SNAPSHOTS_FILE = path.join(process.cwd(), 'data-snapshots.json');
const ER_WAITTIMES_FILE = path.join(process.cwd(), 'data-er-waittimes.json');

function parseWaitTime(timeStr: string): number {
  if (!timeStr) return 0;
  let totalMins = 0;
  const hrMatch = timeStr.match(/(\d+)\s*hr/i);
  const minMatch = timeStr.match(/(\d+)\s*min/i);
  if (hrMatch) totalMins += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) totalMins += parseInt(minMatch[1], 10);
  if (!hrMatch && !minMatch) {
    const rawNum = parseInt(timeStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(rawNum)) totalMins = rawNum;
  }
  return totalMins;
}

function cleanHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/\[;\].*/g, '')   // AHS packs "Parent[;]Child" — keep the first
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

// In-memory state — shared with server.ts via getHospitals()/getSnapshots()
let currentHospitals: Hospital[] = [];
let currentSnapshots: WaitTimeSnapshot[] = [];

export function getHospitals(): Hospital[] {
  return currentHospitals;
}

export function getSnapshots(): WaitTimeSnapshot[] {
  return currentSnapshots;
}

function loadSnapshotsFromDisk(): WaitTimeSnapshot[] {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf8');
      return JSON.parse(data) as WaitTimeSnapshot[];
    }
  } catch (err) {
    console.error('[ErWaitTimesFetcher] Error loading snapshots:', err);
  }
  return [];
}

// Alert checking — callback registered by server.ts
type AlertChecker = () => void;
let alertChecker: AlertChecker | null = null;

export function setAlertChecker(fn: AlertChecker): void {
  alertChecker = fn;
}

export async function fetchErWaitTimes(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[ErWaitTimesFetcher] Fetching live AHS wait times...');

  try {
    // Load existing snapshots from disk on first run
    if (currentSnapshots.length === 0) {
      currentSnapshots = loadSnapshotsFromDisk();
    }

    const response = await axios.get(AHS_JSON_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 15000,
    });

    if (!response.data) {
      throw new Error('Empty response from AHS API');
    }

    const data = response.data as Record<string, { Emergency?: unknown[]; Urgent?: unknown[] }>;
    const keys = Object.keys(data);

    if (keys.length === 0) {
      console.warn('[ErWaitTimesFetcher] No regional data keys found.');
      return {
        domain: 'er-waittimes',
        pipeline: 'erWaitTimesFetcher',
        status: 'failed',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error: 'AHS response contained no regional keys',
        timestamp,
      };
    }

    const updatedHospitals: Hospital[] = [];

    for (const key of keys) {
      const zoneData = data[key];
      if (!zoneData) continue;

      let regionName = `${key} Zone`;
      if (key === 'RedDeer') regionName = 'Central Zone';
      else if (key === 'Lethbridge' || key === 'MedicineHat') regionName = 'South Zone';
      else if (key === 'GrandePrairie' || key === 'FortMcMurray') regionName = 'North Zone';

      const emergencyList = (zoneData.Emergency ?? []) as Array<Record<string, string>>;
      const urgentList = (zoneData.Urgent ?? []) as Array<Record<string, string>>;
      const combinedList = [...emergencyList, ...urgentList];

      for (const fac of combinedList) {
        const name = cleanHtmlEntities(fac.Name ?? '');
        if (!name) continue;

        const rawWaitTimeLabel = fac.WaitTime ?? '0m';
        const waitTimeLabel = cleanHtmlEntities(rawWaitTimeLabel);
        const isUnavailable = waitTimeLabel.toLowerCase().includes('unavailable') ||
                              waitTimeLabel.toLowerCase().includes('not available') ||
                              waitTimeLabel.toLowerCase().includes('n/a');
        const waitTimeMinutes = isUnavailable ? -1 : parseWaitTime(waitTimeLabel);

        const hospitalId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        const mapsLink = fac.GoogleMapsLinkDirection ?? '';
        const coordMatch = mapsLink.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
        const latitude = coordMatch ? parseFloat(coordMatch[1]) : undefined;
        const longitude = coordMatch ? parseFloat(coordMatch[2]) : undefined;

        let city = 'Alberta';
        const address = fac.Address ?? '';
        if (address) {
          const lowerAddr = address.toLowerCase();
          if (lowerAddr.includes('calgary')) city = 'Calgary';
          else if (lowerAddr.includes('edmonton')) city = 'Edmonton';
          else if (lowerAddr.includes('red deer')) city = 'Red Deer';
          else if (lowerAddr.includes('lethbridge')) city = 'Lethbridge';
          else if (lowerAddr.includes('medicine hat')) city = 'Medicine Hat';
          else if (lowerAddr.includes('grande prairie')) city = 'Grande Prairie';
          else if (lowerAddr.includes('fort mcmurray')) city = 'Fort McMurray';
          else if (lowerAddr.includes('st. albert')) city = 'St. Albert';
          else if (lowerAddr.includes('sherwood park')) city = 'Sherwood Park';
          else if (lowerAddr.includes('leduc')) city = 'Leduc';
          else if (lowerAddr.includes('fort saskatchewan')) city = 'Fort Saskatchewan';
          else if (lowerAddr.includes('stony plain')) city = 'Stony Plain';
          else if (lowerAddr.includes('airdrie')) city = 'Airdrie';
          else if (lowerAddr.includes('okotoks')) city = 'Okotoks';
          else if (lowerAddr.includes('cochrane')) city = 'Cochrane';
          else if (lowerAddr.includes('devon')) city = 'Devon';
          else if (lowerAddr.includes('innisfail')) city = 'Innisfail';
          else if (lowerAddr.includes('lacombe')) city = 'Lacombe';
          else {
            const parts = address.split(' ');
            const abIndex = parts.indexOf('Alberta');
            if (abIndex > 0) {
              city = parts[abIndex - 1];
            } else {
              city = key.replace(/([A-Z])/g, ' $1').trim();
            }
          }
        }

        let status: Hospital['status'] = 'Green';
        if (waitTimeMinutes > 120) status = 'Red';
        else if (waitTimeMinutes > 60) status = 'Yellow';

        const hospitalData: Hospital = {
          id: hospitalId,
          name,
          city: cleanHtmlEntities(city),
          region: regionName,
          waitTime: waitTimeMinutes,
          waitTimeLabel,
          status,
          updatedAt: timestamp,
          category: fac.Category ?? 'Emergency',
          address: cleanHtmlEntities(fac.Address ?? ''),
          note: cleanHtmlEntities(fac.Note ?? ''),
          latitude,
          longitude,
        };

        updatedHospitals.push(hospitalData);
        currentSnapshots.push({
          hospitalId,
          waitTime: waitTimeMinutes,
          timestamp,
        });
      }
    }

    if (updatedHospitals.length > 0) {
      currentHospitals = updatedHospitals;

      // Write ER wait times to dedicated JSON file
      writeFileAtomicSync(ER_WAITTIMES_FILE, JSON.stringify({
        hospitals: currentHospitals,
        lastUpdated: timestamp,
      }, null, 2));

      // Check alert thresholds
      alertChecker?.();
    }

    // Retain only last 365 days of snapshots
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    currentSnapshots = currentSnapshots.filter(s => new Date(s.timestamp).getTime() > oneYearAgo);

    // Persist snapshots
    writeFileAtomicSync(SNAPSHOTS_FILE, JSON.stringify(currentSnapshots, null, 2));

    if (updatedHospitals.length === 0) {
      console.warn('[ErWaitTimesFetcher] No valid facilities parsed from AHS response.');
      return {
        domain: 'er-waittimes',
        pipeline: 'erWaitTimesFetcher',
        status: 'failed',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        error: 'AHS regional keys present but zero valid facilities parsed',
        timestamp,
      };
    }

    const durationMs = Date.now() - startTime;
    console.log(`[ErWaitTimesFetcher] Sync complete. ${currentHospitals.length} facilities. ${durationMs}ms`);

    return {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'success',
      recordsFetched: updatedHospitals.length,
      recordsWritten: updatedHospitals.length,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[ErWaitTimesFetcher] FAILED:', errorMsg);

    return {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}
