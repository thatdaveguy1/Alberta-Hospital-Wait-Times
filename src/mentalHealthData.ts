// Alberta Mental Health & Addictions Datasets (2019 - 2026 reporting periods)
// Compiled from Alberta Substance Use Surveillance System, 
// Addiction Bed Exploration Dashboard (ABED), and CIHI Mental Health Indicators.

export interface SubstanceHarmTrend {
  year: string;
  substanceType: 'Opioids' | 'Stimulants' | 'Alcohol' | 'All Substances';
  apparentDeaths: number;
  hospitalizations: number;
  emsOverdoseResponses: number;
  albertaRatePer100k: number;
  canadaRatePer100k: number;
}

export interface AddictionBedStatus {
  id: string;
  siteName: string;
  corridor: string;
  bedType: string;
  gender: string;
  totalBeds: number;
  /** null when live availability is not currently reported by the source. */
  availableBeds: number | null;
  status: string;
  lastUpdated?: string;
  notes?: string;
}

export interface CommunityMHWait {
  year: string;
  ageGroup: 'Children & Youth (5-17)' | 'Adults (18+)' | 'Seniors (65+)';
  albertaMedianWaitDays: number;
  albertaP90WaitDays: number;
  canadaMedianWaitDays: number;
  unmetNeedPct: number; // Percent reporting unmet mental health care need
}

export interface HospitalMHSUBurden {
  year: string;
  metric: string; // e.g., 'Repeat MHSU Hospitalizations', 'Frequent ER Visits for MHSU'
  albertaRatePct: number;
  canadaRatePct: number;
  annualCount: number;
}

export interface SupportHelpline {
  name: string;
  number: string;
  availability: string;
  scope: string;
  description: string;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Apparent Substance-Related Harms & Opioid Crisis Metrics (Alberta Surveillance System)
// Note: Opioid deaths reached a record peak in Alberta during 2023 (~1,850 deaths) and have begun a gradual recovery.
export const SUBSTANCE_HARM_TRENDS: SubstanceHarmTrend[] = [];

// 2. Addiction Treatment Bed Capacity (Addiction Bed Exploration Dashboard - ABED)
// Source: findaddictionbeds.alberta.ca (live, updated once daily Mon-Fri).
// availableBeds is null when the pipeline has not yet populated live counts;
// the dashboard renders a disclosure in that case instead of "0 vacancies".
export const ADDICTION_BED_CAPACITIES: AddictionBedStatus[] = [];

// 3. Community Mental Health Counseling Access & Gaps (CIHI Shared Health Priorities / MHACS Survey)
export const COMMUNITY_MH_WAITS: CommunityMHWait[] = [];

// 4. Emergency & Inpatient Hospitalization Pressure (CIHI MHSU Indicators)
export const HOSPITAL_MHSU_BURDEN: HospitalMHSUBurden[] = [];

// 5. Official Crisis Support Directories & Helplines (AHS & Recovery Alberta Access)
export const SUPPORT_HELPLINES: SupportHelpline[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  ADDICTION_BED_CAPACITIES: { source: "Addiction Bed Exploration Dashboard (ABED) - findaddictionbeds.alberta.ca", sourceVintage: "Live (updated once daily, Mon-Fri)", lastUpdated: "2026-07-08", updateType: 'manual', verification: "Bed availability scraped from ABED prerendered HTML cards. Sites not listed on ABED retain hand-authored totalBeds with availableBeds=null until matched." },
  SUPPORT_HELPLINES: { source: "alberta211Scraper", sourceVintage: "Alberta 211 (API limitations)", lastUpdated: "2026-07-05", updateType: "manual", verification: "Helpline directory matches known resources but the API has limitations, requiring manual listing checks." },
  CIHI_MH_READMISSION_RATES: { source: "albertaSubstanceUseScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:57:36.994Z", updateType: 'manual' },
};
