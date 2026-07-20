import { describe, expect, it } from 'vitest';
import {
  nearestZonesForUser,
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
