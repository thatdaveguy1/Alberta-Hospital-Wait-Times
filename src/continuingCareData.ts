// Alberta Continuing Care & Home Care Datasets (2019 - 2026 reporting periods)
// Compiled from HQA FOCUS Continuing Care, CIHI Long-Term Care, and Open Alberta standards.

export interface PlacementMetric {
  year: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  pctPlacedWithin30Days: number; // Target: 60%+
  pctPlacedPreferredOption: number; // Target: 70%+
  daysWaitingP50: number; // Median wait days
  daysWaitingP90: number; // 90th percentile wait days
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
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  lastInspectionDate: string;
  standardsCompliant: boolean;
  violationsCount: number;
  majorViolationsDesc: string | null;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Placement Times & Flow into Preferred Living Options (HQA FOCUS)
export const CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[] = [
  {
    year: '2021',
    zone: 'Calgary Zone',
    pctPlacedWithin30Days: 52.4,
    pctPlacedPreferredOption: 61.8,
    daysWaitingP50: 28,
    daysWaitingP90: 89
  },
  {
    year: '2023',
    zone: 'Calgary Zone',
    pctPlacedWithin30Days: 48.1, // Pandemic impact & staff shortages
    pctPlacedPreferredOption: 58.4,
    daysWaitingP50: 34,
    daysWaitingP90: 104
  },
  {
    year: '2025',
    zone: 'Calgary Zone',
    pctPlacedWithin30Days: 58.5, // System recovery post-pandemic
    pctPlacedPreferredOption: 68.2,
    daysWaitingP50: 24,
    daysWaitingP90: 78
  },
  // Edmonton Zone
  {
    year: '2021',
    zone: 'Edmonton Zone',
    pctPlacedWithin30Days: 50.1,
    pctPlacedPreferredOption: 59.2,
    daysWaitingP50: 31,
    daysWaitingP90: 94
  },
  {
    year: '2023',
    zone: 'Edmonton Zone',
    pctPlacedWithin30Days: 45.4,
    pctPlacedPreferredOption: 55.1,
    daysWaitingP50: 38,
    daysWaitingP90: 112
  },
  {
    year: '2025',
    zone: 'Edmonton Zone',
    pctPlacedWithin30Days: 56.2,
    pctPlacedPreferredOption: 66.8,
    daysWaitingP50: 26,
    daysWaitingP90: 82
  },
  // North Zone
  {
    year: '2021',
    zone: 'North Zone',
    pctPlacedWithin30Days: 42.8,
    pctPlacedPreferredOption: 48.5,
    daysWaitingP50: 42,
    daysWaitingP90: 118
  },
  {
    year: '2023',
    zone: 'North Zone',
    pctPlacedWithin30Days: 38.2,
    pctPlacedPreferredOption: 44.1,
    daysWaitingP50: 48,
    daysWaitingP90: 134
  },
  {
    year: '2025',
    zone: 'North Zone',
    pctPlacedWithin30Days: 46.5, // Rural facilities struggles with nurse recruitment
    pctPlacedPreferredOption: 52.4,
    daysWaitingP50: 36,
    daysWaitingP90: 102
  }
];

// 2. Clinical Care Quality Indicators (CIHI Long-Term Care Database)
export const RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[] = [
  {
    year: '2021',
    metric: 'Inappropriate Antipsychotic Use',
    albertaRatePct: 21.4,
    canadaRatePct: 19.8,
    directionIsLowerBetter: true
  },
  {
    year: '2023',
    metric: 'Inappropriate Antipsychotic Use',
    albertaRatePct: 20.8,
    canadaRatePct: 20.1,
    directionIsLowerBetter: true
  },
  {
    year: '2025',
    metric: 'Inappropriate Antipsychotic Use',
    albertaRatePct: 18.2, // Improved due to HQA guidelines on antipsychotic audits
    canadaRatePct: 19.2,
    directionIsLowerBetter: true
  },
  {
    year: '2021',
    metric: 'Falls in Last 30 Days',
    albertaRatePct: 15.6,
    canadaRatePct: 14.8,
    directionIsLowerBetter: true
  },
  {
    year: '2023',
    metric: 'Falls in Last 30 Days',
    albertaRatePct: 16.1,
    canadaRatePct: 15.1,
    directionIsLowerBetter: true
  },
  {
    year: '2025',
    metric: 'Falls in Last 30 Days',
    albertaRatePct: 14.5,
    canadaRatePct: 14.6,
    directionIsLowerBetter: true
  },
  {
    year: '2021',
    metric: 'Physical Restraint Daily Use',
    albertaRatePct: 6.2,
    canadaRatePct: 5.4,
    directionIsLowerBetter: true
  },
  {
    year: '2023',
    metric: 'Physical Restraint Daily Use',
    albertaRatePct: 5.4,
    canadaRatePct: 4.8,
    directionIsLowerBetter: true
  },
  {
    year: '2025',
    metric: 'Physical Restraint Daily Use',
    albertaRatePct: 3.8, // Major reduction standard implementation
    canadaRatePct: 4.2,
    directionIsLowerBetter: true
  }
];

// 3. Home Care Experience & Staff Continuity (HQA FOCUS Survey)
export const HOME_CARE_EXPERIENCE: HomeCareContinuity[] = [
  {
    zone: 'Calgary Zone',
    overallCareRatingPct: 68.4,
    unmetNeedsPct: 16.2,
    differentStaffCountAverage: 8.4
  },
  {
    zone: 'Edmonton Zone',
    overallCareRatingPct: 66.1,
    unmetNeedsPct: 18.5,
    differentStaffCountAverage: 9.1
  },
  {
    zone: 'Central Zone',
    overallCareRatingPct: 62.4,
    unmetNeedsPct: 21.8,
    differentStaffCountAverage: 11.2 // High turnover rural boundary areas
  },
  {
    zone: 'South Zone',
    overallCareRatingPct: 61.8,
    unmetNeedsPct: 22.4,
    differentStaffCountAverage: 11.6
  },
  {
    zone: 'North Zone',
    overallCareRatingPct: 54.2, // Deepest gap in professional consistency
    unmetNeedsPct: 28.6,
    differentStaffCountAverage: 14.8 // Severely fragmented staffing lines
  },
  {
    zone: 'Alberta',
    overallCareRatingPct: 64.2,
    unmetNeedsPct: 19.8,
    differentStaffCountAverage: 10.1
  }
];

// 4. Operator Compliance & Standards Violated (Open Alberta Accommodation Registry)
export const CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[] = [
  {
    id: 'FAC-001',
    name: 'Chinnook Care Centre',
    type: 'Type A (Long-Term Care)',
    operator: 'Private/Contracted',
    city: 'Calgary',
    zone: 'Calgary Zone',
    lastInspectionDate: '2026-04-12',
    standardsCompliant: true,
    violationsCount: 0,
    majorViolationsDesc: null
  },
  {
    id: 'FAC-002',
    name: 'Mill Woods Shepherd\'s Care Centre',
    type: 'Type A (Long-Term Care)',
    operator: 'Non-Profit',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    lastInspectionDate: '2026-05-18',
    standardsCompliant: false,
    violationsCount: 3,
    majorViolationsDesc: 'Sub-standard therapeutic activity planning & nutritional choice violations'
  },
  {
    id: 'FAC-003',
    name: 'Misericordia Continuing Care Centre',
    type: 'Type A (Long-Term Care)',
    operator: 'Covenant Health',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    lastInspectionDate: '2026-02-10',
    standardsCompliant: true,
    violationsCount: 0,
    majorViolationsDesc: null
  },
  {
    id: 'FAC-004',
    name: 'South Country Village',
    type: 'Type B (Designated Supportive Living)',
    operator: 'Private/Contracted',
    city: 'Medicine Hat',
    zone: 'South Zone',
    lastInspectionDate: '2026-03-24',
    standardsCompliant: false,
    violationsCount: 1,
    majorViolationsDesc: 'Minor drug administration logging standard discrepancy'
  },
  {
    id: 'FAC-005',
    name: 'St. Therese Villa',
    type: 'Type B (Designated Supportive Living)',
    operator: 'Covenant Health',
    city: 'Lethbridge',
    zone: 'South Zone',
    lastInspectionDate: '2026-05-02',
    standardsCompliant: true,
    violationsCount: 0,
    majorViolationsDesc: null
  },
  {
    id: 'FAC-006',
    name: 'Northern Lights Health Centre Supportive Care',
    type: 'Type A (Long-Term Care)',
    operator: 'AHS',
    city: 'Fort McMurray',
    zone: 'North Zone',
    lastInspectionDate: '2026-01-15',
    standardsCompliant: false,
    violationsCount: 4,
    majorViolationsDesc: 'Critical facility maintenance delay & laundry hygiene standard backlog'
  }
];
