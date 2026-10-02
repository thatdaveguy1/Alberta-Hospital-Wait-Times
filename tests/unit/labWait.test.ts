import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLabWaitSentinel,
  isLabWaitUnavailable,
  labWaitBand,
  labWaitUnavailableDetail,
  parseAplWaitTime,
  unavailableWaitLabel,
} from '../../src/lib/labWait';

describe('parseAplWaitTime', () => {
  it('parses Closed and Appointments Only sentinels', () => {
    assert.strictEqual(parseAplWaitTime('Closed'), 'Closed');
    assert.strictEqual(parseAplWaitTime('Appointments Only'), 'Appointments Only');
    assert.strictEqual(parseAplWaitTime('By Appointment'), 'Appointments Only');
  });

  it('maps Not Available and synonyms without collapsing to Closed', () => {
    assert.strictEqual(parseAplWaitTime('Not Available'), 'Not Available');
    assert.strictEqual(parseAplWaitTime('n/a'), 'Not Available');
    assert.strictEqual(parseAplWaitTime('N/A'), 'Not Available');
    assert.strictEqual(parseAplWaitTime('unavailable'), 'Not Available');
    assert.strictEqual(parseAplWaitTime(''), 'Not Available');
    assert.strictEqual(parseAplWaitTime(null), 'Not Available');
    assert.strictEqual(parseAplWaitTime('???'), 'Not Available');
  });

  it('parses numeric wait strings including hours', () => {
    assert.strictEqual(parseAplWaitTime('45 min'), 45);
    assert.strictEqual(parseAplWaitTime('1 hr 30 min'), 90);
    assert.strictEqual(parseAplWaitTime('2 hr'), 120);
    assert.strictEqual(parseAplWaitTime('90+ min'), 90);
  });
});

describe('lab wait unavailable helpers', () => {
  it('detects string sentinels including Not Available', () => {
    assert.strictEqual(isLabWaitSentinel('Closed'), true);
    assert.strictEqual(isLabWaitSentinel('Appointments Only'), true);
    assert.strictEqual(isLabWaitSentinel('Not Available'), true);
    assert.strictEqual(isLabWaitSentinel(12), false);
    assert.strictEqual(isLabWaitSentinel('Open'), false);
  });

  it('treats Not Available as unavailable with No Estimate label, not closed detail', () => {
    const lab = { waitTimeMin: 'Not Available' as const, walkInAvailable: true };
    assert.strictEqual(isLabWaitUnavailable(lab), true);
    assert.strictEqual(unavailableWaitLabel(lab), 'No Estimate');
    assert.strictEqual(labWaitBand(lab), 'unavailable');
    assert.match(labWaitUnavailableDetail(lab), /not available/i);
    assert.doesNotMatch(labWaitUnavailableDetail(lab), /closed/i);
  });

  it('keeps Closed and Appointments Only labels distinct', () => {
    assert.strictEqual(unavailableWaitLabel({ waitTimeMin: 'Closed', walkInAvailable: false }), 'Closed');
    assert.strictEqual(labWaitBand({ waitTimeMin: 'Closed', walkInAvailable: false }), 'closed');
    assert.strictEqual(unavailableWaitLabel({ waitTimeMin: 'Appointments Only', walkInAvailable: false }), 'Appointments Only');
    assert.strictEqual(labWaitBand({ waitTimeMin: 'Appointments Only', walkInAvailable: false }), 'unavailable');
    assert.match(labWaitUnavailableDetail({ waitTimeMin: 'Appointments Only', walkInAvailable: false }), /appointment/i);
  });

  it('treats zero wait with no walk-in as unavailable Closed', () => {
    const lab = { waitTimeMin: 0, walkInAvailable: false };
    assert.strictEqual(isLabWaitUnavailable(lab), true);
    assert.strictEqual(unavailableWaitLabel(lab), 'Closed');
    assert.strictEqual(labWaitBand(lab), 'unavailable');
  });

  it('keeps numeric walk-in waits available with wait bands', () => {
    assert.strictEqual(isLabWaitUnavailable({ waitTimeMin: 12, walkInAvailable: true }), false);
    assert.strictEqual(isLabWaitUnavailable({ waitTimeMin: 0, walkInAvailable: true }), false);
    assert.strictEqual(labWaitBand({ waitTimeMin: 12, walkInAvailable: true }), 'low');
    assert.strictEqual(labWaitBand({ waitTimeMin: 35, walkInAvailable: true }), 'moderate');
    assert.strictEqual(labWaitBand({ waitTimeMin: 50, walkInAvailable: true }), 'high');
  });
});
