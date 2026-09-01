import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { msUntilNextLocalHour } from '../../src/pipelines/scheduler';

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
