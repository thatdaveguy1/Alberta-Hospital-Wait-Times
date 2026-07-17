import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Clock, 
  Building2, 
  TrendingUp, 
  Info, 
  FileText, 
  AlertTriangle, 
  Layers,
  ArrowUpRight,
  ShieldAlert,
  BarChart2,
  MapPin,
  Award,
  RefreshCw
} from 'lucide-react';
import type {
  FacilityFlow,
  WeeklyEDLOS,
  CIHIComparator,
  LGADemand,
  HistoricalFlowSnapshot,
} from '../systemFlowData';
import * as systemFlowDataModule from '../systemFlowData';
import { type DataMetadataMap, DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';
type SystemFlowData = {
  FACILITY_FLOW_METRICS: FacilityFlow[];
  AHS_WEEKLY_ED_LOS: WeeklyEDLOS[];
  CIHI_COMPARATORS: CIHIComparator[];
  REGIONAL_LGA_DEMAND: LGADemand[];
  HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[];
  CIHI_OCCUPANCY_RATES?: Record<string, unknown>[];
  CIHI_ED_WAIT_INITIAL_ASSESSMENT?: Record<string, unknown>[];
  _dataMetadata?: DataMetadataMap;
};
export default function SystemFlowDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<SystemFlowData>('system-flow', systemFlowDataModule);
  // Quarantine: facility-level occupancy/ALC/LWBS/LOS and historical timelines are
  // hand-authored estimates with no verified scrape path. Do not surface them.
  const FACILITY_FLOW_METRICS: FacilityFlow[] = [];
  const AHS_WEEKLY_ED_LOS = useMemo(
    () => (data?.AHS_WEEKLY_ED_LOS ?? []).filter((r) => r.weekEnding && String(r.weekEnding).trim()),
    [data?.AHS_WEEKLY_ED_LOS],
  );
  const CIHI_COMPARATORS = data?.CIHI_COMPARATORS ?? [];
  const REGIONAL_LGA_DEMAND = data?.REGIONAL_LGA_DEMAND ?? [];
  const HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[] = [];
  const CIHI_OCCUPANCY_RATES = useMemo(
    () => (data?.CIHI_OCCUPANCY_RATES ?? []) as Array<Record<string, unknown>>,
    [data?.CIHI_OCCUPANCY_RATES],
  );
  const CIHI_ED_WAIT_INITIAL_ASSESSMENT = useMemo(
    () => (data?.CIHI_ED_WAIT_INITIAL_ASSESSMENT ?? []) as Array<Record<string, unknown>>,
    [data?.CIHI_ED_WAIT_INITIAL_ASSESSMENT],
  );
  // Navigation Tabs — default to weekly ED (real PDF) rather than estimated facility grid
  const [subTab, setSubTab] = useState<'ranked' | 'scatterplot' | 'trends-weekly' | 'cihi-lga' | 'cihi-occupancy'>('trends-weekly');
  // Zone focus for LGA demand cards (UI highlight only)
  const [selectedZone, setSelectedZone] = useState<string>('All');


  const parseCihiNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && v.trim() !== '–' && v.trim() !== '-') {
      const n = parseFloat(v.replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const cihiOccupancySummary = useMemo(() => {
    const facilityRows = CIHI_OCCUPANCY_RATES.filter(
      (r) => String(r['Reporting level'] ?? '') === 'Facility' && String(r['Province/Territory'] ?? '') === 'Alberta',
    );
    // Prefer latest fiscal year present
    const frames = Array.from(new Set(facilityRows.map((r) => String(r['Time frame'] ?? '')).filter(Boolean))).sort();
    const latestFrame = frames[frames.length - 1] ?? '';
    const latest = latestFrame
      ? facilityRows.filter((r) => String(r['Time frame'] ?? '') === latestFrame)
      : facilityRows;
    const values = latest
      .map((r) => parseCihiNumber(r['Occupancy rate of acute beds']))
      .filter((v): v is number => v != null);
    if (values.length === 0) {
      return { avgOccupancy: null as number | null, facilityCount: 0, timeFrame: '', rows: [] as Array<Record<string, unknown>> };
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      avgOccupancy: parseFloat(avg.toFixed(1)),
      facilityCount: values.length,
      timeFrame: latestFrame,
      rows: latest
        .map((r) => ({
          ...r,
          _occ: parseCihiNumber(r['Occupancy rate of acute beds']),
          _name: String(r['Place or organization'] ?? ''),
          _region: String(r['Region'] ?? ''),
        }))
        .filter((r) => r._occ != null)
        .sort((a, b) => (b._occ as number) - (a._occ as number)),
    };
  }, [CIHI_OCCUPANCY_RATES]);

  const cihiEdWaitSummary = useMemo(() => {
    const rows = CIHI_ED_WAIT_INITIAL_ASSESSMENT.filter(
      (r) => String(r['Province/Territory'] ?? '') === 'Alberta',
    );
    const frames = Array.from(new Set(rows.map((r) => String(r['Time frame'] ?? '')).filter(Boolean))).sort();
    const latestFrame = frames[frames.length - 1] ?? '';
    const latest = latestFrame ? rows.filter((r) => String(r['Time frame'] ?? '') === latestFrame) : rows;
    const facility = latest.filter((r) => String(r['Reporting level'] ?? '') === 'Facility');
    const values = facility
      .map((r) => parseCihiNumber(r['90th percentile']))
      .filter((v): v is number => v != null);
    const avg = values.length > 0 ? parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)) : null;
    const provincial = latest.find((r) => String(r['Reporting level'] ?? '').toLowerCase().includes('province'));
    const provincialP90 = provincial ? parseCihiNumber(provincial['90th percentile']) : null;
    return {
      avgFacilityP90: avg,
      provincialP90,
      facilityCount: values.length,
      timeFrame: latestFrame,
      rows: facility
        .map((r) => ({
          ...r,
          _p90: parseCihiNumber(r['90th percentile']),
          _name: String(r['Place or organization'] ?? ''),
          _region: String(r['Region'] ?? ''),
        }))
        .filter((r) => r._p90 != null)
        .sort((a, b) => (b._p90 as number) - (a._p90 as number)),
    };
  }, [CIHI_ED_WAIT_INITIAL_ASSESSMENT]);

  // Provincial KPIs from verified CIHI arrays only (not estimated facility metrics)
  const provincialOverview = useMemo(() => {
    return {
      avgOccupancy: cihiOccupancySummary.avgOccupancy,
      avgAlc: null as number | null,
      avgLwbs: null as number | null,
      avgP90Wait: cihiEdWaitSummary.provincialP90 ?? cihiEdWaitSummary.avgFacilityP90,
      totalBeds: null as number | null,
      totalVolume: null as number | null,
      occupancyFrame: cihiOccupancySummary.timeFrame,
      occupancyFacilities: cihiOccupancySummary.facilityCount,
      edFrame: cihiEdWaitSummary.timeFrame,
      edFacilities: cihiEdWaitSummary.facilityCount,
    };
  }, [cihiOccupancySummary, cihiEdWaitSummary]);

  const sortedWeeklyEdLos = useMemo(() => {
    return [...AHS_WEEKLY_ED_LOS].sort((a, b) => {
      const aHasData = a.weekEnding ? -1 : 1;
      const bHasData = b.weekEnding ? -1 : 1;
      if (aHasData !== bHasData) return aHasData - bHasData;
      return a.facilityName.localeCompare(b.facilityName);
    });
  }, [AHS_WEEKLY_ED_LOS]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading system flow data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load system flow data: {error}</span>
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:border-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }
  return (
    <div id="system-flow-dashboard-root" className="space-y-6 text-slate-100 font-sans">
      
      {/* Standardized Tab bar header */}
      <DashboardHeader
        icon={TrendingUp}
        title="Hospital System Flow"
        description="CIHI acute occupancy and ED physician assessment waits, plus AHS weekly ED LOS from metro PDF reports."
        metadata={metadata}
        arrayKey="AHS_WEEKLY_ED_LOS"
      >
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:border-slate-700 flex items-center gap-1.5 cursor-pointer shrink-0"
          title="Refresh system flow data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </DashboardHeader>

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setSubTab('trends-weekly')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'trends-weekly'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Weekly ED LOS</span>
        </button>

        <button
          onClick={() => setSubTab('cihi-occupancy')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'cihi-occupancy'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>CIHI Occupancy & ED</span>
        </button>

        <button
          onClick={() => setSubTab('cihi-lga')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'cihi-lga'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Benchmarks & Profiles</span>
        </button>
      </div>

      {/* Verified CIHI KPIs only — estimated facility ALC/LWBS/historical trends removed */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden border bg-slate-900/60 border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">CIHI Avg Acute Occupancy</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-500 font-mono">
                {provincialOverview.avgOccupancy != null ? `${provincialOverview.avgOccupancy}%` : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">
              {provincialOverview.occupancyFacilities > 0
                ? `Mean across ${provincialOverview.occupancyFacilities} Alberta facilities (${provincialOverview.occupancyFrame || 'latest CIHI frame'})`
                : 'No CIHI occupancy rows available'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 shrink-0 border border-rose-500/20">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden border bg-slate-900/60 border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">CIHI ED Physician Assessment P90</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-500 font-mono">
                {provincialOverview.avgP90Wait != null ? `${provincialOverview.avgP90Wait}h` : '—'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">
              {provincialOverview.edFacilities > 0
                ? `Physician initial assessment (${provincialOverview.edFrame || 'latest CIHI frame'})`
                : 'No CIHI ED assessment rows available'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden border bg-slate-900/60 border-slate-800">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Weekly ED LOS rows</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-400 font-mono">{AHS_WEEKLY_ED_LOS.length}</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">
              Facilities with non-empty weekEnding from AHS metro PDFs (empty stubs filtered)
            </span>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>


      {/* Estimated facility-flow grid removed — no verified HQCA FOCUS feed */}
      <AnimatePresence mode="wait">
        {subTab === 'ranked' && (
          <motion.div key="ranked-tab" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
            className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-slate-200">Facility-level flow metrics unavailable</p>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
              Occupancy, ALC, LWBS, and ED bed-wait figures previously shown here were hand-authored analytical estimates, not a live upstream feed. Use the CIHI Occupancy &amp; ED tab for verified CIHI rows, or Weekly ED LOS for AHS metro PDF data.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scatterplot removed — depended on estimated facility occupancy/bed-wait */}
      <AnimatePresence mode="wait">
        {subTab === 'scatterplot' && (
          <motion.div key="scatterplot-tab" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} transition={{ duration: 0.3 }}
            className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-slate-200">Bottleneck correlation unavailable</p>
            <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
              This chart required facility occupancy and P90 bed-wait estimates that are not published on a scrapeable upstream. It has been removed rather than fabricated.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CIHI occupancy + ED physician assessment (real upstream arrays) */}
      <AnimatePresence mode="wait">
        {subTab === 'cihi-occupancy' && (
          <motion.div
            key="cihi-occupancy-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-rose-400" />
                    CIHI Acute Bed Occupancy
                  </h3>
                  <DataTimestamp compact metadata={metadata ?? {}} arrayKey="CIHI_OCCUPANCY_RATES" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Facility-level average acute occupancy from CIHI indicator tables
                  {cihiOccupancySummary.timeFrame ? ` (${cihiOccupancySummary.timeFrame})` : ''}.
                </p>
                {cihiOccupancySummary.rows.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No CIHI occupancy rows available.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-850/60 border border-slate-850 rounded-xl">
                    {cihiOccupancySummary.rows.slice(0, 40).map((r) => (
                      <div key={String(r._name)} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{String(r._name).replace(' (Alta.)', '')}</div>
                          <div className="text-[10px] text-slate-500">{String(r._region)}</div>
                        </div>
                        <span className="font-mono font-black text-rose-400 shrink-0">{r._occ}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    CIHI ED Physician Initial Assessment (P90)
                  </h3>
                  <DataTimestamp compact metadata={metadata ?? {}} arrayKey="CIHI_ED_WAIT_INITIAL_ASSESSMENT" />
                </div>
                <p className="text-[11px] text-slate-400">
                  90th-percentile hours to physician initial assessment
                  {cihiEdWaitSummary.timeFrame ? ` (${cihiEdWaitSummary.timeFrame})` : ''}.
                </p>
                {cihiEdWaitSummary.rows.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">No CIHI ED assessment rows available.</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-slate-850/60 border border-slate-850 rounded-xl">
                    {cihiEdWaitSummary.rows.slice(0, 40).map((r) => (
                      <div key={String(r._name)} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{String(r._name).replace(' (Alta.)', '')}</div>
                          <div className="text-[10px] text-slate-500">{String(r._region)}</div>
                        </div>
                        <span className="font-mono font-black text-amber-400 shrink-0">{r._p90}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- SUB-TAB 5: COMPARATORS & UPSTREAM LGA DEMAND ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'cihi-lga' && (
          <motion.div
            key="cihi-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* CIHI National Benchmarks (Surfacing Comparator Data) */}
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-400" />
                  <span>CIHI National Comparators (Alberta vs Canada Avg)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Standardized metrics illustrating Alberta's system stress level relative to national averages.
                </p>
              </div>

              <div className="space-y-4">
                {CIHI_COMPARATORS.map((comp, idx) => {
                  const isBetterThanCanada = comp.albertaValue < comp.canadaValue;
                  const isBeds = comp.unit === 'beds_per_1000';
                  // Staffed beds is better when higher, others are better when lower
                  const isPositive = isBeds ? !isBetterThanCanada : isBetterThanCanada;

                  // Compute absolute difference and percentage variance
                  const diffPercent = ((comp.albertaValue - comp.canadaValue) / comp.canadaValue) * 100;
                  
                  let varianceText = '';
                  let varianceColor = '';
                  if (isBeds) {
                    // Beds: higher is better
                    if (comp.albertaValue > comp.canadaValue) {
                      varianceText = `+${diffPercent.toFixed(1)}% above national avg (Favorable)`;
                      varianceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    } else if (comp.albertaValue < comp.canadaValue) {
                      varianceText = `${diffPercent.toFixed(1)}% below national avg (Unfavorable)`;
                      varianceColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                    } else {
                      varianceText = 'Equal to national avg';
                      varianceColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                    }
                  } else {
                    // Lower is better (ALC, LOS, LWBS, Readmissions)
                    if (comp.albertaValue < comp.canadaValue) {
                      varianceText = `${diffPercent.toFixed(1)}% below national avg (Favorable)`;
                      varianceColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                    } else if (comp.albertaValue > comp.canadaValue) {
                      varianceText = `+${diffPercent.toFixed(1)}% above national avg (Unfavorable)`;
                      varianceColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                    } else {
                      varianceText = 'Equal to national avg';
                      varianceColor = 'text-slate-400 bg-slate-500/10 border-slate-500/20';
                    }
                  }

                  const formatVal = (val: number) => {
                    if (comp.unit === 'percent') return `${val}%`;
                    if (comp.unit === 'hours') return `${val} hrs`;
                    if (comp.unit === 'beds_per_1000') return `${val} per 1k`;
                    if (comp.unit === 'days') return `${val} days`;
                    return val.toString();
                  };

                  // Parallel bars scaling normalized to max of both values + 15% padding
                  const maxVal = Math.max(comp.albertaValue, comp.canadaValue);
                  const abPercent = (comp.albertaValue / (maxVal * 1.15)) * 100;
                  const caPercent = (comp.canadaValue / (maxVal * 1.15)) * 100;

                  const getMetricIcon = (metricName: string) => {
                    if (metricName.includes('Alternate Level of Care')) return <Layers className="w-4 h-4 text-violet-400" />;
                    if (metricName.includes('Admitted Patient ED Total Length')) return <Clock className="w-4 h-4 text-rose-400" />;
                    if (metricName.includes('Discharged Patient ED Total Length')) return <Clock className="w-4 h-4 text-amber-400" />;
                    if (metricName.includes('Staffed Acute Care Beds')) return <Building2 className="w-4 h-4 text-blue-400" />;
                    if (metricName.includes('Left Without Being Seen')) return <ShieldAlert className="w-4 h-4 text-orange-400" />;
                    if (metricName.includes('Readmissions')) return <Activity className="w-4 h-4 text-indigo-400" />;
                    return <Award className="w-4 h-4 text-slate-400" />;
                  };
                  
                  return (
                    <div key={idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 hover:border-slate-800 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/2 space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-2.5 items-start">
                          <div className="mt-0.5 p-1.5 rounded-lg bg-slate-900 border border-slate-800/80 shrink-0">
                            {getMetricIcon(comp.metric)}
                          </div>
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-black text-slate-200 leading-tight">{comp.metric}</h4>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-medium">{comp.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Variance Badge */}
                      <div className="flex items-center justify-between gap-2 border-t border-b border-slate-900/60 py-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Performance Gap</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border font-mono ${varianceColor}`}>
                          {varianceText}
                        </span>
                      </div>

                      {/* Parallel progress bars */}
                      <div className="space-y-2 pt-1 font-mono text-xs">
                        {/* Alberta Row */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span>Alberta</span>
                            </span>
                            <span className="text-white font-extrabold">{formatVal(comp.albertaValue)}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className={`h-full bg-gradient-to-r ${isPositive ? 'from-emerald-600 to-emerald-400 shadow-emerald-500/20' : 'from-rose-600 to-rose-400 shadow-rose-500/20'} rounded-full`}
                              style={{ width: `${abPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Canada Row */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-medium flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-650" />
                              <span>Canada Average</span>
                            </span>
                            <span className="text-slate-400 font-bold">{formatVal(comp.canadaValue)}</span>
                          </div>
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-900">
                            <div 
                              className="h-full bg-slate-700/80 rounded-full"
                              style={{ width: `${caPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upstream LGA Triage Profiler */}
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Upstream LGA Demand Profiles (Open Alberta Portal)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Emergency department visit rates and Canadian Triage and Acuity Scale (CTAS) profiles by Local Geographic Area (LGA), derived from <a href="https://open.alberta.ca/dataset/28492ab1-7912-4ad1-8988-c666bee26c33" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Open Alberta Table 10.1</a> (community need indicators) and <a href="https://open.alberta.ca/dataset/34236eee-06a6-49aa-a328-71dcfafc6fc1" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">Figure 2.2</a> (LGA population). Click a card to focus on its zone.
                </p>
              </div>

              <div className="space-y-4">
                {REGIONAL_LGA_DEMAND.map((lga, idx) => {
                  const hasPopulation = lga.population > 0;
                  // Use the source edVisitsPer1000 rate directly when available;
                  // only derive from annualEdVisits/population when both are real.
                  const visitRate = hasPopulation
                    ? Math.round((lga.annualEdVisits / lga.population) * 1000)
                    : lga.edVisitsPer1000 ?? 0;
                  const isZoneFocused = selectedZone === lga.zone;
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedZone(lga.zone)}
                      className={`p-4 rounded-xl cursor-pointer border transition-all duration-300 hover:scale-[1.01] hover:shadow-xl hover:shadow-blue-500/2 space-y-3.5 group relative overflow-hidden select-none ${
                        isZoneFocused 
                          ? 'bg-slate-900/90 border-blue-500/50 shadow-blue-500/5' 
                          : 'bg-slate-950/60 border-slate-850 hover:border-slate-800'
                      }`}
                    >
                      {/* Active Indicator Glow Corner */}
                      {isZoneFocused && (
                        <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-blue-500 to-indigo-600 rounded-bl" />
                      )}

                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-black text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                            <MapPin className={`w-3.5 h-3.5 ${isZoneFocused ? 'text-blue-400' : 'text-slate-500'}`} />
                            <span>{lga.lgaName}</span>
                          </h4>
                          <span className="px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-400 text-[8px] font-black font-mono rounded uppercase tracking-wider block w-max">
                            {lga.zone.replace(' Zone', '')}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border font-mono ${
                            isZoneFocused ? 'text-blue-400 border-blue-500/30 bg-blue-500/5' : 'text-slate-500 border-slate-800 bg-slate-950'
                          }`}>
                            {isZoneFocused ? 'Active Filter' : 'Focus Zone'}
                          </span>
                        </div>
                      </div>

                      {/* LGA epidemiological stats grid */}
                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-900 text-center font-mono">
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">ED Visits</span>
                          <span className="text-xs font-black text-slate-200">
                            {hasPopulation ? lga.annualEdVisits.toLocaleString() : <span className="text-slate-600">N/A</span>}
                          </span>
                        </div>
                        <div className="space-y-0.5 border-l border-r border-slate-900">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">Population</span>
                          <span className="text-xs font-black text-slate-200">
                            {hasPopulation ? lga.population.toLocaleString() : <span className="text-slate-600">N/A</span>}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider block">Visit Rate</span>
                          <span className="text-xs font-black text-amber-400">
                            {visitRate > 0 ? `${visitRate} / 1k` : <span className="text-slate-600">N/A</span>}
                          </span>
                        </div>
                      </div>

                      {/* Disclosure notice for LGAs without population data */}
                      {!hasPopulation && (
                        <div className="flex items-start gap-1.5 text-[9px] text-amber-400/80 leading-relaxed bg-amber-500/5 border border-amber-500/15 rounded-lg p-2">
                          <Info className="w-3 h-3 shrink-0 mt-px text-amber-500" />
                          <span>
                            Population unavailable for this composite LGA. ED visit rate is sourced directly from{' '}
                            <a href="https://open.alberta.ca/dataset/28492ab1-7912-4ad1-8988-c666bee26c33" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-300">Open Alberta Table 10.1</a>.
                          </span>
                        </div>
                      )}


                      {/* Segmented triage progress bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-mono text-slate-400 flex-wrap gap-x-3 gap-y-1">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>CTAS 1-2 (Urgent): <strong className="text-slate-200">{lga.ctas1_2_Pct}%</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>CTAS 3 (Mod): <strong className="text-slate-200">{lga.ctas3_Pct}%</strong></span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>CTAS 4-5 (Mild): <strong className="text-slate-200">{lga.ctas4_5_Pct}%</strong></span>
                          </span>
                        </div>
                        
                        {/* Segmented triage capsule with gaps */}
                        <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-950 p-px border border-slate-900 gap-0.5">
                          <div 
                            className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-l-full" 
                            style={{ width: `${lga.ctas1_2_Pct}%` }} 
                            title={`CTAS 1-2: ${lga.ctas1_2_Pct}%`} 
                          />
                          <div 
                            className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full" 
                            style={{ width: `${lga.ctas3_Pct}%` }} 
                            title={`CTAS 3: ${lga.ctas3_Pct}%`} 
                          />
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-r-full" 
                            style={{ width: `${lga.ctas4_5_Pct}%` }} 
                            title={`CTAS 4-5: ${lga.ctas4_5_Pct}%`} 
                          />
                        </div>
                      </div>

                      {/* Diagnoses */}
                      <div className="pt-2 border-t border-slate-900/60 flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed font-medium">
                        <span className="font-black text-slate-300 uppercase tracking-widest text-[8px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-850 shrink-0">
                          Primary Presenting Issue
                        </span>
                        <span className="text-slate-300">{lga.topDiagnosis}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* CTAS Guidelines detailed card */}
              <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-850 space-y-2.5 shadow-md">
                <div className="flex items-center gap-1.5 text-slate-200 font-extrabold text-[11px] uppercase tracking-wide">
                  <Info className="w-3.5 h-3.5 text-blue-400" />
                  <span>Clinical Guidance: Canadian Triage and Acuity Scale (CTAS)</span>
                </div>
                <div className="space-y-2 text-[10px] text-slate-400 leading-relaxed font-medium">
                  <p>
                    <strong>Levels 1 & 2 (Resuscitation / Emergent):</strong> Critical life threats (e.g. cardiac arrest, severe trauma). Require immediate intervention.
                  </p>
                  <p>
                    <strong>Level 3 (Urgent):</strong> Serious conditions requiring moderate resources (e.g., chest pain, asthma flare).
                  </p>
                  <p>
                    <strong>Levels 4 & 5 (Less / Non-Urgent):</strong> Minor illnesses (e.g., sprains, cold symptoms, refills) that can be managed in community clinics, yet crowd metropolitan EDs due to localized primary care access shortfalls.
                  </p>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* AHS Weekly Los PDF Releases Segment */}
      {subTab === 'trends-weekly' && (
      <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>AHS Weekly ED LOS PDF Output releases</span>
            </h3>
            <p className="text-xs text-slate-400">
              Fresh weekly datasets parsed directly from Alberta Health Services weekly ED wait times PDF reports.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Direct Parser Feed
          </span>
        </div>

        {sortedWeeklyEdLos.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">No AHS weekly ED LOS rows with a non-empty weekEnding. Empty PDF stubs are filtered out.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedWeeklyEdLos.map((item, idx) => {
            const isEdmonton = item.city === 'Edmonton';
            const hasData = !!item.weekEnding;
            const warningDischarge = item.pctDischargedWithin4h > 0 && item.pctDischargedWithin4h < 30;
            const warningAdmit = item.pctAdmittedWithin8h > 0 && item.pctAdmittedWithin8h < 20;
            
            return (
              <div key={idx} className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs ${hasData ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-950/20 border-slate-850/50'}`}>
                <div className="space-y-1">
                  <div className="font-extrabold text-slate-200 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isEdmonton ? 'bg-indigo-500' : 'bg-cyan-500'}`}></span>
                    <span>{item.facilityName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {hasData ? `Week Ending: ${item.weekEnding} • ${item.city}, AB` : `${item.city}, AB`}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                  
                  <div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Discharged</div>
                    <div className="font-extrabold text-slate-300">
                      {hasData ? item.dischargedCount : <span className="text-slate-600">—</span>}
                    </div>
                    <div className={`text-[10px] font-black ${warningDischarge ? 'text-rose-400' : hasData ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {hasData ? `${item.pctDischargedWithin4h}%` : <span className="text-slate-600">—</span>}
                      {hasData && <span className="text-[8px] font-normal text-slate-500 font-sans uppercase"> in 4h</span>}
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-800" />

                  <div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Admitted</div>
                    <div className="font-extrabold text-slate-300">
                      {hasData ? item.admittedCount : <span className="text-slate-600">—</span>}
                    </div>
                    <div className={`text-[10px] font-black ${warningAdmit ? 'text-rose-400' : hasData ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {hasData ? `${item.pctAdmittedWithin8h}%` : <span className="text-slate-600">—</span>}
                      {hasData && <span className="text-[8px] font-normal text-slate-500 font-sans uppercase"> in 8h</span>}
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
        )}

        <div className="mt-3 flex items-start gap-2 text-[10px] text-slate-500 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
          <p>
            AHS weekly ED LOS PDFs only publish throughput data for major Edmonton and Calgary hospitals.
            Facilities not included in those reports show "—".
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400 font-medium leading-relaxed">
          <span>Would you like to examine the official, unparsed PDF wait time datasets directly from Alberta Health Services releases?</span>
          <a 
            href="https://www.albertahealthservices.ca/about/Page3166.aspx" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-850 text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 hover:underline tracking-wider uppercase text-[10px]"
          >
            <span>AHS Official Releases Portal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      )}

      {/* Footer methodology notes */}
      <div className="p-4 rounded-xl bg-[#090e21] border border-slate-800 text-[9px] text-slate-500 font-mono leading-relaxed flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <span>Sources shown here: CIHI indicator tables (occupancy &amp; ED physician assessment), Open Alberta LGA demand, and AHS weekly ED LOS PDF parser. Hand-authored facility ALC/LWBS/occupancy estimates have been removed.</span>
        <span className="uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-blue-400" />
          Verified upstream only
        </span>
      </div>

    </div>
  );
}
