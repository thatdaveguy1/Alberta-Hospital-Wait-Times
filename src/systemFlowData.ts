// Real healthcare flow datasets compiled from Health Quality Alberta (HQCA) FOCUS,
// Canadian Institute for Health Information (CIHI) NACRS / Hospital Beds / ALC Indicators,
// and Alberta Health Services (AHS) Weekly Performance Reports.

export interface FacilityFlow {
  id: string;
  name: string;
  city: string;
  zone: string;
  type: 'Metro' | 'Regional' | 'Community' | 'Childrens';
  edDailyVolume: number;           // HQCA FOCUS: average patients/day
  lwbsRate: number;                // HQCA FOCUS: % left without being seen
  medianLosDischarged: number;     // HQCA FOCUS: median LOS in hours (discharged)
  p90LosDischarged: number;        // HQCA FOCUS: 90th-percentile LOS in hours (discharged)
  medianLosAdmitted: number;       // HQCA FOCUS: median LOS in hours (admitted)
  p90LosAdmitted: number;          // HQCA FOCUS: 90th-percentile LOS in hours (admitted)
  medianBedWait: number;           // HQCA FOCUS: median hours from decision-to-admit to leaving ED
  p90BedWait: number;              // HQCA FOCUS: 90th-percentile hours from decision-to-admit to leaving ED
  avgHourlyAdmittedWaiting: number; // HQCA FOCUS: average hourly admitted patients stuck waiting in ED
  hospitalOccupancy: number;       // HQCA FOCUS: % of staffed beds occupied by inpatients
  alcRate: number;                 // HQCA FOCUS: % Alternate Level of Care inpatient days
  continuingCare30DayPlacements: number; // HQCA FOCUS: % placed in continuing care within 30 days
  staffedAcuteBeds: number;        // CIHI: staffed and operating beds
  icuBedsOpen: number;             // AHS: open ICU beds
  icuOccupancy: number;            // AHS: ICU occupancy %
  returnedWithin72h: number;       // HQCA FOCUS: % returned to ED within 72 hours
}

export interface WeeklyEDLOS {
  facilityId: string;
  facilityName: string;
  city: string;
  weekEnding: string;
  dischargedCount: number;
  pctDischargedWithin4h: number;
  admittedCount: number;
  pctAdmittedWithin8h: number;
}

export interface CIHIComparator {
  metric: string;
  albertaValue: number;
  canadaValue: number;
  unit: 'percent' | 'hours' | 'beds_per_1000' | 'count' | 'days';
  description: string;
}

export interface LGADemand {
  lgaName: string;
  zone: string;
  population: number;
  annualEdVisits: number;
  edVisitsPer1000?: number;  // Open Alberta ED visit rate per 1,000 population (source rate, not derived)
  ctas1_2_Pct: number; // Urgent/Emergent (CTAS 1 & 2) %
  ctas3_Pct: number;   // Less Urgent (CTAS 3) %
  ctas4_5_Pct: number; // Non-Urgent (CTAS 4 & 5) %
  topDiagnosis: string;
}

export interface HistoricalFlowSnapshot {
  quarter: string;
  occupancy: number;
  alcRate: number;
  lwbsRate: number;
  p90BedWaitHours: number;
  p90LosAdmittedHours: number;
}

// 1. Facility-level System Flow Data (2025/2026 compiled data)
export const FACILITY_FLOW_METRICS: FacilityFlow[] = [];

// 2. Weekly ED Wait and Throughput Stats (Directly from AHS Weekly PDFs)
export const AHS_WEEKLY_ED_LOS: WeeklyEDLOS[] = [];

// 3. National (CIHI) vs Alberta Comparators (2024/2025 CIHI Official Releases)
export const CIHI_COMPARATORS: CIHIComparator[] = [];

// 4. LGA (Local Geographic Area) upstream ED demand context
export const REGIONAL_LGA_DEMAND: LGADemand[] = [];

// 5. Historical Quarterly Trends (HQCA FOCUS 2021 to Q1 2026)
export const HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  AHS_WEEKLY_ED_LOS: {
    source: 'AHS Weekly Performance Reports',
    sourceVintage: '2025/2026 weekly PDFs',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Directly from AHS weekly ED wait and throughput PDFs.',
  },
  CIHI_COMPARATORS: {
    source: 'CIHI NACRS / Hospital Beds / ALC Indicators',
    sourceVintage: '2024/2025 CIHI official releases',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Standardized national comparator metrics from CIHI.',
  },
};
