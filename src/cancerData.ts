// Alberta Cancer Care & Screening Datasets (2019 - 2026 reporting periods)
// Compiled from Cancer Care Alberta 2026 Report on Cancer Statistics, 
// CIHI Priority Procedures Wait Times (2025 Release), and Screening for Life reports.

export interface CancerBurdenItem {
  cancerType: string;
  projectedCases2026: number;
  crudeIncidenceRate: number; // per 100k
  ageStandardizedIncidenceRate: number; // per 100k
  projectedDeaths2026: number;
  crudeMortalityRate: number; // per 100k
  ageStandardizedMortalityRate: number; // per 100k
  fiveYearRelativeSurvivalPct: number;
}

export interface CancerScreeningZoneRate {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  breastScreeningPct: number; // mammography within last 2 years (target: 70%)
  cervicalScreeningPct: number; // pap test within last 3 years (target: 80%)
  colorectalScreeningPct: number; // FIT test within last 2 years (target: 60%)
  lungScreeningEnrollmentCount: number; // pilot rollout enrollment
}

export interface CancerSurgeryWaitTrend {
  year: string;
  cancerType: 'Breast' | 'Colorectal' | 'Lung' | 'Prostate' | 'Bladder';
  albertaP50Days: number;
  albertaP90Days: number;
  canadaP50Days: number;
  canadaP90Days: number;
  completedVolume: number;
}

export interface RadiationTherapyCompliance {
  year: string;
  albertaPctWithinBenchmark: number; // Treated within 28 days target (CAR/CIHI benchmark)
  canadaPctWithinBenchmark: number;
  albertaP50WaitDays: number;
  albertaP90WaitDays: number;
}

export interface CancerCentreLocation {
  id: string;
  name: string;
  type: 'Tertiary Cancer Centre' | 'Regional Cancer Centre' | 'Community Cancer Centre';
  city: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  address: string;
  services: string[];
  systemicTherapyAvailable: boolean;
  radiationTherapyAvailable: boolean;
  surgicalOncologyAvailable: boolean;
  latitude: number;
  longitude: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Projected Cancer Burden & Survival Outcomes in Alberta (CCA 2026 Report on Cancer Statistics)
export const CANCER_BURDEN_STATS: CancerBurdenItem[] = [
  {
    cancerType: 'Breast Cancer',
    projectedCases2026: 3450,
    crudeIncidenceRate: 151.2,
    ageStandardizedIncidenceRate: 124.5,
    projectedDeaths2026: 480,
    crudeMortalityRate: 21.1,
    ageStandardizedMortalityRate: 16.8,
    fiveYearRelativeSurvivalPct: 89.2
  },
  {
    cancerType: 'Colorectal Cancer',
    projectedCases2026: 2350,
    crudeIncidenceRate: 103.0,
    ageStandardizedIncidenceRate: 85.2,
    projectedDeaths2026: 780,
    crudeMortalityRate: 34.2,
    ageStandardizedMortalityRate: 27.5,
    fiveYearRelativeSurvivalPct: 64.8
  },
  {
    cancerType: 'Lung Cancer',
    projectedCases2026: 2890,
    crudeIncidenceRate: 126.7,
    ageStandardizedIncidenceRate: 104.8,
    projectedDeaths2026: 1650,
    crudeMortalityRate: 72.3,
    ageStandardizedMortalityRate: 59.1,
    fiveYearRelativeSurvivalPct: 22.4 // Lags severely due to late-stage detection
  },
  {
    cancerType: 'Prostate Cancer',
    projectedCases2026: 3120,
    crudeIncidenceRate: 136.8,
    ageStandardizedIncidenceRate: 112.4,
    projectedDeaths2026: 420,
    crudeMortalityRate: 18.4,
    ageStandardizedMortalityRate: 15.1,
    fiveYearRelativeSurvivalPct: 91.5
  },
  {
    cancerType: 'Bladder Cancer',
    projectedCases2026: 920,
    crudeIncidenceRate: 40.3,
    ageStandardizedIncidenceRate: 32.8,
    projectedDeaths2026: 210,
    crudeMortalityRate: 9.2,
    ageStandardizedMortalityRate: 7.2,
    fiveYearRelativeSurvivalPct: 75.1
  },
  {
    cancerType: 'Melanoma',
    projectedCases2026: 1150,
    crudeIncidenceRate: 50.4,
    ageStandardizedIncidenceRate: 41.6,
    projectedDeaths2026: 130,
    crudeMortalityRate: 5.7,
    ageStandardizedMortalityRate: 4.5,
    fiveYearRelativeSurvivalPct: 88.5
  }
];

// 2. Organized Cancer Screening Program Rates by Geographic Zone (Screening for Life / IHDA 2024-2025)
export const CANCER_SCREENING_RATES: CancerScreeningZoneRate[] = [
  {
    zone: 'Calgary Zone',
    breastScreeningPct: 66.4, // Target: 70%
    cervicalScreeningPct: 71.2, // Target: 80%
    colorectalScreeningPct: 44.1, // Target: 60%
    lungScreeningEnrollmentCount: 1450
  },
  {
    zone: 'Edmonton Zone',
    breastScreeningPct: 64.8,
    cervicalScreeningPct: 69.5,
    colorectalScreeningPct: 42.8,
    lungScreeningEnrollmentCount: 1680
  },
  {
    zone: 'Central Zone',
    breastScreeningPct: 59.2,
    cervicalScreeningPct: 63.8,
    colorectalScreeningPct: 38.5,
    lungScreeningEnrollmentCount: 520
  },
  {
    zone: 'South Zone',
    breastScreeningPct: 57.5,
    cervicalScreeningPct: 61.2,
    colorectalScreeningPct: 36.9,
    lungScreeningEnrollmentCount: 310
  },
  {
    zone: 'North Zone',
    breastScreeningPct: 52.1, // Significant rural access lag
    cervicalScreeningPct: 56.4,
    colorectalScreeningPct: 32.4, // Deep gaps in FIT kit distribution/positivity follow-up
    lungScreeningEnrollmentCount: 280
  },
  {
    zone: 'Alberta',
    breastScreeningPct: 62.8,
    cervicalScreeningPct: 66.8,
    colorectalScreeningPct: 40.5,
    lungScreeningEnrollmentCount: 4240
  }
];

// 3. Cancer Surgery Wait Time Trends (CIHI 50th and 90th percentile wait days 2019 - 2025)
export const CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[] = [
  // Breast Cancer Surgery
  { year: '2019', cancerType: 'Breast', albertaP50Days: 19, albertaP90Days: 41, canadaP50Days: 16, canadaP90Days: 34, completedVolume: 3120 },
  { year: '2021', cancerType: 'Breast', albertaP50Days: 24, albertaP90Days: 49, canadaP50Days: 19, canadaP90Days: 39, completedVolume: 2950 },
  { year: '2023', cancerType: 'Breast', albertaP50Days: 28, albertaP90Days: 56, canadaP50Days: 21, canadaP90Days: 42, completedVolume: 3240 },
  { year: '2025', cancerType: 'Breast', albertaP50Days: 23, albertaP90Days: 48, canadaP50Days: 18, canadaP90Days: 38, completedVolume: 3410 },

  // Colorectal Cancer Surgery
  { year: '2019', cancerType: 'Colorectal', albertaP50Days: 22, albertaP90Days: 48, canadaP50Days: 19, canadaP90Days: 42, completedVolume: 1850 },
  { year: '2021', cancerType: 'Colorectal', albertaP50Days: 29, albertaP90Days: 59, canadaP50Days: 23, canadaP90Days: 49, completedVolume: 1680 },
  { year: '2023', cancerType: 'Colorectal', albertaP50Days: 34, albertaP90Days: 68, canadaP50Days: 25, canadaP90Days: 52, completedVolume: 1910 },
  { year: '2025', cancerType: 'Colorectal', albertaP50Days: 28, albertaP90Days: 58, canadaP50Days: 21, canadaP90Days: 45, completedVolume: 2040 },

  // Lung Cancer Surgery
  { year: '2019', cancerType: 'Lung', albertaP50Days: 25, albertaP90Days: 55, canadaP50Days: 21, canadaP90Days: 48, completedVolume: 1120 },
  { year: '2021', cancerType: 'Lung', albertaP50Days: 32, albertaP90Days: 68, canadaP50Days: 26, canadaP90Days: 56, completedVolume: 980 },
  { year: '2023', cancerType: 'Lung', albertaP50Days: 38, albertaP90Days: 78, canadaP50Days: 28, canadaP90Days: 60, completedVolume: 1180 },
  { year: '2025', cancerType: 'Lung', albertaP50Days: 31, albertaP90Days: 65, canadaP50Days: 23, canadaP90Days: 52, completedVolume: 1250 }
];

// 4. Radiation Therapy Wait Time Trends & National Compliance Targets (CIHI Indicators 2019 - 2025)
export const RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[] = [
  { year: '2019', albertaPctWithinBenchmark: 95.8, canadaPctWithinBenchmark: 96.4, albertaP50WaitDays: 8, albertaP90WaitDays: 22 },
  { year: '2020', albertaPctWithinBenchmark: 92.4, canadaPctWithinBenchmark: 94.1, albertaP50WaitDays: 11, albertaP90WaitDays: 26 },
  { year: '2021', albertaPctWithinBenchmark: 88.5, canadaPctWithinBenchmark: 92.5, albertaP50WaitDays: 14, albertaP90WaitDays: 32 },
  { year: '2022', albertaPctWithinBenchmark: 84.1, canadaPctWithinBenchmark: 90.2, albertaP50WaitDays: 16, albertaP90WaitDays: 38 },
  { year: '2023', albertaPctWithinBenchmark: 86.8, canadaPctWithinBenchmark: 91.5, albertaP50WaitDays: 15, albertaP90WaitDays: 35 },
  { year: '2024', albertaPctWithinBenchmark: 89.4, canadaPctWithinBenchmark: 93.1, albertaP50WaitDays: 12, albertaP90WaitDays: 30 },
  { year: '2025', albertaPctWithinBenchmark: 92.1, canadaPctWithinBenchmark: 94.8, albertaP50WaitDays: 10, albertaP90WaitDays: 25 }
];

// 5. Alberta Cancer Centres and Diagnostic/Systemic Facilities (AHS Treatment Directory)
export const ALBERTA_CANCER_CENTRES: CancerCentreLocation[] = [
  {
    id: 'CC-001',
    name: 'Cross Cancer Institute',
    type: 'Tertiary Cancer Centre',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    address: '11560 University Ave',
    services: ['Radiation Therapy', 'Systemic Chemotherapy', 'Surgical Oncology', 'Central Clinical Trials', 'Inpatient Cancer Beds'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: true,
    latitude: 53.5218,
    longitude: -113.5262
  },
  {
    id: 'CC-002',
    name: 'Arthur J.E. Child Comprehensive Cancer Centre',
    type: 'Tertiary Cancer Centre',
    city: 'Calgary',
    zone: 'Calgary Zone',
    address: '1403 29 St NW',
    services: ['Advanced Radiation Oncology', 'High-Volume Chemotherapy Infusions', 'Complex Surgical Oncology', 'Bone Marrow Transplants', 'Oncology EMR Hub'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: true,
    latitude: 51.0638,
    longitude: -114.1305
  },
  {
    id: 'CC-003',
    name: 'Jack Ady Cancer Centre',
    type: 'Regional Cancer Centre',
    city: 'Lethbridge',
    zone: 'South Zone',
    address: '960 19 St S',
    services: ['Linear Accelerator Radiation', 'Outpatient Chemotherapy', 'Cancer Navigation Support'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: false,
    latitude: 49.6865,
    longitude: -112.8123
  },
  {
    id: 'CC-004',
    name: 'Central Alberta Cancer Centre',
    type: 'Regional Cancer Centre',
    city: 'Red Deer',
    zone: 'Central Zone',
    address: '3942 50A Ave',
    services: ['Linear Accelerator Radiation', 'Systemic Therapy Clinic', 'Cancer Patient Navigation'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: false,
    latitude: 52.2618,
    longitude: -113.8115
  },
  {
    id: 'CC-005',
    name: 'Grande Prairie Cancer Centre',
    type: 'Regional Cancer Centre',
    city: 'Grande Prairie',
    zone: 'North Zone',
    address: '11205 110 St',
    services: ['Radiation Therapy Suite', 'Local Chemotherapy Dispensing', 'Multidisciplinary Supportive Care'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: true,
    surgicalOncologyAvailable: false,
    latitude: 55.1812,
    longitude: -118.8021
  },
  {
    id: 'CC-006',
    name: 'Margery E. Yuill Cancer Centre',
    type: 'Regional Cancer Centre',
    city: 'Medicine Hat',
    zone: 'South Zone',
    address: '666 5 St SW',
    services: ['Outpatient Chemotherapy Support', 'Clinical Oncology Consultation', 'Patient Navigation Services'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: false, // Relies on Jack Ady for radiation
    surgicalOncologyAvailable: false,
    latitude: 50.0354,
    longitude: -110.6865
  },
  {
    id: 'CC-007',
    name: 'Fort McMurray Community Cancer Clinic',
    type: 'Community Cancer Centre',
    city: 'Fort McMurray',
    zone: 'North Zone',
    address: '7 Hospital St',
    services: ['Local Chemotherapy Administration', 'Tele-Oncology Reviews'],
    systemicTherapyAvailable: true,
    radiationTherapyAvailable: false,
    surgicalOncologyAvailable: false,
    latitude: 56.7245,
    longitude: -111.3804
  }
];
