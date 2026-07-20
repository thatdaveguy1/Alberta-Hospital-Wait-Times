import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  Layers,
  Coins,
  Scale,
  Globe,
  BarChart2,
  X,
  AlertTriangle,
  RefreshCw,
  ArrowRightLeft,
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
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import type {
  NationalSpendingCompare,
  ActivityVolumeTrend,
  PhysicianPaymentSpecialty,
  SpendingByUseOfFunds,
  ProvincialSpendingTrend,
  ProvincialUseOfFunds,
} from '../spendingData';
import * as spendingData from '../spendingData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type SpendingData = {
  NATIONAL_SPENDING_COMPARE: NationalSpendingCompare[];
  ALBERTA_ACTIVITY_VOLUME_TREND: ActivityVolumeTrend[];
  PHYSICIAN_SPECIALTY_BILLING: PhysicianPaymentSpecialty[];
  ALBERTA_USE_OF_FUNDS: SpendingByUseOfFunds[];
  PROVINCIAL_SPENDING_TREND: ProvincialSpendingTrend[];
  PROVINCIAL_USE_OF_FUNDS: ProvincialUseOfFunds[];
};

const COLORS = [
  'oklch(0.68 0.13 252)',
  'oklch(0.78 0.12 155)',
  'oklch(0.82 0.12 85)',
  'oklch(0.7 0.15 340)',
  'oklch(0.75 0.14 25)',
  'oklch(0.65 0.12 300)',
  'oklch(0.7 0.12 200)',
];

const MAJOR_PEER_SET = new Set([
  'Alberta',
  'British Columbia',
  'Saskatchewan',
  'Manitoba',
  'Ontario',
  'Quebec',
  'Canada',
]);

const PROVINCE_SHORT: Record<string, string> = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Saskatchewan: 'SK',
  Manitoba: 'MB',
  Ontario: 'ON',
  Quebec: 'QC',
  'New Brunswick': 'NB',
  'Nova Scotia': 'NS',
  'Prince Edward Island': 'PE',
  'Newfoundland and Labrador': 'NL',
  Yukon: 'YT',
  'Northwest Territories': 'NT',
  Nunavut: 'NU',
  Canada: 'CA',
};

type CompareMetricKey =
  | 'spendingPerCapita'
  | 'hospitalSpendingPerCapita'
  | 'physicianSpendingPerCapita'
  | 'drugSpendingPerCapita'
  | 'bedsPer100k'
  | 'costPerStandardStay';

const COMPARE_METRICS: {
  key: CompareMetricKey;
  label: string;
  lowerIsBetter?: boolean;
  format: (v: number) => string;
}[] = [
  {
    key: 'spendingPerCapita',
    label: 'Total spend / capita',
    format: (v) => `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: 'hospitalSpendingPerCapita',
    label: 'Hospital spend / capita',
    format: (v) => `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: 'physicianSpendingPerCapita',
    label: 'Physician spend / capita',
    format: (v) => `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: 'drugSpendingPerCapita',
    label: 'Drug spend / capita',
    format: (v) => `$${Math.round(v).toLocaleString()}`,
  },
  {
    key: 'bedsPer100k',
    label: 'Staffed beds / 100k',
    format: (v) => v.toFixed(1),
  },
  {
    key: 'costPerStandardStay',
    label: 'Cost per standard stay',
    lowerIsBetter: true,
    format: (v) => `$${Math.round(v).toLocaleString()}`,
  },
];

const getSpecialtyLabel = (name: string): string => {
  if (name.includes('General Practice')) return 'Family Medicine';
  if (name.includes('General & Thoracic')) return 'Surgery';
  if (name.includes('Internal')) return 'Internal Med';
  return name;
};

const formatFiscalYearShort = (fy: string): string => {
  const match = fy.match(/^(\d{4})-\d{2}(\d{2})$/);
  return match ? `${match[1]}-${match[2]}` : fy;
};

const isMeasuredNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

const firstMeasuredIndex = (data: ActivityVolumeTrend[], key: keyof ActivityVolumeTrend): number => {
  return data.findIndex((d) => isMeasuredNumber(d[key]));
};

const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'oklch(0.2 0.022 255)',
    border: '1px solid oklch(0.28 0.02 255)',
    borderRadius: '8px',
  },
  itemStyle: { color: 'oklch(0.96 0.008 255)' },
  labelStyle: { color: 'oklch(0.78 0.015 255)' },
};

const metricValue = (row: NationalSpendingCompare | undefined, key: CompareMetricKey): number | null => {
  if (!row) return null;
  const v = row[key];
  return isMeasuredNumber(v) ? v : null;
};

export default function SpendingDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<SpendingData>('spending', spendingData);
  const NATIONAL_SPENDING_COMPARE = data?.NATIONAL_SPENDING_COMPARE ?? [];
  const ALBERTA_ACTIVITY_VOLUME_TREND = data?.ALBERTA_ACTIVITY_VOLUME_TREND ?? [];
  const PHYSICIAN_SPECIALTY_BILLING = data?.PHYSICIAN_SPECIALTY_BILLING ?? [];
  const ALBERTA_USE_OF_FUNDS = data?.ALBERTA_USE_OF_FUNDS ?? [];
  const PROVINCIAL_SPENDING_TREND = data?.PROVINCIAL_SPENDING_TREND ?? [];
  const PROVINCIAL_USE_OF_FUNDS = data?.PROVINCIAL_USE_OF_FUNDS ?? [];

  const [activeSpendingTab, setActiveSpendingTab] = useState<
    'national-scoreboard' | 'spending-access' | 'physician-payments'
  >('national-scoreboard');
  const [peerMode, setPeerMode] = useState<'major' | 'all'>('major');
  const [compareProvince, setCompareProvince] = useState<string>('British Columbia');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('General Practice / Family Medicine');
  const [selectedActivityKpi, setSelectedActivityKpi] = useState<'totalExpenseBillions' | null>(null);
  const [sortMetric, setSortMetric] = useState<CompareMetricKey>('spendingPerCapita');

  const peerRows = useMemo(() => {
    if (peerMode === 'major') {
      return NATIONAL_SPENDING_COMPARE.filter((p) => MAJOR_PEER_SET.has(p.province));
    }
    return NATIONAL_SPENDING_COMPARE;
  }, [NATIONAL_SPENDING_COMPARE, peerMode]);

  const albertaProvinceData = useMemo(
    () => NATIONAL_SPENDING_COMPARE.find((p) => p.province === 'Alberta'),
    [NATIONAL_SPENDING_COMPARE],
  );

  const compareProvinceData = useMemo(() => {
    return (
      NATIONAL_SPENDING_COMPARE.find((p) => p.province === compareProvince) ||
      peerRows.find((p) => p.province !== 'Alberta') ||
      NATIONAL_SPENDING_COMPARE[0]
    );
  }, [NATIONAL_SPENDING_COMPARE, compareProvince, peerRows]);

  const compareChoices = useMemo(() => {
    return peerRows.filter((p) => p.province !== 'Alberta');
  }, [peerRows]);

  // Keep compare target valid when peer filter changes.
  useEffect(() => {
    if (!compareChoices.some((p) => p.province === compareProvince)) {
      const fallback =
        compareChoices.find((p) => p.province === 'British Columbia')?.province ||
        compareChoices.find((p) => p.province === 'Canada')?.province ||
        compareChoices[0]?.province;
      if (fallback) setCompareProvince(fallback);
    }
  }, [compareChoices, compareProvince]);

  const { albertaSpendingPerCapita, albertaSpendingRank, higherSpendingProvinces, albertaPeerRank } = useMemo(() => {
    const universe = peerRows.length > 0 ? peerRows : NATIONAL_SPENDING_COMPARE;
    const ranked = [...universe]
      .filter((p) => p.province !== 'Canada')
      .sort((a, b) => b.spendingPerCapita - a.spendingPerCapita);
    const alberta = NATIONAL_SPENDING_COMPARE.find((p) => p.province === 'Alberta');
    const rank = ranked.findIndex((p) => p.province === 'Alberta') + 1;
    const higher = ranked
      .filter((p) => p.province !== 'Alberta' && p.spendingPerCapita > (alberta?.spendingPerCapita ?? 0))
      .slice(0, 3)
      .map((p) => p.province);
    return {
      albertaSpendingPerCapita: alberta?.spendingPerCapita ?? 0,
      albertaSpendingRank: rank,
      higherSpendingProvinces: higher,
      albertaPeerRank: rank > 0 ? `${rank} of ${ranked.length}` : '—',
    };
  }, [NATIONAL_SPENDING_COMPARE, peerRows]);

  const varianceRows = useMemo(() => {
    if (!albertaProvinceData || !compareProvinceData) return [];
    return COMPARE_METRICS.map((m) => {
      const ab = metricValue(albertaProvinceData, m.key);
      const peer = metricValue(compareProvinceData, m.key);
      const diff = ab != null && peer != null ? ab - peer : null;
      return { ...m, ab, peer, diff };
    });
  }, [albertaProvinceData, compareProvinceData]);

  const sortedPeerTable = useMemo(() => {
    const rows = [...peerRows];
    rows.sort((a, b) => {
      const av = metricValue(a, sortMetric);
      const bv = metricValue(b, sortMetric);
      if (av == null && bv == null) return a.province.localeCompare(b.province);
      if (av == null) return 1;
      if (bv == null) return -1;
      const metric = COMPARE_METRICS.find((m) => m.key === sortMetric);
      return metric?.lowerIsBetter ? av - bv : bv - av;
    });
    return rows;
  }, [peerRows, sortMetric]);

  const chartPeers = useMemo(() => {
    return [...peerRows]
      .filter((p) => p.province !== 'Canada')
      .sort((a, b) => b.spendingPerCapita - a.spendingPerCapita);
  }, [peerRows]);

  const trendChartData = useMemo(() => {
    if (PROVINCIAL_SPENDING_TREND.length === 0) return [];
    const focus = new Set(['Alberta', compareProvince, 'Canada']);
    const byYear = new Map<string, Record<string, string | number>>();
    for (const row of PROVINCIAL_SPENDING_TREND) {
      if (!focus.has(row.province)) continue;
      // Keep recent history readable in the default view.
      if (Number(row.year) < 2005) continue;
      const key = row.year;
      const existing = byYear.get(key) ?? { year: key };
      existing[row.province] = row.spendingPerCapita;
      byYear.set(key, existing);
    }
    return [...byYear.values()].sort((a, b) => String(a.year).localeCompare(String(b.year)));
  }, [PROVINCIAL_SPENDING_TREND, compareProvince]);

  const compositionChartData = useMemo(() => {
    const focusProvinces = peerRows.map((p) => p.province).filter((p) => p !== 'Canada');
    const categories = [
      ...new Set(
        PROVINCIAL_USE_OF_FUNDS.filter(
          (r) =>
            focusProvinces.includes(r.province) &&
            !/sub-?total/i.test(r.category) &&
            r.category.toLowerCase() !== 'total',
        ).map((r) => r.category),
      ),
    ];
    // Prefer a stable short list of major categories for stacked bars.
    const preferred = [
      'Hospitals & Acute Care',
      'Physician Payments',
      'Drugs & Therapeutics',
      'Long-Term & Continuing Care',
      'Public Health & Prevention',
      'Administration & Infrastructure',
      'Allied & Other Professionals',
      'Other Health Spending',
    ];
    const orderedCats = [
      ...preferred.filter((c) => categories.includes(c)),
      ...categories.filter((c) => !preferred.includes(c)),
    ].slice(0, 8);

    return focusProvinces.map((province) => {
      const row: Record<string, string | number> = {
        province: PROVINCE_SHORT[province] ?? province,
        fullName: province,
      };
      for (const cat of orderedCats) {
        const hit = PROVINCIAL_USE_OF_FUNDS.find((r) => r.province === province && r.category === cat);
        row[cat] = hit?.percentageShare ?? 0;
      }
      return row;
    });
  }, [PROVINCIAL_USE_OF_FUNDS, peerRows]);

  const compositionCategories = useMemo(() => {
    if (compositionChartData.length === 0) return [] as string[];
    return Object.keys(compositionChartData[0]).filter((k) => k !== 'province' && k !== 'fullName');
  }, [compositionChartData]);

  const selectedSpecialtyData = useMemo(() => {
    return (
      PHYSICIAN_SPECIALTY_BILLING.find((s) => s.specialtyGroup === selectedSpecialty) ||
      PHYSICIAN_SPECIALTY_BILLING[0]
    );
  }, [selectedSpecialty, PHYSICIAN_SPECIALTY_BILLING]);

  const expenseTrend = useMemo(() => {
    return ALBERTA_ACTIVITY_VOLUME_TREND.filter((r) => isMeasuredNumber(r.totalExpenseBillions));
  }, [ALBERTA_ACTIVITY_VOLUME_TREND]);

  const filteredExpenseTrend = useMemo(() => {
    if (!selectedActivityKpi) return expenseTrend;
    const idx = firstMeasuredIndex(expenseTrend, selectedActivityKpi);
    return idx === -1 ? [] : expenseTrend.slice(idx);
  }, [selectedActivityKpi, expenseTrend]);

  const latestAlbertaActivity = expenseTrend.length > 0 ? expenseTrend[expenseTrend.length - 1] : null;
  const expenseVsPrevPct = useMemo(() => {
    if (expenseTrend.length < 2) return null;
    const latest = expenseTrend[expenseTrend.length - 1];
    const prev = expenseTrend[expenseTrend.length - 2];
    const latestVal = latest.totalExpenseBillions;
    const prevVal = prev.totalExpenseBillions;
    if (!isMeasuredNumber(prevVal) || !isMeasuredNumber(latestVal)) return null;
    const pct = ((latestVal - prevVal) / prevVal) * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}% vs prev`;
  }, [expenseTrend]);

  const activityKpiDetails = useMemo(() => {
    if (!selectedActivityKpi) return null;
    return {
      label: 'Alberta Total Health Expenditure',
      description:
        'Total current-dollar health expenditure for Alberta from CIHI NHEX Table O.1 (public + private). Volume/activity series are not sourced and are not shown.',
      colorClass: 'text-ok',
      strokeColor: 'oklch(0.78 0.12 155)',
      gradientId: 'colorActivityExpense',
      unit: 'B',
      icon: Coins,
    };
  }, [selectedActivityKpi]);

  const activityKpiStats = useMemo(() => {
    if (!selectedActivityKpi) return null;
    const values = filteredExpenseTrend.map((t) => t.totalExpenseBillions).filter(isMeasuredNumber);
    if (values.length === 0) return null;
    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;
    const fmt = (v: number) => (v >= 1000 ? v.toLocaleString() : v.toFixed(1));
    return {
      baseline: fmt(baseline),
      latest: fmt(latest),
      peak: fmt(peak),
      minVal: fmt(minVal),
      delta: rawDelta > 0 ? `+${fmt(rawDelta)}` : fmt(rawDelta),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0,
    };
  }, [selectedActivityKpi, filteredExpenseTrend]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-ink-2 text-sm">
        Loading spending data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ink-2 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-warn" />
        <span>Failed to load spending data: {error}</span>
        <button
          onClick={refresh}
          className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div id="spending-dashboard-container" className="space-y-6">
      <DashboardHeader
        variant="light"
        icon={Coins}
        title="Health Expenditures"
        description="Province-first NHEX comparisons, Alberta fiscal detail, and AHCIP physician billings."
        metadata={metadata ?? undefined}
        arrayKey="NATIONAL_SPENDING_COMPARE"
      />

      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5" role="tablist" aria-label="Spending views">
        <button
          onClick={() => setActiveSpendingTab('national-scoreboard')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
            activeSpendingTab === 'national-scoreboard' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Province Compare</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('spending-access')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
            activeSpendingTab === 'spending-access' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Alberta Detail</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('physician-payments')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-2 cursor-pointer ${
            activeSpendingTab === 'physician-payments' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Physician Payments</span>
        </button>
      </div>

      {activeSpendingTab === 'national-scoreboard' && (
        <div
          id="sd-narrative-callout"
          className="bg-surface border border-line p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5 font-mono">
              <Globe className="w-4.5 h-4.5 text-accent" />
              <span>Alberta-anchored provincial comparison</span>
            </h4>
            <p className="text-[11px] text-ink-2 max-w-4xl leading-normal">
              Alberta per-capita spend is{' '}
              <strong>{albertaSpendingPerCapita > 0 ? `$${albertaSpendingPerCapita.toLocaleString()}` : '—'}</strong>
              {albertaSpendingRank > 0 ? (
                <>
                  {' '}
                  (rank <strong>{albertaPeerRank}</strong> in the current peer set
                  {higherSpendingProvinces.length > 0 ? `, below ${higherSpendingProvinces.join(', ')}` : ''}).
                </>
              ) : null}{' '}
              Territories inflate all-Canada ranks — default peer set is major provinces + Canada.
            </p>
          </div>
          <span className="text-[9px] bg-ok-soft border border-ok/30 text-ok px-2 py-1 rounded font-mono font-semibold shrink-0">
            CIHI NHEX
          </span>
        </div>
      )}

      {activeSpendingTab === 'spending-access' && (
        <div
          id="sd-narrative-callout"
          className="bg-surface border border-line p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5 font-mono">
              <Scale className="w-4.5 h-4.5 text-ok" />
              <span>NHEX expenditure & use of funds</span>
            </h4>
            <p className="text-[11px] text-ink-2 max-w-4xl leading-normal">
              Alberta-only total expenditure trend and Series D1 public use-of-funds mix. Cross-province trends live on
              Province Compare.
            </p>
          </div>
          <span className="text-[9px] bg-ok-soft border border-ok/30 text-ok px-2 py-1 rounded font-mono font-semibold shrink-0">
            CIHI NHEX
          </span>
        </div>
      )}

      {activeSpendingTab === 'physician-payments' && (
        <div
          id="sd-narrative-callout"
          className="bg-surface border border-line p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5 font-mono">
              <Users className="w-4.5 h-4.5 text-accent" />
              <span>Physician payment mix</span>
            </h4>
            <p className="text-[11px] text-ink-2 max-w-4xl leading-normal">
              Gross payments from the AHCIP statistical supplement (Open Alberta). Services-per-patient is shown only when
              Table 2.14 supplies registered persons for that specialty.
            </p>
          </div>
        </div>
      )}

      {activeSpendingTab === 'national-scoreboard' && (
        <div id="sd-national-scoreboard-panel" className="space-y-6">
          <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="NATIONAL_SPENDING_COMPARE" />

          {NATIONAL_SPENDING_COMPARE.length === 0 || !albertaProvinceData ? (
            <div className="bg-surface border border-line p-6 rounded-xl text-sm text-ink-2">
              No measured national spending compare rows are available from CIHI NHEX.
            </div>
          ) : (
            <>
              <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-ink-2 font-mono flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-accent" />
                      Alberta vs peer variance
                    </h3>
                    <p className="text-[10px] text-ink-3 mt-1">
                      Fixed Alberta column with selectable peer. Null metrics show as unavailable — never coerced to 0.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
                      <button
                        onClick={() => setPeerMode('major')}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md cursor-pointer ${
                          peerMode === 'major' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
                        }`}
                      >
                        Major provinces
                      </button>
                      <button
                        onClick={() => setPeerMode('all')}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md cursor-pointer ${
                          peerMode === 'all' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'
                        }`}
                      >
                        All P/Ts
                      </button>
                    </div>
                    <label className="text-[10px] text-ink-2 font-semibold flex items-center gap-2">
                      Compare with
                      <select
                        value={compareProvince}
                        onChange={(e) => setCompareProvince(e.target.value)}
                        className="bg-paper border border-line rounded-lg text-xs text-ink px-3 py-1.5 focus:border-accent focus:outline-none"
                      >
                        {compareChoices.map((p) => (
                          <option key={p.province} value={p.province}>
                            {p.province}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-surface border-b border-line text-[10px] font-semibold text-ink-2">
                        <th className="p-3">Metric</th>
                        <th className="p-3 text-crit">Alberta</th>
                        <th className="p-3 text-accent">{compareProvince}</th>
                        <th className="p-3 text-center">Variance (AB − peer)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {varianceRows.map((row) => {
                        const unavailable = row.ab == null || row.peer == null || row.diff == null;
                        const better =
                          row.diff == null
                            ? null
                            : row.lowerIsBetter
                              ? row.diff <= 0
                              : row.diff >= 0;
                        return (
                          <tr key={row.key}>
                            <td className="p-3 text-ink">{row.label}</td>
                            <td className="p-3 text-ink font-mono">{row.ab == null ? '—' : row.format(row.ab)}</td>
                            <td className="p-3 text-ink-2 font-mono">
                              {row.peer == null ? '—' : row.format(row.peer)}
                            </td>
                            <td className="p-3 text-center font-mono">
                              {unavailable ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface text-ink-3 border border-line">
                                  —
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    better ? 'bg-ok-soft text-ok' : 'bg-crit-soft text-crit'
                                  }`}
                                >
                                  {row.diff! >= 0 ? '+' : ''}
                                  {row.key.includes('PerCapita') || row.key === 'costPerStandardStay'
                                    ? `$${Math.round(row.diff!).toLocaleString()}`
                                    : row.diff!.toFixed(1)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-ink-2 font-mono">Peer scoreboard matrix</h3>
                    <p className="text-[10px] text-ink-3 mt-1">
                      Sort by metric. Alberta rows stay highlighted. Canada included in major-peer mode as a benchmark.
                    </p>
                  </div>
                  <label className="text-[10px] text-ink-2 font-semibold flex items-center gap-2">
                    Sort by
                    <select
                      value={sortMetric}
                      onChange={(e) => setSortMetric(e.target.value as CompareMetricKey)}
                      className="bg-paper border border-line rounded-lg text-xs text-ink px-3 py-1.5 focus:border-accent focus:outline-none"
                    >
                      {COMPARE_METRICS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto rounded-xl border border-line bg-paper">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-surface border-b border-line text-[10px] font-semibold text-ink-2">
                        <th className="p-2.5">Province</th>
                        {COMPARE_METRICS.map((m) => (
                          <th key={m.key} className="p-2.5 whitespace-nowrap">
                            {m.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPeerTable.map((row) => {
                        const isAb = row.province === 'Alberta';
                        const isPeer = row.province === compareProvince;
                        return (
                          <tr
                            key={row.province}
                            className={`border-b border-line/60 ${
                              isAb ? 'bg-crit-soft/30' : isPeer ? 'bg-accent/10' : ''
                            }`}
                          >
                            <td className="p-2.5 font-semibold text-ink whitespace-nowrap">
                              {row.province}
                              {isAb ? ' ★' : ''}
                            </td>
                            {COMPARE_METRICS.map((m) => {
                              const v = metricValue(row, m.key);
                              return (
                                <td key={m.key} className="p-2.5 font-mono text-ink-2 whitespace-nowrap">
                                  {v == null ? '—' : m.format(v)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-semibold text-ink-2 font-mono">Total health spending per capita</h3>
                  {chartPeers.length === 0 ? (
                    <p className="text-sm text-ink-3">No measured national spending compare rows available.</p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartPeers} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                          <XAxis
                            dataKey="province"
                            stroke="oklch(0.62 0.02 255)"
                            fontSize={9}
                            tickFormatter={(v) => PROVINCE_SHORT[String(v)] ?? String(v).slice(0, 3)}
                          />
                          <YAxis stroke="oklch(0.78 0.12 155)" fontSize={9} />
                          <Tooltip {...chartTooltipStyle} />
                          <Bar dataKey="spendingPerCapita" name="Per Capita ($)" radius={[4, 4, 0, 0]}>
                            {chartPeers.map((entry) => (
                              <Cell
                                key={entry.province}
                                fill={
                                  entry.province === 'Alberta'
                                    ? 'oklch(0.75 0.14 25)'
                                    : entry.province === compareProvince
                                      ? 'oklch(0.68 0.13 252)'
                                      : 'oklch(0.78 0.12 155)'
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold text-ink-2 font-mono">Per-capita trend (2005+)</h3>
                      <p className="text-[10px] text-ink-3 mt-1">Alberta vs selected peer vs Canada</p>
                    </div>
                    <DataTimestamp
                      compact
                      variant="light"
                      metadata={metadata ?? undefined}
                      arrayKey="PROVINCIAL_SPENDING_TREND"
                    />
                  </div>
                  {trendChartData.length === 0 ? (
                    <p className="text-sm text-ink-3">
                      Multi-year provincial series not available yet — refresh CIHI NHEX extract.
                    </p>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                          <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={9} />
                          <YAxis stroke="oklch(0.62 0.02 255)" fontSize={9} />
                          <Tooltip {...chartTooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Line
                            type="monotone"
                            dataKey="Alberta"
                            stroke="oklch(0.75 0.14 25)"
                            strokeWidth={2.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                          {compareProvince !== 'Alberta' && (
                            <Line
                              type="monotone"
                              dataKey={compareProvince}
                              stroke="oklch(0.68 0.13 252)"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
                          {compareProvince !== 'Canada' && (
                            <Line
                              type="monotone"
                              dataKey="Canada"
                              stroke="oklch(0.62 0.02 255)"
                              strokeWidth={1.5}
                              strokeDasharray="4 4"
                              dot={false}
                              isAnimationActive={false}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-ink-2 font-mono">
                      Public use-of-funds mix by province
                    </h3>
                    <p className="text-[10px] text-ink-3 mt-1">
                      Latest non-forecast NHEX year, public sector shares of each province&apos;s public total.
                    </p>
                  </div>
                  <DataTimestamp
                    compact
                    variant="light"
                    metadata={metadata ?? undefined}
                    arrayKey="PROVINCIAL_USE_OF_FUNDS"
                  />
                </div>
                {compositionChartData.length === 0 || compositionCategories.length === 0 ? (
                  <p className="text-sm text-ink-3">
                    Provincial use-of-funds composition not available yet — refresh CIHI NHEX extract.
                  </p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compositionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="province" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis stroke="oklch(0.62 0.02 255)" fontSize={9} unit="%" />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        {compositionCategories.map((cat, idx) => (
                          <Bar
                            key={cat}
                            dataKey={cat}
                            stackId="uof"
                            fill={COLORS[idx % COLORS.length]}
                            isAnimationActive={false}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                <h3 className="text-xs font-semibold text-ink-2 font-mono">Cost of a standard hospital stay</h3>
                {chartPeers.filter((p) => isMeasuredNumber(p.costPerStandardStay)).length === 0 ? (
                  <p className="text-sm text-ink-3">No measured CSHS values available for provinces in this extract.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartPeers.filter((p) => isMeasuredNumber(p.costPerStandardStay))}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis
                          dataKey="province"
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          tickFormatter={(v) => PROVINCE_SHORT[String(v)] ?? String(v).slice(0, 3)}
                        />
                        <YAxis stroke="oklch(0.62 0.02 255)" fontSize={9} />
                        <Tooltip {...chartTooltipStyle} />
                        <Bar dataKey="costPerStandardStay" name="CSHS ($)" radius={[4, 4, 0, 0]}>
                          {chartPeers
                            .filter((p) => isMeasuredNumber(p.costPerStandardStay))
                            .map((entry) => (
                              <Cell
                                key={entry.province}
                                fill={
                                  entry.province === 'Alberta' ? 'oklch(0.75 0.14 25)' : 'oklch(0.62 0.02 255)'
                                }
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeSpendingTab === 'spending-access' && (
        <div id="sd-spending-access-panel" className="space-y-6">
          <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="ALBERTA_ACTIVITY_VOLUME_TREND" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedActivityKpi(selectedActivityKpi === 'totalExpenseBillions' ? null : 'totalExpenseBillions')
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(
                    selectedActivityKpi === 'totalExpenseBillions' ? null : 'totalExpenseBillions',
                  );
                }
              }}
              className={`bg-surface border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none ${
                selectedActivityKpi === 'totalExpenseBillions' ? 'border-ok' : 'border-line hover:border-ok'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-ink-2 font-semibold block leading-snug">Total Health Expenditure</span>
                <Coins className="w-3.5 h-3.5 text-ok shrink-0" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-semibold text-ok">
                    {latestAlbertaActivity && isMeasuredNumber(latestAlbertaActivity.totalExpenseBillions)
                      ? `$${latestAlbertaActivity.totalExpenseBillions}B`
                      : '—'}
                  </span>
                </div>
                <span className="text-[10px] text-ok font-mono font-semibold">{expenseVsPrevPct ?? '—'}</span>
              </div>
              <p className="text-[9px] text-ink-2 pt-1.5 border-t border-line font-medium">
                CIHI NHEX Alberta total (public + private current dollars).
              </p>
              <span className="text-[9px] text-ink-3 group-hover:text-ok font-semibold flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'totalExpenseBillions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div className="bg-surface border border-line p-4 rounded-xl space-y-2 flex flex-col justify-between md:col-span-2">
              <span className="text-[10px] text-ink-2 font-semibold block leading-snug">Unsupported activity volumes</span>
              <p className="text-[11px] text-ink-3 leading-relaxed">
                Surgeries, CT exams, lab tests, ED visits, hospital admissions, and physician FTE activity series are not
                present in the NHEX Table O.1 extract. Those cards and the productivity index chart have been removed
                rather than showing hand-authored or zero-filled values.
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedActivityKpi && activityKpiDetails && activityKpiStats && (
              <motion.div
                key={`activity-kpi-trend-${selectedActivityKpi}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-xl bg-surface border border-line space-y-6 relative">
                  <button
                    onClick={() => setSelectedActivityKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-paper border border-line hover:border-line-2 text-ink-2 hover:text-ink transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                        {React.createElement(activityKpiDetails.icon, {
                          className: `w-4 h-4 ${activityKpiDetails.colorClass}`,
                        })}
                        <span>{activityKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">{activityKpiDetails.description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-paper border border-line">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">
                        Baseline (
                        {filteredExpenseTrend[0]?.fiscalYear
                          ? formatFiscalYearShort(filteredExpenseTrend[0].fiscalYear)
                          : '—'}
                        )
                      </span>
                      <span className="text-xl font-semibold text-ink font-mono">
                        {activityKpiStats.baseline}
                        {activityKpiDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">
                        Current (
                        {filteredExpenseTrend[filteredExpenseTrend.length - 1]?.fiscalYear
                          ? formatFiscalYearShort(filteredExpenseTrend[filteredExpenseTrend.length - 1].fiscalYear)
                          : '—'}
                        )
                      </span>
                      <span className="text-xl font-semibold text-ink font-mono">
                        {activityKpiStats.latest}
                        {activityKpiDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Series Peak</span>
                      <span className={`text-xl font-semibold font-mono ${activityKpiDetails.colorClass}`}>
                        {activityKpiStats.peak}
                        {activityKpiDetails.unit}
                      </span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Overall Shift</span>
                      <span
                        className={`text-xl font-semibold font-mono flex items-center justify-center sm:justify-start gap-1 ${
                          activityKpiStats.isIncrease ? 'text-crit' : 'text-ok'
                        }`}
                      >
                        {activityKpiStats.isIncrease ? (
                          <TrendingUp className="w-4 h-4 shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 shrink-0" />
                        )}
                        <span>
                          {activityKpiStats.delta}
                          {activityKpiDetails.unit} ({activityKpiStats.pctChange})
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    {filteredExpenseTrend.length === 0 ? (
                      <p className="text-sm text-ink-3">No measured NHEX expenditure years available.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={filteredExpenseTrend} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={activityKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={activityKpiDetails.strokeColor} stopOpacity={0.2} />
                              <stop offset="95%" stopColor={activityKpiDetails.strokeColor} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                          <XAxis
                            dataKey="fiscalYear"
                            stroke="oklch(0.62 0.02 255)"
                            style={{ fontSize: 10, fontFamily: 'monospace' }}
                          />
                          <YAxis
                            stroke="oklch(0.62 0.02 255)"
                            style={{ fontSize: 10, fontFamily: 'monospace' }}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip {...chartTooltipStyle} />
                          <Area
                            type="monotone"
                            dataKey="totalExpenseBillions"
                            name={activityKpiDetails.label}
                            stroke={activityKpiDetails.strokeColor}
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill={`url(#${activityKpiDetails.gradientId})`}
                            dot={{ r: 4, strokeWidth: 1 }}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
              <div>
                <h3 className="text-xs font-semibold text-ink-2 font-mono">Alberta total health expenditure (NHEX)</h3>
                <p className="text-[10px] text-ink-3 mt-1">
                  Measured total expense only — activity volume series not sourced.
                </p>
                <DataTimestamp
                  compact
                  variant="light"
                  metadata={metadata ?? undefined}
                  arrayKey="ALBERTA_ACTIVITY_VOLUME_TREND"
                />
              </div>
              {expenseTrend.length === 0 ? (
                <p className="text-sm text-ink-3">No measured Alberta expenditure years from CIHI NHEX.</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={expenseTrend} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                      <XAxis dataKey="fiscalYear" stroke="oklch(0.62 0.02 255)" fontSize={9} />
                      <YAxis
                        stroke="oklch(0.62 0.02 255)"
                        fontSize={9}
                        label={{
                          value: 'CAD billions',
                          angle: -90,
                          position: 'insideLeft',
                          fill: 'oklch(0.62 0.02 255)',
                          fontSize: 10,
                          offset: 10,
                        }}
                      />
                      <Tooltip {...chartTooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="totalExpenseBillions"
                        stroke="oklch(0.78 0.12 155)"
                        strokeWidth={3}
                        name="Total expenditure ($B)"
                        activeDot={{ r: 6 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-surface border border-line p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-ink-2 font-mono">Use of Alberta Health Public Funds</h3>
                <p className="text-[10px] text-ink-3">
                  Distribution of public health expenditure by category (CIHI NHEX Series D1)
                </p>
                <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="ALBERTA_USE_OF_FUNDS" />
              </div>

              {ALBERTA_USE_OF_FUNDS.length === 0 ? (
                <p className="text-sm text-ink-3">
                  Use-of-funds breakdown unavailable until CIHI Series D1 is successfully refreshed.
                </p>
              ) : (
                <>
                  <div className="h-44 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ALBERTA_USE_OF_FUNDS}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="amountBillions"
                        >
                          {ALBERTA_USE_OF_FUNDS.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...chartTooltipStyle} formatter={(value) => `$${value} Billion`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-2 mt-2">
                    {ALBERTA_USE_OF_FUNDS.map((fund, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded-md hover:bg-paper transition-all"
                      >
                        <div className="flex items-center gap-2 text-ink min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                          />
                          <span className="truncate font-medium">{fund.category}</span>
                        </div>
                        <span className="text-ink font-mono font-semibold shrink-0">
                          ${fund.amountBillions.toFixed(2)}B ({fund.percentageShare}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'physician-payments' && (
        <div id="sd-physician-payments-panel" className="space-y-6">
          <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="PHYSICIAN_SPECIALTY_BILLING" />

          {PHYSICIAN_SPECIALTY_BILLING.length === 0 || !selectedSpecialtyData ? (
            <div className="bg-surface border border-line p-6 rounded-xl text-sm text-ink-2">
              No measured AHCIP specialty billing rows are available. Payments are not shown until Open Alberta billing
              refresh succeeds.
            </div>
          ) : (
            <>
              <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-ink-2 font-mono">
                      Physician Insured Clinical Billing & Intensity
                    </h3>
                    <p className="text-[10px] text-ink-3">
                      Gross fee-for-service allocations from AHCIP Statistical Supplement (Open Alberta)
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 bg-paper p-1 rounded-xl border border-line">
                    {PHYSICIAN_SPECIALTY_BILLING.map((spec, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedSpecialty(spec.specialtyGroup)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                          selectedSpecialty === spec.specialtyGroup
                            ? 'bg-ok text-white font-semibold'
                            : 'text-ink-2 hover:text-ink'
                        }`}
                      >
                        {getSpecialtyLabel(spec.specialtyGroup)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-paper border border-line p-4 rounded-xl space-y-1 hover:border-ok transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] text-ink-2 font-semibold block leading-snug">FTE Clinical Count</span>
                      <Users className="w-3.5 h-3.5 text-accent shrink-0" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-ink">
                        {isMeasuredNumber(selectedSpecialtyData.physicianCount)
                          ? selectedSpecialtyData.physicianCount.toLocaleString()
                          : '—'}
                      </div>
                      <span className="text-[10px] text-ink-3 font-mono">practitioners</span>
                    </div>
                    <p className="text-[9px] text-ink-3 pt-1.5 border-t border-line font-medium mt-2">
                      Rostered physicians practicing in this category.
                    </p>
                  </div>

                  <div className="bg-paper border border-line p-4 rounded-xl space-y-1 hover:border-ok transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] text-ink-2 font-semibold block leading-snug">Total Payments</span>
                      <DollarSign className="w-3.5 h-3.5 text-ok shrink-0" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-ink">
                        {isMeasuredNumber(selectedSpecialtyData.totalPaymentsMillions)
                          ? `$${selectedSpecialtyData.totalPaymentsMillions}M`
                          : '—'}
                      </div>
                      <span className="text-[10px] text-ink-3 font-mono">annual billings</span>
                    </div>
                    <p className="text-[9px] text-ink-3 pt-1.5 border-t border-line font-medium mt-2">
                      Sum of clinical fees and program expenditures.
                    </p>
                  </div>

                  <div className="bg-paper border border-line p-4 rounded-xl space-y-1 hover:border-ok transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] text-ink-2 font-semibold block leading-snug font-mono">
                        Avg Gross Payment / MD
                      </span>
                      <Coins className="w-3.5 h-3.5 text-warn shrink-0" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-ok">
                        {isMeasuredNumber(selectedSpecialtyData.averagePaymentGross)
                          ? `$${selectedSpecialtyData.averagePaymentGross.toLocaleString()}`
                          : '—'}
                      </div>
                      <span className="text-[10px] text-ink-3 font-mono">per physician</span>
                    </div>
                    <p className="text-[9px] text-ink-3 pt-1.5 border-t border-line font-medium mt-2">
                      Clinical billings before clinic overhead costs.
                    </p>
                  </div>

                  <div className="bg-paper border border-line p-4 rounded-xl space-y-1 hover:border-ok transition-all flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-1">
                      <span className="text-[10px] text-ink-2 font-semibold block leading-snug">
                        Services per Patient / Year
                      </span>
                      <Activity className="w-3.5 h-3.5 text-accent shrink-0" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-ink">
                        {isMeasuredNumber(selectedSpecialtyData.servicesPerPatient)
                          ? selectedSpecialtyData.servicesPerPatient
                          : '—'}
                      </div>
                      <span className="text-[10px] text-ink-3 font-mono">avg annual services</span>
                    </div>
                    <p className="text-[9px] text-ink-3 pt-1.5 border-t border-line font-medium mt-2">
                      From Table 2.14 when present; Pathology/Radiology and missing joins show —.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-semibold text-ink-2 font-mono">
                    Average Gross Clinical Payment per Physician (CAD)
                  </h3>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={PHYSICIAN_SPECIALTY_BILLING} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis
                          dataKey="specialtyGroup"
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          tickFormatter={getSpecialtyLabel}
                        />
                        <YAxis
                          stroke="oklch(0.62 0.02 255)"
                          fontSize={9}
                          label={{
                            value: 'Average Gross Payment ($)',
                            angle: -90,
                            position: 'insideLeft',
                            fill: 'oklch(0.62 0.02 255)',
                            fontSize: 10,
                          }}
                        />
                        <Tooltip {...chartTooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="averagePaymentGross" name="Avg Gross Payment ($)" radius={[4, 4, 0, 0]}>
                          {PHYSICIAN_SPECIALTY_BILLING.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                entry.specialtyGroup === selectedSpecialty
                                  ? 'oklch(0.78 0.12 155)'
                                  : 'oklch(0.68 0.13 252)'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
