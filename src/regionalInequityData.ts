// Alberta Health Community Profiles & Regional Health Inequity Datasets (2021 - 2026)
// Compiled from:
// - Alberta Health Community Profiles Dashboard (132 Local Geographic Areas)
// - Primary Health Care Indicators of Community Need
// - Canadian Index of Multiple Deprivation (CIMD)
// - AHS/StatsCan Health Facility Geolocation database
// - LGA Chronic Disease & ED Utilization statistics

export interface CommunityNeedMetric {
  lgaName: string;
  zone: 'North Zone' | 'Edmonton Zone' | 'Central Zone' | 'Calgary Zone' | 'South Zone';
  type: 'Urban Hub' | 'Suburban' | 'Rural' | 'Remote / Indigenous';
  physiciansPer100k: number;          // Prov avg ~ 115
  claimsOutsideLgaPct: number;         // % of local residents receiving primary care outside their LGA
  acscRatePer100k: number;             // Ambulatory Care Sensitive Conditions (preventable hospitalization rate)
  deprivationIndex: number;            // CIMD score (1-5, where 5 is highly deprived)
  medianHouseholdIncome: number;       // In CAD
  highSchoolGradPct: number;
  population?: number;               // LGA population (Open Alberta Figure 2.2, AHCIP registrants)
}

export interface ChronicDiseaseBurden {
  lgaName: string;
  diabetesPrevalencePct: number;       // Prov avg ~ 6.8%
  copdPrevalencePct: number;           // Prov avg ~ 3.5%
  hypertensionPrevalencePct: number;   // Prov avg ~ 21.0%
  infantMortalityPer1000: number;      // Prov avg ~ 4.3
  lifeExpectancyYears: number;         // Prov avg ~ 81.5
}

export interface EDRelianceMetric {
  lgaName: string;
  totalEdVisitsPer1000: number;        // Rate of ED visits per 1,000 population
  lowAcuityCtas45Pct: number;          // % of ED visits that are semi-urgent or non-urgent (indicator of primary care substitution)
  afterHoursEdPct: number;             // % of ED visits occurring between 18:00 and 08:00
  moodAnxietyEdRatePer100k: number;    // ED visits for mental health issues
}

export interface TravelForCare {
  lgaName: string;
  careDeliveredOutsideLgaPct: number;  // % of total primary/ambulatory visits requiring outward travel
  topDestinationFacility: string;
  avgTravelDistanceKm: number;
  localBedLeakagePct: number;          // % of local inpatient beds occupied by out-of-LGA residents vs local residents traveling out
}

export interface ServiceAccessMetric {
  lgaName: string;
  facilitiesPer10k: number;            // Medical facilities (clinics, hospitals, diagnostics) per 10,000 residents
  distanceToNearestEdKm: number;
  distanceToNearestImagingKm: number;
  providersAcceptingPatients: number;   // Active family practices accepting new rostered patients
}

// ----------------------------------------------------------------------------
// DATASETS BY REPRESENTATIVE LOCAL GEOGRAPHIC AREAS (LGAs)
// Selected to represent the contrasting geographic, economic, and health disparities across Alberta
// ----------------------------------------------------------------------------

export const COMMUNITY_NEED_PROFILES: CommunityNeedMetric[] = [];

export const CHRONIC_DISEASE_BURDEN: ChronicDiseaseBurden[] = [];

export const ED_RELIANCE_METRICS: EDRelianceMetric[] = [];

export const TRAVEL_FOR_CARE: TravelForCare[] = [];

export const SERVICE_ACCESS_METRICS: ServiceAccessMetric[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  COMMUNITY_NEED_PROFILES: { source: "openAlbertaInequityFetcher", sourceVintage: "Open Alberta (mapping/no-match limits)", lastUpdated: "2026-07-05", updateType: "manual", verification: "Open Alberta community need profiling workbook has mapping and alignment limits, requiring manual reconciliation." },
  CHRONIC_DISEASE_BURDEN: { source: "openAlbertaInequityFetcher", sourceVintage: "Open Alberta (mapping/no-match limits)", lastUpdated: "2026-07-05", updateType: "manual", verification: "Chronic disease burden sheet has alignment limits, requiring manual reconciliation." },
  ED_RELIANCE_METRICS: { source: "openAlbertaInequityFetcher", sourceVintage: "Open Alberta (mapping/no-match limits)", lastUpdated: "2026-07-05", updateType: "manual", verification: "Emergency Department reliance sheet has mapping limits, requiring manual reconciliation." },
};
