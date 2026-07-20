// Shared geospatial helpers used across dashboards.

/** Haversine formula to compute great-circle distance in kilometers. */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

export interface UserLocation {
  lat: number;
  lng: number;
  city: string;
  region?: string;
  isGPS: boolean;
  /** How the coordinates were obtained — GPS preferred; IP is coarse fallback. */
  source?: 'gps' | 'ip' | 'manual' | 'saved';
}

export type AhsZone =
  | 'Calgary Zone'
  | 'Edmonton Zone'
  | 'Central Zone'
  | 'South Zone'
  | 'North Zone';

/** Dense metro zones — one zone is enough for local ER choice. */
export const URBAN_ZONES = new Set<string>(['Calgary Zone', 'Edmonton Zone']);

export interface ZoneDistance {
  region: string;
  distanceKm: number;
}

type Locatable = {
  region: string;
  latitude?: number;
  longitude?: number;
};

/** Max road-ish distance for home "near you" lists that include drive time. */
export const NEAR_YOU_MAX_KM = 150;

/**
 * Coarse Alberta bounding box (with a little border slack).
 * Outside-province pins (e.g. Seattle IP) are still returned from geo APIs so
 * the UI can show wait-only lists + a Location unavailable modal; they must not
 * feed OSRM / drive-ranked "near you" math.
 */
export function isRoughlyInAlberta(lat: number, lng: number): boolean {
  return lat >= 48.9 && lat <= 60.1 && lng >= -120.1 && lng <= -109.9;
}

/**
 * Whether a resolved pin may be used for drive-time ranking / OSRM.
 * Drive ranking requires the Alberta bbox. Home near-you lists should also
 * require `locationIsNearCare` before showing drive-inclusive headlines.
 */
export function isDriveLocationUsable(
  loc: Pick<UserLocation, 'lat' | 'lng'> | null | undefined,
): boolean {
  if (!loc) return false;
  return isRoughlyInAlberta(loc.lat, loc.lng);
}

/** Distance to the nearest geocoded facility, or null if none. */
export function nearestFacilityKm(
  lat: number,
  lng: number,
  facilities: Locatable[],
): number | null {
  let best: number | null = null;
  for (const f of facilities) {
    if (f.latitude == null || f.longitude == null) continue;
    const d = calculateDistance(lat, lng, f.latitude, f.longitude);
    if (best === null || d < best) best = d;
  }
  return best;
}

/** True when the user is close enough for drive-inclusive near-you ranking. */
export function locationIsNearCare(
  lat: number,
  lng: number,
  facilities: Locatable[],
  maxKm: number = NEAR_YOU_MAX_KM,
): boolean {
  const nearest = nearestFacilityKm(lat, lng, facilities);
  return nearest !== null && nearest <= maxKm;
}

/**
 * Rank AHS zones by distance from the user to the nearest facility in each zone.
 * Zones with no geocoded facilities are omitted.
 */
export function rankZonesByProximity(
  lat: number,
  lng: number,
  facilities: Locatable[],
): ZoneDistance[] {
  const best = new Map<string, number>();
  for (const f of facilities) {
    if (!f.region || f.latitude == null || f.longitude == null) continue;
    const d = calculateDistance(lat, lng, f.latitude, f.longitude);
    const prev = best.get(f.region);
    if (prev === undefined || d < prev) best.set(f.region, d);
  }
  return [...best.entries()]
    .map(([region, distanceKm]) => ({ region, distanceKm }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Home / near-you lists: nearest zone only for Calgary & Edmonton metros;
 * nearest two zones for rural users (Central / South / North and anyone
 * whose closest zone is not an urban metro).
 */
export function nearestZonesForUser(
  lat: number,
  lng: number,
  facilities: Locatable[],
): string[] {
  const ranked = rankZonesByProximity(lat, lng, facilities);
  if (ranked.length === 0) return [];
  const nearest = ranked[0].region;
  if (URBAN_ZONES.has(nearest)) return [nearest];
  return ranked.slice(0, 2).map((z) => z.region);
}

const LOCAL_STORAGE_KEY = 'alberta_hospital_user_location';

/** Read the user's saved location from localStorage (set by the ER tab). */
export function loadSavedLocation(): UserLocation | null {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as UserLocation;
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number'
    ) {
      return parsed;
    }
  } catch {
    // Ignore corrupt localStorage entries.
  }
  return null;
}

/** Persist a user location to localStorage so all tabs share it. */
export function saveLocation(loc: UserLocation): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(loc));
}

/** Clear the shared saved location. */
export function clearSavedLocation(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

async function reverseGeocodeCity(
  lat: number,
  lng: number,
): Promise<{ city: string; region: string }> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      return {
        city: data?.city ? toTitleCase(String(data.city)) : 'Your location',
        region: data?.region ? String(data.region) : 'Alberta',
      };
    }
  } catch {
    // City label is cosmetic; coordinates still work.
  }
  return { city: 'Your location', region: 'Alberta' };
}

/** GPS via the browser Geolocation API. Returns null on denial / timeout / insecure context. */
export function requestGpsLocation(
  options: PositionOptions = {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 120000,
  },
): Promise<GeolocationPosition | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  const insecure =
    typeof window !== 'undefined' &&
    !window.isSecureContext &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  if (insecure) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      options,
    );
  });
}

/** Coarse IP-based location from the edge / server (`/api/geo/ip`). */
export async function fetchIpLocation(): Promise<UserLocation | null> {
  try {
    const res = await fetch('/api/geo/ip');
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.lat !== 'number' || typeof data?.lng !== 'number') return null;
    // Keep outside-Alberta IP pins (callers gate drive math with isDriveLocationUsable).
    return {
      lat: data.lat,
      lng: data.lng,
      city: data.city ? toTitleCase(String(data.city)) : 'Your area',
      region: data.region ? String(data.region) : undefined,
      isGPS: false,
      source: 'ip',
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the best available user location:
 * 1. GPS (precise) — preferred
 * 2. IP geolocation — fallback when GPS is unavailable / denied
 */
export async function resolveLocationGpsThenIp(): Promise<UserLocation | null> {
  const pos = await requestGpsLocation();
  if (pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const { city, region } = await reverseGeocodeCity(lat, lng);
    return { lat, lng, city, region, isGPS: true, source: 'gps' };
  }
  return fetchIpLocation();
}
