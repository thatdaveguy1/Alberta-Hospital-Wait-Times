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
export const PHYSICIAN_SPECIALTY_ZONE: PhysicianSpecialtyZone[] = [];

// 2. Nursing and Health Care Aide Supply and Vacancies (CIHI & CRNA/CLHA Statistics 2024-2025)
export const NURSING_SUPPLY_TRENDS: NursingSupplyGroup[] = [];

// 3. Age Profiles & Potential Retirement Cliff Exposure (CIHI Health Workforce 2024 Profiles)
export const WORKFORCE_AGE_PROFILE: WorkforceAgeProfile[] = [];

// 4. Job Vacancy Trends in Health Care (StatsCan JVWS Table 14-10-0443-01 & 14-10-0406-01)
export const JOB_VACANCY_TRENDS: JobVacancyTrend[] = [];

// 5. Specialist 10-Year Forecasting & Strategic Alignment (AHS Physician Workforce Plan 2024)
export const SPECIALIST_RECRUITMENT_NEEDS: SpecialistRecruitmentNeed[] = [];

// 6. Allied Health Professional Supply & National Comparison Rates (CIHI Quick Stats 2024)
export const ALLIED_HEALTH_SUPPLY: AlliedHealthSupply[] = [];
