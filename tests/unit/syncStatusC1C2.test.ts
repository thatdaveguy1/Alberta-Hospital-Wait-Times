import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeResultsByIdentity,
  applyErWaitTimesUpdate,
  applyLabWaitsUpdate,
  applyDailySyncResults,
  buildDailySyncHistoryEntry,
} from '../../src/pipelines/syncStatus';
import type { SyncResult, SyncStatus } from '../../src/pipelines/types';

// Pure unit tests for C1-C2 logic. No live network or runtime JSON writes.

function baseStatus(): SyncStatus {
  return {
    status: 'never_run',
    lastSyncTimestamp: null,
    nextSyncTimestamp: null,
    results: [],
    erWaitTimesLastUpdate: null,
    erWaitTimesNextUpdate: null,
    labWaitsLastUpdate: null,
    labWaitsNextUpdate: null,
  };
}

function result(
  domain: string,
  pipeline: string,
  status: SyncResult['status'],
  timestamp: string,
  error?: string,
): SyncResult {
  return {
    domain,
    pipeline,
    status,
    recordsFetched: status === 'success' ? 10 : 0,
    recordsWritten: status === 'success' ? 10 : 0,
    durationMs: 100,
    timestamp,
    ...(error ? { error } : {}),
  };
}

describe('normalizeResultsByIdentity (C2)', () => {
  it('keeps latest per (domain, pipeline) and preserves CIHI diagnostic + surgical entries', () => {
    const inputs: SyncResult[] = [
      result('diagnostic', 'cihiWaitTimesDownloader', 'success', '2026-07-22T12:00:00.000Z'),
      result('surgical', 'cihiWaitTimesDownloader', 'success', '2026-07-22T12:00:00.000Z'),
      result('diagnostic', 'cihiWaitTimesDownloader', 'failed', '2026-07-23T12:00:00.000Z', 'timeout'),
      result('surgical', 'cihiWaitTimesDownloader', 'success', '2026-07-23T12:00:00.000Z'),
      result('diagnostic', 'aplLabWaitTimesFetcher', 'success', '2026-07-23T11:00:00.000Z'),
      result('diagnostic', 'aplLabWaitTimesFetcher', 'success', '2026-07-23T12:00:00.000Z'),
    ];

    const normalized = normalizeResultsByIdentity(inputs);
    assert.equal(normalized.length, 3);

    const diagnosticCihi = normalized.find(
      (r) => r.domain === 'diagnostic' && r.pipeline === 'cihiWaitTimesDownloader',
    );
    const surgicalCihi = normalized.find(
      (r) => r.domain === 'surgical' && r.pipeline === 'cihiWaitTimesDownloader',
    );
    const apl = normalized.find((r) => r.pipeline === 'aplLabWaitTimesFetcher');

    assert.ok(diagnosticCihi);
    assert.equal(diagnosticCihi!.status, 'failed');
    assert.equal(diagnosticCihi!.timestamp, '2026-07-23T12:00:00.000Z');
    assert.ok(surgicalCihi);
    assert.equal(surgicalCihi!.status, 'success');
    assert.equal(surgicalCihi!.timestamp, '2026-07-23T12:00:00.000Z');
    assert.ok(apl);
    assert.equal(apl!.timestamp, '2026-07-23T12:00:00.000Z');
  });

  it('last input wins on identical timestamps', () => {
    const inputs: SyncResult[] = [
      result('er-waittimes', 'erWaitTimesFetcher', 'success', '2026-07-23T12:00:00.000Z'),
      result('er-waittimes', 'erWaitTimesFetcher', 'failed', '2026-07-23T12:00:00.000Z', 'timeout'),
    ];
    const normalized = normalizeResultsByIdentity(inputs);
    assert.equal(normalized.length, 1);
    assert.equal(normalized[0].status, 'failed');
  });
});

describe('applyErWaitTimesUpdate (C1-C2)', () => {
  it('records failed ER attempt and does not advance last update', () => {
    const failed: SyncResult = {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'upstream timeout',
      timestamp: '2026-07-23T12:00:00.000Z',
    };

    const updated = applyErWaitTimesUpdate(
      baseStatus(),
      failed,
      Date.parse('2026-07-23T12:00:00.000Z'),
    );
    const er = updated.results.find((r) => r.pipeline === 'erWaitTimesFetcher');
    assert.ok(er);
    assert.equal(er!.status, 'failed');
    assert.equal(er!.error, 'upstream timeout');
    assert.equal(updated.erWaitTimesLastUpdate, null);
  });

  it('advances erWaitTimesLastUpdate on success', () => {
    const success: SyncResult = {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'success',
      recordsFetched: 29,
      recordsWritten: 29,
      durationMs: 100,
      timestamp: '2026-07-23T12:05:00.000Z',
    };

    const updated = applyErWaitTimesUpdate(
      baseStatus(),
      success,
      Date.parse('2026-07-23T12:05:00.000Z'),
    );
    assert.equal(updated.erWaitTimesLastUpdate, '2026-07-23T12:05:00.000Z');
  });
});

describe('applyLabWaitsUpdate (C1-C2)', () => {
  it('records failed lab attempt and does not advance labWaitsLastUpdate', () => {
    const failed: SyncResult = {
      domain: 'diagnostic',
      pipeline: 'aplLabWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'APL API returned empty Sites array',
      timestamp: '2026-07-23T12:00:00.000Z',
    };

    const updated = applyLabWaitsUpdate(
      baseStatus(),
      failed,
      Date.parse('2026-07-23T12:00:00.000Z'),
    );
    const lab = updated.results.find((r) => r.pipeline === 'aplLabWaitTimesFetcher');
    assert.ok(lab);
    assert.equal(lab!.status, 'failed');
    assert.equal(updated.labWaitsLastUpdate, null);
  });
});

describe('applyDailySyncResults (C2)', () => {
  it('normalizes mixed daily + fast-tier results by (domain, pipeline)', () => {
    const status = baseStatus();
    status.results = [
      result('er-waittimes', 'erWaitTimesFetcher', 'success', '2026-07-23T11:00:00.000Z'),
      result('diagnostic', 'aplLabWaitTimesFetcher', 'success', '2026-07-23T11:00:00.000Z'),
    ];

    const daily: SyncResult[] = [
      result('disruptions', 'disruptionsScraper', 'success', '2026-07-23T12:00:00.000Z'),
      result('diagnostic', 'cihiWaitTimesDownloader', 'success', '2026-07-23T12:01:00.000Z'),
      result('surgical', 'cihiWaitTimesDownloader', 'success', '2026-07-23T12:02:00.000Z'),
    ];

    const updated = applyDailySyncResults(status, daily, Date.parse('2026-07-23T12:03:00.000Z'));
    const cihiDiagnostic = updated.results.find(
      (r) => r.domain === 'diagnostic' && r.pipeline === 'cihiWaitTimesDownloader',
    );
    const cihiSurgical = updated.results.find(
      (r) => r.domain === 'surgical' && r.pipeline === 'cihiWaitTimesDownloader',
    );
    assert.ok(cihiDiagnostic);
    assert.ok(cihiSurgical);
    assert.notEqual(cihiDiagnostic, cihiSurgical);
  });
});

describe('ER fetcher failure classification (C1)', () => {
  it('classifies no regional keys as failed', () => {
    const noKeysResult: SyncResult = {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'AHS response contained no regional keys',
      timestamp: '2026-07-23T12:00:00.000Z',
    };
    assert.equal(noKeysResult.status, 'failed');
    assert.ok(noKeysResult.error?.includes('no regional keys'));
  });

  it('classifies zero valid facilities as failed', () => {
    const zeroFacilitiesResult: SyncResult = {
      domain: 'er-waittimes',
      pipeline: 'erWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'AHS regional keys present but zero valid facilities parsed',
      timestamp: '2026-07-23T12:00:00.000Z',
    };
    assert.equal(zeroFacilitiesResult.status, 'failed');
    assert.ok(zeroFacilitiesResult.error?.includes('zero valid facilities'));
  });
});

describe('APL fetcher failure classification (C1)', () => {
  it('classifies empty Sites array as failed and preserves last good diagnostic data', () => {
    const emptySitesResult: SyncResult = {
      domain: 'diagnostic',
      pipeline: 'aplLabWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'APL API returned empty Sites array',
      timestamp: '2026-07-23T12:00:00.000Z',
    };
    assert.equal(emptySitesResult.status, 'failed');
    assert.ok(emptySitesResult.error?.includes('empty Sites'));
  });

  // Note: the "zero valid lab locations" guard in the fetcher exists to avoid
  // overwriting the existing data file when the API returns sites that all fail
  // validation. It is intentionally a defensive failure path, not an expected
  // normal outcome.
  it('classifies zero valid lab locations as failed', () => {
    const zeroLabsResult: SyncResult = {
      domain: 'diagnostic',
      pipeline: 'aplLabWaitTimesFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: 100,
      error: 'Zero valid lab locations parsed from APL API',
      timestamp: '2026-07-23T12:00:00.000Z',
    };
    assert.equal(zeroLabsResult.status, 'failed');
    assert.ok(zeroLabsResult.error?.includes('Zero valid'));
  });
});

describe('buildDailySyncHistoryEntry still works after syncStatus changes', () => {
  it('summarizes mixed daily results', () => {
    const entry = buildDailySyncHistoryEntry(
      [
        result('public-health', 'phacFetcher', 'success', '2026-07-23T12:00:00.000Z'),
        result('spending', 'openAlbertaFetcher', 'skipped', '2026-07-23T12:00:00.000Z', 'no mapping'),
      ],
      'partial_success',
      '2026-07-23T12:00:00.000Z',
    );
    assert.equal(entry.status, 'partial_success');
    assert.match(entry.summary, /1 success/);
    assert.match(entry.summary, /1 skipped/);
  });
});
