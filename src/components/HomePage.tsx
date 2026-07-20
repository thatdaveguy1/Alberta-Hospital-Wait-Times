// HomePage — the front door. The hero is an answer: the state of Alberta ERs
// right now, the fastest path to care near you, active disruptions, and a
// data-first directory of every module.
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Map, Navigation, Search } from 'lucide-react';
import {
  CATEGORIES,
  CATEGORY_TITLE_BY_ID,
  DASHBOARDS,
  type DashboardId,
} from '../lib/dashboardRegistry';
import { dashboardMatchesSearch } from '../lib/dashboardModuleSearch';
import {
  enrichHospital,
  shortHospitalName,
  type EnrichedHospital,
} from '../lib/erFacility';
import {
  calculateDistance,
  clearSavedLocation,
  loadSavedLocation,
  nearestZonesForUser,
  resolveLocationGpsThenIp,
  saveLocation,
  type UserLocation,
} from '../lib/geo';
import { formatMinutesToHm } from '../lib/utils';
import { formatRelativeTime } from '../hooks/useSyncStatus';
import { WaitBandChip } from './WaitBandChip';
import type { Hospital, ServiceDisruption } from '../types';

interface HomePageProps {
  onNavigate: (id: DashboardId) => void;
}

type ScoredFacility = EnrichedHospital & {
  distance?: number;
  driveMins?: number;
  netScore: number;
};

function median(sortedNums: number[]): number | null {
  if (sortedNums.length === 0) return null;
  const mid = Math.floor(sortedNums.length / 2);
  return sortedNums.length % 2 === 0
    ? (sortedNums[mid - 1] + sortedNums[mid]) / 2
    : sortedNums[mid];
}

export default function HomePage({ onNavigate }: HomePageProps) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(() => loadSavedLocation());
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [locatingBootstrap, setLocatingBootstrap] = useState(() => !loadSavedLocation());
  const [osrmData, setOsrmData] = useState<Record<string, { durationMins: number; distanceKm: number }>>({});
  const [directoryQuery, setDirectoryQuery] = useState('');

  const load = () => {
    setLoading(true);
    setFetchError(false);
    fetch('/api/hospitals')
      .then((r) => r.json())
      .then((d) => setHospitals(Array.isArray(d) ? (d as Hospital[]) : []))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
    fetch('/api/disruptions')
      .then((r) => r.json())
      .then((d) => setDisruptions(Array.isArray(d) ? (d as ServiceDisruption[]) : []))
      .catch(() => setDisruptions([]));
  };

  useEffect(load, []);

  // Auto-resolve location: saved → GPS → IP fallback.
  useEffect(() => {
    const saved = loadSavedLocation();
    if (saved) {
      setLocation(saved);
      setLocatingBootstrap(false);
      return;
    }
    let cancelled = false;
    setLocatingBootstrap(true);
    (async () => {
      const loc = await resolveLocationGpsThenIp();
      if (cancelled) return;
      if (loc) {
        setLocation(loc);
        saveLocation(loc);
      }
      setLocatingBootstrap(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeZones = useMemo(() => {
    if (!location || hospitals.length === 0) return [] as string[];
    return nearestZonesForUser(location.lat, location.lng, hospitals);
  }, [location, hospitals]);

  // OSRM drive times for facilities in the active zone(s) — same mechanism as the ER tab.
  useEffect(() => {
    if (!location || hospitals.length === 0 || activeZones.length === 0) {
      setOsrmData({});
      return;
    }
    let cancelled = false;
    const zoneSet = new Set(activeZones);
    const run = async () => {
      const results: Record<string, { durationMins: number; distanceKm: number }> = {};
      const nearby = hospitals.filter((h) => {
        if (!zoneSet.has(h.region)) return false;
        if (h.latitude == null || h.longitude == null) return false;
        return calculateDistance(location.lat, location.lng, h.latitude, h.longitude) <= 150;
      });
      await Promise.all(
        nearby.map(async (h) => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${location.lng},${location.lat};${h.longitude},${h.latitude}?overview=false`;
            const res = await fetch(url);
            if (!res.ok) return;
            const data = await res.json();
            if (data.code === 'Ok' && data.routes?.[0]) {
              results[h.id] = {
                durationMins: Math.round(data.routes[0].duration / 60),
                distanceKm: parseFloat((data.routes[0].distance / 1000).toFixed(1)),
              };
            }
          } catch {
            // Routing is best-effort; rows fall back to posted wait only.
          }
        }),
      );
      if (!cancelled) setOsrmData(results);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [location, hospitals, activeZones]);

  const enriched = useMemo(() => hospitals.map(enrichHospital), [hospitals]);

  const pulse = useMemo(() => {
    const waits = enriched
      .map((h) => h.effectiveWaitMinutes)
      .filter((w): w is number => w !== null)
      .sort((a, b) => a - b);
    const med = median(waits);
    const busiest = enriched.reduce<EnrichedHospital | null>((acc, h) => {
      if (h.effectiveWaitMinutes === null) return acc;
      if (!acc || (acc.effectiveWaitMinutes ?? -1) < h.effectiveWaitMinutes) return h;
      return acc;
    }, null);
    const latest = hospitals.reduce<string | null>((acc, h) => {
      if (!h.updatedAt) return acc;
      return !acc || h.updatedAt > acc ? h.updatedAt : acc;
    }, null);
    return {
      median: med,
      busiest,
      reporting: waits.length,
      total: hospitals.length,
      latest,
    };
  }, [enriched, hospitals]);

  const activeDisruptions = useMemo(
    () => disruptions.filter((d) => d.status === 'Active'),
    [disruptions],
  );

  const topPicks = useMemo<ScoredFacility[]>(() => {
    if (!location || activeZones.length === 0) return [];
    const zoneSet = new Set(activeZones);
    return enriched
      .filter((h) => zoneSet.has(h.region))
      .map((h) => {
        const drive = osrmData[h.id];
        const distance =
          h.latitude != null && h.longitude != null
            ? calculateDistance(location.lat, location.lng, h.latitude, h.longitude)
            : undefined;
        const wait = h.effectiveWaitMinutes;
        if (wait === null) return null;
        return {
          ...h,
          distance,
          driveMins: drive?.durationMins,
          netScore: wait + (drive?.durationMins ?? 0),
        };
      })
      .filter((h): h is ScoredFacility => h !== null)
      .sort((a, b) => a.netScore - b.netScore)
      .slice(0, 3);
  }, [enriched, location, osrmData, activeZones]);

  const requestLocation = async () => {
    setGeoBusy(true);
    setGeoError('');
    const loc = await resolveLocationGpsThenIp();
    if (loc) {
      setLocation(loc);
      saveLocation(loc);
      setGeoBusy(false);
      return;
    }
    setGeoBusy(false);
    setGeoError(
      'Couldn’t detect your location. Allow GPS, or open the full ER page to enter a city.',
    );
  };

  const clearLocation = () => {
    clearSavedLocation();
    setLocation(null);
    setOsrmData({});
  };

  const directoryGroups = useMemo(
    () =>
      CATEGORIES.filter((c) => c.id !== 'all')
        .map((cat) => ({
          id: cat.id,
          title: CATEGORY_TITLE_BY_ID[cat.id],
          modules: DASHBOARDS.filter(
            (d) => d.category === cat.id && dashboardMatchesSearch(d, directoryQuery),
          ),
        }))
        .filter((g) => g.modules.length > 0),
    [directoryQuery],
  );

  const medianLabel = pulse.median === null ? '—' : formatMinutesToHm(pulse.median);
  const locationSourceHint =
    location?.source === 'ip'
      ? 'approx. from network'
      : location?.isGPS || location?.source === 'gps'
        ? 'GPS'
        : null;
  const zoneLabel =
    activeZones.length === 0
      ? null
      : activeZones.length === 1
        ? activeZones[0].replace(/ Zone$/, '')
        : activeZones.map((z) => z.replace(/ Zone$/, '')).join(' + ');

  const FullErCta = ({ compact = false }: { compact?: boolean }) => (
    <button
      type="button"
      onClick={() => onNavigate('er-waits')}
      className={
        compact
          ? 'mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-left transition-colors hover:bg-accent hover:text-white cursor-pointer group'
          : 'mt-4 flex w-full items-center justify-between gap-4 rounded-xl bg-accent px-5 py-4 text-left text-white shadow-sm transition-colors hover:bg-accent-strong cursor-pointer'
      }
    >
      <span className="min-w-0">
        <span className={`flex items-center gap-2 ${compact ? 'text-sm font-semibold text-accent group-hover:text-white' : 'text-base font-semibold'}`}>
          <Map className="h-5 w-5 shrink-0" aria-hidden />
          Open the full ER wait times page
        </span>
        <span className={`mt-0.5 block text-xs ${compact ? 'text-ink-2 group-hover:text-white/80' : 'text-white/80'}`}>
          Map, every Alberta site, drive times, and trends
        </span>
      </span>
      <ArrowRight className={`h-5 w-5 shrink-0 ${compact ? 'text-accent group-hover:text-white' : ''}`} aria-hidden />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* 1 · Provincial pulse */}
      <section aria-label="Current ER state across Alberta">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Right now in Alberta</h2>
          {pulse.latest && (
            <p className="font-mono text-xs tabular-nums text-ink-3">
              updated {formatRelativeTime(pulse.latest)}
            </p>
          )}
        </div>
        {loading ? (
          <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-surface p-4">
                <div className="h-3 w-20 animate-pulse rounded bg-neutral-chip" />
                <div className="mt-3 h-7 w-24 animate-pulse rounded bg-neutral-chip" />
              </div>
            ))}
          </div>
        ) : fetchError ? (
          <div className="mt-3 rounded-xl border border-line bg-surface p-5 text-center">
            <p className="text-sm text-ink-2">Couldn’t load the current ER picture.</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-3">Median ER wait</p>
                <p className="mt-1 font-mono text-2xl tabular-nums text-ink">{medianLabel}</p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-3">Busiest ER</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">
                  {pulse.busiest ? shortHospitalName(pulse.busiest.name) : '—'}
                </p>
                <p className="font-mono text-sm tabular-nums text-ink-2">
                  {pulse.busiest?.effectiveWaitMinutes != null
                    ? formatMinutesToHm(pulse.busiest.effectiveWaitMinutes)
                    : ''}
                </p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-3">Reporting sites</p>
                <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
                  {pulse.reporting}
                  <span className="text-sm text-ink-3"> / {pulse.total}</span>
                </p>
              </div>
              <div className="bg-surface p-4">
                <p className="text-xs text-ink-3">Active alerts</p>
                <p className="mt-1 font-mono text-2xl tabular-nums text-ink">
                  {activeDisruptions.length}
                </p>
              </div>
            </div>
            {pulse.busiest && pulse.median !== null && (
              <p className="mt-2 text-sm text-ink-2">
                {pulse.median >= 180
                  ? `ERs are very busy right now — longest current wait at ${shortHospitalName(pulse.busiest.name)}.`
                  : pulse.median >= 90
                    ? `ERs are moderately busy — longest current wait at ${shortHospitalName(pulse.busiest.name)}.`
                    : `ERs are relatively calm — longest current wait at ${shortHospitalName(pulse.busiest.name)}.`}
              </p>
            )}
          </>
        )}
      </section>

      {/* 2 · Fastest path */}
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label="Fastest ER near you">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">Find the fastest ER near you</h2>
          {location && (
            <p className="text-xs text-ink-3">
              Near <span className="font-medium text-ink-2">{location.city}</span>
              {zoneLabel ? ` · ${zoneLabel}` : ''}
              {locationSourceHint ? ` · ${locationSourceHint}` : ''}
              {' · '}
              <button
                type="button"
                onClick={clearLocation}
                className="underline underline-offset-2 hover:text-ink cursor-pointer"
              >
                change
              </button>
            </p>
          )}
        </div>

        {!location && locatingBootstrap ? (
          <div className="mt-3 space-y-2">
            <div className="h-14 animate-pulse rounded-lg bg-neutral-chip" />
            <div className="h-14 animate-pulse rounded-lg bg-neutral-chip" />
            <p className="text-xs text-ink-3">Finding hospitals near you…</p>
          </div>
        ) : !location ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={requestLocation}
              disabled={geoBusy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60 cursor-pointer"
            >
              <Navigation className="h-5 w-5" aria-hidden />
              {geoBusy ? 'Locating…' : 'Use my location'}
            </button>
            <FullErCta compact />
            {geoError && <p className="mt-2 text-xs text-ink-3">{geoError}</p>}
          </div>
        ) : loading ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-chip" />
            ))}
          </div>
        ) : topPicks.length === 0 ? (
          <div className="mt-3">
            <p className="text-sm text-ink-2">
              No live waits near {location.city}
              {zoneLabel ? ` (${zoneLabel})` : ''} right now.
            </p>
            <FullErCta />
          </div>
        ) : (
          <>
            <ol className="mt-3 divide-y divide-line">
              {topPicks.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate('er-waits')}
                    className="group flex w-full items-center gap-3 py-3 text-left cursor-pointer"
                  >
                    <span className="w-5 shrink-0 text-center font-mono text-xs tabular-nums text-ink-3">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink group-hover:text-accent">
                        {shortHospitalName(h.name)}
                      </span>
                      <span className="block text-xs text-ink-3">
                        {h.driveMins != null
                          ? `${h.driveMins} min drive${h.distance != null ? ` · ${h.distance} km` : ''}`
                          : h.city}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-lg tabular-nums text-ink">
                      {h.effectiveWaitMinutes != null ? formatMinutesToHm(h.effectiveWaitMinutes) : '—'}
                    </span>
                    <WaitBandChip band={h.waitBand} className="hidden sm:inline-flex" />
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ol>
            <FullErCta />
          </>
        )}
      </section>

      {/* 3 · Active disruptions — rendered only when alerts exist */}
      {activeDisruptions.length > 0 && (
        <section className="rounded-xl border border-line bg-warn-soft p-4 sm:p-5" aria-label="Active service disruptions">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">
              {activeDisruptions.length} active service{' '}
              {activeDisruptions.length === 1 ? 'disruption' : 'disruptions'}
            </h2>
          </div>
          <ul className="mt-2 space-y-1">
            {activeDisruptions.slice(0, 3).map((d) => (
              <li key={d.id} className="text-sm text-ink-2">
                <span className="font-medium text-ink">{d.facilityName}</span>
                {d.serviceAffected ? ` — ${d.serviceAffected}` : ''}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onNavigate('disruptions')}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong cursor-pointer"
          >
            View all disruptions <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </section>
      )}

      {/* 4 · Module directory */}
      <section aria-label="All data modules">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-ink">Explore the data</h2>
          <div className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 sm:w-64">
            <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            <input
              type="text"
              value={directoryQuery}
              onChange={(e) => setDirectoryQuery(e.target.value)}
              placeholder="Search modules…"
              className="h-9 w-full bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none"
            />
          </div>
        </div>
        {directoryGroups.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line-2 bg-surface p-6 text-center text-sm text-ink-3">
            No modules match your search.
          </p>
        ) : (
          directoryGroups.map((group) => (
            <div key={group.id} className="mt-5">
              <h3 className="text-sm font-semibold text-ink-2">{group.title}</h3>
              <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">
                {group.modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onNavigate(m.id as DashboardId)}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-paper cursor-pointer"
                    >
                      <span className="rounded-lg border border-line bg-surface p-1.5 text-ink-3 group-hover:text-accent" aria-hidden>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink group-hover:text-accent">
                          {m.shortName}
                        </span>
                        <span className="block truncate text-xs text-ink-3">{m.description}</span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block">
                        {m.id === 'er-waits' ? (
                          <>
                            <span className="block font-mono text-sm tabular-nums text-ink">
                              {loading ? '…' : medianLabel}
                            </span>
                            <span className="block text-xs text-ink-3">median wait</span>
                          </>
                        ) : m.id === 'disruptions' ? (
                          <>
                            <span className="block font-mono text-sm tabular-nums text-ink">
                              {activeDisruptions.length}
                            </span>
                            <span className="block text-xs text-ink-3">active</span>
                          </>
                        ) : (
                          <>
                            <span className="block text-xs text-ink-2">{m.updateFrequency}</span>
                            <span className="block max-w-44 truncate text-xs text-ink-3">{m.source}</span>
                          </>
                        )}
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 5 · About */}
      <section className="rounded-xl border border-line bg-surface p-4 sm:p-5" aria-label="About this tracker">
        <h2 className="text-sm font-semibold text-ink">About this tracker</h2>
        <p className="mt-1.5 max-w-prose text-sm text-ink-2">
          An independent monitor of Alberta’s health system: live ER and urgent-care waits, plus
          verified indicators for surgery, diagnostics, workforce, and community care. Every figure
          is tied to a public source and a timestamp — data sources and update cadences are listed
          in the footer.
        </p>
        <p className="mt-2 max-w-prose text-sm text-ink-2">
          This tracker is <strong className="font-semibold text-ink">unofficial</strong> and not
          affiliated with Alberta Health Services. In a life-threatening emergency, call{' '}
          <strong className="font-semibold text-ink">911</strong>.
        </p>
      </section>
    </div>
  );
}
