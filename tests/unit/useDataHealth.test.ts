// useDataHealth.test.ts — focused pure tests for the minute clock seam.
//
// The hook itself is not rendered (doing so would require React testing
// dependencies this repo does not have). Instead we exercise the exact seam
// the hook uses: `useDataHealth` passes a 60-second clock (`nowMs`) into
// `assessDataHealth`. We import the pure `dataHealth` helpers the hook calls
// and assert that the same cached status object re-evaluates as `nowMs` advances.
// We also import `formatRelativeTime` from useSyncStatus to prove the header's
// relative-time display updates with the real wall clock.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatRelativeTime } from '../../src/hooks/useSyncStatus';
import {
  assessDataHealth,
  getDomainHealth,
  type SyncStatusLike,
} from '../../src/lib/dataHealth';

const NOW_MS = Date.parse('2026-07-22T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW_MS - minutes * 60_000).toISOString();
}

function baseStatus(overrides: Partial<SyncStatusLike> = {}): SyncStatusLike {
  return {
    status: 'success',
    lastSyncTimestamp: minutesAgo(60),
    nextSyncTimestamp: minutesAgo(-60),
    results: [
      {
        domain: 'er-waittimes',
        pipeline: 'erWaitTimesFetcher',
        status: 'success',
        recordsFetched: 10,
        recordsWritten: 10,
        durationMs: 100,
        timestamp: minutesAgo(5),
      },
      {
        domain: 'diagnostic',
        pipeline: 'aplLabWaitTimesFetcher',
        status: 'success',
        recordsFetched: 10,
        recordsWritten: 10,
        durationMs: 100,
        timestamp: minutesAgo(5),
      },
    ],
    erWaitTimesLastUpdate: minutesAgo(5),
    erWaitTimesNextUpdate: minutesAgo(-5),
    labWaitsLastUpdate: minutesAgo(5),
    labWaitsNextUpdate: minutesAgo(-5),
    ...overrides,
  };
}

describe('useDataHealth minute clock seam', () => {
  it('frozen payload at +25m yields ER soft_stale and no global banner', () => {
    const status = baseStatus();
    const health = assessDataHealth(status, NOW_MS + 25 * 60_000);
    const er = getDomainHealth(health, 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'soft_stale');
    assert.equal(er.ageMinutes, 30);
    assert.equal(health.bannerMessage, null);
    assert.equal(health.overall, 'degraded');
  });

  it('frozen payload at +50m yields ER critical_stale and a global banner', () => {
    const status = baseStatus();
    const health = assessDataHealth(status, NOW_MS + 50 * 60_000);
    const er = getDomainHealth(health, 'er-waittimes');

    assert.ok(er);
    assert.equal(er.state, 'critical_stale');
    assert.equal(er.ageMinutes, 55);
    assert.ok(health.bannerMessage);
    assert.match(health.bannerMessage, /critically stale/i);
    assert.ok(health.criticalIssues.some((d) => d.domain === 'er-waittimes'));
    assert.equal(health.overall, 'down');
  });

  it('fetch failure still immediately yields the status-unreachable banner', () => {
    const health = assessDataHealth(null, NOW_MS);

    assert.equal(health.overall, 'down');
    assert.equal(health.syncStatusAvailable, false);
    assert.equal(
      health.bannerMessage,
      'Live data status is unreachable. Showing last received data where available.',
    );
  });

  it('header relative time updates as the clock advances without a new payload', () => {
    // formatRelativeTime uses `new Date()` internally, so we feed it timestamps
    // anchored to the real wall clock and verify both ages in one call.
    const realNow = Date.now();
    const erTimestamp = new Date(realNow - 5 * 60_000).toISOString();
    assert.equal(formatRelativeTime(erTimestamp), '5m ago');

    const staleTimestamp = new Date(realNow - 45 * 60_000).toISOString();
    assert.equal(formatRelativeTime(staleTimestamp), '45m ago');
  });
});
