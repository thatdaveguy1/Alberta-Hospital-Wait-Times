import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  MapPin,
  AlertTriangle,
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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
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

type PlacementKpiKey = 'pctPlacedWithin30Days' | 'pctPlacedPreferredOption';

const PLACEMENT_ZONE_COLORS: Record<string, string> = {
  Alberta: 'oklch(0.45 0.02 255)',
  'Calgary Zone': 'oklch(0.68 0.13 252)',
  'Edmonton Zone': 'oklch(0.65 0.12 155)',
  'Central Zone': 'oklch(0.7 0.14 85)',
  'South Zone': 'oklch(0.7 0.15 350)',
  'North Zone': 'oklch(0.6 0.12 270)',
};

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

function pivotPlacementMetric(
  rows: Array<{ year: string; zone: string; pctPlacedWithin30Days: number; pctPlacedPreferredOption: number }>,
  metric: 'pctPlacedWithin30Days' | 'pctPlacedPreferredOption',
  years: string[],
  zones: string[],
): Array<Record<string, string | number | null>> {
  return years.map((year) => {
    const point: Record<string, string | number | null> = { year };
    for (const zone of zones) {
      const row = rows.find((r) => r.year === year && r.zone === zone);
      const val = row?.[metric];
      point[zone] = typeof val === 'number' && !Number.isNaN(val) ? val : null;
    }
    return point;
  });
}

export default function ContinuingCareDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<ContinuingCareData>('continuing-care', continuingCareData);
  const [activeSubTab, setActiveSubTab] = useState<'placement' | 'resident-quality' | 'compliance'>('placement');

  // Focus highlight for which placement KPI/chart is emphasized (both charts always visible)
  const [selectedKpi, setSelectedKpi] = useState<PlacementKpiKey | null>('pctPlacedWithin30Days');

  // Normalize placement stats: treat daysWaitingP50/P90 == 0 as missing (null) so we never
  // invent wait-day trends from zero placeholders.
  const placementStats = useMemo(() => {
    return (data?.CONTINUING_CARE_PLACEMENT_STATS ?? []).map((r) => ({
      ...r,
      daysWaitingP50: r.daysWaitingP50 === 0 || r.daysWaitingP50 === undefined ? null : r.daysWaitingP50,
      daysWaitingP90: r.daysWaitingP90 === 0 || r.daysWaitingP90 === undefined ? null : r.daysWaitingP90,
    }));
  }, [data]);

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

  const placementYears = useMemo(() => {
    return Array.from(new Set(placementStats.map((r) => r.year))).sort();
  }, [placementStats]);

  const placementZones = useMemo(() => {
    return Array.from(new Set(placementStats.map((p) => p.zone))).sort();
  }, [placementStats]);

  const placementChartZones = useMemo(() => {
    if (selectedZone === 'All') return placementZones;
    return placementZones.filter((z) => z === selectedZone);
  }, [selectedZone, placementZones]);

  const placementTrendWithin30 = useMemo(
    () => pivotPlacementMetric(placementStats, 'pctPlacedWithin30Days', placementYears, placementZones),
    [placementStats, placementYears, placementZones]
  );

  const placementTrendPreferred = useMemo(
    () => pivotPlacementMetric(placementStats, 'pctPlacedPreferredOption', placementYears, placementZones),
    [placementStats, placementYears, placementZones]
  );

  const latestYearPlacementByZone = useMemo(() => {
    const latestYear = placementYears[placementYears.length - 1];
    if (!latestYear) return [] as Array<{ zone: string; within30: number | null; preferred: number | null }>;
    return placementZones.map((zone) => {
      const row = placementStats.find((r) => r.year === latestYear && r.zone === zone);
      return {
        zone,
        within30: typeof row?.pctPlacedWithin30Days === 'number' ? row.pctPlacedWithin30Days : null,
        preferred: typeof row?.pctPlacedPreferredOption === 'number' ? row.pctPlacedPreferredOption : null,
      };
    });
  }, [placementStats, placementYears, placementZones]);

  const placementKpis = useMemo(() => {
    const years = placementYears;
    const latestYear = years[years.length - 1] ?? null;

    // Prefer Alberta latest-year row for headline KPIs; else fall back to latest year available
    const albertaLatest = latestYear
      ? placementStats.find((r) => r.year === latestYear && r.zone === 'Alberta')
      : undefined;

    if (albertaLatest) {
      return {
        within30: typeof albertaLatest.pctPlacedWithin30Days === 'number' ? albertaLatest.pctPlacedWithin30Days : null,
        preferred: typeof albertaLatest.pctPlacedPreferredOption === 'number' ? albertaLatest.pctPlacedPreferredOption : null,
        waitP50: albertaLatest.daysWaitingP50 ?? null,
        labelYear: latestYear,
        labelZone: 'Alberta' as const,
      };
    }

    // No Alberta row — average whatever zones exist for the latest year
    const latestRows = latestYear ? placementStats.filter((r) => r.year === latestYear) : [];
    return {
      within30: avgNumeric(latestRows.map((r) => r.pctPlacedWithin30Days)),
      preferred: avgNumeric(latestRows.map((r) => r.pctPlacedPreferredOption)),
      waitP50: avgNumeric(latestRows.map((r) => r.daysWaitingP50)),
      labelYear: latestYear,
      labelZone: null as string | null,
    };
  }, [placementStats, placementYears]);

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
                  onClick={() => setSelectedKpi('pctPlacedWithin30Days')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedKpi('pctPlacedWithin30Days');
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
                    Alberta share placed into continuing care within 30 days
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="flex items-center gap-1 pt-1.5 text-[10px] font-medium text-ok">
                    <BarChart2 className="w-3 h-3" />
                    <span>
                      {selectedKpi === 'pctPlacedWithin30Days' ? 'Focused trend' : 'Click to focus trend'}
                    </span>
                  </div>
                </div>

                <div
                  tabIndex={0}
                  onClick={() => setSelectedKpi('pctPlacedPreferredOption')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedKpi('pctPlacedPreferredOption');
                    }
                  }}
                  className={`cursor-pointer space-y-1 rounded-xl border bg-surface p-4 text-left transition-all hover:border-line-2 ${
                    selectedKpi === 'pctPlacedPreferredOption'
                      ? 'border-accent bg-accent-soft'
                      : 'border-line'
                  }`}
                >
                  <span className="block text-xs font-medium text-ink-3">
                    Preferred Option Rate
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-ok">
                      {formatOptional(placementKpis.preferred, { suffix: '%', empty: '—' })}
                    </span>
                    <span className="text-xs font-medium font-mono text-ink-2">Target: 70%+</span>
                  </div>
                  <p className="border-t border-line pt-1 text-xs text-ink-2">
                    Alberta share of placements into the resident&apos;s preferred living option
                    {placementKpis.labelYear ? ` (${placementKpis.labelYear})` : ''}.
                  </p>
                  <div className="flex items-center gap-1 pt-1.5 text-[10px] font-medium text-accent">
                    <BarChart2 className="w-3 h-3" />
                    <span>
                      {selectedKpi === 'pctPlacedPreferredOption' ? 'Focused trend' : 'Click to focus trend'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 rounded-xl border border-line bg-surface p-4 text-left opacity-90">
                  <span className="block text-xs font-medium text-ink-3">
                    Median Wait Days
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-ink">
                      {placementKpis.waitP50 === null
                        ? 'N/A'
                        : `${placementKpis.waitP50.toFixed(0)} days`}
                    </span>
                    <span className="text-xs font-medium font-mono text-ink-2">P50</span>
                  </div>
                  <p className="border-t border-line pt-1 text-xs text-ink-2">
                    Upstream wait-day series is not reported in the current feed — no wait trend is shown.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-ink-2">Placement trends by year</h3>
                  <p className="text-xs text-ink-3">
                    Year-over-year rates{placementYears.length ? ` (${placementYears[0]}–${placementYears[placementYears.length - 1]})` : ''}. Filter by zone to isolate a series.
                  </p>
                </div>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                  aria-label="Filter placement charts by zone"
                >
                  <option value="All">All zones</option>
                  {placementZones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`space-y-3 rounded-xl border bg-surface p-5 transition-colors ${
                  selectedKpi === 'pctPlacedWithin30Days' ? 'border-ok' : 'border-line'
                }`}
              >
                <div>
                  <h3 className="text-sm font-semibold text-ink-2">% placed within 30 days</h3>
                  <p className="text-xs text-ink-3">Target 60%+. {selectedZone === 'All' ? 'One series per zone.' : selectedZone}</p>
                </div>
                {placementTrendWithin30.length === 0 || placementChartZones.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-ink-3">No placement trend rows.</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={placementTrendWithin30} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis
                          domain={[0, 100]}
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'oklch(0.2 0.022 255)',
                            border: '1px solid oklch(0.28 0.02 255)',
                            borderRadius: '8px',
                          }}
                          itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                          labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                          formatter={(value: number | string) =>
                            typeof value === 'number' ? [`${value.toFixed(1)}%`, ''] : [value, '']
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <ReferenceLine
                          y={60}
                          stroke="oklch(0.65 0.12 155)"
                          strokeDasharray="4 4"
                          label={{ value: '60% target', position: 'insideTopRight', fill: 'oklch(0.62 0.02 255)', fontSize: 10 }}
                        />
                        {placementChartZones.map((zone) => (
                          <Line
                            key={zone}
                            type="monotone"
                            dataKey={zone}
                            name={zone}
                            stroke={PLACEMENT_ZONE_COLORS[zone] ?? 'oklch(0.55 0.08 255)'}
                            strokeWidth={selectedZone === 'All' && zone === 'Alberta' ? 2.75 : 2}
                            dot={{ r: 3, strokeWidth: 1 }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div
                className={`space-y-3 rounded-xl border bg-surface p-5 transition-colors ${
                  selectedKpi === 'pctPlacedPreferredOption' ? 'border-accent' : 'border-line'
                }`}
              >
                <div>
                  <h3 className="text-sm font-semibold text-ink-2">% preferred option met</h3>
                  <p className="text-xs text-ink-3">Target 70%+. {selectedZone === 'All' ? 'One series per zone.' : selectedZone}</p>
                </div>
                {placementTrendPreferred.length === 0 || placementChartZones.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-ink-3">No preferred-option trend rows.</div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={placementTrendPreferred} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis
                          domain={[0, 100]}
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'oklch(0.2 0.022 255)',
                            border: '1px solid oklch(0.28 0.02 255)',
                            borderRadius: '8px',
                          }}
                          itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                          labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                          formatter={(value: number | string) =>
                            typeof value === 'number' ? [`${value.toFixed(1)}%`, ''] : [value, '']
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <ReferenceLine
                          y={70}
                          stroke="oklch(0.68 0.13 252)"
                          strokeDasharray="4 4"
                          label={{ value: '70% target', position: 'insideTopRight', fill: 'oklch(0.62 0.02 255)', fontSize: 10 }}
                        />
                        {placementChartZones.map((zone) => (
                          <Line
                            key={zone}
                            type="monotone"
                            dataKey={zone}
                            name={zone}
                            stroke={PLACEMENT_ZONE_COLORS[zone] ?? 'oklch(0.55 0.08 255)'}
                            strokeWidth={selectedZone === 'All' && zone === 'Alberta' ? 2.75 : 2}
                            dot={{ r: 3, strokeWidth: 1 }}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {latestYearPlacementByZone.length > 0 && (
                <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
                  <div>
                    <h3 className="text-sm font-semibold text-ink-2">
                      Latest-year zone comparison
                      {placementYears.length ? ` (${placementYears[placementYears.length - 1]})` : ''}
                    </h3>
                    <p className="text-xs text-ink-3">
                      Within-30 and preferred-option rates by zone for the most recent reporting year.
                    </p>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={latestYearPlacementByZone}
                        margin={{ top: 10, right: 16, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="zone" stroke="oklch(0.62 0.02 255)" fontSize={9} interval={0} angle={-18} textAnchor="end" height={56} />
                        <YAxis
                          domain={[0, 100]}
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'oklch(0.2 0.022 255)',
                            border: '1px solid oklch(0.28 0.02 255)',
                            borderRadius: '8px',
                          }}
                          itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                          labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                          formatter={(value: number | string) =>
                            typeof value === 'number' ? [`${value.toFixed(1)}%`, ''] : [value, '']
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="within30" name="Within 30 days" fill="oklch(0.65 0.12 155)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Bar dataKey="preferred" name="Preferred option" fill="oklch(0.68 0.13 252)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="border-t border-line pt-3 text-xs text-ink-3">
                    Wait days are not charted — the upstream HQCA FOCUS feed does not report wait-day values for these years.
                  </p>
                </div>
              )}
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
