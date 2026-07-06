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
export const HEALTH_LINK_VOLUMES: HealthLinkVolume[] = [
  {
    fiscalYear: '2021-2022',
    clinicalReceived: 820000,
    nonClinicalReceived: 410000,
    clinicalOutbound: 120000,
    nonClinicalOutbound: 90000,
    padisCalls: 44200
  },
  {
    fiscalYear: '2022-2023',
    clinicalReceived: 780000,
    nonClinicalReceived: 350000,
    clinicalOutbound: 110000,
    nonClinicalOutbound: 80000,
    padisCalls: 43100
  },
  {
    fiscalYear: '2023-2024',
    clinicalReceived: 810000,
    nonClinicalReceived: 390000,
    clinicalOutbound: 115000,
    nonClinicalOutbound: 85000,
    padisCalls: 44800
  },
  {
    fiscalYear: '2024-2025',
    clinicalReceived: 830000,
    nonClinicalReceived: 410000,
    clinicalOutbound: 120000,
    nonClinicalOutbound: 92000,
    padisCalls: 45200
  },
  {
    fiscalYear: '2025-2026', // Standard projected/current cycle
    clinicalReceived: 850000,
    nonClinicalReceived: 430000,
    clinicalOutbound: 125000,
    nonClinicalOutbound: 95000,
    padisCalls: 46000
  }
];

// 2. CJEM Peer-Reviewed Evaluation Study (Virtual MD Cohort of 19,312 patients)
export const VIRTUAL_MD_COHORT_STUDY: VirtualMDCohortStudy[] = [
  {
    adviceCategory: 'Advised Primary Care',
    metricLabel: 'Sought Primary Care',
    followThroughPct: 55.7,
    timeframe: 'Within 14 Days',
    totalCohortSize: 19312
  },
  {
    adviceCategory: 'Advised ED / Urgent Care',
    metricLabel: 'Sought ED / Urgent Care',
    followThroughPct: 60.0,
    timeframe: 'Within 2 Days',
    totalCohortSize: 19312
  },
  {
    adviceCategory: 'Advised Self-Management',
    metricLabel: 'No Subsequent Health Use',
    followThroughPct: 52.5,
    timeframe: 'Within 14 Days',
    totalCohortSize: 19312
  }
];

// 3. Virtual MD Patient Dispositions (General clinical findings among 100,000+ assessments)
export const VIRTUAL_MD_DISPOSITIONS: VirtualMDDisposition[] = [
  {
    outcome: 'Self-Care at Home',
    percentageShare: 50.0,
    description: 'Condition successfully managed at home with nurse and physician advice, avoiding system utilization.'
  },
  {
    outcome: 'Primary Care Network Referral',
    percentageShare: 35.0,
    description: 'Directed to follow up with local family physician or primary care clinic.'
  },
  {
    outcome: 'Urgent Care Centre Advice',
    percentageShare: 10.0,
    description: 'Referred to community urgent care centres for non-life-threatening medical issues.'
  },
  {
    outcome: 'Emergency Department Triage',
    percentageShare: 5.0,
    description: 'Direct instructions to proceed to the nearest active hospital Emergency Room.'
  }
];

// 4. EMS-811 Shared Response Line Diversion Breakdown (Cumulative 50,000+ non-emergency calls redirected)
export const EMS_811_DIVERSION_DATA: EmsDiversionMetric[] = [
  {
    disposition: 'Community Services (Dentists, Pharmacists, Public Health)',
    percentageShare: 41.7, // "about one-third, others directed to community..." so roughly 41.7%
    volumeProxy: 20850
  },
  {
    disposition: 'Family Physician Consult Advice',
    percentageShare: 33.3, // "about one-third"
    volumeProxy: 16650
  },
  {
    disposition: 'Self-Care at Home Advice',
    percentageShare: 25.0, // "about one-quarter"
    volumeProxy: 12500
  }
];

// 5. Adjacent advice lines and navigation support (AHS Primary Care Directories)
export const ADJACENT_HELPLINES: AdjacentHelplineVolume[] = [
  {
    lineName: 'Addiction & Mental Health Helpline',
    annualCalls: 38400,
    clinicalType: 'Mental Health Triage',
    availability: '24/7'
  },
  {
    lineName: 'Dementia Advice Line',
    annualCalls: 12200,
    clinicalType: 'Specialist Nursing Support',
    availability: '24/7'
  },
  {
    lineName: 'Rehabilitation Advice Line',
    annualCalls: 8500,
    clinicalType: 'Physical / Occupational Therapy Triage',
    availability: 'Monday-Friday'
  },
  {
    lineName: 'Indigenous Support Line',
    annualCalls: 6200,
    clinicalType: 'Culturally-Safe Navigation',
    availability: '24/7'
  },
  {
    lineName: 'AlbertaQuits Helpline',
    annualCalls: 5400,
    clinicalType: 'Tobacco / Vaping Cessation',
    availability: '7 Days a Week'
  }
];

// Data freshness metadata mirroring data-virtual-care.json _dataMetadata.
// Used by the DataTimestamp component to show source vintage and last update.
export const VIRTUAL_CARE_METADATA: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  HEALTH_LINK_VOLUMES: {
    source: 'virtualCareFetcher',
    sourceVintage: 'AHS reports (no new publications)',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'PubMed checked but no new AHS program milestones are published, requiring manual monitoring.',
  },
  VIRTUAL_MD_COHORT_STUDY: {
    source: 'CJEM Peer-Reviewed Study (Springer Link 2025)',
    sourceVintage: 'Unknown',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Exact match to published study (cohort=19312, 55.7%/60%/52.5%)',
  },
  VIRTUAL_MD_DISPOSITIONS: {
    source: 'AHS program-reported milestone',
    sourceVintage: 'Program-reported estimate',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Matches AHS statement that ~50% of callers self-manage at home',
  },
  EMS_811_DIVERSION_DATA: {
    source: 'AHS program milestone announcement',
    sourceVintage: 'Approximate',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Could not verify exact percentages — marked as estimate',
  },
  ADJACENT_HELPLINES: {
    source: 'alberta211Scraper',
    sourceVintage: 'Alberta 211 (API limitations)',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Helplines database is static due to 211 API limits, requiring manual registry checks.',
  },
};
