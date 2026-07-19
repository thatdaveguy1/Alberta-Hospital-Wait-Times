import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Clock, 
  User, 
  Building2, 
  Sparkles, 
  TrendingUp, 
  Info, 
  FileText, 
  BarChart3, 
  Award, 
  Layers,
  Users,
  TrendingDown,
  Search,
  Check,
  AlertTriangle,
  BarChart2,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import type {
  SurgicalRecord,
  Specialist,
  FacilitySurgicalCapacity,
  JointWaitRecord,
  HistoricalTrend,
  StatsCanDemographic,
  FacilityComparisonRecord,
  SpecialistComparisonRecord,
} from '../surgicalData';
import * as surgicalData from '../surgicalData';
import { DataTimestamp, type DataMetadataMap } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

interface StatsCanSatisfactionSegment {
  segment: string;
  value: number;
}

interface StatsCanSatisfactionStats {
  reporting_title: string;
  survey_period: string;
  metrics_alberta: {
    satisfied_with_wait: number;
    unsatisfied_with_wait: number;
    wait_affected_life_negatively: number;
    waiting_segment_distribution: StatsCanSatisfactionSegment[];
    life_impact_categories: { impact: string; value: number }[];
  };
}

type SurgicalData = {
  SURGICAL_RECORDS: SurgicalRecord[];
  ORTHOPEDIC_SPECIALTY_RECORDS: JointWaitRecord[];
  SURGICAL_FACILITIES: FacilitySurgicalCapacity[];
  SPECIALISTS_LIST?: Specialist[];
  STATSCAN_SATISFACTION_STATS: StatsCanSatisfactionStats;
  HISTORICAL_WAIT_TRENDS: HistoricalTrend[];
  STATSCAN_DEMOGRAPHICS: StatsCanDemographic[];
  FACILITY_COMPARISONS: FacilityComparisonRecord[];
  SPECIALIST_COMPARISONS?: SpecialistComparisonRecord[];
  _dataMetadata?: DataMetadataMap;
};

const EMPTY_SATISFACTION_STATS: StatsCanSatisfactionStats = {
  reporting_title: '',
  survey_period: '',
  metrics_alberta: {
    satisfied_with_wait: 0,
    unsatisfied_with_wait: 0,
    wait_affected_life_negatively: 0,
    waiting_segment_distribution: [],
    life_impact_categories: [],
  },
};

/** True only when a non-placeholder StatsCan satisfaction payload is present. */
function hasVerifiedStatsCanSatisfaction(stats: StatsCanSatisfactionStats | null | undefined): boolean {
  if (!stats?.metrics_alberta) return false;
  const m = stats.metrics_alberta;
  const hasMeta = Boolean(stats.reporting_title?.trim() || stats.survey_period?.trim());
  const hasSegments = (m.waiting_segment_distribution?.length ?? 0) > 0;
  const hasLifeImpact = (m.life_impact_categories?.length ?? 0) > 0;
  const hasPositiveRates =
    m.satisfied_with_wait > 0 ||
    m.unsatisfied_with_wait > 0 ||
    m.wait_affected_life_negatively > 0;
  // Fail-closed empty object (zeros + empty arrays, blank title/period) is not observed data.
  return hasMeta && (hasSegments || hasLifeImpact || hasPositiveRates);
}

export default function SurgicalDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'ortho' | 'comparisons' | 'statscan'>('overview');
  
  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'hip_replacement_median' | 'knee_replacement_median' | 'cataract_surgery_median' | null>(null);
  const { data, metadata, isLoading, error, refresh } = useDomainData<SurgicalData>('surgical', surgicalData);
  const SURGICAL_RECORDS = useMemo(() => {
    return (data?.SURGICAL_RECORDS ?? []).filter(
      r => r.procedure_group !== 'Diagnostic Imaging' &&
           !r.procedure_name.includes('MRI') &&
           !r.procedure_name.includes('CT')
    );
  }, [data]);
  const ORTHOPEDIC_SPECIALTY_RECORDS = data?.ORTHOPEDIC_SPECIALTY_RECORDS ?? [];
  // SURGICAL_FACILITIES / FACILITY_COMPARISONS ops metrics are estimated — do not surface.
  const SURGICAL_FACILITIES: typeof data extends { SURGICAL_FACILITIES: infer T } ? T : never[] = [] as any;
  const SPECIALISTS_LIST = data?.SPECIALISTS_LIST ?? [];
  // StatsCan satisfaction snapshot is manual/unverified in this domain — fail closed.
  const STATSCAN_SATISFACTION_STATS = EMPTY_SATISFACTION_STATS;
  const rawHistoricalTrends = data?.HISTORICAL_WAIT_TRENDS ?? [];
  const HISTORICAL_WAIT_TRENDS = useMemo(() => {
    if (!rawHistoricalTrends || rawHistoricalTrends.length === 0) return [];
    // If the data is already parsed/pivoted, return it directly
    const first = rawHistoricalTrends[0];
    if (first && 'hip_replacement_median' in first) {
      return rawHistoricalTrends as unknown as HistoricalTrend[];
    }
    
    // Otherwise, pivot the flat array grouped by year
    const map = new Map<string, Partial<HistoricalTrend>>();
    for (const rawItem of rawHistoricalTrends) {
      const item = rawItem as unknown as { year: string; procedure: string; medianWaitDays: number };
      const year = item.year;
      if (!year) continue;
      let entry = map.get(year);
      if (!entry) {
        entry = { year };
        map.set(year, entry);
      }
      const days = item.medianWaitDays || 0;
      const weeks = Number((days / 7).toFixed(1));
      switch (item.procedure) {
        case 'Hip Replacement':
          entry.hip_replacement_median = weeks;
          break;
        case 'Knee Replacement':
          entry.knee_replacement_median = weeks;
          break;
        case 'Cataract Surgery':
          entry.cataract_surgery_median = weeks;
          break;
        case 'MRI Scan':
          entry.mri_scan_median = weeks;
          break;
        case 'CT Scan':
          entry.ct_scan_median = weeks;
          break;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.year.localeCompare(b.year)) as HistoricalTrend[];
  }, [rawHistoricalTrends]);
  const STATSCAN_DEMOGRAPHICS = data?.STATSCAN_DEMOGRAPHICS ?? [];
  const FACILITY_COMPARISONS: typeof data extends { FACILITY_COMPARISONS: infer T } ? T : never[] = [] as any;
  const SPECIALIST_COMPARISONS = data?.SPECIALIST_COMPARISONS ?? [];

  useEffect(() => {
    if (SPECIALIST_COMPARISONS.length === 0) return;
    setCompSpecialistA(prev =>
      prev && SPECIALIST_COMPARISONS.some(s => s.id === prev) ? prev : SPECIALIST_COMPARISONS[0].id,
    );
    setCompSpecialistB(prev => {
      if (prev && SPECIALIST_COMPARISONS.some(s => s.id === prev)) return prev;
      const second = SPECIALIST_COMPARISONS.find(s => s.id !== SPECIALIST_COMPARISONS[0]?.id);
      return second?.id ?? SPECIALIST_COMPARISONS[0].id;
    });
  }, [SPECIALIST_COMPARISONS]);

  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const values = HISTORICAL_WAIT_TRENDS.map(t => t[selectedKpi] as number).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toFixed(1),
      latest: latest.toFixed(1),
      peak: peak.toFixed(1),
      minVal: minVal.toFixed(1),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(1)}` : rawDelta.toFixed(1),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedKpi, HISTORICAL_WAIT_TRENDS]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'hip_replacement_median':
        return {
          label: 'Total Hip Replacement Median Wait Time',
          description: 'Historical trend of hip replacement surgery median wait times (weeks) in Alberta from 2015 to 2026. The COVID pandemic and subsequent system strain caused a major spike, which has only partially resolved.',
          colorClass: 'text-accent',
          bgClass: 'bg-accent-soft',
          strokeColor: 'oklch(0.68 0.13 252)',
          gradientId: 'colorHipTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'knee_replacement_median':
        return {
          label: 'Total Knee Replacement Median Wait Time',
          description: 'Historical trend of knee replacement surgery median wait times (weeks) in Alberta from 2015 to 2026. Consistent under-capacity relative to aging demographics remains a primary strain factor.',
          colorClass: 'text-accent',
          bgClass: 'bg-purple-500/10',
          strokeColor: 'oklch(0.82 0.12 85)',
          gradientId: 'colorKneeTrend',
          unit: ' Wks',
          icon: Clock
        };
      case 'cataract_surgery_median':
        return {
          label: 'Cataract Extraction Median Wait Time',
          description: 'Historical trend of cataract surgery median wait times (weeks) in Alberta from 2015 to 2026. Substantial provincial volume shifts have helped stabilize cataract waits closer to target relative to orthopedics.',
          colorClass: 'text-ok',
          bgClass: 'bg-ok-soft',
          strokeColor: 'oklch(0.78 0.12 155)',
          gradientId: 'colorCataractTrend',
          unit: ' Wks',
          icon: Sparkles
        };
      default:
        return null;
    }
  }, [selectedKpi]);

  // Comparisons States
  const [compFacilityA, setCompFacilityA] = useState<string>('WDFAB783'); // Royal Alex
  const [compFacilityB, setCompFacilityB] = useState<string>('WDFAB102'); // U of A
  const [compSpecialistA, setCompSpecialistA] = useState<string>('');
  const [compSpecialistB, setCompSpecialistB] = useState<string>('');
  const [compProcedureA, setCompProcedureA] = useState<string>('Total Hip Arthroplasty');
  const [compProcedureB, setCompProcedureB] = useState<string>('Total Knee Arthroplasty');

  // StatsCan State
  const [statscanCategoryFilter, setStatscanCategoryFilter] = useState<string>('All');

  // Search & Filter States
  const [specialistSearch, setSpecialistSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedProcedureGroup, setSelectedProcedureGroup] = useState<string>('Hip Replacement');

  // Get filtered Specialists list
  const filteredSpecialists = SPECIALISTS_LIST.filter(spec => {
    const matchesSearch = spec.name.toLowerCase().includes(specialistSearch.toLowerCase()) ||
                          spec.specialty.toLowerCase().includes(specialistSearch.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'All' || spec.specialty === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  // Get filtered Facilities list
  const filteredFacilities = SURGICAL_FACILITIES.filter(fac => {
    const matchesSearch = fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                          fac.city.toLowerCase().includes(facilitySearch.toLowerCase());
    const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
    return matchesSearch && matchesZone;
  });

  // Split into tracked (reporting) and untracked (not reporting) lists
  const trackedFacilities = useMemo(() => {
    return filteredFacilities.filter(f => f.or_utilization_rate > 0);
  }, [filteredFacilities]);

  const untrackedFacilities = useMemo(() => {
    return filteredFacilities.filter(f => !f.or_utilization_rate || f.or_utilization_rate === 0);
  }, [filteredFacilities]);

  const surgicalCapacityStats = useMemo(() => {
    const total = SURGICAL_FACILITIES.length;
    const csfCount = SURGICAL_FACILITIES.filter(f => f.chartered_partner_status).length;
    const csfSharePct = total > 0 ? Math.round((csfCount / total) * 1000) / 10 : 0;
    const tracked = SURGICAL_FACILITIES.filter(f => f.or_utilization_rate > 0);
    const orUtilPct =
      tracked.length > 0
        ? Math.round((tracked.reduce((s, f) => s + f.or_utilization_rate, 0) / tracked.length) * 10) / 10
        : 0;
    const hipBench = SURGICAL_RECORDS.find(
      r =>
        r.procedure_name === 'Total Hip Arthroplasty' &&
        (r.geography_name === 'Alberta' || r.geography_type === 'Province') &&
        r.metric_name === '% within benchmark' &&
        r.wait_segment === 'Decision-to-surgery',
    )?.metric_value;
    return { total, csfSharePct, orUtilPct, hipBenchPct: hipBench ?? null };
  }, [SURGICAL_FACILITIES, SURGICAL_RECORDS]);


  const parseBenchmarkWeeks = (benchmark?: string): number | null => {
    if (!benchmark) return null;
    const match = benchmark.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
    return match ? parseFloat(match[1]) : null;
  };

  const findProvincial90th = (procedureName: string) =>
    SURGICAL_RECORDS.find(
      r =>
        r.procedure_name === procedureName &&
        r.geography_name === 'Alberta' &&
        r.metric_name === '90th percentile' &&
        r.wait_segment === 'Decision-to-surgery',
    );

  const findComparison90th = (procedureKey: string) =>
    SURGICAL_RECORDS.find(
      r =>
        r.geography_name === 'Alberta' &&
        r.metric_name === '90th percentile' &&
        r.wait_segment === 'Decision-to-surgery' &&
        (r.procedure_name === procedureKey || r.procedure_group === procedureKey),
    );

  const provincial90thOptions = useMemo(() => {
    const seen = new Set<string>();
    return SURGICAL_RECORDS.filter(r => {
      if (r.geography_type !== 'Province' || r.metric_name !== '90th percentile') return false;
      if (seen.has(r.procedure_name)) return false;
      seen.add(r.procedure_name);
      return true;
    });
  }, [SURGICAL_RECORDS]);

  const overviewProcedureCards = useMemo(() => {
    const specs = [
      { procedureName: 'Total Hip Arthroplasty', title: 'Total Hip Replacement', iconColor: 'text-accent', pctClass: 'text-warn' },
      { procedureName: 'Total Knee Arthroplasty', title: 'Total Knee Replacement', iconColor: 'text-accent', pctClass: 'text-warn' },
      { procedureName: 'Cataract Extraction & Lens Implant', title: 'Cataract Extraction', iconColor: 'text-ok', pctClass: 'text-ok' },
      { procedureName: 'Breast Cancer Surgery', title: 'Breast Cancer Surgery', iconColor: 'text-crit', pctClass: 'text-crit', subtitle: 'Breast Cancer 90th percentile' },
    ] as const;
    return specs.map(spec => {
      const record = findProvincial90th(spec.procedureName);
      const wait = record?.metric_value ?? null;
      const target = parseBenchmarkWeeks(record?.benchmark_value);
      const pctOfTarget = wait != null && target != null && target > 0 ? Math.round((wait / target) * 1000) / 10 : null;
      return { ...spec, wait, target, pctOfTarget, benchmarkLabel: record?.benchmark_value };
    });
  }, [SURGICAL_RECORDS]);
  const renderFacilityRow = (fac: FacilitySurgicalCapacity) => {
    const isTracked = fac.or_utilization_rate > 0;
    // color scale for OR utilization
    let progressColor = 'bg-accent';
    let textColor = 'text-accent';
    if (fac.or_utilization_rate >= 93) {
      progressColor = 'bg-crit';
      textColor = 'text-crit';
    } else if (fac.or_utilization_rate >= 88) {
      progressColor = 'bg-warn';
      textColor = 'text-warn';
    } else {
      progressColor = 'bg-ok';
      textColor = 'text-ok';
    }

    return (
      <tr key={fac.id} className="hover:bg-paper transition-all text-ink">
        <td className="p-3">
          <div className="font-semibold text-ink text-[13px]">{fac.name}</div>
          <div className="text-[10px] text-ink-3 font-mono">{fac.id}</div>
        </td>
        <td className="p-3">
          <span className="font-semibold text-ink">{fac.city}</span>
          <span className="text-ink-3 text-[10px] block">{fac.zone}</span>
        </td>
        <td className="p-3">
          {isTracked ? (
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className={`font-mono text-[11px] font-semibold ${textColor}`}>{fac.or_utilization_rate}%</span>
              <div className="w-24 bg-paper h-1 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${fac.or_utilization_rate}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="font-mono text-[11px] font-semibold text-ink-3">—</span>
              <span className="text-[9px] text-ink-3 font-medium font-sans">No Data</span>
            </div>
          )}
        </td>
        <td className="p-3">
          {fac.chartered_partner_status ? (
            <span className="px-2 py-0.5 bg-ok-soft text-ok border border-ok rounded font-semibold text-[9px]">
              Chartered Partner (CSF)
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-accent-soft text-accent border border-accent rounded font-semibold text-[9px]">
              Public Facility (AHS)
            </span>
          )}
        </td>
        <td className="p-3">
          <div className="flex flex-wrap gap-1 max-w-[280px]">
            {fac.specialties_offered.map((spec, sIdx) => (
              <span key={sIdx} className="bg-paper text-ink-2 px-1.5 py-0.5 rounded text-[9px] font-mono border border-line">
                {spec}
              </span>
            ))}
          </div>
        </td>
      </tr>
    );
  };

  const renderFacilityMobileCard = (fac: FacilitySurgicalCapacity) => {
    const isTracked = fac.or_utilization_rate > 0;
    let progressColor = 'bg-accent';
    let textColor = 'text-accent';
    if (fac.or_utilization_rate >= 93) {
      progressColor = 'bg-crit';
      textColor = 'text-crit';
    } else if (fac.or_utilization_rate >= 88) {
      progressColor = 'bg-warn';
      textColor = 'text-warn';
    } else {
      progressColor = 'bg-ok';
      textColor = 'text-ok';
    }

    return (
      <div key={fac.id} className="bg-paper border border-line p-4 rounded-xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-ink text-xs">{fac.name}</h4>
            <span className="text-[9px] text-ink-3 font-mono block">{fac.id} • {fac.city} ({fac.zone})</span>
          </div>
          <div className="shrink-0">
            {fac.chartered_partner_status ? (
              <span className="px-1.5 py-0.5 bg-ok-soft text-ok border border-ok rounded text-[8px] font-semibold">
                CSF
              </span>
            ) : (
              <span className="px-1.5 py-0.5 bg-accent-soft text-accent border border-accent rounded text-[8px] font-semibold">
                Public
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs border-t border-line pt-2">
          <span className="text-ink-2 font-medium">OR Utilization:</span>
          {isTracked ? (
            <div className="flex items-center gap-2">
              <span className={`font-mono font-semibold ${textColor}`}>{fac.or_utilization_rate}%</span>
              <div className="w-16 bg-surface h-1.5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${fac.or_utilization_rate}%` }} />
              </div>
            </div>
          ) : (
            <span className="font-mono font-semibold text-ink-3">— (No Data)</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-line">
          {fac.specialties_offered.map((spec, sIdx) => (
            <span key={sIdx} className="bg-surface text-ink-2 px-1.5 py-0.5 rounded text-[8.5px] font-mono border border-line">
              {spec}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Get active joint replacement records
  const orthopedicData = ORTHOPEDIC_SPECIALTY_RECORDS.filter(
    item => item.procedure === selectedProcedureGroup
  );

  // StatsCan Demographics Filter
  const filteredStatsCanDemographics = STATSCAN_DEMOGRAPHICS.filter(demo => 
    statscanCategoryFilter === 'All' || demo.category === statscanCategoryFilter
  );

  // Head to Head Select Data
  const facAData = FACILITY_COMPARISONS.find(f => f.facility_id === compFacilityA);
  const facBData = FACILITY_COMPARISONS.find(f => f.facility_id === compFacilityB);

  const specAData = SPECIALIST_COMPARISONS.find(s => s.id === compSpecialistA);
  const specBData = SPECIALIST_COMPARISONS.find(s => s.id === compSpecialistB);

  const procAData = findComparison90th(compProcedureA);
  const procBData = findComparison90th(compProcedureB);
  // Pie chart stats for StatsCan Satisfaction — only when verified non-empty payload exists
  const hasStatsCanSatisfaction = hasVerifiedStatsCanSatisfaction(STATSCAN_SATISFACTION_STATS);
  const satisfactionPieData = hasStatsCanSatisfaction
    ? [
        { name: 'Satisfied with wait time', value: STATSCAN_SATISFACTION_STATS.metrics_alberta.satisfied_with_wait, color: '#10b981' },
        { name: 'Unsatisfied with wait time', value: STATSCAN_SATISFACTION_STATS.metrics_alberta.unsatisfied_with_wait, color: '#ef4444' },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-ink-2 text-sm">
        Loading surgical data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ink-2 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-warn" />
        <span>Failed to load surgical data: {error}</span>
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold text-ink hover:border-line-2 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <DashboardHeader
        icon={Activity}
        title="Surgical Wait Times"
        description="Track surgery waitlists, volumes, and priority benchmark compliance across facilities."
        metadata={metadata ?? undefined}
        arrayKey="SURGICAL_RECORDS"
        variant="light"
      >
        <button
          onClick={refresh}
          disabled={isLoading}
          className="rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-line flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'overview'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Provincial Overview</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ortho')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ortho'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Orthopedics & Historical Trends</span>
        </button>

        <button
          onClick={() => setActiveSubTab('comparisons')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'comparisons'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Head-to-Head Comparisons</span>
        </button>

        <button
          onClick={() => setActiveSubTab('statscan')}
          className={`px-4 py-2.5 text-xs font-semibold   border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'statscan'
              ? 'border-accent text-accent bg-accent-soft'
              : 'border-transparent text-ink-2 hover:text-ink hover:border-line-2'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>StatsCan Patient Survey</span>
        </button>

      </div>

      {/* --- SUB-TAB: PROVINCIAL OVERVIEW --- */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {overviewProcedureCards.map((card) => {
              const trendKey =
                card.procedureName === 'Total Hip Arthroplasty'
                  ? 'hip_replacement_median'
                  : card.procedureName === 'Total Knee Arthroplasty'
                    ? 'knee_replacement_median'
                    : card.procedureName === 'Cataract Extraction & Lens Implant'
                      ? 'cataract_surgery_median'
                      : null;
              const waitLabel = card.wait != null ? `${card.wait} Weeks` : '—';
              const targetFooter =
                card.target != null
                  ? `National Target: ${card.target} Wks`
                  : card.benchmarkLabel
                    ? `Target: ${card.benchmarkLabel}`
                    : 'Target: —';
              const pctFooter =
                card.pctOfTarget != null
                  ? card.procedureName === 'Cataract Extraction & Lens Implant' && card.pctOfTarget <= 100
                    ? `${card.pctOfTarget}% (Within Target)`
                    : `${card.pctOfTarget}% of Target`
                  : card.procedureName === 'Breast Cancer Surgery'
                    ? 'High Priority Flow'
                    : '—';

              if (card.procedureName === 'Breast Cancer Surgery') {
                return (
                  <div key={card.procedureName} className="bg-surface border border-line rounded-xl p-4 space-y-2 relative overflow-hidden group">
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-ink-2 font-semibold">Oncology Fast-Track</span>
                      <Activity className="w-3.5 h-3.5 text-crit" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-2xl font-semibold text-ink">{waitLabel}</div>
                      <div className="text-[10px] text-ink-2">{card.subtitle ?? 'Breast Cancer 90th percentile'}</div>
                    </div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2">
                      <span>{targetFooter}</span>
                      <span className="text-crit font-semibold">{pctFooter}</span>
                    </div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-ink-3">
                      <span>No Trend Data Available</span>
                    </div>
                  </div>
                );
              }

              const isActive = trendKey != null && selectedKpi === trendKey;
              const toggle = () => trendKey && setSelectedKpi(isActive ? null : trendKey);

              if (card.procedureName === 'Total Hip Arthroplasty') {
                return (
                  <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                    className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-accent   bg-surface ' : 'border-line hover:border-accent'}`}>
                    
                    <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">{card.title}</span><Clock className="w-3.5 h-3.5 text-accent" /></div>
                    <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-accent group-hover:text-accent transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                  </div>
                );
              }
              if (card.procedureName === 'Total Knee Arthroplasty') {
                return (
                  <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                    className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-accent   bg-surface ' : 'border-line hover:border-accent'}`}>
                    
                    <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">{card.title}</span><Clock className="w-3.5 h-3.5 text-accent" /></div>
                    <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                    <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                    <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-accent group-hover:text-accent transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                  </div>
                );
              }
              return (
                <div key={card.procedureName} tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                  className={`bg-surface border rounded-xl p-4 space-y-2 relative overflow-hidden group cursor-pointer transition-all duration-300 select-none   ${isActive ? 'border-ok   bg-surface ' : 'border-line hover:border-ok'}`}>
                  
                  <div className="flex items-center justify-between"><span className="text-[10px] text-ink-2 font-semibold">Cataract Extractions</span><Sparkles className="w-3.5 h-3.5 text-ok" /></div>
                  <div className="space-y-0.5"><div className="text-2xl font-semibold text-ink">{waitLabel}</div><div className="text-[10px] text-ink-2">90th Percentile Wait Time</div></div>
                  <div className="pt-2 border-t border-line flex items-center justify-between text-[9px] text-ink-2"><span>{targetFooter}</span><span className={`${card.pctClass} font-semibold`}>{pctFooter}</span></div>
                  <div className="pt-1.5 flex items-center gap-1 text-[8px] font-semibold text-ok group-hover:text-ok transition-colors"><BarChart2 className="w-3 h-3" /><span>{isActive ? 'Active: Hide Trend' : 'Click to View Trend'}</span></div>
                </div>
              );
            })}
          </div>
          {/* Trend Panel */}
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
                <div className="bg-paper border border-line p-4 sm:p-5 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold flex items-center gap-2 text-ink">
                        {React.createElement(selectedKpiDetails.icon, {
                          className: `w-4 h-4 ${selectedKpiDetails.colorClass}`
                        })}
                        <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                      </h3>
                      <p className="text-xs text-ink-2 max-w-3xl leading-relaxed">
                        {selectedKpiDetails.description}
                       </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface p-3 rounded-xl border border-line">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Baseline (2015)</span>
                      <span className="text-xl font-semibold text-ink font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Current (2026)</span>
                      <span className="text-xl font-semibold text-ink font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">5-Year Peak</span>
                      <span className={`text-xl font-semibold font-mono ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                    </div>
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] font-semibold text-ink-3 block">Overall Shift</span>
                      <span className={`text-xs font-semibold flex items-center justify-center sm:justify-start gap-1 ${kpiStats.isIncrease ? 'text-crit' : 'text-ok'}`}>
                        {kpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                        <span>{kpiStats.delta}{selectedKpiDetails.unit} ({kpiStats.pctChange})</span>
                      </span>
                    </div>
                  </div>

                  <div className="h-60 mt-3 pt-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HISTORICAL_WAIT_TRENDS} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                        <XAxis dataKey="year" stroke="oklch(0.62 0.02 255)" fontSize={10} />
                        <YAxis stroke="oklch(0.62 0.02 255)" fontSize={10} unit={selectedKpiDetails.unit} />
                        <RechartsTooltip contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }} />
                        <Area
                          type="monotone"
                          dataKey={selectedKpi}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-semibold text-sm text-ink mb-1.5 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  Provincial Specialty Wait Times (Decision-to-Surgery)
                </h3>
                <p className="text-[11px] text-ink-2 leading-normal mb-4">
                  Official reporting parameters showing the median and 90th percentile (the timeframe in which 90% of procedures are performed).
                </p>
                <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="SURGICAL_RECORDS" />
              </div>

              {/* Wait Times Legend */}
              <div className="mb-4 p-3.5 bg-paper border border-line rounded-xl space-y-2">
                <h4 className="text-[10px] font-semibold text-ink flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Wait Times Legend &amp; Definitions</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] leading-relaxed">
                  <div className="p-2.5 bg-surface rounded-lg border border-line">
                    <strong className="text-ink block mb-0.5">Wait 1 (GP Referral to Specialist Consult)</strong>
                    <span className="text-ink-2">The total duration from when your Family Doctor submits a referral to when you have your initial consultation visit with the surgical specialist.</span>
                  </div>
                  <div className="p-2.5 bg-surface rounded-lg border border-line">
                    <strong className="text-ink block mb-0.5">Wait 2 (Decision to Surgical Procedure)</strong>
                    <span className="text-ink-2">The duration from when you and the specialist decide to proceed with surgery (signed consent form) to the actual date the surgery is performed.</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] text-ink-2">
                      <th className="py-2.5 px-3">Procedure Group</th>
                      <th className="py-2.5 px-3 text-center">Median Wait</th>
                      <th className="py-2.5 px-3 text-center">90% Seen Within</th>
                      <th className="py-2.5 px-3">Standard Benchmark</th>
                      <th className="py-2.5 px-3 text-right">Primary Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const formatWaitTime = (val: number | string) => {
                        if (typeof val === 'number') return val.toFixed(1);
                        const num = parseFloat(val);
                        return isNaN(num) ? val : num.toFixed(1);
                      };

                      const formatBenchmark = (val: string | null) => {
                        if (!val) return null;
                        const lower = val.toLowerCase();
                        if (lower.includes('week') || lower.includes('day')) return val;
                        return `${val} weeks`;
                      };

                      const getWaitSegmentLabel = (segment: string) => {
                        if (segment === 'Decision-to-surgery') return 'Wait 2 (Decision to Surgery)';
                        if (segment === 'Referral-to-treatment') return 'Wait 1 (Referral to Treatment)';
                        return segment;
                      };

                      const getSourceLabel = (source: string) => {
                        if (source.includes('Power BI')) return 'AHS Power BI';
                        if (source.includes('Wait Times')) return 'AHS Registry';
                        return source;
                      };

                      return SURGICAL_RECORDS.filter(r => r.geography_type === 'Province' && r.metric_name === 'Median wait').map((rec, i) => {
                        const matching90th = SURGICAL_RECORDS.find(
                          r => r.procedure_name === rec.procedure_name && 
                               r.metric_name === '90th percentile' &&
                               r.wait_segment === rec.wait_segment
                        );
                        return (
                          <tr key={i} className="border-b border-line hover:bg-paper transition-all font-sans">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-ink text-[13px]">{rec.procedure_name}</div>
                              <span className="inline-block mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-paper text-ink-2 border border-line">
                                {getWaitSegmentLabel(rec.wait_segment)}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-ink whitespace-nowrap">
                              {rec.metric_value > 0 ? `${formatWaitTime(rec.metric_value)} weeks` : <span className="text-[10px] font-semibold text-ink-3">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-ink whitespace-nowrap">
                              {matching90th && matching90th.metric_value > 0 ? `${formatWaitTime(matching90th.metric_value)} weeks` : <span className="text-[10px] font-semibold text-ink-3">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-ink-2 font-semibold text-[11px] whitespace-nowrap">
                              {rec.benchmark_value ? formatBenchmark(rec.benchmark_value) : <span className="text-ink-3 font-normal">—</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-paper border border-line text-accent">
                                {getSourceLabel(rec.source_name)}
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AHS context and policy tracker panel */}
            <div className="space-y-4">
              <div className="bg-surface border border-line rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-ink-2" />
                  <h4 className="text-xs font-semibold text-ink">Surgical Capacity & Initiatives</h4>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-paper border border-line rounded-xl space-y-1">
                    <p className="text-[11px] text-ink font-semibold">OR utilization & CSF share unavailable</p>
                    <p className="text-[10px] text-ink-3 leading-relaxed">
                      Facility OR utilization and chartered-facility share were estimated and not from a published feed. Removed rather than displayed.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-ink font-medium">Hip % within CIHI 182-day benchmark</span>
                      <span className="text-warn font-semibold">
                        {surgicalCapacityStats.hipBenchPct != null ? `${surgicalCapacityStats.hipBenchPct}%` : '—'}
                      </span>
                    </div>
                    <p className="text-[9px] text-ink-3">From SURGICAL_RECORDS when the provincial Power BI row is present</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-warn" />
                  <h4 className="text-xs font-semibold text-ink">Patient Impact survey</h4>
                </div>
                <p className="text-[11px] text-ink-2 leading-relaxed">
                  StatsCan patient-impact figures are not shown until a table-backed fetch with field-level provenance is wired. Handwritten percentages have been removed.
                </p>
              </div>
            </div>
          </div>

          {/* Estimated surgical facility OR utilization directory removed */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm text-ink">Surgical Facilities Directory & Capacity Monitor</h3>
            </div>
            <p className="text-[11px] text-ink-2 leading-relaxed">
              Facility OR utilization rates and CSF partner flags were estimated (not from a published live OR registry feed) and have been removed. Provincial wait-time series remain available from Power BI surgical records when present.
            </p>
          </div>

        </div>
      )}

      {/* --- SUB-TAB: ORTHOPEDICS & HISTORICAL TRENDS --- */}
      {activeSubTab === 'ortho' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                Joint Reconstruction Specialty Registry (ABJHI & IIHO Feeds)
              </h3>
              <p className="text-xs text-ink-2">
                Detailed metrics by geography comparing hip and knee replacement wait segments and historical median values.
              </p>
              <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="ORTHOPEDIC_SPECIALTY_RECORDS" />
              {ORTHOPEDIC_SPECIALTY_RECORDS.length === 0 && (
                <p className="text-[11px] text-warn">No current ABJHI orthopedic rows. Failed scrapes are not treated as fresh data.</p>
              )}
              {ORTHOPEDIC_SPECIALTY_RECORDS.length > 0 && metadata?.ORTHOPEDIC_SPECIALTY_RECORDS?.updateType === 'manual' && (
                <p className="text-[11px] text-warn">ABJHI last scrape did not refresh these rows — treat as stale, not live.</p>
              )}
            </div>

            {/* Procedure toggle */}
            <div className="flex items-center gap-1.5 p-1 bg-paper border border-line rounded-xl">
              <button
                onClick={() => setSelectedProcedureGroup('Hip Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold   transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Hip Replacement'
                    ? 'bg-accent text-ink '
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Hip replacement
              </button>
              <button
                onClick={() => setSelectedProcedureGroup('Knee Replacement')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold   transition-all cursor-pointer ${
                  selectedProcedureGroup === 'Knee Replacement'
                    ? 'bg-accent text-ink '
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                Knee replacement
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Geo wait times bar chart */}
            <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-xs text-ink mb-1">
                  Active Regional Wait Times (90th Percentile)
                </h4>
                <p className="text-[10px] text-ink-2 mb-4">
                  Shows referral-to-consult (Wait 1) and decision-to-surgery (Wait 2) durations in days by Alberta municipality.
                </p>
              </div>

              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orthopedicData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="geography" tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 9 }} stroke="oklch(0.28 0.02 255)" />
                    <YAxis tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" unit="d" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', pt: 10 }} />
                    <Bar dataKey="consult_wait_days_90th" name="Wait 1: Consult Wait (Days)" fill="oklch(0.68 0.13 252)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="surgery_wait_days_90th" name="Wait 2: Surgery Wait (Days)" fill="oklch(0.82 0.12 85)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Ortho side metrics panel */}
            <div className="bg-surface border border-line rounded-xl p-4 space-y-4">
              <div>
                <span className="text-[9px] text-warn font-semibold">Registry Insights</span>
                <h4 className="font-semibold text-sm text-ink mt-0.5">Regional Volume Splits</h4>
                <p className="text-[10px] text-ink-2 leading-normal mt-1">
                  Orthopedic joint waitlists are highly concentrated in urban medical centers. Secondary private/chartered clinics are contracted to perform day-surgery joint reconstructions.
                </p>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {orthopedicData.map((record, idx) => (
                  <div key={idx} className="p-2 bg-paper border border-line rounded-xl flex items-center justify-between text-[11px]">
                    <div>
                      <span className="font-semibold text-ink block">{record.geography}</span>
                      <span className="text-[9px] text-ink-3 font-mono">Completed cases: {record.count_completed}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-accent font-semibold block">{record.longest_10_days} Days</span>
                      <span className="text-[8.5px] text-ink-3 font-semibold">90% Seen Within</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Historical Trends area chart (2015-2026) */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5">
            <div className="space-y-1 mb-5">
              <h4 className="font-semibold text-xs text-ink">
                Provincial Decadal Wait Trends (2015 - 2026)
              </h4>
              <p className="text-[10px] text-ink-2">
                Sourced from <strong>CIHI priority procedure tables</strong>. Traces the median wait time in weeks over a ten-year horizon, showing the impact of pandemic delays and subsequent recoveries.
              </p>
            </div>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={HISTORICAL_WAIT_TRENDS}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="colorHip" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.68 0.13 252)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorKnee" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.82 0.12 85)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCataract" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(0.78 0.12 155)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                  <XAxis dataKey="year" tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" />
                  <YAxis tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" unit="w" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', pt: 10 }} />
                  <Area type="monotone" dataKey="hip_replacement_median" name="Hip Replacement Wait (Wks)" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHip)" strokeWidth={2} />
                  <Area type="monotone" dataKey="knee_replacement_median" name="Knee Replacement Wait (Wks)" stroke="#a78bfa" fillOpacity={1} fill="url(#colorKnee)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cataract_surgery_median" name="Cataract Surgery Wait (Wks)" stroke="#10b981" fillOpacity={1} fill="url(#colorCataract)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: HEAD-TO-HEAD COMPARISONS --- */}
      {activeSubTab === 'comparisons' && (
        <div className="space-y-8">
          
          {/* COMPARISON BLOCK 1: FACILITY TO FACILITY — estimated ops metrics only when upstream present */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Building2 className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-semibold text-sm text-ink">Facility Head-to-Head</h3>
                <p className="text-[10px] text-ink-2">Operational facility comparison (OR utilization / waitlist) is only shown when a verified upstream provides rows.</p>
              <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="FACILITY_COMPARISONS" />
              </div>
            </div>

            {FACILITY_COMPARISONS.length === 0 ? (
              <p className="text-[11px] text-ink-2 leading-relaxed p-3 bg-paper border border-line rounded-xl">
                Facility comparison metrics (OR utilization, completed volume, waitlists) were estimated and are not displayed. Use Power BI surgical records and ABJHI orthopedic rows when available.
              </p>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Facility A</label>
                <select
                  value={compFacilityA}
                  onChange={(e) => setCompFacilityA(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {FACILITY_COMPARISONS.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>{f.name} ({f.city})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Facility B</label>
                <select
                  value={compFacilityB}
                  onChange={(e) => setCompFacilityB(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {FACILITY_COMPARISONS.map(f => (
                    <option key={f.facility_id} value={f.facility_id}>{f.name} ({f.city})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Matrix Table */}
            {facAData && facBData && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-paper p-4 border border-line rounded-xl">
                {/* Facility A Stats */}
                <div className="space-y-4">
                  <div className="space-y-1 text-center md:text-left">
                    <span className="px-1.5 py-0.5 bg-accent-soft border border-accent text-accent rounded text-[9px] font-mono">
                      {facAData.zone}
                    </span>
                    <h4 className="font-semibold text-sm text-ink mt-1">{facAData.name}</h4>
                    <p className="text-[10px] text-ink-2">{facAData.city}, AB</p>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-surface border border-line p-2.5 rounded-xl">
                      <span className="text-[9px] text-ink-2 block">OR Efficiency</span>
                      <span className="text-ink font-semibold text-lg font-mono">{facAData.or_utilization}%</span>
                    </div>
                    <div className="bg-surface border border-line p-2.5 rounded-xl">
                      <span className="text-[9px] text-ink-2 block">Completed (This Month)</span>
                      <span className="text-ink font-semibold text-lg font-mono">{facAData.completed_this_month}</span>
                    </div>
                  </div>
                </div>

                {/* Comparison Center Scale */}
                <div className="space-y-3 px-2 border-y md:border-y-0 md:border-x border-line py-4 md:py-0">
                  <span className="text-[9.5px] text-ink-3 font-semibold text-center block mb-2">Performance Metrics</span>
                  
                  {/* OR Progress Comparison */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-accent font-semibold">{facAData.or_utilization}%</span>
                      <span className="text-ink-2">OR utilization</span>
                      <span className="text-ok font-semibold">{facBData.or_utilization}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full flex overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${(facAData.or_utilization / (facAData.or_utilization + facBData.or_utilization)) * 100}%` }}></div>
                      <div className="bg-ok h-full" style={{ width: `${(facBData.or_utilization / (facAData.or_utilization + facBData.or_utilization)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Active Waitlist Progress */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-accent font-semibold">{facAData.active_waitlist}</span>
                      <span className="text-ink-2">Active Waitlist Volume</span>
                      <span className="text-ok font-semibold">{facBData.active_waitlist}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full flex overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${(facAData.active_waitlist / (facAData.active_waitlist + facBData.active_waitlist)) * 100}%` }}></div>
                      <div className="bg-ok h-full" style={{ width: `${(facBData.active_waitlist / (facAData.active_waitlist + facBData.active_waitlist)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Ortho Wait times */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-accent font-semibold">{facAData.ortho_wait_90th_days ? `${facAData.ortho_wait_90th_days}d` : 'N/A'}</span>
                      <span className="text-ink-2">90th% Ortho Wait</span>
                      <span className="text-ok font-semibold">{facBData.ortho_wait_90th_days ? `${facBData.ortho_wait_90th_days}d` : 'N/A'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full flex overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${(facAData.ortho_wait_90th_days / (facAData.ortho_wait_90th_days + facBData.ortho_wait_90th_days)) * 100}%` }}></div>
                      <div className="bg-ok h-full" style={{ width: `${(facBData.ortho_wait_90th_days / (facAData.ortho_wait_90th_days + facBData.ortho_wait_90th_days)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Cataract Wait times */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-accent font-semibold">{facAData.cataract_wait_90th_days ? `${facAData.cataract_wait_90th_days}d` : 'N/A'}</span>
                      <span className="text-ink-2">90th% Cataract Wait</span>
                      <span className="text-ok font-semibold">{facBData.cataract_wait_90th_days ? `${facBData.cataract_wait_90th_days}d` : 'N/A'}</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full flex overflow-hidden">
                      <div className="bg-accent h-full" style={{ width: `${(facAData.cataract_wait_90th_days / (facAData.cataract_wait_90th_days + facBData.cataract_wait_90th_days)) * 100}%` }}></div>
                      <div className="bg-ok h-full" style={{ width: `${(facBData.cataract_wait_90th_days / (facAData.cataract_wait_90th_days + facBData.cataract_wait_90th_days)) * 100}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Facility B Stats */}
                <div className="space-y-4 text-center md:text-right">
                  <div className="space-y-1">
                    <span className="px-1.5 py-0.5 bg-ok-soft border border-ok text-ok rounded text-[9px] font-mono">
                      {facBData.zone}
                    </span>
                    <h4 className="font-semibold text-sm text-ink mt-1">{facBData.name}</h4>
                    <p className="text-[10px] text-ink-2">{facBData.city}, AB</p>
                  </div>

                  <div className="space-y-2 text-left md:text-right">
                    <div className="bg-surface border border-line p-2.5 rounded-xl">
                      <span className="text-[9px] text-ink-2 block">OR Efficiency</span>
                      <span className="text-ink font-semibold text-lg font-mono">{facBData.or_utilization}%</span>
                    </div>
                    <div className="bg-surface border border-line p-2.5 rounded-xl">
                      <span className="text-[9px] text-ink-2 block">Completed (This Month)</span>
                      <span className="text-ink font-semibold text-lg font-mono">{facBData.completed_this_month}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
            )}
          </div>

          {/* COMPARISON BLOCK 2: SPECIALIST TO SPECIALIST */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <User className="w-5 h-5 text-accent" />
              <div>
                <h3 className="font-semibold text-sm text-ink">Specialist Head-to-Head</h3>
                <p className="text-[10px] text-ink-2">Select any two surgical specialists to compare active referral wait queues and operating times.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Specialist A</label>
                <select
                  value={compSpecialistA}
                  onChange={(e) => setCompSpecialistA(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {SPECIALIST_COMPARISONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Specialist B</label>
                <select
                  value={compSpecialistB}
                  onChange={(e) => setCompSpecialistB(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {SPECIALIST_COMPARISONS.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.specialty})</option>
                  ))}
                </select>
              </div>
            </div>

            {SPECIALIST_COMPARISONS.length === 0 && (
              <div className="bg-paper border border-line p-6 text-center rounded-xl">
                <AlertTriangle className="w-6 h-6 text-warn mx-auto mb-2" />
                <p className="text-xs text-ink-2">Specialist comparison profiles are not available in the live surgical dataset yet.</p>
              </div>
            )}

            {specAData && specBData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Specialist A */}
                <div className="bg-surface p-4 border border-accent rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-semibold text-accent">{specAData.specialty}</span>
                      <h4 className="font-semibold text-base text-ink">{specAData.name}</h4>
                      <p className="text-[10.5px] text-ink-2">{specAData.facility}</p>
                    </div>
                    <span className="text-xs text-ink-3 font-mono">ID: {specAData.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Wait 1 (Consult)</span>
                      <span className="text-accent font-semibold text-sm">{specAData.wait1_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Wait 2 (Surgery)</span>
                      <span className="text-accent font-semibold text-sm">{specAData.wait2_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Surgical Volume (3m)</span>
                      <span className="text-ink font-semibold">{specAData.volume_3m} Cases</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Patient Satisfaction</span>
                      <span className="text-ok font-semibold">{specAData.patient_satisfaction}% Rating</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Experience</span>
                      <span className="text-ink font-semibold">{specAData.experience_years} Years</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Avg Surgery Time</span>
                      <span className="text-warn font-semibold">{specAData.avg_surgery_time_mins} Mins</span>
                    </div>
                  </div>
                </div>

                {/* Card Specialist B */}
                <div className="bg-surface p-4 border border-ok rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-semibold text-ok">{specBData.specialty}</span>
                      <h4 className="font-semibold text-base text-ink">{specBData.name}</h4>
                      <p className="text-[10.5px] text-ink-2">{specBData.facility}</p>
                    </div>
                    <span className="text-xs text-ink-3 font-mono">ID: {specBData.id}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Wait 1 (Consult)</span>
                      <span className="text-accent font-semibold text-sm">{specBData.wait1_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Wait 2 (Surgery)</span>
                      <span className="text-accent font-semibold text-sm">{specBData.wait2_days_90th} Days</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Surgical Volume (3m)</span>
                      <span className="text-ink font-semibold">{specBData.volume_3m} Cases</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Patient Satisfaction</span>
                      <span className="text-ok font-semibold">{specBData.patient_satisfaction}% Rating</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Experience</span>
                      <span className="text-ink font-semibold">{specBData.experience_years} Years</span>
                    </div>
                    <div className="p-2 bg-surface rounded-xl border border-line">
                      <span className="text-[8.5px] text-ink-2 block font-sans">Avg Surgery Time</span>
                      <span className="text-warn font-semibold">{specBData.avg_surgery_time_mins} Mins</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* COMPARISON BLOCK 3: PROCEDURE TO PROCEDURE */}
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Sparkles className="w-5 h-5 text-ok" />
              <div>
                <h3 className="font-semibold text-sm text-ink">Procedure Target Benchmarking</h3>
                <p className="text-[10px] text-ink-2">Compare clinical timelines and targets between core procedures side-by-side.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Procedure A</label>
                <select
                  value={compProcedureA}
                  onChange={(e) => setCompProcedureA(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {provincial90thOptions.map(p => (
                    <option key={p.procedure_name} value={p.procedure_name}>{p.procedure_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-ink-2 font-semibold block mb-1">Procedure B</label>
                <select
                  value={compProcedureB}
                  onChange={(e) => setCompProcedureB(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                >
                  {provincial90thOptions.map(p => (
                    <option key={p.procedure_name} value={p.procedure_name}>{p.procedure_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {procAData && procBData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-paper p-4 border border-line rounded-xl text-xs">
                <div className="space-y-3">
                  <h4 className="font-semibold text-ink">{procAData.procedure_name}</h4>
                  <div className="space-y-1 bg-surface border border-line p-3 rounded-xl font-mono">
                    <div className="flex justify-between">
                      <span className="text-ink-2">90th Percentile Wait:</span>
                      <span className="text-accent font-semibold">{procAData.metric_value} weeks</span>
                    </div>
                    <div className="flex justify-between border-t border-line mt-1 pt-1">
                      <span className="text-ink-2">National Benchmark:</span>
                      <span className="text-ink italic">{procAData.benchmark_value || 'None Established'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-ink">{procBData.procedure_name}</h4>
                  <div className="space-y-1 bg-surface border border-line p-3 rounded-xl font-mono">
                    <div className="flex justify-between">
                      <span className="text-ink-2">90th Percentile Wait:</span>
                      <span className="text-accent font-semibold">{procBData.metric_value} weeks</span>
                    </div>
                    <div className="flex justify-between border-t border-line mt-1 pt-1">
                      <span className="text-ink-2">National Benchmark:</span>
                      <span className="text-ink italic">{procBData.benchmark_value || 'None Established'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: STATSCAN PATIENT ACCESS SURVEY --- */}
      {activeSubTab === 'statscan' && (
        <div className="space-y-6">
          <div className="p-4 bg-accent-soft border border-accent rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-ink">
                {hasStatsCanSatisfaction
                  ? (STATSCAN_SATISFACTION_STATS.reporting_title || 'Statistics Canada Specialist Access Survey')
                  : 'Statistics Canada Specialist Access Survey'}
              </h4>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                {hasStatsCanSatisfaction
                  ? 'Patient-reported outcomes on medical specialist initial consultation access. Prolonged waiting represents a bottleneck prior to decision-for-surgery scheduling.'
                  : 'Patient-reported specialist-access satisfaction metrics stay withheld until a verified StatsCan table extract with field-level provenance is wired. Zero placeholders from the fail-closed satisfaction object are not treated as survey results.'}
              </p>
              {hasStatsCanSatisfaction && (
                <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="STATSCAN_SATISFACTION_STATS" />
              )}
            </div>
          </div>

          {!hasStatsCanSatisfaction ? (
            <div className="bg-surface border border-line rounded-xl p-6 sm:p-8 text-center space-y-3">
              <AlertTriangle className="w-6 h-6 text-warn mx-auto" />
              <p className="text-sm font-semibold text-ink">StatsCan patient satisfaction unavailable</p>
              <p className="text-xs text-ink-2 max-w-2xl mx-auto leading-relaxed">
                Statistics Canada specialist-access satisfaction percentages, wait-segment shares, and life-impact rates are not shown until a table-backed fetch with field-level provenance is wired. The pipeline fails closed with an empty satisfaction object; zero placeholders are withheld rather than rendered as observed survey outcomes.
              </p>
              <p className="text-[10px] text-ink-3 max-w-xl mx-auto leading-relaxed">
                Expected source: Statistics Canada Health Care Access Survey / specialist consultation wait modules (typically annual or multi-year release cadence). Handwritten snapshot percentages have been removed.
              </p>
              <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="STATSCAN_SATISFACTION_STATS" />
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pie Chart Satisfaction */}
            <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col items-center justify-between">
              <div className="w-full text-left">
                <h4 className="font-semibold text-xs text-ink mb-0.5">
                  Satisfaction with wait times
                </h4>
                <p className="text-[9.5px] text-ink-2 mb-4">Percentage representing patient experience scores for specialist consult referral periods.</p>
              </div>

              <div className="h-[200px] w-full flex justify-center items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={satisfactionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {satisfactionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full space-y-1 pt-4 border-t border-line text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-ok"></div>
                    <span className="text-ink">Satisfied with Wait</span>
                  </div>
                  <span className="font-semibold text-ok">{STATSCAN_SATISFACTION_STATS.metrics_alberta.satisfied_with_wait}%</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-crit"></div>
                    <span className="text-ink">Unsatisfied / Highly frustrated</span>
                  </div>
                  <span className="font-semibold text-crit">{STATSCAN_SATISFACTION_STATS.metrics_alberta.unsatisfied_with_wait}%</span>
                </div>
              </div>
            </div>

            {/* Wait Bracket Distribution Chart */}
            <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-semibold text-xs text-ink mb-0.5">
                  Access Wait duration breakdown (Days/Months)
                </h4>
                <p className="text-[9.5px] text-ink-2 mb-4">Survey respondents reported times spanning the referral date to active specialist assessment.</p>
              </div>

              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={STATSCAN_SATISFACTION_STATS.metrics_alberta.waiting_segment_distribution}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" />
                    <XAxis dataKey="segment" tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 9 }} stroke="oklch(0.28 0.02 255)" />
                    <YAxis tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 10 }} stroke="oklch(0.28 0.02 255)" unit="%" />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'oklch(0.2 0.022 255)', border: '1px solid oklch(0.28 0.02 255)', borderRadius: '8px' }} itemStyle={{ color: 'oklch(0.96 0.008 255)' }} labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                    />
                    <Bar dataKey="value" name="Patients Proportion (%)" fill="oklch(0.82 0.12 85)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-between text-[10px] text-ink-3">
                <span>
                  {STATSCAN_SATISFACTION_STATS.reporting_title || 'Statistics Canada specialist access survey'}
                </span>
                <span>{STATSCAN_SATISFACTION_STATS.survey_period || 'Release pending provenance'}</span>
              </div>
            </div>
          </div>
          )}

          {/* Demographic filters cuts — only when upstream rows exist */}
          {STATSCAN_DEMOGRAPHICS.length === 0 ? (
            <div className="bg-surface border border-line rounded-xl p-5 space-y-2">
              <h4 className="font-semibold text-xs text-ink">Demographic Cuts & Life Impact Indicators</h4>
              <p className="text-[11px] text-ink-2 leading-relaxed">
                Demographic survey cuts are unavailable. No verified StatsCan demographic break rows are loaded; satisfaction and life-impact percentages by age, gender, or referral pathway are withheld.
              </p>
              <DataTimestamp compact variant="light" metadata={metadata ?? undefined} arrayKey="STATSCAN_DEMOGRAPHICS" />
            </div>
          ) : (
          <div className="bg-surface border border-line rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-line pb-3">
              <div>
                <h4 className="font-semibold text-xs text-ink">Demographic Cuts & Life Impact Indicators</h4>
                <p className="text-[10.5px] text-ink-2">Filter demographic survey outcomes by Age, Gender, and GP Referral pathways.</p>
              </div>

              <div className="flex items-center gap-1.5 bg-paper p-1 border border-line rounded-xl">
                {['All', 'Age', 'Gender', 'Referral Type'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setStatscanCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-[9.5px] font-semibold   transition-colors cursor-pointer ${
                      (cat === 'All' && statscanCategoryFilter === 'All') || statscanCategoryFilter === cat
                        ? 'bg-accent text-ink '
                        : 'text-ink-2 hover:text-ink'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] text-ink-3">
                    <th className="py-2.5 px-3">Demographic segment</th>
                    <th className="py-2.5 px-3">Under 1 Month</th>
                    <th className="py-2.5 px-3">1 to 3 Months</th>
                    <th className="py-2.5 px-3">3 to 6 Months</th>
                    <th className="py-2.5 px-3">6 Months+</th>
                    <th className="py-2.5 px-3 text-center">Satisfaction Rate</th>
                    <th className="py-2.5 px-3 text-right">Severe Life Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatsCanDemographics.map((row, idx) => (
                    <tr key={idx} className="border-b border-line hover:bg-paper transition-all">
                      <td className="py-2.5 px-3 font-semibold text-ink">
                        <span className="text-[9px] text-ink-3 block">{row.category}</span>
                        {row.dimension}
                      </td>
                      <td className="py-2.5 px-3 text-ink-2 font-mono">{row.wait_under_1m}%</td>
                      <td className="py-2.5 px-3 text-ink-2 font-mono">{row.wait_1_to_3m}%</td>
                      <td className="py-2.5 px-3 text-ink-2 font-mono">{row.wait_3_to_6m}%</td>
                      <td className="py-2.5 px-3 text-ink-2 font-mono font-semibold text-warn">{row.wait_over_6m}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-ok-soft border border-ok text-ok font-semibold font-mono">
                          {row.satisfied_percentage}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-accent font-mono">{row.life_affected_percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}

    </div>
  );
}

// Simple CN helper
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
