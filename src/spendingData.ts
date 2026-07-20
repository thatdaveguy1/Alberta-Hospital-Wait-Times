// Alberta Health Spending, Activity & Productivity Datasets (2015 - 2026)
// Compiled from:
// - CIHI National Health Expenditure Trends (NHEX)
// - CIHI Spending Trends in Health Service Delivery & Cost of a Standard Hospital Stay (CSHS)
// - AHS Annual Reports, Consolidated Financial Statements & Quick Facts
// - Open Alberta AHCIP Statistical Supplement (Physician Payments and Services)

export interface NationalSpendingCompare {
  province: string;
  spendingPerCapita: number;       // total health expenditure per capita in CAD
  spendingAsPercentGdp: number | null;    // %
  hospitalSpendingPerCapita: number;
  physicianSpendingPerCapita: number;
  drugSpendingPerCapita: number;
  bedsPer100k: number | null;
  costPerStandardStay: number | null;     // CIHI Cost of a Standard Hospital Stay in CAD
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
  servicesPerPatient: number | null;
}

export interface SpendingByUseOfFunds {
  category: string;                // e.g. 'Hospitals', 'Physicians', 'Drugs', 'Public Health', 'Administration', 'Other'
  amountBillions: number;          // CAD Billions
  percentageShare: number;
}

/** Multi-year provincial per-capita series from NHEX Table O.1 (public + private). */
export interface ProvincialSpendingTrend {
  province: string;
  year: string;                    // NHEX calendar year
  fiscalYear: string;
  spendingPerCapita: number;
  hospitalSpendingPerCapita: number;
  physicianSpendingPerCapita: number;
  drugSpendingPerCapita: number;
  publicSharePct: number | null;   // public total / (public + private total)
}

/** Latest-year public-sector use-of-funds mix by province from NHEX Table O.1. */
export interface ProvincialUseOfFunds {
  province: string;
  category: string;
  amountBillions: number;
  percentageShare: number;
  perCapita: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. National spending and capacity scoreboard (CIHI NHEX & CSHS 2025/2026 releases)
export const NATIONAL_SPENDING_COMPARE: NationalSpendingCompare[] = [];

// 2. Alberta total spending vs activity volume trend (AHS Annual Reports / Quick Facts)
export const ALBERTA_ACTIVITY_VOLUME_TREND: ActivityVolumeTrend[] = [];

// 3. Hospital efficiency, bed utilization and staffing input trend (CIHI Spending Trends)
export const HOSPITAL_EFFICIENCY_TREND: HospitalEfficiencyMetric[] = [];

// 4. Physician payments & activity by specialty group (Open Alberta AHCIP Statistical Supplement)
export const PHYSICIAN_SPECIALTY_BILLING: PhysicianPaymentSpecialty[] = [];

// 5. Public health-system use of funds (CIHI NHEX Alberta profile)
export const ALBERTA_USE_OF_FUNDS: SpendingByUseOfFunds[] = [];

// 6. Multi-year provincial per-capita trends (CIHI NHEX Table O.1)
export const PROVINCIAL_SPENDING_TREND: ProvincialSpendingTrend[] = [];

// 7. Latest-year public use-of-funds composition by province (CIHI NHEX Table O.1)
export const PROVINCIAL_USE_OF_FUNDS: ProvincialUseOfFunds[] = [];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: "auto" | "manual";
  verification?: string;
}> = {
  NATIONAL_SPENDING_COMPARE: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  ALBERTA_ACTIVITY_VOLUME_TREND: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  PHYSICIAN_SPECIALTY_BILLING: { source: "Open Alberta AHCIP Statistical Supplement (combined workbook)", sourceVintage: "AHCIP Statistical Supplement — latest release (Tables 2.3, 2.12 A/B/D, 2.14)", lastUpdated: "2026-07-08T04:31:47.021Z", updateType: 'manual', verification: "Physician count, average gross payment, and service counts are joined from AHCIP Statistical Supplement Tables 2.12 A/B/D (latest service year). Total payments sum FFS+BCP+RRNP+MEDR from Table 2.3. servicesPerPatient = services / registered persons, with registered persons derived from Table 2.14 FTE counts. Pathology and Radiology have no Table 2.14 entry, so their servicesPerPatient is null when unavailable. Values below are a hand-curated fallback used only if data-spending.json is absent." },
  ALBERTA_USE_OF_FUNDS: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  PROVINCIAL_SPENDING_TREND: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  PROVINCIAL_USE_OF_FUNDS: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  CIHI_RESOURCE_USE_INTENSITY: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
  CIHI_SPENDING_PER_PERSON: { source: "CIHI National Health Expenditure Trends (NHEX)", sourceVintage: "NHEX 2025 release", lastUpdated: "2026-07-05T15:56:27.339Z", updateType: 'manual' },
};
