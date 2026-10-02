import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDailySyncStale,
  isFastTierOverdue,
  getFastTierState,
  FAST_TIER_OVERDUE_MS,
} from '../../src/pipelines/scheduler';

describe('isDailySyncStale', () => {
  const now = Date.parse('2026-09-02T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

  it('is fresh at 1h', () => assert.equal(isDailySyncStale(hoursAgo(1), now), false));
  it('is not stale at 25h', () => assert.equal(isDailySyncStale(hoursAgo(25), now), false));
  it('is stale at 27h', () => assert.equal(isDailySyncStale(hoursAgo(27), now), true));
  it('is stale when null', () => assert.equal(isDailySyncStale(null, now), true));
  it('is stale when unparseable', () => assert.equal(isDailySyncStale('garbage', now), true));
});

describe('isFastTierOverdue', () => {
  const now = 1_800_000_000_000;

  it('is not overdue for a recent finish', () => {
    assert.equal(isFastTierOverdue(now - 5 * 60_000, now), false);
  });

  it('is overdue when no finish has been recorded since process start', () => {
    assert.equal(isFastTierOverdue(0, now), true);
  });

  it('is overdue past the 15-minute threshold', () => {
    assert.equal(isFastTierOverdue(now - FAST_TIER_OVERDUE_MS - 1, now), true);
    assert.equal(isFastTierOverdue(now - FAST_TIER_OVERDUE_MS + 60_000, now), false);
  });

  it('honours an explicit threshold', () => {
    assert.equal(isFastTierOverdue(now - 2_000, now, 1_000), true);
    assert.equal(isFastTierOverdue(now - 500, now, 1_000), false);
  });
});

describe('getFastTierState', () => {
  it('reports overdue on a fresh process before the first tick finishes', () => {
    const state = getFastTierState();
    assert.equal(state.erInFlight, false);
    assert.equal(state.labInFlight, false);
    assert.equal(state.erOverdue, true);
    assert.equal(state.labOverdue, true);
  });
});
