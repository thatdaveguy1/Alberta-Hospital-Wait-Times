import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Droplet, 
  ShieldCheck, 
  AlertTriangle, 
  Flame, 
  Wind, 
  Info, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Search, 
  Layers, 
  HeartPulse, 
  CheckCircle2, 
  FileSpreadsheet, 
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Dna,
  BarChart2,
  X,
  TrendingDown,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import type {
  RespiratoryVirusMetric,
  WastewaterSignal,
  ImmunizationCoverage,
  NotifiableDiseaseIncidence,
  EnvironmentalAdvisory,
  OutbreakGuidelines
} from '../publicHealthData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type PublicHealthData = {
  RESPIRATORY_VIRUS_SURVEILLANCE: RespiratoryVirusMetric[];
  WASTEWATER_SIGNALS: WastewaterSignal[];
  CHILDHOOD_IMMUNIZATION_COVERAGE: ImmunizationCoverage[];
  NOTIFIABLE_DISEASE_INCIDENCE: NotifiableDiseaseIncidence[];
  ENVIRONMENTAL_ADVISORIES: EnvironmentalAdvisory[];
  OUTBREAK_PROTOCOLS: Record<string, OutbreakGuidelines>;
};

export default function PublicHealthDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<PublicHealthData>('public-health');
  const [activeSubTab, setActiveSubTab] = useState<'respiratory' | 'wastewater' | 'notifiable' | 'immunization' | 'advisories'>('respiratory');
  
  // Filter States
  const [selectedSeason, setSelectedSeason] = useState<string>('2025-2026');
  const [wastewaterSearch, setWastewaterSearch] = useState<string>('');
  const [diseaseFilter, setDiseaseFilter] = useState<string>('Pertussis (Whooping Cough)');
  const [immunizationZone, setImmunizationZone] = useState<string>('All');
  const [selectedProtocolSetting, setSelectedProtocolSetting] = useState<string>('Acute Care Wards');
  const [advisoryTypeFilter, setAdvisoryTypeFilter] = useState<string>('All');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [selectedDiseaseKpi, setSelectedDiseaseKpi] = useState<'pertussis' | 'measles' | 'salmonellosis' | 'hepatitisC' | null>(null);

  const covidTrends = useMemo(() => (data?.RESPIRATORY_VIRUS_SURVEILLANCE ?? []).filter(r => r.virus === 'COVID-19'), [data]);
  const fluATrends = useMemo(() => (data?.RESPIRATORY_VIRUS_SURVEILLANCE ?? []).filter(r => r.virus === 'Influenza A'), [data]);
  const rsvTrends = useMemo(() => (data?.RESPIRATORY_VIRUS_SURVEILLANCE ?? []).filter(r => r.virus === 'RSV'), [data]);
  const icuTrends = useMemo(() => {
    return ['2024-2025', '2025-2026'].map(season => ({
      season,
      icuAdmissions: (data?.RESPIRATORY_VIRUS_SURVEILLANCE ?? []).filter(r => r.season === season).reduce((sum, r) => sum + r.icuAdmissions, 0)
    }));
  }, [data]);
  // Respiratory data filtration
  const filteredRespiratoryData = useMemo(() => {
    return (data?.RESPIRATORY_VIRUS_SURVEILLANCE ?? []).filter(r => r.season === selectedSeason);
  }, [selectedSeason, data]);

  // Wastewater plant filtration
  const filteredWastewater = useMemo(() => {
    return (data?.WASTEWATER_SIGNALS ?? []).filter(w =>
      w.site.toLowerCase().includes(wastewaterSearch.toLowerCase()) ||
      w.zone.toLowerCase().includes(wastewaterSearch.toLowerCase())
    );
  }, [wastewaterSearch, data]);

  // Notifiable disease data filtration
  const filteredDiseases = useMemo(() => {
    // Show either the trend over years for selected disease (Alberta aggregated)
    // or the breakdown by Zone for year 2025.
    return (data?.NOTIFIABLE_DISEASE_INCIDENCE ?? []).filter(d => d.disease === diseaseFilter);
  }, [diseaseFilter, data]);

  // Notifiable disease KPI card configuration and trend data
  const diseaseKpiConfigs = useMemo(() => ({
    pertussis: { label: 'Pertussis (Whooping Cough)', disease: 'Pertussis (Whooping Cough)' as const, shortLabel: 'Pertussis', colorClass: 'text-rose-400', bgClass: 'bg-rose-500/10', borderClass: 'border-rose-500/20', strokeColor: '#f43f5e', gradientId: 'colorPertussisTrend', icon: ShieldAlert, blurb: 'Vaccine-preventable resurgence driven by DTaP-IPV-Hib coverage deficits.' },
    measles: { label: 'Measles', disease: 'Measles' as const, shortLabel: 'Measles', colorClass: 'text-amber-400', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/20', strokeColor: '#f59e0b', gradientId: 'colorMeaslesTrend', icon: AlertTriangle, blurb: 'Imported exposures gaining traction as MMR Dose 1 coverage falls below herd immunity.' },
    salmonellosis: { label: 'Salmonellosis', disease: 'Salmonellosis' as const, shortLabel: 'Salmonellosis', colorClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/20', strokeColor: '#3b82f6', gradientId: 'colorSalmonellosisTrend', icon: Activity, blurb: 'Enteric disease burden tracked via mandatory lab-confirmed case reporting.' },
    hepatitisC: { label: 'Hepatitis C (Acute/Chronic)', disease: 'Hepatitis C (Acute/Chronic)' as const, shortLabel: 'Hepatitis C', colorClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/20', strokeColor: '#a78bfa', gradientId: 'colorHepatitisCTrend', icon: Dna, blurb: 'Chronic blood-borne infection incidence monitored under provincial reporting mandates.' }
  }), []);

  const diseaseKpiLatest = useMemo(() => {
    return (Object.keys(diseaseKpiConfigs) as Array<keyof typeof diseaseKpiConfigs>).reduce((acc, key) => {
      const cfg = diseaseKpiConfigs[key];
      const albertaRecords = (data?.NOTIFIABLE_DISEASE_INCIDENCE ?? [])
        .filter(d => d.disease === cfg.disease && d.zone === 'Alberta')
        .sort((a, b) => a.year.localeCompare(b.year));
      acc[key] = albertaRecords[albertaRecords.length - 1] || null;
      return acc;
    }, {} as Record<keyof typeof diseaseKpiConfigs, NotifiableDiseaseIncidence | null>);
  }, [diseaseKpiConfigs, data]);

  const diseaseKpiTrend = useMemo(() => {
    if (!selectedDiseaseKpi) return null;
    const cfg = diseaseKpiConfigs[selectedDiseaseKpi];
    return (data?.NOTIFIABLE_DISEASE_INCIDENCE ?? [])
      .filter(d => d.disease === cfg.disease && d.zone === 'Alberta')
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [selectedDiseaseKpi, diseaseKpiConfigs, data]);

  const diseaseKpiStats = useMemo(() => {
    if (!selectedDiseaseKpi || !diseaseKpiTrend || diseaseKpiTrend.length === 0) return null;
    const rates = diseaseKpiTrend.map(r => r.ratePer100k);
    const cases = diseaseKpiTrend.map(r => r.casesCount);
    const baseline = rates[0];
    const latest = rates[rates.length - 1];
    const peak = Math.max(...rates);
    const totalCases = cases.reduce((s, c) => s + c, 0);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;
    return {
      baseline: baseline.toFixed(1),
      latest: latest.toFixed(1),
      peak: peak.toFixed(1),
      totalCases: totalCases.toLocaleString(),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(1)}` : rawDelta.toFixed(1),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0,
      firstYear: diseaseKpiTrend[0].year,
      lastYear: diseaseKpiTrend[diseaseKpiTrend.length - 1].year
    };
  }, [selectedDiseaseKpi, diseaseKpiTrend]);

  // Immunization coverage data filtration
  const filteredImmunization = useMemo(() => {
    if (immunizationZone === 'All') {
      return (data?.CHILDHOOD_IMMUNIZATION_COVERAGE ?? []).filter(imm => imm.zone !== 'Alberta');
    }
    return (data?.CHILDHOOD_IMMUNIZATION_COVERAGE ?? []).filter(imm => imm.zone === immunizationZone);
  }, [immunizationZone, data]);

  // Environmental advisories filtration
  const filteredAdvisories = useMemo(() => {
    if (advisoryTypeFilter === 'All') return data?.ENVIRONMENTAL_ADVISORIES ?? [];
    return (data?.ENVIRONMENTAL_ADVISORIES ?? []).filter(adv => adv.type === advisoryTypeFilter);
  }, [advisoryTypeFilter, data]);

  // Computed Stats
  const activeAdvisoriesCount = (data?.ENVIRONMENTAL_ADVISORIES ?? []).filter(a => a.status === 'Active').length;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading public health data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load public health data: {error}</span>
        <button
          onClick={() => refresh()}
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
      <DashboardHeader
        icon={ShieldAlert}
        title="Public Health & Surveillance"
        description="Track respiratory viruses, wastewater pathogen loads, and immunization rates."
        metadata={metadata}
        arrayKey="RVD_RESPIRATORY_CASE_COUNTS"
      />

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('respiratory')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'respiratory'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Respiratory Viruses</span>
        </button>
        <button
          onClick={() => setActiveSubTab('wastewater')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'wastewater'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Wastewater Signals</span>
        </button>
        <button
          onClick={() => setActiveSubTab('immunization')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'immunization'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Childhood Immunization</span>
        </button>
      </div>

      {/* Warning Narrative Chain */}
      <div id="ph-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert className="w-4.5 h-4.5 text-indigo-400" />
            <span>Community Prevention & Pathogen Transmission Dynamics</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            Declining childhood immunization coverage sets a vulnerable demographic baseline, leading directly to 
            preventable communicable outbreaks (such as Pertussis). These outbreaks, paired with high seasonal respiratory 
            positivity rates, trigger acute-care unit closures and add critical bottleneck pressures onto regional emergency departments.
          </p>
        </div>
        <span className="text-[9px] bg-indigo-950/40 border border-indigo-500/25 text-indigo-400 px-2 py-1 rounded font-mono font-extrabold shrink-0">
          PROVINCIAL HEALTH INDEX
        </span>
      </div>

      {/* SUBTAB 1: Respiratory Virus Burden */}
      {activeSubTab === 'respiratory' && (
        <div id="ph-respiratory-subtab" className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="RESPIRATORY_VIRUS_SURVEILLANCE" />
          {/* Top-line Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => setExpandedCard(expandedCard === 'covid' ? null : 'covid')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-rose-500/50 ${
                expandedCard === 'covid' ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">COVID-19 Positivity Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-400">12.3%</span>
                <span className="text-[10px] text-slate-400">Peak Season: 14.8%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850 font-medium">
                SARS-CoV-2 positivity remains a persistent year-round bed occupancy driver in hospital wards. Click to view trend.
              </p>
              {expandedCard === 'covid' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={covidTrends} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="season" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Bar dataKey="positivityRatePct" name="Positivity %" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>

            <button
              onClick={() => setExpandedCard(expandedCard === 'flua' ? null : 'flua')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-amber-500/50 ${
                expandedCard === 'flua' ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Influenza A Positivity Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-500">9.8%</span>
                <span className="text-[10px] text-slate-400">Peak Season: 11.2%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850 font-medium">
                Dominant winter seasonal flu driver triggering critical care alerts across multiple zones. Click to view trend.
              </p>
              {expandedCard === 'flua' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={fluATrends} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="season" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Bar dataKey="positivityRatePct" name="Positivity %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>

            <button
              onClick={() => setExpandedCard(expandedCard === 'rsv' ? null : 'rsv')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-indigo-500/50 ${
                expandedCard === 'rsv' ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">RSV Lab Positive Prevalence</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-400">7.2%</span>
                <span className="text-[10px] text-slate-400">Peak Season: 8.5%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850 font-medium">
                Presents high clinical severity risks for pediatric emergency services and neonatal ICU capacities. Click to view trend.
              </p>
              {expandedCard === 'rsv' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rsvTrends} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="season" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Bar dataKey="positivityRatePct" name="Prevalence %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>

            <button
              onClick={() => setExpandedCard(expandedCard === 'icu' ? null : 'icu')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-red-500/50 ${
                expandedCard === 'icu' ? 'border-red-500 ring-1 ring-red-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Seasonal Respiratory ICU Burden</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-red-500">245 cases</span>
                <span className="text-[10px] text-slate-400">2025-2026 Season</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850 font-medium">
                Total critical ICU respiratory admissions requiring ventilation or supportive therapy. Click to view trend.
              </p>
              {expandedCard === 'icu' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={icuTrends} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="season" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Bar dataKey="icuAdmissions" name="ICU Admissions" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>
          </div>

          {/* Interactive Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Seasonal Respiratory Burden (Lab Positivity vs Hospitalizations)</h3>
                  <p className="text-[10px] text-slate-500">Comparing active diagnostic testing outcomes and acute admissions</p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setSelectedSeason('2024-2025')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                      selectedSeason === '2024-2025' 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2024-2025 Peak
                  </button>
                  <button
                    onClick={() => setSelectedSeason('2025-2026')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                      selectedSeason === '2025-2026' 
                        ? 'bg-indigo-600 text-white' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2025-2026 Current
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredRespiratoryData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="virus" stroke="#64748b" fontSize={10} />
                    <YAxis yAxisId="left" label={{ value: 'Positivity Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Hospital Admissions', angle: 90, position: 'insideRight', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="positivityRatePct" name="Lab Positivity Rate (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="hospitalizations" name="Acute Care Admissions" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pathogen Clinical Outcomes */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Pathogen Severity Indices</h3>
                <p className="text-[10px] text-slate-500">Evaluating critical care ICU allocations and risk profiles</p>
              </div>

              <div className="space-y-3">
                {filteredRespiratoryData.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{item.virus}</span>
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                        {item.season}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>
                        <span>Lab Positivity:</span>
                        <p className="text-sm font-black text-indigo-400">{item.positivityRatePct}%</p>
                      </div>
                      <div>
                        <span>ICU Admissions:</span>
                        <p className="text-sm font-black text-rose-400">{item.icuAdmissions} ICU</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>AHS Surveillance Standard:</strong> Seasonal virus reporting utilizes provincial sentinel laboratories and random clinic swabbing panels.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Wastewater Pathogen Signal */}
      {activeSubTab === 'wastewater' && (
        <div id="ph-wastewater-subtab" className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="WASTEWATER_SIGNALS" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Wastewater Early Warning Pathogen Logs</h3>
              <p className="text-[10px] text-slate-500">Unbiased non-clinical monitoring of virus viral loads inside sewer networks</p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search wastewater site or zone..."
                value={wastewaterSearch}
                onChange={(e) => setWastewaterSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wastewater Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Normalized Pathogen Loads by Treatment Plant (Index)</h4>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredWastewater}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="site" stroke="#64748b" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
                    <YAxis label={{ value: 'Viral Load Signal Index', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="covidSignal" name="COVID-19 Signal" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fluASignal" name="Influenza A Signal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="rsvSignal" name="RSV Signal" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Wastewater Plant Directories */}
            <div className="space-y-4">
              {filteredWastewater.map((plant, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-extrabold text-white">{plant.site}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-600" />
                          <span>{plant.zone} • {plant.populationServed.toLocaleString()} served</span>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold ${
                          plant.activityLevel === 'Very High' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : plant.activityLevel === 'High'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : plant.activityLevel === 'Moderate'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {plant.activityLevel} Load
                        </span>
                        <span className="block text-[8px] text-slate-400 mt-1">{plant.trend} Trend</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-850 text-center">
                      <div className="p-1 bg-slate-950/40 rounded">
                        <span className="text-[8px] text-slate-500 block uppercase">COVID</span>
                        <span className="text-xs font-black text-indigo-400">{plant.covidSignal}</span>
                      </div>
                      <div className="p-1 bg-slate-950/40 rounded">
                        <span className="text-[8px] text-slate-500 block uppercase">Flu A</span>
                        <span className="text-xs font-black text-amber-500">{plant.fluASignal}</span>
                      </div>
                      <div className="p-1 bg-slate-950/40 rounded">
                        <span className="text-[8px] text-slate-500 block uppercase">RSV</span>
                        <span className="text-xs font-black text-pink-500">{plant.rsvSignal}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Notifiable Infectious Diseases */}
      {activeSubTab === 'notifiable' && (
        <div id="ph-notifiable-subtab" className="space-y-6 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Notifiable Infectious Disease Trends</h3>
              <p className="text-[10px] text-slate-500">Tracking legally-mandated disease incidence spikes across Alberta Health regions</p>
            </div>

            <div className="flex flex-wrap gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {['Pertussis (Whooping Cough)', 'Measles', 'Salmonellosis', 'Hepatitis C (Acute/Chronic)'].map(disease => (
                <button
                  key={disease}
                  onClick={() => setDiseaseFilter(disease as any)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                    diseaseFilter === disease
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {disease.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
          {/* Notifiable Disease KPI Cards - Click to View Trend */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(diseaseKpiConfigs) as Array<keyof typeof diseaseKpiConfigs>).map(key => {
              const cfg = diseaseKpiConfigs[key];
              const latest = diseaseKpiLatest[key];
              const isActive = selectedDiseaseKpi === key;
              return (
                <div
                  key={key}
                  id={`metric-disease-${String(key)}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDiseaseKpi(isActive ? null : key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDiseaseKpi(isActive ? null : key);
                    }
                  }}
                  className={`p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 border select-none hover:scale-[1.02] hover:shadow-xl ${
                    isActive
                      ? `bg-slate-900/90 ${cfg.borderClass.replace('/20', '/50')} ring-1 ${cfg.borderClass.replace('/20', '/30')}`
                      : 'bg-slate-900/60 border-slate-800 hover:' + cfg.borderClass.replace('/20', '/30')
                  }`}
                >
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{cfg.shortLabel}</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black font-mono ${cfg.colorClass}`}>{latest ? latest.ratePer100k.toFixed(1) : '—'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">per 100k</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block leading-tight">
                      {latest ? `${latest.casesCount.toLocaleString()} cases (${latest.year})` : 'No data'}
                    </span>
                    <span className="text-[9px] text-slate-500 group-hover:text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
                      <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                      {isActive ? 'Active: Hide Trend' : 'Click to View Trend'}
                    </span>
                  </div>
                  <div className={`p-3 rounded-lg ${cfg.bgClass} ${cfg.colorClass} shrink-0 border ${cfg.borderClass} group-hover:scale-110 transition-transform duration-300`}>
                    <cfg.icon className="w-5 h-5" />
                  </div>
                  <div className={`absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l ${cfg.bgClass.replace('/10', '/100')} to-slate-900 rounded-bl`} />
                </div>
              );
            })}
          </div>

          {/* Notifiable Disease KPI Trend Explorer Panel */}
          <AnimatePresence mode="wait">
            {selectedDiseaseKpi && diseaseKpiTrend && diseaseKpiStats && (
              <motion.div
                key={`disease-kpi-trend-${selectedDiseaseKpi}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-6 shadow-xl relative">
                  <button
                    onClick={() => setSelectedDiseaseKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        {React.createElement(diseaseKpiConfigs[selectedDiseaseKpi].icon, {
                          className: `w-4 h-4 ${diseaseKpiConfigs[selectedDiseaseKpi].colorClass}`
                        })}
                        <span>{diseaseKpiConfigs[selectedDiseaseKpi].label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {diseaseKpiConfigs[selectedDiseaseKpi].blurb} Annual Alberta-aggregated incidence rate per 100,000 population.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline ({diseaseKpiStats.firstYear})</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{diseaseKpiStats.baseline}<span className="text-[10px] text-slate-500 ml-0.5">/100k</span></span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current ({diseaseKpiStats.lastYear})</span>
                      <span className="text-xl font-black text-white font-mono">{diseaseKpiStats.latest}<span className="text-[10px] text-slate-500 ml-0.5">/100k</span></span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Peak Rate</span>
                      <span className={`text-xl font-black font-mono ${diseaseKpiConfigs[selectedDiseaseKpi].colorClass}`}>{diseaseKpiStats.peak}<span className="text-[10px] text-slate-500 ml-0.5">/100k</span></span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                        diseaseKpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        {diseaseKpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{diseaseKpiStats.delta} ({diseaseKpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={diseaseKpiTrend} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={diseaseKpiConfigs[selectedDiseaseKpi].gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={diseaseKpiConfigs[selectedDiseaseKpi].strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={diseaseKpiConfigs[selectedDiseaseKpi].strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                          labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                          itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="ratePer100k"
                          name="Incidence Rate per 100k"
                          stroke={diseaseKpiConfigs[selectedDiseaseKpi].strokeColor}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill={`url(#${diseaseKpiConfigs[selectedDiseaseKpi].gradientId})`}
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
            {/* Diseases Trends */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">{diseaseFilter} Trend Analysis</h4>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={filteredDiseases}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate per 100,000', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="ratePer100k" name="Incidence Rate per 100k" stroke="#ef4444" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="casesCount" name="Total Case Count" stroke="#6366f1" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pathogen Clinical Analysis */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Outbreak Spikes & Focus Areas</h3>
                <p className="text-[10px] text-slate-500">Critical pathogen concerns in current reporting cycle</p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[9px] text-rose-400 font-mono font-bold uppercase block">South Zone Pertussis Spike</span>
                  <p className="text-xs text-white font-bold">Incidence Rate: 67.4 per 100k</p>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    In 2025, South Alberta observed an unprecedented pertussis (whooping cough) resurgence of 215 cases, heavily driven by localized immunisation coverage deficits.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[9px] text-amber-500 font-mono font-bold uppercase block">Measles Susceptibility Alert</span>
                  <p className="text-xs text-white font-bold">18 Lab-Confirmed Cases (2025)</p>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Due to declining MMR Dose 1 coverage rates falling below herd immunity levels, imported measles exposures now present high transmission risks.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>MOH Legal Directive:</strong> Notifiable diseases require instant reporting from clinical physicians and diagnostic labs within 24 hours of presumptive identification.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Childhood Immunization Gap */}
      {activeSubTab === 'immunization' && (
        <div id="ph-immunization-subtab" className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="CHILDHOOD_IMMUNIZATION_COVERAGE" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Childhood Immunization Coverage Gap (Age 2)</h3>
              <p className="text-[10px] text-slate-500">Tracking current vaccination coverage ratios against herd-immunity thresholds</p>
            </div>

            <div className="relative">
              <select
                value={immunizationZone}
                onChange={(e) => setImmunizationZone(e.target.value)}
                className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="All">Compare All Zones</option>
                <option value="Calgary Zone">Calgary Zone</option>
                <option value="Edmonton Zone">Edmonton Zone</option>
                <option value="Central Zone">Central Zone</option>
                <option value="North Zone">North Zone</option>
                <option value="South Zone">South Zone</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Immunization Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Vaccine Coverage Rates vs. Herd Immunity Target (95%)</h4>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredImmunization}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="zone" stroke="#64748b" fontSize={10} />
                    <YAxis domain={[0, 100]} label={{ value: 'Coverage Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="coverageRatePct" name="Actual Coverage (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="targetPct" name="Herd Immunity Target (%)" fill="#1e293b" stroke="#6366f1" strokeDasharray="3 3" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Immunization breakdown card list */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Herd Immunity Exposure Risk</h3>
                <p className="text-[10px] text-slate-500">Identifying vulnerable regions failing safety targets</p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">North Zone Vulnerability</span>
                    <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded font-mono">
                      High Risk
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>DTaP-IPV-Hib Coverage:</span>
                      <strong className="text-rose-400">68.5%</strong>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div className="bg-rose-500 h-full" style={{ width: '68.5%' }} />
                    </div>
                    <p className="text-[9px] text-slate-500 italic mt-0.5">Below herd immunity margins. Extreme risk of pertussis cluster formation.</p>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Central Zone Vulnerability</span>
                    <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono">
                      Moderate Risk
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Measles-Containing Coverage:</span>
                      <strong className="text-amber-400">76.2%</strong>
                    </div>
                    <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: '76.2%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>
                  <strong>AIP Strategy:</strong> The Alberta Immunization Policy requires proactive childhood health clinic outreach programs to bridge regional coverage gaps.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Environmental Health Advisories */}
      {activeSubTab === 'advisories' && (
        <div id="ph-advisories-subtab" className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="OUTBREAK_PROTOCOLS" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Cyanobacteria (Blue-Green Algae)', 'Air Quality Advisory', 'Boil Water Advisory', 'Water Quality Advisory'].map(type => (
                <button
                  key={type}
                  onClick={() => setAdvisoryTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    advisoryTypeFilter === type
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type === 'All' ? 'All Advisories' : type.split(' ')[0]}
                </button>
              ))}
            </div>

            <div className="text-xs bg-slate-950/60 border border-slate-850 px-3.5 py-2 rounded-xl text-slate-400 font-mono flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping shrink-0" />
              <strong>{activeAdvisoriesCount} active public health advisories</strong>
            </div>
          </div>

          {/* Advisories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredAdvisories.map(adv => (
              <div key={adv.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{adv.location}</h4>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span>{adv.zone}</span>
                      </p>
                    </div>

                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase shrink-0">
                      {adv.status}
                    </span>
                  </div>

                  <div className="space-y-1 p-2.5 bg-slate-950/60 border border-slate-850 rounded-lg">
                    <span className="text-[8px] text-indigo-400 font-extrabold uppercase block">{adv.type}</span>
                    <p className="text-[10px] text-slate-300 font-medium leading-normal">{adv.issueDescription}</p>
                  </div>

                  <div className="p-2.5 bg-amber-950/10 border border-amber-500/10 rounded text-[10px] text-amber-300 leading-normal flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p>{adv.precautionaryMeasures}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-850/60 text-[9px] text-slate-500 text-right">
                  Declared: {adv.dateDeclared}
                </div>
              </div>
            ))}

            {filteredAdvisories.length === 0 && (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No public health advisories matched your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OUTBREAK CLINICAL PROTOCOLS MODULE (Static Lookout) */}
      <div id="ph-outbreak-protocols" className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-850">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <Layers className="w-4.5 h-4.5 text-indigo-400" />
              <span>AHS Infection Prevention & Control Outbreak Manual</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Required trigger thresholds and containment strategies under the Public Health Act.</p>
          </div>

          <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
            {['Acute Care Wards', 'Continuing Care Homes', 'Supportive Living / Shelter'].map(setting => (
              <button
                key={setting}
                onClick={() => setSelectedProtocolSetting(setting)}
                className={`px-3 py-1 rounded text-[10px] font-bold ${
                  selectedProtocolSetting === setting
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {setting}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">1. Outbreak Declaration Trigger</span>
            <p className="text-xs font-medium text-white leading-relaxed">
              {data?.OUTBREAK_PROTOCOLS[selectedProtocolSetting].triggerThreshold}
            </p>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">2. Isolation & Cohorting Protocols</span>
            <p className="text-xs font-medium text-white leading-relaxed">
              {data?.OUTBREAK_PROTOCOLS[selectedProtocolSetting].isolationProtocol}
            </p>
          </div>

          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">3. Antiviral / Prophylaxis Strategy</span>
            <p className="text-xs font-medium text-white leading-relaxed">
              {data?.OUTBREAK_PROTOCOLS[selectedProtocolSetting].antiviralPolicy}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
