import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  msUntilNextLocalHour,
  isFastTierOverdue,
  getFastTierState,
  FAST_TIER_OVERDUE_MS,
} from '../../src/pipelines/scheduler';

describe('msUntilNextLocalHour', () => {
  it('returns time remaining before the same-day hour when it is still ahead', () => {
    const now = new Date('2026-09-01T03:15:00');
    const ms = msUntilNextLocalHour(6, now);
    const expected = new Date('2026-09-01T06:00:00').getTime() - now.getTime();
    assert.equal(ms, expected);
  });

  it('rolls to the next day when the hour has already passed', () => {
    const now = new Date('2026-09-01T06:00:00');
    const ms = msUntilNextLocalHour(6, now);
    const expected = new Date('2026-09-02T06:00:00').getTime() - now.getTime();
    assert.equal(ms, expected);
    assert.ok(ms > 0);
  });
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
