import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Building2,
  Search,
  Activity, 
  MapPin, 
  CheckCircle, 
  Phone, 
  Clock, 
  Globe, 
  Filter, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  Stethoscope, 
  DollarSign, 
  Sliders, 
  HelpCircle,
  Eye,
  BarChart3,
  BarChart2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell, 
  ReferenceLine,
  Label,
  AreaChart,
  Area
} from 'recharts';
import type { 
  AttachmentRate,
  AcceptingProvider,
  PCNCapacity,
  EDRelianceMetric,
  ContinuityAndSatisfaction
} from '../primaryCareData';
import { DataTimestamp, DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';

type PrimaryCareData = {
  ATTACHMENT_RATES: AttachmentRate[];
  ACCEPTING_PROVIDERS: AcceptingProvider[];
  PCN_CAPACITY: PCNCapacity[];
  ED_RELIANCE_BY_CONTINUITY: EDRelianceMetric[];
  CONTINUITY_SATISFACTION: ContinuityAndSatisfaction[];
  _dataMetadata?: DataMetadataMap;
};

export default function PrimaryCareDashboard() {
  const [primaryCareData, setPrimaryCareData] = useState<PrimaryCareData>({
    ATTACHMENT_RATES: [],
    ACCEPTING_PROVIDERS: [],
    PCN_CAPACITY: [],
    ED_RELIANCE_BY_CONTINUITY: [],
    CONTINUITY_SATISFACTION: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/data/primary-care')
      .then(res => res.json())
      .then((data: PrimaryCareData) => {
        if (!cancelled) {
          setPrimaryCareData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const [activeSubTab, setActiveSubTab] = useState<'attachment' | 'directory' | 'pcn' | 'er-link'>('attachment');

  // Interactive KPI selected state for attachment trend panel
  const [selectedKpi, setSelectedKpi] = useState<'attachment_rate' | null>(null);

  // Interactive State for Provider Directory
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [filterWalkIn, setFilterWalkIn] = useState(false);
  const [filterAfterHours, setFilterAfterHours] = useState(false);
  const [filterVirtual, setFilterVirtual] = useState(false);


  // Filtered Provider Directory logic
  const filteredProviders = useMemo(() => {
    return primaryCareData.ACCEPTING_PROVIDERS.filter(prov => {
      const matchesSearch = 
        prov.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.clinicName.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.city.toLowerCase().includes(directorySearch.toLowerCase()) ||
        (prov.pcnName && prov.pcnName.toLowerCase().includes(directorySearch.toLowerCase()));
      
      const matchesZone = selectedZoneFilter === 'All' || prov.zone === selectedZoneFilter;
      const matchesType = selectedTypeFilter === 'All' || prov.type === selectedTypeFilter;
      
      const matchesWalkIn = !filterWalkIn || prov.features.walkIn;
      const matchesAfterHours = !filterAfterHours || prov.features.afterHours;
      const matchesVirtual = !filterVirtual || prov.features.virtualAppointments;
      
      return matchesSearch && matchesZone && matchesType && matchesWalkIn && matchesAfterHours && matchesVirtual;
    });
  }, [directorySearch, selectedZoneFilter, selectedTypeFilter, filterWalkIn, filterAfterHours, filterVirtual, primaryCareData]);

  // Unique list of cities from providers for directory filter
  const uniqueCities = useMemo(() => {
    const cities = primaryCareData.ACCEPTING_PROVIDERS.map(p => p.city);
    return Array.from(new Set(cities));
  }, [primaryCareData]);


  // Executive summary counts
  const totalAcceptingCount = primaryCareData.ACCEPTING_PROVIDERS.filter(p => p.acceptingNewPatients).length;

  // Data-driven computed values (avoid hardcoded KPIs)
  const albertaAttachment = primaryCareData.ATTACHMENT_RATES
    .filter(r => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
    .sort((a, b) => b.reporting_year.localeCompare(a.reporting_year))[0];
  const canadaAttachment = primaryCareData.ATTACHMENT_RATES
    .filter(r => r.geography === 'Canada' && r.demographic_group === 'All Residents')
    .sort((a, b) => b.reporting_year.localeCompare(a.reporting_year))[0];
  const attachmentRate = albertaAttachment?.metric_value ?? 0;
  const canadaAvg = canadaAttachment?.metric_value ?? 0;
  const reportingYear = albertaAttachment?.reporting_year ?? '';

  // Latest-year Alberta attachment rates by demographic group (for chart + insights)
  const latestAlbertaRates = useMemo(() => {
    const latestYear = primaryCareData.ATTACHMENT_RATES
      .filter(r => r.geography === 'Alberta')
      .map(r => r.reporting_year)
      .sort((a, b) => b.localeCompare(a))[0] ?? reportingYear;
    const year = latestYear || reportingYear;
    return primaryCareData.ATTACHMENT_RATES
      .filter(r => r.geography === 'Alberta' && r.reporting_year === year)
      .sort((a, b) => b.metric_value - a.metric_value);
  }, [primaryCareData, reportingYear]);
  const getRate = (group: string) => latestAlbertaRates.find(r => r.demographic_group === group)?.metric_value ?? 0;
  const lowIncomeRate = getRate('Lowest Income Quintile');
  const youngAdultsRate = getRate('Adults (18-64)');
  const ruralRate = getRate('Rural / Remote Areas');
  const seniorsRate = getRate('Seniors (65+)');

  const albertaContinuity = primaryCareData.CONTINUITY_SATISFACTION.find(c => c.zone === 'Alberta');
  const sameDayAccess = albertaContinuity?.sameNextDayAccessPct ?? 0;
  const waitSatisfaction = albertaContinuity?.satisfiedWithWaitTimePct ?? 0;
  const clinicContinuity = albertaContinuity?.highClinicContinuityPct ?? 0;
  const careRatingExcellent = albertaContinuity?.overallCareRatingExcellentPct ?? 0;

  const albertaEdReliance = primaryCareData.ED_RELIANCE_BY_CONTINUITY.find(e => e.group === 'Alberta Average');
  const minorConditionEdRate = albertaEdReliance?.minorConditionEdVisitsPer1000 ?? 0;

  const albertaPcn = primaryCareData.PCN_CAPACITY.find(p => p.zone === 'Alberta');
  const provincialFundingPerPatient = albertaPcn?.fundingPerPatient ?? 0;
  const provincialProvidersPer100k = albertaPcn?.providersPer100k ?? 0;
  const northZone = primaryCareData.PCN_CAPACITY.find(p => p.zone === 'North Zone');
  const edmontonZone = primaryCareData.PCN_CAPACITY.find(p => p.zone === 'Edmonton Zone');
  const calgaryZone = primaryCareData.PCN_CAPACITY.find(p => p.zone === 'Calgary Zone');

  // Trend panel stats for the attachment rate KPI
  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    // Build a historical series of Alberta "All Residents" attachment rates by year
    const series = primaryCareData.ATTACHMENT_RATES
      .filter(r => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
      .sort((a, b) => a.reporting_year.localeCompare(b.reporting_year))
      .map(r => r.metric_value);
    if (series.length === 0) return null;

    const baseline = series[0];
    const latest = series[series.length - 1];
    const peak = Math.max(...series);
    const minVal = Math.min(...series);
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
  }, [selectedKpi, primaryCareData.ATTACHMENT_RATES]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'attachment_rate':
        return {
          label: 'Primary Care Attachment Rate',
          description: 'Historical trend of the percentage of Albertans reporting access to a regular family doctor or health provider. Attachment has eroded modestly in recent years due to provider retirements and panel caps, with persistent gaps for low-income, young-adult, and rural residents.',
          colorClass: 'text-indigo-400',
          bgClass: 'bg-indigo-500/10',
          strokeColor: '#6366f1',
          gradientId: 'colorAttachmentTrend',
          unit: '%',
          icon: Users
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  // Historical trend series for the attachment rate AreaChart
  const attachmentTrendSeries = useMemo(() => {
    return primaryCareData.ATTACHMENT_RATES
      .filter(r => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
      .sort((a, b) => a.reporting_year.localeCompare(b.reporting_year))
      .map(r => ({ year: r.reporting_year, attachment_rate: r.metric_value }));
  }, [primaryCareData.ATTACHMENT_RATES]);
  
  if (isLoading) return <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={Stethoscope}
        title="Primary Care & Providers"
        description="Track family medicine attachment rates and locate accepting clinics."
        metadata={primaryCareData._dataMetadata}
        arrayKey="ATTACHMENT_RATES"
      />

      {/* Sub-tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('attachment')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'attachment'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Attachment & Access</span>
        </button>
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'directory'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Accepting Providers</span>
        </button>
        <button
          onClick={() => setActiveSubTab('pcn')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'pcn'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>PCN Capacity</span>
        </button>
        <button
          onClick={() => setActiveSubTab('er-link')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'er-link'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>ER Overreliance</span>
        </button>
      </div>

      {/* Top Level Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div
          tabIndex={0}
          role="button"
          aria-pressed={selectedKpi === 'attachment_rate'}
          onClick={() => setSelectedKpi(selectedKpi === 'attachment_rate' ? null : 'attachment_rate')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'attachment_rate' ? null : 'attachment_rate');
            }
          }}
          className={`bg-slate-950 border rounded-xl p-4 flex items-start gap-4 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group relative ${
            selectedKpi === 'attachment_rate'
              ? 'border-indigo-500 ring-1 ring-indigo-500/30 bg-slate-900/80 shadow-indigo-500/5'
              : 'border-slate-900 hover:border-indigo-500/30 hover:bg-slate-900/50'
          }`}
        >
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Attached to Regular GP</span>
              <span className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-500 group-hover:text-indigo-400 group-hover:border-indigo-500/30 transition-all shrink-0" title="Click to view trend">
                <BarChart2 className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{attachmentRate}%</span>
              <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> CIHI {reportingYear}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-slate-400 block">Canada Avg: {canadaAvg}% (CIHI {reportingYear})</span>
              <span className={`text-[9px] font-bold flex items-center gap-0.5 transition-opacity ${
                selectedKpi === 'attachment_rate'
                  ? 'text-indigo-400 opacity-100'
                  : 'text-indigo-400/80 opacity-100 group-hover:opacity-100'
              }`}>
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'attachment_rate' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </span>
            </div>
          </div>
        </div>
        {/* Metric 2 */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Accepting Patients (Listed)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{totalAcceptingCount.toLocaleString()} Providers</span>
              <span className="text-[10px] text-emerald-400 font-bold">Live Directory</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Source: Alberta Find a Provider · {primaryCareData.ACCEPTING_PROVIDERS.length} providers province-wide</span>
          </div>
        </div>

        {/* Metric 3 */}
        <button
          onClick={() => setActiveSubTab('attachment')}
          className="w-full text-left bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4 hover:border-blue-500/30 hover:bg-slate-900/50 cursor-pointer transition-all group relative"
        >
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Same / Next Day Access</span>
              <span className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-500 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all shrink-0" title="Click to view details">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{sameDayAccess}%</span>
              <span className="text-[10px] text-rose-500 font-bold">Access Gap</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-slate-400 block">Only {Math.round(sameDayAccess / 10 * 10) / 10} in 10 get immediate non-urgent care</span>
              <span className="text-[9px] text-blue-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View Details
              </span>
            </div>
          </div>
        </button>

        {/* Metric 4 */}
        <button
          onClick={() => setActiveSubTab('er-link')}
          className="w-full text-left bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4 hover:border-rose-500/30 hover:bg-slate-900/50 cursor-pointer transition-all group relative"
        >
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Minor-Condition ER Rate</span>
              <span className="p-1 bg-slate-900 border border-slate-800 rounded text-slate-500 group-hover:text-rose-400 group-hover:border-rose-500/30 transition-all shrink-0" title="Click to view chart">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{minorConditionEdRate}</span>
              <span className="text-[10px] text-slate-400">per 1k pop</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-amber-500 block">Over 1M low-acuity ER visits annually</span>
              <span className="text-[9px] text-rose-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View Chart
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* KPI Trend Explorer Panel */}
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
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline</span>
                  <span className="text-xl font-black text-slate-300 font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current</span>
                  <span className="text-xl font-black text-white font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Peak</span>
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
                  <AreaChart data={attachmentTrendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} unit={selectedKpiDetails.unit} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 11 }}
                      formatter={(v: number) => [`${v}${selectedKpiDetails.unit}`, 'Attached']}
                    />
                    <Area
                      type="monotone"
                      dataKey="attachment_rate"
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

      {/* SUB-TAB CONTENTS */}

      {/* 1. ATTACHMENT & ACCESS */}
      {activeSubTab === 'attachment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Primary Care Attachment Rates by Demographic Group</h3>
                  <p className="text-xs text-slate-400">Percent of Albertans who report having access to a regular health provider ({reportingYear})</p>
                  <DataTimestamp compact metadata={primaryCareData._dataMetadata} arrayKey="ATTACHMENT_RATES" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500"></span>
                  <span className="text-xs text-slate-400">Alberta (% Attached)</span>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={latestAlbertaRates}
                    layout="vertical"
                    margin={{ top: 25, right: 30, left: 160, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#475569" tickFormatter={(v) => `${v}%`} className="text-[10px] font-mono" />
                    <YAxis dataKey="demographic_group" type="category" stroke="#475569" className="text-[10px] font-bold" width={150} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      formatter={(v: number) => [`${v}%`, 'Attached Patients']}
                    />
                    <Bar dataKey="metric_value" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                      {latestAlbertaRates.map((entry, index) => {
                        let barColor = '#6366f1';
                        if (entry.demographic_group.includes('Lowest')) barColor = '#f43f5e';
                        if (entry.demographic_group.includes('Seniors')) barColor = '#10b981';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                    <ReferenceLine x={canadaAvg} stroke="#f59e0b" strokeDasharray="3 3">
                      <Label value={`Canada Avg (${canadaAvg}%)`} position="top" offset={10} fill="#f59e0b" className="text-[9px] font-mono font-bold" />
                    </ReferenceLine>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-900 rounded-lg flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <strong>Critical Vulnerability identified:</strong> Access to a regular healthcare provider varies substantially across demographics. Low-income earners (<span className="text-rose-400 font-bold">{lowIncomeRate}%</span>), young adults (<span className="text-amber-400 font-bold">{youngAdultsRate}%</span>), and rural residents (<span className="text-rose-400 font-bold">{ruralRate}%</span>) experience severe gaps compared to seniors (<span className="text-emerald-400 font-bold">{seniorsRate}%</span>).
                </div>
              </div>
            </div>

            {/* Sidebar Analytics */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Key Quality & Access Indicators</h3>
                <p className="text-xs text-slate-400">Provincial aggregates derived from CIHI and FOCUS modules.</p>
              </div>

              <div className="space-y-4">
                {/* Same-day Access indicator */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Same/Next Day Doctor Access</span>
                    <span className="text-xs font-mono font-bold text-rose-500">{sameDayAccess}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: `${sameDayAccess}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Percentage of Albertans who are able to obtain a same-day or next-day appointment with their primary care team when sick.
                  </p>
                </div>

                {/* Patient Wait satisfaction */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Satisfaction with Wait Time</span>
                    <span className="text-xs font-mono font-bold text-amber-500">{waitSatisfaction}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${waitSatisfaction}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Percentage of paneled patients satisfied or very satisfied with the wait time for a non-urgent care appointment.
                  </p>
                </div>

                {/* Clinic Continuity */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">High Clinic Continuity</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">{clinicContinuity}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${clinicContinuity}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Patients visiting the same clinic for over 80% of their annual primary care consultations.
                  </p>
                </div>

                {/* Patient experience overall */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Primary Care Rating (Excellent)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{careRatingExcellent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${careRatingExcellent}%` }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Patients rating their overall primary healthcare experience as Excellent or Very Good (HQCA FOCUS Survey).
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900">
                <span className="text-[10px] text-indigo-400 uppercase font-black block tracking-wider">CPAR Integration Status</span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Central Patient Attachment Registry (CPAR) is active to prevent panel conflicts, verifying explicit clinic-to-patient relationships.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {/* Filters Panel */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Search & Filter Clinics Accepting New Patients</h3>
              <DataTimestamp compact metadata={primaryCareData._dataMetadata} arrayKey="ACCEPTING_PROVIDERS" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search text */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search doctor, clinic or city..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Zone Filter */}
              <div>
                <select
                  value={selectedZoneFilter}
                  onChange={(e) => setSelectedZoneFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>
              </div>

              {/* Provider Type */}
              <div>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Provider Types</option>
                  <option value="Family Doctor">Family Doctors (MD)</option>
                  <option value="Nurse Practitioner">Nurse Practitioners (NP)</option>
                </select>
              </div>

              {/* Quick Feature Checkboxes */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-start md:justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterWalkIn}
                    onChange={(e) => setFilterWalkIn(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">Dedicated Walk-In</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterAfterHours}
                    onChange={(e) => setFilterAfterHours(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">After Hours</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterVirtual}
                    onChange={(e) => setFilterVirtual(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">Virtual Appts</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
              <span>Showing <strong>{filteredProviders.length}</strong> providers accepting new patients matching criteria.</span>
              <button
                onClick={() => {
                  setDirectorySearch('');
                  setSelectedZoneFilter('All');
                  setSelectedTypeFilter('All');
                  setFilterWalkIn(false);
                  setFilterAfterHours(false);
                  setFilterVirtual(false);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Directory Listings Grid */}
          {filteredProviders.length > 0 ? (
            <div className="space-y-4">
              {filteredProviders.length > 60 && (
                <div className="text-xs text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
                  Showing first 60 of {filteredProviders.length} matching providers. Narrow your search or filter to see more.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProviders.slice(0, 60).map(prov => (
                <div
                  key={prov.id}
                  className="bg-slate-950 border border-slate-900 hover:border-indigo-500/40 rounded-xl p-5 flex flex-col justify-between transition-all shadow-md relative group"
                >
                  <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Accepting Patients
                  </div>

                  <div>
                    {/* Title */}
                    <div className="mb-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-850">
                        {prov.type}
                      </span>
                      <h4 className="text-base font-black text-white mt-1.5 group-hover:text-indigo-400 transition-colors">
                        {prov.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">{prov.clinicName}</p>
                    </div>

                    {/* Address / Zone details */}
                    <div className="space-y-1.5 py-3 border-y border-slate-900 text-xs">
                      <div className="flex items-start gap-2 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                        <div>
                          <p>{prov.address}</p>
                          <p className="text-[10px] text-slate-500">{prov.city}, AB, {prov.postalCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{prov.phone}</span>
                      </div>
                      {prov.pcnName && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>PCN: <strong className="text-slate-400 font-semibold">{prov.pcnName}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges / Languages / Actions */}
                  <div className="mt-4 pt-3 space-y-3">
                    {/* Features */}
                    <div className="flex flex-wrap gap-1.5">
                      {prov.features.walkIn && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/5 text-indigo-400 border border-indigo-500/10">
                          Walk-In
                        </span>
                      )}
                      {prov.features.afterHours && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/5 text-blue-400 border border-blue-500/10">
                          After Hours
                        </span>
                      )}
                      {prov.features.virtualAppointments && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                          Virtual
                        </span>
                      )}
                      {prov.features.wheelchairAccess && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-400">
                          Wheelchair
                        </span>
                      )}
                      {prov.features.onlineBooking && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/5 text-violet-400 border border-violet-500/10">
                          Online Book
                        </span>
                      )}
                    </div>

                    {/* Languages & Gender */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{(prov.languages ?? []).join(', ') || '—'}</span>
                      </div>
                      {prov.gender && (
                        <span>Gender: <strong className="text-slate-400">{prov.gender}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-black text-white">No Matching Providers Found</h4>
                <p className="text-xs text-slate-400">
                  Try widening your filter selections or clearing the search box to browse accepting clinics.
                </p>
              </div>
            </div>
          )}
        </div>
      )}


      {activeSubTab === 'pcn' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualizer card */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Primary Care Network (PCN) Resource Distribution</h3>
                <p className="text-xs text-slate-400">Comparison of active primary care providers and payments per patient across health zones.</p>
              <DataTimestamp compact metadata={primaryCareData._dataMetadata} arrayKey="PCN_CAPACITY" />
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={primaryCareData.PCN_CAPACITY.filter(c => c.zone !== 'Alberta')}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="zone" stroke="#475569" className="text-[10px] font-bold" />
                    <YAxis yAxisId="left" orientation="left" stroke="#818cf8" tickFormatter={(v) => `${v}`} className="text-[10px] font-mono">
                      <Label value="Active GP Providers" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#818cf8' }} />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" tickFormatter={(v) => `$${v}`} className="text-[10px] font-mono">
                      <Label value="Funding Per Patient" angle={90} position="insideRight" style={{ textAnchor: 'middle', fill: '#10b981' }} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="activeProviders" name="Active GP Providers" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={35}  isAnimationActive={false} />
                    <Bar yAxisId="right" dataKey="fundingPerPatient" name="Annual Funding per Patient" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35}  isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg text-xs text-slate-300">
                <strong>Funding Distribution Insight:</strong> The provincial average funding per patient is <strong className="text-emerald-400">${provincialFundingPerPatient}</strong>. While rural/remote regions like the <strong>North Zone</strong> receive higher relative patient funding (<strong className="text-emerald-400">${northZone?.fundingPerPatient ?? 0}</strong>), they suffer from severe provider shortages with only <strong className="text-rose-400">{northZone?.providersPer100k ?? 0} GP providers per 100k population</strong> compared to Edmonton (<strong className="text-indigo-400">{edmontonZone?.providersPer100k ?? 0}</strong>) and Calgary (<strong className="text-indigo-400">{calgaryZone?.providersPer100k ?? 0}</strong>).
              </div>
            </div>

            {/* Quick stats table */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">PCN Zone Statistics</h3>
                <p className="text-xs text-slate-400">Detailed capacity counts across AHS zones.</p>
              </div>

              <div className="divide-y divide-slate-900 overflow-hidden">
                {primaryCareData.PCN_CAPACITY.map((zone, idx) => (
                  <div key={idx} className={`py-2.5 flex justify-between items-center text-xs ${zone.zone === 'Alberta' ? 'bg-indigo-950/20 px-2 rounded-lg border border-indigo-900/30' : ''}`}>
                    <div>
                      <strong className={`font-bold block ${zone.zone === 'Alberta' ? 'text-indigo-300' : 'text-white'}`}>
                        {zone.zone}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        {zone.pcnCount} Networks | {zone.enrolledPatients.toLocaleString()} Patients
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-slate-300 block">
                        {zone.activeProviders} GPs
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {zone.patientsPerProvider} pts/doctor
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-900">
                <DataTimestamp compact metadata={primaryCareData._dataMetadata} arrayKey="PCN_CAPACITY" />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'er-link' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Causal Chart */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Impact of Family Doctor Continuity on Low-Acuity ER Visits</h3>
                <p className="text-xs text-slate-400">
                  Annual minor-condition (CTAS 4 & 5) emergency room visits per 1,000 patients, grouped by care continuity with their primary care provider.
                </p>
              <DataTimestamp compact metadata={primaryCareData._dataMetadata} arrayKey="ED_RELIANCE_BY_CONTINUITY" />
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={primaryCareData.ED_RELIANCE_BY_CONTINUITY}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="group" stroke="#475569" className="text-[10px] font-bold" />
                    <YAxis stroke="#475569" className="text-[10px] font-mono" tickFormatter={(v) => `${v}`}>
                      <Label value="ED Visits per 1,000 Patients" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#94a3b8' }} />
                    </YAxis>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      formatter={(v: number) => [`${v} visits`, 'Visits per 1,000']}
                    />
                    <Bar dataKey="minorConditionEdVisitsPer1000" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45} isAnimationActive={false}>
                      {primaryCareData.ED_RELIANCE_BY_CONTINUITY.map((entry, index) => {
                        let barColor = '#3b82f6';
                        if (entry.group.includes('High')) barColor = '#10b981';
                        if (entry.group.includes('Low')) barColor = '#f59e0b';
                        if (entry.group.includes('No Attached')) barColor = '#f43f5e';
                        if (entry.group.includes('Average')) barColor = '#64748b';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-900 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <strong className="text-xs text-white">The "Primary Care Collapse to ER Overreliance" Loop:</strong>
                </div>
                <p className="text-xs text-slate-300">
                  Analytical model based on CIHI Shared Health Priorities and HQCA FOCUS survey data. Patients who have no family doctor, or have extremely low continuity (&lt;30%), consume over <span className="text-rose-400 font-black">3x more ER visits</span> for simple minor conditions (sore throats, minor rashes, routine medication renewal) than attached patients with high continuity.
                </p>
              </div>
            </div>

            {/* Sidebar Analytical Breakdown */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">Theoretical Action Plan</h3>
                <p className="text-xs text-slate-400">Systemic remedies to alleviate ER pressure via primary care reform.</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Step 1 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-indigo-400 uppercase font-black tracking-wider block">1. Panel Expansion & Attachment Support</span>
                  <p className="text-slate-400 leading-relaxed">
                    Formalize relationships via CPAR. Target the <strong className="text-white">{Math.round((100 - attachmentRate) * 10) / 10}% unattached residents</strong>, prioritizing low-income and remote geographies with active nurse practitioner integration.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">2. Enhancing After-Hours Clinic Capacity</span>
                  <p className="text-slate-400 leading-relaxed">
                    Over 40% of low-acuity ER visits occur outside standard 9-to-5 working hours. Funding clinics to remain open for evening/weekend walk-ins diverts CTAS 4/5 volumes.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-violet-400 uppercase font-black tracking-wider block">3. Multi-Disciplinary Health Teams</span>
                  <p className="text-slate-400 leading-relaxed">
                    Surround family doctors with dieticians, mental health workers, and pharmacists to offload non-clinical administrative constraints, increasing daily patient capacity by up to 25%.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                <span>Unofficial analytical model · CIHI Shared Health Priorities &amp; HQCA FOCUS survey references</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
