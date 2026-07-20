// Alberta Diagnostic Imaging & Laboratory Datasets (2008 - 2026 reporting periods)
// Compiled from Alberta Precision Labs (APL) QMe JSON operational data, 
// CIHI CT/MRI wait-time indicators, Alberta Wait Times Reporting, and AHS Implementation Plans.

import type { LabWaitValue } from './lib/labWait';

export interface LabLocationWait {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  region: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  waitTimeMin: LabWaitValue;
  saveMyPlaceAvailable: boolean;
  appointmentRequired: boolean;
  walkInAvailable: boolean;
  latitude: number;
  longitude: number;
  dailyVolume?: number;
  peakHours?: string;
}

export interface TestTurnaround {
  testName: string;
  category: 'STAT / Critical' | 'Urgent Routine' | 'Specialty Pathology' | 'Send-out Reference';
  specimenType: string;
  statTurnaroundHrs: number;
  routineTurnaroundDays: number;
  volumePerYearMillions: number;
}

export interface ImagingWaitTrend {
  year: string;
  modality: 'CT Scan' | 'MRI Scan';
  albertaP50Days: number;
  albertaP90Days: number;
  canadaP50Days: number;
  canadaP90Days: number;
}

export interface FacilityImagingWait {
  facilityId: string;
  facilityName: string;
  city: string;
  zone: string;
  mriP50WaitDays: number;
  mriP90WaitDays: number;
  ctP50WaitDays: number;
  ctP90WaitDays: number;
  annualCompletedExamsCount: number;
  scannerUtilizationPct: number;
}

export interface PriorityTarget {
  priority: 'P1 Emergent' | 'P2 Urgent' | 'P3 Semi-Urgent' | 'P4 Non-Urgent';
  targetLimitText: string;
  targetDaysMax: number;
  albertaCtCompliancePct: number;
  albertaMriCompliancePct: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Live APL Community Lab Locations & Recalculated Wait Times (APL QMe API Snapshot 2026)
export const LAB_LOCATION_WAITS: LabLocationWait[] = [];

// 2. Lab Test Turnaround-Time Benchmarks (APL Test Directory 2025/2026 Metadata)
export const TEST_TURNAROUND_METRICS: TestTurnaround[] = [];

// 3. CIHI Historical Wait-Time Trends for CT & MRI (P50 and P90 Wait Days 2008 - 2025)
export const IMAGING_WAIT_TRENDS: ImagingWaitTrend[] = [];

// 4. Facility-Level Diagnostic Imaging Wait Days (Alberta Wait Times Reporting - 12 Rolling Months)
export const FACILITY_IMAGING_WAITS: FacilityImagingWait[] = [];

// 5. CAR Wait-Time Targets vs Alberta Current Performance (Auditor General & AHS Metrics)
export const PRIORITY_TARGET_COMPLIANCE: PriorityTarget[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  LAB_LOCATION_WAITS: {
    source: 'Alberta Precision Laboratories (APL) directory',
    sourceVintage: 'APL directory (approximate 2024-2025)',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'APL is the real provincial lab service. Location names and addresses are likely real. Wait time minutes are point-in-time estimates.',
  },
  IMAGING_WAIT_TRENDS: {
    source: 'CIHI wait times download',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
  CIHI_DIAGNOSTIC_WAIT_TIMES: {
    source: 'CIHI wait times download',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
  },
};
