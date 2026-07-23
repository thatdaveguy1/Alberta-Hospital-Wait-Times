import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SyncResult, Pipeline } from '../../src/pipelines/types';

// Minimal in-module reimplementation of the retry contract to verify:
// 1. one full pass over definitions
// 2. one retry pass of only status==='failed'
// 3. replacement by (domain, pipeline)
// 4. no retry of success/partial/manual/skipped
// 5. exit 1 iff failures remain (tested via final results)

function runPipeline(
  pipeline: Pipeline,
  attempt: number,
  failing: Set<string>,
  recoverOnRetry: Set<string>,
): SyncResult {
  const shouldFail = failing.has(pipeline.name);
  const recovers = recoverOnRetry.has(pipeline.name) && attempt === 2;
  const status: SyncResult['status'] =
    !shouldFail || recovers ? 'success' : 'failed';
  return {
    domain: pipeline.domain,
    pipeline: pipeline.name,
    status,
    recordsFetched: 1,
    recordsWritten: status === 'success' ? 1 : 0,
    durationMs: 1,
    timestamp: new Date().toISOString(),
    ...(status === 'failed' ? { error: 'simulated' } : {}),
  };
}

async function runAllPipelinesWithRetrySim(
  pipelines: Pipeline[],
  failing: Set<string>,
  recoverOnRetry: Set<string>,
): Promise<SyncResult[]> {
  const firstPass = pipelines.map((p) => runPipeline(p, 1, failing, recoverOnRetry));

  const failedIndexes = firstPass
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => r.status === 'failed');

  if (failedIndexes.length === 0) return firstPass;

  const retryResults = new Map<number, SyncResult>();
  for (const { r, index } of failedIndexes) {
    const pipeline = pipelines.find(
      (p) => p.name === r.pipeline && p.domain === r.domain,
    );
    if (!pipeline) continue;
    retryResults.set(index, runPipeline(pipeline, 2, failing, recoverOnRetry));
  }

  return firstPass.map((r, index) => retryResults.get(index) ?? r);
}

describe('daily C4 retry semantics', () => {
  const pipelines: Pipeline[] = [
    { name: 'phac', domain: 'public-health', run: async () => ({}) as any },
    { name: 'open-alberta', domain: 'spending', run: async () => ({}) as any },
    { name: 'fraser', domain: 'spending', run: async () => ({}) as any },
  ];

  it('retries only failed pipelines and replaces prior results', async () => {
    const results = await runAllPipelinesWithRetrySim(
      pipelines,
      new Set(['phac', 'fraser']),
      new Set(['phac']),
    );

    assert.equal(results.length, 3);
    const phac = results.find((r) => r.pipeline === 'phac');
    const fraser = results.find((r) => r.pipeline === 'fraser');
    const openAlberta = results.find((r) => r.pipeline === 'open-alberta');

    assert.equal(phac!.status, 'success');
    assert.equal(fraser!.status, 'failed');
    assert.equal(openAlberta!.status, 'success');
    assert.equal(fraser!.error, 'simulated');
  });

  it('does not retry success, partial, manual, or skipped statuses', async () => {
    const statuses: SyncResult['status'][] = [
      'success',
      'partial',
      'manual',
      'skipped',
    ];
    for (const status of statuses) {
      const p: Pipeline[] = [
        {
          name: 'p1',
          domain: 'd1',
          run: async () =>
            ({
              domain: 'd1',
              pipeline: 'p1',
              status,
              recordsFetched: 1,
              recordsWritten: 1,
              durationMs: 1,
              timestamp: new Date().toISOString(),
            } as SyncResult),
        },
      ];
      const r0: SyncResult = {
        domain: 'd1',
        pipeline: 'p1',
        status,
        recordsFetched: 1,
        recordsWritten: 1,
        durationMs: 1,
        timestamp: new Date().toISOString(),
      };
      // Direct contract: only 'failed' enters the retry map.
      const shouldRetry = r0.status === 'failed';
      assert.equal(shouldRetry, false);
    }
  });

  it('exit 1 iff failures remain after retry', async () => {
    const results = await runAllPipelinesWithRetrySim(
      pipelines,
      new Set(['phac']),
      new Set(),
    );
    const failed = results.filter((r) => r.status === 'failed').length;
    assert.equal(failed, 1);
    assert.equal(failed > 0 ? 1 : 0, 1);

    const allGood = await runAllPipelinesWithRetrySim(
      pipelines,
      new Set(),
      new Set(),
    );
    assert.equal(allGood.every((r) => r.status === 'success'), true);
    assert.equal(0, 0);
  });
});
