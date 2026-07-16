import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Compass,
  Filter,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapComponent } from './MapComponent';
import { DashboardHeader } from './DashboardHeader';
import type { DataMetadataMap } from './DataTimestamp';
import { calculateDistance, loadSavedLocation, saveLocation, type UserLocation } from '../lib/geo';
import {
  averageFacilityWaitMinutes,
  busiestHourOfDay,
  facilityTrendYDomain,
  type BusiestHourResult,
} from '../lib/facilityWaitStats';
import {
  careTypeLabel,
  directionsUrl,
  enrichHospital,
  mapsPlaceUrl,
  type CareType,
  type EnrichedHospital,
  waitBandLabel,
} from '../lib/erFacility';
import { cn, formatMinutesToHm } from '../lib/utils';
import { formatRelativeTime, useSyncStatus } from '../hooks/useSyncStatus';
import type { Hospital, WaitTimeSnapshot } from '../types';

type ViewMode = 'me' | 'system';
type SortKey = 'net-wait' | 'proximity' | 'raw-wait';
type CareFilter = 'all' | CareType;

type MaxPeak = { waitTime: number; hospitalName: string; timestamp: string } | null;
type MaxStats = { max24h: MaxPeak; max7d: MaxPeak; max30d: MaxPeak };

const LOCATION_SKIP_KEY = 'alberta_hospital_location_prompt_dismissed';
const POLL_MS = 60_000;

const waitTone: Record<string, string> = {
  low: 'text-emerald-300',
  moderate: 'text-amber-300',
  high: 'text-rose-300',
  closed: 'text-slate-400',
  unavailable: 'text-slate-500',
};

const waitSurface: Record<string, string> = {
  low: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
  moderate: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
  high: 'bg-rose-500/10 border-rose-500/25 text-rose-300',
  closed: 'bg-slate-800/70 border-slate-700 text-slate-400',
  unavailable: 'bg-slate-900 border-slate-800 text-slate-500',
};

function normalizeTrendRange(range: string) {
  return range === '30D' ? '30d' : range;
}

function formatChartXAxis(tick: string, range: string) {
  try {
    const d = new Date(tick);
    const r = normalizeTrendRange(range);
    if (r === '24h') return format(d, 'HH:mm');
    if (r === '7d' || r === '30d') return format(d, 'MMM d');
    return format(d, 'MMM yy');
  } catch {
    return tick;
  }
}

function trendRangeLabel(range: string) {
  const r = normalizeTrendRange(range);
  if (r === '24h') return '24 hours';
  if (r === '7d') return '7 days';
  if (r === '30d') return '30 days';
  return r;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractCityFromDisplayName(displayName: string | undefined, fallback: string): string {
  if (!displayName) return toTitleCase(fallback);
  const parts = displayName.split(',').map((s) => s.trim());
  const albertaIdx = parts.findIndex((p) => p.toLowerCase() === 'alberta');
  if (albertaIdx > 0) return toTitleCase(parts[albertaIdx - 1]);
  if (parts.length >= 2) return toTitleCase(parts[parts.length - 2]);
  return toTitleCase(fallback);
}

function formatAvgWaitDisplay(minutes: number, validCount: number): string {
  if (validCount === 0) return '—';
  return formatMinutesToHm(minutes);
}

function shortHospitalName(name: string): string {
  return name
    .replace('Community Hospital', '')
    .replace('General Hospital', '')
    .replace('Health Centre', '')
    .replace('Regional Hospital', '')
    .replace('Regional Health Centre', '')
    .trim();
}

export default function ErWaitDashboard() {
  const { syncStatus } = useSyncStatus();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('me');
  const [search, setSearch] = useState('');
  const [careFilter, setCareFilter] = useState<CareFilter>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [sortBy, setSortBy] = useState<SortKey>('net-wait');
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  /** Once the user picks a facility, stop auto-jumping to nearest. */
  const userPickedHospitalRef = useRef(false);
  const [trends, setTrends] = useState<WaitTimeSnapshot[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [zoneTrends, setZoneTrends] = useState<any[]>([]);
  const [zoneRange, setZoneRange] = useState('24h');
  const [hospitalRange, setHospitalRange] = useState('24h');
  const [maxStats, setMaxStats] = useState<MaxStats | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);

  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [gpsRefused, setGpsRefused] = useState(false);
  const [locationPanelOpen, setLocationPanelOpen] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [geocodingError, setGeocodingError] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [osrmData, setOsrmData] = useState<Record<string, { durationMins: number; distanceKm: number }>>({});
  const [locationNudgeDismissed, setLocationNudgeDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(LOCATION_SKIP_KEY) === '1',
  );


  const fetchHospitals = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setLoading(true);
    try {
      const res = await fetch('/api/hospitals');
      const data = await res.json();
      if (Array.isArray(data)) {
        setHospitals((prev) => {
          // Skip state churn when the poll returns identical waits (reduces map/list flicker).
          if (
            prev.length === data.length &&
            prev.every((h, i) => {
              const n = data[i];
              return (
                h.id === n.id &&
                h.waitTime === n.waitTime &&
                h.waitTimeLabel === n.waitTimeLabel &&
                h.status === n.status &&
                h.updatedAt === n.updatedAt
              );
            })
          ) {
            return prev;
          }
          return data;
        });
      } else {
        setHospitals([]);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMaxStats = useCallback(async () => {
    try {
      const res = await fetch('/api/trends/max-stats');
      if (res.ok) setMaxStats(await res.json());
    } catch (err) {
      console.error('Failed to fetch max stats', err);
    }
  }, []);

  const fetchZoneTrends = useCallback(async (range: string) => {
    try {
      const res = await fetch(`/api/trends/zones?range=${range}`);
      const data = await res.json();
      if (Array.isArray(data)) setZoneTrends(data);
    } catch (error) {
      console.error('Failed to fetch zone trends', error);
    }
  }, []);

  const fetchTrends = useCallback(async (id: string, range: string) => {
    setLoadingTrends(true);
    const apiRange = normalizeTrendRange(range);
    try {
      const res = await fetch(`/api/trends/${encodeURIComponent(id)}?range=${encodeURIComponent(apiRange)}`);
      const data = await res.json();
      setTrends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch trends', error);
      setTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  const updateLocationWithCityName = useCallback(async (lat: number, lng: number, isGPS: boolean) => {
    const provisional: UserLocation = {
      lat,
      lng,
      city: 'Determining…',
      region: 'Alberta',
      isGPS,
    };
    setUserLocation(provisional);
    saveLocation(provisional);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.city) {
          const resolved: UserLocation = {
            lat,
            lng,
            city: toTitleCase(String(data.city)),
            region: data.region || 'Alberta',
            isGPS,
          };
          setUserLocation(resolved);
          saveLocation(resolved);
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to reverse geocode user coordinates:', err);
    }
    const fallback: UserLocation = { lat, lng, city: 'Your location', region: 'Alberta', isGPS };
    setUserLocation(fallback);
    saveLocation(fallback);
  }, []);

  const geoErrorMessage = (err: GeolocationPositionError | null, insecure: boolean) => {
    if (insecure) {
      return 'GPS needs a secure page (https:// or http://localhost). Use localhost, or enter a city/postal code below.';
    }
    if (!err) return 'Could not detect location. Enter a city or postal code instead.';
    if (err.code === err.PERMISSION_DENIED) {
      return 'Location permission blocked. Allow location for this site, or enter a city/postal code.';
    }
    if (err.code === err.TIMEOUT) {
      return 'Location timed out. Try again, or enter a city/postal code.';
    }
    return 'Could not detect location. Enter a city or postal code instead.';
  };

  const requestGPSLocation = useCallback(() => {
    setLoadingGeo(true);
    setGpsRefused(false);
    setGeocodingError('');

    const insecure =
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    if (insecure || !navigator.geolocation) {
      setGeocodingError(
        geoErrorMessage(null, insecure || !navigator.geolocation),
      );
      setGpsRefused(true);
      setLoadingGeo(false);
      setLocationPanelOpen(true);
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      updateLocationWithCityName(pos.coords.latitude, pos.coords.longitude, true);
      setGpsRefused(false);
      setGeocodingError('');
      setSortBy('net-wait');
      setLoadingGeo(false);
      setLocationPanelOpen(false);
    };

    const tryLowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (err) => {
          console.warn('GPS low-accuracy failed:', err);
          setGpsRefused(true);
          setGeocodingError(geoErrorMessage(err, false));
          setLoadingGeo(false);
          setLocationPanelOpen(true);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 },
      );
    };

    // High accuracy first (GPS); fall back to network location if it times out.
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        console.warn('GPS high-accuracy failed, retrying low-accuracy:', err);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsRefused(true);
          setGeocodingError(geoErrorMessage(err, false));
          setLoadingGeo(false);
          setLocationPanelOpen(true);
          return;
        }
        tryLowAccuracy();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [updateLocationWithCityName]);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    setIsGeocoding(true);
    setGeocodingError('');
    try {
      const inputTrimmed = addressInput.trim();
      const compactPostal = inputTrimmed.replace(/\s+/g, '').toUpperCase();
      const fsaFromFullPostal = /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compactPostal)
        ? compactPostal.slice(0, 3)
        : null;
      const fsaMatch =
        fsaFromFullPostal ??
        (inputTrimmed.match(/\b([a-zA-Z]\d[a-zA-Z])\b/) || inputTrimmed.match(/([a-zA-Z]\d[a-zA-Z])/))?.[1]?.toUpperCase() ??
        null;
      const fsa = fsaMatch;

      if (fsa) {
        try {
          const zipRes = await fetch(`https://api.zippopotam.us/ca/${fsa}`);
          if (zipRes.ok) {
            const zipData = await zipRes.json();
            if (zipData?.places?.length) {
              const place = zipData.places[0];
              const loc: UserLocation = {
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
                city: place['place name'],
                region: 'Alberta',
                isGPS: false,
              };
              setUserLocation(loc);
              saveLocation(loc);
              setSortBy('net-wait');
              setAddressInput('');
              setIsGeocoding(false);
              setLocationPanelOpen(false);
              return;
            }
          }
        } catch (zipErr) {
          console.warn('Zippopotam.us API error, falling back to Nominatim:', zipErr);
        }
      }

      const cleanQuery = fsa ? `${fsa}, Alberta, Canada` : `${inputTrimmed}, Alberta, Canada`;
      const query = encodeURIComponent(cleanQuery);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'AlbertaWaitTimesApp/1.0',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.length) {
          const result = data[0];
          const loc: UserLocation = {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            city: extractCityFromDisplayName(result.display_name, inputTrimmed),
            region: 'Alberta',
            isGPS: false,
          };
          setUserLocation(loc);
          saveLocation(loc);
          setSortBy('net-wait');
          setAddressInput('');
          setLocationPanelOpen(false);
        } else {
          setGeocodingError('Location not found. Try an Alberta city or postal code (e.g. Calgary, T2P 2M5).');
        }
      } else {
        setGeocodingError('Unable to reach location services. Try again.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setGeocodingError('Something went wrong looking up that location.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const clearLocation = () => {
    userPickedHospitalRef.current = false;
    setUserLocation(null);
    setOsrmData({});
    localStorage.removeItem('alberta_hospital_user_location');
  };

  const dismissLocationNudge = () => {
    localStorage.setItem(LOCATION_SKIP_KEY, '1');
    setLocationNudgeDismissed(true);
    setLocationPanelOpen(false);
    setGeocodingError('');
  };

  // Bootstrap data + location (no blocking modal)
  useEffect(() => {
    fetchHospitals();
    fetchMaxStats();
    const poll = setInterval(() => {
      fetchHospitals({ quiet: true });
      fetchMaxStats();
    }, POLL_MS);

    const saved = loadSavedLocation();
    if (saved && typeof saved.lat === 'number' && typeof saved.lng === 'number') {
      setUserLocation(saved);
      setSortBy('net-wait');
      if (
        saved.isGPS &&
        (saved.city === 'GPS Location' ||
          saved.city === 'My Precise GPS Location' ||
          saved.city === 'Determining...' ||
          saved.city === 'Determining…' ||
          saved.city === 'Alberta' ||
          saved.city === 'Your location')
      ) {
        updateLocationWithCityName(saved.lat, saved.lng, true);
      }
      return () => clearInterval(poll);
    }

    // Soft GPS only on secure contexts (localhost / https). LAN IP pages block geolocation.
    const canSoftGps =
      typeof navigator !== 'undefined' &&
      !!navigator.geolocation &&
      (window.isSecureContext ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    if (!canSoftGps) {
      setLoadingGeo(false);
      return () => clearInterval(poll);
    }

    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocationWithCityName(pos.coords.latitude, pos.coords.longitude, true);
        setSortBy('net-wait');
        setLoadingGeo(false);
      },
      () => {
        // Silent fail on autoload — user can still press "Use current location".
        setLoadingGeo(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );

    return () => clearInterval(poll);
  }, [fetchHospitals, fetchMaxStats, updateLocationWithCityName]);

  useEffect(() => {
    if (userLocation) saveLocation(userLocation);
  }, [userLocation]);

  // OSRM for nearby sites
  useEffect(() => {
    if (!userLocation || hospitals.length === 0) {
      setOsrmData({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      const results: Record<string, { durationMins: number; distanceKm: number }> = {};
      const nearby = hospitals.filter((h) => {
        if (h.latitude == null || h.longitude == null) return false;
        return calculateDistance(userLocation.lat, userLocation.lng, h.latitude, h.longitude) <= 100;
      });
      await Promise.all(
        nearby.map(async (h) => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${h.longitude},${h.latitude}?overview=false`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.[0]) {
              results[h.id] = {
                durationMins: Math.round(data.routes[0].duration / 60),
                distanceKm: parseFloat((data.routes[0].distance / 1000).toFixed(1)),
              };
            }
          } catch (e) {
            console.warn(`OSRM routing failed for ${h.name}:`, e);
          }
        }),
      );
      if (!cancelled) setOsrmData(results);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userLocation, hospitals]);

  useEffect(() => {
    fetchZoneTrends(zoneRange);
  }, [zoneRange, fetchZoneTrends]);

  useEffect(() => {
    if (selectedHospitalId) fetchTrends(selectedHospitalId, hospitalRange);
  }, [selectedHospitalId, hospitalRange, fetchTrends]);

  const processed = useMemo(() => {
    return hospitals.map((h) => {
      const base = enrichHospital(h);
      let distance: number | undefined;
      let driveMins: number | undefined;
      if (userLocation && h.latitude != null && h.longitude != null) {
        if (osrmData[h.id]) {
          distance = osrmData[h.id].distanceKm;
          driveMins = osrmData[h.id].durationMins;
        } else {
          distance = calculateDistance(userLocation.lat, userLocation.lng, h.latitude, h.longitude);
          driveMins = Math.round((distance / 85) * 60);
        }
      }
      return { ...base, distance, driveMins };
    });
  }, [hospitals, userLocation, osrmData]);

  const regions = useMemo(
    () => ['All', ...Array.from(new Set(processed.map((h) => h.region))).sort()],
    [processed],
  );

  const ranked = useMemo(() => {
    const q = search.trim().toLowerCase();
    return processed
      .filter((h) => {
        const matchesSearch =
          !q ||
          h.name.toLowerCase().includes(q) ||
          h.city.toLowerCase().includes(q) ||
          h.region.toLowerCase().includes(q);
        const matchesRegion = selectedRegion === 'All' || h.region === selectedRegion;
        const matchesCare = careFilter === 'all' || h.careType === careFilter;
        const matchesOpen = !openOnly || h.openState === 'open';
        return matchesSearch && matchesRegion && matchesCare && matchesOpen;
      })
      .sort((a, b) => {
        const aDead = a.effectiveWaitMinutes === null;
        const bDead = b.effectiveWaitMinutes === null;
        if (aDead && !bDead) return 1;
        if (!aDead && bDead) return -1;
        if (aDead && bDead) {
          if (a.distance != null && b.distance != null) return a.distance - b.distance;
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'net-wait') {
          if (a.driveMins != null && b.driveMins != null && a.effectiveWaitMinutes != null && b.effectiveWaitMinutes != null) {
            return a.driveMins + a.effectiveWaitMinutes - (b.driveMins + b.effectiveWaitMinutes);
          }
          return (a.effectiveWaitMinutes ?? 9999) - (b.effectiveWaitMinutes ?? 9999);
        }
        if (sortBy === 'proximity') {
          if (a.distance != null && b.distance != null) return a.distance - b.distance;
          if (a.distance != null) return -1;
          if (b.distance != null) return 1;
          return (a.effectiveWaitMinutes ?? 9999) - (b.effectiveWaitMinutes ?? 9999);
        }
        return (a.effectiveWaitMinutes ?? 9999) - (b.effectiveWaitMinutes ?? 9999);
      });
  }, [processed, search, selectedRegion, careFilter, openOnly, sortBy]);

  const topThree = useMemo(() => {
    const pool = processed.filter((h) => {
      if (h.effectiveWaitMinutes === null) return false;
      if (userLocation) return h.distance != null && h.distance < 150;
      return true;
    });
    return [...pool]
      .sort((a, b) => {
        if (userLocation && a.driveMins != null && b.driveMins != null) {
          return a.driveMins + (a.effectiveWaitMinutes ?? 0) - (b.driveMins + (b.effectiveWaitMinutes ?? 0));
        }
        return (a.effectiveWaitMinutes ?? 0) - (b.effectiveWaitMinutes ?? 0);
      })
      .slice(0, 3);
  }, [processed, userLocation]);

  const selected = useMemo(
    () => processed.find((h) => h.id === selectedHospitalId) ?? ranked[0] ?? null,
    [processed, selectedHospitalId, ranked],
  );

  // When location is known, prefer the nearest open site until the user picks one.
  useEffect(() => {
    if (!userLocation || processed.length === 0) return;
    if (userPickedHospitalRef.current) return;

    const nearest = [...processed]
      .filter((h) => h.latitude != null && h.longitude != null && h.distance != null)
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))[0];

    if (nearest && nearest.id !== selectedHospitalId) {
      setSelectedHospitalId(nearest.id);
    } else if (!selectedHospitalId && ranked[0]) {
      setSelectedHospitalId(ranked[0].id);
    }
  }, [userLocation, processed, selectedHospitalId, ranked]);

  const selectHospital = (h: { id: string }) => {
    userPickedHospitalRef.current = true;
    setSelectedHospitalId(h.id);
    setSheetOpen(true);
  };

  const facilityTrendStats = useMemo(() => {
    const avg = averageFacilityWaitMinutes(trends);
    const busiest = busiestHourOfDay(trends);
    const yDomain = facilityTrendYDomain(trends);
    return { avg, busiest, yDomain, rangeKey: normalizeTrendRange(hospitalRange) };
  }, [trends, hospitalRange]);

  const openSites = useMemo(
    () => processed.filter((h) => h.openState === 'open' && h.effectiveWaitMinutes != null),
    [processed],
  );
  const edmonton = openSites.filter((h) => h.city.toLowerCase() === 'edmonton');
  const calgary = openSites.filter((h) => h.city.toLowerCase() === 'calgary');
  const rest = openSites.filter(
    (h) => h.city.toLowerCase() !== 'edmonton' && h.city.toLowerCase() !== 'calgary',
  );
  const avg = (list: typeof openSites) =>
    list.length ? Math.round(list.reduce((s, h) => s + (h.effectiveWaitMinutes ?? 0), 0) / list.length) : 0;

  const pressure = {
    open: openSites.length,
    high: openSites.filter((h) => h.waitBand === 'high').length,
    closed: processed.filter((h) => h.openState === 'closed').length,
    unavailable: processed.filter((h) => h.waitBand === 'unavailable').length,
    provincialAvg: avg(openSites),
    edmontonAvg: avg(edmonton),
    calgaryAvg: avg(calgary),
    restAvg: avg(rest),
  };

  const lastUpdated = syncStatus?.erWaitTimesLastUpdate ?? null;
  const nextUpdate = syncStatus?.erWaitTimesNextUpdate ?? null;

  // Tick once a minute so relative labels stay fresh without re-rendering every parent update.
  const [clockMin, setClockMin] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = window.setInterval(() => setClockMin(Math.floor(Date.now() / 60_000)), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const freshness = useMemo(() => {
    void clockMin;
    if (lastUpdated != null) return `Updated ${formatRelativeTime(lastUpdated)}`;
    if (loading) return 'Loading live waits…';
    return 'Update time unknown';
  }, [lastUpdated, loading, clockMin]);

  const nextFresh = useMemo(() => {
    void clockMin;
    if (nextUpdate == null) return 'every ~10m';
    const mins = Math.max(0, Math.round((new Date(nextUpdate).getTime() - Date.now()) / 60_000));
    return mins <= 0 ? 'refreshing soon' : `next ~${mins}m`;
  }, [nextUpdate, clockMin]);

  const mapHospitals = useMemo(
    () =>
      ranked.map((h) => ({
        ...h,
        // Map colors: closed/unavailable render muted via status override
        status:
          h.openState === 'closed' || h.effectiveWaitMinutes === null
            ? ('Green' as const)
            : h.status,
      })),
    [ranked],
  );

  const headerMetadata = useMemo<DataMetadataMap>(
    () => ({
      ER_WAIT_TIMES: {
        source: 'Alberta Health Services Portal',
        sourceVintage: 'Live AHS feed (registration → physician assessment)',
        lastUpdated: lastUpdated ?? 'Unknown',
        updateType: 'auto',
      },
    }),
    [lastUpdated],
  );

  return (
    <div className="space-y-4">
      <DashboardHeader
        icon={Activity}
        title="Emergency wait times"
        description="Find the fastest path from where you are to a doctor — drive time plus live AHS queue estimates."
        metadata={headerMetadata}
        arrayKey="ER_WAIT_TIMES"
      />

      {/* Decision bar */}
      <div className="sticky top-[4.25rem] z-20 -mx-1 px-1">
        <div className="rounded-2xl border border-white/8 bg-[#0a1224]/95 backdrop-blur-xl shadow-xl shadow-black/30">
          <div className="flex flex-col gap-3 p-3 sm:p-3.5">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setLocationPanelOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                    userLocation
                      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/15'
                      : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-slate-500',
                  )}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate max-w-[12rem] sm:max-w-[16rem]">
                    {loadingGeo
                      ? 'Finding you…'
                      : userLocation
                        ? `Near ${userLocation.city}`
                        : 'Set location'}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                    {userLocation ? 'Change' : 'Optional'}
                  </span>
                </button>

                <div className="inline-flex rounded-full border border-slate-800 bg-slate-950 p-0.5">
                  {(
                    [
                      ['me', 'For me'],
                      ['system', 'Province'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewMode(id)}
                      className={cn(
                        'px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer',
                        viewMode === id
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 tabular-nums">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" aria-hidden />
                  {freshness}
                </span>
                <span className="hidden sm:inline text-slate-500">· {nextFresh}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-100/90">
              <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p>
                <span className="font-bold text-amber-200">Life-threatening?</span> Call{' '}
                <span className="font-black text-white">911</span> — do not use this page to choose a hospital.
                Estimates are unofficial AHS queue guidance only.
              </p>
            </div>

            <AnimatePresence initial={false}>
              {locationPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold text-slate-200 leading-snug pr-2">
                        Location ranks sites by drive + wait. Stored only in this browser.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLocationPanelOpen(false)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 cursor-pointer shrink-0"
                        aria-label="Close location panel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={requestGPSLocation}
                        disabled={loadingGeo}
                        className="w-full h-11 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-500/15 disabled:opacity-50 cursor-pointer"
                      >
                        <Compass className={cn('w-4 h-4', loadingGeo && 'animate-spin')} />
                        {loadingGeo ? 'Detecting…' : 'Use current location'}
                      </button>
                      {userLocation && (
                        <button
                          type="button"
                          onClick={clearLocation}
                          className="w-full h-10 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-xs font-bold hover:border-slate-500 cursor-pointer"
                        >
                          Clear location ({userLocation.city})
                        </button>
                      )}
                    </div>

                    <div className="relative flex items-center justify-center py-0.5">
                      <div className="absolute inset-x-0 top-1/2 border-t border-slate-800" />
                      <span className="relative px-2 bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        or enter a place
                      </span>
                    </div>

                    <form onSubmit={handleAddressSubmit} className="space-y-2">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          placeholder="City or postal code (e.g. St. Albert, T8N)"
                          className="w-full h-11 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isGeocoding || !addressInput.trim()}
                        className="w-full h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                      >
                        {isGeocoding ? 'Looking up…' : 'Set location'}
                      </button>
                    </form>

                    {geocodingError && <p className="text-[11px] text-rose-300 leading-snug">{geocodingError}</p>}
                    {gpsRefused && !userLocation && (
                      <p className="text-[11px] text-slate-500 leading-snug">
                        GPS blocked or unavailable — a city or postal code works just as well.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Soft location nudge — never modal */}
      {!userLocation && !locationNudgeDismissed && !locationPanelOpen && viewMode === 'me' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.07] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-50">Want the fastest option near you?</p>
            <p className="text-[11px] text-cyan-100/70 mt-0.5">
              Add a location to combine drive time with live waits. You can browse without it.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setLocationPanelOpen(true)}
              className="h-9 px-3 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black cursor-pointer"
            >
              Add location
            </button>
            <button
              type="button"
              onClick={dismissLocationNudge}
              className="h-9 px-3 rounded-xl border border-slate-700 text-slate-400 text-xs font-bold hover:text-slate-200 cursor-pointer"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {viewMode === 'me' ? (
        <>
          {/* Top 3 hero */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <h3 className="text-sm font-black tracking-tight text-white">
                    {userLocation ? 'Fastest path to a doctor' : 'Shortest live waits'}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {userLocation
                    ? 'Ranked by drive time + current queue estimate within ~150 km.'
                    : 'Set a location to include driving time in the ranking.'}
                </p>
              </div>
              <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">
                {openSites.length} open · {pressure.closed} closed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl border border-slate-800 bg-slate-900/40 animate-pulse" />
                ))}
              {!loading && topThree.length === 0 && (
                <div className="md:col-span-3 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 px-4 py-8 text-center text-sm text-slate-500">
                  No open facilities match the current filters.
                </div>
              )}
              {topThree.map((h, i) => {
                const wait = h.effectiveWaitMinutes ?? 0;
                const total =
                  userLocation && h.driveMins != null ? wait + h.driveMins : wait;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => selectHospital(h)}
                    className={cn(
                      'text-left rounded-2xl border p-4 transition-all cursor-pointer group',
                      i === 0
                        ? 'border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-slate-900/80 to-slate-950 shadow-lg shadow-cyan-950/30'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-600',
                      selected?.id === h.id && 'ring-2 ring-cyan-400/30',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <span
                        className={cn(
                          'text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full',
                          i === 0 ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400',
                        )}
                      >
                        {i === 0 ? 'Best option' : `Option ${i + 1}`}
                      </span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', waitSurface[h.waitBand])}>
                        {waitBandLabel(h.waitBand)}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white leading-snug group-hover:text-cyan-100">
                      {h.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {h.city} · {careTypeLabel(h.careType)}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          {userLocation && h.driveMins != null ? 'Drive + wait' : 'Wait'}
                        </p>
                        <p className="text-2xl font-black tracking-tight text-white tabular-nums">
                          {formatMinutesToHm(total)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400 font-mono space-y-0.5">
                        <p>Wait {formatMinutesToHm(wait)}</p>
                        {userLocation && h.driveMins != null && (
                          <p>Drive {formatMinutesToHm(h.driveMins)}</p>
                        )}
                        {h.distance != null && <p className="text-slate-500">{h.distance} km</p>}
                      </div>
                    </div>
                    {(h.careType === 'pediatric-emergency' || h.ageMinYears != null) && (
                      <p className="mt-3 text-[10px] font-semibold text-violet-300/90">{h.servesLabel}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Map + sheet */}
          <section
            className={cn(
              'grid gap-3',
              isMapFullscreen
                ? ''
                : 'grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]',
            )}
          >
            <div
              className={cn(
                'rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col',
                isMapFullscreen && 'fixed inset-0 z-[9999] rounded-none bg-slate-950 p-3 sm:p-5',
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3.5 py-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2 min-w-0">
                  <MapIcon className="w-4 h-4 text-cyan-300 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      {isMapFullscreen ? 'Map — fullscreen' : 'Map'}
                    </h3>
                    <p className="text-[10px] text-slate-500 hidden sm:block">
                      Pins coloured by queue. Tap a site for details.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                >
                  {isMapFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" /> Exit
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                    </>
                  )}
                </button>
              </div>
              <div className={cn('relative', isMapFullscreen ? 'flex-1 min-h-0' : 'h-[280px] sm:h-[340px]')}>
                <MapComponent
                  hospitals={mapHospitals}
                  userLocation={userLocation}
                  selectedHospital={selected}
                  setSelectedHospital={selectHospital}
                  sortBy={sortBy}
                />
              </div>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 border-t border-slate-800/80">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Quieter
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Busy
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> Very busy
                </span>
              </div>
            </div>

            {!isMapFullscreen && (
              <FacilitySheet
                hospital={selected}
                userLocation={userLocation}
                trends={trends}
                loadingTrends={loadingTrends}
                hospitalRange={hospitalRange}
                setHospitalRange={setHospitalRange}
                facilityTrendStats={facilityTrendStats}
                open={sheetOpen}
                onClose={() => setSheetOpen(false)}
              />
            )}
          </section>

          {/* Filters + ranked list */}
          <section className="space-y-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-3.5 space-y-3">
              <div className="flex flex-col lg:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search facility or city…"
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                  />
                </div>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="h-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 px-3 cursor-pointer"
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r === 'All' ? 'All zones' : r}
                    </option>
                  ))}
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortKey)}
                  className="h-10 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 px-3 cursor-pointer"
                >
                  <option value="net-wait">
                    {userLocation ? 'Sort: drive + wait' : 'Sort: wait time'}
                  </option>
                  <option value="proximity">Sort: nearest</option>
                  <option value="raw-wait">Sort: queue only</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500 font-bold mr-1">
                  <Filter className="w-3 h-3" /> Type
                </span>
                {(
                  [
                    ['all', 'All'],
                    ['emergency', 'ER'],
                    ['urgent-care', 'Urgent care'],
                    ['pediatric-emergency', 'Pediatric'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCareFilter(id)}
                    className={cn(
                      'h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer',
                      careFilter === id
                        ? 'bg-white text-slate-950 border-white'
                        : 'border-slate-700 text-slate-400 hover:text-slate-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOpenOnly((v) => !v)}
                  className={cn(
                    'h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ml-1',
                    openOnly
                      ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200',
                  )}
                >
                  Open now
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Ranked facilities ({ranked.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                {userLocation ? 'Includes estimated drive time' : 'Raw queue order — add location for drive + wait'}
              </p>
            </div>

            <div className="space-y-2">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-2xl border border-slate-800 bg-slate-900/30 animate-pulse" />
                ))}
              {!loading && ranked.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 py-12 text-center text-slate-500 text-sm">
                  No facilities match those filters.
                </div>
              )}
              {ranked.map((h, index) => (
                <FacilityRow
                  key={h.id}
                  hospital={h}
                  rank={index + 1}
                  selected={selected?.id === h.id}
                  sortBy={sortBy}
                  hasLocation={!!userLocation}
                  onSelect={() => selectHospital(h)}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        <SystemMode
          pressure={pressure}
          maxStats={maxStats}
          zoneTrends={zoneTrends}
          zoneRange={zoneRange}
          setZoneRange={setZoneRange}
          openSites={openSites}
          processed={processed}
          onSelect={(h) => {
            selectHospital(h);
            setViewMode('me');
          }}
        />
      )}
    </div>
  );
}
type FacilityRowProps = {
  hospital: EnrichedHospital;
  rank: number;
  selected: boolean;
  sortBy: SortKey;
  hasLocation: boolean;
  onSelect: () => void;
  /** Present when used in list maps without full React type packages. */
  key?: string | number;
};

function FacilityRow({
  hospital: h,
  rank,
  selected,
  sortBy,
  hasLocation,
  onSelect,
}: FacilityRowProps) {
  const wait = h.effectiveWaitMinutes;
  const showNet = hasLocation && h.driveMins != null && wait != null && sortBy !== 'raw-wait';
  const primary =
    showNet ? formatMinutesToHm(wait + h.driveMins!) : wait != null ? formatMinutesToHm(wait) : waitBandLabel(h.waitBand);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'w-full text-left rounded-2xl border px-3.5 py-3 flex items-center gap-3 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/40',
        selected
          ? 'border-cyan-400/40 bg-cyan-500/10'
          : h.openState === 'closed' || wait === null
            ? 'border-slate-800/60 bg-slate-950/40 opacity-80 hover:opacity-100'
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-600',
      )}
    >
      <div className="w-7 shrink-0 text-center">
        <span className="text-[11px] font-mono text-slate-500">{rank}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h4 className="text-sm font-bold text-white truncate">{h.name}</h4>
          <span className="text-[10px] font-semibold text-slate-500">{careTypeLabel(h.careType)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span>
            {h.city}
            {h.distance != null ? ` · ${h.distance} km` : ''}
          </span>
          <span className={cn('px-1.5 py-0.5 rounded-md border text-[10px] font-bold', waitSurface[h.waitBand])}>
            {waitBandLabel(h.waitBand)}
          </span>
          {(h.careType === 'pediatric-emergency' || h.ageMinYears != null) && (
            <span className="text-violet-300/90 font-semibold">{h.servesLabel}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-lg font-black tabular-nums tracking-tight', waitTone[h.waitBand])}>{primary}</p>
        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5">
          {showNet ? 'Drive + wait' : wait != null ? 'Wait' : h.openState === 'closed' ? 'Closed' : 'No data'}
        </p>
        {showNet && wait != null && (
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">
            {formatMinutesToHm(wait)} + {formatMinutesToHm(h.driveMins!)}
          </p>
        )}
      </div>
      <a
        href={directionsUrl(h)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] font-bold text-cyan-300 hover:border-cyan-500/40 cursor-pointer"
      >
        <Navigation className="w-3 h-3" /> Go
      </a>
    </div>
  );
}

function FacilitySheet({
  hospital: h,
  userLocation,
  trends,
  loadingTrends,
  hospitalRange,
  setHospitalRange,
  facilityTrendStats,
  open,
  onClose,
}: {
  hospital: EnrichedHospital | null;
  userLocation: UserLocation | null;
  trends: WaitTimeSnapshot[];
  loadingTrends: boolean;
  hospitalRange: string;
  setHospitalRange: (r: string) => void;
  facilityTrendStats: {
    avg: number | null;
    busiest: BusiestHourResult | null;
    yDomain: [number, number | 'auto'];
    rangeKey: string;
  };
  open: boolean;
  onClose: () => void;
}) {
  if (!h) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-8 text-center text-slate-500 text-sm">
        Select a facility on the map or list.
      </div>
    );
  }

  const wait = h.effectiveWaitMinutes;
  const net =
    userLocation && h.driveMins != null && wait != null ? wait + h.driveMins : null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden flex flex-col',
        !open && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', waitSurface[h.waitBand])}>
              {waitBandLabel(h.waitBand)}
            </span>
            <span className="text-[10px] font-semibold text-slate-500">{careTypeLabel(h.careType)}</span>
          </div>
          <h3 className="text-base font-black text-white leading-snug">{h.name}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {h.city}, {h.region}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white xl:hidden cursor-pointer"
          aria-label="Collapse details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Current wait</p>
            <p className={cn('text-2xl font-black tabular-nums mt-1', waitTone[h.waitBand])}>
              {wait != null ? formatMinutesToHm(wait) : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Registration → doctor (AHS)</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {net != null ? 'Drive + wait' : 'Distance'}
            </p>
            <p className="text-2xl font-black tabular-nums mt-1 text-cyan-200">
              {net != null
                ? formatMinutesToHm(net)
                : h.distance != null
                  ? `${h.distance} km`
                  : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {h.driveMins != null
                ? `~${formatMinutesToHm(h.driveMins)} drive`
                : userLocation
                  ? 'Routing…'
                  : 'Set location'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1">
            {h.servesLabel}
          </span>
          {h.openState === 'closed' && (
            <span className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1">
              Closed now
            </span>
          )}
          {h.openState === 'open' && (
            <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2 py-1">
              Open
            </span>
          )}
        </div>

        {h.hoursSummary && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Hours / notes</p>
            <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-line">{h.hoursSummary}</p>
          </div>
        )}

        {h.address && (
          <a
            href={mapsPlaceUrl(h)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-[12px] text-slate-400 hover:text-cyan-300"
          >
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{h.address}</span>
          </a>
        )}

        <div className="flex gap-2">
          <a
            href={directionsUrl(h)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5"
          >
            <Navigation className="w-3.5 h-3.5" /> Directions
          </a>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Wait trend</h4>
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5">
              {['24h', '7d', '30D'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setHospitalRange(r)}
                  className={cn(
                    'px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider cursor-pointer',
                    hospitalRange === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 mb-2">
            {facilityTrendStats.avg != null && (
              <span>
                Avg ({trendRangeLabel(facilityTrendStats.rangeKey)}):{' '}
                <span className="text-slate-300 font-mono font-bold">
                  {formatMinutesToHm(facilityTrendStats.avg)}
                </span>
              </span>
            )}
            {facilityTrendStats.busiest && (
              <span>
                Busiest hour:{' '}
                <span className="text-slate-300 font-mono font-bold">
                  {facilityTrendStats.busiest.hourLabel} (~
                  {formatMinutesToHm(facilityTrendStats.busiest.avgWaitMinutes)})
                </span>
              </span>
            )}
          </div>
          <div className="h-28 rounded-xl border border-slate-800 bg-slate-950/70 p-1.5">
            {loadingTrends ? (
              <div className="h-full flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-cyan-500/50 animate-spin" />
              </div>
            ) : trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 4, right: 4, left: 0, bottom: 1 }}>
                  <defs>
                    <linearGradient id="erFacilityWait" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(tick) => formatChartXAxis(tick, hospitalRange)}
                    stroke="#334155"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                  />
                  <YAxis
                    width={30}
                    domain={facilityTrendStats.yDomain}
                    stroke="#334155"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    tickFormatter={(v) => formatMinutesToHm(Number(v))}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="chart-tooltip text-[10px] !p-2">
                          <p className="chart-tooltip-value !text-cyan-300">
                            {formatMinutesToHm(Number(payload[0].value))}
                          </p>
                          <p className="text-[8px] text-slate-500 font-mono mt-0.5">
                            {format(new Date(payload[0].payload.timestamp), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      );
                    }}
                  />
                  {facilityTrendStats.avg != null && (
                    <ReferenceLine
                      y={facilityTrendStats.avg}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      label={{ value: 'Avg', position: 'insideTopRight', fill: '#94a3b8', fontSize: 8 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="waitTime"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    fill="url(#erFacilityWait)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <TrendingUp className="w-4 h-4 mb-1" />
                <p className="text-[10px]">No trend samples yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemMode({
  pressure,
  maxStats,
  zoneTrends,
  zoneRange,
  setZoneRange,
  openSites,
  processed,
  onSelect,
}: {
  pressure: {
    open: number;
    high: number;
    closed: number;
    unavailable: number;
    provincialAvg: number;
    edmontonAvg: number;
    calgaryAvg: number;
    restAvg: number;
  };
  maxStats: MaxStats | null;
  zoneTrends: any[];
  zoneRange: string;
  setZoneRange: (r: string) => void;
  openSites: EnrichedHospital[];
  processed: EnrichedHospital[];
  onSelect: (h: EnrichedHospital) => void;
}) {
  const rising = [...openSites]
    .sort((a, b) => (b.effectiveWaitMinutes ?? 0) - (a.effectiveWaitMinutes ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Typical open-ER wait',
            value: formatAvgWaitDisplay(pressure.provincialAvg, pressure.open),
            hint: `${pressure.open} open sites`,
          },
          {
            label: 'Very busy sites',
            value: String(pressure.high),
            hint: 'High queue pressure',
          },
          {
            label: 'Closed now',
            value: String(pressure.closed),
            hint: 'Mostly limited-hour urgent care',
          },
          {
            label: 'No live data',
            value: String(pressure.unavailable),
            hint: 'Excluded from averages',
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{card.label}</p>
            <p className="text-2xl font-black text-white mt-1 tabular-nums">{card.value}</p>
            <p className="text-[11px] text-slate-500 mt-1">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-3">Zone averages</p>
          <div className="space-y-2">
            {[
              ['Edmonton', pressure.edmontonAvg],
              ['Calgary', pressure.calgaryAvg],
              ['Rest of Alberta', pressure.restAvg],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="font-mono font-bold text-white">
                  {formatAvgWaitDisplay(value as number, pressure.open)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 lg:col-span-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-3">
            Recorded peaks
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['24h', maxStats?.max24h],
                ['7d', maxStats?.max7d],
                ['30d', maxStats?.max30d],
              ] as const
            ).map(([label, peak]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">{label}</p>
                <p className="text-lg font-black text-rose-300 tabular-nums mt-1">
                  {peak ? formatMinutesToHm(peak.waitTime) : '—'}
                </p>
                <p className="text-[10px] text-slate-500 mt-1 truncate" title={peak?.hospitalName}>
                  {peak ? shortHospitalName(peak.hospitalName) : 'No data'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-300" />
            <h3 className="text-sm font-bold text-white">Zone queue trends</h3>
          </div>
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 self-start">
            {['24h', '7d', '30D'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setZoneRange(r)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-bold rounded-md uppercase tracking-wider cursor-pointer',
                  zoneRange === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-300',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="h-52">
          {zoneTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={zoneTrends}>
                <defs>
                  <linearGradient id="zCal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="zEdm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(tick) => formatChartXAxis(tick, zoneRange)}
                  stroke="#475569"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                />
                <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="m" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="chart-tooltip space-y-1.5 text-xs max-w-xs">
                        <p className="chart-tooltip-title">
                          {format(new Date(payload[0].payload.timestamp), 'MMM d, h:mm a')}
                        </p>
                        {payload.map((series: any) => (
                          <div key={series.name} className="chart-tooltip-row">
                            <span style={{ color: series.color || '#cbd5e1' }} className="chart-tooltip-label">
                              {series.name}:
                            </span>
                            <span className="chart-tooltip-value">
                              {formatMinutesToHm(Number(series.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Area type="monotone" name="Calgary Zone" dataKey="Calgary Zone" stroke="#3b82f6" strokeWidth={2} fill="url(#zCal)" />
                <Area type="monotone" name="Edmonton Zone" dataKey="Edmonton Zone" stroke="#10b981" strokeWidth={2} fill="url(#zEdm)" />
                <Area type="monotone" name="Central Zone" dataKey="Central Zone" stroke="#f59e0b" strokeWidth={2} fill="none" />
                <Area type="monotone" name="South Zone" dataKey="South Zone" stroke="#ec4899" strokeWidth={2} fill="none" />
                <Area type="monotone" name="North Zone" dataKey="North Zone" stroke="#8b5cf6" strokeWidth={2} fill="none" />
                <Area type="monotone" name="Provincial Avg" dataKey="Provincial Avg" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2} fill="none" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
              Compiling zone trends…
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5">
        <h3 className="text-sm font-bold text-white mb-3">Longest open queues right now</h3>
        <div className="space-y-2">
          {rising.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h)}
              className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-left hover:border-slate-600 cursor-pointer"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{h.name}</p>
                <p className="text-[11px] text-slate-500">
                  {h.city} · {careTypeLabel(h.careType)}
                </p>
              </div>
              <span className={cn('text-base font-black tabular-nums', waitTone[h.waitBand])}>
                {formatMinutesToHm(h.effectiveWaitMinutes ?? 0)}
              </span>
            </button>
          ))}
          {rising.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">No open sites with live waits.</p>
          )}
        </div>
        <p className="text-[11px] text-slate-600 mt-3">
          Tracking {processed.length} emergency & urgent-care sites · closed and unavailable excluded from averages
        </p>
      </div>
    </div>
  );
}
