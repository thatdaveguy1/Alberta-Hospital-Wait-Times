import React, { useState, useMemo } from 'react';
import { 
  Building, 
  Clock, 
  MapPin, 
  Search, 
  AlertTriangle, 
  Info, 
  ChevronRight, 
  Sparkles,
  Calendar,
  Layers,
  FlaskConical,
  Activity,
  Award,
  CheckCircle,
  HelpCircle,
  FileText,
  Bookmark,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Map,
  Users
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  LAB_LOCATION_WAITS, 
  TEST_TURNAROUND_METRICS, 
  IMAGING_WAIT_TRENDS, 
  FACILITY_IMAGING_WAITS, 
  PRIORITY_TARGET_COMPLIANCE,
  LabLocationWait,
  TestTurnaround,
  ImagingWaitTrend,
  FacilityImagingWait,
  PriorityTarget
} from '../diagnosticData';

export default function DiagnosticDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'labs' | 'imaging-waits' | 'facilities' | 'turnaround' | 'bottlenecks'>('labs');
  
  // Interactive States
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [labSearch, setLabSearch] = useState<string>('');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [selectedModality, setSelectedModality] = useState<'CT Scan' | 'MRI Scan'>('MRI Scan');

  // Lab location filtering
  const filteredLabs = useMemo(() => {
    return LAB_LOCATION_WAITS.filter(lab => {
      const matchesRegion = selectedRegion === 'All' || lab.region === selectedRegion;
      const matchesSearch = lab.name.toLowerCase().includes(labSearch.toLowerCase()) || 
                            lab.city.toLowerCase().includes(labSearch.toLowerCase()) ||
                            lab.code.toLowerCase().includes(labSearch.toLowerCase());
      return matchesRegion && matchesSearch;
    });
  }, [selectedRegion, labSearch]);

  // Nearby alternative recommendation (high wait vs low wait same region)
  const labRecommendations = useMemo(() => {
    if (filteredLabs.length === 0) return [];
    
    // Find labs in same region with high waits (> 40 mins)
    const highWaitLabs = filteredLabs.filter(l => typeof l.waitTimeMin === 'number' && l.waitTimeMin > 35);
    
    return highWaitLabs.map(highLab => {
      // Find low wait alternatives in same region
      const alternatives = LAB_LOCATION_WAITS.filter(l => 
        l.region === highLab.region && 
        l.id !== highLab.id && 
        typeof l.waitTimeMin === 'number' && 
        l.waitTimeMin < 25
      );
      
      if (alternatives.length > 0) {
        // Pick best alternative
        const best = alternatives.reduce((prev, curr) => 
          (typeof prev.waitTimeMin === 'number' && typeof curr.waitTimeMin === 'number' && curr.waitTimeMin < prev.waitTimeMin) ? curr : prev
        );
        return {
          highLab,
          betterLab: best,
          savingMins: (highLab.waitTimeMin as number) - (best.waitTimeMin as number)
        };
      }
      return null;
    }).filter(item => item !== null) as { highLab: LabLocationWait; betterLab: LabLocationWait; savingMins: number }[];
  }, [filteredLabs]);

  // Facility filtering
  const filteredFacilities = useMemo(() => {
    return FACILITY_IMAGING_WAITS.filter(fac => {
      const matchesSearch = fac.facilityName.toLowerCase().includes(facilitySearch.toLowerCase()) || 
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.zone.toLowerCase().includes(facilitySearch.toLowerCase());
      return matchesSearch;
    });
  }, [facilitySearch]);

  // Historical data for selected modality
  const filteredTrendData = useMemo(() => {
    return IMAGING_WAIT_TRENDS.filter(trend => trend.modality === selectedModality);
  }, [selectedModality]);

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute left-1/4 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Diagnostic Services Console
              </span>
              <span className="text-xs text-slate-500">
                Data Refresh: Q1 2026 Release
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
              Diagnostic Imaging & Lab Access
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Live patient service center wait times, CT & MRI historical backlogs, national benchmark comparisons, and diagnostic turnaround-time diagnostic profiles.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('labs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'labs' 
                  ? 'bg-cyan-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Live Lab Waits
            </button>
            <button
              onClick={() => setActiveSubTab('imaging-waits')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'imaging-waits' 
                  ? 'bg-cyan-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CT & MRI Waits
            </button>
            <button
              onClick={() => setActiveSubTab('facilities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'facilities' 
                  ? 'bg-cyan-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Facility Access
            </button>
            <button
              onClick={() => setActiveSubTab('turnaround')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'turnaround' 
                  ? 'bg-cyan-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Test Turnaround
            </button>
            <button
              onClick={() => setActiveSubTab('bottlenecks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'bottlenecks' 
                  ? 'bg-cyan-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              System Bottlenecks
            </button>
          </div>
        </div>
      </div>

      {/* SUBTAB 1: Live Lab Waits */}
      {activeSubTab === 'labs' && (
        <div className="space-y-6">
          {/* Lab location filters & search */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'].map(region => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    selectedRegion === region
                      ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search labs by name, code or city..."
                value={labSearch}
                onChange={(e) => setLabSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Smart Redirect / Routing (High Waits vs Nearby low wait alternatives) */}
          {labRecommendations.length > 0 && (
            <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Active Lab Re-routing Suggestions</h3>
              </div>
              <p className="text-[10px] text-slate-500">
                Several community labs are currently experiencing peak wait volumes. Consider re-routing to alternative low-wait sites nearby to optimize check-in.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labRecommendations.slice(0, 2).map((item, index) => (
                  <div key={index} className="bg-slate-950/80 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 truncate">
                        <span className="line-through">{item.highLab.name}</span>
                        <span className="text-red-400 text-[10px] font-mono">({item.highLab.waitTimeMin}m wait)</span>
                      </div>
                      <div className="text-xs font-bold text-white flex items-center gap-1 truncate">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Route to {item.betterLab.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        Estimated transit saving of <strong>{item.savingMins} minutes</strong> wait duration.
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold block">
                        Wait: {item.betterLab.waitTimeMin}m
                      </span>
                      <a
                        href="https://mylabbooking.albertaprecisionlabs.ca/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[9px] text-cyan-400 hover:underline mt-1 block font-bold"
                      >
                        Queue Remotely
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lab wait list grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLabs.map(lab => {
              const waitIsNumber = typeof lab.waitTimeMin === 'number';
              
              // Color scale for wait times
              let badgeColor = 'bg-slate-900 text-slate-400 border-slate-800';
              if (waitIsNumber) {
                const wait = lab.waitTimeMin as number;
                if (wait <= 15) badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                else if (wait <= 30) badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                else if (wait <= 45) badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                else badgeColor = 'bg-red-500/10 text-red-400 border-red-500/20';
              } else if (lab.waitTimeMin === 'Appointments Only') {
                badgeColor = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
              } else {
                badgeColor = 'bg-slate-950 text-slate-600 border-slate-900';
              }

              return (
                <div key={lab.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{lab.name}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-600 shrink-0" />
                          <span className="truncate">{lab.address}, {lab.city}</span>
                        </p>
                      </div>

                      <span className="text-[10px] text-slate-500 font-mono font-semibold uppercase shrink-0">
                        {lab.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-850/60 pt-2 text-[11px]">
                      <span className="text-slate-400 font-medium">Estimated wait:</span>
                      <span className={`px-2 py-0.5 rounded border font-mono font-bold ${badgeColor}`}>
                        {waitIsNumber ? `${lab.waitTimeMin} mins` : lab.waitTimeMin}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                      <div className="bg-slate-950/40 p-1.5 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Peak Hours</span>
                        <span className="font-semibold text-slate-300">{lab.peakHours}</span>
                      </div>
                      <div className="bg-slate-950/40 p-1.5 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Daily Volume</span>
                        <span className="font-semibold text-slate-300">~{lab.dailyVolume} patients</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/60">
                    <div className="flex items-center gap-2">
                      {lab.walkInAvailable && (
                        <span className="text-[9px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded border border-slate-850 font-bold uppercase">
                          Walk-In
                        </span>
                      )}
                      {lab.appointmentRequired && (
                        <span className="text-[9px] bg-indigo-950 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-900/40 font-bold uppercase">
                          Appt Req
                        </span>
                      )}
                    </div>

                    {lab.saveMyPlaceAvailable && lab.waitTimeMin !== 'Closed' && (
                      <a
                        href="https://mylabbooking.albertaprecisionlabs.ca/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-all shadow-sm"
                      >
                        Save My Place
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredLabs.length === 0 && (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No community labs matched your search criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 2: CT & MRI Public Wait Times */}
      {activeSubTab === 'imaging-waits' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* National Wait Trends Comparison Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI CT & MRI Diagnostic Wait Days</h3>
                  <p className="text-[10px] text-slate-500">Comparing Alberta (P50 and P90 percentile days) against Canadian averages (2019 - 2025)</p>
                </div>

                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  {(['CT Scan', 'MRI Scan'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setSelectedModality(m)}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                        selectedModality === m 
                          ? 'bg-cyan-600 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredTrendData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorAlberta" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCanada" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#06b6d4" fillOpacity={1} fill="url(#colorAlberta)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanada)" strokeWidth={1.5} strokeDasharray="5 5" />
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#06b6d4" strokeWidth={1.5} dot />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#6366f1" strokeWidth={1} strokeDasharray="3 3" dot />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                💡 <strong>90th Percentile (P90):</strong> The number of days in which 90% of patients received their scan. High gaps between Median (P50) and P90 reflect structural wait-list accumulation for lower-priority outpatients.
              </p>
            </div>

            {/* Target compliance and CAR targets */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National CAR Performance Targets</h3>
                <p className="text-[10px] text-slate-500">Alberta wait-time compliance relative to Canadian Association of Radiologists standards</p>
              </div>

              <div className="space-y-3">
                {PRIORITY_TARGET_COMPLIANCE.map(item => (
                  <div key={item.priority} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{item.priority}</h4>
                        <span className="text-[9px] text-slate-500 block">Target maximum: <strong>{item.targetLimitText}</strong></span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">CT Compliance</span>
                        <span className={`font-mono font-bold ${item.albertaCtCompliancePct >= 90 ? 'text-emerald-400' : 'text-amber-500'}`}>{item.albertaCtCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${item.albertaCtCompliancePct}%` }} />
                      </div>

                      <div className="flex justify-between text-[9px] pt-1">
                        <span className="text-slate-400">MRI Compliance</span>
                        <span className={`font-mono font-bold ${item.albertaMriCompliancePct >= 90 ? 'text-emerald-400' : 'text-amber-500'}`}>{item.albertaMriCompliancePct}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${item.albertaMriCompliancePct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Imaging Facility Access */}
      {activeSubTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Facility Diagnostic Volume & Utilization</h3>
                <p className="text-[10px] text-slate-500">Individual medical-surgical hospital scanner statistics and local P50 / P90 wait ranges</p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search hospitals..."
                  value={facilitySearch}
                  onChange={(e) => setFacilitySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Facility list table */}
            <div className="overflow-x-auto border border-slate-850 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-bold">
                    <th className="p-3.5">Facility Name</th>
                    <th className="p-3.5">Zone</th>
                    <th className="p-3.5">CT Waits (P50/P90)</th>
                    <th className="p-3.5">MRI Waits (P50/P90)</th>
                    <th className="p-3.5">Annual Completed</th>
                    <th className="p-3.5">Scanner Util Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60">
                  {filteredFacilities.map(fac => (
                    <tr key={fac.facilityId} className="hover:bg-slate-950/40 text-slate-300">
                      <td className="p-3.5 font-bold text-white">{fac.facilityName}</td>
                      <td className="p-3.5 text-slate-400">{fac.zone}</td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{fac.ctP50WaitDays}d</span>
                        <span className="text-slate-500 text-[10px] ml-1">/ {fac.ctP90WaitDays}d</span>
                      </td>
                      <td className="p-3.5 font-mono">
                        <span className="text-white font-bold">{fac.mriP50WaitDays}d</span>
                        <span className="text-slate-500 text-[10px] ml-1">/ {fac.mriP90WaitDays}d</span>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-400">
                        {fac.annualCompletedExamsCount.toLocaleString()} scans
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${fac.scannerUtilizationPct}%` }} />
                          </div>
                          <span className="font-mono text-[10px] font-bold text-cyan-400">{fac.scannerUtilizationPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Lab Test Turnaround-Time Benchmarks */}
      {activeSubTab === 'turnaround' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Turnaround times bar chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Test Turnaround Duration Benchmarks</h3>
                  <p className="text-[10px] text-slate-500">Required specimen analytical processing timeline from collection to report</p>
                </div>
                <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: APL Test Directory
                </span>
              </div>

              {/* Recharts Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={TEST_TURNAROUND_METRICS}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="testName" stroke="#64748b" fontSize={9} interval={0} tickFormatter={(value) => value.length > 15 ? value.substring(0, 15) + '...' : value} />
                    <YAxis label={{ value: 'Turnaround Hours (STAT)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="statTurnaroundHrs" name="STAT / Critical Turnaround (Hours)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="routineTurnaroundDays" name="Routine Outpatient Turnaround (Days)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                🔬 <strong>Specialty Pathology:</strong> Note that major surgical pathologies (e.g. tumor margin check biopsies) suffer from a 5-day routine backlog due to systemic province-wide pathologist workforce limits.
              </p>
            </div>

            {/* Test directory collection catalog */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lab Test Catalog Specifications</h3>
                <p className="text-[10px] text-slate-500">Specimen and routing specifications for high-volume lab markers</p>
              </div>

              <div className="space-y-3">
                {TEST_TURNAROUND_METRICS.slice(0, 4).map(test => (
                  <div key={test.testName} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-white">{test.testName}</span>
                      <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded font-mono">
                        {test.category}
                      </span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Specimen Tube:</span>
                      <span className="text-slate-400 font-semibold">{test.specimenType}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Annual Volume:</span>
                      <span className="text-slate-400 font-semibold">~{test.volumePerYearMillions}M tests</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Diagnostic Bottlenecks & Auditor General Review */}
      {activeSubTab === 'bottlenecks' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-red-500" />
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" />
                <span>Decentralized Zone Intake</span>
              </div>
              <h4 className="text-sm font-bold text-white">Manual Referral Booking Schedulers</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                The Auditor General audit reports CT/MRI bookings remain highly decentralized and manual across individual health zones, resulting in significant administrative routing lag of up to 14 days before triage is complete.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-amber-500" />
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" />
                <span>Inconsistent Prioritization</span>
              </div>
              <h4 className="text-sm font-bold text-white">Non-Standardized Intake Triaging</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Triage guidelines (P1 - P4 scales) are applied inconsistently between metropolitan hospitals and rural diagnostic facilities, creating wide variance in wait-times for patients with equivalent urgency markers.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-blue-500" />
              <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4" />
                <span>Budget-vs-Demand Mismatch</span>
              </div>
              <h4 className="text-sm font-bold text-white">Decoupled Fiscal Allocations</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Diagnostic scanner operational budgets are allocated primarily based on historic facility spend rather than live wait-list pressure or local population expansion rates, leaving high-demand areas under-equipped.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AHS Strategic CT & MRI Recovery Commitments</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">Priority Action 1: Centralized Booking Intake</span>
                <p className="text-xs text-slate-300">
                  Consolidating CT/MRI booking requests into a single province-wide electronic portal. This prevents patients from being backlogged at one site while nearby scanners sit underutilized during evening shifts.
                </p>
              </div>

              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-2">
                <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">Priority Action 2: Operational Capacity Expansion</span>
                <p className="text-xs text-slate-300">
                  Expanding daily scanner operational hours to run 24/7 or late evening blocks at major trauma centres (UAH, FMC, RAH). This aims to clear the semi-urgent (P3) outpatient backlog.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
