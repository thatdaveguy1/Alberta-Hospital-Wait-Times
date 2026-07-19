import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Activity,
  Layers,
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  FileText, 
  Stethoscope, 
  DollarSign, 
  Sliders, 
  HelpCircle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  UserCheck,
  Briefcase,
  AlertCircle,
  BarChart2,
  Building,
  RefreshCw,
  X,
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell, 
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie
} from 'recharts';
import {
  type PhysicianSpecialtyZone,
  type NursingSupplyGroup,
  type WorkforceAgeProfile,
  type JobVacancyTrend,
  type AlliedHealthSupply
} from '../workforceData';
import * as workforceDataModule from '../workforceData';
import { DataTimestamp, DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type NursingSupplyDisplay = Omit<NursingSupplyGroup, 'profession'> & { profession: string };

function cihiAlliedHasRates(rows: AlliedHealthSupply[] | undefined): boolean {
  if (!rows || rows.length === 0) return false;
  return rows.some((a) => {
    const rates = a.nationalComparisonRatePer100k;
    if (!rates) return false;
    const ab = rates.alberta;
    const ca = rates.canadaAvg;
    return (
      (typeof ab === 'number' && Number.isFinite(ab) && ab > 0) ||
      (typeof ca === 'number' && Number.isFinite(ca) && ca > 0)
    );
  });
}

type JobVacancyDisplay = Omit<JobVacancyTrend, 'sector'> & { sector: string };

type WorkforceData = {
  PHYSICIAN_SPECIALTY_ZONE: PhysicianSpecialtyZone[];
  NURSING_SUPPLY_TRENDS: NursingSupplyGroup[];
  NURSING_SUPPLY_TRENDS_CIHI?: NursingSupplyDisplay[];
  WORKFORCE_AGE_PROFILE: WorkforceAgeProfile[];
  WORKFORCE_AGE_PROFILE_CIHI?: WorkforceAgeProfile[];
  JOB_VACANCY_TRENDS: JobVacancyTrend[];
  JOB_VACANCY_TRENDS_CIHI?: JobVacancyDisplay[];
  ALLIED_HEALTH_SUPPLY: AlliedHealthSupply[];
  ALLIED_HEALTH_SUPPLY_CIHI?: AlliedHealthSupply[];
  _dataMetadata?: DataMetadataMap;
};

export default function WorkforceDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'physicians' | 'nursing' | 'allied' | 'retirement' | 'vacancies'>('physicians');
  // Interactive trend panel selector for overview cards backed by historical arrays
  const [selectedTrend, setSelectedTrend] = useState<'nursingSupply' | 'jobVacancies' | null>(null);
  
  // Interactive Filters
  const [selectedZone, setSelectedZone] = useState<string>('Alberta');
  const [searchProfession, setSearchProfession] = useState<string>('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('All');
  const { data, metadata, isLoading, error, refresh } = useDomainData<WorkforceData>('workforce', workforceDataModule);
  // Prefer measured CIHI arrays only. Never fall back to hand-authored *Data.ts seeds.
  const useCihiNursing = (data?.NURSING_SUPPLY_TRENDS_CIHI?.length ?? 0) > 0;
  const useCihiAgeProfile = (data?.WORKFORCE_AGE_PROFILE_CIHI?.length ?? 0) > 0;
  const useCihiJobVacancy = (data?.JOB_VACANCY_TRENDS_CIHI?.length ?? 0) > 0;
  const useCihiAllied = cihiAlliedHasRates(data?.ALLIED_HEALTH_SUPPLY_CIHI);

  const NURSING_SUPPLY_TRENDS: NursingSupplyDisplay[] = useCihiNursing
    ? (data!.NURSING_SUPPLY_TRENDS_CIHI as NursingSupplyDisplay[])
    : [];
  const WORKFORCE_AGE_PROFILE: WorkforceAgeProfile[] = useCihiAgeProfile
    ? (data!.WORKFORCE_AGE_PROFILE_CIHI as WorkforceAgeProfile[])
    : [];
  const JOB_VACANCY_TRENDS: JobVacancyDisplay[] = useCihiJobVacancy
    ? (data!.JOB_VACANCY_TRENDS_CIHI as JobVacancyDisplay[])
    : (data?.JOB_VACANCY_TRENDS ?? []);

  const nursingSupplyMetadataKey = useCihiNursing ? 'NURSING_SUPPLY_TRENDS_CIHI' : 'NURSING_SUPPLY_TRENDS';
  const ageProfileMetadataKey = useCihiAgeProfile ? 'WORKFORCE_AGE_PROFILE_CIHI' : 'WORKFORCE_AGE_PROFILE';
  const jobVacancyMetadataKey = useCihiJobVacancy ? 'JOB_VACANCY_TRENDS_CIHI' : 'JOB_VACANCY_TRENDS';
  const alliedSupplyMetadataKey = useCihiAllied ? 'ALLIED_HEALTH_SUPPLY_CIHI' : 'ALLIED_HEALTH_SUPPLY';

  const latestNursingYear = useMemo(() => {
    const years = NURSING_SUPPLY_TRENDS.map(n => n.year);
    if (years.length === 0) return '';
    return years.reduce((max, y) => (y > max ? y : max), years[0]);
  }, [NURSING_SUPPLY_TRENDS]);

  const PHYSICIAN_SPECIALTY_ZONE = data?.PHYSICIAN_SPECIALTY_ZONE ?? [];
  const ALLIED_HEALTH_SUPPLY: AlliedHealthSupply[] = useCihiAllied
    ? (data!.ALLIED_HEALTH_SUPPLY_CIHI as AlliedHealthSupply[])
    : [];

  // Physician calculations — prefer selected zone, else Alberta rollup, else first row.
  const physicianZoneData = useMemo(() => {
    if (PHYSICIAN_SPECIALTY_ZONE.length === 0) return null;
    return (
      PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === selectedZone) ||
      PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === 'Alberta') ||
      PHYSICIAN_SPECIALTY_ZONE[0]
    );
  }, [selectedZone, PHYSICIAN_SPECIALTY_ZONE]);

  // Only emit specialty slices with measured (>0) counts — headline-only rows have zeros.
  const zonePieData = useMemo(() => {
    if (!physicianZoneData) return [];
    const d = physicianZoneData;
    return [
      { name: 'Family Medicine', value: d.familyMedicine, color: 'oklch(0.78 0.12 155)' },
      { name: 'Medical Specialties', value: d.medicalSpecialties, color: 'oklch(0.68 0.13 252)' },
      { name: 'Surgical Specialties', value: d.surgicalSpecialties, color: 'oklch(0.7 0.15 350)' },
      { name: 'Laboratory', value: d.laboratorySpecialties, color: 'oklch(0.6 0.12 270)' },
      { name: 'Psychiatry', value: d.psychiatry, color: 'oklch(0.82 0.12 85)' }
    ].filter(s => typeof s.value === 'number' && s.value > 0);
  }, [physicianZoneData]);

  const hasSpecialtyBreakdown = zonePieData.length > 0;

  // Nursing filtered trends (latest year in series)
  const selectedNursingProfession = useMemo(() => {
    if (!latestNursingYear) return [];
    return NURSING_SUPPLY_TRENDS.filter(n => n.year === latestNursingYear);
  }, [NURSING_SUPPLY_TRENDS, latestNursingYear]);

  // Retirement risk profiles
  const filteredRetirementProfiles = useMemo(() => {
    return WORKFORCE_AGE_PROFILE.filter(profile => {
      const matchesSearch = profile.professionGroup.toLowerCase().includes(searchProfession.toLowerCase());
      const matchesRisk = selectedRiskLevel === 'All' || profile.retirementRiskLevel === selectedRiskLevel;
      return matchesSearch && matchesRisk;
    });
  }, [searchProfession, selectedRiskLevel, WORKFORCE_AGE_PROFILE]);

  // CIHI vacancy rows use provider-type sector labels; StatsCan uses sector names.
  const healthJobVacancySeries = useMemo(
    () =>
      useCihiJobVacancy
        ? JOB_VACANCY_TRENDS
        : JOB_VACANCY_TRENDS.filter(t => /health/i.test(t.sector)),
    [JOB_VACANCY_TRENDS, useCihiJobVacancy]
  );

  // Aggregate stats — null/empty when source values are missing (never fabricate zeros as claims).
  const aggregateStats = useMemo(() => {
    const abRow = PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === 'Alberta');
    const totalPhysicians = abRow?.totalActive ?? null;
    const rnYear = latestNursingYear || NURSING_SUPPLY_TRENDS.map(n => n.year).sort().at(-1) || '';
    const totalRNs = NURSING_SUPPLY_TRENDS.find(
      n => n.profession === 'Registered Nurse (RN)' && n.year === rnYear
    )?.activePermits ?? null;
    const vacancySeries = healthJobVacancySeries;
    const activeVacancies =
      vacancySeries.length > 0 ? vacancySeries[vacancySeries.length - 1]?.vacanciesCount ?? null : null;
    const nursingLatestYear = NURSING_SUPPLY_TRENDS.filter(n => n.year === rnYear);
    const vacancyRates = nursingLatestYear
      .map(n => n.vacancyRatePct)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const avgNursingVacancy =
      vacancyRates.length > 0
        ? Math.round((vacancyRates.reduce((s, n) => s + n, 0) / vacancyRates.length) * 10) / 10
        : null;

    return {
      totalPhysicians,
      totalRNs,
      activeVacancies,
      avgNursingVacancy
    };
  }, [PHYSICIAN_SPECIALTY_ZONE, NURSING_SUPPLY_TRENDS, healthJobVacancySeries, latestNursingYear]);
  // Max allied health rate for bar normalization
  const alliedMaxRate = useMemo(() => {
    const allRates = ALLIED_HEALTH_SUPPLY.flatMap(a => {
      const rates = a.nationalComparisonRatePer100k;
      return [rates?.alberta, rates?.canadaAvg].filter(
        (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
      );
    });
    const max = allRates.length > 0 ? Math.max(...allRates) : 0;
    return max > 0 ? max : 1;
  }, [ALLIED_HEALTH_SUPPLY]);
  // Alberta provincial physician density benchmark (data-derived)
  const albertaRatePer100k = useMemo(
    () => PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === 'Alberta')?.ratePer100k ?? 0,
    [PHYSICIAN_SPECIALTY_ZONE]
  );

  // Physician retirement-cliff ratio: share of physicians aged 55+ averaged across physician groups
  const physicianRetirementRatio = useMemo(() => {
    const physicianProfiles = WORKFORCE_AGE_PROFILE.filter(
      p => /physician|specialist/i.test(p.professionGroup)
    );
    if (physicianProfiles.length === 0) return 0;
    return physicianProfiles.reduce((sum, p) => sum + p.age55to64Pct + p.over65Pct, 0) / physicianProfiles.length;
  }, [WORKFORCE_AGE_PROFILE]);

  // Nursing supply chart pivoted by year into RN/LPN/HCA (+ NP when present)
  const nursingChartData = useMemo(() => {
    const allYears = NURSING_SUPPLY_TRENDS.map(n => n.year);
    const years = allYears.filter((y, i) => allYears.indexOf(y) === i).sort();
    const findPermits = (year: string, profession: string) =>
      NURSING_SUPPLY_TRENDS.find(n => n.year === year && n.profession === profession)?.activePermits ?? 0;
    const hasNp = NURSING_SUPPLY_TRENDS.some(
      n => n.profession === 'Nurse Practitioner (NP)' && n.activePermits > 0
    );
    return years.map(year => {
      const row: Record<string, string | number> = {
        year,
        RN: findPermits(year, 'Registered Nurse (RN)'),
        LPN: findPermits(year, 'Licensed Practical Nurse (LPN)'),
        HCA: findPermits(year, 'Health Care Aide (HCA)'),
      };
      if (hasNp) {
        row.NP = findPermits(year, 'Nurse Practitioner (NP)');
      }
      return row;
    });
  }, [NURSING_SUPPLY_TRENDS]);

  const nursingChartHasNp = useMemo(
    () => nursingChartData.some(row => typeof row.NP === 'number' && row.NP > 0),
    [nursingChartData]
  );

  // RN registered growth rate (latest year) for overview card
  // RN registered growth rate (latest year) for overview card — null when missing
  const rnGrowthPct = useMemo(() => {
    const rnYear = latestNursingYear || NURSING_SUPPLY_TRENDS.map(n => n.year).sort().at(-1) || '';
    const v = NURSING_SUPPLY_TRENDS.find(
      n => n.profession === 'Registered Nurse (RN)' && n.year === rnYear
    )?.growthRatePct;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  }, [NURSING_SUPPLY_TRENDS, latestNursingYear]);

  // Vacancy count change vs 2024 peak for overview card
  const vacancyChangePct = useMemo(() => {
    const trends = healthJobVacancySeries;
    if (trends.length === 0) return 0;
    const latest = trends[trends.length - 1].vacanciesCount;
    const peak2024 = Math.max(0, ...trends.filter(t => t.quarter.startsWith('2024')).map(t => t.vacanciesCount));
    if (peak2024 === 0) return 0;
    return ((latest - peak2024) / peak2024) * 100;
  }, [healthJobVacancySeries]);

  // Trend panel metadata for the selected overview card
  const selectedTrendDetails = useMemo(() => {
    if (!selectedTrend) return null;
    switch (selectedTrend) {
      case 'nursingSupply':
        return {
          label: 'Nursing & Health Care Aide Supply',
          description: 'Active permit counts by nursing profession from CIHI & CRNA/CLPAUA registers. Rising permit counts alongside persistent vacancy rates indicate supply growth is being outpaced by demand.',
          colorClass: 'text-accent',
          strokeColor: 'oklch(0.68 0.13 252)',
          gradientId: 'colorNursingSupplyTrend',
          icon: Activity
        };
      case 'jobVacancies':
        return {
          label: 'Health Care Job Vacancies',
          description: useCihiJobVacancy
            ? 'CIHI health workforce vacancy counts by provider type (annual, Alberta). Declining counts from 2024 peaks signal modest labour-market easing.'
            : 'StatsCan JVWS quarterly open vacancy counts and offered hourly wages in the Health Care & Social Assistance sector. Declining counts from 2024 peaks signal modest labour-market easing.',
          colorClass: 'text-warn',
          strokeColor: 'oklch(0.82 0.12 85)',
          gradientId: 'colorJobVacancyTrend',
          icon: Briefcase
        };
      default:
        return null;
    }
  }, [selectedTrend, useCihiJobVacancy]);

  // Job vacancy chart series — omit zero-filled wages; only include wage when present.
  const vacancyChartData = useMemo(() => {
    return healthJobVacancySeries.map(t => ({
      quarter: t.quarter,
      vacanciesCount: t.vacanciesCount,
      vacancyRatePct: t.vacancyRatePct,
      avgOfferedHourlyWage:
        typeof t.avgOfferedHourlyWage === 'number' && t.avgOfferedHourlyWage > 0
          ? t.avgOfferedHourlyWage
          : null,
    }));
  }, [healthJobVacancySeries]);

  const vacancyChartHasWage = useMemo(
    () => vacancyChartData.some(t => typeof t.avgOfferedHourlyWage === 'number' && t.avgOfferedHourlyWage > 0),
    [vacancyChartData]
  );

  // Trend panel summary statistics for the selected series
  const selectedTrendStats = useMemo(() => {
    if (!selectedTrend) return null;
    if (selectedTrend === 'nursingSupply') {
      const rnSeries = NURSING_SUPPLY_TRENDS.filter(n => n.profession === 'Registered Nurse (RN)').sort((a, b) => a.year.localeCompare(b.year));
      if (rnSeries.length === 0) return null;
      const baseline = rnSeries[0].activePermits;
      const latest = rnSeries[rnSeries.length - 1].activePermits;
      const peak = Math.max(...rnSeries.map(n => n.activePermits));
      const rawDelta = latest - baseline;
      const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;
      return {
        baseline: baseline.toLocaleString(),
        latest: latest.toLocaleString(),
        peak: peak.toLocaleString(),
        delta: rawDelta > 0 ? `+${rawDelta.toLocaleString()}` : rawDelta.toLocaleString(),
        pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
        isIncrease: rawDelta > 0,
        unit: ''
      };
    }
    // jobVacancies
    const series = vacancyChartData;
    if (series.length === 0) return null;
    const baseline = series[0].vacanciesCount;
    const latest = series[series.length - 1].vacanciesCount;
    const peak = Math.max(...series.map(s => s.vacanciesCount));
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;
    return {
      baseline: baseline.toLocaleString(),
      latest: latest.toLocaleString(),
      peak: peak.toLocaleString(),
      delta: rawDelta > 0 ? `+${rawDelta.toLocaleString()}` : rawDelta.toLocaleString(),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0,
      unit: ''
    };
  }, [selectedTrend, vacancyChartData]);

  if (isLoading) return <div className="flex items-center justify-center h-full min-h-[400px] text-ink-2 text-sm">Loading...</div>;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ink-2 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-warn" />
        <span>Failed to load workforce data: {error}</span>
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-bold text-ink hover:border-line-2 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <DashboardHeader
        icon={Users}
        title="Health Workforce & Staffing"
        description="Monitor physician register counts, nurse supply trends, and job vacancies."
        metadata={metadata}
        arrayKey="PHYSICIAN_SPECIALTY_ZONE"
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

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-line flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('physicians')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'physicians'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Physicians Register</span>
        </button>
        <button
          onClick={() => setActiveSubTab('nursing')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'nursing'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Nursing Supply</span>
        </button>
        <button
          onClick={() => setActiveSubTab('allied')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'allied'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Allied Health</span>
        </button>
        <button
          onClick={() => setActiveSubTab('retirement')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'retirement'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Retirement Risk</span>
        </button>
        <button
          onClick={() => setActiveSubTab('vacancies')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'vacancies'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Job Vacancies</span>
        </button>
      </div>

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-line p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-ink-2 font-semibold">Active Registered Physicians</span>
            <div className="text-lg sm:text-2xl font-semibold text-ink">
              {aggregateStats.totalPhysicians != null
                ? aggregateStats.totalPhysicians.toLocaleString()
                : '—'}
            </div>
            <span className="text-[9px] text-ink-3 font-bold flex items-center gap-1 mt-1.5">
              CPSA full register snapshot
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-ok-soft text-ok hidden sm:block">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedTrend(selectedTrend === 'nursingSupply' ? null : 'nursingSupply')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedTrend(selectedTrend === 'nursingSupply' ? null : 'nursingSupply');
            }
          }}
          className={`bg-surface border p-4 rounded-xl flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] ${
            selectedTrend === 'nursingSupply'
              ? 'border-accent'
              : 'border-line hover:border-accent/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-ink-2 font-semibold">Active RN Permits</span>
            <div className="text-lg sm:text-2xl font-semibold text-ink">
              {aggregateStats.totalRNs != null ? aggregateStats.totalRNs.toLocaleString() : '—'}
            </div>
            <p className="text-[10px] text-ok font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {typeof rnGrowthPct === 'number' && Number.isFinite(rnGrowthPct)
                ? `${rnGrowthPct > 0 ? '+' : ''}${rnGrowthPct.toFixed(1)}% Registered Growth`
                : 'Growth unavailable'}
            </p>
            <span className="text-[9px] text-ink-3 group-hover:text-accent font-bold flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedTrend === 'nursingSupply' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-accent-soft text-accent hidden sm:block group-hover:scale-110 transition-transform duration-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedTrend(selectedTrend === 'jobVacancies' ? null : 'jobVacancies')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedTrend(selectedTrend === 'jobVacancies' ? null : 'jobVacancies');
            }
          }}
          className={`bg-surface border p-4 rounded-xl flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] ${
            selectedTrend === 'jobVacancies'
              ? 'border-warn'
              : 'border-line hover:border-warn/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-ink-2 font-semibold">Health Care Vacancies</span>
            <div className="text-lg sm:text-2xl font-semibold text-ink">
              {aggregateStats.activeVacancies != null
                ? aggregateStats.activeVacancies.toLocaleString()
                : '—'}
            </div>
            <p className="text-[10px] text-warn font-bold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              {healthJobVacancySeries.length > 0
                ? `${vacancyChangePct.toFixed(1)}% vs 2024 Peaks`
                : 'Vacancy series unavailable'}
            </p>
            <span className="text-[9px] text-ink-3 group-hover:text-warn font-bold flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedTrend === 'jobVacancies' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-warn-soft text-warn hidden sm:block group-hover:scale-110 transition-transform duration-300">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface border border-line p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-lg sm:text-2xl font-semibold text-ink">
              {WORKFORCE_AGE_PROFILE.length > 0
                ? `${physicianRetirementRatio.toFixed(1)}%`
                : '—'}
            </div>
            <p className="text-[10px] text-crit font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-crit" />
              {WORKFORCE_AGE_PROFILE.length > 0 ? 'Physicians Over Age 55' : 'Age profile unavailable'}
            </p>
            <span className="text-[9px] text-ink-3 font-bold flex items-center gap-1 mt-1.5">
              Snapshot only — no time series
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-crit-soft text-crit hidden sm:block">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Overview KPI Trend Explorer Panel */}
      <AnimatePresence mode="wait">
        {selectedTrend && selectedTrendDetails && selectedTrendStats && (
          <motion.div
            key={`overview-trend-${selectedTrend}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-xl bg-surface border border-line space-y-6 relative">
              {/* Close Button */}
              <button
                onClick={() => setSelectedTrend(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-paper border border-line hover:border-line-2 text-ink-2 hover:text-ink transition-colors cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title and description */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-ink">
                    {React.createElement(selectedTrendDetails.icon, {
                      className: `w-4 h-4 ${selectedTrendDetails.colorClass}`
                    })}
                    <span>{selectedTrendDetails.label} Historical Trend Explorer</span>
                  </h3>
                  <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                    {selectedTrendDetails.description}
                  </p>
                </div>
              </div>

              {/* Stats highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-paper border border-line">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-ink-3 block">Baseline</span>
                  <span className="text-xl font-semibold text-ink font-mono">{selectedTrendStats.baseline}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-ink-3 block">Latest</span>
                  <span className="text-xl font-semibold text-ink font-mono">{selectedTrendStats.latest}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-ink-3 block">Series Peak</span>
                  <span className={`text-xl font-semibold font-mono ${selectedTrendDetails.colorClass}`}>{selectedTrendStats.peak}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-ink-3 block">Overall Shift</span>
                  <span className={`text-xl font-semibold font-mono flex items-center justify-center sm:justify-start gap-1 ${
                    selectedTrendStats.isIncrease ? 'text-warn' : 'text-ok'
                  }`}>
                    {selectedTrendStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                    <span>{selectedTrendStats.delta} ({selectedTrendStats.pctChange})</span>
                  </span>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {selectedTrend === 'nursingSupply' ? (
                    <AreaChart data={nursingChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorNursingRNTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingLPNTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingHCATrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingNPTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.6 0.12 270)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="oklch(0.6 0.12 270)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                      <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis stroke="oklch(0.62 0.02 255)" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'oklch(0.16 0.02 255)', borderColor: 'oklch(0.28 0.02 255)', borderRadius: 8 }}
                        labelStyle={{ fontWeight: 600, color: 'oklch(0.96 0.008 255)', fontSize: 11 }}
                        itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <Area type="monotone" dataKey="RN" name="Registered Nurses" stroke="oklch(0.68 0.13 252)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingRNTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      <Area type="monotone" dataKey="LPN" name="Licensed Practical Nurses" stroke="oklch(0.78 0.12 155)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingLPNTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      <Area type="monotone" dataKey="HCA" name="Health Care Aides" stroke="oklch(0.82 0.12 85)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingHCATrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      {nursingChartHasNp && (
                        <Area type="monotone" dataKey="NP" name="Nurse Practitioners" stroke="oklch(0.6 0.12 270)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingNPTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      )}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </AreaChart>
                  ) : (
                    <AreaChart data={vacancyChartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id={selectedTrendDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={selectedTrendDetails.strokeColor} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={selectedTrendDetails.strokeColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                      <XAxis dataKey="quarter" stroke="oklch(0.62 0.02 255)" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis yAxisId="left" stroke="oklch(0.62 0.02 255)" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      {vacancyChartHasWage && (
                        <YAxis yAxisId="right" orientation="right" stroke="oklch(0.62 0.02 255)" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      )}
                      <Tooltip
                        contentStyle={{ backgroundColor: 'oklch(0.16 0.02 255)', borderColor: 'oklch(0.28 0.02 255)', borderRadius: 8 }}
                        labelStyle={{ fontWeight: 600, color: 'oklch(0.96 0.008 255)', fontSize: 11 }}
                        itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="vacanciesCount" name="Open Vacancies" stroke={selectedTrendDetails.strokeColor} strokeWidth={2.5} fillOpacity={1} fill={`url(#${selectedTrendDetails.gradientId})`} dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      {vacancyChartHasWage && (
                        <Area yAxisId="right" type="monotone" dataKey="avgOfferedHourlyWage" name="Avg Offered Wage ($/Hr)" stroke="oklch(0.78 0.12 155)" strokeWidth={2.5} fillOpacity={0} dot={{ r: 3, strokeWidth: 1 }} isAnimationActive={false} />
                      )}
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUBTAB 1: Physician register (measured CPSA headline / zone rows only) */}
      {activeSubTab === 'physicians' && (
        <div className="space-y-6">
          {PHYSICIAN_SPECIALTY_ZONE.length === 0 ? (
            <div className="bg-surface border border-line p-6 rounded-xl text-sm text-ink-2">
              No measured CPSA physician register data is available. Specialty and zone breakdowns are not shown when upstream scrape yields no headline total.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Zone Specialty Breakdown Selector */}
            <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink-2">Geographic Profile Selector</h3>
                  <p className="text-[10px] text-ink-3">
                    {hasSpecialtyBreakdown
                      ? 'Analyze specialties inside local health authorities'
                      : 'Alberta headline register only (zone/specialty breakdown not measured)'}
                  </p>
                <DataTimestamp compact variant="light" metadata={metadata} arrayKey="PHYSICIAN_SPECIALTY_ZONE" />
                </div>
                <Building className="w-4 h-4 text-accent" />
              </div>

              <div className="grid grid-cols-1 gap-1">
                {PHYSICIAN_SPECIALTY_ZONE.map(zone => (
                  <button
                    key={zone.zone}
                    onClick={() => setSelectedZone(zone.zone)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all text-left ${
                      selectedZone === zone.zone
                        ? 'bg-accent text-ink font-bold'
                        : 'bg-paper text-ink-2 hover:text-ink border border-line'
                    }`}
                  >
                    <span>{zone.zone}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        selectedZone === zone.zone ? 'bg-accent-strong text-ink' : 'bg-surface text-ink-2'
                      }`}>
                        {zone.totalActive} MDs
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* MD per 100k card — only when measured rate present */}
              <div className="bg-paper p-4 border border-line rounded-xl space-y-2">
                <span className="text-[9px] text-ink-3 font-semibold">Zone Physician Density</span>
                {physicianZoneData && physicianZoneData.ratePer100k > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between">
                      <div className="text-2xl font-semibold text-ink">{physicianZoneData.ratePer100k}</div>
                      <span className="text-xs text-ink-2">MDs per 100k Pop</span>
                    </div>
                    <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-ok h-full rounded-full transition-all duration-500"
                        style={{ width: `${albertaRatePer100k > 0 ? Math.min(100, (physicianZoneData.ratePer100k / albertaRatePer100k) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-ink-2">
                      {physicianZoneData.zone === 'Alberta'
                        ? 'Provincial average healthcare density benchmark.'
                        : 'Zone density relative to Alberta rollup when measured.'}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-ink-3">Density not available — zone populations or counts are not measured for this row.</p>
                )}
              </div>
            </div>

            {/* Specialty Share Pie/Bar Visualizer */}
            <div className="bg-surface border border-line p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink-2">Specialty Distribution Profile</h3>
                  <p className="text-[10px] text-ink-3">
                    {hasSpecialtyBreakdown
                      ? <>Composition of active clinical workforce in <strong>{selectedZone}</strong></>
                      : 'Specialty mix not published as scrapable CPSA HTML — headline total only'}
                  </p>
                </div>
                <span className="text-[9px] bg-neutral-chip text-ink-2 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: CPSA Quarterly Statistics
                </span>
              </div>

              {!hasSpecialtyBreakdown || !physicianZoneData ? (
                <div className="p-6 rounded-xl bg-paper border border-line text-sm text-ink-2 space-y-2">
                  <p>
                    Fully registered physicians (Alberta):{' '}
                    <strong className="text-ink">
                      {(physicianZoneData?.totalActive ?? aggregateStats.totalPhysicians)?.toLocaleString() ?? '—'}
                    </strong>
                  </p>
                  <p className="text-[11px] text-ink-3">
                    Zone and specialty breakdowns are omitted because CPSA Power BI embeds are not parseable as measured HTML, and proportional synthesis is disabled.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                <div className="space-y-2">
                  {zonePieData.map(slice => {
                    const denom = physicianZoneData.totalActive;
                    const pct = denom > 0 ? ((slice.value / denom) * 100).toFixed(1) : '—';
                    return (
                      <div key={slice.name} className="p-2.5 bg-paper rounded-lg border border-line flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-xs text-ink-2 font-medium truncate max-w-[110px]">{slice.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-ink block">{slice.value}</span>
                          <span className="text-[9px] text-ink-3 block">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="sm:col-span-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={zonePieData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" horizontal={false} />
                      <XAxis type="number" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="oklch(0.62 0.02 255)" fontSize={9} width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', borderColor: 'oklch(0.28 0.02 255)' }}
                        labelClassName="text-ink font-bold text-xs"
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                        {zonePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: Nursing & Allied Staffing Supply Trends */}
      {activeSubTab === 'nursing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Nursing growth trends chart */}
            <div className="bg-surface border border-line p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-ink-2">Permit Growth & Demand Tracker</h3>
                  <p className="text-[10px] text-ink-3">
                    Active licensed practice permit expansion
                    {latestNursingYear ? ` (through ${latestNursingYear})` : ''}
                  </p>
                <DataTimestamp compact variant="light" metadata={metadata} arrayKey={nursingSupplyMetadataKey} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-neutral-chip text-ink-2 px-2 py-0.5 rounded-full font-bold uppercase">
                    {useCihiNursing ? 'Source: CIHI Health Workforce Quick Stats' : 'No measured CIHI nursing rows'}
                  </span>
                </div>
              </div>

              {/* Chart */}
              {nursingChartData.length === 0 ? (
                <p className="text-sm text-ink-3">Nursing permit series unavailable until CIHI workforce arrays are successfully refreshed.</p>
              ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nursingChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                    <YAxis stroke="oklch(0.62 0.02 255)" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', borderColor: 'oklch(0.28 0.02 255)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="RN" name="Registered Nurses (RN)" fill="oklch(0.68 0.13 252)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="LPN" name="Licensed Practical Nurses (LPN)" fill="oklch(0.78 0.12 155)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="HCA" name="Health Care Aides (HCA)" fill="oklch(0.7 0.15 350)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    {nursingChartHasNp && (
                    <Bar dataKey="NP" name="Nurse Practitioners (NP)" fill="oklch(0.6 0.12 270)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </div>

            {/* Quick Metrics Cards */}
            <div className="bg-surface border border-line p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-ink-2">Nursing Capacity Diagnostics</h3>
                <p className="text-[10px] text-ink-3">
                  {latestNursingYear ? `${latestNursingYear} ` : ''}Active Registry benchmarks and allocation profiles
                </p>
              </div>

              <div className="space-y-3">
                {selectedNursingProfession.length === 0 ? (
                  <p className="text-[11px] text-ink-3">No CIHI nursing supply rows available for the latest year.</p>
                ) : selectedNursingProfession.map(prof => (
                  <div key={prof.profession} className="p-3 bg-paper rounded-xl border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">{prof.profession}</span>
                      <span className="text-xs font-mono font-bold text-accent">{prof.activePermits.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-paper p-1.5 rounded">
                        <span className="text-ink-3 block text-[8px]">VACANCY RATE</span>
                        <span className="font-bold text-crit">
                          {typeof prof.vacancyRatePct === 'number' ? `${prof.vacancyRatePct}%` : '—'}
                        </span>
                      </div>
                      <div className="bg-paper p-1.5 rounded">
                        <span className="text-ink-3 block text-[8px]">DIRECT CARE</span>
                        <span className="font-bold text-ok">
                          {typeof prof.directCarePct === 'number' ? `${prof.directCarePct}%` : '—'}
                        </span>
                      </div>
                      <div className="bg-paper p-1.5 rounded">
                        <span className="text-ink-3 block text-[8px]">RURAL FOCUS</span>
                        <span className="font-bold text-accent">
                          {typeof prof.ruralRemotePct === 'number' ? `${prof.ruralRemotePct}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Allied Health Supply — CIHI measured only */}
      {activeSubTab === 'allied' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-ink-2">Allied Health Professional Benchmarking</h3>
                <p className="text-[10px] text-ink-3">Active staffing densities per 100,000 population: Alberta vs National Canadian Average</p>
                <DataTimestamp compact variant="light" metadata={metadata} arrayKey={alliedSupplyMetadataKey} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-neutral-chip text-ink-2 px-2 py-0.5 rounded-full font-bold uppercase">
                  {useCihiAllied ? 'Source: CIHI Health Workforce Quick Stats' : 'No measured CIHI allied rows'}
                </span>
              </div>
            </div>

            {ALLIED_HEALTH_SUPPLY.length === 0 ? (
              <p className="text-sm text-ink-3">Allied health supply is unavailable until CIHI workforce arrays are successfully refreshed.</p>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALLIED_HEALTH_SUPPLY.map(allied => {
                const abRate = allied.nationalComparisonRatePer100k?.alberta;
                const caRate = allied.nationalComparisonRatePer100k?.canadaAvg;
                const hasRates =
                  typeof abRate === 'number' && Number.isFinite(abRate) &&
                  typeof caRate === 'number' && Number.isFinite(caRate);
                const diff = hasRates ? abRate - caRate : null;
                const matchesAvg = diff != null ? diff >= 0 : false;
                const vacancy =
                  typeof allied.vacancyActivePostings === 'number' && Number.isFinite(allied.vacancyActivePostings)
                    ? allied.vacancyActivePostings
                    : null;

                return (
                  <div key={allied.profession} className="bg-paper border border-line p-4 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-ink">{allied.profession}</h4>
                        <span className="text-[10px] font-mono text-ink-2">
                          Total Alberta count: <strong>{allied.albertaCount?.toLocaleString() ?? '—'}</strong>
                        </span>
                      </div>
                      {diff != null ? (
                      <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        matchesAvg ? 'bg-ok/15 text-ok' : 'bg-crit/15 text-crit'
                      }`}>
                        {matchesAvg ? `+${diff.toFixed(1)} vs National` : `${diff.toFixed(1)} vs National`}
                      </span>
                      ) : (
                        <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-neutral-chip text-ink-3">Rate N/A</span>
                      )}
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-ink-3">
                          <span>Alberta Density (per 100k)</span>
                          <span className="font-bold text-ink">{typeof abRate === 'number' ? abRate : '—'}</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-accent h-full rounded-full" style={{ width: `${typeof abRate === 'number' ? (abRate / alliedMaxRate) * 100 : 0}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-ink-3">
                          <span>Canada Benchmark</span>
                          <span className="font-bold text-ink-2">{typeof caRate === 'number' ? caRate : '—'}</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-ink-3 h-full rounded-full" style={{ width: `${typeof caRate === 'number' ? (caRate / alliedMaxRate) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-line text-[10px]">
                      <span className="text-ink-3">CIHI vacancy count</span>
                      <span className="font-bold text-warn flex items-center gap-1">
                        {vacancy != null ? (
                          <>
                            <span className="w-1.5 h-1.5 bg-warn rounded-full"></span>
                            {vacancy} vacancies
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 4: Age & Retirement Risk Profile — CIHI measured only */}
      {activeSubTab === 'retirement' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-semibold text-ink-2">Active Retirement Cliff & Demographics Analyzer</h3>
                <p className="text-[10px] text-ink-3">Evaluating potential staffing supply flight via aging practitioner profiles</p>
                <DataTimestamp compact variant="light" metadata={metadata} arrayKey={ageProfileMetadataKey} />
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-ink-3" />
                  <input
                    type="text"
                    placeholder="Search professions..."
                    value={searchProfession}
                    onChange={(e) => setSearchProfession(e.target.value)}
                    className="bg-paper border border-line rounded-lg pl-8 pr-3 py-1 text-xs text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                  />
                </div>

                <select
                  value={selectedRiskLevel}
                  onChange={(e) => setSelectedRiskLevel(e.target.value)}
                  className="bg-paper border border-line rounded-lg px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  <option value="All">All Risks</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {filteredRetirementProfiles.length === 0 ? (
              <p className="text-sm text-ink-3">
                {WORKFORCE_AGE_PROFILE.length === 0
                  ? 'Workforce age profiles are unavailable until CIHI arrays are successfully refreshed.'
                  : 'No profiles match the current filters.'}
              </p>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRetirementProfiles.map(profile => {
                const over55 = profile.age55to64Pct + profile.over65Pct;

                return (
                  <div key={profile.professionGroup} className="bg-paper border border-line p-4 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-ink">{profile.professionGroup}</h4>
                        <span className="text-[9px] text-ink-3">Age demographic breakdown</span>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          profile.retirementRiskLevel === 'Critical'
                            ? 'bg-crit/15 text-crit border border-line'
                            : profile.retirementRiskLevel === 'High'
                            ? 'bg-warn/15 text-warn border border-warn/20'
                            : 'bg-accent/15 text-accent border border-accent/20'
                        }`}>
                          {profile.retirementRiskLevel} RISK
                        </span>
                        <p className="text-[9px] text-ink-2 mt-1">
                          <strong>{over55.toFixed(1)}%</strong> Over 55
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-ink-3">
                          <span>Under Age 35 (Early-career)</span>
                          <span className="font-bold text-ok">{profile.under35Pct}%</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-ok h-full rounded-full" style={{ width: `${profile.under35Pct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-ink-3">
                          <span>Ages 35 to 54 (Mid-career core)</span>
                          <span className="font-bold text-accent">{profile.age35to54Pct}%</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-accent h-full rounded-full" style={{ width: `${profile.age35to54Pct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-ink-3">
                          <span>Ages 55 to 64 (Imminent Retirement Cliff)</span>
                          <span className="font-bold text-warn">{profile.age55to64Pct}%</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-warn h-full rounded-full" style={{ width: `${profile.age55to64Pct}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-ink-3">
                          <span>Ages 65+ (Active Post-Retirement Practice)</span>
                          <span className="font-bold text-crit">{profile.over65Pct}%</span>
                        </div>
                        <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden">
                          <div className="bg-crit h-full rounded-full" style={{ width: `${profile.over65Pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: Vacancy trends — measured series only; no illustrative claims */}
      {activeSubTab === 'vacancies' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-ink-2">
                  {useCihiJobVacancy ? 'CIHI Health Workforce Vacancy Trends' : 'StatsCan Job Vacancy Trends'}
                </h3>
                <p className="text-[10px] text-ink-3">
                  {useCihiJobVacancy
                    ? 'Annual vacancy counts by health provider type (Alberta)'
                    : vacancyChartHasWage
                      ? 'Unadjusted quarterly vacancy counts and offered hourly wages (Alberta)'
                      : 'Unadjusted quarterly vacancy counts (Alberta) — offered wage not in this StatCan table'}
                </p>
                <DataTimestamp compact variant="light" metadata={metadata} arrayKey={jobVacancyMetadataKey} />
              </div>
              <span className="text-[9px] bg-neutral-chip text-ink-2 px-2 py-0.5 rounded-full font-bold uppercase">
                {useCihiJobVacancy ? 'Source: CIHI Health Workforce Quick Stats' : 'Source: StatCan Table 14-10-0371-01'}
              </span>
            </div>

            {vacancyChartData.length === 0 ? (
              <p className="text-sm text-ink-3">No measured job-vacancy rows are available from CIHI or StatsCan for this domain.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={vacancyChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="quarter" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                    <YAxis yAxisId="left" stroke="oklch(0.68 0.13 252)" fontSize={9} />
                    {vacancyChartHasWage && (
                      <YAxis yAxisId="right" orientation="right" stroke="oklch(0.78 0.12 155)" fontSize={9} />
                    )}
                    <Tooltip contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', borderColor: 'oklch(0.28 0.02 255)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="vacanciesCount" name="Open Vacancies (Count)" stroke="oklch(0.68 0.13 252)" strokeWidth={2.5} activeDot={{ r: 6 }} isAnimationActive={false} />
                    {vacancyChartHasWage && (
                      <Line yAxisId="right" type="monotone" dataKey="avgOfferedHourlyWage" name="Avg Offered Wage ($/Hr)" stroke="oklch(0.78 0.12 155)" strokeWidth={2.5} isAnimationActive={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
