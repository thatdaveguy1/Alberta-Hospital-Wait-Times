import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Search,
  MapPin,
  AlertTriangle,
  TrendingUp,
  Info,
  PhoneCall,
  Activity,
  Layers,
  Clock,
  ShieldAlert,
  BarChart2,
  TrendingDown,
  X,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type {
  SubstanceHarmTrend,
  AddictionBedStatus,
  SupportHelpline,
} from '../mentalHealthData';
import * as mentalHealthData from '../mentalHealthData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type MentalHealthSubTab =
  | 'substance-harms'
  | 'addiction-beds'
  | 'mh-readmissions'
  | 'helplines';

type MentalHealthData = {
  SUBSTANCE_HARM_TRENDS: SubstanceHarmTrend[];
  ADDICTION_BED_CAPACITIES: AddictionBedStatus[];
  SUPPORT_HELPLINES: SupportHelpline[];
  CIHI_MH_READMISSION_RATES?: Record<string, unknown>[];
  _dataMetadata?: DataMetadataMap;
};

function parseCihiNumber(value: unknown): number | null {
  if (value == null || value === '' || value === '–' || value === '-' || value === '—') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Province-wide totals are only trusted for complete All Substances rows (or multi-type verified sets). */
function isSubstanceHarmsComplete(rows: SubstanceHarmTrend[]): boolean {
  if (rows.length === 0) return false;
  const types = new Set(rows.map((r) => r.substanceType));
  // Single-type subsets (e.g. Stimulants-only) are incomplete for all-substance KPIs.
  if (types.size === 1 && !types.has('All Substances')) return false;
  // Prefer All Substances rows with core metrics present; never invent province totals from partial types.
  const allSubstanceRows = rows.filter((r) => r.substanceType === 'All Substances');
  if (allSubstanceRows.length === 0) return false;
  return allSubstanceRows.every(
    (r) =>
      typeof r.apparentDeaths === 'number' &&
      typeof r.hospitalizations === 'number' &&
      typeof r.emsOverdoseResponses === 'number' &&
      typeof r.albertaRatePer100k === 'number',
  );
}

export default function MentalHealthDashboard() {
  const [selectedHarmKpi, setSelectedHarmKpi] = useState<
    'apparentDeaths' | 'emsOverdoseResponses' | 'hospitalizations' | null
  >(null);
  // null until first explicit tab click — default derived from substance completeness.
  const [activeSubTab, setActiveSubTab] = useState<MentalHealthSubTab | null>(null);

  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('All');
  const [siteSearch, setSiteSearch] = useState<string>('');

  const { data, metadata, isLoading, error, refresh } = useDomainData<MentalHealthData>(
    'mental-health',
    mentalHealthData,
  );
  const SUBSTANCE_HARM_TRENDS = data?.SUBSTANCE_HARM_TRENDS ?? [];
  const ADDICTION_BED_CAPACITIES = data?.ADDICTION_BED_CAPACITIES ?? [];
  const SUPPORT_HELPLINES = data?.SUPPORT_HELPLINES ?? [];
  const CIHI_MH_READMISSION_RATES = data?.CIHI_MH_READMISSION_RATES ?? [];

  const substanceHarmsComplete = useMemo(
    () => isSubstanceHarmsComplete(SUBSTANCE_HARM_TRENDS),
    [SUBSTANCE_HARM_TRENDS],
  );

  const effectiveSubTab: MentalHealthSubTab =
    activeSubTab ?? (substanceHarmsComplete ? 'substance-harms' : 'addiction-beds');

  // Only aggregate verified All Substances rows — never sum stimulants-only as province totals.
  const filteredHarmData = useMemo(() => {
    if (!substanceHarmsComplete) return [];
    const complete = SUBSTANCE_HARM_TRENDS.filter((t) => t.substanceType === 'All Substances');
    const years = Array.from(new Set(complete.map((t) => t.year))).sort();
    return years.map((year) => {
      const records = complete.filter((t) => t.year === year);
      const apparentDeaths = records.reduce((sum, r) => sum + r.apparentDeaths, 0);
      const hospitalizations = records.reduce((sum, r) => sum + r.hospitalizations, 0);
      const emsOverdoseResponses = records.reduce((sum, r) => sum + r.emsOverdoseResponses, 0);
      return { year, apparentDeaths, hospitalizations, emsOverdoseResponses };
    });
  }, [SUBSTANCE_HARM_TRENDS, substanceHarmsComplete]);

  const substanceHarmStats = useMemo(() => {
    if (filteredHarmData.length === 0) {
      return { latest: null as (typeof filteredHarmData)[number] | null, peak: null as (typeof filteredHarmData)[number] | null };
    }
    const latest = filteredHarmData[filteredHarmData.length - 1];
    const peak = filteredHarmData.reduce(
      (max, r) => (r.apparentDeaths > max.apparentDeaths ? r : max),
      filteredHarmData[0],
    );
    return { latest, peak };
  }, [filteredHarmData]);

  const harmKpiStats = useMemo(() => {
    if (!selectedHarmKpi || !substanceHarmsComplete) return null;
    const values = filteredHarmData
      .map((t) => t[selectedHarmKpi] as number)
      .filter((v) => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toLocaleString(),
      latest: latest.toLocaleString(),
      peak: peak.toLocaleString(),
      minVal: minVal.toLocaleString(),
      delta: rawDelta > 0 ? `+${rawDelta.toLocaleString()}` : rawDelta.toLocaleString(),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0,
    };
  }, [selectedHarmKpi, filteredHarmData, substanceHarmsComplete]);

  const selectedHarmKpiDetails = useMemo(() => {
    if (!selectedHarmKpi) return null;
    switch (selectedHarmKpi) {
      case 'apparentDeaths':
        return {
          label: 'Alberta Apparent Toxicity Deaths',
          description:
            'Annual apparent toxicity deaths across Alberta from the Alberta Substance Use Surveillance System (complete All Substances rows only).',
          colorClass: 'text-rose-500',
          strokeColor: '#e11d48',
          gradientId: 'colorDeathsTrend',
          unit: '',
          icon: AlertTriangle,
        };
      case 'emsOverdoseResponses':
        return {
          label: 'EMS Suspected Overdose Dispatches',
          description:
            'Annual EMS dispatches for suspected opioid and substance overdoses across Alberta (complete source-backed rows only).',
          colorClass: 'text-violet-400',
          strokeColor: '#8b5cf6',
          gradientId: 'colorEmsTrend',
          unit: '',
          icon: PhoneCall,
        };
      case 'hospitalizations':
        return {
          label: 'Poisoning Hospital Admissions',
          description:
            'Toxic substance poisonings and accidental overdoses requiring inpatient hospitalization (complete source-backed rows only).',
          colorClass: 'text-emerald-400',
          strokeColor: '#10b981',
          gradientId: 'colorHospTrend',
          unit: '',
          icon: Activity,
        };
      default:
        return null;
    }
  }, [selectedHarmKpi]);

  const bedStats = useMemo(() => {
    const total = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const liveSites = ADDICTION_BED_CAPACITIES.filter(
      (b) => b.availableBeds !== null && b.availableBeds !== undefined,
    );
    const liveTotal = liveSites.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const available = liveSites.reduce((acc, curr) => acc + (curr.availableBeds ?? 0), 0);
    const pctOccupied = liveTotal > 0 ? ((liveTotal - available) / liveTotal) * 100 : 0;
    return { total, available, pctOccupied, liveCount: liveSites.length, hasLiveData: liveSites.length > 0 };
  }, [ADDICTION_BED_CAPACITIES]);

  const filteredBeds = useMemo(() => {
    return ADDICTION_BED_CAPACITIES.filter((bed) => {
      const matchesCorridor = corridorFilter === 'All' || bed.corridor === corridorFilter;
      const matchesBedType = bedTypeFilter === 'All' || bed.bedType === bedTypeFilter;
      const matchesSearch =
        bed.siteName.toLowerCase().includes(siteSearch.toLowerCase()) ||
        bed.corridor.toLowerCase().includes(siteSearch.toLowerCase());
      return matchesCorridor && matchesBedType && matchesSearch;
    });
  }, [corridorFilter, bedTypeFilter, siteSearch, ADDICTION_BED_CAPACITIES]);

  // CIHI 30-day MH/SU readmission: province-level, Level 1 Not applicable, rate by Time frame.
  const mhReadmissionChart = useMemo(() => {
    const rows = CIHI_MH_READMISSION_RATES;
    if (rows.length === 0) return [];

    const isProvinceLevel = (r: Record<string, unknown>) => {
      const level = String(r['Reporting level'] ?? '').toLowerCase();
      return level.includes('province') || level === '' || level === '–';
    };
    const isNotApplicableBreakdown = (r: Record<string, unknown>) =>
      String(r['Level 1 breakdown'] ?? '') === 'Not applicable';

    const alberta = rows.filter((r) => {
      const prov = String(r['Province/Territory'] ?? '');
      return (
        (prov === 'Alberta' || prov.includes('Alberta')) &&
        isNotApplicableBreakdown(r) &&
        isProvinceLevel(r)
      );
    });
    const canada = rows.filter((r) => {
      const prov = String(r['Province/Territory'] ?? '');
      return (
        (prov === 'Canada' || prov === 'National' || prov.includes('Canada')) &&
        isNotApplicableBreakdown(r) &&
        isProvinceLevel(r)
      );
    });

    const frames = Array.from(
      new Set(
        [...alberta, ...canada]
          .map((r) => String(r['Time frame'] ?? ''))
          .filter(Boolean),
      ),
    ).sort();

    return frames
      .map((frame) => {
        const ab = alberta.find((r) => String(r['Time frame'] ?? '') === frame);
        const ca = canada.find((r) => String(r['Time frame'] ?? '') === frame);
        return {
          timeFrame: frame,
          albertaRate: ab ? parseCihiNumber(ab['Risk-adjusted rate']) : null,
          canadaRate: ca ? parseCihiNumber(ca['Risk-adjusted rate']) : null,
        };
      })
      .filter((d) => d.albertaRate != null || d.canadaRate != null);
  }, [CIHI_MH_READMISSION_RATES]);

  const getBedStatusStyle = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === 'available') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (lower === 'almost full') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (lower === 'full') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (lower.includes('planned')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (lower.includes('operational')) return 'bg-slate-700/30 text-slate-300 border-slate-600/30';
    return 'bg-slate-900 text-slate-400 border-slate-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading mental health data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load mental health data: {error}</span>
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
    <div className="space-y-6">
      <DashboardHeader
        icon={Brain}
        title="Mental Health & Addictions"
        description="Track substance use harms, treatment bed capacity, CIHI MH readmissions, and helpline directories."
        metadata={metadata}
        arrayKey={substanceHarmsComplete ? 'SUBSTANCE_HARM_TRENDS' : 'ADDICTION_BED_CAPACITIES'}
      />

      <div className="sticky top-16 z-20 bg-[#070b19]/95 backdrop-blur-sm border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar -mx-1 px-1">
        <button
          onClick={() => setActiveSubTab('substance-harms')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            effectiveSubTab === 'substance-harms'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Substance Harms</span>
        </button>
        <button
          onClick={() => setActiveSubTab('addiction-beds')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            effectiveSubTab === 'addiction-beds'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Addiction Beds</span>
        </button>
        <button
          onClick={() => setActiveSubTab('mh-readmissions')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            effectiveSubTab === 'mh-readmissions'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>MH Readmissions</span>
        </button>
        <button
          onClick={() => setActiveSubTab('helplines')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            effectiveSubTab === 'helplines'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Crisis Helplines</span>
        </button>
      </div>

      {/* SUBTAB: Substance Harms */}
      {effectiveSubTab === 'substance-harms' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="SUBSTANCE_HARM_TRENDS" />

          {!substanceHarmsComplete ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-white">Substance harm trends unavailable</h3>
              <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
                Data unavailable until the Alberta Substance Use Surveillance pipeline produces complete
                source-backed rows (apparent deaths, EMS overdose responses, hospitalizations, and Alberta
                rate for All Substances). Partial single-substance subsets are not shown as province-wide
                totals.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(selectedHarmKpi === 'apparentDeaths' ? null : 'apparentDeaths')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(selectedHarmKpi === 'apparentDeaths' ? null : 'apparentDeaths');
                    }
                  }}
                  className={`bg-slate-900 border p-4 rounded-xl space-y-1 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                    selectedHarmKpi === 'apparentDeaths'
                      ? 'border-rose-500/50 ring-1 ring-rose-500/30 shadow-rose-500/5'
                      : 'border-slate-800 hover:border-rose-500/30'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Alberta Apparent Toxicity Deaths
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-rose-500">
                      {substanceHarmStats.latest?.apparentDeaths != null
                        ? substanceHarmStats.latest.apparentDeaths.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">deaths</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    {substanceHarmStats.peak &&
                    substanceHarmStats.latest &&
                    substanceHarmStats.peak.year !== substanceHarmStats.latest.year
                      ? `Period peak year in source series: ${substanceHarmStats.peak.year} (${substanceHarmStats.peak.apparentDeaths.toLocaleString()} deaths).`
                      : 'Latest complete annual apparent toxicity deaths (All Substances).'}
                  </p>
                  <span className="text-[9px] text-slate-500 group-hover:text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                    {selectedHarmKpi === 'apparentDeaths' ? 'Active: Hide Trend' : 'Click to View Trend'}
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(
                      selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses',
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(
                        selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses',
                      );
                    }
                  }}
                  className={`bg-slate-900 border p-4 rounded-xl space-y-1 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                    selectedHarmKpi === 'emsOverdoseResponses'
                      ? 'border-violet-500/50 ring-1 ring-violet-500/30 shadow-violet-500/5'
                      : 'border-slate-800 hover:border-violet-500/30'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Emergency EMS overdose dispatches
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-violet-400">
                      {substanceHarmStats.latest?.emsOverdoseResponses != null
                        ? substanceHarmStats.latest.emsOverdoseResponses.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">annual responses</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    Source-backed EMS suspected overdose dispatches for the latest complete year.
                  </p>
                  <span className="text-[9px] text-slate-500 group-hover:text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                    {selectedHarmKpi === 'emsOverdoseResponses'
                      ? 'Active: Hide Trend'
                      : 'Click to View Trend'}
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(
                        selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations',
                      );
                    }
                  }}
                  className={`bg-slate-900 border p-4 rounded-xl space-y-1 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                    selectedHarmKpi === 'hospitalizations'
                      ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                      : 'border-slate-800 hover:border-emerald-500/30'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Poisoning Hospital Admissions
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-400">
                      {substanceHarmStats.latest?.hospitalizations != null
                        ? substanceHarmStats.latest.hospitalizations.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">admissions</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    Source-backed poisoning hospital admissions for the latest complete year.
                  </p>
                  <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                    {selectedHarmKpi === 'hospitalizations' ? 'Active: Hide Trend' : 'Click to View Trend'}
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectedHarmKpi && selectedHarmKpiDetails && harmKpiStats && (
                  <motion.div
                    key={`harm-kpi-trend-${selectedHarmKpi}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl relative">
                      <button
                        onClick={() => setSelectedHarmKpi(null)}
                        className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                        title="Close panel"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                        <div className="space-y-1">
                          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                            {React.createElement(selectedHarmKpiDetails.icon, {
                              className: `w-4 h-4 ${selectedHarmKpiDetails.colorClass}`,
                            })}
                            <span>{selectedHarmKpiDetails.label} Historical Trend Explorer</span>
                          </h3>
                          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                            {selectedHarmKpiDetails.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Series start
                          </span>
                          <span className="text-xl font-black text-slate-300 font-mono">
                            {harmKpiStats.baseline}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Latest
                          </span>
                          <span className="text-xl font-black text-white font-mono">
                            {harmKpiStats.latest}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Period Peak
                          </span>
                          <span
                            className={`text-xl font-black font-mono ${selectedHarmKpiDetails.colorClass}`}
                          >
                            {harmKpiStats.peak}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Overall Shift
                          </span>
                          <span
                            className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                              harmKpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                            }`}
                          >
                            {harmKpiStats.isIncrease ? (
                              <TrendingUp className="w-4 h-4 shrink-0" />
                            ) : (
                              <TrendingDown className="w-4 h-4 shrink-0" />
                            )}
                            <span>
                              {harmKpiStats.delta}
                              {selectedHarmKpiDetails.unit} ({harmKpiStats.pctChange})
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={filteredHarmData}
                            margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id={selectedHarmKpiDetails.gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={selectedHarmKpiDetails.strokeColor}
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={selectedHarmKpiDetails.strokeColor}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis
                              dataKey="year"
                              stroke="#64748b"
                              style={{ fontSize: 10, fontFamily: 'monospace' }}
                            />
                            <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#1e293b',
                                borderRadius: 8,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey={selectedHarmKpi}
                              name={selectedHarmKpiDetails.label}
                              stroke={selectedHarmKpiDetails.strokeColor}
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill={`url(#${selectedHarmKpiDetails.gradientId})`}
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
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Substance-Induced Toxicity & Overdose Harms
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Complete All Substances rows only — not single-substance subsets
                    </p>
                  </div>

                  {filteredHarmData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-500">
                      No complete trend points available.
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filteredHarmData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorDeaths" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorEMS" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={9} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Area
                            type="monotone"
                            dataKey="apparentDeaths"
                            name="Apparent Toxicity Deaths"
                            stroke="#e11d48"
                            fillOpacity={1}
                            fill="url(#colorDeaths)"
                            strokeWidth={2.5}
                          />
                          <Area
                            type="monotone"
                            dataKey="emsOverdoseResponses"
                            name="EMS Suspected Overdose Calls"
                            stroke="#8b5cf6"
                            fillOpacity={1}
                            fill="url(#colorEMS)"
                            strokeWidth={1.5}
                          />
                          <Line
                            type="monotone"
                            dataKey="hospitalizations"
                            name="Poisoning Hospital Admissions"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Annual Event Breakdown
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Total recorded events across Alberta by year
                      </p>
                    </div>

                    <div className="space-y-3 pt-1">
                      {filteredHarmData.map((item) => (
                        <div
                          key={item.year}
                          className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs font-bold text-white border-b border-slate-850/50 pb-1.5">
                            <span>Year {item.year}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                            <div>
                              <span className="text-[9px] text-slate-400 block">Deaths</span>
                              <span className="font-mono text-xs font-black text-rose-500">
                                {item.apparentDeaths.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">EMS Calls</span>
                              <span className="font-mono text-xs font-black text-violet-400">
                                {item.emsOverdoseResponses.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-400 block">Admissions</span>
                              <span className="font-mono text-xs font-black text-emerald-400">
                                {item.hospitalizations.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredHarmData.length === 0 && (
                        <p className="text-xs text-slate-500">No annual breakdown rows available.</p>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-850 pt-3 flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Surveillance Notice:</strong> Registry backlogs may update prior years
                      retroactively when medical examiner and toxicology findings are finalized.
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB: Addiction Beds (ABED) */}
      {effectiveSubTab === 'addiction-beds' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="ADDICTION_BED_CAPACITIES" />
          <div className="bg-slate-900/60 border border-slate-800/60 p-3 rounded-lg flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Bed availability data is sourced from the{' '}
              <a
                href="https://findaddictionbeds.alberta.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Addiction Bed Exploration Dashboard (ABED)
              </a>
              , updated once daily (Mon–Fri). Beds cannot be reserved through the dashboard — contact
              sites directly to confirm availability, intake policies, and waitlist information. For
              immediate help, call 211 or visit{' '}
              <a
                href="https://recoveryaccessalberta.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Recovery Access Alberta
              </a>
              .
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {[
                'All',
                'Calgary Corridor',
                'Edmonton Corridor',
                'Central Corridor',
                'South Corridor',
                'North Corridor',
              ].map((corr) => (
                <button
                  key={corr}
                  onClick={() => setCorridorFilter(corr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    corridorFilter === corr
                      ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {corr.replace(' Corridor', '')}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search bed providers or sites..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                ABED Active Sites
              </span>
              <span className="text-xl font-bold text-white">
                {ADDICTION_BED_CAPACITIES.length > 0
                  ? `${ADDICTION_BED_CAPACITIES.length} registered sites`
                  : 'N/A'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                Total Bed Allocation
              </span>
              <span className="text-xl font-bold text-white">
                {ADDICTION_BED_CAPACITIES.length > 0 ? `${bedStats.total} beds` : 'N/A'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                Available Beds Today
              </span>
              {bedStats.hasLiveData ? (
                <span className="text-xl font-bold text-emerald-400">
                  {bedStats.available} of {bedStats.total} beds
                </span>
              ) : (
                <span className="text-sm font-bold text-amber-400">N/A</span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                Avg System Bed Occupancy
              </span>
              {bedStats.hasLiveData ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-white">
                    {bedStats.pctOccupied.toFixed(1)}%
                  </span>
                  <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                    <div className="bg-purple-500 h-full" style={{ width: `${bedStats.pctOccupied}%` }} />
                  </div>
                </div>
              ) : (
                <span className="text-sm font-bold text-amber-400">N/A</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBeds.map((bed) => {
              return (
                <div
                  key={bed.id}
                  className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{bed.siteName}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="truncate">{bed.corridor}</span>
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${getBedStatusStyle(bed.status)}`}
                      >
                        {bed.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-850/60">
                      <div className="bg-slate-950/40 p-2 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Care Bed Type</span>
                        <span className="font-semibold text-slate-300 truncate">{bed.bedType}</span>
                      </div>
                      <div className="bg-slate-950/40 p-2 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Gender / Age</span>
                        <span className="font-semibold text-slate-300 truncate">
                          {bed.gender} • {bed.bedType === 'Youth Specific' ? 'Youth' : 'Adult'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-850/60">
                      {bed.availableBeds !== null && bed.availableBeds !== undefined ? (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Available Beds:</span>
                            <strong className="text-slate-200 font-mono font-black">
                              {bed.availableBeds} / {bed.totalBeds}
                            </strong>
                          </div>
                          <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                            <div
                              className="bg-emerald-500 h-full"
                              style={{
                                width: `${Math.min(100, (bed.availableBeds / bed.totalBeds) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-[9px] text-slate-500">
                            {bed.availableBeds === 0
                              ? 'No vacancies currently reported'
                              : bed.availableBeds / bed.totalBeds < 0.25
                                ? 'Limited availability'
                                : 'Beds available now'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Available Beds:</span>
                            <strong className="text-amber-400 font-mono font-black">N/A</strong>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">Total Beds:</span>
                            <strong className="text-slate-200 font-mono font-black">
                              {bed.totalBeds} beds
                            </strong>
                          </div>
                          <p className="text-[9px] text-amber-400/80">
                            Live availability not currently reported for this site. Check{' '}
                            <a
                              href="https://findaddictionbeds.alberta.ca/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-amber-300"
                            >
                              ABED
                            </a>{' '}
                            or call 211 for current status.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-[10px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{bed.lastUpdated ?? 'N/A'}</span>
                    </span>

                    <a
                      href="https://recoveryaccessalberta.ca/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all text-center"
                    >
                      Triage Intake
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredBeds.length === 0 && (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">
                  {ADDICTION_BED_CAPACITIES.length === 0
                    ? 'Addiction bed capacity data is currently unavailable.'
                    : 'No active treatment or recovery beds matched your search parameters.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: CIHI MH Readmissions */}
      {effectiveSubTab === 'mh-readmissions' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="CIHI_MH_READMISSION_RATES" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  30-Day Readmission for Mental Health and Substance Use
                </h3>
                <p className="text-[10px] text-slate-500">
                  CIHI risk-adjusted rate by fiscal time frame (province-level, Level 1 breakdown: Not
                  applicable)
                </p>
              </div>

              {mhReadmissionChart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <AlertTriangle className="w-7 h-7 text-amber-500" />
                  <p className="text-xs text-slate-400">
                    CIHI mental-health readmission rates are currently unavailable for Alberta at
                    province level.
                  </p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mhReadmissionChart}
                      margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeFrame" stroke="#64748b" fontSize={9} />
                      <YAxis
                        label={{
                          value: 'Risk-adjusted rate',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748b',
                          fontSize: 10,
                        }}
                        stroke="#64748b"
                        fontSize={9}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="albertaRate"
                        name="Alberta risk-adjusted rate"
                        stroke="#a78bfa"
                        strokeWidth={2.5}
                        dot
                        connectNulls
                      />
                      {mhReadmissionChart.some((d) => d.canadaRate != null) && (
                        <Line
                          type="monotone"
                          dataKey="canadaRate"
                          name="Canada risk-adjusted rate"
                          stroke="#64748b"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[10px] text-slate-400">
                Source: CIHI 30-Day Readmission for Mental Health and Substance Use indicator table.
                Only province/territory rows with Level 1 breakdown &quot;Not applicable&quot; are charted.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Alberta series points
                  </h3>
                  <p className="text-[10px] text-slate-500">Risk-adjusted rate by fiscal time frame</p>
                </div>

                <div className="space-y-3 pt-1 max-h-80 overflow-y-auto">
                  {mhReadmissionChart.length === 0 && (
                    <p className="text-xs text-slate-500">No province-level readmission rows available.</p>
                  )}
                  {mhReadmissionChart.map((item) => (
                    <div
                      key={item.timeFrame}
                      className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5"
                    >
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-extrabold">
                        {item.timeFrame}
                      </span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-black text-white">
                          {item.albertaRate != null ? item.albertaRate.toFixed(1) : 'N/A'}
                        </span>
                        <span className="text-[10px] text-purple-400 font-mono font-bold">AB rate</span>
                      </div>
                      {item.canadaRate != null && (
                        <div className="flex justify-between text-[9px] text-slate-400">
                          <span>Canada comparator</span>
                          <span className="font-mono">{item.canadaRate.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 flex items-start gap-1.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  Values are risk-adjusted rates from CIHI. Missing Canada comparators are omitted when
                  not present in the domain payload.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: Helplines */}
      {effectiveSubTab === 'helplines' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="SUPPORT_HELPLINES" />
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Crisis Helplines & Navigation Pathways
              </h3>
              <p className="text-[10px] text-slate-500">
                Immediate, toll-free mental health support services available to Alberta residents
              </p>
            </div>

            {SUPPORT_HELPLINES.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto" />
                <p className="text-xs text-slate-400">
                  Crisis helpline directory is currently unavailable from upstream sources.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUPPORT_HELPLINES.map((hl, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:border-purple-500/40 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <PhoneCall className="w-4 h-4 text-purple-400" />
                          <span>{hl.name}</span>
                        </h4>
                        <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                          {hl.availability}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{hl.description}</p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-[10px]">
                      <span className="text-slate-500 font-mono font-medium">{hl.scope}</span>
                      <a
                        href={`tel:${hl.number.replace(/\s+/g, '')}`}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1"
                      >
                        <span>Call {hl.number}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
