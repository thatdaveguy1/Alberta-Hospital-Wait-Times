import React, { useState, useEffect, useMemo } from 'react';
import { calculateDistance } from './lib/geo';
import { dashboardMatchesSearch, readDashboardModuleFromUrl } from './lib/dashboardModuleSearch';
import { averageFacilityWaitMinutes, busiestHourOfDay, facilityTrendYDomain } from './lib/facilityWaitStats';
import { Hospital, WaitTimeSnapshot } from './types';
import { 
  Activity, 
  Clock, 
  MapPin, 
  TrendingUp, 
  AlertCircle, 
  Search,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Info,
  Database,
  Compass,
  Map,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Mail,
  Bell,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Sparkles,
  Minus,
  Check,
  Maximize2,
  Minimize2,
  Layers,
  Stethoscope,
  Users,
  FlaskConical,
  HeartPulse,
  Brain,
  Home,
  HeartHandshake,
  Coins,
  Phone,
  Ribbon,
  Shield,
  X
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
  ReferenceLine
} from 'recharts';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { MapComponent } from './components/MapComponent';
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
import { useSyncStatus } from './hooks/useSyncStatus';
import { DashboardHeader } from './components/DashboardHeader';
import { ContributionsSection } from './components/ContributionsSection';
import type { DataMetadataMap } from './components/DataTimestamp';


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

const getCategoryTitle = (id: CategoryId | string) =>
  CATEGORY_TITLE_BY_ID[id as CategoryId] ?? id;

const DASHBOARDS = [
  {
    id: 'er-waits' as const,
    title: 'ER Wait Times',
    shortName: 'ER waits',
    category: 'acute-urgent' as CategoryId,
    description: 'Real-time emergency department tracking, wait estimates, facility mapping, and geographic proximity alerts.',
    icon: Activity,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    badge: 'LIVE FEED',
    badgeColor: 'bg-red-500/10 text-red-400 border-red-500/20',
    source: 'Alberta Health Services Portal',
    updateFrequency: 'Every 30 minutes',
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
    updateFrequency: 'Ad-hoc / Instant',
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
    source: 'AHS Clinical Operations DB',
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
    description: 'Live community lab waits, CT & MRI backlogs, compliance targets, and pathology result turnarounds.',
    icon: FlaskConical,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/20',
    badge: 'LIVE LABS',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    source: 'APL QMe, AHS & CIHI',
    updateFrequency: 'Lab waits: every 30 min · Imaging/turnaround: annual/manual',
  },
  {
    id: 'primary-care' as const,
    title: 'Primary Care Access',
    shortName: 'Primary Care',
    category: 'community-care' as CategoryId,
    description: 'Family doctor attachment rates, accepting provider directories, and Local Geographic Area community healthcare needs.',
    icon: Stethoscope,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    badge: 'COMMUNITY',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    source: 'CIHI Shared Health Priorities & StatsCan Profiles',
    updateFrequency: 'Annual surveys',
  },
  {
    id: 'long-term-care' as const,
    title: 'Long Term Care & Seniors Care',
    shortName: 'Long Term Care',
    category: 'community-care' as CategoryId,
    description: 'Placement timelines, clinical outcome standards, home care professional continuity, and facility compliance registries.',
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
    description: 'Patient-reported satisfaction, clinician communication efficacy, hospital harm rates, and advocacy diagnostics.',
    icon: HeartHandshake,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    badge: 'FOCUS SURVEY',
    badgeColor: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    source: 'HQCA FOCUS & CIHI Inpatient CPES-IC',
    updateFrequency: 'Quarterly Release',
  },
  {
    id: 'virtual-care' as const,
    title: 'Virtual Care & 811 Access',
    shortName: 'Virtual Care',
    category: 'community-care' as CategoryId,
    description: 'Health Link 811 call volumes, Virtual MD physician consult outcomes, 911-to-811 diversion pathways, and digital care access.',
    icon: Phone,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-500/10',
    borderColor: 'border-fuchsia-500/20',
    badge: 'VIRTUAL CARE',
    badgeColor: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    source: 'AHS Quick Facts • CJEM Study • Primary Care Alberta',
    updateFrequency: 'Quarterly Audits',
  },
  {
    id: 'cancer' as const,
    title: 'Cancer Screening & Care',
    shortName: 'Cancer Care',
    category: 'prevention-surveillance' as CategoryId,
    description: 'Oncology burden, cancer screening participation rates by health zone, surgery wait times, and treatment locations.',
    icon: Ribbon,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/20',
    badge: 'ONCOLOGY',
    badgeColor: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    source: 'Cancer Care Alberta & CIHI',
    updateFrequency: 'Q1 2026 Release',
  },
  {
    id: 'public-health' as const,
    title: 'Public Health & Outbreaks',
    shortName: 'Public Health',
    category: 'prevention-surveillance' as CategoryId,
    description: 'Respiratory pathogens, wastewater early-warning monitors, and childhood immunization coverage (notifiable-disease and environmental-advisory views pending verified data).',
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
    description: 'Substance-related harms, live detoxification and recovery bed availability, and counselling wait times.',
    icon: Brain,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    badge: 'MHSU SYSTEM',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    source: 'Recovery Alberta & ABED Registry',
    updateFrequency: 'Daily updates',
  },
  {
    id: 'regional-inequity' as const,
    title: 'Regional Health Inequity',
    shortName: 'Health Inequity',
    category: 'equity-outcomes' as CategoryId,
    description: 'Socioeconomic deprivation indicators, regional chronic disease burdens, emergency department reliance, and travel-for-care metrics.',
    icon: Compass,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    badge: 'EQUITY INDEX',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    source: 'Alberta Health Community Profiles (132 LGAs)',
    updateFrequency: 'Annual Audits',
  },
  {
    id: 'health-spending' as const,
    title: 'Health Spending & Productivity',
    shortName: 'Health Spending',
    category: 'equity-outcomes' as CategoryId,
    description: 'CIHI spending benchmarks, hospital productivity indexes, case stay costs, and physician clinical payment analyses.',
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

const LOCATION_SKIP_KEY = 'alberta_hospital_location_prompt_dismissed';

interface EmailAlert {
  id: string;
  email: string;
  hospitalId: string;
  hospitalName: string;
  thresholdMins: number;
  createdAt: string;
}

interface AlertLog {
  id: string;
  email: string;
  hospitalName: string;
  thresholdMins: number;
  currentMins: number;
  timestamp: string;
}

const isWaitTimeUnavailable = (hospital: Hospital | null | undefined) => {
  if (!hospital) return true;
  const label = hospital.waitTimeLabel?.toLowerCase() || '';
  return label.includes('unavailable') || label.includes('not available') || label.includes('n/a') || hospital.waitTime < 0;
};

const normalizeTrendRange = (range: string) => (range === '30D' ? '30d' : range);

const formatChartXAxis = (tick: string, range: string) => {
  try {
    const d = new Date(tick);
    const r = normalizeTrendRange(range);
    if (r === '24h') {
      return format(d, 'HH:mm');
    } else if (r === '7d' || r === '30d') {
      return format(d, 'MMM d');
    } else {
      return format(d, 'MMM yy');
    }
  } catch (e) {
    return tick;
  }
};

const trendRangeLabel = (range: string) => {
  const r = normalizeTrendRange(range);
  if (r === '24h') return '24 hours';
  if (r === '7d') return '7 days';
  if (r === '30d') return '30 days';
  return r;
};


const TAB_METADATA_MAP: Record<string, {
  updateType: 'auto' | 'manual';
  interval: string;
  sourceVintage: string;
  source: string;
  domain?: string;
}> = {
  'er-waits': {
    updateType: 'auto',
    interval: 'every 30 mins',
    sourceVintage: 'Real-time feed',
    source: 'Alberta Health Services Portal'
  },
  'disruptions': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: 'Live Active Alerts',
    source: 'AHS Emergency Advisories'
  },
  'system-flow': {
    updateType: 'auto',
    interval: 'daily at 06:00 MT',
    sourceVintage: 'Auto-refreshed daily',
    source: 'HQCA FOCUS & AHS Weekly reports'
  },
  'surgical-waits': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: 'Live / April 2026',
    source: 'AHCIP Surgical Wait Time Registry & ABJHI Orthopedic feeds',
    domain: 'surgical'
  },
  'primary-care': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2024-2026',
    source: 'CIHI Shared Health Priorities & accepting providers database',
    domain: 'primary-care'
  },
  'workforce': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2015-2024',
    source: 'CIHI Health Workforce Database & CPSA Registry',
    domain: 'workforce'
  },
  'diagnostics': {
    updateType: 'auto',
    interval: 'Lab waits: every 30 min · Imaging: annual',
    sourceVintage: '2025-2026',
    source: 'APL QMe REST API, AHS Imaging & CIHI Diagnostic Imaging',
    domain: 'diagnostic'
  },
  'cancer': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2025 screening & wait trends',
    source: 'Cancer Care Alberta & CIHI priority procedure waits',
    domain: 'cancer'
  },
  'mental-health': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2019-2026 MHSU indicators',
    source: 'Recovery Alberta, ASUSS & CIHI indicators',
    domain: 'mental-health'
  },
  'long-term-care': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2020-2026 placement stats',
    source: 'HQCA FOCUS, CIHI CCRS & AHS Continuing Care Registry',
    domain: 'continuing-care'
  },
  'patient-experience': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2026 survey data',
    source: 'HQCA FOCUS & CIHI CPES-IC',
    domain: 'patient-experience'
  },
  'public-health': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: 'July 2026 surveillance indicators',
    source: 'AHS ProvLab, PHAC Wastewater Feed & Alberta RVD',
    domain: 'public-health'
  },
  'regional-inequity': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2026 LGA Community Profiles',
    source: 'Alberta Health Community Profiles (135 LGAs)',
    domain: 'regional-inequity'
  },
  'health-spending': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2025 spending benchmarks',
    source: 'CIHI Spending Trends & AHCIP Supplement',
    domain: 'spending'
  },
  'virtual-care': {
    updateType: 'auto',
    interval: 'every 24 hours',
    sourceVintage: '2025-2026 program statistics',
    source: 'AHS Quick Facts, CJEM Study & PubMed API',
    domain: 'virtual-care'
  }
};

export default function App() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const { syncStatus } = useSyncStatus();
  // Standardized header metadata for the ER Wait Times tab, derived from sync status.
  const erWaitTimesMetadata: DataMetadataMap = {
    ER_WAIT_TIMES: {
      source: 'Alberta Health Services Portal',
      sourceVintage: 'Real-time Feed',
      lastUpdated: syncStatus?.erWaitTimesLastUpdate ?? 'Live Feed',
      updateType: 'auto',
    },
  };
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);
  const [zoneTrends, setZoneTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [trends, setTrends] = useState<WaitTimeSnapshot[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

  // Geolocation States
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; city: string; region: string; isGPS: boolean } | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [sortBy, setSortBy] = useState<'net-wait' | 'proximity' | 'raw-wait'>('net-wait');
  const [gpsRefused, setGpsRefused] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [geocodingError, setGeocodingError] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [osrmData, setOsrmData] = useState<{ [id: string]: { durationMins: number; distanceKm: number } }>({});

  // Chart Range States
  const [zoneRange, setZoneRange] = useState<string>('24h');
  const [hospitalRange, setHospitalRange] = useState<string>('24h');

  // Email Alert States
  const [alertEmail, setAlertEmail] = useState('');
  const [selectedAlertHospitals, setSelectedAlertHospitals] = useState<string[]>([]);
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [submittingAlert, setSubmittingAlert] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<EmailAlert[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([]);
  const [alertSuccessMessage, setAlertSuccessMessage] = useState('');
  const [alertErrorMessage, setAlertErrorMessage] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<{ [region: string]: boolean }>({});
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'er-waits' | 'surgical-waits' | 'disruptions' | 'system-flow' | 'primary-care' | 'workforce' | 'diagnostics' | 'cancer' | 'mental-health' | 'long-term-care' | 'patient-experience' | 'public-health' | 'regional-inequity' | 'health-spending' | 'virtual-care'>(() => {
    const ids = DASHBOARDS.map((d) => d.id);
    return (readDashboardModuleFromUrl(ids) as typeof activeTab) ?? 'er-waits';
  });
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isModulesExpanded, setIsModulesExpanded] = useState(false);

  // Deep-link: ?module=diagnostics (headed verify + bookmarks)
  useEffect(() => {
    const fromUrl = readDashboardModuleFromUrl(DASHBOARDS.map((d) => d.id));
    if (fromUrl) setActiveTab(fromUrl as typeof activeTab);
  }, []);

  // Lock body scroll when map is fullscreen
  useEffect(() => {
    if (isMapFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMapFullscreen]);
  
  const [maxStats, setMaxStats] = useState<{
    max24h: { waitTime: number; timestamp: string; hospitalId: string; hospitalName: string; city: string } | null;
    max7d: { waitTime: number; timestamp: string; hospitalId: string; hospitalName: string; city: string } | null;
    max30d: { waitTime: number; timestamp: string; hospitalId: string; hospitalName: string; city: string } | null;
  } | null>(null);

  // Resolve city name from coordinates using our secure server-side proxy
  const updateLocationWithCityName = async (lat: number, lng: number, isGPS: boolean) => {
    // 1. Immediately set coordinates so all distance-based and routing calculations proceed
    setUserLocation({
      lat,
      lng,
      city: "Determining...",
      region: "Alberta",
      isGPS
    });

    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.city) {
          setUserLocation({
            lat,
            lng,
            city: data.city,
            region: data.region || 'Alberta',
            isGPS
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to reverse geocode user coordinates:', err);
    }

    // Fallback default if geocoding yields nothing or fails
    setUserLocation({
      lat,
      lng,
      city: "Alberta",
      region: "Alberta",
      isGPS
    });
  };

  // Persist userLocation to localStorage
  useEffect(() => {
    if (userLocation) {
      localStorage.setItem('alberta_hospital_user_location', JSON.stringify(userLocation));
    }
  }, [userLocation]);

  useEffect(() => {
    fetchHospitals();
    fetchAlertsAndLogs();
    fetchMaxStats();
    
    // Check if there is a saved location in localStorage first
    const savedLoc = localStorage.getItem('alberta_hospital_user_location');
    if (savedLoc) {
      try {
        const loc = JSON.parse(savedLoc);
        if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
          setUserLocation(loc);
          setSortBy('net-wait');
          setLoadingGeo(false);
          
          // If the saved location was a GPS location and had a generic placeholder name, geocode it
          if (loc.isGPS && (loc.city === "GPS Location" || loc.city === "My Precise GPS Location" || loc.city === "Determining..." || loc.city === "Alberta")) {
            updateLocationWithCityName(loc.lat, loc.lng, true);
          }
          
          // Poll logs occasionally to show real-time alert dispatching
          const intervalLoc = setInterval(fetchAlertsAndLogs, 10000);
          return () => clearInterval(intervalLoc);
        }
      } catch (e) {
        console.warn('Failed to parse saved user location:', e);
      }
    }

    // Auto-request GPS on page load, fallback to IP-based location
    setLoadingGeo(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateLocationWithCityName(pos.coords.latitude, pos.coords.longitude, true);
          setGpsRefused(false);
          setSortBy('net-wait');
          setLoadingGeo(false);
        },
        (err) => {
          console.warn("GPS access declined/failed:", err);
          setGpsRefused(true);
          setLoadingGeo(false);
          if (!localStorage.getItem(LOCATION_SKIP_KEY)) {
            setShowManualInput(true);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setGpsRefused(true);
      setLoadingGeo(false);
      if (!localStorage.getItem(LOCATION_SKIP_KEY)) {
        setShowManualInput(true);
      }
    }
    
    // Poll logs occasionally to show real-time alert dispatching
    const interval = setInterval(fetchAlertsAndLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch travel times using OpenStreetMap routing (OSRM API) for hospitals within 100km
  useEffect(() => {
    if (!userLocation || hospitals.length === 0) {
      setOsrmData({});
      return;
    }

    const fetchOSRMDistances = async () => {
      const results: { [id: string]: { durationMins: number; distanceKm: number } } = {};
      
      // Filter hospitals within 100km straight-line distance
      const nearbyHospitals = hospitals.filter(h => {
        if (!h.latitude || !h.longitude) return false;
        const d = calculateDistance(userLocation.lat, userLocation.lng, h.latitude, h.longitude);
        return d <= 100;
      });

      if (nearbyHospitals.length === 0) {
        setOsrmData({});
        return;
      }

      // Fetch OSRM coordinates for each nearby hospital
      await Promise.all(nearbyHospitals.map(async (h) => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${h.longitude},${h.latitude}?overview=false`;
          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
              const route = data.routes[0];
              const durationMins = Math.round(route.duration / 60);
              const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
              results[h.id] = { durationMins, distanceKm };
            }
          }
        } catch (e) {
          console.warn(`OSRM routing failed for ${h.name}:`, e);
        }
      }));

      setOsrmData(results);
    };

    fetchOSRMDistances();
  }, [userLocation, hospitals]);

  // Auto-select nearest hospital when userLocation or hospitals list updates
  useEffect(() => {
    if (userLocation && hospitals.length > 0) {
      const withDistances = hospitals
        .filter(h => h.latitude !== null && h.longitude !== null)
        .map(h => {
          const dist = calculateDistance(userLocation.lat, userLocation.lng, h.latitude!, h.longitude!);
          return { ...h, distance: dist };
        });

      if (withDistances.length > 0) {
        withDistances.sort((a, b) => a.distance - b.distance);
        const nearest = hospitals.find(h => h.id === withDistances[0].id);
        if (nearest && selectedHospital?.id !== nearest.id) {
          setSelectedHospital(nearest);
        }
      }
    }
  }, [userLocation, hospitals]);

  // Sync Zone Trends on Range Update
  useEffect(() => {
    fetchZoneTrends(zoneRange);
  }, [zoneRange]);

  // Sync Selected Hospital Trends on Hospital or Range Update
  useEffect(() => {
    if (selectedHospital) {
      fetchTrends(selectedHospital.id, hospitalRange);
    }
  }, [selectedHospital?.id, hospitalRange]);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitals');
      const data = await res.json();
      if (Array.isArray(data)) {
        setHospitals(data);
        // Default to first hospital for detailed side panel
        if (data.length > 0 && !selectedHospital) {
          setSelectedHospital(data[0]);
        }
      } else {
        console.error('Expected array of hospitals, got:', data);
        setHospitals([]);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaxStats = async () => {
    try {
      const res = await fetch('/api/trends/max-stats');
      if (res.ok) {
        const data = await res.json();
        setMaxStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch max stats', err);
    }
  };

  const fetchZoneTrends = async (range: string = '24h') => {
    try {
      const res = await fetch(`/api/trends/zones?range=${range}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setZoneTrends(data);
      } else {
        console.error('Expected array of zone trends, got:', data);
      }
    } catch (error) {
      console.error('Failed to fetch zone trends', error);
    }
  };

  const fetchTrends = async (id: string, range: string = '24h') => {
    setLoadingTrends(true);
    const apiRange = normalizeTrendRange(range);
    try {
      const res = await fetch(`/api/trends/${encodeURIComponent(id)}?range=${encodeURIComponent(apiRange)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setTrends(data);
      } else {
        console.error('Expected array of trends, got:', data);
        setTrends([]);
      }
    } catch (error) {
      console.error('Failed to fetch trends', error);
      setTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  };

  // Fetch active subscriptions and dispatch history
  const fetchAlertsAndLogs = async () => {
    try {
      const resAlerts = await fetch('/api/alerts');
      const dataAlerts = await resAlerts.json();
      if (Array.isArray(dataAlerts)) {
        setActiveAlerts(dataAlerts);
      }

      const resLogs = await fetch('/api/alerts/logs');
      const dataLogs = await resLogs.json();
      if (Array.isArray(dataLogs)) {
        setAlertLogs(dataLogs);
      }
    } catch (err) {
      console.warn('Failed to load alert statuses:', err);
    }
  };

  const toTitleCase = (str: string): string => {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Extract a clean city name from Nominatim's display_name.
  // Returns the part just before "Alberta" when available, otherwise the
  // second-to-last comma-separated component, falling back to the raw input.
  const extractCityFromDisplayName = (displayName: string | undefined, fallback: string): string => {
    if (!displayName) return toTitleCase(fallback);
    const parts = displayName.split(',').map(s => s.trim());
    const albertaIdx = parts.findIndex(p => p.toLowerCase() === 'alberta');
    if (albertaIdx > 0) {
      return toTitleCase(parts[albertaIdx - 1]);
    }
    if (parts.length >= 2) {
      return toTitleCase(parts[parts.length - 2]);
    }
    return toTitleCase(fallback);
  };

  // Precise browser GPS request
  const requestGPSLocation = () => {
    setLoadingGeo(true);
    setGpsRefused(false);
    setGeocodingError('');
    if (!navigator.geolocation) {
      setGeocodingError("Browser geolocation services are not supported by this browser.");
      setGpsRefused(true);
      setLoadingGeo(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateLocationWithCityName(pos.coords.latitude, pos.coords.longitude, true);
        setGpsRefused(false);
        setSortBy('net-wait');
        setLoadingGeo(false);
        setShowManualInput(false);
      },
      (err) => {
        console.warn("Precise GPS access declined/failed:", err);
        setGpsRefused(true);
        setGeocodingError("Could not detect your location automatically. Enter an Alberta postal code, address, or city below.");
        setLoadingGeo(false);
        setShowManualInput(true);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Geocode address or postal code using zippopotam.us (for Canadian postal codes) or Nominatim as fallback
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput.trim()) return;
    setIsGeocoding(true);
    setGeocodingError('');
    try {
      const inputTrimmed = addressInput.trim();
      
      const compactPostal = inputTrimmed.replace(/\s+/g, '').toUpperCase();
      const fsaFromFullPostal =
        /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compactPostal) ? compactPostal.slice(0, 3) : null;
      const fsaMatch =
        fsaFromFullPostal ??
        (inputTrimmed.match(/\b([a-zA-Z]\d[a-zA-Z])\b/) || inputTrimmed.match(/([a-zA-Z]\d[a-zA-Z])/))?.[1]?.toUpperCase() ??
        null;
      const fsa = fsaMatch;

      if (fsa) {
        try {
          const zipRes = await fetch(`https://api.zippopotam.us/ca/${fsa}`);
          if (zipRes.ok) {
            const zipData = await zipRes.json();
            if (zipData && zipData.places && zipData.places.length > 0) {
              const place = zipData.places[0];
              setUserLocation({
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
                city: place['place name'],
                region: "Alberta",
                isGPS: false
              });
              setSortBy('net-wait');
              setAddressInput('');
              setIsGeocoding(false);
              setShowManualInput(false);
              return; // Successfully geocoded postal code
            }
          }
        } catch (zipErr) {
          console.warn('Zippopotam.us API error, falling back to Nominatim:', zipErr);
        }
      }

      // Fallback: Geocode using Nominatim
      const cleanQuery = fsa ? `${fsa}, Alberta, Canada` : `${inputTrimmed}, Alberta, Canada`;
      const query = encodeURIComponent(cleanQuery);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'AlbertaWaitTimesApp/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const result = data[0];
          // Extract a clean city name from Nominatim's display_name when possible,
          // e.g. "T6G, Edmonton, Alberta, Canada" -> "Edmonton"
          const cityName = extractCityFromDisplayName(result.display_name, inputTrimmed);
          setUserLocation({
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            city: cityName,
            region: "Alberta",
            isGPS: false
          });
          setSortBy('net-wait');
          setAddressInput('');
          setShowManualInput(false);
        } else {
          setGeocodingError('Location not found. Please try a valid Alberta postal code, address, or city (e.g., T2P 2M5, Calgary).');
        }
      } else {
        setGeocodingError('Unable to connect to location services. Please try again.');
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      setGeocodingError('An error occurred while looking up the location.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Register a new Email alert
  const registerAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertSuccessMessage('');
    setAlertErrorMessage('');
    if (!alertEmail || selectedAlertHospitals.length === 0) {
      setAlertErrorMessage("Please provide an email address and select at least one hospital facility.");
      return;
    }

    setSubmittingAlert(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: alertEmail,
          hospitalIds: selectedAlertHospitals,
          thresholdMins: alertThreshold
        })
      });

      if (res.ok) {
        setAlertSuccessMessage(`Successfully registered alerts for ${alertEmail}!`);
        setAlertEmail('');
        setSelectedAlertHospitals([]);
        fetchAlertsAndLogs();
        setTimeout(() => setAlertSuccessMessage(''), 5000);
      } else {
        const errData = await res.json();
        setAlertErrorMessage(errData.error || "Subscription failed");
      }
    } catch (error) {
      console.error("Alert registration error:", error);
      setAlertErrorMessage("An error occurred during alert registration. Please check your connection and try again.");
    } finally {
      setSubmittingAlert(false);
    }
  };

  // Remove alert subscription
  const deleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAlertsAndLogs();
      }
    } catch (err) {
      console.warn("Delete subscription failure:", err);
    }
  };
  // Get unique region list
  const regions = ['All', ...Array.from(new Set(hospitals.map(h => h.region)))];

  // Process list with distance calculation, search, filters, and proximity sorting
  const processedHospitals = hospitals.map(h => {
    let distance: number | undefined = undefined;
    let driveMins: number | undefined = undefined;
    
    if (userLocation && h.latitude && h.longitude) {
      if (osrmData[h.id]) {
        distance = osrmData[h.id].distanceKm;
        driveMins = osrmData[h.id].durationMins;
      } else {
        distance = calculateDistance(userLocation.lat, userLocation.lng, h.latitude, h.longitude);
        driveMins = Math.round((distance / 85) * 60);
      }
    }
    return { ...h, distance, driveMins };
  });

  const filteredAndSortedHospitals = processedHospitals
    .filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) || 
                            h.city.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || h.region === selectedRegion;
      return matchesSearch && matchesRegion;
    })
    .sort((a, b) => {
      const isAUnav = isWaitTimeUnavailable(a);
      const isBUnav = isWaitTimeUnavailable(b);
      // Keep unavailable wait times at the bottom of the list for all sort modes
      if (isAUnav && !isBUnav) return 1;
      if (!isAUnav && isBUnav) return -1;
      if (isAUnav && isBUnav) {
        // If both are unavailable, sort by distance/name
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return a.name.localeCompare(b.name);
      }

      if (sortBy === 'net-wait') {
        if (a.distance !== undefined && b.distance !== undefined) {
          const driveMinsA = a.driveMins || 0;
          const driveMinsB = b.driveMins || 0;
          const netWaitA = driveMinsA + a.waitTime;
          const netWaitB = driveMinsB + b.waitTime;
          return netWaitA - netWaitB;
        }
        // Fallback if no location: Sort by waitTime (raw)
        return a.waitTime - b.waitTime;
      }

      if (sortBy === 'proximity') {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
        return a.waitTime - b.waitTime;
      }

      // sortBy === 'raw-wait'
      return a.waitTime - b.waitTime;
    });

  // Group processed hospitals by zone (region), sorting them within each zone using the same selected sort key
  const groupedZones: { name: string; distance: number; hospitals: typeof processedHospitals }[] = [];
  const allRegions = Array.from(new Set(processedHospitals.map(h => h.region))) as string[];
  
  allRegions.forEach(regionName => {
    const matchedHospitals = processedHospitals.filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(search.toLowerCase()) || 
                            h.city.toLowerCase().includes(search.toLowerCase());
      const matchesRegion = selectedRegion === 'All' || h.region === selectedRegion;
      return h.region === regionName && matchesSearch && matchesRegion;
    });

    if (matchedHospitals.length > 0) {
      matchedHospitals.sort((a, b) => {
        const isAUnav = isWaitTimeUnavailable(a);
        const isBUnav = isWaitTimeUnavailable(b);
        if (isAUnav && !isBUnav) return 1;
        if (!isAUnav && isBUnav) return -1;
        if (isAUnav && isBUnav) {
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          return a.name.localeCompare(b.name);
        }

        if (sortBy === 'net-wait') {
          if (a.distance !== undefined && b.distance !== undefined) {
            const driveMinsA = a.driveMins || 0;
            const driveMinsB = b.driveMins || 0;
            const netWaitA = driveMinsA + a.waitTime;
            const netWaitB = driveMinsB + b.waitTime;
            return netWaitA - netWaitB;
          }
          return a.waitTime - b.waitTime;
        }

        if (sortBy === 'proximity') {
          if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
          }
          if (a.distance !== undefined) return -1;
          if (b.distance !== undefined) return 1;
          return a.waitTime - b.waitTime;
        }

        return a.waitTime - b.waitTime;
      });

      const minDistance = Math.min(...matchedHospitals.map(h => h.distance !== undefined ? h.distance : Infinity));

      groupedZones.push({
        name: regionName,
        distance: minDistance === Infinity ? 999999 : minDistance,
        hospitals: matchedHospitals
      });
    }
  });

  // Sort the zones themselves: closest zone to user first!
  groupedZones.sort((a, b) => {
    if (sortBy === 'net-wait' && userLocation) {
      const minNetWaitA = Math.min(...a.hospitals.map(h => {
        const isUnav = isWaitTimeUnavailable(h);
        if (isUnav) return Infinity;
        const driveMins = h.driveMins || 0;
        return driveMins + h.waitTime;
      }));
      const minNetWaitB = Math.min(...b.hospitals.map(h => {
        const isUnav = isWaitTimeUnavailable(h);
        if (isUnav) return Infinity;
        const driveMins = h.driveMins || 0;
        return driveMins + h.waitTime;
      }));
      if (minNetWaitA !== minNetWaitB) return minNetWaitA - minNetWaitB;
    }
    return a.distance - b.distance;
  });

  // Shortest Wait Calculator logic: Drive Time (OSRM or 85km/h avg) + Current Hospital Wait Time
  const calculatedShortestWaitList = processedHospitals
    .filter(h => h.distance !== undefined && h.distance < 150 && !isWaitTimeUnavailable(h)) // Only look within 150km radius and with available wait times
    .map(h => {
      const driveMins = h.driveMins || 0;
      const totalTime = driveMins + h.waitTime;

      return {
        ...h,
        driveMins,
        trafficDelay: 0,
        totalTime
      };
    })
    .sort((a, b) => a.totalTime - b.totalTime)
    .slice(0, 3); // Top 3 optimal recommendations

  // Calculate high-fidelity metrics
  const validHospitals = hospitals.filter(h => h.waitTime >= 0);
  const edmontonHospitals = validHospitals.filter(h => h.city.toLowerCase() === 'edmonton');
  const calgaryHospitals = validHospitals.filter(h => h.city.toLowerCase() === 'calgary');
  const restHospitals = validHospitals.filter(h => h.city.toLowerCase() !== 'edmonton' && h.city.toLowerCase() !== 'calgary');

  const stats = {
    avgWait: validHospitals.length > 0 ? Math.round(validHospitals.reduce((acc, h) => acc + h.waitTime, 0) / validHospitals.length) : 0,
    edmontonAvgWait: edmontonHospitals.length > 0 ? Math.round(edmontonHospitals.reduce((acc, h) => acc + h.waitTime, 0) / edmontonHospitals.length) : 0,
    calgaryAvgWait: calgaryHospitals.length > 0 ? Math.round(calgaryHospitals.reduce((acc, h) => acc + h.waitTime, 0) / calgaryHospitals.length) : 0,
    restAvgWait: restHospitals.length > 0 ? Math.round(restHospitals.reduce((acc, h) => acc + h.waitTime, 0) / restHospitals.length) : 0,
    maxWait: hospitals.length > 0 ? Math.max(...hospitals.map(h => h.waitTime)) : 0,
    totalHospitals: hospitals.length,
    nearestHospital: processedHospitals.filter(h => h.distance !== undefined).sort((a, b) => (a.distance || 0) - (b.distance || 0))[0] || null
  };

  const facilityTrendStats = useMemo(() => {
    const avg = averageFacilityWaitMinutes(trends);
    const busiest = busiestHourOfDay(trends);
    const yDomain = facilityTrendYDomain(trends);
    const rangeKey = normalizeTrendRange(hospitalRange);
    return { avg, busiest, yDomain, rangeKey };
  }, [trends, hospitalRange]);

  const activeDashboard = DASHBOARDS.find(d => d.id === activeTab) ?? DASHBOARDS[0];
  const footerTitle =
    activeTab === 'er-waits'
      ? 'Alberta Emergency Department Monitor'
      : 'Alberta Health Data Monitor';
  const footerBlurb =
    activeTab === 'er-waits'
      ? 'Data synchronized directly from the Alberta Health Services live portal. Estimated wait times are updated every 30 minutes.'
      : `Viewing ${activeDashboard.title}. Source: ${activeDashboard.source}. Update cadence: ${activeDashboard.updateFrequency}.`;

  const dismissLocationPrompt = () => {
    localStorage.setItem(LOCATION_SKIP_KEY, '1');
    setShowManualInput(false);
    setGeocodingError('');
  };

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
          
          <div className="flex items-center gap-4">
            {/* Compass Geolocation Badge */}
            {userLocation ? (
              <button
                onClick={() => {
                  setShowManualInput(true);
                  const el = document.getElementById('geolocation-banner');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                  setTimeout(() => {
                    const inputEl = document.getElementById('manual-location-input');
                    if (inputEl) inputEl.focus();
                  }, 500);
                }}
                className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-full text-xs text-blue-300 font-medium transition-all cursor-pointer group"
                title="Change or set location manually"
              >
                <Compass className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300 animate-spin-slow" />
                <span>Location: {userLocation.city}</span>
                <span className="text-[10px] text-blue-400/80 hover:text-blue-200 pl-1.5 border-l border-blue-500/30 font-bold uppercase tracking-wider ml-0.5">Change</span>
              </button>
            ) : loadingGeo ? (
              <div className="hidden md:flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800/60 rounded-full text-xs text-slate-400 font-medium">
                <Compass className="w-3 h-3 animate-spin" />
                <span>Locating...</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowManualInput(true);
                  const el = document.getElementById('geolocation-banner');
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                  }
                  setTimeout(() => {
                    const inputEl = document.getElementById('manual-location-input');
                    if (inputEl) inputEl.focus();
                  }, 500);
                }}
                className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-full text-xs text-blue-300 font-medium transition-all cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                <span>Set Location</span>
              </button>
            )}


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

        {/* Mobile Header Dashboard Switcher */}
        {(() => {
          const activeDashboard = DASHBOARDS.find(d => d.id === activeTab) || DASHBOARDS[0];
          const ActiveIcon = activeDashboard.icon;
          return (
            <div className="lg:hidden mb-6">
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="w-full flex items-center justify-between p-4 bg-[#090e21] border border-slate-800 rounded-2xl hover:border-slate-700 transition-all text-left shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${activeDashboard.bgColor} ${activeDashboard.color}`}>
                    <ActiveIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-wider">
                      {getCategoryTitle(activeDashboard.category)}
                    </div>
                    <div className="text-sm font-extrabold text-white">
                      {activeDashboard.title}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[9px] font-black bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-full uppercase tracking-wider">
                    Change Module
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            </div>
          );
        })()}

        {/* Mobile Slide-Up Navigation Drawer */}
        <AnimatePresence>
          {isMobileNavOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                key="mobile-nav-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileNavOpen(false)}
                className="fixed inset-0 bg-black/80 z-50 lg:hidden"
              />
              {/* Slide-up Container */}
              <motion.div
                key="mobile-nav-drawer"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#090e21] border-t border-slate-800 rounded-t-3xl z-50 p-6 flex flex-col overflow-hidden lg:hidden shadow-2xl"
              >
                {/* Drawer Drag Bar */}
                <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto mb-4 shrink-0" />

                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                      Select Analytics Console
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Explore active health service metrics across Alberta</p>
                  </div>
                  <button
                    onClick={() => setIsMobileNavOpen(false)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                </div>

                {/* Drawer Search */}
                <div className="relative my-4 shrink-0">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search dashboards..."
                    value={dashboardSearch}
                    onChange={(e) => setDashboardSearch(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  {dashboardSearch && (
                    <button
                      onClick={() => setDashboardSearch('')}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-white text-xs font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Drawer Body - Scrollable */}
                <div className="flex-1 overflow-y-auto pr-1 pb-8 space-y-6">
                  {CATEGORIES.filter(c => c.id !== 'all').map(category => {
                    const items = DASHBOARDS.filter(d =>
                      d.category === category.id &&
                      dashboardMatchesSearch(d, dashboardSearch)
                    );

                    if (items.length === 0) return null;

                    return (
                      <div key={category.id} className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">
                          {CATEGORY_TITLE_BY_ID[category.id]}
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {items.map(d => {
                            const Icon = d.icon;
                            const isActive = activeTab === d.id;
                            return (
                              <button
                                key={d.id}
                                type="button"
                                data-dashboard-id={d.id}
                                onClick={() => {
                                  setActiveTab(d.id);
                                  setIsMobileNavOpen(false);
                                  if (isMapFullscreen) {
                                    setIsMapFullscreen(false);
                                  }
                                }}
                                className={`w-full flex items-start gap-3.5 p-3.5 rounded-xl text-xs transition-all text-left ${
                                  isActive
                                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold border border-blue-400/30'
                                    : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-800/40'
                                }`}
                              >
                                <div className={`p-2 rounded-xl shrink-0 ${
                                  isActive ? 'bg-white/10 text-white' : `${d.bgColor} ${d.color}`
                                }`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="space-y-1">
                                  <div className="font-extrabold flex items-center gap-2">
                                    <span>{d.title}</span>
                                    {d.badge && (
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-widest border ${
                                        isActive ? 'bg-white/10 text-white border-white/20' : d.badgeColor
                                      }`}>
                                        {d.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-[10px] leading-relaxed ${isActive ? 'text-blue-100/80' : 'text-slate-400'}`}>
                                    {d.description}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* No Results Drawer */}
                  {DASHBOARDS.filter(d =>
                    dashboardMatchesSearch(d, dashboardSearch)
                  ).length === 0 && (
                    <div className="text-center py-8 bg-slate-950/20 border border-dashed border-slate-800 rounded-2xl space-y-2">
                      <Search className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400 font-medium">No matches found</p>
                      <button
                        onClick={() => setDashboardSearch('')}
                        className="text-[10px] text-blue-400 font-black uppercase tracking-wider"
                      >
                        Reset Filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Horizontal Nav Bar (Desktop Only, under notice disclaimer) */}
        {!isModulesExpanded ? (
          <div className="hidden lg:flex bg-[#090e21] border border-slate-800 rounded-2xl p-3 mb-6 shadow-xl w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  Active Module: <span className="text-white font-extrabold">{DASHBOARDS.find(d => d.id === activeTab)?.title}</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-medium">Click "Change Module" to browse other analytical dashboards</p>
              </div>
            </div>
            <button
              onClick={() => setIsModulesExpanded(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
            >
              Change Module
            </button>
          </div>
        ) : (
          <div className="hidden lg:block bg-[#090e21] border border-slate-800 rounded-2xl p-4 mb-8 shadow-xl w-full space-y-4">
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

            {/* Search Bar */}
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
                  onClick={() => setDashboardSearch('')}
                  className="absolute right-3 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setIsModulesExpanded(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                Minimize
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
              <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
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
                      onClick={() => {
                        setActiveTab(d.id);
                        setIsModulesExpanded(false);
                        if (isMapFullscreen) setIsMapFullscreen(false);
                      }}
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
                    <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                      {items.map(d => {
                        const Icon = d.icon;
                        const isActive = activeTab === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            data-dashboard-id={d.id}
                            onClick={() => {
                              setActiveTab(d.id);
                              setIsModulesExpanded(false);
                              if (isMapFullscreen) setIsMapFullscreen(false);
                            }}
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
          <>
            {/* Header */}
            <DashboardHeader
              icon={Clock}
              title="Real-time Emergency Department Wait Times"
              description="Track estimated wait times from registration to physician assessment at regional emergency facilities."
              metadata={erWaitTimesMetadata}
              arrayKey="ER_WAIT_TIMES"
            />

        {/* Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Provincial Avg Wait Card Breakdown */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-[8px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  Live State Average
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-black text-white tracking-tight leading-none">
                  {formatMinutesToHm(stats.avgWait)}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Provincial Average Wait
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 mt-1">
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Edmonton</span>
                <span className="text-xs font-black text-emerald-400 font-mono block mt-0.5">
                  {formatMinutesToHm(stats.edmontonAvgWait)}
                </span>
              </div>
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Calgary</span>
                <span className="text-xs font-black text-blue-400 font-mono block mt-0.5">
                  {formatMinutesToHm(stats.calgaryAvgWait)}
                </span>
              </div>
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Rest AB</span>
                <span className="text-xs font-black text-indigo-400 font-mono block mt-0.5">
                  {formatMinutesToHm(stats.restAvgWait)}
                </span>
              </div>
            </div>
          </div>

          {/* Max Recorded Wait Card Breakdown */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
                <span className="text-[8px] font-extrabold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  Historical Peaks
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-1.5">
                <p className="text-2xl font-black text-white tracking-tight leading-none">
                  {maxStats?.max24h ? formatMinutesToHm(maxStats.max24h.waitTime) : formatMinutesToHm(stats.maxWait)}
                </p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Max Recorded Wait (24h Peak)
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5 mt-1">
              {/* 24 Hour Max Column */}
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl flex flex-col justify-between text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">24h Max</span>
                <span className="text-xs font-black text-red-400 font-mono block mt-0.5">
                  {maxStats?.max24h ? formatMinutesToHm(maxStats.max24h.waitTime) : formatMinutesToHm(stats.maxWait)}
                </span>
                <span className="text-[7px] text-slate-500 font-medium italic truncate block mt-1" title={maxStats?.max24h ? maxStats.max24h.hospitalName : ''}>
                  {maxStats?.max24h ? maxStats.max24h.hospitalName.replace('Community Hospital', '').replace('General Hospital', '').trim() : 'Syncing...'}
                </span>
              </div>

              {/* 7 Day Max Column */}
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl flex flex-col justify-between text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">7d Max</span>
                <span className="text-xs font-black text-red-400 font-mono block mt-0.5">
                  {maxStats?.max7d ? formatMinutesToHm(maxStats.max7d.waitTime) : '—'}
                </span>
                <span className="text-[7px] text-slate-500 font-medium italic truncate block mt-1" title={maxStats?.max7d ? maxStats.max7d.hospitalName : ''}>
                  {maxStats?.max7d ? maxStats.max7d.hospitalName.replace('Community Hospital', '').replace('General Hospital', '').trim() : 'No historical data'}
                </span>
              </div>

              {/* 30 Day Max Column */}
              <div className="p-2 bg-slate-950/40 border border-slate-800/40 rounded-xl flex flex-col justify-between text-center min-w-0">
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">30d Max</span>
                <span className="text-xs font-black text-red-400 font-mono block mt-0.5">
                  {maxStats?.max30d ? formatMinutesToHm(maxStats.max30d.waitTime) : '—'}
                </span>
                <span className="text-[7px] text-slate-500 font-medium italic truncate block mt-1" title={maxStats?.max30d ? maxStats.max30d.hospitalName : ''}>
                  {maxStats?.max30d ? maxStats.max30d.hospitalName.replace('Community Hospital', '').replace('General Hospital', '').trim() : 'No historical data'}
                </span>
              </div>
            </div>
          </div>

          {/* Travel & Treatment Calculator Card */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <Compass className="w-4 h-4 text-blue-400" />
                </div>
                {userLocation ? (
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    userLocation.isGPS 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                      : 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
                  }`}>
                    {userLocation.isGPS ? 'Auto-Detected' : 'Custom'}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700/60 text-slate-400 rounded text-[8px] font-black uppercase tracking-widest">
                    Inactive
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-2 mb-1.5">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Treatment Calculator
                </h3>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal">
                Combine your driving time with live ER wait times to find the fastest care.
              </p>
            </div>

            <div className="space-y-2 mt-1">
              {userLocation ? (
                <div className="p-2 bg-slate-950/60 border border-slate-850 rounded-xl flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[8px] text-slate-500 uppercase font-bold">Location Origin</p>
                    <p className="text-[11px] text-white font-extrabold truncate flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
                      <span>{userLocation.city}, AB</span>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setUserLocation(null);
                      setAddressInput('');
                    }}
                    className="px-2 py-1 text-[9px] font-black bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg uppercase tracking-wider hover:bg-red-500/25 transition-all cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={requestGPSLocation}
                    disabled={loadingGeo}
                    className="py-1.5 px-2 text-[10px] font-bold rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Compass className={`w-3 h-3 ${loadingGeo ? 'animate-spin' : ''}`} />
                    <span>{loadingGeo ? '...' : 'Use GPS'}</span>
                  </button>
                  <button
                    onClick={() => setShowManualInput(true)}
                    className="py-1.5 px-2 text-[10px] font-bold rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <MapPin className="w-3 h-3" />
                    <span>Manual</span>
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowManualInput(true)}
                className="w-full py-1.5 px-2 text-[10px] font-bold rounded-lg border border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3" />
                <span>{userLocation ? 'Change Location' : 'Set Location'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Shortest Wait Time Driving Calculator Section (Shows if distance available) */}
        {calculatedShortestWaitList.length > 0 && (
          <div className="mb-3 p-3.5 sm:p-4 bg-[#0b1329] border border-blue-900/30 rounded-2xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Compass className="w-32 h-32 text-blue-500" />
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-2.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4.5 h-4.5 text-blue-400" />
                <h3 className="text-sm font-extrabold text-white tracking-tight">Optimal Route Planner: Shortest Time to Treatment</h3>
              </div>
              <p className="text-[10px] text-slate-400">
                Live Alberta Health waiting cues + driving times combined to calculate fastest path.
              </p>
            </div>
 
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-2.5">
              {calculatedShortestWaitList.map((h, i) => (
                <div 
                  key={h.id} 
                  className={cn(
                    "p-3 rounded-xl border transition-all flex flex-col justify-between cursor-pointer",
                    i === 0 
                      ? "bg-blue-950/20 border-blue-500/40 ring-1 ring-blue-500/10" 
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                  )}
                  onClick={() => setSelectedHospital(h)}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
                        i === 0 ? "bg-blue-500/20 text-blue-300" : "bg-slate-800 text-slate-400"
                      )}>
                        {i === 0 ? "Rank 1: Fastest Care" : `Rank ${i + 1}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold font-mono">{h.distance} km away</span>
                    </div>
                    <h4 className="text-xs font-extrabold text-white break-words mt-0.5 leading-tight">{h.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{h.city}</p>
                  </div>
 
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none">Est. Treatment</p>
                      <p className="text-sm font-black text-white mt-0.5 leading-none">{formatMinutesToHm(h.totalTime)}</p>
                    </div>
                    <div className="text-right text-[9px] text-slate-400 font-semibold space-y-0.5 leading-none">
                      <p>Wait: {formatMinutesToHm(h.waitTime)}</p>
                      <p>Drive: {formatMinutesToHm(h.driveMins)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
 
            {/* Disclaimer block inside Optimal Route Planner */}
            <div className="p-2 bg-amber-500/5 border border-amber-500/15 rounded-xl text-[9px] text-amber-300/85 leading-normal flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="truncate sm:whitespace-normal">
                <strong>Emergency Disclaimer:</strong> Estimates are guidance only. In a medical emergency, please dial <strong>911</strong> immediately or head directly to the nearest facility.
              </p>
            </div>
          </div>
        )}
 
        {/* Consolidated Historical Charts */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-3 sm:p-3.5 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                <h3 className="text-sm font-extrabold text-white">Hospital Queue Averages & Trends</h3>
              </div>
            </div>
            
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 shrink-0 self-start sm:self-center">
              {['24h', '7d', '30D'].map((r) => {
                const val = r;
                const isActive = zoneRange === val;
                return (
                  <button
                    key={r}
                    onClick={() => setZoneRange(val)}
                    className={cn(
                      "px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider transition-all",
                      isActive 
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/10" 
                        : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
 
          <div className="h-36">
            {zoneTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={zoneTrends}>
                  <defs>
                    <linearGradient id="colorCalgary" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorEdmonton" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorCentral" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorSouth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ec4899" stopOpacity={0.15}/><stop offset="95%" stopColor="#ec4899" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorNorth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(tick) => formatChartXAxis(tick, zoneRange)}
                    stroke="#475569"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                  />
                  <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 10 }} unit="m" />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="chart-tooltip space-y-1.5 text-xs max-w-xs">
                            <p className="chart-tooltip-title">{format(new Date(payload[0].payload.timestamp), 'MMM d, h:mm a')}</p>
                            {payload.map((series: any) => (
                              <div key={series.name} className="chart-tooltip-row">
                                <span style={{ color: series.color || '#cbd5e1' }} className="chart-tooltip-label">{series.name}:</span>
                                <span className="chart-tooltip-value">{formatMinutesToHm(Number(series.value))}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" name="Calgary Zone" dataKey="Calgary Zone" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorCalgary)" />
                  <Area type="monotone" name="Edmonton Zone" dataKey="Edmonton Zone" stroke="#10b981" strokeWidth={2.5} fill="url(#colorEdmonton)" />
                  <Area type="monotone" name="Central Zone" dataKey="Central Zone" stroke="#f59e0b" strokeWidth={2.5} fill="url(#colorCentral)" />
                  <Area type="monotone" name="South Zone" dataKey="South Zone" stroke="#ec4899" strokeWidth={2.5} fill="url(#colorSouth)" />
                  <Area type="monotone" name="North Zone" dataKey="North Zone" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorNorth)" />
                  <Area type="monotone" name="Provincial Avg" dataKey="Provincial Avg" stroke="#cbd5e1" strokeDasharray="5 5" strokeWidth={2.5} fill="none" />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                <RefreshCw className="w-6 h-6 animate-spin mr-2 text-emerald-500" />
                <span>Compiling comparative zone trends...</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Cartography & Selected Facility Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {/* Map Layer Section (Alberta Cartographic Overlay) */}
          <div className={cn(
            "transition-all duration-300 flex flex-col justify-between",
            isMapFullscreen 
              ? "fixed inset-0 z-[9999] bg-slate-950 p-4 sm:p-6 h-screen w-screen" 
              : "bg-slate-900/40 border border-slate-800 rounded-2xl p-3 sm:p-3.5"
          )}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Map className="w-4.5 h-4.5 text-blue-400" />
                  <h3 className="font-extrabold text-sm text-white">
                    {isMapFullscreen ? "Live Cartography (Alberta Overlay) — Fullscreen Mode" : "Live Cartography"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold border border-slate-700/60 transition-colors cursor-pointer"
                    title={isMapFullscreen ? "Exit fullscreen map mode" : "Maximize map view"}
                  >
                    {isMapFullscreen ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span>Exit Fullscreen</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Fullscreen</span>
                      </>
                    )}
                  </button>
                  <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded text-[8px] font-bold uppercase tracking-wider">OpenStreetMap</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                Explore real-time Alberta Emergency Departments on the interactive map. Click a pin to inspect detailed wait queues.
              </p>
            </div>

            {/* Interactive OpenStreetMap Map Container */}
            <div className={cn(
              "relative bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden mt-2",
              isMapFullscreen ? "flex-1 min-h-0 my-3" : "h-[300px]"
            )}>
              <MapComponent
                hospitals={processedHospitals}
                userLocation={userLocation}
                selectedHospital={selectedHospital}
                setSelectedHospital={setSelectedHospital}
                sortBy={sortBy}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-2">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Low Queue</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Med Queue</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> High Queue</span>
            </div>
          </div>

          {/* Selected Hospital Details Card */}
          <div className={cn(
            "bg-slate-900 rounded-2xl border border-slate-800 p-3 sm:p-3.5 shadow-2xl flex flex-col justify-between",
            !selectedHospital && "border-slate-800/40 opacity-50"
          )}>
            {selectedHospital ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="w-4.5 h-4.5 text-blue-400" />
                      <h2 className="font-extrabold text-sm text-white">Facility Details</h2>
                    </div>
                    <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[8px] font-bold text-blue-400 uppercase tracking-widest">
                      {selectedHospital.category || "Emergency"}
                    </span>
                  </div>
                  
                  <div className="p-2 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 min-w-0">
                        <h3 className="text-xs font-extrabold text-slate-100 truncate">{selectedHospital.name}</h3>
                        {selectedHospital.address && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(selectedHospital.name + ' ' + selectedHospital.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-0.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded border border-blue-500/20 transition-all"
                            title="Open in Google Maps"
                          >
                            <Map className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{selectedHospital.city}, {selectedHospital.region}</p>
                      {selectedHospital.distance !== undefined && (
                        <p className="text-[10px] text-blue-400 font-bold mt-1 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 animate-spin-slow shrink-0" />
                          <span className="truncate">{selectedHospital.distance} km away from your location</span>
                        </p>
                      )}
                    </div>
                    {/* Big Spotlight visual according to sortBy */}
                    <div className="shrink-0 text-right p-2 bg-slate-900 border border-slate-800 rounded-xl min-w-[84px] flex flex-col items-center justify-center select-none shadow-sm">
                      {sortBy === 'raw-wait' ? (
                        <>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wait Time</span>
                          <span className={cn(
                            "text-base font-black tracking-tight leading-none font-sans",
                            isWaitTimeUnavailable(selectedHospital)
                              ? "text-slate-500"
                              : selectedHospital.status === 'Red' 
                                ? "text-red-400" 
                                : selectedHospital.status === 'Yellow' 
                                  ? "text-amber-400" 
                                  : "text-emerald-400"
                          )}>
                            {isWaitTimeUnavailable(selectedHospital) ? "Unav" : formatMinutesToHm(selectedHospital.waitTime)}
                          </span>
                        </>
                      ) : selectedHospital.distance !== undefined && !isWaitTimeUnavailable(selectedHospital) ? (
                        <>
                          <span className="text-[8px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1">Net Time</span>
                          <span className="text-base font-black tracking-tight text-cyan-200 leading-none font-sans">
                            {formatMinutesToHm((selectedHospital.driveMins || 0) + selectedHospital.waitTime)}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wait Time</span>
                          <span className={cn(
                            "text-base font-black tracking-tight leading-none font-sans",
                            isWaitTimeUnavailable(selectedHospital)
                              ? "text-slate-500"
                              : selectedHospital.status === 'Red' 
                                ? "text-red-400" 
                                : selectedHospital.status === 'Yellow' 
                                  ? "text-amber-400" 
                                  : "text-emerald-400"
                          )}>
                            {isWaitTimeUnavailable(selectedHospital) ? "Unav" : formatMinutesToHm(selectedHospital.waitTime)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Single Facility Historical Trend */}
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Historical Wait Trend</h4>
                      <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800 shrink-0">
                        {['24h', '7d', '30D'].map((r) => {
                          const val = r;
                          const isActive = hospitalRange === val;
                          return (
                            <button
                              key={r}
                              onClick={() => setHospitalRange(val)}
                              className={cn(
                                "px-1 py-0.5 text-[7px] font-extrabold rounded uppercase tracking-wider transition-all",
                                isActive 
                                  ? "bg-blue-600 text-white" 
                                  : "text-slate-400 hover:text-slate-200"
                              )}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {(facilityTrendStats.avg !== null || facilityTrendStats.busiest !== null || trends.length === 0) && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-1 text-[9px] text-slate-500">
                        {facilityTrendStats.avg !== null ? (
                          <span>
                            <span className="text-slate-500 font-semibold uppercase tracking-wider">Avg wait ({trendRangeLabel(facilityTrendStats.rangeKey)}):</span>{' '}
                            <span className="text-slate-300 font-mono font-bold">{formatMinutesToHm(facilityTrendStats.avg)}</span>
                          </span>
                        ) : null}
                        {facilityTrendStats.busiest !== null ? (
                          <span>
                            <span className="text-slate-500 font-semibold uppercase tracking-wider">Busiest hour:</span>{' '}
                            <span className="text-slate-300 font-mono font-bold">
                              {facilityTrendStats.busiest.hourLabel} (~{formatMinutesToHm(facilityTrendStats.busiest.avgWaitMinutes)} avg)
                            </span>
                          </span>
                        ) : null}
                        {trends.length === 0 && !loadingTrends && facilityTrendStats.avg === null && facilityTrendStats.busiest === null ? (
                          <span className="text-slate-600">—</span>
                        ) : null}
                      </div>
                    )}
                    <div className="h-28 bg-slate-950 border border-slate-800/80 rounded-xl p-1.5">
                      {loadingTrends ? (
                        <div className="w-full h-full animate-pulse flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 text-blue-500/40 animate-spin" />
                        </div>
                      ) : trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trends} margin={{ top: 4, right: 4, left: 0, bottom: 1 }}>
                            <defs>
                              <linearGradient id="colorWaitSingle" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45}/>
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.08}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                            <XAxis 
                              dataKey="timestamp" 
                              tickFormatter={(tick) => formatChartXAxis(tick, hospitalRange)}
                              stroke="#334155"
                              tick={{ fill: '#64748b', fontSize: 7 }}
                            />
                            <YAxis
                              width={28}
                              domain={facilityTrendStats.yDomain}
                              stroke="#334155"
                              tick={{ fill: '#64748b', fontSize: 7 }}
                              tickFormatter={(v) => formatMinutesToHm(Number(v))}
                            />
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="chart-tooltip text-[10px] !p-2">
                                      <p className="chart-tooltip-value !text-blue-400">{formatMinutesToHm(Number(payload[0].value))}</p>
                                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">{format(new Date(payload[0].payload.timestamp), 'MMM d, HH:mm')}</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {facilityTrendStats.avg !== null && (
                              <ReferenceLine
                                y={facilityTrendStats.avg}
                                stroke="#64748b"
                                strokeDasharray="4 4"
                                label={{ value: 'Avg', position: 'insideTopRight', fill: '#94a3b8', fontSize: 8 }}
                              />
                            )}
                            <Area 
                              type="monotone" 
                              dataKey="waitTime" 
                              stroke="#3b82f6" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorWaitSingle)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full rounded-lg flex flex-col items-center justify-center text-center">
                          <TrendingUp className="w-4 h-4 text-slate-700 mb-0.5" />
                          <p className="text-[8px] text-slate-500 italic">No trend coordinates collected yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mt-2">

                  {selectedHospital.distance !== undefined && !isWaitTimeUnavailable(selectedHospital) && (
                    <>
                      <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-1 px-1">
                        <span className="text-slate-400 font-medium">Estimated Drive Time</span>
                        <span className="font-bold text-xs text-blue-400 font-mono">
                          ~{formatMinutesToHm(selectedHospital.driveMins || 0)}
                        </span>
                      </div>
                      <div className={cn(
                        "flex justify-between items-center text-xs border-b border-slate-800/80 pb-1 px-1 rounded transition-colors",
                        sortBy !== 'raw-wait' && "bg-cyan-950/15 border-cyan-500/10"
                      )}>
                        <span className={cn("text-slate-400 font-medium", sortBy !== 'raw-wait' && "text-cyan-300 font-bold")}>
                          Total Net Treatment Time {sortBy !== 'raw-wait' && "🎯"}
                        </span>
                        <span className={cn(
                          "font-black text-xs font-mono text-cyan-400",
                          sortBy !== 'raw-wait' && "text-sm text-cyan-300"
                        )}>
                          ~{formatMinutesToHm((selectedHospital.driveMins || 0) + selectedHospital.waitTime)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between items-center text-xs border-b border-slate-800/80 pb-1 px-1">
                    <span className="text-slate-400 font-medium">Queue Severity</span>
                    <StatusBadge status={selectedHospital.status} />
                  </div>

                  {selectedHospital.note && (
                    <div className="text-[11px]">
                      <span className="text-slate-400 block mb-0.5 text-[9px]">Hours</span>
                      <div className="p-1.5 bg-slate-950/60 border border-slate-800 rounded-lg flex gap-1.5">
                        <Clock className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-[9px] text-slate-400 leading-normal truncate-2-lines">
                          {formatHospitalHours(selectedHospital.note)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 text-center my-auto">
                <div className="w-10 h-10 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center mx-auto mb-2 shadow-xl">
                  <TrendingUp className="w-5 h-5 text-slate-600" />
                </div>
                <p className="text-slate-300 font-extrabold text-xs">Select a Facility</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[180px] mx-auto">Explore live wait metrics, facility hours, directions and 24-hour trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* Main List Section */}
        <div className="space-y-6">
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-slate-900/60 p-4 rounded-3xl border border-slate-800/80 shadow-md">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search by facility or city..." 
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 md:shrink-0">
                <div className="relative w-full sm:w-44">
                  <select 
                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                  >
                    {regions.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative w-full sm:w-48">
                  <select 
                    className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'net-wait' | 'proximity' | 'raw-wait')}
                  >
                    <option value="net-wait">Sort: Net Wait (Fastest)</option>
                    <option value="proximity">Sort: Proximity (Nearest)</option>
                    <option value="raw-wait">Sort: Raw Wait Time</option>
                  </select>
                  <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Emergency & Urgent Care Centers ({filteredAndSortedHospitals.length})</h2>
              <span className="text-xs text-slate-400">
                Sorting: <span className="text-blue-400 font-semibold">
                  {sortBy === 'net-wait' 
                    ? (userLocation ? "Net Wait (Drive + Wait)" : "Wait Time (Default Location)") 
                    : sortBy === 'proximity' 
                      ? (userLocation ? "Proximity" : "Proximity (Default Location)") 
                      : "Raw Wait Time"}
                </span>
              </span>
            </div>

            {/* Hospital Grid grouped by Zone */}
            <div className="space-y-8">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : groupedZones.length > 0 ? (
                groupedZones.map(zone => (
                  <div key={zone.name} className="space-y-3">
                    {/* Zone Header with proximity badge */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <h3 className="font-extrabold text-sm text-slate-200 uppercase tracking-wider">
                          {zone.name}
                        </h3>
                      </div>
                      {userLocation && zone.distance !== 999999 && (
                        <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-[9px] font-bold">
                          ~{zone.distance} km closest
                        </span>
                      )}
                    </div>
                    
                    {/* Hospital cards for this zone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {zone.hospitals.map(hospital => (
                        <HospitalCard 
                          key={hospital.id} 
                          hospital={hospital} 
                          onClick={() => setSelectedHospital(hospital)}
                          selected={selectedHospital?.id === hospital.id}
                          sortBy={sortBy}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-16 bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl text-center text-slate-500">
                  <Info className="w-12 h-12 mx-auto mb-4 text-slate-700" />
                  <p className="text-lg font-bold text-slate-300">No facilities found</p>
                  <p className="text-sm text-slate-500 mt-1">Try adjusting your search or region filter</p>
                </div>
              )}
            </div>
          </div>



          </>
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

      <ContributionsSection />

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
                      const isAuto = meta.updateType === 'auto';
                      return (
                        <tr key={key} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 pr-4 font-bold text-white">{name}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                              isAuto 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {isAuto ? 'Auto' : 'Manual'}
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

      {/* LOCATION MODAL */}
      {showManualInput && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1226] border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <MapPin className="w-4 h-4 text-blue-400" />
                </div>
                <h2 className="text-sm font-black text-white tracking-tight">Set Your Location</h2>
              </div>
              <button
                onClick={dismissLocationPrompt}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                aria-label="Close location prompt"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* GPS button */}
              <button
                onClick={() => {
                  setGeocodingError('');
                  requestGPSLocation();
                }}
                disabled={loadingGeo}
                className="w-full py-3 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Compass className={`w-4 h-4 ${loadingGeo ? 'animate-spin' : ''}`} />
                <span className="text-sm font-black">
                  {loadingGeo ? 'Detecting location...' : 'Use my current location'}
                </span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <span className="relative px-3 bg-[#0b1226] text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  or enter your location
                </span>
              </div>

              {/* Address/postal form */}
              <form onSubmit={handleAddressSubmit} className="space-y-3">
                <div className="relative">
                  <input
                    id="manual-location-input"
                    type="text"
                    placeholder="Address or postal code (e.g. Calgary, T2P 2M5)"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    className="w-full h-11 px-4 pl-10 text-xs bg-slate-950/60 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-all font-medium"
                    autoFocus
                  />
                  <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
                </div>

                <button
                  type="submit"
                  disabled={isGeocoding || !addressInput.trim()}
                  className="w-full h-11 text-xs font-black rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-blue-600/10"
                >
                  {isGeocoding ? 'Looking up...' : 'Set Location'}
                </button>
              </form>

              {geocodingError && (
                <p className="text-[11px] text-red-400 font-medium leading-relaxed">
                  {geocodingError}
                </p>
              )}

              <p className="text-[10px] text-slate-500 leading-relaxed">
                Your location is used to estimate driving times and sort nearby hospitals. We only store it in your browser.
              </p>

              <button
                type="button"
                onClick={dismissLocationPrompt}
                className="w-full py-2.5 text-[11px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, trend, subtext }: { title: string, value: string, icon: React.ReactNode, trend: string, subtext?: string }) {
  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl">{icon}</div>
        <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">{trend}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-white tracking-tight leading-none">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{title}</p>
        {subtext && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtext}</p>}
      </div>
    </div>
  );
}

function HospitalCard({ hospital, onClick, selected, sortBy }: { hospital: Hospital, onClick: () => void, selected: boolean, sortBy?: 'net-wait' | 'proximity' | 'raw-wait', key?: any }) {
  const isUnavailable = isWaitTimeUnavailable(hospital);

  return (
    <div 
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "text-left bg-slate-900/40 p-4 rounded-2xl border transition-colors flex items-center justify-between group cursor-pointer w-full gap-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50",
        selected 
          ? "border-blue-500 bg-blue-950/25 ring-4 ring-blue-500/15 shadow-xl shadow-blue-950/40" 
          : isUnavailable
            ? "border-slate-800/40 bg-slate-900/10 opacity-60 hover:opacity-85"
            : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
      )}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-100 group-hover:text-blue-400 transition-colors break-words">
          {hospital.name}
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-medium">
          <span className="flex items-center gap-1 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-slate-500" />
            {hospital.city}
          </span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span className="truncate">{hospital.region}</span>
        </div>
        
        {/* Navigation Directions & Proximity Display */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <a
            href={`https://maps.google.com/?daddr=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md hover:bg-blue-500/20 hover:border-blue-500/40 transition-all shrink-0 cursor-pointer"
            title="Get driving directions in Google Maps"
          >
            <Navigation className="w-3 h-3" />
            <span>Directions</span>
          </a>

          {hospital.distance !== undefined && (
            <>
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-md shrink-0">
                <Compass className="w-3 h-3 animate-spin-slow" />
                <span>{hospital.distance} km away</span>
              </div>
              {!isUnavailable && hospital.driveMins !== undefined && (
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md shrink-0">
                  <Clock className="w-3 h-3" />
                  <span>~{formatMinutesToHm(hospital.driveMins)} drive</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          {hospital.distance !== undefined && !isUnavailable ? (
            sortBy === 'raw-wait' ? (
              <div className="flex flex-col items-end select-none">
                {/* Stacked Math Formula with Drive & Net as helpers */}
                <div className="flex flex-col items-end text-[10px] font-mono text-slate-400 leading-none space-y-1 pb-1 mb-1.5 border-b border-slate-800/60 w-24">
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Drive:</span>
                    <span className="font-bold text-slate-300">~{formatMinutesToHm(hospital.driveMins || 0)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Net:</span>
                    <span className="font-bold text-slate-300">{formatMinutesToHm((hospital.driveMins || 0) + hospital.waitTime)}</span>
                  </div>
                </div>
                
                {/* Primary spotlight is Wait Time */}
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Wait Time</span>
                  <p className={cn(
                    "text-xl sm:text-2xl font-black tracking-tight leading-none font-sans",
                    hospital.status === 'Red' 
                      ? "text-red-400" 
                      : hospital.status === 'Yellow' 
                        ? "text-amber-400" 
                        : "text-emerald-400"
                  )}>
                    {formatMinutesToHm(hospital.waitTime)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-end select-none">
                {/* Stacked Math Formula with Wait & Drive */}
                <div className="flex flex-col items-end text-[10px] font-mono text-slate-400 leading-none space-y-1 pb-1 mb-1.5 border-b border-slate-800/60 w-24">
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Wait:</span>
                    <span className="font-bold text-slate-300">{formatMinutesToHm(hospital.waitTime)}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">Drive:</span>
                    <span className="font-bold text-slate-300">+{formatMinutesToHm(hospital.driveMins || 0)}</span>
                  </div>
                </div>
                
                {/* Primary spotlight is Net Time */}
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-cyan-400/90 uppercase tracking-widest leading-none mb-1">Net Time</span>
                  <p className="text-xl sm:text-2xl font-black tracking-tight text-cyan-200 leading-none font-sans">
                    {formatMinutesToHm((hospital.driveMins || 0) + hospital.waitTime)}
                  </p>
                </div>
              </div>
            )
          ) : (
            <>
              <p className={cn(
                "text-lg sm:text-xl font-black tracking-tight leading-none",
                isUnavailable
                  ? "text-slate-500"
                  : hospital.status === 'Red' 
                    ? "text-red-400" 
                    : hospital.status === 'Yellow' 
                      ? "text-amber-400" 
                      : "text-emerald-400"
              )}>
                {isUnavailable ? "Unavailable" : formatMinutesToHm(hospital.waitTime)}
              </p>
              {!isUnavailable && <p className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest mt-1">Wait Time</p>}
            </>
          )}
        </div>
        <ChevronRight className={cn(
          "w-5 h-5 transition-transform duration-300",
          selected ? "translate-x-1 text-blue-400" : "text-slate-600 group-hover:text-slate-400"
        )} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    Green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    Yellow: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    Red: 'bg-red-500/10 text-red-400 border-red-500/20'
  };
  const colorClass = colors[status as keyof typeof colors] || colors.Green;
  
  return (
    <span className={cn("px-2.5 py-1 rounded-lg text-[9px] font-extrabold border uppercase tracking-wider", colorClass)}>
      {status}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800/60 flex items-center justify-between animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-44 bg-slate-800 rounded-lg" />
        <div className="h-3 w-28 bg-slate-800/60 rounded-lg" />
      </div>
      <div className="h-8 w-14 bg-slate-800 rounded-lg" />
    </div>
  );
}

function formatHospitalHours(note: string): string {
  if (!note) return '';
  
  // Clean up HTML/Entities tags first: e.g. <br>, <br/>, &lt;br&gt;, &lt;br/&gt; etc.
  let cleaned = note
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&');
  
  // Remove "Operational Advisory" (case insensitive) and optionally any trailing punctuation like colons
  cleaned = cleaned.replace(/operational\s+advisory\s*:/gi, '');
  cleaned = cleaned.replace(/operational\s+advisory/gi, '');
  
  // Trim and clean up multiple newlines/spaces
  cleaned = cleaned.trim();
  
  // If there's a leading colon or dash, remove it
  cleaned = cleaned.replace(/^[:\-\s\n]+/, '');
  
  return cleaned.trim();
}
