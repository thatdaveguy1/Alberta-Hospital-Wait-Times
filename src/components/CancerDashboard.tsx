import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  CheckCircle, 
  Calendar, 
  FileText, 
  Info,
  ChevronRight,
  UserCheck,
  HeartPulse,
  FlaskConical,
  Award
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
  Cell
} from 'recharts';
import { 
  CANCER_BURDEN_STATS, 
  CANCER_SCREENING_RATES, 
  CANCER_SURGERY_WAIT_TRENDS, 
  RADIATION_THERAPY_WAIT_TRENDS, 
  ALBERTA_CANCER_CENTRES,
  CancerBurdenItem,
  CancerScreeningZoneRate,
  CancerSurgeryWaitTrend,
  CancerCentreLocation
} from '../cancerData';

export default function CancerDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'burden' | 'screening' | 'surgery' | 'radiation' | 'facilities'>('burden');
  
  // Interactive Filter States
  const [selectedCancer, setSelectedCancer] = useState<string>('All');
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [facilitySearch, setFacilitySearch] = useState<string>('');
  const [screeningMetric, setScreeningMetric] = useState<'breast' | 'cervical' | 'colorectal'>('breast');
  
  // Interactive Simulation for FIT Kit Ordering or Mammogram reminder
  const [orderedKit, setOrderedKit] = useState<boolean>(false);
  const [kitZone, setKitZone] = useState<string>('Calgary Zone');
  const [reminderEmail, setReminderEmail] = useState<string>('');
  const [reminderStatus, setReminderStatus] = useState<string | null>(null);

  const handleOrderFitKit = (e: React.FormEvent) => {
    e.preventDefault();
    setOrderedKit(true);
    setTimeout(() => {
      setOrderedKit(false);
    }, 5000);
  };

  const handleSetReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderEmail) return;
    setReminderStatus(`Thank you! A biennial screening reminder has been set for ${reminderEmail}.`);
    setReminderEmail('');
    setTimeout(() => {
      setReminderStatus(null);
    }, 5000);
  };

  // Filter Cancer Burden stats
  const filteredBurden = useMemo(() => {
    if (selectedCancer === 'All') return CANCER_BURDEN_STATS;
    return CANCER_BURDEN_STATS.filter(b => b.cancerType === selectedCancer);
  }, [selectedCancer]);

  // Aggregate stats for the burden tab
  const burdenSummary = useMemo(() => {
    const totalCases = CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedCases2026, 0);
    const totalDeaths = CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.projectedDeaths2026, 0);
    const avgSurvival = CANCER_BURDEN_STATS.reduce((acc, curr) => acc + curr.fiveYearRelativeSurvivalPct, 0) / CANCER_BURDEN_STATS.length;
    return { totalCases, totalDeaths, avgSurvival };
  }, []);

  // Filter Facilities by Zone and Search
  const filteredFacilities = useMemo(() => {
    return ALBERTA_CANCER_CENTRES.filter(fac => {
      const matchesZone = selectedZone === 'All' || fac.zone === selectedZone;
      const matchesSearch = fac.name.toLowerCase().includes(facilitySearch.toLowerCase()) || 
                            fac.city.toLowerCase().includes(facilitySearch.toLowerCase()) ||
                            fac.services.some(s => s.toLowerCase().includes(facilitySearch.toLowerCase()));
      return matchesZone && matchesSearch;
    });
  }, [selectedZone, facilitySearch]);

  // Screening comparison data for BarChart
  const screeningChartData = useMemo(() => {
    return CANCER_SCREENING_RATES.map(rate => ({
      zone: rate.zone,
      'Breast Screening (Mammography) %': rate.breastScreeningPct,
      'Cervical Screening (Pap) %': rate.cervicalScreeningPct,
      'Colorectal Screening (FIT) %': rate.colorectalScreeningPct,
      'Breast Target %': 70,
      'Cervical Target %': 80,
      'Colorectal Target %': 60
    }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute left-1/4 top-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Oncology Performance & Screening Console
              </span>
              <span className="text-xs text-slate-500 font-mono">
                AHS Cancer Care Alberta & CIHI registries
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
              Cancer Care System & Screening Performance
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Track tumor burden indicators, provincial preventative screening participation gaps by health zone, 
              surgery waitlists, national radiation benchmark compliance, and tertiary therapy facility access.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850 self-start lg:self-auto shrink-0">
            <button
              onClick={() => setActiveSubTab('burden')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'burden' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tumor Burden
            </button>
            <button
              onClick={() => setActiveSubTab('screening')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'screening' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Preventative Screening
            </button>
            <button
              onClick={() => setActiveSubTab('surgery')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'surgery' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Surgery Waits
            </button>
            <button
              onClick={() => setActiveSubTab('radiation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'radiation' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Radiation Waits
            </button>
            <button
              onClick={() => setActiveSubTab('facilities')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'facilities' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Treatment Directory
            </button>
          </div>
        </div>
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
                Lung cancer remains the leading cause of oncological mortality (~1,650 cases), accounting for nearly 40% of all cancer deaths.
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
                </div>
                <div className="relative">
                  <select
                    value={selectedCancer}
                    onChange={(e) => setSelectedCancer(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="All">All Major Cancers</option>
                    {CANCER_BURDEN_STATS.map(b => (
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
                    <Bar dataKey="projectedCases2026" name="Projected New Cases" fill="#059669" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="projectedDeaths2026" name="Projected Annual Deaths" fill="#e11d48" radius={[4, 4, 0, 0]} />
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

      {/* SUBTAB 2: Preventative Cancer Screening Participation */}
      {activeSubTab === 'screening' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Screening Participation Gaps Chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Organized Screening Participation by Health Zone</h3>
                  <p className="text-[10px] text-slate-500">Mammography (Breast), Pap Smear (Cervical), FIT kit (Colorectal) rates vs National Benchmarks</p>
                </div>

                <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-850">
                  <button
                    onClick={() => setScreeningMetric('breast')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      screeningMetric === 'breast' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Breast (Mammography)
                  </button>
                  <button
                    onClick={() => setScreeningMetric('cervical')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      screeningMetric === 'cervical' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Cervical (Pap)
                  </button>
                  <button
                    onClick={() => setScreeningMetric('colorectal')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${
                      screeningMetric === 'colorectal' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Colorectal (FIT)
                  </button>
                </div>
              </div>

              {/* Chart of zone performance */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={CANCER_SCREENING_RATES}
                    margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="zone" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Participation Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    {screeningMetric === 'breast' && (
                      <>
                        <Bar dataKey="breastScreeningPct" name="Actual Mammography Participation Rate" fill="#049669" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="breastTarget" name="National Target Limit (70%)" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" />
                      </>
                    )}
                    {screeningMetric === 'cervical' && (
                      <>
                        <Bar dataKey="cervicalScreeningPct" name="Actual Pap Screening Rate" fill="#0d9488" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="cervicalTarget" name="National Target Limit (80%)" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" />
                      </>
                    )}
                    {screeningMetric === 'colorectal' && (
                      <>
                        <Bar dataKey="colorectalScreeningPct" name="Actual Colorectal FIT Rate" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="colorectalTarget" name="National Target Limit (60%)" stroke="#fbbf24" strokeWidth={2} strokeDasharray="5 5" />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-850/60 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">Geographic Participation Disparities</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    The <strong>North Zone</strong> suffers from severe rural screening gaps (52.1% mammography vs. Calgary's 66.4%). 
                    AHS Screening for Life reports that lack of stable mobile mammography coach routes in remote regions and 
                    lower primary care clinic attachment rates significantly suppress rural preventative access.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Screening Call to Action Form */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Public Screening Outreach Portal</h3>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  As part of the Primary Care Alberta screening mandate, eligible patients can order a home FIT kit or schedule biennial screening reminders.
                </p>
              </div>

              {/* Action 1: Order FIT kit */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-white flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Order Home FIT Kit</span>
                  </span>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    Ages 50-74
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Fecal Immunochemical Test (FIT) is completed at home once every 2 years to detect early colorectal indicators.
                </p>

                {orderedKit ? (
                  <div className="bg-emerald-950/60 border border-emerald-500/30 p-2.5 rounded text-[10px] text-emerald-200 font-bold">
                    ✓ FIT kit order successfully queued for dispatch! Expected arrival via Canada Post in 3-5 business days.
                  </div>
                ) : (
                  <form onSubmit={handleOrderFitKit} className="flex gap-2">
                    <select
                      value={kitZone}
                      onChange={(e) => setKitZone(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-[10px] text-white rounded px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 grow"
                    >
                      <option value="Calgary Zone">Calgary Zone</option>
                      <option value="Edmonton Zone">Edmonton Zone</option>
                      <option value="Central Zone">Central Zone</option>
                      <option value="South Zone">South Zone</option>
                      <option value="North Zone">North Zone</option>
                    </select>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all shrink-0"
                    >
                      Request Kit
                    </button>
                  </form>
                )}
              </div>

              {/* Action 2: Set Mammogram biennial reminder */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl space-y-3">
                <span className="text-[11px] font-bold text-white flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Set Biennial Reminder</span>
                </span>
                <p className="text-[10px] text-slate-400">
                  Stay updated with reminders when you are due for your next routine mammography check.
                </p>

                {reminderStatus ? (
                  <div className="bg-emerald-950/60 border border-emerald-500/30 p-2.5 rounded text-[10px] text-emerald-200 font-semibold">
                    {reminderStatus}
                  </div>
                ) : (
                  <form onSubmit={handleSetReminder} className="flex gap-2">
                    <input
                      type="email"
                      required
                      placeholder="patient@email.ca"
                      value={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-[10px] text-white rounded px-2.5 py-1.5 placeholder-slate-500 focus:outline-none focus:border-emerald-500 grow"
                    />
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded transition-all shrink-0"
                    >
                      Set Reminder
                    </button>
                  </form>
                )}
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
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={CANCER_SURGERY_WAIT_TRENDS.filter(t => t.cancerType === 'Breast' || t.cancerType === 'Colorectal')}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Wait Days', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    
                    <Line type="monotone" dataKey="albertaP90Days" name="Alberta 90th Percentile (Days)" stroke="#e11d48" strokeWidth={2.5} dot />
                    <Line type="monotone" dataKey="canadaP90Days" name="Canada 90th Percentile (Days)" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 3" dot />
                    
                    <Line type="monotone" dataKey="albertaP50Days" name="Alberta Median (Days)" stroke="#10b981" strokeWidth={2} dot />
                    <Line type="monotone" dataKey="canadaP50Days" name="Canada Median (Days)" stroke="#10b981" strokeWidth={1} strokeDasharray="3 3" dot />
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
                    Acute cases with rapid localized growth. Current AHS performance targets are generally met with 94.2% of patients receiving surgery within 14 days.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 2 (Semi-Urgent)</span>
                    <span className="text-[10px] text-amber-500 font-mono font-bold">28 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Established primary solid tumors. 84.1% compliance rate within Alberta's central and metropolitan cancer hubs.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-white">Priority 3 (Elective)</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-bold">42 Days Max</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Post-chemotherapy margin reconstruction or slow-growing prostate monitors. Compliance falls to 72.5% during high peak surgical volumes.
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
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={RADIATION_THERAPY_WAIT_TRENDS}
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
                    <Area type="monotone" dataKey="albertaPctWithinBenchmark" name="Alberta % Within Benchmark" stroke="#10b981" fillOpacity={1} fill="url(#colorAlbertaRad)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="canadaPctWithinBenchmark" name="Canadian Average %" stroke="#6366f1" fillOpacity={1} fill="url(#colorCanadaRad)" strokeWidth={1.5} strokeDasharray="5 5" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-slate-400">
                ✔️ <strong>Recovery Trend:</strong> Following a dip during the pandemic years (84.1% in 2022), Alberta's radiation therapy throughput recovered to 92.1% in 2025 due to clinical cohort expansions and late-night scanning blocks.
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
                      10 Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Half of all patients referred for urgent or routine palliative radiation treatment receive their first fraction within 10 days of the clinical directive.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">90th Percentile Wait (P90)</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                      25 Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    90% of all oncology cohorts receive radiation within 25 days, comfortably meeting the Canadian Association of Radiologists standard of 28 days.
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
