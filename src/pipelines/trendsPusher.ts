// Trends Pusher — computes trend aggregates from in-memory snapshots and
// pushes them to Cloudflare SNAPSHOTS_KV via the authenticated push endpoint.
//
// The worker reads pre-computed KV keys (trends-all-24h, trends-labs-7d, etc.)
// so this module computes all range variants and sends them as a
// { kvKey: value } map under the er-trends / lab-trends push domains.
// The worker iterates the map and puts each key to SNAPSHOTS_KV.
//
// Per-facility raw series are packed into ONE map key each (not one key per
// facility). Cloudflare free-tier KV is ~1,000 writes/day; per-entity keys
// blew past that in hours (31 hospitals + 60 labs every cycle).

import type { WaitTimeSnapshot } from '../types';
import type { LabWaitSnapshot } from './aplLabWaitTimesFetcher';
import type { Hospital } from '../types';
import { pushToCloudflare } from './pushClient';

const RANGES = ['24h', '7d', '30d'] as const;
type Range = typeof RANGES[number];

function getRangeCutoff(range: Range): number {
  const now = Date.now();
  switch (range) {
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case '24h':
    default:
      return now - 24 * 60 * 60 * 1000;
  }
}

// --- ER trend aggregates ---

function computeErTrendAll(snapshots: WaitTimeSnapshot[], range: Range) {
  const cutoff = getRangeCutoff(range);
  const filtered = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

  const groups: { [timestamp: string]: number[] } = {};
  for (const snap of filtered) {
    if (!groups[snap.timestamp]) groups[snap.timestamp] = [];
    groups[snap.timestamp].push(snap.waitTime);
  }

  const averages = Object.entries(groups).map(([timestamp, waitTimes]) => {
    const valid = waitTimes.filter(t => t >= 0);
    const sum = valid.reduce((acc, t) => acc + t, 0);
    return { timestamp, waitTime: valid.length > 0 ? Math.round(sum / valid.length) : 0 };
  });
  averages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return averages;
}

function computeErTrendZones(snapshots: WaitTimeSnapshot[], hospitals: Hospital[], range: Range) {
  const cutoff = getRangeCutoff(range);
  const filtered = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

  const hospitalRegionMap = new Map<string, string>();
  for (const h of hospitals) hospitalRegionMap.set(h.id, h.region);

  const groups: { [timestamp: string]: { [region: string]: number[] } } = {};
  for (const snap of filtered) {
    const region = hospitalRegionMap.get(snap.hospitalId);
    if (!region) continue;
    if (!groups[snap.timestamp]) groups[snap.timestamp] = {};
    if (!groups[snap.timestamp][region]) groups[snap.timestamp][region] = [];
    groups[snap.timestamp][region].push(snap.waitTime);
  }

  const result = Object.entries(groups).map(([timestamp, regionMap]) => {
    const row: { [key: string]: number | string } = { timestamp };
    let totalSum = 0;
    let totalCount = 0;
    for (const [region, waitTimes] of Object.entries(regionMap)) {
      const valid = waitTimes.filter(t => t >= 0);
      const sum = valid.reduce((acc, t) => acc + t, 0);
      row[region] = valid.length > 0 ? Math.round(sum / valid.length) : 0;
      totalSum += sum;
      totalCount += valid.length;
    }
    row['Provincial Avg'] = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
    return row;
  });
  result.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  return result;
}

function computeErMaxStats(snapshots: WaitTimeSnapshot[], hospitals: Hospital[]) {
  const now = Date.now();

  const getPeakForRange = (cutoffMs: number, fallbackToCurrent = false) => {
    const cutoff = now - cutoffMs;
    const rangeSnaps = snapshots.filter(s => {
      const t = new Date(s.timestamp).getTime();
      return t >= cutoff && s.waitTime >= 0;
    });

    if (rangeSnaps.length === 0) {
      // Only the 24h window may fall back to the current live snapshot; longer ranges
      // should not inherit a single point-in-time value as their historical peak.
      if (!fallbackToCurrent) return null;
      const validHospitals = hospitals.filter(h => h.waitTime >= 0);
      if (validHospitals.length === 0) return null;
      const peakHosp = validHospitals.reduce((max, h) => h.waitTime > max.waitTime ? h : max, validHospitals[0]);
      return {
        waitTime: peakHosp.waitTime,
        timestamp: peakHosp.updatedAt || new Date().toISOString(),
        hospitalId: peakHosp.id,
        hospitalName: peakHosp.name,
        city: peakHosp.city,
      };
    }

    const peakSnap = rangeSnaps.reduce((max, s) => s.waitTime > max.waitTime ? s : max, rangeSnaps[0]);
    const hosp = hospitals.find(h => h.id === peakSnap.hospitalId);
    return {
      waitTime: peakSnap.waitTime,
      timestamp: peakSnap.timestamp,
      hospitalId: peakSnap.hospitalId,
      hospitalName: hosp ? hosp.name : (peakSnap.hospitalId.charAt(0).toUpperCase() + peakSnap.hospitalId.slice(1).replace(/-/g, ' ')),
      city: hosp ? hosp.city : 'Alberta',
    };
  };

  return {
    max24h: getPeakForRange(24 * 60 * 60 * 1000, true),
    max7d: getPeakForRange(7 * 24 * 60 * 60 * 1000),
    max30d: getPeakForRange(30 * 24 * 60 * 60 * 1000),
  };
}


// --- Lab trend aggregates ---

function computeLabTrendProvincial(snapshots: LabWaitSnapshot[], range: Range) {
  const cutoff = getRangeCutoff(range);
  const filtered = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

  const groups: { [timestamp: string]: number[] } = {};
  for (const snap of filtered) {
    if (!groups[snap.timestamp]) groups[snap.timestamp] = [];
    groups[snap.timestamp].push(snap.waitTime);
  }

  const averages = Object.entries(groups).map(([timestamp, waits]) => {
    const sum = waits.reduce((acc, w) => acc + w, 0);
    return { timestamp, waitTime: waits.length > 0 ? Math.round(sum / waits.length) : 0 };
  });
  averages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return averages;
}

/**
 * Compute and push all ER trend aggregates to Cloudflare SNAPSHOTS_KV.
 * Call from the ER pipeline; scheduler throttles this to ~30 min for KV budget.
 */
export async function pushErTrends(
  snapshots: WaitTimeSnapshot[],
  hospitals: Hospital[],
): Promise<void> {
  if (snapshots.length === 0) return;

  const kvMap: Record<string, unknown> = {};

  for (const range of RANGES) {
    kvMap[`trends-all-${range}`] = computeErTrendAll(snapshots, range);
    kvMap[`trends-zones-${range}`] = computeErTrendZones(snapshots, hospitals, range);
  }

  kvMap['trends-max-stats'] = computeErMaxStats(snapshots, hospitals);
  // Pack all hospital series into one key so we pay 1 write, not N.
  // Worker extracts by hospitalId on read. Keeps facility charts working.
  const erRawByHospital: Record<string, Array<{ waitTime: number; timestamp: string }>> = {};
  for (const snap of snapshots) {
    const bucket = erRawByHospital[snap.hospitalId] ?? (erRawByHospital[snap.hospitalId] = []);
    bucket.push({ waitTime: snap.waitTime, timestamp: snap.timestamp });
  }
  kvMap['trends-er-raw'] = erRawByHospital;

  const result = await pushToCloudflare('er-trends', kvMap);
  if (result.success) {
    console.log(`[TrendsPusher] Pushed ${Object.keys(kvMap).length} ER trend keys to Cloudflare KV`);
  }
}

/**
 * Compute and push all lab trend aggregates to Cloudflare SNAPSHOTS_KV.
 * Call after each APL lab wait times fetch (every 30 min).
 */
export async function pushLabTrends(snapshots: LabWaitSnapshot[]): Promise<void> {
  if (snapshots.length === 0) return;

  const kvMap: Record<string, unknown> = {};

  for (const range of RANGES) {
    kvMap[`trends-labs-${range}`] = computeLabTrendProvincial(snapshots, range);
  }
  // Pack all lab series into one key so we pay 1 write, not N.
  const labRawByLab: Record<string, Array<{ waitTime: number; timestamp: string }>> = {};
  for (const snap of snapshots) {
    const bucket = labRawByLab[snap.labId] ?? (labRawByLab[snap.labId] = []);
    bucket.push({ waitTime: snap.waitTime, timestamp: snap.timestamp });
  }
  kvMap['trends-labs-raw'] = labRawByLab;

  const result = await pushToCloudflare('lab-trends', kvMap);
  if (result.success) {
    console.log(`[TrendsPusher] Pushed ${Object.keys(kvMap).length} lab trend keys to Cloudflare KV`);
  }
}
