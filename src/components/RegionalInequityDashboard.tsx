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
  Area
} from 'recharts';
import type {
  CommunityNeedMetric,
  ChronicDiseaseBurden,
  EDRelianceMetric,
  TravelForCare,
  ServiceAccessMetric,
} from '../regionalInequityData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type RegionalInequityData = {
  COMMUNITY_NEED_PROFILES: CommunityNeedMetric[];
  CHRONIC_DISEASE_BURDEN: ChronicDiseaseBurden[];
  ED_RELIANCE_METRICS: EDRelianceMetric[];
  TRAVEL_FOR_CARE: TravelForCare[];
  SERVICE_ACCESS_METRICS: ServiceAccessMetric[];
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
export default function RegionalInequityDashboard() {
  // Live data fetched from /api/data/regional-inequity
  const { data, metadata, isLoading, error, refresh } = useDomainData<RegionalInequityData>('regional-inequity');
  const COMMUNITY_NEED_PROFILES = data?.COMMUNITY_NEED_PROFILES ?? [];
  const CHRONIC_DISEASE_BURDEN = data?.CHRONIC_DISEASE_BURDEN ?? [];
  const ED_RELIANCE_METRICS = data?.ED_RELIANCE_METRICS ?? [];
  const TRAVEL_FOR_CARE = data?.TRAVEL_FOR_CARE ?? [];
  const SERVICE_ACCESS_METRICS = data?.SERVICE_ACCESS_METRICS ?? [];

  // ----------------------------------------------------------------------------
  // PROVINCIAL BENCHMARKS (DYNAMICALLY CALCULATED FROM THE 5 REPRESENTATIVE LGAs)
  // ----------------------------------------------------------------------------
  const PROVINCIAL_BENCHMARKS = useMemo(() => {
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
    const n = COMMUNITY_NEED_PROFILES.length;
    return {
      medianHouseholdIncome: Math.round(COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.medianHouseholdIncome, 0) / n),
      physiciansPer100k: parseFloat((COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.physiciansPer100k, 0) / n).toFixed(1)),
      claimsOutsideLgaPct: parseFloat((COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.claimsOutsideLgaPct, 0) / n).toFixed(1)),
      acscRatePer100k: Math.round(COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.acscRatePer100k, 0) / n),
      highSchoolGradPct: parseFloat((COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.highSchoolGradPct, 0) / n).toFixed(1)),
      deprivationIndex: parseFloat((COMMUNITY_NEED_PROFILES.reduce((acc, p) => acc + p.deprivationIndex, 0) / n).toFixed(1)),

      diabetesPrevalencePct: parseFloat((CHRONIC_DISEASE_BURDEN.reduce((acc, d) => acc + d.diabetesPrevalencePct, 0) / n).toFixed(2)),
      copdPrevalencePct: parseFloat((CHRONIC_DISEASE_BURDEN.reduce((acc, d) => acc + d.copdPrevalencePct, 0) / n).toFixed(2)),
      hypertensionPrevalencePct: parseFloat((CHRONIC_DISEASE_BURDEN.reduce((acc, d) => acc + d.hypertensionPrevalencePct, 0) / n).toFixed(2)),
      infantMortalityPer1000: parseFloat((CHRONIC_DISEASE_BURDEN.reduce((acc, d) => acc + d.infantMortalityPer1000, 0) / n).toFixed(2)),
      lifeExpectancyYears: parseFloat((CHRONIC_DISEASE_BURDEN.reduce((acc, d) => acc + d.lifeExpectancyYears, 0) / n).toFixed(1)),

      totalEdVisitsPer1000: Math.round(ED_RELIANCE_METRICS.reduce((acc, e) => acc + e.totalEdVisitsPer1000, 0) / n),
      lowAcuityCtas45Pct: parseFloat((ED_RELIANCE_METRICS.reduce((acc, e) => acc + e.lowAcuityCtas45Pct, 0) / n).toFixed(1)),
      afterHoursEdPct: parseFloat((ED_RELIANCE_METRICS.reduce((acc, e) => acc + e.afterHoursEdPct, 0) / n).toFixed(1)),
      moodAnxietyEdRatePer100k: Math.round(ED_RELIANCE_METRICS.reduce((acc, e) => acc + e.moodAnxietyEdRatePer100k, 0) / n),

      careDeliveredOutsideLgaPct: parseFloat((TRAVEL_FOR_CARE.reduce((acc, t) => acc + t.careDeliveredOutsideLgaPct, 0) / n).toFixed(1)),
      avgTravelDistanceKm: parseFloat((TRAVEL_FOR_CARE.reduce((acc, t) => acc + t.avgTravelDistanceKm, 0) / n).toFixed(1)),
      localBedLeakagePct: parseFloat((TRAVEL_FOR_CARE.reduce((acc, t) => acc + t.localBedLeakagePct, 0) / n).toFixed(1)),

      facilitiesPer10k: parseFloat((SERVICE_ACCESS_METRICS.reduce((acc, s) => acc + s.facilitiesPer10k, 0) / n).toFixed(2)),
      distanceToNearestEdKm: parseFloat((SERVICE_ACCESS_METRICS.reduce((acc, s) => acc + s.distanceToNearestEdKm, 0) / n).toFixed(1)),
      distanceToNearestImagingKm: parseFloat((SERVICE_ACCESS_METRICS.reduce((acc, s) => acc + s.distanceToNearestImagingKm, 0) / n).toFixed(1)),
      providersAcceptingPatients: Math.round(SERVICE_ACCESS_METRICS.reduce((acc, s) => acc + s.providersAcceptingPatients, 0) / n)
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
    return TRAVEL_FOR_CARE.find(t => t.lgaName === selectedLgaDetail) || TRAVEL_FOR_CARE[0] || defaultTravel;
  }, [TRAVEL_FOR_CARE, selectedLgaDetail]);

  const selectedLgaAccess = useMemo(() => {
    return SERVICE_ACCESS_METRICS.find(s => s.lgaName === selectedLgaDetail) || SERVICE_ACCESS_METRICS[0] || defaultAccess;
  }, [SERVICE_ACCESS_METRICS, selectedLgaDetail]);

  // Combined full dataset of selected LGA
  const selectedFullData = useMemo(() => {
    return {
      ...selectedLgaNeed,
      ...selectedLgaDisease,
      ...selectedLgaEd,
      ...selectedLgaTravel,
      ...selectedLgaAccess
    };
  }, [selectedLgaNeed, selectedLgaDisease, selectedLgaEd, selectedLgaTravel, selectedLgaAccess]);

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
      const travel = TRAVEL_FOR_CARE.find(t => t.lgaName === comparisonTarget) || TRAVEL_FOR_CARE[0] || defaultTravel;
      const access = SERVICE_ACCESS_METRICS.find(s => s.lgaName === comparisonTarget) || SERVICE_ACCESS_METRICS[0] || defaultAccess;
      return {
        ...need,
        ...disease,
        ...ed,
        ...travel,
        ...access
      };
    }
  }, [comparisonTarget, PROVINCIAL_BENCHMARKS, COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, ED_RELIANCE_METRICS, TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS]);

  // Normalized Radar Chart Data
  const radarChartData = useMemo(() => {
    // Normalization Helpers (0 - 100 score, higher is better)
    // 1. Doctor Density: Physicians per 100k relative to maximum (168.4)
    const normalizePhysicians = (val: number) => {
      if (val === undefined || isNaN(val)) return 0;
      return Math.round((val / 168.4) * 100);
    };
    
    // 2. Economic strength: Median household income relative to max ($112,500)
    const normalizeIncome = (val: number) => {
      if (val === undefined || isNaN(val)) return 0;
      return Math.round((val / 112500) * 100);
    };
    
    // 3. Preventative care efficacy: Inverse of ACSC rate (lower is better, max 845.1, min 184.2)
    // Map so 845.1 becomes 15 and 184.2 becomes 95
    const normalizePreventative = (val: number) => {
      if (val === undefined || isNaN(val)) return 0;
      const progress = (val - 184.2) / (845.1 - 184.2);
      return Math.round(95 - (progress * 80));
    };

    // 4. Care proximity: Inverse of distance to ED (max 145.8, min 2.1)
    const normalizeProximity = (val: number) => {
      if (val === undefined || isNaN(val)) return 0;
      const progress = (val - 2.1) / (145.8 - 2.1);
      return Math.round(98 - (progress * 90));
    };

    // 5. Care Retention: Retaining rostered patients locally (% rostered locally, which is 100 - claimsOutsideLgaPct)
    const normalizeRetention = (val: number) => {
      if (val === undefined || isNaN(val)) return 0;
      return Math.round(100 - val);
    };
    return [
      {
        subject: 'Primary Care Density',
        [selectedLgaDetail]: normalizePhysicians(selectedFullData.physiciansPer100k),
        [comparisonTarget]: normalizePhysicians(comparisonFullData.physiciansPer100k),
        fullMark: 100,
      },
      {
        subject: 'Socioeconomic Affluence',
        [selectedLgaDetail]: normalizeIncome(selectedFullData.medianHouseholdIncome),
        [comparisonTarget]: normalizeIncome(comparisonFullData.medianHouseholdIncome),
        fullMark: 100,
      },
      {
        subject: 'Preventative Efficacy',
        [selectedLgaDetail]: normalizePreventative(selectedFullData.acscRatePer100k),
        [comparisonTarget]: normalizePreventative(comparisonFullData.acscRatePer100k),
        fullMark: 100,
      },
      {
        subject: 'Emergency Proximity',
        [selectedLgaDetail]: normalizeProximity(selectedFullData.distanceToNearestEdKm),
        [comparisonTarget]: normalizeProximity(comparisonFullData.distanceToNearestEdKm),
        fullMark: 100,
      },
      {
        subject: 'Care Retention',
        [selectedLgaDetail]: normalizeRetention(selectedFullData.claimsOutsideLgaPct),
        [comparisonTarget]: normalizeRetention(comparisonFullData.claimsOutsideLgaPct),
        fullMark: 100,
      },
    ];
  }, [selectedLgaDetail, comparisonTarget, selectedFullData, comparisonFullData]);

  // Combined full table array for All Data Explorer
  const fullCombinedDataset = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.map(p => {
      const disease = CHRONIC_DISEASE_BURDEN.find(d => d.lgaName === p.lgaName) || defaultDisease;
      const ed = ED_RELIANCE_METRICS.find(e => e.lgaName === p.lgaName) || defaultEd;
      const travel = TRAVEL_FOR_CARE.find(t => t.lgaName === p.lgaName) || defaultTravel;
      const access = SERVICE_ACCESS_METRICS.find(s => s.lgaName === p.lgaName) || defaultAccess;
      return {
        ...p,
        ...disease,
        ...ed,
        ...travel,
        ...access
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
  // DYNAMIC CASE STUDIES & INSIGHTS (100% PROGRAMMATIC - NO HARDCODED PLACEHOLDERS)
  // ----------------------------------------------------------------------------
  const dynamicEquityCaseStudy = useMemo(() => {
    const isHighDeprivation = selectedFullData.deprivationIndex >= 4;
    const isMediumDeprivation = selectedFullData.deprivationIndex === 3;
    
    let classification = "an affluent Urban Hub profile";
    if (isHighDeprivation) {
      classification = "a highly vulnerable, resource-constrained environment";
    } else if (isMediumDeprivation) {
      classification = "a transitional, moderately underserved regional environment";
    } else if (selectedFullData.deprivationIndex === 2) {
      classification = "a stable suburban grid profile";
    }

    const docStatus = selectedFullData.physiciansPer100k < 115 
      ? `exhibits a primary care density gap, operating ${((115 - selectedFullData.physiciansPer100k) / 115 * 100).toFixed(0)}% below the AHS provincial average standard of 115 family doctors per 100k`
      : `boasts a primary care surplus, registering ${((selectedFullData.physiciansPer100k - 115) / 115 * 100).toFixed(0)}% more family doctors per 100k than the AHS provincial standard of 115`;

    const preventableAdmissionsMultiplier = (selectedFullData.acscRatePer100k / 184.2).toFixed(1);

    return {
      title: `${selectedLgaDetail}: Demographic & Preventative Care Audit`,
      summary: `Demographic audit classifies this LGA as ${classification}. Economic metrics reveal a median household income of $${selectedFullData.medianHouseholdIncome.toLocaleString()} and high school graduation rates at ${selectedFullData.highSchoolGradPct}%. This socioeconomic posture is a primary driver of downstream clinical pathways.`,
      infrastructure: `Healthcare supply and physicians density in this region ${docStatus}. Because local primary practices are so ${selectedFullData.physiciansPer100k < 100 ? 'congested or absent' : 'integrated'}, a substantial ${selectedFullData.claimsOutsideLgaPct}% of residents are rostered or treated outside of this LGA's boundaries.`,
      downstreamEffect: `A direct consequence of failing to anchor primary preventative care is the escalation of avoidable hospitalizations. ${selectedLgaDetail} exhibits an Ambulatory Care Sensitive Conditions (ACSC) rate of ${selectedFullData.acscRatePer100k} per 100k. Compared to Calgary - West Bow (the provincial optimum), this avoidable hospitalization rate is ${preventableAdmissionsMultiplier}x higher, indicating a critical need for localized primary clinic investments.`
    };
  }, [selectedFullData, selectedLgaDetail]);

  const dynamicChronicDiseaseInsight = useMemo(() => {
    const lifeExpectancyDelta = (84.6 - selectedFullData.lifeExpectancyYears).toFixed(1);
    const diabetesMultiplier = (selectedFullData.diabetesPrevalencePct / 4.8).toFixed(1);
    const copdMultiplier = (selectedFullData.copdPrevalencePct / 1.9).toFixed(1);
    
    return {
      expectancy: `Life expectancy in ${selectedLgaDetail} stands at ${selectedFullData.lifeExpectancyYears} years. When compared to the provincial maximum of 84.6 years (Calgary West Bow), this reveals an active longevity gap of ${lifeExpectancyDelta} years, demonstrating the profound real-world cost of health resource inequity.`,
      burdenMultiplier: `Standardized age prevalence shows that diabetes is ${diabetesMultiplier}x higher and COPD is ${copdMultiplier}x higher in ${selectedLgaDetail} than the provincial optimums. Standard pediatric audits also register infant mortality at ${selectedFullData.infantMortalityPer1000} per 1,000 births, demonstrating how pre-natal counseling and pediatric access gaps degrade early childhood health outcomes.`
    };
  }, [selectedFullData, selectedLgaDetail]);

  const dynamicEdRelianceInsight = useMemo(() => {
    const avgEdVisits = PROVINCIAL_BENCHMARKS.totalEdVisitsPer1000;
    const visitsComparison = selectedFullData.totalEdVisitsPer1000 > avgEdVisits
      ? `${(selectedFullData.totalEdVisitsPer1000 - avgEdVisits)} more visits per 1,000 residents than the provincial average`
      : `${(avgEdVisits - selectedFullData.totalEdVisitsPer1000)} fewer visits per 1,000 residents than the provincial average`;

    const isERSubstitute = selectedFullData.lowAcuityCtas45Pct > 45;
    const ERSubstitutionStatus = isERSubstitute
      ? `A low-acuity rate of ${selectedFullData.lowAcuityCtas45Pct}% indicates that Emergency Departments are actively serving as primary care substitutes due to localized roster blockades`
      : `A low-acuity rate of ${selectedFullData.lowAcuityCtas45Pct}% indicates stable clinic routing, meaning residents are using emergency trauma centers primarily for true acute events`;

    return {
      reliance: `Annual Emergency Department presentation rate stands at ${selectedFullData.totalEdVisitsPer1000} visits per 1,000 residents. This represents ${visitsComparison} (${avgEdVisits} visits).`,
      substitution: `${ERSubstitutionStatus}. Furthermore, ${selectedFullData.afterHoursEdPct}% of ED visits occur between 18:00 and 08:00, signaling a lack of after-hours primary clinics or integrated weekend primary networks.`
    };
  }, [selectedFullData, selectedLgaDetail, PROVINCIAL_BENCHMARKS]);

  const dynamicAccessTravelInsight = useMemo(() => {
    return {
      travel: `Remote specialty gaps force local residents to travel an average of ${selectedFullData.avgTravelDistanceKm} km per outpatient cycle. The primary regional facility absorbing this outward medical flow is ${selectedFullData.topDestinationFacility}.`,
      leakage: `This resource gap is confirmed by a local inpatient bed leakage rate of ${selectedFullData.localBedLeakagePct}%. Local diagnostics are unable to retain native clinical caseloads, requiring residents to leave their home districts for standard inpatient care.`
    };
  }, [selectedFullData, selectedLgaDetail]);

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

      {/* Warning Narrative Chain */}
      <div id="ri-narrative-callout" className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="space-y-1 flex-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-rose-400" />
            <span>Socioeconomic Status & Health Inequity Dynamics</span>
          </h4>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong>The Cycle of Disparity:</strong> Severe socioeconomic deprivation correlates directly to primary care attachment gaps. With local primary clinics accepting zero rosters, residents rely heavily on regional Emergency Departments as primary care substitutes. This drives acute-care congestion, diagnostic delays, and extreme travel-for-care burdens.
          </p>
        </div>
        <span className="text-[10px] bg-rose-500/10 border border-rose-500/25 text-rose-400 px-3 py-1.5 rounded-lg font-mono font-bold tracking-widest shrink-0 self-start md:self-center">
          PROVINCIAL HEALTH AUDIT
        </span>
      </div>

      {/* Main Two-Column Interactive Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* Left Column: LGA Navigator & Profile selector */}
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
                  ${selectedLgaNeed.medianHouseholdIncome.toLocaleString()}
                </span>
                <span className="text-[8px] text-slate-500 block font-medium mt-0.5">
                  {selectedLgaNeed.medianHouseholdIncome < 70000 ? 'Below Average' : 'Above Average'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dashboard Content Panels */}
        <div className="xl:col-span-3 space-y-6 min-w-0">

          {/* SUBTAB 1: Needs & Deprivation */}
          {activeSubTab === 'lga-needs' && (
            <div id="ri-needs-view" className="space-y-6 animate-fadeIn">
              {/* Primary Care Needs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Rostered Family Physicians</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">{selectedLgaNeed.physiciansPer100k}</span>
                    <span className="text-[10px] text-slate-500 font-medium">per 100k</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial standard average: <strong className="text-slate-300">115 per 100k</strong>. Selected LGA is {selectedLgaNeed.physiciansPer100k < 115 ? 'below' : 'above'} standard.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Primary Care Outside LGA</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">{selectedLgaNeed.claimsOutsideLgaPct}%</span>
                    <span className="text-[10px] text-slate-500 font-medium">outward claims</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Residents rostered or treated outside boundaries. Higher values signify local primary access failure.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Preventable ACSC Admissions</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">{selectedLgaNeed.acscRatePer100k}</span>
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
                        data={COMMUNITY_NEED_PROFILES}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
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
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#ef4444" fontSize={9} tickLine={false} label={{ value: 'ACSC Hospitalization Rate', angle: -90, position: 'insideLeft', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} tickLine={false} label={{ value: 'Physicians per 100k', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }} 
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar yAxisId="left" dataKey="acscRatePer100k" name="Preventable Hosp. Rate" fill="url(#acscGrad)" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="physiciansPer100k" name="Physicians per 100k" fill="url(#physGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-sans">Socio-Demographic Disparity Audit</h3>
                    <p className="text-[10px] text-slate-500">Selected LGA metrics relative to the Provincial Median Baseline</p>
                  </div>

                  <div className="space-y-4 flex-1 justify-center flex flex-col">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">High School Graduation Rate:</span>
                        <span className="text-white font-mono">{selectedLgaNeed.highSchoolGradPct}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${selectedLgaNeed.highSchoolGradPct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Provincial secondary educational baseline target is 90%.</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-400">Rostered Outside Local Geographic Area:</span>
                        <span className="text-orange-400 font-mono">{selectedLgaNeed.claimsOutsideLgaPct}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                        <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${selectedLgaNeed.claimsOutsideLgaPct}%` }} />
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
                    <span className="text-2xl font-black text-rose-400">{selectedLgaDisease.lifeExpectancyYears}</span>
                    <span className="text-[10px] text-slate-500 font-medium">years</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">79.0 years</strong>. Longevity delta is closely tied to local primary support density.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Infant Mortality Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">{selectedLgaDisease.infantMortalityPer1000}</span>
                    <span className="text-[10px] text-slate-500 font-medium">per 1,000 births</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">4.9</strong>. Key clinical marker reflecting prenatal healthcare quality and pediatric density.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Diabetes Prevalence</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">{selectedLgaDisease.diabetesPrevalencePct}%</span>
                    <span className="text-[10px] text-slate-500 font-medium">of population</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">8.3%</strong>. Chronic disease load indicating preventative clinical access and dietary factors.
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
                        data={CHRONIC_DISEASE_BURDEN}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
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
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis domain={[0, 35]} label={{ value: 'Prevalence %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} stroke="#64748b" fontSize={9} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar dataKey="diabetesPrevalencePct" name="Diabetes (%)" fill="url(#dbGrad)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="copdPrevalencePct" name="COPD (%)" fill="url(#copdGrad)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="hypertensionPrevalencePct" name="Hypertension (%)" fill="url(#hypGrad)" radius={[4, 4, 0, 0]} />
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
                      <p className="text-xs text-white font-extrabold mt-1">LGA Life Expectancy: {selectedLgaDisease.lifeExpectancyYears} Years</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicChronicDiseaseInsight.expectancy}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-wider block">Chronic Risk Burden Multipliers</span>
                      <p className="text-xs text-white font-extrabold mt-1">COPD: {selectedLgaDisease.copdPrevalencePct}% | Diabetes: {selectedLgaDisease.diabetesPrevalencePct}%</p>
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
                    <span className="text-2xl font-black text-rose-400">{selectedLgaEd.totalEdVisitsPer1000}</span>
                    <span className="text-[10px] text-slate-500 font-medium">visits</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">472 visits</strong>. Measures raw annual emergency care presentations per 1,000 local pop.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Low Acuity CTAS 4/5 Rate</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">{selectedLgaEd.lowAcuityCtas45Pct}%</span>
                    <span className="text-[10px] text-slate-500 font-medium">low acuity</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">51.7%</strong>. Non-urgent presentations indicating primary practice scarcity.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Mental Health ED Visits</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">{selectedLgaEd.moodAnxietyEdRatePer100k}</span>
                    <span className="text-[10px] text-slate-500 font-medium">per 100k</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed">
                    Provincial average: <strong className="text-slate-300">938 per 100k</strong>. Emergency visits triggered by psychiatric, mood, or substance crises.
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
                        data={ED_RELIANCE_METRICS}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
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
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis yAxisId="left" stroke="#ec4899" fontSize={9} tickLine={false} label={{ value: 'ED Visits per 1000', angle: -90, position: 'insideLeft', fill: '#ec4899', fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} tickLine={false} label={{ value: 'CTAS 4/5 %', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10, fontWeight: 'bold' }} />
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
                      <p className="text-xs text-white font-extrabold mt-1">LGA Rate: {selectedLgaEd.lowAcuityCtas45Pct}% of ED presentations</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicEdRelianceInsight.reliance}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-amber-500 font-mono font-bold uppercase block tracking-wider">After-Hours Care Access Deficit</span>
                      <p className="text-xs text-white font-extrabold mt-1">After-Hours Percentage: {selectedLgaEd.afterHoursEdPct}%</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicEdRelianceInsight.substitution}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 4: Access & Travel */}
          {activeSubTab === 'access-travel' && (
            <div id="ri-travel-view" className="space-y-6 animate-fadeIn">
              {/* Access metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Clinics per 10k population</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-rose-400">{selectedLgaAccess.facilitiesPer10k}</span>
                    <span className="text-[10px] text-slate-500 font-medium">clinics</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed text-[11px]">
                    Prov average: <strong className="text-slate-300">5.58</strong>. Medical sites per 10k residents.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Distance to Nearest ED</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-orange-400">{selectedLgaAccess.distanceToNearestEdKm}</span>
                    <span className="text-[10px] text-slate-500 font-medium">km</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed text-[11px]">
                    Prov average: <strong className="text-slate-300">51.4 km</strong>. Travel distance to open ER.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Distance to Nearest Imaging</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-indigo-400">{selectedLgaAccess.distanceToNearestImagingKm}</span>
                    <span className="text-[10px] text-slate-500 font-medium">km</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed text-[11px]">
                    Prov average: <strong className="text-slate-300">50.1 km</strong>. Surfaced imaging distance.
                  </p>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-4 rounded-2xl space-y-1 shadow-md">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block">Accepting Roster practices</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-500">{selectedLgaAccess.providersAcceptingPatients}</span>
                    <span className="text-[10px] text-slate-500 font-medium">clinics</span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-2 border-t border-slate-800/80 font-medium leading-relaxed text-[11px]">
                    Active family practices accepting new rostered patients.
                  </p>
                </div>
              </div>

              {/* Travel charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 shadow-md">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Travel & Care Outside LGA (%)</h3>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={TRAVEL_FOR_CARE}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="travelGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.4}/>
                          </linearGradient>
                          <linearGradient id="leakGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="lgaName" stroke="#64748b" fontSize={9} tickLine={false} />
                        <YAxis label={{ value: 'Outside LGA %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} stroke="#64748b" fontSize={9} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#090e21', borderColor: '#1e293b', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                        <Bar dataKey="careDeliveredOutsideLgaPct" name="Outward Care Travel (%)" fill="url(#travelGrad)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="localBedLeakagePct" name="Inpatient Care Leakage (%)" fill="url(#leakGrad)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#0b1226] border border-slate-800 p-5 rounded-2xl space-y-4 flex flex-col justify-between shadow-md">
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Geographic Access Disparity</h3>
                    <p className="text-[10px] text-slate-500">Assessing driving burdens and referral pathways</p>
                  </div>

                  <div className="space-y-3.5 flex-1 justify-center flex flex-col">
                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <span className="text-[9px] text-rose-400 font-mono font-bold uppercase tracking-wider block">Outward Care Referral Journey</span>
                      
                      {/* Interactive stylized travel path visualizer */}
                      <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800/60 justify-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Local Center</span>
                        <div className="flex-1 flex items-center justify-center relative min-w-[100px]">
                          <div className="w-full border-t border-dashed border-rose-500/40"></div>
                          <span className="absolute bg-[#0b1226] border border-rose-500/30 text-[9px] px-2 py-0.5 rounded-full font-mono text-rose-300 font-bold">
                            {selectedLgaTravel.avgTravelDistanceKm} km
                          </span>
                        </div>
                        <span className="text-[10px] font-black text-rose-400 truncate max-w-[120px]" title={selectedLgaTravel.topDestinationFacility}>
                          {selectedLgaTravel.topDestinationFacility.split(' ')[0]}...
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicAccessTravelInsight.travel}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl">
                      <span className="text-[9px] text-amber-500 font-mono font-bold uppercase tracking-wider block">Local Retention & Infrastructure Capacity</span>
                      <p className="text-xs text-white font-extrabold mt-1">Bed Leakage: {selectedLgaTravel.localBedLeakagePct}%</p>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1">
                        {dynamicAccessTravelInsight.leakage}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
                            <td className="p-3 text-white font-mono">{selectedFullData.physiciansPer100k}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.physiciansPer100k}</td>
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
                            <td className="p-3 text-white font-mono">{selectedFullData.providersAcceptingPatients}</td>
                            <td className="p-3 text-slate-400 font-mono">{comparisonFullData.providersAcceptingPatients}</td>
                            <td className="p-3 text-center font-mono">
                              {(() => {
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
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lga.deprivationIndex >= 4 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                  {lga.deprivationIndex} / 5
                                </span>
                              </td>
                              <td className="p-3 text-right text-slate-100">${lga.medianHouseholdIncome.toLocaleString()}</td>
                              <td className="p-3 text-right">{lga.highSchoolGradPct}%</td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'chronic') && (
                            <>
                              <td className="p-3 text-right text-slate-100">{lga.lifeExpectancyYears} yrs</td>
                              <td className="p-3 text-right text-orange-400">{lga.infantMortalityPer1000}</td>
                              <td className="p-3 text-right">{lga.diabetesPrevalencePct}%</td>
                              <td className="p-3 text-right">{lga.copdPrevalencePct}%</td>
                              <td className="p-3 text-right">{lga.hypertensionPrevalencePct}%</td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'ed') && (
                            <>
                              <td className="p-3 text-right text-slate-100">{lga.totalEdVisitsPer1000}</td>
                              <td className="p-3 text-right text-orange-400">{lga.lowAcuityCtas45Pct}%</td>
                              <td className="p-3 text-right">{lga.afterHoursEdPct}%</td>
                              <td className="p-3 text-right text-slate-100">{lga.moodAnxietyEdRatePer100k}</td>
                            </>
                          )}

                          {(explorerCategory === 'all' || explorerCategory === 'access') && (
                            <>
                              <td className="p-3 text-right text-slate-100">{lga.physiciansPer100k}</td>
                              <td className="p-3 text-right">{lga.claimsOutsideLgaPct}%</td>
                              <td className="p-3 text-right text-slate-100">{lga.acscRatePer100k}</td>
                              <td className="p-3 text-right text-slate-400">{lga.facilitiesPer10k}</td>
                              <td className="p-3 text-right text-orange-400">{lga.distanceToNearestEdKm} km</td>
                              <td className="p-3 text-right text-orange-400">{lga.distanceToNearestImagingKm} km</td>
                              <td className="p-3 text-right text-slate-100">{lga.providersAcceptingPatients}</td>
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
