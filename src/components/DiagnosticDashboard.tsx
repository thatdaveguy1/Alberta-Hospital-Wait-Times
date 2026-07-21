import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock,
  MapPin,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  FlaskConical,
  Activity,
  BarChart2,
  SlidersHorizontal,
  Compass,
  TrendingUp,
  TrendingDown,
  X
} from 'lucide-react';
import { MapComponent } from './MapComponent';
import { 
  ResponsiveContainer, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart,
  Area
} from 'recharts';
import {
  LabLocationWait,
  TestTurnaround,
  ImagingWaitTrend,
  FacilityImagingWait,
  PriorityTarget,
} from '../diagnosticData';
import * as diagnosticDataModule from '../diagnosticData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type DiagnosticData = {
  LAB_LOCATION_WAITS: LabLocationWait[];
  TEST_TURNAROUND_METRICS: TestTurnaround[];
  IMAGING_WAIT_TRENDS: ImagingWaitTrend[];
  FACILITY_IMAGING_WAITS: FacilityImagingWait[];
  PRIORITY_TARGET_COMPLIANCE: PriorityTarget[];
  _dataMetadata?: DataMetadataMap;
};
import { calculateDistance, isRoughlyInAlberta, loadSavedLocation, saveLocation, type UserLocation } from '../lib/geo';
import {
  LocationUnavailableModal,
  useLocationUnavailableModal,
} from './LocationUnavailableModal';
import {
  isLabWaitUnavailable,
  labWaitUnavailableDetail,
  unavailableWaitLabel,
} from '../lib/labWait';
import { cn, formatMinutesToHm } from '../lib/utils';
import { LabCard, type LabCardData } from './LabCard';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: any }) {
  if (!active || !payload?.length) return null;
  const title = typeof label === 'string' && !isNaN(Date.parse(label)) ? new Date(label).toLocaleString('en-US') : String(label ?? '');
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{title}</p>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-label">{entry.name}:</span>
          <span className="chart-tooltip-value">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DiagnosticDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'labs' | 'imaging-waits' | 'facilities' | 'turnaround'>('labs');
  
  // Interactive States
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [labSearch, setLabSearch] = useState<string>('');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState<'CT Scan' | 'MRI Scan'>('MRI Scan');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'CT Scan' | 'MRI Scan' | null>(null);
  // Lab wait trends — provincial average and per-lab historical snapshots
  const [labTrends, setLabTrends] = useState<{ timestamp: string; waitTime: number }[]>([]);
  const [selectedLabTrends, setSelectedLabTrends] = useState<{ labId: string; waitTime: number; timestamp: string }[]>([]);
  const [loadingLabTrends, setLoadingLabTrends] = useState(false);
  const [labTrendRange, setLabTrendRange] = useState<'24h' | '7d' | '30d'>('24h');

  const { data, metadata, isLoading, error } = useDomainData<DiagnosticData>('diagnostic', diagnosticDataModule);
  const LAB_LOCATION_WAITS = data?.LAB_LOCATION_WAITS ?? [];
  // Hand-authored / unconfirmed diagnostic arrays — fail closed (empty).
  const TEST_TURNAROUND_METRICS: typeof data extends { TEST_TURNAROUND_METRICS: infer T } ? T : never[] = [] as any;
  const IMAGING_WAIT_TRENDS = data?.IMAGING_WAIT_TRENDS ?? [];
  const FACILITY_IMAGING_WAITS: typeof data extends { FACILITY_IMAGING_WAITS: infer T } ? T : never[] = [] as any;
  const PRIORITY_TARGET_COMPLIANCE: typeof data extends { PRIORITY_TARGET_COMPLIANCE: infer T } ? T : never[] = [] as any;

  // Location + drive-time sorting (mirrors ER tab behaviour)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [osrmData, setOsrmData] = useState<Record<string, { durationMins: number; distanceKm: number }>>({});
  const [sortBy, setSortBy] = useState<'net-wait' | 'proximity' | 'raw-wait'>('net-wait');

  // Load location saved from the ER tab (or auto-request GPS if none exists)
  useEffect(() => {
    const saved = loadSavedLocation();
    if (saved) {
      setUserLocation(saved);
      return;
    }

    if (!navigator.geolocation) return;
    setLoadingGeo(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          city: 'GPS Location',
          isGPS: true,
        };
        setUserLocation(loc);
        saveLocation(loc);
        setLoadingGeo(false);
      },
      () => {
        setLoadingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  const driveEnabled = Boolean(
    userLocation && isRoughlyInAlberta(userLocation.lat, userLocation.lng),
  );
  const { open: locationUnavailableOpen, dismiss: dismissLocationUnavailable } =
    useLocationUnavailableModal(userLocation);

  // Fetch OSRM drive times for labs within 100 km (Alberta pins only)
  useEffect(() => {
    if (!driveEnabled || !userLocation || LAB_LOCATION_WAITS.length === 0) {
      setOsrmData({});
      return;
    }

    const fetchOSRMTimes = async () => {
      const labs = LAB_LOCATION_WAITS;
      const nearby = labs.filter((lab) => {
        const d = calculateDistance(userLocation.lat, userLocation.lng, lab.latitude, lab.longitude);
        return d <= 100;
      });

      if (nearby.length === 0) {
        setOsrmData({});
        return;
      }

      const results: Record<string, { durationMins: number; distanceKm: number }> = {};
      await Promise.all(
        nearby.map(async (lab) => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${lab.longitude},${lab.latitude}?overview=false`;
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.json();
              if (data.code === 'Ok' && data.routes?.length > 0) {
                const route = data.routes[0];
                results[lab.id] = {
                  durationMins: Math.round(route.duration / 60),
                  distanceKm: parseFloat((route.distance / 1000).toFixed(1)),
                };
              }
            }
          } catch (e) {
            // console.warn is fine but noisy; silently fall back to haversine estimate.
          }
        }),
      );

      setOsrmData(results);
    };

    fetchOSRMTimes();
  }, [driveEnabled, userLocation, LAB_LOCATION_WAITS]);

  const getLabStatus = (lab: LabLocationWait): { label: string; detail: string } => {
    if (isLabWaitUnavailable(lab)) {
      return {
        label: unavailableWaitLabel(lab),
        detail: labWaitUnavailableDetail(lab),
      };
    }
    return { label: formatMinutesToHm(lab.waitTimeMin as number), detail: 'Live wait from APL QMe' };
  };
  const getLabWaitTone = (lab: LabLocationWait): string => {
    if (isLabWaitUnavailable(lab)) return 'text-ink-3';
    const wait = lab.waitTimeMin as number;
    if (wait > 45) return 'text-crit';
    if (wait > 30) return 'text-warn';
    if (wait > 15) return 'text-accent';
    return 'text-ok';
  };
  const formatLabAvgWait = (minutes: number, validCount: number): string => {
    if (validCount === 0) return '—';
    return formatMinutesToHm(minutes);
  };

  // Fetch provincial lab wait trend (averaged across all labs per timestamp)
  const fetchLabTrends = (range: '24h' | '7d' | '30d' = labTrendRange) => {
    setLoadingLabTrends(true);
    fetch(`/api/trends/labs?range=${range}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setLabTrends(data); else setLabTrends([]); })
      .catch(() => setLabTrends([]))
      .finally(() => setLoadingLabTrends(false));
  };

  // Fetch per-lab historical trend when a lab card is selected
  useEffect(() => {
    if (!selectedLabId) { setSelectedLabTrends([]); return; }
    fetch(`/api/trends/labs/${encodeURIComponent(selectedLabId)}?range=${labTrendRange}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setSelectedLabTrends(data); else setSelectedLabTrends([]); })
      .catch(() => setSelectedLabTrends([]));
  }, [selectedLabId, labTrendRange]);

  // Fetch provincial lab trend when labs subtab is active
  useEffect(() => {
    if (activeSubTab === 'labs') fetchLabTrends(labTrendRange);
  }, [activeSubTab, labTrendRange]);

  const labStats = useMemo(() => {
    if (LAB_LOCATION_WAITS.length === 0) {
      return {
        avgWait: 0, edmontonAvg: 0, calgaryAvg: 0, restAvg: 0,
        validLabCount: 0, edmontonLabCount: 0, calgaryLabCount: 0, restLabCount: 0,
        maxWaitLab: null as LabLocationWait | null,
        totalActive: 0, walkInCount: 0, apptOnlyCount: 0
      };
    }
    const validLabs = LAB_LOCATION_WAITS.filter(l => !isLabWaitUnavailable(l));
    const avgWait = validLabs.length > 0 ? Math.round(validLabs.reduce((acc, l) => acc + (l.waitTimeMin as number), 0) / validLabs.length) : 0;

    const edmontonLabs = validLabs.filter(l => l.region === 'Edmonton Zone');
    const edmontonAvg = edmontonLabs.length > 0 ? Math.round(edmontonLabs.reduce((acc, l) => acc + (l.waitTimeMin as number), 0) / edmontonLabs.length) : 0;

    const calgaryLabs = validLabs.filter(l => l.region === 'Calgary Zone');
    const calgaryAvg = calgaryLabs.length > 0 ? Math.round(calgaryLabs.reduce((acc, l) => acc + (l.waitTimeMin as number), 0) / calgaryLabs.length) : 0;

    const restLabs = validLabs.filter(l => l.region !== 'Edmonton Zone' && l.region !== 'Calgary Zone');
    const restAvg = restLabs.length > 0 ? Math.round(restLabs.reduce((acc, l) => acc + (l.waitTimeMin as number), 0) / restLabs.length) : 0;

    let maxWaitLab: LabLocationWait | null = null;
    if (validLabs.length > 0) {
      maxWaitLab = validLabs.reduce((prev, curr) =>
        (typeof curr.waitTimeMin === 'number' && typeof prev.waitTimeMin === 'number' && curr.waitTimeMin > prev.waitTimeMin) ? curr : prev
      );
    }

    const totalActive = LAB_LOCATION_WAITS.length;
    const walkInCount = LAB_LOCATION_WAITS.filter(l => l.walkInAvailable).length;
    const apptOnlyCount = LAB_LOCATION_WAITS.filter(l => l.appointmentRequired && !l.walkInAvailable).length;
    return {
      avgWait,
      edmontonAvg,
      calgaryAvg,
      restAvg,
      validLabCount: validLabs.length,
      edmontonLabCount: edmontonLabs.length,
      calgaryLabCount: calgaryLabs.length,
      restLabCount: restLabs.length,
      maxWaitLab,
      totalActive,
      walkInCount,
      apptOnlyCount
    };
  }, [LAB_LOCATION_WAITS]);
  // Enrich labs with distance + drive time, then filter and sort
  const processedLabs = useMemo(() => {
    return LAB_LOCATION_WAITS
      .map((lab) => {
        let distance: number | undefined = undefined;
        let driveMins: number | undefined = undefined;

        if (driveEnabled && userLocation) {
          if (osrmData[lab.id]) {
            distance = osrmData[lab.id].distanceKm;
            driveMins = osrmData[lab.id].durationMins;
          } else {
            distance = calculateDistance(userLocation.lat, userLocation.lng, lab.latitude, lab.longitude);
            driveMins = Math.round((distance / 85) * 60);
          }
        }

        return { ...lab, distance, driveMins };
      })
      .filter((lab) => {
        const matchesRegion = selectedRegion === 'All' || lab.region === selectedRegion;
        const matchesSearch =
          lab.name.toLowerCase().includes(labSearch.toLowerCase()) ||
          lab.city.toLowerCase().includes(labSearch.toLowerCase()) ||
          lab.code.toLowerCase().includes(labSearch.toLowerCase());
        return matchesRegion && matchesSearch;
      })
      .sort((a, b) => {
        const aUnav = isLabWaitUnavailable(a);
        const bUnav = isLabWaitUnavailable(b);
        if (aUnav && !bUnav) return 1;
        if (!aUnav && bUnav) return -1;
        if (aUnav && bUnav) {
          if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'net-wait') {
          if (a.distance !== undefined && b.distance !== undefined) {
            const netA = (a.driveMins || 0) + (a.waitTimeMin as number);
            const netB = (b.driveMins || 0) + (b.waitTimeMin as number);
            return netA - netB;
          }
          return (a.waitTimeMin as number) - (b.waitTimeMin as number);
        }

        if (sortBy === 'proximity') {
          if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
          if (a.distance !== undefined) return -1;
          if (b.distance !== undefined) return 1;
          return (a.waitTimeMin as number) - (b.waitTimeMin as number);
        }

        return (a.waitTimeMin as number) - (b.waitTimeMin as number);
      });
  }, [LAB_LOCATION_WAITS, selectedRegion, labSearch, userLocation, osrmData, sortBy, driveEnabled]);

  // Group processed labs by zone, sorting zones by proximity (or fastest net wait)
  const groupedLabs = useMemo(() => {
    const groups: { name: string; distance: number; labs: typeof processedLabs }[] = [];
    const allRegions = Array.from(new Set(processedLabs.map((l) => l.region))) as string[];

    allRegions.forEach((regionName) => {
      const matched = processedLabs.filter((l) => l.region === regionName);
      if (matched.length === 0) return;

      const minDistance = Math.min(...matched.map((l) => (l.distance !== undefined ? l.distance : Infinity)));
      groups.push({
        name: regionName,
        distance: minDistance === Infinity ? 999999 : minDistance,
        labs: matched,
      });
    });

    groups.sort((a, b) => {
      if (sortBy === 'net-wait' && driveEnabled) {
        const minNetA = Math.min(
          ...a.labs.map((l) => (isLabWaitUnavailable(l) ? Infinity : (l.driveMins || 0) + (l.waitTimeMin as number))),
        );
        const minNetB = Math.min(
          ...b.labs.map((l) => (isLabWaitUnavailable(l) ? Infinity : (l.driveMins || 0) + (l.waitTimeMin as number))),
        );
        if (minNetA !== minNetB) return minNetA - minNetB;
      }
      return a.distance - b.distance;
    });

    return groups;
  }, [processedLabs, sortBy, driveEnabled]);

  // Map pins — Hospital shape for MapComponent (status mirrors LabCard wait bands)
  const mapLabs = useMemo(() => {
    return processedLabs
      .filter((lab) => lab.latitude != null && lab.longitude != null)
      .map((lab) => {
        const unavailable = isLabWaitUnavailable(lab);
        const waitTime = typeof lab.waitTimeMin === 'number' ? lab.waitTimeMin : 0;
        let status: 'Green' | 'Yellow' | 'Red' = 'Green';
        if (!unavailable) {
          if (waitTime > 45) status = 'Red';
          else if (waitTime > 30) status = 'Yellow';
        }
        return {
          id: lab.id,
          name: lab.name,
          status,
          latitude: lab.latitude,
          longitude: lab.longitude,
          city: lab.city,
          waitTime,
          ...(lab.distance !== undefined ? { distance: lab.distance } : {}),
          ...(lab.driveMins !== undefined ? { driveMins: lab.driveMins } : {}),
        };
      });
  }, [processedLabs]);

  const selectedMapLab = useMemo(
    () => mapLabs.find((lab) => lab.id === selectedLabId) ?? null,
    [mapLabs, selectedLabId],
  );

  // Top 3 optimal lab recommendations by net time (Alberta drive pins only)
  const calculatedShortestWaitList = useMemo(() => {
    if (!driveEnabled) return [];
    return processedLabs
      .filter((l) => l.distance !== undefined && l.distance < 150 && !isLabWaitUnavailable(l))
      .map((l) => ({
        ...l,
        totalTime: (l.driveMins || 0) + (l.waitTimeMin as number),
      }))
      .sort((a, b) => a.totalTime - b.totalTime)
      .slice(0, 3);
  }, [processedLabs, driveEnabled]);

  // Nearby alternative recommendation (high wait vs low wait same region)
  const labRecommendations = useMemo(() => {
    if (processedLabs.length === 0) return [];

    // Find labs in same region with high waits (> 35 mins)
    const highWaitLabs = processedLabs.filter((l) => !isLabWaitUnavailable(l) && typeof l.waitTimeMin === 'number' && l.waitTimeMin > 35);

    return highWaitLabs.map((highLab) => {
      // Find low wait alternatives in same region
      const alternatives = LAB_LOCATION_WAITS.filter(
        (l) =>
          l.region === highLab.region &&
          l.id !== highLab.id &&
          typeof l.waitTimeMin === 'number' &&
          l.waitTimeMin < 25,
      );

      if (alternatives.length > 0) {
        // Pick best alternative
        const best = alternatives.reduce((prev, curr) =>
          (typeof prev.waitTimeMin === 'number' && typeof curr.waitTimeMin === 'number' && curr.waitTimeMin < prev.waitTimeMin) ? curr : prev
        );
        return {
          highLab,
          betterLab: best,
          savingMins: (highLab.waitTimeMin as number) - (best.waitTimeMin as number)
        };
      }
      return null;
    }).filter(item => item !== null) as { highLab: LabLocationWait; betterLab: LabLocationWait; savingMins: number }[];
  }, [processedLabs, LAB_LOCATION_WAITS]);

  // Facility filtering
  const filteredFacilities = useMemo(() => {
    return FACILITY_IMAGING_WAITS.filter(fac => {
      const matchesSearch = fac.facilityName.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.zone.toLowerCase().includes(facilitySearch.toLowerCase());
      return matchesSearch;
    });
  }, [facilitySearch, FACILITY_IMAGING_WAITS]);

  // Historical data for selected modality
  const filteredTrendData = useMemo(() => {
    return IMAGING_WAIT_TRENDS.filter(trend => trend.modality === selectedModality);
  }, [selectedModality, IMAGING_WAIT_TRENDS]);

  // KPI trend stats for the selected modality trend panel
  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const series = IMAGING_WAIT_TRENDS.filter(t => t.modality === selectedKpi);
    const values = series.map(t => t.albertaP90Days).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toFixed(0),
      latest: latest.toFixed(0),
      peak: peak.toFixed(0),
      minVal: minVal.toFixed(0),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(0)}` : rawDelta.toFixed(0),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedKpi, IMAGING_WAIT_TRENDS]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'CT Scan':
        return {
          label: 'CT Scan Wait Days (P90)',
          description: 'Historical tracking of Alberta 90th-percentile wait days for CT scans, benchmarked against the Canadian national average. Rising P90 values signal structural wait-list accumulation for lower-priority outpatient imaging.',
          colorClass: 'text-accent',
          bgClass: 'bg-accent-soft',
          strokeColor: '#06b6d4',
          gradientId: 'colorCtTrend',
          unit: 'd',
          icon: Activity
        };
      case 'MRI Scan':
        return {
          label: 'MRI Scan Wait Days (P90)',
          description: 'Historical tracking of Alberta 90th-percentile wait days for MRI scans, benchmarked against the Canadian national average. MRI waits are persistently the longest of all modalities and a leading indicator of diagnostic access strain.',
          colorClass: 'text-accent-strong',
          bgClass: 'bg-accent-soft',
          strokeColor: '#6366f1',
          gradientId: 'colorMriTrend',
          unit: 'd',
          icon: Activity
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  if (isLoading) return (
    <div className="space-y-4 p-4">
      <div className="h-48 animate-pulse rounded-xl border border-line bg-neutral-chip" />
    </div>
  );
  if (error) return (
    <div className="p-4">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
        <span>Unable to load diagnostics: {error}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <DashboardHeader
        icon={FlaskConical}
        title="Diagnostic & Lab Services"
        description="Monitor laboratory wait times and diagnostic imaging benchmark compliance."
        metadata={metadata}
        arrayKey="LAB_LOCATION_WAITS"
        variant="light"
      />

      {/* Sub-Tab Navigation */}
      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5" role="tablist" aria-label="Diagnostics view">
        <button
          onClick={() => setActiveSubTab('labs')}
          role="tab"
          aria-selected={activeSubTab === 'labs'}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5',
            activeSubTab === 'labs' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
          )}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Laboratory Waits</span>
        </button>
        <button
          onClick={() => setActiveSubTab('imaging-waits')}
          role="tab"
          aria-selected={activeSubTab === 'imaging-waits'}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5',
            activeSubTab === 'imaging-waits' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Imaging Gaps</span>
        </button>
      </div>

      {/* SUBTAB 1: Live Lab Waits */}
      {activeSubTab === 'labs' && (
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Provincial Avg Wait Card Breakdown */}
            <div className="bg-surface border border-line p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-paper border border-line rounded-lg">
                    <Clock className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-xs font-medium text-accent-strong bg-accent-soft border border-line px-1.5 py-0.5 rounded-full">
                    Lab State Average
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className="text-2xl font-semibold text-ink tracking-tight leading-none">
                    {formatLabAvgWait(labStats.avgWait, labStats.validLabCount)}
                  </p>
                  <p className="text-xs font-medium text-ink-3">
                    Provincial Average Lab Wait
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 border-t border-line pt-2.5 mt-1">
                <div className="p-2 bg-paper border border-line rounded-xl text-center min-w-0">
                  <span className="text-xs font-medium text-ink-3 block">Edmonton</span>
                  <span className="text-sm font-medium text-ink font-mono tabular-nums block mt-0.5">
                    {formatLabAvgWait(labStats.edmontonAvg, labStats.edmontonLabCount)}
                  </span>
                </div>
                <div className="p-2 bg-paper border border-line rounded-xl text-center min-w-0">
                  <span className="text-xs font-medium text-ink-3 block">Calgary</span>
                  <span className="text-sm font-medium text-ink font-mono tabular-nums block mt-0.5">
                    {formatLabAvgWait(labStats.calgaryAvg, labStats.calgaryLabCount)}
                  </span>
                </div>
                <div className="p-2 bg-paper border border-line rounded-xl text-center min-w-0">
                  <span className="text-xs font-medium text-ink-3 block">Rest AB</span>
                  <span className="text-sm font-medium text-ink font-mono tabular-nums block mt-0.5">
                    {formatLabAvgWait(labStats.restAvg, labStats.restLabCount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Peak Delay Lab */}
            <div className="bg-surface border border-line p-4 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-paper border border-line rounded-lg">
                    <AlertCircle className="w-4 h-4 text-crit" />
                  </div>
                  <span className="text-xs font-medium text-crit bg-crit-soft border border-line px-1.5 py-0.5 rounded-full">
                    Peak Delay Lab
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className={cn('text-2xl font-medium tracking-tight leading-none font-mono tabular-nums', labStats.maxWaitLab ? getLabWaitTone(labStats.maxWaitLab) : 'text-ink-2')} title={labStats.maxWaitLab ? getLabStatus(labStats.maxWaitLab).detail : ''}>
                    {labStats.maxWaitLab ? getLabStatus(labStats.maxWaitLab).label : '—'}
                  </p>
                  <p className="text-xs font-medium text-ink-3">
                    Longest Live Wait Time
                  </p>
                </div>
              </div>
              
              <div className="border-t border-line pt-2 mt-1">
                <span className="text-xs font-medium text-ink-3 block">Site with longest wait</span>
                <span className="text-xs font-medium text-crit font-mono tabular-nums block mt-0.5 truncate" title={labStats.maxWaitLab?.name}>
                  {labStats.maxWaitLab ? labStats.maxWaitLab.name : '—'}
                </span>
              </div>
            </div>

            {/* Treatment Calculator */}
            <div className="bg-surface border border-line p-4 rounded-xl flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-paper border border-line rounded-lg">
                    <Compass className="w-4 h-4 text-accent" />
                  </div>
                  {userLocation ? (
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                      userLocation.isGPS
                        ? 'bg-ok-soft border border-line text-ok'
                        : 'bg-accent-soft border border-line text-accent-strong'
                    }`}>
                      {userLocation.isGPS ? 'Auto-Detected' : 'Custom'}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-neutral-chip border border-line-2 text-ink-2 rounded-full text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mb-1.5">
                  <h3 className="text-xs font-semibold text-ink-2">
                    Treatment Calculator
                  </h3>
                </div>
                <p className="text-xs text-ink-2 leading-normal">
                  Combine your driving time with live lab wait times to find the fastest check-in.
                </p>
              </div>

              <div className="space-y-2 mt-1">
                {userLocation ? (
                  <div className="p-2 bg-paper border border-line rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-3">Location Origin</p>
                      <p className="text-[11px] font-semibold text-ink truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-accent shrink-0" />
                        <span>
                          {userLocation.city}
                          {isRoughlyInAlberta(userLocation.lat, userLocation.lng) ? ', AB' : ''}
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setUserLocation(null);
                        localStorage.removeItem('alberta_hospital_user_location');
                      }}
                      className="px-2 py-1 text-xs font-medium bg-crit-soft border border-line text-crit rounded-lg hover:bg-crit-soft transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => {
                        setLoadingGeo(true);
                        if (navigator.geolocation) {
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              const loc = {
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                                city: 'GPS Location',
                                isGPS: true,
                              };
                              setUserLocation(loc);
                              saveLocation(loc);
                              setLoadingGeo(false);
                            },
                            () => setLoadingGeo(false),
                            { enableHighAccuracy: true, timeout: 5000 },
                          );
                        } else {
                          setLoadingGeo(false);
                        }
                      }}
                      disabled={loadingGeo}
                      className="py-1.5 px-2 text-xs font-semibold rounded-lg border border-line bg-paper text-ink-2 hover:bg-neutral-chip hover:text-ink transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Compass className={cn('w-3 h-3', loadingGeo && 'animate-spin')} />
                      <span>{loadingGeo ? '...' : 'Use GPS'}</span>
                    </button>
                    <button
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-location-modal'));
                      }}
                      className="py-1.5 px-2 text-xs font-semibold rounded-lg border border-line bg-paper text-ink-2 hover:bg-neutral-chip hover:text-ink transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      <span>Manual</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-location-modal'));
                  }}
                  className="w-full py-1.5 px-2 text-xs font-semibold rounded-lg border border-line bg-paper text-ink-2 hover:bg-neutral-chip hover:text-ink transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <MapPin className="w-3 h-3" />
                  <span>{userLocation ? 'Change Location' : 'Set Location'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Optimal Route Planner — top 3 fastest labs by net time */}
          {calculatedShortestWaitList.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-surface border border-line rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Compass className="w-32 h-32 text-accent" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-ink tracking-tight">Optimal Route Planner: Shortest Time to Lab</h3>
                </div>
                <p className="text-xs text-ink-2">
                  Live APL lab waits + driving times combined to calculate the fastest path.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-2.5">
                {calculatedShortestWaitList.map((lab, i) => (
                  <div
                    key={lab.id}
                    onClick={() => setSelectedLabId(lab.id)}
                    className={cn(
                      'p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer',
                      i === 0
                        ? 'bg-accent-soft border-accent ring-1 ring-accent/10'
                        : 'bg-paper border-line hover:border-line-2',
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          'text-xs font-medium px-1.5 py-0.5 rounded-full',
                          i === 0 ? 'bg-accent text-white' : 'bg-neutral-chip text-ink-2',
                        )}>
                          {i === 0 ? 'Rank 1: Fastest Lab' : `Rank ${i + 1}`}
                        </span>
                        <span className="text-xs text-ink-2 font-mono tabular-nums">{lab.distance} km away</span>
                      </div>
                      <h4 className="text-xs font-semibold text-ink break-words mt-0.5 leading-tight">{lab.name}</h4>
                      <p className="text-xs text-ink-2 mt-0.5">{lab.city}</p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-line flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-ink-3 leading-none">Est. Total</p>
                        <p className="text-sm font-semibold text-ink mt-0.5 leading-none">{formatMinutesToHm(lab.totalTime)}</p>
                      </div>
                      <div className="text-right text-xs text-ink-2 font-semibold space-y-0.5 leading-none">
                        <p title={getLabStatus(lab).detail}>Wait: {getLabStatus(lab).label}</p>
                        <p>Drive: {formatMinutesToHm(lab.driveMins || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
                <p className="truncate sm:whitespace-normal">
                  Estimates are guidance only. For medical emergencies, please dial <strong className="font-semibold text-ink">911</strong> immediately or head directly to the nearest emergency facility.
                </p>
              </div>
            </div>
          )}
          {/* Provincial Lab Wait Trend Chart */}
          <div data-testid="provincial-lab-wait-trend" className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-ink-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  Provincial Lab Wait Time Trend
                </h3>
                <p className="text-xs text-ink-3 mt-0.5">
                  Average wait time across all monitored APL community labs, sampled every 10 minutes.
                </p>
              </div>
              <div className="flex bg-paper p-0.5 rounded-lg border border-line">
                {(['24h', '7d', '30d'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setLabTrendRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      labTrendRange === r ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {loadingLabTrends ? (
              <div className="h-64 flex items-center justify-center text-ink-3 text-xs">
                <Activity className="w-4 h-4 animate-pulse mr-2" /> Loading lab wait trends...
              </div>
            ) : labTrends.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={labTrends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLabTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b5cad" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0b5cad" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ee" />
                    <XAxis
                      dataKey="timestamp"
                      stroke="#64748b"
                      style={{ fontSize: 10, fontFamily: 'monospace' }}
                      tickFormatter={(ts: string) => {
                        const d = new Date(ts);
                        return labTrendRange === '24h'
                          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      }}
                    />
                    <YAxis
                      stroke="#64748b"
                      style={{ fontSize: 10, fontFamily: 'monospace' }}
                      label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="waitTime"
                      name="Avg Lab Wait (min)"
                      stroke="#0b5cad"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorLabTrend)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-ink-3 text-xs gap-2">
                <Clock className="w-6 h-6 text-ink-3" />
                <p>No trend data yet. Lab wait snapshots are collected every 10 minutes — check back shortly.</p>
              </div>
            )}
          </div>

          {/* Labs map — same fullscreen pattern as ER */}
          <div
            className={cn(
              'flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-line bg-surface',
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
                hospitals={mapLabs}
                userLocation={userLocation}
                selectedHospital={selectedMapLab}
                setSelectedHospital={(h) => setSelectedLabId(h.id)}
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

          {/* Search and Filters — mirrors ER tab */}
          <div className="flex flex-col md:flex-row gap-3 rounded-xl border border-line bg-surface p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                placeholder="Search by facility or city..."
                className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                value={labSearch}
                onChange={(e) => setLabSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 md:shrink-0">
              <div className="relative w-full sm:w-44">
                <select
                  className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-paper pl-3 pr-10 text-sm text-ink focus:border-accent focus:outline-none"
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                >
                  {['All', 'Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <SlidersHorizontal className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 pointer-events-none" />
              </div>

              <div className="relative w-full sm:w-48">
                <select
                  className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-paper pl-3 pr-10 text-sm text-ink focus:border-accent focus:outline-none"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'net-wait' | 'proximity' | 'raw-wait')}
                >
                  <option value="net-wait">Sort: Net Wait (Fastest)</option>
                  <option value="proximity">Sort: Proximity (Nearest)</option>
                  <option value="raw-wait">Sort: Raw Wait Time</option>
                </select>
                <SlidersHorizontal className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* List Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink-2">Community Labs & Patient Collection Sites ({processedLabs.length})</h2>
            <span className="text-xs text-ink-2">
              Sorting: <span className="text-accent font-semibold">
                {sortBy === 'net-wait'
                  ? (driveEnabled ? 'Net Wait (Drive + Wait)' : 'Wait Time')
                  : sortBy === 'proximity'
                    ? (driveEnabled ? 'Proximity' : 'Proximity (set Alberta location)')
                    : 'Raw Wait Time'}
              </span>
            </span>
          </div>

          {/* Lab Grid grouped by Zone */}
          <div className="space-y-8">
            {groupedLabs.length > 0 ? (
              groupedLabs.map((zone) => (
                <div key={zone.name} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-ink-2" />
                      <h3 className="font-semibold text-sm text-ink">
                        {zone.name}
                      </h3>
                    </div>
                    {driveEnabled && zone.distance !== 999999 && (
                      <span className="px-2 py-0.5 bg-accent text-white rounded-full text-xs font-medium">
                        ~{zone.distance} km closest
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {zone.labs.map((lab) => (
                      <LabCard
                        key={lab.id}
                        lab={lab}
                        onClick={() => setSelectedLabId(selectedLabId === lab.id ? null : lab.id)}
                        selected={selectedLabId === lab.id}
                        sortBy={sortBy}
                      />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-16 text-center text-sm text-ink-3">
                <Info className="mx-auto mb-4 h-12 w-12 text-ink-3" />
                <p className="text-lg font-semibold text-ink">No labs found</p>
                <p className="mt-1 text-sm text-ink-3">Try adjusting your search or region filter</p>
              </div>
            )}
          </div>
          {/* Per-lab historical trend panel — shown when a lab card is selected */}
          <AnimatePresence mode="wait">
            {selectedLabId && (
              <motion.div
                data-testid="per-lab-wait-trend"
                key={`lab-trend-${selectedLabId}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-line bg-surface p-6 space-y-6 relative">
                  <button
                    onClick={() => setSelectedLabId(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-paper border border-line hover:border-line-2 text-ink-2 hover:text-ink transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="space-y-1 pr-8">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      <span>{processedLabs.find(l => l.id === selectedLabId)?.name ?? selectedLabId} — Wait Time Trend</span>
                    </h3>
                    <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                      Historical wait time for this lab site, sampled every 10 minutes from live APL QMe API data. Only numeric wait times are charted; 'Appointments Only', 'Closed', and 'Not Available' states are excluded.
                    </p>
                  </div>

                  {selectedLabTrends.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedLabTrends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorLabSiteTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0b5cad" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#0b5cad" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ee" />
                          <XAxis
                            dataKey="timestamp"
                            stroke="#64748b"
                            style={{ fontSize: 10, fontFamily: 'monospace' }}
                            tickFormatter={(ts: string) => {
                              const d = new Date(ts);
                              return labTrendRange === '24h'
                                ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          />
                          <YAxis
                            stroke="#64748b"
                            style={{ fontSize: 10, fontFamily: 'monospace' }}
                            label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="waitTime"
                            name="Wait Time (min)"
                            stroke="#0b5cad"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorLabSiteTrend)"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-ink-3 text-xs gap-2">
                      <Clock className="w-6 h-6 text-ink-3" />
                      <p>No trend data yet for this lab. Snapshots are collected every 10 minutes — check back shortly.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUBTAB 2: CT & MRI Public Wait Times */}
      {activeSubTab === 'imaging-waits' && (
        <div className="space-y-4">
          <DataTimestamp compact variant="light" metadata={metadata ?? {}} arrayKey="IMAGING_WAIT_TRENDS" />
          {/* Clickable KPI overview cards — toggle historical trend panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* CT Scan KPI Card */}
            <div
              tabIndex={0}
              role="button"
              aria-pressed={selectedKpi === 'CT Scan'}
              onClick={() => setSelectedKpi(selectedKpi === 'CT Scan' ? null : 'CT Scan')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKpi(selectedKpi === 'CT Scan' ? null : 'CT Scan');
                }
              }}
              className={`p-4 rounded-xl bg-surface border relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover: ${
                selectedKpi === 'CT Scan'
                  ? 'border-accent ring-1 ring-accent/30 '
                  : 'border-line hover:border-accent/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-paper border border-line rounded-lg">
                  <Activity className="w-4 h-4 text-accent" />
                </div>
                <span className="text-xs font-medium text-accent-strong bg-accent-soft border border-line px-1.5 py-0.5 rounded-full">
                  CT Scan P90
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-semibold text-ink tracking-tight leading-none font-mono tabular-nums">
                  {(IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === 'CT Scan').slice(-1)[0]?.albertaP90Days ?? '—'}
                </p>
                <p className="text-xs font-medium text-ink-3">
                  Alberta 90th Percentile Wait (Days)
                </p>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-accent group-hover:text-accent-strong transition-colors">
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'CT Scan' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </div>
            </div>

            {/* MRI Scan KPI Card */}
            <div
              tabIndex={0}
              role="button"
              aria-pressed={selectedKpi === 'MRI Scan'}
              onClick={() => setSelectedKpi(selectedKpi === 'MRI Scan' ? null : 'MRI Scan')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKpi(selectedKpi === 'MRI Scan' ? null : 'MRI Scan');
                }
              }}
              className={`p-4 rounded-xl bg-surface border relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover: ${
                selectedKpi === 'MRI Scan'
                  ? 'border-accent-strong ring-1 ring-accent/30 '
                  : 'border-line hover:border-accent/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-paper border border-line rounded-lg">
                  <Activity className="w-4 h-4 text-accent-strong" />
                </div>
                <span className="text-xs font-medium text-accent-strong bg-accent-soft border border-line px-1.5 py-0.5 rounded-full">
                  MRI Scan P90
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-semibold text-ink tracking-tight leading-none font-mono tabular-nums">
                  {(IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === 'MRI Scan').slice(-1)[0]?.albertaP90Days ?? '—'}
                </p>
                <p className="text-xs font-medium text-ink-3">
                  Alberta 90th Percentile Wait (Days)
                </p>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-accent-strong group-hover:text-accent transition-colors">
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'MRI Scan' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </div>
            </div>
          </div>

          {/* KPI Trend Explorer Panel */}
          <AnimatePresence mode="wait">
            {selectedKpi && selectedKpiDetails && kpiStats && (
              <motion.div
                key={`kpi-trend-${selectedKpi}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-line bg-surface p-6 space-y-6 relative">
                  {/* Close Button */}
                  <button
                    onClick={() => setSelectedKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-paper border border-line hover:border-line-2 text-ink-2 hover:text-ink transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Title and description */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                        {React.createElement(selectedKpiDetails.icon, {
                          className: `w-4 h-4 ${selectedKpiDetails.colorClass}`
                        })}
                        <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                        {selectedKpiDetails.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-paper border border-line">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Baseline (2019)</span>
                      <span className="text-xl font-medium text-ink-2 font-mono tabular-nums">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Current (2025)</span>
                      <span className="text-xl font-medium text-ink font-mono tabular-nums">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Peak</span>
                      <span className={`text-xl font-medium font-mono tabular-nums ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Overall Shift</span>
                      <span className={`text-xl font-medium font-mono tabular-nums flex items-center justify-center sm:justify-start gap-1 ${
                        kpiStats.isIncrease ? 'text-crit' : 'text-ok'
                      }`}>
                        {kpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{kpiStats.delta}{selectedKpiDetails.unit} ({kpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  {/* Chart container */}
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={(IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === selectedKpi)}
                        margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ee" />
                        <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis
                          stroke="#64748b"
                          style={{ fontSize: 10, fontFamily: 'monospace' }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="albertaP90Days"
                          name="Alberta 90th Percentile (Days)"
                          stroke={selectedKpiDetails.strokeColor}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill={`url(#${selectedKpiDetails.gradientId})`}
                          dot={{ r: 4, strokeWidth: 1 }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* National Wait Trends Comparison Chart */}
            <div className="bg-surface border border-line p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold text-ink-2">CIHI CT & MRI Diagnostic Wait Days</h3>
                  <p className="text-xs text-ink-3">Comparing Alberta (P50 and P90 percentile days) against Canadian averages (2018 - 2025)</p>
                </div>

                <div className="flex bg-paper p-0.5 rounded-lg border border-line">
                  {(['CT Scan', 'MRI Scan'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModality(m)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                        selectedModality === m 
                          ? 'bg-accent text-white' 
                          : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredTrendData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorAlberta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0b5cad" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0b5cad" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCanada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ee" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#0b5cad" fillOpacity={1} fill="url(#colorAlberta)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#64748b" fillOpacity={1} fill="url(#colorCanada)" strokeWidth={1.5} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#0b5cad" strokeWidth={1.5} dot />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" dot />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-ink-2">
                💡 <strong>90th Percentile (P90):</strong> The number of days in which 90% of patients received their scan. High gaps between Median (P50) and P90 reflect structural wait-list accumulation for lower-priority outpatients.
              </p>
            </div>

            {/* Target compliance and CAR targets */}
            <div className="bg-surface border border-line p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-ink-2">National CAR Performance Targets</h3>
                <p className="text-xs text-ink-3">Alberta wait-time compliance relative to Canadian Association of Radiologists standards</p>
              </div>

              <div className="space-y-3">
                {(PRIORITY_TARGET_COMPLIANCE ?? []).length === 0 ? (
                  <p className="text-[11px] text-ink-2 leading-relaxed p-3 bg-paper border border-line rounded-xl">
                    Priority target compliance is not shown. Prior values were unconfirmed estimates without a verified published report.
                  </p>
                ) : (
                  (PRIORITY_TARGET_COMPLIANCE ?? []).map(item => (
                  <div key={item.priority} className="p-3 bg-paper rounded-xl border border-line space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-ink">{item.priority}</h4>
                        <span className="text-xs text-ink-3 block">Target maximum: <strong>{item.targetLimitText}</strong></span>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-ink-2">CT Compliance</span>
                        <span className={`font-mono tabular-nums font-medium ${item.albertaCtCompliancePct >= 90 ? 'text-ok' : 'text-warn'}`}>{item.albertaCtCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-neutral-chip h-1 rounded-full overflow-hidden">
                        <div className="bg-accent h-full rounded-full" style={{ width: `${item.albertaCtCompliancePct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs pt-1">
                        <span className="text-ink-2">MRI Compliance</span>
                        <span className={`font-mono tabular-nums font-medium ${item.albertaMriCompliancePct >= 90 ? 'text-ok' : 'text-warn'}`}>{item.albertaMriCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-neutral-chip h-1 rounded-full overflow-hidden">
                        <div className="bg-accent-strong h-full rounded-full" style={{ width: `${item.albertaMriCompliancePct}%` }} />
                      </div>
                    </div>
                  </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      <LocationUnavailableModal
        open={locationUnavailableOpen}
        onDismiss={dismissLocationUnavailable}
      />
    </div>
  );
}