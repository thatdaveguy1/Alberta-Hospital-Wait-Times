// Trends Pusher — computes trend aggregates from in-memory snapshots and
// pushes a single JSON blob per domain to Cloudflare SNAPSHOTS_KV via the
// authenticated push endpoint.
//
// Domains `er-trends` and `lab-trends` each map to one SNAPSHOTS_KV key
// (same name as the domain). The worker stores the full body; public routes
// read slices from that blob (with legacy per-key fallback on the worker).
//
// Per-facility / per-lab raw time series stay on the Mac mini only — they are
// not included in push payloads.

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


export type ErTrendAllPoint = { timestamp: string; waitTime: number };
export type ErTrendZoneRow = { [key: string]: number | string };
export type ErTrendProvincialPoint = { timestamp: string; waitTime: number };
// --- ER trend aggregates ---

function computeErTrendAll(snapshots: WaitTimeSnapshot[], range: Range): ErTrendAllPoint[] {
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

function computeErTrendZones(snapshots: WaitTimeSnapshot[], hospitals: Hospital[], range: Range): ErTrendZoneRow[] {
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

function computeErTrendFacility(
  snapshots: WaitTimeSnapshot[],
  hospitalId: string,
  range: Range,
): { timestamp: string; waitTime: number }[] {
  const cutoff = getRangeCutoff(range);
  const filtered = snapshots.filter(
    (s) => s.hospitalId === hospitalId && new Date(s.timestamp).getTime() >= cutoff,
  );

  if (range === '24h') {
    const points = filtered.map((s) => ({ timestamp: s.timestamp, waitTime: s.waitTime }));
    points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return points;
  }

  // Downsample to conserve memory/KV value sizes
  const intervalMs = range === '7d' ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
  const buckets: { [bucketTime: string]: number[] } = {};

  for (const snap of filtered) {
    const time = new Date(snap.timestamp).getTime();
    const roundedTime = Math.floor(time / intervalMs) * intervalMs;
    const bucketStr = new Date(roundedTime).toISOString();
    if (!buckets[bucketStr]) buckets[bucketStr] = [];
    buckets[bucketStr].push(snap.waitTime);
  }

  const result = Object.entries(buckets).map(([timestamp, waitTimes]) => {
    const valid = waitTimes.filter((t) => t >= 0);
    const sum = valid.reduce((acc, t) => acc + t, 0);
    return { timestamp, waitTime: valid.length > 0 ? Math.round(sum / valid.length) : 0 };
  });

  result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return result;
}

export const LAB_TRENDS_BLOB_BUDGET_BYTES = 5 * 1024 * 1024; // conservative; Cloudflare hard limit is 25 MiB

export interface LabTrendPoint {
  timestamp: string;
  waitTime: number;
}

export interface LabTrendsBlob {
  provincial: Record<Range, LabTrendPoint[]>;
  labs?: Record<string, Record<Range, LabTrendPoint[]>>;
}

export interface LabTrendBuildResult {
  blob: LabTrendsBlob;
  bytes: number;
  mode: 'full' | 'provincial-only' | 'oversized';
}

// --- Lab trend aggregates ---

export function computeLabTrendProvincial(snapshots: LabWaitSnapshot[], range: Range): ErTrendProvincialPoint[] {
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

export function computeLabTrendFacility(snapshots: LabWaitSnapshot[], labId: string, range: Range): LabTrendPoint[] {
  const cutoff = getRangeCutoff(range);
  const filtered = snapshots.filter(s => s.labId === labId && new Date(s.timestamp).getTime() >= cutoff);

  if (range === '24h') {
    const points = filtered.map(s => ({ timestamp: s.timestamp, waitTime: s.waitTime }));
    points.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return points;
  }

  // Downsample to conserve KV value size while keeping enough resolution for charts.
  const intervalMs = range === '7d' ? 60 * 60 * 1000 : 4 * 60 * 60 * 1000;
  const buckets: { [bucketTime: string]: number[] } = {};

  for (const snap of filtered) {
    const time = new Date(snap.timestamp).getTime();
    const roundedTime = Math.floor(time / intervalMs) * intervalMs;
    const bucketStr = new Date(roundedTime).toISOString();
    if (!buckets[bucketStr]) buckets[bucketStr] = [];
    buckets[bucketStr].push(snap.waitTime);
  }

  const result = Object.entries(buckets).map(([timestamp, waitTimes]) => {
    const valid = waitTimes.filter(t => t >= 0);
    const sum = valid.reduce((acc, t) => acc + t, 0);
    return { timestamp, waitTime: valid.length > 0 ? Math.round(sum / valid.length) : 0 };
  });

  result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return result;
}

function buildProvincialLabTrends(snapshots: LabWaitSnapshot[]): LabTrendsBlob {
  const provincial: Record<Range, ErTrendProvincialPoint[]> = {
    '24h': [],
    '7d': [],
    '30d': [],
  };
  for (const range of RANGES) {
    provincial[range] = computeLabTrendProvincial(snapshots, range);
  }
  return { provincial, labs: {} };
}

/**
 * Build the `lab-trends` blob from snapshots.
 *
 * - Always includes provincial ranges because they are small and safety-critical.
 * - If the full { provincial, labs } blob fits the conservative budget, returns
 *   the full blob and mode `'full'`.
 * - If the full blob exceeds the budget but a provincial-only blob fits, drops
 *   per-lab data, logs a fallback warning, and returns mode `'provincial-only'`.
 * - If even the provincial-only blob exceeds the (possibly reduced) budget,
 *   returns mode `'oversized'` with the provincial blob and an oversized byte
 *   count so callers can report an honest failure rather than silently skipping.
 */
export function buildLabTrendsBlob(
  snapshots: LabWaitSnapshot[],
  budgetBytes: number = LAB_TRENDS_BLOB_BUDGET_BYTES,
): LabTrendBuildResult {
  const provincialBlob = buildProvincialLabTrends(snapshots);
  const provincialOnly = { provincial: provincialBlob.provincial, labs: {} };
  const provincialBytes = Buffer.byteLength(JSON.stringify(provincialOnly));
  if (snapshots.length === 0) {
    return { blob: provincialBlob, bytes: provincialBytes, mode: 'full' };
  }

  const labIds = [...new Set(snapshots.map(s => s.labId))].sort();
  const labs: Record<string, Record<Range, LabTrendPoint[]>> = {};
  for (const labId of labIds) {
    labs[labId] = {
      '24h': computeLabTrendFacility(snapshots, labId, '24h'),
      '7d': computeLabTrendFacility(snapshots, labId, '7d'),
      '30d': computeLabTrendFacility(snapshots, labId, '30d'),
    };
  }

  const fullBlob: LabTrendsBlob = { provincial: provincialBlob.provincial, labs };
  const fullBytes = Buffer.byteLength(JSON.stringify(fullBlob));
  if (fullBytes <= budgetBytes) {
    return { blob: fullBlob, bytes: fullBytes, mode: 'full' };
  }

  if (provincialBytes <= budgetBytes) {
    console.warn(
      `[TrendsPusher] lab-trends full blob ${fullBytes} bytes exceeds ${budgetBytes} byte budget — falling back to provincial-only (${provincialBytes} bytes)`,
    );
    return { blob: provincialOnly, bytes: provincialBytes, mode: 'provincial-only' };
  }

  console.error(
    `[TrendsPusher] lab-trends provincial-only blob ${provincialBytes} bytes exceeds ${budgetBytes} byte budget`,
  );
  return { blob: provincialBlob, bytes: provincialBytes, mode: 'oversized' };
}

/**
 * Compute and push ER trend aggregates as one `er-trends` blob to Cloudflare SNAPSHOTS_KV.
 * Call from the ER pipeline; scheduler throttles cadence for KV budget.
 */
export async function pushErTrends(
  snapshots: WaitTimeSnapshot[],
  hospitals: Hospital[],
): Promise<void> {
  if (snapshots.length === 0) return;

  const all: Record<Range, ErTrendAllPoint[]> = {
    '24h': [],
    '7d': [],
    '30d': [],
  };
  const zones: Record<Range, ErTrendZoneRow[]> = {
    '24h': [],
    '7d': [],
    '30d': [],
  };
  for (const range of RANGES) {
    all[range] = computeErTrendAll(snapshots, range);
    zones[range] = computeErTrendZones(snapshots, hospitals, range);
  }
  const facilities: Record<string, Record<Range, { timestamp: string; waitTime: number }[]>> = {};
  for (const h of hospitals) {
    facilities[h.id] = {
      '24h': computeErTrendFacility(snapshots, h.id, '24h'),
      '7d': computeErTrendFacility(snapshots, h.id, '7d'),
      '30d': computeErTrendFacility(snapshots, h.id, '30d'),
    };
  }

  const blob = {
    all,
    zones,
    maxStats: computeErMaxStats(snapshots, hospitals),
    facilities,
  };
  const result = await pushToCloudflare('er-trends', blob);
  if (result.skipped) {
    const reason = result.cooldown ? 'cooldown' : 'unchanged';
    console.log(`[TrendsPusher] er-trends blob ${reason} — not written`);
  } else if (result.success) {
    console.log('[TrendsPusher] Pushed er-trends blob to Cloudflare KV');
  } else {
    console.warn(`[TrendsPusher] er-trends blob push failed: ${result.error ?? 'unknown'}`);
  }
}

/**
 * Compute and push lab trend aggregates as one `lab-trends` blob to Cloudflare SNAPSHOTS_KV.
 * Call after each APL lab wait times fetch.
 */
export async function pushLabTrends(snapshots: LabWaitSnapshot[]): Promise<void> {
  const { blob, bytes, mode } = buildLabTrendsBlob(snapshots);
  if (mode === 'oversized') {
    console.warn(
      `[TrendsPusher] lab-trends payload ${bytes} bytes exceeds budget; not pushing`,
    );
    return;
  }

  const result = await pushToCloudflare('lab-trends', blob);
  if (result.skipped) {
    const reason = result.cooldown ? 'cooldown' : 'unchanged';
    console.log(`[TrendsPusher] lab-trends blob ${reason} — not written`);
  } else if (result.success) {
    console.log(
      `[TrendsPusher] Pushed lab-trends blob to Cloudflare KV (${bytes} bytes, ${mode})`,
    );
  } else {
    console.warn(`[TrendsPusher] lab-trends blob push failed: ${result.error ?? 'unknown'}`);
  }
}
