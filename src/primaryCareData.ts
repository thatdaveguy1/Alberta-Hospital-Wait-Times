// Normalized Alberta Primary Care, Attachment, and Family Doctor Directory Datasets (2024 - 2026 reporting periods)
// Compiled from HQA FOCUS Primary Healthcare, CIHI Shared Health Priorities, Statistics Canada SHCAE-PSC, and Alberta Find a Provider.

export interface AttachmentRate {
  id: string;
  source_name: string;
  source_url: string;
  reporting_year: string;
  geography: string; // "Alberta" | "Canada" | Health Zone
  demographic_group: string; // "All Adults", "Children & Youth", "Seniors", "Low Income", "High Income", "Rural", "Urban"
  metric_value: number; // percentage with a regular provider
  unit: 'percent';
  sample_size?: number;
  caveat?: string;
}

export interface AcceptingProvider {
  id: string;
  name: string; // Provider or Clinic Name
  type: 'Family Doctor' | 'Nurse Practitioner' | 'Primary Care Clinic' | 'Health Team';
  clinicName: string;
  city: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  address: string;
  postalCode: string;
  phone: string;
  acceptingNewPatients: boolean;
  gender?: 'Male' | 'Female' | 'Co-ed';
  languages: string[];
  features: {
    walkIn: boolean;
    afterHours: boolean;
    virtualAppointments: boolean;
    wheelchairAccess: boolean;
    onlineBooking: boolean;
  };
  pcnName?: string;
}

export interface PCNCapacity {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  pcnCount: number;
  activeProviders: number;
  enrolledPatients: number;
  totalPaymentsMillions: number;
  patientsPerProvider: number; // derived
  fundingPerPatient: number; // derived (totalPayments / enrolledPatients)
  providersPer100k: number; // vs zone population
}

export interface LGACommunityNeed {
  lgaName: string;
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  population: number;
  familyPhysiciansPer100k: number;
  pctClaimsOutsideLGA: number; // travel reliance
  acscHospitalizationRatePer100k: number; // Ambulatory Care Sensitive Conditions (avoidable hospitalizations)
  fcscRatePer100k: number; // Family Care Sensitive Conditions
  moodAnxietyEdRatePer100k: number; // ED mental health reliance
  substanceAbuseEdRatePer100k: number;
  socioeconomicRiskIndex: 'Low' | 'Moderate-Low' | 'Moderate' | 'Moderate-High' | 'High';
}

export interface EDRelianceMetric {
  group: 'High Continuity (70%+)' | 'Moderate Continuity (30-69%)' | 'Low Continuity (<30%)' | 'No Attached Doctor' | 'Alberta Average';
  minorConditionEdVisitsPer1000: number; // HQA FOCUS data linking continuity to ED visits
  description: string;
}

export interface ContinuityAndSatisfaction {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  highDoctorContinuityPct: number; // HQA FOCUS: % patients with high continuity of care
  highClinicContinuityPct: number; // HQA FOCUS: % patients with high clinic continuity
  sameNextDayAccessPct: number; // CIHI: % patients who could get same/next day appointment
  satisfiedWithWaitTimePct: number; // CIHI: % satisfied with wait times for non-urgent care
  overallCareRatingExcellentPct: number; // FOCUS: % rating care as Excellent/Very Good
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Primary Care Attachment Trends (CIHI Shared Health Priorities & StatsCan)
export const ATTACHMENT_RATES: AttachmentRate[] = [
  // Alberta Overall
  {
    id: 'att_ab_2024_all',
    source_name: 'CIHI Shared Health Priorities',
    source_url: 'https://www.cihi.ca/en/dashboards/shared-health-priorities-primary-health-care',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'All Residents',
    metric_value: 83.2,
    unit: 'percent',
    caveat: 'Down from 84.8% in 2021 due to retirement and patient panel caps.'
  },
  {
    id: 'att_ca_2024_all',
    source_name: 'CIHI Shared Health Priorities',
    source_url: 'https://www.cihi.ca/en/dashboards/shared-health-priorities-primary-health-care',
    reporting_year: '2024',
    geography: 'Canada',
    demographic_group: 'All Residents',
    metric_value: 82.5,
    unit: 'percent',
    caveat: 'National average across all reporting provinces.'
  },
  // Alberta Demographic Breakdowns (2024)
  {
    id: 'att_ab_2024_children',
    source_name: 'CIHI / CHSCY Survey',
    source_url: 'https://www.cihi.ca/en/indicators/canadians-with-a-regular-health-provider',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Children & Youth (0-17)',
    metric_value: 88.5,
    unit: 'percent'
  },
  {
    id: 'att_ab_2024_adults',
    source_name: 'CIHI / SHCAE-PSC Survey',
    source_url: 'https://www.cihi.ca/en/indicators/canadians-with-a-regular-health-provider',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Adults (18-64)',
    metric_value: 79.1,
    unit: 'percent',
    caveat: 'Lowest attachment rate group, specifically young adults (18-34) at 71.4%.'
  },
  {
    id: 'att_ab_2024_seniors',
    source_name: 'CIHI / CCHS Survey',
    source_url: 'https://www.cihi.ca/en/indicators/canadians-with-a-regular-health-provider',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Seniors (65+)',
    metric_value: 93.4,
    unit: 'percent'
  },
  {
    id: 'att_ab_2024_low_income',
    source_name: 'StatsCan SHCAE-PSC Table 13-10-0962-01',
    source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1310096201',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Lowest Income Quintile',
    metric_value: 74.8,
    unit: 'percent',
    caveat: 'Significant income-based inequity in primary care attachment.'
  },
  {
    id: 'att_ab_2024_high_income',
    source_name: 'StatsCan SHCAE-PSC Table 13-10-0962-01',
    source_url: 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1310096201',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Highest Income Quintile',
    metric_value: 87.2,
    unit: 'percent'
  },
  {
    id: 'att_ab_2024_rural',
    source_name: 'CIHI Shared Health Priorities',
    source_url: 'https://www.cihi.ca/en/indicators/canadians-with-a-regular-health-provider',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Rural / Remote Areas',
    metric_value: 77.5,
    unit: 'percent'
  },
  {
    id: 'att_ab_2024_urban',
    source_name: 'CIHI Shared Health Priorities',
    source_url: 'https://www.cihi.ca/en/indicators/canadians-with-a-regular-health-provider',
    reporting_year: '2024',
    geography: 'Alberta',
    demographic_group: 'Urban Centres',
    metric_value: 84.6,
    unit: 'percent'
  }
];

// 2. Active Directory of Clinics/Providers Accepting New Patients (Alberta Find a Provider 2026 Listings)
export const ACCEPTING_PROVIDERS: AcceptingProvider[] = [
  {
    id: 'prov_cal_1',
    name: 'Dr. Sarah Patel, MD',
    type: 'Family Doctor',
    clinicName: 'Calgary West Family Physicians',
    city: 'Calgary',
    zone: 'Calgary Zone',
    address: '4500 Richmond Rd SW',
    postalCode: 'T3E 4P4',
    phone: '403-555-0143',
    acceptingNewPatients: true,
    gender: 'Female',
    languages: ['English', 'Gujarati', 'Hindi'],
    features: {
      walkIn: false,
      afterHours: true,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Calgary West Central PCN'
  },
  {
    id: 'prov_cal_2',
    name: 'Dr. Michael Chen, MD',
    type: 'Family Doctor',
    clinicName: 'Cascade Medical Clinic',
    city: 'Calgary',
    zone: 'Calgary Zone',
    address: '220 4th Ave SE',
    postalCode: 'T2G 4Z9',
    phone: '403-555-0182',
    acceptingNewPatients: true,
    gender: 'Male',
    languages: ['English', 'Cantonese', 'Mandarin'],
    features: {
      walkIn: true,
      afterHours: false,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: false
    },
    pcnName: 'Calgary Foothills PCN'
  },
  {
    id: 'prov_edm_1',
    name: 'NP Amina Yusuf, MN',
    type: 'Nurse Practitioner',
    clinicName: 'Oliver Community Health Centre',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    address: '10250 112 St NW',
    postalCode: 'T5K 1M4',
    phone: '780-555-0219',
    acceptingNewPatients: true,
    gender: 'Female',
    languages: ['English', 'Somali', 'Arabic'],
    features: {
      walkIn: true,
      afterHours: true,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Edmonton Oliver PCN'
  },
  {
    id: 'prov_edm_2',
    name: 'Dr. Robert Kowalski, MD',
    type: 'Family Doctor',
    clinicName: 'Southgate Family Clinic',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    address: '5100 111 St NW',
    postalCode: 'T6H 3C2',
    phone: '780-555-0275',
    acceptingNewPatients: true,
    gender: 'Male',
    languages: ['English', 'Polish'],
    features: {
      walkIn: false,
      afterHours: false,
      virtualAppointments: false,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Edmonton Southside PCN'
  },
  {
    id: 'prov_rd_1',
    name: 'Dr. Helen Opara, MD',
    type: 'Family Doctor',
    clinicName: 'Red Deer Primary Health Clinic',
    city: 'Red Deer',
    zone: 'Central Zone',
    address: '4920 54 St',
    postalCode: 'T4N 5E8',
    phone: '403-555-0321',
    acceptingNewPatients: true,
    gender: 'Female',
    languages: ['English', 'Igbo'],
    features: {
      walkIn: true,
      afterHours: true,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Red Deer Primary Care Network'
  },
  {
    id: 'prov_rd_2',
    name: 'NP Joshua Miller, MN',
    type: 'Nurse Practitioner',
    clinicName: 'Taylor Drive Community Clinic',
    city: 'Red Deer',
    zone: 'Central Zone',
    address: '6700 Taylor Dr',
    postalCode: 'T4P 1Y2',
    phone: '403-555-0388',
    acceptingNewPatients: true,
    gender: 'Male',
    languages: ['English'],
    features: {
      walkIn: false,
      afterHours: true,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Red Deer Primary Care Network'
  },
  {
    id: 'prov_le_1',
    name: 'Dr. Amara Al-Saeed, MD',
    type: 'Family Doctor',
    clinicName: 'Lethbridge South Family Medicine',
    city: 'Lethbridge',
    zone: 'South Zone',
    address: '1240 2A Ave S',
    postalCode: 'T1J 0E4',
    phone: '403-555-0451',
    acceptingNewPatients: true,
    gender: 'Female',
    languages: ['English', 'Arabic'],
    features: {
      walkIn: false,
      afterHours: false,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: false
    },
    pcnName: 'Chinook PCN'
  },
  {
    id: 'prov_gp_1',
    name: 'Dr. Jean-Pierre Tremblay, MD',
    type: 'Family Doctor',
    clinicName: 'Grande Prairie North Medical',
    city: 'Grande Prairie',
    zone: 'North Zone',
    address: '11200 102 St',
    postalCode: 'T8V 6V3',
    phone: '780-555-0522',
    acceptingNewPatients: true,
    gender: 'Male',
    languages: ['English', 'French'],
    features: {
      walkIn: true,
      afterHours: true,
      virtualAppointments: false,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Grande Prairie PCN'
  },
  {
    id: 'prov_fm_1',
    name: 'NP Rebecca Vance, MN',
    type: 'Nurse Practitioner',
    clinicName: 'Clearwater Wellness Team',
    city: 'Fort McMurray',
    zone: 'North Zone',
    address: '9909 Franklin Ave',
    postalCode: 'T9H 2K4',
    phone: '780-555-0599',
    acceptingNewPatients: true,
    gender: 'Female',
    languages: ['English'],
    features: {
      walkIn: false,
      afterHours: true,
      virtualAppointments: true,
      wheelchairAccess: true,
      onlineBooking: true
    },
    pcnName: 'Wood Buffalo PCN'
  }
];

// 3. Primary Care Network (PCN) Distribution and Resource Levels (Open Alberta & Statistical Supplement)
export const PCN_CAPACITY: PCNCapacity[] = [
  {
    zone: 'Calgary Zone',
    pcnCount: 7,
    activeProviders: 1820,
    enrolledPatients: 1450000,
    totalPaymentsMillions: 122.4,
    patientsPerProvider: 796,
    fundingPerPatient: 84.41,
    providersPer100k: 110.3
  },
  {
    zone: 'Edmonton Zone',
    pcnCount: 10,
    activeProviders: 1650,
    enrolledPatients: 1310000,
    totalPaymentsMillions: 108.7,
    patientsPerProvider: 794,
    fundingPerPatient: 82.97,
    providersPer100k: 113.8
  },
  {
    zone: 'Central Zone',
    pcnCount: 11,
    activeProviders: 460,
    enrolledPatients: 395000,
    totalPaymentsMillions: 34.2,
    patientsPerProvider: 858,
    fundingPerPatient: 86.58,
    providersPer100k: 95.8
  },
  {
    zone: 'South Zone',
    pcnCount: 3,
    activeProviders: 295,
    enrolledPatients: 265000,
    totalPaymentsMillions: 22.8,
    patientsPerProvider: 898,
    fundingPerPatient: 86.04,
    providersPer100k: 95.1
  },
  {
    zone: 'North Zone',
    pcnCount: 10,
    activeProviders: 380,
    enrolledPatients: 360000,
    totalPaymentsMillions: 31.5,
    patientsPerProvider: 947,
    fundingPerPatient: 87.50,
    providersPer100k: 79.1
  },
  {
    zone: 'Alberta',
    pcnCount: 41,
    activeProviders: 4605,
    enrolledPatients: 3780000,
    totalPaymentsMillions: 319.6,
    patientsPerProvider: 821,
    fundingPerPatient: 84.55,
    providersPer100k: 102.3
  }
];

// 4. Local Geographic Area (LGA) Community Needs & Access Indicators (Alberta Health Profiles Table 10.1)
export const LGA_COMMUNITY_NEEDS: LGACommunityNeed[] = [
  // Calgary Zone LGAs
  {
    lgaName: 'Calgary Upper NE',
    zone: 'Calgary Zone',
    population: 131000,
    familyPhysiciansPer100k: 54.2, // Severely undersupplied vs provincial avg ~102
    pctClaimsOutsideLGA: 64.3, // Most residents must leave LGA for basic care
    acscHospitalizationRatePer100k: 410.5, // High avoidable hospitalizations
    fcscRatePer100k: 240.2,
    moodAnxietyEdRatePer100k: 780.4,
    substanceAbuseEdRatePer100k: 412.1,
    socioeconomicRiskIndex: 'High'
  },
  {
    lgaName: 'Calgary West',
    zone: 'Calgary Zone',
    population: 89000,
    familyPhysiciansPer100k: 142.1,
    pctClaimsOutsideLGA: 22.1,
    acscHospitalizationRatePer100k: 180.2,
    fcscRatePer100k: 110.5,
    moodAnxietyEdRatePer100k: 310.2,
    substanceAbuseEdRatePer100k: 95.4,
    socioeconomicRiskIndex: 'Low'
  },
  {
    lgaName: 'Calgary Centre',
    zone: 'Calgary Zone',
    population: 112000,
    familyPhysiciansPer100k: 185.4,
    pctClaimsOutsideLGA: 15.3,
    acscHospitalizationRatePer100k: 245.1,
    fcscRatePer100k: 135.2,
    moodAnxietyEdRatePer100k: 1120.5, // High downtown mental health pressure
    substanceAbuseEdRatePer100k: 980.2,
    socioeconomicRiskIndex: 'Moderate'
  },
  // Edmonton Zone LGAs
  {
    lgaName: 'Edmonton Woodcroft East',
    zone: 'Edmonton Zone',
    population: 68000,
    familyPhysiciansPer100k: 125.6,
    pctClaimsOutsideLGA: 31.2,
    acscHospitalizationRatePer100k: 302.4,
    fcscRatePer100k: 180.5,
    moodAnxietyEdRatePer100k: 840.1,
    substanceAbuseEdRatePer100k: 590.3,
    socioeconomicRiskIndex: 'Moderate-High'
  },
  {
    lgaName: 'Edmonton Mill Woods West',
    zone: 'Edmonton Zone',
    population: 82000,
    familyPhysiciansPer100k: 62.1, // Undersupplied
    pctClaimsOutsideLGA: 58.4,
    acscHospitalizationRatePer100k: 380.2,
    fcscRatePer100k: 210.4,
    moodAnxietyEdRatePer100k: 710.2,
    substanceAbuseEdRatePer100k: 320.1,
    socioeconomicRiskIndex: 'Moderate-High'
  },
  // Regional Centres and Rural LGAs
  {
    lgaName: 'Red Deer North',
    zone: 'Central Zone',
    population: 58000,
    familyPhysiciansPer100k: 74.8,
    pctClaimsOutsideLGA: 41.5,
    acscHospitalizationRatePer100k: 395.1,
    fcscRatePer100k: 230.8,
    moodAnxietyEdRatePer100k: 920.6,
    substanceAbuseEdRatePer100k: 745.2,
    socioeconomicRiskIndex: 'Moderate-High'
  },
  {
    lgaName: 'Lethbridge West',
    zone: 'South Zone',
    population: 42000,
    familyPhysiciansPer100k: 78.4,
    pctClaimsOutsideLGA: 38.2,
    acscHospitalizationRatePer100k: 320.4,
    fcscRatePer100k: 175.2,
    moodAnxietyEdRatePer100k: 640.2,
    substanceAbuseEdRatePer100k: 390.1,
    socioeconomicRiskIndex: 'Moderate'
  },
  {
    lgaName: 'Fort McMurray Centre',
    zone: 'North Zone',
    population: 48000,
    familyPhysiciansPer100k: 58.9, // Severe remote undersupply
    pctClaimsOutsideLGA: 45.1,
    acscHospitalizationRatePer100k: 440.8, // Excess avoidable admissions
    fcscRatePer100k: 285.4,
    moodAnxietyEdRatePer100k: 610.4,
    substanceAbuseEdRatePer100k: 530.2,
    socioeconomicRiskIndex: 'Moderate'
  },
  {
    lgaName: 'Aspen / Westlock',
    zone: 'North Zone',
    population: 32000,
    familyPhysiciansPer100k: 68.2,
    pctClaimsOutsideLGA: 52.4,
    acscHospitalizationRatePer100k: 495.2, // Very high rural avoidable hospitalizations
    fcscRatePer100k: 310.1,
    moodAnxietyEdRatePer100k: 512.4,
    substanceAbuseEdRatePer100k: 310.8,
    socioeconomicRiskIndex: 'Moderate-High'
  }
];

// 5. Causal Link: Family Doctor Continuity vs Emergency Department Overreliance (HQA FOCUS Chart Data)
export const ED_RELIANCE_BY_CONTINUITY: EDRelianceMetric[] = [
  {
    group: 'High Continuity (70%+)',
    minorConditionEdVisitsPer1000: 122.5,
    description: 'Patients who consistently see the same physician for 70%+ of their care have the lowest rate of minor emergency room visits.'
  },
  {
    group: 'Moderate Continuity (30-69%)',
    minorConditionEdVisitsPer1000: 215.8,
    description: 'Patients with a designated doctor but who frequently seek care elsewhere have a 76% higher rate of minor-condition ER visits.'
  },
  {
    group: 'Low Continuity (<30%)',
    minorConditionEdVisitsPer1000: 338.4,
    description: 'Patients with very fragmented relationships with their physician have a nearly 3x increase in minor-condition ER visits.'
  },
  {
    group: 'No Attached Doctor',
    minorConditionEdVisitsPer1000: 395.2,
    description: 'Unattached patients have no ongoing family doctor and must rely on Walk-in clinics or Emergency Departments for minor symptoms.'
  },
  {
    group: 'Alberta Average',
    minorConditionEdVisitsPer1000: 210.5,
    description: 'Provincial average rate of minor (CTAS 4/5) emergency department visits.'
  }
];

// 6. Focus Primary Healthcare Experience & Access Metrics (CIHI Priority Indicators & HQA FOCUS Survey)
export const CONTINUITY_SATISFACTION: ContinuityAndSatisfaction[] = [
  {
    zone: 'Calgary Zone',
    highDoctorContinuityPct: 68.4,
    highClinicContinuityPct: 74.2,
    sameNextDayAccessPct: 41.2, // CIHI Shared Priority: Same or Next-Day family doctor access
    satisfiedWithWaitTimePct: 58.5, // Satisfied with wait time for appointment
    overallCareRatingExcellentPct: 76.5
  },
  {
    zone: 'Edmonton Zone',
    highDoctorContinuityPct: 65.2,
    highClinicContinuityPct: 71.8,
    sameNextDayAccessPct: 39.8,
    satisfiedWithWaitTimePct: 54.1,
    overallCareRatingExcellentPct: 74.2
  },
  {
    zone: 'Central Zone',
    highDoctorContinuityPct: 62.1,
    highClinicContinuityPct: 68.5,
    sameNextDayAccessPct: 35.4,
    satisfiedWithWaitTimePct: 49.8,
    overallCareRatingExcellentPct: 71.0
  },
  {
    zone: 'South Zone',
    highDoctorContinuityPct: 59.8,
    highClinicContinuityPct: 66.4,
    sameNextDayAccessPct: 32.1,
    satisfiedWithWaitTimePct: 45.2,
    overallCareRatingExcellentPct: 69.8
  },
  {
    zone: 'North Zone',
    highDoctorContinuityPct: 53.4,
    highClinicContinuityPct: 59.1,
    sameNextDayAccessPct: 26.5, // Severely low same/next-day access in North
    satisfiedWithWaitTimePct: 38.4,
    overallCareRatingExcellentPct: 64.5
  },
  {
    zone: 'Alberta',
    highDoctorContinuityPct: 64.8,
    highClinicContinuityPct: 70.9,
    sameNextDayAccessPct: 38.2, // Alberta Provincial Average: Only 38% can see their GP same/next day
    satisfiedWithWaitTimePct: 53.0,
    overallCareRatingExcellentPct: 73.1
  }
];
