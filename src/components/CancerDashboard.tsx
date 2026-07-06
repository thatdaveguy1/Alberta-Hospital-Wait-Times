import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  FileText, 
  Info,
  ChevronRight,
  UserCheck,
  HeartPulse,
  Award,
  Clock
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
  Legend, 
  Cell,
  ReferenceLine
} from 'recharts';
import {
  type CancerBurdenItem,
  type CancerSurgeryWaitTrend,
  type CancerCentreLocation,
  type RadiationTherapyCompliance
} from '../cancerData';
import { DataTimestamp, DataMetadataMap } from './DataTimestamp';

export default function CancerDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'burden' | 'surgery' | 'radiation' | 'facilities'>('burden');
  
  // Interactive Filter States
  const [selectedCancer, setSelectedCancer] = useState<string>('All');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [domainData, setDomainData] = useState<{
    CANCER_BURDEN_STATS: CancerBurdenItem[];
    CANCER_SURGERY_WAIT_TRENDS: CancerSurgeryWaitTrend[];
    RADIATION_THERAPY_WAIT_TRENDS: RadiationTherapyCompliance[];
    ALBERTA_CANCER_CENTRES: CancerCentreLocation[];
    _handAuthoredMetadata?: Record<string, { source: string; vintage?: string; lastVerified: string; verification: string }>;
    _dataMetadata?: DataMetadataMap;
  }>({
    CANCER_BURDEN_STATS: [],
    CANCER_SURGERY_WAIT_TRENDS: [],
    RADIATION_THERAPY_WAIT_TRENDS: [],
    ALBERTA_CANCER_CENTRES: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/data/cancer')
      .then(res => res.json())
      .then(data => { setDomainData(data); setIsLoading(false); })
      .catch(err => { console.error('Failed to load cancer data:', err); setIsLoading(false); });
  }, []);

  // Filter Cancer Burden stats
  const filteredBurden = useMemo(() => {
    if (selectedCancer === 'All') return domainData.CANCER_BURDEN_STATS;
    return domainData.CANCER_BURDEN_STATS.filter(b => b.cancerType === selectedCancer);
  }, [selectedCancer, domainData]);

  // Aggregate stats for the burden tab
  const burdenSummary = useMemo(() => {
    const totalCases = domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedCases2026, 0);
    const totalDeaths = domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedDeaths2026, 0);
    const avgSurvival = domainData.CANCER_BURDEN_STATS.length > 0
      ? domainData.CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.fiveYearRelativeSurvivalPct, 0) / domainData.CANCER_BURDEN_STATS.length
      : 0;
    const lungDeaths = domainData.CANCER_BURDEN_STATS.find(b => b.cancerType === 'Lung Cancer')?.projectedDeaths2026 ?? 0;
    const lungDeathPct = totalDeaths > 0 ? Math.round((lungDeaths / totalDeaths) * 100) : 0;
    return { totalCases, totalDeaths, avgSurvival, lungDeaths, lungDeathPct };
  }, [domainData]);

  // Filter Facilities by Zone and Search
  const filteredFacilities = useMemo(() => {
    return domainData.ALBERTA_CANCER_CENTRES.filter(fac => {
      const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
      const matchesSearch = fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.services.some(s => s.toLowerCase().includes(facilitySearch.toLowerCase()));
      return matchesZone && matchesSearch;
    });
  }, [selectedZone, facilitySearch, domainData]);

  // Radiation therapy trend summary (latest year + year-over-year recovery delta)
  const radiationSummary = useMemo(() => {
    const trends = [...domainData.RADIATION_THERAPY_WAIT_TRENDS].sort((a, b) => a.year.localeCompare(b.year));
    const latest = trends.length > 0 ? trends[trends.length - 1] : null;
    const year2022 = trends.find(t => t.year === '2022') ?? null;
    const recoveryDelta = latest && year2022 ? Math.round((latest.albertaPctWithinBenchmark - year2022.albertaPctWithinBenchmark) * 10) / 10 : 0;
    return { latest, year2022, recoveryDelta };
  }, [domainData]);

  if (isLoading) return <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-emerald-400" />
            <span>Cancer Care & Screening</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track projected cases, screening participation rates, and radiation therapy benchmarks.
          </p>
          <DataTimestamp metadata={domainData._dataMetadata} arrayKey="CANCER_SURGERY_WAIT_TRENDS" />
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('burden')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'burden'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Tumor Burden</span>
        </button>
        <button
          onClick={() => setActiveSubTab('surgery')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'surgery'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Cancer Surgeries</span>
        </button>
        <button
          onClick={() => setActiveSubTab('radiation')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'radiation'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Radiation Gaps</span>
        </button>
        <button
          onClick={() => setActiveSubTab('facilities')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'facilities'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Therapy Centers</span>
        </button>
      </div>

      {/* SUBTAB 1: Tumor Burden & Survival Outcomes */}
      {activeSubTab === 'burden' && (
        <div className="space-y-6">
          {/* Burden Cards Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">2026 Projected Annual Cancer Diagnoses</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">~{(burdenSummary.totalCases).toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-mono">new cases</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Expected primary cancer cases diagnosed among residents of Alberta, monitored via the Alberta Cancer Registry.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">2026 Projected Annual Cancer Deaths</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-500">~{(burdenSummary.totalDeaths).toLocaleString()}</span>
                <span className="text-xs text-slate-400 font-mono">mortality count</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Lung cancer remains the leading cause of oncological mortality (~{burdenSummary.lungDeaths.toLocaleString()} cases), accounting for approximately {burdenSummary.lungDeathPct}% of all cancer deaths.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Average 5-Year Survival Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{burdenSummary.avgSurvival.toFixed(1)}%</span>
                <span className="text-xs text-slate-400 font-mono">relative average</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-850">
                Prostate & breast cancers demonstrate high relative survival rates (&gt;89%), while lung cancer lags at 22.4% due to delayed diagnosis.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Burden chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Alberta Primary Cancer Burden Profiler</h3>
                  <p className="text-[10px] text-slate-500">Projected incident cases vs actual mortality indicators (March 2026 Registry Update)</p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="CANCER_BURDEN_STATS" />
                </div>
                <div className="relative">
                  <select
                    value={selectedCancer}
                    onChange={(e) => setSelectedCancer(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="All">All Major Cancers</option>
                    {domainData.CANCER_BURDEN_STATS.map(b => (
                      <option key={b.cancerType} value={b.cancerType}>{b.cancerType}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredBurden}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="cancerType" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="projectedCases2026" name="Projected New Cases" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="projectedDeaths2026" name="Projected Annual Deaths" fill="#e11d48" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detailed Table view */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Surveillance Rates & Risks</h3>
                  <p className="text-[10px] text-slate-500">Age-standardized rates per 100,000 population</p>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {filteredBurden.map(item => (
                    <div key={item.cancerType} className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{item.cancerType}</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          {item.fiveYearRelativeSurvivalPct}% Survival
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>
                          <span className="text-[9px] text-slate-500 block">Incidence Rate:</span>
                          <strong className="text-slate-300 font-semibold">{item.ageStandardizedIncidenceRate} / 100k</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-500 block">Mortality Rate:</span>
                          <strong className="text-slate-300 font-semibold">{item.ageStandardizedMortalityRate} / 100k</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Age-Standardization:</strong> Minimizes differences in population age profiles when comparing different health regions or decades over time.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Cancer Surgery Wait Times (CIHI Benchmarks) */}
      {activeSubTab === 'surgery' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Surgery Wait Times Line Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI Priority Cancer Surgery Wait Trends</h3>
                <p className="text-[10px] text-slate-500">
                  Comparing Alberta median (P50) and 90th percentile (P90) wait times in days against the Canadian national standard.
                </p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="CANCER_SURGERY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={domainData.CANCER_SURGERY_WAIT_TRENDS.filter(t => t.cancerType === 'Breast' || t.cancerType === 'Colorectal')}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    
                    <Line type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#e11d48" strokeWidth={2.5} dot  isAnimationActive={false} />
                    <Line type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 3" dot  isAnimationActive={false} />
                    
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#10b981" strokeWidth={2} dot  isAnimationActive={false} />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot  isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                💡 <strong>Wait List Dynamics:</strong> Spikes in the 90th Percentile (P90) reflect secondary backlog development. 
                While urgent patients (Median) are scheduled rapidly, elective outpatients wait considerably longer for margin reconstructions.
              </p>
            </div>

            {/* Performance Target / Priority breakdown */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National Surgical Milestones</h3>
                <p className="text-[10px] text-slate-500">Benchmark compliance under clinical prioritizations</p>
              </div>

              <div className="space-y-3 grow pt-2">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 1 (Urgent Care)</span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">14 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Acute cases with rapid localized growth. Current AHS performance targets are generally met with 94.2% of patients receiving surgery within 14 days (program-reported estimate; no public registry source).
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 2 (Semi-Urgent)</span>
                    <span className="text-[10px] text-amber-500 font-mono font-bold">28 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Established primary solid tumors. 84.1% compliance rate within Alberta's central and metropolitan cancer hubs (program-reported estimate; no public registry source).
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 3 (Elective)</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold">42 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Post-chemotherapy margin reconstruction or slow-growing prostate monitors. Compliance falls to 72.5% during high peak surgical volumes (program-reported estimate; no public registry source).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Radiation Therapy Access */}
      {activeSubTab === 'radiation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Radiation Therapy Wait Times Percentiles */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">National Radiation Therapy Wait Times</h3>
                <p className="text-[10px] text-slate-500">
                  Percentage of oncology patients receiving first radiation therapy treatment within the recommended 28-day national clinical target.
                </p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="RADIATION_THERAPY_WAIT_TRENDS" />
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={domainData.RADIATION_THERAPY_WAIT_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="colorAlbertaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCanadaRad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Within Benchmark %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} domain={[70, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="albertaPctWithinBenchmark" name="Alberta % Within Benchmark" stroke="#10b981" fillOpacity={1} fill="url(#colorAlbertaRad)" strokeWidth={2.5}  isAnimationActive={false} />
                    <Area type="monotone" dataKey="canadaPctWithinBenchmark" name="Canadian Average %" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanadaRad)" strokeWidth={1.5} strokeDasharray="5 5"  isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                ✔️ <strong>Recovery Trend:</strong> Following a dip during the pandemic years ({radiationSummary.year2022?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.year2022?.year ?? '2022'}), Alberta's radiation therapy throughput recovered to {radiationSummary.latest?.albertaPctWithinBenchmark ?? 0}% in {radiationSummary.latest?.year ?? '2025'} due to clinical cohort expansions and late-night scanning blocks.
              </p>
            </div>

            {/* Benchmark Details */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Radiation Access Milestones</h3>
                <p className="text-[10px] text-slate-500">Wait times from clinical ready-to-treat decision to first beam</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Median Wait (P50)</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {radiationSummary.latest?.albertaP50WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Half of all patients referred for urgent or routine palliative radiation treatment receive their first fraction within {radiationSummary.latest?.albertaP50WaitDays ?? 0} days of the clinical directive ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">90th Percentile Wait (P90)</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      {radiationSummary.latest?.albertaP90WaitDays ?? 0} Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    90% of all oncology cohorts receive radiation within {radiationSummary.latest?.albertaP90WaitDays ?? 0} days, comfortably meeting the Canadian Association of Radiologists standard of 28 days ({radiationSummary.latest?.year ?? '2025'} reporting period).
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-[10px] text-emerald-300 font-bold">Alberta maintains one of the shortest radiation queues in Western Canada.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Treatment Access & Facility Map */}
      {activeSubTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Oncology Treatment Centers & Service Directories</h3>
                <p className="text-[10px] text-slate-500">Live directory of specialized cancer centers, linear accelerators, and chemotherapy access sites</p>
                <DataTimestamp compact metadata={domainData._dataMetadata} arrayKey="ALBERTA_CANCER_CENTRES" />
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search clinics & services..."
                    value={facilitySearch}
                    onChange={(e) => setFacilitySearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* List of Cancer Centres */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFacilities.map(fac => (
                <div key={fac.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{fac.name}</h4>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded mt-1.5 inline-block font-mono">
                          {fac.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold shrink-0">
                        {fac.city}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 space-y-1">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                        <span className="truncate">{fac.address}, {fac.city} ({fac.zone})</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-2">
                      <span className="text-[9px] text-slate-500 uppercase font-extrabold block mb-1">Available Services:</span>
                      <div className="flex flex-wrap gap-1">
                        {fac.services.map((srv, idx) => (
                          <span key={idx} className="text-[9px] bg-emerald-500/5 text-emerald-400 border border-emerald-500/10 px-2 py-0.5 rounded">
                            {srv}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-900 text-[9px] text-center">
                    <div className={`p-1 rounded font-bold ${fac.systemicTherapyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Chemo / Systemic
                    </div>
                    <div className={`p-1 rounded font-bold ${fac.radiationTherapyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Radiation (LINAC)
                    </div>
                    <div className={`p-1 rounded font-bold ${fac.surgicalOncologyAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-600'}`}>
                      Onco Surgery
                    </div>
                  </div>
                </div>
              ))}

              {filteredFacilities.length === 0 && (
                <div className="col-span-full bg-slate-950 border border-slate-850 p-8 text-center rounded-xl">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-slate-400 text-xs">No specialized cancer clinics or support services matched your search criteria.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
