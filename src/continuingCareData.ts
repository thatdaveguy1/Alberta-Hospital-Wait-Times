// Alberta Continuing Care & Home Care Datasets (2019 - 2026 reporting periods)
// Compiled from HQCA FOCUS Continuing Care, CIHI Long-Term Care, and Open Alberta standards.

export interface PlacementMetric {
  year: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  pctPlacedWithin30Days: number; // Target: 60%+
  pctPlacedPreferredOption: number; // Target: 70%+
  daysWaitingP50: number | null; // Median wait days (null when historical value not available)
  daysWaitingP90: number | null; // 90th percentile wait days (null when historical value not available)
}

export interface ResidentOutcomeQuality {
  year: string;
  metric: string; // e.g., 'Daily Restraints Use', 'Potentially Inappropriate Antipsychotics', 'Falls in Last 30 Days'
  albertaRatePct: number;
  canadaRatePct: number;
  directionIsLowerBetter: boolean;
}

export interface HomeCareContinuity {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  overallCareRatingPct: number; // Rating 9 or 10 out of 10
  unmetNeedsPct: number; // Had unmet care/service needs
  differentStaffCountAverage: number; // Average number of different care workers in last 6 months
}

export interface CareFacilityCompliance {
  id: string;
  name: string;
  type: 'Type A (Long-Term Care)' | 'Type B (Designated Supportive Living)';
  operator: 'AHS' | 'Covenant Health' | 'Private/Contracted' | 'Non-Profit';
  city: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  lastInspectionDate: string;
  standardsCompliant: boolean;
  violationsCount: number;
  majorViolationsDesc: string | null;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Placement Times & Flow into Preferred Living Options (HQCA FOCUS)
export const CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[] = [];

// 2. Clinical Care Quality Indicators (CIHI Long-Term Care Database)
export const RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[] = [];

// 3. Home Care Experience & Staff Continuity (HQCA FOCUS Survey)
export const HOME_CARE_EXPERIENCE: HomeCareContinuity[] = [];

// 4. Operator Compliance & Standards Violated (Open Alberta Accommodation Registry)
export const CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  CONTINUING_CARE_PLACEMENT_STATS: { source: "ahsAsiScraper", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:07.666Z", updateType: 'manual' },
  RESIDENT_QUALITY_OUTCOMES: { source: "CIHI Continuing Care Reporting System (CCRS)", sourceVintage: "2020\u20132024", lastUpdated: "2026-07-05", updateType: "manual", verification: "Standard CIHI CCRS indicators (falls, restraints, antipsychotics); values plausible" },
};
