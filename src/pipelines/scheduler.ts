// Scheduler — manages timed execution of all pipelines.
// Replaces the setInterval calls in server.ts with a clean module.
// ER wait times: every 10 minutes. Lab waits: every 30 minutes. Daily orchestrator: every 24 hours.

import { fetchErWaitTimes, getHospitals, getSnapshots, setAlertChecker } from './erWaitTimesFetcher';
import { getLabSnapshots } from './aplLabWaitTimesFetcher';
import { scrapeDisruptions } from './disruptionsScraper';
import { recordErWaitTimesUpdate, recordLabWaitsUpdate, recordDailySyncResults, loadSyncStatusFromDisk, getSyncStatus } from './syncStatus';
import type { SyncResult } from './types';

type DailyOrchestratorFn = () => Promise<SyncResult[]>;

let dailyOrchestrator: DailyOrchestratorFn | null = null;
let erIntervalId: NodeJS.Timeout | null = null;
let dailyIntervalId: NodeJS.Timeout | null = null;
let labIntervalId: NodeJS.Timeout | null = null;

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
export function getLabSnapshotsData() {
  return getLabSnapshots();
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
    // Push pre-computed trend aggregates to SNAPSHOTS_KV
    const { pushErTrends } = await import('./trendsPusher');
    await pushErTrends(getSnapshots(), getHospitals());
  }
}

async function runLabWaitsPipeline(): Promise<void> {
  const { run: aplLabRun } = await import('./aplLabWaitTimesFetcher');
  const result = await aplLabRun();
  recordLabWaitsUpdate(result);

  // Push to Cloudflare if configured
  if (result.status === 'success') {
    const { pushToCloudflare } = await import('./pushClient');
    const fs = await import('fs');
    const path = await import('path');
    const diagnosticFile = path.join(process.cwd(), 'data-diagnostic.json');
    try {
      const data = fs.readFileSync(diagnosticFile, 'utf8');
      const parsed = JSON.parse(data);
      await pushToCloudflare('diagnostic', parsed);
    } catch (err) {
      console.warn('[Scheduler] Failed to push diagnostic data to Cloudflare:', err);
    }
    // Push pre-computed lab trend aggregates to SNAPSHOTS_KV
    const { pushLabTrends } = await import('./trendsPusher');
    await pushLabTrends(getLabSnapshots());
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

  // Initial ER wait times run — fast, await so hospitals are populated before serving
  console.log('[Scheduler] Starting initial ER wait times pipeline...');
  await runErWaitTimesPipeline();

  // Kick off daily sync in the background — don't block server startup (Puppeteer/CIHI take minutes)
  runDailySync().catch(err => {
    console.error('[Scheduler] Initial daily sync error:', err);
  });

  // Kick off lab waits in the background — don't block server startup
  runLabWaitsPipeline().catch(err => {
    console.error('[Scheduler] Initial lab waits pipeline error:', err);
  });

  // Schedule ER wait times every 10 minutes
  erIntervalId = setInterval(() => {
    runErWaitTimesPipeline().catch(err => {
      console.error('[Scheduler] ER wait times pipeline error:', err);
    });
  }, 10 * 60 * 1000);

  // Schedule lab waits every 30 minutes
  labIntervalId = setInterval(() => {
    runLabWaitsPipeline().catch(err => {
      console.error('[Scheduler] Lab waits pipeline error:', err);
    });
  }, 30 * 60 * 1000);

  // Schedule daily sync every 24 hours
  dailyIntervalId = setInterval(() => {
    runDailySync().catch(err => {
      console.error('[Scheduler] Daily sync error:', err);
    });
  }, 24 * 60 * 60 * 1000);

  console.log('[Scheduler] Running. ER wait times: every 10 min. Lab waits: every 30 min. Daily sync: every 24 hr.');
}

export function stopScheduler(): void {
  if (erIntervalId) {
    clearInterval(erIntervalId);
    erIntervalId = null;
  }
  if (labIntervalId) {
    clearInterval(labIntervalId);
    labIntervalId = null;
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
  return getSyncStatus().results;
}
