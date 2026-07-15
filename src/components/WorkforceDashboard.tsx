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
  GraduationCap,
  X,
  RefreshCw
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
  type SpecialistRecruitmentNeed,
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
  SPECIALIST_RECRUITMENT_NEEDS: SpecialistRecruitmentNeed[];
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
  const useCihiNursing = (data?.NURSING_SUPPLY_TRENDS_CIHI?.length ?? 0) > 0;
  const useCihiAgeProfile = (data?.WORKFORCE_AGE_PROFILE_CIHI?.length ?? 0) > 0;
  const useCihiJobVacancy = (data?.JOB_VACANCY_TRENDS_CIHI?.length ?? 0) > 0;
  const useCihiAllied = cihiAlliedHasRates(data?.ALLIED_HEALTH_SUPPLY_CIHI);

  const NURSING_SUPPLY_TRENDS: NursingSupplyDisplay[] = useCihiNursing
    ? (data!.NURSING_SUPPLY_TRENDS_CIHI as NursingSupplyDisplay[])
    : (data?.NURSING_SUPPLY_TRENDS ?? []);
  const WORKFORCE_AGE_PROFILE: WorkforceAgeProfile[] = useCihiAgeProfile
    ? (data!.WORKFORCE_AGE_PROFILE_CIHI as WorkforceAgeProfile[])
    : (data?.WORKFORCE_AGE_PROFILE ?? []);
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
  const SPECIALIST_RECRUITMENT_NEEDS = data?.SPECIALIST_RECRUITMENT_NEEDS ?? [];
  const ALLIED_HEALTH_SUPPLY: AlliedHealthSupply[] = useCihiAllied
    ? (data!.ALLIED_HEALTH_SUPPLY_CIHI as AlliedHealthSupply[])
    : (data?.ALLIED_HEALTH_SUPPLY ?? []);

  // Physician calculations
  const physicianZoneData = useMemo(() => {
    return PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === selectedZone) || PHYSICIAN_SPECIALTY_ZONE[5];
  }, [selectedZone, PHYSICIAN_SPECIALTY_ZONE]);

  const zonePieData = useMemo(() => {
    if (!physicianZoneData) return [];
    const d = physicianZoneData;
    return [
      { name: 'Family Medicine', value: d.familyMedicine, color: '#10b981' },
      { name: 'Medical Specialties', value: d.medicalSpecialties, color: '#3b82f6' },
      { name: 'Surgical Specialties', value: d.surgicalSpecialties, color: '#ec4899' },
      { name: 'Laboratory', value: d.laboratorySpecialties, color: '#6366f1' },
      { name: 'Psychiatry', value: d.psychiatry, color: '#f59e0b' }
    ];
  }, [physicianZoneData]);

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

  const healthJobVacancySeries = useMemo(
    () => JOB_VACANCY_TRENDS.filter(t => /health/i.test(t.sector)),
    [JOB_VACANCY_TRENDS]
  );

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalPhysicians = PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === 'Alberta')?.totalActive ?? 0;
    const rnYear = latestNursingYear || NURSING_SUPPLY_TRENDS.map(n => n.year).sort().at(-1) || '';
    const totalRNs = NURSING_SUPPLY_TRENDS.find(
      n => n.profession === 'Registered Nurse (RN)' && n.year === rnYear
    )?.activePermits ?? 0;
    const vacancySeries = healthJobVacancySeries;
    const activeVacancies = vacancySeries[vacancySeries.length - 1]?.vacanciesCount ?? 0;
    const nursingLatestYear = NURSING_SUPPLY_TRENDS.filter(n => n.year === rnYear);
    const avgNursingVacancy =
      nursingLatestYear.length > 0
        ? Math.round((nursingLatestYear.reduce((s, n) => s + n.vacancyRatePct, 0) / nursingLatestYear.length) * 10) / 10
        : 0;

    return {
      totalPhysicians,
      totalRNs,
      activeVacancies,
      avgNursingVacancy
    };
  }, [PHYSICIAN_SPECIALTY_ZONE, NURSING_SUPPLY_TRENDS, healthJobVacancySeries, latestNursingYear]);
  // Max allied health rate for bar normalization (replaces hardcoded 140)
  const alliedMaxRate = useMemo(() => {
    const allRates = ALLIED_HEALTH_SUPPLY.flatMap(a => [a.nationalComparisonRatePer100k.alberta, a.nationalComparisonRatePer100k.canadaAvg]);
    const max = Math.max(...allRates, 0);
    return max > 0 ? max : 140;
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
  const rnGrowthPct = useMemo(() => {
    const rnYear = latestNursingYear || NURSING_SUPPLY_TRENDS.map(n => n.year).sort().at(-1) || '';
    return NURSING_SUPPLY_TRENDS.find(
      n => n.profession === 'Registered Nurse (RN)' && n.year === rnYear
    )?.growthRatePct ?? 0;
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
          colorClass: 'text-blue-400',
          strokeColor: '#3b82f6',
          gradientId: 'colorNursingSupplyTrend',
          icon: Activity
        };
      case 'jobVacancies':
        return {
          label: 'Health Care Job Vacancies',
          description: useCihiJobVacancy
            ? 'CIHI health workforce vacancy counts by provider type (annual, Alberta). Declining counts from 2024 peaks signal modest labour-market easing.'
            : 'StatsCan JVWS quarterly open vacancy counts and offered hourly wages in the Health Care & Social Assistance sector. Declining counts from 2024 peaks signal modest labour-market easing.',
          colorClass: 'text-amber-500',
          strokeColor: '#f59e0b',
          gradientId: 'colorJobVacancyTrend',
          icon: Briefcase
        };
      default:
        return null;
    }
  }, [selectedTrend, useCihiJobVacancy]);

  // Job vacancy chart series (health-related sectors)
  const vacancyChartData = useMemo(() => {
    return healthJobVacancySeries.map(t => ({
      quarter: t.quarter,
      vacanciesCount: t.vacanciesCount,
      vacancyRatePct: t.vacancyRatePct,
      avgOfferedHourlyWage: t.avgOfferedHourlyWage,
    }));
  }, [healthJobVacancySeries]);

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

  if (isLoading) return <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">Loading...</div>;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load workforce data: {error}</span>
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
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <DashboardHeader
        icon={Users}
        title="Health Workforce & Staffing"
        description="Monitor physician register counts, nurse supply trends, and job vacancies."
        metadata={metadata}
        arrayKey="PHYSICIAN_SPECIALTY_ZONE"
      />

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('physicians')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'physicians'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Physicians Register</span>
        </button>
        <button
          onClick={() => setActiveSubTab('nursing')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'nursing'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Nursing Supply</span>
        </button>
        <button
          onClick={() => setActiveSubTab('allied')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'allied'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Allied Health</span>
        </button>
        <button
          onClick={() => setActiveSubTab('retirement')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'retirement'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Retirement Risk</span>
        </button>
        <button
          onClick={() => setActiveSubTab('vacancies')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'vacancies'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Job Vacancies</span>
        </button>
      </div>

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active Registered Physicians</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.totalPhysicians.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.4% Annual Increase (illustrative)
            </p>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5">
              Snapshot only — no time series
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hidden sm:block">
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
          className={`bg-[#090e21] border p-4 rounded-xl flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedTrend === 'nursingSupply'
              ? 'border-blue-500 ring-1 ring-blue-500/30 shadow-blue-500/5'
              : 'border-slate-800/80 hover:border-blue-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active RN Permits</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.totalRNs.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +{rnGrowthPct.toFixed(1)}% Registered Growth
            </p>
            <span className="text-[9px] text-slate-500 group-hover:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedTrend === 'nursingSupply' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hidden sm:block group-hover:scale-110 transition-transform duration-300">
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
          className={`bg-[#090e21] border p-4 rounded-xl flex items-center justify-between relative overflow-hidden group cursor-pointer transition-all duration-300 select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedTrend === 'jobVacancies'
              ? 'border-amber-500 ring-1 ring-amber-500/30 shadow-amber-500/5'
              : 'border-slate-800/80 hover:border-amber-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Health Care Vacancies</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.activeVacancies.toLocaleString()}</div>
            <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              {vacancyChangePct.toFixed(1)}% vs 2024 Peaks
            </p>
            <span className="text-[9px] text-slate-500 group-hover:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedTrend === 'jobVacancies' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 hidden sm:block group-hover:scale-110 transition-transform duration-300">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Retirement Cliff Ratio</span>
            <div className="text-lg sm:text-2xl font-black text-white">{physicianRetirementRatio.toFixed(1)}%</div>
            <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              Physicians Over Age 55
            </p>
            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5">
              Snapshot only — no time series
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hidden sm:block">
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
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-6 shadow-xl relative">
              {/* Close Button */}
              <button
                onClick={() => setSelectedTrend(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title and description */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                    {React.createElement(selectedTrendDetails.icon, {
                      className: `w-4 h-4 ${selectedTrendDetails.colorClass}`
                    })}
                    <span>{selectedTrendDetails.label} Historical Trend Explorer</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    {selectedTrendDetails.description}
                  </p>
                </div>
              </div>

              {/* Stats highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline</span>
                  <span className="text-xl font-black text-slate-300 font-mono">{selectedTrendStats.baseline}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Latest</span>
                  <span className="text-xl font-black text-white font-mono">{selectedTrendStats.latest}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Series Peak</span>
                  <span className={`text-xl font-black font-mono ${selectedTrendDetails.colorClass}`}>{selectedTrendStats.peak}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                  <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                    selectedTrendStats.isIncrease ? 'text-amber-500' : 'text-emerald-500'
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
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingLPNTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingHCATrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorNursingNPTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                        labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                        itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <Area type="monotone" dataKey="RN" name="Registered Nurses" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingRNTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      <Area type="monotone" dataKey="LPN" name="Licensed Practical Nurses" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingLPNTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      <Area type="monotone" dataKey="HCA" name="Health Care Aides" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingHCATrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      {nursingChartHasNp && (
                        <Area type="monotone" dataKey="NP" name="Nurse Practitioners" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorNursingNPTrend)" dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="quarter" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis yAxisId="left" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                        labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                        itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                      />
                      <Area yAxisId="left" type="monotone" dataKey="vacanciesCount" name="Open Vacancies" stroke={selectedTrendDetails.strokeColor} strokeWidth={2.5} fillOpacity={1} fill={`url(#${selectedTrendDetails.gradientId})`} dot={{ r: 4, strokeWidth: 1 }} isAnimationActive={false} />
                      <Area yAxisId="right" type="monotone" dataKey="avgOfferedHourlyWage" name="Avg Offered Wage ($/Hr)" stroke="#10b981" strokeWidth={2.5} fillOpacity={0} dot={{ r: 3, strokeWidth: 1 }} isAnimationActive={false} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUBTAB 1: Physician Supply & 10-Yr Specialty Forecast */}
      {activeSubTab === 'physicians' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Zone Specialty Breakdown Selector */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Geographic Profile Selector</h3>
                  <p className="text-[10px] text-slate-500">Analyze specialties inside local health authorities</p>
                <DataTimestamp compact metadata={metadata} arrayKey="PHYSICIAN_SPECIALTY_ZONE" />
                </div>
                <Building className="w-4 h-4 text-blue-500" />
              </div>

              <div className="grid grid-cols-1 gap-1">
                {PHYSICIAN_SPECIALTY_ZONE.map(zone => (
                  <button
                    key={zone.zone}
                    onClick={() => setSelectedZone(zone.zone)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all text-left ${
                      selectedZone === zone.zone
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-850'
                    }`}
                  >
                    <span>{zone.zone}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        selectedZone === zone.zone ? 'bg-blue-700 text-white' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {zone.totalActive} MDs
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* MD per 100k card */}
              <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Zone Physician Density</span>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black text-white">{physicianZoneData.ratePer100k}</div>
                  <span className="text-xs text-slate-400">MDs per 100k Pop</span>
                </div>
                <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${albertaRatePer100k > 0 ? Math.min(100, (physicianZoneData.ratePer100k / albertaRatePer100k) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {physicianZoneData.zone === 'Alberta' 
                    ? 'Provincial average healthcare density benchmark.' 
                    : physicianZoneData.ratePer100k < 150 
                    ? `⚠️ Region has critical specialist access gaps below Alberta average (${albertaRatePer100k.toFixed(1)}).` 
                    : 'Region meets or exceeds provincial physician density benchmarks.'}
                </p>
              </div>
            </div>

            {/* Specialty Share Pie/Bar Visualizer */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Specialty Distribution Profile</h3>
                  <p className="text-[10px] text-slate-500">Composition of active fee-for-service clinical workforce in <strong>{selectedZone}</strong></p>
                </div>
                <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: CPSA Quarterly Statistics
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* Visual stats blocks */}
                <div className="space-y-2">
                  {zonePieData.map(slice => {
                    const pct = ((slice.value / physicianZoneData.totalActive) * 100).toFixed(1);
                    return (
                      <div key={slice.name} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-850 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-xs text-slate-400 font-medium truncate max-w-[110px]">{slice.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white block">{slice.value}</span>
                          <span className="text-[9px] text-slate-500 block">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recharts Bar chart representation */}
                <div className="sm:col-span-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={zonePieData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                        labelClassName="text-slate-200 font-bold text-xs"
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
            </div>
          </div>

          {/* Specialist 10-Year Recruitment Need and Strategic Alignment */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AHS 10-Year Specialist Forecasting & Strategic Alignment</h3>
                <p className="text-[10px] text-slate-500">FTE target needs vs current active workforce and recruitment seat caps (Specialist Physician Resource Plan)</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  10-Year Strategic Outlook
                </span>
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Hand-authored
                </span>
            <DataTimestamp compact metadata={metadata} arrayKey="SPECIALIST_RECRUITMENT_NEEDS" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SPECIALIST_RECRUITMENT_NEEDS.map(item => {
                const deficit = item.forecasted10YrNeed - item.currentActive;
                const ratio = Math.round((item.currentActive / item.forecasted10YrNeed) * 100);
                
                return (
                  <div key={item.specialty} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3 relative overflow-hidden">
                    {/* Corner accent according to risk */}
                    <div className={`absolute top-0 right-0 w-2 h-full ${
                      item.gapShortageRisk === 'Critical Deficit' 
                        ? 'bg-red-500' 
                        : item.gapShortageRisk === 'High Gap' 
                        ? 'bg-amber-500' 
                        : item.gapShortageRisk === 'Moderate Gap' 
                        ? 'bg-blue-400' 
                        : 'bg-emerald-500'
                    }`} />

                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{item.specialty}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider ${
                          item.gapShortageRisk === 'Critical Deficit'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : item.gapShortageRisk === 'High Gap'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : item.gapShortageRisk === 'Moderate Gap'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.gapShortageRisk}
                        </span>
                      </div>
                      <div className="text-right pr-3">
                        <span className="text-[10px] text-slate-500 block">Strategic Deficit</span>
                        <span className="text-xs font-bold text-slate-200">+{deficit} FTEs required</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>FTE Supply Gap Progress</span>
                        <span>{item.currentActive} / {item.forecasted10YrNeed} FTEs ({ratio}%)</span>
                      </div>
                      <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            item.gapShortageRisk === 'Critical Deficit' 
                              ? 'bg-red-500' 
                              : item.gapShortageRisk === 'High Gap' 
                              ? 'bg-amber-500' 
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] bg-slate-900/60 p-2 rounded-lg">
                      <span className="text-slate-400 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                        Planned residency seats
                      </span>
                      <span className="font-bold text-white">{item.plannedRecruitmentSeats} Seats</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Nursing & Allied Staffing Supply Trends */}
      {activeSubTab === 'nursing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Nursing growth trends chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Permit Growth & Demand Tracker</h3>
                  <p className="text-[10px] text-slate-500">
                    Active licensed practice permit expansion
                    {latestNursingYear ? ` (through ${latestNursingYear})` : ''}
                  </p>
                <DataTimestamp compact metadata={metadata} arrayKey={nursingSupplyMetadataKey} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                    {useCihiNursing ? 'Source: CIHI Health Workforce Quick Stats' : 'Source: CRNA & CLHA Registers'}
                  </span>
                  {!useCihiNursing && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                    Hand-authored
                  </span>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={nursingChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="RN" name="Registered Nurses (RN)" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="LPN" name="Licensed Practical Nurses (LPN)" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="HCA" name="Health Care Aides (HCA)" fill="#ec4899" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    {nursingChartHasNp && (
                    <Bar dataKey="NP" name="Nurse Practitioners (NP)" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nursing Capacity Diagnostics</h3>
                <p className="text-[10px] text-slate-500">
                  {latestNursingYear ? `${latestNursingYear} ` : ''}Active Registry benchmarks and allocation profiles
                </p>
              </div>

              <div className="space-y-3">
                {selectedNursingProfession.map(prof => (
                  <div key={prof.profession} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{prof.profession}</span>
                      <span className="text-xs font-mono font-bold text-blue-400">{prof.activePermits.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">VACANCY RATE</span>
                        <span className="font-bold text-red-400">{prof.vacancyRatePct}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">DIRECT CARE</span>
                        <span className="font-bold text-emerald-400">{prof.directCarePct}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">RURAL FOCUS</span>
                        <span className="font-bold text-indigo-400">{prof.ruralRemotePct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Allied Health Supply */}
      {activeSubTab === 'allied' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Allied Health Professional Benchmarking</h3>
                <p className="text-[10px] text-slate-500">Active staffing densities per 100,000 population: Alberta vs National Canadian Average</p>
                <DataTimestamp compact metadata={metadata} arrayKey={alliedSupplyMetadataKey} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  {useCihiAllied ? 'Source: CIHI Health Workforce Quick Stats' : 'Source: CIHI Health Workforce Quick Stats (hand-authored)'}
                </span>
                {!useCihiAllied && (
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Hand-authored
                </span>
                )}
              </div>
            </div>

            {/* Visual Grid comparing Alberta and Canada rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALLIED_HEALTH_SUPPLY.map(allied => {
                const diff = allied.nationalComparisonRatePer100k.alberta - allied.nationalComparisonRatePer100k.canadaAvg;
                const matchesAvg = diff >= 0;
                
                return (
                  <div key={allied.profession} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{allied.profession}</h4>
                        <span className="text-[10px] font-mono text-slate-400">Total Alberta count: <strong>{allied.albertaCount.toLocaleString()}</strong></span>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        matchesAvg ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {matchesAvg ? `+${diff.toFixed(1)} vs National` : `${diff.toFixed(1)} vs National`}
                      </span>
                    </div>

                    {/* Comparison Bars */}
                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Alberta Density (per 100k)</span>
                          <span className="font-bold text-white">{allied.nationalComparisonRatePer100k.alberta}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(allied.nationalComparisonRatePer100k.alberta / alliedMaxRate) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Canada Benchmark</span>
                          <span className="font-bold text-slate-400">{allied.nationalComparisonRatePer100k.canadaAvg}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-700 h-full rounded-full" style={{ width: `${(allied.nationalComparisonRatePer100k.canadaAvg / alliedMaxRate) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px]">
                      <span className="text-slate-500">Active Job Postings (AHS)</span>
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                        {allied.vacancyActivePostings} Active Listings
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Age & Retirement Risk Profile */}
      {activeSubTab === 'retirement' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Retirement Cliff & Demographics Analyzer</h3>
                <p className="text-[10px] text-slate-500">Evaluating potential staffing supply flight via aging practitioner profiles</p>
                <DataTimestamp compact metadata={metadata} arrayKey={ageProfileMetadataKey} />
                {!useCihiAgeProfile && (
                <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase w-fit mt-1">
                  Hand-authored
                </span>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search professions..."
                    value={searchProfession}
                    onChange={(e) => setSearchProfession(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedRiskLevel}
                  onChange={(e) => setSelectedRiskLevel(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="All">All Risks</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Profile display panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRetirementProfiles.map(profile => {
                const over55 = profile.age55to64Pct + profile.over65Pct;
                
                return (
                  <div key={profile.professionGroup} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{profile.professionGroup}</h4>
                        <span className="text-[9px] text-slate-500">Age demographic breakdown</span>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          profile.retirementRiskLevel === 'Critical'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                            : profile.retirementRiskLevel === 'High'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                          {profile.retirementRiskLevel} RISK
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">
                          <strong>{over55.toFixed(1)}%</strong> Over 55
                        </p>
                      </div>
                    </div>

                    {/* Staggered distribution progress bars */}
                    <div className="space-y-2">
                      {/* Under 35 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Under Age 35 (Early-career)</span>
                          <span className="font-bold text-emerald-400">{profile.under35Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${profile.under35Pct}%` }} />
                        </div>
                      </div>

                      {/* 35 to 54 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 35 to 54 (Mid-career core)</span>
                          <span className="font-bold text-blue-400">{profile.age35to54Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${profile.age35to54Pct}%` }} />
                        </div>
                      </div>

                      {/* 55 to 64 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 55 to 64 (Imminent Retirement Cliff)</span>
                          <span className="font-bold text-amber-500">{profile.age55to64Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${profile.age55to64Pct}%` }} />
                        </div>
                      </div>

                      {/* Over 65 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 65+ (Active Post-Retirement Practice)</span>
                          <span className="font-bold text-red-500">{profile.over65Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full rounded-full" style={{ width: `${profile.over65Pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Vacancy & Shortage Pressure */}
      {activeSubTab === 'vacancies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Vacancy & Wage Trend chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {useCihiJobVacancy ? 'CIHI Health Workforce Vacancy Trends' : 'StatsCan Vacancy and Offered Hourly Wage Trends'}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {useCihiJobVacancy
                      ? 'Annual vacancy counts by health provider type (Alberta)'
                      : 'Unadjusted quarterly monitoring for Health Care & Social Assistance (Alberta)'}
                  </p>
                <DataTimestamp compact metadata={metadata} arrayKey={jobVacancyMetadataKey} />
                </div>
                <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  {useCihiJobVacancy ? 'Source: CIHI Health Workforce Quick Stats' : 'Source: StatCan Table 14-10-0371-01'}
                </span>
              </div>

              {/* Line charts with two axes or combined representation */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={vacancyChartData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="quarter" stroke="#64748b" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#3b82f6" fontSize={9} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="vacanciesCount" name="Open Vacancies (Count)" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="avgOfferedHourlyWage" name="Avg Offered Wage ($/Hr)" stroke="#10b981" strokeWidth={2.5} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strategic Intervention & Policy Diagnostics */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Staffing Pressure Diagnostics</h3>
                <p className="text-[10px] text-slate-500">Interlinked systems pressure loop (Shortages → Overtime → Closures)</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Extreme Overtime Stress</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    AHS clinical reports show overtime utilization in medical-surgical units remains <strong>38% above 2019 baseline benchmarks</strong> (illustrative).
                  </p>
                </div>

                <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>Duration / Long-Term Vacancies</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Over <strong>42% of specialized nursing vacancies</strong> in Northern and Rural economic regions remain unfilled for more than 90 consecutive days (illustrative).
                  </p>
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Residency Expansion Seat Allocations</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    The Alberta Ministry of Health is committing funding to support <strong>120+ additional postgraduate medical residency seats</strong> by fiscal 2026 (illustrative).
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
