import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Search, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Activity, 
  SlidersHorizontal,
  Info,
  ExternalLink,
  BarChart3,
  RefreshCw
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
import { useSyncStatus, getDomainResult } from '../hooks/useSyncStatus';
import { DashboardHeader } from './DashboardHeader';
import { cn } from '../lib/utils';
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
      lastUpdated: lastSyncTime || undefined,
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
      setError('Unable to reach service disruptions feed.');
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
    all: 'oklch(0.75 0.14 25)',
    Closure: 'oklch(0.75 0.14 25)',
    'Reduced Hours': 'oklch(0.82 0.12 85)',
    'Bed Reduction': 'oklch(0.68 0.13 252)',
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
    <div className="space-y-4">
      <DashboardHeader
        icon={ShieldAlert}
        title="Temporary Service Disruptions"
        description="Monitor active health facility advisories and service disruptions across Alberta (updated daily)."
        metadata={metadata}
        arrayKey="disruptions"
        variant="light"
      >
        <button
          onClick={() => !loading && fetchDisruptions()}
          disabled={loading}
          className="self-start md:self-auto rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </DashboardHeader>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => openChart('all')}
          className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:bg-paper hover:border-line-2 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink-3">Active Advisories</span>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-paper border border-line rounded-lg">
                <AlertTriangle className="w-4 h-4 text-crit" />
              </div>
              <div className="p-1 bg-paper border border-line rounded text-ink-3 group-hover:text-ink transition-colors">
                <BarChart3 className="w-3 h-3" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink leading-none">{activeDisruptions.length}</p>
          <p className="text-xs text-ink-3 mt-1 font-medium flex items-center gap-1">
            Click for zone breakdown
            <BarChart3 className="w-3 h-3 text-ink-3 group-hover:text-crit transition-colors" />
          </p>
        </button>

        <button
          onClick={() => openChart('Closure')}
          className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:bg-paper hover:border-line-2 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink-3">Full Site Closures</span>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-paper border border-line rounded-lg">
                <ShieldAlert className="w-4 h-4 text-crit" />
              </div>
              <div className="p-1 bg-paper border border-line rounded text-ink-3 group-hover:text-ink transition-colors">
                <BarChart3 className="w-3 h-3" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink leading-none">{totalClosures}</p>
          <p className="text-xs text-ink-3 mt-1 font-medium flex items-center gap-1">
            Click for zone breakdown
            <BarChart3 className="w-3 h-3 text-ink-3 group-hover:text-crit transition-colors" />
          </p>
        </button>

        <button
          onClick={() => openChart('Reduced Hours')}
          className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:bg-paper hover:border-line-2 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink-3">Reduced Hours</span>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-paper border border-line rounded-lg">
                <Clock className="w-4 h-4 text-warn" />
              </div>
              <div className="p-1 bg-paper border border-line rounded text-ink-3 group-hover:text-ink transition-colors">
                <BarChart3 className="w-3 h-3" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink leading-none">{totalReduced}</p>
          <p className="text-xs text-ink-3 mt-1 font-medium flex items-center gap-1">
            Click for zone breakdown
            <BarChart3 className="w-3 h-3 text-ink-3 group-hover:text-warn transition-colors" />
          </p>
        </button>

        <button
          onClick={() => openChart('Bed Reduction')}
          className="rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:bg-paper hover:border-line-2 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ink-3">Bed/Specialty Reductions</span>
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 bg-paper border border-line rounded-lg">
                <Activity className="w-4 h-4 text-accent" />
              </div>
              <div className="p-1 bg-paper border border-line rounded text-ink-3 group-hover:text-ink transition-colors">
                <BarChart3 className="w-3 h-3" />
              </div>
            </div>
          </div>
          <p className="text-2xl font-semibold font-mono tabular-nums text-ink leading-none">{totalBeds}</p>
          <p className="text-xs text-ink-3 mt-1 font-medium flex items-center gap-1">
            Click for zone breakdown
            <BarChart3 className="w-3 h-3 text-ink-3 group-hover:text-accent transition-colors" />
          </p>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="rounded-xl border border-line bg-surface p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="Search disruptions by facility, city, service or reason..."
              className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0">
            <div className="relative w-full sm:w-44">
              <select
                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-paper pl-3 pr-10 text-sm text-ink focus:border-accent focus:outline-none"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                {zones.map(z => (
                  <option key={z} value={z}>{z === 'All' ? 'All Zones' : z}</option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>

            <div className="relative w-full sm:w-48">
              <select
                className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-line bg-paper pl-3 pr-10 text-sm text-ink focus:border-accent focus:outline-none"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {types.map(t => (
                  <option key={t} value={t}>{t === 'All' ? 'All Disruptions' : t}</option>
                ))}
              </select>
              <SlidersHorizontal className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3 flex-wrap gap-3">
          <div className="inline-flex rounded-lg border border-line bg-paper p-0.5" role="tablist" aria-label="Status filter">
            <button
              onClick={() => setSelectedStatus('Active')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                selectedStatus === 'Active' ? 'bg-crit text-white' : 'text-ink-2 hover:text-ink'
              )}
            >
              Active Advisories ({disruptions.filter(d => d.status === 'Active').length})
            </button>
            <button
              onClick={() => setSelectedStatus('Resolved')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                selectedStatus === 'Resolved' ? 'bg-ok text-white' : 'text-ink-2 hover:text-ink'
              )}
            >
              Resolved History ({disruptions.filter(d => d.status === 'Resolved').length})
            </button>
            <button
              onClick={() => setSelectedStatus('All')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                selectedStatus === 'All' ? 'bg-neutral-chip text-ink' : 'text-ink-2 hover:text-ink'
              )}
            >
              All Records ({disruptions.length})
            </button>
          </div>

          <span className="text-xs font-medium text-ink-3">
            Displaying {filteredDisruptions.length} matching events
          </span>
        </div>
      </div>

      {/* Disruption Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse rounded-xl border border-line bg-surface p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-48 bg-neutral-chip rounded-md" />
                <div className="h-5 w-24 bg-neutral-chip rounded-md" />
              </div>
              <div className="h-3 w-36 bg-neutral-chip rounded-md" />
              <div className="h-10 w-full bg-neutral-chip rounded-md" />
            </div>
          ))}
        </div>
      ) : filteredDisruptions.length > 0 ? (
        <div className="space-y-3">
          {filteredDisruptions.map(disr => {
            const isExpanded = expandedId === disr.id;
            const isActive = disr.status === 'Active';

            const tone = isActive
              ? disr.disruptionType === 'Closure' || disr.disruptionType === 'Service Suspension'
                ? 'bg-crit-soft text-crit'
                : disr.disruptionType === 'Reduced Hours'
                  ? 'bg-warn-soft text-warn'
                  : disr.disruptionType === 'Bed Reduction'
                    ? 'bg-accent-soft text-accent-strong'
                    : 'bg-neutral-chip text-ink-2'
              : 'bg-ok-soft text-ok';

            return (
              <div
                key={disr.id}
                onClick={() => toggleExpand(disr.id)}
                className={cn(
                  'rounded-xl border bg-surface overflow-hidden cursor-pointer transition-colors',
                  isExpanded ? 'border-accent ring-1 ring-accent/20' : 'border-line hover:bg-paper'
                )}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink leading-tight truncate">{disr.facilityName}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-neutral-chip text-ink-2 text-xs font-medium">
                        {disr.zone}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-ink-3" aria-hidden />
                        {disr.city}, AB
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-ink-3" aria-hidden />
                        Started: {formatDate(disr.startDate)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-ink-3" aria-hidden />
                        Ended: {disr.endDate === 'Ongoing' ? <span className="text-crit font-medium">Ongoing</span> : formatDate(disr.endDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-start sm:items-end gap-2.5 shrink-0 w-full sm:w-auto border-t border-line pt-3 sm:pt-0 sm:border-0 justify-between sm:justify-start">
                    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium border border-line', tone)}>
                      {isActive ? `${disr.disruptionType}: ${disr.serviceAffected}` : 'Resolved'}
                    </span>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <button
                          onClick={(e) => handleResolve(disr.id, e)}
                          className="px-2.5 py-1 rounded-lg border border-line-2 bg-surface text-xs font-medium text-ink-2 hover:bg-paper transition-colors cursor-pointer"
                          title="Mark this disruption as resolved"
                        >
                          Resolve
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-accent" aria-hidden />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-ink-3" aria-hidden />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-line bg-paper p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
                        <h4 className="text-xs font-semibold text-crit flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                          Disruption Advisory
                        </h4>
                        <div className="space-y-1 text-sm text-ink-2 leading-relaxed">
                          <p>
                            <span className="text-ink-3">Affected Department:</span>{' '}
                            <span className="text-ink font-medium">{disr.serviceAffected}</span>
                          </p>
                          <p>
                            <span className="text-ink-3">Primary Reason:</span>{' '}
                            <span className="text-ink font-medium">{disr.reason}</span>
                          </p>
                          <p className="mt-2 rounded-lg border border-line bg-paper p-2.5 text-xs text-ink-2 font-medium leading-relaxed">
                            {disr.details}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-line bg-surface p-3.5 space-y-2">
                        <h4 className="text-xs font-semibold text-accent flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" aria-hidden />
                          Patient Divert & Alternative Care
                        </h4>
                        <div className="text-sm text-ink-2 leading-relaxed space-y-2">
                          {disr.alternativeCare ? (
                            <p className="text-xs rounded-lg border border-line bg-paper p-2.5 text-ink font-medium leading-relaxed">
                              {disr.alternativeCare}
                            </p>
                          ) : (
                            <p className="text-xs text-ink-3 leading-relaxed">
                              No facility-specific divert guidance was published on the AHS advisory. See the official AHS page for details. In emergencies dial 911.
                            </p>
                          )}
                          <p className="text-xs text-ink-3 leading-relaxed">
                            Zone and disruption type are inferred from city maps / keywords when not explicit on the page.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-3">
                      <span>Advisory record ID: {disr.id} | Last Sync: {formatDate(disr.updatedAt)}</span>
                      {disr.sourceUrl && disr.sourceUrl.startsWith('http') && (
                        <a
                          href={disr.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-strong transition-colors"
                        >
                          <span>Official AHS Advisory Webpage</span>
                          <ExternalLink className="w-3 h-3" aria-hidden />
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
        <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center">
          <Info className="w-12 h-12 mx-auto mb-4 text-ink-3" aria-hidden />
          <p className="text-lg font-semibold text-ink">No active service disruptions matching filters</p>
          <p className="text-sm text-ink-3 mt-1">Try resetting the Zone, Disruption Type, or Status filter above.</p>
        </div>
      )}

      {/* Chart Modal */}
      {chartOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setChartOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-xl border border-line bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-accent" aria-hidden />
                {chartTitles[chartType]}
              </h3>
              <button
                onClick={() => setChartOpen(false)}
                className="p-1 rounded-lg text-ink-3 hover:text-ink hover:bg-paper transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData(chartType)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.02 255)" vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 12 }}
                    axisLine={{ stroke: 'oklch(0.28 0.02 255)' }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'oklch(0.62 0.02 255)', fontSize: 12 }}
                    axisLine={{ stroke: 'oklch(0.28 0.02 255)' }}
                  />
                  <Tooltip
                    cursor={{ fill: 'oklch(0.16 0.02 255 / 0.5)' }}
                    contentStyle={{
                      backgroundColor: 'oklch(0.2 0.022 255)',
                      border: '1px solid oklch(0.28 0.02 255)',
                      borderRadius: '8px',
                    }}
                    itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                    labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {getChartData(chartType).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[chartType]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-ink-3 mt-3 font-medium">
              Based on {chartType === 'all' ? activeDisruptions.length : activeDisruptions.filter(d => d.disruptionType === chartType).length} active {chartType === 'all' ? 'advisories' : chartType.toLowerCase()} across Alberta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
