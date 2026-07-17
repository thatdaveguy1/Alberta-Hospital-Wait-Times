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
  labWaitsLastUpdate: null,
  labWaitsNextUpdate: null,
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
  // Reload from disk first so we don't clobber a standalone daily-sync run that wrote
  // an updated status while the server was running.
  loadSyncStatusFromDisk();
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

export function recordLabWaitsUpdate(result: SyncResult): void {
  // Reload from disk first so we don't clobber a standalone daily-sync run that wrote
  // an updated status while the server was running.
  loadSyncStatusFromDisk();
  currentStatus.labWaitsLastUpdate = result.timestamp;
  currentStatus.labWaitsNextUpdate = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
  const anySuccess = results.some(r => r.status === 'success');
  const anyPartialSkippedOrManual = results.some(
    r => r.status === 'partial' || r.status === 'skipped' || r.status === 'manual'
  );

  // success = all succeeded.
  // partial_success = some succeeded, rest partial/skipped/manual/failed; or any failed with success present.
  // failed = all failed (no successes, no partial/skipped/manual).
  // manual = no successes, only partial/skipped/manual (no failed).
  let status: SyncStatus['status'];
  if (allSuccess) {
    status = 'success';
  } else if (anyFailed) {
    status = anySuccess ? 'partial_success' : 'failed';
  } else if (anyPartialSkippedOrManual) {
    status = anySuccess ? 'partial_success' : 'manual';
  } else {
    status = 'failed';
  }
  currentStatus.status = status;
  currentStatus.lastSyncTimestamp = new Date().toISOString();
  currentStatus.nextSyncTimestamp = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Replace all daily sync results with the new set.
  // Keep ER wait times and lab waits results (different cadence), replace everything else.
  const fastTierResults = currentStatus.results.filter(
    r => r.pipeline === 'erWaitTimesFetcher' || r.pipeline === 'aplLabWaitTimesFetcher'
  );
  currentStatus.results = [...fastTierResults, ...results];

  saveToDisk();
}

function saveToDisk(): void {
  try {
    fs.writeFileSync(SYNC_STATUS_FILE, JSON.stringify(currentStatus, null, 2), 'utf8');
  } catch (err) {
    console.error('[SyncStatus] Error saving to disk:', err);
  }
}
