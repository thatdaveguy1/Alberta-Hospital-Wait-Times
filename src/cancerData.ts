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
export const CANCER_BURDEN_STATS: CancerBurdenItem[] = [];

// 2. Organized Cancer Screening Program Rates by Geographic Zone (Screening for Life / IHDA 2024-2025)
export const CANCER_SCREENING_RATES: CancerScreeningZoneRate[] = [];

// 3. Cancer Surgery Wait Time Trends (CIHI 50th and 90th percentile wait days 2019 - 2025)
export const CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[] = [];

// 4. Radiation Therapy Wait Time Trends & National Compliance Targets (CIHI Indicators 2019 - 2025)
export const RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[] = [];

// 5. Alberta Cancer Centres and Diagnostic/Systemic Facilities (AHS Treatment Directory)
export const ALBERTA_CANCER_CENTRES: CancerCentreLocation[] = [];
