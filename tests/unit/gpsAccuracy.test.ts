import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GPS_MAX_ACCURACY_M,
  isGpsFixPreciseEnough,
  PRECISE_GPS_OPTIONS,
} from '../../src/lib/geo';

describe('isGpsFixPreciseEnough', () => {
  it('accepts typical phone GPS accuracy', () => {
    assert.equal(isGpsFixPreciseEnough(12), true);
    assert.equal(isGpsFixPreciseEnough(100), true);
    assert.equal(isGpsFixPreciseEnough(GPS_MAX_ACCURACY_M), true);
  });

  it('rejects coarse network / cell-level fixes (Calgary snap class)', () => {
    // Browser network location for rural AB often reports multi-km accuracy.
    assert.equal(isGpsFixPreciseEnough(5000), false);
    assert.equal(isGpsFixPreciseEnough(15000), false);
    assert.equal(isGpsFixPreciseEnough(GPS_MAX_ACCURACY_M + 1), false);
  });

  it('rejects missing or non-finite accuracy', () => {
    assert.equal(isGpsFixPreciseEnough(undefined), false);
    assert.equal(isGpsFixPreciseEnough(null), false);
    assert.equal(isGpsFixPreciseEnough(NaN), false);
    assert.equal(isGpsFixPreciseEnough(0), false);
    assert.equal(isGpsFixPreciseEnough(-1), false);
  });
});

describe('PRECISE_GPS_OPTIONS', () => {
  it('requests high accuracy and refuses cached network pins', () => {
    assert.equal(PRECISE_GPS_OPTIONS.enableHighAccuracy, true);
    assert.equal(PRECISE_GPS_OPTIONS.maximumAge, 0);
  });
});
