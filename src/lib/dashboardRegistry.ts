// Shared dashboard registry — single source of truth for module metadata.
// Consumed by the app shell (nav/mega-menu), the home page directory, and the
// Data Sources modal. Moved out of App.tsx during the Clinical Ledger redesign.
import {
  Activity,
  AlertTriangle,
  Layers,
  Stethoscope,
  Users,
  FlaskConical,
  Home,
  Coins,
  Ribbon,
  Shield,
  TrendingUp,
  Compass,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'acute-urgent', label: 'Acute & Urgent' },
  { id: 'system-capacity', label: 'System Capacity' },
  { id: 'community-care', label: 'Community Care' },
  { id: 'prevention-surveillance', label: 'Prevention' },
  { id: 'equity-outcomes', label: 'Equity & Outcomes' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_TITLE_BY_ID: Record<CategoryId, string> = {
  all: 'All Modules',
  'acute-urgent': 'Acute & Urgent Care',
  'system-capacity': 'System Capacity & Flow',
  'community-care': 'Community & Continuing Care',
  'prevention-surveillance': 'Prevention & Surveillance',
  'equity-outcomes': 'Equity & Outcomes',
};

export interface DashboardMeta {
  id: string;
  title: string;
  shortName: string;
  category: CategoryId;
  description: string;
  icon: LucideIcon;
  badge: string;
  source: string;
  updateFrequency: string;
}

export const DASHBOARDS: readonly DashboardMeta[] = [
  {
    id: 'er-waits',
    title: 'ER Wait Times',
    shortName: 'ER waits',
    category: 'acute-urgent',
    description: 'Live ER & urgent-care waits — fastest path near you, plus provincial pressure.',
    icon: Activity,
    badge: '10-MIN POLL',
    source: 'Alberta Health Services Portal',
    updateFrequency: 'About every 10 minutes',
  },
  {
    id: 'disruptions',
    title: 'Service Disruptions',
    shortName: 'Disruptions',
    category: 'acute-urgent',
    description: 'Active facility closures, temporary service shutdowns, and clinical emergency alerts across Alberta.',
    icon: AlertTriangle,
    badge: 'ACTIVE ALERTS',
    source: 'AHS Emergency Advisories',
    updateFrequency: 'Daily scrape (≈24h)',
  },
  {
    id: 'system-flow',
    title: 'Hospital System Flow',
    shortName: 'System Flow',
    category: 'system-capacity',
    description: 'Inpatient occupancy metrics, emergency admission bottlenecks, and medical discharge delay statistics.',
    icon: Layers,
    badge: 'CAPACITY',
    source: 'HQCA FOCUS & CIHI ED Indicators',
    updateFrequency: 'Daily updates',
  },
  {
    id: 'surgical-waits',
    title: 'Surgical Waitlists',
    shortName: 'Surgical waits',
    category: 'system-capacity',
    description: 'Surgical waitlist queues, specialty-specific wait distributions, and diagnostic timeline targets.',
    icon: TrendingUp,
    badge: 'BACKLOG',
    source: 'AHCIP Surgical Wait Time Registry',
    updateFrequency: 'Monthly stats',
  },
  {
    id: 'workforce',
    title: 'Health Workforce & Supply',
    shortName: 'Health Workforce',
    category: 'system-capacity',
    description: 'Physician registries, nursing supply indicators, allied health benchmarks, age profiles, and job vacancy trends.',
    icon: Users,
    badge: 'NEW CONSOLE',
    source: 'CIHI, CPSA, CRNA & StatsCan',
    updateFrequency: 'Quarterly stats',
  },
  {
    id: 'diagnostics',
    title: 'Diagnostic Imaging + Labs',
    shortName: 'Diagnostics & Labs',
    category: 'system-capacity',
    description: 'Community lab waits and CIHI CT/MRI imaging trends.',
    icon: FlaskConical,
    badge: '60-MIN POLL',
    source: 'APL QMe & CIHI Diagnostic Imaging',
    updateFrequency: 'Lab waits: every 60 min · Imaging: annual/manual',
  },
  {
    id: 'primary-care',
    title: 'Primary Care Access',
    shortName: 'Primary Care',
    category: 'community-care',
    description: 'Family doctor attachment rates, accepting providers, and measured CIHI/HQCA access indicators.',
    icon: Stethoscope,
    badge: 'COMMUNITY',
    source: 'CIHI Shared Health Priorities, HQCA & accepting providers',
    updateFrequency: 'Annual surveys',
  },
  {
    id: 'long-term-care',
    title: 'Long Term Care & Seniors Care',
    shortName: 'Long Term Care',
    category: 'community-care',
    description: 'Placement timelines, measured quality outcomes, and facility compliance registries.',
    icon: Home,
    badge: 'CONTINUING CARE',
    source: 'HQCA FOCUS & CIHI CCRS Registry',
    updateFrequency: 'Quarterly Audits',
  },
  {
    id: 'cancer',
    title: 'Cancer Care',
    shortName: 'Cancer Care',
    category: 'prevention-surveillance',
    description: 'Cancer surgery and radiation wait times, plus treatment centre locations.',
    icon: Ribbon,
    badge: 'ONCOLOGY',
    source: 'Cancer Care Alberta & CIHI priority procedure waits',
    updateFrequency: 'Q1 2026 Release',
  },
  {
    id: 'public-health',
    title: 'Public Health & Outbreaks',
    shortName: 'Public Health',
    category: 'prevention-surveillance',
    description: 'Respiratory case counts and wastewater early-warning monitors.',
    icon: Shield,
    badge: 'SURVEILLANCE',
    source: 'AHS ProvLab & PHAC Wastewater Feed',
    updateFrequency: 'Weekly Updates',
  },
  {
    id: 'regional-inequity',
    title: 'Regional Health Inequity',
    shortName: 'Health Inequity',
    category: 'equity-outcomes',
    description: 'Verified regional health and socioeconomic profile indicators from upstream community data.',
    icon: Compass,
    badge: 'EQUITY INDEX',
    source: 'Alberta Health Community Profiles (LGA)',
    updateFrequency: 'Annual Audits',
  },
  {
    id: 'health-spending',
    title: 'Health Spending & Productivity',
    shortName: 'Health Spending',
    category: 'equity-outcomes',
    description: 'Province-compare NHEX spending, Alberta fiscal detail, and physician clinical payments.',
    icon: Coins,
    badge: 'VALUE AUDIT',
    source: 'CIHI Spending Trends & AHCIP Supplement',
    updateFrequency: 'Annual Releases',
  },
] as const;

export type DashboardId = (typeof DASHBOARDS)[number]['id'];

// Per-console registry for the Data Sources modal. Cadence/source strings are
// descriptive only — they MUST NOT claim tab-wide "auto" when arrays are mixed
// or manual. Field-level truth lives in each domain's `_dataMetadata` and is
// rendered by DataTimestamp / DashboardHeader.
export interface TabMetadata {
  updateType: 'auto' | 'manual' | 'mixed';
  interval: string;
  sourceVintage: string;
  source: string;
  domain?: string;
}

export const TAB_METADATA_MAP: Record<string, TabMetadata> = {
  'er-waits': {
    updateType: 'auto',
    interval: 'about every 10 mins',
    sourceVintage: 'AHS WaitTimes Feed (~10m poll)',
    source: 'Alberta Health Services Portal'
  },
  'disruptions': {
    updateType: 'auto',
    interval: 'Every 24 hours',
    sourceVintage: 'Daily AHS Advisories',
    source: 'AHS Emergency Advisories'
  },
  'system-flow': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'HQCA FOCUS, AHS weekly ED LOS, CIHI indicators'
  },
  'surgical-waits': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'AHCIP Surgical Wait Time Registry & ABJHI Orthopedic feeds',
    domain: 'surgical'
  },
  'primary-care': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'CIHI Shared Health Priorities & accepting providers database',
    domain: 'primary-care'
  },
  'workforce': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'CIHI Health Workforce Database & CPSA Registry',
    domain: 'workforce'
  },
  'diagnostics': {
    updateType: 'mixed',
    interval: 'Lab waits: every 60 min · Imaging: annual/manual',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'APL QMe REST API & CIHI Diagnostic Imaging',
    domain: 'diagnostic'
  },
  'cancer': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'CIHI priority procedure waits & Cancer Care Alberta centres',
    domain: 'cancer'
  },
  'long-term-care': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'HQCA FOCUS, CIHI CCRS & continuing-care compliance',
    domain: 'continuing-care'
  },
  'public-health': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'AHS ProvLab & PHAC Wastewater Feed',
    domain: 'public-health'
  },
  'regional-inequity': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'Alberta Health Community Profiles (LGA)',
    domain: 'regional-inequity'
  },
  'health-spending': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'CIHI Spending Trends & physician payment tables',
    domain: 'spending'
  }
};
