import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Activity,
  MapPin,
  CheckCircle,
  Phone,
  Clock,
  Globe,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Stethoscope,
  Sliders,
  BarChart3,
  BarChart2,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  Label,
  AreaChart,
  Area,
} from 'recharts';
import type {
  AttachmentRate,
  AcceptingProvider,
  ContinuitySatisfactionHqca,
} from '../primaryCareData';
import * as primaryCareDataModule from '../primaryCareData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type PrimaryCareData = {
  ATTACHMENT_RATES: AttachmentRate[];
  ACCEPTING_PROVIDERS: AcceptingProvider[];
  CONTINUITY_SATISFACTION_HQCA?: ContinuitySatisfactionHqca[];
  /** Raw CIHI same-day/next-day access rows (optional). */
  CIHI_SAME_DAY_ACCESS?: Record<string, unknown>[];
};

function parseWeightedPercent(raw: unknown): number | null {
  if (raw == null || raw === '' || raw === '–' || raw === '-') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function rowStr(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v == null) return '';
  return String(v).trim();
}

function isPlaceMatch(row: Record<string, unknown>, place: string): boolean {
  const target = place.toLowerCase();
  const placeOrg = rowStr(row, 'Place or organization').toLowerCase();
  const province = rowStr(row, 'Province/Territory').toLowerCase();
  return placeOrg === target || province === target;
}

function isLevel1Total(row: Record<string, unknown>): boolean {
  const l1 = rowStr(row, 'Level 1 breakdown').toLowerCase();
  return (
    l1 === 'not applicable' ||
    l1 === 'n/a' ||
    l1 === 'na' ||
    l1 === '–' ||
    l1 === '-' ||
    l1 === ''
  );
}

function isOverallLifeStage(row: Record<string, unknown>): boolean {
  const ls = rowStr(row, 'Life Stage').toLowerCase();
  return (
    ls === 'overall' ||
    ls === 'all ages' ||
    ls === 'all' ||
    ls === 'total' ||
    ls.includes('overall')
  );
}

/** Prefer Alberta (then Canada) provincial totals; overall life stage if present, else first total row. */
function pickCihiSameDayAccess(rows: Record<string, unknown>[]): {
  value: number | null;
  year: string;
  place: string;
  lifeStage: string;
} {
  if (!rows.length) {
    return { value: null, year: '', place: '', lifeStage: '' };
  }

  const pickFrom = (candidates: Record<string, unknown>[]) => {
    if (!candidates.length) return null;
    const overall = candidates.find(isOverallLifeStage);
    const row = overall ?? candidates[0];
    return {
      value: parseWeightedPercent(row['Percent (weighted)']),
      year: rowStr(row, 'Time frame'),
      place: rowStr(row, 'Place or organization') || rowStr(row, 'Province/Territory'),
      lifeStage: rowStr(row, 'Life Stage'),
    };
  };

  const albertaTotals = rows.filter((r) => isPlaceMatch(r, 'Alberta') && isLevel1Total(r));
  const canadaTotals = rows.filter((r) => isPlaceMatch(r, 'Canada') && isLevel1Total(r));

  return (
    pickFrom(albertaTotals) ??
    pickFrom(canadaTotals) ?? { value: null, year: '', place: '', lifeStage: '' }
  );
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${value}%`;
}

export default function PrimaryCareDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<PrimaryCareData>(
    'primary-care',
    primaryCareDataModule
  );

  const domainData = useMemo(
    () => ({
      ATTACHMENT_RATES: data?.ATTACHMENT_RATES ?? [],
      ACCEPTING_PROVIDERS: data?.ACCEPTING_PROVIDERS ?? [],
      CONTINUITY_SATISFACTION_HQCA: data?.CONTINUITY_SATISFACTION_HQCA ?? [],
      CIHI_SAME_DAY_ACCESS: data?.CIHI_SAME_DAY_ACCESS ?? [],
    }),
    [data]
  );

  const latestHqcaContinuityByZone = useMemo(() => {
    const rows = domainData.CONTINUITY_SATISFACTION_HQCA;
    if (!rows.length) return [];
    const latestYear = rows.map((r) => r.fiscalYear).sort((a, b) => b.localeCompare(a))[0];
    return rows
      .filter((r) => r.fiscalYear === latestYear)
      .sort((a, b) => b.continuityPct - a.continuityPct);
  }, [domainData.CONTINUITY_SATISFACTION_HQCA]);

  const cihiSameDay = useMemo(
    () => pickCihiSameDayAccess(domainData.CIHI_SAME_DAY_ACCESS),
    [domainData.CIHI_SAME_DAY_ACCESS]
  );

  const [activeSubTab, setActiveSubTab] = useState<'attachment' | 'directory'>('attachment');

  // Interactive KPI selected state for attachment trend panel
  const [selectedKpi, setSelectedKpi] = useState<'attachment_rate' | null>(null);

  // Interactive State for Provider Directory
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [filterWalkIn, setFilterWalkIn] = useState(false);
  const [filterAfterHours, setFilterAfterHours] = useState(false);
  const [filterVirtual, setFilterVirtual] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasClickedBrowseAll, setHasClickedBrowseAll] = useState(false);

  const isFilterActive = useMemo(() => {
    return (
      directorySearch.trim().length > 0 ||
      selectedZoneFilter !== 'All' ||
      selectedTypeFilter !== 'All' ||
      filterWalkIn ||
      filterAfterHours ||
      filterVirtual
    );
  }, [directorySearch, selectedZoneFilter, selectedTypeFilter, filterWalkIn, filterAfterHours, filterVirtual]);

  useEffect(() => {
    setCurrentPage(1);
  }, [directorySearch, selectedZoneFilter, selectedTypeFilter, filterWalkIn, filterAfterHours, filterVirtual]);

  // Filtered Provider Directory logic
  const filteredProviders = useMemo(() => {
    return domainData.ACCEPTING_PROVIDERS.filter((prov) => {
      const matchesSearch =
        prov.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.clinicName.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.city.toLowerCase().includes(directorySearch.toLowerCase()) ||
        (prov.pcnName && prov.pcnName.toLowerCase().includes(directorySearch.toLowerCase()));

      const matchesZone = selectedZoneFilter === 'All' || prov.zone === selectedZoneFilter;
      const matchesType = selectedTypeFilter === 'All' || prov.type === selectedTypeFilter;

      const matchesWalkIn = !filterWalkIn || prov.features.walkIn;
      const matchesAfterHours = !filterAfterHours || prov.features.afterHours;
      const matchesVirtual = !filterVirtual || prov.features.virtualAppointments;

      return matchesSearch && matchesZone && matchesType && matchesWalkIn && matchesAfterHours && matchesVirtual;
    });
  }, [directorySearch, selectedZoneFilter, selectedTypeFilter, filterWalkIn, filterAfterHours, filterVirtual, domainData]);

  const PAGE_SIZE = 15;
  const totalPages = useMemo(() => {
    return Math.ceil(filteredProviders.length / PAGE_SIZE);
  }, [filteredProviders]);

  const paginatedProviders = useMemo(() => {
    return filteredProviders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  }, [filteredProviders, currentPage]);

  // Executive summary counts
  const totalAcceptingCount = domainData.ACCEPTING_PROVIDERS.filter((p) => p.acceptingNewPatients).length;

  // Data-driven computed values (avoid hardcoded KPIs)
  const albertaAttachment = domainData.ATTACHMENT_RATES
    .filter((r) => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
    .sort((a, b) => b.reporting_year.localeCompare(a.reporting_year))[0];
  const canadaAttachment = domainData.ATTACHMENT_RATES
    .filter((r) => r.geography === 'Canada' && r.demographic_group === 'All Residents')
    .sort((a, b) => b.reporting_year.localeCompare(a.reporting_year))[0];
  const attachmentRate: number | null =
    albertaAttachment?.metric_value != null && Number.isFinite(albertaAttachment.metric_value)
      ? albertaAttachment.metric_value
      : null;
  const canadaAvg: number | null =
    canadaAttachment?.metric_value != null && Number.isFinite(canadaAttachment.metric_value)
      ? canadaAttachment.metric_value
      : null;
  const reportingYear = albertaAttachment?.reporting_year ?? canadaAttachment?.reporting_year ?? '';

  // Latest-year Alberta attachment rates by demographic group (for chart + insights)
  const latestAlbertaRates = useMemo(() => {
    const latestYear =
      domainData.ATTACHMENT_RATES
        .filter((r) => r.geography === 'Alberta')
        .map((r) => r.reporting_year)
        .sort((a, b) => b.localeCompare(a))[0] ?? reportingYear;
    const year = latestYear || reportingYear;
    return domainData.ATTACHMENT_RATES
      .filter((r) => r.geography === 'Alberta' && r.reporting_year === year)
      .sort((a, b) => b.metric_value - a.metric_value);
  }, [domainData, reportingYear]);

  const getRate = (group: string): number | null => {
    const found = latestAlbertaRates.find((r) => r.demographic_group === group)?.metric_value;
    return found != null && Number.isFinite(found) ? found : null;
  };
  const lowIncomeRate = getRate('Lowest Income Quintile');
  const youngAdultsRate = getRate('Adults (18-64)');
  const ruralRate = getRate('Rural / Remote Areas');
  const seniorsRate = getRate('Seniors (65+)');
  const workingAgeRate = youngAdultsRate;

  const attachmentGapInsight = useMemo(() => {
    if (attachmentRate == null || !latestAlbertaRates.length) {
      return domainData.ATTACHMENT_RATES.length === 0
        ? 'Attachment rates are not available from upstream CIHI data.'
        : null;
    }
    const gaps: { label: string; rate: number; gap: number }[] = [
      lowIncomeRate != null
        ? { label: 'lowest income quintile', rate: lowIncomeRate, gap: attachmentRate - lowIncomeRate }
        : null,
      ruralRate != null
        ? { label: 'rural / remote residents', rate: ruralRate, gap: attachmentRate - ruralRate }
        : null,
      workingAgeRate != null
        ? { label: 'working-age adults (18–64)', rate: workingAgeRate, gap: attachmentRate - workingAgeRate }
        : null,
    ].filter((g): g is { label: string; rate: number; gap: number } => g != null && g.gap >= 3);

    const worst = gaps.sort((a, b) => b.gap - a.gap)[0];
    const seniorsLabel = seniorsRate != null ? `${seniorsRate}%` : 'N/A';
    if (!worst) {
      return `Provincial attachment is ${attachmentRate}% (CIHI ${reportingYear || '—'}). Lowest-income and rural groups remain below the provincial average where reported; seniors (${seniorsLabel}) are typically highest.`;
    }
    return `Provincial attachment is ${attachmentRate}% (CIHI ${reportingYear || '—'}). The largest gap is ${worst.gap.toFixed(1)} points below average for the ${worst.label} (${worst.rate}% attached) versus seniors at ${seniorsLabel}.`;
  }, [
    attachmentRate,
    reportingYear,
    lowIncomeRate,
    ruralRate,
    workingAgeRate,
    seniorsRate,
    latestAlbertaRates.length,
    domainData.ATTACHMENT_RATES.length,
  ]);

  // Trend panel stats for the attachment rate KPI
  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const series = domainData.ATTACHMENT_RATES
      .filter((r) => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
      .sort((a, b) => a.reporting_year.localeCompare(b.reporting_year))
      .map((r) => r.metric_value)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (series.length === 0) return null;

    const baseline = series[0];
    const latest = series[series.length - 1];
    const peak = Math.max(...series);
    const minVal = Math.min(...series);
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
  }, [selectedKpi, domainData.ATTACHMENT_RATES]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'attachment_rate':
        return {
          label: 'Primary Care Attachment Rate',
          description:
            'Historical trend of the percentage of Albertans reporting access to a regular family doctor or health provider. Attachment has eroded modestly in recent years due to provider retirements and panel caps, with persistent gaps for low-income, young-adult, and rural residents.',
          colorClass: 'text-accent',
          bgClass: 'bg-accent-soft',
          strokeColor: 'oklch(0.68 0.13 252)',
          gradientId: 'colorAttachmentTrend',
          unit: '%',
          icon: Users,
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  // Historical trend series for the attachment rate AreaChart
  const attachmentTrendSeries = useMemo(() => {
    return domainData.ATTACHMENT_RATES
      .filter((r) => r.geography === 'Alberta' && r.demographic_group === 'All Residents')
      .sort((a, b) => a.reporting_year.localeCompare(b.reporting_year))
      .map((r) => ({ year: r.reporting_year, attachment_rate: r.metric_value }));
  }, [domainData.ATTACHMENT_RATES]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ink-2 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-warn" />
        <span>Failed to load primary care data: {error}</span>
        <button
          onClick={() => refresh()}
          className="px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-paper flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-ink-2 text-sm">
        Loading primary care data...
      </div>
    );
  }

  const sameDayValue = cihiSameDay.value;
  const sameDayYear = cihiSameDay.year;
  const sameDayLifeStage = cihiSameDay.lifeStage;
  const sameDayIn10 =
    sameDayValue != null ? Math.round((sameDayValue / 10) * 10) / 10 : null;

  return (
    <div className="space-y-6">
      <DashboardHeader
        variant="light"
        icon={Stethoscope}
        title="Primary Care & Providers"
        description="Track family medicine attachment rates and locate accepting clinics."
        metadata={metadata}
        arrayKey="ATTACHMENT_RATES"
      >
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {/* Sub-tab Navigation */}
      <div className="inline-flex rounded-lg border border-line bg-paper p-0.5">
        <button
          onClick={() => setActiveSubTab('attachment')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'attachment'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink hover:bg-paper'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Attachment & Access</span>
        </button>
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-2 cursor-pointer transition-colors ${
            activeSubTab === 'directory'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink hover:bg-paper'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Accepting Providers</span>
        </button>
      </div>

      {/* Top Level Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Metric 1 — Attachment */}
        <div
          tabIndex={0}
          role="button"
          aria-pressed={selectedKpi === 'attachment_rate'}
          onClick={() => setSelectedKpi(selectedKpi === 'attachment_rate' ? null : 'attachment_rate')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'attachment_rate' ? null : 'attachment_rate');
            }
          }}
          className={`bg-surface border rounded-xl p-4 flex items-start gap-4 cursor-pointer transition-colors select-none group relative ${
            selectedKpi === 'attachment_rate'
              ? 'border-accent bg-accent-soft'
              : 'border-line hover:border-line-2 hover:bg-paper'
          }`}
        >
          <div className="p-3 rounded-lg bg-paper border border-line text-accent shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3 text-[10px] font-medium block">
                Attached to Regular GP
              </span>
              <span
                className="p-1.5 bg-paper border border-line rounded-lg text-ink-3 group-hover:text-accent group-hover:border-line-2 transition-colors shrink-0"
                title="Click to view trend"
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-ink font-mono tabular-nums">
                {formatPct(attachmentRate)}
              </span>
              {reportingYear ? (
                <span className="text-[10px] text-warn font-medium flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> CIHI {reportingYear}
                </span>
              ) : (
                <span className="text-[10px] text-ink-3 font-medium">No upstream year</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-ink-2 block">
                Canada Avg: {formatPct(canadaAvg)}
                {reportingYear ? ` (CIHI ${reportingYear})` : ''}
              </span>
              <span
                className={`text-[9px] font-medium flex items-center gap-0.5 transition-opacity ${
                  selectedKpi === 'attachment_rate' ? 'text-accent opacity-100' : 'text-accent/80 opacity-100 group-hover:opacity-100'
                }`}
              >
                <BarChart2 className="w-3 h-3" />
                <span>{selectedKpi === 'attachment_rate' ? 'Active: Hide Trend' : 'Click to View Trend'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Metric 2 — Accepting providers */}
        <div className="bg-surface border border-line rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-paper border border-line text-ok shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-ink-3 text-[10px] font-medium block">
              Accepting Patients (Listed)
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-ink font-mono tabular-nums">
                {domainData.ACCEPTING_PROVIDERS.length === 0
                  ? 'N/A'
                  : `${totalAcceptingCount.toLocaleString()} Providers`}
              </span>
              {domainData.ACCEPTING_PROVIDERS.length > 0 && (
                <span className="text-[10px] text-ok font-medium">Live Directory</span>
              )}
            </div>
            <span className="text-[10px] text-ink-2 mt-1 block">
              {domainData.ACCEPTING_PROVIDERS.length === 0
                ? 'No accepting-provider listings available from the directory feed.'
                : `Source: Alberta Find a Provider directory · ${domainData.ACCEPTING_PROVIDERS.length} providers province-wide (not attachment statistics)`}
            </span>
          </div>
        </div>

        {/* Metric 3 — CIHI same/next-day access */}
        <button
          onClick={() => setActiveSubTab('attachment')}
          className="w-full text-left bg-surface border border-line rounded-xl p-4 flex items-start gap-4 hover:border-line-2 hover:bg-paper cursor-pointer transition-colors group relative"
        >
          <div className="p-3 rounded-lg bg-paper border border-line text-accent shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-ink-3 text-[10px] font-medium block">
                Same / Next Day Access
              </span>
              <span
                className="p-1.5 bg-paper border border-line rounded-lg text-ink-3 group-hover:text-accent group-hover:border-line-2 transition-colors shrink-0"
                title="Click to view details"
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-semibold text-ink font-mono tabular-nums">
                {formatPct(sameDayValue)}
              </span>
              {sameDayYear ? (
                <span className="text-[10px] text-accent font-medium">CIHI {sameDayYear}</span>
              ) : (
                <span className="text-[10px] text-ink-3 font-medium">No CIHI row</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 mt-1">
              <span className="text-[10px] text-ink-2 block">
                {sameDayValue != null
                  ? `${sameDayIn10} in 10 report same/next-day access${sameDayLifeStage ? ` (${sameDayLifeStage})` : ''}`
                  : 'Same-day access not available from CIHI_SAME_DAY_ACCESS'}
              </span>
              <span className="text-[9px] text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                View Details
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* KPI Trend Explorer Panel */}
      <AnimatePresence mode="wait">
        {selectedKpi && selectedKpiDetails && kpiStats && (
          <motion.div
            key={`kpi-trend-${selectedKpi}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-line p-4 sm:p-5 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    {React.createElement(selectedKpiDetails.icon, {
                      className: 'w-4 h-4 text-accent',
                    })}
                    <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                  </h3>
                  <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                    {selectedKpiDetails.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-paper border border-line rounded-xl p-3">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-medium text-ink-3 block">Baseline</span>
                  <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                    {kpiStats.baseline}
                    {selectedKpiDetails.unit}
                  </span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-medium text-ink-3 block">Current</span>
                  <span className="text-xl font-semibold text-ink font-mono tabular-nums">
                    {kpiStats.latest}
                    {selectedKpiDetails.unit}
                  </span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-medium text-ink-3 block">Peak</span>
                  <span className="text-xl font-semibold text-accent font-mono tabular-nums">
                    {kpiStats.peak}
                    {selectedKpiDetails.unit}
                  </span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-medium text-ink-3 block">Overall Shift</span>
                  <span
                    className={`text-sm font-semibold flex items-center justify-center sm:justify-start gap-1 ${
                      kpiStats.isIncrease ? 'text-ok' : 'text-warn'
                    }`}
                  >
                    {kpiStats.isIncrease ? (
                      <TrendingUp className="w-4 h-4 shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      {kpiStats.delta}
                      {selectedKpiDetails.unit} ({kpiStats.pctChange})
                    </span>
                  </span>
                </div>
              </div>

              <div className="h-60 mt-3 pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attachmentTrendSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                    <YAxis stroke="oklch(0.62 0.02 255)" fontSize={10} unit={selectedKpiDetails.unit} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', borderColor: 'oklch(0.28 0.02 255)', fontSize: 11 }}
                      itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                      formatter={(v: number) => [`${v}${selectedKpiDetails.unit}`, 'Attached']}
                    />
                    <Area
                      type="monotone"
                      dataKey="attachment_rate"
                      name={selectedKpiDetails.label}
                      stroke={selectedKpiDetails.strokeColor}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill={`url(#${selectedKpiDetails.gradientId})`}
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

      {/* SUB-TAB CONTENTS */}

      {/* 1. ATTACHMENT & ACCESS */}
      {activeSubTab === 'attachment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="bg-surface border border-line rounded-xl p-5 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Primary Care Attachment Rates by Demographic Group
                  </h3>
                  <p className="text-xs text-ink-2">
                    CIHI Shared Health Priorities — percent of Albertans reporting access to a regular provider
                    {reportingYear ? ` (${reportingYear})` : ''}
                  </p>
                  <DataTimestamp compact variant="light" metadata={metadata} arrayKey="ATTACHMENT_RATES" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-accent"></span>
                  <span className="text-xs text-ink-2">Alberta (% Attached)</span>
                </div>
              </div>

              {latestAlbertaRates.length === 0 ? (
                <div className="h-80 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-2 bg-surface p-4 text-sm text-ink-2">
                  <AlertTriangle className="w-6 h-6 text-warn" />
                  <span>No attachment rate rows available for Alberta.</span>
                </div>
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={latestAlbertaRates}
                      layout="vertical"
                      margin={{ top: 25, right: 30, left: 160, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        stroke="oklch(0.62 0.02 255)"
                        tickFormatter={(v) => `${v}%`}
                        className="text-[10px] font-mono tabular-nums"
                      />
                      <YAxis
                        dataKey="demographic_group"
                        type="category"
                        stroke="oklch(0.62 0.02 255)"
                        className="text-[10px] font-medium"
                        width={150}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', borderColor: 'oklch(0.28 0.02 255)' }}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        formatter={(v: number) => [`${v}%`, 'Attached Patients']}
                      />
                      <Bar dataKey="metric_value" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                        {latestAlbertaRates.map((entry, index) => {
                          let barColor = 'oklch(0.68 0.13 252)';
                          if (entry.demographic_group.includes('Lowest')) barColor = 'oklch(0.75 0.14 25)';
                          if (entry.demographic_group.includes('Seniors')) barColor = 'oklch(0.78 0.12 155)';
                          return <Cell key={`cell-${index}`} fill={barColor} />;
                        })}
                      </Bar>
                      {canadaAvg != null && (
                        <ReferenceLine x={canadaAvg} stroke="oklch(0.82 0.12 85)" strokeDasharray="3 3">
                          <Label
                            value={`Canada Avg (${canadaAvg}%)`}
                            position="top"
                            offset={10}
                            fill="oklch(0.82 0.12 85)"
                            className="text-[9px] font-mono font-semibold"
                          />
                        </ReferenceLine>
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {attachmentGapInsight && (
                <div className="p-3 bg-surface border border-line rounded-lg flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                  <div className="text-xs text-ink-2">
                    <strong className="text-ink">Access gap (CIHI):</strong> {attachmentGapInsight}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Analytics — verified HQCA + CIHI only */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-ink mb-1">
                  Key Quality & Access Indicators
                </h3>
                <p className="text-xs text-ink-2">
                  Verified upstream metrics from CIHI same-day access and HQCA FOCUS continuity.
                </p>
              </div>

              <div className="space-y-4">
                {/* CIHI Same-day Access indicator */}
                <div className="p-3 bg-paper border border-line rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs text-ink font-medium">Same/Next Day Doctor Access</span>
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold ${
                        sameDayValue == null ? 'text-ink-3' : 'text-accent'
                      }`}
                    >
                      {formatPct(sameDayValue)}
                    </span>
                  </div>
                  {sameDayValue != null ? (
                    <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line">
                      <div
                        className="bg-accent h-full rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, sameDayValue))}%` }}
                      />
                    </div>
                  ) : (
                    <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden border border-line">
                      <div className="bg-ink-3/30 h-full rounded-full w-0" />
                    </div>
                  )}
                  <p className="text-[10px] text-ink-2">
                    {sameDayValue != null
                      ? `CIHI Shared Health Priorities — ${sameDayLifeStage || 'provincial total'}${
                          sameDayYear ? ` (${sameDayYear})` : ''
                        }. Percentage reporting same-day or next-day access to a health provider.`
                      : 'No CIHI same-day/next-day access row available for Alberta (or Canada comparator).'}
                  </p>
                  <div>
                    <DataTimestamp compact variant="light" metadata={metadata} arrayKey="CIHI_SAME_DAY_ACCESS" />
                  </div>
                </div>
              </div>

              {latestHqcaContinuityByZone.length > 0 ? (
                <div className="p-3 bg-paper border border-line rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink font-medium">Family Doctor Continuity by Zone</span>
                    <DataTimestamp
                      compact
                      variant="light"
                      metadata={metadata}
                      arrayKey="CONTINUITY_SATISFACTION_HQCA"
                    />
                  </div>
                  <p className="text-[10px] text-ink-2">
                    HQCA FOCUS — percent of visits with the patient&apos;s usual family doctor (
                    {latestHqcaContinuityByZone[0]?.fiscalYear}).
                  </p>
                  <div className="divide-y divide-line max-h-40 overflow-y-auto">
                    {latestHqcaContinuityByZone.map((row) => (
                      <div
                        key={`${row.zone}-${row.fiscalYear}`}
                        className="flex justify-between py-1.5 text-[11px]"
                      >
                        <span className="text-ink-2">{row.zone}</span>
                        <span className="font-mono tabular-nums font-semibold text-accent">{row.continuityPct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-paper border border-line rounded-lg space-y-1">
                  <span className="text-xs text-ink font-medium">Family Doctor Continuity by Zone</span>
                  <p className="text-[10px] text-ink-2">
                    HQCA FOCUS continuity by zone is not available in the current primary-care payload.
                  </p>
                  <DataTimestamp
                    compact
                    variant="light"
                    metadata={metadata}
                    arrayKey="CONTINUITY_SATISFACTION_HQCA"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-line">
                <span className="text-[10px] text-accent font-medium block">CPAR Integration Status</span>
                <p className="text-[10px] text-ink-2 mt-1">
                  Central Patient Attachment Registry (CPAR) is active to prevent panel conflicts, verifying
                  explicit clinic-to-patient relationships.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {/* Filters Panel */}
          <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Sliders className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-ink">
                Search & Filter Clinics Accepting New Patients
              </h3>
              <DataTimestamp compact variant="light" metadata={metadata} arrayKey="ACCEPTING_PROVIDERS" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search text */}
              <div className="relative">
                <Search className="w-4 h-4 text-ink-3 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search doctor, clinic or city..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-paper border border-line text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Zone Filter */}
              <div>
                <select
                  value={selectedZoneFilter}
                  onChange={(e) => setSelectedZoneFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-paper border border-line text-xs text-ink focus:outline-none focus:border-accent"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>
              </div>

              {/* Provider Type */}
              <div>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-paper border border-line text-xs text-ink focus:outline-none focus:border-accent"
                >
                  <option value="All">All Provider Types</option>
                  <option value="Family Doctor">Family Doctors (MD)</option>
                  <option value="Nurse Practitioner">Nurse Practitioners (NP)</option>
                </select>
              </div>

              {/* Quick Feature Checkboxes */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-start md:justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterWalkIn}
                    onChange={(e) => setFilterWalkIn(e.target.checked)}
                    className="rounded border-line bg-paper accent-accent focus:outline-none cursor-pointer"
                  />
                  <span className="text-[10px] text-ink-2 font-medium select-none">Dedicated Walk-In</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterAfterHours}
                    onChange={(e) => setFilterAfterHours(e.target.checked)}
                    className="rounded border-line bg-paper accent-accent focus:outline-none cursor-pointer"
                  />
                  <span className="text-[10px] text-ink-2 font-medium select-none">After Hours</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterVirtual}
                    onChange={(e) => setFilterVirtual(e.target.checked)}
                    className="rounded border-line bg-paper accent-accent focus:outline-none cursor-pointer"
                  />
                  <span className="text-[10px] text-ink-2 font-medium select-none">Virtual Appts</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-ink-2 pt-2 border-t border-line">
              <span>
                Showing <strong className="text-ink">{filteredProviders.length}</strong> providers accepting new patients matching
                criteria.
              </span>
              <button
                onClick={() => {
                  setDirectorySearch('');
                  setSelectedZoneFilter('All');
                  setSelectedTypeFilter('All');
                  setFilterWalkIn(false);
                  setFilterAfterHours(false);
                  setFilterVirtual(false);
                  setHasClickedBrowseAll(false);
                  setCurrentPage(1);
                }}
                className="text-accent hover:text-accent-strong font-semibold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Directory Listings Grid */}
          {domainData.ACCEPTING_PROVIDERS.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-warn mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-semibold text-ink">No Provider Listings Available</h4>
                <p className="text-xs text-ink-2">
                  The accepting-provider directory feed is empty. No fabricated listings are shown.
                </p>
              </div>
            </div>
          ) : !isFilterActive && !hasClickedBrowseAll ? (
            <div className="bg-surface border border-line rounded-xl p-12 text-center space-y-4">
              <Search className="w-12 h-12 text-accent mx-auto animate-pulse" />
              <div className="max-w-md mx-auto space-y-2">
                <h4 className="text-base font-semibold text-ink">Search-First Provider Directory</h4>
                <p className="text-xs text-ink-2">
                  Enter a clinic name, physician name, city, or PCN, or use the filters above to locate accepting
                  family physicians and clinics.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => setHasClickedBrowseAll(true)}
                    className="px-4 py-2 rounded-lg bg-accent text-white font-semibold text-xs transition-colors hover:bg-accent-strong cursor-pointer"
                  >
                    Browse All Providers
                  </button>
                </div>
              </div>
            </div>
          ) : filteredProviders.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedProviders.map((prov) => {
                  return (
                    <div
                      key={prov.id}
                      className="bg-surface border border-line rounded-xl p-5 flex flex-col justify-between hover:border-line-2 transition-colors relative group"
                    >
                      <div className="absolute top-4 right-4 bg-ok-soft text-ok border border-line text-[9px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse" />
                        Accepting Patients
                      </div>

                      <div>
                        {/* Title */}
                        <div className="mb-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-neutral-chip text-ink-2 border border-line">
                            {prov.type}
                          </span>
                          <h4 className="text-base font-semibold text-ink mt-1.5 group-hover:text-accent transition-colors">
                            {prov.name}
                          </h4>
                          <p className="text-xs text-ink-2 font-medium">{prov.clinicName}</p>
                        </div>

                        {/* Address / Zone details */}
                        <div className="space-y-1.5 py-3 border-y border-line text-xs">
                          <div className="flex items-start gap-2 text-ink">
                            <MapPin className="w-3.5 h-3.5 text-ink-3 mt-0.5 shrink-0" />
                            <div>
                              <p>{prov.address}</p>
                              <p className="text-[10px] text-ink-2">
                                {prov.city}, AB, {prov.postalCode}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-ink">
                            <Phone className="w-3.5 h-3.5 text-ink-3 shrink-0" />
                            <span>{prov.phone}</span>
                          </div>
                          {prov.pcnName && (
                            <div className="flex items-center gap-2 text-ink">
                              <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                              <span>
                                PCN: <strong className="text-ink-2 font-medium">{prov.pcnName}</strong>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Badges / Languages / Actions */}
                      <div className="mt-4 pt-3 space-y-3">
                        {/* Features */}
                        <div className="flex flex-wrap gap-1.5">
                          {prov.features.walkIn && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-warn-soft text-warn border border-line">
                              Walk-In
                            </span>
                          )}
                          {prov.features.afterHours && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-warn-soft text-warn border border-line">
                              After Hours
                            </span>
                          )}
                          {prov.features.virtualAppointments && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-accent-soft text-accent border border-line">
                              Virtual
                            </span>
                          )}
                          {prov.features.wheelchairAccess && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-neutral-chip text-ink-2 border border-line">
                              Wheelchair
                            </span>
                          )}
                          {prov.features.onlineBooking && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-accent-soft text-accent border border-line">
                              Online Book
                            </span>
                          )}
                        </div>

                        {/* Languages & Gender */}
                        <div className="flex items-center justify-between text-[10px] text-ink-3">
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-ink-3" />
                            <span>{(prov.languages ?? []).join(', ') || '—'}</span>
                          </div>
                          {prov.gender && (
                            <span>
                              Gender: <strong className="text-ink-2 font-medium">{prov.gender}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-line pt-4 mt-6">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-ink-2 font-medium">
                    Page <strong className="text-ink font-semibold">{currentPage}</strong> of{' '}
                    <strong className="text-ink font-semibold">{totalPages}</strong>
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-xl p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-warn mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-semibold text-ink">No Matching Providers Found</h4>
                <p className="text-xs text-ink-2">
                  Try widening your filter selections or clearing the search box to browse accepting clinics.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
