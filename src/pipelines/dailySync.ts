// Standalone daily-sync CLI — replicates the full server-side runDailySync() flow
// so a launchd one-shot (or `npm run daily-sync`) can keep KV + data-sync-status.json
// fresh without the Express server running.
//
// Flow:
//   1. scrapeDisruptions()  → record result
//   2. runAllPipelinesWithRetry() → collect Tier 1-4 results and retry any failures once
//   3. recordDailySyncResults(results) → write data-sync-status.json
//   4. pushAllToCloudflare() → bulk-push all 15 domain data files to KV
//   5. push `sync-status` to KV
//
// Exits 0 on completion with no remaining failures, 1 if failures remain or a fatal error occurs.

import 'dotenv/config';
import { scrapeDisruptions } from './disruptionsScraper';
import { runAllPipelinesWithRetry } from './orchestrator';
import { recordDailySyncResults, getSyncStatus } from './syncStatus';
import { pushToCloudflare, pushAllToCloudflare } from './pushClient';
import type { SyncResult } from './types';

// Shared daily-sync logic. Exported so the server's manual triggerDailySync() can
// call the exact same flow instead of duplicating it.
export async function runDailySyncFlow(): Promise<SyncResult[]> {
  console.log('[DailySync] Starting daily sync cycle...');

  const results: SyncResult[] = [];

  // 1. Disruptions scraper — run first; KV push deferred to bulk pushAll at end.
  const disruptionsResult = await scrapeDisruptions();
  results.push(disruptionsResult);

  // 2. Full orchestrator with one retry pass for failed pipelines.
  const orchestratorResults = await runAllPipelinesWithRetry();
  results.push(...orchestratorResults);

  // 3. Persist the rolled-up sync status to disk.
  recordDailySyncResults(results);

  // 4. Bulk-push every updated domain data file to Cloudflare KV. This covers
  //    all 15 domains written by the orchestrator's pipelines (including
  //    `disruptions` from the scraper). `sync-status` is pushed separately below — it is not a
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
    .then((results) => {
      const failed = results.filter(r => r.status === 'failed').length;
      if (failed > 0) {
        console.error(`[DailySync] ${failed} pipeline(s) failed after retry.`);
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(err => {
      console.error('[DailySync] Fatal error:', err);
      process.exit(1);
    });
}
