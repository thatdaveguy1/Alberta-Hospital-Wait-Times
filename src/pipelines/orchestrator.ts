// Orchestrator — replaces the fake syncOtherDatasetsDaily() in server.ts.
// Runs all Tier 1-4 pipelines in sequence, collects results, and returns them.
// Called by the scheduler every 24 hours.

import { execFileSync } from 'child_process';
import type { SyncResult, Pipeline } from './types';

// Tier 1: API fetchers
import { run as statscanRun } from './statscanFetcher';
import { run as phacRun } from './phacFetcher';
import { run as openAlbertaRun } from './openAlbertaFetcher';
import { run as aplLabWaitTimesRun } from './aplLabWaitTimesFetcher';

// Tier 2: HTML scrapers
import { run as abjhiRun } from './abjhiScraper';
import { run as ahsAsiRun } from './ahsAsiScraper';
import { run as acuteCareRun } from './acuteCareScraper';
import { run as cpsaRun } from './cpsaScraper';
import { run as goodcaringRun } from './goodcaringScraper';
import { run as ahsCancerCentresRun } from './ahsCancerCentresScraper';
import { run as ahsWeeklyEdLosRun } from './ahsWeeklyEdLosScraper';

// Tier 3: File download+parse
import { run as cihiRun } from './cihiDownloader';
import { run as fraserRun } from './fraserDownloader';
import { run as cihiWaitTimesRun, runCancer as cihiWaitTimesCancerRun, runSurgical as cihiWaitTimesSurgicalRun } from './cihiWaitTimesDownloader';
import { run as primaryCareRun } from './primaryCareFetcher';
import { run as albertaFindAProviderRun } from './albertaFindAProviderScraper';
import { run as hqcaContinuingCareRun } from './hqcaContinuingCareFetcher';
import { run as openAlbertaInequityRun, runPrimaryCare as openAlbertaInequityPrimaryCareRun } from './openAlbertaInequityFetcher';
import { run as openAlbertaBillingRun } from './openAlbertaBillingFetcher';
import { run as hqcaFocusRun } from './hqcaFocusScraper';
import { run as albertaRvdRun } from './albertaRespiratoryVirusScraper';
import { run as cihiWorkforceRun } from './cihiWorkforceFetcher';
import { run as cihiMhSafetyRun } from './cihiMhSafetyFetcher';
import { run as cihiWaitTimesPriorityRun } from './cihiWaitTimesPriorityFetcher';
import { run as continuingCareComplianceRun } from './continuingCareComplianceFetcher';

// Power BI scraper runs as a child process because Puppeteer is ESM-only
// and the server bundles as CJS. The scraper launches headless Chrome,
// intercepts Power BI querydata API responses, and writes to data-surgical.json.
async function runPowerBIScraper(): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const stdout = execFileSync(
      'npx',
      ['tsx', 'src/pipelines/powerbiScraper.ts'],
      {
        cwd: process.cwd(),
        timeout: 120000,
        encoding: 'utf8',
        env: { ...process.env },
      },
    );
    // The scraper prints log lines followed by a pretty-printed JSON SyncResult.
    // Find the first line starting with '{' and parse from there to the end.
    const lines = stdout.trim().split('\n');
    const jsonStartIdx = lines.findIndex((l) => l.trim().startsWith('{'));
    if (jsonStartIdx === -1) {
      throw new Error('No JSON object found in powerbiScraper stdout');
    }
    const jsonStr = lines.slice(jsonStartIdx).join('\n');
    const result = JSON.parse(jsonStr) as SyncResult;
    result.durationMs = Date.now() - startTime;
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Orchestrator] Power BI scraper failed:', errorMsg);
    return {
      domain: 'surgical',
      pipeline: 'powerbiScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// All pipelines in execution order.
// Each pipeline is independent — failure of one doesn't stop others.
const PIPELINES: Pipeline[] = [
  // Tier 1: API fetchers (most reliable, run first)
  { name: 'statscan', domain: 'workforce', run: statscanRun },
  { name: 'phac', domain: 'public-health', run: phacRun },
  { name: 'open-alberta', domain: 'spending', run: openAlbertaRun },
  { name: 'apl-lab-waits', domain: 'diagnostic', run: aplLabWaitTimesRun },

  // Tier 2: HTML scrapers
  // waittimes.alberta.ca was shut down Jan 2026 — replaced by Power BI dashboard.
  // Power BI scraper runs as child process (Puppeteer needs ESM + headless Chrome).
  { name: 'powerbi-scraper', domain: 'surgical', run: runPowerBIScraper },
  { name: 'abjhi', domain: 'surgical', run: abjhiRun },
  { name: 'ahs-asi', domain: 'continuing-care', run: ahsAsiRun },
  { name: 'acute-care', domain: 'system-flow', run: acuteCareRun },
  { name: 'ahs-weekly-edlos', domain: 'system-flow', run: ahsWeeklyEdLosRun },
  { name: 'cpsa', domain: 'workforce', run: cpsaRun },
  { name: 'goodcaring', domain: 'patient-experience', run: goodcaringRun },
  { name: 'ahs-cancer-centres', domain: 'cancer', run: ahsCancerCentresRun },

  // Tier 3: File download+parse (XLSX/CSV/ZIP)
  { name: 'cihi-nhex', domain: 'spending', run: cihiRun },
  { name: 'cihi-wait-times', domain: 'diagnostic', run: cihiWaitTimesRun },
  { name: 'cihi-wait-times-cancer', domain: 'cancer', run: cihiWaitTimesCancerRun },
  { name: 'cihi-wait-times-surgical', domain: 'surgical', run: cihiWaitTimesSurgicalRun },
  { name: 'primary-care', domain: 'primary-care', run: primaryCareRun },
  { name: 'alberta-find-a-provider', domain: 'primary-care', run: albertaFindAProviderRun },
  { name: 'hqca-continuing-care', domain: 'continuing-care', run: hqcaContinuingCareRun },
  { name: 'continuing-care-compliance', domain: 'continuing-care', run: continuingCareComplianceRun },
  { name: 'open-alberta-inequity', domain: 'regional-inequity', run: openAlbertaInequityRun },
  { name: 'open-alberta-inequity-primary-care', domain: 'primary-care', run: openAlbertaInequityPrimaryCareRun },
  { name: 'fraser', domain: 'spending', run: fraserRun },
  { name: 'open-alberta-billing', domain: 'spending', run: openAlbertaBillingRun },
  { name: 'hqca-focus', domain: 'patient-experience', run: hqcaFocusRun },
  { name: 'alberta-rvd', domain: 'public-health', run: albertaRvdRun },
  { name: 'cihi-workforce', domain: 'workforce', run: cihiWorkforceRun },
  { name: 'cihi-mh-safety', domain: 'patient-experience', run: cihiMhSafetyRun },
  { name: 'cihi-wait-times-priority', domain: 'surgical', run: cihiWaitTimesPriorityRun },
];


// Run a single pipeline with error isolation
async function runPipelineSafely(pipeline: Pipeline): Promise<SyncResult> {
  const startTime = Date.now();
  try {
    const result = await pipeline.run();
    const durationMs = Date.now() - startTime;
    // Ensure durationMs is filled
    if (!result.durationMs) {
      result.durationMs = durationMs;
    }
    console.log(`[Orchestrator] ${pipeline.name}: ${result.status} (${result.recordsFetched} fetched, ${result.recordsWritten} written, ${result.durationMs}ms)`);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] ${pipeline.name} threw: ${errorMsg}`);
    return {
      domain: pipeline.domain,
      pipeline: pipeline.name,
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Run all pipelines and return results.
// Each pipeline runs sequentially to respect rate limits across sources.
export async function runAllPipelines(): Promise<SyncResult[]> {
  console.log(`[Orchestrator] Starting ${PIPELINES.length} pipelines...`);
  const results: SyncResult[] = [];

  for (const pipeline of PIPELINES) {
    const result = await runPipelineSafely(pipeline);
    results.push(result);

    // Brief pause between pipelines to avoid hammering sources
    if (pipeline !== PIPELINES[PIPELINES.length - 1]) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const successCount = results.filter(r => r.status === 'success').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  console.log(`[Orchestrator] Complete: ${successCount} success, ${skippedCount} skipped, ${failedCount} failed`);

  return results;
}

// Run a single pipeline by name (for manual triggers)
export async function runPipelineByName(name: string): Promise<SyncResult | null> {
  const pipeline = PIPELINES.find(p => p.name === name);
  if (!pipeline) {
    console.warn(`[Orchestrator] Unknown pipeline: ${name}`);
    return null;
  }
  return runPipelineSafely(pipeline);
}

// List all registered pipelines (for /api/sync/pipelines endpoint)
export function listPipelines(): { name: string; domain: string }[] {
  return PIPELINES.map(p => ({ name: p.name, domain: p.domain }));
}

// CLI entry point: tsx src/pipelines/orchestrator.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const pipelineName = process.argv[2];
  if (pipelineName) {
    runPipelineByName(pipelineName).then(r => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(r?.status === 'success' ? 0 : 1);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    runAllPipelines().then(results => {
      console.log(JSON.stringify(results, null, 2));
      const failed = results.filter(r => r.status === 'failed').length;
      process.exit(failed > 0 ? 1 : 0);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
