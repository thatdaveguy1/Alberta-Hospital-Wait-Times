import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Search,
  MapPin,
  AlertTriangle,
  TrendingUp,
  Info,
  PhoneCall,
  Activity,
  Layers,
  Clock,
  ShieldAlert,
  BarChart2,
  TrendingDown,
  X,
  RefreshCw,
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
import type {
  SubstanceHarmTrend,
  AddictionBedStatus,
  SupportHelpline,
} from '../mentalHealthData';
import * as mentalHealthData from '../mentalHealthData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type MentalHealthSubTab =
  | 'substance-harms'
  | 'addiction-beds'
  | 'mh-readmissions'
  | 'helplines';

type MentalHealthData = {
  SUBSTANCE_HARM_TRENDS: SubstanceHarmTrend[];
  ADDICTION_BED_CAPACITIES: AddictionBedStatus[];
  SUPPORT_HELPLINES: SupportHelpline[];
  CIHI_MH_READMISSION_RATES?: Record<string, unknown>[];
  _dataMetadata?: DataMetadataMap;
};

function parseCihiNumber(value: unknown): number | null {
  if (value == null || value === '' || value === '–' || value === '-' || value === '—') return null;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/** Province-wide totals are only trusted for complete All Substances rows (or multi-type verified sets). */
function isSubstanceHarmsComplete(rows: SubstanceHarmTrend[]): boolean {
  if (rows.length === 0) return false;
  const types = new Set(rows.map((r) => r.substanceType));
  // Single-type subsets (e.g. Stimulants-only) are incomplete for all-substance KPIs.
  if (types.size === 1 && !types.has('All Substances')) return false;
  // Prefer All Substances rows with core metrics present; never invent province totals from partial types.
  const allSubstanceRows = rows.filter((r) => r.substanceType === 'All Substances');
  if (allSubstanceRows.length === 0) return false;
  return allSubstanceRows.every(
    (r) =>
      typeof r.apparentDeaths === 'number' &&
      typeof r.hospitalizations === 'number' &&
      typeof r.emsOverdoseResponses === 'number' &&
      typeof r.albertaRatePer100k === 'number',
  );
}

const CHART_GRID = 'oklch(0.28 0.02 255)';
const CHART_TICK = 'oklch(0.62 0.02 255)';

const tooltipStyle = {
  backgroundColor: 'oklch(0.2 0.022 255)',
  border: '1px solid oklch(0.28 0.02 255)',
  borderRadius: '8px',
};
const tooltipItemStyle = { color: 'oklch(0.96 0.008 255)' };
const tooltipLabelStyle = { color: 'oklch(0.78 0.015 255)' };

export default function MentalHealthDashboard() {
  const [selectedHarmKpi, setSelectedHarmKpi] = useState<
    'apparentDeaths' | 'emsOverdoseResponses' | 'hospitalizations' | null
  >(null);
  // null until first explicit tab click — default derived from substance completeness.
  const [activeSubTab, setActiveSubTab] = useState<MentalHealthSubTab | null>(null);

  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('All');
  const [siteSearch, setSiteSearch] = useState<string>('');

  const { data, metadata, isLoading, error, refresh } = useDomainData<MentalHealthData>(
    'mental-health',
    mentalHealthData,
  );
  const SUBSTANCE_HARM_TRENDS = data?.SUBSTANCE_HARM_TRENDS ?? [];
  const ADDICTION_BED_CAPACITIES = data?.ADDICTION_BED_CAPACITIES ?? [];
  const SUPPORT_HELPLINES = data?.SUPPORT_HELPLINES ?? [];
  const CIHI_MH_READMISSION_RATES = data?.CIHI_MH_READMISSION_RATES ?? [];

  const substanceHarmsComplete = useMemo(
    () => isSubstanceHarmsComplete(SUBSTANCE_HARM_TRENDS),
    [SUBSTANCE_HARM_TRENDS],
  );

  const effectiveSubTab: MentalHealthSubTab =
    activeSubTab ?? (substanceHarmsComplete ? 'substance-harms' : 'addiction-beds');

  // Only aggregate verified All Substances rows — never sum stimulants-only as province totals.
  const filteredHarmData = useMemo(() => {
    if (!substanceHarmsComplete) return [];
    const complete = SUBSTANCE_HARM_TRENDS.filter((t) => t.substanceType === 'All Substances');
    const years = Array.from(new Set(complete.map((t) => t.year))).sort();
    return years.map((year) => {
      const records = complete.filter((t) => t.year === year);
      const apparentDeaths = records.reduce((sum, r) => sum + r.apparentDeaths, 0);
      const hospitalizations = records.reduce((sum, r) => sum + r.hospitalizations, 0);
      const emsOverdoseResponses = records.reduce((sum, r) => sum + r.emsOverdoseResponses, 0);
      return { year, apparentDeaths, hospitalizations, emsOverdoseResponses };
    });
  }, [SUBSTANCE_HARM_TRENDS, substanceHarmsComplete]);

  const substanceHarmStats = useMemo(() => {
    if (filteredHarmData.length === 0) {
      return { latest: null as (typeof filteredHarmData)[number] | null, peak: null as (typeof filteredHarmData)[number] | null };
    }
    const latest = filteredHarmData[filteredHarmData.length - 1];
    const peak = filteredHarmData.reduce(
      (max, r) => (r.apparentDeaths > max.apparentDeaths ? r : max),
      filteredHarmData[0],
    );
    return { latest, peak };
  }, [filteredHarmData]);

  const harmKpiStats = useMemo(() => {
    if (!selectedHarmKpi || !substanceHarmsComplete) return null;
    const values = filteredHarmData
      .map((t) => t[selectedHarmKpi] as number)
      .filter((v) => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toLocaleString(),
      latest: latest.toLocaleString(),
      peak: peak.toLocaleString(),
      minVal: minVal.toLocaleString(),
      delta: rawDelta > 0 ? `+${rawDelta.toLocaleString()}` : rawDelta.toLocaleString(),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0,
    };
  }, [selectedHarmKpi, filteredHarmData, substanceHarmsComplete]);

  const selectedHarmKpiDetails = useMemo(() => {
    if (!selectedHarmKpi) return null;
    switch (selectedHarmKpi) {
      case 'apparentDeaths':
        return {
          label: 'Alberta apparent toxicity deaths',
          description:
            'Annual apparent toxicity deaths across Alberta from the Alberta Substance Use Surveillance System (complete All Substances rows only).',
          valueClass: 'text-crit',
          activeBorderClass: 'border-crit',
          activeBgClass: 'bg-crit-soft',
          strokeColor: 'oklch(0.75 0.14 25)',
          gradientId: 'colorDeathsTrend',
          unit: '',
          icon: AlertTriangle,
        };
      case 'emsOverdoseResponses':
        return {
          label: 'EMS suspected overdose dispatches',
          description:
            'Annual EMS dispatches for suspected opioid and substance overdoses across Alberta (complete source-backed rows only).',
          valueClass: 'text-warn',
          activeBorderClass: 'border-warn',
          activeBgClass: 'bg-warn-soft',
          strokeColor: 'oklch(0.82 0.12 85)',
          gradientId: 'colorEmsTrend',
          unit: '',
          icon: PhoneCall,
        };
      case 'hospitalizations':
        return {
          label: 'Poisoning hospital admissions',
          description:
            'Toxic substance poisonings and accidental overdoses requiring inpatient hospitalization (complete source-backed rows only).',
          valueClass: 'text-accent',
          activeBorderClass: 'border-accent',
          activeBgClass: 'bg-accent-soft',
          strokeColor: 'oklch(0.68 0.13 252)',
          gradientId: 'colorHospTrend',
          unit: '',
          icon: Activity,
        };
      default:
        return null;
    }
  }, [selectedHarmKpi]);

  const bedStats = useMemo(() => {
    const total = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const liveSites = ADDICTION_BED_CAPACITIES.filter(
      (b) => b.availableBeds !== null && b.availableBeds !== undefined,
    );
    const liveTotal = liveSites.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const available = liveSites.reduce((acc, curr) => acc + (curr.availableBeds ?? 0), 0);
    const pctOccupied = liveTotal > 0 ? ((liveTotal - available) / liveTotal) * 100 : 0;
    return { total, available, pctOccupied, liveCount: liveSites.length, hasLiveData: liveSites.length > 0 };
  }, [ADDICTION_BED_CAPACITIES]);

  const filteredBeds = useMemo(() => {
    return ADDICTION_BED_CAPACITIES.filter((bed) => {
      const matchesCorridor = corridorFilter === 'All' || bed.corridor === corridorFilter;
      const matchesBedType = bedTypeFilter === 'All' || bed.bedType === bedTypeFilter;
      const matchesSearch =
        bed.siteName.toLowerCase().includes(siteSearch.toLowerCase()) ||
        bed.corridor.toLowerCase().includes(siteSearch.toLowerCase());
      return matchesCorridor && matchesBedType && matchesSearch;
    });
  }, [corridorFilter, bedTypeFilter, siteSearch, ADDICTION_BED_CAPACITIES]);

  // CIHI 30-day MH/SU readmission: province-level, Level 1 Not applicable, rate by Time frame.
  const mhReadmissionChart = useMemo(() => {
    const rows = CIHI_MH_READMISSION_RATES;
    if (rows.length === 0) return [];

    const isProvinceLevel = (r: Record<string, unknown>) => {
      const level = String(r['Reporting level'] ?? '').toLowerCase();
      return level.includes('province') || level === '' || level === '–';
    };
    const isNotApplicableBreakdown = (r: Record<string, unknown>) =>
      String(r['Level 1 breakdown'] ?? '') === 'Not applicable';

    const alberta = rows.filter((r) => {
      const prov = String(r['Province/Territory'] ?? '');
      return (
        (prov === 'Alberta' || prov.includes('Alberta')) &&
        isNotApplicableBreakdown(r) &&
        isProvinceLevel(r)
      );
    });
    const canada = rows.filter((r) => {
      const prov = String(r['Province/Territory'] ?? '');
      return (
        (prov === 'Canada' || prov === 'National' || prov.includes('Canada')) &&
        isNotApplicableBreakdown(r) &&
        isProvinceLevel(r)
      );
    });

    const frames = Array.from(
      new Set(
        [...alberta, ...canada]
          .map((r) => String(r['Time frame'] ?? ''))
          .filter(Boolean),
      ),
    ).sort();

    return frames
      .map((frame) => {
        const ab = alberta.find((r) => String(r['Time frame'] ?? '') === frame);
        const ca = canada.find((r) => String(r['Time frame'] ?? '') === frame);
        return {
          timeFrame: frame,
          albertaRate: ab ? parseCihiNumber(ab['Risk-adjusted rate']) : null,
          canadaRate: ca ? parseCihiNumber(ca['Risk-adjusted rate']) : null,
        };
      })
      .filter((d) => d.albertaRate != null || d.canadaRate != null);
  }, [CIHI_MH_READMISSION_RATES]);

  const getBedStatusStyle = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === 'available') return 'bg-ok-soft text-ok border-ok';
    if (lower === 'almost full') return 'bg-warn-soft text-warn border-warn';
    if (lower === 'full') return 'bg-crit-soft text-crit border-crit';
    if (lower.includes('planned')) return 'bg-neutral-chip text-ink-2 border-line-2';
    if (lower.includes('operational')) return 'bg-neutral-chip text-ink-2 border-line-2';
    return 'bg-neutral-chip text-ink-2 border-line-2';
  };

  const tabs: { key: MentalHealthSubTab; label: string; icon: React.ElementType }[] = [
    { key: 'substance-harms', label: 'Substance harms', icon: TrendingUp },
    { key: 'addiction-beds', label: 'Addiction beds', icon: Layers },
    { key: 'mh-readmissions', label: 'MH readmissions', icon: Activity },
    { key: 'helplines', label: 'Crisis helplines', icon: Clock },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-neutral-chip" />
          <div className="mt-2 h-3 w-2/3 rounded bg-neutral-chip" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-12 text-sm text-ink-2">
        <AlertTriangle className="h-6 w-6 text-warn" />
        <span>Failed to load mental health data: {error}</span>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={Brain}
        title="Mental health & addictions"
        description="Track substance use harms, treatment bed capacity, CIHI MH readmissions, and helpline directories."
        metadata={metadata ?? undefined}
        arrayKey={substanceHarmsComplete ? 'SUBSTANCE_HARM_TRENDS' : 'ADDICTION_BED_CAPACITIES'}
        variant="light"
      >
        <button
          onClick={() => !isLoading && refresh()}
          disabled={isLoading}
          className="self-start md:self-auto rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </DashboardHeader>

      <div className="sticky top-16 z-20 bg-paper border-b border-line flex items-center overflow-x-auto gap-2 pb-px no-scrollbar -mx-1 px-1">
        {tabs.map((t) => {
          const active = effectiveSubTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all shrink-0 cursor-pointer ${
                active
                  ? 'border-accent text-accent'
                  : 'border-transparent text-ink-3 hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBTAB: Substance Harms */}
      {effectiveSubTab === 'substance-harms' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="SUBSTANCE_HARM_TRENDS"
          />

          {!substanceHarmsComplete ? (
            <div className="rounded-xl border border-line bg-surface p-8 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-warn mx-auto" />
              <h3 className="text-sm font-semibold text-ink">Substance harm trends unavailable</h3>
              <p className="text-xs text-ink-2 max-w-xl mx-auto leading-relaxed">
                Data unavailable until the Alberta Substance Use Surveillance pipeline produces complete
                source-backed rows (apparent deaths, EMS overdose responses, hospitalizations, and Alberta
                rate for All Substances). Partial single-substance subsets are not shown as province-wide
                totals.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(selectedHarmKpi === 'apparentDeaths' ? null : 'apparentDeaths')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(selectedHarmKpi === 'apparentDeaths' ? null : 'apparentDeaths');
                    }
                  }}
                  className={`rounded-xl border p-4 space-y-1 relative overflow-hidden group cursor-pointer transition-all select-none ${
                    selectedHarmKpi === 'apparentDeaths'
                      ? 'border-crit bg-crit-soft'
                      : 'border-line bg-surface hover:bg-paper hover:border-line-2'
                  }`}
                >
                  <span className="text-[10px] font-medium text-ink-3 block">
                    Alberta apparent toxicity deaths
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-crit">
                      {substanceHarmStats.latest?.apparentDeaths != null
                        ? substanceHarmStats.latest.apparentDeaths.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-ink-2 font-mono">deaths</span>
                  </div>
                  <p className="text-[10px] text-ink-2 pt-1 border-t border-line">
                    {substanceHarmStats.peak &&
                    substanceHarmStats.latest &&
                    substanceHarmStats.peak.year !== substanceHarmStats.latest.year
                      ? `Period peak year in source series: ${substanceHarmStats.peak.year} (${substanceHarmStats.peak.apparentDeaths.toLocaleString()} deaths).`
                      : 'Latest complete annual apparent toxicity deaths (All Substances).'}
                  </p>
                  <span className="text-[9px] text-ink-3 group-hover:text-crit font-medium flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="h-3.5 w-3.5" />
                    {selectedHarmKpi === 'apparentDeaths' ? 'Active: hide trend' : 'Click to view trend'}
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(
                      selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses',
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(
                        selectedHarmKpi === 'emsOverdoseResponses' ? null : 'emsOverdoseResponses',
                      );
                    }
                  }}
                  className={`rounded-xl border p-4 space-y-1 relative overflow-hidden group cursor-pointer transition-all select-none ${
                    selectedHarmKpi === 'emsOverdoseResponses'
                      ? 'border-warn bg-warn-soft'
                      : 'border-line bg-surface hover:bg-paper hover:border-line-2'
                  }`}
                >
                  <span className="text-[10px] font-medium text-ink-3 block">
                    Emergency EMS overdose dispatches
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-warn">
                      {substanceHarmStats.latest?.emsOverdoseResponses != null
                        ? substanceHarmStats.latest.emsOverdoseResponses.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-ink-2 font-mono">annual responses</span>
                  </div>
                  <p className="text-[10px] text-ink-2 pt-1 border-t border-line">
                    Source-backed EMS suspected overdose dispatches for the latest complete year.
                  </p>
                  <span className="text-[9px] text-ink-3 group-hover:text-warn font-medium flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="h-3.5 w-3.5" />
                    {selectedHarmKpi === 'emsOverdoseResponses'
                      ? 'Active: hide trend'
                      : 'Click to view trend'}
                  </span>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setSelectedHarmKpi(selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations')
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedHarmKpi(
                        selectedHarmKpi === 'hospitalizations' ? null : 'hospitalizations',
                      );
                    }
                  }}
                  className={`rounded-xl border p-4 space-y-1 relative overflow-hidden group cursor-pointer transition-all select-none ${
                    selectedHarmKpi === 'hospitalizations'
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface hover:bg-paper hover:border-line-2'
                  }`}
                >
                  <span className="text-[10px] font-medium text-ink-3 block">
                    Poisoning hospital admissions
                    {substanceHarmStats.latest?.year ? ` (${substanceHarmStats.latest.year})` : ''}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold font-mono tabular-nums text-accent">
                      {substanceHarmStats.latest?.hospitalizations != null
                        ? substanceHarmStats.latest.hospitalizations.toLocaleString()
                        : 'N/A'}
                    </span>
                    <span className="text-xs text-ink-2 font-mono">admissions</span>
                  </div>
                  <p className="text-[10px] text-ink-2 pt-1 border-t border-line">
                    Source-backed poisoning hospital admissions for the latest complete year.
                  </p>
                  <span className="text-[9px] text-ink-3 group-hover:text-accent font-medium flex items-center gap-1 mt-1.5 transition-colors">
                    <BarChart2 className="h-3.5 w-3.5" />
                    {selectedHarmKpi === 'hospitalizations' ? 'Active: hide trend' : 'Click to view trend'}
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {selectedHarmKpi && selectedHarmKpiDetails && harmKpiStats && (
                  <motion.div
                    key={`harm-kpi-trend-${selectedHarmKpi}`}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="relative rounded-xl border border-line bg-surface p-5 space-y-4">
                      <button
                        onClick={() => setSelectedHarmKpi(null)}
                        className="absolute top-4 right-4 p-1.5 rounded-lg border border-line bg-paper text-ink-2 hover:border-line-2 hover:text-ink transition-colors cursor-pointer"
                        title="Close panel"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                            {React.createElement(selectedHarmKpiDetails.icon, {
                              className: `h-4 w-4 ${selectedHarmKpiDetails.valueClass}`,
                            })}
                            <span>{selectedHarmKpiDetails.label} historical trend</span>
                          </h3>
                          <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                            {selectedHarmKpiDetails.description}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-line bg-paper">
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-medium text-ink-3 block">
                            Series start
                          </span>
                          <span className="text-xl font-semibold text-ink-2 font-mono tabular-nums">
                            {harmKpiStats.baseline}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-medium text-ink-3 block">Latest</span>
                          <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                            {harmKpiStats.latest}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-medium text-ink-3 block">
                            Period peak
                          </span>
                          <span
                            className={`text-xl font-semibold font-mono tabular-nums ${selectedHarmKpiDetails.valueClass}`}
                          >
                            {harmKpiStats.peak}
                            {selectedHarmKpiDetails.unit}
                          </span>
                        </div>
                        <div className="space-y-1 text-center sm:text-left">
                          <span className="text-[10px] font-medium text-ink-3 block">
                            Overall shift
                          </span>
                          <span
                            className={`text-xl font-semibold font-mono tabular-nums flex items-center justify-center sm:justify-start gap-1 ${
                              harmKpiStats.isIncrease ? 'text-crit' : 'text-ok'
                            }`}
                          >
                            {harmKpiStats.isIncrease ? (
                              <TrendingUp className="h-4 w-4 shrink-0" />
                            ) : (
                              <TrendingDown className="h-4 w-4 shrink-0" />
                            )}
                            <span>
                              {harmKpiStats.delta}
                              {selectedHarmKpiDetails.unit} ({harmKpiStats.pctChange})
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={filteredHarmData}
                            margin={{ top: 10, right: 15, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id={selectedHarmKpiDetails.gradientId}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={selectedHarmKpiDetails.strokeColor}
                                  stopOpacity={0.2}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={selectedHarmKpiDetails.strokeColor}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                            <XAxis
                              dataKey="year"
                              stroke={CHART_TICK}
                              tick={{ fill: CHART_TICK, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                            />
                            <YAxis
                              stroke={CHART_TICK}
                              tick={{ fill: CHART_TICK, fontSize: 10, fontFamily: 'var(--font-mono)' }}
                            />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              itemStyle={tooltipItemStyle}
                              labelStyle={tooltipLabelStyle}
                            />
                            <Area
                              type="monotone"
                              dataKey={selectedHarmKpi}
                              name={selectedHarmKpiDetails.label}
                              stroke={selectedHarmKpiDetails.strokeColor}
                              strokeWidth={2.5}
                              fillOpacity={1}
                              fill={`url(#${selectedHarmKpiDetails.gradientId})`}
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Substance-induced toxicity & overdose harms
                    </h3>
                    <p className="text-[10px] text-ink-3">
                      Complete All Substances rows only — not single-substance subsets
                    </p>
                  </div>

                  {filteredHarmData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-ink-3">
                      No complete trend points available.
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={filteredHarmData}
                          margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="colorDeaths" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.75 0.14 25)" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="oklch(0.75 0.14 25)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorEMS" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0.15} />
                              <stop offset="95%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                          <XAxis
                            dataKey="year"
                            stroke={CHART_TICK}
                            tick={{ fill: CHART_TICK, fontSize: 10 }}
                          />
                          <YAxis
                            stroke={CHART_TICK}
                            tick={{ fill: CHART_TICK, fontSize: 9 }}
                          />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            itemStyle={tooltipItemStyle}
                            labelStyle={tooltipLabelStyle}
                          />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Area
                            type="monotone"
                            dataKey="apparentDeaths"
                            name="Apparent toxicity deaths"
                            stroke="oklch(0.75 0.14 25)"
                            fillOpacity={1}
                            fill="url(#colorDeaths)"
                            strokeWidth={2.5}
                          />
                          <Area
                            type="monotone"
                            dataKey="emsOverdoseResponses"
                            name="EMS suspected overdose calls"
                            stroke="oklch(0.82 0.12 85)"
                            fillOpacity={1}
                            fill="url(#colorEMS)"
                            strokeWidth={1.5}
                          />
                          <Line
                            type="monotone"
                            dataKey="hospitalizations"
                            name="Poisoning hospital admissions"
                            stroke="oklch(0.68 0.13 252)"
                            strokeWidth={2}
                            dot
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-surface p-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">Annual event breakdown</h3>
                      <p className="text-[10px] text-ink-3">
                        Total recorded events across Alberta by year
                      </p>
                    </div>

                    <div className="space-y-3 pt-1">
                      {filteredHarmData.map((item) => (
                        <div
                          key={item.year}
                          className="rounded-xl border border-line bg-paper p-3 space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs font-semibold text-ink border-b border-line pb-1.5">
                            <span>Year {item.year}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                            <div>
                              <span className="text-[9px] text-ink-3 block">Deaths</span>
                              <span className="font-mono text-xs font-semibold tabular-nums text-crit">
                                {item.apparentDeaths.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-ink-3 block">EMS calls</span>
                              <span className="font-mono text-xs font-semibold tabular-nums text-warn">
                                {item.emsOverdoseResponses.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-[9px] text-ink-3 block">Admissions</span>
                              <span className="font-mono text-xs font-semibold tabular-nums text-accent">
                                {item.hospitalizations.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredHarmData.length === 0 && (
                        <p className="text-xs text-ink-3">No annual breakdown rows available.</p>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] text-ink-2 leading-relaxed border-t border-line pt-3 flex items-start gap-1.5">
                    <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span>
                      <strong>Surveillance notice:</strong> Registry backlogs may update prior years
                      retroactively when medical examiner and toxicology findings are finalized.
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* SUBTAB: Addiction Beds (ABED) */}
      {effectiveSubTab === 'addiction-beds' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="ADDICTION_BED_CAPACITIES"
          />
          <div className="rounded-xl border border-line bg-surface p-3 flex items-start gap-2 text-xs text-ink-2">
            <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Bed availability data is sourced from the{' '}
              <a
                href="https://findaddictionbeds.alberta.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Addiction Bed Exploration Dashboard (ABED)
              </a>
              , updated once daily (Mon–Fri). Beds cannot be reserved through the dashboard — contact
              sites directly to confirm availability, intake policies, and waitlist information. For
              immediate help, call 211 or visit{' '}
              <a
                href="https://recoveryaccessalberta.ca/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                Recovery Access Alberta
              </a>
              .
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="inline-flex flex-wrap gap-2">
              {[
                'All',
                'Calgary Corridor',
                'Edmonton Corridor',
                'Central Corridor',
                'South Corridor',
                'North Corridor',
              ].map((corr) => (
                <button
                  key={corr}
                  onClick={() => setCorridorFilter(corr)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    corridorFilter === corr
                      ? 'border-accent bg-accent text-white'
                      : 'border-line-2 bg-surface text-ink-2 hover:bg-paper hover:text-ink'
                  }`}
                >
                  {corr.replace(' Corridor', '')}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-3" />
              <input
                type="text"
                placeholder="Search bed providers or sites..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="w-full bg-paper border border-line rounded-lg pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl border border-line bg-surface p-5">
            <div className="space-y-1">
              <span className="text-[9px] font-medium text-ink-3 block">ABED active sites</span>
              <span className="text-xl font-semibold text-ink">
                {ADDICTION_BED_CAPACITIES.length > 0
                  ? `${ADDICTION_BED_CAPACITIES.length} registered sites`
                  : 'N/A'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-medium text-ink-3 block">Total bed allocation</span>
              <span className="text-xl font-semibold text-ink">
                {ADDICTION_BED_CAPACITIES.length > 0 ? `${bedStats.total} beds` : 'N/A'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-medium text-ink-3 block">Available beds today</span>
              {bedStats.hasLiveData ? (
                <span className="text-xl font-semibold text-ok">
                  {bedStats.available} of {bedStats.total} beds
                </span>
              ) : (
                <span className="text-sm font-semibold text-warn">N/A</span>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-medium text-ink-3 block">Avg system bed occupancy</span>
              {bedStats.hasLiveData ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold text-ink">
                    {bedStats.pctOccupied.toFixed(1)}%
                  </span>
                  <div className="w-16 bg-paper h-1.5 rounded-full overflow-hidden border border-line">
                    <div className="bg-accent h-full" style={{ width: `${bedStats.pctOccupied}%` }} />
                  </div>
                </div>
              ) : (
                <span className="text-sm font-semibold text-warn">N/A</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBeds.map((bed) => {
              return (
                <div
                  key={bed.id}
                  className="rounded-xl border border-line bg-surface p-4 flex flex-col justify-between space-y-4 hover:border-line-2 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-ink truncate">{bed.siteName}</h4>
                        <p className="text-[10px] text-ink-3 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                          <span className="truncate">{bed.corridor}</span>
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono font-semibold shrink-0 ${getBedStatusStyle(bed.status)}`}
                      >
                        {bed.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-line">
                      <div className="bg-paper p-2 rounded flex flex-col border border-line">
                        <span className="text-[8px] text-ink-3">Care bed type</span>
                        <span className="font-medium text-ink-2 truncate">{bed.bedType}</span>
                      </div>
                      <div className="bg-paper p-2 rounded flex flex-col border border-line">
                        <span className="text-[8px] text-ink-3">Gender / age</span>
                        <span className="font-medium text-ink-2 truncate">
                          {bed.gender} • {bed.bedType === 'Youth Specific' ? 'Youth' : 'Adult'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-paper p-2 rounded-lg border border-line">
                      {bed.availableBeds !== null && bed.availableBeds !== undefined ? (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-ink-2">Available beds:</span>
                            <strong className="text-ink font-mono font-semibold tabular-nums">
                              {bed.availableBeds} / {bed.totalBeds}
                            </strong>
                          </div>
                          <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden border border-line">
                            <div
                              className="bg-ok h-full"
                              style={{
                                width: `${Math.min(100, (bed.availableBeds / bed.totalBeds) * 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-[9px] text-ink-3">
                            {bed.availableBeds === 0
                              ? 'No vacancies currently reported'
                              : bed.availableBeds / bed.totalBeds < 0.25
                                ? 'Limited availability'
                                : 'Beds available now'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-ink-2">Available beds:</span>
                            <strong className="text-warn font-mono font-semibold tabular-nums">N/A</strong>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-ink-2">Total beds:</span>
                            <strong className="text-ink font-mono font-semibold tabular-nums">
                              {bed.totalBeds} beds
                            </strong>
                          </div>
                          <p className="text-[9px] text-warn">
                            Live availability not currently reported for this site. Check{' '}
                            <a
                              href="https://findaddictionbeds.alberta.ca/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-ink"
                            >
                              ABED
                            </a>{' '}
                            or call 211 for current status.
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-line text-[10px]">
                    <span className="text-ink-3 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{bed.lastUpdated ?? 'N/A'}</span>
                    </span>

                    <a
                      href="https://recoveryaccessalberta.ca/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong transition-colors text-center"
                    >
                      Triage intake
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredBeds.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
                <AlertTriangle className="h-8 w-8 text-warn mx-auto mb-2" />
                <p>
                  {ADDICTION_BED_CAPACITIES.length === 0
                    ? 'Addiction bed capacity data is currently unavailable.'
                    : 'No active treatment or recovery beds matched your search parameters.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: CIHI MH Readmissions */}
      {effectiveSubTab === 'mh-readmissions' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="CIHI_MH_READMISSION_RATES"
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  30-day readmission for mental health and substance use
                </h3>
                <p className="text-[10px] text-ink-3">
                  CIHI risk-adjusted rate by fiscal time frame (province-level, Level 1 breakdown: Not
                  applicable)
                </p>
              </div>

              {mhReadmissionChart.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <AlertTriangle className="h-7 w-7 text-warn" />
                  <p className="text-xs text-ink-2">
                    CIHI mental-health readmission rates are currently unavailable for Alberta at
                    province level.
                  </p>
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={mhReadmissionChart}
                      margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis
                        dataKey="timeFrame"
                        stroke={CHART_TICK}
                        tick={{ fill: CHART_TICK, fontSize: 9 }}
                      />
                      <YAxis
                        label={{
                          value: 'Risk-adjusted rate',
                          angle: -90,
                          position: 'insideLeft',
                          fill: CHART_TICK,
                          fontSize: 10,
                        }}
                        stroke={CHART_TICK}
                        tick={{ fill: CHART_TICK, fontSize: 9 }}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={tooltipItemStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="albertaRate"
                        name="Alberta risk-adjusted rate"
                        stroke="oklch(0.68 0.13 252)"
                        strokeWidth={2.5}
                        dot
                        connectNulls
                      />
                      {mhReadmissionChart.some((d) => d.canadaRate != null) && (
                        <Line
                          type="monotone"
                          dataKey="canadaRate"
                          name="Canada risk-adjusted rate"
                          stroke="oklch(0.62 0.02 255)"
                          strokeWidth={1.5}
                          strokeDasharray="4 4"
                          dot
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[10px] text-ink-2">
                Source: CIHI 30-day readmission for mental health and substance use indicator table.
                Only province/territory rows with Level 1 breakdown &quot;Not applicable&quot; are charted.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Alberta series points</h3>
                  <p className="text-[10px] text-ink-3">Risk-adjusted rate by fiscal time frame</p>
                </div>

                <div className="space-y-3 pt-1 max-h-80 overflow-y-auto">
                  {mhReadmissionChart.length === 0 && (
                    <p className="text-xs text-ink-3">No province-level readmission rows available.</p>
                  )}
                  {mhReadmissionChart.map((item) => (
                    <div
                      key={item.timeFrame}
                      className="rounded-xl border border-line bg-paper p-3 space-y-1.5"
                    >
                      <span className="text-[10px] text-ink-3 block font-medium">
                        {item.timeFrame}
                      </span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-semibold text-ink font-mono tabular-nums">
                          {item.albertaRate != null ? item.albertaRate.toFixed(1) : 'N/A'}
                        </span>
                        <span className="text-[10px] text-accent font-mono font-medium">AB rate</span>
                      </div>
                      {item.canadaRate != null && (
                        <div className="flex justify-between text-[9px] text-ink-2">
                          <span>Canada comparator</span>
                          <span className="font-mono tabular-nums">{item.canadaRate.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-line text-[10px] text-ink-2 flex items-start gap-1.5">
                <ShieldAlert className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p>
                  Values are risk-adjusted rates from CIHI. Missing Canada comparators are omitted when
                  not present in the domain payload.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: Helplines */}
      {effectiveSubTab === 'helplines' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="SUPPORT_HELPLINES"
          />
          <div className="rounded-xl border border-line bg-surface p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">Crisis helplines & navigation pathways</h3>
              <p className="text-[10px] text-ink-3">
                Immediate, toll-free mental health support services available to Alberta residents
              </p>
            </div>

            {SUPPORT_HELPLINES.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center space-y-2">
                <AlertTriangle className="h-7 w-7 text-warn mx-auto" />
                <p className="text-xs text-ink-2">
                  Crisis helpline directory is currently unavailable from upstream sources.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUPPORT_HELPLINES.map((hl, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-line bg-paper p-4 flex flex-col justify-between space-y-3 hover:border-line-2 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-ink flex items-center gap-1.5">
                          <PhoneCall className="h-4 w-4 text-accent" />
                          <span>{hl.name}</span>
                        </h4>
                        <span className="text-[9px] bg-neutral-chip text-ink-2 border border-line px-2 py-0.5 rounded-full font-medium">
                          {hl.availability}
                        </span>
                      </div>
                      <p className="text-xs text-ink-2 leading-relaxed">{hl.description}</p>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-line text-[10px]">
                      <span className="text-ink-3 font-mono tabular-nums font-medium">{hl.scope}</span>
                      <a
                        href={`tel:${hl.number.replace(/\s+/g, '')}`}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong transition-colors flex items-center gap-1"
                      >
                        <span>Call {hl.number}</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
