import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDriveLocationUsable,
  isRoughlyInAlberta,
  locationIsNearCare,
  nearestFacilityKm,
  nearestZonesForUser,
  NEAR_YOU_MAX_KM,
  rankZonesByProximity,
  URBAN_ZONES,
} from '../../src/lib/geo';

const facilities = [
  { region: 'Calgary Zone', latitude: 51.05, longitude: -114.07 },
  { region: 'Edmonton Zone', latitude: 53.55, longitude: -113.49 },
  { region: 'Central Zone', latitude: 52.27, longitude: -113.81 },
  { region: 'South Zone', latitude: 49.7, longitude: -112.84 },
  { region: 'North Zone', latitude: 55.17, longitude: -118.8 },
];

describe('nearestZonesForUser', () => {
  it('limits Calgary metro users to Calgary Zone only', () => {
    const zones = nearestZonesForUser(51.05, -114.07, facilities);
    assert.deepStrictEqual(zones, ['Calgary Zone']);
    assert.strictEqual(URBAN_ZONES.has(zones[0]), true);
  });

  it('limits Edmonton metro users to Edmonton Zone only', () => {
    const zones = nearestZonesForUser(53.55, -113.49, facilities);
    assert.deepStrictEqual(zones, ['Edmonton Zone']);
  });

  it('gives rural Central users the nearest two zones', () => {
    const zones = nearestZonesForUser(52.27, -113.81, facilities);
    assert.strictEqual(zones.length, 2);
    assert.strictEqual(zones[0], 'Central Zone');
    assert.notStrictEqual(zones[1], 'Central Zone');
  });

  it('gives rural South users nearest two zones starting with South', () => {
    const zones = nearestZonesForUser(49.7, -112.84, facilities);
    assert.strictEqual(zones[0], 'South Zone');
    assert.strictEqual(zones.length, 2);
  });

  it('ranks zones by proximity to the nearest facility in each zone', () => {
    const ranked = rankZonesByProximity(51.05, -114.07, facilities);
    assert.strictEqual(ranked[0].region, 'Calgary Zone');
    assert.ok(ranked[0].distanceKm < ranked[1].distanceKm);
  });

  it('omits zones with no coordinates', () => {
    const ranked = rankZonesByProximity(51, -114, [
      { region: 'Calgary Zone', latitude: 51.05, longitude: -114.07 },
      { region: 'Ghost Zone' },
    ]);
    assert.deepStrictEqual(ranked.map((z) => z.region), ['Calgary Zone']);
  });
});


describe('near-you distance gates', () => {
  it('accepts Alberta coordinates and rejects Seattle', () => {
    assert.strictEqual(isRoughlyInAlberta(53.55, -113.49), true);
    assert.strictEqual(isRoughlyInAlberta(51.05, -114.07), true);
    assert.strictEqual(isRoughlyInAlberta(47.61, -122.33), false); // Seattle
  });

  it('treats Seattle as too far for drive-inclusive near-you lists', () => {
    const nearest = nearestFacilityKm(47.61, -122.33, facilities);
    assert.notStrictEqual(nearest, null);
    assert.ok(nearest! > NEAR_YOU_MAX_KM);
    assert.strictEqual(locationIsNearCare(47.61, -122.33, facilities), false);
  });

  it('treats Edmonton as near care', () => {
    assert.strictEqual(locationIsNearCare(53.55, -113.49, facilities), true);
    assert.ok(nearestFacilityKm(53.55, -113.49, facilities)! <= NEAR_YOU_MAX_KM);
  });
});

describe('isDriveLocationUsable', () => {
  it('is true only for Alberta bbox pins', () => {
    assert.strictEqual(isDriveLocationUsable({ lat: 53.55, lng: -113.49 }), true);
    assert.strictEqual(isDriveLocationUsable({ lat: 51.05, lng: -114.07 }), true);
    assert.strictEqual(isDriveLocationUsable({ lat: 47.61, lng: -122.33 }), false); // Seattle
    assert.strictEqual(isDriveLocationUsable(null), false);
    assert.strictEqual(isDriveLocationUsable(undefined), false);
  });

  it('matches isRoughlyInAlberta for outside-AB IP acceptance gating', () => {
    // Outside-AB IP locations are kept (not nulled); drive usability still fails.
    const seattle = { lat: 47.61, lng: -122.33 };
    assert.strictEqual(isRoughlyInAlberta(seattle.lat, seattle.lng), false);
    assert.strictEqual(isDriveLocationUsable(seattle), false);
  });
});
