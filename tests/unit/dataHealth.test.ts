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
  pipeline: string,
  status: SyncResultLike['status'],
  ageMinutes: number,
  error?: string,
): SyncResultLike {
  return {
    domain,
    pipeline,
    status,
    recordsFetched: status === 'failed' ? 0 : 10,
    recordsWritten: status === 'failed' ? 0 : 10,
    durationMs: 100,
    timestamp: minutesAgo(ageMinutes),
    ...(error ? { error } : {}),
  };
}

function baseStatus(overrides: Partial<SyncStatusLike> = {}): SyncStatusLike {
  return {
    status: 'success',
    lastSyncTimestamp: minutesAgo(60),
    nextSyncTimestamp: minutesAgo(-60),
    results: [
      pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 5),
      pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
    ],
    erWaitTimesLastUpdate: minutesAgo(5),
    erWaitTimesNextUpdate: minutesAgo(-5),
    labWaitsLastUpdate: minutesAgo(5),
    labWaitsNextUpdate: minutesAgo(-5),
    ...overrides,
  };
}

describe('assessDataHealth', () => {
  it('healthy ER+daily → overall ok, bannerMessage null', () => {
    const health = assessDataHealth(baseStatus(), NOW_MS);

    assert.equal(health.overall, 'ok');
    assert.equal(health.bannerMessage, null);
    assert.equal(health.criticalIssues.length, 0);
    assert.equal(health.softIssues.length, 0);
  });

  it('ER failed → critical, bannerMessage set, sanitized message', () => {
    const status = baseStatus({
      // Previous success was 10m ago; the latest fetch just failed.
      erWaitTimesLastUpdate: minutesAgo(10),
      results: [
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'failed', 5, 'upstream timeout'),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const er = health.domains.find((d) => d.domain === 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'failed');
    assert.equal(er.critical, true);
    assert.equal(er.message, 'ER / Urgent Care feed failed');
    assert.ok(!er.message.includes('upstream'));
    assert.ok(health.criticalIssues.some((d) => d.domain === 'er-waittimes'));
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /failing|ER/i);
    assert.equal(health.overall, 'down');
  });

  it('ER soft stale (25m) → softIssues, bannerMessage null', () => {
    const status = baseStatus({
      erWaitTimesLastUpdate: minutesAgo(25),
      results: [
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 25),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
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
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 50),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
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

  it('multi-pipeline domain: latest failed but earlier success exists → partial, not critical', () => {
    const status = baseStatus({
      results: [
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 5),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
        pipelineResult('surgical', 'powerbiScraper', 'success', 15),
        pipelineResult('surgical', 'abjhiScraper', 'failed', 10, 'timeout'),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const surgical = health.domains.find((d) => d.domain === 'surgical');

    assert.ok(surgical);
    assert.equal(surgical.state, 'partial');
    assert.equal(surgical.critical, false);
    assert.equal(surgical.message, 'Surgical Waitlists returned a partial update');
    assert.equal(health.bannerMessage, null);
  });

  it('multi-pipeline domain: all failed → failed/critical', () => {
    const status = baseStatus({
      results: [
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 5),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
        pipelineResult('surgical', 'powerbiScraper', 'failed', 15, 'timeout'),
        pipelineResult('surgical', 'abjhiScraper', 'failed', 10, 'timeout'),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const surgical = health.domains.find((d) => d.domain === 'surgical');

    assert.ok(surgical);
    assert.equal(surgical.state, 'failed');
    assert.equal(surgical.critical, true);
    assert.ok(health.criticalIssues.some((d) => d.domain === 'surgical'));
  });

  it('never-run non-critical domain with daily sync present stays never_run', () => {
    const status = baseStatus({
      results: [
        pipelineResult('er-waittimes', 'erWaitTimesFetcher', 'success', 5),
        pipelineResult('diagnostic', 'aplLabWaitTimesFetcher', 'success', 5),
      ],
    });

    const health = assessDataHealth(status, NOW_MS);
    const spending = health.domains.find((d) => d.domain === 'spending');

    assert.ok(spending);
    assert.equal(spending.state, 'never_run');
    assert.equal(spending.critical, false);
  });

  it('partial_success rollup with all healthy domains → overall ok', () => {
    const status = baseStatus({
      status: 'partial_success',
    });

    const health = assessDataHealth(status, NOW_MS);

    assert.equal(health.overall, 'ok');
    assert.equal(health.bannerMessage, null);
  });

  it('daily soft stale → overall degraded and syncStale-equivalent', () => {
    const status = baseStatus({
      lastSyncTimestamp: minutesAgo(30 * 60),
    });

    const health = assessDataHealth(status, NOW_MS);

    assert.equal(health.overall, 'degraded');
    assert.ok(health.checks.includes('daily_sync_soft_stale'));
    assert.equal(health.bannerMessage, null);
  });

  it('daily critical stale → overall down and banner set', () => {
    const status = baseStatus({
      lastSyncTimestamp: minutesAgo(50 * 60),
    });

    const health = assessDataHealth(status, NOW_MS);

    assert.equal(health.overall, 'down');
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /Daily sync|critically stale/i);
    assert.ok(health.criticalIssues.some((d) => d.domain === 'daily-sync'));
  });

  it('never-run daily sync banner says never completed', () => {
    const status = baseStatus({
      lastSyncTimestamp: null,
      results: [],
      erWaitTimesLastUpdate: null,
      labWaitsLastUpdate: null,
    });

    const health = assessDataHealth(status, NOW_MS);

    assert.equal(health.overall, 'down');
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /never completed/i);
  });
});

describe('syncDomainForView / getDomainHealth', () => {
  it('maps er-waits and erWaitTimes view to er-waittimes', () => {
    assert.equal(syncDomainForView('er-waits'), 'er-waittimes');
    assert.equal(syncDomainForView('erWaitTimes'), 'er-waittimes');

    const health = assessDataHealth(baseStatus(), NOW_MS);
    const byView = getDomainHealth(health, 'er-waits');
    const byDomain = getDomainHealth(health, 'er-waittimes');

    assert.ok(byView);
    assert.equal(byView.domain, 'er-waittimes');
    assert.deepEqual(byView, byDomain);
  });
});
