import { describe, expect, it } from 'vitest';
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
    expect(parseAplWaitTime('Closed')).toBe('Closed');
    expect(parseAplWaitTime('Appointments Only')).toBe('Appointments Only');
    expect(parseAplWaitTime('By Appointment')).toBe('Appointments Only');
  });

  it('maps Not Available and synonyms without collapsing to Closed', () => {
    expect(parseAplWaitTime('Not Available')).toBe('Not Available');
    expect(parseAplWaitTime('n/a')).toBe('Not Available');
    expect(parseAplWaitTime('N/A')).toBe('Not Available');
    expect(parseAplWaitTime('unavailable')).toBe('Not Available');
    expect(parseAplWaitTime('')).toBe('Not Available');
    expect(parseAplWaitTime(null)).toBe('Not Available');
    expect(parseAplWaitTime('???')).toBe('Not Available');
  });

  it('parses numeric wait strings including hours', () => {
    expect(parseAplWaitTime('45 min')).toBe(45);
    expect(parseAplWaitTime('1 hr 30 min')).toBe(90);
    expect(parseAplWaitTime('2 hr')).toBe(120);
    expect(parseAplWaitTime('90+ min')).toBe(90);
  });
});

describe('lab wait unavailable helpers', () => {
  it('detects string sentinels including Not Available', () => {
    expect(isLabWaitSentinel('Closed')).toBe(true);
    expect(isLabWaitSentinel('Appointments Only')).toBe(true);
    expect(isLabWaitSentinel('Not Available')).toBe(true);
    expect(isLabWaitSentinel(12)).toBe(false);
    expect(isLabWaitSentinel('Open')).toBe(false);
  });

  it('treats Not Available as unavailable with No Estimate label, not closed detail', () => {
    const lab = { waitTimeMin: 'Not Available' as const, walkInAvailable: true };
    expect(isLabWaitUnavailable(lab)).toBe(true);
    expect(unavailableWaitLabel(lab)).toBe('No Estimate');
    expect(labWaitBand(lab)).toBe('unavailable');
    expect(labWaitUnavailableDetail(lab)).toMatch(/not available/i);
    expect(labWaitUnavailableDetail(lab)).not.toMatch(/closed/i);
  });

  it('keeps Closed and Appointments Only labels distinct', () => {
    expect(unavailableWaitLabel({ waitTimeMin: 'Closed', walkInAvailable: false })).toBe('Closed');
    expect(labWaitBand({ waitTimeMin: 'Closed', walkInAvailable: false })).toBe('closed');
    expect(
      unavailableWaitLabel({ waitTimeMin: 'Appointments Only', walkInAvailable: false }),
    ).toBe('Appointments Only');
    expect(
      labWaitBand({ waitTimeMin: 'Appointments Only', walkInAvailable: false }),
    ).toBe('unavailable');
    expect(
      labWaitUnavailableDetail({ waitTimeMin: 'Appointments Only', walkInAvailable: false }),
    ).toMatch(/appointment/i);
  });

  it('treats zero wait with no walk-in as unavailable Closed', () => {
    const lab = { waitTimeMin: 0, walkInAvailable: false };
    expect(isLabWaitUnavailable(lab)).toBe(true);
    expect(unavailableWaitLabel(lab)).toBe('Closed');
    expect(labWaitBand(lab)).toBe('unavailable');
  });

  it('keeps numeric walk-in waits available with wait bands', () => {
    expect(isLabWaitUnavailable({ waitTimeMin: 12, walkInAvailable: true })).toBe(false);
    expect(isLabWaitUnavailable({ waitTimeMin: 0, walkInAvailable: true })).toBe(false);
    expect(labWaitBand({ waitTimeMin: 12, walkInAvailable: true })).toBe('low');
    expect(labWaitBand({ waitTimeMin: 35, walkInAvailable: true })).toBe('moderate');
    expect(labWaitBand({ waitTimeMin: 50, walkInAvailable: true })).toBe('high');
  });
});
