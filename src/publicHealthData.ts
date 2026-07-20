// Alberta Public Health, Respiratory Surveillance & Outbreak Datasets (RVD/PHAC; history from 2009 influenza seasons / 2021 lab / 2023 RVD WW)
// Compiled from:
// - AHS Respiratory Virus Surveillance Dashboard & ProvLab Updates
// - PHAC Canadian Respiratory Virus Surveillance (FluWatch) & Wastewater Monitoring
// - Open Alberta Notifiable Disease Summaries & Alberta Regional Dashboard (Immunization by Age 2)
// - AHS Environmental Public Health active advisories and orders.

export interface RespiratoryVirusMetric {
  season: string; // e.g. '2024-2025', '2025-2026'
  virus: 'Influenza A' | 'Influenza B' | 'COVID-19' | 'RSV';
  testsPerformed: number;
  positivityRatePct: number;
  hospitalizations: number;
  icuAdmissions: number;
}

export interface WastewaterSignal {
  site: string; // e.g. 'Calgary (Bonnybrook)', 'Edmonton (Gold Bar)', 'Red Deer', 'Grande Prairie', 'Lethbridge'
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'North Zone' | 'South Zone';
  populationServed: number;
  covidSignal: number; // Normalized viral load (copies/mL or index)
  /** @deprecated Do not populate from PHAC leftovers; RVD snapshot is COVID-only. */
  fluASignal?: number;
  /** @deprecated Do not populate from PHAC leftovers; RVD snapshot is COVID-only. */
  rsvSignal?: number;
  activityLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  sampleDate?: string; // Latest actual wastewater collection date (YYYY-MM-DD)
}

/** Full Alberta RVD wastewater history (COVID normalized load). */
export interface WastewaterTimeSeriesPoint {
  site: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'North Zone' | 'South Zone';
  sampleDate: string; // YYYY-MM-DD
  covidSignal: number;
  source: 'alberta-rvd';
}

/** PHAC Infobase multi-pathogen wastewater history (separate scale from RVD). */
export interface PhacWastewaterTimeSeriesPoint {
  site: string;
  locationRaw: string;
  sampleDate: string; // YYYY-MM-DD
  pathogen: 'covid' | 'fluA' | 'fluB' | 'rsv';
  viralLoad: number;
  sevenDayAvg?: number;
  source: 'phac-wastewater-daily' | 'phac-wastewater-legacy';
}

export interface RvdRespiratoryCaseCount {
  virus: string;
  weekEnding: string; // YYYY-MM-DD
  count: number;
}

export interface RvdInfluenzaSeasonCount {
  season: string; // e.g. '2019-2020'
  weekEnding: string; // YYYY-MM-DD
  count: number;
}

export interface RvdLabTestPositivity {
  virus: string; // e.g. 'SARS-CoV-2', 'Influenza (All)', 'Respiratory Syncytial Virus'
  weekEnding: string; // YYYY-MM-DD
  percentPositive: number;
  totalTests?: number;
}

export interface RvdImmunizationDose {
  season: string;
  weekEnding: string;
  doses: number;
}

export interface ImmunizationCoverage {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'North Zone' | 'South Zone' | 'Alberta';
  ageMilestone: 'Age 2';
  antigen: 'DTaP-IPV-Hib (Dose 4)' | 'Measles-Containing (Dose 1)';
  coverageRatePct: number; // Target is typically 95%
  targetPct: number;
  reportingYear: string;
}

export interface NotifiableDiseaseIncidence {
  year: string;
  disease: 'Pertussis (Whooping Cough)' | 'Measles' | 'Salmonellosis' | 'Hepatitis C (Acute/Chronic)';
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'North Zone' | 'South Zone' | 'Alberta';
  casesCount: number;
  ratePer100k: number;
}

export interface EnvironmentalAdvisory {
  id: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'North Zone' | 'South Zone' | 'Alberta';
  location: string;
  type: 'Cyanobacteria (Blue-Green Algae)' | 'Air Quality Advisory' | 'Boil Water Advisory' | 'Water Quality Advisory';
  issueDescription: string;
  dateDeclared: string;
  status: 'Active' | 'Resolved';
  precautionaryMeasures: string;
}

export interface OutbreakGuidelines {
  settingType: string;
  triggerThreshold: string;
  isolationProtocol: string;
  antiviralPolicy: string;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Seasonal Respiratory Virus Detections & Burden (AHS Respiratory Surveillance)
// Compiled from actual surveillance reports for late-2024 through March 2026 reporting periods.
export const RESPIRATORY_VIRUS_SURVEILLANCE: RespiratoryVirusMetric[] = [];

// 2. Wastewater Pathogen Signal Monitoring (Alberta RVD latest snapshot — COVID only)
export const WASTEWATER_SIGNALS: WastewaterSignal[] = [];

// 2b. Full Alberta RVD wastewater COVID time series (from ~2023-07)
export const WASTEWATER_TIME_SERIES: WastewaterTimeSeriesPoint[] = [];

// 2c. PHAC Infobase multi-pathogen wastewater time series (separate scale)
export const PHAC_WASTEWATER_TIME_SERIES: PhacWastewaterTimeSeriesPoint[] = [];

// 2d. Alberta RVD weekly case counts (influenza / RSV / COVID)
export const RVD_RESPIRATORY_CASE_COUNTS: RvdRespiratoryCaseCount[] = [];

// 2e. Alberta RVD influenza season overlays (2009+)
export const RVD_INFLUENZA_SEASON_COUNTS: RvdInfluenzaSeasonCount[] = [];

// 2f. Alberta RVD laboratory percent positivity (2021+)
export const RVD_LAB_TEST_POSITIVITY: RvdLabTestPositivity[] = [];

// 2g. Alberta RVD influenza immunization doses by epi-week
export const RVD_IMMUNIZATION_DOSES: RvdImmunizationDose[] = [];

// 3. Childhood Immunization Coverage Rates by Age 2 (Open Alberta / Regional Dashboard)
// Real-world immunization coverage probabilities demonstrating the sub-optimal provincial baseline.
export const CHILDHOOD_IMMUNIZATION_COVERAGE: ImmunizationCoverage[] = [];

// 4. Notifiable Communicable Disease Incidence Rates (Open Alberta Summary / IHDA)
// Documenting the emergence of preventable disease spikes (e.g., Pertussis resurgence).
export const NOTIFIABLE_DISEASE_INCIDENCE: NotifiableDiseaseIncidence[] = [];

// 5. Environmental Public Health Active Advisories & Closures (AHS EPH)
export const ENVIRONMENTAL_ADVISORIES: EnvironmentalAdvisory[] = [];

// 6. Outbreak prevention, controls, and case tracking thresholds (AHS CDC guidelines)
export const OUTBREAK_PROTOCOLS: Record<string, OutbreakGuidelines> = {};

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  WASTEWATER_SIGNALS: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD wastewater", lastUpdated: "2026-07-05", updateType: "manual" },
  WASTEWATER_TIME_SERIES: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD wastewater", lastUpdated: "2026-07-05", updateType: "manual" },
  PHAC_WASTEWATER_TIME_SERIES: { source: "phacFetcher", sourceVintage: "PHAC wastewater_daily", lastUpdated: "2026-07-05", updateType: "manual" },
  RVD_RESPIRATORY_CASE_COUNTS: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD summary", lastUpdated: "2026-07-05T15:57:24.174Z", updateType: 'manual' },
  RVD_INFLUENZA_SEASON_COUNTS: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD summary seasons", lastUpdated: "2026-07-05", updateType: "manual" },
  RVD_LAB_TEST_POSITIVITY: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD laboratory-testing", lastUpdated: "2026-07-05", updateType: "manual" },
  RVD_IMMUNIZATION_DOSES: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Alberta RVD immunizations", lastUpdated: "2026-07-05T15:57:24.174Z", updateType: 'manual' },
};
