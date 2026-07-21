import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplet,
  Info,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  PhacWastewaterTimeSeriesPoint,
  RvdImmunizationDose,
  RvdInfluenzaSeasonCount,
  RvdLabTestPositivity,
  RvdRespiratoryCaseCount,
  WastewaterSignal,
  WastewaterTimeSeriesPoint,
} from '../publicHealthData';
import * as publicHealthData from '../publicHealthData';
import { DashboardHeader } from './DashboardHeader';
import { DataTimestamp } from './DataTimestamp';
import { useDomainData } from '../hooks/useDomainData';

type PublicHealthData = {
  RESPIRATORY_VIRUS_SURVEILLANCE?: unknown[];
  WASTEWATER_SIGNALS?: WastewaterSignal[];
  WASTEWATER_TIME_SERIES?: WastewaterTimeSeriesPoint[];
  PHAC_WASTEWATER_TIME_SERIES?: PhacWastewaterTimeSeriesPoint[];
  RVD_RESPIRATORY_CASE_COUNTS?: RvdRespiratoryCaseCount[];
  RVD_INFLUENZA_SEASON_COUNTS?: RvdInfluenzaSeasonCount[];
  RVD_LAB_TEST_POSITIVITY?: RvdLabTestPositivity[];
  RVD_IMMUNIZATION_DOSES?: RvdImmunizationDose[];
  CHILDHOOD_IMMUNIZATION_COVERAGE?: unknown[];
  NOTIFIABLE_DISEASE_INCIDENCE?: unknown[];
  ENVIRONMENTAL_ADVISORIES?: unknown[];
  OUTBREAK_PROTOCOLS?: Record<string, unknown>;
};

/* Recharts props can't consume CSS vars — chart literals live here only. */
const CHART_GRID = 'oklch(0.28 0.02 255)';
const CHART_TICK = 'oklch(0.62 0.02 255)';
const CHART_COVID = 'oklch(0.68 0.13 252)'; // accent
const CHART_FLU = 'oklch(0.82 0.12 85)'; // warn
const CHART_RSV = 'oklch(0.75 0.14 25)'; // crit
const CHART_FLU_B = 'oklch(0.78 0.12 155)'; // ok

const VIRUS_STROKES = [
  CHART_COVID,
  CHART_FLU,
  CHART_RSV,
  CHART_FLU_B,
  'oklch(0.5 0.08 220)',
  'oklch(0.7 0.1 310)',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'oklch(0.2 0.022 255)',
  border: '1px solid oklch(0.28 0.02 255)',
  borderRadius: '8px',
} as const;

/** Prefer seasons from 2019-2020 onward for the comparison chart. */
const SEASON_FOCUS_FLOOR = 2019;

function formatWastewaterSignal(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs < 0.001 || abs >= 1_000_000) return value.toExponential(2);
  return abs < 1 ? value.toFixed(3) : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function activityTone(level: string): { chip: string; text: string } {
  const lowered = level.toLowerCase();
  if (lowered === 'low') return { chip: 'bg-ok-soft text-ok', text: 'text-ok' };
  if (lowered === 'moderate') return { chip: 'bg-warn-soft text-warn', text: 'text-warn' };
  if (lowered === 'high' || lowered === 'very high') return { chip: 'bg-crit-soft text-crit', text: 'text-crit' };
  return { chip: 'bg-neutral-chip text-ink-2', text: 'text-ink-2' };
}

function trendTone(trend: string): string {
  const lowered = trend.toLowerCase();
  if (lowered === 'increasing') return 'text-crit';
  if (lowered === 'decreasing') return 'text-ok';
  return 'text-ink-2';
}

function strokeForLabel(label: string, idx: number): string {
  const v = label.toLowerCase();
  if (v.includes('covid') || v.includes('sars') || v === 'covid') return CHART_COVID;
  if (v.includes('rsv') || v.includes('syncytial')) return CHART_RSV;
  if (v.includes('influenza b') || v.includes('flu b') || v === 'flub') return CHART_FLU_B;
  if (v.includes('influenza') || v.includes('flu')) return CHART_FLU;
  return VIRUS_STROKES[idx % VIRUS_STROKES.length];
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function seasonStartYear(season: string): number | null {
  const match = /^(\d{4})\s*[-–]\s*(\d{2,4})$/.exec(season.trim());
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function pivotWeeklySeries<T extends { weekEnding: string }>(
  rows: T[],
  keyOf: (row: T) => string,
  valueOf: (row: T) => number,
  options?: { lastNWeeks?: number; skipZero?: boolean },
): { points: Record<string, string | number>[]; keys: string[] } {
  const weeks = Array.from(new Set(rows.map((r) => r.weekEnding))).sort();
  const lastWeeks = options?.lastNWeeks ? weeks.slice(-options.lastNWeeks) : weeks;
  const keys = Array.from(new Set(rows.map(keyOf))).filter(Boolean).sort();
  const byWeekKey = new Map<string, number>();
  for (const row of rows) {
    byWeekKey.set(`${row.weekEnding}::${keyOf(row)}`, valueOf(row));
  }
  const points = lastWeeks.map((week) => {
    const point: Record<string, string | number> = { weekEnding: week };
    for (const key of keys) {
      const value = byWeekKey.get(`${week}::${key}`);
      if (value == null) continue;
      if (options?.skipZero && value === 0) continue;
      point[key] = value;
    }
    return point;
  });
  return { points, keys };
}

export default function PublicHealthDashboard() {
  const { data, metadata, isLoading, error } = useDomainData<PublicHealthData>(
    'public-health',
    publicHealthData,
  );

  const [activeSubTab, setActiveSubTab] = useState<'respiratory' | 'wastewater'>('respiratory');
  const [wastewaterSearch, setWastewaterSearch] = useState('');
  const [selectedWwSite, setSelectedWwSite] = useState('');
  const [selectedPhacSite, setSelectedPhacSite] = useState('');

  const rvdCases: RvdRespiratoryCaseCount[] = data?.RVD_RESPIRATORY_CASE_COUNTS ?? [];
  const labPositivity: RvdLabTestPositivity[] = data?.RVD_LAB_TEST_POSITIVITY ?? [];
  const fluSeasons: RvdInfluenzaSeasonCount[] = data?.RVD_INFLUENZA_SEASON_COUNTS ?? [];
  const wastewater: WastewaterSignal[] = data?.WASTEWATER_SIGNALS ?? [];
  const wwTimeSeries: WastewaterTimeSeriesPoint[] = data?.WASTEWATER_TIME_SERIES ?? [];
  const phacSeries: PhacWastewaterTimeSeriesPoint[] = data?.PHAC_WASTEWATER_TIME_SERIES ?? [];

  // Latest non-zero count per virus from full RVD case array (influenza subtypes + RSV + COVID when present).
  const latestByVirus = useMemo(() => {
    const map = new Map<string, RvdRespiratoryCaseCount>();
    for (const row of rvdCases) {
      if (!row.virus || typeof row.count !== 'number') continue;
      const prev = map.get(row.virus);
      if (!prev || row.weekEnding > prev.weekEnding) map.set(row.virus, row);
    }
    return Array.from(map.values()).filter((r) => r.count > 0);
  }, [rvdCases]);

  const { points: rvdChartData, keys: virusKeys } = useMemo(
    () =>
      pivotWeeklySeries(rvdCases, (r) => r.virus, (r) => r.count, {
        lastNWeeks: 24,
        skipZero: true,
      }),
    [rvdCases],
  );

  const { points: labChartData, keys: labVirusKeys } = useMemo(
    () =>
      pivotWeeklySeries(labPositivity, (r) => r.virus, (r) => r.percentPositive, {
        lastNWeeks: 52,
      }),
    [labPositivity],
  );

  const focusedFluSeasons = useMemo(
    () =>
      fluSeasons.filter((row) => {
        const year = seasonStartYear(row.season);
        return year == null || year >= SEASON_FOCUS_FLOOR;
      }),
    [fluSeasons],
  );

  const fluSeasonChart = useMemo(() => {
    const seasons = uniqueSorted(focusedFluSeasons.map((r) => r.season));
    const weekIndexBySeason = new Map<string, Map<string, number>>();
    for (const season of seasons) {
      const weeks = uniqueSorted(
        focusedFluSeasons.filter((r) => r.season === season).map((r) => r.weekEnding),
      );
      const map = new Map<string, number>();
      weeks.forEach((week, idx) => map.set(week, idx + 1));
      weekIndexBySeason.set(season, map);
    }

    const maxWeek = Math.max(
      0,
      ...Array.from(weekIndexBySeason.values()).map((m) => m.size),
    );
    const valueLookup = new Map<string, number>();
    for (const row of focusedFluSeasons) {
      const weekIdx = weekIndexBySeason.get(row.season)?.get(row.weekEnding);
      if (weekIdx == null) continue;
      valueLookup.set(`${row.season}::${weekIdx}`, row.count);
    }

    const points = Array.from({ length: maxWeek }, (_, i) => {
      const weekIndex = i + 1;
      const point: Record<string, string | number> = { weekIndex };
      for (const season of seasons) {
        const value = valueLookup.get(`${season}::${weekIndex}`);
        if (value != null) point[season] = value;
      }
      return point;
    });

    return { points, seasons };
  }, [focusedFluSeasons]);

  const filteredWastewater = useMemo(() => {
    const q = wastewaterSearch.toLowerCase();
    return wastewater.filter(
      (w) => w.site.toLowerCase().includes(q) || w.zone.toLowerCase().includes(q),
    );
  }, [wastewater, wastewaterSearch]);

  const wastewaterChartData = useMemo(
    () =>
      filteredWastewater.map((w) => ({
        site: w.site,
        covidSignal: w.covidSignal,
        activityLevel: w.activityLevel,
        trend: w.trend,
        zone: w.zone,
      })),
    [filteredWastewater],
  );

  const wwSites = useMemo(
    () => Array.from(new Set(wwTimeSeries.map((r) => r.site).filter(Boolean))).sort(),
    [wwTimeSeries],
  );

  useEffect(() => {
    if (!wwSites.length) {
      setSelectedWwSite('');
      return;
    }
    if (!selectedWwSite || !wwSites.includes(selectedWwSite)) {
      setSelectedWwSite(wwSites[0]);
    }
  }, [wwSites, selectedWwSite]);

  const selectedWwSeries = useMemo(
    () =>
      wwTimeSeries
        .filter((r) => r.site === selectedWwSite)
        .slice()
        .sort((a, b) => a.sampleDate.localeCompare(b.sampleDate))
        .map((r) => ({
          sampleDate: r.sampleDate,
          covidSignal: r.covidSignal,
        })),
    [wwTimeSeries, selectedWwSite],
  );

  const phacSites = useMemo(
    () => Array.from(new Set(phacSeries.map((r) => r.site).filter(Boolean))).sort(),
    [phacSeries],
  );

  useEffect(() => {
    if (!phacSites.length) {
      setSelectedPhacSite('');
      return;
    }
    if (!selectedPhacSite || !phacSites.includes(selectedPhacSite)) {
      setSelectedPhacSite(phacSites[0]);
    }
  }, [phacSites, selectedPhacSite]);

  const phacChart = useMemo(() => {
    const rows = phacSeries.filter((r) => r.site === selectedPhacSite);
    const pathogens = Array.from(new Set(rows.map((r) => r.pathogen))).sort();
    const dates = Array.from(new Set(rows.map((r) => r.sampleDate))).sort();
    const lookup = new Map<string, number>();
    for (const row of rows) {
      const value = row.sevenDayAvg ?? row.viralLoad;
      lookup.set(`${row.sampleDate}::${row.pathogen}`, value);
    }
    const points = dates.map((sampleDate) => {
      const point: Record<string, string | number> = { sampleDate };
      for (const pathogen of pathogens) {
        const value = lookup.get(`${sampleDate}::${pathogen}`);
        if (value != null) point[pathogen] = value;
      }
      return point;
    });
    return { points, pathogens };
  }, [phacSeries, selectedPhacSite]);

  const hasRespiratory =
    rvdCases.length > 0 || labPositivity.length > 0 || focusedFluSeasons.length > 0;
  const hasWastewater =
    wastewater.length > 0 || wwTimeSeries.length > 0 || phacSeries.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-5 w-1/3 bg-neutral-chip rounded" />
          <div className="mt-2 h-3 w-2/3 bg-neutral-chip rounded" />
          <div className="mt-4 h-3 w-1/2 bg-neutral-chip rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-line bg-surface p-4">
              <div className="h-3 w-1/2 bg-neutral-chip rounded" />
              <div className="mt-2 h-8 w-1/3 bg-neutral-chip rounded" />
            </div>
          ))}
        </div>
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4 h-72" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          icon={ShieldAlert}
          title="Public Health & Surveillance"
          description="Alberta respiratory case counts, lab positivity, and wastewater viral loads with fuller RVD history when available."
          metadata={metadata ?? undefined}
          arrayKey="WASTEWATER_SIGNALS"
          variant="light"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Failed to load public health data: {error}</span>
        </div>
      </div>
    );
  }

  const effectiveTab: 'respiratory' | 'wastewater' =
    activeSubTab === 'respiratory' && hasRespiratory
      ? 'respiratory'
      : hasWastewater
        ? 'wastewater'
        : hasRespiratory
          ? 'respiratory'
          : 'respiratory';

  if (!hasRespiratory && !hasWastewater) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          icon={ShieldAlert}
          title="Public Health & Surveillance"
          description="Upstream respiratory and wastewater feeds only. Manual notifiable, childhood immunization, and advisory panels have been removed."
          metadata={metadata ?? undefined}
          arrayKey="WASTEWATER_SIGNALS"
          variant="light"
        />
        <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
          No verified public-health arrays are available from the current upstream pipelines.
        </div>
      </div>
    );
  }

  const headerArrayKey = hasRespiratory ? 'RVD_RESPIRATORY_CASE_COUNTS' : 'WASTEWATER_SIGNALS';

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={ShieldAlert}
        title="Public Health & Surveillance"
        description="Alberta RVD case counts (influenza, RSV, COVID), laboratory positivity, multi-season influenza overlays, and wastewater viral loads with fuller site history. Notifiable disease, childhood immunization, and environmental advisory panels stay withheld until a verified upstream exists."
        metadata={metadata ?? undefined}
        arrayKey={headerArrayKey}
        variant="light"
      />

      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
        {hasRespiratory && (
          <button
            onClick={() => setActiveSubTab('respiratory')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
              effectiveTab === 'respiratory'
                ? 'bg-accent text-white'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Respiratory Viruses</span>
          </button>
        )}
        {hasWastewater && (
          <button
            onClick={() => setActiveSubTab('wastewater')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer flex items-center gap-2 ${
              effectiveTab === 'wastewater'
                ? 'bg-accent text-white'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Wastewater Signals</span>
          </button>
        )}
      </div>

      {effectiveTab === 'respiratory' && hasRespiratory && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="RVD_RESPIRATORY_CASE_COUNTS"
          />

          {rvdCases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              RVD weekly case counts are not available from the current upstream payload.
            </div>
          ) : latestByVirus.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              RVD case-count array is present but contains no non-zero counts for the latest weeks.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {latestByVirus.map((row) => (
                <div key={row.virus} className="rounded-xl border border-line bg-surface p-4 space-y-2">
                  <span className="text-xs font-medium text-ink-3 block">{row.virus}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold font-mono tabular-nums text-ink">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="text-xs text-ink-3">cases</span>
                  </div>
                  <p className="text-[10px] text-ink-3 pt-2 border-t border-line font-mono">
                    Week ending {row.weekEnding}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Alberta RVD weekly case counts</h3>
              <p className="text-xs text-ink-3">
                Full summary extracts (influenza subtypes, RSV, and COVID when present). No fabricated seasonal positivity or ICU KPI cards.
              </p>
            </div>
            {rvdChartData.length === 0 ? (
              <p className="text-sm text-ink-3">No chartable RVD case rows.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rvdChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="weekEnding" stroke={CHART_TICK} fontSize={9} />
                    <YAxis stroke={CHART_TICK} fontSize={9} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                      labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {virusKeys.map((virus, idx) => (
                      <Line
                        key={virus}
                        type="monotone"
                        dataKey={virus}
                        name={virus}
                        stroke={strokeForLabel(virus, idx)}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Laboratory test positivity</h3>
              <p className="text-xs text-ink-3">
                Percent positive traces from the Alberta RVD laboratory-testing tab (COVID, influenza, and RSV when present).
              </p>
            </div>
            {labPositivity.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-3">
                Lab positivity array is missing or empty.
              </div>
            ) : labChartData.length === 0 ? (
              <p className="text-sm text-ink-3">No chartable lab positivity rows.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={labChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="weekEnding" stroke={CHART_TICK} fontSize={9} />
                    <YAxis stroke={CHART_TICK} fontSize={9} unit="%" />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                      labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      formatter={(value: number | string) =>
                        typeof value === 'number' ? `${value.toFixed(1)}%` : value
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {labVirusKeys.map((virus, idx) => (
                      <Line
                        key={virus}
                        type="monotone"
                        dataKey={virus}
                        name={virus}
                        stroke={strokeForLabel(virus, idx)}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="pt-3 border-t border-line text-xs text-ink-2 flex items-start gap-1.5 leading-relaxed">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Source: Alberta Respiratory Virus Dashboard laboratory-testing extracts (RVD_LAB_TEST_POSITIVITY). History begins ~2021-08 when upstream provides it.
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Influenza season comparison</h3>
              <p className="text-xs text-ink-3">
                Season-overlay counts focused on {SEASON_FOCUS_FLOOR}–{SEASON_FOCUS_FLOOR + 1} onward (earlier seasons may exist upstream but are omitted here).
              </p>
            </div>
            {focusedFluSeasons.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-3">
                Influenza season comparison array is missing or has no seasons from {SEASON_FOCUS_FLOOR} onward.
              </div>
            ) : fluSeasonChart.points.length === 0 ? (
              <p className="text-sm text-ink-3">No chartable influenza season rows.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fluSeasonChart.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis
                      dataKey="weekIndex"
                      stroke={CHART_TICK}
                      fontSize={9}
                      label={{ value: 'Week of season', position: 'insideBottom', offset: -2, fontSize: 10, fill: CHART_TICK }}
                    />
                    <YAxis stroke={CHART_TICK} fontSize={9} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                      labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      labelFormatter={(label) => `Season week ${label}`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {fluSeasonChart.seasons.map((season, idx) => (
                      <Line
                        key={season}
                        type="monotone"
                        dataKey={season}
                        name={season}
                        stroke={VIRUS_STROKES[idx % VIRUS_STROKES.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {effectiveTab === 'wastewater' && hasWastewater && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="WASTEWATER_SIGNALS"
          />

          <div className="rounded-xl border border-line bg-surface p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-accent" />
                Alberta RVD COVID wastewater
              </h4>
              <p className="text-xs text-ink-3 max-w-3xl">
                Latest site snapshot and full COVID time series from Alberta RVD. Flu A / RSV fields are not shown on RVD cards (COVID-only snapshot).
              </p>
            </div>
            {wastewater.length > 0 && (
              <input
                type="search"
                value={wastewaterSearch}
                onChange={(e) => setWastewaterSearch(e.target.value)}
                placeholder="Filter site or zone"
                className="bg-paper text-sm border border-line rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none w-full md:w-56"
              />
            )}
          </div>

          {wastewater.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              Latest wastewater snapshot array is missing or empty.
            </div>
          ) : filteredWastewater.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              No wastewater sites match the current filter.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
                <h3 className="text-sm font-semibold text-ink">Latest COVID site signals</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wastewaterChartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis
                        dataKey="site"
                        stroke={CHART_TICK}
                        fontSize={8}
                        angle={-30}
                        textAnchor="end"
                        height={70}
                        interval={0}
                      />
                      <YAxis stroke={CHART_TICK} fontSize={9} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="covidSignal" name="COVID signal" fill={CHART_COVID} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWastewater.map((w) => {
                  const { chip } = activityTone(w.activityLevel);
                  return (
                    <div key={w.site} className="rounded-xl border border-line bg-surface p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-ink">{w.site}</p>
                          <p className="text-[10px] text-ink-3 font-mono">{w.zone}</p>
                          <p className="text-[10px] text-ink-3 font-mono">Sampled {w.sampleDate ?? 'unknown'}</p>
                        </div>
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full font-mono ${chip}`}
                        >
                          {w.activityLevel}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="block text-ink-3">COVID</span>
                          <strong className="text-ink font-mono tabular-nums">
                            {formatWastewaterSignal(w.covidSignal)}
                          </strong>
                        </div>
                        <div>
                          <span className="block text-ink-3">Trend</span>
                          <strong className={`font-medium ${trendTone(w.trend)}`}>{w.trend}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Site COVID time series</h3>
                <p className="text-xs text-ink-3">
                  Full Alberta RVD wastewater history for the selected site (normalized COVID load).
                </p>
              </div>
              {wwSites.length > 0 && (
                <select
                  value={selectedWwSite}
                  onChange={(e) => setSelectedWwSite(e.target.value)}
                  className="h-10 cursor-pointer rounded-lg border border-line bg-paper px-3 text-sm text-ink focus:border-accent focus:outline-none w-full md:w-64"
                  aria-label="Wastewater site"
                >
                  {wwSites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {wwTimeSeries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line-2 px-4 py-6 text-center text-sm text-ink-3">
                Wastewater time-series array is missing or empty.
              </div>
            ) : selectedWwSeries.length === 0 ? (
              <p className="text-sm text-ink-3">No time-series points for the selected site.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedWwSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="sampleDate" stroke={CHART_TICK} fontSize={9} />
                    <YAxis stroke={CHART_TICK} fontSize={9} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                      labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      formatter={(value: number | string) =>
                        typeof value === 'number' ? formatWastewaterSignal(value) : value
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="covidSignal"
                      name="COVID signal"
                      stroke={CHART_COVID}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="pt-3 border-t border-line text-xs text-ink-2 flex items-start gap-1.5 leading-relaxed">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Source: Alberta RVD wastewater surveillance (WASTEWATER_TIME_SERIES / WASTEWATER_SIGNALS). RVD COVID history begins ~2023-07.
              </span>
            </div>
          </div>

          {phacSeries.length > 0 && (
            <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">PHAC multi-pathogen wastewater</h3>
                  <p className="text-xs text-ink-3">
                    Edmonton / Calgary PHAC Infobase series. PHAC viral_load scale is not comparable to RVD normalized COVID load — never plotted on the same axis.
                  </p>
                </div>
                {phacSites.length > 0 && (
                  <select
                    value={selectedPhacSite}
                    onChange={(e) => setSelectedPhacSite(e.target.value)}
                    className="h-10 cursor-pointer rounded-lg border border-line bg-paper px-3 text-sm text-ink focus:border-accent focus:outline-none w-full md:w-64"
                    aria-label="PHAC wastewater site"
                  >
                    {phacSites.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {phacChart.points.length === 0 ? (
                <p className="text-sm text-ink-3">No PHAC points for the selected site.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={phacChart.points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="sampleDate" stroke={CHART_TICK} fontSize={9} />
                      <YAxis stroke={CHART_TICK} fontSize={9} />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {phacChart.pathogens.map((pathogen, idx) => (
                        <Line
                          key={pathogen}
                          type="monotone"
                          dataKey={pathogen}
                          name={pathogen}
                          stroke={strokeForLabel(pathogen, idx)}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="pt-3 border-t border-line text-xs text-ink-2 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span>
                  Source: PHAC Infobase (PHAC_WASTEWATER_TIME_SERIES). Kept separate from RVD COVID load because the measurement scales differ.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
