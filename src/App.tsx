import React, { useState, useEffect } from 'react';
import { dashboardMatchesSearch, readDashboardModuleFromUrl } from './lib/dashboardModuleSearch';
import {
  Activity,
  Search,
  AlertTriangle,
  SlidersHorizontal,
  Layers,
  Stethoscope,
  Users,
  FlaskConical,
  Brain,
  Home,
  HeartHandshake,
  Coins,
  Phone,
  Ribbon,
  Shield,
  TrendingUp,
  Compass,
} from 'lucide-react';
import ErWaitDashboard from './components/ErWaitDashboard';
import SurgicalDashboard from './components/SurgicalDashboard';
import ServiceDisruptionsDashboard from './components/ServiceDisruptionsDashboard';
import SystemFlowDashboard from './components/SystemFlowDashboard';
import PrimaryCareDashboard from './components/PrimaryCareDashboard';
import WorkforceDashboard from './components/WorkforceDashboard';
import DiagnosticDashboard from './components/DiagnosticDashboard';
import CancerDashboard from './components/CancerDashboard';
import MentalHealthDashboard from './components/MentalHealthDashboard';
import ContinuingCareDashboard from './components/ContinuingCareDashboard';
import PatientExperienceDashboard from './components/PatientExperienceDashboard';
import PublicHealthDashboard from './components/PublicHealthDashboard';
import RegionalInequityDashboard from './components/RegionalInequityDashboard';
import SpendingDashboard from './components/SpendingDashboard';
import VirtualCareDashboard from './components/VirtualCareDashboard';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'acute-urgent', label: 'Acute & Urgent' },
  { id: 'system-capacity', label: 'System Capacity' },
  { id: 'community-care', label: 'Community Care' },
  { id: 'prevention-surveillance', label: 'Prevention' },
  { id: 'equity-outcomes', label: 'Equity & Outcomes' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const CATEGORY_TITLE_BY_ID: Record<CategoryId, string> = {
  all: 'All Modules',
  'acute-urgent': 'Acute & Urgent Care',
  'system-capacity': 'System Capacity & Flow',
  'community-care': 'Community & Continuing Care',
  'prevention-surveillance': 'Prevention & Surveillance',
  'equity-outcomes': 'Equity & Outcomes',
};

const DASHBOARDS = [
  {
    id: 'er-waits' as const,
    title: 'ER Wait Times',
    shortName: 'ER waits',
    category: 'acute-urgent' as CategoryId,
    description: 'Live ER & urgent-care waits — fastest path near you, plus provincial pressure.',
    icon: Activity,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    badge: '10-MIN POLL',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
    source: 'Alberta Health Services Portal',
    updateFrequency: 'About every 10 minutes',
  },
  {
    id: 'disruptions' as const,
    title: 'Service Disruptions',
    shortName: 'Disruptions',
    category: 'acute-urgent' as CategoryId,
    description: 'Active facility closures, temporary service shutdowns, and clinical emergency alerts across Alberta.',
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    badge: 'ACTIVE ALERTS',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    source: 'AHS Emergency Advisories',
    updateFrequency: 'Daily scrape (≈24h)',
  },
  {
    id: 'system-flow' as const,
    title: 'Hospital System Flow',
    shortName: 'System Flow',
    category: 'system-capacity' as CategoryId,
    description: 'Inpatient occupancy metrics, emergency admission bottlenecks, and medical discharge delay statistics.',
    icon: Layers,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
    badge: 'CAPACITY',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    source: 'HQCA FOCUS & CIHI ED Indicators',
    updateFrequency: 'Daily updates',
  },
  {
    id: 'surgical-waits' as const,
    title: 'Surgical Waitlists',
    shortName: 'Surgical waits',
    category: 'system-capacity' as CategoryId,
    description: 'Surgical waitlist queues, specialty-specific wait distributions, and diagnostic timeline targets.',
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    badge: 'BACKLOG',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    source: 'AHCIP Surgical Wait Time Registry',
    updateFrequency: 'Monthly stats',
  },
  {
    id: 'workforce' as const,
    title: 'Health Workforce & Supply',
    shortName: 'Health Workforce',
    category: 'system-capacity' as CategoryId,
    description: 'Physician registries, nursing supply indicators, allied health benchmarks, age profiles, and job vacancy trends.',
    icon: Users,
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    badge: 'NEW CONSOLE',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    source: 'CIHI, CPSA, CRNA & StatsCan',
    updateFrequency: 'Quarterly stats',
  },
  {
    id: 'diagnostics' as const,
    title: 'Diagnostic Imaging + Labs',
    shortName: 'Diagnostics & Labs',
    category: 'system-capacity' as CategoryId,
    description: 'Community lab waits and CIHI CT/MRI imaging trends.',
    icon: FlaskConical,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    badge: '60-MIN POLL',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    source: 'APL QMe & CIHI Diagnostic Imaging',
    updateFrequency: 'Lab waits: every 60 min · Imaging: annual/manual',
  },
  {
    id: 'primary-care' as const,
    title: 'Primary Care Access',
    shortName: 'Primary Care',
    category: 'community-care' as CategoryId,
    description: 'Family doctor attachment rates, accepting providers, and measured CIHI/HQCA access indicators.',
    icon: Stethoscope,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    badge: 'COMMUNITY',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    source: 'CIHI Shared Health Priorities, HQCA & accepting providers',
    updateFrequency: 'Annual surveys',
  },
  {
    id: 'long-term-care' as const,
    title: 'Long Term Care & Seniors Care',
    shortName: 'Long Term Care',
    category: 'community-care' as CategoryId,
    description: 'Placement timelines, measured quality outcomes, and facility compliance registries.',
    icon: Home,
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/20',
    badge: 'CONTINUING CARE',
    badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    source: 'HQCA FOCUS & CIHI CCRS Registry',
    updateFrequency: 'Quarterly Audits',
  },
  {
    id: 'patient-experience' as const,
    title: 'Patient Experience & Care Quality',
    shortName: 'Patient Experience',
    category: 'community-care' as CategoryId,
    description: 'Available HQCA, GoodCaring, and CIHI patient-experience and care-quality measures.',
    icon: HeartHandshake,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    badge: 'FOCUS SURVEY',
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    source: 'HQCA FOCUS, GoodCaring & CIHI CPES-IC',
    updateFrequency: 'Quarterly Release',
  },
  {
    id: 'virtual-care' as const,
    title: 'Virtual Care & 811 Access',
    shortName: 'Virtual Care',
    category: 'community-care' as CategoryId,
    description: 'Verified Health Link 811 call volumes when available (other virtual-care cohorts withheld).',
    icon: Phone,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/20',
    badge: 'VIRTUAL CARE',
    badgeColor: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    source: 'AHS Quick Facts',
    updateFrequency: 'Per-array / when verified',
  },
  {
    id: 'cancer' as const,
    title: 'Cancer Care',
    shortName: 'Cancer Care',
    category: 'prevention-surveillance' as CategoryId,
    description: 'Cancer surgery and radiation wait times, plus treatment centre locations.',
    icon: Ribbon,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    badge: 'ONCOLOGY',
    badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    source: 'Cancer Care Alberta & CIHI priority procedure waits',
    updateFrequency: 'Q1 2026 Release',
  },
  {
    id: 'public-health' as const,
    title: 'Public Health & Outbreaks',
    shortName: 'Public Health',
    category: 'prevention-surveillance' as CategoryId,
    description: 'Respiratory case counts and wastewater early-warning monitors.',
    icon: Shield,
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/20',
    badge: 'SURVEILLANCE',
    badgeColor: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
    source: 'AHS ProvLab & PHAC Wastewater Feed',
    updateFrequency: 'Weekly Updates',
  },
  {
    id: 'mental-health' as const,
    title: 'Mental Health & Addictions',
    shortName: 'Mental Health',
    category: 'prevention-surveillance' as CategoryId,
    description: 'ABED recovery beds, crisis helplines, and measured CIHI mental-health readmission indicators.',
    icon: Brain,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    badge: 'MHSU SYSTEM',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    source: 'ABED Registry & CIHI indicators',
    updateFrequency: 'Daily updates',
  },
  {
    id: 'regional-inequity' as const,
    title: 'Regional Health Inequity',
    shortName: 'Health Inequity',
    category: 'equity-outcomes' as CategoryId,
    description: 'Verified regional health and socioeconomic profile indicators from upstream community data.',
    icon: Compass,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    badge: 'EQUITY INDEX',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    source: 'Alberta Health Community Profiles (LGA)',
    updateFrequency: 'Annual Audits',
  },
  {
    id: 'health-spending' as const,
    title: 'Health Spending & Productivity',
    shortName: 'Health Spending',
    category: 'equity-outcomes' as CategoryId,
    description: 'Measured CIHI health spending trends and physician clinical payments.',
    icon: Coins,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    badge: 'VALUE AUDIT',
    badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    source: 'CIHI Spending Trends & AHCIP Supplement',
    updateFrequency: 'Annual Releases',
  },
] as const;

// Per-console registry for the Data Sources modal. Cadence/source strings are
// descriptive only — they MUST NOT claim tab-wide "auto" when arrays are mixed
// or manual. Prefer "mixed" / "manual" / "auto" based on the dominant verified
// pipeline posture for that console. Field-level truth lives in each domain's
// `_dataMetadata` and is rendered by DataTimestamp / DashboardHeader.
const TAB_METADATA_MAP: Record<string, {
  updateType: 'auto' | 'manual' | 'mixed';
  interval: string;
  sourceVintage: string;
  source: string;
  domain?: string;
}> = {
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
  'mental-health': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'ABED Registry & CIHI mental-health indicators',
    domain: 'mental-health'
  },
  'long-term-care': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'HQCA FOCUS, CIHI CCRS & continuing-care compliance',
    domain: 'continuing-care'
  },
  'patient-experience': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'HQCA FOCUS, GoodCaring & CIHI CPES-IC',
    domain: 'patient-experience'
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
  },
  'virtual-care': {
    updateType: 'mixed',
    interval: 'daily sync · per-array provenance',
    sourceVintage: 'Per-array (see dashboard timestamps)',
    source: 'AHS Quick Facts (Health Link when verified)',
    domain: 'virtual-care'
  }
};


export default function App() {
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'er-waits' | 'surgical-waits' | 'disruptions' | 'system-flow' | 'primary-care' | 'workforce' | 'diagnostics' | 'cancer' | 'mental-health' | 'long-term-care' | 'patient-experience' | 'public-health' | 'regional-inequity' | 'health-spending' | 'virtual-care'>(() => {
    const ids = DASHBOARDS.map((d) => d.id);
    return (readDashboardModuleFromUrl(ids) as typeof activeTab) ?? 'er-waits';
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [isModulesExpanded, setIsModulesExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('alberta_hospital_modules_expanded') !== '0';
  });

  useEffect(() => {
    const fromUrl = readDashboardModuleFromUrl(DASHBOARDS.map((d) => d.id));
    if (fromUrl) setActiveTab(fromUrl as typeof activeTab);
  }, []);

  useEffect(() => {
    localStorage.setItem('alberta_hospital_modules_expanded', isModulesExpanded ? '1' : '0');
  }, [isModulesExpanded]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('module', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);

  const activeDashboard = DASHBOARDS.find(d => d.id === activeTab) ?? DASHBOARDS[0];
  const footerTitle =
    activeTab === 'er-waits'
      ? 'Alberta Emergency Department Monitor'
      : 'Alberta Health Data Monitor';
  const footerBlurb =
    activeTab === 'er-waits'
      ? 'Data synchronized from Alberta Health Services data feeds. Estimated ER wait times refresh about every 10 minutes.'
      : `Viewing ${activeDashboard.title}. Source: ${activeDashboard.source}. Update cadence: ${activeDashboard.updateFrequency}.`;

  return (
    <div className="min-h-screen bg-[#070b19] text-slate-100 font-sans selection:bg-blue-600/30 selection:text-blue-200">
      
      {/* Sticky Premium Header */}
      <header className="bg-[#0b1226] border-b border-slate-800/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600/20 border border-red-500/30 p-2 rounded-xl">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white sm:text-lg">Unofficial Alberta Hospital Wait Times</h1>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[9px] font-bold uppercase tracking-wider">AHS Data Feed</span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Independent ED Monitor • Unofficial Tracking</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Unofficial Warning Disclaimer Header */}
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
            <strong>Notice:</strong> This tracker is completely <strong>unofficial</strong> and not endorsed by or affiliated with Alberta Health Services. For critical emergency services or life-threatening conditions, please dial <strong>911</strong> immediately.
          </p>
        </div>


        {/* Module picker (all screen sizes; optional hide via localStorage) */}
        {!isModulesExpanded ? (
          <div className="flex bg-[#090e21] border border-slate-800 rounded-2xl p-3 mb-6 shadow-xl w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Active Module: <span className="text-white font-extrabold">{DASHBOARDS.find(d => d.id === activeTab)?.title}</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Module picker is hidden — use Show modules to browse all dashboards</p>
              </div>
            </div>
            <button
              onClick={() => setIsModulesExpanded(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              Show modules
            </button>
          </div>
        ) : (
          <div className="block bg-[#090e21] border border-slate-800 rounded-2xl p-4 mb-8 shadow-xl w-full space-y-4">
          {/* Header Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    Analytics Modules
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Select a module below to view interactive health indicators and trends</p>
                </div>
              </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search modules..."
                value={dashboardSearch}
                onChange={(e) => setDashboardSearch(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {dashboardSearch && (
                <button
                  type="button"
                  onClick={() => setDashboardSearch('')}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>
              <button
                type="button"
                onClick={() => setIsModulesExpanded(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer shadow-md shrink-0"
                title="Hide module picker"
              >
                Hide modules
              </button>
            </div>
            </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const count = DASHBOARDS.filter(d => d.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 bg-slate-950/40 border border-slate-800/60'
                  }`}
                >
                  {cat.label}
                  {cat.id !== 'all' && (
                    <span className={`ml-1.5 text-[9px] opacity-70 ${selectedCategory === cat.id ? 'text-blue-200' : 'text-slate-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Module Tiles */}
          <div className="space-y-4">
            {selectedCategory === 'all' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {DASHBOARDS.filter(d =>
                  dashboardMatchesSearch(d, dashboardSearch)
                ).map(d => {
                  const Icon = d.icon;
                  const isActive = activeTab === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      data-dashboard-id={d.id}
                      onClick={() => setActiveTab(d.id)}
                      className={`relative group flex items-center gap-2 p-2.5 rounded-lg text-left transition-all border ${
                        isActive
                          ? 'bg-blue-500/5 border-blue-500/40 ring-1 ring-blue-500/30'
                          : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/50'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-blue-500" />
                      )}
                      <div className={`p-1.5 rounded-md shrink-0 ${d.bgColor} ${d.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h5 className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            {d.shortName}
                          </h5>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug line-clamp-1">
                          {d.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              CATEGORIES.filter(c => c.id === selectedCategory).map(category => {
                const items = DASHBOARDS.filter(d =>
                  d.category === category.id &&
                  dashboardMatchesSearch(d, dashboardSearch)
                );

                if (items.length === 0) return null;

                return (
                  <div key={category.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        {CATEGORY_TITLE_BY_ID[category.id]}
                      </h4>
                      <span className="text-[10px] text-slate-600 font-medium">
                        {items.length} module{items.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                      {items.map(d => {
                        const Icon = d.icon;
                        const isActive = activeTab === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            data-dashboard-id={d.id}
                            onClick={() => setActiveTab(d.id)}
                            className={`relative group flex items-center gap-2 p-2.5 rounded-lg text-left transition-all border ${
                              isActive
                                ? 'bg-blue-500/5 border-blue-500/40 ring-1 ring-blue-500/30'
                                : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/50'
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-blue-500" />
                            )}
                            <div className={`p-1.5 rounded-md shrink-0 ${d.bgColor} ${d.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                                {d.shortName}
                              </h5>
                              <p className="text-[10px] text-slate-500 leading-snug line-clamp-1">
                                {d.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}

            {/* Empty search results */}
            {DASHBOARDS.filter(d => {
              const matchesCategory = selectedCategory === 'all' || d.category === selectedCategory;
              const matchesSearch = dashboardMatchesSearch(d, dashboardSearch);
              return matchesCategory && matchesSearch;
            }).length === 0 && (
              <div className="text-center py-6 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl space-y-2">
                <Search className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">No matching analytical modules found</p>
                <button
                  onClick={() => { setDashboardSearch(''); setSelectedCategory('all'); }}
                  className="text-[10px] text-blue-400 font-black uppercase tracking-wider"
                >
                  Reset Filters
                </button>
              </div>
            )}
            </div>
          </div>
        )}



        {/* ACTIVE CONTENT CHANNEL (Full Width Layout) */}
        <div className="w-full min-w-0">
            {activeTab === 'er-waits' ? (
          <ErWaitDashboard />
        ) : activeTab === 'surgical-waits' ? (
          <SurgicalDashboard />
        ) : activeTab === 'disruptions' ? (
          <ServiceDisruptionsDashboard />
        ) : activeTab === 'system-flow' ? (
          <SystemFlowDashboard />
        ) : activeTab === 'primary-care' ? (
          <PrimaryCareDashboard />
        ) : activeTab === 'workforce' ? (
          <WorkforceDashboard />
        ) : activeTab === 'diagnostics' ? (
          <DiagnosticDashboard />
        ) : activeTab === 'cancer' ? (
          <CancerDashboard />
        ) : activeTab === 'mental-health' ? (
          <MentalHealthDashboard />
        ) : activeTab === 'long-term-care' ? (
          <ContinuingCareDashboard />
        ) : activeTab === 'patient-experience' ? (
          <PatientExperienceDashboard />
        ) : activeTab === 'public-health' ? (
          <PublicHealthDashboard />
        ) : activeTab === 'regional-inequity' ? (
          <RegionalInequityDashboard />
        ) : activeTab === 'health-spending' ? (
          <SpendingDashboard />
        ) : (
          <VirtualCareDashboard />
        )}

          </div>
      </main>



      <footer id="site-footer" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-800 mt-12 text-slate-500">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">{footerTitle}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              {footerBlurb}
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs shrink-0 font-bold uppercase tracking-wider">
            <button 
              onClick={() => setIsSourcesModalOpen(true)} 
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer border-0 bg-transparent p-0 font-bold uppercase tracking-wider"
            >
              Data Sources
            </button>
            <a href="https://www.albertahealthservices.ca/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-300 transition-colors">Official AHS Web</a>
            <a href="#" className="text-slate-500 hover:text-slate-300 transition-colors">System Diagnostics</a>
            <a href="#contributions" className="text-slate-500 hover:text-slate-300 transition-colors">
              Contribute
            </a>
          </div>
        </div>
      </footer>


      {/* DATA SOURCES MODAL */}
      {isSourcesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-905 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-white">Data Sources & Registries</h3>
                <p className="text-xs text-slate-400 mt-1">Detailed registry of dataset origins and update frequencies across all consoles</p>
              </div>
              <button 
                onClick={() => setIsSourcesModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-widest text-[9px] font-black">
                      <th className="py-2.5 pr-4">Console</th>
                      <th className="py-2.5 px-4">Update Type</th>
                      <th className="py-2.5 px-4">Frequency</th>
                      <th className="py-2.5 pl-4">Data Source Registry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40 text-slate-300 font-medium">
                    {Object.entries(TAB_METADATA_MAP).map(([key, meta]) => {
                      const dashboard = DASHBOARDS.find(d => d.id === key);
                      const name = dashboard ? dashboard.shortName : key;
                      const updateKind = meta.updateType;
                      const badgeClass =
                        updateKind === 'auto'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : updateKind === 'mixed'
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      const badgeLabel =
                        updateKind === 'auto'
                          ? 'Auto'
                          : updateKind === 'mixed'
                            ? 'Mixed'
                            : 'Manual';
                      return (
                        <tr key={key} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 pr-4 font-bold text-white">{name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono">{meta.interval}</td>
                          <td className="py-3 pl-4 text-slate-500 leading-normal">{meta.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800/80 flex justify-end">
              <button
                onClick={() => setIsSourcesModalOpen(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
