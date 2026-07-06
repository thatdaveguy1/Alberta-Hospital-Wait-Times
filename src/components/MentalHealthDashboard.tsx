import React, { useState, useMemo } from 'react';
import { 
  Brain, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  Calendar, 
  Info,
  ChevronRight,
  Heart,
  Layers,
  ShieldAlert,
  PhoneCall,
  Activity,
  Award,
  Users,
  Clock,
  ShieldCheck
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
  SUBSTANCE_HARM_TRENDS, 
  ADDICTION_BED_CAPACITIES, 
  COMMUNITY_MH_WAITS, 
  HOSPITAL_MHSU_BURDEN, 
  SUPPORT_HELPLINES,
  SubstanceHarmTrend,
  AddictionBedStatus,
  CommunityMHWait,
  HospitalMHSUBurden
} from '../mentalHealthData';
import { DataTimestamp } from './DataTimestamp';
import { _dataMetadata as mentalHealthDataMetadata } from '../mentalHealthData';

export default function MentalHealthDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'substance-harms' | 'addiction-beds' | 'community-access' | 'er-pressure' | 'helplines'>('substance-harms');
  
  // Interactive Filters
  const [selectedSubstance, setSelectedSubstance] = useState<'Opioids' | 'Stimulants'>('Opioids');
  const [corridorFilter, setCorridorFilter] = useState<string>('All');
  const [bedTypeFilter, setBedTypeFilter] = useState<string>('All');
  const [siteSearch, setSiteSearch] = useState<string>('');
  const [waitAgeGroup, setWaitAgeGroup] = useState<string>('All');

  // Filter Harm Trends
  const filteredHarmData = useMemo(() => {
    return SUBSTANCE_HARM_TRENDS.filter(t => t.substanceType === selectedSubstance);
  }, [selectedSubstance]);

  // Aggregate bed capacity stats
  const bedStats = useMemo(() => {
    const total = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.totalBeds, 0);
    const available = ADDICTION_BED_CAPACITIES.reduce((acc, curr) => acc + curr.availableBeds, 0);
    const pctOccupied = ((total - available) / total) * 100;
    return { total, available, pctOccupied };
  }, []);

  // Filter ABED Beds
  const filteredBeds = useMemo(() => {
    return ADDICTION_BED_CAPACITIES.filter(bed => {
      const matchesCorridor = corridorFilter === 'All' || bed.corridor === corridorFilter;
      const matchesBedType = bedTypeFilter === 'All' || bed.bedType === bedTypeFilter;
      const matchesSearch = bed.siteName.toLowerCase().includes(siteSearch.toLowerCase()) || 
                            bed.corridor.toLowerCase().includes(siteSearch.toLowerCase());
      return matchesCorridor && matchesBedType && matchesSearch;
    });
  }, [corridorFilter, bedTypeFilter, siteSearch]);

  // Filter Counselling Waits
  const filteredWaits = useMemo(() => {
    if (waitAgeGroup === 'All') return COMMUNITY_MH_WAITS;
    return COMMUNITY_MH_WAITS.filter(w => w.ageGroup === waitAgeGroup);
  }, [waitAgeGroup]);

  // Helper to color-code bed status
  const getBedStatusStyle = (status: 'Available' | 'Almost Full' | 'Full') => {
    switch (status) {
      case 'Available':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Almost Full':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Full':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <span>Mental Health & Addictions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track substance use harms, treatment bed capacity, and helpline volumes.
          </p>
          <DataTimestamp metadata={mentalHealthDataMetadata} arrayKey="SUBSTANCE_HARM_TRENDS" />
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('substance-harms')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'substance-harms'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Substance Harms</span>
        </button>
        <button
          onClick={() => setActiveSubTab('addiction-beds')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'addiction-beds'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Addiction Beds</span>
        </button>
        <button
          onClick={() => setActiveSubTab('community-access')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'community-access'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Community Access</span>
        </button>
        <button
          onClick={() => setActiveSubTab('er-pressure')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'er-pressure'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>ER Pressure</span>
        </button>
        <button
          onClick={() => setActiveSubTab('helplines')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'helplines'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Crisis Helplines</span>
        </button>
      </div>

      {/* SUBTAB 1: Overdose & Substance Harms */}
      {activeSubTab === 'substance-harms' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Alberta Apparent Opioid Deaths (2025)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-500">~1,350</span>
                <span className="text-xs text-slate-400 font-mono">deaths</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Gradual reduction from the record 2023 surge (~1,850 deaths) following active expansion of Recovery Communities.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Emergency EMS overdose dispatches</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-violet-400">~7,850</span>
                <span className="text-xs text-slate-400 font-mono">annual responses</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Opioid agonist treatments and rapid naloxone kit distribution networks help suppress overall fatality curves.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Alberta vs Canada Toxicity Burden (2025)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">29.1</span>
                <span className="text-xs text-slate-400 font-mono">vs 18.4 per 100k</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-850">
                Alberta remains significantly above the national averages due to systemic high-potency non-pharmaceutical drug supplies.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Harms Trend Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Substance-Induced Toxicity & Overdose Harms</h3>
                  <p className="text-[10px] text-slate-500">Comparing toxicological outcomes and emergency EMS calls by category</p>
                </div>

                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => setSelectedSubstance('Opioids')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      selectedSubstance === 'Opioids' ? 'bg-purple-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Opioids (Fentanyl / Carfentanil)
                  </button>
                  <button
                    onClick={() => setSelectedSubstance('Stimulants')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      selectedSubstance === 'Stimulants' ? 'bg-purple-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Stimulants (Meth / Cocaine)
                  </button>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredHarmData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorDeaths" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorEMS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="apparentDeaths" name="Apparent Toxicity Deaths" stroke="#e11d48" fillOpacity={1} fill="url(#colorDeaths)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="emsOverdoseResponses" name="EMS Suspected Overdose Calls" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorEMS)" strokeWidth={1.5} />
                    <Line type="monotone" dataKey="hospitalizations" name="Poisoning Hospital Admissions" stroke="#10b981" strokeWidth={2} dot />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* In-depth Mortality Risk Rates */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Toxicity Rates per 100,000</h3>
                  <p className="text-[10px] text-slate-500">Alberta vs Canadian national averages</p>
                </div>

                <div className="space-y-3 pt-1">
                  {filteredHarmData.map(item => (
                    <div key={item.year} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-bold text-white">
                        <span>Year {item.year}</span>
                        <span className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded font-mono">
                          {item.apparentDeaths} deaths
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Alberta rate</span>
                          <span className="font-mono text-slate-200 font-bold">{item.albertaRatePer100k} per 100k</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-400">Canada rate</span>
                          <span className="font-mono text-slate-500">{item.canadaRatePer100k} per 100k</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden mt-1.5">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(item.albertaRatePer100k / 45) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-850 pt-3 flex items-start gap-1.5">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Surveillance Notice:</strong> Subscriptions, clinical toxicology diagnostics, and medical examiner findings contribute to registry backlogs which update retroactively.
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Daily Bed Capacity (findaddictionbeds.alberta.ca) */}
      {activeSubTab === 'addiction-beds' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={mentalHealthDataMetadata} arrayKey="ADDICTION_BED_CAPACITIES" />
          {/* Bed search & corridor filters */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['All', 'Calgary Corridor', 'Edmonton Corridor', 'Central Corridor', 'South Corridor', 'North Corridor'].map(corr => (
                <button
                  key={corr}
                  onClick={() => setCorridorFilter(corr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    corridorFilter === corr
                      ? 'bg-purple-600 border-purple-500 text-white shadow-sm'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {corr.replace(' Corridor', '')}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search bed providers or sites..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Bed occupancies summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">ABED Active Sites</span>
              <span className="text-xl font-bold text-white">{ADDICTION_BED_CAPACITIES.length} registered sites</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Total Bed Allocation</span>
              <span className="text-xl font-bold text-white">{bedStats.total} beds</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Available Beds Today</span>
              <span className="text-xl font-bold text-emerald-400">{bedStats.available} vacancies</span>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider font-extrabold block">Avg System Bed Occupancy</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white">{bedStats.pctOccupied.toFixed(1)}%</span>
                <div className="w-16 bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                  <div className="bg-purple-500 h-full" style={{ width: `${bedStats.pctOccupied}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bed List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredBeds.map(bed => {
              return (
                <div key={bed.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-4">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{bed.siteName}</h4>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                          <span className="truncate">{bed.corridor}</span>
                        </p>
                      </div>

                      <span className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold shrink-0 ${getBedStatusStyle(bed.status)}`}>
                        {bed.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-slate-850/60">
                      <div className="bg-slate-950/40 p-2 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Care Bed Type</span>
                        <span className="font-semibold text-slate-300 truncate">{bed.bedType}</span>
                      </div>
                      <div className="bg-slate-950/40 p-2 rounded flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase">Gender / Age</span>
                        <span className="font-semibold text-slate-300 truncate">{bed.gender} • {bed.bedType === 'Youth Specific' ? 'Youth' : 'Adult'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-slate-950/60 p-2 rounded-lg border border-slate-850/60">
                      <span className="text-slate-400">Available Beds:</span>
                      <strong className="text-slate-200 font-mono font-black">{bed.availableBeds} / {bed.totalBeds}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-850/60 text-[10px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{bed.lastUpdated}</span>
                    </span>

                    <a
                      href="https://recoveryaccessalberta.ca/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all text-center"
                    >
                      Triage Intake
                    </a>
                  </div>
                </div>
              );
            })}

            {filteredBeds.length === 0 && (
              <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-slate-400 text-xs">No active treatment or recovery beds matched your search parameters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: Community MH Counselling (CIHI Indicators) */}
      {activeSubTab === 'community-access' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={mentalHealthDataMetadata} arrayKey="COMMUNITY_MH_WAITS" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Counselling waits chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Community Mental Health Waiting Durations</h3>
                  <p className="text-[10px] text-slate-500">Wait times from intake referral to first integrated counseling session (days)</p>
                </div>

                <div className="relative">
                  <select
                    value={waitAgeGroup}
                    onChange={(e) => setWaitAgeGroup(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="All">All Age Cohorts</option>
                    <option value="Children & Youth (5-17)">Children & Youth (5-17)</option>
                    <option value="Adults (18+)">Adults (18+)</option>
                  </select>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredWaits}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="albertaMedianWaitDays" name="Alberta Median Wait" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="albertaP90WaitDays" name="Alberta 90th Percentile Wait" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="canadaMedianWaitDays" name="Canada Median Wait" fill="#4b5563" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3.5 bg-slate-950/60 border border-slate-850/60 rounded-xl flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
                <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  💡 <strong>Early Intervention:</strong> 2025 metrics show improved youth counselling waits (Median down to 21 days) following targeted regional pilot schemes and virtual outpatient intake support frameworks.
                </p>
              </div>
            </div>

            {/* Unmet care needs panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Unmet Care Need Gaps</h3>
                <p className="text-[10px] text-slate-500">Percent reporting unmet mental health care demands</p>
              </div>

              <div className="space-y-3.5">
                {filteredWaits.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                    <div className="flex justify-between text-xs font-bold text-white">
                      <span>{item.ageGroup}</span>
                      <span className="text-purple-400 font-mono font-extrabold">{item.year}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Unmet need rate:</span>
                        <strong className="text-rose-400 font-mono font-bold">{item.unmetNeedPct}%</strong>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${item.unmetNeedPct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center gap-2 text-[10px] text-slate-500">
                <Award className="w-5 h-5 text-purple-400 shrink-0" />
                <span className="font-semibold text-purple-300">Reducing waiting times directly coordinates with reduced emergency department presentations.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: ER & Hospital Pressure */}
      {activeSubTab === 'er-pressure' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={mentalHealthDataMetadata} arrayKey="HOSPITAL_MHSU_BURDEN" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Readmissions & ER Overloads */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Mental Health System Readmission & ER Metrics</h3>
                <p className="text-[10px] text-slate-500">Percentage of mental health & substance use (MHSU) patients requiring recurrent acute interventions</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={HOSPITAL_MHSU_BURDEN}
                    margin={{ top: 10, right: 15, left: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="albertaRatePct" name="Alberta Rate %" stroke="#a78bfa" strokeWidth={2.5} dot />
                    <Line type="monotone" dataKey="canadaRatePct" name="Canadian National Average %" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                ⚠️ <strong>Recurring Acute Burden:</strong> Higher rates of repeat hospital presentations (recurrent within 30 days) often indicate gaps in post-discharge community stabilization, and primary-care attachment barriers.
              </p>
            </div>

            {/* Inpatient counts panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Acute Cohort Overloads</h3>
                  <p className="text-[10px] text-slate-500">Annual inpatient occurrences and clinical admissions volumes</p>
                </div>

                <div className="space-y-3 pt-1">
                  {HOSPITAL_MHSU_BURDEN.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-extrabold">{item.metric}</span>
                      <div className="flex justify-between items-baseline">
                        <span className="text-lg font-black text-white">{(item.annualCount).toLocaleString()} cases</span>
                        <span className="text-[10px] text-purple-400 font-mono font-bold">({item.year})</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>AB Rate: {item.albertaRatePct}%</span>
                        <span>CA Avg: {item.canadaRatePct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 flex items-start gap-1.5">
                <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Triage Goal:</strong> Discharges coordinated with mental-health coordinators within 7 days reduce the likelihood of recurrence by up to 30%.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Helplines & Support Pathways */}
      {activeSubTab === 'helplines' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={mentalHealthDataMetadata} arrayKey="SUPPORT_HELPLINES" />
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Crisis Helplines & Navigation Pathways</h3>
              <p className="text-[10px] text-slate-500">Immediate, toll-free mental health support services available to Alberta residents</p>
            </div>

            {/* Helpline cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SUPPORT_HELPLINES.map((hl, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-3 hover:border-purple-500/40 transition-all">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <PhoneCall className="w-4 h-4 text-purple-400" />
                        <span>{hl.name}</span>
                      </h4>
                      <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                        {hl.availability}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{hl.description}</p>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-[10px]">
                    <span className="text-slate-500 font-mono font-medium">{hl.scope}</span>
                    <a
                      href={`tel:${hl.number.replace(/\s+/g, '')}`}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1"
                    >
                      <span>Call {hl.number}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
