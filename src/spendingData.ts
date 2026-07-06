// Alberta Health Spending, Activity & Productivity Datasets (2015 - 2026)
// Compiled from:
// - CIHI National Health Expenditure Trends (NHEX)
// - CIHI Spending Trends in Health Service Delivery & Cost of a Standard Hospital Stay (CSHS)
// - AHS Annual Reports, Consolidated Financial Statements & Quick Facts
// - Open Alberta AHCIP Statistical Supplement (Physician Payments and Services)

export interface NationalSpendingCompare {
  province: string;
  spendingPerCapita: number;       // total health expenditure per capita in CAD
  spendingAsPercentGdp: number;    // %
  hospitalSpendingPerCapita: number;
  physicianSpendingPerCapita: number;
  drugSpendingPerCapita: number;
  bedsPer100k: number;
  costPerStandardStay: number;     // CIHI Cost of a Standard Hospital Stay in CAD
}

export interface ActivityVolumeTrend {
  fiscalYear: string;
  totalExpenseBillions: number;
  surgeriesCount: number;
  ctExamsCount: number;
  labTestsMillions: number;
  edVisitsMillions: number;
  hospitalAdmissions: number;
  physiciansCount: number;
}

export interface HospitalEfficiencyMetric {
  fiscalYear: string;
  spendingPerStaffedBed: number;   // CAD per bed
  hospitalizationsPerBed: number;  // admissions per staffed bed
  surgeriesPerBed: number;         // surgeries per staffed bed
  hoursWorkedPerBed: number;       // staff hours worked per bed
  standardStayCost: number;        // CIHI CSHS trend
}

export interface PhysicianPaymentSpecialty {
  specialtyGroup: string;
  physicianCount: number;
  totalPaymentsMillions: number;
  averagePaymentGross: number;     // gross payment per physician in CAD
  servicesPerPatient: number;
}

export interface SpendingByUseOfFunds {
  category: string;                // e.g. 'Hospitals', 'Physicians', 'Drugs', 'Public Health', 'Administration', 'Other'
  amountBillions: number;          // CAD Billions
  percentageShare: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. National spending and capacity scoreboard (CIHI NHEX & CSHS 2025/2026 releases)
export const NATIONAL_SPENDING_COMPARE: NationalSpendingCompare[] = [
  {
    province: 'Alberta',
    spendingPerCapita: 8540,
    spendingAsPercentGdp: 12.2,
    hospitalSpendingPerCapita: 3120,
    physicianSpendingPerCapita: 1480,
    drugSpendingPerCapita: 1140,
    bedsPer100k: 242,
    costPerStandardStay: 7420
  },
  {
    province: 'British Columbia',
    spendingPerCapita: 8120,
    spendingAsPercentGdp: 11.8,
    hospitalSpendingPerCapita: 2980,
    physicianSpendingPerCapita: 1390,
    drugSpendingPerCapita: 1040,
    bedsPer100k: 235,
    costPerStandardStay: 6840
  },
  {
    province: 'Saskatchewan',
    spendingPerCapita: 8350,
    spendingAsPercentGdp: 12.0,
    hospitalSpendingPerCapita: 3040,
    physicianSpendingPerCapita: 1410,
    drugSpendingPerCapita: 1080,
    bedsPer100k: 254,
    costPerStandardStay: 7120
  },
  {
    province: 'Ontario',
    spendingPerCapita: 7850,
    spendingAsPercentGdp: 11.2,
    hospitalSpendingPerCapita: 2810,
    physicianSpendingPerCapita: 1320,
    drugSpendingPerCapita: 990,
    bedsPer100k: 220,
    costPerStandardStay: 6240
  },
  {
    province: 'Quebec',
    spendingPerCapita: 7920,
    spendingAsPercentGdp: 11.5,
    hospitalSpendingPerCapita: 2840,
    physicianSpendingPerCapita: 1350,
    drugSpendingPerCapita: 1120,
    bedsPer100k: 238,
    costPerStandardStay: 6410
  },
  {
    province: 'Canada Average',
    spendingPerCapita: 8020,
    spendingAsPercentGdp: 11.6,
    hospitalSpendingPerCapita: 2910,
    physicianSpendingPerCapita: 1370,
    drugSpendingPerCapita: 1050,
    bedsPer100k: 232,
    costPerStandardStay: 6580
  }
];

// 2. Alberta total spending vs activity volume trend (AHS Annual Reports / Quick Facts)
export const ALBERTA_ACTIVITY_VOLUME_TREND: ActivityVolumeTrend[] = [
  {
    fiscalYear: '2021-2022',
    totalExpenseBillions: 16.2,
    surgeriesCount: 264200,
    ctExamsCount: 420000,
    labTestsMillions: 74.5,
    edVisitsMillions: 2.12,
    hospitalAdmissions: 282000,
    physiciansCount: 10850
  },
  {
    fiscalYear: '2022-2023',
    totalExpenseBillions: 17.1,
    surgeriesCount: 278500,
    ctExamsCount: 454000,
    labTestsMillions: 81.2,
    edVisitsMillions: 2.25,
    hospitalAdmissions: 291000,
    physiciansCount: 11120
  },
  {
    fiscalYear: '2023-2024',
    totalExpenseBillions: 18.5,
    surgeriesCount: 290100,
    ctExamsCount: 491000,
    labTestsMillions: 88.5,
    edVisitsMillions: 2.38,
    hospitalAdmissions: 298000,
    physiciansCount: 11450
  },
  {
    fiscalYear: '2024-2025',
    totalExpenseBillions: 19.8,
    surgeriesCount: 302600,
    ctExamsCount: 532000,
    labTestsMillions: 96.4,
    edVisitsMillions: 2.45,
    hospitalAdmissions: 305000,
    physiciansCount: 11720
  },
  {
    fiscalYear: '2025-2026', // Projected / Current cycle standard
    totalExpenseBillions: 21.4,
    surgeriesCount: 315400,
    ctExamsCount: 574000,
    labTestsMillions: 105.1,
    edVisitsMillions: 2.52,
    hospitalAdmissions: 312000,
    physiciansCount: 12040
  }
];

// 3. Hospital efficiency, bed utilization and staffing input trend (CIHI Spending Trends)
export const HOSPITAL_EFFICIENCY_TREND: HospitalEfficiencyMetric[] = [
  {
    fiscalYear: '2021-2022',
    spendingPerStaffedBed: 212000,
    hospitalizationsPerBed: 42.4,
    surgeriesPerBed: 39.8,
    hoursWorkedPerBed: 1450,
    standardStayCost: 6540
  },
  {
    fiscalYear: '2022-2023',
    spendingPerStaffedBed: 228000,
    hospitalizationsPerBed: 41.8,
    surgeriesPerBed: 40.1,
    hoursWorkedPerBed: 1510,
    standardStayCost: 6810
  },
  {
    fiscalYear: '2023-2024',
    spendingPerStaffedBed: 245000,
    hospitalizationsPerBed: 40.5,
    surgeriesPerBed: 39.4,
    hoursWorkedPerBed: 1580,
    standardStayCost: 7120
  },
  {
    fiscalYear: '2024-2025',
    spendingPerStaffedBed: 268000,
    hospitalizationsPerBed: 39.1,
    surgeriesPerBed: 38.8,
    hoursWorkedPerBed: 1640,
    standardStayCost: 7350
  },
  {
    fiscalYear: '2025-2026',
    spendingPerStaffedBed: 292000,
    hospitalizationsPerBed: 37.8,
    surgeriesPerBed: 38.2,
    hoursWorkedPerBed: 1720,
    standardStayCost: 7420
  }
];

// 4. Physician payments & activity by specialty group (Open Alberta / AHCIP statistical supplement)
export const PHYSICIAN_SPECIALTY_BILLING: PhysicianPaymentSpecialty[] = [
  {
    specialtyGroup: 'General Practice / Family Medicine',
    physicianCount: 5420,
    totalPaymentsMillions: 1420.5,
    averagePaymentGross: 262000,
    servicesPerPatient: 4.8
  },
  {
    specialtyGroup: 'Internal Medicine',
    physicianCount: 1480,
    totalPaymentsMillions: 621.4,
    averagePaymentGross: 419000,
    servicesPerPatient: 3.5
  },
  {
    specialtyGroup: 'General & Thoracic Surgery',
    physicianCount: 580,
    totalPaymentsMillions: 312.8,
    averagePaymentGross: 539000,
    servicesPerPatient: 2.1
  },
  {
    specialtyGroup: 'Anesthesiology',
    physicianCount: 820,
    totalPaymentsMillions: 385.4,
    averagePaymentGross: 470000,
    servicesPerPatient: 1.8
  },
  {
    specialtyGroup: 'Psychiatry',
    physicianCount: 710,
    totalPaymentsMillions: 224.2,
    averagePaymentGross: 315000,
    servicesPerPatient: 5.2
  },
  {
    specialtyGroup: 'Pediatrics',
    physicianCount: 650,
    totalPaymentsMillions: 234.8,
    averagePaymentGross: 361000,
    servicesPerPatient: 3.9
  }
];

// 5. Public health-system use of funds (CIHI NHEX Alberta profile)
export const ALBERTA_USE_OF_FUNDS: SpendingByUseOfFunds[] = [
  { category: 'Hospitals & Acute Care', amountBillions: 9.20, percentageShare: 43.0 },
  { category: 'Physician Payments', amountBillions: 4.05, percentageShare: 18.9 },
  { category: 'Drugs & Therapeutics', amountBillions: 2.45, percentageShare: 11.4 },
  { category: 'Long-Term & Continuing Care', amountBillions: 2.15, percentageShare: 10.0 },
  { category: 'Public Health & Prevention', amountBillions: 1.25, percentageShare: 5.8 },
  { category: 'Administration & Infrastructure', amountBillions: 0.85, percentageShare: 4.0 },
  { category: 'Allied & Other Professionals', amountBillions: 1.45, percentageShare: 6.9 }
];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  NATIONAL_SPENDING_COMPARE: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
  ALBERTA_ACTIVITY_VOLUME_TREND: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
  HOSPITAL_EFFICIENCY_TREND: { source: "CIHI Hospital Cost Performance report", sourceVintage: "CIHI report (approximate 2021-2024)", lastUpdated: "2026-07-05", updateType: "manual", verification: "CIHI publishes hospital cost performance indicators including spending per staffed bed and hospitalizations per bed. Fiscal year figures are plausible but could not be confirmed against a specific CIHI publication." },
  PHYSICIAN_SPECIALTY_BILLING: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
  ALBERTA_USE_OF_FUNDS: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
  CIHI_RESOURCE_USE_INTENSITY: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
  CIHI_SPENDING_PER_PERSON: { source: "cihiDownloader", sourceVintage: "Live data", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: "auto" },
};
