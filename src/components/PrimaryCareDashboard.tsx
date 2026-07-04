import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Activity, 
  MapPin, 
  CheckCircle, 
  Phone, 
  Clock, 
  Globe, 
  Filter, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  FileText, 
  Stethoscope, 
  DollarSign, 
  Sliders, 
  HelpCircle,
  Eye
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
  ReferenceLine,
  Label,
  AreaChart,
  Area
} from 'recharts';
import { 
  ATTACHMENT_RATES, 
  ACCEPTING_PROVIDERS, 
  PCN_CAPACITY, 
  LGA_COMMUNITY_NEEDS, 
  ED_RELIANCE_BY_CONTINUITY, 
  CONTINUITY_SATISFACTION,
  AttachmentRate,
  AcceptingProvider,
  PCNCapacity,
  LGACommunityNeed,
  EDRelianceMetric,
  ContinuityAndSatisfaction
} from '../primaryCareData';

export default function PrimaryCareDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'attachment' | 'directory' | 'pcn' | 'needs' | 'er-link'>('attachment');
  
  // Interactive State for Provider Directory
  const [directorySearch, setDirectorySearch] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>('All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('All');
  const [filterWalkIn, setFilterWalkIn] = useState(false);
  const [filterAfterHours, setFilterAfterHours] = useState(false);
  const [filterVirtual, setFilterVirtual] = useState(false);

  // Interactive State for Community Needs (LGA filter)
  const [selectedNeedsZone, setSelectedNeedsZone] = useState<string>('All');
  const [needsSortBy, setNeedsSortBy] = useState<'physicians' | 'travel' | 'acsc' | 'population'>('physicians');

  // Filtered Provider Directory logic
  const filteredProviders = useMemo(() => {
    return ACCEPTING_PROVIDERS.filter(prov => {
      const matchesSearch = 
        prov.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.clinicName.toLowerCase().includes(directorySearch.toLowerCase()) ||
        prov.city.toLowerCase().includes(directorySearch.toLowerCase()) ||
        (prov.pcnName && prov.pcnName.toLowerCase().includes(directorySearch.toLowerCase()));
      
      const matchesZone = selectedZoneFilter === 'All' || prov.zone === selectedZoneFilter;
      const matchesType = selectedTypeFilter === 'All' || prov.type === selectedTypeFilter;
      
      const matchesWalkIn = !filterWalkIn || prov.features.walkIn;
      const matchesAfterHours = !filterAfterHours || prov.features.afterHours;
      const matchesVirtual = !filterVirtual || prov.features.virtualAppointments;
      
      return matchesSearch && matchesZone && matchesType && matchesWalkIn && matchesAfterHours && matchesVirtual;
    });
  }, [directorySearch, selectedZoneFilter, selectedTypeFilter, filterWalkIn, filterAfterHours, filterVirtual]);

  // Unique list of cities from providers for directory filter
  const uniqueCities = useMemo(() => {
    const cities = ACCEPTING_PROVIDERS.map(p => p.city);
    return Array.from(new Set(cities));
  }, []);

  // Filtered and Sorted LGA Community Needs
  const sortedLGAData = useMemo(() => {
    const filtered = LGA_COMMUNITY_NEEDS.filter(lga => 
      selectedNeedsZone === 'All' || lga.zone === selectedNeedsZone
    );

    return [...filtered].sort((a, b) => {
      if (needsSortBy === 'physicians') {
        return a.familyPhysiciansPer100k - b.familyPhysiciansPer100k; // Lower is higher need
      } else if (needsSortBy === 'travel') {
        return b.pctClaimsOutsideLGA - a.pctClaimsOutsideLGA; // Higher travel is higher need
      } else if (needsSortBy === 'acsc') {
        return b.acscHospitalizationRatePer100k - a.acscHospitalizationRatePer100k; // Higher avoidable hospitalization is higher need
      } else {
        return b.population - a.population;
      }
    });
  }, [selectedNeedsZone, needsSortBy]);

  // Executive summary counts
  const totalAcceptingCount = ACCEPTING_PROVIDERS.filter(p => p.acceptingNewPatients).length;
  
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -z-10" />
        <div className="absolute left-1/3 top-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Primary Healthcare Analytics
              </span>
              <span className="text-xs text-slate-500">
                Data Updated: Q2 2026
              </span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
              Primary Care Access & Attachment
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Analyzing community family physician capacity, clinic availability, and Primary Care Network (PCN) resource distribution across Alberta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('attachment')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'attachment' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              Attachment & Access
            </button>
            <button
              onClick={() => setActiveSubTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'directory' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              Accepting Providers
            </button>
            <button
              onClick={() => setActiveSubTab('needs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'needs' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              Community Need (LGA)
            </button>
            <button
              onClick={() => setActiveSubTab('pcn')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'pcn' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              PCN Capacity
            </button>
            <button
              onClick={() => setActiveSubTab('er-link')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'er-link' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              ER Overreliance Link
            </button>
          </div>
        </div>
      </div>

      {/* Top Level Strategic Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Attached to Regular GP</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">83.2%</span>
              <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> -1.6% vs 2021
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Canada Avg: 82.5% (CIHI 2024)</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Accepting Patients (Listed)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">{totalAcceptingCount} Clinics</span>
              <span className="text-[10px] text-emerald-400 font-bold">Directory Active</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Source: Alberta Find a Provider 2026</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Same / Next Day Access</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">38.2%</span>
              <span className="text-[10px] text-rose-500 font-bold">Access Gap</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Only 3.8 in 10 get immediate non-urgent care</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-slate-950 border border-slate-900 rounded-xl p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider block">Minor-Condition ER Rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-white">210.5</span>
              <span className="text-[10px] text-slate-400">per 1k pop</span>
            </div>
            <span className="text-[10px] text-amber-500 mt-1 block">Over 1M low-acuity ER visits annually</span>
          </div>
        </div>
      </div>

      {/* SUB-TAB CONTENTS */}

      {/* 1. ATTACHMENT & ACCESS */}
      {activeSubTab === 'attachment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Area */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Primary Care Attachment Rates by Demographic Group</h3>
                  <p className="text-xs text-slate-400">Percent of Albertans who report having access to a regular health provider (2024)</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-sm bg-indigo-500"></span>
                  <span className="text-xs text-slate-400">Alberta (% Attached)</span>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ATTACHMENT_RATES.filter(r => r.geography === 'Alberta')}
                    layout="vertical"
                    margin={{ top: 25, right: 30, left: 160, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#475569" tickFormatter={(v) => `${v}%`} className="text-[10px] font-mono" />
                    <YAxis dataKey="demographic_group" type="category" stroke="#475569" className="text-[10px] font-bold" width={150} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      formatter={(v: any) => [`${v}%`, 'Attached Patients']}
                    />
                    <Bar dataKey="metric_value" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      {ATTACHMENT_RATES.filter(r => r.geography === 'Alberta').map((entry, index) => {
                        let barColor = '#6366f1';
                        if (entry.demographic_group.includes('Lowest')) barColor = '#f43f5e';
                        if (entry.demographic_group.includes('Seniors')) barColor = '#10b981';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                    <ReferenceLine x={82.5} stroke="#f59e0b" strokeDasharray="3 3">
                      <Label value="Canada Avg (82.5%)" position="top" offset={10} fill="#f59e0b" className="text-[9px] font-mono font-bold" />
                    </ReferenceLine>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-slate-900/60 border border-slate-900 rounded-lg flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300">
                  <strong>Critical Vulnerability identified:</strong> Access to a regular healthcare provider varies substantially across demographics. Low-income earners (<span className="text-rose-400 font-bold">74.8%</span>), young adults (<span className="text-amber-400 font-bold">79.1%</span>), and rural residents (<span className="text-rose-400 font-bold">77.5%</span>) experience severe gaps compared to seniors (<span className="text-emerald-400 font-bold">93.4%</span>).
                </div>
              </div>
            </div>

            {/* Sidebar Analytics */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">Key Quality & Access Indicators</h3>
                <p className="text-xs text-slate-400">Provincial aggregates derived from CIHI and FOCUS modules.</p>
              </div>

              <div className="space-y-4">
                {/* Same-day Access indicator */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Same/Next Day Doctor Access</span>
                    <span className="text-xs font-mono font-bold text-rose-500">38.2%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: '38.2%' }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Percentage of Albertans who are able to obtain a same-day or next-day appointment with their primary care team when sick.
                  </p>
                </div>

                {/* Patient Wait satisfaction */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Satisfaction with Wait Time</span>
                    <span className="text-xs font-mono font-bold text-amber-500">53.0%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: '53.0%' }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Percentage of paneled patients satisfied or very satisfied with the wait time for a non-urgent care appointment.
                  </p>
                </div>

                {/* Clinic Continuity */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">High Clinic Continuity</span>
                    <span className="text-xs font-mono font-bold text-indigo-400">70.9%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: '70.9%' }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Patients visiting the same clinic for over 80% of their annual primary care consultations.
                  </p>
                </div>

                {/* Patient experience overall */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-300 font-bold">Primary Care Rating (Excellent)</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">73.1%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '73.1%' }}></div>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Patients rating their overall primary healthcare experience as Excellent or Very Good (HQA FOCUS Survey).
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900">
                <span className="text-[10px] text-indigo-400 uppercase font-black block tracking-wider">CPAR Integration Status</span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Central Patient Attachment Registry (CPAR) is active to prevent panel conflicts, verifying explicit clinic-to-patient relationships.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FIND A PROVIDER DIRECTORY */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          {/* Filters Panel */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-900 pb-3">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Search & Filter Clinics Accepting New Patients</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search text */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  placeholder="Search doctor, clinic or city..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Zone Filter */}
              <div>
                <select
                  value={selectedZoneFilter}
                  onChange={(e) => setSelectedZoneFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Health Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>
              </div>

              {/* Provider Type */}
              <div>
                <select
                  value={selectedTypeFilter}
                  onChange={(e) => setSelectedTypeFilter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Provider Types</option>
                  <option value="Family Doctor">Family Doctors (MD)</option>
                  <option value="Nurse Practitioner">Nurse Practitioners (NP)</option>
                </select>
              </div>

              {/* Quick Feature Checkboxes */}
              <div className="flex flex-wrap gap-x-4 gap-y-2 items-center justify-start md:justify-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterWalkIn}
                    onChange={(e) => setFilterWalkIn(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">Dedicated Walk-In</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterAfterHours}
                    onChange={(e) => setFilterAfterHours(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">After Hours</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterVirtual}
                    onChange={(e) => setFilterVirtual(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-850 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[10px] text-slate-400 font-semibold select-none">Virtual Appts</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-900">
              <span>Showing <strong>{filteredProviders.length}</strong> providers accepting new patients matching criteria.</span>
              <button 
                onClick={() => {
                  setDirectorySearch('');
                  setSelectedZoneFilter('All');
                  setSelectedTypeFilter('All');
                  setFilterWalkIn(false);
                  setFilterAfterHours(false);
                  setFilterVirtual(false);
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Directory Listings Grid */}
          {filteredProviders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProviders.map(prov => (
                <div 
                  key={prov.id} 
                  className="bg-slate-950 border border-slate-900 hover:border-indigo-500/40 rounded-xl p-5 flex flex-col justify-between transition-all shadow-md relative group"
                >
                  <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Accepting Patients
                  </div>

                  <div>
                    {/* Title */}
                    <div className="mb-3">
                      <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-slate-900 text-slate-400 border border-slate-850">
                        {prov.type}
                      </span>
                      <h4 className="text-base font-black text-white mt-1.5 group-hover:text-indigo-400 transition-colors">
                        {prov.name}
                      </h4>
                      <p className="text-xs text-slate-400 font-medium">{prov.clinicName}</p>
                    </div>

                    {/* Address / Zone details */}
                    <div className="space-y-1.5 py-3 border-y border-slate-900 text-xs">
                      <div className="flex items-start gap-2 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                        <div>
                          <p>{prov.address}</p>
                          <p className="text-[10px] text-slate-500">{prov.city}, AB, {prov.postalCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{prov.phone}</span>
                      </div>
                      {prov.pcnName && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>PCN: <strong className="text-slate-400 font-semibold">{prov.pcnName}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Badges / Languages / Actions */}
                  <div className="mt-4 pt-3 space-y-3">
                    {/* Features */}
                    <div className="flex flex-wrap gap-1.5">
                      {prov.features.walkIn && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/5 text-indigo-400 border border-indigo-500/10">
                          Walk-In
                        </span>
                      )}
                      {prov.features.afterHours && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/5 text-blue-400 border border-blue-500/10">
                          After Hours
                        </span>
                      )}
                      {prov.features.virtualAppointments && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                          Virtual
                        </span>
                      )}
                      {prov.features.wheelchairAccess && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-slate-400">
                          Wheelchair
                        </span>
                      )}
                      {prov.features.onlineBooking && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-500/5 text-violet-400 border border-violet-500/10">
                          Online Book
                        </span>
                      )}
                    </div>

                    {/* Languages & Gender */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-500" />
                        <span>{prov.languages.join(', ')}</span>
                      </div>
                      {prov.gender && (
                        <span>Gender: <strong className="text-slate-400">{prov.gender}</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-12 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="text-base font-black text-white">No Matching Providers Found</h4>
                <p className="text-xs text-slate-400">
                  Try widening your filter selections or clearing the search box to browse accepting clinics.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. LGA COMMUNITY NEED */}
      {activeSubTab === 'needs' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Local Geographic Area (LGA) Primary Care Gaps</h3>
              <p className="text-xs text-slate-400">Analyze localized shortages and the corresponding impact on diagnostic and hospital burdens.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Zone:</span>
                <select
                  value={selectedNeedsZone}
                  onChange={(e) => setSelectedNeedsZone(e.target.value)}
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="All">All Zones</option>
                  <option value="Calgary Zone">Calgary Zone</option>
                  <option value="Edmonton Zone">Edmonton Zone</option>
                  <option value="Central Zone">Central Zone</option>
                  <option value="South Zone">South Zone</option>
                  <option value="North Zone">North Zone</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Sort by Need:</span>
                <select
                  value={needsSortBy}
                  onChange={(e) => setNeedsSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none"
                >
                  <option value="physicians">Physicians per 100k (Lowest Supply)</option>
                  <option value="travel">Claims Outside LGA (Highest Travel)</option>
                  <option value="acsc">Avoidable Hospitalization (ACSC)</option>
                  <option value="population">Population (Size)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid Layout of LGAs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedLGAData.map((lga, idx) => {
              // Threshold indicators
              const isShortage = lga.familyPhysiciansPer100k < 75;
              const isHighTravel = lga.pctClaimsOutsideLGA > 40;
              const isHighACSC = lga.acscHospitalizationRatePer100k > 350;

              return (
                <div key={idx} className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-4">
                  {/* Title Bar */}
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">
                        {lga.zone}
                      </span>
                      <h4 className="text-base font-black text-white mt-0.5">
                        {lga.lgaName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Population: {lga.population.toLocaleString()}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      lga.socioeconomicRiskIndex === 'High' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : lga.socioeconomicRiskIndex.includes('High')
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      Risk: {lga.socioeconomicRiskIndex}
                    </span>
                  </div>

                  {/* Core Metrics */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-900">
                    <div className="p-2.5 bg-slate-900/40 border border-slate-900 rounded-lg">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">GP Supply</span>
                      <span className={`text-sm font-mono font-bold block mt-1 ${isShortage ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {lga.familyPhysiciansPer100k} / 100k
                      </span>
                      <span className="text-[9px] text-slate-400">Prov Avg: ~102.3</span>
                    </div>

                    <div className="p-2.5 bg-slate-900/40 border border-slate-900 rounded-lg">
                      <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider block">Travel Reliance</span>
                      <span className={`text-sm font-mono font-bold block mt-1 ${isHighTravel ? 'text-amber-400' : 'text-slate-300'}`}>
                        {lga.pctClaimsOutsideLGA}%
                      </span>
                      <span className="text-[9px] text-slate-400">Consult outside LGA</span>
                    </div>
                  </div>

                  {/* Avoidable Hospitalizations & Mental Health Reliance */}
                  <div className="space-y-2 pt-2 border-t border-slate-900">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Avoidable Hospitalizations (ACSC Rate)</span>
                      <span className={`font-mono font-bold ${isHighACSC ? 'text-rose-400' : 'text-slate-300'}`}>
                        {lga.acscHospitalizationRatePer100k} <span className="text-[10px] text-slate-500">/100k</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">ED Mood/Anxiety Access Rate</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {lga.moodAnxietyEdRatePer100k} <span className="text-[10px] text-slate-500">/100k</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">ED Substance Use Access Rate</span>
                      <span className="font-mono font-bold text-violet-400">
                        {lga.substanceAbuseEdRatePer100k} <span className="text-[10px] text-slate-500">/100k</span>
                      </span>
                    </div>
                  </div>

                  {/* Vulnerability Warnings */}
                  {(isShortage || isHighTravel || isHighACSC) && (
                    <div className="pt-2.5 border-t border-slate-900 flex flex-wrap gap-1">
                      {isShortage && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">
                          Severe GP Shortage
                        </span>
                      )}
                      {isHighTravel && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          Out-of-Area Care Reliance
                        </span>
                      )}
                      {isHighACSC && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">
                          High Preventable Admission
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. PCN CAPACITY & FUNDING */}
      {activeSubTab === 'pcn' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visualizer card */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Primary Care Network (PCN) Resource Distribution</h3>
                <p className="text-xs text-slate-400">Comparison of active primary care providers and payments per patient across health zones.</p>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={PCN_CAPACITY.filter(c => c.zone !== 'Alberta')}
                    margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="zone" stroke="#475569" className="text-[10px] font-bold" />
                    <YAxis yAxisId="left" orientation="left" stroke="#818cf8" tickFormatter={(v) => `${v}`} className="text-[10px] font-mono">
                      <Label value="Active GP Providers" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#818cf8' }} />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" tickFormatter={(v) => `$${v}`} className="text-[10px] font-mono">
                      <Label value="Funding Per Patient" angle={90} position="insideRight" style={{ textAnchor: 'middle', fill: '#10b981' }} />
                    </YAxis>
                    <Tooltip contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="activeProviders" name="Active GP Providers" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={35} />
                    <Bar yAxisId="right" dataKey="fundingPerPatient" name="Annual Funding per Patient" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-3 bg-slate-900/50 border border-slate-900 rounded-lg text-xs text-slate-300">
                <strong>Funding Distribution Insight:</strong> The provincial average funding per patient is <strong className="text-emerald-400">$84.55</strong>. While rural/remote regions like the <strong>North Zone</strong> receive higher relative patient funding (<strong className="text-emerald-400">$87.50</strong>), they suffer from severe provider shortages with only <strong className="text-rose-400">79.1 GP providers per 100k population</strong> compared to Edmonton (<strong className="text-indigo-400">113.8</strong>) and Calgary (<strong className="text-indigo-400">110.3</strong>).
              </div>
            </div>

            {/* Quick stats table */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">PCN Zone Statistics</h3>
                <p className="text-xs text-slate-400">Detailed capacity counts across AHS zones.</p>
              </div>

              <div className="divide-y divide-slate-900 overflow-hidden">
                {PCN_CAPACITY.map((zone, idx) => (
                  <div key={idx} className={`py-2.5 flex justify-between items-center text-xs ${zone.zone === 'Alberta' ? 'bg-indigo-950/20 px-2 rounded-lg border border-indigo-900/30' : ''}`}>
                    <div>
                      <strong className={`font-bold block ${zone.zone === 'Alberta' ? 'text-indigo-300' : 'text-white'}`}>
                        {zone.zone}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        {zone.pcnCount} Networks | {zone.enrolledPatients.toLocaleString()} Patients
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-slate-300 block">
                        {zone.activeProviders} GPs
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {zone.patientsPerProvider} pts/doctor
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Source: AHCIP Statistical Supplement Supplement Table 10.2</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. CAUSAL ER LINK */}
      {activeSubTab === 'er-link' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary Causal Chart */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Impact of Family Doctor Continuity on Low-Acuity ER Visits</h3>
                <p className="text-xs text-slate-400">
                  Annual minor-condition (CTAS 4 & 5) emergency room visits per 1,000 patients, grouped by care continuity with their primary care provider.
                </p>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ED_RELIANCE_BY_CONTINUITY}
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="group" stroke="#475569" className="text-[10px] font-bold" />
                    <YAxis stroke="#475569" className="text-[10px] font-mono" tickFormatter={(v) => `${v}`}>
                      <Label value="ED Visits per 1,000 Patients" angle={-90} position="insideLeft" style={{ textAnchor: 'middle', fill: '#94a3b8' }} />
                    </YAxis>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b' }}
                      formatter={(v: any) => [`${v} visits`, 'Visits per 1,000']}
                    />
                    <Bar dataKey="minorConditionEdVisitsPer1000" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={45}>
                      {ED_RELIANCE_BY_CONTINUITY.map((entry, index) => {
                        let barColor = '#3b82f6';
                        if (entry.group.includes('High')) barColor = '#10b981';
                        if (entry.group.includes('Low')) barColor = '#f59e0b';
                        if (entry.group.includes('No Attached')) barColor = '#f43f5e';
                        if (entry.group.includes('Average')) barColor = '#64748b';
                        return <Cell key={`cell-${index}`} fill={barColor} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="p-4 bg-slate-900/60 border border-slate-900 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <strong className="text-xs text-white">The "Primary Care Collapse to ER Overreliance" Loop:</strong>
                </div>
                <p className="text-xs text-slate-300">
                  HQA FOCUS healthcare datasets demonstrate a direct correlation between primary care continuity and emergency room pressure. Patients who have no family doctor, or have extremely low continuity (&lt;30%), consume over <span className="text-rose-400 font-black">3x more ER visits</span> for simple minor conditions (sore throats, minor rashes, routine medication renewal) than attached patients with high continuity.
                </p>
              </div>
            </div>

            {/* Sidebar Analytical Breakdown */}
            <div className="bg-slate-950 border border-slate-900 rounded-xl p-5 space-y-6">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">Theoretical Action Plan</h3>
                <p className="text-xs text-slate-400">Systemic remedies to alleviate ER pressure via primary care reform.</p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Step 1 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-indigo-400 uppercase font-black tracking-wider block">1. Panel Expansion & Attachment Support</span>
                  <p className="text-slate-400 leading-relaxed">
                    Formalize relationships via CPAR. Target the <strong className="text-white">16.8% unattached residents</strong>, prioritizing low-income and remote geographies with active nurse practitioner integration.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-emerald-400 uppercase font-black tracking-wider block">2. Enhancing After-Hours Clinic Capacity</span>
                  <p className="text-slate-400 leading-relaxed">
                    Over 40% of low-acuity ER visits occur outside standard 9-to-5 working hours. Funding clinics to remain open for evening/weekend walk-ins diverts CTAS 4/5 volumes.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="p-3 bg-slate-900/40 border border-slate-900 rounded-lg space-y-1">
                  <span className="text-[10px] text-violet-400 uppercase font-black tracking-wider block">3. Multi-Disciplinary Health Teams</span>
                  <p className="text-slate-400 leading-relaxed">
                    Surround family doctors with dieticians, mental health workers, and pharmacists to offload non-clinical administrative constraints, increasing daily patient capacity by up to 25%.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                <span>Indicators verified from HQA FOCUS &amp; CIHI priority health guidelines.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
