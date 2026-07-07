import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Clock, 
  User, 
  Building2, 
  Sparkles, 
  TrendingUp, 
  Info, 
  FileText, 
  BarChart3, 
  Award, 
  Layers,
  Users,
  TrendingDown,
  Search,
  Check,
  AlertTriangle,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type {
  SurgicalRecord,
  Specialist,
  FacilitySurgicalCapacity,
  JointWaitRecord,
  HistoricalTrend,
  StatsCanDemographic,
  FacilityComparisonRecord,
  SpecialistComparisonRecord,
} from '../surgicalData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

interface StatsCanSatisfactionSegment {
  segment: string;
  value: number;
}

interface StatsCanSatisfactionStats {
  reporting_title: string;
  survey_period: string;
  metrics_alberta: {
    satisfied_with_wait: number;
    unsatisfied_with_wait: number;
    wait_affected_life_negatively: number;
    waiting_segment_distribution: StatsCanSatisfactionSegment[];
    life_impact_categories: { impact: string; value: number }[];
  };
}

type SurgicalData = {
  SURGICAL_RECORDS: SurgicalRecord[];
  ORTHOPEDIC_SPECIALTY_RECORDS: JointWaitRecord[];
  SURGICAL_FACILITIES: FacilitySurgicalCapacity[];
  SPECIALISTS_LIST?: Specialist[];
  STATSCAN_SATISFACTION_STATS: StatsCanSatisfactionStats;
  HISTORICAL_WAIT_TRENDS: HistoricalTrend[];
  STATSCAN_DEMOGRAPHICS: StatsCanDemographic[];
  FACILITY_COMPARISONS: FacilityComparisonRecord[];
  SPECIALIST_COMPARISONS?: SpecialistComparisonRecord[];
  _dataMetadata?: DataMetadataMap;
};

const EMPTY_SATISFACTION_STATS: StatsCanSatisfactionStats = {
  reporting_title: '',
  survey_period: '',
  metrics_alberta: {
    satisfied_with_wait: 0,
    unsatisfied_with_wait: 0,
    wait_affected_life_negatively: 0,
    waiting_segment_distribution: [],
    life_impact_categories: [],
  },
};

export default function SurgicalDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ortho' | 'comparisons' | 'statscan'>('overview');
  
  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'hip_replacement_median' | 'knee_replacement_median' | 'cataract_surgery_median' | null>(null);
  // Live data fetched from /api/data/surgical
  const { data, metadata, isLoading, error, refresh } = useDomainData<SurgicalData>('surgical');
  const SURGICAL_RECORDS = data?.SURGICAL_RECORDS ?? [];
  const ORTHOPEDIC_SPECIALTY_RECORDS = data?.ORTHOPEDIC_SPECIALTY_RECORDS ?? [];
  const SURGICAL_FACILITIES = data?.SURGICAL_FACILITIES ?? [];
  const SPECIALISTS_LIST = data?.SPECIALISTS_LIST ?? [];
  const STATSCAN_SATISFACTION_STATS = data?.STATSCAN_SATISFACTION_STATS ?? EMPTY_SATISFACTION_STATS;
  const HISTORICAL_WAIT_TRENDS = data?.HISTORICAL_WAIT_TRENDS ?? [];
  const STATSCAN_DEMOGRAPHICS = data?.STATSCAN_DEMOGRAPHICS ?? [];
  const FACILITY_COMPARISONS = data?.FACILITY_COMPARISONS ?? [];
  const SPECIALIST_COMPARISONS = data?.SPECIALIST_COMPARISONS ?? [];

  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const values = HISTORICAL_WAIT_TRENDS.map(t => t[selectedKpi] as number).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toFixed(1),
      latest: latest.toFixed(1),
      peak: peak.toFixed(1),
      minVal: minVal.toFixed(1),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(1)}` : rawDelta.toFixed(1),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedKpi, HISTORICAL_WAIT_TRENDS]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'hip_replacement_median':
        return {
          label: 'Total Hip Replacement Median Wait Time',
          description: 'Historical trend of hip replacement surgery median wait times (weeks) in Alberta from 2015 to 2026. The COVID pandemic and subsequent system strain caused a major spike, which has only partially resolved.',
          colorClass: 'text-blue-400',
          bgClass: 'bg-blue-500/10',
          strokeColor: '#3b82f6',
          gradientId: 'colorHipTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'knee_replacement_median':
        return {
          label: 'Total Knee Replacement Median Wait Time',
          description: 'Historical trend of knee replacement surgery median wait times (weeks) in Alberta from 2015 to 2026. Consistent under-capacity relative to aging demographics remains a primary strain factor.',
          colorClass: 'text-purple-400',
          bgClass: 'bg-purple-500/10',
          strokeColor: '#a855f7',
          gradientId: 'colorKneeTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'cataract_surgery_median':
        return {
          label: 'Cataract Extraction Median Wait Time',
          description: 'Historical trend of cataract surgery median wait times (weeks) in Alberta from 2015 to 2026. Substantial provincial volume shifts have helped stabilize cataract waits closer to target relative to orthopedics.',
          colorClass: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10',
          strokeColor: '#10b981',
          gradientId: 'colorCataractTrend',
          unit: ' Wks',
          icon: Sparkles
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  // Comparisons States
  const [compFacilityA, setCompFacilityA] = useState<string>('WDFAB783'); // Royal Alex
  const [compFacilityB, setCompFacilityB] = useState<string>('WDFAB102'); // U of A
  const [compSpecialistA, setCompSpecialistA] = useState<string>('6743'); // Dr. Arbour
  const [compSpecialistB, setCompSpecialistB] = useState<string>('6748'); // Dr. Tremblay
  const [compProcedureA, setCompProcedureA] = useState<string>('Total Hip Replacement');
  const [compProcedureB, setCompProcedureB] = useState<string>('Total Knee Replacement');

  // StatsCan State
  const [statscanCategoryFilter, setStatscanCategoryFilter] = useState<string>('All');

  // Search & Filter States
  const [specialistSearch, setSpecialistSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedProcedureGroup, setSelectedProcedureGroup] = useState<string>('Hip Replacement');

  // Get filtered Specialists list
  const filteredSpecialists = SPECIALISTS_LIST.filter(spec => {
    const matchesSearch = spec.name.toLowerCase().includes(specialistSearch.toLowerCase()) ||
                          spec.specialty.toLowerCase().includes(specialistSearch.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'All' || spec.specialty === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  // Get filtered Facilities list
  const filteredFacilities = SURGICAL_FACILITIES.filter(fac => {
    const matchesSearch = fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                          fac.city.toLowerCase().includes(facilitySearch.toLowerCase());
    const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
    return matchesSearch && matchesZone;
  });

  // Get active joint replacement records
  const orthopedicData = ORTHOPEDIC_SPECIALTY_RECORDS.filter(
    item => item.procedure === selectedProcedureGroup
  );

  // StatsCan Demographics Filter
  const filteredStatsCanDemographics = STATSCAN_DEMOGRAPHICS.filter(demo => 
    statscanCategoryFilter === 'All' || demo.category === statscanCategoryFilter
  );

  // Head to Head Select Data
  const facAData = FACILITY_COMPARISONS.find(f => f.facility_id === compFacilityA);
  const facBData = FACILITY_COMPARISONS.find(f => f.facility_id === compFacilityB);

  const specAData = SPECIALIST_COMPARISONS.find(s => s.id === compSpecialistA);
  const specBData = SPECIALIST_COMPARISONS.find(s => s.id === compSpecialistB);

  const procAData = SURGICAL_RECORDS.find(p => p.procedure_name === compProcedureA && p.metric_name === '90th percentile') || SURGICAL_RECORDS[0];
  const procBData = SURGICAL_RECORDS.find(p => p.procedure_name === compProcedureB && p.metric_name === '90th percentile') || SURGICAL_RECORDS[1];

  // Pie chart stats for StatsCan Satisfaction
  const satisfactionPieData = [
    { name: 'Satisfied with wait time', value: STATSCAN_SATISFACTION_STATS.metrics_alberta.satisfied_with_wait, color: '#10b981' },
    { name: 'Unsatisfied with wait time', value: STATSCAN_SATISFACTION_STATS.metrics_alberta.unsatisfied_with_wait, color: '#ef4444' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading surgical data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load surgical data: {error}</span>
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
      
      {/* Header */}
      <DashboardHeader
        icon={Activity}
        title="Surgical Wait Times"
        description="Track surgery waitlists, volumes, and priority benchmark compliance across facilities."
        metadata={metadata}
        arrayKey="SURGICAL_RECORDS"
      />

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Provincial Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ortho')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ortho'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Orthopedics & Historical Trends</span>
        </button>

        <button
          onClick={() => setActiveSubTab('comparisons')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'comparisons'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Head-to-Head Comparisons</span>
        </button>

        <button
          onClick={() => setActiveSubTab('statscan')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'statscan'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>StatsCan Patient Survey</span>
        </button>

      </div>

      {/* --- SUB-TAB: PROVINCIAL OVERVIEW --- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div 
              tabIndex={0}
              onClick={() => setSelectedKpi(selectedKpi === 'hip_replacement_median' ? null : 'hip_replacement_median')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKpi(selectedKpi === 'hip_replacement_median' ? null : 'hip_replacement_median');
                }
              }}
              className={`bg-slate-900/40 border rounded-2xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedKpi === 'hip_replacement_median'
                  ? 'border-blue-500 ring-1 ring-blue-500/30 bg-slate-900/80 shadow-blue-500/5'
                  : 'border-slate-800 hover:border-blue-500/30'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Hip Replacement</span>
                <Clock className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-white">36.8 Weeks</div>
                <div className="text-[10px] text-slate-400">90th Percentile Wait Time</div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400">
                <span>National Target: 26.0 Wks</span>
                <span className="text-amber-400 font-bold">141% of Target</span>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-blue-400/80 group-hover:text-blue-400 transition-colors">
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'hip_replacement_median' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </div>
            </div>

            <div 
              tabIndex={0}
              onClick={() => setSelectedKpi(selectedKpi === 'knee_replacement_median' ? null : 'knee_replacement_median')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKpi(selectedKpi === 'knee_replacement_median' ? null : 'knee_replacement_median');
                }
              }}
              className={`bg-slate-900/40 border rounded-2xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedKpi === 'knee_replacement_median'
                  ? 'border-purple-500 ring-1 ring-purple-500/30 bg-slate-900/80 shadow-purple-500/5'
                  : 'border-slate-800 hover:border-purple-500/30'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Knee Replacement</span>
                <Clock className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-white">43.1 Weeks</div>
                <div className="text-[10px] text-slate-400">90th Percentile Wait Time</div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400">
                <span>National Target: 26.0 Wks</span>
                <span className="text-amber-500 font-bold">165% of Target</span>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-purple-400/80 group-hover:text-purple-400 transition-colors">
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'knee_replacement_median' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </div>
            </div>

            <div 
              tabIndex={0}
              onClick={() => setSelectedKpi(selectedKpi === 'cataract_surgery_median' ? null : 'cataract_surgery_median')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedKpi(selectedKpi === 'cataract_surgery_median' ? null : 'cataract_surgery_median');
                }
              }}
              className={`bg-slate-900/40 border rounded-2xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedKpi === 'cataract_surgery_median'
                  ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-slate-900/80 shadow-emerald-500/5'
                  : 'border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cataract Extractions</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-white">15.2 Weeks</div>
                <div className="text-[10px] text-slate-400">90th Percentile Wait Time</div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400">
                <span>National Target: 16.0 Wks</span>
                <span className="text-emerald-400 font-bold">95% (Within Target)</span>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'cataract_surgery_median' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-colors pointer-events-none"></div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Oncology Fast-Track</span>
                <Activity className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-white">5.9 Weeks</div>
                <div className="text-[10px] text-slate-400">Breast Cancer 90th percentile</div>
              </div>
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[9px] text-slate-400">
                <span>Standard Target: 4.0 Wks</span>
                <span className="text-rose-400 font-bold">High Priority Flow</span>
              </div>
              <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-slate-500">
                <span>No Trend Data Available</span>
              </div>
            </div>
          </div>

          {/* Trend Panel */}
          <AnimatePresence mode="wait">
            {selectedKpi && selectedKpiDetails && kpiStats && (
              <motion.div
                key={`kpi-trend-${selectedKpi}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-950/80 border border-slate-850 p-4 sm:p-5 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/60">
                    <div className="space-y-1">
                      <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-white">
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (2015)</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (2026)</span>
                      <span className="text-xl font-black text-white font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
                      <span className={`text-xl font-black font-mono ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xs font-extrabold flex items-center justify-center sm:justify-start gap-1 ${kpiStats.isIncrease ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {kpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{kpiStats.delta}{selectedKpiDetails.unit} ({kpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-60 mt-3 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HISTORICAL_WAIT_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                        <YAxis stroke="#64748b" fontSize={10} unit={selectedKpiDetails.unit} />
                        <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 11 }} />
                        <Area
                          type="monotone"
                          dataKey={selectedKpi}
                          name={selectedKpiDetails.label}
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
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-white mb-1.5 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Provincial Specialty Wait Times (Decision-to-Surgery)
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal mb-4">
                  Official reporting parameters showing the median and 90th percentile (the timeframe in which 90% of procedures are performed).
                </p>
                <DataTimestamp compact metadata={metadata} arrayKey="SURGICAL_RECORDS" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3">Procedure Group</th>
                      <th className="py-2.5 px-3 text-center">Median Wait</th>
                      <th className="py-2.5 px-3 text-center">90% Seen Within</th>
                      <th className="py-2.5 px-3">Standard Benchmark</th>
                      <th className="py-2.5 px-3 text-right">Primary Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SURGICAL_RECORDS.filter(r => r.geography_type === 'Province' && r.metric_name === 'Median wait').map((rec, i) => {
                      const matching90th = SURGICAL_RECORDS.find(
                        r => r.procedure_name === rec.procedure_name && r.metric_name === '90th percentile'
                      );
                      return (
                        <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all">
                          <td className="py-2.5 px-3 font-semibold text-white">{rec.procedure_name}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                            {rec.metric_value} {rec.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 font-extrabold text-slate-300">
                              {matching90th ? `${matching90th.metric_value} weeks` : 'Not Reported'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 italic font-mono text-[10px]">
                            {rec.benchmark_value || 'None established'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[9px] font-bold text-blue-400 uppercase">{rec.source_name}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl flex items-start gap-2.5">
                <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Interpretation Guidelines</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    <strong>Wait 1</strong> represents the time from referral by a GP to your specialist consultation. <strong>Wait 2</strong> is the time from the decision to proceed with surgery to the date of the actual procedure. Percentile wait times are based on the previous three months of rolling data.
                  </p>
                </div>
              </div>
            </div>

            {/* AHS context and policy tracker panel */}
            <div className="space-y-4">
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-slate-400" />
                  <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Surgical Capacity & Initiatives</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Chartered Surgical Facilities Share</span>
                      <span className="text-emerald-400 font-bold">34.0%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: '34%' }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500">Day surgery optimization partner contracts (Acute Care Alberta Initiative)</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Provincial Operating Room (OR) Utilization</span>
                      <span className="text-blue-400 font-bold">88.5%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: '88.5%' }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500">Averages based on acute-care facilities performing complex surgery</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">ASI Hip/Knee Fast-Track Compliance</span>
                      <span className="text-amber-400 font-bold">62.0%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: '62%' }}></div>
                    </div>
                    <p className="text-[9px] text-slate-500">Benchmark target compliance for joint reconstruction procedures</p>
                  </div>
                </div>
              </div>

              {/* StatsCan Survey Snapshot */}
              <div className="bg-gradient-to-br from-[#0a0f1d] to-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-black text-slate-200 uppercase tracking-wider">Patient Impact survey</h4>
                  </div>
                  <span className="text-[8px] font-bold text-slate-500">StatsCan 2024</span>
                </div>
                
                <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300">Wait negatively impacted life</span>
                    <span className="text-amber-400 font-extrabold text-sm">42.6%</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 leading-normal">
                    Provincial survey respondents experienced stress, pain or productivity losses while waiting for initial specialist consultations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Top Impact Categories</span>
                  <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-300">Anxiety/Stress</div>
                      <div className="text-slate-400 font-extrabold">78.5%</div>
                    </div>
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-300">Physical Pain</div>
                      <div className="text-slate-400 font-extrabold">65.2%</div>
                    </div>
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-300">Income Loss</div>
                      <div className="text-slate-400 font-extrabold font-mono">34.0%</div>
                    </div>
                    <div className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg">
                      <div className="text-slate-300">Health Decline</div>
                      <div className="text-slate-400 font-extrabold">28.4%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Unused State Integration: Surgical Facilities Directory & Live Capacity */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-4">
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  Surgical Facilities Directory & Capacity Monitor
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Comprehensive tracking of all 11 licensed acute care and contracted Chartered Surgical Facilities (CSF) performing specialized surgeries in Alberta.
                </p>
              </div>

              {/* Interactive Search & Zone Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search */}
                <div className="relative shrink-0">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search name or city..."
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    className="w-full sm:w-48 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {/* Zone filter */}
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {['All', ...Array.from(new Set(SURGICAL_FACILITIES.map(f => f.zone)))].map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table layout for desktop */}
            <div className="hidden md:block overflow-x-auto border border-slate-850/60 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-3">Facility Details</th>
                    <th className="p-3">Zone & Region</th>
                    <th className="p-3 text-center">OR Utilization Rate</th>
                    <th className="p-3">Operating Status</th>
                    <th className="p-3">Specialties Offered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {filteredFacilities.map(fac => {
                    // color scale for OR utilization
                    let progressColor = 'bg-cyan-500';
                    let textColor = 'text-cyan-400';
                    if (fac.or_utilization_rate >= 93) {
                      progressColor = 'bg-rose-500';
                      textColor = 'text-rose-400';
                    } else if (fac.or_utilization_rate >= 88) {
                      progressColor = 'bg-amber-500';
                      textColor = 'text-amber-400';
                    } else {
                      progressColor = 'bg-emerald-500';
                      textColor = 'text-emerald-400';
                    }

                    return (
                      <tr key={fac.id} className="hover:bg-slate-950/20 transition-all text-slate-300">
                        <td className="p-3">
                          <div className="font-bold text-white text-[13px]">{fac.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{fac.id}</div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-200">{fac.city}</span>
                          <span className="text-slate-500 text-[10px] block">{fac.zone}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-center justify-center space-y-1">
                            <span className={`font-mono text-[11px] font-black ${textColor}`}>{fac.or_utilization_rate}%</span>
                            <div className="w-24 bg-slate-950 h-1 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${fac.or_utilization_rate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          {fac.chartered_partner_status ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-black text-[9px] uppercase tracking-wide">
                              Chartered Partner (CSF)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-black text-[9px] uppercase tracking-wide">
                              Public Facility (AHS)
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1 max-w-[280px]">
                            {fac.specialties_offered.map((spec, sIdx) => (
                              <span key={sIdx} className="bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-mono border border-slate-850">
                                {spec}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Grid layout for mobile */}
            <div className="md:hidden grid grid-cols-1 gap-3">
              {filteredFacilities.map(fac => {
                let progressColor = 'bg-cyan-500';
                let textColor = 'text-cyan-400';
                if (fac.or_utilization_rate >= 93) {
                  progressColor = 'bg-rose-500';
                  textColor = 'text-rose-400';
                } else if (fac.or_utilization_rate >= 88) {
                  progressColor = 'bg-amber-500';
                  textColor = 'text-amber-400';
                } else {
                  progressColor = 'bg-emerald-500';
                  textColor = 'text-emerald-400';
                }

                return (
                  <div key={fac.id} className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-xs">{fac.name}</h4>
                        <span className="text-[9px] text-slate-500 font-mono block">{fac.id} • {fac.city} ({fac.zone})</span>
                      </div>
                      <div className="shrink-0">
                        {fac.chartered_partner_status ? (
                          <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded text-[8px] font-bold uppercase tracking-wider">
                            CSF
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/15 rounded text-[8px] font-bold uppercase tracking-wider">
                            Public
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs border-t border-slate-900 pt-2">
                      <span className="text-slate-400 font-medium">OR Utilization:</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono font-bold ${textColor}`}>{fac.or_utilization_rate}%</span>
                        <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${fac.or_utilization_rate}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-900">
                      {fac.specialties_offered.map((spec, sIdx) => (
                        <span key={sIdx} className="bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded text-[8.5px] font-mono border border-slate-850">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredFacilities.length === 0 && (
              <div className="bg-slate-950/40 border border-slate-850/60 p-8 text-center rounded-xl">
                <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No facilities matched your search and zone parameters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: ORTHOPEDICS & HISTORICAL TRENDS --- */}
      {activeSubTab === 'ortho' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                Joint Reconstruction Specialty Registry (ABJHI & IIHO Feeds)
              </h3>
              <p className="text-xs text-slate-400">
                Detailed metrics by geography comparing hip and knee replacement wait segments and historical median values.
              </p>
              <DataTimestamp compact metadata={metadata} arrayKey="ORTHOPEDIC_SPECIALTY_RECORDS" />
            </div>

            {/* Procedure toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
              <button
                onClick={() => setSelectedProcedureGroup('Hip Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Hip Replacement'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hip replacement
              </button>
              <button
                onClick={() => setSelectedProcedureGroup('Knee Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Knee Replacement'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Knee replacement
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Geo wait times bar chart */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider mb-1">
                  Active Regional Wait Times (90th Percentile)
                </h4>
                <p className="text-[10px] text-slate-400 mb-4">
                  Shows referral-to-consult (Wait 1) and decision-to-surgery (Wait 2) durations in days by Alberta municipality.
                </p>
              </div>

              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orthopedicData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="geography" tick={{ fill: '#94a3b8', fontSize: 9 }} stroke="#1e293b" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1e293b" unit="d" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', pt: 10 }} />
                    <Bar dataKey="consult_wait_days_90th" name="Wait 1: Consult Wait (Days)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="surgery_wait_days_90th" name="Wait 2: Surgery Wait (Days)" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ortho side metrics panel */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-4">
              <div>
                <span className="text-[9px] text-amber-400 font-bold uppercase tracking-widest">Registry Insights</span>
                <h4 className="font-extrabold text-sm text-white mt-0.5">Regional Volume Splits</h4>
                <p className="text-[10px] text-slate-400 leading-normal mt-1">
                  Orthopedic joint waitlists are highly concentrated in urban medical centers. Secondary private/chartered clinics are contracted to perform day-surgery joint reconstructions.
                </p>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {orthopedicData.map((record, idx) => (
                  <div key={idx} className="p-2 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-extrabold text-slate-200 block">{record.geography}</span>
                      <span className="text-[9px] text-slate-500 font-mono">Completed cases: {record.count_completed}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-400 font-black block">{record.longest_10_days} Days</span>
                      <span className="text-[8.5px] text-slate-500 font-bold uppercase">90% Seen Within</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Trends area chart (2015-2026) */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5">
            <div className="space-y-1 mb-5">
              <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                Provincial Decadal Wait Trends (2015 - 2026)
              </h4>
              <p className="text-[10px] text-slate-400">
                Sourced from <strong>CIHI priority procedure tables</strong>. Traces the median wait time in weeks over a ten-year horizon, showing the impact of pandemic delays and subsequent recoveries.
              </p>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={HISTORICAL_WAIT_TRENDS}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorHip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKnee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCataract" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1e293b" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1e293b" unit="w" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', pt: 10 }} />
                  <Area type="monotone" dataKey="hip_replacement_median" name="Hip Replacement Wait (Wks)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHip)" strokeWidth={2} />
                  <Area type="monotone" dataKey="knee_replacement_median" name="Knee Replacement Wait (Wks)" stroke="#a78bfa" fillOpacity={1} fill="url(#colorKnee)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cataract_surgery_median" name="Cataract Surgery Wait (Wks)" stroke="#10b981" fillOpacity={1} fill="url(#colorCataract)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: HEAD-TO-HEAD COMPARISONS --- */}
      {activeSubTab === 'comparisons' && (
        <div className="space-y-8">
          
          {/* COMPARISON BLOCK 1: FACILITY TO FACILITY */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Building2 className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">Facility Head-to-Head</h3>
                <p className="text-[10px] text-slate-400">Select any two surgical facilities to compare operational metrics and waitlist counts side-by-side.</p>
              <DataTimestamp compact metadata={metadata} arrayKey="FACILITY_COMPARISONS" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Facility A</label>
                <select
                  value={compFacilityA}
                  onChange={(e) => setCompFacilityA(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {FACILITY_COMPARISONS.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>{f.name} ({f.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Facility B</label>
                <select
                  value={compFacilityB}
                  onChange={(e) => setCompFacilityB(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {FACILITY_COMPARISONS.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>{f.name} ({f.city})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            {facAData && facBData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-950/40 p-4 border border-slate-850 rounded-xl">
                {/* Facility A Stats */}
                <div className="space-y-4">
                  <div className="space-y-1 text-center md:text-left">
                    <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[9px] font-mono">
                      {facAData.zone}
                    </span>
                    <h4 className="font-extrabold text-sm text-white mt-1">{facAData.name}</h4>
                    <p className="text-[10px] text-slate-400">{facAData.city}, AB</p>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">OR Efficiency</span>
                      <span className="text-white font-black text-lg font-mono">{facAData.or_utilization}%</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Completed (This Month)</span>
                      <span className="text-white font-black text-lg font-mono">{facAData.completed_this_month}</span>
                    </div>
                  </div>
                </div>

                {/* Comparison Center Scale */}
                <div className="space-y-3 px-2 border-y md:border-y-0 md:border-x border-slate-800 py-4 md:py-0">
                  <span className="text-[9.5px] text-slate-500 font-bold uppercase tracking-widest text-center block mb-2">Performance Metrics</span>
                  
                  {/* OR Progress Comparison */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-blue-400 font-bold">{facAData.or_utilization}%</span>
                      <span className="text-slate-400">OR utilization</span>
                      <span className="text-emerald-400 font-bold">{facBData.or_utilization}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full flex overflow-hidden">
                      <div className="bg-blue-500 h-full" style={{ width: `${(facAData.or_utilization / (facAData.or_utilization + facBData.or_utilization)) * 100}%` }}></div>
                      <div className="bg-emerald-500 h-full" style={{ width: `${(facBData.or_utilization / (facAData.or_utilization + facBData.or_utilization)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Active Waitlist Progress */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-blue-400 font-bold">{facAData.active_waitlist}</span>
                      <span className="text-slate-400">Active Waitlist Volume</span>
                      <span className="text-emerald-400 font-bold">{facBData.active_waitlist}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full flex overflow-hidden">
                      <div className="bg-blue-400 h-full" style={{ width: `${(facAData.active_waitlist / (facAData.active_waitlist + facBData.active_waitlist)) * 100}%` }}></div>
                      <div className="bg-emerald-400 h-full" style={{ width: `${(facBData.active_waitlist / (facAData.active_waitlist + facBData.active_waitlist)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Ortho Wait times */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-blue-400 font-bold">{facAData.ortho_wait_90th_days ? `${facAData.ortho_wait_90th_days}d` : 'N/A'}</span>
                      <span className="text-slate-400">90th% Ortho Wait</span>
                      <span className="text-emerald-400 font-bold">{facBData.ortho_wait_90th_days ? `${facBData.ortho_wait_90th_days}d` : 'N/A'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full flex overflow-hidden">
                      <div className="bg-blue-400 h-full" style={{ width: `${(facAData.ortho_wait_90th_days / (facAData.ortho_wait_90th_days + facBData.ortho_wait_90th_days)) * 100}%` }}></div>
                      <div className="bg-emerald-400 h-full" style={{ width: `${(facBData.ortho_wait_90th_days / (facAData.ortho_wait_90th_days + facBData.ortho_wait_90th_days)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Cataract Wait times */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-blue-400 font-bold">{facAData.cataract_wait_90th_days ? `${facAData.cataract_wait_90th_days}d` : 'N/A'}</span>
                      <span className="text-slate-400">90th% Cataract Wait</span>
                      <span className="text-emerald-400 font-bold">{facBData.cataract_wait_90th_days ? `${facBData.cataract_wait_90th_days}d` : 'N/A'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-900 rounded-full flex overflow-hidden">
                      <div className="bg-blue-400 h-full" style={{ width: `${(facAData.cataract_wait_90th_days / (facAData.cataract_wait_90th_days + facBData.cataract_wait_90th_days)) * 100}%` }}></div>
                      <div className="bg-emerald-400 h-full" style={{ width: `${(facBData.cataract_wait_90th_days / (facAData.cataract_wait_90th_days + facBData.cataract_wait_90th_days)) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Facility B Stats */}
                <div className="space-y-4 text-center md:text-right">
                  <div className="space-y-1">
                    <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[9px] font-mono">
                      {facBData.zone}
                    </span>
                    <h4 className="font-extrabold text-sm text-white mt-1">{facBData.name}</h4>
                    <p className="text-[10px] text-slate-400">{facBData.city}, AB</p>
                  </div>

                  <div className="space-y-2 text-left md:text-right">
                    <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">OR Efficiency</span>
                      <span className="text-white font-black text-lg font-mono">{facBData.or_utilization}%</span>
                    </div>
                    <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Completed (This Month)</span>
                      <span className="text-white font-black text-lg font-mono">{facBData.completed_this_month}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COMPARISON BLOCK 2: SPECIALIST TO SPECIALIST */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <User className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">Specialist Head-to-Head</h3>
                <p className="text-[10px] text-slate-400">Select any two surgical specialists to compare active referral wait queues and operating times.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Specialist A</label>
                <select
                  value={compSpecialistA}
                  onChange={(e) => setCompSpecialistA(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {SPECIALIST_COMPARISONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Specialist B</label>
                <select
                  value={compSpecialistB}
                  onChange={(e) => setCompSpecialistB(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {SPECIALIST_COMPARISONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>
                  ))}
                </select>
              </div>
            </div>

            {specAData && specBData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Specialist A */}
                <div className="bg-gradient-to-br from-[#0c122b] to-slate-950 p-4 border border-blue-500/15 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{specAData.specialty}</span>
                      <h4 className="font-black text-base text-white">{specAData.name}</h4>
                      <p className="text-[10.5px] text-slate-400">{specAData.facility}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">ID: {specAData.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Wait 1 (Consult)</span>
                      <span className="text-blue-400 font-extrabold text-sm">{specAData.wait1_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Wait 2 (Surgery)</span>
                      <span className="text-purple-400 font-extrabold text-sm">{specAData.wait2_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Surgical Volume (3m)</span>
                      <span className="text-slate-200 font-bold">{specAData.volume_3m} Cases</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Patient Satisfaction</span>
                      <span className="text-emerald-400 font-bold">{specAData.patient_satisfaction}% Rating</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Experience</span>
                      <span className="text-slate-300 font-bold">{specAData.experience_years} Years</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Avg Surgery Time</span>
                      <span className="text-amber-400 font-bold">{specAData.avg_surgery_time_mins} Mins</span>
                    </div>
                  </div>
                </div>

                {/* Card Specialist B */}
                <div className="bg-gradient-to-br from-[#0a1816] to-slate-950 p-4 border border-emerald-500/15 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{specBData.specialty}</span>
                      <h4 className="font-black text-base text-white">{specBData.name}</h4>
                      <p className="text-[10.5px] text-slate-400">{specBData.facility}</p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">ID: {specBData.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Wait 1 (Consult)</span>
                      <span className="text-blue-400 font-extrabold text-sm">{specBData.wait1_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Wait 2 (Surgery)</span>
                      <span className="text-purple-400 font-extrabold text-sm">{specBData.wait2_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Surgical Volume (3m)</span>
                      <span className="text-slate-200 font-bold">{specBData.volume_3m} Cases</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Patient Satisfaction</span>
                      <span className="text-emerald-400 font-bold">{specBData.patient_satisfaction}% Rating</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Experience</span>
                      <span className="text-slate-300 font-bold">{specBData.experience_years} Years</span>
                    </div>
                    <div className="p-2 bg-slate-900 rounded-xl border border-slate-800/60">
                      <span className="text-[8.5px] text-slate-400 block uppercase font-sans">Avg Surgery Time</span>
                      <span className="text-amber-400 font-bold">{specBData.avg_surgery_time_mins} Mins</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COMPARISON BLOCK 3: PROCEDURE TO PROCEDURE */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">Procedure Target Benchmarking</h3>
                <p className="text-[10px] text-slate-400">Compare clinical timelines and targets between core procedures side-by-side.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Procedure A</label>
                <select
                  value={compProcedureA}
                  onChange={(e) => setCompProcedureA(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {SURGICAL_RECORDS.filter(p => p.geography_type === 'Province' && p.metric_name === '90th percentile').map(p => (
                    <option key={p.procedure_name} value={p.procedure_name}>{p.procedure_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Procedure B</label>
                <select
                  value={compProcedureB}
                  onChange={(e) => setCompProcedureB(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                >
                  {SURGICAL_RECORDS.filter(p => p.geography_type === 'Province' && p.metric_name === '90th percentile').map(p => (
                    <option key={p.procedure_name} value={p.procedure_name}>{p.procedure_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {procAData && procBData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/20 p-4 border border-slate-850 rounded-xl text-xs">
                <div className="space-y-3">
                  <h4 className="font-extrabold text-white">{procAData.procedure_name}</h4>
                  <div className="space-y-1 bg-slate-900 border border-slate-850 p-3 rounded-xl font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">90th Percentile Wait:</span>
                      <span className="text-blue-400 font-bold">{procAData.metric_value} weeks</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850 mt-1 pt-1">
                      <span className="text-slate-400">National Benchmark:</span>
                      <span className="text-slate-300 italic">{procAData.benchmark_value || 'None Established'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-extrabold text-white">{procBData.procedure_name}</h4>
                  <div className="space-y-1 bg-slate-900 border border-slate-850 p-3 rounded-xl font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-400">90th Percentile Wait:</span>
                      <span className="text-blue-400 font-bold">{procBData.metric_value} weeks</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850 mt-1 pt-1">
                      <span className="text-slate-400">National Benchmark:</span>
                      <span className="text-slate-300 italic">{procBData.benchmark_value || 'None Established'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: STATSCAN PATIENT ACCESS SURVEY --- */}
      {activeSubTab === 'statscan' && (
        <div className="space-y-6">
          <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Statistics Canada Specialist Access Survey (2024 Survey release)</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                This captures patient-reported outcomes on medical specialist initial consultation access. Prolonged waiting represents a severe bottleneck prior to decision-for-surgery scheduling.
              </p>
              <DataTimestamp compact metadata={metadata} arrayKey="STATSCAN_SATISFACTION_STATS" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie Chart Satisfaction */}
            <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-between">
              <div className="w-full text-left">
                <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider mb-0.5">
                  Satisfaction with wait times
                </h4>
                <p className="text-[9.5px] text-slate-400 mb-4">Percentage representing patient experience scores for specialist consult referral periods.</p>
              </div>

              <div className="h-[200px] w-full flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={satisfactionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {satisfactionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full space-y-1 pt-4 border-t border-slate-800/60 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-slate-300">Satisfied with Wait</span>
                  </div>
                  <span className="font-bold text-emerald-400">{STATSCAN_SATISFACTION_STATS.metrics_alberta.satisfied_with_wait}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <span className="text-slate-300">Unsatisfied / Highly frustrated</span>
                  </div>
                  <span className="font-bold text-rose-400">{STATSCAN_SATISFACTION_STATS.metrics_alberta.unsatisfied_with_wait}%</span>
                </div>
              </div>
            </div>

            {/* Wait Bracket Distribution Chart */}
            <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider mb-0.5">
                  Access Wait duration breakdown (Days/Months)
                </h4>
                <p className="text-[9.5px] text-slate-400 mb-4">Survey respondents reported times spanning the referral date to active specialist assessment.</p>
              </div>

              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={STATSCAN_SATISFACTION_STATS.metrics_alberta.waiting_segment_distribution}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="segment" tick={{ fill: '#94a3b8', fontSize: 9 }} stroke="#1e293b" />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} stroke="#1e293b" unit="%" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Bar dataKey="value" name="Patients Proportion (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                <span>Total Patients Screened: Alberta Weighted</span>
                <span>July 2025 release</span>
              </div>
            </div>
          </div>

          {/* Demographic filters cuts */}
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider">Demographic Cuts & Life Impact Indicators</h4>
                <p className="text-[10.5px] text-slate-400">Filter demographic survey outcomes by Age, Gender, and GP Referral pathways.</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 border border-slate-800 rounded-xl">
                {['All', 'Age', 'Gender', 'Referral Type'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setStatscanCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-[9.5px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                      (cat === 'All' && statscanCategoryFilter === 'All') || statscanCategoryFilter === cat
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Demographic segment</th>
                    <th className="py-2.5 px-3">Under 1 Month</th>
                    <th className="py-2.5 px-3">1 to 3 Months</th>
                    <th className="py-2.5 px-3">3 to 6 Months</th>
                    <th className="py-2.5 px-3">6 Months+</th>
                    <th className="py-2.5 px-3 text-center">Satisfaction Rate</th>
                    <th className="py-2.5 px-3 text-right">Severe Life Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatsCanDemographics.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-all">
                      <td className="py-2.5 px-3 font-semibold text-white">
                        <span className="text-[9px] text-slate-500 block uppercase">{row.category}</span>
                        {row.dimension}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{row.wait_under_1m}%</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{row.wait_1_to_3m}%</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{row.wait_3_to_6m}%</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono font-bold text-amber-500">{row.wait_over_6m}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold font-mono">
                          {row.satisfied_percentage}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-purple-400 font-mono">{row.life_affected_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Simple CN helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
