import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplet,
  Info,
  Layers,
  RefreshCw,
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
import type { WastewaterSignal } from '../publicHealthData';
import * as publicHealthData from '../publicHealthData';
import { DashboardHeader } from './DashboardHeader';
import { DataTimestamp } from './DataTimestamp';
import { useDomainData } from '../hooks/useDomainData';

/** RVD summary rows written by albertaRespiratoryVirusScraper. */
type RvdCaseCount = {
  virus: string;
  weekEnding: string;
  count: number;
};

type RvdImmunizationDose = {
  season: string;
  weekEnding: string;
  doses: number;
};

type PublicHealthData = {
  RESPIRATORY_VIRUS_SURVEILLANCE?: unknown[];
  WASTEWATER_SIGNALS: WastewaterSignal[];
  RVD_RESPIRATORY_CASE_COUNTS?: RvdCaseCount[];
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

const VIRUS_STROKES = [
  CHART_COVID,
  CHART_FLU,
  CHART_RSV,
  'oklch(0.78 0.12 155)', // ok
  'oklch(0.5 0.08 220)',
];

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

export default function PublicHealthDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<PublicHealthData>(
    'public-health',
    publicHealthData,
  );

  const [activeSubTab, setActiveSubTab] = useState<'respiratory' | 'wastewater'>('respiratory');
  const [wastewaterSearch, setWastewaterSearch] = useState('');

  const rvdCases = data?.RVD_RESPIRATORY_CASE_COUNTS ?? [];
  const wastewater = data?.WASTEWATER_SIGNALS ?? [];

  // Latest non-zero count per virus from RVD (no fabricated seasonal KPIs).
  const latestByVirus = useMemo(() => {
    const map = new Map<string, RvdCaseCount>();
    for (const row of rvdCases) {
      if (!row.virus || typeof row.count !== 'number') continue;
      const prev = map.get(row.virus);
      if (!prev || row.weekEnding > prev.weekEnding) map.set(row.virus, row);
    }
    return Array.from(map.values()).filter((r) => r.count > 0);
  }, [rvdCases]);

  // Time series for chart: pivot last N week endings × virus counts present upstream.
  const rvdChartData = useMemo(() => {
    const weeks = Array.from(new Set(rvdCases.map((r) => r.weekEnding))).sort();
    const lastWeeks = weeks.slice(-12);
    const viruses = Array.from(new Set(rvdCases.map((r) => r.virus)));
    return lastWeeks.map((week) => {
      const point: Record<string, string | number> = { weekEnding: week };
      for (const virus of viruses) {
        const hit = rvdCases.find((r) => r.weekEnding === week && r.virus === virus);
        if (hit && hit.count > 0) point[virus] = hit.count;
      }
      return point;
    });
  }, [rvdCases]);

  const virusKeys = useMemo(
    () => Array.from(new Set(rvdCases.map((r) => r.virus))).filter(Boolean),
    [rvdCases],
  );

  const filteredWastewater = useMemo(() => {
    const q = wastewaterSearch.toLowerCase();
    return wastewater.filter(
      (w) => w.site.toLowerCase().includes(q) || w.zone.toLowerCase().includes(q),
    );
  }, [wastewater, wastewaterSearch]);

  const wastewaterHasFlu = filteredWastewater.some((w) => w.fluASignal != null);
  const wastewaterHasRsv = filteredWastewater.some((w) => w.rsvSignal != null);

  const wastewaterChartData = useMemo(
    () =>
      filteredWastewater.map((w) => ({
        site: w.site,
        covidSignal: w.covidSignal,
        fluASignal: w.fluASignal,
        rsvSignal: w.rsvSignal,
        activityLevel: w.activityLevel,
        trend: w.trend,
        zone: w.zone,
      })),
    [filteredWastewater],
  );

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
          description="Alberta respiratory virus case counts and wastewater viral loads."
          metadata={metadata ?? undefined}
          arrayKey="WASTEWATER_SIGNALS"
          variant="light"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Failed to load public health data: {error}</span>
          <button
            onClick={() => refresh()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const hasRespiratory = rvdCases.length > 0;
  const hasWastewater = wastewater.length > 0;
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
        description="Alberta Respiratory Virus Dashboard case counts and wastewater viral loads only. Notifiable disease, childhood immunization, and environmental advisory panels are withheld until a verified upstream exists."
        metadata={metadata ?? undefined}
        arrayKey={headerArrayKey}
        variant="light"
      >
        <button
          onClick={() => !isLoading && refresh()}
          disabled={isLoading}
          className="self-start md:self-auto rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

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

          {latestByVirus.length === 0 ? (
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
                Direct Plotly extracts from the Alberta Respiratory Virus Dashboard summary tab. No seasonal positivity KPIs are invented.
              </p>
            </div>
            {rvdChartData.length === 0 ? (
              <p className="text-sm text-ink-3">No chartable RVD rows.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rvdChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="weekEnding" stroke={CHART_TICK} fontSize={9} />
                    <YAxis stroke={CHART_TICK} fontSize={9} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'oklch(0.2 0.022 255)',
                        border: '1px solid oklch(0.28 0.02 255)',
                        borderRadius: '8px',
                      }}
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
            <div className="pt-3 border-t border-line text-xs text-ink-2 flex items-start gap-1.5 leading-relaxed">
              <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                Source: Alberta Respiratory Virus Dashboard (RVD_RESPIRATORY_CASE_COUNTS). Hardcoded seasonal positivity and ICU KPI cards were removed.
              </span>
            </div>
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
                Wastewater viral load
              </h4>
              <p className="text-xs text-ink-3 max-w-3xl">
                PHAC Edmonton Gold Bar + Alberta RVD site traces. Only non-zero pathogen fields are charted.
              </p>
            </div>
            <input
              type="search"
              value={wastewaterSearch}
              onChange={(e) => setWastewaterSearch(e.target.value)}
              placeholder="Filter site or zone"
              className="bg-paper text-sm border border-line rounded-lg px-3 py-1.5 text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none w-full md:w-56"
            />
          </div>

          {filteredWastewater.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              No wastewater sites match the current filter.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
                <h3 className="text-sm font-semibold text-ink">Site signals</h3>
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
                        contentStyle={{
                          backgroundColor: 'oklch(0.2 0.022 255)',
                          border: '1px solid oklch(0.28 0.02 255)',
                          borderRadius: '8px',
                        }}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="covidSignal" name="COVID signal" fill={CHART_COVID} radius={[4, 4, 0, 0]} />
                      {wastewaterHasFlu && (
                        <Bar dataKey="fluASignal" name="Flu A signal" fill={CHART_FLU} radius={[4, 4, 0, 0]} />
                      )}
                      {wastewaterHasRsv && (
                        <Bar dataKey="rsvSignal" name="RSV signal" fill={CHART_RSV} radius={[4, 4, 0, 0]} />
                      )}
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
                        {w.fluASignal != null ? (
                          <div>
                            <span className="block text-ink-3">Flu A</span>
                            <strong className="text-warn font-mono tabular-nums">
                              {formatWastewaterSignal(w.fluASignal)}
                            </strong>
                          </div>
                        ) : (
                          <div>
                            <span className="block text-ink-3">Flu A</span>
                            <strong className="text-ink-3 font-mono">Not reported</strong>
                          </div>
                        )}
                        {w.rsvSignal != null ? (
                          <div>
                            <span className="block text-ink-3">RSV</span>
                            <strong className="text-crit font-mono tabular-nums">
                              {formatWastewaterSignal(w.rsvSignal)}
                            </strong>
                          </div>
                        ) : (
                          <div>
                            <span className="block text-ink-3">RSV</span>
                            <strong className="text-ink-3 font-mono">Not reported</strong>
                          </div>
                        )}
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
        </div>
      )}
    </div>
  );
}
