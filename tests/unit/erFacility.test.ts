import { describe, expect, it } from 'vitest';
import type { Hospital } from '../../src/types';
import {
  deriveCareType,
  deriveOpenState,
  effectiveWaitMinutes,
  enrichHospital,
  isWaitTimeUnavailable,
  waitBandFor,
} from '../../src/lib/erFacility';

function hospital(partial: Partial<Hospital> & Pick<Hospital, 'id' | 'name'>): Hospital {
  return {
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTime: 30,
    waitTimeLabel: '0 hr 30 min',
    status: 'Green',
    updatedAt: '2026-07-16T00:00:00.000Z',
    category: 'Emergency',
    ...partial,
  };
}

describe('erFacility model', () => {
  it('marks closed urgent care as closed, not a zero wait', () => {
    const h = hospital({
      id: 'cochrane',
      name: 'Cochrane Community Health Centre',
      category: 'Urgent Care',
      waitTime: 0,
      waitTimeLabel: 'Closed',
      note: '8 am – 10 pm',
      status: 'Green',
    });
    expect(deriveOpenState(h)).toBe('closed');
    expect(isWaitTimeUnavailable(h)).toBe(true);
    expect(effectiveWaitMinutes(h)).toBeNull();
    expect(waitBandFor(h)).toBe('closed');
    expect(deriveCareType(h)).toBe('urgent-care');
  });

  it('treats unavailable negative waits as null effective wait', () => {
    const h = hospital({
      id: 'innisfail',
      name: 'Innisfail Health Centre',
      waitTime: -1,
      waitTimeLabel: 'Wait times unavailable',
    });
    expect(isWaitTimeUnavailable(h)).toBe(true);
    expect(effectiveWaitMinutes(h)).toBeNull();
    expect(waitBandFor(h)).toBe('unavailable');
  });

  it('detects pediatric emergency from name and note', () => {
    const h = hospital({
      id: 'ach',
      name: "Alberta Children's Hospital",
      note: 'Open 24 hours for patients 17 & under (two adult family/support persons allowed)',
      waitTime: 43,
      waitTimeLabel: '0 hr 43 min',
    });
    const enriched = enrichHospital(h);
    expect(enriched.careType).toBe('pediatric-emergency');
    expect(enriched.ageMaxYears).toBe(17);
    expect(enriched.servesLabel).toMatch(/17/);
    expect(enriched.effectiveWaitMinutes).toBe(43);
  });

  it('keeps open adult ER waits in averages', () => {
    const h = hospital({
      id: 'foothills',
      name: 'Foothills Medical Centre',
      waitTime: 326,
      waitTimeLabel: '5 hr 26 min',
      status: 'Red',
      note: 'Open 24 hours<br />For patients 15 and older',
    });
    expect(deriveOpenState(h)).toBe('open');
    expect(effectiveWaitMinutes(h)).toBe(326);
    expect(waitBandFor(h)).toBe('high');
    expect(enrichHospital(h).ageMinYears).toBe(15);
  });
});
