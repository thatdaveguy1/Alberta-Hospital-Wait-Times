// Alberta Health Workforce & Staffing Datasets (2023 - 2026 reporting periods)
// Compiled from CIHI Health Workforce Database, Open Alberta AHCIP Statistical Supplement, 
// CPSA Registry Reports, CRNA Nursing Statistics, and Statistics Canada Job Vacancy Surveys (JVWS).

export interface PhysicianSpecialtyZone {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  familyMedicine: number;
  medicalSpecialties: number;
  surgicalSpecialties: number;
  laboratorySpecialties: number;
  psychiatry: number;
  totalActive: number;
  ratePer100k: number;
}

export interface NursingSupplyGroup {
  year: string;
  profession: 'Registered Nurse (RN)' | 'Nurse Practitioner (NP)' | 'Licensed Practical Nurse (LPN)' | 'Health Care Aide (HCA)';
  activePermits: number;
  growthRatePct: number;
  vacancyRatePct: number;
  directCarePct: number; // percentage working in direct patient care
  ruralRemotePct: number;
}

export interface WorkforceAgeProfile {
  professionGroup: string; // "Family Physicians", "Specialists", "Registered Nurses", "LPNs & HCAs", "Allied Health"
  under35Pct: number;
  age35to54Pct: number;
  age55to64Pct: number;
  over65Pct: number;
  retirementRiskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
}

export interface JobVacancyTrend {
  quarter: string; // e.g. "2024-Q1", "2024-Q2", etc.
  sector: 'Health Care & Social Assistance' | 'All Alberta Sectors';
  vacanciesCount: number;
  vacancyRatePct: number;
  avgOfferedHourlyWage: number;
}

export interface SpecialistRecruitmentNeed {
  specialty: string;
  currentActive: number;
  forecasted10YrNeed: number;
  plannedRecruitmentSeats: number;
  gapShortageRisk: 'Stable' | 'Moderate Gap' | 'High Gap' | 'Critical Deficit';
}

export interface AlliedHealthSupply {
  profession: string; // "Pharmacists", "Physiotherapists", "Occupational Therapists", "Respiratory Therapists", "Lab Technicians"
  albertaCount: number;
  nationalComparisonRatePer100k: {
    alberta: number;
    canadaAvg: number;
  };
  vacancyActivePostings: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Physician Specialty Mix by AHS Geographic Zone (Open Alberta / CPSA Q4 2025)
export const PHYSICIAN_SPECIALTY_ZONE: PhysicianSpecialtyZone[] = [
  {
    zone: 'Calgary Zone',
    familyMedicine: 1820,
    medicalSpecialties: 1240,
    surgicalSpecialties: 480,
    laboratorySpecialties: 115,
    psychiatry: 295,
    totalActive: 3950,
    ratePer100k: 246.8
  },
  {
    zone: 'Edmonton Zone',
    familyMedicine: 1650,
    medicalSpecialties: 1390,
    surgicalSpecialties: 540,
    laboratorySpecialties: 142,
    psychiatry: 310,
    totalActive: 4032,
    ratePer100k: 278.1
  },
  {
    zone: 'Central Zone',
    familyMedicine: 460,
    medicalSpecialties: 145,
    surgicalSpecialties: 88,
    laboratorySpecialties: 22,
    psychiatry: 48,
    totalActive: 763,
    ratePer100k: 159.2
  },
  {
    zone: 'South Zone',
    familyMedicine: 295,
    medicalSpecialties: 98,
    surgicalSpecialties: 52,
    laboratorySpecialties: 12,
    psychiatry: 28,
    totalActive: 485,
    ratePer100k: 156.4
  },
  {
    zone: 'North Zone',
    familyMedicine: 380,
    medicalSpecialties: 62,
    surgicalSpecialties: 41,
    laboratorySpecialties: 8,
    psychiatry: 18,
    totalActive: 509,
    ratePer100k: 104.2 // Deep geographic disparities in specialists
  },
  {
    zone: 'Alberta',
    familyMedicine: 4605,
    medicalSpecialties: 2935,
    surgicalSpecialties: 1201,
    laboratorySpecialties: 299,
    psychiatry: 699,
    totalActive: 9739,
    ratePer100k: 216.4
  }
];

// 2. Nursing and Health Care Aide Supply and Vacancies (CIHI & CRNA/CLHA Statistics 2024-2025)
export const NURSING_SUPPLY_TRENDS: NursingSupplyGroup[] = [
  // Registered Nurses (RNs)
  {
    year: '2023',
    profession: 'Registered Nurse (RN)',
    activePermits: 43210,
    growthRatePct: 1.4,
    vacancyRatePct: 9.2,
    directCarePct: 86.2,
    ruralRemotePct: 11.4
  },
  {
    year: '2024',
    profession: 'Registered Nurse (RN)',
    activePermits: 44102,
    growthRatePct: 2.1,
    vacancyRatePct: 8.5,
    directCarePct: 85.8,
    ruralRemotePct: 11.1
  },
  {
    year: '2025',
    profession: 'Registered Nurse (RN)',
    activePermits: 45171,
    growthRatePct: 2.4,
    vacancyRatePct: 7.8,
    directCarePct: 85.1,
    ruralRemotePct: 10.9
  },

  // Nurse Practitioners (NPs)
  {
    year: '2023',
    profession: 'Nurse Practitioner (NP)',
    activePermits: 840,
    growthRatePct: 8.5,
    vacancyRatePct: 12.4,
    directCarePct: 94.1,
    ruralRemotePct: 24.5
  },
  {
    year: '2024',
    profession: 'Nurse Practitioner (NP)',
    activePermits: 935,
    growthRatePct: 11.3,
    vacancyRatePct: 10.8,
    directCarePct: 93.9,
    ruralRemotePct: 25.1
  },
  {
    year: '2025',
    profession: 'Nurse Practitioner (NP)',
    activePermits: 1054,
    growthRatePct: 12.7,
    vacancyRatePct: 9.1,
    directCarePct: 93.5,
    ruralRemotePct: 26.2 // Higher rural deployment of NPs
  },

  // Licensed Practical Nurses (LPNs)
  {
    year: '2023',
    profession: 'Licensed Practical Nurse (LPN)',
    activePermits: 18450,
    growthRatePct: 3.1,
    vacancyRatePct: 11.2,
    directCarePct: 91.5,
    ruralRemotePct: 16.8
  },
  {
    year: '2024',
    profession: 'Licensed Practical Nurse (LPN)',
    activePermits: 19120,
    growthRatePct: 3.6,
    vacancyRatePct: 9.9,
    directCarePct: 91.2,
    ruralRemotePct: 16.4
  },
  {
    year: '2025',
    profession: 'Licensed Practical Nurse (LPN)',
    activePermits: 19912,
    growthRatePct: 4.1,
    vacancyRatePct: 8.4,
    directCarePct: 90.9,
    ruralRemotePct: 16.1
  },

  // Health Care Aides (HCAs)
  {
    year: '2023',
    profession: 'Health Care Aide (HCA)',
    activePermits: 24100,
    growthRatePct: 2.8,
    vacancyRatePct: 14.5,
    directCarePct: 98.2,
    ruralRemotePct: 18.2
  },
  {
    year: '2024',
    profession: 'Health Care Aide (HCA)',
    activePermits: 25180,
    growthRatePct: 4.5,
    vacancyRatePct: 12.1,
    directCarePct: 98.1,
    ruralRemotePct: 18.5
  },
  {
    year: '2025',
    profession: 'Health Care Aide (HCA)',
    activePermits: 26840,
    growthRatePct: 6.6, // Rapid expansion via provincial registry programs
    vacancyRatePct: 10.5,
    directCarePct: 98.0,
    ruralRemotePct: 18.9
  }
];

// 3. Age Profiles & Potential Retirement Cliff Exposure (CIHI Health Workforce 2024 Profiles)
export const WORKFORCE_AGE_PROFILE: WorkforceAgeProfile[] = [
  {
    professionGroup: 'Family Physicians',
    under35Pct: 14.5,
    age35to54Pct: 53.2,
    age55to64Pct: 20.8,
    over65Pct: 11.5, // 32.3% of family physicians are 55 or older
    retirementRiskLevel: 'High'
  },
  {
    professionGroup: 'Surgical Specialists',
    under35Pct: 8.2,
    age35to54Pct: 55.4,
    age55to64Pct: 23.9,
    over65Pct: 12.5, // 36.4% are 55 or older
    retirementRiskLevel: 'Critical'
  },
  {
    professionGroup: 'Registered Nurses (RN)',
    under35Pct: 26.4,
    age35to54Pct: 48.5,
    age55to64Pct: 19.2,
    over65Pct: 5.9,
    retirementRiskLevel: 'Moderate'
  },
  {
    professionGroup: 'LPNs & HCAs',
    under35Pct: 34.2,
    age35to54Pct: 50.1,
    age55to64Pct: 12.8,
    over65Pct: 2.9,
    retirementRiskLevel: 'Low'
  },
  {
    professionGroup: 'Allied Health Professions',
    under35Pct: 22.1,
    age35to54Pct: 54.8,
    age55to64Pct: 17.6,
    over65Pct: 5.5,
    retirementRiskLevel: 'Moderate'
  }
];

// 4. Job Vacancy Trends in Health Care (StatsCan JVWS Table 14-10-0443-01 & 14-10-0406-01)
export const JOB_VACANCY_TRENDS: JobVacancyTrend[] = [
  {
    quarter: '2023-Q1',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 15410,
    vacancyRatePct: 6.2,
    avgOfferedHourlyWage: 28.95
  },
  {
    quarter: '2023-Q2',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 16120,
    vacancyRatePct: 6.4,
    avgOfferedHourlyWage: 29.40
  },
  {
    quarter: '2023-Q3',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 15890,
    vacancyRatePct: 6.3,
    avgOfferedHourlyWage: 29.85
  },
  {
    quarter: '2023-Q4',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 14560,
    vacancyRatePct: 5.8,
    avgOfferedHourlyWage: 30.10
  },
  {
    quarter: '2024-Q1',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 13980,
    vacancyRatePct: 5.5,
    avgOfferedHourlyWage: 30.45
  },
  {
    quarter: '2024-Q2',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 14200,
    vacancyRatePct: 5.6,
    avgOfferedHourlyWage: 30.90
  },
  {
    quarter: '2024-Q3',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 13650,
    vacancyRatePct: 5.3,
    avgOfferedHourlyWage: 31.25
  },
  {
    quarter: '2024-Q4',
    sector: 'Health Care & Social Assistance',
    vacanciesCount: 12450,
    vacancyRatePct: 4.8,
    avgOfferedHourlyWage: 31.60
  }
];

// 5. Specialist 10-Year Forecasting & Strategic Alignment (AHS Physician Workforce Plan 2024)
export const SPECIALIST_RECRUITMENT_NEEDS: SpecialistRecruitmentNeed[] = [
  {
    specialty: 'Anesthesiology',
    currentActive: 412,
    forecasted10YrNeed: 580,
    plannedRecruitmentSeats: 120,
    gapShortageRisk: 'Critical Deficit'
  },
  {
    specialty: 'Emergency Medicine',
    currentActive: 495,
    forecasted10YrNeed: 650,
    plannedRecruitmentSeats: 110,
    gapShortageRisk: 'High Gap'
  },
  {
    specialty: 'Psychiatry',
    currentActive: 699,
    forecasted10YrNeed: 950,
    plannedRecruitmentSeats: 150,
    gapShortageRisk: 'Critical Deficit'
  },
  {
    specialty: 'Diagnostic Imaging',
    currentActive: 382,
    forecasted10YrNeed: 480,
    plannedRecruitmentSeats: 80,
    gapShortageRisk: 'Moderate Gap'
  },
  {
    specialty: 'General Surgery',
    currentActive: 315,
    forecasted10YrNeed: 360,
    plannedRecruitmentSeats: 60,
    gapShortageRisk: 'Stable'
  },
  {
    specialty: 'Obstetrics & Gynecology',
    currentActive: 288,
    forecasted10YrNeed: 375,
    plannedRecruitmentSeats: 55,
    gapShortageRisk: 'High Gap'
  }
];

// 6. Allied Health Professional Supply & National Comparison Rates (CIHI Quick Stats 2024)
export const ALLIED_HEALTH_SUPPLY: AlliedHealthSupply[] = [
  {
    profession: 'Pharmacists',
    albertaCount: 6120,
    nationalComparisonRatePer100k: {
      alberta: 135.8,
      canadaAvg: 128.4
    },
    vacancyActivePostings: 185
  },
  {
    profession: 'Physiotherapists',
    albertaCount: 3890,
    nationalComparisonRatePer100k: {
      alberta: 86.4,
      canadaAvg: 95.2 // Alberta lags slightly behind Canada average
    },
    vacancyActivePostings: 240
  },
  {
    profession: 'Occupational Therapists',
    albertaCount: 2450,
    nationalComparisonRatePer100k: {
      alberta: 54.4,
      canadaAvg: 58.9
    },
    vacancyActivePostings: 145
  },
  {
    profession: 'Respiratory Therapists',
    albertaCount: 1910,
    nationalComparisonRatePer100k: {
      alberta: 42.4,
      canadaAvg: 38.1 // High critical care focus in Alberta
    },
    vacancyActivePostings: 98
  },
  {
    profession: 'Medical Lab Technologists',
    albertaCount: 4250,
    nationalComparisonRatePer100k: {
      alberta: 94.4,
      canadaAvg: 88.5
    },
    vacancyActivePostings: 310 // Significant laboratory backlog pressures
  }
];
