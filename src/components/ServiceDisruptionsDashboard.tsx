import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Plus, 
  X, 
  CheckCircle,
  ChevronDown, 
  ChevronUp, 
  Activity, 
  SlidersHorizontal,
  Info,
  ExternalLink,
  ChevronRight,
  BarChart3,
  TrendingUp
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ServiceDisruption } from '../types';
import { useSyncStatus, formatRelativeTime, getDomainResult } from '../hooks/useSyncStatus';
import { DashboardHeader } from './DashboardHeader';
export default function ServiceDisruptionsDashboard() {
  const [disruptions, setDisruptions] = useState<ServiceDisruption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { syncStatus } = useSyncStatus();
  const disruptionsSync = getDomainResult(syncStatus, 'disruptions');

  // Never invent a page-load timestamp when sync status is missing.
  const lastSyncTime = disruptionsSync?.timestamp ?? '';
  const metadata = {
    disruptions: {
      source: 'AHS temporary bed/space reductions page (Page17594)',
      sourceVintage: 'Daily scrape of published AHS advisories (not continuous live poll)',
      lastUpdated: lastSyncTime || '1970-01-01T00:00:00.000Z',
      updateType: (lastSyncTime ? 'auto' : 'manual') as 'auto' | 'manual',
      verification: 'Core fields scraped from AHS page. Zone/type are inferred from city map / keyword heuristics. alternativeCare only from editorial overrides.',
    }
  };
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | 'Active' | 'Resolved'>('Active');

  // Expanded disruption IDs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Chart modal state
  const [chartOpen, setChartOpen] = useState(false);
  const [chartType, setChartType] = useState<'all' | 'Closure' | 'Reduced Hours' | 'Bed Reduction'>('all');

  const openChart = (type: 'all' | 'Closure' | 'Reduced Hours' | 'Bed Reduction') => {
    setChartType(type);
    setChartOpen(true);
  };


  const fetchDisruptions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/disruptions');
      if (!res.ok) throw new Error('Failed to load disruptions data.');
      const data = await res.ok ? await res.json() : [];
      setDisruptions(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Could not establish secure communication with AHS disruptions endpoint. Using cached system records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisruptions();
  }, []);

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure this service disruption has been resolved?')) return;
    try {
      const res = await fetch(`/api/disruptions/${id}/resolve`, { method: 'POST' });
      if (res.ok) {
        fetchDisruptions();
      }
    } catch (err) {
      console.error('Failed to resolve disruption:', err);
    }
  };



  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Helper counters
  const activeDisruptions = disruptions.filter(d => d.status === 'Active');
  const totalClosures = activeDisruptions.filter(d => d.disruptionType === 'Closure').length;
  const totalReduced = activeDisruptions.filter(d => d.disruptionType === 'Reduced Hours').length;
  const totalBeds = activeDisruptions.filter(d => d.disruptionType === 'Bed Reduction').length;

  // Chart data: breakdown by zone
  const chartZones = ['North Zone', 'Edmonton Zone', 'Central Zone', 'Calgary Zone', 'South Zone'];
  const getChartData = (type: 'all' | 'Closure' | 'Reduced Hours' | 'Bed Reduction') => {
    const records = type === 'all'
      ? activeDisruptions
      : activeDisruptions.filter(d => d.disruptionType === type);
    return chartZones.map(zone => ({
      zone: zone.replace(' Zone', ''),
      count: records.filter(d => d.zone === zone).length,
      fullZone: zone
    }));
  };

  const chartTitles: Record<typeof chartType, string> = {
    all: 'Active Advisories by Zone',
    Closure: 'Full Site Closures by Zone',
    'Reduced Hours': 'Reduced Hours by Zone',
    'Bed Reduction': 'Bed/Specialty Reductions by Zone'
  };

  const chartColors: Record<typeof chartType, string> = {
    all: '#ef4444',
    Closure: '#f43f5e',
    'Reduced Hours': '#f59e0b',
    'Bed Reduction': '#3b82f6'
  };

  // Filter lists
  const filteredDisruptions = disruptions.filter(d => {
    // Search
    const matchesSearch = 
      d.facilityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.serviceAffected.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.reason.toLowerCase().includes(searchQuery.toLowerCase());

    // Zone
    const matchesZone = selectedZone === 'All' || d.zone === selectedZone;

    // Type
    const matchesType = selectedType === 'All' || d.disruptionType === selectedType;

    // Status
    const matchesStatus = selectedStatus === 'All' || d.status === selectedStatus;

    return matchesSearch && matchesZone && matchesType && matchesStatus;
  });

  const zones = ['All', 'North Zone', 'Edmonton Zone', 'Central Zone', 'Calgary Zone', 'South Zone'];
  const types = ['All', 'Closure', 'Reduced Hours', 'Bed Reduction', 'Service Suspension'];

  const formatDate = (isoString: string) => {
    if (!isoString) return '';
    const cleanStr = isoString.trim();
    if (['ongoing', 'tbd', 'indefinite', 'unknown'].includes(cleanStr.toLowerCase())) {
      return cleanStr;
    }
    try {
      const date = new Date(cleanStr);
      if (isNaN(date.getTime())) {
        return cleanStr;
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return cleanStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        icon={ShieldAlert}
        title="Temporary Service Disruptions"
        description="Monitor real-time closures, reduced hours, and bed reductions across Alberta."
        metadata={metadata}
        arrayKey="disruptions"
      />

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Active */}
        <button
          onClick={() => openChart('all')}
          className="bg-[#090e21] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-left transition-all hover:border-red-500/30 hover:bg-slate-900/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Active Advisories</span>
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-red-500/10 border border-red-500/20 rounded-lg group-hover:bg-red-500/20 transition-colors">
                <AlertTriangle className="w-4 h-4 text-red-400" />
              </span>
              <span className="p-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 group-hover:text-white transition-colors">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-white leading-none">{activeDisruptions.length}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
              Click for zone breakdown
              <BarChart3 className="w-3 h-3 text-slate-500 group-hover:text-red-400 transition-colors" />
            </p>
          </div>
        </button>

        {/* Card 2: Closures */}
        <button
          onClick={() => openChart('Closure')}
          className="bg-[#090e21] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-left transition-all hover:border-rose-500/30 hover:bg-slate-900/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Full Site Closures</span>
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </span>
              <span className="p-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 group-hover:text-white transition-colors">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-white leading-none">{totalClosures}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
              Click for zone breakdown
              <BarChart3 className="w-3 h-3 text-slate-500 group-hover:text-rose-400 transition-colors" />
            </p>
          </div>
        </button>

        {/* Card 3: Reduced Hours */}
        <button
          onClick={() => openChart('Reduced Hours')}
          className="bg-[#090e21] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-left transition-all hover:border-amber-500/30 hover:bg-slate-900/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Reduced Hours</span>
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                <Clock className="w-4 h-4 text-amber-400" />
              </span>
              <span className="p-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 group-hover:text-white transition-colors">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-white leading-none">{totalReduced}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
              Click for zone breakdown
              <BarChart3 className="w-3 h-3 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </p>
          </div>
        </button>

        {/* Card 4: Bed Reductions */}
        <button
          onClick={() => openChart('Bed Reduction')}
          className="bg-[#090e21] border border-slate-800 p-4 rounded-2xl flex flex-col justify-between text-left transition-all hover:border-blue-500/30 hover:bg-slate-900/50 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bed/Specialty Reductions</span>
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Activity className="w-4 h-4 text-blue-400" />
              </span>
              <span className="p-1 bg-slate-800/50 border border-slate-700/50 rounded text-slate-400 group-hover:text-white transition-colors">
                <BarChart3 className="w-3 h-3" />
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-black text-white leading-none">{totalBeds}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
              Click for zone breakdown
              <BarChart3 className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </p>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800/80 shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search disruptions by facility, city, service or reason..." 
              className="w-full pl-11 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Sliders and drop downs */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            {/* Zone Filter */}
            <div className="relative w-full sm:w-44">
              <select 
                className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {zones.map(z => (
                  <option key={z} value={z}>{z === 'All' ? 'All Zones' : z}</option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>

            {/* Type Filter */}
            <div className="relative w-full sm:w-48">
              <select 
                className="w-full appearance-none pl-4 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {types.map(t => (
                  <option key={t} value={t}>{t === 'All' ? 'All Disruptions' : t}</option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Status Selector Switch */}
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-3 flex-wrap gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setSelectedStatus('Active')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedStatus === 'Active' 
                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Advisories ({disruptions.filter(d => d.status === 'Active').length})
            </button>
            <button
              onClick={() => setSelectedStatus('Resolved')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedStatus === 'Resolved' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/10' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resolved History ({disruptions.filter(d => d.status === 'Resolved').length})
            </button>
            <button
              onClick={() => setSelectedStatus('All')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                selectedStatus === 'All' 
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Records ({disruptions.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
            Displaying {filteredDisruptions.length} matching events
          </span>
        </div>
      </div>

      {/* Disruption Cards Grid */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl animate-pulse space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-48 bg-slate-800 rounded-md" />
                <div className="h-5 w-24 bg-slate-800 rounded-md" />
              </div>
              <div className="h-3 w-36 bg-slate-800/60 rounded-md" />
              <div className="h-10 w-full bg-slate-800/40 rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredDisruptions.length > 0 ? (
        <div className="space-y-4">
          {filteredDisruptions.map(disr => {
            const isExpanded = expandedId === disr.id;
            const isActive = disr.status === 'Active';
            
            // Badge styles depending on type and status
            let typeBadgeClass = 'bg-slate-950 border border-slate-800 text-slate-300';
            if (isActive) {
              if (disr.disruptionType === 'Closure') {
                typeBadgeClass = 'bg-red-500/10 border border-red-500/20 text-red-400';
              } else if (disr.disruptionType === 'Reduced Hours') {
                typeBadgeClass = 'bg-amber-500/10 border border-amber-500/20 text-amber-400';
              } else if (disr.disruptionType === 'Bed Reduction') {
                typeBadgeClass = 'bg-blue-500/10 border border-blue-500/20 text-blue-400';
              } else if (disr.disruptionType === 'Service Suspension') {
                typeBadgeClass = 'bg-rose-500/10 border border-rose-500/20 text-rose-400';
              }
            } else {
              typeBadgeClass = 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400';
            }

            return (
              <div 
                key={disr.id}
                className={`bg-[#090e21] hover:bg-[#0b1329]/80 border transition-all duration-300 rounded-2xl overflow-hidden cursor-pointer ${
                  isExpanded ? 'border-blue-900/40 shadow-xl' : 'border-slate-800/80 hover:border-slate-700'
                }`}
                onClick={() => toggleExpand(disr.id)}
              >
                {/* Main Header Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-white leading-tight truncate">{disr.facilityName}</h3>
                      <span className="px-2 py-0.5 bg-slate-900 border border-slate-850 rounded text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        {disr.zone}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-semibold font-mono">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{disr.city}, AB</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Started: {formatDate(disr.startDate)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Ended: {disr.endDate === 'Ongoing' ? <span className="text-rose-400 font-bold uppercase tracking-wider animate-pulse">Ongoing</span> : formatDate(disr.endDate)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions & Badges column */}
                  <div className="flex sm:flex-col items-start sm:items-end gap-2.5 shrink-0 w-full sm:w-auto border-t border-slate-800/40 pt-3 sm:pt-0 sm:border-0 justify-between sm:justify-start">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest ${typeBadgeClass}`}>
                      {isActive ? `${disr.disruptionType}: ${disr.serviceAffected}` : 'Resolved'}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <button
                          onClick={(e) => handleResolve(disr.id, e)}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded-lg text-[9px] font-black transition-colors cursor-pointer"
                          title="Mark this disruption as resolved"
                        >
                          Resolve
                        </button>
                      )}
                      
                      <span className="text-slate-500 group-hover:text-slate-300">
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div className="bg-slate-950/60 border-t border-slate-900/80 p-5 space-y-4 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left: What happened */}
                      <div className="space-y-2 p-3.5 bg-slate-900/25 border border-slate-850 rounded-xl">
                        <h4 className="font-extrabold text-white text-[11px] uppercase tracking-wider flex items-center gap-1.5 text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Disruption Advisory</span>
                        </h4>
                        <div className="space-y-1 text-slate-300 leading-relaxed">
                          <p><strong>Affected Department:</strong> <span className="text-white font-bold">{disr.serviceAffected}</span></p>
                          <p><strong>Primary Reason:</strong> <span className="text-white font-bold">{disr.reason}</span></p>
                          <p className="mt-2 text-[11px] bg-slate-950/40 p-2 border border-slate-900 rounded font-medium">{disr.details}</p>
                        </div>
                      </div>

                      {/* Right: Alternative options (only when editorial override exists) */}
                      <div className="space-y-2 p-3.5 bg-blue-950/5 border border-blue-950/20 rounded-xl">
                        <h4 className="font-extrabold text-blue-400 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Patient Divert & Alternative Care</span>
                        </h4>
                        <div className="text-slate-300 leading-relaxed space-y-2">
                          {disr.alternativeCare ? (
                            <p className="text-[11px] bg-blue-900/10 p-2.5 border border-blue-900/20 text-slate-200 font-bold rounded">
                              {disr.alternativeCare}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              No facility-specific divert guidance was published on the AHS advisory. See the official AHS page for details. In emergencies dial 911.
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Zone and disruption type are inferred from city maps / keywords when not explicit on the page.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Metadata & source */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-900/60 pt-3 text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                      <span>Advisory record ID: {disr.id} | Last Sync: {formatDate(disr.updatedAt)}</span>
                      {disr.sourceUrl && disr.sourceUrl.startsWith('http') && (
                        <a 
                          href={disr.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <span>Official AHS Advisory Webpage</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 bg-slate-900/25 border border-dashed border-slate-800 rounded-3xl text-center text-slate-500">
          <Info className="w-12 h-12 mx-auto mb-4 text-slate-700" />
          <p className="text-lg font-bold text-slate-300">No active service disruptions matching filters</p>
          <p className="text-sm text-slate-500 mt-1">Try resetting the Zone, Disruption Type, or Status filter above.</p>
        </div>
      )}

      {/* Chart Modal */}
      {chartOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => setChartOpen(false)}
        >
          <div 
            className="bg-[#090e21] border border-slate-800 rounded-2xl p-5 w-full max-w-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                {chartTitles[chartType]}
              </h3>
              <button 
                onClick={() => setChartOpen(false)} 
                className="p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData(chartType)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis 
                    dataKey="zone" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    axisLine={{ stroke: '#334155' }} 
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fill: '#94a3b8', fontSize: 12 }} 
                    axisLine={{ stroke: '#334155' }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    cursor={{ fill: '#1e293b' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {getChartData(chartType).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[chartType]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 font-medium">
              Based on {chartType === 'all' ? activeDisruptions.length : activeDisruptions.filter(d => d.disruptionType === chartType).length} active {chartType === 'all' ? 'advisories' : chartType.toLowerCase()} across Alberta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
