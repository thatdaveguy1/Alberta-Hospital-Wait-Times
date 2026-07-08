import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  DollarSign, 
  Building2, 
  Activity, 
  FileSpreadsheet,
  Layers,
  HeartPulse,
  Coins,
  Scale,
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
  HospitalEfficiencyMetric,
  PhysicianPaymentSpecialty,
  SpendingByUseOfFunds,
} from '../spendingData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type SpendingData = {
  NATIONAL_SPENDING_COMPARE: NationalSpendingCompare[];
  ALBERTA_ACTIVITY_VOLUME_TREND: ActivityVolumeTrend[];
  HOSPITAL_EFFICIENCY_TREND: HospitalEfficiencyMetric[];
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

const firstNonZeroIndex = (data: ActivityVolumeTrend[], key: keyof ActivityVolumeTrend): number => {
  return data.findIndex(d => {
    const v = d[key];
    return v !== null && v !== undefined && v !== 0;
  });
};

const firstAllNonZeroIndex = (data: ActivityVolumeTrend[], keys: (keyof ActivityVolumeTrend)[]): number => {
  return data.findIndex(d => keys.every(k => {
    const v = d[k];
    return v !== null && v !== undefined && v !== 0;
  }));
};

export default function SpendingDashboard() {
  // Live data fetched from /api/data/spending
  const { data, metadata, isLoading, error, refresh } = useDomainData<SpendingData>('spending');
  const NATIONAL_SPENDING_COMPARE = data?.NATIONAL_SPENDING_COMPARE ?? [];
  const ALBERTA_ACTIVITY_VOLUME_TREND = data?.ALBERTA_ACTIVITY_VOLUME_TREND ?? [];
  const HOSPITAL_EFFICIENCY_TREND = data?.HOSPITAL_EFFICIENCY_TREND ?? [];
  const PHYSICIAN_SPECIALTY_BILLING = data?.PHYSICIAN_SPECIALTY_BILLING ?? [];
  const ALBERTA_USE_OF_FUNDS = data?.ALBERTA_USE_OF_FUNDS ?? [];
  const [activeSpendingTab, setActiveSpendingTab] = useState<'spending-access' | 'national-scoreboard' | 'hospital-efficiency' | 'physician-payments'>('spending-access');
  const [selectedProvince, setSelectedProvince] = useState<string>('Alberta');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('General Practice / Family Medicine');
  // Interactive KPI selected state for spending-access historical trend panel
  const [selectedActivityKpi, setSelectedActivityKpi] = useState<keyof Omit<ActivityVolumeTrend, 'fiscalYear'> | null>(null);
  // Interactive KPI selected state for hospital-efficiency historical trend panel
  const [selectedEfficiencyKpi, setSelectedEfficiencyKpi] = useState<keyof Omit<HospitalEfficiencyMetric, 'fiscalYear'> | null>(null);

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
        spendingAsPercentGdp: p.spendingAsPercentGdp ?? undefined,
        costPerStandardStay: p.costPerStandardStay ?? undefined,
      })),
    [NATIONAL_SPENDING_COMPARE]
  );


  const selectedSpecialtyData = useMemo(() => {
    return PHYSICIAN_SPECIALTY_BILLING.find(s => s.specialtyGroup === selectedSpecialty) || PHYSICIAN_SPECIALTY_BILLING[0];
  }, [selectedSpecialty, PHYSICIAN_SPECIALTY_BILLING]);

  // Trim the activity trend to the period where the selected KPI actually has data,
  // so charts don't render a long empty tail of zero years before data collection began.
  const filteredActivityTrend = useMemo(() => {
    if (!selectedActivityKpi) return ALBERTA_ACTIVITY_VOLUME_TREND;
    const idx = firstNonZeroIndex(ALBERTA_ACTIVITY_VOLUME_TREND, selectedActivityKpi);
    return idx === -1 ? [] : ALBERTA_ACTIVITY_VOLUME_TREND.slice(idx);
  }, [selectedActivityKpi, ALBERTA_ACTIVITY_VOLUME_TREND]);

  // Trim the data used for the index chart to the period where every index input has data.
  const filteredActivityTrendForIndex = useMemo(() => {
    const indexKeys: (keyof ActivityVolumeTrend)[] = [
      'totalExpenseBillions', 'surgeriesCount', 'ctExamsCount', 'labTestsMillions',
      'edVisitsMillions', 'hospitalAdmissions', 'physiciansCount'
    ];
    const idx = firstAllNonZeroIndex(ALBERTA_ACTIVITY_VOLUME_TREND, indexKeys);
    return idx === -1 ? [] : ALBERTA_ACTIVITY_VOLUME_TREND.slice(idx);
  }, [ALBERTA_ACTIVITY_VOLUME_TREND]);

  // Derived growth index calculations relative to the first year where all series have data (index = 100)
  const derivedGrowthIndexes = useMemo(() => {
    const baseline = filteredActivityTrendForIndex[0];
    if (!baseline) return [];
    return filteredActivityTrendForIndex.map(year => {
      return {
        fiscalYear: year.fiscalYear,
        'Spending Index': (year.totalExpenseBillions / baseline.totalExpenseBillions) * 100,
        'Surgeries Index': (year.surgeriesCount / baseline.surgeriesCount) * 100,
        'CT Exams Index': (year.ctExamsCount / baseline.ctExamsCount) * 100,
        'Lab Tests Index': (year.labTestsMillions / baseline.labTestsMillions) * 100,
        'ED Visits Index': (year.edVisitsMillions / baseline.edVisitsMillions) * 100,
        'Admissions Index': (year.hospitalAdmissions / baseline.hospitalAdmissions) * 100,
        'Physicians Index': (year.physiciansCount / baseline.physiciansCount) * 100
      };
    });
  }, [filteredActivityTrendForIndex]);

  const latestAlbertaActivity = ALBERTA_ACTIVITY_VOLUME_TREND[ALBERTA_ACTIVITY_VOLUME_TREND.length - 1];

  // KPI detail metadata for spending-access cards (backed by ALBERTA_ACTIVITY_VOLUME_TREND)
  const activityKpiDetails = useMemo(() => {
    if (!selectedActivityKpi) return null;
    const map: Record<string, { label: string; description: string; colorClass: string; strokeColor: string; gradientId: string; unit: string; icon: typeof Coins }> = {
      totalExpenseBillions: {
        label: 'AHS Total Expense',
        description: 'Annual budget consumed by Alberta Health Services infrastructure. Rising expense outpacing service volume signals declining system productivity.',
        colorClass: 'text-emerald-400', strokeColor: '#10b981', gradientId: 'colorActivityExpense', unit: 'B', icon: Coins
      },
      surgeriesCount: {
        label: 'Annual Surgeries',
        description: 'Total day-surgeries and inpatient procedures executed across Alberta facilities each fiscal year.',
        colorClass: 'text-indigo-400', strokeColor: '#6366f1', gradientId: 'colorActivitySurgeries', unit: '', icon: Activity
      },
      ctExamsCount: {
        label: 'CT Scan Imaging',
        description: 'Annual CT scanning exams executed, a proxy for diagnostic imaging capacity utilization.',
        colorClass: 'text-amber-500', strokeColor: '#f59e0b', gradientId: 'colorActivityCt', unit: '', icon: Layers
      },
      labTestsMillions: {
        label: 'Laboratory Tests',
        description: 'Insured clinical lab test volume processed annually across the provincial laboratory network.',
        colorClass: 'text-cyan-400', strokeColor: '#06b6d4', gradientId: 'colorActivityLab', unit: 'M', icon: FileSpreadsheet
      },
      edVisitsMillions: {
        label: 'ER Department Visits',
        description: 'Total annual emergency department visits, reflecting acute demand on hospital front-doors.',
        colorClass: 'text-emerald-400', strokeColor: '#34d399', gradientId: 'colorActivityEd', unit: 'M', icon: HeartPulse
      },
      hospitalAdmissions: {
        label: 'Hospital Admissions',
        description: 'Acute standard admissions handled annually, a core measure of inpatient throughput.',
        colorClass: 'text-rose-400', strokeColor: '#f43f5e', gradientId: 'colorActivityAdm', unit: '', icon: Building2
      },
      physiciansCount: {
        label: 'Physicians (FTE)',
        description: 'Full-time-equivalent physicians receiving clinical payments, tracking human-resource capacity.',
        colorClass: 'text-pink-400', strokeColor: '#ec4899', gradientId: 'colorActivityPhys', unit: '', icon: Users
      }
    };
    return map[selectedActivityKpi] ?? null;
  }, [selectedActivityKpi]);

  const activityKpiStats = useMemo(() => {
    if (!selectedActivityKpi) return null;
    const values = filteredActivityTrend.map(t => t[selectedActivityKpi] as number);
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
  }, [selectedActivityKpi, filteredActivityTrend]);

  // KPI detail metadata for hospital-efficiency cards (backed by HOSPITAL_EFFICIENCY_TREND)
  const efficiencyKpiDetails = useMemo(() => {
    if (!selectedEfficiencyKpi) return null;
    const map: Record<string, { label: string; description: string; colorClass: string; strokeColor: string; gradientId: string; unit: string; icon: typeof Coins }> = {
      standardStayCost: {
        label: 'Standard Stay Cost',
        description: 'CIHI Cost of a Standard Hospital Stay (CSHS) — the adjusted unit cost of a standard acute-care hospitalization in Alberta.',
        colorClass: 'text-rose-400', strokeColor: '#f43f5e', gradientId: 'colorEffStayCost', unit: '$', icon: Coins
      },
      spendingPerStaffedBed: {
        label: 'Spend per Staffed Bed',
        description: 'Annual clinical overhead, supply, and nurse staffing expense per operating staffed bed.',
        colorClass: 'text-orange-400', strokeColor: '#fb923c', gradientId: 'colorEffSpendBed', unit: '$', icon: TrendingUp
      },
      hoursWorkedPerBed: {
        label: 'Staff Hours per Bed',
        description: 'Cumulative annual hours worked by healthcare practitioners per operating staffed bed.',
        colorClass: 'text-amber-500', strokeColor: '#f59e0b', gradientId: 'colorEffHours', unit: ' hrs', icon: Activity
      },
      hospitalizationsPerBed: {
        label: 'Hospitalizations per Bed',
        description: 'Average acute stays/admissions handled annually per staffed bed — a direct measure of bed asset productivity.',
        colorClass: 'text-cyan-400', strokeColor: '#06b6d4', gradientId: 'colorEffHospBed', unit: '', icon: Building2
      },
      surgeriesPerBed: {
        label: 'Surgeries per Bed',
        description: 'Total operations and surgeries performed annually divided by staffed beds.',
        colorClass: 'text-indigo-400', strokeColor: '#6366f1', gradientId: 'colorEffSurgBed', unit: '', icon: Activity
      }
    };
    return map[selectedEfficiencyKpi] ?? null;
  }, [selectedEfficiencyKpi]);

  const efficiencyKpiStats = useMemo(() => {
    if (!selectedEfficiencyKpi) return null;
    const values = HOSPITAL_EFFICIENCY_TREND.map(t => t[selectedEfficiencyKpi] as number);
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
  }, [selectedEfficiencyKpi, HOSPITAL_EFFICIENCY_TREND]);

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
        title="Health Expenditures & Efficiency"
        description="Analyze fiscal allocations, national scoreboards, and physician billings."
        metadata={metadata ?? undefined}
        arrayKey="NATIONAL_SPENDING_COMPARE"
      />

      {/* Primary Sub-Tab Navigation */}
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
          <span>Spending & Access</span>
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
          onClick={() => setActiveSpendingTab('hospital-efficiency')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'hospital-efficiency'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Hospital Efficiency</span>
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

      {/* Warning Narrative Chain / Ingestion Insights */}
      {activeSpendingTab === 'spending-access' && (
      <div id="sd-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <Scale className="w-4.5 h-4.5 text-emerald-400" />
            <span>Value for Money & Macro Efficiency Signal</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            <strong>System Productivity Gap:</strong> Alberta’s per capita health expenditure is now <strong>${albertaSpendingPerCapita.toLocaleString()}</strong>, ranking <strong>{albertaSpendingRank}</strong> of {NATIONAL_SPENDING_COMPARE.length} reporting provinces — below {higherSpendingProvinces.join(', ')}. Despite this spending level, patient wait-times and staffed bed shortages persist, suggesting that rising expenditure is increasingly absorbed by legacy operational structures, personnel premium pay, and service-delivery inflation rather than proportionate physical-capacity expansions.
          </p>
        </div>
        <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/25 text-emerald-400 px-2 py-1 rounded font-mono font-extrabold shrink-0">
          CIHI VALUE BENCHMARK
        </span>
      </div>
      )}

      {/* Primary Panels based on Tabs */}
      {activeSpendingTab === 'spending-access' && (
        <div id="sd-spending-access-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="ALBERTA_USE_OF_FUNDS" />
          {/* Key Alberta Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">AHS Expense</span>
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-400">${latestAlbertaActivity.totalExpenseBillions}B</span>
                </div>
                <span className="text-[10px] text-emerald-500 font-mono font-semibold">+8.1% vs prev</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Annual budget consumed by health infrastructure.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'totalExpenseBillions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'surgeriesCount' ? null : 'surgeriesCount')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'surgeriesCount' ? null : 'surgeriesCount');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'surgeriesCount'
                  ? 'border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-indigo-500/5'
                  : 'border-slate-800 hover:border-indigo-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Annual Surgeries</span>
                <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-indigo-400">{latestAlbertaActivity.surgeriesCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">cases</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Total day-surgeries and inpatient procedures.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'surgeriesCount' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'ctExamsCount' ? null : 'ctExamsCount')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'ctExamsCount' ? null : 'ctExamsCount');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'ctExamsCount'
                  ? 'border-amber-500/50 ring-1 ring-amber-500/30 shadow-amber-500/5'
                  : 'border-slate-800 hover:border-amber-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">CT Scan Imaging</span>
                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-amber-500">{latestAlbertaActivity.ctExamsCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">exams</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Annual CT scanning exams executed.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'ctExamsCount' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'labTestsMillions' ? null : 'labTestsMillions')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'labTestsMillions' ? null : 'labTestsMillions');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'labTestsMillions'
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-cyan-500/5'
                  : 'border-slate-800 hover:border-cyan-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Laboratory Tests</span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-cyan-400">{latestAlbertaActivity.labTestsMillions}M</div>
                <span className="text-[10px] text-slate-500 font-mono">tests</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Insured clinical lab test volume.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'labTestsMillions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'edVisitsMillions' ? null : 'edVisitsMillions')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'edVisitsMillions' ? null : 'edVisitsMillions');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'edVisitsMillions'
                  ? 'border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                  : 'border-slate-800 hover:border-emerald-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">ER Dept Visits</span>
                <HeartPulse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-400">{latestAlbertaActivity.edVisitsMillions}M</div>
                <span className="text-[10px] text-slate-500 font-mono">visits</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Total annual emergency visits.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'edVisitsMillions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'hospitalAdmissions' ? null : 'hospitalAdmissions')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'hospitalAdmissions' ? null : 'hospitalAdmissions');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'hospitalAdmissions'
                  ? 'border-rose-500/50 ring-1 ring-rose-500/30 shadow-rose-500/5'
                  : 'border-slate-800 hover:border-rose-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospital Admissions</span>
                <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-rose-400">{latestAlbertaActivity.hospitalAdmissions.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">stays</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Acute standard admissions handled.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'hospitalAdmissions' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedActivityKpi(selectedActivityKpi === 'physiciansCount' ? null : 'physiciansCount')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedActivityKpi(selectedActivityKpi === 'physiciansCount' ? null : 'physiciansCount');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-2 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedActivityKpi === 'physiciansCount'
                  ? 'border-pink-500/50 ring-1 ring-pink-500/30 shadow-pink-500/5'
                  : 'border-slate-800 hover:border-pink-500/30'
              }`}
            >
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Physicians (FTE)</span>
                <Users className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-pink-400">{latestAlbertaActivity.physiciansCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">FTEs</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Physicians receiving clinical payments.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-pink-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedActivityKpi === 'physiciansCount' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>
          </div>

          {/* Spending & Access KPI Trend Explorer Panel */}
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
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline ({filteredActivityTrend[0]?.fiscalYear ? formatFiscalYearShort(filteredActivityTrend[0].fiscalYear) : '2021-22'})</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{activityKpiStats.baseline}{activityKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current ({filteredActivityTrend[filteredActivityTrend.length - 1]?.fiscalYear ? formatFiscalYearShort(filteredActivityTrend[filteredActivityTrend.length - 1].fiscalYear) : '2025-26'})</span>
                      <span className="text-xl font-black text-white font-mono">{activityKpiStats.latest}{activityKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
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
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={filteredActivityTrend} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
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
                          dataKey={selectedActivityKpi}
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
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Productivity Disconnect: Index Growth Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Alberta Health spending vs Service activity growth (Cumulative % Change)
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Base Year {filteredActivityTrendForIndex[0]?.fiscalYear ? formatFiscalYearShort(filteredActivityTrendForIndex[0].fiscalYear) : '2021-22'} indexed at 100. Disconnects indicate spending outpacing service delivery yields.
                </p>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={derivedGrowthIndexes}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" domain={[95, 145]} fontSize={9} label={{ value: 'Indexed Growth (Base 100)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="Spending Index" stroke="#ef4444" strokeWidth={3} name="Total Spending" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Surgeries Index" stroke="#6366f1" strokeWidth={2} name="Surgical Volume" />
                    <Line type="monotone" dataKey="CT Exams Index" stroke="#f59e0b" strokeWidth={2} name="CT Scans Volume" />
                    <Line type="monotone" dataKey="Lab Tests Index" stroke="#06b6d4" strokeWidth={2} name="Lab Tests Volume" />
                    <Line type="monotone" dataKey="ED Visits Index" stroke="#10b981" strokeWidth={2} name="Emergency Room Volume" />
                    <Line type="monotone" dataKey="Admissions Index" stroke="#8b5cf6" strokeWidth={2} name="Hospital Admissions" />
                    <Line type="monotone" dataKey="Physicians Index" stroke="#ec4899" strokeWidth={2} name="Physician Headcount" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* In-depth Allocation of Funds */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Use of Alberta Health Public Funds
                </h3>
                <p className="text-[10px] text-slate-500">
                  Distribution of public health expenditure by category (CIHI NHEX Profile)
                </p>
              </div>

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
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'national-scoreboard' && (
        <div id="sd-national-scoreboard-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="CIHI_SPENDING_PER_PERSON" />
          {/* Province focus row */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Canada-Wide Spending & Efficiency Scoreboard
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
                  {selectedProvinceData.spendingAsPercentGdp != null && selectedProvinceData.spendingAsPercentGdp > 0 ? (
                    `${selectedProvinceData.spendingAsPercentGdp}%`
                  ) : (
                    <span className="text-slate-500 text-sm font-black uppercase tracking-wider">Data not available</span>
                  )}
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Total health spending share of GDP.
                </p>
              </div>
            </div>
          </div>

          {/* National charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Total Health Spending per Capita (CAD) vs % of GDP
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nationalChartCompare}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis yAxisId="left" stroke="#10b981" fontSize={9} label={{ value: 'Per Capita Spending ($)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} label={{ value: '% of GDP', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="spendingPerCapita" name="Per Capita Spending ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="spendingAsPercentGdp" name="Spending as % of GDP" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Cost of Standard Hospital Stay (CIHI CSHS)
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nationalChartCompare.filter(p => p.costPerStandardStay != null && p.costPerStandardStay > 0)}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" domain={[5000, 8000]} fontSize={9} label={{ value: 'Cost per stay ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
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
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'hospital-efficiency' && (
        <div id="sd-hospital-efficiency-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="HOSPITAL_EFFICIENCY_TREND" />
          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'standardStayCost' ? null : 'standardStayCost')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'standardStayCost' ? null : 'standardStayCost');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedEfficiencyKpi === 'standardStayCost'
                  ? 'border-rose-500/50 ring-1 ring-rose-500/30 shadow-rose-500/5'
                  : 'border-slate-800 hover:border-rose-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Standard Stay Cost</span>
              <div className="text-xl font-black text-rose-400">${HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].standardStayCost.toLocaleString()}</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Adjusted unit cost of standard acute-care hospitalization in Alberta.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors mt-2">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedEfficiencyKpi === 'standardStayCost' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'spendingPerStaffedBed' ? null : 'spendingPerStaffedBed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'spendingPerStaffedBed' ? null : 'spendingPerStaffedBed');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedEfficiencyKpi === 'spendingPerStaffedBed'
                  ? 'border-orange-500/50 ring-1 ring-orange-500/30 shadow-orange-500/5'
                  : 'border-slate-800 hover:border-orange-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Spend per Staffed Bed</span>
              <div className="text-xl font-black text-orange-400">${HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].spendingPerStaffedBed.toLocaleString()}</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Annual clinical overhead, supply, and nurse staffing expense per operating bed.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors mt-2">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedEfficiencyKpi === 'spendingPerStaffedBed' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'hoursWorkedPerBed' ? null : 'hoursWorkedPerBed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'hoursWorkedPerBed' ? null : 'hoursWorkedPerBed');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedEfficiencyKpi === 'hoursWorkedPerBed'
                  ? 'border-amber-500/50 ring-1 ring-amber-500/30 shadow-amber-500/5'
                  : 'border-slate-800 hover:border-amber-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Staff Hours per Bed</span>
              <div className="text-xl font-black text-amber-500">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].hoursWorkedPerBed.toLocaleString()} hrs</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Cumulative annual hours worked by healthcare practitioners per operating bed.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-amber-500 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors mt-2">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedEfficiencyKpi === 'hoursWorkedPerBed' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'hospitalizationsPerBed' ? null : 'hospitalizationsPerBed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'hospitalizationsPerBed' ? null : 'hospitalizationsPerBed');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedEfficiencyKpi === 'hospitalizationsPerBed'
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-cyan-500/5'
                  : 'border-slate-800 hover:border-cyan-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospitalizations / Bed</span>
              <div className="text-xl font-black text-cyan-400">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].hospitalizationsPerBed.toLocaleString()} stays</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Average acute stays/admissions handled annually per staffed bed.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors mt-2">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedEfficiencyKpi === 'hospitalizationsPerBed' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'surgeriesPerBed' ? null : 'surgeriesPerBed')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedEfficiencyKpi(selectedEfficiencyKpi === 'surgeriesPerBed' ? null : 'surgeriesPerBed');
                }
              }}
              className={`bg-slate-900 border p-4 rounded-xl space-y-1 flex flex-col justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
                selectedEfficiencyKpi === 'surgeriesPerBed'
                  ? 'border-indigo-500/50 ring-1 ring-indigo-500/30 shadow-indigo-500/5'
                  : 'border-slate-800 hover:border-indigo-500/30'
              }`}
            >
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Surgeries per Bed</span>
              <div className="text-xl font-black text-indigo-400">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].surgeriesPerBed.toLocaleString()} cases</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Total operations and surgeries performed annually divided by staffed beds.
              </p>
              <span className="text-[9px] text-slate-500 group-hover:text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors mt-2">
                <BarChart2 className="w-3 h-3 animate-pulse" />
                {selectedEfficiencyKpi === 'surgeriesPerBed' ? 'Active: Hide Trend' : 'Click to View Trend'}
              </span>
            </div>
          </div>

          {/* Hospital Efficiency KPI Trend Explorer Panel */}
          <AnimatePresence mode="wait">
            {selectedEfficiencyKpi && efficiencyKpiDetails && efficiencyKpiStats && (
              <motion.div
                key={`efficiency-kpi-trend-${selectedEfficiencyKpi}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl relative">
                  <button
                    onClick={() => setSelectedEfficiencyKpi(null)}
                    className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    title="Close panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                    <div className="space-y-1">
                      <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        {React.createElement(efficiencyKpiDetails.icon, {
                          className: `w-4 h-4 ${efficiencyKpiDetails.colorClass}`
                        })}
                        <span>{efficiencyKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                        {efficiencyKpiDetails.description}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (2021-22)</span>
                      <span className="text-xl font-black text-slate-300 font-mono">{efficiencyKpiStats.baseline}{efficiencyKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (2025-26)</span>
                      <span className="text-xl font-black text-white font-mono">{efficiencyKpiStats.latest}{efficiencyKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
                      <span className={`text-xl font-black font-mono ${efficiencyKpiDetails.colorClass}`}>{efficiencyKpiStats.peak}{efficiencyKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                      <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                        efficiencyKpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                      }`}>
                        {efficiencyKpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{efficiencyKpiStats.delta}{efficiencyKpiDetails.unit} ({efficiencyKpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HOSPITAL_EFFICIENCY_TREND} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={efficiencyKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={efficiencyKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={efficiencyKpiDetails.strokeColor} stopOpacity={0}/>
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
                          dataKey={selectedEfficiencyKpi}
                          name={efficiencyKpiDetails.label}
                          stroke={efficiencyKpiDetails.strokeColor}
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill={`url(#${efficiencyKpiDetails.gradientId})`}
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

          {/* Efficiency trend chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Staffing Hours Worked vs. Inpatient Admissions per Bed
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={HOSPITAL_EFFICIENCY_TREND}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" fontSize={9} />
                    <YAxis yAxisId="left" stroke="#f59e0b" fontSize={9} label={{ value: 'Staffing Hours Worked', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={9} label={{ value: 'Admissions per Operating Bed', angle: 90, position: 'insideRight', fill: '#ef4444', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="hoursWorkedPerBed" name="Staff Hours per Bed" stroke="#f59e0b" strokeWidth={2.5} />
                    <Line yAxisId="right" type="monotone" dataKey="hospitalizationsPerBed" name="Admissions per Bed" stroke="#ef4444" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Hospital Overhead Efficiency Analysis
                </h3>
                <p className="text-[10px] text-slate-500">
                  Explaining rising staffing intensity paired with declining admissions yield
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-rose-400 font-mono font-bold uppercase block">
                    Productivity Squeeze
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Annual spending per staffed bed surged from <strong>$212,000</strong> to <strong>$292,000</strong> (+37%), but the admissions handled per bed decreased from <strong>42.4</strong> to <strong>37.8</strong>. This demonstrates a decline in hospital asset productivity, driven by systemic inpatient bottlenecks and patient flow delays.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-amber-500 font-mono font-bold uppercase block">
                    CIHI Standard Stay Cost Spike
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    The Cost of a Standard Hospital Stay rose by 13.4% to <strong>$7,420</strong>. This indicates rising underlying operational cost-per-case, influenced heavily by staffing shortages forcing premium-rate overtime usage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'physician-payments' && (
        <div id="sd-physician-payments-panel" className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="PHYSICIAN_SPECIALTY_BILLING" />
          {/* Selector & Details row */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Physician Insured Clinical Billing & Intensity
                </h3>
                <p className="text-[10px] text-slate-500">
                  Compare total gross fee-for-service allocations and service intensity by medical specialty
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

            {/* Specialty metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">FTE Clinical Count</span>
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{selectedSpecialtyData.physicianCount}</div>
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
                  <div className="text-xl font-black text-white">${selectedSpecialtyData.totalPaymentsMillions}M</div>
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
                  <div className="text-xl font-black text-emerald-400">${selectedSpecialtyData.averagePaymentGross.toLocaleString()}</div>
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
                  <div className="text-xl font-black text-white">{selectedSpecialtyData.servicesPerPatient}</div>
                  <span className="text-[10px] text-slate-500 font-mono">avg annual services</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Average consults/procedures per unique patient.
                </p>
              </div>
            </div>
          </div>

          {/* Specialty charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Billing & Retention Analytics
                </h3>
                <p className="text-[10px] text-slate-500">
                  Insights from the AHCIP Statistical Supplement Tables
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-indigo-400 font-mono font-bold uppercase block">
                    Specialty Allocation Gap
                  </span>
                  <p className="text-xs text-white font-bold mt-1">General Practice vs. Surgery</p>
                  <p className="text-[10px] text-slate-400 leading-normal mt-1">
                    While General Practice commands the largest collective pool (<strong>$1.42 Billion</strong>), the average gross payment is <strong>$262,000</strong>. Surgical specialties average over <strong>$539,000</strong>. This creates significant commercial pressures for primary care practices facing rising clinic operational overheads.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-rose-400 font-mono font-bold uppercase block">
                    Insured Fee Reform Impact
                  </span>
                  <p className="text-[10px] text-slate-400 leading-normal mt-1">
                    Insured FFS billing data highlights high-intensity clinical activities. Current primary care reform targets shifting family physicians from pure FFS (fee-for-service) to blended capitation models to encourage comprehensive community medicine.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
