// Scheduler — manages timed execution of all pipelines.
// Replaces the setInterval calls in server.ts with a clean module.
// ER wait times: every 10 minutes. Daily orchestrator: every 24 hours.

import { fetchErWaitTimes, getHospitals, getSnapshots, setAlertChecker } from './erWaitTimesFetcher';
import { scrapeDisruptions } from './disruptionsScraper';
import { recordErWaitTimesUpdate, recordDailySyncResults, loadSyncStatusFromDisk } from './syncStatus';
import type { SyncResult } from './types';

type DailyOrchestratorFn = () => Promise<SyncResult[]>;

let dailyOrchestrator: DailyOrchestratorFn | null = null;
let erIntervalId: ReturnType<typeof setInterval> | null = null;
let dailyIntervalId: ReturnType<typeof setInterval> | null = null;

export function setDailyOrchestrator(fn: DailyOrchestratorFn): void {
  dailyOrchestrator = fn;
}

export function setAlertCheckFn(fn: () => void): void {
  setAlertChecker(fn);
}

export function getHospitalsData() {
  return getHospitals();
}
export function getSnapshotsData() {
  return getSnapshots();
}

async function runErWaitTimesPipeline(): Promise<void> {
  const result = await fetchErWaitTimes();
  recordErWaitTimesUpdate(result);

  // Push to Cloudflare if configured
  if (result.status === 'success') {
    const { pushToCloudflare } = await import('./pushClient');
    await pushToCloudflare('er-waittimes', {
      hospitals: getHospitals(),
      lastUpdated: result.timestamp,
    });
  }
}

async function runDailySync(): Promise<void> {
  console.log('[Scheduler] Starting daily sync cycle...');

  const results: SyncResult[] = [];

  // Run disruptions scraper
  const disruptionsResult = await scrapeDisruptions();
  results.push(disruptionsResult);

  // Push disruptions to Cloudflare if configured
  if (disruptionsResult.status === 'success') {
    const { pushToCloudflare } = await import('./pushClient');
    const fs = await import('fs');
    const path = await import('path');
    const disruptionsFile = path.join(process.cwd(), 'data-disruptions.json');
    try {
      const data = fs.readFileSync(disruptionsFile, 'utf8');
      const parsed = JSON.parse(data);
      await pushToCloudflare('disruptions', parsed);
    } catch (err) {
      console.warn('[Scheduler] Failed to push disruptions to Cloudflare:', err);
    }
  }

  // Run the daily orchestrator (Tier 1-4 pipelines) if registered
  if (dailyOrchestrator) {
    const orchestratorResults = await dailyOrchestrator();
    results.push(...orchestratorResults);
  }

  recordDailySyncResults(results);

  // Push sync status to Cloudflare if configured
  const { pushToCloudflare } = await import('./pushClient');
  const { getSyncStatus } = await import('./syncStatus');
  await pushToCloudflare('sync-status', getSyncStatus());

  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`[Scheduler] Daily sync complete: ${successCount}/${results.length} pipelines succeeded`);
}

export async function startScheduler(): Promise<void> {
  // Load persisted sync status
  loadSyncStatusFromDisk();

  // Initial runs on startup
  console.log('[Scheduler] Starting initial pipeline runs...');
  await runErWaitTimesPipeline();
  await runDailySync();

  // Schedule ER wait times every 10 minutes
  erIntervalId = setInterval(() => {
    runErWaitTimesPipeline().catch(err => {
      console.error('[Scheduler] ER wait times pipeline error:', err);
    });
  }, 10 * 60 * 1000);

  // Schedule daily sync every 24 hours
  dailyIntervalId = setInterval(() => {
    runDailySync().catch(err => {
      console.error('[Scheduler] Daily sync error:', err);
    });
  }, 24 * 60 * 60 * 1000);

  console.log('[Scheduler] Running. ER wait times: every 10 min. Daily sync: every 24 hr.');
}

export function stopScheduler(): void {
  if (erIntervalId) {
    clearInterval(erIntervalId);
    erIntervalId = null;
  }
  if (dailyIntervalId) {
    clearInterval(dailyIntervalId);
    dailyIntervalId = null;
  }
  console.log('[Scheduler] Stopped.');
}

// Manual trigger for daily sync (used by POST /api/sync/trigger)
export async function triggerDailySync(): Promise<SyncResult[]> {
  console.log('[Scheduler] Manual daily sync trigger...');
  await runDailySync();
  return getSyncStatusResults();
}

function getSyncStatusResults(): SyncResult[] {
  // Re-import to get fresh state
  const { getSyncStatus } = require('./syncStatus');
  return getSyncStatus().results;
}
