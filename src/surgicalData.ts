// Normalized Alberta Surgical Wait Times Data Set (2025 - 2026 reporting periods)
// Strictly typed according to the user requested normalized data model.

export interface SurgicalRecord {
  id: string;
  source_name: string;
  source_url: string;
  reporting_period_start: string;
  reporting_period_end: string;
  geography_type: 'Province' | 'Zone' | 'Facility' | 'Specialist' | 'Health Region';
  geography_name: string;
  facility_id?: string;
  facility_name?: string;
  specialist_id?: string;
  specialist_name?: string;
  specialty?: string;
  procedure_group: string;
  procedure_name: string;
  wait_segment: 'Referral-to-consult' | 'Decision-to-surgery' | 'Referral-to-treatment';
  metric_name: 'Median wait' | 'Average wait' | '90th percentile' | '% within benchmark' | 'Volume';
  metric_value: number;
  unit: 'weeks' | 'days' | 'percent' | 'count';
  benchmark_value?: string;
  method_note?: string;
}

export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  zone: string;
  primary_facility: string;
  consult_wait_days_90th: number;
  surgery_wait_days_90th: number;
  completed_surgeries_3m: number;
  cpsa_id: string;
}

export interface FacilitySurgicalCapacity {
  id: string;
  name: string;
  city: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  or_utilization_rate: number; // percentage
  chartered_partner_status: boolean; // is it a chartered surgical facility?
  specialties_offered: string[];
}

// 1. Core Normalized Surgical Records (Alberta Wait Times Reporting & CIHI)
export const SURGICAL_RECORDS: SurgicalRecord[] = [];

// 2. ABJHI & IIHO Orthopedic Hip & Knee Specialty Wait Times by Geo (Quarterly 2026)
export interface JointWaitRecord {
  geography: string;
  procedure: 'Hip Replacement' | 'Knee Replacement';
  count_completed: number;
  consult_wait_days_90th: number; // IIHO Wait 1
  surgery_wait_days_90th: number; // IIHO Wait 2
  shortest_25_days: number;
  average_days: number;
  longest_10_days: number; // 90th percentile
}

export const ORTHOPEDIC_SPECIALTY_RECORDS: JointWaitRecord[] = [];

// 3. Facility Details & Capacity Metrics (AHS and Acute Care Alberta Partnerships)
export const SURGICAL_FACILITIES: FacilitySurgicalCapacity[] = [];

// 4. Specialist Details - Wait times and CPSA lookups
export const SPECIALISTS_LIST: Specialist[] = [];

// 5. CIHI Provincial Benchmark Comparators (National Context)
export interface CIHIComparatorRecord {
  province: string;
  hip_within_benchmark: number; // percentage
  knee_within_benchmark: number; // percentage
  cataract_within_benchmark: number; // percentage
  mri_median_wait_days: number;
}

export const CIHI_PROVINCIAL_COMPARATORS: CIHIComparatorRecord[] = [];

// 6. StatsCan 2024 Survey Health Care Access (Pre-Surgical Specialist Access metrics)
export const STATSCAN_SATISFACTION_STATS = {
  reporting_title: '',
  survey_period: '',
  metrics_alberta: {
    satisfied_with_wait: null as number | null,
    unsatisfied_with_wait: null as number | null,
    wait_affected_life_negatively: null as number | null,
    waiting_segment_distribution: [] as { segment: string; value: number }[],
    life_impact_categories: [] as { impact: string; value: number }[],
  }
};

// 7. Fraser Institute - Waiting Your Turn (Specialty Benchmarks Weeks)
// Cleared: no verified live upstream in this fallback module.
export const FRASER_MEDIAN_WEEKS_2025: {
  specialty: string;
  gp_to_consult: number;
  consult_to_surgery: number;
  total: number;
}[] = [];

// 8. Historical Wait Trends (CIHI Priority Procedures 2015 - 2026)
export interface HistoricalTrend {
  year: string;
  hip_replacement_median: number; // weeks
  knee_replacement_median: number; // weeks
  cataract_surgery_median: number; // weeks
  mri_scan_median: number; // weeks
  ct_scan_median: number; // weeks
}

export const HISTORICAL_WAIT_TRENDS: HistoricalTrend[] = [];

// 9. StatsCan Demographic Breaks (Table 1, 2, 3 details)
export interface StatsCanDemographic {
  category: string; // Age, Gender, Referral, Geography
  dimension: string; // e.g. "18-34 years", "Female"
  wait_under_1m: number; // percentage
  wait_1_to_3m: number; // percentage
  wait_3_to_6m: number; // percentage
  wait_over_6m: number; // percentage
  satisfied_percentage: number;
  life_affected_percentage: number;
}

export const STATSCAN_DEMOGRAPHICS: StatsCanDemographic[] = [];

// 10. Data Ingestion Pipeline Sources Configuration & Scraper Codebases
export interface IngestionSource {
  id: string;
  name: string;
  priority: number;
  role: 'Primary' | 'Secondary' | 'National Comparator' | 'Specialty' | 'Survey Context' | 'Capacity Context' | 'QA Fallback';
  url: string;
  api_or_selector: string;
  description: string;
  crawler_code_type: 'node' | 'python';
  crawler_code: string;
  scraping_fields: string[];
}

export const DATA_INGESTION_SOURCES: IngestionSource[] = [];

// 11. Facility Performance Side-by-Side Comparisons
export interface FacilityComparisonRecord {
  facility_id: string;
  name: string;
  city: string;
  zone: string;
  or_utilization: number;
  total_surgeons: number;
  active_waitlist: number;
  ortho_wait_90th_days: number;
  cataract_wait_90th_days: number;
  completed_this_month: number;
  chartered: boolean;
}

export const FACILITY_COMPARISONS: FacilityComparisonRecord[] = [];

// 12. Specialist detailed parameters for Specialist-to-Specialist comparisons
export interface SpecialistComparisonRecord {
  id: string;
  name: string;
  specialty: string;
  zone: string;
  facility: string;
  wait1_days_90th: number;
  wait2_days_90th: number;
  volume_3m: number;
  patient_satisfaction: number; // 0 - 100%
  experience_years: number;
  avg_surgery_time_mins: number;
}

export const SPECIALIST_COMPARISONS: SpecialistComparisonRecord[] = [];


// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  SURGICAL_RECORDS: {
    source: 'Alberta Wait Times Reporting (Power BI scraper)',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
  ORTHOPEDIC_SPECIALTY_RECORDS: {
    source: 'ABJHI & IIHO orthopedic specialty feeds',
    sourceVintage: 'Quarterly 2026',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
  CIHI_PROVINCIAL_COMPARATORS: {
    source: 'CIHI provincial benchmark comparators',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
  HISTORICAL_WAIT_TRENDS: {
    source: 'CIHI priority procedures historical trends',
    sourceVintage: '2015 - 2026',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
};
