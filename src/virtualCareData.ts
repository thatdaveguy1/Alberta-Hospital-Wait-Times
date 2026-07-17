// Alberta Health Link 811 & Virtual Care Datasets (2020 - 2026)
// Compiled from:
// - AHS Quick Facts & Performance Reports (Health Link Call Volumes)
// - Primary Care Alberta 811 Milestones (27 million calls lifetime)
// - CJEM Virtual MD Evaluation Study (19,312 cohort, April 2022 - March 2023)
// - AHS EMS-811 Shared Response Line releases (>50,000 diversions)
// - PADIS (Poison and Drug Information Service) Annual Volume Records

export interface HealthLinkVolume {
  fiscalYear: string;
  clinicalReceived: number;        // clinical inbound calls
  nonClinicalReceived: number;     // non-clinical inbound (info, influenza, records)
  clinicalOutbound: number;       // outbound nurse callbacks/follow-ups
  nonClinicalOutbound: number;    // outbound non-clinical bookings/info
  padisCalls: number;             // Poison and Drug Info service
}

export interface VirtualMDCohortStudy {
  adviceCategory: string;
  metricLabel: string;
  followThroughPct: number;        // % who followed recommended care pathway
  timeframe: string;
  totalCohortSize: number;
}

export interface VirtualMDDisposition {
  outcome: string;
  percentageShare: number;
  description: string;
}

export interface EmsDiversionMetric {
  disposition: string;
  percentageShare: number;
  volumeProxy: number;             // estimated counts from 50k cohort
}

export interface AdjacentHelplineVolume {
  lineName: string;
  annualCalls: number;
  clinicalType: string;
  availability: string;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Health Link 811 Inbound and Outbound Trends (AHS Quick Facts)
export const HEALTH_LINK_VOLUMES: HealthLinkVolume[] = [];

// 2. CJEM Peer-Reviewed Evaluation Study (Virtual MD Cohort of 19,312 patients)
export const VIRTUAL_MD_COHORT_STUDY: VirtualMDCohortStudy[] = [];

// 3. Virtual MD Patient Dispositions (General clinical findings among 100,000+ assessments)
export const VIRTUAL_MD_DISPOSITIONS: VirtualMDDisposition[] = [];

// 4. EMS-811 Shared Response Line Diversion Breakdown (Cumulative 50,000+ non-emergency calls redirected)
export const EMS_811_DIVERSION_DATA: EmsDiversionMetric[] = [];

// 5. Adjacent advice lines and navigation support (AHS Primary Care Directories)
export const ADJACENT_HELPLINES: AdjacentHelplineVolume[] = [];

// Data freshness metadata mirroring data-virtual-care.json _dataMetadata.
// Used by the DataTimestamp component to show source vintage and last update.
export const VIRTUAL_CARE_METADATA: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  VIRTUAL_MD_COHORT_STUDY: {
    source: 'CJEM Peer-Reviewed Study (Springer Link 2025)',
    sourceVintage: 'Unknown',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Exact match to published study (cohort=19312, 55.7%/60%/52.5%)',
  },
};
