import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDataHealth,
  getDomainHealth,
  syncDomainForView,
  type SyncResultLike,
  type SyncStatusLike,
} from '../../src/lib/dataHealth';

const NOW_MS = Date.parse('2026-07-22T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW_MS - minutes * 60_000).toISOString();
}

function pipelineResult(
  domain: string,
  status: SyncResultLike['status'],
  ageMinutes: number,
  error?: string,
): SyncResultLike {
  return {
    domain,
    pipeline: domain,
    status,
    recordsFetched: status === 'failed' ? 0 : 10,
    recordsWritten: status === 'failed' ? 0 : 10,
    durationMs: 100,
    timestamp: minutesAgo(ageMinutes),
    ...(error ? { error } : {}),
  };
}

/** Fresh diagnostic feed so never_run/critical diagnostic does not pollute ER-focused cases. */
function healthyDiagnostic(): {
  result: SyncResultLike;
  labWaitsLastUpdate: string;
} {
  return {
    result: pipelineResult('diagnostic', 'success', 5),
    labWaitsLastUpdate: minutesAgo(5),
  };
}

function baseStatus(overrides: Partial<SyncStatusLike> = {}): SyncStatusLike {
  const diagnostic = healthyDiagnostic();
  return {
    status: 'success',
    lastSyncTimestamp: minutesAgo(60),
    nextSyncTimestamp: minutesAgo(-60),
    results: [diagnostic.result],
    erWaitTimesLastUpdate: null,
    erWaitTimesNextUpdate: null,
    labWaitsLastUpdate: diagnostic.labWaitsLastUpdate,
    labWaitsNextUpdate: minutesAgo(-5),
    ...overrides,
  };
}

describe('assessDataHealth', () => {
  it('healthy ER+daily → overall ok, bannerMessage null', () => {
    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(5),
      results: [
        pipelineResult('er-waittimes', 'success', 5),
        pipelineResult('diagnostic', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);

    assert.equal(health.overall, 'ok');
    assert.equal(health.bannerMessage, null);
    assert.equal(health.criticalIssues.length, 0);
    assert.equal(health.softIssues.length, 0);
  });

  it('ER failed → critical, bannerMessage set', () => {
    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(5),
      results: [
        pipelineResult('er-waittimes', 'failed', 5, 'upstream timeout'),
        pipelineResult('diagnostic', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const er = health.domains.find((d) => d.domain === 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'failed');
    assert.equal(er.critical, true);
    assert.ok(health.criticalIssues.some((d) => d.domain === 'er-waittimes'));
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /failing|ER/i);
    assert.equal(health.overall, 'down');
  });

  it('ER soft stale (25m) → softIssues, bannerMessage null', () => {
    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(25),
      results: [
        pipelineResult('er-waittimes', 'success', 25),
        pipelineResult('diagnostic', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const er = health.domains.find((d) => d.domain === 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'soft_stale');
    assert.equal(er.critical, false);
    assert.ok(health.softIssues.some((d) => d.domain === 'er-waittimes'));
    assert.equal(health.criticalIssues.length, 0);
    assert.equal(health.bannerMessage, null);
    assert.equal(health.overall, 'degraded');
  });

  it('ER critical stale (50m) → bannerMessage set', () => {
    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(50),
      results: [
        pipelineResult('er-waittimes', 'success', 50),
        pipelineResult('diagnostic', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const er = health.domains.find((d) => d.domain === 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'critical_stale');
    assert.equal(er.critical, true);
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /critically stale/i);
    assert.ok(health.criticalIssues.some((d) => d.domain === 'er-waittimes'));
  });

  it('null sync status → down + unreachable banner', () => {
    const health = assessDataHealth(null, NOW_MS);

    assert.equal(health.overall, 'down');
    assert.equal(health.syncStatusAvailable, false);
    assert.equal(
      health.bannerMessage,
      'Live data status is unreachable. Showing last received data where available.',
    );
  });
});

describe('syncDomainForView / getDomainHealth', () => {
  it('maps er-waits view to er-waittimes domain health', () => {
    assert.equal(syncDomainForView('er-waits'), 'er-waittimes');

    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(5),
      results: [
        pipelineResult('er-waittimes', 'success', 5),
        pipelineResult('diagnostic', 'success', 5),
      ],
    });
    const health = assessDataHealth(status, NOW_MS);
    const byView = getDomainHealth(health, 'er-waits');
    const byDomain = getDomainHealth(health, 'er-waittimes');

    assert.ok(byView);
    assert.equal(byView.domain, 'er-waittimes');
    assert.deepEqual(byView, byDomain);
  });
});
