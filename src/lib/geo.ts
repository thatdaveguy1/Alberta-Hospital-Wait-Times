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
