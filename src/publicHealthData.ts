// Alberta Public Health, Respiratory Surveillance & Outbreak Datasets (2021 - 2026)
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
  fluASignal?: number; // Only present when a verified upstream trace exists
  rsvSignal?: number; // Only present when a verified upstream trace exists
  activityLevel: 'Low' | 'Moderate' | 'High' | 'Very High';
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  sampleDate?: string; // Latest actual wastewater collection date (YYYY-MM-DD)
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

// 2. Wastewater Pathogen Signal Monitoring (PHAC & University of Calgary)
// Signal representing normalized viral load copies relative to local baselines.
export const WASTEWATER_SIGNALS: WastewaterSignal[] = [];

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
  WASTEWATER_SIGNALS: { source: "phacFetcher (Edmonton only)", sourceVintage: "PHAC / AVD (partial)", lastUpdated: "2026-07-05", updateType: "manual", verification: "PHAC only provides Edmonton wastewater data; other zones must be manually parsed or estimated." },
  RVD_RESPIRATORY_CASE_COUNTS: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:24.174Z", updateType: 'manual' },
  RVD_IMMUNIZATION_DOSES: { source: "albertaRespiratoryVirusScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:24.174Z", updateType: 'manual' },
};
