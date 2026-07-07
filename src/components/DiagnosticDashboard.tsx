import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  Clock, 
  MapPin, 
  Search, 
  AlertTriangle, 
  AlertCircle,
  Info, 
  ChevronRight,
  Sparkles,
  Calendar,
  FlaskConical,
  Activity,
  BarChart2,
  Award,
  CheckCircle,
  HelpCircle,
  FileText,
  Bookmark,
  ShieldAlert,
  Sliders,
  SlidersHorizontal,
  Compass,
  TrendingUp,
  TrendingDown,
  Map,
  Users,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
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
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { calculateDistance, loadSavedLocation, saveLocation, type UserLocation } from '../lib/geo';

export default function DiagnosticDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'labs' | 'imaging-waits' | 'facilities' | 'turnaround'>('labs');
  
  // Interactive States
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [labSearch, setLabSearch] = useState<string>('');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState<'CT Scan' | 'MRI Scan'>('MRI Scan');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'CT Scan' | 'MRI Scan' | null>(null);
  // Lab wait trends — provincial average and per-lab historical snapshots
  const [labTrends, setLabTrends] = useState<{ timestamp: string; waitTime: number }[]>([]);
  const [selectedLabTrends, setSelectedLabTrends] = useState<{ labId: string; waitTime: number; timestamp: string }[]>([]);
  const [loadingLabTrends, setLoadingLabTrends] = useState(false);
  const [labTrendRange, setLabTrendRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Diagnostic data loaded at runtime from /api/data/diagnostic so that
 // 30-min refreshed data-diagnostic.json reaches the browser without a rebuild.
  const [diagnosticData, setDiagnosticData] = useState<{
    LAB_LOCATION_WAITS: LabLocationWait[];
    TEST_TURNAROUND_METRICS: TestTurnaround[];
    IMAGING_WAIT_TRENDS: ImagingWaitTrend[];
    FACILITY_IMAGING_WAITS: FacilityImagingWait[];
    PRIORITY_TARGET_COMPLIANCE: PriorityTarget[];
    _dataMetadata: DataMetadataMap;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Location + drive-time sorting (mirrors ER tab behaviour)
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [osrmData, setOsrmData] = useState<Record<string, { durationMins: number; distanceKm: number }>>({});
  const [sortBy, setSortBy] = useState<'net-wait' | 'proximity' | 'raw-wait'>('net-wait');

  const loadDiagnosticData = () => {
    fetch('/api/data/diagnostic')
      .then(res => { if (!res.ok) throw new Error('Failed to load diagnostic data'); return res.json(); })
      .then(data => { setDiagnosticData(data); setIsLoading(false); })
      .catch(err => { setError(err.message); setIsLoading(false); });
  };

  useEffect(() => {
    loadDiagnosticData();
  }, []);

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

  // Fetch OSRM drive times for labs within 100 km of the user
  useEffect(() => {
    if (!userLocation || !diagnosticData) {
      setOsrmData({});
      return;
    }

    const fetchOSRMTimes = async () => {
      const labs = diagnosticData.LAB_LOCATION_WAITS;
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
  }, [userLocation, diagnosticData]);

  const refreshData = () => {
    setRefreshing(true);
    fetch('/api/data/diagnostic')
      .then(res => res.json())
      .then(data => { setDiagnosticData(data); setRefreshing(false); })
      .catch(() => setRefreshing(false));
  };
  const isLabWaitUnavailable = (lab: LabLocationWait): boolean =>
    typeof lab.waitTimeMin !== 'number';

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

  const formatMinutesToHm = (minutes: number): string => {
    if (!minutes || isNaN(minutes)) return '0m';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const labStats = useMemo(() => {
    const LAB_LOCATION_WAITS = diagnosticData?.LAB_LOCATION_WAITS ?? [];
    if (!diagnosticData) {
      return {
        avgWait: 0, edmontonAvg: 0, calgaryAvg: 0, restAvg: 0,
        maxWaitLab: null as LabLocationWait | null,
        totalActive: 0, walkInCount: 0, apptOnlyCount: 0
      };
    }
    const validLabs = LAB_LOCATION_WAITS.filter(l => typeof l.waitTimeMin === 'number');
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
      maxWaitLab,
      totalActive,
      walkInCount,
      apptOnlyCount
    };
  }, [diagnosticData]);
  // Enrich labs with distance + drive time, then filter and sort
  const processedLabs = useMemo(() => {
    const LAB_LOCATION_WAITS = diagnosticData?.LAB_LOCATION_WAITS ?? [];
    return LAB_LOCATION_WAITS
      .map((lab) => {
        let distance: number | undefined = undefined;
        let driveMins: number | undefined = undefined;

        if (userLocation) {
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
  }, [diagnosticData, selectedRegion, labSearch, userLocation, osrmData, sortBy]);

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
      if (sortBy === 'net-wait' && userLocation) {
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
  }, [processedLabs, sortBy, userLocation]);

  // Nearby alternative recommendation (high wait vs low wait same region)
  const labRecommendations = useMemo(() => {
    if (!diagnosticData || processedLabs.length === 0) return [];
    const LAB_LOCATION_WAITS = diagnosticData.LAB_LOCATION_WAITS;

    // Find labs in same region with high waits (> 35 mins)
    const highWaitLabs = processedLabs.filter((l) => typeof l.waitTimeMin === 'number' && l.waitTimeMin > 35);

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
  }, [processedLabs, diagnosticData]);

  // Reusable lab card renderer used by both grouped and fallback layouts
  const renderLabCard = (lab: typeof processedLabs[number]) => {
    const waitIsNumber = typeof lab.waitTimeMin === 'number';
    const hasDrive = lab.distance !== undefined && lab.driveMins !== undefined && userLocation;
    const netWait = hasDrive && waitIsNumber ? (lab.driveMins || 0) + (lab.waitTimeMin as number) : undefined;

    // Color scale for wait times
    let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';
    if (waitIsNumber) {
      const wait = lab.waitTimeMin as number;
      if (wait <= 15) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      else if (wait <= 30) badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      else if (wait <= 45) badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      else badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
    } else if (lab.waitTimeMin === 'Appointments Only') {
      badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    } else {
      badgeColor = 'bg-slate-950 text-slate-600 border-slate-900';
    }

    return (
      <button
        key={lab.id}
        onClick={() => setSelectedLabId(selectedLabId === lab.id ? null : lab.id)}
        className={`bg-slate-900 border text-left p-4 rounded-2xl shadow-lg flex flex-col justify-between space-y-4 cursor-pointer transition-all hover:border-cyan-500/50 ${
          selectedLabId === lab.id ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-slate-800'
        }`}
      >
        <div className="space-y-2 w-full">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate">{lab.name}</h4>
              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                <span className="truncate">{lab.address}, {lab.city}</span>
              </p>
            </div>

            <span className="text-[10px] text-slate-500 font-mono font-semibold uppercase shrink-0">
              {lab.code}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between border-t border-slate-850/60 pt-2 text-[11px]">
              <span className="text-slate-400 font-medium">Estimated wait:</span>
              <span className={`px-2 py-0.5 rounded border font-mono font-bold ${badgeColor}`}>
                {waitIsNumber ? `${lab.waitTimeMin} mins` : lab.waitTimeMin}
              </span>
            </div>

            {hasDrive && waitIsNumber && (
              <div className="flex items-center justify-between text-[11px] py-1 px-1 rounded bg-cyan-950/15 border border-cyan-500/10">
                <span className="text-cyan-300 font-bold">Net time (drive + wait):</span>
                <span className="font-black text-cyan-300 font-mono">{formatMinutesToHm(netWait as number)}</span>
              </div>
            )}

            {hasDrive && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Drive:</span>
                <span className="font-mono">{lab.distance} km • {formatMinutesToHm(lab.driveMins || 0)}</span>
              </div>
            )}
          </div>

          {(lab.peakHours || lab.dailyVolume) && (
            <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
              {lab.peakHours && (
                <div className="bg-slate-950/40 p-1.5 rounded flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">Peak Hours</span>
                  <span className="font-semibold text-slate-300">{lab.peakHours}</span>
                </div>
              )}
              {lab.dailyVolume && (
                <div className="bg-slate-950/40 p-1.5 rounded flex flex-col">
                  <span className="text-[8px] text-slate-500 uppercase">Daily Volume</span>
                  <span className="font-semibold text-slate-300">~{lab.dailyVolume} patients</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            {lab.walkInAvailable && (
              <span className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-850 font-bold uppercase">
                Walk-In
              </span>
            )}
            {lab.appointmentRequired && (
              <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900/40 font-bold uppercase">
                Appt Req
              </span>
            )}
          </div>

          {lab.saveMyPlaceAvailable && lab.waitTimeMin !== 'Closed' && (
            <a
              href="https://mylabbooking.albertaprecisionlabs.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-all shadow-sm"
            >
              Save My Place
            </a>
          )}
        </div>
      </button>
    );
  };

  // Facility filtering
  const filteredFacilities = useMemo(() => {
    const FACILITY_IMAGING_WAITS = diagnosticData?.FACILITY_IMAGING_WAITS ?? [];
    return FACILITY_IMAGING_WAITS.filter(fac => {
      const matchesSearch = fac.facilityName.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.zone.toLowerCase().includes(facilitySearch.toLowerCase());
      return matchesSearch;
    });
  }, [facilitySearch, diagnosticData]);

  // Historical data for selected modality
  const filteredTrendData = useMemo(() => {
    const IMAGING_WAIT_TRENDS = diagnosticData?.IMAGING_WAIT_TRENDS ?? [];
    return IMAGING_WAIT_TRENDS.filter(trend => trend.modality === selectedModality);
  }, [selectedModality, diagnosticData]);

  // KPI trend stats for the selected modality trend panel
  const kpiStats = useMemo(() => {
    if (!selectedKpi || !diagnosticData) return null;
    const series = diagnosticData.IMAGING_WAIT_TRENDS.filter(t => t.modality === selectedKpi);
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
  }, [selectedKpi, diagnosticData]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'CT Scan':
        return {
          label: 'CT Scan Wait Days (P90)',
          description: 'Historical tracking of Alberta 90th-percentile wait days for CT scans, benchmarked against the Canadian national average. Rising P90 values signal structural wait-list accumulation for lower-priority outpatient imaging.',
          colorClass: 'text-cyan-400',
          bgClass: 'bg-cyan-500/10',
          strokeColor: '#06b6d4',
          gradientId: 'colorCtTrend',
          unit: 'd',
          icon: Activity
        };
      case 'MRI Scan':
        return {
          label: 'MRI Scan Wait Days (P90)',
          description: 'Historical tracking of Alberta 90th-percentile wait days for MRI scans, benchmarked against the Canadian national average. MRI waits are persistently the longest of all modalities and a leading indicator of diagnostic access strain.',
          colorClass: 'text-indigo-400',
          bgClass: 'bg-indigo-500/10',
          strokeColor: '#6366f1',
          gradientId: 'colorMriTrend',
          unit: 'd',
          icon: Activity
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  if (isLoading) return <div className="p-6 text-slate-400">Loading diagnostic data...</div>;
  if (error) return <div className="p-6 text-red-400">Error: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={Activity}
        title="Diagnostic & Lab Services"
        description="Monitor laboratory wait times and diagnostic imaging benchmark compliance."
        metadata={diagnosticData?._dataMetadata}
        arrayKey="LAB_LOCATION_WAITS"
      >
        <button
          onClick={refreshing ? undefined : refreshData}
          disabled={refreshing}
          className="self-start md:self-auto px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {/* Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('labs')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'labs'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Laboratory Waits</span>
        </button>
        <button
          onClick={() => setActiveSubTab('imaging-waits')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'imaging-waits'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Imaging Gaps</span>
        </button>
        <button
          onClick={() => setActiveSubTab('facilities')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'facilities'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Diagnostic Sites</span>
        </button>
        <button
          onClick={() => setActiveSubTab('turnaround')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'turnaround'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Lab Turnaround</span>
        </button>
      </div>

      {/* SUBTAB 1: Live Lab Waits */}
      {activeSubTab === 'labs' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={diagnosticData?._dataMetadata ?? {}} arrayKey="LAB_LOCATION_WAITS" />

          {/* Stats Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Provincial Avg Wait Card Breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <Clock className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-[8px] font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Lab State Average
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className="text-2xl font-black text-white tracking-tight leading-none">
                    {formatMinutesToHm(labStats.avgWait)}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Provincial Average Lab Wait
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 mt-1">
                <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Edmonton</span>
                  <span className="text-xs font-black text-emerald-400 font-mono block mt-0.5">
                    {formatMinutesToHm(labStats.edmontonAvg)}
                  </span>
                </div>
                <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Calgary</span>
                  <span className="text-xs font-black text-blue-400 font-mono block mt-0.5">
                    {formatMinutesToHm(labStats.calgaryAvg)}
                  </span>
                </div>
                <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Rest AB</span>
                  <span className="text-xs font-black text-indigo-400 font-mono block mt-0.5">
                    {formatMinutesToHm(labStats.restAvg)}
                  </span>
                </div>
              </div>
            </div>

            {/* Max Wait Card Breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  </div>
                  <span className="text-[8px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Peak Delay Lab
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className="text-2xl font-black text-white tracking-tight leading-none">
                    {labStats.maxWaitLab ? formatMinutesToHm(labStats.maxWaitLab.waitTimeMin as number) : '0m'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Longest Estimated Wait Time
                  </p>
                </div>
              </div>
              
              <div className="border-t border-slate-800/80 pt-2 mt-1">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Highest Volume Site</span>
                <span className="text-xs font-black text-red-400 font-mono block mt-0.5 truncate" title={labStats.maxWaitLab?.name}>
                  {labStats.maxWaitLab ? labStats.maxWaitLab.name : 'N/A'}
                </span>
              </div>
            </div>

            {/* Total Active / Walk-in Available Card */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                    <Building className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="text-[8px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                    Lab Sites Status
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <p className="text-2xl font-black text-white tracking-tight leading-none">
                    {labStats.totalActive}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Total Monitored Facilities
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 mt-1">
                <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Walk-In Access</span>
                  <span className="text-xs font-black text-emerald-400 font-mono block mt-0.5">
                    {labStats.walkInCount}
                  </span>
                </div>
                <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Appt Only</span>
                  <span className="text-xs font-black text-indigo-400 font-mono block mt-0.5">
                    {labStats.apptOnlyCount}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* Provincial Lab Wait Trend Chart */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  Provincial Lab Wait Time Trend
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Average wait time across all monitored APL community labs, sampled every 30 minutes.
                </p>
              </div>
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                {(['24h', '7d', '30d'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setLabTrendRange(r)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      labTrendRange === r ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {loadingLabTrends ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                <Activity className="w-4 h-4 animate-pulse mr-2" /> Loading lab wait trends...
              </div>
            ) : labTrends.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={labTrends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLabTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
                    <Tooltip
                      contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                      labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                      labelFormatter={(ts: string) => new Date(ts).toLocaleString('en-US')}
                    />
                    <Area
                      type="monotone"
                      dataKey="waitTime"
                      name="Avg Lab Wait (min)"
                      stroke="#06b6d4"
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
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Clock className="w-6 h-6 text-slate-600" />
                <p>No trend data yet. Lab wait snapshots are collected every 30 minutes — check back shortly.</p>
              </div>
            )}
          </div>

          {/* Lab location filters, search, sort & location */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search labs by name, code or city..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative w-full sm:w-48">
                  <select
                    className="w-full appearance-none pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition-all cursor-pointer"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'net-wait' | 'proximity' | 'raw-wait')}
                  >
                    <option value="net-wait">Sort: Net Wait (Fastest)</option>
                    <option value="proximity">Sort: Proximity (Nearest)</option>
                    <option value="raw-wait">Sort: Raw Wait Time</option>
                  </select>
                  <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

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
                        () => {
                          setLoadingGeo(false);
                        },
                        { enableHighAccuracy: true, timeout: 5000 },
                      );
                    } else {
                      setLoadingGeo(false);
                    }
                  }}
                  disabled={loadingGeo}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950/40 text-xs font-bold text-slate-300 hover:text-cyan-400 hover:border-cyan-500/40 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Compass className={`w-3.5 h-3.5 ${loadingGeo ? 'animate-spin' : ''}`} />
                  <span>
                    {userLocation ? `Location: ${userLocation.city}` : loadingGeo ? 'Locating...' : 'Set Location'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {['All', 'Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'].map(region => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    selectedRegion === region
                      ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>
                Sorting:{' '}
                <span className="text-cyan-400 font-semibold">
                  {sortBy === 'net-wait'
                    ? userLocation ? 'Net Wait (Drive + Wait)' : 'Wait Time (Set location for drive-time sort)'
                    : sortBy === 'proximity'
                      ? userLocation ? 'Proximity' : 'Proximity (Set location)'
                      : 'Raw Wait Time'}
                </span>
              </span>
              <span className="text-slate-600">
                {processedLabs.length} lab{processedLabs.length !== 1 ? 's' : ''} shown
              </span>
            </div>
          </div>

          {/* Smart Redirect / Routing (High Waits vs Nearby low wait alternatives) */}
          {labRecommendations.length > 0 && (
            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Active Lab Re-routing Suggestions</h3>
              </div>
              <p className="text-[10px] text-slate-500">
                Several community labs are currently experiencing peak wait volumes. Consider re-routing to alternative low-wait sites nearby to optimize check-in.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labRecommendations.slice(0, 2).map((item, index) => (
                  <div key={index} className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 truncate">
                        <span className="line-through">{item.highLab.name}</span>
                        <span className="text-red-400 text-[10px] font-mono">({item.highLab.waitTimeMin}m wait)</span>
                      </div>
                      <div className="text-xs font-bold text-white flex items-center gap-1 truncate">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Route to {item.betterLab.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Estimated transit saving of <strong>{item.savingMins} minutes</strong> wait duration.
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold block">
                        Wait: {item.betterLab.waitTimeMin}m
                      </span>
                      <a
                        href="https://mylabbooking.albertaprecisionlabs.ca/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-cyan-400 hover:underline mt-1 block font-bold"
                      >
                        Queue Remotely
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab wait list grid — grouped by zone, fastest to slowest within each zone */}
          <div className="space-y-8">
            {groupedLabs.length > 0 ? (
              groupedLabs.map((zone) => (
                <div key={zone.name} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
                        {zone.name}
                      </h3>
                    </div>
                    {userLocation && zone.distance !== 999999 && (
                      <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-[9px] font-bold">
                        ~{zone.distance} km closest
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {zone.labs.map((lab) => renderLabCard(lab))}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No community labs matched your search criteria.</p>
              </div>
            )}
          </div>
          {/* Per-lab historical trend panel — shown when a lab card is selected */}
          <AnimatePresence mode="wait">
            {selectedLabId && (
              <motion.div
                key={`lab-trend-${selectedLabId}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-6 shadow-xl relative">
                  <button
                    onClick={() => setSelectedLabId(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="space-y-1 pr-8">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      <span>{processedLabs.find(l => l.id === selectedLabId)?.name ?? selectedLabId} — Wait Time Trend</span>
                    </h3>
                    <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                      Historical wait time for this lab site, sampled every 30 minutes from live APL QMe API data. Only numeric wait times are charted; 'Appointments Only' and 'Closed' states are excluded.
                    </p>
                  </div>

                  {selectedLabTrends.length > 0 ? (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedLabTrends} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorLabSiteTrend" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
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
                          <Tooltip
                            contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                            labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                            itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                            labelFormatter={(ts: string) => new Date(ts).toLocaleString('en-US')}
                          />
                          <Area
                            type="monotone"
                            dataKey="waitTime"
                            name="Wait Time (min)"
                            stroke="#06b6d4"
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
                    <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <Clock className="w-6 h-6 text-slate-600" />
                      <p>No trend data yet for this lab. Snapshots are collected every 30 minutes — check back shortly.</p>
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
        <div className="space-y-6">
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
              className={`p-4 rounded-2xl bg-slate-900 border shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedKpi === 'CT Scan'
                  ? 'border-cyan-500 ring-1 ring-cyan-500/30 shadow-cyan-500/5'
                  : 'border-slate-800 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-[8px] font-extrabold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  CT Scan P90
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-black text-white tracking-tight leading-none font-mono">
                  {(diagnosticData?.IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === 'CT Scan').slice(-1)[0]?.albertaP90Days ?? '—'}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Alberta 90th Percentile Wait (Days)
                </p>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-cyan-400/80 group-hover:text-cyan-400 transition-colors">
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
              className={`p-4 rounded-2xl bg-slate-900 border shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedKpi === 'MRI Scan'
                  ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-indigo-500/5'
                  : 'border-slate-800 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <Activity className="w-4 h-4 text-indigo-400" />
                </div>
                <span className="text-[8px] font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  MRI Scan P90
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-black text-white tracking-tight leading-none font-mono">
                  {(diagnosticData?.IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === 'MRI Scan').slice(-1)[0]?.albertaP90Days ?? '—'}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Alberta 90th Percentile Wait (Days)
                </p>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-indigo-400/80 group-hover:text-indigo-400 transition-colors">
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
                <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-6 shadow-xl relative">
                  {/* Close Button */}
                  <button
                    onClick={() => setSelectedKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Title and description */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        {React.createElement(selectedKpiDetails.icon, {
                          className: `w-4 h-4 ${selectedKpiDetails.colorClass}`
                        })}
                        <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {selectedKpiDetails.description}
                      </p>
                    </div>
                  </div>

                  {/* Stats highlights */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (2019)</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (2025)</span>
                      <span className="text-xl font-black text-white font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Peak</span>
                      <span className={`text-xl font-black font-mono ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                        kpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
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
                        data={(diagnosticData?.IMAGING_WAIT_TRENDS ?? []).filter(t => t.modality === selectedKpi)}
                        margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis
                          stroke="#64748b"
                          style={{ fontSize: 10, fontFamily: 'monospace' }}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                          labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                          itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                        />
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
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI CT & MRI Diagnostic Wait Days</h3>
                  <p className="text-[10px] text-slate-500">Comparing Alberta (P50 and P90 percentile days) against Canadian averages (2019 - 2025)</p>
                  <DataTimestamp compact metadata={diagnosticData?._dataMetadata ?? {}} arrayKey="IMAGING_WAIT_TRENDS" />
                </div>

                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  {(['CT Scan', 'MRI Scan'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModality(m)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        selectedModality === m 
                          ? 'bg-cyan-600 text-white' 
                          : 'text-slate-400 hover:text-white'
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
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCanada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#06b6d4" fillOpacity={1} fill="url(#colorAlberta)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanada)" strokeWidth={1.5} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#06b6d4" strokeWidth={1.5} dot />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" dot />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                💡 <strong>90th Percentile (P90):</strong> The number of days in which 90% of patients received their scan. High gaps between Median (P50) and P90 reflect structural wait-list accumulation for lower-priority outpatients.
              </p>
            </div>

            {/* Target compliance and CAR targets */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National CAR Performance Targets</h3>
                <p className="text-[10px] text-slate-500">Alberta wait-time compliance relative to Canadian Association of Radiologists standards</p>
              </div>

              <div className="space-y-3">
                {(diagnosticData?.PRIORITY_TARGET_COMPLIANCE ?? []).map(item => (
                  <div key={item.priority} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{item.priority}</h4>
                        <span className="text-[9px] text-slate-500 block">Target maximum: <strong>{item.targetLimitText}</strong></span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">CT Compliance</span>
                        <span className={`font-mono font-bold ${item.albertaCtCompliancePct >= 90 ? 'text-emerald-400' : 'text-amber-500'}`}>{item.albertaCtCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${item.albertaCtCompliancePct}%` }} />
                      </div>

                      <div className="flex justify-between text-[9px] pt-1">
                        <span className="text-slate-400">MRI Compliance</span>
                        <span className={`font-mono font-bold ${item.albertaMriCompliancePct >= 90 ? 'text-emerald-400' : 'text-amber-500'}`}>{item.albertaMriCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${item.albertaMriCompliancePct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Imaging Facility Access */}
      {activeSubTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Facility Diagnostic Volume & Utilization</h3>
                <p className="text-[10px] text-slate-500">Individual medical-surgical hospital scanner statistics and local P50 / P90 wait ranges</p>
                <DataTimestamp compact metadata={diagnosticData?._dataMetadata ?? {}} arrayKey="FACILITY_IMAGING_WAITS" />
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search hospitals..."
                  value={facilitySearch}
                  onChange={(e) => setFacilitySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Facility list table */}
            <div className="overflow-x-auto border border-slate-850 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-3.5">Facility Name</th>
                    <th className="p-3.5">Zone</th>
                    <th className="p-3.5">CT Waits (P50/P90)</th>
                    <th className="p-3.5">MRI Waits (P50/P90)</th>
                    <th className="p-3.5">Annual Completed</th>
                    <th className="p-3.5">Scanner Util Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {filteredFacilities.map(fac => (
                    <tr key={fac.facilityId} className="hover:bg-slate-950/40 text-slate-300">
                      <td className="p-3.5 font-bold text-white">{fac.facilityName}</td>
                      <td className="p-3.5 text-slate-400">{fac.zone}</td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{fac.ctP50WaitDays}d</span>
                        <span className="text-slate-500 text-[10px] ml-1">/ {fac.ctP90WaitDays}d</span>
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{fac.mriP50WaitDays}d</span>
                        <span className="text-slate-500 text-[10px] ml-1">/ {fac.mriP90WaitDays}d</span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-400">
                        {fac.annualCompletedExamsCount.toLocaleString()} scans
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${fac.scannerUtilizationPct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-cyan-400">{fac.scannerUtilizationPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Lab Test Turnaround-Time Benchmarks */}
      {activeSubTab === 'turnaround' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Turnaround times bar chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Test Turnaround Duration Benchmarks</h3>
                  <p className="text-[10px] text-slate-500">Required specimen analytical processing timeline from collection to report</p>
                  <DataTimestamp compact metadata={diagnosticData?._dataMetadata ?? {}} arrayKey="TEST_TURNAROUND_METRICS" />
                </div>
                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: APL Test Directory
                </span>
              </div>

              {/* Recharts Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={diagnosticData?.TEST_TURNAROUND_METRICS ?? []}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="testName" stroke="#64748b" fontSize={9} interval={0} tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value} />
                    <YAxis label={{ value: 'Turnaround Hours (STAT)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="statTurnaroundHrs" name="STAT / Critical Turnaround (Hours)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="routineTurnaroundDays" name="Routine Outpatient Turnaround (Days)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                🔬 <strong>Specialty Pathology:</strong> Note that major surgical pathologies (e.g. tumor margin check biopsies) suffer from a 5-day routine backlog due to systemic province-wide pathologist workforce limits.
              </p>
            </div>

            {/* Test directory collection catalog */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lab Test Catalog Specifications</h3>
                <p className="text-[10px] text-slate-500">Specimen and routing specifications for high-volume lab markers</p>
              </div>

              <div className="space-y-3">
                {(diagnosticData?.TEST_TURNAROUND_METRICS ?? []).slice(0, 4).map(test => (
                  <div key={test.testName} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-white">{test.testName}</span>
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono">
                        {test.category}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Specimen Tube:</span>
                      <span className="text-slate-400 font-semibold">{test.specimenType}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Annual Volume:</span>
                      <span className="text-slate-400 font-semibold">~{test.volumePerYearMillions}M tests</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
