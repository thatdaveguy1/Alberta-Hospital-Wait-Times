import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  FileText, 
  Info,
  ChevronRight,
  UserCheck,
  HeartPulse,
  Award,
  Clock,
  BarChart2,
  TrendingDown,
  RefreshCw,
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
  Legend, 
  Cell,
  ReferenceLine
} from 'recharts';
import * as cancerData from '../cancerData';
import {
  type CancerBurdenItem,
  type CancerSurgeryWaitTrend,
  type CancerCentreLocation,
  type RadiationTherapyCompliance,
  type CancerScreeningZoneRate
} from '../cancerData';
import { DataTimestamp, DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type CancerData = {
  CANCER_BURDEN_STATS: CancerBurdenItem[];
  CANCER_SCREENING_RATES: CancerScreeningZoneRate[];
  CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[];
  RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[];
  ALBERTA_CANCER_CENTRES: CancerCentreLocation[];
};

export default function CancerDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'burden' | 'screening' | 'surgery' | 'radiation' | 'facilities'>('burden');
  
  // Interactive Filter States
  const [selectedCancer, setSelectedCancer] = useState<string>('All');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const { data, metadata, isLoading, error, refresh } = useDomainData<CancerData>('cancer', cancerData);

  const domainData = useMemo(() => ({
    CANCER_BURDEN_STATS: data?.CANCER_BURDEN_STATS ?? [],
    CANCER_SCREENING_RATES: data?.CANCER_SCREENING_RATES ?? [],
    CANCER_SURGERY_WAIT_TRENDS: data?.CANCER_SURGERY_WAIT_TRENDS ?? [],
    RADIATION_THERAPY_WAIT_TRENDS: data?.RADIATION_THERAPY_WAIT_TRENDS ?? [],
    ALBERTA_CANCER_CENTRES: data?.ALBERTA_CANCER_CENTRES ?? [],
    _dataMetadata: metadata ?? undefined
  }), [data, metadata]);

  // Filter Cancer Burden stats
  const filteredBurden = useMemo(() => {
    if (selectedCancer === 'All') return domainData.CANCER_BURDEN_STATS;
    return domainData.CANCER_BURDEN_STATS.filter(b => b.cancerType === selectedCancer);
  }, [selectedCancer, domainData]);

  // Aggregate stats for the burden tab
  const burdenSummary = useMemo(() => {
    const totalCases = domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedCases2026, 0);
    const totalDeaths = domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedDeaths2026, 0);
    const avgSurvival = domainData.CANCER_BURDEN_STATS.length > 0
      ? domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.fiveYearRelativeSurvivalPct, 0) / domainData.CANCER_BURDEN_STATS.length
      : 0;
    const lungDeaths = domainData.CANCER_BURDEN_STATS.find(b => b.cancerType === 'Lung Cancer')?.projectedDeaths2026 ?? 0;
    const lungDeathPct = totalDeaths > 0 ? Math.round((lungDeaths / totalDeaths) * 100) : 0;
    return { totalCases, totalDeaths, avgSurvival, lungDeaths, lungDeathPct };
  }, [domainData]);

  // Filter Facilities by Zone and Search
  const filteredFacilities = useMemo(() => {
    return domainData.ALBERTA_CANCER_CENTRES.filter(fac => {
      const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
      const matchesSearch = fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.services.some(s => s.toLowerCase().includes(facilitySearch.toLowerCase()));
      return matchesZone && matchesSearch;
    });
  }, [selectedZone, facilitySearch, domainData]);

  // Radiation therapy trend summary (latest year + year-over-year recovery delta)
  const radiationSummary = useMemo(() => {
    const trends = [...domainData.RADIATION_THERAPY_WAIT_TRENDS].sort((a, b) => a.year.localeCompare(b.year));
    const latest = trends.length > 0 ? trends[trends.length - 1] : null;
    const year2022 = trends.find(t => t.year === '2022') ?? null;
    const recoveryDelta = latest && year2022 ? Math.round((latest.albertaPctWithinBenchmark - year2022.albertaPctWithinBenchmark) * 10) / 10 : 0;
    return { latest, year2022, recoveryDelta };
  }, [domainData]);

  // Interactive trend selector for wait-time historical trend panel
  const [selectedTrend, setSelectedTrend] = useState<'cancer_surgery' | 'radiation_therapy' | null>(null);

  const trendDetails = useMemo(() => {
    if (!selectedTrend) return null;
    switch (selectedTrend) {
      case 'cancer_surgery':
        return {
          label: 'Cancer Surgery Wait Times',
          description: 'Historical tracking of Alberta median (P50) and 90th percentile (P90) wait times in days for priority cancer surgeries, benchmarked against the Canadian national standard. Spikes in the P90 series reflect secondary backlog development in elective oncology cohorts.',
          colorClass: 'text-rose-400',
          bgClass: 'bg-rose-500/10',
          strokeColor: '#e11d48',
          gradientId: 'colorSurgeryTrend',
          unit: ' days',
          icon: Activity
        };
      case 'radiation_therapy':
        return {
          label: 'Radiation Therapy Wait Times',
          description: 'Historical tracking of the percentage of oncology patients receiving first radiation therapy treatment within the recommended 28-day national clinical target, alongside P50/P90 wait day percentiles. Recovery follows pandemic-era throughput expansions.',
          colorClass: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10',
          strokeColor: '#10b981',
          gradientId: 'colorRadiationTrend',
          unit: '%',
          icon: Clock
        };
      default:
        return null;
    }
  }, [selectedTrend]);

  const trendStats = useMemo(() => {
    if (!selectedTrend) return null;
    if (selectedTrend === 'cancer_surgery') {
      const trends = [...domainData.CANCER_SURGERY_WAIT_TRENDS]
        .filter(t => t.cancerType === 'Breast')
        .sort((a, b) => a.year.localeCompare(b.year));
      const values = trends.map(t => t.albertaP90Days).filter(v => typeof v === 'number');
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
    }
    if (selectedTrend === 'radiation_therapy') {
      const trends = [...domainData.RADIATION_THERAPY_WAIT_TRENDS].sort((a, b) => a.year.localeCompare(b.year));
      const values = trends.map(t => t.albertaPctWithinBenchmark).filter(v => typeof v === 'number');
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
        // For compliance %, a decrease is the worsening direction.
        isIncrease: rawDelta < 0
      };
    }
    return null;
  }, [selectedTrend, domainData]);

  const hasNoData = !data || 
                    !data.CANCER_BURDEN_STATS || data.CANCER_BURDEN_STATS.length === 0 || 
                    !data.CANCER_SURGERY_WAIT_TRENDS || data.CANCER_SURGERY_WAIT_TRENDS.length === 0 || 
                    !data.RADIATION_THERAPY_WAIT_TRENDS || data.RADIATION_THERAPY_WAIT_TRENDS.length === 0 || 
                    !data.ALBERTA_CANCER_CENTRES || data.ALBERTA_CANCER_CENTRES.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading cancer data...
      </div>
    );
  }

  if (error || hasNoData) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>{error ? `Failed to load cancer data: ${error}` : 'No cancer data available'}</span>
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
        icon={HeartPulse}
        title="Cancer Care & Screening"
        description="Track projected cases, screening participation rates, and radiation therapy benchmarks."
        metadata={domainData._dataMetadata}
        arrayKey="CANCER_SURGERY_WAIT_TRENDS"
      />

      {/* Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('burden')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'burden'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tumor Burden</span>
        </button>
        <button
          onClick={() => setActiveSubTab('screening')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'screening'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Screening Rates</span>
        </button>
        <button
          onClick={() => setActiveSubTab('surgery')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'surgery'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Cancer Surgeries</span>
        </button>
        <button
          onClick={() => setActiveSubTab('radiation')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'radiation'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Radiation Gaps</span>
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
          <span>Therapy Centers</span>
        </button>
      </div>

      {/* SUBTAB 1: Tumor Burden & Survival Outcomes */}
      {activeSubTab === 'burden' && (
        <div className="space-y-6">
          {/* Burden Cards Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">2026 Projected Major Cancer Diagnoses</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">~{(burdenSummary.totalCases).toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-mono">new cases (major cancers)</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Sum of projected 2026 cases for tracked major cancer types (not total provincial incidence). Registry vintage shown in data timestamp below.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">2026 Projected Annual Cancer Deaths</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-500">~{(burdenSummary.totalDeaths).toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-mono">mortality count</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Lung cancer remains the leading cause of oncological mortality (~{burdenSummary.lungDeaths.toLocaleString()} cases), accounting for approximately {burdenSummary.lungDeathPct}% of all cancer deaths.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Average 5-Year Survival Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{burdenSummary.avgSurvival.toFixed(1)}%</span>
                <span className="text-xs text-slate-400 font-mono">relative average</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Prostate & breast cancers demonstrate high relative survival rates (&gt;89%), while lung cancer lags at 22.4% due to delayed diagnosis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Burden chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alberta Primary Cancer Burden Profiler</h3>
                  <p className="text-[10px] text-slate-500">Projected incident cases for the tracked major cancers vs. actual mortality indicators (March 2026 Registry Update). This is not the total annual cancer burden for Alberta.</p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="CANCER_BURDEN_STATS" />
                </div>
                <div className="relative">
                  <select
                    value={selectedCancer}
                    onChange={(e) => setSelectedCancer(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="All">All Major Cancers</option>
                    {domainData.CANCER_BURDEN_STATS.map(b => (
                      <option key={b.cancerType} value={b.cancerType}>{b.cancerType}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredBurden}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="cancerType" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="projectedCases2026" name="Projected New Cases" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="projectedDeaths2026" name="Projected Annual Deaths" fill="#e11d48" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Table view */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Surveillance Rates & Risks</h3>
                  <p className="text-[10px] text-slate-500">Age-standardized rates per 100,000 population</p>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {filteredBurden.map(item => (
                    <div key={item.cancerType} className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{item.cancerType}</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          {item.fiveYearRelativeSurvivalPct}% Survival
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>
                          <span className="text-[9px] text-slate-500 block">Incidence Rate:</span>
                          <strong className="text-slate-300 font-semibold">{item.ageStandardizedIncidenceRate} / 100k</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block">Mortality Rate:</span>
                          <strong className="text-slate-300 font-semibold">{item.ageStandardizedMortalityRate} / 100k</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Age-Standardization:</strong> Minimizes differences in population age profiles when comparing different health regions or decades over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Organized Cancer Screening by Zone */}
      {activeSubTab === 'screening' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="CANCER_SCREENING_RATES" />
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Screening for Life Participation by Zone</h3>
              <p className="text-[10px] text-slate-500">Breast, cervical, and colorectal screening rates (% eligible population screened)</p>
            </div>
            {domainData.CANCER_SCREENING_RATES.length === 0 ? (
              <p className="text-sm text-slate-500">No screening rate data available.</p>
            ) : (
              <>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={domainData.CANCER_SCREENING_RATES}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="zone" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={9} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="breastScreeningPct" name="Breast (%)" fill="#ec4899" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="cervicalScreeningPct" name="Cervical (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="colorectalScreeningPct" name="Colorectal (%)" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-800">
                        <th className="py-2 pr-4 font-extrabold">Zone</th>
                        <th className="py-2 pr-4 font-extrabold">Breast %</th>
                        <th className="py-2 pr-4 font-extrabold">Cervical %</th>
                        <th className="py-2 font-extrabold">Colorectal %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domainData.CANCER_SCREENING_RATES.map((row) => (
                        <tr key={row.zone} className="border-b border-slate-850 text-slate-300">
                          <td className="py-2 pr-4 font-semibold text-white">{row.zone}</td>
                          <td className="py-2 pr-4 font-mono">{row.breastScreeningPct}%</td>
                          <td className="py-2 pr-4 font-mono">{row.cervicalScreeningPct}%</td>
                          <td className="py-2 font-mono">{row.colorectalScreeningPct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* SUBTAB 3: Cancer Surgery Wait Times (CIHI Benchmarks) */}
      {activeSubTab === 'surgery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Surgery Wait Times Line Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI Priority Cancer Surgery Wait Trends</h3>
                <p className="text-[10px] text-slate-500">
                  Comparing Alberta median (P50) and 90th percentile (P90) wait times in days against the Canadian national standard.
                </p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="CANCER_SURGERY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={domainData.CANCER_SURGERY_WAIT_TRENDS.filter(t => t.cancerType === 'Breast' || t.cancerType === 'Colorectal')}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    
                    <Line type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#e11d48" strokeWidth={2.5} dot  isAnimationActive={false} />
                    <Line type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 3" dot  isAnimationActive={false} />
                    
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#10b981" strokeWidth={2} dot  isAnimationActive={false} />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot  isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                💡 <strong>Wait List Dynamics:</strong> Spikes in the 90th Percentile (P90) reflect secondary backlog development. 
                While urgent patients (Median) are scheduled rapidly, elective outpatients wait considerably longer for margin reconstructions.
              </p>
            </div>

            {/* Performance Target / Priority breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National Surgical Milestones</h3>
                <p className="text-[10px] text-slate-500">Benchmark compliance under clinical prioritizations</p>
              </div>

              <div className="space-y-3 grow pt-2">
                <div
                  tabIndex={0}
                  onClick={() => setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery');
                    }
                  }}
                  className={`p-3 bg-slate-950/40 rounded-xl border space-y-1 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group ${
                    selectedTrend === 'cancer_surgery'
                      ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                      : 'border-slate-850 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 1 (Urgent Care)</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">14 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Acute cases with rapid localized growth. Current AHS performance targets are generally met with 94.2% of patients receiving surgery within 14 days (program-reported estimate; no public registry source).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'cancer_surgery' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  onClick={() => setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery');
                    }
                  }}
                  className={`p-3 bg-slate-950/40 rounded-xl border space-y-1 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group ${
                    selectedTrend === 'cancer_surgery'
                      ? 'border-amber-500 ring-1 ring-amber-500/30 shadow-amber-500/5'
                      : 'border-slate-850 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 2 (Semi-Urgent)</span>
                    <span className="text-[10px] text-amber-500 font-mono font-bold">28 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Established primary solid tumors. 84.1% compliance rate within Alberta's central and metropolitan cancer hubs (program-reported estimate; no public registry source).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-amber-500/80 group-hover:text-amber-500 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'cancer_surgery' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  onClick={() => setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'cancer_surgery' ? null : 'cancer_surgery');
                    }
                  }}
                  className={`p-3 bg-slate-950/40 rounded-xl border space-y-1 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group ${
                    selectedTrend === 'cancer_surgery'
                      ? 'border-indigo-500 ring-1 ring-indigo-500/30 shadow-indigo-500/5'
                      : 'border-slate-850 hover:border-indigo-500/30'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 3 (Elective)</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold">42 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Post-chemotherapy margin reconstruction or slow-growing prostate monitors. Compliance falls to 72.5% during high peak surgical volumes (program-reported estimate; no public registry source).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-indigo-400/80 group-hover:text-indigo-400 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'cancer_surgery' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trend Panel */}
          <AnimatePresence mode="wait">
            {selectedTrend === 'cancer_surgery' && trendDetails && trendStats && (
              <motion.div
                key="cancer-surgery-trend"
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
                        {React.createElement(trendDetails.icon, {
                          className: `w-4 h-4 ${trendDetails.colorClass}`
                        })}
                        <span>{trendDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {trendDetails.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (Breast P90)</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{trendStats.baseline}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (Breast P90)</span>
                      <span className="text-xl font-black text-white font-mono">{trendStats.latest}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
                      <span className={`text-xl font-black font-mono ${trendDetails.colorClass}`}>{trendStats.peak}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xs font-extrabold flex items-center justify-center sm:justify-start gap-1 ${trendStats.isIncrease ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {trendStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{trendStats.delta}{trendDetails.unit} ({trendStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-60 mt-3 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={domainData.CANCER_SURGERY_WAIT_TRENDS.filter(t => t.cancerType === 'Breast' || t.cancerType === 'Colorectal')}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                        <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#e11d48" strokeWidth={2.5} dot isAnimationActive={false} />
                        <Line type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 3" dot isAnimationActive={false} />
                        <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#10b981" strokeWidth={2} dot isAnimationActive={false} />
                        <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUBTAB 4: Radiation Therapy Access */}
      {activeSubTab === 'radiation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Radiation Therapy Wait Times Percentiles */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National Radiation Therapy Wait Times</h3>
                <p className="text-[10px] text-slate-500">
                  Percentage of oncology patients receiving first radiation therapy treatment within the recommended 28-day national clinical target.
                </p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="RADIATION_THERAPY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={domainData.RADIATION_THERAPY_WAIT_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorAlbertaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCanadaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Within Benchmark %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} domain={[70, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="albertaPctWithinBenchmark" name="Alberta % Within Benchmark" stroke="#10b981" fillOpacity={1} fill="url(#colorAlbertaRad)" strokeWidth={2.5}  isAnimationActive={false} />
                    <Area type="monotone" dataKey="canadaPctWithinBenchmark" name="Canadian Average %" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanadaRad)" strokeWidth={1.5} strokeDasharray="5 5"  isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                ✔️ <strong>Recovery Trend:</strong> Following a dip during the pandemic years ({radiationSummary.year2022?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.year2022?.year ?? '2022'}), Alberta's radiation therapy throughput recovered to {radiationSummary.latest?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.latest?.year ?? '2025'} due to clinical cohort expansions and late-night scanning blocks.
              </p>
            </div>

            {/* Benchmark Details */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Radiation Access Milestones</h3>
                <p className="text-[10px] text-slate-500">Wait times from clinical ready-to-treat decision to first beam</p>
              </div>

              <div className="space-y-4 pt-2">
                <div
                  tabIndex={0}
                  onClick={() => setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy');
                    }
                  }}
                  className={`p-3 bg-slate-950/40 rounded-xl border space-y-2 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group ${
                    selectedTrend === 'radiation_therapy'
                      ? 'border-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                      : 'border-slate-850 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Median Wait (P50)</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {radiationSummary.latest?.albertaP50WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Half of all patients referred for urgent or routine palliative radiation treatment receive their first fraction within {radiationSummary.latest?.albertaP50WaitDays ?? 0} days of the clinical directive ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'radiation_therapy' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  onClick={() => setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy');
                    }
                  }}
                  className={`p-3 bg-slate-950/40 rounded-xl border space-y-2 cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl group ${
                    selectedTrend === 'radiation_therapy'
                      ? 'border-amber-500 ring-1 ring-amber-500/30 shadow-amber-500/5'
                      : 'border-slate-850 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">90th Percentile Wait (P90)</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {radiationSummary.latest?.albertaP90WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    90% of all oncology cohorts receive radiation within {radiationSummary.latest?.albertaP90WaitDays ?? 0} days, comfortably meeting the Canadian Association of Radiologists standard of 28 days ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-amber-500/80 group-hover:text-amber-500 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'radiation_therapy' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-[10px] text-emerald-300 font-bold">Alberta maintains one of the shortest radiation queues in Western Canada.</span>
              </div>
            </div>
          </div>

          {/* Trend Panel */}
          <AnimatePresence mode="wait">
            {selectedTrend === 'radiation_therapy' && trendDetails && trendStats && (
              <motion.div
                key="radiation-therapy-trend"
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
                        {React.createElement(trendDetails.icon, {
                          className: `w-4 h-4 ${trendDetails.colorClass}`
                        })}
                        <span>{trendDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {trendDetails.description}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800/40">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline Within Benchmark</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{trendStats.baseline}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Within Benchmark</span>
                      <span className="text-xl font-black text-white font-mono">{trendStats.latest}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
                      <span className={`text-xl font-black font-mono ${trendDetails.colorClass}`}>{trendStats.peak}{trendDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xs font-extrabold flex items-center justify-center sm:justify-start gap-1 ${trendStats.isIncrease ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {trendStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{trendStats.delta}{trendDetails.unit} ({trendStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-60 mt-3 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={domainData.RADIATION_THERAPY_WAIT_TRENDS}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id={trendDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={trendDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={trendDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCanadaRadTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                        <YAxis label={{ value: 'Within Benchmark %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} domain={[70, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area type="monotone" dataKey="albertaPctWithinBenchmark" name="Alberta % Within Benchmark" stroke={trendDetails.strokeColor} fillOpacity={1} fill={`url(#${trendDetails.gradientId})`} strokeWidth={2.5} isAnimationActive={false} />
                        <Area type="monotone" dataKey="canadaPctWithinBenchmark" name="Canadian Average %" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanadaRadTrend)" strokeWidth={1.5} strokeDasharray="5 5" isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUBTAB 5: Treatment Access & Facility Map */}
      {activeSubTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Oncology Treatment Centers & Service Directories</h3>
                <p className="text-[10px] text-slate-500">Live directory of specialized cancer centers, linear accelerators, and chemotherapy access sites</p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="ALBERTA_CANCER_CENTRES" />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search clinics & services..."
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* List of Cancer Centres */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFacilities.map(fac => (
                <div key={fac.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{fac.name}</h4>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded mt-1.5 inline-block font-mono">
                          {fac.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate">{fac.address}, {fac.city} ({fac.zone})</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-2">
                      <span className="text-[9px] text-slate-500 uppercase font-extrabold block mb-1">Available Services:</span>
                      <div className="flex flex-wrap gap-1">
                        {fac.services.map((srv, idx) => (
                          <span key={idx} className="text-[9px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded">
                            {srv}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-900 text-[9px] text-center">
                    <div className={`p-1 rounded font-bold ${fac.systemicTherapyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Chemo / Systemic
                    </div>
                    <div className={`p-1 rounded font-bold ${fac.radiationTherapyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Radiation (LINAC)
                    </div>
                    <div className={`p-1 rounded font-bold ${fac.surgicalOncologyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Onco Surgery
                    </div>
                  </div>
                </div>
              ))}

              {filteredFacilities.length === 0 && (
                <div className="col-span-full bg-slate-950 border border-slate-850 p-8 text-center rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">No specialized cancer clinics or support services matched your search criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
