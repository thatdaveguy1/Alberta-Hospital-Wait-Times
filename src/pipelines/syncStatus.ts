// Sync Status Tracker — tracks pipeline health across all runs
// Writes to data-sync-status.json and provides the data for /api/sync/status

import fs from 'fs';
import path from 'path';
import type { SyncResult, SyncStatus } from './types';
import { writeFileAtomicSync, withCollectorLockSync } from '../lib/atomicFile';

const SYNC_STATUS_FILE = path.join(process.cwd(), 'data-sync-status.json');
const HISTORY_FILE = path.join(process.cwd(), 'data-sync-history.jsonl');
const HISTORY_MAX_BYTES = 5 * 1024 * 1024;
const HISTORY_MAX_LINES = 10_000;
const HISTORY_RETENTION_DAYS = 90;

export interface SyncHistoryFailure {
  pipeline: string;
  status: SyncResult['status'];
  error?: string;
}

export interface SyncHistoryEntry {
  ts: string;
  kind: 'daily' | 'er' | 'lab';
  status: string;
  summary: string;
  failures: SyncHistoryFailure[];
}

let currentStatus: SyncStatus = {
  status: 'never_run',
  lastSyncTimestamp: null,
  nextSyncTimestamp: null,
  results: [],
  erWaitTimesLastUpdate: null,
  erWaitTimesNextUpdate: null,
  labWaitsLastUpdate: null,
  labWaitsNextUpdate: null,
};

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

/** Return a result list containing only the latest entry for each (domain, pipeline) pair. */
export function normalizeResultsByIdentity(results: SyncResult[]): SyncResult[] {
  const latestByKey = new Map<string, SyncResult>();
  for (const result of results) {
    const key = `${result.domain}|${result.pipeline}`;
    const existing = latestByKey.get(key);
    const resultMs = new Date(result.timestamp).getTime();
    const existingMs = existing ? new Date(existing.timestamp).getTime() : -Infinity;
    // Latest timestamp wins; on exact ties the later input order wins.
    if (!existing || resultMs >= existingMs) {
      latestByKey.set(key, result);
    }
  }
  return Array.from(latestByKey.values());
}

export function loadSyncStatusFromDisk(): void {
  try {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      const data = withCollectorLockSync(() => fs.readFileSync(SYNC_STATUS_FILE, 'utf8'));
      currentStatus = JSON.parse(data) as SyncStatus;
      currentStatus.results = normalizeResultsByIdentity(currentStatus.results);
      console.log(`[SyncStatus] Loaded from disk. Last sync: ${currentStatus.lastSyncTimestamp}`);
    }
  } catch (err) {
    console.error('[SyncStatus] Error loading from disk:', err);
  }
}

/** Pure helper: merge a single ER result into a status object. */
export function applyErWaitTimesUpdate(status: SyncStatus, result: SyncResult, nowMs = Date.now()): SyncStatus {
  const next: SyncStatus = { ...status };
  // Only advance the "last success" timestamp when the fetch actually succeeds.
  if (result.status === 'success') {
    next.erWaitTimesLastUpdate = result.timestamp;
  }
  next.erWaitTimesNextUpdate = new Date(nowMs + 10 * 60 * 1000).toISOString();
  next.results = normalizeResultsByIdentity([...next.results, result]);
  return next;
}

export function recordErWaitTimesUpdate(result: SyncResult): void {
  // Reload from disk first so we don't clobber a standalone daily-sync run that wrote
  // an updated status while the server was running, then write back under the
  // cross-process collector lock so concurrent fast/daily processes cannot
  // interleave read-modify-write cycles.
  withCollectorLockSync(() => {
    loadSyncStatusFromDisk();
    currentStatus = applyErWaitTimesUpdate(currentStatus, result);
    saveToDisk();
  });
  if (result.status === 'failed') {
    appendHistory(buildFastTierSyncHistoryEntry(result, 'er'));
  }
}

/** Pure helper: merge a single lab result into a status object. */
export function applyLabWaitsUpdate(status: SyncStatus, result: SyncResult, nowMs = Date.now()): SyncStatus {
  const next: SyncStatus = { ...status };
  // Only advance the "last success" timestamp when the fetch actually succeeds.
  if (result.status === 'success') {
    next.labWaitsLastUpdate = result.timestamp;
  }
  next.labWaitsNextUpdate = new Date(nowMs + 10 * 60 * 1000).toISOString();
  next.results = normalizeResultsByIdentity([...next.results, result]);
  return next;
}

export function recordLabWaitsUpdate(result: SyncResult): void {
  withCollectorLockSync(() => {
    loadSyncStatusFromDisk();
    currentStatus = applyLabWaitsUpdate(currentStatus, result);
    saveToDisk();
  });
  if (result.status === 'failed') {
    appendHistory(buildFastTierSyncHistoryEntry(result, 'lab'));
  }
}

/** Pure helper: merge daily results into a status object. */
export function applyDailySyncResults(status: SyncStatus, results: SyncResult[], nowMs = Date.now()): SyncStatus {
  const allSuccess = results.every(r => r.status === 'success');
  const anyFailed = results.some(r => r.status === 'failed');
  const anySuccess = results.some(r => r.status === 'success');
  const anyPartialSkippedOrManual = results.some(
    r => r.status === 'partial' || r.status === 'skipped' || r.status === 'manual'
  );

  // overallStatus: success = all succeeded.
  // partial_success = some succeeded, rest partial/skipped/manual/failed; or any failed with success present.
  // failed = all failed (no successes, no partial/skipped/manual).
  // manual = no successes, only partial/skipped/manual (no failed).
  let overallStatus: SyncStatus['status'];
  if (allSuccess) {
    overallStatus = 'success';
  } else if (anyFailed) {
    overallStatus = anySuccess ? 'partial_success' : 'failed';
  } else if (anyPartialSkippedOrManual) {
    overallStatus = anySuccess ? 'partial_success' : 'manual';
  } else {
    overallStatus = 'failed';
  }

  const lastSyncTimestamp = new Date(nowMs).toISOString();

  // Replace all daily sync results with the new set.
  // Keep ER wait times and lab waits results (different cadence), replace everything else.
  const fastTierResults = status.results.filter(
    r => r.pipeline === 'erWaitTimesFetcher' || r.pipeline === 'aplLabWaitTimesFetcher'
  );
  const normalizedResults = normalizeResultsByIdentity([...fastTierResults, ...results]);

  return {
    ...status,
    status: overallStatus,
    lastSyncTimestamp,
    nextSyncTimestamp: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
    results: normalizedResults,
  };
}

export function recordDailySyncResults(results: SyncResult[]): void {
  // Reload from disk first so a standalone daily-sync CLI process does not
  // clobber ER/lab timestamps written by the long-running scheduler, then
  // write back under the cross-process collector lock.
  withCollectorLockSync(() => {
    loadSyncStatusFromDisk();
    currentStatus = applyDailySyncResults(currentStatus, results);
    saveToDisk();
  });
  appendHistory(buildDailySyncHistoryEntry(results, currentStatus.status, currentStatus.lastSyncTimestamp!));
}

export function buildDailySyncHistoryEntry(
  results: SyncResult[],
  status: SyncStatus['status'],
  ts: string,
): SyncHistoryEntry {
  const counts: Record<SyncResult['status'], number> = {
    success: 0,
    failed: 0,
    partial: 0,
    skipped: 0,
    manual: 0,
  };
  for (const result of results) {
    counts[result.status]++;
  }

  const parts: string[] = [];
  if (counts.success) parts.push(`${counts.success} success`);
  if (counts.partial) parts.push(`${counts.partial} partial`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.manual) parts.push(`${counts.manual} manual`);

  const failures: SyncHistoryFailure[] = results
    .filter((result) => result.status !== 'success')
    .map((result) => ({
      pipeline: result.pipeline,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    }));

  return {
    ts,
    kind: 'daily',
    status,
    summary: `${results.length} pipelines: ${parts.join(', ')}`,
    failures,
  };
}

export function buildFastTierSyncHistoryEntry(
  result: SyncResult,
  kind: 'er' | 'lab',
  ts: string = result.timestamp,
): SyncHistoryEntry {
  return {
    ts,
    kind,
    status: result.status,
    summary: `${result.pipeline} ${result.status}${result.error ? `: ${result.error}` : ''}`,
    failures: [
      {
        pipeline: result.pipeline,
        status: result.status,
        ...(result.error ? { error: result.error } : {}),
      },
    ],
  };
}

export function appendHistory(entry: SyncHistoryEntry): void {
  try {
    fs.appendFileSync(HISTORY_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
    trimHistoryIfNeeded();
  } catch (err) {
    console.error('[SyncStatus] Error appending history:', err);
  }
}

export function getSyncHistory(limit = 50): SyncHistoryEntry[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return [];
    }

    const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter((line) => line.trim());
    const entries: SyncHistoryEntry[] = [];

    for (const line of lines.slice(-limit)) {
      try {
        entries.push(JSON.parse(line) as SyncHistoryEntry);
      } catch {
        // Skip malformed lines.
      }
    }

    return entries;
  } catch (err) {
    console.error('[SyncStatus] Error reading history:', err);
    return [];
  }
}

function trimHistoryIfNeeded(): void {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      return;
    }

    const stat = fs.statSync(HISTORY_FILE);
    const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter((line) => line.trim());
    if (stat.size <= HISTORY_MAX_BYTES && lines.length <= HISTORY_MAX_LINES) {
      return;
    }

    const cutoffMs = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const kept = lines.filter((line) => {
      try {
        const entry = JSON.parse(line) as SyncHistoryEntry;
        const tsMs = Date.parse(entry.ts);
        return !Number.isNaN(tsMs) && tsMs >= cutoffMs;
      } catch {
        return false;
      }
    });

    writeFileAtomicSync(
      HISTORY_FILE,
      kept.length > 0 ? `${kept.join('\n')}\n` : '',
    );
  } catch (err) {
    console.error('[SyncStatus] Error trimming history:', err);
  }
}

function saveToDisk(): void {
  try {
    writeFileAtomicSync(SYNC_STATUS_FILE, JSON.stringify(currentStatus, null, 2));
  } catch (err) {
    console.error('[SyncStatus] Error saving to disk:', err);
  }
}

// Lock-aware helper used by tests and callers that need to inspect the file
// under the same cross-process lock.
export function loadSyncStatusFromDiskLocked(): SyncStatus {
  return withCollectorLockSync(() => {
    loadSyncStatusFromDisk();
    return { ...currentStatus };
  });
}
