import { describe, expect, it } from 'vitest';
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
    expect(zones).toEqual(['Calgary Zone']);
    expect(URBAN_ZONES.has(zones[0])).toBe(true);
  });

  it('limits Edmonton metro users to Edmonton Zone only', () => {
    const zones = nearestZonesForUser(53.55, -113.49, facilities);
    expect(zones).toEqual(['Edmonton Zone']);
  });

  it('gives rural Central users the nearest two zones', () => {
    const zones = nearestZonesForUser(52.27, -113.81, facilities);
    expect(zones).toHaveLength(2);
    expect(zones[0]).toBe('Central Zone');
    expect(zones[1]).not.toBe('Central Zone');
  });

  it('gives rural South users nearest two zones starting with South', () => {
    const zones = nearestZonesForUser(49.7, -112.84, facilities);
    expect(zones[0]).toBe('South Zone');
    expect(zones).toHaveLength(2);
  });

  it('ranks zones by proximity to the nearest facility in each zone', () => {
    const ranked = rankZonesByProximity(51.05, -114.07, facilities);
    expect(ranked[0].region).toBe('Calgary Zone');
    expect(ranked[0].distanceKm).toBeLessThan(ranked[1].distanceKm);
  });

  it('omits zones with no coordinates', () => {
    const ranked = rankZonesByProximity(51, -114, [
      { region: 'Calgary Zone', latitude: 51.05, longitude: -114.07 },
      { region: 'Ghost Zone' },
    ]);
    expect(ranked.map((z) => z.region)).toEqual(['Calgary Zone']);
  });
});


describe('near-you distance gates', () => {
  it('accepts Alberta coordinates and rejects Seattle', () => {
    expect(isRoughlyInAlberta(53.55, -113.49)).toBe(true);
    expect(isRoughlyInAlberta(51.05, -114.07)).toBe(true);
    expect(isRoughlyInAlberta(47.61, -122.33)).toBe(false); // Seattle
  });

  it('treats Seattle as too far for drive-inclusive near-you lists', () => {
    const nearest = nearestFacilityKm(47.61, -122.33, facilities);
    expect(nearest).not.toBeNull();
    expect(nearest!).toBeGreaterThan(NEAR_YOU_MAX_KM);
    expect(locationIsNearCare(47.61, -122.33, facilities)).toBe(false);
  });

  it('treats Edmonton as near care', () => {
    expect(locationIsNearCare(53.55, -113.49, facilities)).toBe(true);
    expect(nearestFacilityKm(53.55, -113.49, facilities)!).toBeLessThanOrEqual(NEAR_YOU_MAX_KM);
  });
});

describe('isDriveLocationUsable', () => {
  it('is true only for Alberta bbox pins', () => {
    expect(isDriveLocationUsable({ lat: 53.55, lng: -113.49 })).toBe(true);
    expect(isDriveLocationUsable({ lat: 51.05, lng: -114.07 })).toBe(true);
    expect(isDriveLocationUsable({ lat: 47.61, lng: -122.33 })).toBe(false); // Seattle
    expect(isDriveLocationUsable(null)).toBe(false);
    expect(isDriveLocationUsable(undefined)).toBe(false);
  });

  it('matches isRoughlyInAlberta for outside-AB IP acceptance gating', () => {
    // Outside-AB IP locations are kept (not nulled); drive usability still fails.
    const seattle = { lat: 47.61, lng: -122.33 };
    expect(isRoughlyInAlberta(seattle.lat, seattle.lng)).toBe(false);
    expect(isDriveLocationUsable(seattle)).toBe(false);
  });
});
