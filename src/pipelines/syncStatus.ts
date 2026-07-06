// Sync Status Tracker — tracks pipeline health across all runs
// Writes to data-sync-status.json and provides the data for /api/sync/status

import fs from 'fs';
import path from 'path';
import type { SyncResult, SyncStatus } from './types';

const SYNC_STATUS_FILE = path.join(process.cwd(), 'data-sync-status.json');

let currentStatus: SyncStatus = {
  status: 'never_run',
  lastSyncTimestamp: null,
  nextSyncTimestamp: null,
  results: [],
  erWaitTimesLastUpdate: null,
  erWaitTimesNextUpdate: null,
};

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function loadSyncStatusFromDisk(): void {
  try {
    if (fs.existsSync(SYNC_STATUS_FILE)) {
      const data = fs.readFileSync(SYNC_STATUS_FILE, 'utf8');
      currentStatus = JSON.parse(data) as SyncStatus;
      console.log(`[SyncStatus] Loaded from disk. Last sync: ${currentStatus.lastSyncTimestamp}`);
    }
  } catch (err) {
    console.error('[SyncStatus] Error loading from disk:', err);
  }
}

export function recordErWaitTimesUpdate(result: SyncResult): void {
  currentStatus.erWaitTimesLastUpdate = result.timestamp;
  currentStatus.erWaitTimesNextUpdate = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Update or append the result
  const existingIdx = currentStatus.results.findIndex(
    r => r.pipeline === result.pipeline
  );
  if (existingIdx >= 0) {
    currentStatus.results[existingIdx] = result;
  } else {
    currentStatus.results.push(result);
  }

  saveToDisk();
}

export function recordDailySyncResults(results: SyncResult[]): void {
  const allSuccess = results.every(r => r.status === 'success');
  const anyFailed = results.some(r => r.status === 'failed');
  const anyPartialOrSkipped = results.some(r => r.status === 'partial' || r.status === 'skipped');

  // success = all succeeded. partial_success = some succeeded, rest partial/skipped/failed.
  // failed = all failed (no successes at all).
  currentStatus.status = allSuccess ? 'success' : anyFailed || anyPartialOrSkipped ? 'partial_success' : 'failed';
  currentStatus.lastSyncTimestamp = new Date().toISOString();
  currentStatus.nextSyncTimestamp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Replace all daily sync results with the new set.
  // Keep ER wait times results (different cadence), replace everything else.
  const erResults = currentStatus.results.filter(r => r.pipeline === 'erWaitTimesFetcher');
  currentStatus.results = [...erResults, ...results];

  saveToDisk();
}

function saveToDisk(): void {
  try {
    fs.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(currentStatus, null, 2), 'utf8');
  } catch (err) {
    console.error('[SyncStatus] Error saving to disk:', err);
  }
}
