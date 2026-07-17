import React, { useState, useMemo } from 'react';
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
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import type {
  NationalSpendingCompare,
  ActivityVolumeTrend,
  PhysicianPaymentSpecialty,
  SpendingByUseOfFunds,
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
};

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4'];

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
  return data.findIndex(d => isMeasuredNumber(d[key]));
};

export default function SpendingDashboard() {
  // Live data fetched from /api/data/spending
  const { data, metadata, isLoading, error, refresh } = useDomainData<SpendingData>('spending', spendingData);
  const NATIONAL_SPENDING_COMPARE = data?.NATIONAL_SPENDING_COMPARE ?? [];
  const ALBERTA_ACTIVITY_VOLUME_TREND = data?.ALBERTA_ACTIVITY_VOLUME_TREND ?? [];
  const PHYSICIAN_SPECIALTY_BILLING = data?.PHYSICIAN_SPECIALTY_BILLING ?? [];
  const ALBERTA_USE_OF_FUNDS = data?.ALBERTA_USE_OF_FUNDS ?? [];
  const [activeSpendingTab, setActiveSpendingTab] = useState<'spending-access' | 'national-scoreboard' | 'physician-payments'>('spending-access');
  const [selectedProvince, setSelectedProvince] = useState<string>('Alberta');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('General Practice / Family Medicine');
  // Interactive KPI selected state for spending-access historical trend panel (expense only when measured)
  const [selectedActivityKpi, setSelectedActivityKpi] = useState<'totalExpenseBillions' | null>(null);

  const selectedProvinceData = useMemo(() => {
    return NATIONAL_SPENDING_COMPARE.find(p => p.province === selectedProvince) || NATIONAL_SPENDING_COMPARE[0];
  }, [selectedProvince, NATIONAL_SPENDING_COMPARE]);

  const { albertaSpendingPerCapita, albertaSpendingRank, higherSpendingProvinces } = useMemo(() => {
    const sorted = [...NATIONAL_SPENDING_COMPARE].sort((a, b) => b.spendingPerCapita - a.spendingPerCapita);
    const rank = sorted.findIndex(p => p.province === 'Alberta') + 1;
    const alberta = sorted.find(p => p.province === 'Alberta');
    const higher = sorted
      .filter(p => p.province !== 'Alberta' && p.spendingPerCapita > (alberta?.spendingPerCapita ?? 0))
      .slice(0, 3)
      .map(p => p.province);
    return {
      albertaSpendingPerCapita: alberta?.spendingPerCapita ?? 0,
      albertaSpendingRank: rank,
      higherSpendingProvinces: higher,
    };
  }, [NATIONAL_SPENDING_COMPARE]);

  const selectedProvinceRank = useMemo(() => {
    const sorted = [...NATIONAL_SPENDING_COMPARE].sort((a, b) => b.spendingPerCapita - a.spendingPerCapita);
    const idx = sorted.findIndex(p => p.province === selectedProvince);
    return idx >= 0 ? idx + 1 : null;
  }, [NATIONAL_SPENDING_COMPARE, selectedProvince]);

  const albertaProvinceData = useMemo(
    () => NATIONAL_SPENDING_COMPARE.find(p => p.province === 'Alberta'),
    [NATIONAL_SPENDING_COMPARE]
  );

  const nationalChartCompare = useMemo(
    () =>
      NATIONAL_SPENDING_COMPARE.map(p => ({
        ...p,
        costPerStandardStay: p.costPerStandardStay ?? undefined,
      })),
    [NATIONAL_SPENDING_COMPARE]
  );

  const nationalHasGdp = useMemo(
    () => NATIONAL_SPENDING_COMPARE.some(p => isMeasuredNumber(p.spendingAsPercentGdp)),
    [NATIONAL_SPENDING_COMPARE]
  );

  const selectedSpecialtyData = useMemo(() => {
    return PHYSICIAN_SPECIALTY_BILLING.find(s => s.specialtyGroup === selectedSpecialty) || PHYSICIAN_SPECIALTY_BILLING[0];
  }, [selectedSpecialty, PHYSICIAN_SPECIALTY_BILLING]);

  // Expense series only — volume fields are not sourced from NHEX and must not drive charts.
  const expenseTrend = useMemo(() => {
    return ALBERTA_ACTIVITY_VOLUME_TREND.filter(r => isMeasuredNumber(r.totalExpenseBillions));
  }, [ALBERTA_ACTIVITY_VOLUME_TREND]);

  const filteredExpenseTrend = useMemo(() => {
    if (!selectedActivityKpi) return expenseTrend;
    const idx = firstMeasuredIndex(expenseTrend, selectedActivityKpi);
    return idx === -1 ? [] : expenseTrend.slice(idx);
  }, [selectedActivityKpi, expenseTrend]);

  const latestAlbertaActivity = expenseTrend.length > 0
    ? expenseTrend[expenseTrend.length - 1]
    : null;
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
      description: 'Total current-dollar health expenditure for Alberta from CIHI NHEX Table O.1 (public + private). Volume/activity series are not sourced and are not shown.',
      colorClass: 'text-emerald-400',
      strokeColor: '#10b981',
      gradientId: 'colorActivityExpense',
      unit: 'B',
      icon: Coins,
    };
  }, [selectedActivityKpi]);

  const activityKpiStats = useMemo(() => {
    if (!selectedActivityKpi) return null;
    const values = filteredExpenseTrend.map(t => t.totalExpenseBillions).filter(isMeasuredNumber);
    if (values.length === 0) return null;
    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;
    const fmt = (v: number) => v >= 1000 ? v.toLocaleString() : v.toFixed(1);
    return {
      baseline: fmt(baseline),
      latest: fmt(latest),
      peak: fmt(peak),
      minVal: fmt(minVal),
      delta: rawDelta > 0 ? `+${fmt(rawDelta)}` : fmt(rawDelta),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedActivityKpi, filteredExpenseTrend]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading spending data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load spending data: {error}</span>
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:border-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }
  return (
    <div id="spending-dashboard-container" className="space-y-6">
      {/* Tab bar header */}
      <DashboardHeader
        icon={Coins}
        title="Health Expenditures"
        description="Source-backed fiscal allocations, national scoreboards, and physician billings."
        metadata={metadata ?? undefined}
        arrayKey="NATIONAL_SPENDING_COMPARE"
      />

      {/* Primary Sub-Tab Navigation — hospital efficiency removed (no measured upstream series) */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSpendingTab('spending-access')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'spending-access'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Spending & Funds</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('national-scoreboard')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'national-scoreboard'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>National Scoreboard</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('physician-payments')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'physician-payments'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Physician Payments</span>
        </button>
      </div>

      {activeSpendingTab === 'spending-access' && (
      <div id="sd-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <Scale className="w-4.5 h-4.5 text-emerald-400" />
            <span>NHEX expenditure & use of funds</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            Alberta per-capita spend is{' '}
            <strong>
              {albertaSpendingPerCapita > 0 ? `$${albertaSpendingPerCapita.toLocaleString()}` : '—'}
            </strong>
            {albertaSpendingRank > 0 ? <> (rank <strong>{albertaSpendingRank}</strong> nationally)</> : null}.
            Service-volume KPIs (surgeries, imaging, ED, admissions) are omitted until a measured upstream is wired.
          </p>
        </div>
        <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/25 text-emerald-400 px-2 py-1 rounded font-mono font-extrabold shrink-0">
          CIHI NHEX
        </span>
      </div>
      )}
      {activeSpendingTab === 'national-scoreboard' && (
      <div id="sd-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <Globe className="w-4.5 h-4.5 text-blue-400" />
            <span>Inter-provincial comparison</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            Per-capita spend, beds per 100k, and cost per standard stay for <strong>{selectedProvince}</strong>
            {selectedProvinceRank != null ? ` (rank ${selectedProvinceRank} by per-capita spend)` : ''}.
            GDP share is not present in the NHEX Table O.1 extract and is not shown as measured.
          </p>
        </div>
      </div>
      )}
      {activeSpendingTab === 'physician-payments' && (
      <div id="sd-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <Users className="w-4.5 h-4.5 text-violet-400" />
            <span>Physician payment mix</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            Gross payments from the AHCIP statistical supplement (Open Alberta). Services-per-patient is shown only when Table 2.14 supplies registered persons for that specialty.
          </p>
        </div>
      </div>
      )}

      {/* Primary Panels based on Tabs */}
      {activeSpendingTab === 'spending-access' && (
        <div id="sd-spending-access-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="ALBERTA_ACTIVITY_VOLUME_TREND" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'totalExpenseBillions' ? null : 'totalExpenseBillions')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'totalExpenseBillions' ? null : 'totalExpenseBillions');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'totalExpenseBillions'
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                  : 'border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Total Health Expenditure</span>
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-400">
                    {latestAlbertaActivity && isMeasuredNumber(latestAlbertaActivity.totalExpenseBillions)
                      ? `$${latestAlbertaActivity.totalExpenseBillions}B`
                      : '—'}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-500 font-mono font-semibold">
                  {expenseVsPrevPct ?? '—'}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                CIHI NHEX Alberta total (public + private current dollars).
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'totalExpenseBillions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between md:col-span-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Unsupported activity volumes</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Surgeries, CT exams, lab tests, ED visits, hospital admissions, and physician FTE activity series are not present in the NHEX Table O.1 extract. Those cards and the productivity index chart have been removed rather than showing hand-authored or zero-filled values.
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
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl relative">
                  <button
                    onClick={() => setSelectedActivityKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        {React.createElement(activityKpiDetails.icon, {
                          className: `w-4 h-4 ${activityKpiDetails.colorClass}`
                        })}
                        <span>{activityKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {activityKpiDetails.description}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Baseline ({filteredExpenseTrend[0]?.fiscalYear ? formatFiscalYearShort(filteredExpenseTrend[0].fiscalYear) : '—'})
                      </span>
                      <span className="text-xl font-black text-slate-300 font-mono">{activityKpiStats.baseline}{activityKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Current ({filteredExpenseTrend[filteredExpenseTrend.length - 1]?.fiscalYear ? formatFiscalYearShort(filteredExpenseTrend[filteredExpenseTrend.length - 1].fiscalYear) : '—'})
                      </span>
                      <span className="text-xl font-black text-white font-mono">{activityKpiStats.latest}{activityKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Series Peak</span>
                      <span className={`text-xl font-black font-mono ${activityKpiDetails.colorClass}`}>{activityKpiStats.peak}{activityKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                        activityKpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        {activityKpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{activityKpiStats.delta}{activityKpiDetails.unit} ({activityKpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    {filteredExpenseTrend.length === 0 ? (
                      <p className="text-sm text-slate-500">No measured NHEX expenditure years available.</p>
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredExpenseTrend} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={activityKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={activityKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={activityKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="fiscalYear" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                        <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} domain={['auto', 'auto']} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: 8 }}
                          labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                          itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                        />
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
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Alberta total health expenditure (NHEX)
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Measured total expense only — activity volume series not sourced.
                </p>
                <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="ALBERTA_ACTIVITY_VOLUME_TREND" />
              </div>
              {expenseTrend.length === 0 ? (
                <p className="text-sm text-slate-500">No measured Alberta expenditure years from CIHI NHEX.</p>
              ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={expenseTrend} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} label={{ value: 'CAD billions', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="totalExpenseBillions" stroke="#10b981" strokeWidth={3} name="Total expenditure ($B)" activeDot={{ r: 6 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Use of Alberta Health Public Funds
                </h3>
                <p className="text-[10px] text-slate-500">
                  Distribution of public health expenditure by category (CIHI NHEX Series D1)
                </p>
                <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="ALBERTA_USE_OF_FUNDS" />
              </div>

              {ALBERTA_USE_OF_FUNDS.length === 0 ? (
                <p className="text-sm text-slate-500">Use-of-funds breakdown unavailable until CIHI Series D1 is successfully refreshed.</p>
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
                      {ALBERTA_USE_OF_FUNDS.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value} Billion`} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-2">
                {ALBERTA_USE_OF_FUNDS.map((fund, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded-md hover:bg-slate-850/60 transition-all">
                    <div className="flex items-center gap-2 text-slate-300 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate font-medium">{fund.category}</span>
                    </div>
                    <span className="text-white font-mono font-bold shrink-0">${fund.amountBillions.toFixed(2)}B ({fund.percentageShare}%)</span>
                  </div>
                ))}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'national-scoreboard' && (
        <div id="sd-national-scoreboard-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="NATIONAL_SPENDING_COMPARE" />
          {NATIONAL_SPENDING_COMPARE.length === 0 || !selectedProvinceData ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-sm text-slate-400">
              No measured national spending compare rows are available from CIHI NHEX.
            </div>
          ) : (
          <>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Canada-Wide Spending Scoreboard
                </h3>
                <p className="text-[10px] text-slate-500">
                  Select a province to examine comparative CIHI metrics relative to Alberta's profile
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850">
                {NATIONAL_SPENDING_COMPARE.map((prov, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedProvince(prov.province)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedProvince === prov.province
                        ? 'bg-indigo-600 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {prov.province}
                  </button>
                ))}
              </div>
            </div>

            {/* granular scoreboard comparisons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Total Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.spendingPerCapita.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-mono mt-2">
                  {selectedProvinceRank != null ? (
                    selectedProvince === 'Alberta' ? (
                      <span className="text-emerald-400 font-semibold">
                        Rank {selectedProvinceRank} of {NATIONAL_SPENDING_COMPARE.length} — below {higherSpendingProvinces.join(', ')}
                      </span>
                    ) : albertaProvinceData ? (
                      <span>
                        Rank {selectedProvinceRank} of {NATIONAL_SPENDING_COMPARE.length}
                        {selectedProvinceData.spendingPerCapita < albertaProvinceData.spendingPerCapita ? (
                          <> — AB spends <strong className="text-emerald-400">+${(albertaProvinceData.spendingPerCapita - selectedProvinceData.spendingPerCapita).toLocaleString()}</strong> more</>
                        ) : selectedProvinceData.spendingPerCapita > albertaProvinceData.spendingPerCapita ? (
                          <> — <strong className="text-amber-400">${(selectedProvinceData.spendingPerCapita - albertaProvinceData.spendingPerCapita).toLocaleString()}</strong> above AB</>
                        ) : (
                          <> — matches Alberta per capita</>
                        )}
                      </span>
                    ) : (
                      <span>Rank {selectedProvinceRank} of {NATIONAL_SPENDING_COMPARE.length}</span>
                    )
                  ) : (
                    <span className="text-slate-500">Rank unavailable</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Cost per Standard Stay</span>
                <div className="text-xl font-black text-white">
                  {selectedProvinceData.costPerStandardStay != null && selectedProvinceData.costPerStandardStay > 0 ? (
                    `$${selectedProvinceData.costPerStandardStay.toLocaleString()}`
                  ) : (
                    <span className="text-slate-500 text-sm font-black uppercase tracking-wider">Data not available</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Adjusted unit cost per clinical admission.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Staffed Beds / 100k</span>
                <div className="text-xl font-black text-white">
                  {selectedProvinceData.bedsPer100k != null && selectedProvinceData.bedsPer100k > 0 ? (
                    selectedProvinceData.bedsPer100k
                  ) : (
                    <span className="text-slate-500 text-sm font-black uppercase tracking-wider">Data not available</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Staffed acute beds per 100k residents.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospital Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.hospitalSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Dedicated hospital funding per person.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Physician Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.physicianSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Gross insured physician costs per person.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Drug Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.drugSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Public and private pharmaceutical costs.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Health Spend % of GDP</span>
                <div className="text-xl font-black text-white">
                  {nationalHasGdp && selectedProvinceData && isMeasuredNumber(selectedProvinceData.spendingAsPercentGdp) ? (
                    `${selectedProvinceData.spendingAsPercentGdp}%`
                  ) : (
                    <span className="text-slate-500 text-sm font-black uppercase tracking-wider">Not sourced</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  NHEX Table O.1 extract does not include GDP share — never shown as measured.
                </p>
              </div>
            </div>
          </div>

          {/* National charts — per-capita only; GDP axis omitted when unsourced */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Total Health Spending per Capita (CAD)
              </h3>

              {NATIONAL_SPENDING_COMPARE.length === 0 ? (
                <p className="text-sm text-slate-500">No measured national spending compare rows available.</p>
              ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nationalChartCompare}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#10b981" fontSize={9} label={{ value: 'Per Capita Spending ($)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="spendingPerCapita" name="Per Capita Spending ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Cost of Standard Hospital Stay (CIHI CSHS)
              </h3>

              {nationalChartCompare.filter(p => p.costPerStandardStay != null && p.costPerStandardStay > 0).length === 0 ? (
                <p className="text-sm text-slate-500">No measured CSHS values available for provinces in this extract.</p>
              ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nationalChartCompare.filter(p => p.costPerStandardStay != null && p.costPerStandardStay > 0)}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" fontSize={9} label={{ value: 'Cost per stay ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="costPerStandardStay" name="Standard Acute Stay Cost ($)" fill="#ef4444" radius={[4, 4, 0, 0]}>
                      {NATIONAL_SPENDING_COMPARE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.province === 'Alberta' ? '#ef4444' : '#64748b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {activeSpendingTab === 'physician-payments' && (
        <div id="sd-physician-payments-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="PHYSICIAN_SPECIALTY_BILLING" />

          {PHYSICIAN_SPECIALTY_BILLING.length === 0 || !selectedSpecialtyData ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-sm text-slate-400">
              No measured AHCIP specialty billing rows are available. Payments are not shown until Open Alberta billing refresh succeeds.
            </div>
          ) : (
          <>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Physician Insured Clinical Billing & Intensity
                </h3>
                <p className="text-[10px] text-slate-500">
                  Gross fee-for-service allocations from AHCIP Statistical Supplement (Open Alberta)
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850">
                {PHYSICIAN_SPECIALTY_BILLING.map((spec, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSpecialty(spec.specialtyGroup)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedSpecialty === spec.specialtyGroup
                        ? 'bg-emerald-600 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {getSpecialtyLabel(spec.specialtyGroup)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">FTE Clinical Count</span>
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {isMeasuredNumber(selectedSpecialtyData.physicianCount)
                      ? selectedSpecialtyData.physicianCount.toLocaleString()
                      : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">practitioners</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Rostered physicians practicing in this category.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Total Payments</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {isMeasuredNumber(selectedSpecialtyData.totalPaymentsMillions)
                      ? `$${selectedSpecialtyData.totalPaymentsMillions}M`
                      : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">annual billings</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Sum of clinical fees and program expenditures.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug font-mono">Avg Gross Payment / MD</span>
                  <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-emerald-400">
                    {isMeasuredNumber(selectedSpecialtyData.averagePaymentGross)
                      ? `$${selectedSpecialtyData.averagePaymentGross.toLocaleString()}`
                      : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">per physician</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Clinical billings before clinic overhead costs.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Services per Patient / Year</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {isMeasuredNumber(selectedSpecialtyData.servicesPerPatient)
                      ? selectedSpecialtyData.servicesPerPatient
                      : '—'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">avg annual services</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  From Table 2.14 when present; Pathology/Radiology and missing joins show —.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Average Gross Clinical Payment per Physician (CAD)
              </h3>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={PHYSICIAN_SPECIALTY_BILLING}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="specialtyGroup" stroke="#64748b" fontSize={9} tickFormatter={getSpecialtyLabel} />
                    <YAxis stroke="#64748b" fontSize={9} label={{ value: 'Average Gross Payment ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="averagePaymentGross" name="Avg Gross Payment ($)" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {PHYSICIAN_SPECIALTY_BILLING.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.specialtyGroup === selectedSpecialty ? '#10b981' : '#6366f1'} />
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
