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
  RefreshCw,
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
  Legend,
} from 'recharts';
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  CareFacilityCompliance,
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
          colorClass: 'text-ok',
          bgClass: 'bg-ok-soft',
          strokeColor: 'oklch(0.65 0.12 155)',
          gradientId: 'colorPlacementTrend',
          unit: '%',
          icon: CheckCircle2,
        };
      case 'daysWaitingP50':
        return {
          label: 'Median Wait Days to Placement',
          description:
            'Historical trend of median (P50) wait times (days) from assessment to continuing care admission (Calgary and Edmonton Zone average). Lower is better.',
          colorClass: 'text-accent',
          bgClass: 'bg-accent-soft',
          strokeColor: 'oklch(0.68 0.13 252)',
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
      <div className="space-y-4 p-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-neutral-chip" />
          <div className="mt-2 h-3 w-1/2 rounded bg-neutral-chip" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-line bg-surface p-4">
              <div className="h-3 w-1/2 rounded bg-neutral-chip" />
              <div className="mt-2 h-8 w-1/3 rounded bg-neutral-chip" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Failed to load continuing care data: {error}</span>
        </div>
        <button
          onClick={() => refresh()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <DashboardHeader
        icon={Building2}
        title="Continuing & Long Term Care"
        description="Monitor facility placement timelines, quality outcomes, and standards compliance."
        metadata={metadata}
        arrayKey="CONTINUING_CARE_PLACEMENT_STATS"
        variant="light"
      >
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="self-start rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 md:self-auto"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {/* Sub-Tab Navigation — placement | resident-quality | compliance only */}
      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
        <button
          onClick={() => setActiveSubTab('placement')}
          className={`rounded-md px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSubTab === 'placement'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Placement & Flow</span>
        </button>
        <button
          onClick={() => setActiveSubTab('resident-quality')}
          className={`rounded-md px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSubTab === 'resident-quality'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical Quality</span>
        </button>
        <button
          onClick={() => setActiveSubTab('compliance')}
          className={`rounded-md px-4 py-2 text-xs font-medium transition-colors flex items-center gap-2 ${
            activeSubTab === 'compliance'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
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
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="h-6 w-6 text-warn" />
              <span>No placement timeline data available</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  className={`cursor-pointer space-y-1 rounded-xl border bg-surface p-4 text-left transition-all hover:border-line-2 ${
                    selectedKpi === 'pctPlacedWithin30Days'
                      ? 'border-ok bg-ok-soft'
                      : 'border-line'
                  }`}
                >
                  <span className="block text-xs font-medium text-ink-3">
                    Avg Placement Within 30 Days
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-ok">
                      {formatOptional(placementKpis.within30, { suffix: '%', empty: '—' })}
                    </span>
                    <span className="text-xs font-medium font-mono text-ink-2">Target: 60%+</span>
                  </div>
                  <p className="border-t border-line pt-1 text-xs text-ink-2">
                    Share of assessed patients placed into continuing care within 30 days
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="flex items-center gap-1 pt-1.5 text-[10px] font-medium text-ok transition-colors">
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
                  className={`space-y-1 rounded-xl border bg-surface p-4 text-left transition-all ${
                    hasWaitDayData
                      ? `cursor-pointer hover:border-line-2 ${
                          selectedKpi === 'daysWaitingP50'
                            ? 'border-accent bg-accent-soft'
                            : 'border-line'
                        }`
                      : 'border-line opacity-90'
                  }`}
                >
                  <span className="block text-xs font-medium text-ink-3">
                    Median Wait Days (Calgary & Edmonton)
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-ink">
                      {placementKpis.waitP50 === null
                        ? 'N/A'
                        : `${placementKpis.waitP50.toFixed(0)} days`}
                    </span>
                    <span className="text-xs font-medium font-mono text-ink-2">P50 benchmark</span>
                  </div>
                  <p className="border-t border-line pt-1 text-xs text-ink-2">
                    {hasWaitDayData
                      ? 'Median days from assessment to continuing care admission when wait data is reported.'
                      : 'Wait-day values are not available in the current upstream feed.'}
                  </p>
                  <div className="flex items-center gap-1 pt-1.5 text-[10px] font-medium text-accent">
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

                <div className="space-y-1 rounded-xl border border-line bg-surface p-4">
                  <span className="block text-xs font-medium text-ink-3">
                    Preferred Option Placement Rate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-ok">
                      {formatOptional(placementKpis.preferred, { suffix: '%', empty: '—' })}
                    </span>
                    <span className="text-xs font-medium font-mono text-ink-2">Target: 70%+</span>
                  </div>
                  <p className="border-t border-line pt-1 text-xs text-ink-2">
                    Share of placements into the resident&apos;s preferred living option
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="flex items-center gap-1 pt-1.5 text-[10px] font-medium text-ink-3">
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
                    <div className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
                      <div className="flex flex-col justify-between gap-4 border-b border-line pb-3 sm:flex-row sm:items-center">
                        <div className="space-y-1">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                            {React.createElement(selectedKpiDetails.icon, {
                              className: `h-4 w-4 ${selectedKpiDetails.colorClass}`,
                            })}
                            <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                          </h3>
                          <p className="max-w-3xl text-xs leading-relaxed text-ink-2">
                            {selectedKpiDetails.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-paper p-3 sm:grid-cols-4">
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="block text-xs font-medium text-ink-3">
                            Baseline (2021)
                          </span>
                          <span className="text-xl font-semibold font-mono tabular-nums text-ink">
                            {kpiStats.baseline}
                            {kpiStats.baseline !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="block text-xs font-medium text-ink-3">
                            Current (2025)
                          </span>
                          <span className="text-xl font-semibold font-mono tabular-nums text-ink">
                            {kpiStats.latest}
                            {kpiStats.latest !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="block text-xs font-medium text-ink-3">
                            Peak
                          </span>
                          <span
                            className={`text-xl font-semibold font-mono tabular-nums ${selectedKpiDetails.colorClass}`}
                          >
                            {kpiStats.peak}
                            {kpiStats.peak !== 'N/A' ? selectedKpiDetails.unit : ''}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="block text-xs font-medium text-ink-3">
                            Overall Shift
                          </span>
                          {kpiStats.hasDelta ? (
                            <span
                              className={`flex items-center justify-center gap-1 text-xs font-semibold sm:justify-start ${
                                kpiStats.isIncrease ? 'text-crit' : 'text-ok'
                              }`}
                            >
                              {kpiStats.isIncrease ? (
                                <TrendingUp className="h-4 w-4 shrink-0" />
                              ) : (
                                <TrendingDown className="h-4 w-4 shrink-0" />
                              )}
                              <span>
                                {kpiStats.delta}
                                {selectedKpiDetails.unit} ({kpiStats.pctChange})
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-ink-3">N/A</span>
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
                            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                            <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                            <YAxis stroke="oklch(0.62 0.02 255)" fontSize={10} unit={selectedKpiDetails.unit} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'oklch(0.2 0.022 255)',
                                border: '1px solid oklch(0.28 0.02 255)',
                                borderRadius: '8px',
                              }}
                              itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                              labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Placement Chart */}
                <div className="space-y-4 rounded-xl border border-line bg-surface p-5 lg:col-span-2">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-ink-2">
                        Wait times & Placement Timelines
                      </h3>
                      <p className="text-xs text-ink-3">
                        Tracking median (P50) and 90th percentile (P90) wait times from assessment
                        to placement
                      </p>
                    </div>

                    <div className="relative">
                      <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-ink focus:border-accent focus:outline-none"
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
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-ink-3">
                      <AlertTriangle className="h-5 w-5 text-warn" />
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
                              <stop offset="5%" stopColor="oklch(0.75 0.14 25)" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="oklch(0.75 0.14 25)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.65 0.12 155)" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="oklch(0.65 0.12 155)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                          <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                          <YAxis
                            label={{
                              value: 'Days',
                              angle: -90,
                              position: 'insideLeft',
                              fill: 'oklch(0.62 0.02 255)',
                              fontSize: 10,
                            }}
                            stroke="oklch(0.62 0.02 255)"
                            fontSize={9}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'oklch(0.2 0.022 255)',
                              border: '1px solid oklch(0.28 0.02 255)',
                              borderRadius: '8px',
                            }}
                            itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                            labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Area
                            type="monotone"
                            dataKey="daysWaitingP90"
                            name="90th Percentile Wait (Days)"
                            stroke="oklch(0.75 0.14 25)"
                            fillOpacity={1}
                            fill="url(#colorP90)"
                            strokeWidth={2}
                            connectNulls={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="daysWaitingP50"
                            name="Median Wait (Days)"
                            stroke="oklch(0.65 0.12 155)"
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
                <div className="flex flex-col justify-between rounded-xl border border-line bg-surface p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-2">
                      Flow & Preferred Options
                    </h3>
                    <p className="text-xs text-ink-3">
                      Evaluating percent placed into preferred facilities
                    </p>
                  </div>

                  <div className="space-y-4">
                    {filteredPlacementData.length === 0 ? (
                      <div className="rounded-xl border border-line bg-paper p-3 text-xs text-ink-3">
                        No placement rows match the selected zone.
                      </div>
                    ) : (
                      filteredPlacementData.map((item, idx) => (
                        <div
                          key={idx}
                          className="space-y-2.5 rounded-xl border border-line bg-paper p-3"
                        >
                          <div className="flex items-center justify-between text-xs font-medium text-ink">
                            <span>
                              {item.zone} ({item.year})
                            </span>
                            <span className="rounded border border-line bg-ok-soft px-1.5 py-0.5 font-mono text-xs text-ok">
                              P50:{' '}
                              {item.daysWaitingP50 === null || item.daysWaitingP50 === undefined
                                ? 'N/A'
                                : `${item.daysWaitingP50}d`}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs text-ink-2">
                              <span>Placed in 30 days:</span>
                              <span className="font-medium text-ink">
                                {typeof item.pctPlacedWithin30Days === 'number'
                                  ? `${item.pctPlacedWithin30Days}%`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
                              <div
                                className="h-full bg-ok"
                                style={{
                                  width: `${
                                    typeof item.pctPlacedWithin30Days === 'number'
                                      ? Math.min(Math.max(item.pctPlacedWithin30Days, 0), 100)
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>

                            <div className="flex justify-between text-xs text-ink-2">
                              <span>Preferred option met:</span>
                              <span className="font-medium text-ink">
                                {typeof item.pctPlacedPreferredOption === 'number'
                                  ? `${item.pctPlacedPreferredOption}%`
                                  : 'N/A'}
                              </span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
                              <div
                                className="h-full bg-accent"
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

                  <div className="flex items-start gap-1.5 border-t border-line pt-3 text-xs text-ink-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
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
          <DataTimestamp compact variant="light" metadata={metadata} arrayKey="RESIDENT_QUALITY_OUTCOMES" />
          {qualityOutcomes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="h-6 w-6 text-warn" />
              <span>No resident quality outcome data available</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-ink-2">
                    CIHI Clinical Care Quality Indicators
                  </h3>
                  <p className="text-xs text-ink-3">
                    Comparative safety and effectiveness outcomes across Alberta facilities
                  </p>
                </div>

                <div className="relative">
                  <select
                    value={qualityMetricSelected}
                    onChange={(e) => setQualityMetricSelected(e.target.value)}
                    className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
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

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Outcomes Chart */}
                <div className="space-y-4 rounded-xl border border-line bg-surface p-5 lg:col-span-2">
                  <h4 className="text-sm font-semibold text-ink-2">
                    Long-Term Resident Quality Prevalence (%)
                  </h4>

                  {filteredQualityData.length === 0 ? (
                    <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-ink-3">
                      <AlertTriangle className="h-5 w-5 text-warn" />
                      <span>No quality rows match the selected metric.</span>
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={filteredQualityData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                          <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                          <YAxis
                            label={{
                              value: 'Rate %',
                              angle: -90,
                              position: 'insideLeft',
                              fill: 'oklch(0.62 0.02 255)',
                              fontSize: 10,
                            }}
                            stroke="oklch(0.62 0.02 255)"
                            fontSize={9}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'oklch(0.2 0.022 255)',
                              border: '1px solid oklch(0.28 0.02 255)',
                              borderRadius: '8px',
                            }}
                            itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                            labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar
                            dataKey="albertaRatePct"
                            name="Alberta Prevalence Rate"
                            fill="oklch(0.65 0.12 155)"
                            radius={[4, 4, 0, 0]}
                          />
                          <Bar
                            dataKey="canadaRatePct"
                            name="Canadian National Average"
                            fill="oklch(0.62 0.02 255)"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Quality Summary list */}
                <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
                  <h4 className="text-sm font-semibold text-ink-2">
                    Quality Benchmarks Breakdown
                  </h4>

                  <div className="space-y-3.5">
                    {filteredQualityData.length === 0 ? (
                      <div className="rounded-xl border border-line bg-paper p-3 text-xs text-ink-3">
                        No quality metrics to display.
                      </div>
                    ) : (
                      filteredQualityData.map((item, idx) => (
                        <div
                          key={idx}
                          className="space-y-2 rounded-xl border border-line bg-paper p-4"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-ink">{item.metric}</span>
                            <Award className="h-4 w-4 shrink-0 text-ok" />
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-ink-2">
                            <div>
                              <span>Alberta ({item.year}):</span>
                              <p className="text-lg font-semibold text-ok">
                                {typeof item.albertaRatePct === 'number'
                                  ? `${item.albertaRatePct}%`
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span>Canada ({item.year}):</span>
                              <p className="text-lg font-semibold text-ink-2">
                                {typeof item.canadaRatePct === 'number'
                                  ? `${item.canadaRatePct}%`
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>
                          {item.directionIsLowerBetter && (
                            <div className="text-[10px] italic text-ink-3">
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
          <DataTimestamp compact variant="light" metadata={metadata} arrayKey="CONTINUING_CARE_COMPLIANCE" />
          {!data?.CONTINUING_CARE_COMPLIANCE || data.CONTINUING_CARE_COMPLIANCE.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="h-6 w-6 text-warn" />
              <span>No compliance data available</span>
            </div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-4 md:flex-row md:items-center">
                <div className="flex flex-wrap gap-2">
                  {['All', 'AHS', 'Covenant Health', 'Private/Contracted', 'Non-Profit'].map(
                    (operator) => (
                      <button
                        key={operator}
                        onClick={() => setOperatorFilter(operator)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          operatorFilter === operator
                            ? 'border-accent bg-accent text-white'
                            : 'border-line-2 text-ink-2 hover:bg-paper'
                        }`}
                      >
                        {operator}
                      </button>
                    )
                  )}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-3" />
                  <input
                    type="text"
                    placeholder="Search facility, city, or zone..."
                    value={complianceSearch}
                    onChange={(e) => setComplianceSearch(e.target.value)}
                    className="w-full rounded-lg border border-line bg-paper py-2 pl-9 pr-3 text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface p-5 md:grid-cols-4">
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-ink-3">
                    Monitored Facilities
                  </span>
                  <span className="text-xl font-semibold text-ink">
                    {aggregateStats.totalFacilities} sites audited
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-ink-3">
                    Accommodation Standards Pass
                  </span>
                  <span className="text-xl font-semibold text-ok">
                    {aggregateStats.complianceRate === null
                      ? 'N/A'
                      : `${aggregateStats.complianceRate.toFixed(1)}% compliant`}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-ink-3">
                    Total standards violations
                  </span>
                  <span className="text-xl font-semibold text-crit">
                    {aggregateStats.totalViolations} violations found
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="block text-xs font-medium text-ink-3">
                    Auditing schedule
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    Quarterly (Alberta Open Government data)
                  </span>
                </div>
              </div>

              {/* Compliance List Grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCompliance.map((fac) => {
                  return (
                    <div
                      key={fac.id}
                      className="flex flex-col justify-between rounded-xl border border-line bg-surface p-4 space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="truncate text-sm font-semibold text-ink">{fac.name}</h4>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {fac.city}
                                {fac.zone ? ` · ${fac.zone}` : ', Alberta'}
                              </span>
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded border px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                              fac.standardsCompliant
                                ? 'border-line bg-ok-soft text-ok'
                                : 'border-line bg-crit-soft text-crit'
                            }`}
                          >
                            {fac.standardsCompliant ? 'Compliant' : 'Violation'}
                          </span>
                        </div>

                        <div className="space-y-2 rounded-lg border border-line bg-paper p-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-ink-3">Facility Type:</span>
                            <span className="truncate font-medium text-ink">{fac.type}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-ink-3">Operator:</span>
                            <span className="font-medium text-ink">{fac.operator}</span>
                          </div>
                          {fac.zone && (
                            <div className="flex justify-between">
                              <span className="text-ink-3">Zone:</span>
                              <span className="font-medium text-ink">{fac.zone}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-ink-3">Inspection:</span>
                            <span className="font-medium text-ink-2">
                              {fac.lastInspectionDate}
                            </span>
                          </div>
                        </div>

                        {!fac.standardsCompliant && fac.majorViolationsDesc && (
                          <div className="flex items-start gap-1.5 rounded-lg border border-line bg-crit-soft p-2.5">
                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-crit" />
                            <p className="text-[10px] font-medium leading-normal text-crit">
                              {fac.majorViolationsDesc}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between border-t border-line pt-2 text-[10px]">
                        <span className="flex items-center gap-1 text-ink-3">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{fac.violationsCount} infractions logged</span>
                        </span>

                        <a
                          href="https://standardsandlicensing.alberta.ca"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg bg-accent px-3 py-1.5 text-center text-xs font-semibold text-white transition-colors hover:bg-accent-strong"
                        >
                          Verify Status
                        </a>
                      </div>
                    </div>
                  );
                })}

                {filteredCompliance.length === 0 && (
                  <div className="col-span-full rounded-xl border border-line bg-surface p-8 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-warn" />
                    <p className="text-xs text-ink-3">
                      No audited facilities matched your search parameters.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-4 text-xs leading-relaxed text-ink-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p>
                  Data source:{' '}
                  <a
                    href="https://open.alberta.ca/dataset/2003f13d-33ad-4d3f-865d-0d9488ace84d"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Alberta Open Government — Continuing Care Accommodation Standards compliance
                    reporting
                  </a>{' '}
                  (OGL-A licensed, updated quarterly). Each facility is aggregated from per-visit
                  monitoring records dating back to April 2013;{' '}
                  <strong className="text-ink">violationsCount</strong> reflects only
                  open/unresolved non-compliances. For real-time inspection results, search the{' '}
                  <a
                    href="https://standardsandlicensing.alberta.ca"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
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
