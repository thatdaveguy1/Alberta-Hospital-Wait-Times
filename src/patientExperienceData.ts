// Alberta Patient Experience & Health Service Quality Datasets (2019 - 2026)
// Compiled from HQCA FOCUS (Primary Care, ED, Hospital, Home Care, LTC) and CIHI Hospital Harm metrics.

export interface SettingExperience {
  setting: string; // e.g., 'Primary Care', 'Emergency Dept', 'Hospital Inpatient', 'Home Care', 'Long-Term Care'
  metric: string; // e.g., 'Provider Listened Carefully', 'Felt Respected', 'Involved in Decisions'
  albertaRatePct: number; // Percent responding 'Always' or 'Excellent/Very Good'
  canadaRatePct: number | null; // National comparator where available
  year: string;
}

export interface InpatientDetail {
  year: string;
  nursesCommunication: number; // % Always
  doctorsCommunication: number; // % Always
  painHelpfulness: number; // % Always
  dischargeInformation: number; // % Always
  overallExcellentRating: number; // % Rating 9-10
}

export interface EDExperienceTrend {
  year: string;
  overallCommunication: number; // % Always
  staffIntroducedThemselves: number; // % Always
  helpedWithPain: number; // % Always
  medicineSideEffectsExplained: number; // % Always
  dischargedClearInstructions: number; // % Always
}

export interface HospitalHarmMetric {
  year: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  hospitalHarmRate: number; // % of hospitalizations experiencing at least 1 preventable harm
  readmissionRate30Day: number; // % unplanned 30-day readmissions
}

export interface ComplaintCategory {
  category: string;
  percentage: number;
  description: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Voice of the Patient: High-Level Satisfaction & Communication across Settings (HQCA FOCUS)
export const PATIENT_VOICE_BY_SETTING: SettingExperience[] = [];

// 2. Inpatient Experience Drilldown Trends (HQCA Hospital Care Survey)
export const INPATIENT_EXPERIENCE_TRENDS: InpatientDetail[] = [];

// 3. Emergency Department Specific Experience Trends (HQCA EDPEC Survey)
export const ED_EXPERIENCE_TRENDS: EDExperienceTrend[] = [];

// 4. Clinical Safety Outcomes: Hospital-Preventable Harm Rates & Readmissions (CIHI)
// Direct measure of clinical quality as a balance to subjective patient experience metrics.
export const CLINICAL_SAFETY_TRENDS: HospitalHarmMetric[] = [];

// 5. Patient Complaints & Concerns Distribution (AHS Patient Relations System)
export const PATIENT_COMPLAINTS: ComplaintCategory[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  PATIENT_VOICE_BY_SETTING: { source: "goodcaringScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:14.680Z", updateType: 'manual' },
  INPATIENT_EXPERIENCE_TRENDS_HQCA: { source: "goodcaringScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:14.680Z", updateType: 'manual' },
  CIHI_ALL_READMISSION_RATES: { source: "goodcaringScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:14.680Z", updateType: 'manual' },
  CIHI_ACSC_HOSPITALIZATIONS: { source: "goodcaringScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:14.680Z", updateType: 'manual' },
  CIHI_WAIT_TIME_SATISFACTION: { source: "goodcaringScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:14.680Z", updateType: 'manual' },
};
