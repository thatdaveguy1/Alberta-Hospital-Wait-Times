import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Filter,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Navigation,
  RefreshCw,
  Search,
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
import { WaitBandChip } from './WaitBandChip';
import type { DataMetadataMap } from './DataTimestamp';
import { calculateDistance, isRoughlyInAlberta, loadSavedLocation, saveLocation, type UserLocation } from '../lib/geo';
import {
  LocationUnavailableModal,
  useLocationUnavailableModal,
} from './LocationUnavailableModal';
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
  shortHospitalName,
  type CareType,
  type EnrichedHospital,
  type WaitBand,
} from '../lib/erFacility';
import { cn, formatMinutesToHm } from '../lib/utils';
import { formatRelativeTime, useSyncStatus } from '../hooks/useSyncStatus';
import type { Hospital, WaitTimeSnapshot } from '../types';

type ViewMode = 'me' | 'system';
type SortKey = 'net-wait' | 'proximity' | 'raw-wait';
type CareFilter = 'all' | CareType;

type MaxPeak = { waitTime: number; hospitalName: string; timestamp: string } | null;
type MaxStats = { max24h: MaxPeak; max7d: MaxPeak; max30d: MaxPeak };

/** Bump when verifying LAN deploy — shown in the decision bar. */
const ER_UI_BUILD = '2026-07-19-clinical-ledger';
const POLL_MS = 60_000;
/** Feed older than this triggers the stale-data banner. */
const STALE_AFTER_MS = 20 * 60_000;

const bandTextTone: Record<WaitBand, string> = {
  low: 'text-ok',
  moderate: 'text-warn',
  high: 'text-crit',
  closed: 'text-ink-3',
  unavailable: 'text-ink-3',
};

/* Recharts props can't consume CSS vars — chart literals live here only. */
const CHART_GRID = '#e3e7ee';
const CHART_TICK = '#64748b';
const CHART_ACCENT = '#0b5cad';
const CHART_REF = '#94a3b8';

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

export interface ErWaitDashboardProps {
  /** Set by the app shell when another surface requests a specific facility. */
  requestedFacilityId?: string | null;
  onRequestedFacilityHandled?: () => void;
}

export default function ErWaitDashboard({
  requestedFacilityId = null,
  onRequestedFacilityHandled,
}: ErWaitDashboardProps = {}) {
  const { syncStatus } = useSyncStatus();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
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
  const [zoneTrends, setZoneTrends] = useState<Array<Record<string, string | number>>>([]);
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
        setFetchError(false);
      } else {
        setHospitals([]);
        setFetchError(false);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals', error);
      setFetchError(true);
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
      setGeocodingError(geoErrorMessage(null, insecure || !navigator.geolocation));
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

  const driveEnabled = Boolean(
    userLocation && isRoughlyInAlberta(userLocation.lat, userLocation.lng),
  );
  const { open: locationUnavailableOpen, dismiss: dismissLocationUnavailable } =
    useLocationUnavailableModal(userLocation);

  // OSRM for nearby sites (Alberta pins only — skip absurd cross-border drives)
  useEffect(() => {
    if (!driveEnabled || !userLocation || hospitals.length === 0) {
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
  }, [driveEnabled, userLocation, hospitals]);

  useEffect(() => {
    fetchZoneTrends(zoneRange);
  }, [zoneRange, fetchZoneTrends]);

  useEffect(() => {
    if (selectedHospitalId) fetchTrends(selectedHospitalId, hospitalRange);
  }, [selectedHospitalId, hospitalRange, fetchTrends]);

  // External facility requests (app shell: command palette, deep links).
  useEffect(() => {
    if (!requestedFacilityId || hospitals.length === 0) return;
    userPickedHospitalRef.current = true;
    setViewMode('me');
    setSelectedHospitalId(requestedFacilityId);
    setSheetOpen(true);
    onRequestedFacilityHandled?.();
  }, [requestedFacilityId, hospitals.length, onRequestedFacilityHandled]);

  const processed = useMemo(() => {
    return hospitals.map((h) => {
      const base = enrichHospital(h);
      let distance: number | undefined;
      let driveMins: number | undefined;
      if (driveEnabled && userLocation && h.latitude != null && h.longitude != null) {
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
  }, [hospitals, userLocation, osrmData, driveEnabled]);

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
      if (driveEnabled) return h.distance != null && h.distance < 150;
      return true;
    });
    return [...pool]
      .sort((a, b) => {
        if (driveEnabled && a.driveMins != null && b.driveMins != null) {
          return a.driveMins + (a.effectiveWaitMinutes ?? 0) - (b.driveMins + (b.effectiveWaitMinutes ?? 0));
        }
        return (a.effectiveWaitMinutes ?? 0) - (b.effectiveWaitMinutes ?? 0);
      })
      .slice(0, 3);
  }, [processed, driveEnabled]);

  const selected = useMemo(
    () => processed.find((h) => h.id === selectedHospitalId) ?? ranked[0] ?? null,
    [processed, selectedHospitalId, ranked],
  );

  // Prefer nearest when location is known; otherwise auto-select the top ranked site
  // so detail sheet + trends load even without GPS.
  useEffect(() => {
    if (processed.length === 0) return;
    if (userPickedHospitalRef.current) return;

    if (driveEnabled) {
      const nearest = [...processed]
        .filter((h) => h.latitude != null && h.longitude != null && h.distance != null)
        .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))[0];

      if (nearest && nearest.id !== selectedHospitalId) {
        setSelectedHospitalId(nearest.id);
        return;
      }
    }

    if (!selectedHospitalId && ranked[0]) {
      setSelectedHospitalId(ranked[0].id);
    }
  }, [driveEnabled, processed, selectedHospitalId, ranked]);

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

  const isStaleData = useMemo(() => {
    void clockMin;
    if (lastUpdated == null) return false;
    return Date.now() - new Date(lastUpdated).getTime() > STALE_AFTER_MS;
  }, [lastUpdated, clockMin]);

  // Always plot every facility with coords so city framing can show peers.
  const mapHospitals = useMemo(
    () =>
      processed
        .filter((h) => h.latitude != null && h.longitude != null)
        .map((h) => ({
          ...h,
          status:
            h.openState === 'closed' || h.effectiveWaitMinutes === null
              ? ('Green' as const)
              : h.status,
        })),
    [processed],
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

  const topPick = topThree[0] ?? null;
  const runnerUp = topThree[1] ?? null;

  return (
    <div className="space-y-4">
      <DashboardHeader
        icon={Activity}
        title="Emergency wait times"
        description="Find the fastest path from where you are to a doctor — drive time plus AHS queue estimates (refreshed every ~10 min)."
        metadata={headerMetadata}
        arrayKey="ER_WAIT_TIMES"
        variant="light"
      />

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Unable to refresh live ER wait times. Showing last received data.</span>
        </div>
      )}

      {isStaleData && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>ER data may be stale — last update {formatRelativeTime(lastUpdated)}.</span>
        </div>
      )}

      {/* Decision bar */}
      <div className="sticky top-16 z-20">
        <div className="rounded-xl border border-line bg-surface shadow-sm">
          <div className="flex flex-col gap-3 p-3 sm:p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocationPanelOpen((v) => !v)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                    userLocation
                      ? 'border-line bg-surface text-ink-2 hover:border-line-2'
                      : 'border-line bg-accent-soft text-accent-strong hover:bg-accent-soft/70',
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="max-w-[12rem] truncate sm:max-w-[16rem]">
                    {loadingGeo
                      ? 'Finding you…'
                      : userLocation
                        ? `Near ${userLocation.city}`
                        : 'Set location'}
                  </span>
                  <span className="text-ink-3">{userLocation ? 'Change' : ''}</span>
                </button>

                <div className="inline-flex rounded-lg border border-line bg-paper p-0.5" role="tablist" aria-label="View">
                  {(
                    [
                      ['me', 'Near you'],
                      ['system', 'Provincial picture'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={viewMode === id}
                      onClick={() => setViewMode(id)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                        viewMode === id
                          ? 'bg-accent text-white'
                          : 'text-ink-2 hover:text-ink',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 font-medium text-ok">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
                  {freshness}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-ink-3" title="UI bundle id">
                  · {ER_UI_BUILD}
                </span>
              </div>
            </div>

            {viewMode === 'me' && userLocation && topPick && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="text-xs text-ink-3">Fastest for you now</p>
                  <p className="truncate text-lg font-semibold text-ink sm:text-xl">
                    {shortHospitalName(topPick.name)}
                  </p>
                  <p className="text-xs text-ink-3">
                    {topPick.city} · {careTypeLabel(topPick.careType)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-mono text-3xl tabular-nums text-ink">
                    {formatMinutesToHm(
                      (topPick.effectiveWaitMinutes ?? 0) +
                        (driveEnabled && topPick.driveMins != null ? topPick.driveMins : 0),
                    )}
                  </p>
                  <div className="space-y-1">
                    <WaitBandChip band={topPick.waitBand} />
                    <p className="text-xs tabular-nums text-ink-3">
                      {driveEnabled && topPick.driveMins != null
                        ? `Drive + wait · wait ${formatMinutesToHm(topPick.effectiveWaitMinutes ?? 0)}`
                        : 'Wait'}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {runnerUp && (
                    <p className="hidden text-xs text-ink-3 md:block">
                      Next best:{' '}
                      <span className="font-medium text-ink-2">
                        {shortHospitalName(runnerUp.name)} ·{' '}
                        {formatMinutesToHm(
                          (runnerUp.effectiveWaitMinutes ?? 0) +
                            (driveEnabled && runnerUp.driveMins != null ? runnerUp.driveMins : 0),
                        )}
                      </span>
                    </p>
                  )}
                  <a
                    href={directionsUrl(topPick)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
                  >
                    <Navigation className="h-4 w-4" aria-hidden />
                    Directions
                  </a>
                </div>
              </div>
            )}

            {viewMode === 'me' && userLocation && !topPick && !loading && (
              <p className="border-t border-line pt-3 text-sm text-ink-2">
                No open facilities with live waits near you right now.
              </p>
            )}

            {viewMode === 'me' && !userLocation && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Set your location to find the fastest ER</p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Combines drive time with live queue estimates. Stored only in this browser.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={requestGPSLocation}
                    disabled={loadingGeo}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60 cursor-pointer"
                  >
                    <Compass className={cn('h-3.5 w-3.5', loadingGeo && 'animate-spin')} aria-hidden />
                    {loadingGeo ? 'Detecting…' : 'Use my location'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocationPanelOpen(true)}
                    className="rounded-lg border border-line-2 bg-surface px-3.5 py-2 text-xs font-semibold text-ink transition-colors hover:bg-paper cursor-pointer"
                  >
                    Enter city or postal code
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {locationPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 rounded-lg border border-line bg-paper p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="pr-2 text-xs font-medium leading-snug text-ink-2">
                        Location ranks sites by drive + wait. Stored only in this browser.
                      </p>
                      <button
                        type="button"
                        onClick={() => setLocationPanelOpen(false)}
                        className="shrink-0 rounded-md p-1.5 text-ink-3 transition-colors hover:bg-neutral-chip hover:text-ink cursor-pointer"
                        aria-label="Close location panel"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={requestGPSLocation}
                        disabled={loadingGeo}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-xs font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60 cursor-pointer"
                      >
                        <Compass className={cn('h-4 w-4', loadingGeo && 'animate-spin')} aria-hidden />
                        {loadingGeo ? 'Detecting…' : 'Use current location'}
                      </button>
                      {userLocation && (
                        <button
                          type="button"
                          onClick={clearLocation}
                          className="h-9 w-full rounded-lg border border-line-2 bg-surface text-xs font-semibold text-ink-2 transition-colors hover:bg-paper cursor-pointer"
                        >
                          Clear location ({userLocation.city})
                        </button>
                      )}
                    </div>

                    <div className="relative flex items-center justify-center py-0.5">
                      <div className="absolute inset-x-0 top-1/2 border-t border-line" />
                      <span className="relative bg-paper px-2 text-xs text-ink-3">or enter a place</span>
                    </div>

                    <form onSubmit={handleAddressSubmit} className="space-y-2">
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
                        <input
                          value={addressInput}
                          onChange={(e) => setAddressInput(e.target.value)}
                          placeholder="City or postal code (e.g. St. Albert, T8N)"
                          className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isGeocoding || !addressInput.trim()}
                        className="h-10 w-full rounded-lg bg-accent text-xs font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60 cursor-pointer"
                      >
                        {isGeocoding ? 'Looking up…' : 'Set location'}
                      </button>
                    </form>

                    {geocodingError && <p className="text-xs leading-snug text-crit">{geocodingError}</p>}
                    {gpsRefused && !userLocation && (
                      <p className="text-xs leading-snug text-ink-3">
                        GPS blocked or unavailable — a city or postal code works just as well.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="border-t border-line pt-2.5 text-xs text-ink-3">
              In a life-threatening emergency, call{' '}
              <strong className="font-semibold text-ink">911</strong> — estimates are unofficial AHS
              queue guidance.
            </p>
          </div>
        </div>
      </div>

      {viewMode === 'me' ? (
        <>
          {/* Top 3 */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {driveEnabled ? 'Fastest path to a doctor' : 'Shortest live waits'}
                </h3>
                <p className="mt-0.5 text-xs text-ink-3">
                  {driveEnabled
                    ? 'Ranked by drive time + current queue estimate within ~150 km.'
                    : userLocation
                      ? 'Drive times are Alberta-only — ranked by live wait.'
                      : 'Set a location to include driving time in the ranking.'}
                </p>
              </div>
              <span className="hidden font-mono text-xs tabular-nums text-ink-3 sm:inline">
                {openSites.length} open · {pressure.closed} closed
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {loading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-xl border border-line bg-neutral-chip" />
                ))}
              {!loading && topThree.length === 0 && (
                <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3 md:col-span-3">
                  No open facilities match the current filters.
                </div>
              )}
              {topThree.map((h, i) => {
                const wait = h.effectiveWaitMinutes ?? 0;
                const total = driveEnabled && h.driveMins != null ? wait + h.driveMins : wait;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => selectHospital(h)}
                    className={cn(
                      'group rounded-xl border p-4 text-left transition-colors cursor-pointer',
                      i === 0
                        ? 'border-accent bg-accent-soft'
                        : 'border-line bg-surface hover:border-line-2',
                      selected?.id === h.id && 'ring-2 ring-accent/30',
                    )}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          i === 0 ? 'bg-accent text-white' : 'bg-neutral-chip text-ink-3',
                        )}
                      >
                        {i === 0 ? 'Best option' : `Option ${i + 1}`}
                      </span>
                      <WaitBandChip band={h.waitBand} />
                    </div>
                    <h4 className="text-sm font-semibold leading-snug text-ink group-hover:text-accent">
                      {h.name}
                    </h4>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {h.city} · {careTypeLabel(h.careType)}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="text-xs text-ink-3">
                          {driveEnabled && h.driveMins != null ? 'Drive + wait' : 'Wait'}
                        </p>
                        <p className="font-mono text-2xl tabular-nums text-ink">
                          {formatMinutesToHm(total)}
                        </p>
                      </div>
                      <div className="space-y-0.5 text-right font-mono text-xs tabular-nums text-ink-3">
                        <p>Wait {formatMinutesToHm(wait)}</p>
                        {driveEnabled && h.driveMins != null && (
                          <p>Drive {formatMinutesToHm(h.driveMins)}</p>
                        )}
                        {h.distance != null && <p>{h.distance} km</p>}
                      </div>
                    </div>
                    {(h.careType === 'pediatric-emergency' || h.ageMinYears != null) && (
                      <p className="mt-3 text-xs font-medium text-ink-2">{h.servesLabel}</p>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Map + sheet */}
          <section
            className={cn(
              'grid items-stretch gap-3',
              isMapFullscreen
                ? ''
                : 'grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] xl:min-h-[520px]',
            )}
          >
            <div
              className={cn(
                'flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-line bg-surface',
                !isMapFullscreen && 'xl:h-full',
                isMapFullscreen && 'fixed inset-0 z-[9999] rounded-none bg-paper p-3 sm:p-5',
              )}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <MapIcon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-ink">
                      {isMapFullscreen ? 'Map — fullscreen' : 'Map'}
                    </h3>
                    <p className="hidden text-xs text-ink-3 sm:block">
                      Pins coloured by queue. Tap a site for details.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapFullscreen((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-paper cursor-pointer"
                >
                  {isMapFullscreen ? (
                    <>
                      <Minimize2 className="h-3.5 w-3.5" aria-hidden /> Exit
                    </>
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden /> Fullscreen
                    </>
                  )}
                </button>
              </div>
              <div className={cn('er-map-slot', isMapFullscreen && 'er-map-slot--fullscreen')}>
                <MapComponent
                  hospitals={mapHospitals}
                  userLocation={userLocation}
                  selectedHospital={selected}
                  setSelectedHospital={selectHospital}
                  sortBy={sortBy}
                />
                {!isMapFullscreen && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] flex items-center justify-between gap-2 border-t border-line bg-surface/90 px-3 py-1.5 text-xs font-medium text-ink-3">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-ok" aria-hidden /> Quieter
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-warn" aria-hidden /> Busy
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-crit" aria-hidden /> Very busy
                    </span>
                  </div>
                )}
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
            <div className="space-y-2.5 rounded-xl border border-line bg-surface p-3">
              <div className="flex flex-col gap-2 lg:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search facility or city…"
                    className="h-10 w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                </div>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="h-10 cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
                  aria-label="Zone"
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
                  className="h-10 cursor-pointer rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-accent focus:outline-none"
                  aria-label="Sort order"
                >
                  <option value="net-wait">
                    {driveEnabled ? 'Sort: drive + wait' : 'Sort: wait time'}
                  </option>
                  <option value="proximity">Sort: nearest</option>
                  <option value="raw-wait">Sort: queue only</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-ink-3">
                  <Filter className="h-3 w-3" aria-hidden /> Type
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
                      'h-7 rounded-full border px-2.5 text-xs font-medium transition-colors cursor-pointer',
                      careFilter === id
                        ? 'border-accent bg-accent text-white'
                        : 'border-line-2 text-ink-2 hover:bg-paper',
                    )}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setOpenOnly((v) => !v)}
                  aria-pressed={openOnly}
                  className={cn(
                    'ml-1 h-7 rounded-full border px-2.5 text-xs font-medium transition-colors cursor-pointer',
                    openOnly
                      ? 'border-ok bg-ok text-white'
                      : 'border-line-2 text-ink-2 hover:bg-paper',
                  )}
                >
                  Open now
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-ink-3">
                Ranked facilities ({ranked.length})
              </h3>
              <p className="text-xs text-ink-3">
                {driveEnabled
                  ? 'Includes estimated drive time'
                  : userLocation
                    ? 'Wait order — drive times only in Alberta'
                    : 'Raw queue order — add location for drive + wait'}
              </p>
            </div>

            <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[72px] animate-pulse bg-neutral-chip/40" />
                ))}
              {!loading && ranked.length === 0 && (
                <div className="py-12 text-center text-sm text-ink-3">
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
                  hasLocation={!!driveEnabled}
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
      <LocationUnavailableModal
        open={locationUnavailableOpen}
        onDismiss={dismissLocationUnavailable}
      />
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
  const primary = showNet
    ? formatMinutesToHm(wait + h.driveMins!)
    : wait != null
      ? formatMinutesToHm(wait)
      : null;

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
        'flex w-full cursor-pointer items-center gap-3 px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:bg-accent-soft',
        selected
          ? 'bg-accent-soft'
          : h.openState === 'closed' || wait === null
            ? 'opacity-70 hover:bg-paper hover:opacity-100'
            : 'hover:bg-paper',
      )}
    >
      <div className="w-6 shrink-0 text-center">
        <span className="font-mono text-xs tabular-nums text-ink-3">{rank}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5">
          <h4 className="truncate text-sm font-semibold text-ink">{h.name}</h4>
          <span className="text-xs text-ink-3">{careTypeLabel(h.careType)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-3">
          <span>
            {h.city}
            {h.distance != null ? ` · ${h.distance} km` : ''}
          </span>
          <WaitBandChip band={h.waitBand} />
          {(h.careType === 'pediatric-emergency' || h.ageMinYears != null) && (
            <span className="font-medium text-ink-2">{h.servesLabel}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('font-mono text-lg tabular-nums', bandTextTone[h.waitBand])}>
          {primary ?? h.waitBand === 'closed' ? (primary ?? 'Closed') : primary}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">
          {showNet ? 'Drive + wait' : wait != null ? 'Wait' : h.openState === 'closed' ? 'Closed' : 'No data'}
        </p>
        {showNet && wait != null && (
          <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-3">
            {formatMinutesToHm(wait)} + {formatMinutesToHm(h.driveMins!)}
          </p>
        )}
      </div>
      <a
        href={directionsUrl(h)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hidden shrink-0 items-center gap-1 rounded-lg border border-line-2 bg-surface px-2 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft sm:inline-flex"
      >
        <Navigation className="h-3 w-3" aria-hidden /> Go
      </a>
    </div>
  );
}

function FacilityWaitTrendBlock({
  trends,
  loadingTrends,
  hospitalRange,
  setHospitalRange,
  facilityTrendStats,
}: {
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
}) {
  return (
    <div className="er-trend-panel rounded-lg border border-line bg-paper p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-ink-2">Wait trend</h4>
        <div className="flex rounded-lg border border-line bg-surface p-0.5">
          {['24h', '7d', '30D'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setHospitalRange(r)}
              className={cn(
                'cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
                hospitalRange === r ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink',
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
        {facilityTrendStats.avg != null && (
          <span>
            Avg ({trendRangeLabel(facilityTrendStats.rangeKey)}):{' '}
            <span className="font-mono tabular-nums text-ink">{formatMinutesToHm(facilityTrendStats.avg)}</span>
          </span>
        )}
        {facilityTrendStats.busiest && (
          <span>
            Busiest hour:{' '}
            <span className="font-mono tabular-nums text-ink">
              {facilityTrendStats.busiest.hourLabel} (~{formatMinutesToHm(facilityTrendStats.busiest.avgWaitMinutes)})
            </span>
          </span>
        )}
      </div>
      <div className="h-[120px] w-full rounded-lg border border-line bg-surface p-1">
        {loadingTrends ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin text-ink-3" aria-hidden />
          </div>
        ) : trends.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 4, right: 4, left: 0, bottom: 1 }}>
                <defs>
                  <linearGradient id="erFacilityWait" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_ACCENT} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_ACCENT} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(tick) => formatChartXAxis(tick, hospitalRange)}
                  stroke={CHART_GRID}
                  tick={{ fill: CHART_TICK, fontSize: 9 }}
                />
                <YAxis
                  width={36}
                  domain={facilityTrendStats.yDomain}
                  stroke={CHART_GRID}
                  tick={{ fill: CHART_TICK, fontSize: 9 }}
                  tickFormatter={(v) => formatMinutesToHm(Number(v))}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="chart-tooltip !p-2 text-xs">
                        <p className="chart-tooltip-value">
                          {formatMinutesToHm(Number(payload[0].value))}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                          {format(new Date(payload[0].payload.timestamp), 'MMM d, HH:mm')}
                        </p>
                      </div>
                    );
                  }}
                />
                {facilityTrendStats.avg != null && (
                  <ReferenceLine
                    y={facilityTrendStats.avg}
                    stroke={CHART_REF}
                    strokeDasharray="4 4"
                    label={{ value: 'Avg', position: 'insideTopRight', fill: CHART_TICK, fontSize: 8 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="waitTime"
                  stroke={CHART_ACCENT}
                  strokeWidth={2}
                  fill="url(#erFacilityWait)"
                  dot={trends.length <= 12 ? { r: 3, fill: CHART_ACCENT, strokeWidth: 0 } : false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {trends.length < 6 && (
              <p className="pt-1 text-center text-[10px] text-ink-3">
                {trends.length} sample{trends.length === 1 ? '' : 's'} — tap{' '}
                <strong className="text-accent">30D</strong> for full history.
              </p>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-ink-3">
            <TrendingUp className="mb-1 h-4 w-4" aria-hidden />
            <p className="text-xs">No trend samples yet</p>
          </div>
        )}
      </div>
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
      <div className="rounded-xl border border-dashed border-line-2 bg-surface p-8 text-center text-sm text-ink-3">
        Select a facility on the map or list.
      </div>
    );
  }

  const wait = h.effectiveWaitMinutes;
  const driveOk = Boolean(
    userLocation && isRoughlyInAlberta(userLocation.lat, userLocation.lng),
  );
  const net = driveOk && h.driveMins != null && wait != null ? wait + h.driveMins : null;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface xl:h-full',
        !open && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <WaitBandChip band={h.waitBand} />
            <span className="text-xs text-ink-3">{careTypeLabel(h.careType)}</span>
          </div>
          <h3 className="text-base font-semibold leading-snug text-ink">{h.name}</h3>
          <p className="mt-0.5 text-xs text-ink-3">
            {h.city}, {h.region}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-neutral-chip hover:text-ink xl:hidden cursor-pointer"
          aria-label="Collapse details"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-xs text-ink-3">Current wait</p>
            <p className={cn('mt-1 font-mono text-2xl tabular-nums', bandTextTone[h.waitBand])}>
              {wait != null ? formatMinutesToHm(wait) : '—'}
            </p>
            <p className="mt-1 text-xs text-ink-3">Registration → doctor (AHS)</p>
          </div>
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="text-xs text-ink-3">{net != null ? 'Drive + wait' : 'Distance'}</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
              {net != null ? formatMinutesToHm(net) : h.distance != null ? `${h.distance} km` : '—'}
            </p>
            <p className="mt-1 text-xs text-ink-3">
              {h.driveMins != null
                ? `~${formatMinutesToHm(h.driveMins)} drive`
                : driveOk
                  ? 'Routing…'
                  : userLocation
                    ? 'Wait only outside Alberta'
                    : 'Set location'}
            </p>
          </div>
        </div>

        <FacilityWaitTrendBlock
          trends={trends}
          loadingTrends={loadingTrends}
          hospitalRange={hospitalRange}
          setHospitalRange={setHospitalRange}
          facilityTrendStats={facilityTrendStats}
        />

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-neutral-chip px-2.5 py-1 text-xs font-medium text-ink-2">
            {h.servesLabel}
          </span>
          {h.openState === 'closed' && (
            <span className="rounded-full bg-neutral-chip px-2.5 py-1 text-xs font-medium text-ink-3">
              Closed now
            </span>
          )}
          {h.openState === 'open' && (
            <span className="rounded-full bg-ok-soft px-2.5 py-1 text-xs font-medium text-ok">Open</span>
          )}
        </div>

        {h.hoursSummary && (
          <div className="rounded-lg border border-line bg-paper p-3">
            <p className="mb-1 text-xs font-semibold text-ink-2">Hours / notes</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{h.hoursSummary}</p>
          </div>
        )}

        {h.address && (
          <a
            href={mapsPlaceUrl(h)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-ink-2 transition-colors hover:text-accent"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{h.address}</span>
          </a>
        )}

        <a
          href={directionsUrl(h)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          <Navigation className="h-4 w-4" aria-hidden /> Directions
        </a>
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
  zoneTrends: Array<Record<string, string | number>>;
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
          <div key={card.label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-ink-3">{card.label}</p>
            <p className="mt-1 font-mono text-2xl tabular-nums text-ink">{card.value}</p>
            <p className="mt-1 text-xs text-ink-3">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-3 text-xs font-semibold text-ink-2">Zone averages</p>
          <div className="space-y-2">
            {[
              ['Edmonton', pressure.edmontonAvg],
              ['Calgary', pressure.calgaryAvg],
              ['Rest of Alberta', pressure.restAvg],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between text-sm">
                <span className="text-ink-2">{label}</span>
                <span className="font-mono tabular-nums text-ink">
                  {formatAvgWaitDisplay(value as number, pressure.open)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4 lg:col-span-2">
          <p className="mb-3 text-xs font-semibold text-ink-2">Recorded peaks</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['24h', maxStats?.max24h],
                ['7d', maxStats?.max7d],
                ['30d', maxStats?.max30d],
              ] as const
            ).map(([label, peak]) => (
              <div key={label} className="rounded-lg border border-line bg-paper p-3 text-center">
                <p className="text-xs text-ink-3">{label}</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-crit">
                  {peak ? formatMinutesToHm(peak.waitTime) : '—'}
                </p>
                <p className="mt-1 truncate text-xs text-ink-3" title={peak?.hospitalName}>
                  {peak ? shortHospitalName(peak.hospitalName) : 'No data'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3.5">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-3" aria-hidden />
            <h3 className="text-sm font-semibold text-ink">Zone queue trends</h3>
          </div>
          <div className="flex self-start rounded-lg border border-line bg-paper p-0.5">
            {['24h', '7d', '30D'].map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setZoneRange(r)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  zoneRange === r ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink',
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(tick) => formatChartXAxis(tick, zoneRange)}
                  stroke={CHART_GRID}
                  tick={{ fill: CHART_TICK, fontSize: 10 }}
                />
                <YAxis stroke={CHART_GRID} tick={{ fill: CHART_TICK, fontSize: 10 }} unit="m" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="chart-tooltip max-w-xs space-y-1.5 text-xs">
                        <p className="chart-tooltip-title">
                          {format(new Date(payload[0].payload.timestamp), 'MMM d, h:mm a')}
                        </p>
                        {payload.map((series: { name?: string; color?: string; value?: number | string }) => (
                          <div key={series.name} className="chart-tooltip-row">
                            <span style={{ color: series.color || '#39465c' }} className="chart-tooltip-label">
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
                <Area type="monotone" name="Provincial Avg" dataKey="Provincial Avg" stroke="#475569" strokeDasharray="5 5" strokeWidth={2} fill="none" />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-ink-3">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
              Compiling zone trends…
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-3.5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Longest open queues right now</h3>
        <div className="divide-y divide-line rounded-lg border border-line">
          {rising.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => onSelect(h)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-paper"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{h.name}</p>
                <p className="text-xs text-ink-3">
                  {h.city} · {careTypeLabel(h.careType)}
                </p>
              </div>
              <span className={cn('font-mono text-base tabular-nums', bandTextTone[h.waitBand])}>
                {formatMinutesToHm(h.effectiveWaitMinutes ?? 0)}
              </span>
            </button>
          ))}
          {rising.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-3">No open sites with live waits.</p>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Tracking {processed.length} emergency & urgent-care sites · closed and unavailable excluded from averages
        </p>
      </div>
    </div>
  );
}
