import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  MapPin, 
  Search, 
  Info, 
  ChevronRight, 
  ShieldAlert, 
  Users, 
  DollarSign, 
  GraduationCap, 
  Heart, 
  AlertTriangle, 
  Building2, 
  Compass, 
  Activity, 
  ArrowRightLeft,
  ArrowRight,
  Eye,
  FileSpreadsheet,
  Layers,
  HeartPulse,
  ActivitySquare,
  Sparkles,
  BarChart3,
  CheckCircle,
  HelpCircle,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  Cell
} from 'recharts';
import type {
  CommunityNeedMetric,
  ChronicDiseaseBurden,
  EDRelianceMetric,
  TravelForCare,
  ServiceAccessMetric,
} from '../regionalInequityData';
import * as regionalInequityData from '../regionalInequityData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';
type RegionalInequityData = {
  COMMUNITY_NEED_PROFILES: CommunityNeedMetric[];
  CHRONIC_DISEASE_BURDEN: ChronicDiseaseBurden[];
  ED_RELIANCE_METRICS: EDRelianceMetric[];
  TRAVEL_FOR_CARE?: TravelForCare[];
  SERVICE_ACCESS_METRICS?: ServiceAccessMetric[];
};

const defaultNeed: CommunityNeedMetric = {
  lgaName: 'Loading...',
  zone: 'Calgary Zone',
  type: 'Urban Hub',
  physiciansPer100k: 0,
  claimsOutsideLgaPct: 0,
  acscRatePer100k: 0,
  deprivationIndex: 1,
  medianHouseholdIncome: 0,
  highSchoolGradPct: 0
};

const defaultDisease: ChronicDiseaseBurden = {
  lgaName: 'Loading...',
  diabetesPrevalencePct: 0,
  copdPrevalencePct: 0,
  hypertensionPrevalencePct: 0,
  infantMortalityPer1000: 0,
  lifeExpectancyYears: 0
};

const defaultEd: EDRelianceMetric = {
  lgaName: 'Loading...',
  totalEdVisitsPer1000: 0,
  lowAcuityCtas45Pct: 0,
  afterHoursEdPct: 0,
  moodAnxietyEdRatePer100k: 0
};

const defaultTravel: TravelForCare = {
  lgaName: 'Loading...',
  careDeliveredOutsideLgaPct: 0,
  topDestinationFacility: 'None',
  avgTravelDistanceKm: 0,
  localBedLeakagePct: 0
};

const defaultAccess: ServiceAccessMetric = {
  lgaName: 'Loading...',
  facilitiesPer10k: 0,
  distanceToNearestEdKm: 0,
  distanceToNearestImagingKm: 0,
  providersAcceptingPatients: 0
};

/** Treat 0 / null / undefined / NaN as missing for fail-closed display. */
function hasMetric(value: number | null | undefined): value is number {
  return typeof value === 'number' && !Number.isNaN(value) && value !== 0;
}

function formatMetric(
  value: number | null | undefined,
  opts?: { digits?: number; suffix?: string; prefix?: string },
): string {
  if (!hasMetric(value)) return 'N/A';
  const digits = opts?.digits ?? 1;
  const body = Number.isInteger(value) && digits === 0
    ? String(value)
    : value.toFixed(digits);
  return `${opts?.prefix ?? ''}${body}${opts?.suffix ?? ''}`;
}

export default function RegionalInequityDashboard() {
  // Live data fetched from /api/data/regional-inequity — no client-side estimation.
  const { data, metadata, isLoading, error, refresh } = useDomainData<RegionalInequityData>('regional-inequity', regionalInequityData);

  // Pass through only upstream-mapped arrays. Never invent claims/income/education/ED/travel/access values.
  const COMMUNITY_NEED_PROFILES = data?.COMMUNITY_NEED_PROFILES ?? [];
  const CHRONIC_DISEASE_BURDEN = data?.CHRONIC_DISEASE_BURDEN ?? [];
  const ED_RELIANCE_METRICS = data?.ED_RELIANCE_METRICS ?? [];
  // Travel / service-access stay empty until a real upstream writer exists.
  const TRAVEL_FOR_CARE = data?.TRAVEL_FOR_CARE ?? [];
  const SERVICE_ACCESS_METRICS = data?.SERVICE_ACCESS_METRICS ?? [];
  const hasTravelAccessData = TRAVEL_FOR_CARE.length > 0 && SERVICE_ACCESS_METRICS.length > 0;

  // Provincial means are computed only from non-zero upstream values so zero-padded
  // "not published" fields never look like a real provincial average of zero.
  const PROVINCIAL_BENCHMARKS = useMemo(() => {
    const mean = (vals: number[], digits = 1): number => {
      const usable = vals.filter((v) => typeof v === 'number' && !Number.isNaN(v) && v !== 0);
      if (usable.length === 0) return 0;
      const avg = usable.reduce((a, b) => a + b, 0) / usable.length;
      const factor = 10 ** digits;
      return Math.round(avg * factor) / factor;
    };
    if (COMMUNITY_NEED_PROFILES.length === 0) {
      return {
        medianHouseholdIncome: 0, physiciansPer100k: 0, claimsOutsideLgaPct: 0, acscRatePer100k: 0,
        highSchoolGradPct: 0, deprivationIndex: 0, diabetesPrevalencePct: 0, copdPrevalencePct: 0,
        hypertensionPrevalencePct: 0, infantMortalityPer1000: 0, lifeExpectancyYears: 0,
        totalEdVisitsPer1000: 0, lowAcuityCtas45Pct: 0, afterHoursEdPct: 0, moodAnxietyEdRatePer100k: 0,
        careDeliveredOutsideLgaPct: 0, avgTravelDistanceKm: 0, localBedLeakagePct: 0,
        facilitiesPer10k: 0, distanceToNearestEdKm: 0, distanceToNearestImagingKm: 0, providersAcceptingPatients: 0,
      };
    }
    return {
      // Income / education are not published in Table 10.1 — stay 0 unless a real feed lands.
      medianHouseholdIncome: mean(COMMUNITY_NEED_PROFILES.map((p) => p.medianHouseholdIncome), 0),
      physiciansPer100k: mean(COMMUNITY_NEED_PROFILES.map((p) => p.physiciansPer100k), 1),
      claimsOutsideLgaPct: mean(COMMUNITY_NEED_PROFILES.map((p) => p.claimsOutsideLgaPct), 1),
      acscRatePer100k: mean(COMMUNITY_NEED_PROFILES.map((p) => p.acscRatePer100k), 0),
      highSchoolGradPct: mean(COMMUNITY_NEED_PROFILES.map((p) => p.highSchoolGradPct), 1),
      deprivationIndex: mean(COMMUNITY_NEED_PROFILES.map((p) => p.deprivationIndex), 1),

      diabetesPrevalencePct: mean(CHRONIC_DISEASE_BURDEN.map((d) => d.diabetesPrevalencePct), 2),
      copdPrevalencePct: mean(CHRONIC_DISEASE_BURDEN.map((d) => d.copdPrevalencePct), 2),
      hypertensionPrevalencePct: mean(CHRONIC_DISEASE_BURDEN.map((d) => d.hypertensionPrevalencePct), 2),
      infantMortalityPer1000: mean(CHRONIC_DISEASE_BURDEN.map((d) => d.infantMortalityPer1000), 2),
      lifeExpectancyYears: mean(CHRONIC_DISEASE_BURDEN.map((d) => d.lifeExpectancyYears), 1),

      totalEdVisitsPer1000: mean(ED_RELIANCE_METRICS.map((e) => e.totalEdVisitsPer1000), 0),
      lowAcuityCtas45Pct: mean(ED_RELIANCE_METRICS.map((e) => e.lowAcuityCtas45Pct), 1),
      afterHoursEdPct: mean(ED_RELIANCE_METRICS.map((e) => e.afterHoursEdPct), 1),
      moodAnxietyEdRatePer100k: mean(ED_RELIANCE_METRICS.map((e) => e.moodAnxietyEdRatePer100k), 0),

      careDeliveredOutsideLgaPct: mean(TRAVEL_FOR_CARE.map((t) => t.careDeliveredOutsideLgaPct), 1),
      avgTravelDistanceKm: mean(TRAVEL_FOR_CARE.map((t) => t.avgTravelDistanceKm), 1),
      localBedLeakagePct: mean(TRAVEL_FOR_CARE.map((t) => t.localBedLeakagePct), 1),

      facilitiesPer10k: mean(SERVICE_ACCESS_METRICS.map((s) => s.facilitiesPer10k), 2),
      distanceToNearestEdKm: mean(SERVICE_ACCESS_METRICS.map((s) => s.distanceToNearestEdKm), 1),
      distanceToNearestImagingKm: mean(SERVICE_ACCESS_METRICS.map((s) => s.distanceToNearestImagingKm), 1),
      providersAcceptingPatients: mean(SERVICE_ACCESS_METRICS.map((s) => s.providersAcceptingPatients), 0),
    };
  }, [COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, ED_RELIANCE_METRICS, TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS]);
  const [activeSubTab, setActiveSubTab] = useState<'lga-needs' | 'disease-burden' | 'ed-reliance' | 'access-travel' | 'compare-matrix' | 'data-explorer'>('lga-needs');
  
  // Search and selection states
  const [lgaSearch, setLgaSearch] = useState<string>('');
  const [selectedLgaDetail, setSelectedLgaDetail] = useState<string>('Wood Buffalo / Fort McKay');
  
  // Comparison state
  const [comparisonTarget, setComparisonTarget] = useState<string>('Provincial Average');

  // Explorer active category state
  const [explorerCategory, setExplorerCategory] = useState<'all' | 'socioeconomics' | 'chronic' | 'ed' | 'access'>('all');
  const [sortKey, setSortKey] = useState<string>('lgaName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const showLgaSidebar =
    activeSubTab !== 'compare-matrix' && activeSubTab !== 'data-explorer';

  // Filter lists based on search
  const filteredNeeds = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.filter(p => 
      p.lgaName.toLowerCase().includes(lgaSearch.toLowerCase()) ||
      p.zone.toLowerCase().includes(lgaSearch.toLowerCase())
    );
  }, [COMMUNITY_NEED_PROFILES, lgaSearch]);

  const selectedLgaNeed = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.find(p => p.lgaName === selectedLgaDetail) || COMMUNITY_NEED_PROFILES[0] || defaultNeed;
  }, [COMMUNITY_NEED_PROFILES, selectedLgaDetail]);

  const selectedLgaDisease = useMemo(() => {
    return CHRONIC_DISEASE_BURDEN.find(d => d.lgaName === selectedLgaDetail) || CHRONIC_DISEASE_BURDEN[0] || defaultDisease;
  }, [CHRONIC_DISEASE_BURDEN, selectedLgaDetail]);

  const selectedLgaEd = useMemo(() => {
    return ED_RELIANCE_METRICS.find(e => e.lgaName === selectedLgaDetail) || ED_RELIANCE_METRICS[0] || defaultEd;
  }, [ED_RELIANCE_METRICS, selectedLgaDetail]);

  const selectedLgaTravel = useMemo(() => {
    if (TRAVEL_FOR_CARE.length === 0) return null;
    return TRAVEL_FOR_CARE.find(t => t.lgaName === selectedLgaDetail) ?? null;
  }, [TRAVEL_FOR_CARE, selectedLgaDetail]);

  const selectedLgaAccess = useMemo(() => {
    if (SERVICE_ACCESS_METRICS.length === 0) return null;
    return SERVICE_ACCESS_METRICS.find(s => s.lgaName === selectedLgaDetail) ?? null;
  }, [SERVICE_ACCESS_METRICS, selectedLgaDetail]);

  // Combined full dataset of selected LGA
  const selectedFullData = useMemo(() => {
    return {
      ...selectedLgaNeed,
      ...selectedLgaDisease,
      ...selectedLgaEd,
      ...(selectedLgaTravel ?? {
        careDeliveredOutsideLgaPct: null as number | null,
        topDestinationFacility: null as string | null,
        avgTravelDistanceKm: null as number | null,
        localBedLeakagePct: null as number | null,
      }),
      ...(selectedLgaAccess ?? {
        facilitiesPer10k: null as number | null,
        distanceToNearestEdKm: null as number | null,
        distanceToNearestImagingKm: null as number | null,
        providersAcceptingPatients: null as number | null,
      }),
      lgaName: selectedLgaNeed.lgaName
    };
  }, [selectedLgaNeed, selectedLgaDisease, selectedLgaEd, selectedLgaTravel, selectedLgaAccess]);

  const zoneNeeds = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.filter(p => p.zone === selectedLgaNeed.zone);
  }, [COMMUNITY_NEED_PROFILES, selectedLgaNeed.zone]);

  const zoneChronic = useMemo(() => {
    const lgasInZone = new Set(zoneNeeds.map(p => p.lgaName));
    return CHRONIC_DISEASE_BURDEN.filter(d => lgasInZone.has(d.lgaName));
  }, [CHRONIC_DISEASE_BURDEN, zoneNeeds]);

  const zoneEd = useMemo(() => {
    const lgasInZone = new Set(zoneNeeds.map(p => p.lgaName));
    return ED_RELIANCE_METRICS.filter(e => lgasInZone.has(e.lgaName));
  }, [ED_RELIANCE_METRICS, zoneNeeds]);

  const zoneTravel = useMemo(() => {
    const lgasInZone = new Set(zoneNeeds.map(p => p.lgaName));
    return TRAVEL_FOR_CARE.filter(t => lgasInZone.has(t.lgaName));
  }, [TRAVEL_FOR_CARE, zoneNeeds]);
  // Combined full dataset of comparison target
  const comparisonFullData = useMemo(() => {
    if (comparisonTarget === 'Provincial Average') {
      return {
        lgaName: 'Provincial Average',
        zone: 'All Alberta Zones',
        type: 'Composite Benchmark',
        ...PROVINCIAL_BENCHMARKS
      };
    } else {
      const need = COMMUNITY_NEED_PROFILES.find(p => p.lgaName === comparisonTarget) || COMMUNITY_NEED_PROFILES[0] || defaultNeed;
      const disease = CHRONIC_DISEASE_BURDEN.find(d => d.lgaName === comparisonTarget) || CHRONIC_DISEASE_BURDEN[0] || defaultDisease;
      const ed = ED_RELIANCE_METRICS.find(e => e.lgaName === comparisonTarget) || ED_RELIANCE_METRICS[0] || defaultEd;
      const travel = TRAVEL_FOR_CARE.length > 0
        ? (TRAVEL_FOR_CARE.find(t => t.lgaName === comparisonTarget) ?? null)
        : null;
      const access = SERVICE_ACCESS_METRICS.length > 0
        ? (SERVICE_ACCESS_METRICS.find(s => s.lgaName === comparisonTarget) ?? null)
        : null;
      return {
        ...need,
        ...disease,
        ...ed,
        ...(travel ?? {
          careDeliveredOutsideLgaPct: null as number | null,
          topDestinationFacility: null as string | null,
          avgTravelDistanceKm: null as number | null,
          localBedLeakagePct: null as number | null,
        }),
        ...(access ?? {
          facilitiesPer10k: null as number | null,
          distanceToNearestEdKm: null as number | null,
          distanceToNearestImagingKm: null as number | null,
          providersAcceptingPatients: null as number | null,
        }),
        lgaName: need.lgaName
      };
    }
  }, [comparisonTarget, PROVINCIAL_BENCHMARKS, COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, ED_RELIANCE_METRICS, TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS]);

  // Radar scores use only non-zero upstream values, scaled against the max among
  // currently loaded LGAs (no hardcoded provincial standards or invented anchors).
  const radarChartData = useMemo(() => {
    const nonZero = (vals: Array<number | null | undefined>): number[] =>
      vals.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v) && v !== 0);

    const scaleHigherBetter = (
      val: number | null | undefined,
      pool: number[],
    ): number | null => {
      if (!hasMetric(val) || pool.length === 0) return null;
      const max = Math.max(...pool);
      if (max <= 0) return null;
      return Math.round((val / max) * 100);
    };

    const scaleLowerBetter = (
      val: number | null | undefined,
      pool: number[],
    ): number | null => {
      if (!hasMetric(val) || pool.length === 0) return null;
      const max = Math.max(...pool);
      if (max <= 0) return null;
      return Math.round((1 - val / max) * 100);
    };

    const physPool = nonZero(COMMUNITY_NEED_PROFILES.map((p) => p.physiciansPer100k));
    const incomePool = nonZero(COMMUNITY_NEED_PROFILES.map((p) => p.medianHouseholdIncome));
    const acscPool = nonZero(COMMUNITY_NEED_PROFILES.map((p) => p.acscRatePer100k));
    const claimsPool = nonZero(COMMUNITY_NEED_PROFILES.map((p) => p.claimsOutsideLgaPct));
    const edDistPool = nonZero(SERVICE_ACCESS_METRICS.map((s) => s.distanceToNearestEdKm));

    const axes = [
      {
        subject: 'Primary Care Density',
        selected: scaleHigherBetter(selectedFullData.physiciansPer100k, physPool),
        comparison: scaleHigherBetter(comparisonFullData.physiciansPer100k, physPool),
      },
      {
        subject: 'Socioeconomic Affluence',
        selected: scaleHigherBetter(selectedFullData.medianHouseholdIncome, incomePool),
        comparison: scaleHigherBetter(comparisonFullData.medianHouseholdIncome, incomePool),
      },
      {
        subject: 'Preventative Efficacy',
        selected: scaleLowerBetter(selectedFullData.acscRatePer100k, acscPool),
        comparison: scaleLowerBetter(comparisonFullData.acscRatePer100k, acscPool),
      },
      {
        subject: 'Emergency Proximity',
        selected: scaleLowerBetter(selectedFullData.distanceToNearestEdKm, edDistPool),
        comparison: scaleLowerBetter(comparisonFullData.distanceToNearestEdKm, edDistPool),
      },
      {
        subject: 'Care Retention',
        selected: scaleLowerBetter(selectedFullData.claimsOutsideLgaPct, claimsPool),
        comparison: scaleLowerBetter(comparisonFullData.claimsOutsideLgaPct, claimsPool),
      },
    ];

    return axes
      .filter((a) => a.selected != null || a.comparison != null)
      .map((a) => ({
        subject: a.subject,
        [selectedLgaDetail]: a.selected ?? 0,
        [comparisonTarget]: a.comparison ?? 0,
        fullMark: 100,
      }));
  }, [
    selectedLgaDetail,
    comparisonTarget,
    selectedFullData,
    comparisonFullData,
    COMMUNITY_NEED_PROFILES,
    SERVICE_ACCESS_METRICS,
  ]);

  // Combined full table array for All Data Explorer
  const fullCombinedDataset = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.map(p => {
      const disease = CHRONIC_DISEASE_BURDEN.find(d => d.lgaName === p.lgaName) || defaultDisease;
      const ed = ED_RELIANCE_METRICS.find(e => e.lgaName === p.lgaName) || defaultEd;
      const travel = TRAVEL_FOR_CARE.length > 0 ? TRAVEL_FOR_CARE.find(t => t.lgaName === p.lgaName) : null;
      const access = SERVICE_ACCESS_METRICS.length > 0 ? SERVICE_ACCESS_METRICS.find(s => s.lgaName === p.lgaName) : null;
      return {
        ...p,
        ...disease,
        ...ed,
        ...(travel ?? {
          careDeliveredOutsideLgaPct: null,
          topDestinationFacility: null,
          avgTravelDistanceKm: null,
          localBedLeakagePct: null,
        }),
        ...(access ?? {
          facilitiesPer10k: null,
          distanceToNearestEdKm: null,
          distanceToNearestImagingKm: null,
          providersAcceptingPatients: null,
        }),
        lgaName: p.lgaName
      };
    });
  }, [COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, ED_RELIANCE_METRICS, TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS]);

  // Sorted explorer dataset
  const sortedExplorerData = useMemo(() => {
    return [...fullCombinedDataset].sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });
  }, [fullCombinedDataset, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  // ----------------------------------------------------------------------------
  // DYNAMIC CASE STUDIES & INSIGHTS — only from real upstream numbers (no hardcoded standards)
  // ----------------------------------------------------------------------------
  const dynamicEquityCaseStudy = useMemo(() => {
    const phys = selectedFullData.physiciansPer100k;
    const claims = selectedFullData.claimsOutsideLgaPct;
    const acsc = selectedFullData.acscRatePer100k;
    const depriv = selectedFullData.deprivationIndex;
    const income = selectedFullData.medianHouseholdIncome;
    const grad = selectedFullData.highSchoolGradPct;
    const benchPhys = PROVINCIAL_BENCHMARKS.physiciansPer100k;
    const benchAcsc = PROVINCIAL_BENCHMARKS.acscRatePer100k;

    const parts: string[] = [];
    if (hasMetric(depriv)) {
      parts.push(`Deprivation index ${depriv.toFixed(2)} (upstream CIMD-style score).`);
    }
    if (hasMetric(income)) {
      parts.push(`Median household income $${income.toLocaleString()} (upstream).`);
    }
    if (hasMetric(grad)) {
      parts.push(`High school graduation ${grad}% (upstream).`);
    }
    if (parts.length === 0) {
      parts.push('Income, education, and deprivation detail are limited or zero-padded for this LGA; missing fields are not estimated.');
    }

    let infrastructure = 'Primary-care density and outward-claim metrics are unavailable for comparison.';
    if (hasMetric(phys) && hasMetric(benchPhys)) {
      const delta = phys - benchPhys;
      infrastructure = `Rostered family physicians: ${phys.toFixed(1)} per 100k vs mean of loaded LGAs ${benchPhys.toFixed(1)} per 100k (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}).`;
    } else if (hasMetric(phys)) {
      infrastructure = `Rostered family physicians: ${phys.toFixed(1)} per 100k (no non-zero provincial mean available from loaded rows).`;
    }
    if (hasMetric(claims)) {
      infrastructure += ` Outward primary-care claims: ${claims.toFixed(1)}%.`;
    }

    let downstreamEffect = 'Preventable ACSC admission rate is unavailable for this LGA.';
    if (hasMetric(acsc) && hasMetric(benchAcsc)) {
      downstreamEffect = `ACSC rate ${acsc.toFixed(1)} per 100k vs mean of loaded LGAs ${benchAcsc.toFixed(1)} per 100k.`;
    } else if (hasMetric(acsc)) {
      downstreamEffect = `ACSC rate ${acsc.toFixed(1)} per 100k (no non-zero provincial mean available from loaded rows).`;
    }

    return {
      title: `${selectedLgaDetail}: upstream community-need summary`,
      summary: parts.join(' '),
      infrastructure,
      downstreamEffect,
    };
  }, [selectedFullData, selectedLgaDetail, PROVINCIAL_BENCHMARKS]);

  const dynamicChronicDiseaseInsight = useMemo(() => {
    const life = selectedFullData.lifeExpectancyYears;
    const diabetes = selectedFullData.diabetesPrevalencePct;
    const copd = selectedFullData.copdPrevalencePct;
    const infant = selectedFullData.infantMortalityPer1000;
    const benchLife = PROVINCIAL_BENCHMARKS.lifeExpectancyYears;
    const benchDiabetes = PROVINCIAL_BENCHMARKS.diabetesPrevalencePct;
    const benchCopd = PROVINCIAL_BENCHMARKS.copdPrevalencePct;

    let expectancy = 'Life expectancy is unavailable (zero or missing upstream).';
    if (hasMetric(life) && hasMetric(benchLife)) {
      const delta = life - benchLife;
      expectancy = `Life expectancy ${life.toFixed(1)} years vs mean of loaded LGAs ${benchLife.toFixed(1)} years (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}).`;
    } else if (hasMetric(life)) {
      expectancy = `Life expectancy ${life.toFixed(1)} years (no non-zero provincial mean available from loaded rows).`;
    }

    const burdenBits: string[] = [];
    if (hasMetric(diabetes) && hasMetric(benchDiabetes)) {
      burdenBits.push(`diabetes ${diabetes.toFixed(1)}% vs mean ${benchDiabetes.toFixed(1)}%`);
    } else if (hasMetric(diabetes)) {
      burdenBits.push(`diabetes ${diabetes.toFixed(1)}%`);
    }
    if (hasMetric(copd) && hasMetric(benchCopd)) {
      burdenBits.push(`COPD ${copd.toFixed(1)}% vs mean ${benchCopd.toFixed(1)}%`);
    } else if (hasMetric(copd)) {
      burdenBits.push(`COPD ${copd.toFixed(1)}%`);
    }
    if (hasMetric(infant)) {
      burdenBits.push(`infant mortality ${infant.toFixed(1)} per 1,000 births`);
    }
    const burdenMultiplier = burdenBits.length > 0
      ? `Upstream chronic metrics: ${burdenBits.join('; ')}.`
      : 'Chronic prevalence and infant mortality are unavailable for this LGA; values are not estimated.';

    return { expectancy, burdenMultiplier };
  }, [selectedFullData, selectedLgaDetail, PROVINCIAL_BENCHMARKS]);

  const dynamicEdRelianceInsight = useMemo(() => {
    const visits = selectedFullData.totalEdVisitsPer1000;
    const lowAcuity = selectedFullData.lowAcuityCtas45Pct;
    const afterHours = selectedFullData.afterHoursEdPct;
    const mood = selectedFullData.moodAnxietyEdRatePer100k;
    const avgVisits = PROVINCIAL_BENCHMARKS.totalEdVisitsPer1000;
    const avgLow = PROVINCIAL_BENCHMARKS.lowAcuityCtas45Pct;
    const avgAfter = PROVINCIAL_BENCHMARKS.afterHoursEdPct;

    let reliance = 'ED visit rate is unavailable (zero or missing upstream).';
    if (hasMetric(visits) && hasMetric(avgVisits)) {
      const delta = visits - avgVisits;
      reliance = `ED visits ${visits.toFixed(1)} per 1,000 vs mean of loaded LGAs ${avgVisits.toFixed(1)} (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}).`;
    } else if (hasMetric(visits)) {
      reliance = `ED visits ${visits.toFixed(1)} per 1,000 (no non-zero provincial mean available from loaded rows).`;
    }

    const subBits: string[] = [];
    if (hasMetric(lowAcuity) && hasMetric(avgLow)) {
      subBits.push(`low-acuity CTAS 4/5 ${lowAcuity.toFixed(1)}% vs mean ${avgLow.toFixed(1)}%`);
    } else if (hasMetric(lowAcuity)) {
      subBits.push(`low-acuity CTAS 4/5 ${lowAcuity.toFixed(1)}%`);
    }
    if (hasMetric(afterHours) && hasMetric(avgAfter)) {
      subBits.push(`after-hours ED share ${afterHours.toFixed(1)}% vs mean ${avgAfter.toFixed(1)}%`);
    } else if (hasMetric(afterHours)) {
      subBits.push(`after-hours ED share ${afterHours.toFixed(1)}%`);
    }
    if (hasMetric(mood)) {
      subBits.push(`mood/anxiety ED ${mood.toFixed(1)} per 100k`);
    }
    const substitution = subBits.length > 0
      ? `Upstream ED composition: ${subBits.join('; ')}.`
      : 'Low-acuity, after-hours, and mental-health ED metrics are unavailable; values are not estimated.';

    return { reliance, substitution };
  }, [selectedFullData, selectedLgaDetail, PROVINCIAL_BENCHMARKS]);

  const dynamicAccessTravelInsight = useMemo(() => {
    const hasTravel = TRAVEL_FOR_CARE.length > 0 && selectedLgaTravel != null;
    const hasAccess = SERVICE_ACCESS_METRICS.length > 0 && selectedLgaAccess != null;
    if (!hasTravel && !hasAccess) {
      return {
        travel: 'Travel-for-care and facility-distance metrics are not published in the current Open Alberta LGA workbooks. Arrays stay empty; values are not estimated.',
        leakage: 'Inpatient bed leakage and outward travel distance require a dedicated TRAVEL_FOR_CARE upstream — currently unavailable.',
      };
    }
    const dist = selectedLgaTravel?.avgTravelDistanceKm;
    const dest = selectedLgaTravel?.topDestinationFacility;
    const leak = selectedLgaTravel?.localBedLeakagePct;
    return {
      travel: hasMetric(dist)
        ? `Average travel distance ${dist.toFixed(1)} km${dest ? `; top destination ${dest}` : ''}.`
        : 'Average travel distance is unavailable for this LGA.',
      leakage: hasMetric(leak)
        ? `Local inpatient bed leakage ${leak.toFixed(1)}%.`
        : 'Bed leakage rate is unavailable for this LGA.',
    };
  }, [TRAVEL_FOR_CARE.length, SERVICE_ACCESS_METRICS.length, selectedLgaTravel, selectedLgaAccess]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading regional inequity data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load regional inequity data: {error}</span>
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

  // Fail closed when no upstream LGA arrays are present (empty payload / failed sync).
  if (COMMUNITY_NEED_PROFILES.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          icon={MapPin}
          title="Health Inequity & Community Need"
          description="Open Alberta LGA community profiles only. Travel/access and unpublished income fields stay empty until a verified upstream exists."
          metadata={metadata ?? undefined}
          arrayKey="COMMUNITY_NEED_PROFILES"
        />
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl text-sm text-slate-400">
          No verified community-need, chronic-disease, or ED-reliance rows are available. Values are not estimated.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={MapPin}
        title="Health Inequity & Community Need"
        description="Analyze geographic disparities, chronic disease burden, and care travel patterns."
        metadata={metadata ?? undefined}
        arrayKey="COMMUNITY_NEED_PROFILES"
      />

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('lga-needs')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'lga-needs'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Community Profile</span>
        </button>
        <button
          onClick={() => setActiveSubTab('disease-burden')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'disease-burden'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Disease Burden</span>
        </button>
        <button
          onClick={() => setActiveSubTab('ed-reliance')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ed-reliance'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ED Reliance</span>
        </button>
        {hasTravelAccessData && (
        <button
          onClick={() => setActiveSubTab('access-travel')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'access-travel'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Travel For Care</span>
        </button>
        )}
        <button
          onClick={() => setActiveSubTab('compare-matrix')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'compare-matrix'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Compare Matrix</span>
        </button>
        <button
          onClick={() => setActiveSubTab('data-explorer')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'data-explorer'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Data Explorer</span>
        </button>
      </div>

      {/* Subtab-specific context (Cycle of Disparity only on Community Profile) */}
      {activeSubTab === 'lga-needs' && (
      <div id="ri-narrative-callout" className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
            <span>Community socioeconomic profile</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong>Cycle of disparity:</strong> Deprivation and primary-care attachment gaps in this LGA shape downstream ED reliance and travel-for-care burdens shown in other subtabs.
          </p>
        </div>
        <span className="text-[10px] bg-rose-500/10 border border-rose-500/25 text-rose-400 px-3 py-1.5 rounded-lg font-mono font-bold tracking-widest shrink-0 self-start md:self-center">
          LGA PROFILE
        </span>
      </div>
      )}
      {activeSubTab === 'disease-burden' && (
      <div id="ri-narrative-callout" className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <HeartPulse className="w-4.5 h-4.5 text-orange-400" />
            <span>Chronic disease burden</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Prevalence and outcome metrics for the selected LGA — diabetes, COPD, hypertension, infant mortality, and life expectancy vs provincial benchmarks.
          </p>
        </div>
      </div>
      )}
      {activeSubTab === 'ed-reliance' && (
      <div id="ri-narrative-callout" className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4.5 h-4.5 text-amber-400" />
            <span>Emergency department reliance</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Low-acuity CTAS 4–5 visits and after-hours ED use often signal primary-care access gaps rather than true emergencies.
          </p>
        </div>
      </div>
      )}
      {activeSubTab === 'access-travel' && (
      <div id="ri-narrative-callout" className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4.5 h-4.5 text-cyan-400" />
            <span>Travel and local access</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Share of care delivered outside the home LGA, typical travel distance, and leakage of staffed beds to regional hubs.
          </p>
        </div>
      </div>
      )}

      <div className={`grid gap-6 ${showLgaSidebar ? 'grid-cols-1 xl:grid-cols-4' : 'grid-cols-1'}`}>
        
        {showLgaSidebar && (
        <div className="bg-[#0b1226] border border-slate-800 rounded-2xl p-5 space-y-4 xl:col-span-1 shadow-md">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">LGA Selection Navigator</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Select a representative local geographic area to focus</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search LGA or Zone..."
              value={lgaSearch}
              onChange={(e) => setLgaSearch(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition-colors font-medium"
            />
          </div>

          <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
            {filteredNeeds.map((lga, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedLgaDetail(lga.lgaName)}
                className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                  selectedLgaDetail === lga.lgaName
                    ? 'bg-rose-500/10 border-rose-500/35 text-white'
                    : 'bg-slate-950/40 border-slate-800/40 text-slate-400 hover:border-slate-800 hover:text-slate-200 hover:bg-slate-950/80'
                }`}
              >
                <div className="space-y-0.5 min-w-0 pr-2">
                  <div className="font-bold flex items-center gap-1.5 truncate">
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${selectedLgaDetail === lga.lgaName ? 'text-rose-400' : 'text-slate-500'}`} />
                    <span className="truncate">{lga.lgaName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {lga.zone} • {lga.type}
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${selectedLgaDetail === lga.lgaName ? 'text-rose-400 translate-x-1' : 'text-slate-600'}`} />
              </button>
            ))}
          </div>

          {/* Quick Stats of Selected LGA */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">LGA Identity Profile</h4>
              <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-[9px] font-bold rounded-md text-slate-400">
                LGA ID
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
                <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Deprivation Index</span>
                <span className={`text-sm font-black block mt-0.5 ${selectedLgaNeed.deprivationIndex >= 4 ? 'text-rose-400' : selectedLgaNeed.deprivationIndex === 3 ? 'text-orange-400' : 'text-emerald-400'}`}>
                  {selectedLgaNeed.deprivationIndex} / 5
                </span>
                <span className="text-[8px] text-slate-500 block font-medium mt-0.5">
                  {selectedLgaNeed.deprivationIndex >= 4 ? 'Highly Deprived' : selectedLgaNeed.deprivationIndex === 3 ? 'Moderate' : 'Highly Affluent'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60 text-center">
                <span className="text-[8px] text-slate-500 block uppercase font-bold tracking-wider">Median Income</span>
                <span className="text-sm font-black text-white block mt-0.5">
                  {selectedLgaNeed.medianHouseholdIncome > 0 ? `$${selectedLgaNeed.medianHouseholdIncome.toLocaleString()}` : '—'}
                </span>
                <span className="text-[8px] text-slate-500 block font-medium mt-0.5">
                  {hasMetric(selectedLgaNeed.medianHouseholdIncome)
                    ? (hasMetric(PROVINCIAL_BENCHMARKS.medianHouseholdIncome)
                      ? (selectedLgaNeed.medianHouseholdIncome < PROVINCIAL_BENCHMARKS.medianHouseholdIncome ? 'Below loaded-LGA mean' : 'At/above loaded-LGA mean')
                      : 'Upstream income')
                    : 'No Data'}
                </span>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Dashboard content */}
        <div className={`space-y-6 min-w-0 ${showLgaSidebar ? 'xl:col-span-3' : ''}`}>

          {/* SUBTAB 1: Needs & Deprivation */}
          {activeSubTab === 'lga-needs' && (
            <div id="ri-needs-view" className="space-y-6 animate-fadeIn">
              {/* Primary Care Needs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Rostered Family Physicians</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">
                      {formatMetric(selectedLgaNeed.physiciansPer100k, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">per 100k</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaNeed.physiciansPer100k) && hasMetric(PROVINCIAL_BENCHMARKS.physiciansPer100k)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.physiciansPer100k.toFixed(1)} per 100k</strong>.</>
                      : 'No hardcoded provincial standard is shown; missing upstream values render as N/A.'}
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Primary Care Outside LGA</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">
                      {formatMetric(selectedLgaNeed.claimsOutsideLgaPct, { digits: 1, suffix: '%' })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">outward claims</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Residents rostered or treated outside boundaries. Higher values signify local primary access failure.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Preventable ACSC Admissions</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">
                      {formatMetric(selectedLgaNeed.acscRatePer100k, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">per 100k</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Ambulatory Care Sensitive Conditions. High rates mean family medicine gaps are pushing patients to hospital beds.
                  </p>
                </div>
              </div>

              {/* Comparative Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Socioeconomic Deprivation vs. ACSC Rate</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Correlating poverty level (CIMD score) with avoidable clinical hospitalizations</p>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={zoneNeeds}
                        margin={{ top: 10, right: 35, left: 35, bottom: 35 }}
                      >
                        <defs>
                          <linearGradient id="acscGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4}/>
                          </linearGradient>
                          <linearGradient id="physGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={8} tickLine={false} angle={-45} textAnchor="end" height={80} interval={0} />
                        <YAxis yAxisId="left" stroke="#ef4444" fontSize={9} tickLine={false} width={50} label={{ value: 'ACSC Hospitalization Rate', angle: -90, position: 'insideLeft', fill: '#ef4444', fontSize: 10, fontWeight: 'bold', offset: 0 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} tickLine={false} width={50} label={{ value: 'Physicians per 100k', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10, fontWeight: 'bold', offset: 0 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }} 
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar yAxisId="left" dataKey="acscRatePer100k" name="Preventable Hosp. Rate" fill="url(#acscGrad)" radius={[4, 4, 0, 0]}>
                          {zoneNeeds.map((entry, index) => (
                            <Cell 
                              key={`cell-acsc-${index}`} 
                              fill={entry.lgaName === selectedLgaDetail ? '#f43f5e' : 'url(#acscGrad)'} 
                            />
                          ))}
                        </Bar>
                        <Bar yAxisId="right" dataKey="physiciansPer100k" name="Physicians per 100k" fill="url(#physGrad)" radius={[4, 4, 0, 0]}>
                          {zoneNeeds.map((entry, index) => (
                            <Cell 
                              key={`cell-phys-${index}`} 
                              fill={entry.lgaName === selectedLgaDetail ? '#3b82f6' : 'url(#physGrad)'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-sans">Socio-Demographic Disparity Audit</h3>
                    <p className="text-[10px] text-slate-500">Selected LGA metrics from upstream rows; comparisons use means of non-zero loaded LGAs only</p>
                  </div>

                  <div className="space-y-4 flex-1 justify-center flex flex-col">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">High School Graduation Rate:</span>
                        <span className="text-white font-mono">{selectedLgaNeed.highSchoolGradPct > 0 ? `${selectedLgaNeed.highSchoolGradPct}%` : '—'}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${selectedLgaNeed.highSchoolGradPct > 0 ? selectedLgaNeed.highSchoolGradPct : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">{hasMetric(selectedLgaNeed.highSchoolGradPct) ? 'Upstream high school graduation rate for this LGA.' : 'High school graduation is unavailable for this LGA; not estimated.'}</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">Rostered Outside Local Geographic Area:</span>
                        <span className="text-orange-400 font-mono">{selectedLgaNeed.claimsOutsideLgaPct > 0 ? `${selectedLgaNeed.claimsOutsideLgaPct}%` : '—'}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${selectedLgaNeed.claimsOutsideLgaPct > 0 ? selectedLgaNeed.claimsOutsideLgaPct : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Reflects a localized shortage of accepting practices, forcing outward travel.</p>
                    </div>
                  </div>

                  {/* Programmatic, fully dynamic Equity Insight block */}
                  <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2.5 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                    <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-white text-xs block">Case Study: {dynamicEquityCaseStudy.title}</span>
                      <p>{dynamicEquityCaseStudy.summary}</p>
                      <p className="text-slate-500 mt-1">{dynamicEquityCaseStudy.infrastructure}</p>
                      <p className="text-slate-500 mt-1">{dynamicEquityCaseStudy.downstreamEffect}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: Chronic Disease Burden */}
          {activeSubTab === 'disease-burden' && (
            <div id="ri-diseases-view" className="space-y-6 animate-fadeIn">
              <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="CHRONIC_DISEASE_BURDEN" />
              {/* Outcome Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Life Expectancy</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">
                      {formatMetric(selectedLgaDisease.lifeExpectancyYears, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">years</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaDisease.lifeExpectancyYears) && hasMetric(PROVINCIAL_BENCHMARKS.lifeExpectancyYears)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.lifeExpectancyYears.toFixed(1)} years</strong>.</>
                      : 'No hardcoded provincial life-expectancy average is shown; zero/missing values render as N/A.'}
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Infant Mortality Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">
                      {formatMetric(selectedLgaDisease.infantMortalityPer1000, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">per 1,000 births</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaDisease.infantMortalityPer1000) && hasMetric(PROVINCIAL_BENCHMARKS.infantMortalityPer1000)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.infantMortalityPer1000.toFixed(1)}</strong>.</>
                      : 'Infant mortality is unavailable for this LGA; not estimated against a hardcoded provincial target.'}
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Diabetes Prevalence</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">
                      {formatMetric(selectedLgaDisease.diabetesPrevalencePct, { digits: 1, suffix: '%' })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">of population</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaDisease.diabetesPrevalencePct) && hasMetric(PROVINCIAL_BENCHMARKS.diabetesPrevalencePct)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.diabetesPrevalencePct.toFixed(1)}%</strong>.</>
                      : 'No hardcoded provincial diabetes average is shown; zero/missing values render as N/A.'}
                  </p>
                </div>
              </div>

              {/* Disease charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Chronic Disease Prevalence Comparison (%)</h3>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={zoneChronic}
                        margin={{ top: 10, right: 10, left: 25, bottom: 35 }}
                      >
                        <defs>
                          <linearGradient id="dbGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.4}/>
                          </linearGradient>
                          <linearGradient id="copdGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.4}/>
                          </linearGradient>
                          <linearGradient id="hypGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={8} tickLine={false} angle={-45} textAnchor="end" height={80} interval={0} />
                        <YAxis domain={[0, 35]} label={{ value: 'Prevalence %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} stroke="#64748b" fontSize={9} width={45} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar dataKey="diabetesPrevalencePct" name="Diabetes (%)" fill="url(#dbGrad)" radius={[4, 4, 0, 0]}>
                          {zoneChronic.map((entry, index) => (
                            <Cell 
                              key={`cell-db-${index}`} 
                              fill={entry.lgaName === selectedLgaDetail ? '#f43f5e' : 'url(#dbGrad)'} 
                            />
                          ))}
                        </Bar>
                        <Bar dataKey="copdPrevalencePct" name="COPD (%)" fill="url(#copdGrad)" radius={[4, 4, 0, 0]}>
                          {zoneChronic.map((entry, index) => (
                            <Cell 
                              key={`cell-copd-${index}`} 
                              fill={entry.lgaName === selectedLgaDetail ? '#ec4899' : 'url(#copdGrad)'} 
                            />
                          ))}
                        </Bar>
                        <Bar dataKey="hypertensionPrevalencePct" name="Hypertension (%)" fill="url(#hypGrad)" radius={[4, 4, 0, 0]}>
                          {zoneChronic.map((entry, index) => (
                            <Cell 
                              key={`cell-hyp-${index}`} 
                              fill={entry.lgaName === selectedLgaDetail ? '#f59e0b' : 'url(#hypGrad)'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Regional Disease Burden Analytics</h3>
                    <p className="text-[10px] text-slate-500">Maternal, child and life outcomes index for selected LGA</p>
                  </div>

                  <div className="space-y-3.5 flex-1 justify-center flex flex-col">
                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-rose-400 font-mono font-bold uppercase tracking-wider block">Life Expectancy Inequity</span>
                      <p className="text-xs text-white font-extrabold mt-1">LGA Life Expectancy: {selectedLgaDisease.lifeExpectancyYears > 0 ? `${selectedLgaDisease.lifeExpectancyYears.toFixed(1)} Years` : '—'}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicChronicDiseaseInsight.expectancy}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-wider block">Chronic Risk Burden Multipliers</span>
                      <p className="text-xs text-white font-extrabold mt-1">COPD: {selectedLgaDisease.copdPrevalencePct > 0 ? `${selectedLgaDisease.copdPrevalencePct.toFixed(1)}%` : '—'} | Diabetes: {selectedLgaDisease.diabetesPrevalencePct > 0 ? `${selectedLgaDisease.diabetesPrevalencePct.toFixed(1)}%` : '—'}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicChronicDiseaseInsight.burdenMultiplier}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 3: ER Reliance Index */}
          {activeSubTab === 'ed-reliance' && (
            <div id="ri-ed-view" className="space-y-6 animate-fadeIn">
              <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="ED_RELIANCE_METRICS" />
              {/* ED metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">ED Visits per 1,000 residents</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">
                      {formatMetric(selectedLgaEd.totalEdVisitsPer1000, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">visits</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaEd.totalEdVisitsPer1000) && hasMetric(PROVINCIAL_BENCHMARKS.totalEdVisitsPer1000)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.totalEdVisitsPer1000.toFixed(1)} visits</strong>.</>
                      : 'No hardcoded provincial ED visit average is shown; zero/missing values render as N/A.'}
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Low Acuity CTAS 4/5 Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">
                      {formatMetric(selectedLgaEd.lowAcuityCtas45Pct, { digits: 1, suffix: '%' })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">low acuity</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaEd.lowAcuityCtas45Pct) && hasMetric(PROVINCIAL_BENCHMARKS.lowAcuityCtas45Pct)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.lowAcuityCtas45Pct.toFixed(1)}%</strong>.</>
                      : 'No hardcoded provincial low-acuity average is shown; zero/missing values render as N/A.'}
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Mental Health ED Visits</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">
                      {formatMetric(selectedLgaEd.moodAnxietyEdRatePer100k, { digits: 1 })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">per 100k</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    {hasMetric(selectedLgaEd.moodAnxietyEdRatePer100k) && hasMetric(PROVINCIAL_BENCHMARKS.moodAnxietyEdRatePer100k)
                      ? <>Mean of loaded LGAs: <strong className="text-slate-300">{PROVINCIAL_BENCHMARKS.moodAnxietyEdRatePer100k.toFixed(1)} per 100k</strong>.</>
                      : 'No hardcoded provincial mental-health ED average is shown; zero/missing values render as N/A.'}
                  </p>
                </div>
              </div>

              {/* ED charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Total ED Visits vs. Low Acuity CTAS 4/5 (%)</h3>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={zoneEd}
                        margin={{ top: 10, right: 35, left: 35, bottom: 35 }}
                      >
                        <defs>
                          <linearGradient id="colorEd" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.05}/>
                          </linearGradient>
                          <linearGradient id="colorCtas" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={8} tickLine={false} angle={-45} textAnchor="end" height={80} interval={0} />
                        <YAxis yAxisId="left" stroke="#ec4899" fontSize={9} tickLine={false} width={50} label={{ value: 'ED Visits per 1000', angle: -90, position: 'insideLeft', fill: '#ec4899', fontSize: 10, fontWeight: 'bold', offset: 0 }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} tickLine={false} width={50} label={{ value: 'CTAS 4/5 %', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10, fontWeight: 'bold', offset: 0 }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Area yAxisId="left" type="monotone" dataKey="totalEdVisitsPer1000" name="ED Visits (per 1,000)" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#colorEd)" />
                        <Area yAxisId="right" type="monotone" dataKey="lowAcuityCtas45Pct" name="Low Acuity CTAS 4/5 (%)" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorCtas)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Primary Care Substitution Signal</h3>
                    <p className="text-[10px] text-slate-500">Assessing how missing clinics force residents into acute trauma centers</p>
                  </div>

                  <div className="space-y-3.5 flex-1 justify-center flex flex-col">
                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-rose-400 font-mono font-bold uppercase block tracking-wider">Low-Acuity Congestion Impact</span>
                      <p className="text-xs text-white font-extrabold mt-1">LGA Rate: {formatMetric(selectedLgaEd.lowAcuityCtas45Pct, { digits: 1, suffix: '% of ED presentations' })}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicEdRelianceInsight.reliance}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-amber-500 font-mono font-bold uppercase block tracking-wider">After-Hours Care Access Deficit</span>
                      <p className="text-xs text-white font-extrabold mt-1">After-Hours Percentage: {formatMetric(selectedLgaEd.afterHoursEdPct, { digits: 1, suffix: '%' })}</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicEdRelianceInsight.substitution}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 4: Access & Travel — only when real upstream arrays exist */}
          {activeSubTab === 'access-travel' && (
            <div id="ri-travel-view" className="space-y-6 animate-fadeIn">
              {!hasTravelAccessData ? (
                <div className="bg-[#0b1226] border border-slate-800 p-6 rounded-2xl text-sm text-slate-400">
                  Travel-for-care and service-access metrics are unavailable. No public LGA feed is wired; values are not estimated.
                </div>
              ) : (
                <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Clinics per 10k population</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">{selectedLgaAccess == null ? '—' : selectedLgaAccess.facilitiesPer10k}</span>
                    <span className="text-[10px] text-slate-500 font-medium">clinics</span>
                  </div>
                </div>
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Distance to Nearest ED</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">{selectedLgaAccess == null ? '—' : selectedLgaAccess.distanceToNearestEdKm}</span>
                    <span className="text-[10px] text-slate-500 font-medium">km</span>
                  </div>
                </div>
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Distance to Nearest Imaging</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-400">{selectedLgaAccess == null ? '—' : selectedLgaAccess.distanceToNearestImagingKm}</span>
                    <span className="text-[10px] text-slate-500 font-medium">km</span>
                  </div>
                </div>
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Accepting Roster practices</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">{selectedLgaAccess == null ? '—' : selectedLgaAccess.providersAcceptingPatients}</span>
                    <span className="text-[10px] text-slate-500 font-medium">clinics</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Travel & Care Outside LGA (%)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zoneTravel} margin={{ top: 10, right: 10, left: 25, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={8} tickLine={false} angle={-45} textAnchor="end" height={80} interval={0} />
                        <YAxis stroke="#64748b" fontSize={9} width={45} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar dataKey="careDeliveredOutsideLgaPct" name="Outward Care Travel (%)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="localBedLeakagePct" name="Inpatient Care Leakage (%)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Geographic Access</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Avg travel: {selectedLgaTravel == null ? '—' : `${selectedLgaTravel.avgTravelDistanceKm} km`}
                    {selectedLgaTravel?.topDestinationFacility ? ` → ${selectedLgaTravel.topDestinationFacility}` : ''}
                  </p>
                  <p className="text-xs text-white font-extrabold">
                    Bed Leakage: {selectedLgaTravel == null ? '—' : `${selectedLgaTravel.localBedLeakagePct}%`}
                  </p>
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* SUBTAB 5: Compare LGAs (Radar & Side-by-side Matrix) */}
          {activeSubTab === 'compare-matrix' && (
            <div id="ri-compare-view" className="space-y-6 animate-fadeIn">
              <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <ArrowRightLeft className="w-4 h-4 text-blue-400" />
                      <span>Interactive Health Equity Comparison</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Compare details of the selected LGA with another LGA or the Provincial Average</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-black uppercase">Compare With:</span>
                    <select
                      value={comparisonTarget}
                      onChange={(e) => setComparisonTarget(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 transition-colors font-semibold"
                    >
                      <option value="Provincial Average">Provincial Average Baseline</option>
                      {COMMUNITY_NEED_PROFILES.map((lga) => (
                        <option key={lga.lgaName} value={lga.lgaName} disabled={lga.lgaName === selectedLgaDetail}>
                          {lga.lgaName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Radar Comparative chart */}
                  <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-4 flex flex-col justify-between">
                    <div className="text-center">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Health Equity Dimensions Profile</h3>
                      <p className="text-[9px] text-slate-500 mt-0.5">Normalized score indices (0-100, where 100 represents the optimal equity benchmark)</p>
                    </div>

                    <div className="h-64 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarChartData}>
                          <PolarGrid stroke="#1e293b" />
                          <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={9} />
                          <PolarRadiusAxis stroke="#334155" angle={30} domain={[0, 100]} fontSize={8} />
                          <Radar name={selectedLgaDetail} dataKey={selectedLgaDetail} stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
                          <Radar name={comparisonTarget} dataKey={comparisonTarget} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                          <Tooltip contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }} />
                          <Legend wrapperStyle={{ fontSize: 9 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Comparative Matrix table */}
                  <div className="space-y-3">
                    <div className="text-center sm:text-left">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Detailed Variance Matrix</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Comparing core markers against target benchmarks</p>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            <th className="p-3">Core Performance Metric</th>
                            <th className="p-3 text-rose-400">{selectedLgaDetail.split(' ')[0]}...</th>
                            <th className="p-3 text-blue-400">{comparisonTarget.split(' ')[0]}...</th>
                            <th className="p-3 text-center">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {/* Row 1 */}
                          <tr>
                            <td className="p-3 text-slate-300">Physicians per 100k</td>
                            <td className="p-3 text-white font-mono">{selectedFullData.physiciansPer100k ? Number(selectedFullData.physiciansPer100k).toFixed(1) : '—'}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.physiciansPer100k ? Number(comparisonFullData.physiciansPer100k).toFixed(1) : '—'}</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
                                const diff = selectedFullData.physiciansPer100k - comparisonFullData.physiciansPer100k;
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                          {/* Row 2 */}
                          <tr>
                            <td className="p-3 text-slate-300">Claims Outside LGA %</td>
                            <td className="p-3 text-white font-mono">{selectedFullData.claimsOutsideLgaPct}%</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.claimsOutsideLgaPct}%</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
                                const diff = selectedFullData.claimsOutsideLgaPct - comparisonFullData.claimsOutsideLgaPct;
                                // For outward claims, lower is better
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff <= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}%
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                          {/* Row 3 */}
                          <tr>
                            <td className="p-3 text-slate-300">Preventable ACSC admissions</td>
                            <td className="p-3 text-white font-mono">{selectedFullData.acscRatePer100k}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.acscRatePer100k}</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
                                const diff = selectedFullData.acscRatePer100k - comparisonFullData.acscRatePer100k;
                                // For admissions, lower is better
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff <= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                          {/* Row 4 */}
                          <tr>
                            <td className="p-3 text-slate-300">Life Expectancy (years)</td>
                            <td className="p-3 text-white font-mono">{selectedFullData.lifeExpectancyYears}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.lifeExpectancyYears}</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
                                const diff = selectedFullData.lifeExpectancyYears - comparisonFullData.lifeExpectancyYears;
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                          {/* Row 5 */}
                          <tr>
                            <td className="p-3 text-slate-300">Total ED Visits / 1,000</td>
                            <td className="p-3 text-white font-mono">{selectedFullData.totalEdVisitsPer1000}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.totalEdVisitsPer1000}</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
                                const diff = selectedFullData.totalEdVisitsPer1000 - comparisonFullData.totalEdVisitsPer1000;
                                // For ED visits, lower is better
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff <= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                          {/* Row 6 */}
                          <tr>
                            <td className="p-3 text-slate-300">Providers accepting rosters</td>
                            <td className="p-3 text-white font-mono">{(selectedFullData as { providersAcceptingPatients?: number | null }).providersAcceptingPatients == null ? '—' : (selectedFullData as { providersAcceptingPatients: number }).providersAcceptingPatients}</td>
                            <td className="p-3 text-slate-400 font-mono">{(comparisonFullData as { providersAcceptingPatients?: number | null }).providersAcceptingPatients == null ? '—' : (comparisonFullData as { providersAcceptingPatients: number }).providersAcceptingPatients}</td>
                            <td className="p-3 text-center font-mono">
                              {SERVICE_ACCESS_METRICS.length === 0 ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500 border border-slate-800">
                                  —
                                </span>
                              ) : (() => {
                                const diff = selectedFullData.providersAcceptingPatients - comparisonFullData.providersAcceptingPatients;
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                    {diff >= 0 ? '+' : ''}{diff}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 6: All-Data Spreadsheet Explorer */}
          {activeSubTab === 'data-explorer' && (
            <div id="ri-explorer-view" className="space-y-6 animate-fadeIn">
              <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Full Health Equity Diagnostic Matrix</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Surfacing all available primary, secondary, and tertiary health disparity indicators</p>
                  </div>

                  {/* Filter Subtabs for the explorer */}
                  <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
                    <button
                      onClick={() => setExplorerCategory('all')}
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${explorerCategory === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      All Columns
                    </button>
                    <button
                      onClick={() => setExplorerCategory('socioeconomics')}
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${explorerCategory === 'socioeconomics' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Socioeconomics
                    </button>
                    <button
                      onClick={() => setExplorerCategory('chronic')}
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${explorerCategory === 'chronic' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Chronic Diseases
                    </button>
                    <button
                      onClick={() => setExplorerCategory('ed')}
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${explorerCategory === 'ed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      ER Reliance
                    </button>
                    <button
                      onClick={() => setExplorerCategory('access')}
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer ${explorerCategory === 'access' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Access & Travel
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-3 sticky left-0 bg-slate-900 cursor-pointer hover:bg-slate-850 transition-colors" onClick={() => handleSort('lgaName')}>
                          LGA Name {sortKey === 'lgaName' ? (sortAsc ? '▲' : '▼') : ''}
                        </th>
                        
                        {(explorerCategory === 'all' || explorerCategory === 'socioeconomics') && (
                          <>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors" onClick={() => handleSort('zone')}>Zone {sortKey === 'zone' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors" onClick={() => handleSort('type')}>Type {sortKey === 'type' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-center" onClick={() => handleSort('deprivationIndex')}>Deprivation {sortKey === 'deprivationIndex' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('medianHouseholdIncome')}>Median Income {sortKey === 'medianHouseholdIncome' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('highSchoolGradPct')}>HS Grad % {sortKey === 'highSchoolGradPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                          </>
                        )}

                        {(explorerCategory === 'all' || explorerCategory === 'chronic') && (
                          <>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('lifeExpectancyYears')}>Life Exp. {sortKey === 'lifeExpectancyYears' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('infantMortalityPer1000')}>Infant Mort. {sortKey === 'infantMortalityPer1000' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('diabetesPrevalencePct')}>Diabetes % {sortKey === 'diabetesPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('copdPrevalencePct')}>COPD % {sortKey === 'copdPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('hypertensionPrevalencePct')}>Hypertens. % {sortKey === 'hypertensionPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                          </>
                        )}

                        {(explorerCategory === 'all' || explorerCategory === 'ed') && (
                          <>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('totalEdVisitsPer1000')}>ED Visits/1k {sortKey === 'totalEdVisitsPer1000' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('lowAcuityCtas45Pct')}>CTAS 4/5 % {sortKey === 'lowAcuityCtas45Pct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('afterHoursEdPct')}>After-Hrs % {sortKey === 'afterHoursEdPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('moodAnxietyEdRatePer100k')}>Mental Health ED {sortKey === 'moodAnxietyEdRatePer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                          </>
                        )}

                        {(explorerCategory === 'all' || explorerCategory === 'access') && (
                          <>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('physiciansPer100k')}>Physicians/100k {sortKey === 'physiciansPer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('claimsOutsideLgaPct')}>Outward Care % {sortKey === 'claimsOutsideLgaPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('acscRatePer100k')}>ACSC Rate/100k {sortKey === 'acscRatePer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('facilitiesPer10k')}>Clinics/10k {sortKey === 'facilitiesPer10k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('distanceToNearestEdKm')}>ED Dist. (km) {sortKey === 'distanceToNearestEdKm' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('distanceToNearestImagingKm')}>Imaging Dist. (km) {sortKey === 'distanceToNearestImagingKm' ? (sortAsc ? '▲' : '▼') : ''}</th>
                            <th className="p-3 cursor-pointer hover:bg-slate-850 transition-colors text-right" onClick={() => handleSort('providersAcceptingPatients')}>Accepting Practices {sortKey === 'providersAcceptingPatients' ? (sortAsc ? '▲' : '▼') : ''}</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono font-medium text-slate-300">
                      {sortedExplorerData.map((lga, idx) => (
                        <tr key={idx} className={`hover:bg-slate-900/40 transition-colors ${selectedLgaDetail === lga.lgaName ? 'bg-rose-500/5 border-l-2 border-l-rose-500' : ''}`}>
                          <td className="p-3 sticky left-0 bg-[#090e21] font-sans font-bold text-white max-w-[180px] truncate">
                            {lga.lgaName}
                          </td>
                          
                          {(explorerCategory === 'all' || explorerCategory === 'socioeconomics') && (
                            <>
                              <td className="p-3 font-sans text-slate-400">{lga.zone}</td>
                              <td className="p-3 font-sans text-slate-400">{lga.type}</td>
                              <td className="p-3 text-center">
                                {lga.deprivationIndex ? (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lga.deprivationIndex >= 4 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                    {lga.deprivationIndex} / 5
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="p-3 text-right text-slate-100">
                                {lga.medianHouseholdIncome ? `$${lga.medianHouseholdIncome.toLocaleString()}` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.highSchoolGradPct ? `${lga.highSchoolGradPct}%` : '—'}
                              </td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'chronic') && (
                            <>
                              <td className="p-3 text-right text-slate-100">
                                {lga.lifeExpectancyYears ? `${lga.lifeExpectancyYears} yrs` : '—'}
                              </td>
                              <td className="p-3 text-right text-orange-400">
                                {lga.infantMortalityPer1000 ? lga.infantMortalityPer1000 : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.diabetesPrevalencePct ? `${lga.diabetesPrevalencePct}%` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.copdPrevalencePct ? `${lga.copdPrevalencePct}%` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.hypertensionPrevalencePct ? `${lga.hypertensionPrevalencePct}%` : '—'}
                              </td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'ed') && (
                            <>
                              <td className="p-3 text-right text-slate-100">
                                {lga.totalEdVisitsPer1000 ? lga.totalEdVisitsPer1000 : '—'}
                              </td>
                              <td className="p-3 text-right text-orange-400">
                                {lga.lowAcuityCtas45Pct ? `${lga.lowAcuityCtas45Pct}%` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.afterHoursEdPct ? `${lga.afterHoursEdPct}%` : '—'}
                              </td>
                              <td className="p-3 text-right text-slate-100">
                                {lga.moodAnxietyEdRatePer100k ? lga.moodAnxietyEdRatePer100k : '—'}
                              </td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'access') && (
                            <>
                              <td className="p-3 text-right text-slate-100">
                                {lga.physiciansPer100k ? Number(lga.physiciansPer100k).toFixed(1) : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {lga.claimsOutsideLgaPct ? `${lga.claimsOutsideLgaPct}%` : '—'}
                              </td>
                              <td className="p-3 text-right text-slate-100">
                                {lga.acscRatePer100k ? lga.acscRatePer100k : '—'}
                              </td>
                              <td className="p-3 text-right text-slate-400">
                                {(lga as { facilitiesPer10k?: number | null }).facilitiesPer10k == null ? '—' : (lga as { facilitiesPer10k: number }).facilitiesPer10k}
                              </td>
                              <td className="p-3 text-right text-orange-400">
                                {(lga as { distanceToNearestEdKm?: number | null }).distanceToNearestEdKm == null ? '—' : `${(lga as { distanceToNearestEdKm: number }).distanceToNearestEdKm} km`}
                              </td>
                              <td className="p-3 text-right text-orange-400">
                                {(lga as { distanceToNearestImagingKm?: number | null }).distanceToNearestImagingKm == null ? '—' : `${(lga as { distanceToNearestImagingKm: number }).distanceToNearestImagingKm} km`}
                              </td>
                              <td className="p-3 text-right text-slate-100">
                                {(lga as { providersAcceptingPatients?: number | null }).providersAcceptingPatients == null ? '—' : (lga as { providersAcceptingPatients: number }).providersAcceptingPatients}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-slate-500 font-sans flex items-center gap-1.5 justify-center sm:justify-start">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Interactive grid supports sorting by clicking any column header. Highlighted row indicates the selected focus LGA.</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
