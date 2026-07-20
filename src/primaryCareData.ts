// Normalized Alberta Primary Care, Attachment, and Family Doctor Directory Datasets (2024 - 2026 reporting periods)
// Compiled from HQCA FOCUS Primary Healthcare, CIHI Shared Health Priorities, Statistics Canada SHCAE-PSC, and Alberta Find a Provider.

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
  /** Upstream limited-panel note when the clinic accepts only some patients. */
  limitedPanelMessage?: string | null;
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
  minorConditionEdVisitsPer1000: number; // HQCA FOCUS data linking continuity to ED visits
  description: string;
}

export interface ContinuityAndSatisfaction {
  zone: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone' | 'Alberta';
  highDoctorContinuityPct: number; // HQCA FOCUS: % patients with high continuity of care
  highClinicContinuityPct: number; // HQCA FOCUS: % patients with high clinic continuity
  sameNextDayAccessPct: number; // CIHI: % patients who could get same/next day appointment
  satisfiedWithWaitTimePct: number; // CIHI: % satisfied with wait times for non-urgent care
  overallCareRatingExcellentPct: number; // FOCUS: % rating care as Excellent/Very Good
}

/** HQCA FOCUS: continuity to one family doctor by zone and fiscal year (API-only array). */
export interface ContinuitySatisfactionHqca {
  zone: string;
  fiscalYear: string;
  continuityPct: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Primary Care Attachment Trends (CIHI Shared Health Priorities & StatsCan)
export const ATTACHMENT_RATES: AttachmentRate[] = [];

// 2. Active Directory of Clinics/Providers Accepting New Patients (Alberta Find a Provider 2026 Listings)
export const ACCEPTING_PROVIDERS: AcceptingProvider[] = [];

// 3. Primary Care Network (PCN) Distribution and Resource Levels (Open Alberta & Statistical Supplement)
export const PCN_CAPACITY: PCNCapacity[] = [];

// 4. Local Geographic Area (LGA) Community Needs & Access Indicators (Alberta Health Profiles Table 10.1)
export const LGA_COMMUNITY_NEEDS: LGACommunityNeed[] = [];

// 5. Causal Link: Family Doctor Continuity vs Emergency Department Overreliance (HQCA FOCUS Chart Data)
export const ED_RELIANCE_BY_CONTINUITY: EDRelianceMetric[] = [];

// 6. Focus Primary Healthcare Experience & Access Metrics (CIHI Priority Indicators & HQCA FOCUS Survey)
export const CONTINUITY_SATISFACTION: ContinuityAndSatisfaction[] = [];
