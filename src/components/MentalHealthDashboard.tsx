import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  Calendar, 
  Info,
  ChevronRight,
  Heart,
  Layers,
  ShieldAlert,
  PhoneCall,
  Activity,
  Award,
  Users,
  Clock,
  ShieldCheck,
  BarChart2,
  TrendingDown,
  X,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend
} from 'recharts';
import type {
  SubstanceHarmTrend,
  AddictionBedStatus,
  CommunityMHWait,
  HospitalMHSUBurden,
  SupportHelpline,
} from '../mentalHealthData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { useDomainData } from '../hooks/useDomainData';

type MentalHealthData = {
  SUBSTANCE_HARM_TRENDS: SubstanceHarmTrend[];
  ADDICTION_BED_CAPACITIES: AddictionBedStatus[];
  COMMUNITY_MH_WAITS: CommunityMHWait[];
  HOSPITAL_MHSU_BURDEN: HospitalMHSUBurden[];
  SUPPORT_HELPLINES: SupportHelpline[];
  _dataMetadata?: DataMetadataMap;
};

export default function MentalHealthDashboard() {
  // Interactive KPI selected state for substance harms historical trend panel
  const [selectedHarmKpi, setSelectedHarmKpi] = useState<'apparentDeaths' | 'emsOverdoseResponses' | 'hospitalizations' | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'substance-harms' | 'addiction-beds' | 'community-access' | 'er-pressure' | 'helplines'>('substance-harms');
  
  // Interactive Filters
  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('All');
  const [siteSearch, setSiteSearch] = useState<string>('');
  const [waitAgeGroup, setWaitAgeGroup] = useState<string>('All');
  // Live data fetched from /api/data/mental-health
  const { data, metadata, isLoading, error, refresh } = useDomainData<MentalHealthData>('mental-health');
  const SUBSTANCE_HARM_TRENDS = data?.SUBSTANCE_HARM_TRENDS ?? [];
  const ADDICTION_BED_CAPACITIES = data?.ADDICTION_BED_CAPACITIES ?? [];
  const COMMUNITY_MH_WAITS = data?.COMMUNITY_MH_WAITS ?? [];
  const HOSPITAL_MHSU_BURDEN = data?.HOSPITAL_MHSU_BURDEN ?? [];
  const SUPPORT_HELPLINES = data?.SUPPORT_HELPLINES ?? [];

  // Filter Harm Trends - merged into a single dataset (no selector)
  const filteredHarmData = useMemo(() => {
    const years = Array.from(new Set(SUBSTANCE_HARM_TRENDS.map(t => t.year))).sort();
    return years.map(year => {
      const records = SUBSTANCE_HARM_TRENDS.filter(t => t.year === year);
      const apparentDeaths = records.reduce((sum, r) => sum + r.apparentDeaths, 0);
      const hospitalizations = records.reduce((sum, r) => sum + r.hospitalizations, 0);
      const emsOverdoseResponses = records.reduce((sum, r) => sum + r.emsOverdoseResponses, 0);
      return {
        year,
        apparentDeaths,
        hospitalizations,
        emsOverdoseResponses
      };
    });
  }, [SUBSTANCE_HARM_TRENDS]);

  // Historical trend stats for the selected substance harm KPI
  const harmKpiStats = useMemo(() => {
    if (!selectedHarmKpi) return null;
    const values = filteredHarmData.map(t => t[selectedHarmKpi] as number).filter(v => typeof v === 'number');
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
      isIncrease: rawDelta > 0
    };
  }, [selectedHarmKpi, filteredHarmData]);

  const selectedHarmKpiDetails = useMemo(() => {
    if (!selectedHarmKpi) return null;
    switch (selectedHarmKpi) {
      case 'apparentDeaths':
        return {
          label: 'Alberta Apparent Toxicity Deaths',
          description: 'Annual apparent toxicity deaths across Alberta tracked via the Alberta Substance Use Surveillance System. Deaths peaked during the 2023 surge and have begun a gradual decline following expansion of Recovery Communities and opioid agonist treatment access.',
          colorClass: 'text-rose-500',
          strokeColor: '#e11d48',
          gradientId: 'colorDeathsTrend',
          unit: '',
          icon: AlertTriangle
        };
      case 'emsOverdoseResponses':
        return {
          label: 'EMS Suspected Overdose Dispatches',
          description: 'Annual EMS dispatches for suspected opioid and substance overdoses across Alberta. Naloxone kit distribution and opioid agonist treatment networks help suppress overall fatality curves despite persistent call volumes.',
          colorClass: 'text-violet-400',
          strokeColor: '#8b5cf6',
          gradientId: 'colorEmsTrend',
          unit: '',
          icon: PhoneCall
        };
      case 'hospitalizations':
        return {
          label: 'Poisoning Hospital Admissions',
          description: 'Toxic substance poisonings and accidental overdoses requiring inpatient hospitalization care, tracked annually across Alberta acute facilities.',
          colorClass: 'text-emerald-400',
          strokeColor: '#10b981',
          gradientId: 'colorHospTrend',
          unit: '',
          icon: Heart
        };
      default:
        return null;
    }
  }, [selectedHarmKpi]);
  // Aggregate bed capacity stats
  const bedStats = useMemo(() => {
    const total = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const available = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.availableBeds, 0);
    const pctOccupied = ((total - available) / total) * 100;
    return { total, available, pctOccupied };
  }, [ADDICTION_BED_CAPACITIES]);

  // Filter ABED Beds
  const filteredBeds = useMemo(() => {
    return ADDICTION_BED_CAPACITIES.filter(bed => {
      const matchesCorridor = corridorFilter === 'All' || bed.corridor === corridorFilter;
      const matchesBedType = bedTypeFilter === 'All' || bed.bedType === bedTypeFilter;
      const matchesSearch = bed.siteName.toLowerCase().includes(siteSearch.toLowerCase()) || 
                            bed.corridor.toLowerCase().includes(siteSearch.toLowerCase());
      return matchesCorridor && matchesBedType && matchesSearch;
    });
  }, [corridorFilter, bedTypeFilter, siteSearch, ADDICTION_BED_CAPACITIES]);

  // Filter Counselling Waits
  const filteredWaits = useMemo(() => {
    if (waitAgeGroup === 'All') return COMMUNITY_MH_WAITS;
    return COMMUNITY_MH_WAITS.filter(w => w.ageGroup === waitAgeGroup);
  }, [waitAgeGroup, COMMUNITY_MH_WAITS]);

  // Helper to color-code bed status
  const getBedStatusStyle = (status: 'Available' | 'Almost Full' | 'Full') => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Almost Full':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Full':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-800';
    }
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
      {/* Executive Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span>Mental Health & Addictions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track substance use harms, treatment bed capacity, and helpline volumes.
          </p>
          <DataTimestamp metadata={metadata} arrayKey="SUBSTANCE_HARM_TRENDS" />
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('substance-harms')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'substance-harms'
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
            activeSubTab === 'addiction-beds'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Addiction Beds</span>
        </button>
        <button
          onClick={() => setActiveSubTab('community-access')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'community-access'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Community Access</span>
        </button>
        <button
          onClick={() => setActiveSubTab('er-pressure')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'er-pressure'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ER Pressure</span>
        </button>
        <button
          onClick={() => setActiveSubTab('helplines')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'helplines'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Crisis Helplines</span>
        </button>
      </div>

      {/* SUBTAB 1: Overdose & Substance Harms */}
      {activeSubTab === 'substance-harms' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedHarmKpi(selectedHarmKpi === 'apparentDeaths' ? null : 'apparentDeaths')}
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
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Alberta Apparent Toxicity Deaths (2025)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-500">~1,960</span>
                <span className="text-xs text-slate-400 font-mono">deaths</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Gradual reduction from the record 2023 surge (~2,670 deaths) following active expansion of Recovery Communities.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                {selectedHarmKpi === 'apparentDeaths' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedHarmKpi(selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedHarmKpi(selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedHarmKpi === 'emsOverdoseResponses'
                  ? 'border-violet-500/50 ring-1 ring-violet-500/30 shadow-violet-500/5'
                  : 'border-slate-800 hover:border-violet-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Emergency EMS overdose dispatches (2025)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-violet-400">~11,000</span>
                <span className="text-xs text-slate-400 font-mono">annual responses</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Opioid agonist treatments and rapid naloxone kit distribution networks help suppress overall fatality curves.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                {selectedHarmKpi === 'emsOverdoseResponses' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedHarmKpi(selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedHarmKpi(selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedHarmKpi === 'hospitalizations'
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                  : 'border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Poisoning Hospital Admissions (2025)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">~4,300</span>
                <span className="text-xs text-slate-400 font-mono">admissions</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Toxic substance poisonings and accidental overdoses requiring inpatient hospitalization care.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                {selectedHarmKpi === 'hospitalizations' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>
          </div>

          {/* Substance Harms Historical Trend Explorer Panel */}
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
                          className: `w-4 h-4 ${selectedHarmKpiDetails.colorClass}`
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (2019)</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{harmKpiStats.baseline}{selectedHarmKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (2025)</span>
                      <span className="text-xl font-black text-white font-mono">{harmKpiStats.latest}{selectedHarmKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Period Peak</span>
                      <span className={`text-xl font-black font-mono ${selectedHarmKpiDetails.colorClass}`}>{harmKpiStats.peak}{selectedHarmKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                        harmKpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        {harmKpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{harmKpiStats.delta}{selectedHarmKpiDetails.unit} ({harmKpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredHarmData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={selectedHarmKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedHarmKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={selectedHarmKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8 }} />
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
            {/* Harms Trend Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Substance-Induced Toxicity & Overdose Harms</h3>
                  <p className="text-[10px] text-slate-500">Comparing toxicological outcomes and emergency EMS calls by category</p>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredHarmData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorDeaths" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorEMS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="apparentDeaths" name="Apparent Toxicity Deaths" stroke="#e11d48" fillOpacity={1} fill="url(#colorDeaths)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="emsOverdoseResponses" name="EMS Suspected Overdose Calls" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorEMS)" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="hospitalizations" name="Poisoning Hospital Admissions" stroke="#10b981" strokeWidth={2} dot />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* In-depth Annual Breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Annual Event Breakdown</h3>
                  <p className="text-[10px] text-slate-500">Total recorded events across Alberta by year</p>
                </div>

                <div className="space-y-3 pt-1">
                  {filteredHarmData.map(item => (
                    <div key={item.year} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-white border-b border-slate-850/50 pb-1.5">
                        <span>Year {item.year}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                        <div>
                          <span className="text-[9px] text-slate-400 block">Deaths</span>
                          <span className="font-mono text-xs font-black text-rose-500">{item.apparentDeaths.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">EMS Calls</span>
                          <span className="font-mono text-xs font-black text-violet-400">{item.emsOverdoseResponses.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block">Admissions</span>
                          <span className="font-mono text-xs font-black text-emerald-400">{item.hospitalizations.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-850 pt-3 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Surveillance Notice:</strong> Subscriptions, clinical toxicology diagnostics, and medical examiner findings contribute to registry backlogs which update retroactively.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Daily Bed Capacity (findaddictionbeds.alberta.ca) */}
      {activeSubTab === 'addiction-beds' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="ADDICTION_BED_CAPACITIES" />
          {/* Bed search & corridor filters */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Calgary Corridor', 'Edmonton Corridor', 'Central Corridor', 'South Corridor', 'North Corridor'].map(corr => (
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

          {/* Bed occupancies summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">ABED Active Sites</span>
              <span className="text-xl font-bold text-white">{ADDICTION_BED_CAPACITIES.length} registered sites</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Total Bed Allocation</span>
              <span className="text-xl font-bold text-white">{bedStats.total} beds</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Available Beds Today</span>
              <span className="text-xl font-bold text-emerald-400">{bedStats.available} vacancies</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Avg System Bed Occupancy</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{bedStats.pctOccupied.toFixed(1)}%</span>
                <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div className="bg-purple-500 h-full" style={{ width: `${bedStats.pctOccupied}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bed List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBeds.map(bed => {
              return (
                <div key={bed.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{bed.siteName}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="truncate">{bed.corridor}</span>
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${getBedStatusStyle(bed.status)}`}>
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
                        <span className="font-semibold text-slate-300 truncate">{bed.gender} • {bed.bedType === 'Youth Specific' ? 'Youth' : 'Adult'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-850/60">
                      <span className="text-slate-400">Available Beds:</span>
                      <strong className="text-slate-200 font-mono font-black">{bed.availableBeds} / {bed.totalBeds}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-[10px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{bed.lastUpdated}</span>
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
                <p className="text-slate-400 text-xs">No active treatment or recovery beds matched your search parameters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: Community MH Counselling (CIHI Indicators) */}
      {activeSubTab === 'community-access' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="COMMUNITY_MH_WAITS" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Counselling waits chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Community Mental Health Waiting Durations</h3>
                  <p className="text-[10px] text-slate-500">Wait times from intake referral to first integrated counseling session (days)</p>
                </div>

                <div className="relative">
                  <select
                    value={waitAgeGroup}
                    onChange={(e) => setWaitAgeGroup(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="All">All Age Cohorts</option>
                    <option value="Children & Youth (5-17)">Children & Youth (5-17)</option>
                    <option value="Adults (18+)">Adults (18+)</option>
                  </select>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredWaits}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="albertaMedianWaitDays" name="Alberta Median Wait" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="albertaP90WaitDays" name="Alberta 90th Percentile Wait" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="canadaMedianWaitDays" name="Canada Median Wait" fill="#4b5563" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-850/60 rounded-xl flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  💡 <strong>Early Intervention:</strong> 2025 metrics show improved youth counselling waits (Median down to 21 days) following targeted regional pilot schemes and virtual outpatient intake support frameworks.
                </p>
              </div>
            </div>

            {/* Unmet care needs panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Unmet Care Need Gaps</h3>
                <p className="text-[10px] text-slate-500">Percent reporting unmet mental health care demands</p>
              </div>

              <div className="space-y-3.5">
                {filteredWaits.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs font-bold text-white">
                      <span>{item.ageGroup}</span>
                      <span className="text-purple-400 font-mono font-extrabold">{item.year}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Unmet need rate:</span>
                        <strong className="text-rose-400 font-mono font-bold">{item.unmetNeedPct}%</strong>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${item.unmetNeedPct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center gap-2 text-[10px] text-slate-500">
                <Award className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-purple-300">Reducing waiting times directly coordinates with reduced emergency department presentations.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ER & Hospital Pressure */}
      {activeSubTab === 'er-pressure' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="HOSPITAL_MHSU_BURDEN" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Readmissions & ER Overloads */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Mental Health System Readmission & ER Metrics</h3>
                <p className="text-[10px] text-slate-500">Percentage of mental health & substance use (MHSU) patients requiring recurrent acute interventions</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={HOSPITAL_MHSU_BURDEN}
                    margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="albertaRatePct" name="Alberta Rate %" stroke="#a78bfa" strokeWidth={2.5} dot />
                    <Line type="monotone" dataKey="canadaRatePct" name="Canadian National Average %" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                ⚠️ <strong>Recurring Acute Burden:</strong> Higher rates of repeat hospital presentations (recurrent within 30 days) often indicate gaps in post-discharge community stabilization, and primary-care attachment barriers.
              </p>
            </div>

            {/* Inpatient counts panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Acute Cohort Overloads</h3>
                  <p className="text-[10px] text-slate-500">Annual inpatient occurrences and clinical admissions volumes</p>
                </div>

                <div className="space-y-3 pt-1">
                  {HOSPITAL_MHSU_BURDEN.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-extrabold">{item.metric}</span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-black text-white">{(item.annualCount).toLocaleString()} cases</span>
                        <span className="text-[10px] text-purple-400 font-mono font-bold">({item.year})</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>AB Rate: {item.albertaRatePct}%</span>
                        <span>CA Avg: {item.canadaRatePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 flex items-start gap-1.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Triage Goal:</strong> Discharges coordinated with mental-health coordinators within 7 days reduce the likelihood of recurrence by up to 30%.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Helplines & Support Pathways */}
      {activeSubTab === 'helplines' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="SUPPORT_HELPLINES" />
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Crisis Helplines & Navigation Pathways</h3>
              <p className="text-[10px] text-slate-500">Immediate, toll-free mental health support services available to Alberta residents</p>
            </div>

            {/* Helpline cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUPPORT_HELPLINES.map((hl, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:border-purple-500/40 transition-all">
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
          </div>
        </div>
      )}
    </div>
  );
}
