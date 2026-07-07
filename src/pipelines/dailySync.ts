// Standalone daily-sync CLI — replicates the full server-side runDailySync() flow
// so a launchd one-shot (or `npm run daily-sync`) can keep KV + data-sync-status.json
// fresh without the Express server running.
//
// Flow:
//   1. scrapeDisruptions()  → push `disruptions` domain to KV on success
//   2. runAllPipelines()    → collect Tier 1-4 results (one failure never stops the rest)
//   3. recordDailySyncResults(results) → write data-sync-status.json
//   4. pushAllToCloudflare() → bulk-push all 15 domain data files to KV
//   5. push `sync-status` to KV
//
// Exits 0 on completion, non-zero on fatal error. A single pipeline failure does
// NOT abort the run — it is recorded as a failed SyncResult and the script continues.

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { scrapeDisruptions } from './disruptionsScraper';
import { runAllPipelines } from './orchestrator';
import { recordDailySyncResults, getSyncStatus } from './syncStatus';
import { pushToCloudflare, pushAllToCloudflare } from './pushClient';
import type { SyncResult } from './types';

// Shared daily-sync logic. Exported so the server's manual triggerDailySync() can
// call the exact same flow instead of duplicating it.
export async function runDailySyncFlow(): Promise<SyncResult[]> {
  console.log('[DailySync] Starting daily sync cycle...');

  const results: SyncResult[] = [];

  // 1. Disruptions scraper — run first, push immediately on success.
  const disruptionsResult = await scrapeDisruptions();
  results.push(disruptionsResult);

  if (disruptionsResult.status === 'success') {
    const disruptionsFile = path.join(process.cwd(), 'data-disruptions.json');
    try {
      const data = fs.readFileSync(disruptionsFile, 'utf8');
      const parsed = JSON.parse(data);
      await pushToCloudflare('disruptions', parsed);
    } catch (err) {
      console.warn('[DailySync] Failed to push disruptions to Cloudflare:', err);
    }
  }

  // 2. Full orchestrator (Tier 1-4). Each pipeline is error-isolated inside
  //    runAllPipelines, so one failure won't stop the rest.
  const orchestratorResults = await runAllPipelines();
  results.push(...orchestratorResults);

  // 3. Persist the rolled-up sync status to disk.
  recordDailySyncResults(results);

  // 4. Bulk-push every updated domain data file to Cloudflare KV. This covers
  //    all 15 domains written by the orchestrator's pipelines (including a
  //    fresh re-push of `disruptions` from the just-written file, which is
  //    idempotent). `sync-status` is pushed separately below — it is not a
  //    data domain and is not in pushAllToCloudflare's domain list.
  try {
    const pushResults = await pushAllToCloudflare();
    const pushOk = pushResults.filter(r => r.success).length;
    console.log(`[DailySync] Bulk KV push: ${pushOk}/${pushResults.length} domains succeeded`);
  } catch (err) {
    console.warn('[DailySync] Bulk KV push failed:', err);
  }

  // 5. Push the fresh sync-status to KV.
  await pushToCloudflare('sync-status', getSyncStatus());

  const successCount = results.filter(r => r.status === 'success').length;
  console.log(`[DailySync] Daily sync complete: ${successCount}/${results.length} pipelines succeeded`);

  return results;
}

// CLI entry point: tsx src/pipelines/dailySync.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailySyncFlow()
    .then(() => {
      // Exit 0 on completion — individual pipeline failures are recorded in
      // data-sync-status.json but do not fail the script (the run completed).
      process.exit(0);
    })
    .catch(err => {
      console.error('[DailySync] Fatal error:', err);
      process.exit(1);
    });
}
