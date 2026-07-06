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

export const COMMUNITY_NEED_PROFILES: CommunityNeedMetric[] = [
  {
    lgaName: 'Calgary - West Bow',
    zone: 'Calgary Zone',
    type: 'Urban Hub',
    physiciansPer100k: 168.4,
    claimsOutsideLgaPct: 18.2,
    acscRatePer100k: 184.2,
    deprivationIndex: 1,
    medianHouseholdIncome: 112500,
    highSchoolGradPct: 94.5
  },
  {
    lgaName: 'Edmonton - Woodcroft',
    zone: 'Edmonton Zone',
    type: 'Suburban',
    physiciansPer100k: 114.2,
    claimsOutsideLgaPct: 35.6,
    acscRatePer100k: 295.4,
    deprivationIndex: 2,
    medianHouseholdIncome: 84300,
    highSchoolGradPct: 88.2
  },
  {
    lgaName: 'Red Deer - North',
    zone: 'Central Zone',
    type: 'Rural',
    physiciansPer100k: 84.5,
    claimsOutsideLgaPct: 54.1,
    acscRatePer100k: 412.8,
    deprivationIndex: 3,
    medianHouseholdIncome: 74200,
    highSchoolGradPct: 81.4
  },
  {
    lgaName: 'South rural (Lethbridge/Cardston area)',
    zone: 'South Zone',
    type: 'Rural',
    physiciansPer100k: 58.2,
    claimsOutsideLgaPct: 68.4,
    acscRatePer100k: 589.5,
    deprivationIndex: 4,
    medianHouseholdIncome: 63100,
    highSchoolGradPct: 76.5
  },
  {
    lgaName: 'Wood Buffalo / Fort McKay',
    zone: 'North Zone',
    type: 'Remote / Indigenous',
    physiciansPer100k: 32.4,
    claimsOutsideLgaPct: 82.3,
    acscRatePer100k: 845.1,
    deprivationIndex: 5,
    medianHouseholdIncome: 58900,
    highSchoolGradPct: 64.1
  }
];

export const CHRONIC_DISEASE_BURDEN: ChronicDiseaseBurden[] = [
  {
    lgaName: 'Calgary - West Bow',
    diabetesPrevalencePct: 4.8,
    copdPrevalencePct: 1.9,
    hypertensionPrevalencePct: 15.2,
    infantMortalityPer1000: 2.1,
    lifeExpectancyYears: 84.6
  },
  {
    lgaName: 'Edmonton - Woodcroft',
    diabetesPrevalencePct: 6.5,
    copdPrevalencePct: 3.1,
    hypertensionPrevalencePct: 19.8,
    infantMortalityPer1000: 3.8,
    lifeExpectancyYears: 81.2
  },
  {
    lgaName: 'Red Deer - North',
    diabetesPrevalencePct: 8.1,
    copdPrevalencePct: 4.4,
    hypertensionPrevalencePct: 23.5,
    infantMortalityPer1000: 4.9,
    lifeExpectancyYears: 79.5
  },
  {
    lgaName: 'South rural (Lethbridge/Cardston area)',
    diabetesPrevalencePct: 9.4,
    copdPrevalencePct: 5.8,
    hypertensionPrevalencePct: 27.2,
    infantMortalityPer1000: 5.6,
    lifeExpectancyYears: 77.1
  },
  {
    lgaName: 'Wood Buffalo / Fort McKay',
    diabetesPrevalencePct: 12.8,
    copdPrevalencePct: 8.4,
    hypertensionPrevalencePct: 32.1,
    infantMortalityPer1000: 8.2,
    lifeExpectancyYears: 72.8
  }
];

export const ED_RELIANCE_METRICS: EDRelianceMetric[] = [
  {
    lgaName: 'Calgary - West Bow',
    totalEdVisitsPer1000: 142,
    lowAcuityCtas45Pct: 24.5,
    afterHoursEdPct: 31.4,
    moodAnxietyEdRatePer100k: 310
  },
  {
    lgaName: 'Edmonton - Woodcroft',
    totalEdVisitsPer1000: 220,
    lowAcuityCtas45Pct: 38.2,
    afterHoursEdPct: 45.1,
    moodAnxietyEdRatePer100k: 580
  },
  {
    lgaName: 'Red Deer - North',
    totalEdVisitsPer1000: 410,
    lowAcuityCtas45Pct: 52.3,
    afterHoursEdPct: 54.8,
    moodAnxietyEdRatePer100k: 840
  },
  {
    lgaName: 'South rural (Lethbridge/Cardston area)',
    totalEdVisitsPer1000: 640,
    lowAcuityCtas45Pct: 64.8,
    afterHoursEdPct: 61.2,
    moodAnxietyEdRatePer100k: 1120
  },
  {
    lgaName: 'Wood Buffalo / Fort McKay',
    totalEdVisitsPer1000: 950,
    lowAcuityCtas45Pct: 78.5,
    afterHoursEdPct: 69.8,
    moodAnxietyEdRatePer100k: 1840
  }
];

export const TRAVEL_FOR_CARE: TravelForCare[] = [
  {
    lgaName: 'Calgary - West Bow',
    careDeliveredOutsideLgaPct: 18.2,
    topDestinationFacility: 'Foothills Medical Centre',
    avgTravelDistanceKm: 4.8,
    localBedLeakagePct: 11.2
  },
  {
    lgaName: 'Edmonton - Woodcroft',
    careDeliveredOutsideLgaPct: 35.6,
    topDestinationFacility: 'Royal Alexandra Hospital',
    avgTravelDistanceKm: 12.4,
    localBedLeakagePct: 24.5
  },
  {
    lgaName: 'Red Deer - North',
    careDeliveredOutsideLgaPct: 54.1,
    topDestinationFacility: 'Red Deer Regional Hospital',
    avgTravelDistanceKm: 42.1,
    localBedLeakagePct: 48.2
  },
  {
    lgaName: 'South rural (Lethbridge/Cardston area)',
    careDeliveredOutsideLgaPct: 68.4,
    topDestinationFacility: 'Chinook Regional Hospital (Lethbridge)',
    avgTravelDistanceKm: 94.5,
    localBedLeakagePct: 65.8
  },
  {
    lgaName: 'Wood Buffalo / Fort McKay',
    careDeliveredOutsideLgaPct: 82.3,
    topDestinationFacility: 'Northern Lights Regional Health Centre',
    avgTravelDistanceKm: 284.1,
    localBedLeakagePct: 84.5
  }
];

export const SERVICE_ACCESS_METRICS: ServiceAccessMetric[] = [
  {
    lgaName: 'Calgary - West Bow',
    facilitiesPer10k: 14.2,
    distanceToNearestEdKm: 2.1,
    distanceToNearestImagingKm: 1.8,
    providersAcceptingPatients: 18
  },
  {
    lgaName: 'Edmonton - Woodcroft',
    facilitiesPer10k: 8.5,
    distanceToNearestEdKm: 6.4,
    distanceToNearestImagingKm: 4.5,
    providersAcceptingPatients: 6
  },
  {
    lgaName: 'Red Deer - North',
    facilitiesPer10k: 3.2,
    distanceToNearestEdKm: 28.5,
    distanceToNearestImagingKm: 24.1,
    providersAcceptingPatients: 2
  },
  {
    lgaName: 'South rural (Lethbridge/Cardston area)',
    facilitiesPer10k: 1.4,
    distanceToNearestEdKm: 74.2,
    distanceToNearestImagingKm: 74.2,
    providersAcceptingPatients: 0
  },
  {
    lgaName: 'Wood Buffalo / Fort McKay',
    facilitiesPer10k: 0.6,
    distanceToNearestEdKm: 145.8,
    distanceToNearestImagingKm: 145.8,
    providersAcceptingPatients: 0
  }
];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  COMMUNITY_NEED_PROFILES: { source: "openAlbertaInequityFetcher", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:14.181Z", updateType: "auto" },
  CHRONIC_DISEASE_BURDEN: { source: "openAlbertaInequityFetcher", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:14.181Z", updateType: "auto" },
  ED_RELIANCE_METRICS: { source: "openAlbertaInequityFetcher", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:14.181Z", updateType: "auto" },
};
