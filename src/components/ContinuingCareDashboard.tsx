import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MapPin,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Info,
  Activity,
  Award,
  Clock,
  ShieldAlert,
  Building2,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  CareFacilityCompliance
} from '../continuingCareData';
import * as continuingCareData from '../continuingCareData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type ContinuingCareData = {
  CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[];
  RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[];
  CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[];
};

type PlacementKpiKey = 'daysWaitingP50' | 'pctPlacedWithin30Days';

function avgNumeric(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && !isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function formatOptional(value: number | null, opts: { digits?: number; suffix?: string; empty?: string } = {}): string {
  const { digits = 1, suffix = '', empty = 'N/A' } = opts;
  if (value === null || Number.isNaN(value)) return empty;
  return `${value.toFixed(digits)}${suffix}`;
}

export default function ContinuingCareDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<ContinuingCareData>('continuing-care', continuingCareData);
  const [activeSubTab, setActiveSubTab] = useState<'placement' | 'resident-quality' | 'compliance'>('placement');

  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<PlacementKpiKey | null>(null);

  // Normalize placement stats: treat daysWaitingP50/P90 == 0 as missing (null) so the chart
  // does not draw a misleading flat line across years without real wait-time data.
  const placementStats = useMemo(() => {
    return (data?.CONTINUING_CARE_PLACEMENT_STATS ?? []).map((r) => ({
      ...r,
      daysWaitingP50: r.daysWaitingP50 === 0 || r.daysWaitingP50 === undefined ? null : r.daysWaitingP50,
      daysWaitingP90: r.daysWaitingP90 === 0 || r.daysWaitingP90 === undefined ? null : r.daysWaitingP90,
    }));
  }, [data]);

  const hasWaitDayData = useMemo(
    () => placementStats.some((r) => r.daysWaitingP50 != null || r.daysWaitingP90 != null),
    [placementStats]
  );

  // Drop daysWaitingP50 selection when no non-null wait values exist
  useEffect(() => {
    if (!hasWaitDayData && selectedKpi === 'daysWaitingP50') {
      setSelectedKpi(null);
    }
  }, [hasWaitDayData, selectedKpi]);

  const qualityOutcomes = useMemo(
    () => data?.RESIDENT_QUALITY_OUTCOMES ?? [],
    [data]
  );

  const availableQualityMetrics = useMemo(() => {
    return Array.from(new Set(qualityOutcomes.map((q) => q.metric))).sort();
  }, [qualityOutcomes]);

  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [operatorFilter, setOperatorFilter] = useState<string>('All');
  const [complianceSearch, setComplianceSearch] = useState<string>('');
  const [qualityMetricSelected, setQualityMetricSelected] = useState<string>('All');

  // Reset quality filter if selected metric is no longer present in data
  useEffect(() => {
    if (
      qualityMetricSelected !== 'All' &&
      !availableQualityMetrics.includes(qualityMetricSelected)
    ) {
      setQualityMetricSelected('All');
    }
  }, [availableQualityMetrics, qualityMetricSelected]);

  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    if (selectedKpi === 'daysWaitingP50' && !hasWaitDayData) return null;

    const yearlyData = ['2021', '2023', '2025'].map((y) => {
      const records = placementStats.filter(
        (r) => r.year === y && (r.zone === 'Calgary Zone' || r.zone === 'Edmonton Zone')
      );
      return avgNumeric(records.map((r) => r[selectedKpi]));
    });

    const present = yearlyData.filter((v): v is number => v !== null);
    if (present.length === 0) return null;

    const baseline = yearlyData[0];
    const latest = yearlyData[yearlyData.length - 1];
    const peak = Math.max(...present);
    const rawDelta =
      baseline !== null && latest !== null ? latest - baseline : null;
    const pctChange =
      baseline !== null && baseline !== 0 && rawDelta !== null
        ? (rawDelta / baseline) * 100
        : null;

    return {
      baseline: formatOptional(baseline),
      latest: formatOptional(latest),
      peak: formatOptional(peak),
      delta:
        rawDelta === null
          ? 'N/A'
          : rawDelta > 0
            ? `+${rawDelta.toFixed(1)}`
            : rawDelta.toFixed(1),
      pctChange:
        pctChange === null
          ? 'N/A'
          : pctChange > 0
            ? `+${pctChange.toFixed(1)}%`
            : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta !== null ? rawDelta > 0 : false,
      hasDelta: rawDelta !== null,
    };
  }, [selectedKpi, placementStats, hasWaitDayData]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    if (selectedKpi === 'daysWaitingP50' && !hasWaitDayData) return null;
    switch (selectedKpi) {
      case 'pctPlacedWithin30Days':
        return {
          label: 'Average Placement within 30 Days',
          description:
            'Historical trend of patients placed into continuing care facilities within 30 days of their clinical assessment (Calgary and Edmonton Zone average). Target is 60% or higher.',
          colorClass: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10',
          strokeColor: '#10b981',
          gradientId: 'colorPlacementTrend',
          unit: '%',
          icon: CheckCircle2,
        };
      case 'daysWaitingP50':
        return {
          label: 'Median Wait Days to Placement',
          description:
            'Historical trend of median (P50) wait times (days) from assessment to continuing care admission (Calgary and Edmonton Zone average). Lower is better.',
          colorClass: 'text-blue-400',
          bgClass: 'bg-blue-500/10',
          strokeColor: '#3b82f6',
          gradientId: 'colorWaitTrend',
          unit: ' Days',
          icon: Clock,
        };
      default:
        return null;
    }
  }, [selectedKpi, hasWaitDayData]);

  const trendData = useMemo(() => {
    if (!selectedKpi) return [];
    if (selectedKpi === 'daysWaitingP50' && !hasWaitDayData) return [];
    return ['2021', '2023', '2025'].map((y) => {
      const records = placementStats.filter(
        (r) => r.year === y && (r.zone === 'Calgary Zone' || r.zone === 'Edmonton Zone')
      );
      const val = avgNumeric(records.map((r) => r[selectedKpi]));
      // null (not 0) when no real values — chart leaves a gap rather than fabricating zero
      return { year: y, value: val };
    });
  }, [selectedKpi, placementStats, hasWaitDayData]);

  const hasTrendPoints = useMemo(
    () => trendData.some((d) => d.value !== null),
    [trendData]
  );

  // Filter Placement Metrics by Zone
  const filteredPlacementData = useMemo(() => {
    if (selectedZone === 'All') {
      return placementStats;
    }
    return placementStats.filter((p) => p.zone === selectedZone);
  }, [selectedZone, placementStats]);

  // Filter Quality Metrics — only metrics present in upstream data
  const filteredQualityData = useMemo(() => {
    if (qualityMetricSelected === 'All') return qualityOutcomes;
    return qualityOutcomes.filter((q) => q.metric === qualityMetricSelected);
  }, [qualityMetricSelected, qualityOutcomes]);

  // Filter Compliance Directory
  const filteredCompliance = useMemo(() => {
    return (data?.CONTINUING_CARE_COMPLIANCE ?? []).filter((fac) => {
      const matchesOperator = operatorFilter === 'All' || fac.operator === operatorFilter;
      const matchesSearch =
        fac.name.toLowerCase().includes(complianceSearch.toLowerCase()) ||
        fac.city.toLowerCase().includes(complianceSearch.toLowerCase()) ||
        (fac.zone ?? '').toLowerCase().includes(complianceSearch.toLowerCase());
      return matchesOperator && matchesSearch;
    });
  }, [operatorFilter, complianceSearch, data]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const facilities = data?.CONTINUING_CARE_COMPLIANCE ?? [];
    const totalFacilities = facilities.length;
    const compliantCount = facilities.filter((f) => f.standardsCompliant).length;
    const complianceRate = totalFacilities > 0 ? (compliantCount / totalFacilities) * 100 : null;
    const totalViolations = facilities.reduce((acc, curr) => acc + curr.violationsCount, 0);
    return { totalFacilities, complianceRate, totalViolations };
  }, [data]);

  const placementKpis = useMemo(() => {
    const records2025 = placementStats.filter(
      (r) => r.year === '2025' && (r.zone === 'Calgary Zone' || r.zone === 'Edmonton Zone')
    );
    // Fall back to latest year present if 2025 rows are absent
    const years = Array.from(new Set(placementStats.map((r) => r.year))).sort();
    const latestYear = years[years.length - 1];
    const records =
      records2025.length > 0
        ? records2025
        : placementStats.filter(
            (r) =>
              r.year === latestYear &&
              (r.zone === 'Calgary Zone' || r.zone === 'Edmonton Zone')
          );

    return {
      within30: avgNumeric(records.map((r) => r.pctPlacedWithin30Days)),
      preferred: avgNumeric(records.map((r) => r.pctPlacedPreferredOption)),
      waitP50: avgNumeric(records.map((r) => r.daysWaitingP50)),
      labelYear: records2025.length > 0 ? '2025' : latestYear ?? null,
    };
  }, [placementStats]);

  const placementZones = useMemo(() => {
    return Array.from(new Set(placementStats.map((p) => p.zone))).sort();
  }, [placementStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading continuing care data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load continuing care data: {error}</span>
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
      {/* Header */}
      <DashboardHeader
        icon={Building2}
        title="Continuing & Long Term Care"
        description="Monitor facility placement timelines, quality outcomes, and standards compliance."
        metadata={metadata}
        arrayKey="CONTINUING_CARE_PLACEMENT_STATS"
      />

      {/* Sub-Tab Navigation — placement | resident-quality | compliance only */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('placement')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'placement'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Placement & Flow</span>
        </button>
        <button
          onClick={() => setActiveSubTab('resident-quality')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'resident-quality'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical Quality</span>
        </button>
        <button
          onClick={() => setActiveSubTab('compliance')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'compliance'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Compliance Registry</span>
        </button>
      </div>

      {/* SUBTAB 1: Placement & Flow (HQCA FOCUS) */}
      {activeSubTab === 'placement' && (
        <div className="space-y-6">
          {placementStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>No placement timeline data available</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  tabIndex={0}
                  onClick={() =>
                    setSelectedKpi(
                      selectedKpi === 'pctPlacedWithin30Days' ? null : 'pctPlacedWithin30Days'
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedKpi(
                        selectedKpi === 'pctPlacedWithin30Days' ? null : 'pctPlacedWithin30Days'
                      );
                    }
                  }}
                  className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-emerald-500/50 ${
                    selectedKpi === 'pctPlacedWithin30Days'
                      ? 'border-emerald-500 ring-1 ring-emerald-500/30 font-medium'
                      : 'border-slate-800'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Avg Placement Within 30 Days
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-400">
                      {formatOptional(placementKpis.within30, { suffix: '%', empty: '—' })}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Target: 60%+</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    Share of assessed patients placed into continuing care within 30 days
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-emerald-400/80 group-hover:text-emerald-400 transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>
                      {selectedKpi === 'pctPlacedWithin30Days'
                        ? 'Active: Hide Trend'
                        : 'Click to View Trend'}
                    </span>
                  </div>
                </div>

                <div
                  tabIndex={hasWaitDayData ? 0 : undefined}
                  onClick={() => {
                    if (!hasWaitDayData) return;
                    setSelectedKpi(selectedKpi === 'daysWaitingP50' ? null : 'daysWaitingP50');
                  }}
                  onKeyDown={(e) => {
                    if (!hasWaitDayData) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedKpi(selectedKpi === 'daysWaitingP50' ? null : 'daysWaitingP50');
                    }
                  }}
                  className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 transition-all ${
                    hasWaitDayData
                      ? `cursor-pointer hover:border-blue-500/50 ${
                          selectedKpi === 'daysWaitingP50'
                            ? 'border-blue-500 ring-1 ring-blue-500/30'
                            : 'border-slate-800'
                        }`
                      : 'border-slate-800 opacity-90'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Median Wait Days (Calgary & Edmonton)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">
                      {placementKpis.waitP50 === null
                        ? 'N/A'
                        : `${placementKpis.waitP50.toFixed(0)} days`}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">P50 benchmark</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    {hasWaitDayData
                      ? 'Median days from assessment to continuing care admission when wait data is reported.'
                      : 'Wait-day values are not available in the current upstream feed.'}
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-blue-400/80">
                    <BarChart2 className="w-3 h-3" />
                    <span>
                      {!hasWaitDayData
                        ? 'No trend data'
                        : selectedKpi === 'daysWaitingP50'
                          ? 'Active: Hide Trend'
                          : 'Click to View Trend'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Preferred Option Placement Rate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-teal-400">
                      {formatOptional(placementKpis.preferred, { suffix: '%', empty: '—' })}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Target: 70%+</span>
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                    Share of placements into the resident&apos;s preferred living option
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-bold text-slate-500">
                    <span>No Trend Data Available</span>
                  </div>
                </div>
              </div>

              {/* Trend Panel */}
              <AnimatePresence mode="wait">
                {selectedKpi && selectedKpiDetails && kpiStats && hasTrendPoints && (
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
                              className: `w-4 h-4 ${selectedKpiDetails.colorClass}`,
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
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Baseline (2021)
                          </span>
                          <span className="text-xl font-black text-slate-300 font-mono">
                            {kpiStats.baseline}
                            {kpiStats.baseline !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Current (2025)
                          </span>
                          <span className="text-xl font-black text-white font-mono">
                            {kpiStats.latest}
                            {kpiStats.latest !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Peak
                          </span>
                          <span
                            className={`text-xl font-black font-mono ${selectedKpiDetails.colorClass}`}
                          >
                            {kpiStats.peak}
                            {kpiStats.peak !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            Overall Shift
                          </span>
                          {kpiStats.hasDelta ? (
                            <span
                              className={`text-xs font-extrabold flex items-center justify-center sm:justify-start gap-1 ${
                                kpiStats.isIncrease ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                            >
                              {kpiStats.isIncrease ? (
                                <TrendingUp className="w-4 h-4 shrink-0" />
                              ) : (
                                <TrendingDown className="w-4 h-4 shrink-0" />
                              )}
                              <span>
                                {kpiStats.delta}
                                {selectedKpiDetails.unit} ({kpiStats.pctChange})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs font-extrabold text-slate-500">N/A</span>
                          )}
                        </div>
                      </div>

                      <div className="h-60 mt-3 pt-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={trendData}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id={selectedKpiDetails.gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={selectedKpiDetails.strokeColor}
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={selectedKpiDetails.strokeColor}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                            <YAxis stroke="#64748b" fontSize={10} unit={selectedKpiDetails.unit} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderColor: '#1e293b',
                                fontSize: 11,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              name={selectedKpiDetails.label}
                              stroke={selectedKpiDetails.strokeColor}
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill={`url(#${selectedKpiDetails.gradientId})`}
                              dot={{ r: 4, strokeWidth: 1 }}
                              connectNulls={false}
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
                {/* Placement Chart */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Wait times & Placement Timelines
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        Tracking median (P50) and 90th percentile (P90) wait times from assessment
                        to placement
                      </p>
                    </div>

                    <div className="relative">
                      <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="All">All zones</option>
                        {placementZones.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {!hasWaitDayData ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <span>No wait-day values reported for the selected data.</span>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filteredPlacementData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                          <YAxis
                            label={{
                              value: 'Days',
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
                          <Area
                            type="monotone"
                            dataKey="daysWaitingP90"
                            name="90th Percentile Wait (Days)"
                            stroke="#ef4444"
                            fillOpacity={1}
                            fill="url(#colorP90)"
                            strokeWidth={2}
                            connectNulls={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="daysWaitingP50"
                            name="Median Wait (Days)"
                            stroke="#10b981"
                            fillOpacity={1}
                            fill="url(#colorP50)"
                            strokeWidth={2.5}
                            connectNulls={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Core indicators summary */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Flow & Preferred Options
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Evaluating percent placed into preferred facilities
                    </p>
                  </div>

                  <div className="space-y-4">
                    {filteredPlacementData.length === 0 ? (
                      <div className="text-xs text-slate-500 p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        No placement rows match the selected zone.
                      </div>
                    ) : (
                      filteredPlacementData.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2.5"
                        >
                          <div className="flex justify-between items-center text-xs font-bold text-white">
                            <span>
                              {item.zone} ({item.year})
                            </span>
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                              P50:{' '}
                              {item.daysWaitingP50 === null || item.daysWaitingP50 === undefined
                                ? 'N/A'
                                : `${item.daysWaitingP50}d`}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Placed in 30 days:</span>
                              <span className="font-semibold text-slate-200">
                                {typeof item.pctPlacedWithin30Days === 'number'
                                  ? `${item.pctPlacedWithin30Days}%`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full"
                                style={{
                                  width: `${
                                    typeof item.pctPlacedWithin30Days === 'number'
                                      ? Math.min(Math.max(item.pctPlacedWithin30Days, 0), 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>

                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Preferred option met:</span>
                              <span className="font-semibold text-slate-200">
                                {typeof item.pctPlacedPreferredOption === 'number'
                                  ? `${item.pctPlacedPreferredOption}%`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                              <div
                                className="bg-teal-500 h-full"
                                style={{
                                  width: `${
                                    typeof item.pctPlacedPreferredOption === 'number'
                                      ? Math.min(Math.max(item.pctPlacedPreferredOption, 0), 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 flex items-start gap-1.5">
                    <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>
                      Placement percentages come from HQCA FOCUS continuing-care placement
                      statistics. Wait days show N/A when the upstream series does not report them.
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB 2: Resident quality outcomes (CIHI LTC Indicators) */}
      {activeSubTab === 'resident-quality' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="RESIDENT_QUALITY_OUTCOMES" />
          {qualityOutcomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>No resident quality outcome data available</span>
            </div>
          ) : (
            <>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    CIHI Clinical Care Quality Indicators
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Comparative safety and effectiveness outcomes across Alberta facilities
                  </p>
                </div>

                <div className="relative">
                  <select
                    value={qualityMetricSelected}
                    onChange={(e) => setQualityMetricSelected(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="All">All Quality Indicators</option>
                    {availableQualityMetrics.map((metric) => (
                      <option key={metric} value={metric}>
                        {metric}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Outcomes Chart */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">
                    Long-Term Resident Quality Prevalence (%)
                  </h4>

                  {filteredQualityData.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <span>No quality rows match the selected metric.</span>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={filteredQualityData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                          <YAxis
                            label={{
                              value: 'Rate %',
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
                          <Bar
                            dataKey="albertaRatePct"
                            name="Alberta Prevalence Rate"
                            fill="#10b981"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="canadaRatePct"
                            name="Canadian National Average"
                            fill="#475569"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Quality Summary list */}
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">
                    Quality Benchmarks Breakdown
                  </h4>

                  <div className="space-y-3.5">
                    {filteredQualityData.length === 0 ? (
                      <div className="text-xs text-slate-500 p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                        No quality metrics to display.
                      </div>
                    ) : (
                      filteredQualityData.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white">{item.metric}</span>
                            <Award className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                            <div>
                              <span>Alberta ({item.year}):</span>
                              <p className="text-lg font-bold text-emerald-400">
                                {typeof item.albertaRatePct === 'number'
                                  ? `${item.albertaRatePct}%`
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span>Canada ({item.year}):</span>
                              <p className="text-lg font-bold text-slate-400">
                                {typeof item.canadaRatePct === 'number'
                                  ? `${item.canadaRatePct}%`
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                          {item.directionIsLowerBetter && (
                            <div className="text-[9px] text-slate-500 italic">
                              Lower rates represent safer care plans for this indicator.
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB 3: Compliance Registry (Open Alberta) */}
      {activeSubTab === 'compliance' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata} arrayKey="CONTINUING_CARE_COMPLIANCE" />
          {!data?.CONTINUING_CARE_COMPLIANCE || data.CONTINUING_CARE_COMPLIANCE.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-sm gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500" />
              <span>No compliance data available</span>
            </div>
          ) : (
            <>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  {['All', 'AHS', 'Covenant Health', 'Private/Contracted', 'Non-Profit'].map(
                    (operator) => (
                      <button
                        key={operator}
                        onClick={() => setOperatorFilter(operator)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          operatorFilter === operator
                            ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                            : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {operator}
                      </button>
                    )
                  )}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search facility, city, or zone..."
                    value={complianceSearch}
                    onChange={(e) => setComplianceSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Monitored Facilities
                  </span>
                  <span className="text-xl font-bold text-white">
                    {aggregateStats.totalFacilities} sites audited
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Accommodation Standards Pass
                  </span>
                  <span className="text-xl font-bold text-emerald-400">
                    {aggregateStats.complianceRate === null
                      ? 'N/A'
                      : `${aggregateStats.complianceRate.toFixed(1)}% compliant`}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Total standards violations
                  </span>
                  <span className="text-xl font-bold text-rose-400">
                    {aggregateStats.totalViolations} violations found
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    Auditing schedule
                  </span>
                  <span className="text-sm font-bold text-slate-300">
                    Quarterly (Alberta Open Government data)
                  </span>
                </div>
              </div>

              {/* Compliance List Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCompliance.map((fac) => {
                  return (
                    <div
                      key={fac.id}
                      className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">{fac.name}</h4>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              <span className="truncate">
                                {fac.city}
                                {fac.zone ? ` · ${fac.zone}` : ', Alberta'}
                              </span>
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${
                              fac.standardsCompliant
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}
                          >
                            {fac.standardsCompliant ? 'COMPLIANT' : 'VIOLATION'}
                          </span>
                        </div>

                        <div className="space-y-2 text-[10px] bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Facility Type:</span>
                            <span className="font-semibold text-slate-300 truncate">{fac.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Operator:</span>
                            <span className="font-semibold text-slate-300">{fac.operator}</span>
                          </div>
                          {fac.zone && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Zone:</span>
                              <span className="font-semibold text-slate-300">{fac.zone}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Inspection:</span>
                            <span className="font-semibold text-slate-400">
                              {fac.lastInspectionDate}
                            </span>
                          </div>
                        </div>

                        {!fac.standardsCompliant && fac.majorViolationsDesc && (
                          <div className="bg-rose-950/30 border border-rose-500/20 rounded p-2.5 flex items-start gap-1.5">
                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-rose-300 font-medium leading-normal">
                              {fac.majorViolationsDesc}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-[10px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{fac.violationsCount} infractions logged</span>
                        </span>

                        <a
                          href="https://standardsandlicensing.alberta.ca"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold px-3 py-1.5 rounded-lg bg-emerald-650 hover:bg-emerald-600 text-white transition-all text-center"
                        >
                          Verify Status
                        </a>
                      </div>
                    </div>
                  );
                })}

                {filteredCompliance.length === 0 && (
                  <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">
                      No audited facilities matched your search parameters.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-start gap-2.5 text-[10px] text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <p>
                  Data source:{' '}
                  <a
                    href="https://open.alberta.ca/dataset/2003f13d-33ad-4d3f-865d-0d9488ace84d"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Alberta Open Government — Continuing Care Accommodation Standards compliance
                    reporting
                  </a>{' '}
                  (OGL-A licensed, updated quarterly). Each facility is aggregated from per-visit
                  monitoring records dating back to April 2013;{' '}
                  <strong className="text-slate-300">violationsCount</strong> reflects only
                  open/unresolved non-compliances. For real-time inspection results, search the{' '}
                  <a
                    href="https://standardsandlicensing.alberta.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    standardsandlicensing.alberta.ca
                  </a>{' '}
                  portal.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
