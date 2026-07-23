import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  runPipelinesWithRetry,
  exitCodeForResults,
} from '../../src/pipelines/orchestrator';
import type { SyncResult, Pipeline } from '../../src/pipelines/types';

describe('daily C4 retry semantics via production helper', () => {
  it('retries only failed pipelines and replaces prior results', async () => {
    let phacCalls = 0;
    let fraserCalls = 0;

    const results = await runPipelinesWithRetry([
      {
        name: 'phac',
        domain: 'public-health',
        run: async () => {
          phacCalls++;
          const recoverOnRetry = phacCalls === 2;
          const status = recoverOnRetry ? 'success' : 'failed';
          return {
            domain: 'public-health',
            pipeline: 'phac',
            status,
            recordsFetched: 1,
            recordsWritten: status === 'success' ? 1 : 0,
            durationMs: 1,
            timestamp: new Date().toISOString(),
            ...(status === 'failed' ? { error: 'simulated' } : {}),
          } as SyncResult;
        },
      },
      {
        name: 'open-alberta',
        domain: 'spending',
        run: async () => ({
          domain: 'spending',
          pipeline: 'open-alberta',
          status: 'success',
          recordsFetched: 1,
          recordsWritten: 1,
          durationMs: 1,
          timestamp: new Date().toISOString(),
        }),
      },
      {
        name: 'fraser',
        domain: 'spending',
        run: async () => {
          fraserCalls++;
          return {
            domain: 'spending',
            pipeline: 'fraser',
            status: 'failed',
            recordsFetched: 0,
            recordsWritten: 0,
            durationMs: 1,
            timestamp: new Date().toISOString(),
            error: 'simulated',
          } as SyncResult;
        },
      },
    ]);

    assert.equal(results.length, 3);

    const phac = results.find((r) => r.pipeline === 'phac');
    const fraser = results.find((r) => r.pipeline === 'fraser');
    const openAlberta = results.find((r) => r.pipeline === 'open-alberta');

    assert.equal(phac!.status, 'success');
    assert.equal(fraser!.status, 'failed');
    assert.equal(openAlberta!.status, 'success');
    assert.equal(fraser!.error, 'simulated');
    assert.equal(phacCalls, 2, 'phac retried exactly once and recovered');
    assert.equal(fraserCalls, 2, 'fraser retried exactly once and stayed failed');
  });

  it('does not retry success, partial, manual, or skipped statuses', async () => {
    const statuses: SyncResult['status'][] = [
      'success',
      'partial',
      'manual',
      'skipped',
    ];
    for (const status of statuses) {
      let calls = 0;
      const pipeline: Pipeline = {
        name: 'p1',
        domain: 'd1',
        run: async () => {
          calls++;
          return {
            domain: 'd1',
            pipeline: 'p1',
            status,
            recordsFetched: 1,
            recordsWritten: 1,
            durationMs: 1,
            timestamp: new Date().toISOString(),
          } as SyncResult;
        },
      };
      await runPipelinesWithRetry([pipeline]);
      assert.equal(calls, 1, `status ${status} should not be retried`);
    }
  });

  it('replaces retried result by index, preserving non-failed entries', async () => {
    let attempt = 0;
    const p1: Pipeline = {
      name: 'p1',
      domain: 'd1',
      run: async () => {
        attempt++;
        const failed = attempt === 1;
        return {
          domain: 'd1',
          pipeline: 'p1',
          status: failed ? 'failed' : 'success',
          recordsFetched: 1,
          recordsWritten: failed ? 0 : 1,
          durationMs: 1,
          timestamp: new Date().toISOString(),
          ...(failed ? { error: 'transient' } : {}),
        } as SyncResult;
      },
    };
    const p2: Pipeline = {
      name: 'p2',
      domain: 'd2',
      run: async () => ({
        domain: 'd2',
        pipeline: 'p2',
        status: 'success',
        recordsFetched: 1,
        recordsWritten: 1,
        durationMs: 1,
        timestamp: new Date().toISOString(),
      }),
    };

    const results = await runPipelinesWithRetry([p1, p2]);
    assert.equal(results[1].status, 'success');
    assert.equal(results[0].status, 'success');
    assert.equal(results[0].error, undefined);
  });

  it('exit helper returns 1 iff failures remain', async () => {
    const failing: SyncResult[] = [{
      domain: 'd1',
      pipeline: 'p1',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 1,
      timestamp: new Date().toISOString(),
    }];
    assert.equal(exitCodeForResults(failing), 1);

    const allGood: SyncResult[] = [{
      domain: 'd1',
      pipeline: 'p1',
      status: 'success',
      recordsFetched: 1,
      recordsWritten: 1,
      durationMs: 1,
      timestamp: new Date().toISOString(),
    }];
    assert.equal(exitCodeForResults(allGood), 0);
  });
});
