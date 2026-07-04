import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  FileText, 
  Stethoscope, 
  DollarSign, 
  Sliders, 
  HelpCircle,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  UserCheck,
  Briefcase,
  AlertCircle,
  Building,
  GraduationCap
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell, 
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie
} from 'recharts';
import { 
  PHYSICIAN_SPECIALTY_ZONE, 
  NURSING_SUPPLY_TRENDS, 
  WORKFORCE_AGE_PROFILE, 
  JOB_VACANCY_TRENDS, 
  SPECIALIST_RECRUITMENT_NEEDS, 
  ALLIED_HEALTH_SUPPLY,
  PhysicianSpecialtyZone,
  NursingSupplyGroup,
  WorkforceAgeProfile,
  JobVacancyTrend,
  SpecialistRecruitmentNeed,
  AlliedHealthSupply
} from '../workforceData';

export default function WorkforceDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'physicians' | 'nursing' | 'allied' | 'retirement' | 'vacancies'>('physicians');
  
  // Interactive Filters
  const [selectedZone, setSelectedZone] = useState<string>('Alberta');
  const [searchProfession, setSearchProfession] = useState<string>('');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('All');

  // Physician calculations
  const physicianZoneData = useMemo(() => {
    return PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === selectedZone) || PHYSICIAN_SPECIALTY_ZONE[5];
  }, [selectedZone]);

  const zonePieData = useMemo(() => {
    const d = physicianZoneData;
    return [
      { name: 'Family Medicine', value: d.familyMedicine, color: '#10b981' },
      { name: 'Medical Specialties', value: d.medicalSpecialties, color: '#3b82f6' },
      { name: 'Surgical Specialties', value: d.surgicalSpecialties, color: '#ec4899' },
      { name: 'Laboratory', value: d.laboratorySpecialties, color: '#6366f1' },
      { name: 'Psychiatry', value: d.psychiatry, color: '#f59e0b' }
    ];
  }, [physicianZoneData]);

  // Nursing filtered trends
  const selectedNursingProfession = useMemo(() => {
    return NURSING_SUPPLY_TRENDS.filter(n => n.year === '2025');
  }, []);

  // Retirement risk profiles
  const filteredRetirementProfiles = useMemo(() => {
    return WORKFORCE_AGE_PROFILE.filter(profile => {
      const matchesSearch = profile.professionGroup.toLowerCase().includes(searchProfession.toLowerCase());
      const matchesRisk = selectedRiskLevel === 'All' || profile.retirementRiskLevel === selectedRiskLevel;
      return matchesSearch && matchesRisk;
    });
  }, [searchProfession, selectedRiskLevel]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalPhysicians = PHYSICIAN_SPECIALTY_ZONE.find(z => z.zone === 'Alberta')?.totalActive || 9739;
    const totalRNs = NURSING_SUPPLY_TRENDS.find(n => n.profession === 'Registered Nurse (RN)' && n.year === '2025')?.activePermits || 45171;
    const activeVacancies = JOB_VACANCY_TRENDS[JOB_VACANCY_TRENDS.length - 1].vacanciesCount;
    const avgNursingVacancy = 9.0; // blended vacancy indicator

    return {
      totalPhysicians,
      totalRNs,
      activeVacancies,
      avgNursingVacancy
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute left-1/3 top-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                AHS Workforce & Staffing Supply Console
              </span>
              <span className="text-xs text-slate-500">
                Data Integration: Q1 2026 Release
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
              Health Workforce & Staffing Supply
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Cross-profession supply tracking, vacancy rates, clinical specialty forecasting, and age retirement risk profiles compiled from CIHI, CPSA, CRNA, and StatsCan.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveSubTab('physicians')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'physicians' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Physician Supply & Gaps
            </button>
            <button
              onClick={() => setActiveSubTab('nursing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'nursing' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Nursing & Allied Staffing
            </button>
            <button
              onClick={() => setActiveSubTab('allied')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'allied' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Allied Health Supply
            </button>
            <button
              onClick={() => setActiveSubTab('retirement')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'retirement' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Retirement Cliff
            </button>
            <button
              onClick={() => setActiveSubTab('vacancies')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'vacancies' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Vacancies & Wages
            </button>
          </div>
        </div>
      </div>

      {/* High-Level Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active FFS Physicians</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.totalPhysicians.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.4% Annual Increase
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hidden sm:block">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Active RN Permits</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.totalRNs.toLocaleString()}</div>
            <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2.4% Registered Growth
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hidden sm:block">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Health Care Vacancies</span>
            <div className="text-lg sm:text-2xl font-black text-white">{aggregateStats.activeVacancies.toLocaleString()}</div>
            <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              -8.8% vs 2024 Peaks
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 hidden sm:block">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#090e21] border border-slate-800/80 p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Retirement Cliff Ratio</span>
            <div className="text-lg sm:text-2xl font-black text-white">32.3%</div>
            <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-red-400" />
              Physicians Over Age 55
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hidden sm:block">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SUBTAB 1: Physician Supply & 10-Yr Specialty Forecast */}
      {activeSubTab === 'physicians' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Zone Specialty Breakdown Selector */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Geographic Profile Selector</h3>
                  <p className="text-[10px] text-slate-500">Analyze specialties inside local health authorities</p>
                </div>
                <Building className="w-4 h-4 text-blue-500" />
              </div>

              <div className="grid grid-cols-1 gap-1">
                {PHYSICIAN_SPECIALTY_ZONE.map(zone => (
                  <button
                    key={zone.zone}
                    onClick={() => setSelectedZone(zone.zone)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition-all text-left ${
                      selectedZone === zone.zone
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-slate-950/40 text-slate-400 hover:text-slate-200 border border-slate-850'
                    }`}
                  >
                    <span>{zone.zone}</span>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        selectedZone === zone.zone ? 'bg-blue-700 text-white' : 'bg-slate-900 text-slate-400'
                      }`}>
                        {zone.totalActive} MDs
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* MD per 100k card */}
              <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl space-y-2">
                <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Zone Physician Density</span>
                <div className="flex items-baseline justify-between">
                  <div className="text-2xl font-black text-white">{physicianZoneData.ratePer100k}</div>
                  <span className="text-xs text-slate-400">MDs per 100k Pop</span>
                </div>
                <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (physicianZoneData.ratePer100k / 278.1) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {physicianZoneData.zone === 'Alberta' 
                    ? 'Provincial average healthcare density benchmark.' 
                    : physicianZoneData.ratePer100k < 150 
                    ? '⚠️ Region has critical specialist access gaps below Alberta average (216.4).' 
                    : 'Region meets or exceeds provincial physician density benchmarks.'}
                </p>
              </div>
            </div>

            {/* Specialty Share Pie/Bar Visualizer */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Specialty Distribution Profile</h3>
                  <p className="text-[10px] text-slate-500">Composition of active fee-for-service clinical workforce in <strong>{selectedZone}</strong></p>
                </div>
                <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: Open Alberta Supplement
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* Visual stats blocks */}
                <div className="space-y-2">
                  {zonePieData.map(slice => {
                    const pct = ((slice.value / physicianZoneData.totalActive) * 100).toFixed(1);
                    return (
                      <div key={slice.name} className="p-2.5 bg-slate-950/40 rounded-lg border border-slate-850 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                          <span className="text-xs text-slate-400 font-medium truncate max-w-[110px]">{slice.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-white block">{slice.value}</span>
                          <span className="text-[9px] text-slate-500 block">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Recharts Bar chart representation */}
                <div className="sm:col-span-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={zonePieData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" stroke="#64748b" fontSize={10} />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} width={100} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                        labelClassName="text-slate-200 font-bold text-xs"
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {zonePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Specialist 10-Year Recruitment Need and Strategic Alignment */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AHS 10-Year Specialist Forecasting & Strategic Alignment</h3>
                <p className="text-[10px] text-slate-500">FTE target needs vs current active workforce and recruitment seat caps (Specialist Physician Resource Plan)</p>
              </div>
              <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                10-Year Strategic Outlook
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SPECIALIST_RECRUITMENT_NEEDS.map(item => {
                const deficit = item.forecasted10YrNeed - item.currentActive;
                const ratio = Math.round((item.currentActive / item.forecasted10YrNeed) * 100);
                
                return (
                  <div key={item.specialty} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3 relative overflow-hidden">
                    {/* Corner accent according to risk */}
                    <div className={`absolute top-0 right-0 w-2 h-full ${
                      item.gapShortageRisk === 'Critical Deficit' 
                        ? 'bg-red-500' 
                        : item.gapShortageRisk === 'High Gap' 
                        ? 'bg-amber-500' 
                        : item.gapShortageRisk === 'Moderate Gap' 
                        ? 'bg-blue-400' 
                        : 'bg-emerald-500'
                    }`} />

                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{item.specialty}</h4>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider ${
                          item.gapShortageRisk === 'Critical Deficit'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : item.gapShortageRisk === 'High Gap'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : item.gapShortageRisk === 'Moderate Gap'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {item.gapShortageRisk}
                        </span>
                      </div>
                      <div className="text-right pr-3">
                        <span className="text-[10px] text-slate-500 block">Strategic Deficit</span>
                        <span className="text-xs font-bold text-slate-200">+{deficit} FTEs required</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>FTE Supply Gap Progress</span>
                        <span>{item.currentActive} / {item.forecasted10YrNeed} FTEs ({ratio}%)</span>
                      </div>
                      <div className="w-full bg-slate-850 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            item.gapShortageRisk === 'Critical Deficit' 
                              ? 'bg-red-500' 
                              : item.gapShortageRisk === 'High Gap' 
                              ? 'bg-amber-500' 
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] bg-slate-900/60 p-2 rounded-lg">
                      <span className="text-slate-400 flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
                        Planned residency seats
                      </span>
                      <span className="font-bold text-white">{item.plannedRecruitmentSeats} Seats</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Nursing & Allied Staffing Supply Trends */}
      {activeSubTab === 'nursing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Nursing growth trends chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Permit Growth & Demand Tracker</h3>
                  <p className="text-[10px] text-slate-500">Active licensed practice permit expansion (2023–2025)</p>
                </div>
                <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: CRNA & CLHA Registers
                </span>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { year: '2023', RN: 43210, LPN: 18450, HCA: 24100 },
                      { year: '2024', RN: 44102, LPN: 19120, HCA: 25180 },
                      { year: '2025', RN: 45171, LPN: 19912, HCA: 26840 }
                    ]}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="RN" name="Registered Nurses (RN)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="LPN" name="Licensed Practical Nurses (LPN)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="HCA" name="Health Care Aides (HCA)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Nursing Capacity Diagnostics</h3>
                <p className="text-[10px] text-slate-500">2025 Active Registry benchmarks and allocation profiles</p>
              </div>

              <div className="space-y-3">
                {selectedNursingProfession.map(prof => (
                  <div key={prof.profession} className="p-3 bg-slate-950/40 rounded-xl border border-slate-850 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">{prof.profession}</span>
                      <span className="text-xs font-mono font-bold text-blue-400">{prof.activePermits.toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">VACANCY RATE</span>
                        <span className="font-bold text-red-400">{prof.vacancyRatePct}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">DIRECT CARE</span>
                        <span className="font-bold text-emerald-400">{prof.directCarePct}%</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded">
                        <span className="text-slate-500 block text-[8px]">RURAL FOCUS</span>
                        <span className="font-bold text-indigo-400">{prof.ruralRemotePct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Allied Health Supply */}
      {activeSubTab === 'allied' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Allied Health Professional Benchmarking</h3>
                <p className="text-[10px] text-slate-500">Active staffing densities per 100,000 population: Alberta vs National Canadian Average</p>
              </div>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                Source: CIHI Health Workforce Quick Stats
              </span>
            </div>

            {/* Visual Grid comparing Alberta and Canada rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ALLIED_HEALTH_SUPPLY.map(allied => {
                const diff = allied.nationalComparisonRatePer100k.alberta - allied.nationalComparisonRatePer100k.canadaAvg;
                const matchesAvg = diff >= 0;
                
                return (
                  <div key={allied.profession} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{allied.profession}</h4>
                        <span className="text-[10px] font-mono text-slate-400">Total Alberta count: <strong>{allied.albertaCount.toLocaleString()}</strong></span>
                      </div>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        matchesAvg ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                      }`}>
                        {matchesAvg ? `+${diff.toFixed(1)} vs National` : `${diff.toFixed(1)} vs National`}
                      </span>
                    </div>

                    {/* Comparison Bars */}
                    <div className="space-y-2 pt-1">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Alberta Density (per 100k)</span>
                          <span className="font-bold text-white">{allied.nationalComparisonRatePer100k.alberta}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(allied.nationalComparisonRatePer100k.alberta / 140) * 100}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-slate-500">
                          <span>Canada Benchmark</span>
                          <span className="font-bold text-slate-400">{allied.nationalComparisonRatePer100k.canadaAvg}</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-slate-700 h-full rounded-full" style={{ width: `${(allied.nationalComparisonRatePer100k.canadaAvg / 140) * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px]">
                      <span className="text-slate-500">Active Job Postings (AHS)</span>
                      <span className="font-bold text-amber-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                        {allied.vacancyActivePostings} Active Listings
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Age & Retirement Risk Profile */}
      {activeSubTab === 'retirement' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Retirement Cliff & Demographics Analyzer</h3>
                <p className="text-[10px] text-slate-500">Evaluating potential staffing supply flight via aging practitioner profiles</p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search professions..."
                    value={searchProfession}
                    onChange={(e) => setSearchProfession(e.target.value)}
                    className="bg-slate-950 border border-slate-850 rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>

                <select
                  value={selectedRiskLevel}
                  onChange={(e) => setSelectedRiskLevel(e.target.value)}
                  className="bg-slate-950 border border-slate-850 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="All">All Risks</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Profile display panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredRetirementProfiles.map(profile => {
                const over55 = profile.age55to64Pct + profile.over65Pct;
                
                return (
                  <div key={profile.professionGroup} className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-black text-white">{profile.professionGroup}</h4>
                        <span className="text-[9px] text-slate-500">Age demographic breakdown</span>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          profile.retirementRiskLevel === 'Critical'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                            : profile.retirementRiskLevel === 'High'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        }`}>
                          {profile.retirementRiskLevel} RISK
                        </span>
                        <p className="text-[9px] text-slate-400 mt-1">
                          <strong>{over55.toFixed(1)}%</strong> Over 55
                        </p>
                      </div>
                    </div>

                    {/* Staggered distribution progress bars */}
                    <div className="space-y-2">
                      {/* Under 35 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Under Age 35 (Early-career)</span>
                          <span className="font-bold text-emerald-400">{profile.under35Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${profile.under35Pct}%` }} />
                        </div>
                      </div>

                      {/* 35 to 54 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 35 to 54 (Mid-career core)</span>
                          <span className="font-bold text-blue-400">{profile.age35to54Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${profile.age35to54Pct}%` }} />
                        </div>
                      </div>

                      {/* 55 to 64 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 55 to 64 (Imminent Retirement Cliff)</span>
                          <span className="font-bold text-amber-500">{profile.age55to64Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${profile.age55to64Pct}%` }} />
                        </div>
                      </div>

                      {/* Over 65 */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Ages 65+ (Active Post-Retirement Practice)</span>
                          <span className="font-bold text-red-500">{profile.over65Pct}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-red-500 h-full rounded-full" style={{ width: `${profile.over65Pct}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Vacancy & Shortage Pressure */}
      {activeSubTab === 'vacancies' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Vacancy & Wage Trend chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">StatsCan Vacancy and Offered Hourly Wage Trends</h3>
                  <p className="text-[10px] text-slate-500">Unadjusted quarterly monitoring for Health Care & Social Assistance (Alberta)</p>
                </div>
                <span className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  Source: StatsCan JVWS Table 14-10-0443-01
                </span>
              </div>

              {/* Line charts with two axes or combined representation */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={JOB_VACANCY_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="quarter" stroke="#64748b" fontSize={10} />
                    <YAxis yAxisId="left" stroke="#3b82f6" fontSize={9} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="vacanciesCount" name="Open Vacancies (Count)" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line yAxisId="right" type="monotone" dataKey="avgOfferedHourlyWage" name="Avg Offered Wage ($/Hr)" stroke="#10b981" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strategic Intervention & Policy Diagnostics */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Staffing Pressure Diagnostics</h3>
                <p className="text-[10px] text-slate-500">Interlinked systems pressure loop (Shortages → Overtime → Closures)</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Extreme Overtime Stress</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    AHS clinical reports show overtime utilization in medical-surgical units remains <strong>38% above 2019 baseline benchmarks</strong>.
                  </p>
                </div>

                <div className="p-3 bg-amber-950/20 border border-amber-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>Duration / Long-Term Vacancies</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Over <strong>42% of specialized nursing vacancies</strong> in Northern and Rural economic regions remain unfilled for more than 90 consecutive days.
                  </p>
                </div>

                <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Residency Expansion Seat Allocations</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    The Alberta Ministry of Health is committing funding to support <strong>120+ additional postgraduate medical residency seats</strong> by fiscal 2026.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
