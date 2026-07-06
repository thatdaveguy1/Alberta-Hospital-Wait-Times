import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Clock, 
  Building2, 
  TrendingUp, 
  Info, 
  FileText, 
  AlertTriangle, 
  ArrowRight, 
  TrendingDown,
  Search,
  SlidersHorizontal,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  BarChart2,
  ListOrdered,
  HeartPulse,
  RefreshCw,
  Users,
  Home,
  MapPin,
  Calendar,
  X,
  ChevronRight,
  Sparkles,
  Award
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis,
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  ReferenceLine,
  Cell,
  Label,
  AreaChart,
  Area
} from 'recharts';
import { 
  FACILITY_FLOW_METRICS, 
  AHS_WEEKLY_ED_LOS, 
  CIHI_COMPARATORS, 
  REGIONAL_LGA_DEMAND, 
  HISTORICAL_FLOW_TIMELINES,
  FacilityFlow,
  WeeklyEDLOS,
  CIHIComparator,
  LGADemand,
  HistoricalFlowSnapshot,
  _dataMetadata as systemFlowDataMetadata
} from '../systemFlowData';
import { DataTimestamp } from './DataTimestamp';
export default function SystemFlowDashboard() {
  // Navigation Tabs
  const [subTab, setSubTab] = useState<'ranked' | 'scatterplot' | 'trends-weekly' | 'cihi-lga'>('ranked');
  // Interactive Filters
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Ranked sorting
  const [sortMetric, setSortMetric] = useState<keyof FacilityFlow>('hospitalOccupancy');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selected Hospital for deep-dive panel (defaults to Royal Alex)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('rah-edmonton');

  // Interactive Historical Quarter Selector
  const [selectedQuarter, setSelectedQuarter] = useState<string>('2026-Q1');

  // Interactive Quadrant Highlight for Scatterplot
  const [activeQuadrant, setActiveQuadrant] = useState<'all' | 'gridlock' | 'stress' | 'stable'>('all');

  // Interactive KPI selected state for historical trend panel
  const [selectedKpi, setSelectedKpi] = useState<'occupancy' | 'p90BedWaitHours' | 'lwbsRate' | 'alcRate' | null>(null);

  const kpiStats = useMemo(() => {
    if (!selectedKpi) return null;
    const values = HISTORICAL_FLOW_TIMELINES.map(t => t[selectedKpi] as number).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    const baseline = values[0];
    const latest = values[values.length - 1];
    const peak = Math.max(...values);
    const minVal = Math.min(...values);
    const rawDelta = latest - baseline;
    const pctChange = baseline !== 0 ? (rawDelta / baseline) * 100 : 0;

    return {
      baseline: baseline.toFixed(1),
      latest: latest.toFixed(1),
      peak: peak.toFixed(1),
      minVal: minVal.toFixed(1),
      delta: rawDelta > 0 ? `+${rawDelta.toFixed(1)}` : rawDelta.toFixed(1),
      pctChange: pctChange > 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`,
      isIncrease: rawDelta > 0
    };
  }, [selectedKpi]);

  const selectedKpiDetails = useMemo(() => {
    if (!selectedKpi) return null;
    switch (selectedKpi) {
      case 'occupancy':
        return {
          label: 'Provincial Bed Occupancy',
          description: 'Long-term trend of acute inpatient bed utilization across all provincial hospitals. Occupancies exceeding 100% represent critical boarding states where patients are held in hallways, transition spaces, or emergency wards.',
          colorClass: 'text-rose-500',
          bgClass: 'bg-rose-500/10',
          strokeColor: '#f43f5e',
          gradientId: 'colorOccupancyTrend',
          unit: '%',
          icon: Building2
        };
      case 'p90BedWaitHours':
        return {
          label: 'Average ED Bed Wait (P90)',
          description: 'Historical tracking of the 90th percentile wait times from a decision-to-admit to actual ward bed placement. Rising wait times signal severe inpatient bed gridlock.',
          colorClass: 'text-amber-500',
          bgClass: 'bg-amber-500/10',
          strokeColor: '#f59e0b',
          gradientId: 'colorWaitTrend',
          unit: 'h',
          icon: Clock
        };
      case 'lwbsRate':
        return {
          label: 'Left Without Being Seen (LWBS)',
          description: 'Percentage of patients registered in the emergency department who choose to self-discharge before receiving a medical assessment. High walkout rates correlate strongly with wait times.',
          colorClass: 'text-blue-400',
          bgClass: 'bg-blue-500/10',
          strokeColor: '#3b82f6',
          gradientId: 'colorLwbsTrend',
          unit: '%',
          icon: Activity
        };
      case 'alcRate':
        return {
          label: 'Alternate Level of Care (ALC) Rate',
          description: 'Percentage of acute inpatient beds occupied by patients who no longer require acute clinical services but are waiting for continuing care, rehabilitation, or supportive living placement.',
          colorClass: 'text-violet-400',
          bgClass: 'bg-violet-500/10',
          strokeColor: '#a78bfa',
          gradientId: 'colorAlcTrend',
          unit: '%',
          icon: Layers
        };
      default:
        return null;
    }
  }, [selectedKpi]);
  // Computed Provincial Core Metrics
  const provincialOverview = useMemo(() => {
    const facilities = FACILITY_FLOW_METRICS;
    const totalBeds = facilities.reduce((sum, f) => sum + f.staffedAcuteBeds, 0);
    const avgOccupancy = facilities.reduce((sum, f) => sum + (f.hospitalOccupancy * f.staffedAcuteBeds), 0) / totalBeds;
    const avgAlc = facilities.reduce((sum, f) => sum + f.alcRate, 0) / facilities.length;
    const avgLwbs = facilities.reduce((sum, f) => sum + f.lwbsRate, 0) / facilities.length;
    const avgP90Wait = facilities.reduce((sum, f) => sum + f.p90BedWait, 0) / facilities.length;
    const totalVolume = facilities.reduce((sum, f) => sum + f.edDailyVolume, 0);

    return {
      avgOccupancy: parseFloat(avgOccupancy.toFixed(1)),
      avgAlc: parseFloat(avgAlc.toFixed(1)),
      avgLwbs: parseFloat(avgLwbs.toFixed(1)),
      avgP90Wait: parseFloat(avgP90Wait.toFixed(1)),
      totalBeds,
      totalVolume
    };
  }, []);

  // Filter & Search Facilities
  const filteredFacilities = useMemo(() => {
    return FACILITY_FLOW_METRICS.filter(fac => {
      const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
      const matchesType = selectedType === 'All' || 
        (selectedType === 'Metro' && fac.type === 'Metro') ||
        (selectedType === 'Regional' && fac.type === 'Regional') ||
        (selectedType === 'Community' && fac.type === 'Community') ||
        (selectedType === 'Specialty' && fac.type === 'Childrens');
      
      const matchesSearch = fac.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            fac.city.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesZone && matchesType && matchesSearch;
    });
  }, [selectedZone, selectedType, searchQuery]);

  // Sorted Facilities
  const sortedFacilities = useMemo(() => {
    return [...filteredFacilities].sort((a, b) => {
      const valA = a[sortMetric] as number;
      const valB = b[sortMetric] as number;
      if (valA < valB) return sortDirection === 'desc' ? 1 : -1;
      if (valA > valB) return sortDirection === 'desc' ? -1 : 1;
      return 0;
    });
  }, [filteredFacilities, sortMetric, sortDirection]);

  // Selected Hospital Details
  const selectedHospital = useMemo(() => {
    return FACILITY_FLOW_METRICS.find(f => f.id === selectedHospitalId) || FACILITY_FLOW_METRICS[0];
  }, [selectedHospitalId]);

  // Regional comparisons for selected hospital
  const selectedHospitalZoneAvg = useMemo(() => {
    const zoneFacilities = FACILITY_FLOW_METRICS.filter(f => f.zone === selectedHospital.zone);
    const avgOccupancy = zoneFacilities.reduce((sum, f) => sum + f.hospitalOccupancy, 0) / zoneFacilities.length;
    const avgWait = zoneFacilities.reduce((sum, f) => sum + f.p90BedWait, 0) / zoneFacilities.length;
    const avgLwbs = zoneFacilities.reduce((sum, f) => sum + f.lwbsRate, 0) / zoneFacilities.length;
    const avgAlc = zoneFacilities.reduce((sum, f) => sum + f.alcRate, 0) / zoneFacilities.length;

    return {
      occupancy: parseFloat(avgOccupancy.toFixed(1)),
      p90Wait: parseFloat(avgWait.toFixed(1)),
      lwbs: parseFloat(avgLwbs.toFixed(1)),
      alc: parseFloat(avgAlc.toFixed(1))
    };
  }, [selectedHospital]);

  // Zone statistics
  const zoneAverages = useMemo(() => {
    const zones = ['Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'];
    return zones.map(zoneName => {
      const facilitiesInZone = FACILITY_FLOW_METRICS.filter(f => f.zone === zoneName);
      if (facilitiesInZone.length === 0) return null;
      const totalBeds = facilitiesInZone.reduce((sum, f) => sum + f.staffedAcuteBeds, 0);
      const avgOccupancy = facilitiesInZone.reduce((sum, f) => sum + f.hospitalOccupancy, 0) / facilitiesInZone.length;
      const avgBedWait = facilitiesInZone.reduce((sum, f) => sum + f.p90BedWait, 0) / facilitiesInZone.length;
      const avgLwbs = facilitiesInZone.reduce((sum, f) => sum + f.lwbsRate, 0) / facilitiesInZone.length;
      const totalVolume = facilitiesInZone.reduce((sum, f) => sum + f.edDailyVolume, 0);
      
      return {
        zone: zoneName,
        facilityCount: facilitiesInZone.length,
        totalBeds,
        totalVolume,
        avgOccupancy: parseFloat(avgOccupancy.toFixed(1)),
        avgBedWait: parseFloat(avgBedWait.toFixed(1)),
        avgLwbs: parseFloat(avgLwbs.toFixed(1))
      };
    }).filter(Boolean);
  }, []);

  const handleSort = (metric: keyof FacilityFlow) => {
    if (sortMetric === metric) {
      setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortMetric(metric);
      setSortDirection('desc');
    }
  };

  // Scatter plot data mapping
  const scatterData = useMemo(() => {
    return FACILITY_FLOW_METRICS.map(f => ({
      id: f.id,
      name: f.name,
      x: f.hospitalOccupancy,            // Hospital Occupancy (%)
      y: f.p90BedWait,                  // 90th percentile wait for bed (hours)
      z: f.avgHourlyAdmittedWaiting,     // Bubble size representing patients waiting
      zone: f.zone,
      city: f.city,
      lwbs: f.lwbsRate,
      type: f.type
    }));
  }, []);

  // Filtered scatter plot based on highlighted quadrant
  const filteredScatterData = useMemo(() => {
    return scatterData.filter(d => {
      const isGridlock = d.x >= 100 && d.y >= 24;
      const isStress = (d.x >= 95 && d.x < 100) || (d.y >= 12 && d.y < 24);
      const isStable = d.x < 95 && d.y < 12;

      if (activeQuadrant === 'gridlock') return isGridlock;
      if (activeQuadrant === 'stress') return isStress && !isGridlock;
      if (activeQuadrant === 'stable') return isStable;
      return true;
    });
  }, [scatterData, activeQuadrant]);

  // Selected Quarter snapshot
  const activeQuarterSnapshot = useMemo(() => {
    return HISTORICAL_FLOW_TIMELINES.find(q => q.quarter === selectedQuarter) || HISTORICAL_FLOW_TIMELINES[HISTORICAL_FLOW_TIMELINES.length - 1];
  }, [selectedQuarter]);

  return (
    <div id="system-flow-dashboard-root" className="space-y-6 text-slate-100 font-sans">
      
      {/* Standardized Tab bar header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            <span>Hospital System Flow</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor occupancy, average ED wait times, and alternate level of care bottlenecks.
          </p>
          <DataTimestamp metadata={systemFlowDataMetadata} arrayKey="FACILITY_FLOW_METRICS" />
        </div>
      </div>

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">

        <button
          onClick={() => setSubTab('ranked')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'ranked'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Hospital Flow Grid</span>
        </button>

        <button
          onClick={() => setSubTab('scatterplot')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'scatterplot'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Bottleneck Correlation</span>
        </button>

        <button
          onClick={() => setSubTab('trends-weekly')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'trends-weekly'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Historical Degradation</span>
        </button>

        <button
          onClick={() => setSubTab('cihi-lga')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            subTab === 'cihi-lga'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Benchmarks & Profiles</span>
        </button>
      </div>

      {/* Dynamic Key Performance Indicators (SURFACING PROVINCIAL METRICS DYNAMICALLY) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div
          id="metric-prov-occupancy"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedKpi(selectedKpi === 'occupancy' ? null : 'occupancy')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'occupancy' ? null : 'occupancy');
            }
          }}
          className={`p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 border select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedKpi === 'occupancy'
              ? 'bg-slate-900/90 border-rose-500/50 ring-1 ring-rose-500/30 shadow-rose-500/5'
              : 'bg-slate-900/60 border-slate-800 hover:border-rose-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Provincial Bed Occupancy</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-500 font-mono">{provincialOverview.avgOccupancy}%</span>
              <span className="text-[10px] text-rose-400/80 font-bold font-mono">CRITICAL STATE</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Weighted across {provincialOverview.totalBeds} active acute beds</span>
            <span className="text-[9px] text-slate-500 group-hover:text-rose-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedKpi === 'occupancy' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 shrink-0 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-rose-500 to-rose-600 rounded-bl" />
        </div>

        {/* Metric 2 */}
        <div
          id="metric-mean-bedwait"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedKpi(selectedKpi === 'p90BedWaitHours' ? null : 'p90BedWaitHours')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'p90BedWaitHours' ? null : 'p90BedWaitHours');
            }
          }}
          className={`p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 border select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedKpi === 'p90BedWaitHours'
              ? 'bg-slate-900/90 border-amber-500/50 ring-1 ring-amber-500/30 shadow-amber-500/5'
              : 'bg-slate-900/60 border-slate-800 hover:border-amber-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Average ED Bed Wait (P90)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-500 font-mono">{provincialOverview.avgP90Wait}h</span>
              <span className="text-[10px] text-amber-400 font-bold font-mono">+12.4h since 2021</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">From decision-to-admit to ward placement</span>
            <span className="text-[9px] text-slate-500 group-hover:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedKpi === 'p90BedWaitHours' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
            <Clock className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-amber-500 to-amber-600 rounded-bl" />
        </div>

        {/* Metric 3 */}
        <div
          id="metric-mean-lwbs"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedKpi(selectedKpi === 'lwbsRate' ? null : 'lwbsRate')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'lwbsRate' ? null : 'lwbsRate');
            }
          }}
          className={`p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 border select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedKpi === 'lwbsRate'
              ? 'bg-slate-900/90 border-blue-500/50 ring-1 ring-blue-500/30 shadow-blue-500/5'
              : 'bg-slate-900/60 border-slate-800 hover:border-blue-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Left Without Being Seen</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-400 font-mono">{provincialOverview.avgLwbs}%</span>
              <span className="text-[10px] text-blue-400/80 font-bold font-mono">HIGH RISK</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Provincial average self-discharge rate</span>
            <span className="text-[9px] text-slate-500 group-hover:text-blue-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedKpi === 'lwbsRate' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
            <Activity className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-blue-500 to-blue-600 rounded-bl" />
        </div>

        {/* Metric 4 */}
        <div
          id="metric-mean-alc"
          role="button"
          tabIndex={0}
          onClick={() => setSelectedKpi(selectedKpi === 'alcRate' ? null : 'alcRate')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSelectedKpi(selectedKpi === 'alcRate' ? null : 'alcRate');
            }
          }}
          className={`p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden group cursor-pointer transition-all duration-300 border select-none hover:scale-[1.02] hover:shadow-xl ${
            selectedKpi === 'alcRate'
              ? 'bg-slate-900/90 border-violet-500/50 ring-1 ring-violet-500/30 shadow-violet-500/5'
              : 'bg-slate-900/60 border-slate-800 hover:border-violet-500/30'
          }`}
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Alternate Level of Care (ALC)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-violet-400 font-mono">{provincialOverview.avgAlc}%</span>
              <span className="text-[10px] text-violet-400 font-bold font-mono">DISCHARGE BLOCKED</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Inpatient acute bed-days occupied by non-acute cases</span>
            <span className="text-[9px] text-slate-500 group-hover:text-violet-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-1.5 transition-colors">
              <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
              {selectedKpi === 'alcRate' ? 'Active: Hide Trend' : 'Click to View Trend'}
            </span>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10 text-violet-500 shrink-0 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
            <Layers className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-violet-500 to-violet-600 rounded-bl" />
        </div>
      </div>

      {/* KPI Trend Explorer Panel */}
      <AnimatePresence mode="wait">
        {selectedKpi && selectedKpiDetails && kpiStats && (
          <motion.div
            key={`kpi-trend-${selectedKpi}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-6 shadow-xl relative">
              {/* Close Button */}
              <button
                onClick={() => setSelectedKpi(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title="Close panel"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title and description */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                    {React.createElement(selectedKpiDetails.icon, {
                      className: `w-4 h-4 ${selectedKpiDetails.colorClass}`
                    })}
                    <span>{selectedKpiDetails.label} Historical Trend Explorer</span>
                  </h3>
                  <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
                    {selectedKpiDetails.description}
                  </p>
                </div>
              </div>

              {/* Stats highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-900">
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Baseline (Q1 2021)</span>
                  <span className="text-xl font-black text-slate-300 font-mono">{kpiStats.baseline}{selectedKpiDetails.unit}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current (Q1 2026)</span>
                  <span className="text-xl font-black text-white font-mono">{kpiStats.latest}{selectedKpiDetails.unit}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5-Year Peak</span>
                  <span className={`text-xl font-black font-mono ${selectedKpiDetails.colorClass}`}>{kpiStats.peak}{selectedKpiDetails.unit}</span>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Overall Shift</span>
                  <span className={`text-xl font-black font-mono flex items-center justify-center sm:justify-start gap-1 ${
                    kpiStats.isIncrease ? 'text-rose-500' : 'text-emerald-500'
                  }`}>
                    {kpiStats.isIncrease ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                    <span>{kpiStats.delta}{selectedKpiDetails.unit} ({kpiStats.pctChange})</span>
                  </span>
                </div>
              </div>

              {/* Chart container */}
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={HISTORICAL_FLOW_TIMELINES} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={selectedKpiDetails.gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={selectedKpiDetails.strokeColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="quarter" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis 
                      stroke="#64748b" 
                      style={{ fontSize: 10, fontFamily: 'monospace' }}
                      domain={['auto', 'auto']}
                    />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                      labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey={selectedKpi} 
                      name={selectedKpiDetails.label} 
                      stroke={selectedKpiDetails.strokeColor} 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill={`url(#${selectedKpiDetails.gradientId})`} 
                      dot={{ r: 4, strokeWidth: 1 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* ---------------- SUB-TAB 2: HOSPITAL GRID & DEEP DIVE ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'ranked' && (
          <motion.div
            key="ranked-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Interactive Search & Filter Toolbar */}
            <div className="p-4 rounded-xl bg-[#090e21] border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-black uppercase tracking-wider shrink-0">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
                  <span>Interactive Filters:</span>
                </div>
                
                {/* Zone Filter */}
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="All">All Health Zones (Entire Alberta)</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>

                {/* Hospital Type Filter */}
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="All">All Facility Types</option>
                  <option value="Metro">Metro Trauma Centers</option>
                  <option value="Regional">Regional Hubs</option>
                  <option value="Community">Community / Rural Hospitals</option>
                  <option value="Specialty">Children's / Specialty</option>
                </select>
              </div>

              {/* Text Search */}
              <div className="relative w-full md:w-72 shrink-0">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search hospital or city name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Split Grid: Hospital list (left 60%) + Deep-Dive Profiler (right 40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Sorted Hospitals Grid */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/40 p-3 rounded-lg border border-slate-850/80">
                  <div className="text-xs font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-blue-500" />
                    <span>Hospitals Matching Filters ({sortedFacilities.length})</span>
                  </div>
                  
                  {/* Sorting dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Sort Key:</span>
                    <select
                      value={sortMetric}
                      onChange={(e) => handleSort(e.target.value as keyof FacilityFlow)}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono focus:outline-none"
                    >
                      <option value="hospitalOccupancy">Inpatient Occupancy</option>
                      <option value="p90BedWait">ED Bed Wait (P90)</option>
                      <option value="lwbsRate">Walkout (LWBS) Rate</option>
                      <option value="avgHourlyAdmittedWaiting">Hourly Admitted Boarders</option>
                      <option value="alcRate">Inpatient ALC %</option>
                      <option value="edDailyVolume">ED Daily Intake</option>
                      <option value="returnedWithin72h">72h Return %</option>
                    </select>
                  </div>
                </div>

                {/* Table Container */}
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#090e21] shadow-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 border-b border-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-400">
                        <th className="p-3 text-center w-10">Select</th>
                        <th className="p-3 min-w-[180px]">Hospital / Health Area</th>
                        <th className="p-3 text-center">Daily visits</th>
                        <th className="p-3 text-center">Occupancy</th>
                        <th className="p-3 text-center">P90 Bed Wait</th>
                        <th className="p-3 text-center">LWBS %</th>
                        <th className="p-3 text-center">ALC %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/50 font-mono text-xs">
                      {sortedFacilities.map((fac, idx) => {
                        const isSelected = fac.id === selectedHospitalId;
                        const isCrisisOccupancy = fac.hospitalOccupancy >= 104;
                        const isHighOccupancy = fac.hospitalOccupancy >= 100 && fac.hospitalOccupancy < 104;
                        
                        return (
                          <tr 
                            key={fac.id} 
                            onClick={() => setSelectedHospitalId(fac.id)}
                            className={`group hover:bg-slate-900/40 transition-all cursor-pointer ${
                              isSelected ? 'bg-slate-900/70 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input 
                                type="radio" 
                                checked={isSelected} 
                                onChange={() => setSelectedHospitalId(fac.id)}
                                className="cursor-pointer accent-blue-500"
                              />
                            </td>
                            <td className="p-3 font-sans">
                              <div className="font-extrabold text-slate-100 group-hover:text-blue-400 transition-colors">{fac.name}</div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="px-1 py-0.2 bg-slate-950 border border-slate-800 text-slate-400 text-[8px] font-black font-mono rounded uppercase">
                                  {fac.zone.replace(' Zone', '')}
                                </span>
                                <span>{fac.city}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-300">
                              {fac.edDailyVolume}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-black ${isCrisisOccupancy ? 'text-red-400' : isHighOccupancy ? 'text-amber-500' : 'text-emerald-400'}`}>
                                {fac.hospitalOccupancy}%
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-slate-200">
                              {fac.p90BedWait}h
                            </td>
                            <td className="p-3 text-center font-black text-rose-400/90">
                              {fac.lwbsRate}%
                            </td>
                            <td className="p-3 text-center font-bold text-violet-400">
                              {fac.alcRate}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {sortedFacilities.length === 0 && (
                    <div className="p-8 text-center text-slate-500 font-sans">
                      No facilities match the active filter criteria. Check your filters above.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Hospital Deep-Dive Profile */}
              <div className="lg:col-span-5">
                <div className="p-6 rounded-2xl bg-gradient-to-b from-[#0a1027] to-[#070b1c] border border-slate-800 shadow-2xl sticky top-4 space-y-6">
                  
                  {/* Deep Dive Header */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/20 tracking-widest">
                        Selected Facility Profile
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {selectedHospital.city}, AB
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                        <HeartPulse className="w-5 h-5 text-rose-500" />
                        {selectedHospital.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                        {selectedHospital.zone} • {selectedHospital.type === 'Childrens' ? "Specialty Pediatrics" : `${selectedHospital.type} Trauma Hospital`}
                      </p>
                    </div>
                  </div>

                  {/* Flow KPIs Segment */}
                  <div className="grid grid-cols-2 gap-3">
                    
                    {/* Bed Capacity Block */}
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Staffed Beds &amp; ICU</span>
                      <div className="text-sm font-extrabold text-slate-200 font-mono">
                        {selectedHospital.staffedAcuteBeds} <span className="text-[10px] text-slate-500 font-normal">Acute</span>
                      </div>
                      <span className="text-[9px] text-slate-400 block font-mono">
                        ICU: {selectedHospital.icuBedsOpen} beds ({selectedHospital.icuOccupancy}% occupied)
                      </span>
                    </div>

                    {/* Left unseen Walkout Block */}
                    <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">ED Walkout (LWBS)</span>
                      <div className="text-sm font-black text-rose-400 font-mono">
                        {selectedHospital.lwbsRate}%
                      </div>
                      <div className="text-[9px] text-slate-400 block">
                        72h return: <strong className="text-white">{selectedHospital.returnedWithin72h}%</strong>
                      </div>
                    </div>

                  </div>

                  {/* Dynamic Benchmarking visual comparator (Surfacing *all* available variables!) */}
                  <div className="space-y-3 p-4 bg-slate-950/50 rounded-xl border border-slate-850">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                      <span>Metric Comparison vs Zone Average</span>
                    </h4>

                    <div className="space-y-2.5 text-xs">
                      
                      {/* Comparison 1: Occupancy */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">Hospital Occupancy</span>
                          <span className="text-slate-200">{selectedHospital.hospitalOccupancy}% <span className="text-slate-500">vs</span> {selectedHospitalZoneAvg.occupancy}% <span className="text-slate-500">(Avg)</span></span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
                          <div className="bg-rose-500 h-full rounded-l" style={{ width: `${Math.min(100, (selectedHospital.hospitalOccupancy / 115) * 100)}%` }} />
                          <div className="bg-slate-800 h-full rounded-r" style={{ width: `${Math.max(5, 100 - (selectedHospital.hospitalOccupancy / 115) * 100)}%` }} />
                        </div>
                      </div>

                      {/* Comparison 2: Bed Wait */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">90th Percentile Bed Wait</span>
                          <span className="text-slate-200">{selectedHospital.p90BedWait}h <span className="text-slate-500">vs</span> {selectedHospitalZoneAvg.p90Wait}h <span className="text-slate-500">(Avg)</span></span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
                          <div className="bg-amber-500 h-full rounded-l" style={{ width: `${Math.min(100, (selectedHospital.p90BedWait / 55) * 100)}%` }} />
                          <div className="bg-slate-800 h-full rounded-r" style={{ width: `${Math.max(5, 100 - (selectedHospital.p90BedWait / 55) * 100)}%` }} />
                        </div>
                      </div>

                      {/* Comparison 3: ALC Rate */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[10px]">
                          <span className="text-slate-400">Inpatient ALC Rate</span>
                          <span className="text-slate-200">{selectedHospital.alcRate}% <span className="text-slate-500">vs</span> {selectedHospitalZoneAvg.alc}% <span className="text-slate-500">(Avg)</span></span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden flex">
                          <div className="bg-violet-500 h-full rounded-l" style={{ width: `${Math.min(100, (selectedHospital.alcRate / 30) * 100)}%` }} />
                          <div className="bg-slate-800 h-full rounded-r" style={{ width: `${Math.max(5, 100 - (selectedHospital.alcRate / 30) * 100)}%` }} />
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Flow Timelines Detail (Median vs P90) */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 space-y-3">
                    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block font-mono">ED Length of Stay Parameter Detail</span>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      
                      <div className="space-y-1.5 border-r border-slate-850 pr-2">
                        <span className="text-[10px] text-slate-400 font-sans block font-semibold">Discharged Patients:</span>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Median LOS:</span>
                          <span className="text-slate-200 font-bold">{selectedHospital.medianLosDischarged} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">90th Pct:</span>
                          <span className="text-slate-200 font-black">{selectedHospital.p90LosDischarged} hrs</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pl-2">
                        <span className="text-[10px] text-slate-400 font-sans block font-semibold">Admitted Patients:</span>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Median LOS:</span>
                          <span className="text-slate-200 font-bold">{selectedHospital.medianLosAdmitted} hrs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">90th Pct:</span>
                          <span className="text-slate-200 font-black">{selectedHospital.p90LosAdmitted} hrs</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Programmatic Clinically Sound Flow Narrative Analysis */}
                  <div className="p-4 rounded-xl bg-blue-950/15 border border-blue-900/30 text-xs text-blue-200 leading-relaxed space-y-2">
                    <span className="font-extrabold text-white uppercase tracking-wider flex items-center gap-1 font-mono text-[10px]">
                      <Info className="w-3.5 h-3.5 text-blue-400" />
                      Clinical Flow Assessment
                    </span>
                    <p className="font-medium text-slate-300">
                      With an emergency daily volume of <strong className="text-white">{selectedHospital.edDailyVolume} visits</strong> and acute wards operating at <strong className="text-white">{selectedHospital.hospitalOccupancy}%</strong> capacity, {selectedHospital.name} is in a state of severe flow failure. Admitted patients board in hallway stretchers for <strong className="text-white">{selectedHospital.p90BedWait} hours</strong> (90th percentile) before an inpatient bed opens, with an average of <strong className="text-white">{selectedHospital.avgHourlyAdmittedWaiting} boarding patients</strong> held in active ED rooms at any given hour. This front-end backup is directly driven by an Alternate Level of Care (ALC) rate of <strong className="text-white">{selectedHospital.alcRate}%</strong>, which reveals that nearly 1 in 5 acute care beds is locked by convalescing patients waiting for continuing care placement (of which only <strong className="text-white">{selectedHospital.continuingCare30DayPlacements}%</strong> secure placements within 30 days).
                    </p>
                  </div>

                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- SUB-TAB 3: BOTTLE-NECK SCATTERPLOT ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'scatterplot' && (
          <motion.div
            key="scatterplot-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Quadrant filter / highlighting buttons */}
            <div className="p-4 rounded-xl bg-[#090e21] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block font-mono">Correlation Visualizer Highlights</span>
                <p className="text-xs text-slate-300">Highlight hospitals based on quadrant risk profiles:</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setActiveQuadrant('all')}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    activeQuadrant === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  All ({scatterData.length})
                </button>
                <button 
                  onClick={() => setActiveQuadrant('gridlock')}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                    activeQuadrant === 'gridlock' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-slate-900 text-slate-400 hover:text-white border-transparent'
                  }`}
                >
                  Gridlock Quadrant ({scatterData.filter(d => d.x >= 100 && d.y >= 24).length})
                </button>
                <button 
                  onClick={() => setActiveQuadrant('stress')}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                    activeQuadrant === 'stress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 text-slate-400 hover:text-white border-transparent'
                  }`}
                >
                  High Stress Quadrant ({scatterData.filter(d => (d.x >= 95 && d.x < 100) || (d.y >= 12 && d.y < 24)).length})
                </button>
                <button 
                  onClick={() => setActiveQuadrant('stable')}
                  className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider cursor-pointer border ${
                    activeQuadrant === 'stable' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-900 text-slate-400 hover:text-white border-transparent'
                  }`}
                >
                  Optimal Quadrant ({scatterData.filter(d => d.x < 95 && d.y < 12).length})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Scatterplot Canvas (left 70%) */}
              <div className="lg:col-span-8 p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4 text-rose-500" />
                    <span>Acute Inpatient-to-ED Bottleneck Correlation</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    This chart plots <strong>Hospital Occupancy % (X-axis)</strong> versus <strong>90th percentile Bed Wait Hours in the ED (Y-axis)</strong>. Bubble size represents the <strong>average hourly count of admitted patients stuck boarding in the ED</strong>. Hover or click on a node to load that hospital.
                  </p>
                </div>

                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis 
                        type="number" 
                        dataKey="x" 
                        name="Hospital Occupancy" 
                        unit="%" 
                        domain={[90, 112]} 
                        stroke="#64748b" 
                        style={{ fontSize: 11, fontFamily: 'monospace' }}
                      >
                        <Label value="Hospital Occupancy Rate (%)" offset={-10} position="insideBottom" fill="#94a3b8" fontSize={11} fontStyle="bold" />
                      </XAxis>
                      <YAxis 
                        type="number" 
                        dataKey="y" 
                        name="p90 Bed Wait Time" 
                        unit=" hrs" 
                        domain={[0, 65]} 
                        stroke="#64748b"
                        style={{ fontSize: 11, fontFamily: 'monospace' }}
                      >
                        <Label value="90th percentile Bed Wait (Hours)" angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} fill="#94a3b8" fontSize={11} fontStyle="bold" />
                      </YAxis>
                      <ZAxis type="number" dataKey="z" range={[100, 1200]} name="ED Boarders" />
                      <RechartsTooltip 
                        cursor={{ strokeDasharray: '3 3', stroke: '#3b82f6' }} 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-4 bg-[#050814] border border-slate-800 rounded-xl space-y-2 text-xs font-sans shadow-2xl">
                                <div className="font-extrabold text-white text-sm">{data.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-black">{data.zone} ({data.city})</div>
                                <div className="h-px bg-slate-850"></div>
                                <div className="space-y-1 font-mono text-[11px]">
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Hospital Occupancy:</span>
                                    <span className="text-rose-400 font-bold">{data.x}%</span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">p90 Wait for Bed:</span>
                                    <span className="text-amber-500 font-bold">{data.y} hours</span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Avg Boarding Patients:</span>
                                    <span className="text-blue-400 font-bold">{data.z} per hour</span>
                                  </div>
                                  <div className="flex justify-between gap-6">
                                    <span className="text-slate-400">Left Without Being Seen:</span>
                                    <span className="text-yellow-500 font-bold">{data.lwbs}%</span>
                                  </div>
                                </div>
                                <div className="text-[9px] text-slate-500 italic mt-1 pt-1 border-t border-slate-850">Click bubble to inspect hospital profile</div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Quadrant Lines (Crisis threshold lines) */}
                      <ReferenceLine x={100} stroke="#ef4444" strokeWidth={1} strokeDasharray="5 5">
                        <Label value="Beds Full (100%)" position="top" fill="#ef4444" fontSize={10} fontStyle="bold" />
                      </ReferenceLine>
                      <ReferenceLine y={24} stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5">
                        <Label value="Crisis Wait (24 hrs)" position="right" fill="#f59e0b" fontSize={10} fontStyle="bold" />
                      </ReferenceLine>
                      
                      <Scatter 
                        name="Facilities" 
                        data={filteredScatterData}
                        onClick={(node) => setSelectedHospitalId(node.id)}
                      >
                        {filteredScatterData.map((entry, index) => {
                          const isCrisis = entry.x >= 100 && entry.y >= 24;
                          const isSelected = entry.id === selectedHospitalId;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isCrisis ? '#ef4444' : '#3b82f6'} 
                              fillOpacity={isSelected ? 0.95 : 0.65}
                              stroke={isSelected ? '#fff' : isCrisis ? '#f87171' : '#60a5fa'}
                              strokeWidth={isSelected ? 3 : 1.5}
                              className="cursor-pointer transition-all duration-300 hover:scale-125"
                            />
                          );
                        })}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quadrant Explainer Panel (right 30%) */}
              <div className="lg:col-span-4 space-y-4">
                
                {/* Visual Quad Explainer Card */}
                <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block font-mono">
                    System Correlation Rules
                  </span>
                  <div className="space-y-4 text-xs">
                    
                    {/* Quad 1 */}
                    <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1.5">
                      <h4 className="font-extrabold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-red-500"></span>
                        Gridlock Quadrant (Crisis)
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        Hospitals operating above 100% occupancy with decision-to-admit waits exceeding 24 hours. Represents severe inpatient backup where flow is completely suspended.
                      </p>
                    </div>

                    {/* Quad 2 */}
                    <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1.5">
                      <h4 className="font-extrabold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                        Stress Quadrant (At Risk)
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        Ward occupancies between 95% and 100% or bed wait times rising between 12 and 24 hours. Inpatient ward buffers are exhausted and boarding holds are active.
                      </p>
                    </div>

                    {/* Quad 3 */}
                    <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl space-y-1.5">
                      <h4 className="font-extrabold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                        Stable Quadrant (Optimal)
                      </h4>
                      <p className="text-slate-300 leading-relaxed">
                        Ward occupancies under 95% and bed wait times safely under 12 hours. Circulation is unhindered; emergency departments can quickly offload incoming ambulances.
                      </p>
                    </div>

                  </div>
                </div>

                {/* Selected Hospital Highlight Card */}
                {selectedHospital && (
                  <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-[#090e21] border border-slate-800 shadow-xl space-y-3">
                    <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider font-mono block">Active Selected Node</span>
                    <h4 className="text-sm font-black text-white">{selectedHospital.name}</h4>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-300">
                      <div>Occupancy: <strong className="text-white">{selectedHospital.hospitalOccupancy}%</strong></div>
                      <div>P90 Bed Wait: <strong className="text-white">{selectedHospital.p90BedWait} hrs</strong></div>
                      <div>Admitted Boarders: <strong className="text-white">{selectedHospital.avgHourlyAdmittedWaiting}</strong></div>
                      <div>Walkouts (LWBS): <strong className="text-rose-400">{selectedHospital.lwbsRate}%</strong></div>
                    </div>
                    <button 
                      onClick={() => setSubTab('ranked')}
                      className="w-full mt-2 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-bold uppercase rounded-lg text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Open Detailed Flow Profile</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- SUB-TAB 4: HISTORICAL DEGRADATION TRACKER ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'trends-weekly' && (
          <motion.div
            key="trends-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Historical Degradation Chart Panel (left 60%) */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span>Historical System Degradation Analysis (2021 - 2026)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Long-run quarters compiled from HQA FOCUS datasets illustrate how climbing occupancies trigger non-linear bed wait spikes.
                </p>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={HISTORICAL_FLOW_TIMELINES} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorWait" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="quarter" stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#050814', borderColor: '#1e293b', borderRadius: 8 }}
                      labelStyle={{ fontWeight: 'black', color: '#fff', fontSize: 11 }}
                      itemStyle={{ fontSize: 11, fontFamily: 'monospace' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    
                    {/* Area 1: Occupancy */}
                    <Area type="monotone" dataKey="occupancy" name="Occupancy Rate %" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOccupancy)" dot={{ r: 3 }} />
                    
                    {/* Area 2: Bed Wait */}
                    <Area type="monotone" dataKey="p90BedWaitHours" name="ED Bed Wait (hrs)" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorWait)" dot={{ r: 3 }} />
                    
                    {/* Line 3: ALC */}
                    <Line type="monotone" dataKey="alcRate" name="ALC %" stroke="#a78bfa" strokeWidth={1.5} dot={{ r: 2 }} />
                    
                    {/* Line 4: LWBS */}
                    <Line type="monotone" dataKey="lwbsRate" name="LWBS Rate %" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 text-xs text-slate-300 leading-relaxed">
                <strong>Non-linear Degradation Mechanics:</strong> Between Q1 2021 and Q1 2026, hospital occupancies escalated from <strong>94.2% to 107.5%</strong>. This nominal +13.3% capacity rise precipitated a massive <strong>95.9% expansion</strong> in decisions-to-admit waiting times (from 24.5 hours to 48.0 hours).
              </div>
            </div>

            {/* Quarter Explorer Sidebar (right 40%) */}
            <div className="lg:col-span-5 space-y-4">
              
              {/* Quarterly Executive Selector Grid */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 space-y-3.5 shadow-xl">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider block font-mono">Quarterly Scenario Selector</span>
                  <p className="text-xs text-slate-400">Click a quarter timeline below to view provincial capacity briefs:</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {HISTORICAL_FLOW_TIMELINES.map((timeline) => (
                    <button
                      key={timeline.quarter}
                      onClick={() => setSelectedQuarter(timeline.quarter)}
                      className={`py-2 text-[10px] font-mono font-bold rounded border uppercase cursor-pointer transition-all ${
                        selectedQuarter === timeline.quarter
                          ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      {timeline.quarter}
                    </button>
                  ))}
                </div>

                {/* Selected Quarter Briefing */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-850 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <span className="text-xs font-black text-white font-mono uppercase">{activeQuarterSnapshot.quarter} Snapshot</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                      activeQuarterSnapshot.occupancy >= 105 ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {activeQuarterSnapshot.occupancy >= 105 ? 'CRISIS STATE' : 'ELEVATED STRESS'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">Occupancy</span>
                      <span className="text-slate-200 font-extrabold">{activeQuarterSnapshot.occupancy}%</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">ED Bed Wait</span>
                      <span className="text-slate-200 font-extrabold">{activeQuarterSnapshot.p90BedWaitHours} hrs</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">ALC Rate</span>
                      <span className="text-slate-200 font-extrabold">{activeQuarterSnapshot.alcRate}%</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 uppercase font-black block">LWBS Rate</span>
                      <span className="text-slate-200 font-extrabold">{activeQuarterSnapshot.lwbsRate}%</span>
                    </div>

                  </div>

                  {/* Programmatic brief comment based on quarter selection */}
                  <div className="pt-2 border-t border-slate-850/60 text-[11px] text-slate-400 leading-relaxed font-medium">
                    {activeQuarterSnapshot.quarter === '2021-Q1' && "Pre-crisis period: Hospital bed occupancy hovered below target levels (94.2%). Downstream placement bottlenecks were minor, holding decisions-to-admit waits to a manageable 24.5-hour median."}
                    {activeQuarterSnapshot.quarter === '2022-Q1' && "Early capacity overload: Bed occupancies breached 101.4%. The decision-to-admit wait time expanded to 31.2 hours as ED boarding became a persistent systemic issue."}
                    {activeQuarterSnapshot.quarter === '2024-Q1' && "Critical degradation: Inpatient occupancies hit 104.8%, sending ED bed wait times past 40.5 hours. LWBS walkout rates rose to 9.2% as front-end assessment lines backed up."}
                    {activeQuarterSnapshot.quarter === '2026-Q1' && "Peak systemic crisis: Occumpancy stands at an all-time high of 107.5%. Decisions-to-admit now require a massive 48.0 hours of waiting, driving critical safety risks."}
                    {!['2021-Q1', '2022-Q1', '2024-Q1', '2026-Q1'].includes(activeQuarterSnapshot.quarter) && "Mid-period transition: Continuous growth in Alternate Level of Care (ALC) delayed discharge rates steadily locked acute care wards, slowly degrading ED transit metrics."}
                  </div>
                </div>

              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- SUB-TAB 5: COMPARATORS & UPSTREAM LGA DEMAND ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'cihi-lga' && (
          <motion.div
            key="cihi-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* CIHI National Benchmarks (Surfacing Comparator Data) */}
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <Award className="w-4 h-4 text-blue-400" />
                  <span>CIHI National Comparators (Alberta vs Canada Avg)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Standardized metrics illustrating Alberta's system stress level relative to national averages.
                </p>
              </div>

              <div className="space-y-4">
                {CIHI_COMPARATORS.map((comp, idx) => {
                  const isBetterThanCanada = comp.albertaValue < comp.canadaValue;
                  const isBeds = comp.unit === 'beds_per_1000';
                  // Staffed beds is better when higher, others are better when lower
                  const isPositive = isBeds ? !isBetterThanCanada : isBetterThanCanada;
                  
                  return (
                    <div key={idx} className="p-3 bg-slate-950/60 rounded-xl border border-slate-850 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-slate-200">{comp.metric}</h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-medium">{comp.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {isPositive ? 'Favorable' : 'Unfavorable'}
                          </span>
                        </div>
                      </div>

                      {/* Stacked comparison bar */}
                      <div className="flex items-center gap-4 text-xs font-mono pt-1">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-slate-400">Alberta: <strong className="text-white font-extrabold">{comp.albertaValue}{comp.unit === 'percent' ? '%' : comp.unit === 'hours' ? ' hrs' : ''}</strong></span>
                            <span className="text-slate-500">Canada Avg: <strong className="text-slate-400 font-extrabold">{comp.canadaValue}{comp.unit === 'percent' ? '%' : comp.unit === 'hours' ? ' hrs' : ''}</strong></span>
                          </div>
                          
                          {/* visual progress comparing alberta vs canada */}
                          <div className="h-2 bg-slate-900 rounded-full overflow-hidden flex border border-slate-850">
                            <div 
                              className={`h-full ${isPositive ? 'bg-blue-500' : 'bg-red-500'} rounded-l`} 
                              style={{ width: `${Math.min(100, (comp.albertaValue / (comp.albertaValue + comp.canadaValue)) * 100)}%` }} 
                            />
                            <div 
                              className="bg-slate-700 h-full rounded-r" 
                              style={{ width: `${Math.min(100, (comp.canadaValue / (comp.albertaValue + comp.canadaValue)) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upstream LGA Triage Profiler */}
            <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Upstream LGA Demand Profiles (Open Alberta Portal)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Analysis of emergency department visit rates and Canadian Triage and Acuity Scale (CTAS) profiles by local health geographic area.
                </p>
              </div>

              <div className="space-y-4">
                {REGIONAL_LGA_DEMAND.map((lga, idx) => {
                  return (
                    <div key={idx} className="p-4 bg-slate-950/60 rounded-xl border border-slate-850 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-white">{lga.lgaName}</h4>
                          <div className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">{lga.zone}</div>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <div className="font-extrabold text-slate-200">{lga.annualEdVisits.toLocaleString()} visits/year</div>
                          <div className="text-[10px] text-slate-500">Population: {lga.population.toLocaleString()}</div>
                        </div>
                      </div>

                      {/* Stacked Triage Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-mono text-slate-400">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />CTAS 1-2 (Urgent): {lga.ctas1_2_Pct}%</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />CTAS 3 (Moderate): {lga.ctas3_Pct}%</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />CTAS 4-5 (Mild): {lga.ctas4_5_Pct}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-900 border border-slate-800">
                          <div className="bg-red-500 h-full" style={{ width: `${lga.ctas1_2_Pct}%` }} title="CTAS 1-2" />
                          <div className="bg-amber-500 h-full" style={{ width: `${lga.ctas3_Pct}%` }} title="CTAS 3" />
                          <div className="bg-emerald-500 h-full" style={{ width: `${lga.ctas4_5_Pct}%` }} title="CTAS 4-5" />
                        </div>
                      </div>

                      {/* Diagnoses */}
                      <div className="pt-1.5 border-t border-slate-850 flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed font-medium">
                        <span className="font-black text-slate-300 uppercase tracking-widest text-[8px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                          Primary Presenting Issue
                        </span>
                        <span>{lga.topDiagnosis}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3.5 text-[10.5px] text-slate-400 leading-relaxed bg-slate-950/40 rounded-xl border border-slate-850">
                <strong>CTAS Guidelines:</strong> Level 1 (Resuscitation) and Level 2 (Emergent) represent immediate critical pathologies. Level 4 (Less Urgent) and Level 5 (Non-Urgent) represent primary care issues (e.g. prescription renewals, minor sprains) that crowd metropolitan ED waiting areas due to lack of local community walk-in clinic access.
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* AHS Weekly Los PDF Releases Segment */}
      <div className="p-6 rounded-2xl bg-[#090e21] border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase text-white tracking-widest flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>AHS Weekly ED LOS PDF Output releases</span>
            </h3>
            <p className="text-xs text-slate-400">
              Fresh weekly datasets parsed directly from Alberta Health Services weekly ED wait times PDF reports.
            </p>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Direct Parser Feed
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AHS_WEEKLY_ED_LOS.map((item, idx) => {
            const isEdmonton = item.city === 'Edmonton';
            const warningDischarge = item.pctDischargedWithin4h < 30;
            const warningAdmit = item.pctAdmittedWithin8h < 20;
            
            return (
              <div key={idx} className="p-4 bg-slate-950/40 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="font-extrabold text-slate-200 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isEdmonton ? 'bg-indigo-500' : 'bg-cyan-500'}`}></span>
                    <span>{item.facilityName}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Week Ending: {item.weekEnding} • {item.city}, AB
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                  
                  <div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Discharged</div>
                    <div className="font-extrabold text-slate-300">{item.dischargedCount}</div>
                    <div className={`text-[10px] font-black ${warningDischarge ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {item.pctDischargedWithin4h}% <span className="text-[8px] font-normal text-slate-500 font-sans uppercase">in 4h</span>
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-800" />

                  <div>
                    <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Admitted</div>
                    <div className="font-extrabold text-slate-300">{item.admittedCount}</div>
                    <div className={`text-[10px] font-black ${warningAdmit ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {item.pctAdmittedWithin8h}% <span className="text-[8px] font-normal text-slate-500 font-sans uppercase">in 8h</span>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400 font-medium leading-relaxed">
          <span>Would you like to examine the official, unparsed PDF wait time datasets directly from Alberta Health Services releases?</span>
          <a 
            href="https://www.albertahealthservices.ca/about/Page3166.aspx" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="px-3.5 py-1.5 rounded bg-slate-900 border border-slate-850 text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1.5 hover:underline tracking-wider uppercase text-[10px]"
          >
            <span>AHS Official Releases Portal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Footer methodology notes */}
      <div className="p-4 rounded-xl bg-[#090e21] border border-slate-800 text-[9px] text-slate-500 font-mono leading-relaxed flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <span>Analytical Source: Health Quality Alberta (HQA) FOCUS live database; CIHI NACRS/DAD emergency-acute metadata tables; Alberta Health Services Weekly ED Flow metrics releases.</span>
        <span className="uppercase tracking-wider font-extrabold text-slate-400 flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-blue-400" />
          AHS Certified Performance Data Feed
        </span>
      </div>

    </div>
  );
}
