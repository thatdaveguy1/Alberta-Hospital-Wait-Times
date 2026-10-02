import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Hospital } from '../../src/types';
import {
  deriveCareType,
  deriveOpenState,
  effectiveWaitMinutes,
  enrichHospital,
  hospitalInCareScope,
  isWaitTimeUnavailable,
  moduleForCareType,
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
    assert.strictEqual(deriveOpenState(h), 'closed');
    assert.strictEqual(isWaitTimeUnavailable(h), true);
    assert.strictEqual(effectiveWaitMinutes(h), null);
    assert.strictEqual(waitBandFor(h), 'closed');
    assert.strictEqual(deriveCareType(h), 'urgent-care');
  });

  it('treats unavailable negative waits as null effective wait', () => {
    const h = hospital({
      id: 'innisfail',
      name: 'Innisfail Health Centre',
      waitTime: -1,
      waitTimeLabel: 'Wait times unavailable',
    });
    assert.strictEqual(isWaitTimeUnavailable(h), true);
    assert.strictEqual(effectiveWaitMinutes(h), null);
    assert.strictEqual(waitBandFor(h), 'unavailable');
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
    assert.strictEqual(enriched.careType, 'pediatric-emergency');
    assert.strictEqual(enriched.ageMaxYears, 17);
    assert.match(enriched.servesLabel, /17/);
    assert.strictEqual(enriched.effectiveWaitMinutes, 43);
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
    assert.strictEqual(deriveOpenState(h), 'open');
    assert.strictEqual(effectiveWaitMinutes(h), 326);
    assert.strictEqual(waitBandFor(h), 'high');
    assert.strictEqual(enrichHospital(h).ageMinYears, 15);
  });
});

describe('care scope routing', () => {
  it('includes UC category only on urgent-care scope', () => {
    const uc = hospital({
      id: 'cochrane-community-health-centre',
      name: 'Cochrane Community Health Centre',
      category: 'Urgent Care',
    });
    assert.strictEqual(hospitalInCareScope(uc, 'urgent-care'), true);
    assert.strictEqual(hospitalInCareScope(uc, 'emergency'), false);
  });

  it('emergency scope includes pediatric and adult ER, excludes UC', () => {
    const pediatric = hospital({
      id: 'ach',
      name: "Alberta Children's Hospital",
      note: 'Open 24 hours for patients 17 & under',
    });
    const adult = hospital({
      id: 'foothills',
      name: 'Foothills Medical Centre',
      note: 'Open 24 hours\nFor patients 15 and older',
    });
    const uc = hospital({
      id: 'sheldon-m-chumir-centre',
      name: 'Sheldon M. Chumir Centre',
      category: 'Urgent Care',
    });

    assert.strictEqual(hospitalInCareScope(pediatric, 'emergency'), true);
    assert.strictEqual(hospitalInCareScope(adult, 'emergency'), true);
    assert.strictEqual(hospitalInCareScope(uc, 'emergency'), false);
  });

  it('maps care types to dashboard modules', () => {
    assert.strictEqual(moduleForCareType('urgent-care'), 'urgent-care');
    assert.strictEqual(moduleForCareType('emergency'), 'er-waits');
    assert.strictEqual(moduleForCareType('pediatric-emergency'), 'er-waits');
  });

  it('matches known UC IDs on urgent-care scope when category is Urgent Care', () => {
    const knownUcIds = [
      'airdrie-community-health-centre',
      'cochrane-community-health-centre',
      'okotoks-health-and-wellness-centre',
      'sheldon-m-chumir-centre',
      'south-calgary-health-centre',
    ];
    for (const id of knownUcIds) {
      const h = hospital({ id, name: id, category: 'Urgent Care' });
      assert.strictEqual(hospitalInCareScope(h, 'urgent-care'), true);
      assert.strictEqual(hospitalInCareScope(h, 'emergency'), false);
    }
  });
});
