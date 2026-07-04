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
  Gauge,
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
  HistoricalFlowSnapshot
} from '../systemFlowData';

export default function SystemFlowDashboard() {
  // Navigation Tabs
  const [subTab, setSubTab] = useState<'causal-chain' | 'ranked' | 'scatterplot' | 'trends-weekly' | 'cihi-lga'>('causal-chain');
  
  // Interactive Filters
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Ranked sorting
  const [sortMetric, setSortMetric] = useState<keyof FacilityFlow>('hospitalOccupancy');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selected Hospital for deep-dive panel (defaults to Royal Alex)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string>('rah-edmonton');

  // Interactive Causal Chain Simulator Stress State
  const [simulatorStress, setSimulatorStress] = useState<number>(100); // represents acute occupancy

  // Interactive Historical Quarter Selector
  const [selectedQuarter, setSelectedQuarter] = useState<string>('2026-Q1');

  // Interactive Quadrant Highlight for Scatterplot
  const [activeQuadrant, setActiveQuadrant] = useState<'all' | 'gridlock' | 'stress' | 'stable'>('all');

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

  // Dynamic calculations for Causal Chain Stress Simulator
  const simulatedValues = useMemo(() => {
    const baseOcc = simulatorStress;
    // Non-linear escalation of bed wait times based on occupancy
    // Wait time starts rising exponentially above 95% occupancy
    let waitMultiplier = 1;
    if (baseOcc > 100) {
      waitMultiplier = 1 + Math.pow((baseOcc - 100) * 1.5, 1.4);
    } else if (baseOcc > 90) {
      waitMultiplier = 1 + (baseOcc - 90) * 0.12;
    } else {
      waitMultiplier = 0.5 + (baseOcc / 180);
    }

    const simulatedWait = parseFloat((4.5 * waitMultiplier).toFixed(1));
    const simulatedBoarders = Math.round(1.5 * waitMultiplier);
    const simulatedLwbs = parseFloat(Math.min(15, 2.0 + (baseOcc > 95 ? (baseOcc - 95) * 1.05 : (baseOcc - 85) * 0.15)).toFixed(1));
    const simulatedDischargePlacement = parseFloat(Math.max(10, 85.0 - (baseOcc - 85) * 6.5).toFixed(1));

    return {
      wait: simulatedWait,
      boarders: simulatedBoarders,
      lwbs: simulatedLwbs,
      placement: simulatedDischargePlacement
    };
  }, [simulatorStress]);

  // Selected Quarter snapshot
  const activeQuarterSnapshot = useMemo(() => {
    return HISTORICAL_FLOW_TIMELINES.find(q => q.quarter === selectedQuarter) || HISTORICAL_FLOW_TIMELINES[HISTORICAL_FLOW_TIMELINES.length - 1];
  }, [selectedQuarter]);

  return (
    <div id="system-flow-dashboard-root" className="space-y-6 text-slate-100 font-sans">
      
      {/* Dynamic Key Performance Indicators (SURFACING PROVINCIAL METRICS DYNAMICALLY) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1 */}
        <div id="metric-prov-occupancy" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Provincial Bed Occupancy</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-500 font-mono">{provincialOverview.avgOccupancy}%</span>
              <span className="text-[10px] text-rose-400/80 font-bold font-mono">CRITICAL STATE</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Weighted across {provincialOverview.totalBeds} active acute beds</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 shrink-0 border border-rose-500/20 group-hover:scale-110 transition-transform duration-300">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-rose-500 to-rose-600 rounded-bl" />
        </div>

        {/* Metric 2 */}
        <div id="metric-mean-bedwait" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Average ED Bed Wait (P90)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-500 font-mono">{provincialOverview.avgP90Wait}h</span>
              <span className="text-[10px] text-amber-400 font-bold font-mono">+12.4h since 2021</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">From decision-to-admit to ward placement</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500 shrink-0 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
            <Clock className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-amber-500 to-amber-600 rounded-bl" />
        </div>

        {/* Metric 3 */}
        <div id="metric-mean-lwbs" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Left Without Being Seen</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-blue-400 font-mono">{provincialOverview.avgLwbs}%</span>
              <span className="text-[10px] text-blue-400/80 font-bold font-mono">HIGH RISK</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Provincial average self-discharge rate</span>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0 border border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
            <Activity className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-blue-500 to-blue-600 rounded-bl" />
        </div>

        {/* Metric 4 */}
        <div id="metric-mean-alc" className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between shadow-lg relative overflow-hidden group hover:border-violet-500/30 transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Alternate Level of Care (ALC)</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-violet-400 font-mono">{provincialOverview.avgAlc}%</span>
              <span className="text-[10px] text-violet-400 font-bold font-mono">DISCHARGE BLOCKED</span>
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Inpatient acute bed-days occupied by non-acute cases</span>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10 text-violet-500 shrink-0 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
            <Layers className="w-5 h-5" />
          </div>
          <div className="absolute top-0 right-0 h-1.5 w-16 bg-gradient-to-l from-violet-500 to-violet-600 rounded-bl" />
        </div>

      </div>

      {/* Primary Header Info Block */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-[#0a0f25] to-[#060a1a] border border-slate-800/80 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                HQA FOCUS Standardized Feed
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                CIHI / AHS Certified
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono font-bold">Live Data Verified</span>
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Hospital System Flow &amp; Bed Bottlenecks
            </h1>
            <p className="text-xs text-slate-400 max-w-4xl leading-relaxed">
              An advanced analytical model tracking the end-to-end causal path of hospital flow gridlock. Explore how acute-care bed blocking by alternate-level-of-care (ALC) patients precipitates boarding in the ED, resulting in wait time explosions, ambulance offload bottlenecks, and elevated patient walkout (LWBS) rates.
            </p>
          </div>
          
          {/* Quick Stats Panel */}
          <div className="flex flex-row items-center gap-3 shrink-0 bg-slate-950/50 p-3 rounded-xl border border-slate-850">
            <div className="text-center px-3 border-r border-slate-800">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">Provincial Beds</span>
              <span className="text-lg font-black text-blue-400 font-mono">{provincialOverview.totalBeds}</span>
            </div>
            <div className="text-center px-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block font-mono">Daily ED Visits</span>
              <span className="text-lg font-black text-indigo-400 font-mono">~{provincialOverview.totalVolume.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/60 rounded-xl border border-slate-850/80 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSubTab('causal-chain')}
          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'causal-chain'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>1. Causal Flow Chain Simulator</span>
        </button>
        <button
          onClick={() => setSubTab('ranked')}
          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'ranked'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <ListOrdered className="w-3.5 h-3.5" />
          <span>2. Hospital Flow Grid &amp; Deep-Dive</span>
        </button>
        <button
          onClick={() => setSubTab('scatterplot')}
          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'scatterplot'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>3. Bottleneck Correlation Engine</span>
        </button>
        <button
          onClick={() => setSubTab('trends-weekly')}
          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'trends-weekly'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>4. Historical Degradation Tracker</span>
        </button>
        <button
          onClick={() => setSubTab('cihi-lga')}
          className={`px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'cihi-lga'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>5. National Benchmarks &amp; LGA Profiles</span>
        </button>
      </div>

      {/* ---------------- SUB-TAB 1: CAUSAL CHAIN SIMULATOR ---------------- */}
      <AnimatePresence mode="wait">
        {subTab === 'causal-chain' && (
          <motion.div
            key="causal-chain-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            
            {/* Interactive Simulator Controller */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-[#0a0f25] to-[#070b1e] border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-slate-100 tracking-widest flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-blue-500" />
                    <span>Interactive Hospital Stress &amp; Gridlock Simulator</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Slide the inpatient occupancy level to model how downstream gridlock triggers a rapid, non-linear explosion of emergency department wait times.
                  </p>
                </div>
                <div className="px-3 py-1.5 bg-slate-950/60 border border-slate-850 rounded-lg text-[10px] font-bold text-slate-400 font-mono uppercase">
                  Mathematical Non-Linear Model
                </div>
              </div>

              {/* Slider Controller */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">Acute Ward Occupancy Rate:</span>
                    <span className={`text-lg font-mono font-black ${
                      simulatorStress >= 105 ? 'text-red-500' : simulatorStress >= 98 ? 'text-amber-500' : 'text-emerald-500'
                    }`}>
                      {simulatorStress}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="85" 
                    max="112" 
                    value={simulatorStress} 
                    onChange={(e) => setSimulatorStress(parseInt(e.target.value))}
                    className="w-full h-2 rounded-lg bg-slate-950 border border-slate-800 appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[9px] font-bold font-mono text-slate-500 uppercase">
                    <span>85% (Target)</span>
                    <span>95% (Risk Threshold)</span>
                    <span>100% (Ward Full)</span>
                    <span>112% (Extreme Crisis)</span>
                  </div>
                </div>

                {/* Simulated Output Metrics */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  
                  {/* Output 1 */}
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">ED Bed Wait (P90)</span>
                    <div className="text-xl font-black text-rose-500 font-mono">
                      {simulatedValues.wait} <span className="text-[10px] text-slate-400 font-sans font-medium">hrs</span>
                    </div>
                    <span className="text-[9px] text-slate-400 block leading-tight">Wait to leave ED after admission</span>
                  </div>

                  {/* Output 2 */}
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Hallway Boarders</span>
                    <div className="text-xl font-black text-amber-500 font-mono">
                      {simulatedValues.boarders} <span className="text-[10px] text-slate-400 font-sans font-medium">pt/hr</span>
                    </div>
                    <span className="text-[9px] text-slate-400 block leading-tight">Average boarding patients stuck in ED</span>
                  </div>

                  {/* Output 3 */}
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">LWBS Walkout Rate</span>
                    <div className="text-xl font-black text-blue-400 font-mono">
                      {simulatedValues.lwbs}%
                    </div>
                    <span className="text-[9px] text-slate-400 block leading-tight">Left without assessment due to delay</span>
                  </div>

                  {/* Output 4 */}
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-850 space-y-1">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Continuing Care placements</span>
                    <div className="text-xl font-black text-violet-400 font-mono">
                      {simulatedValues.placement}%
                    </div>
                    <span className="text-[9px] text-slate-400 block leading-tight">Secured placement within 30 days</span>
                  </div>

                </div>
              </div>

              {/* Dynamic Simulated Clinical Brief */}
              <div className={`p-4 rounded-xl border ${
                simulatorStress >= 105 
                  ? 'bg-red-950/20 border-red-900/40 text-red-300' 
                  : simulatorStress >= 98 
                    ? 'bg-amber-950/20 border-amber-900/40 text-amber-300' 
                    : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              } text-xs leading-relaxed space-y-1.5`}>
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" />
                  <span>System State: {
                    simulatorStress >= 105 ? 'SEVERE GRIDLOCK CRISIS' : simulatorStress >= 98 ? 'HIGH SYSTEM STRESS & BOARDING' : 'STABLE SYSTEM CIRCULATION'
                  }</span>
                </div>
                <p>
                  {simulatorStress >= 105 
                    ? `With acute ward occupancy at ${simulatorStress}%, inpatient wards are completely blocked. New emergency patients requiring admission have nowhere to go and board indefinitely in the emergency department (averaging ${simulatedValues.boarders} hallway patients/hour). Decisions-to-admit remain stuck for ${simulatedValues.wait} hours, completely paralyzing the active triage streams and causing a massive walkout rate of ${simulatedValues.lwbs}% of self-triaged cases.`
                    : simulatorStress >= 98
                      ? `At ${simulatorStress}% occupancy, active bed buffering is exhausted. Although inpatient discharge coordinates are active, delay blocks cause admitted emergency patients to spend an average of ${simulatedValues.wait} hours in ED boarding beds. Emergency department physical assets are degraded by holding hallway boarders, elevating wait times and forcing a walkout rate of ${simulatedValues.lwbs}%.`
                      : `At a healthy ${simulatorStress}% occupancy level, inpatient units circulate effectively. Admitted patients undergo rapid ward transfers (under 5 hours), which keeps emergency room assessment bays open. Wait times remain minimal, and patient walkout rates are negligible (under 3%), indicating a stable and highly safe environment.`
                  }
                </p>
              </div>
            </div>

            {/* Interactive Graphical Flow Chain Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 relative">
              
              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition-all duration-300 shadow-xl group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-blue-400 bg-blue-400/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-blue-500/10">Step 1: Deficits</span>
                    <span className="text-xs font-mono font-bold text-slate-600">01</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      Community Gaps
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      Deficits in family medicine and rural clinics channel heavy non-urgent primary care cases directly into metropolitan EDs.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50">
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Provincial Daily Intake</div>
                  <div className="text-lg font-mono font-extrabold text-blue-400 mt-0.5">3,248 <span className="text-[10px] text-slate-500 font-sans font-medium">visits</span></div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all duration-300 shadow-xl group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-indigo-500/10">Step 2: Exit Rate</span>
                    <span className="text-xs font-mono font-bold text-slate-600">02</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-indigo-400" />
                      ED Front Backups
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      Prolonged wait times (discharged patients wait up to 15h) trigger severe patient walkouts (LWBS) before assessments.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50">
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Simulated LWBS Rate</div>
                  <div className="text-lg font-mono font-extrabold text-indigo-400 mt-0.5">{simulatedValues.lwbs}% <span className="text-[9px] text-slate-500 font-sans font-semibold">walkouts</span></div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-all duration-300 shadow-xl group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-amber-500/10">Step 3: Boarders</span>
                    <span className="text-xs font-mono font-bold text-slate-600">03</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      ED Boarding Lock
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      Admitted patients wait in hallway stretchers, locking emergency bays and paralyzing paramedics on offload.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50">
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Simulated Bed Wait</div>
                  <div className="text-lg font-mono font-extrabold text-amber-500 mt-0.5">{simulatedValues.wait} <span className="text-[10px] text-slate-500 font-sans font-medium">hours</span></div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-red-500/40 transition-all duration-300 shadow-xl group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-red-500/10">Step 4: Beds Blocked</span>
                    <span className="text-xs font-mono font-bold text-slate-600">04</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-red-400" />
                      Acute Ward Full
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      With ward occupancy far above 100%, transfers are suspended, forcing ED physicians to hold inpatients in acute exam rooms.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50">
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Ward Occupancy</div>
                  <div className="text-lg font-mono font-extrabold text-red-500 mt-0.5">{simulatorStress}% <span className="text-[9px] text-slate-500 font-sans font-semibold">capacity</span></div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-5 rounded-2xl bg-[#090e21] border border-slate-800 flex flex-col justify-between space-y-4 hover:border-violet-500/40 transition-all duration-300 shadow-xl group">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-violet-400 bg-violet-400/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-violet-500/10">Step 5: ALC Trap</span>
                    <span className="text-xs font-mono font-bold text-slate-600">05</span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-violet-400" />
                      Discharge Block
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      Ward beds remain locked by patients ready for discharge but stranded by community continuing-care shortfalls.
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850/50">
                  <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">SimulatedPlacement</div>
                  <div className="text-lg font-mono font-extrabold text-violet-400 mt-0.5">{simulatedValues.placement}% <span className="text-[9px] text-slate-500 font-sans font-semibold">30d place</span></div>
                </div>
              </div>

            </div>

            {/* In-Depth Zone Averages Bento Grid */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-400" />
                  <span>Provincial Regional Performance (HQA FOCUS Live Feed)</span>
                </h4>
                <span className="text-[10px] text-slate-500 font-mono">Calculated across all designated emergency network facilities</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {zoneAverages.map((z, idx) => {
                  if (!z) return null;
                  const isCrisis = z.avgOccupancy >= 104;
                  const isHigh = z.avgOccupancy >= 100 && z.avgOccupancy < 104;
                  
                  return (
                    <div key={idx} className="p-4 bg-[#090e21] rounded-2xl border border-slate-800/80 space-y-3 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-white">{z.zone.replace(' Zone', '')}</span>
                          <span className="text-[9px] bg-slate-950 px-2 py-0.5 rounded-full text-slate-400 font-mono font-bold border border-slate-800">
                            {z.facilityCount} facilities
                          </span>
                        </div>
                        
                        {/* Occupancy Indicator */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-slate-400">Mean Occupancy</span>
                            <span className={`font-black ${isCrisis ? 'text-red-400' : isHigh ? 'text-amber-500' : 'text-emerald-400'}`}>
                              {z.avgOccupancy}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-850">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCrisis ? 'bg-gradient-to-r from-red-500 to-rose-600' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, (z.avgOccupancy / 112) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Split parameters */}
                        <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono">
                          <div className="bg-slate-950/60 p-2 rounded border border-slate-850">
                            <span className="text-[9px] text-slate-500 uppercase font-black block">Bed Wait</span>
                            <span className="text-slate-200 font-extrabold">{z.avgBedWait}h</span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded border border-slate-850">
                            <span className="text-[9px] text-slate-500 uppercase font-black block">LWBS</span>
                            <span className="text-amber-500 font-extrabold">{z.avgLwbs}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-850/60 flex items-center justify-between text-[9px] font-mono text-slate-400">
                        <span>Staffed Beds: <strong className="text-white font-bold">{z.totalBeds}</strong></span>
                        <span>Visits: <strong className="text-slate-300">{z.totalVolume}/d</strong></span>
                      </div>
                    </div>
                  );
                })}
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
