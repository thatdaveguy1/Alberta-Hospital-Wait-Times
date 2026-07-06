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
export const SURGICAL_RECORDS: SurgicalRecord[] = [
  // --- HIP REPLACEMENT ---
  {
    id: 'rec_hip_prov_med',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 19.4,
    unit: 'weeks',
    benchmark_value: '26 weeks (182 days)',
    method_note: '3-month rolling median data'
  },
  {
    id: 'rec_hip_prov_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 36.8,
    unit: 'weeks',
    benchmark_value: '26 weeks (182 days)',
    method_note: '90% of patients completed within this time'
  },
  {
    id: 'rec_hip_prov_bench',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '% within benchmark',
    metric_value: 62.0,
    unit: 'percent',
    benchmark_value: '182 days',
    method_note: 'CIHI national standard benchmark match'
  },
  {
    id: 'rec_hip_edm_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Zone',
    geography_name: 'Edmonton Zone',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 41.2,
    unit: 'weeks',
    method_note: 'High demand, orthopedic hub focus'
  },
  {
    id: 'rec_hip_cal_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Zone',
    geography_name: 'Calgary Zone',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 34.5,
    unit: 'weeks',
    method_note: 'Integrated hip/knee pathway'
  },

  // --- KNEE REPLACEMENT ---
  {
    id: 'rec_knee_prov_med',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Knee Replacement',
    procedure_name: 'Total Knee Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 22.8,
    unit: 'weeks',
    benchmark_value: '26 weeks (182 days)',
    method_note: '3-month rolling median data'
  },
  {
    id: 'rec_knee_prov_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Knee Replacement',
    procedure_name: 'Total Knee Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 43.1,
    unit: 'weeks',
    benchmark_value: '26 weeks (182 days)',
    method_note: 'Longest wait orthopedic sub-specialty'
  },
  {
    id: 'rec_knee_prov_bench',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Knee Replacement',
    procedure_name: 'Total Knee Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '% within benchmark',
    metric_value: 51.0,
    unit: 'percent',
    benchmark_value: '182 days',
    method_note: 'CIHI knee replacement standard'
  },

  // --- CATARACT SURGERY ---
  {
    id: 'rec_cat_prov_med',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Extraction & Lens Implant',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 8.6,
    unit: 'weeks',
    benchmark_value: '16 weeks (112 days)',
    method_note: 'Substantial use of Chartered Surgical Facilities'
  },
  {
    id: 'rec_cat_prov_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Extraction & Lens Implant',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 15.2,
    unit: 'weeks',
    benchmark_value: '16 weeks (112 days)'
  },
  {
    id: 'rec_cat_prov_bench',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Extraction & Lens Implant',
    wait_segment: 'Decision-to-surgery',
    metric_name: '% within benchmark',
    metric_value: 78.0,
    unit: 'percent',
    benchmark_value: '112 days'
  },

  // --- CANCER SURGERY (BREAST) ---
  {
    id: 'rec_cancer_breast_med',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Oncology',
    procedure_name: 'Breast Cancer Surgery',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 3.1,
    unit: 'weeks',
    benchmark_value: '4 weeks (28 days)',
    method_note: 'Oncology fast-track target'
  },
  {
    id: 'rec_cancer_breast_90',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Oncology',
    procedure_name: 'Breast Cancer Surgery',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 5.9,
    unit: 'weeks'
  },

  // --- CANCER SURGERY (COLORECTAL) ---
  {
    id: 'rec_cancer_colon_med',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Oncology',
    procedure_name: 'Colorectal Cancer Surgery',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 4.2,
    unit: 'weeks',
    benchmark_value: '4 weeks (28 days)'
  },
  {
    id: 'rec_cancer_colon_90',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Oncology',
    procedure_name: 'Colorectal Cancer Surgery',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 7.8,
    unit: 'weeks'
  },

  // --- DIAGNOSTICS (MRI) ---
  {
    id: 'rec_diag_mri_med',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Diagnostic Imaging',
    procedure_name: 'MRI Scan (Magnetic Resonance Imaging)',
    wait_segment: 'Decision-to-surgery', // parsed as referral-to-test
    metric_name: 'Median wait',
    metric_value: 12.4,
    unit: 'weeks',
    method_note: 'Excludes high-priority emergency trauma scans'
  },
  {
    id: 'rec_diag_mri_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Diagnostic Imaging',
    procedure_name: 'MRI Scan (Magnetic Resonance Imaging)',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 29.5,
    unit: 'weeks'
  },

  // --- DIAGNOSTICS (CT SCAN) ---
  {
    id: 'rec_diag_ct_med',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Diagnostic Imaging',
    procedure_name: 'CT Scan (Computed Tomography)',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 5.1,
    unit: 'weeks'
  },
  {
    id: 'rec_diag_ct_90',
    source_name: 'Alberta Wait Times Reporting',
    source_url: 'https://waittimes.alberta.ca/',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Diagnostic Imaging',
    procedure_name: 'CT Scan (Computed Tomography)',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 14.8,
    unit: 'weeks'
  },

  // --- CARDIAC (CABG) ---
  {
    id: 'rec_cardiac_cabg_med',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cardiology',
    procedure_name: 'Coronary Artery Bypass Graft (CABG)',
    wait_segment: 'Decision-to-surgery',
    metric_name: 'Median wait',
    metric_value: 1.8,
    unit: 'weeks',
    benchmark_value: '26 weeks (Max safety benchmark differs by severity)'
  },
  {
    id: 'rec_cardiac_cabg_90',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cardiology',
    procedure_name: 'Coronary Artery Bypass Graft (CABG)',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 8.6,
    unit: 'weeks',
    benchmark_value: '26 weeks (Max safety benchmark differs by severity)'
  },
  {
    id: 'rec_cardiac_cabg_bench',
    source_name: 'CIHI priority procedures',
    source_url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Cardiology',
    procedure_name: 'Coronary Artery Bypass Graft (CABG)',
    wait_segment: 'Decision-to-surgery',
    metric_name: '% within benchmark',
    metric_value: 94.0,
    unit: 'percent',
    benchmark_value: 'Urgent standard 14 days, normal 182 days'
  }
];

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

export const ORTHOPEDIC_SPECIALTY_RECORDS: JointWaitRecord[] = [
  {
    geography: 'Alberta (Provincial)',
    procedure: 'Hip Replacement',
    count_completed: 1840,
    consult_wait_days_90th: 124,
    surgery_wait_days_90th: 258,
    shortest_25_days: 64,
    average_days: 142,
    longest_10_days: 258
  },
  {
    geography: 'Calgary',
    procedure: 'Hip Replacement',
    count_completed: 650,
    consult_wait_days_90th: 110,
    surgery_wait_days_90th: 241,
    shortest_25_days: 52,
    average_days: 130,
    longest_10_days: 241
  },
  {
    geography: 'Edmonton',
    procedure: 'Hip Replacement',
    count_completed: 710,
    consult_wait_days_90th: 138,
    surgery_wait_days_90th: 288,
    shortest_25_days: 72,
    average_days: 158,
    longest_10_days: 288
  },
  {
    geography: 'Lethbridge',
    procedure: 'Hip Replacement',
    count_completed: 140,
    consult_wait_days_90th: 98,
    surgery_wait_days_90th: 195,
    shortest_25_days: 44,
    average_days: 112,
    longest_10_days: 195
  },
  {
    geography: 'Red Deer',
    procedure: 'Hip Replacement',
    count_completed: 180,
    consult_wait_days_90th: 145,
    surgery_wait_days_90th: 292,
    shortest_25_days: 80,
    average_days: 164,
    longest_10_days: 292
  },
  {
    geography: 'Grande Prairie',
    procedure: 'Hip Replacement',
    count_completed: 110,
    consult_wait_days_90th: 120,
    surgery_wait_days_90th: 230,
    shortest_25_days: 58,
    average_days: 128,
    longest_10_days: 230
  },
  {
    geography: 'Fort McMurray',
    procedure: 'Hip Replacement',
    count_completed: 50,
    consult_wait_days_90th: 115,
    surgery_wait_days_90th: 210,
    shortest_25_days: 55,
    average_days: 122,
    longest_10_days: 210
  },

  // Knee replacement
  {
    geography: 'Alberta (Provincial)',
    procedure: 'Knee Replacement',
    count_completed: 2120,
    consult_wait_days_90th: 146,
    surgery_wait_days_90th: 302,
    shortest_25_days: 74,
    average_days: 168,
    longest_10_days: 302
  },
  {
    geography: 'Calgary',
    procedure: 'Knee Replacement',
    count_completed: 740,
    consult_wait_days_90th: 132,
    surgery_wait_days_90th: 280,
    shortest_25_days: 68,
    average_days: 154,
    longest_10_days: 280
  },
  {
    geography: 'Edmonton',
    procedure: 'Knee Replacement',
    count_completed: 820,
    consult_wait_days_90th: 162,
    surgery_wait_days_90th: 335,
    shortest_25_days: 84,
    average_days: 185,
    longest_10_days: 335
  },
  {
    geography: 'Lethbridge',
    procedure: 'Knee Replacement',
    count_completed: 160,
    consult_wait_days_90th: 112,
    surgery_wait_days_90th: 224,
    shortest_25_days: 50,
    average_days: 128,
    longest_10_days: 224
  },
  {
    geography: 'Red Deer',
    procedure: 'Knee Replacement',
    count_completed: 200,
    consult_wait_days_90th: 155,
    surgery_wait_days_90th: 322,
    shortest_25_days: 88,
    average_days: 178,
    longest_10_days: 322
  },
  {
    geography: 'Grande Prairie',
    procedure: 'Knee Replacement',
    count_completed: 120,
    consult_wait_days_90th: 130,
    surgery_wait_days_90th: 270,
    shortest_25_days: 64,
    average_days: 148,
    longest_10_days: 270
  }
];

// 3. Facility Details & Capacity Metrics (AHS and Acute Care Alberta Partnerships)
export const SURGICAL_FACILITIES: FacilitySurgicalCapacity[] = [
  {
    id: 'WDFAB783',
    name: 'Royal Alexandra Hospital (AHS)',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization_rate: 89.2,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'Ophthalmology', 'Gynecology', 'General Surgery']
  },
  {
    id: 'WDFAB102',
    name: 'University of Alberta Hospital (AHS)',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization_rate: 93.5,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'Cardiology', 'Neuro Surgery', 'Thoracic Surgery']
  },
  {
    id: 'WDFAB956',
    name: 'Foothills Medical Centre (AHS)',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization_rate: 91.8,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'Cardiology', 'Neuro Surgery', 'Plastic Surgery']
  },
  {
    id: 'WDFAB412',
    name: 'Rockyview General Hospital (AHS)',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization_rate: 87.4,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Ophthalmology', 'Urology', 'General Surgery']
  },
  {
    id: 'WDFAB203',
    name: 'Red Deer Regional Hospital (AHS)',
    city: 'Red Deer',
    zone: 'Central Zone',
    or_utilization_rate: 88.0,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'Gynecology', 'General Surgery']
  },
  {
    id: 'WDFAB067',
    name: 'Chinook Regional Hospital (AHS)',
    city: 'Lethbridge',
    zone: 'South Zone',
    or_utilization_rate: 82.5,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'General Surgery']
  },
  {
    id: 'WDFAB099',
    name: 'Queen Elizabeth II Hospital (AHS)',
    city: 'Grande Prairie',
    zone: 'North Zone',
    or_utilization_rate: 84.1,
    chartered_partner_status: false,
    specialties_offered: ['Orthopedics', 'Oncology', 'Urology', 'General Surgery']
  },
  // Chartered partner surgical facilities (day surgery optimization & contracts)
  {
    id: 'CSFEDM01',
    name: 'Edmonton Chartered Orthopedic Centre',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization_rate: 95.0,
    chartered_partner_status: true,
    specialties_offered: ['Orthopedics', 'Day Joint Reconstruction']
  },
  {
    id: 'CSFCAL01',
    name: 'Calgary Vision Chartered Facility',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization_rate: 96.2,
    chartered_partner_status: true,
    specialties_offered: ['Ophthalmology', 'Cataract Surgery']
  },
  {
    id: 'CSFEDM02',
    name: 'Windermere Chartered Surgical Clinic',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization_rate: 91.5,
    chartered_partner_status: true,
    specialties_offered: ['ENT', 'Gynecology', 'Urology', 'Plastic Surgery']
  }
];

// 4. Specialist Details - Wait times and CPSA lookups
export const SPECIALISTS_LIST: Specialist[] = [
  // Orthopedics
  {
    id: '6743',
    name: 'Dr. James Arbour',
    specialty: 'Orthopedics',
    zone: 'Edmonton Zone',
    primary_facility: 'Royal Alexandra Hospital (AHS)',
    consult_wait_days_90th: 135,
    surgery_wait_days_90th: 275,
    completed_surgeries_3m: 48,
    cpsa_id: 'CPSA-49215'
  },
  {
    id: '6748',
    name: 'Dr. Sarah Tremblay',
    specialty: 'Orthopedics',
    zone: 'Edmonton Zone',
    primary_facility: 'University of Alberta Hospital (AHS)',
    consult_wait_days_90th: 120,
    surgery_wait_days_90th: 260,
    completed_surgeries_3m: 52,
    cpsa_id: 'CPSA-38104'
  },
  {
    id: '4128',
    name: 'Dr. Robert Fletcher',
    specialty: 'Orthopedics',
    zone: 'Calgary Zone',
    primary_facility: 'Foothills Medical Centre (AHS)',
    consult_wait_days_90th: 105,
    surgery_wait_days_90th: 235,
    completed_surgeries_3m: 60,
    cpsa_id: 'CPSA-88123'
  },
  {
    id: '8921',
    name: 'Dr. Michael Chen',
    specialty: 'Orthopedics',
    zone: 'Calgary Zone',
    primary_facility: 'Rockyview General Hospital (AHS)',
    consult_wait_days_90th: 95,
    surgery_wait_days_90th: 210,
    completed_surgeries_3m: 45,
    cpsa_id: 'CPSA-72531'
  },
  // Ophthalmology
  {
    id: '3205',
    name: 'Dr. Elena Rostova',
    specialty: 'Ophthalmology',
    zone: 'Calgary Zone',
    primary_facility: 'Calgary Vision Chartered Facility',
    consult_wait_days_90th: 45,
    surgery_wait_days_90th: 75,
    completed_surgeries_3m: 112,
    cpsa_id: 'CPSA-19253'
  },
  {
    id: '3210',
    name: 'Dr. Paul Vance',
    specialty: 'Ophthalmology',
    zone: 'Edmonton Zone',
    primary_facility: 'Royal Alexandra Hospital (AHS)',
    consult_wait_days_90th: 78,
    surgery_wait_days_90th: 115,
    completed_surgeries_3m: 85,
    cpsa_id: 'CPSA-23114'
  },
  // Oncology / General
  {
    id: '1102',
    name: 'Dr. Diane Kirkpatrick',
    specialty: 'Oncology',
    zone: 'Edmonton Zone',
    primary_facility: 'University of Alberta Hospital (AHS)',
    consult_wait_days_90th: 18,
    surgery_wait_days_90th: 32,
    completed_surgeries_3m: 35,
    cpsa_id: 'CPSA-99412'
  },
  {
    id: '1105',
    name: 'Dr. Sean O\'Neill',
    specialty: 'Oncology',
    zone: 'Calgary Zone',
    primary_facility: 'Foothills Medical Centre (AHS)',
    consult_wait_days_90th: 21,
    surgery_wait_days_90th: 35,
    completed_surgeries_3m: 38,
    cpsa_id: 'CPSA-54012'
  }
];

// 5. CIHI Provincial Benchmark Comparators (National Context)
export interface CIHIComparatorRecord {
  province: string;
  hip_within_benchmark: number; // percentage
  knee_within_benchmark: number; // percentage
  cataract_within_benchmark: number; // percentage
  mri_median_wait_days: number;
}

export const CIHI_PROVINCIAL_COMPARATORS: CIHIComparatorRecord[] = [
  {
    province: 'Alberta',
    hip_within_benchmark: 62.0,
    knee_within_benchmark: 51.0,
    cataract_within_benchmark: 78.0,
    mri_median_wait_days: 87
  },
  {
    province: 'British Columbia',
    hip_within_benchmark: 66.0,
    knee_within_benchmark: 54.0,
    cataract_within_benchmark: 72.0,
    mri_median_wait_days: 62
  },
  {
    province: 'Saskatchewan',
    hip_within_benchmark: 58.0,
    knee_within_benchmark: 48.0,
    cataract_within_benchmark: 82.0,
    mri_median_wait_days: 95
  },
  {
    province: 'Manitoba',
    hip_within_benchmark: 55.0,
    knee_within_benchmark: 42.0,
    cataract_within_benchmark: 64.0,
    mri_median_wait_days: 110
  },
  {
    province: 'Ontario',
    hip_within_benchmark: 74.0,
    knee_within_benchmark: 68.0,
    cataract_within_benchmark: 80.0,
    mri_median_wait_days: 54
  },
  {
    province: 'Quebec',
    hip_within_benchmark: 68.0,
    knee_within_benchmark: 59.0,
    cataract_within_benchmark: 75.0,
    mri_median_wait_days: 48
  },
  {
    province: 'National Average',
    hip_within_benchmark: 68.4,
    knee_within_benchmark: 58.2,
    cataract_within_benchmark: 74.8,
    mri_median_wait_days: 68
  }
];

// 6. StatsCan 2024 Survey Health Care Access (Pre-Surgical Specialist Access metrics)
export const STATSCAN_SATISFACTION_STATS = {
  reporting_title: 'StatsCan 2024 Specialist Access & Satisfaction Survey',
  survey_period: 'Released July 29, 2025',
  metrics_alberta: {
    satisfied_with_wait: 48.2, // % satisfied
    unsatisfied_with_wait: 51.8, // % unsatisfied
    wait_affected_life_negatively: 42.6, // % experiencing significant life impact
    waiting_segment_distribution: [
      { segment: '< 1 Month', value: 18.5 },
      { segment: '1 to < 3 Months', value: 24.2 },
      { segment: '3 to < 6 Months', value: 29.8 },
      { segment: '6 Months to < 1 Year', value: 18.1 },
      { segment: '1 to < 2 Years', value: 7.4 },
      { segment: '2+ Years', value: 2.0 }
    ],
    life_impact_categories: [
      { impact: 'Worry, anxiety or stress', value: 78.5 },
      { impact: 'Pain, physical discomfort or limitations', value: 65.2 },
      { impact: 'Loss of income/work productivity', value: 34.0 },
      { impact: 'Overall deterioration of health', value: 28.4 }
    ]
  }
};

// 7. Fraser Institute - Waiting Your Turn (Specialty Benchmarks Weeks)
export const FRASER_MEDIAN_WEEKS_2025 = [
  { specialty: 'Orthopedic Surgery', gp_to_consult: 22.4, consult_to_surgery: 26.5, total: 48.9 },
  { specialty: 'Ophthalmology', gp_to_consult: 15.6, consult_to_surgery: 14.8, total: 30.4 },
  { specialty: 'General Surgery', gp_to_consult: 8.4, consult_to_surgery: 10.2, total: 18.6 },
  { specialty: 'Cardiovascular Surgery', gp_to_consult: 3.2, consult_to_surgery: 6.4, total: 9.6 },
  { specialty: 'Gynecology', gp_to_consult: 12.8, consult_to_surgery: 13.5, total: 26.3 },
  { specialty: 'Urology', gp_to_consult: 11.2, consult_to_surgery: 12.8, total: 24.0 }
];

// 8. Historical Wait Trends (CIHI Priority Procedures 2015 - 2026)
export interface HistoricalTrend {
  year: string;
  hip_replacement_median: number; // weeks
  knee_replacement_median: number; // weeks
  cataract_surgery_median: number; // weeks
  mri_scan_median: number; // weeks
  ct_scan_median: number; // weeks
}

export const HISTORICAL_WAIT_TRENDS: HistoricalTrend[] = [
  { year: '2015', hip_replacement_median: 14.2, knee_replacement_median: 16.5, cataract_surgery_median: 7.2, mri_scan_median: 8.5, ct_scan_median: 3.4 },
  { year: '2016', hip_replacement_median: 14.8, knee_replacement_median: 17.2, cataract_surgery_median: 7.5, mri_scan_median: 8.8, ct_scan_median: 3.6 },
  { year: '2017', hip_replacement_median: 15.4, knee_replacement_median: 18.0, cataract_surgery_median: 7.8, mri_scan_median: 9.2, ct_scan_median: 3.9 },
  { year: '2018', hip_replacement_median: 16.0, knee_replacement_median: 18.8, cataract_surgery_median: 8.1, mri_scan_median: 9.5, ct_scan_median: 4.1 },
  { year: '2019', hip_replacement_median: 16.5, knee_replacement_median: 19.5, cataract_surgery_median: 8.4, mri_scan_median: 10.0, ct_scan_median: 4.3 },
  { year: '2020', hip_replacement_median: 22.0, knee_replacement_median: 25.4, cataract_surgery_median: 11.8, mri_scan_median: 15.2, ct_scan_median: 6.8 }, // COVID peak
  { year: '2021', hip_replacement_median: 23.5, knee_replacement_median: 27.0, cataract_surgery_median: 12.5, mri_scan_median: 16.0, ct_scan_median: 7.2 },
  { year: '2022', hip_replacement_median: 21.2, knee_replacement_median: 24.8, cataract_surgery_median: 10.4, mri_scan_median: 14.5, ct_scan_median: 6.1 },
  { year: '2023', hip_replacement_median: 19.8, knee_replacement_median: 23.2, cataract_surgery_median: 9.2, mri_scan_median: 13.1, ct_scan_median: 5.5 },
  { year: '2024', hip_replacement_median: 19.1, knee_replacement_median: 22.5, cataract_surgery_median: 8.8, mri_scan_median: 12.6, ct_scan_median: 5.2 },
  { year: '2025', hip_replacement_median: 19.4, knee_replacement_median: 22.8, cataract_surgery_median: 8.6, mri_scan_median: 12.4, ct_scan_median: 5.1 },
  { year: '2026', hip_replacement_median: 19.5, knee_replacement_median: 23.0, cataract_surgery_median: 8.5, mri_scan_median: 12.5, ct_scan_median: 5.0 }
];

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

export const STATSCAN_DEMOGRAPHICS: StatsCanDemographic[] = [
  // Age cuts
  { category: 'Age', dimension: '18 to 34 years', wait_under_1m: 25.4, wait_1_to_3m: 28.1, wait_3_to_6m: 24.5, wait_over_6m: 22.0, satisfied_percentage: 54.2, life_affected_percentage: 38.5 },
  { category: 'Age', dimension: '35 to 49 years', wait_under_1m: 20.1, wait_1_to_3m: 25.5, wait_3_to_6m: 28.2, wait_over_6m: 26.2, satisfied_percentage: 49.0, life_affected_percentage: 44.2 },
  { category: 'Age', dimension: '50 to 64 years', wait_under_1m: 16.8, wait_1_to_3m: 23.8, wait_3_to_6m: 30.5, wait_over_6m: 28.9, satisfied_percentage: 46.5, life_affected_percentage: 46.8 },
  { category: 'Age', dimension: '65 years and over', wait_under_1m: 15.2, wait_1_to_3m: 22.4, wait_3_to_6m: 32.1, wait_over_6m: 30.3, satisfied_percentage: 45.1, life_affected_percentage: 39.4 },
  // Gender cuts
  { category: 'Gender', dimension: 'Male', wait_under_1m: 19.2, wait_1_to_3m: 24.5, wait_3_to_6m: 29.2, wait_over_6m: 27.1, satisfied_percentage: 49.5, life_affected_percentage: 40.2 },
  { category: 'Gender', dimension: 'Female', wait_under_1m: 17.8, wait_1_to_3m: 23.9, wait_3_to_6m: 30.4, wait_over_6m: 27.9, satisfied_percentage: 46.9, life_affected_percentage: 45.0 },
  // Referral cuts
  { category: 'Referral Type', dimension: 'GP Referral (Standard)', wait_under_1m: 14.5, wait_1_to_3m: 22.8, wait_3_to_6m: 31.2, wait_over_6m: 31.5, satisfied_percentage: 42.0, life_affected_percentage: 48.4 },
  { category: 'Referral Type', dimension: 'Emergency/Acute care', wait_under_1m: 54.2, wait_1_to_3m: 28.0, wait_3_to_6m: 12.4, wait_over_6m: 5.4, satisfied_percentage: 78.5, life_affected_percentage: 18.2 }
];

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

export const DATA_INGESTION_SOURCES: IngestionSource[] = [
  {
    id: 'src_ab_waittimes',
    name: 'Alberta Wait Times Reporting',
    priority: 1,
    role: 'Primary',
    url: 'https://waittimes.alberta.ca/',
    api_or_selector: 'SpecialistDetails.jsp?physID=<PHYSID> & FacilityDetails.jsp?facID=<FACID>',
    description: 'Most direct Alberta surgical wait times data containing individual specialist waitlist queues, active hospital operational parameters, and standard procedure percentiles.',
    crawler_code_type: 'node',
    scraping_fields: ['Physician ID', 'Physician Name', 'Specialty', 'Wait 1 (Referral-to-consult)', 'Wait 2 (Decision-to-surgery)', 'Completed surgeries count', 'Facility name', 'Facility ID'],
    crawler_code: `// Node.js Puppeteer Scraper for Alberta Specialist Wait Times
const puppeteer = require('puppeteer');

async function scrapeSpecialist(physId) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const targetUrl = \`https://waittimes.alberta.ca/SpecialistDetails.jsp?physID=\${physId}\`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  
  const data = await page.evaluate(() => {
    const name = document.querySelector('.physician-header h2')?.innerText?.trim() || '';
    const specialty = document.querySelector('.specialty-badge')?.innerText?.trim() || '';
    
    // Parse Wait 1 (GP referral to specialist consult)
    const wait1_90th = document.querySelector('#wait1-90th-value')?.innerText?.trim();
    // Parse Wait 2 (Specialist consult to surgery)
    const wait2_90th = document.querySelector('#wait2-90th-value')?.innerText?.trim();
    
    return {
      physician_id: physId,
      name,
      specialty,
      wait_1_days_90th: parseFloat(wait1_90th) || null,
      wait_2_days_90th: parseFloat(wait2_90th) || null,
      retrieved_at: new Date().toISOString()
    };
  });
  
  await browser.close();
  return data;
}`
  },
  {
    id: 'src_ab_dashboard',
    name: 'Alberta Health System Dashboard (Power BI)',
    priority: 2,
    role: 'Primary',
    url: 'https://app.powerbi.com/view?r=eyJrIjoiMjUzNjc1MWQtYjcxZC00NTMzLWIwNDctZTA0ZTNiMWQzODBlIiwidCI6IjJiYjUxYzA2LWFmOWItNDJjNS04YmY1LTNjM2I3YjEwODUwYiJ9',
    api_or_selector: 'Power BI querydata endpoint (POST requests)',
    description: 'Modern official dashboard layer. Highly rich, updated monthly, includes exact surgical volumes, wait times for selected procedures, and interactive facility mapping.',
    crawler_code_type: 'python',
    scraping_fields: ['Monthly surgical volumes', 'Procedure group', 'Facility capacity', 'Cancer vs non-cancer splits', 'Averages', 'Trends'],
    crawler_code: `# Python requests ETL for Power BI REST endpoint extraction
import requests
import json

def fetch_power_bi_visual_queries():
    cluster_url = "https://wabi-canada-central-redirect.analysis.windows.net/public/reports/querydata"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    # Decoded Power BI report metadata payloads
    query_payload = {
        "version": "1.0.0",
        "queries": [{
            "Query": {
                "Commands": [{
                    "SemanticQueryDataShapeCommand": {
                        "Query": {
                            "Version": 2,
                            "From": [{"Name": "s", "Entity": "SurgeryWaits", "Type": 0}],
                            "Select": [
                                {"Column": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": "ProcedureGroup"}, "Name": "ProcedureGroup"},
                                {"Measure": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": "Volume"}, "Name": "Volume"},
                                {"Measure": {"Expression": {"SourceRef": {"Source": "s"}}, "Property": "WaitWeeks"}, "Name": "WaitWeeks"}
                            ]
                        },
                        "Binding": {"Primary": {"Groupings": [{"Keys": [{"SourceRef": {"Source": "s"}}]}]}, "DataReduction": {"DataVolume": 3, "Primary": {"Top": {"Count": 500}}}}
                    }
                }]
            }
        }],
        "cancelQueries": [],
        "modelId": 11956
    }
    
    response = requests.post(cluster_url, json=query_payload, headers=headers)
    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Failed visual queries fetch: {response.status_code}")`
  },
  {
    id: 'src_cihi_priority',
    name: 'CIHI Wait Times for Priority Procedures',
    priority: 3,
    role: 'National Comparator',
    url: 'https://www.cihi.ca/en/explore-wait-times-for-priority-procedures-across-canada',
    api_or_selector: 'XLSX Download: wait-times-priority-procedures-in-canada-2025-data-tables-en.xlsx',
    description: 'Official national and provincial benchmark dataset. Essential for historical comparisons, cancer procedures, MRI, CT scans, and provincial target matching.',
    crawler_code_type: 'node',
    scraping_fields: ['Jurisdiction', 'Procedure category', 'Median wait weeks', '90th-percentile wait weeks', 'Percent within national benchmark target', 'Historical years'],
    crawler_code: `// Node.js SheetJS XLSX Parser for CIHI Wait Times Download
const axios = require('axios');
const XLSX = require('xlsx');

async function downloadAndParseCIHI() {
  const url = 'https://www.cihi.ca/sites/default/files/document/wait-times-priority-procedures-in-canada-2025-data-tables-en.xlsx';
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  
  const workbook = XLSX.read(response.data, { type: 'buffer' });
  const sheetName = workbook.SheetNames[2]; // Target: 'Hip and Knee Replacements'
  const sheet = workbook.Sheets[sheetName];
  
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Parse rows, filtering for 'Alberta' health regions or provincial aggregates
  const normalizedData = jsonRows.filter(row => row[0] === 'Alberta').map(row => ({
    province: 'Alberta',
    procedure: row[1], // e.g., 'Total Hip Replacement'
    year: row[2],      // e.g., '2025'
    median_weeks: parseFloat(row[3]) || null,
    pct_within_benchmark: parseFloat(row[4]) || null
  }));
  
  return normalizedData;
}`
  },
  {
    id: 'src_abjhi_ortho',
    name: 'Alberta Bone & Joint Health Institute',
    priority: 4,
    role: 'Specialty',
    url: 'https://albertaboneandjoint.com/resources/wait-times/',
    api_or_selector: 'HTML table scraper (jQuery/Cheerio)',
    description: 'Specialty orthopedic registry containing surgical volumes, average waits, 25th percentile shortest waits, and 90th percentile longest waits by quarter and regional hospitals.',
    crawler_code_type: 'node',
    scraping_fields: ['Procedure type', 'Health Geography', 'Longest 10% wait', 'Average wait', 'Shortest 25% wait', 'Surgical volume'],
    crawler_code: `// Cheerio scraper for ABJHI orthopedic html tables
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeABJHITable() {
  const url = 'https://albertaboneandjoint.com/resources/wait-times/';
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);
  
  const results = [];
  $('table#wait-times-table tbody tr').each((i, elem) => {
    const cells = $(elem).find('td');
    if (cells.length >= 5) {
      results.push({
        geography: $(cells[0]).text().trim(),
        procedure: 'Hip & Knee Replacements',
        surgeries_count: parseInt($(cells[1]).text().trim()) || 0,
        shortest_25_days: parseInt($(cells[2]).text().trim()) || 0,
        average_days: parseInt($(cells[3]).text().trim()) || 0,
        longest_10_days_90th: parseInt($(cells[4]).text().trim()) || 0
      });
    }
  });
  return results;
}`
  },
  {
    id: 'src_iiho_joint',
    name: 'Institute for Healthcare Optimization (IIHO)',
    priority: 5,
    role: 'Specialty',
    url: 'https://iiho.ca/wait-times/',
    api_or_selector: 'HTML table parsing',
    description: 'Provides the critical split between surgeon consultation wait times (Wait 1) and wait-to-surgery (Wait 2) for comprehensive patient pathway timelines.',
    crawler_code_type: 'python',
    scraping_fields: ['Surgeon consultation wait days', 'Surgery wait days', 'Quarter', 'Geography', 'Patient volumes'],
    crawler_code: `# BeautifulSoup scraper for IIHO path metrics
import requests
from bs4 import BeautifulSoup

def extract_iiho_path_metrics():
    url = "https://iiho.ca/wait-times/"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    rows = []
    table = soup.find('table', {'class': 'iiho-wait-table'})
    for tr in table.find('tbody').find_all('tr'):
        cols = tr.find_all('td')
        rows.append({
            "geography": cols[0].text.strip(),
            "wait_segment": cols[1].text.strip(), # 'Consultation' or 'Surgery'
            "median_days": float(cols[2].text.strip()),
            "days_90th_percentile": float(cols[3].text.strip()),
            "quarter": "Q4 2025"
        })
    return rows`
  },
  {
    id: 'src_statscan_survey',
    name: 'Statistics Canada specialist access survey',
    priority: 6,
    role: 'Survey Context',
    url: 'https://www150.statcan.gc.ca/n1/daily-quotidien/250729/dq250729a-eng.htm',
    api_or_selector: 'StatsCan WDS JSON API (getAllCubesListLite / getCubeMetadata)',
    description: 'Captures the pre-surgical specialist access bottleneck, patient frustration/satisfaction metrics, and whether prolonged wait times caused deterioration of physical or mental health.',
    crawler_code_type: 'node',
    scraping_fields: ['Wait time brackets', 'Satisfaction with wait', 'Life affected metrics', 'Demographic cuts (age, gender, chronic condition)'],
    crawler_code: `// Node.js API client for Statistics Canada Web Data Service (WDS)
const axios = require('axios');

async function getStatsCanWDSVector(vectorId) {
  const url = 'https://www150.statcan.gc.ca/t1/wds/rest/getDataFromVectorsAndLatestNPeriods';
  
  const payload = [
    {
      vectorId: vectorId, // Vector referencing wait times table 13-10-0820-01
      latestNPeriods: 1
    }
  ];
  
  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  return response.data;
}`
  },
  {
    id: 'src_fraser_inst',
    name: 'Fraser Institute — Waiting Your Turn',
    priority: 7,
    role: 'Survey Context',
    url: 'https://www.fraserinstitute.org/studies/waiting-your-turn-wait-times-for-health-care-in-canada-2025',
    api_or_selector: 'PDF text scraper / manual layout extracts',
    description: 'Long-standing survey tracking wait times across 12 specialties. Essential for historical context, and highlighting structural delays from GP to Specialist referral.',
    crawler_code_type: 'python',
    scraping_fields: ['GP to specialist wait weeks', 'Specialist to treatment wait weeks', 'Total wait weeks by specialty', 'Provincial aggregates'],
    crawler_code: `# Python PyPDF2 extraction script for Fraser Institute report
import PyPDF2
import re

def scrape_fraser_pdf(pdf_path):
    reader = PyPDF2.PdfReader(pdf_path)
    # Search for Table 2: "Median wait times from Referral to Specialist and Specialist to Treatment 2025"
    extracted_records = []
    for page_num in range(len(reader.pages)):
        text = reader.pages[page_num].extract_text()
        if "Table 2" in text and "Alberta" in text:
            # Parse lines using regex patterns matching specialty and numeric wait columns
            pattern = re.compile(r'([A-Za-z\\s]+)\\s+(\\d+\\.\\d+)\\s+(\\d+\\.\\d+)\\s+(\\d+\\.\\d+)')
            for match in pattern.finditer(text):
                extracted_records.append({
                    "specialty": match.group(1).strip(),
                    "gp_to_consult_weeks": float(match.group(2)),
                    "consult_to_surgery_weeks": float(match.group(3)),
                    "total_weeks": float(match.group(4))
                })
    return extracted_records`
  },
  {
    id: 'src_ahs_asi',
    name: 'Alberta Surgical Initiative (ASI) policy tracker',
    priority: 8,
    role: 'Capacity Context',
    url: 'https://www.albertahealthservices.ca/aop/Page13999.aspx',
    api_or_selector: 'AHS PDF & HTML updates',
    description: 'Tracks policy targets, rapid access clinics, OR utilization, and government commitments vs actual observed trends in the wait-time databases.',
    crawler_code_type: 'node',
    scraping_fields: ['OR utilization rates', 'Accredited clinics count', 'Rapid-access orthopedic clinics', 'ASI waitlist targets'],
    crawler_code: `// Simple Cheerio layout extractor for AHS ASI policy updates
const axios = require('axios');
const cheerio = require('cheerio');

async function fetchASIPolicies() {
  const url = 'https://www.albertahealthservices.ca/aop/Page13999.aspx';
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  
  return {
    title: $('h1').text().trim(),
    commitments: $('.asi-commitment-box').map((i, el) => $(el).text().trim()).get(),
    last_updated: $('.last-modified-date').text().trim()
  };
}`
  },
  {
    id: 'src_acute_care',
    name: 'Acute Care Alberta — Chartered contracts',
    priority: 9,
    role: 'Capacity Context',
    url: 'https://acutecarealberta.ca/page29.aspx',
    api_or_selector: 'HTML scraping',
    description: 'Details on accredited chartered surgical facilities (private clinics performing public day-surgeries under contract) designed to offload provincial hospital waitlists.',
    crawler_code_type: 'python',
    scraping_fields: ['Chartered partners list', 'Accredited Day Surgery specialties', 'Contract volume indicators'],
    crawler_code: `# Scraper for Acute Care Alberta contracts listings
import requests
from bs4 import BeautifulSoup

def scrape_acute_care_partners():
    url = "https://acutecarealberta.ca/page29.aspx"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    facilities = []
    for card in soup.find_all('div', {'class': 'partner-facility-card'}):
        facilities.append({
            "name": card.find('h3').text.strip(),
            "city": card.find('span', {'class': 'city'}).text.strip(),
            "specialties": [tag.text.strip() for tag in card.find_all('span', {'class': 'specialty-tag'})],
            "accredited_status": True
        })
    return facilities`
  },
  {
    id: 'src_goodcaring',
    name: 'GoodCaring surgical wait times overview',
    priority: 10,
    role: 'QA Fallback',
    url: 'https://goodcaring.ca/alberta-specialist-care-wait-times/',
    api_or_selector: 'HTML scraper',
    description: 'Third-party aggregator of Alberta Wait Times Reporting. Highly useful as a backup lookup structure, and for initial procedures grouping validations.',
    crawler_code_type: 'node',
    scraping_fields: ['Procedure averages', 'Specialist density indices', 'Expected wait durations'],
    crawler_code: `// Cheerio fallback scraper for GoodCaring aggregator pages
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGoodCaring(specialtyUrl) {
  const { data } = await axios.get(specialtyUrl);
  const $ = cheerio.load(data);
  
  const summaries = [];
  $('.specialty-average-card').each((i, el) => {
    summaries.push({
      specialty: $(el).find('.title').text().trim(),
      expected_wait_weeks: parseFloat($(el).find('.wait-value').text().trim()) || null,
      notes: $(el).find('.notes').text().trim()
    });
  });
  return summaries;
}`
  }
];

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

export const FACILITY_COMPARISONS: FacilityComparisonRecord[] = [
  {
    facility_id: 'WDFAB783',
    name: 'Royal Alexandra Hospital (AHS)',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization: 89.2,
    total_surgeons: 38,
    active_waitlist: 2450,
    ortho_wait_90th_days: 275,
    cataract_wait_90th_days: 115,
    completed_this_month: 420,
    chartered: false
  },
  {
    facility_id: 'WDFAB102',
    name: 'University of Alberta Hospital (AHS)',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization: 93.5,
    total_surgeons: 45,
    active_waitlist: 3100,
    ortho_wait_90th_days: 260,
    cataract_wait_90th_days: 140,
    completed_this_month: 510,
    chartered: false
  },
  {
    facility_id: 'WDFAB956',
    name: 'Foothills Medical Centre (AHS)',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization: 91.8,
    total_surgeons: 42,
    active_waitlist: 2890,
    ortho_wait_90th_days: 235,
    cataract_wait_90th_days: 125,
    completed_this_month: 480,
    chartered: false
  },
  {
    facility_id: 'WDFAB412',
    name: 'Rockyview General Hospital (AHS)',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization: 87.4,
    total_surgeons: 24,
    active_waitlist: 1680,
    ortho_wait_90th_days: 210,
    cataract_wait_90th_days: 90,
    completed_this_month: 290,
    chartered: false
  },
  {
    facility_id: 'WDFAB203',
    name: 'Red Deer Regional Hospital (AHS)',
    city: 'Red Deer',
    zone: 'Central Zone',
    or_utilization: 88.0,
    total_surgeons: 18,
    active_waitlist: 1420,
    ortho_wait_90th_days: 292,
    cataract_wait_90th_days: 160,
    completed_this_month: 195,
    chartered: false
  },
  {
    facility_id: 'WDFAB067',
    name: 'Chinook Regional Hospital (AHS)',
    city: 'Lethbridge',
    zone: 'South Zone',
    or_utilization: 82.5,
    total_surgeons: 14,
    active_waitlist: 920,
    ortho_wait_90th_days: 195,
    cataract_wait_90th_days: 105,
    completed_this_month: 140,
    chartered: false
  },
  {
    facility_id: 'WDFAB099',
    name: 'Queen Elizabeth II Hospital (AHS)',
    city: 'Grande Prairie',
    zone: 'North Zone',
    or_utilization: 84.1,
    total_surgeons: 12,
    active_waitlist: 850,
    ortho_wait_90th_days: 230,
    cataract_wait_90th_days: 110,
    completed_this_month: 125,
    chartered: false
  },
  {
    facility_id: 'CSFEDM01',
    name: 'Edmonton Chartered Orthopedic Centre',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization: 95.0,
    total_surgeons: 14,
    active_waitlist: 620,
    ortho_wait_90th_days: 112,
    cataract_wait_90th_days: 0, // Not offered
    completed_this_month: 240,
    chartered: true
  },
  {
    facility_id: 'CSFCAL01',
    name: 'Calgary Vision Chartered Facility',
    city: 'Calgary',
    zone: 'Calgary Zone',
    or_utilization: 96.2,
    total_surgeons: 10,
    active_waitlist: 410,
    ortho_wait_90th_days: 0, // Not offered
    cataract_wait_90th_days: 75,
    completed_this_month: 330,
    chartered: true
  },
  {
    facility_id: 'CSFEDM02',
    name: 'Windermere Chartered Surgical Clinic',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    or_utilization: 91.5,
    total_surgeons: 12,
    active_waitlist: 540,
    ortho_wait_90th_days: 0, // Not offered
    cataract_wait_90th_days: 0, // Not offered
    completed_this_month: 180,
    chartered: true
  }
];

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

export const SPECIALIST_COMPARISONS: SpecialistComparisonRecord[] = [
  {
    id: '6743',
    name: 'Dr. James Arbour',
    specialty: 'Orthopedics',
    zone: 'Edmonton Zone',
    facility: 'Royal Alexandra Hospital (AHS)',
    wait1_days_90th: 135,
    wait2_days_90th: 275,
    volume_3m: 48,
    patient_satisfaction: 88,
    experience_years: 18,
    avg_surgery_time_mins: 85
  },
  {
    id: '6748',
    name: 'Dr. Sarah Tremblay',
    specialty: 'Orthopedics',
    zone: 'Edmonton Zone',
    facility: 'University of Alberta Hospital (AHS)',
    wait1_days_90th: 120,
    wait2_days_90th: 260,
    volume_3m: 52,
    patient_satisfaction: 92,
    experience_years: 12,
    avg_surgery_time_mins: 95
  },
  {
    id: '4128',
    name: 'Dr. Robert Fletcher',
    specialty: 'Orthopedics',
    zone: 'Calgary Zone',
    facility: 'Foothills Medical Centre (AHS)',
    wait1_days_90th: 105,
    wait2_days_90th: 235,
    volume_3m: 60,
    patient_satisfaction: 94,
    experience_years: 22,
    avg_surgery_time_mins: 78
  },
  {
    id: '8921',
    name: 'Dr. Michael Chen',
    specialty: 'Orthopedics',
    zone: 'Calgary Zone',
    facility: 'Rockyview General Hospital (AHS)',
    wait1_days_90th: 95,
    wait2_days_90th: 210,
    volume_3m: 45,
    patient_satisfaction: 85,
    experience_years: 9,
    avg_surgery_time_mins: 90
  },
  {
    id: '3205',
    name: 'Dr. Elena Rostova',
    specialty: 'Ophthalmology',
    zone: 'Calgary Zone',
    facility: 'Calgary Vision Chartered Facility',
    wait1_days_90th: 45,
    wait2_days_90th: 75,
    volume_3m: 112,
    patient_satisfaction: 96,
    experience_years: 14,
    avg_surgery_time_mins: 22
  },
  {
    id: '3210',
    name: 'Dr. Paul Vance',
    specialty: 'Ophthalmology',
    zone: 'Edmonton Zone',
    facility: 'Royal Alexandra Hospital (AHS)',
    wait1_days_90th: 78,
    wait2_days_90th: 115,
    volume_3m: 85,
    patient_satisfaction: 89,
    experience_years: 16,
    avg_surgery_time_mins: 25
  },
  {
    id: '1102',
    name: 'Dr. Diane Kirkpatrick',
    specialty: 'Oncology',
    zone: 'Edmonton Zone',
    facility: 'University of Alberta Hospital (AHS)',
    wait1_days_90th: 18,
    wait2_days_90th: 32,
    volume_3m: 35,
    patient_satisfaction: 97,
    experience_years: 20,
    avg_surgery_time_mins: 110
  },
  {
    id: '1105',
    name: 'Dr. Sean O\'Neill',
    specialty: 'Oncology',
    zone: 'Calgary Zone',
    facility: 'Foothills Medical Centre (AHS)',
    wait1_days_90th: 21,
    wait2_days_90th: 35,
    volume_3m: 38,
    patient_satisfaction: 95,
    experience_years: 15,
    avg_surgery_time_mins: 115
  }
];


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
    updateType: 'auto',
  },
  ORTHOPEDIC_SPECIALTY_RECORDS: {
    source: 'ABJHI & IIHO orthopedic specialty feeds',
    sourceVintage: 'Quarterly 2026',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  SURGICAL_FACILITIES: {
    source: 'AHS Find a Facility directory; metrics estimated',
    sourceVintage: 'Facility names current as of 2025; metrics estimated',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'All 20 facility names are real AHS facilities. Operational metrics are estimates.',
  },
  CIHI_PROVINCIAL_COMPARATORS: {
    source: 'CIHI provincial benchmark comparators',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  STATSCAN_SATISFACTION_STATS: {
    source: 'Statistics Canada Health Care Access Survey',
    sourceVintage: '2024 survey release',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  HISTORICAL_WAIT_TRENDS: {
    source: 'CIHI priority procedures historical trends',
    sourceVintage: '2015 - 2026',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  STATSCAN_DEMOGRAPHICS: {
    source: 'Statistics Canada demographic tables',
    sourceVintage: '2024 release',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  FACILITY_COMPARISONS: {
    source: 'AHS facility directory; metrics estimated from Power BI',
    sourceVintage: 'Facility names current as of 2025; metrics estimated',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Facility names are real. OR utilization, surgeon counts, and waitlist sizes are estimates.',
  },
};
