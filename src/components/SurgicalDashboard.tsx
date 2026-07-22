import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Clock, 
  Building2, 
  Sparkles, 
  TrendingUp, 
  BarChart3, 
  TrendingDown,
  AlertTriangle,
  BarChart2
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
  Area
} from 'recharts';
import type {
  SurgicalRecord,
  JointWaitRecord,
  HistoricalTrend,
} from '../surgicalData';
import * as surgicalData from '../surgicalData';
import {
  dedupeLatestMedians,
  findMatchingP90,
  parseBenchmarkWeeks,
  pctOfBenchmark,
  pickLatestProvincialRecord,
  toWeeks,
  unitAbbr,
  unitDisplayLabel,
} from '../lib/surgicalWaitSelection';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type SurgicalData = {
  SURGICAL_RECORDS: SurgicalRecord[];
  ORTHOPEDIC_SPECIALTY_RECORDS: JointWaitRecord[];
  HISTORICAL_WAIT_TRENDS: HistoricalTrend[];
  _dataMetadata?: DataMetadataMap;
};

export default function SurgicalDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ortho'>('overview');
  
  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'hip_replacement_median' | 'knee_replacement_median' | 'cataract_surgery_median' | null>(null);
  const { data, metadata, isLoading, error } = useDomainData<SurgicalData>('surgical', surgicalData);
  const SURGICAL_RECORDS = useMemo(() => {
    return (data?.SURGICAL_RECORDS ?? []).filter(
      r => r.procedure_group !== 'Diagnostic Imaging' &&
           !r.procedure_name.includes('MRI') &&
           !r.procedure_name.includes('CT')
    );
  }, [data]);
  const ORTHOPEDIC_SPECIALTY_RECORDS = data?.ORTHOPEDIC_SPECIALTY_RECORDS ?? [];
  const rawHistoricalTrends = data?.HISTORICAL_WAIT_TRENDS ?? [];
  const HISTORICAL_WAIT_TRENDS = useMemo(() => {
    if (!rawHistoricalTrends || rawHistoricalTrends.length === 0) return [];
    // If the data is already parsed/pivoted, use it directly; otherwise pivot flat rows by year.
    const first = rawHistoricalTrends[0];
    let pivoted: HistoricalTrend[];
    if (first && 'hip_replacement_median' in first) {
      pivoted = rawHistoricalTrends as unknown as HistoricalTrend[];
    } else {
      const map = new Map<string, Partial<HistoricalTrend>>();
      for (const rawItem of rawHistoricalTrends) {
        const item = rawItem as unknown as { year: string; procedure: string; medianWaitDays: number };
        const year = item.year;
        if (!year) continue;
        let entry = map.get(year);
        if (!entry) {
          entry = { year };
          map.set(year, entry);
        }
        const days = item.medianWaitDays || 0;
        const weeks = Number((days / 7).toFixed(1));
        switch (item.procedure) {
          case 'Hip Replacement':
            entry.hip_replacement_median = weeks;
            break;
          case 'Knee Replacement':
            entry.knee_replacement_median = weeks;
            break;
          case 'Cataract Surgery':
            entry.cataract_surgery_median = weeks;
            break;
          case 'MRI Scan':
            entry.mri_scan_median = weeks;
            break;
          case 'CT Scan':
            entry.ct_scan_median = weeks;
            break;
        }
      }
      pivoted = Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year)) as HistoricalTrend[];
    }
    // Exclude pre-2009 points (e.g. 2008) from explorer + provincial charts/stats.
    return pivoted
      .filter(t => t.year >= '2009')
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [rawHistoricalTrends]);
  const historicalTrendYearStart = HISTORICAL_WAIT_TRENDS[0]?.year;
  const historicalTrendYearEnd = HISTORICAL_WAIT_TRENDS[HISTORICAL_WAIT_TRENDS.length - 1]?.year;
  const historicalTrendYearSpan =
    historicalTrendYearStart && historicalTrendYearEnd
      ? `${historicalTrendYearStart}–${historicalTrendYearEnd}`
      : null;
  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const series = HISTORICAL_WAIT_TRENDS
      .map(t => ({ year: t.year, value: t[selectedKpi] as number }))
      .filter(p => typeof p.value === 'number');
    if (series.length === 0) return null;

    const baselinePoint = series[0];
    const latestPoint = series[series.length - 1];
    const baseline = baselinePoint.value;
    const latest = latestPoint.value;
    // True trailing window: last up-to-5 observations with values for this KPI.
    const trailingWindow = series.slice(-5);
    const peak = Math.max(...trailingWindow.map(p => p.value));
    const minVal = Math.min(...series.map(p => p.value));
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toFixed(1),
      baselineYear: baselinePoint.year,
      latest: latest.toFixed(1),
      latestYear: latestPoint.year,
      peak: peak.toFixed(1),
      minVal: minVal.toFixed(1),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(1)}` : rawDelta.toFixed(1),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedKpi, HISTORICAL_WAIT_TRENDS]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    const yearRangeCopy = historicalTrendYearSpan
      ? `from ${historicalTrendYearStart} to ${historicalTrendYearEnd}`
      : 'from 2009 through the latest available year';
    switch (selectedKpi) {
      case 'hip_replacement_median':
        return {
          label: 'Total Hip Replacement Median Wait Time',
          description: `Historical trend of hip replacement surgery median wait times (weeks) in Alberta ${yearRangeCopy}. The COVID pandemic and subsequent system strain caused a major spike peaking around 2022, which has only partially resolved.`,
          colorClass: 'text-accent',
          bgClass: 'bg-accent-soft',
          strokeColor: 'oklch(0.68 0.13 252)',
          gradientId: 'colorHipTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'knee_replacement_median':
        return {
          label: 'Total Knee Replacement Median Wait Time',
          description: `Historical trend of knee replacement surgery median wait times (weeks) in Alberta ${yearRangeCopy}. Consistent under-capacity relative to aging demographics remains a primary strain factor.`,
          colorClass: 'text-accent',
          bgClass: 'bg-purple-500/10',
          strokeColor: 'oklch(0.82 0.12 85)',
          gradientId: 'colorKneeTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'cataract_surgery_median':
        return {
          label: 'Cataract Extraction Median Wait Time',
          description: `Historical trend of cataract surgery median wait times (weeks) in Alberta ${yearRangeCopy}. Substantial provincial volume shifts have helped stabilize cataract waits closer to target relative to orthopedics.`,
          colorClass: 'text-ok',
          bgClass: 'bg-ok-soft',
          strokeColor: 'oklch(0.78 0.12 155)',
          gradientId: 'colorCataractTrend',
          unit: ' Wks',
          icon: Sparkles
        };
      default:
        return null;
    }
  }, [selectedKpi, historicalTrendYearSpan, historicalTrendYearStart, historicalTrendYearEnd]);

  const [selectedProcedureGroup, setSelectedProcedureGroup] = useState<string>('Hip Replacement');

  const overviewProcedureCards = useMemo(() => {
    const specs = [
      { procedureName: 'Total Hip Arthroplasty', title: 'Total Hip Replacement', iconColor: 'text-accent', pctClass: 'text-warn' },
      { procedureName: 'Total Knee Arthroplasty', title: 'Total Knee Replacement', iconColor: 'text-accent', pctClass: 'text-warn' },
      { procedureName: 'Cataract Extraction & Lens Implant', title: 'Cataract Extraction', iconColor: 'text-ok', pctClass: 'text-ok' },
      { procedureName: 'Breast Cancer Surgery', title: 'Breast Cancer Surgery', iconColor: 'text-crit', pctClass: 'text-crit', subtitle: 'Breast Cancer 90th percentile' },
    ] as const;
    return specs.map(spec => {
      const record = pickLatestProvincialRecord(SURGICAL_RECORDS, spec.procedureName, '90th percentile');
      const wait = record?.metric_value ?? null;
      const unit = record?.unit ?? 'weeks';
      const target = parseBenchmarkWeeks(record?.benchmark_value);
      const pctOfTarget =
        wait != null ? pctOfBenchmark(wait, unit, record?.benchmark_value) : null;
      return {
        ...spec,
        wait,
        unit,
        unitLabel: unitDisplayLabel(unit),
        target,
        pctOfTarget,
        benchmarkLabel: record?.benchmark_value,
      };
    });
  }, [SURGICAL_RECORDS]);
  const specialtyWaitPanels = useMemo(() => {
    const sourceLabel = (source: string) => {
      if (source.includes('Power BI')) return 'AHS Power BI';
      if (source.includes('Wait Times')) return 'AHS Registry';
      if (source.includes('CIHI')) return 'CIHI';
      return source;
    };

    const provincialMedians = dedupeLatestMedians(SURGICAL_RECORDS);

    const buildRow = (rec: SurgicalRecord) => {
      const p90 = findMatchingP90(SURGICAL_RECORDS, rec);
      const median = rec.metric_value > 0 ? rec.metric_value : null;
      const pctOfBench =
        median != null ? pctOfBenchmark(median, rec.unit, rec.benchmark_value) : null;
      const status: 'within' | 'over' | 'unknown' =
        pctOfBench == null ? 'unknown' : pctOfBench <= 100 ? 'within' : 'over';
      const medianWeeks = median != null ? toWeeks(median, rec.unit) : null;

      return {
        id: rec.id ?? `${rec.procedure_name}-${rec.wait_segment}`,
        procedure: rec.procedure_name,
        median,
        medianWeeks,
        unitAbbr: unitAbbr(rec.unit),
        p90: p90 && p90.metric_value > 0 ? p90.metric_value : null,
        benchmark: rec.benchmark_value ?? null,
        pctOfBench,
        status,
        source: sourceLabel(rec.source_name),
      };
    };

    const byLongest = (
      a: ReturnType<typeof buildRow>,
      b: ReturnType<typeof buildRow>,
    ) => (b.medianWeeks ?? -1) - (a.medianWeeks ?? -1);

    return {
      wait2: provincialMedians.map(buildRow).sort(byLongest),
    };
  }, [SURGICAL_RECORDS]);

  // Get active joint replacement records
  const orthopedicData = ORTHOPEDIC_SPECIALTY_RECORDS.filter(
    item => item.procedure === selectedProcedureGroup
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-ink-2 text-sm">
        Loading surgical data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ink-2 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-warn" />
        <span>Failed to load surgical data: {error}</span>
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
        metadata={metadata ?? undefined}
        arrayKey="SURGICAL_RECORDS"
        variant="light"
      />

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-line flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Provincial Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ortho')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ortho'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Orthopedics & Historical Trends</span>
        </button>


      </div>

      {/* --- SUB-TAB: PROVINCIAL OVERVIEW --- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {overviewProcedureCards.map((card) => {
              const trendKey =
                card.procedureName === 'Total Hip Arthroplasty'
                  ? 'hip_replacement_median'
                  : card.procedureName === 'Total Knee Arthroplasty'
                    ? 'knee_replacement_median'
                    : card.procedureName === 'Cataract Extraction & Lens Implant'
                      ? 'cataract_surgery_median'
                      : null;
              const waitLabel = card.wait != null ? `${card.wait} ${card.unitLabel}` : '—';
              const targetFooter =
                card.target != null
                  ? `National Target: ${card.target} Wks`
                  : card.benchmarkLabel
                    ? `Target: ${card.benchmarkLabel}`
                    : 'Target: —';
              const pctFooter =
                card.pctOfTarget != null
                  ? card.procedureName === 'Cataract Extraction & Lens Implant' && card.pctOfTarget <= 100
                    ? `${card.pctOfTarget}% (Within Target)`
                    : `${card.pctOfTarget}% of Target`
                  : card.procedureName === 'Breast Cancer Surgery'
                    ? 'High Priority Flow'
                    : '—';

              if (card.procedureName === 'Breast Cancer Surgery') {
                return (
                  <div key={card.procedureName} className="bg-surface border border-line rounded-xl p-4 space-y-2 relative overflow-hidden group">
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-ink-2 font-semibold">Oncology Fast-Track</span>
                      <Activity className="w-3.5 h-3.5 text-crit" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold text-ink">{waitLabel}</div>
                      <div className="text-[10px] text-ink-2">{card.subtitle ?? 'Breast Cancer 90th percentile'}</div>
                    </div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2">
                      <span>{targetFooter}</span>
                      <span className="text-crit font-semibold">{pctFooter}</span>
                    </div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-ink-3">
                      <span>No Trend Data Available</span>
                    </div>
                  </div>
                );
              }

              const isActive = trendKey != null && selectedKpi === trendKey;
              const toggle = () => trendKey && setSelectedKpi(isActive ? null : trendKey);

              if (card.procedureName === 'Total Hip Arthroplasty') {
                return (
                  <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                    className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-accent   bg-surface ' : 'border-line hover:border-accent'}`}>
                    
                    <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">{card.title}</span><Clock className="w-3.5 h-3.5 text-accent" /></div>
                    <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-accent group-hover:text-accent transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                  </div>
                );
              }
              if (card.procedureName === 'Total Knee Arthroplasty') {
                return (
                  <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                    className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-accent   bg-surface ' : 'border-line hover:border-accent'}`}>
                    
                    <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">{card.title}</span><Clock className="w-3.5 h-3.5 text-accent" /></div>
                    <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-accent group-hover:text-accent transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                  </div>
                );
              }
              return (
                <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-ok   bg-surface ' : 'border-line hover:border-ok'}`}>
                  
                  <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">Cataract Extractions</span><Sparkles className="w-3.5 h-3.5 text-ok" /></div>
                  <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                  <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-ok group-hover:text-ok transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                </div>
              );
            })}
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
                <div className="bg-paper border border-line p-4 sm:p-5 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold flex items-center gap-2 text-ink">
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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface p-3 rounded-xl border border-line">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Baseline ({kpiStats.baselineYear})</span>
                      <span className="text-xl font-semibold text-ink font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Current ({kpiStats.latestYear})</span>
                      <span className="text-xl font-semibold text-ink font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">5-Year Peak</span>
                      <span className={`text-xl font-semibold font-mono ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Overall Shift</span>
                      <span className={`text-xs font-semibold flex items-center justify-center sm:justify-start gap-1 ${kpiStats.isIncrease ? 'text-crit' : 'text-ok'}`}>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis stroke="oklch(0.62 0.02 255)" fontSize={10} unit={selectedKpiDetails.unit} />
                        <RechartsTooltip contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }} />
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

          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-sm text-ink mb-1 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-accent" />
                    Provincial Specialty Wait Times
                  </h3>
                  <p className="text-[11px] text-ink-2 leading-normal max-w-2xl">
                    Ready-to-Treat to Treatment (RTT, Wait 2) — from when a specialist deems the patient ready for surgery to the surgery date. Non-cancer surgeries in weeks; cancer surgeries in days.
                  </p>
                </div>
                <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="SURGICAL_RECORDS" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-semibold text-ink">Wait 2 · Ready-to-Treat to Surgery</h4>
                <span className="text-[9px] font-semibold text-ink-3 uppercase tracking-wide">
                  {specialtyWaitPanels.wait2.length} procedures
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-paper border-b border-line text-[10px] text-ink-2">
                      <th className="py-2 px-3 font-semibold">Procedure</th>
                      <th className="py-2 px-3 text-right font-semibold">Median</th>
                      <th className="py-2 px-3 text-right font-semibold">90th</th>
                      <th className="py-2 px-3 font-semibold">Benchmark</th>
                      <th className="py-2 px-3 text-right font-semibold">Median vs Target</th>
                      <th className="py-2 px-3 text-right font-semibold">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {specialtyWaitPanels.wait2.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 px-3 text-center text-[11px] text-ink-3">
                          No provincial Wait 2 median rows available.
                        </td>
                      </tr>
                    ) : (
                      specialtyWaitPanels.wait2.map(row => (
                        <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-paper/70 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-ink text-[12px] leading-snug">{row.procedure}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-ink whitespace-nowrap">
                            {row.median != null ? `${row.median.toFixed(1)} ${row.unitAbbr}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-ink whitespace-nowrap">
                            {row.p90 != null ? `${row.p90.toFixed(1)} ${row.unitAbbr}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-ink-2 whitespace-nowrap">
                            {row.benchmark ?? '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {row.status === 'unknown' || row.pctOfBench == null ? (
                              <span className="text-[10px] text-ink-3">—</span>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  row.status === 'within'
                                    ? 'bg-ok-soft text-ok border border-ok/30'
                                    : row.pctOfBench >= 150
                                      ? 'bg-crit-soft text-crit border border-crit/30'
                                      : 'bg-warn-soft text-warn border border-warn/30'
                                }`}
                              >
                                {row.pctOfBench}%
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <span className="text-[10px] font-semibold text-ink-2">{row.source}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Estimated surgical facility OR utilization directory removed */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm text-ink">Surgical Facilities Directory & Capacity Monitor</h3>
            </div>
            <p className="text-[11px] text-ink-2 leading-relaxed">
              Facility OR utilization rates and CSF partner flags were estimated (not from a published live OR registry feed) and have been removed. Provincial wait-time series remain available from Power BI surgical records when present.
            </p>
          </div>

        </div>
      )}

      {/* --- SUB-TAB: ORTHOPEDICS & HISTORICAL TRENDS --- */}
      {activeSubTab === 'ortho' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                Joint Reconstruction Specialty Registry (ABJHI & IIHO Feeds)
              </h3>
              <p className="text-xs text-ink-2">
                Detailed metrics by geography comparing hip and knee replacement wait segments and historical median values.
              </p>
              <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="ORTHOPEDIC_SPECIALTY_RECORDS" />
              {ORTHOPEDIC_SPECIALTY_RECORDS.length === 0 && (
                <p className="text-[11px] text-warn">No current ABJHI orthopedic rows. Failed scrapes are not treated as fresh data.</p>
              )}
              {ORTHOPEDIC_SPECIALTY_RECORDS.length > 0 && metadata?.ORTHOPEDIC_SPECIALTY_RECORDS?.updateType === 'manual' && (
                <p className="text-[11px] text-warn">ABJHI last scrape did not refresh these rows — treat as stale, not live.</p>
              )}
            </div>

            {/* Procedure toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-paper border border-line rounded-xl">
              <button
                onClick={() => setSelectedProcedureGroup('Hip Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold   transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Hip Replacement'
                    ? 'bg-accent text-ink '
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Hip replacement
              </button>
              <button
                onClick={() => setSelectedProcedureGroup('Knee Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold   transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Knee Replacement'
                    ? 'bg-accent text-ink '
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Knee replacement
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Geo wait times bar chart */}
            <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-xs text-ink mb-1">
                  Active Regional Wait Times (90th Percentile)
                </h4>
                <p className="text-[10px] text-ink-2 mb-4">
                  Shows referral-to-consult (Wait 1) and decision-to-surgery (Wait 2) durations in days by Alberta municipality.
                </p>
              </div>

              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orthopedicData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="geography" tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 9 }} stroke="oklch(0.28 0.02 255)" />
                    <YAxis tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" unit="d" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', pt: 10 }} />
                    <Bar dataKey="consult_wait_days_90th" name="Wait 1: Consult Wait (Days)" fill="oklch(0.68 0.13 252)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="surgery_wait_days_90th" name="Wait 2: Surgery Wait (Days)" fill="oklch(0.82 0.12 85)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ortho side metrics panel */}
            <div className="bg-surface border border-line rounded-xl p-4 space-y-4">
              <div>
                <span className="text-[9px] text-warn font-semibold">Registry Insights</span>
                <h4 className="font-semibold text-sm text-ink mt-0.5">Regional Volume Splits</h4>
                <p className="text-[10px] text-ink-2 leading-normal mt-1">
                  Orthopedic joint waitlists are highly concentrated in urban medical centers. Secondary private/chartered clinics are contracted to perform day-surgery joint reconstructions.
                </p>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {orthopedicData.map((record, idx) => (
                  <div key={idx} className="p-2 bg-paper border border-line rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-ink block">{record.geography}</span>
                      <span className="text-[9px] text-ink-3 font-mono">Completed cases: {record.count_completed}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-accent font-semibold block">{record.longest_10_days} Days</span>
                      <span className="text-[8.5px] text-ink-3 font-semibold">90% Seen Within</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Trends area chart (filtered from 2009) */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5">
            <div className="space-y-1 mb-5">
              <h4 className="font-semibold text-xs text-ink">
                Provincial Wait Trends ({historicalTrendYearSpan ?? '2009–present'})
              </h4>
              <p className="text-[10px] text-ink-2">
                Sourced from <strong>CIHI priority procedure tables</strong>. Traces the median wait time in weeks from {historicalTrendYearStart ?? '2009'} through {historicalTrendYearEnd ?? 'the latest year'}, showing the impact of pandemic delays and subsequent recoveries.
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
                      <stop offset="5%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKnee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCataract" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                  <XAxis dataKey="year" tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" />
                  <YAxis tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" unit="w" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
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


    </div>
  );
}

// Simple CN helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
