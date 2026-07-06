import React, { useState, useMemo } from 'react';
import { 
  Home, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  CheckCircle2, 
  Calendar, 
  Info,
  Building,
  HeartHandshake,
  Activity,
  Award,
  Users,
  Clock,
  ShieldCheck,
  ChevronRight,
  ShieldAlert,
  SlidersHorizontal,
  XCircle,
  Building2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend
} from 'recharts';
import { 
  CONTINUING_CARE_PLACEMENT_STATS, 
  RESIDENT_QUALITY_OUTCOMES, 
  HOME_CARE_EXPERIENCE, 
  CONTINUING_CARE_COMPLIANCE,
  PlacementMetric,
  ResidentOutcomeQuality,
  HomeCareContinuity,
  CareFacilityCompliance
} from '../continuingCareData';
import { DataTimestamp } from './DataTimestamp';
import { _dataMetadata as continuingCareDataMetadata } from '../continuingCareData';

export default function ContinuingCareDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'placement' | 'resident-quality' | 'home-care' | 'compliance'>('placement');
  
  // Interactive Filters
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [operatorFilter, setOperatorFilter] = useState<string>('All');
  const [complianceSearch, setComplianceSearch] = useState<string>('');
  const [qualityMetricSelected, setQualityMetricSelected] = useState<string>('All');

  // Filter Placement Metrics by Zone
  const filteredPlacementData = useMemo(() => {
    if (selectedZone === 'All') {
      // average out by year or show all
      return CONTINUING_CARE_PLACEMENT_STATS.filter(p => p.zone === 'Calgary Zone' || p.zone === 'Edmonton Zone');
    }
    return CONTINUING_CARE_PLACEMENT_STATS.filter(p => p.zone === selectedZone);
  }, [selectedZone]);

  // Filter Quality Metrics
  const filteredQualityData = useMemo(() => {
    if (qualityMetricSelected === 'All') return RESIDENT_QUALITY_OUTCOMES;
    return RESIDENT_QUALITY_OUTCOMES.filter(q => q.metric === qualityMetricSelected);
  }, [qualityMetricSelected]);

  // Filter Compliance Directory
  const filteredCompliance = useMemo(() => {
    return CONTINUING_CARE_COMPLIANCE.filter(fac => {
      const matchesOperator = operatorFilter === 'All' || fac.operator === operatorFilter;
      const matchesSearch = fac.name.toLowerCase().includes(complianceSearch.toLowerCase()) ||
                            fac.city.toLowerCase().includes(complianceSearch.toLowerCase());
      return matchesOperator && matchesSearch;
    });
  }, [operatorFilter, complianceSearch]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalFacilities = CONTINUING_CARE_COMPLIANCE.length;
    const compliantCount = CONTINUING_CARE_COMPLIANCE.filter(f => f.standardsCompliant).length;
    const complianceRate = (compliantCount / totalFacilities) * 100;
    const totalViolations = CONTINUING_CARE_COMPLIANCE.reduce((acc, curr) => acc + curr.violationsCount, 0);
    return { totalFacilities, complianceRate, totalViolations };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            <span>Continuing & Long Term Care</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor facility placement timelines, quality outcomes, and standards compliance.
          </p>
          <DataTimestamp metadata={continuingCareDataMetadata} arrayKey="CONTINUING_CARE_PLACEMENT_STATS" />
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('placement')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'placement'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Placement & Flow</span>
        </button>
        <button
          onClick={() => setActiveSubTab('resident-quality')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'resident-quality'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical Quality</span>
        </button>
        <button
          onClick={() => setActiveSubTab('home-care')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'home-care'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Home Care Continuity</span>
        </button>
        <button
          onClick={() => setActiveSubTab('compliance')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'compliance'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Compliance Registry</span>
        </button>
      </div>

      {/* SUBTAB 1: Placement & Flow (HQA FOCUS) */}
      {activeSubTab === 'placement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Avg Placement Within 30 Days</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">57.3%</span>
                <span className="text-xs text-slate-400 font-mono">Target: 60%+</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Gradual recovery seen in 2025 as capacity expands but rural placement targets remain strained.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Median Wait Days (Calgary & Edmonton)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">25 days</span>
                <span className="text-xs text-slate-400 font-mono">P50 benchmark</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Wait times decreased from a peak average of 36 days in 2023 through proactive transitional care.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Preferred Option Placement Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-teal-400">67.5%</span>
                <span className="text-xs text-slate-400 font-mono">Target: 70%+</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Improves resident and family experience scores significantly when accommodation choices are respected.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Placement Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Wait times & Placement Timelines</h3>
                  <p className="text-[10px] text-slate-500">Tracking median (P50) and 90th percentile (P90) wait times from assessment to placement</p>
                </div>

                <div className="relative">
                  <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="All">Calgary & Edmonton (Combined)</option>
                    <option value="Calgary Zone">Calgary Zone Only</option>
                    <option value="Edmonton Zone">Edmonton Zone Only</option>
                    <option value="North Zone">North Zone Only</option>
                  </select>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredPlacementData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="daysWaitingP90" name="90th Percentile Wait (Days)" stroke="#ef4444" fillOpacity={1} fill="url(#colorP90)" strokeWidth={2} />
                    <Area type="monotone" dataKey="daysWaitingP50" name="Median Wait (Days)" stroke="#10b981" fillOpacity={1} fill="url(#colorP50)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Core indicators summary */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Flow & Preferred Options</h3>
                <p className="text-[10px] text-slate-500">Evaluating percent placed into preferred facilities</p>
              </div>

              <div className="space-y-4">
                {filteredPlacementData.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center text-xs font-bold text-white">
                      <span>{item.zone} ({item.year})</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                        P50: {item.daysWaitingP50}d
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Placed in 30 days:</span>
                        <span className="font-semibold text-slate-200">{item.pctPlacedWithin30Days}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${item.pctPlacedWithin30Days}%` }} />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Preferred option met:</span>
                        <span className="font-semibold text-slate-200">{item.pctPlacedPreferredOption}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                        <div className="bg-teal-500 h-full" style={{ width: `${item.pctPlacedPreferredOption}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Hospital Gridlock Factor:</strong> Delayed placement in Type A facilities locks Alternate Level of Care (ALC) beds, causing emergency room backlogs.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Resident quality outcomes (CIHI LTC Indicators) */}
      {activeSubTab === 'resident-quality' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={continuingCareDataMetadata} arrayKey="RESIDENT_QUALITY_OUTCOMES" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI Clinical Care Quality Indicators</h3>
              <p className="text-[10px] text-slate-500">Comparative safety and effectiveness outcomes across Alberta facilities</p>
            </div>

            <div className="relative">
              <select
                value={qualityMetricSelected}
                onChange={(e) => setQualityMetricSelected(e.target.value)}
                className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="All">All Quality Indicators</option>
                <option value="Inappropriate Antipsychotic Use">Potentially Inappropriate Antipsychotics</option>
                <option value="Falls in Last 30 Days">Falls in Last 30 Days</option>
                <option value="Physical Restraint Daily Use">Daily Physical Restraints</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Outcomes Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Long-Term Resident Quality Prevalence (%)</h4>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredQualityData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="albertaRatePct" name="Alberta Prevalence Rate" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="canadaRatePct" name="Canadian National Average" fill="#475569" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-850/60 rounded-xl flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  💡 <strong>Improvement Trend:</strong> Restraint usage decreased to 3.8% in 2025 due to Covenant and AHS-wide audits matching "least restraint" provincial care policies.
                </p>
              </div>
            </div>

            {/* Quality Summary list */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Quality Benchmarks Breakdown</h4>
              
              <div className="space-y-3.5">
                {RESIDENT_QUALITY_OUTCOMES.filter((_, i) => i % 3 === 2).map((item, idx) => (
                  <div key={idx} className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{item.metric}</span>
                      <Award className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                      <div>
                        <span>Alberta (2025):</span>
                        <p className="text-lg font-bold text-emerald-400">{item.albertaRatePct}%</p>
                      </div>
                      <div>
                        <span>Canada (2025):</span>
                        <p className="text-lg font-bold text-slate-400">{item.canadaRatePct}%</p>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-500 italic">
                      Lower rates represent safer, higher-quality, and more restorative care plans.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Home care client experience (HQA FOCUS Survey) */}
      {activeSubTab === 'home-care' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={continuingCareDataMetadata} arrayKey="HOME_CARE_EXPERIENCE" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {HOME_CARE_EXPERIENCE.map((exp, idx) => {
              const isProvincial = exp.zone === 'Alberta';
              return (
                <div 
                  key={idx} 
                  className={`border p-4 rounded-xl space-y-3 flex flex-col justify-between ${
                    isProvincial 
                      ? 'bg-emerald-950/25 border-emerald-500/30 ring-1 ring-emerald-500/20' 
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-black text-white">{exp.zone}</h4>
                      {isProvincial && (
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase font-mono">
                          Provincial Baseline
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 pt-1.5">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Overall Care Rating 9/10:</span>
                        <strong className="text-slate-200">{exp.overallCareRatingPct}%</strong>
                      </div>
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${exp.overallCareRatingPct}%` }} />
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Clients with Unmet Service Needs:</span>
                        <strong className="text-rose-400">{exp.unmetNeedsPct}%</strong>
                      </div>
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                        <div className="bg-rose-500 h-full" style={{ width: `${exp.unmetNeedsPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] pt-3 border-t border-slate-850/60 text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Workers seen (Avg):</span>
                    </span>
                    <strong className="text-slate-300 font-mono font-bold">{exp.differentStaffCountAverage} workers</strong>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <HeartHandshake className="w-4.5 h-4.5 text-emerald-400" />
                <span>The Turnover & Professional Continuity Gap</span>
              </h4>
              <p className="text-xs text-slate-400 max-w-4xl">
                HQA FOCUS surveys show that clients seeing an average of 11+ different support workers in a 6-month period 
                record up to 40% lower satisfaction rates and face higher medication-mishap occurrence risks.
              </p>
            </div>

            <span className="text-[10px] bg-slate-950/60 border border-slate-850 px-3 py-2 rounded-xl text-slate-500 shrink-0 font-mono">
              Survey Cohort: Apr - Sep 2024
            </span>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Compliance Registry (Open Alberta) */}
      {activeSubTab === 'compliance' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'AHS', 'Covenant Health', 'Private/Contracted', 'Non-Profit'].map(operator => (
                <button
                  key={operator}
                  onClick={() => setOperatorFilter(operator)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    operatorFilter === operator
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {operator}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search facility name or city..."
                value={complianceSearch}
                onChange={(e) => setComplianceSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Monitored Facilities</span>
              <span className="text-xl font-bold text-white">{aggregateStats.totalFacilities} sites audited</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Accommodation Standards Pass</span>
              <span className="text-xl font-bold text-emerald-400">{aggregateStats.complianceRate.toFixed(1)}% compliant</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Total standards violations</span>
              <span className="text-xl font-bold text-rose-400">{aggregateStats.totalViolations} violations found</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Auditing schedule</span>
              <span className="text-sm font-bold text-slate-300">Quarterly updates (March 2026 release)</span>
            </div>
          </div>

          {/* Compliance List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCompliance.map(fac => {
              return (
                <div key={fac.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{fac.name}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="truncate">{fac.city} • {fac.zone}</span>
                        </p>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${
                        fac.standardsCompliant
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {fac.standardsCompliant ? 'COMPLIANT' : 'VIOLATION'}
                      </span>
                    </div>

                    <div className="space-y-2 text-[10px] bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Facility Type:</span>
                        <span className="font-semibold text-slate-300 truncate">{fac.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Operator:</span>
                        <span className="font-semibold text-slate-300">{fac.operator}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Inspection:</span>
                        <span className="font-semibold text-slate-400">{fac.lastInspectionDate}</span>
                      </div>
                    </div>

                    {!fac.standardsCompliant && fac.majorViolationsDesc && (
                      <div className="bg-rose-950/30 border border-rose-500/20 rounded p-2.5 flex items-start gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-rose-300 font-medium leading-normal">{fac.majorViolationsDesc}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-[10px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{fac.violationsCount} infractions logged</span>
                    </span>

                    <a
                      href="https://www.alberta.ca/continuing-care-accommodation-inspections"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold px-3 py-1.5 rounded-lg bg-emerald-650 hover:bg-emerald-600 text-white transition-all text-center"
                    >
                      Verify Status
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredCompliance.length === 0 && (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No audited facilities matched your search parameters.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
