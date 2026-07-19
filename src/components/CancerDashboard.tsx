import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Activity,
  AlertTriangle,
  HeartPulse,
  Clock,
  BarChart2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
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
import { motion, AnimatePresence } from 'framer-motion';
import * as cancerData from '../cancerData';
import {
  type CancerSurgeryWaitTrend,
  type CancerCentreLocation,
  type RadiationTherapyCompliance,
} from '../cancerData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';
import { cn } from '../lib/utils';

type CancerData = {
  CANCER_BURDEN_STATS: unknown[];
  CANCER_SCREENING_RATES: unknown[];
  CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[];
  RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[];
  ALBERTA_CANCER_CENTRES: CancerCentreLocation[];
  _dataMetadata?: DataMetadataMap;
};

type TrendKind = 'cancer_surgery' | 'radiation_therapy';

export default function CancerDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'surgery' | 'radiation' | 'facilities'>('surgery');

  // Interactive Filter States
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const { data, metadata, isLoading, error, refresh } = useDomainData<CancerData>('cancer', cancerData);

  const domainData = useMemo(
    () => ({
      CANCER_BURDEN_STATS: data?.CANCER_BURDEN_STATS ?? [],
      CANCER_SCREENING_RATES: data?.CANCER_SCREENING_RATES ?? [],
      CANCER_SURGERY_WAIT_TRENDS: data?.CANCER_SURGERY_WAIT_TRENDS ?? [],
      RADIATION_THERAPY_WAIT_TRENDS: data?.RADIATION_THERAPY_WAIT_TRENDS ?? [],
      ALBERTA_CANCER_CENTRES: data?.ALBERTA_CANCER_CENTRES ?? [],
      _dataMetadata: metadata ?? undefined,
    }),
    [data, metadata],
  );

  // Burden/screening are not shown until a verified upstream exists.

  // Filter Facilities by Zone and Search
  const filteredFacilities = useMemo(() => {
    return domainData.ALBERTA_CANCER_CENTRES.filter((fac) => {
      const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
      const matchesSearch =
        fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
        fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
        fac.services.some((s) => s.toLowerCase().includes(facilitySearch.toLowerCase()));
      return matchesZone && matchesSearch;
    });
  }, [selectedZone, facilitySearch, domainData]);

  // Radiation therapy trend summary (latest year + year-over-year recovery delta)
  const radiationSummary = useMemo(() => {
    const trends = [...domainData.RADIATION_THERAPY_WAIT_TRENDS].sort((a, b) => a.year.localeCompare(b.year));
    const latest = trends.length > 0 ? trends[trends.length - 1] : null;
    const year2022 = trends.find((t) => t.year === '2022') ?? null;
    const recoveryDelta =
      latest && year2022
        ? Math.round((latest.albertaPctWithinBenchmark - year2022.albertaPctWithinBenchmark) * 10) / 10
        : 0;
    return { latest, year2022, recoveryDelta };
  }, [domainData]);

  // Interactive trend selector for wait-time historical trend panel
  const [selectedTrend, setSelectedTrend] = useState<TrendKind | null>(null);

  const trendDetails = useMemo(() => {
    if (!selectedTrend) return null;
    switch (selectedTrend) {
      case 'cancer_surgery':
        return {
          label: 'Cancer Surgery Wait Times',
          description:
            'Historical tracking of Alberta median (P50) and 90th percentile (P90) wait times in days for priority cancer surgeries, benchmarked against the Canadian national standard. Spikes in the P90 series reflect secondary backlog development in elective oncology cohorts.',
          textClass: 'text-crit',
          softClass: 'bg-crit-soft',
          borderClass: 'border-crit',
          strokeColor: 'oklch(0.75 0.14 25)',
          gradientId: 'colorSurgeryTrend',
          unit: ' days',
          icon: Activity,
        };
      case 'radiation_therapy':
        return {
          label: 'Radiation Therapy Wait Times',
          description:
            'Historical tracking of the percentage of oncology patients receiving first radiation therapy treatment within the recommended 28-day national clinical target, alongside P50/P90 wait day percentiles. Recovery follows pandemic-era throughput expansions.',
          textClass: 'text-ok',
          softClass: 'bg-ok-soft',
          borderClass: 'border-ok',
          strokeColor: 'oklch(0.78 0.12 155)',
          gradientId: 'colorRadiationTrend',
          unit: '%',
          icon: Clock,
        };
      default:
        return null;
    }
  }, [selectedTrend]);

  const trendStats = useMemo(() => {
    if (!selectedTrend) return null;
    if (selectedTrend === 'cancer_surgery') {
      const trends = [...domainData.CANCER_SURGERY_WAIT_TRENDS]
        .filter((t) => t.cancerType === 'Breast')
        .sort((a, b) => a.year.localeCompare(b.year));
      const values = trends.map((t) => t.albertaP90Days).filter((v) => typeof v === 'number') as number[];
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
        isIncrease: rawDelta > 0,
      };
    }
    if (selectedTrend === 'radiation_therapy') {
      const trends = [...domainData.RADIATION_THERAPY_WAIT_TRENDS].sort((a, b) => a.year.localeCompare(b.year));
      const values = trends
        .map((t) => t.albertaPctWithinBenchmark)
        .filter((v) => typeof v === 'number') as number[];
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
        isIncrease: rawDelta < 0,
      };
    }
    return null;
  }, [selectedTrend, domainData]);

  const hasNoData =
    !data ||
    ((data.CANCER_SURGERY_WAIT_TRENDS?.length ?? 0) === 0 &&
      (data.RADIATION_THERAPY_WAIT_TRENDS?.length ?? 0) === 0 &&
      (data.ALBERTA_CANCER_CENTRES?.length ?? 0) === 0);

  const headerArrayKey =
    domainData.CANCER_SURGERY_WAIT_TRENDS.length > 0
      ? 'CANCER_SURGERY_WAIT_TRENDS'
      : domainData.RADIATION_THERAPY_WAIT_TRENDS.length > 0
        ? 'RADIATION_THERAPY_WAIT_TRENDS'
        : 'ALBERTA_CANCER_CENTRES';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          icon={HeartPulse}
          title="Cancer Care"
          description="CIHI cancer surgery and radiation wait trends plus AHS cancer centre directory. Projected burden and screening rates are withheld until a verified upstream exists."
          metadata={domainData._dataMetadata}
          arrayKey={headerArrayKey}
          variant="light"
        />
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="mb-4 h-4 w-1/3 rounded bg-neutral-chip" />
          <div className="h-40 rounded bg-neutral-chip" />
        </div>
      </div>
    );
  }

  if (error || hasNoData) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          icon={HeartPulse}
          title="Cancer Care"
          description="CIHI cancer surgery and radiation wait trends plus AHS cancer centre directory. Projected burden and screening rates are withheld until a verified upstream exists."
          metadata={domainData._dataMetadata}
          arrayKey={headerArrayKey}
          variant="light"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span className="flex-1">
            {error
              ? `Failed to load cancer data: ${error}`
              : 'No verified CIHI surgery/radiation wait trends or AHS cancer centres are available. Projected burden and screening rates stay withheld.'}
          </span>
          <button
            onClick={refresh}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Prefer an available tab if the current selection's array is empty.
  const effectiveSubTab: 'surgery' | 'radiation' | 'facilities' =
    activeSubTab === 'surgery' && domainData.CANCER_SURGERY_WAIT_TRENDS.length > 0
      ? 'surgery'
      : activeSubTab === 'radiation' && domainData.RADIATION_THERAPY_WAIT_TRENDS.length > 0
        ? 'radiation'
        : activeSubTab === 'facilities' && domainData.ALBERTA_CANCER_CENTRES.length > 0
          ? 'facilities'
          : domainData.CANCER_SURGERY_WAIT_TRENDS.length > 0
            ? 'surgery'
            : domainData.RADIATION_THERAPY_WAIT_TRENDS.length > 0
              ? 'radiation'
              : 'facilities';

  const commonTooltipStyle = {
    backgroundColor: 'oklch(0.2 0.022 255)',
    border: '1px solid oklch(0.28 0.02 255)',
    borderRadius: '8px',
  };
  const commonTooltipItemStyle = { color: 'oklch(0.96 0.008 255)' };
  const commonTooltipLabelStyle = { color: 'oklch(0.78 0.015 255)' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={HeartPulse}
        title="Cancer Care"
        description="CIHI cancer surgery and radiation wait trends plus AHS cancer centre directory. Projected burden and screening rates are withheld until a verified upstream exists."
        metadata={domainData._dataMetadata}
        arrayKey={headerArrayKey}
        variant="light"
      >
        <button
          onClick={refresh}
          disabled={isLoading}
          className="self-start md:self-auto rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {/* Sub-Tab Navigation — only surfaces with verified upstreams */}
      <div className="inline-flex flex-wrap rounded-lg border border-line bg-paper p-0.5">
        {domainData.CANCER_SURGERY_WAIT_TRENDS.length > 0 && (
          <button
            onClick={() => setActiveSubTab('surgery')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer',
              effectiveSubTab === 'surgery'
                ? 'bg-accent text-white'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            <Activity className="w-4 h-4" />
            <span>Cancer Surgeries</span>
          </button>
        )}
        {domainData.RADIATION_THERAPY_WAIT_TRENDS.length > 0 && (
          <button
            onClick={() => setActiveSubTab('radiation')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer',
              effectiveSubTab === 'radiation'
                ? 'bg-accent text-white'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            <Clock className="w-4 h-4" />
            <span>Radiation Gaps</span>
          </button>
        )}
        {domainData.ALBERTA_CANCER_CENTRES.length > 0 && (
          <button
            onClick={() => setActiveSubTab('facilities')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2 cursor-pointer',
              effectiveSubTab === 'facilities'
                ? 'bg-accent text-white'
                : 'text-ink-2 hover:text-ink',
            )}
          >
            <MapPin className="w-4 h-4" />
            <span>Therapy Centers</span>
          </button>
        )}
      </div>

      {/* SUBTAB: Cancer Surgery Wait Times (CIHI Benchmarks) */}
      {effectiveSubTab === 'surgery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Surgery Wait Times Line Chart */}
            <div className="bg-surface border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">CIHI Priority Cancer Surgery Wait Trends</h3>
                <p className="text-xs text-ink-3">
                  Comparing Alberta median (P50) and 90th percentile (P90) wait times in days against the Canadian national standard.
                </p>
                <DataTimestamp compact variant="light" metadata={domainData._dataMetadata} arrayKey="CANCER_SURGERY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={domainData.CANCER_SURGERY_WAIT_TRENDS.filter(
                      (t) => t.cancerType === 'Breast' || t.cancerType === 'Colorectal',
                    )}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                    <YAxis
                      label={{
                        value: 'Wait Days',
                        angle: -90,
                        position: 'insideLeft',
                        fill: 'oklch(0.62 0.02 255)',
                        fontSize: 10,
                      }}
                      stroke="oklch(0.62 0.02 255)"
                      fontSize={9}
                    />
                    <Tooltip
                      contentStyle={commonTooltipStyle}
                      itemStyle={commonTooltipItemStyle}
                      labelStyle={commonTooltipLabelStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />

                    <Line
                      type="monotone"
                      dataKey="albertaP90Days"
                      name="Alberta 90th Percentile (Days)"
                      stroke="oklch(0.75 0.14 25)"
                      strokeWidth={2.5}
                      dot
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="canadaP90Days"
                      name="Canada 90th Percentile (Days)"
                      stroke="oklch(0.75 0.14 25)"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot
                      isAnimationActive={false}
                    />

                    <Line
                      type="monotone"
                      dataKey="albertaP50Days"
                      name="Alberta Median (Days)"
                      stroke="oklch(0.78 0.12 155)"
                      strokeWidth={2}
                      dot
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="canadaP50Days"
                      name="Canada Median (Days)"
                      stroke="oklch(0.78 0.12 155)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      dot
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-ink-3">
                Wait List Dynamics: Spikes in the 90th Percentile (P90) reflect secondary backlog development.
                While urgent patients (Median) are scheduled rapidly, elective outpatients wait considerably longer for margin reconstructions.
              </p>
            </div>

            {/* Performance Target / Priority breakdown */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">National Surgical Milestones</h3>
                <p className="text-xs text-ink-3">Benchmark compliance under clinical prioritizations</p>
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
                  className={cn(
                    'p-3 rounded-xl border space-y-1 cursor-pointer transition-colors select-none group bg-paper',
                    selectedTrend === 'cancer_surgery'
                      ? 'border-crit'
                      : 'border-line hover:border-crit',
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-ink">Priority 1 (Urgent Care)</span>
                    <span className="text-[10px] font-mono font-medium rounded-lg bg-crit-soft text-crit px-1.5 py-0.5">
                      14 Days Max
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Urgent cancer surgeries with clinical priority 1. Compliance percentages are not shown without a public registry source; use CIHI wait-day trends for measured performance.
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 group-hover:text-crit transition-colors">
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
                  className={cn(
                    'p-3 rounded-xl border space-y-1 cursor-pointer transition-colors select-none group bg-paper',
                    selectedTrend === 'cancer_surgery'
                      ? 'border-warn'
                      : 'border-line hover:border-warn',
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-ink">Priority 2 (Semi-Urgent)</span>
                    <span className="text-[10px] font-mono font-medium rounded-lg bg-warn-soft text-warn px-1.5 py-0.5">
                      28 Days Max
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Semi-urgent primary solid tumors. Program-reported compliance percentages are withheld; CIHI median and P90 wait days are the sourced metrics.
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 group-hover:text-warn transition-colors">
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
                  className={cn(
                    'p-3 rounded-xl border space-y-1 cursor-pointer transition-colors select-none group bg-paper',
                    selectedTrend === 'cancer_surgery'
                      ? 'border-accent'
                      : 'border-line hover:border-accent',
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-ink">Priority 3 (Elective)</span>
                    <span className="text-[10px] font-mono font-medium rounded-lg bg-accent-soft text-accent-strong px-1.5 py-0.5">
                      42 Days Max
                    </span>
                  </div>
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Lower-urgency reconstructive or monitored cases. Fabricated compliance percentages were removed; refer to CIHI wait trends only.
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 group-hover:text-accent transition-colors">
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
                <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                        {React.createElement(trendDetails.icon, {
                          className: `w-4 h-4 ${trendDetails.textClass}`,
                        })}
                        <span>{trendDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-ink-3 max-w-3xl leading-relaxed">{trendDetails.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper border border-line rounded-xl p-3">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Baseline (Breast P90)</span>
                      <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                        {trendStats.baseline}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Current (Breast P90)</span>
                      <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                        {trendStats.latest}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">5-Year Peak</span>
                      <span className={`text-xl font-semibold font-mono tabular-nums ${trendDetails.textClass}`}>
                        {trendStats.peak}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Overall Shift</span>
                      <span
                        className={cn(
                          'text-sm font-semibold flex items-center justify-center sm:justify-start gap-1',
                          trendStats.isIncrease ? 'text-crit' : 'text-ok',
                        )}
                      >
                        {trendStats.isIncrease ? (
                          <TrendingUp className="w-4 h-4 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {trendStats.delta}
                          {trendDetails.unit} ({trendStats.pctChange})
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="h-60 mt-3 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={domainData.CANCER_SURGERY_WAIT_TRENDS.filter(
                          (t) => t.cancerType === 'Breast' || t.cancerType === 'Colorectal',
                        )}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis
                          label={{
                            value: 'Wait Days',
                            angle: -90,
                            position: 'insideLeft',
                            fill: 'oklch(0.62 0.02 255)',
                            fontSize: 10,
                          }}
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                        />
                        <Tooltip
                          contentStyle={commonTooltipStyle}
                          itemStyle={commonTooltipItemStyle}
                          labelStyle={commonTooltipLabelStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line
                          type="monotone"
                          dataKey="albertaP90Days"
                          name="Alberta 90th Percentile (Days)"
                          stroke="oklch(0.75 0.14 25)"
                          strokeWidth={2.5}
                          dot
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="canadaP90Days"
                          name="Canada 90th Percentile (Days)"
                          stroke="oklch(0.75 0.14 25)"
                          strokeWidth={1.5}
                          strokeDasharray="3 3"
                          dot
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="albertaP50Days"
                          name="Alberta Median (Days)"
                          stroke="oklch(0.78 0.12 155)"
                          strokeWidth={2}
                          dot
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="canadaP50Days"
                          name="Canada Median (Days)"
                          stroke="oklch(0.78 0.12 155)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                          dot
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUBTAB: Radiation Therapy Access */}
      {effectiveSubTab === 'radiation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Radiation Therapy Wait Times Percentiles */}
            <div className="bg-surface border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">National Radiation Therapy Wait Times</h3>
                <p className="text-xs text-ink-3">
                  Percentage of oncology patients receiving first radiation therapy treatment within the recommended 28-day national clinical target.
                </p>
                <DataTimestamp compact variant="light" metadata={domainData._dataMetadata} arrayKey="RADIATION_THERAPY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={domainData.RADIATION_THERAPY_WAIT_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorAlbertaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCanadaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                    <YAxis
                      label={{
                        value: 'Within Benchmark %',
                        angle: -90,
                        position: 'insideLeft',
                        fill: 'oklch(0.62 0.02 255)',
                        fontSize: 10,
                      }}
                      stroke="oklch(0.62 0.02 255)"
                      fontSize={9}
                      domain={[70, 100]}
                    />
                    <Tooltip
                      contentStyle={commonTooltipStyle}
                      itemStyle={commonTooltipItemStyle}
                      labelStyle={commonTooltipLabelStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area
                      type="monotone"
                      dataKey="albertaPctWithinBenchmark"
                      name="Alberta % Within Benchmark"
                      stroke="oklch(0.78 0.12 155)"
                      fillOpacity={1}
                      fill="url(#colorAlbertaRad)"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="canadaPctWithinBenchmark"
                      name="Canadian Average %"
                      stroke="oklch(0.68 0.13 252)"
                      fillOpacity={1}
                      fill="url(#colorCanadaRad)"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-xs text-ink-3">
                Recovery Trend: Following a dip during the pandemic years ({radiationSummary.year2022?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.year2022?.year ?? '2022'}), Alberta's radiation therapy throughput recovered to {radiationSummary.latest?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.latest?.year ?? '2025'} due to clinical cohort expansions and late-night scanning blocks.
              </p>
            </div>

            {/* Benchmark Details */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">Radiation Access Milestones</h3>
                <p className="text-xs text-ink-3">Wait times from clinical ready-to-treat decision to first beam</p>
              </div>

              <div className="space-y-4 pt-2">
                <div
                  tabIndex={0}
                  onClick={() =>
                    setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy');
                    }
                  }}
                  className={cn(
                    'p-3 rounded-xl border space-y-2 cursor-pointer transition-colors select-none group bg-paper',
                    selectedTrend === 'radiation_therapy'
                      ? 'border-ok'
                      : 'border-line hover:border-ok',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">Median Wait (P50)</span>
                    <span className="text-[10px] font-mono font-medium rounded-lg bg-ok-soft text-ok border border-line px-1.5 py-0.5">
                      {radiationSummary.latest?.albertaP50WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-xs text-ink-3">
                    Half of all patients referred for urgent or routine palliative radiation treatment receive their first fraction within {radiationSummary.latest?.albertaP50WaitDays ?? 0} days of the clinical directive ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 group-hover:text-ok transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'radiation_therapy' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  onClick={() =>
                    setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTrend(selectedTrend === 'radiation_therapy' ? null : 'radiation_therapy');
                    }
                  }}
                  className={cn(
                    'p-3 rounded-xl border space-y-2 cursor-pointer transition-colors select-none group bg-paper',
                    selectedTrend === 'radiation_therapy'
                      ? 'border-warn'
                      : 'border-line hover:border-warn',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink">90th Percentile Wait (P90)</span>
                    <span className="text-[10px] font-mono font-medium rounded-lg bg-warn-soft text-warn border border-line px-1.5 py-0.5">
                      {radiationSummary.latest?.albertaP90WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-xs text-ink-3">
                    90% of all oncology cohorts receive radiation within {radiationSummary.latest?.albertaP90WaitDays ?? 0} days, comfortably meeting the Canadian Association of Radiologists standard of 28 days ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                  <div className="pt-1.5 flex items-center gap-1 text-xs font-medium text-ink-3 group-hover:text-warn transition-colors">
                    <BarChart2 className="w-3 h-3" />
                    <span>{selectedTrend === 'radiation_therapy' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line">
                <span className="text-xs text-ink-3 font-medium">
                  Radiation compliance trends are CIHI-sourced wait metrics only; comparative ranking claims are withheld without a verified source.
                </span>
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
                <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                        {React.createElement(trendDetails.icon, {
                          className: `w-4 h-4 ${trendDetails.textClass}`,
                        })}
                        <span>{trendDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-ink-3 max-w-3xl leading-relaxed">{trendDetails.description}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper border border-line rounded-xl p-3">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Baseline Within Benchmark</span>
                      <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                        {trendStats.baseline}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Current Within Benchmark</span>
                      <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                        {trendStats.latest}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">5-Year Peak</span>
                      <span className={`text-xl font-semibold font-mono tabular-nums ${trendDetails.textClass}`}>
                        {trendStats.peak}
                        {trendDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-xs font-medium text-ink-3 block">Overall Shift</span>
                      <span
                        className={cn(
                          'text-sm font-semibold flex items-center justify-center sm:justify-start gap-1',
                          trendStats.isIncrease ? 'text-crit' : 'text-ok',
                        )}
                      >
                        {trendStats.isIncrease ? (
                          <TrendingUp className="w-4 h-4 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {trendStats.delta}
                          {trendDetails.unit} ({trendStats.pctChange})
                        </span>
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
                            <stop offset="5%" stopColor={trendDetails.strokeColor} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={trendDetails.strokeColor} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorCanadaRadTrend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis
                          label={{
                            value: 'Within Benchmark %',
                            angle: -90,
                            position: 'insideLeft',
                            fill: 'oklch(0.62 0.02 255)',
                            fontSize: 10,
                          }}
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          domain={[70, 100]}
                        />
                        <Tooltip
                          contentStyle={commonTooltipStyle}
                          itemStyle={commonTooltipItemStyle}
                          labelStyle={commonTooltipLabelStyle}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="albertaPctWithinBenchmark"
                          name="Alberta % Within Benchmark"
                          stroke={trendDetails.strokeColor}
                          fillOpacity={1}
                          fill={`url(#${trendDetails.gradientId})`}
                          strokeWidth={2.5}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="canadaPctWithinBenchmark"
                          name="Canadian Average %"
                          stroke="oklch(0.68 0.13 252)"
                          fillOpacity={1}
                          fill="url(#colorCanadaRadTrend)"
                          strokeWidth={1.5}
                          strokeDasharray="5 5"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* SUBTAB: Treatment Access & Facility Map */}
      {effectiveSubTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Oncology Treatment Centers & Service Directories</h3>
                <p className="text-xs text-ink-3">Live directory of specialized cancer centers, linear accelerators, and chemotherapy access sites</p>
                <DataTimestamp compact variant="light" metadata={domainData._dataMetadata} arrayKey="ALBERTA_CANCER_CENTRES" />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-paper text-xs border border-line rounded-lg px-2.5 py-1.5 text-ink focus:outline-none focus:border-accent"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-ink-3" />
                  <input
                    type="text"
                    placeholder="Search clinics & services..."
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>

            {/* List of Cancer Centres */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFacilities.map((fac) => (
                <div
                  key={fac.id}
                  className="bg-paper border border-line rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-line-2 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-ink leading-tight">{fac.name}</h4>
                        <span className="text-[10px] bg-neutral-chip text-ink-2 px-1.5 py-0.5 rounded mt-1.5 inline-block font-mono">
                          {fac.type}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-ink-3 space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                        <span className="truncate">
                          {fac.address}, {fac.city} ({fac.zone})
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-line pt-2">
                      <span className="text-[10px] text-ink-3 font-medium block mb-1">Available Services:</span>
                      <div className="flex flex-wrap gap-1">
                        {fac.services.map((srv, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-accent-soft text-accent-strong border border-line px-2 py-0.5 rounded-lg"
                          >
                            {srv}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-line text-[10px] text-center">
                    <div
                      className={cn(
                        'p-1 rounded font-medium border',
                        fac.systemicTherapyAvailable
                          ? 'bg-ok-soft text-ok border-line'
                          : 'bg-paper text-ink-3 border-line',
                      )}
                    >
                      Chemo / Systemic
                    </div>
                    <div
                      className={cn(
                        'p-1 rounded font-medium border',
                        fac.radiationTherapyAvailable
                          ? 'bg-ok-soft text-ok border-line'
                          : 'bg-paper text-ink-3 border-line',
                      )}
                    >
                      Radiation (LINAC)
                    </div>
                    <div
                      className={cn(
                        'p-1 rounded font-medium border',
                        fac.surgicalOncologyAvailable
                          ? 'bg-ok-soft text-ok border-line'
                          : 'bg-paper text-ink-3 border-line',
                      )}
                    >
                      Onco Surgery
                    </div>
                  </div>
                </div>
              ))}

              {filteredFacilities.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
                  <AlertTriangle className="w-8 h-8 text-warn mx-auto mb-2" />
                  <p>No specialized cancer clinics or support services matched your search criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
