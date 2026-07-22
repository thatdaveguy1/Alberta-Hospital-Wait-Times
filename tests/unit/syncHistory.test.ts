import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDailySyncHistoryEntry } from '../../src/pipelines/syncStatus';
import type { SyncResult } from '../../src/pipelines/types';

function result(
  pipeline: string,
  status: SyncResult['status'],
  error?: string,
): SyncResult {
  return {
    domain: 'surgical',
    pipeline,
    status,
    recordsFetched: status === 'success' ? 10 : 0,
    recordsWritten: status === 'success' ? 10 : 0,
    durationMs: 100,
    timestamp: '2026-07-22T12:00:00.000Z',
    ...(error ? { error } : {}),
  };
}

describe('buildDailySyncHistoryEntry', () => {
  it('summarizes mixed daily results and lists non-success failures', () => {
    const entry = buildDailySyncHistoryEntry(
      [
        result('phacFetcher', 'partial'),
        result('abjhiScraper', 'skipped'),
        result('fraserDownloader', 'skipped'),
        result('brokenScraper', 'failed', 'timeout'),
        ...Array.from({ length: 27 }, (_, i) => result(`ok-${i}`, 'success')),
      ],
      'partial_success',
      '2026-07-22T06:00:00.000Z',
    );

    assert.equal(entry.kind, 'daily');
    assert.equal(entry.status, 'partial_success');
    assert.equal(entry.ts, '2026-07-22T06:00:00.000Z');
    assert.match(entry.summary, /^31 pipelines: 27 success, 1 partial, 1 failed, 2 skipped$/);
    assert.equal(entry.failures.length, 4);
    assert.deepEqual(entry.failures.find((f) => f.pipeline === 'brokenScraper'), {
      pipeline: 'brokenScraper',
      status: 'failed',
      error: 'timeout',
    });
  });
});
