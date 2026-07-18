import React, { useState, useMemo } from 'react';
import {
  Activity,
  Droplet,
  AlertTriangle,
  Layers,
  ShieldAlert,
  Info,
  RefreshCw,
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
} from 'recharts';
import type { WastewaterSignal } from '../publicHealthData';
import * as publicHealthData from '../publicHealthData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
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

function formatWastewaterSignal(value: number): string {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs < 0.001 || abs >= 1_000_000) return value.toExponential(2);
  return abs < 1
    ? value.toFixed(3)
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
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
      (w) =>
        w.site.toLowerCase().includes(q) ||
        w.zone.toLowerCase().includes(q),
    );
  }, [wastewater, wastewaterSearch]);

  // Only show signal fields that are actually non-zero somewhere (comparable fields).
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

  const hasRespiratory = rvdCases.length > 0;
  const hasWastewater = wastewater.length > 0;
  // Prefer respiratory when present; otherwise fall through to wastewater.
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
          metadata={metadata}
          arrayKey="WASTEWATER_SIGNALS"
        />
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-sm text-slate-400">
          No verified public-health arrays are available from the current upstream pipelines.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={ShieldAlert}
        title="Public Health & Surveillance"
        description="Alberta Respiratory Virus Dashboard case counts and wastewater viral loads only. Notifiable disease, childhood immunization, and environmental advisory panels are withheld until a verified upstream exists."
        metadata={metadata}
        arrayKey={hasRespiratory ? 'RVD_RESPIRATORY_CASE_COUNTS' : 'WASTEWATER_SIGNALS'}
      />

      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        {hasRespiratory && (
          <button
            onClick={() => setActiveSubTab('respiratory')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
              effectiveTab === 'respiratory'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Respiratory Viruses</span>
          </button>
        )}
        {hasWastewater && (
          <button
            onClick={() => setActiveSubTab('wastewater')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
              effectiveTab === 'wastewater'
                ? 'border-blue-500 text-blue-400 bg-blue-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Wastewater Signals</span>
          </button>
        )}
      </div>

      {effectiveTab === 'respiratory' && hasRespiratory && (
        <div className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="RVD_RESPIRATORY_CASE_COUNTS" />

          {latestByVirus.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-sm text-slate-400">
              RVD case-count array is present but contains no non-zero counts for the latest weeks.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {latestByVirus.map((row) => (
                <div key={row.virus} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">
                    {row.virus}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{row.count.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400">cases</span>
                  </div>
                  <p className="text-[9px] text-slate-500 pt-1 border-t border-slate-850 font-mono">
                    Week ending {row.weekEnding}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Alberta RVD weekly case counts
              </h3>
              <p className="text-[10px] text-slate-500">
                Direct Plotly extracts from the Alberta Respiratory Virus Dashboard summary tab. No seasonal positivity KPIs are invented.
              </p>
            </div>
            {rvdChartData.length === 0 ? (
              <p className="text-sm text-slate-500">No chartable RVD rows.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rvdChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="weekEnding" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {virusKeys.map((virus, idx) => {
                      const colors = ['#f43f5e', '#f59e0b', '#6366f1', '#10b981', '#06b6d4'];
                      return (
                        <Line
                          key={virus}
                          type="monotone"
                          dataKey={virus}
                          name={virus}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Source: Alberta Respiratory Virus Dashboard (`RVD_RESPIRATORY_CASE_COUNTS`). Hardcoded seasonal positivity and ICU KPI cards were removed.
              </span>
            </div>
          </div>
        </div>
      )}

      {effectiveTab === 'wastewater' && hasWastewater && (
        <div className="space-y-6 animate-fadeIn">
          <DataTimestamp compact metadata={metadata} arrayKey="WASTEWATER_SIGNALS" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-cyan-400" />
                Wastewater viral load
              </h4>
              <p className="text-[11px] text-slate-400 max-w-3xl">
                PHAC Edmonton Gold Bar + Alberta RVD site traces. Only non-zero pathogen fields are charted.
              </p>
            </div>
            <input
              type="search"
              value={wastewaterSearch}
              onChange={(e) => setWastewaterSearch(e.target.value)}
              placeholder="Filter site or zone"
              className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500 w-full md:w-56"
            />
          </div>

          {filteredWastewater.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl text-sm text-slate-400">
              No wastewater sites match the current filter.
            </div>
          ) : (
            <>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Site signals</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wastewaterChartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="site" stroke="#64748b" fontSize={8} angle={-30} textAnchor="end" height={70} interval={0} />
                      <YAxis stroke="#64748b" fontSize={9} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="covidSignal" name="COVID signal" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      {wastewaterHasFlu && (
                        <Bar dataKey="fluASignal" name="Flu A signal" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      )}
                      {wastewaterHasRsv && (
                        <Bar dataKey="rsvSignal" name="RSV signal" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWastewater.map((w) => (
                  <div key={w.site} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{w.site}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{w.zone}</p>
                        <p className="text-[9px] text-slate-500 font-mono">Sampled {w.sampleDate ?? 'unknown'}</p>
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {w.activityLevel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>
                        <span className="block text-slate-500">COVID</span>
                        <strong className="text-cyan-300 font-mono">{formatWastewaterSignal(w.covidSignal)}</strong>
                      </div>
                      {w.fluASignal != null ? (
                        <div>
                          <span className="block text-slate-500">Flu A</span>
                          <strong className="text-amber-300 font-mono">{formatWastewaterSignal(w.fluASignal)}</strong>
                        </div>
                      ) : (
                        <div>
                          <span className="block text-slate-500">Flu A</span>
                          <strong className="text-slate-600 font-mono">Not reported</strong>
                        </div>
                      )}
                      {w.rsvSignal != null ? (
                        <div>
                          <span className="block text-slate-500">RSV</span>
                          <strong className="text-violet-300 font-mono">{formatWastewaterSignal(w.rsvSignal)}</strong>
                        </div>
                      ) : (
                        <div>
                          <span className="block text-slate-500">RSV</span>
                          <strong className="text-slate-600 font-mono">Not reported</strong>
                        </div>
                      )}
                      <div>
                        <span className="block text-slate-500">Trend</span>
                        <strong className="text-slate-200">{w.trend}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
