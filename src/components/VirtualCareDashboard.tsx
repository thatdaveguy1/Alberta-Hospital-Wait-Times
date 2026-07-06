import React, { useState, useMemo } from 'react';
import { 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Activity, 
  ExternalLink, 
  ShieldAlert, 
  Info, 
  Calendar, 
  ArrowUpRight, 
  Layers,
  Sparkles,
  TrendingUp,
  MapPin,
  Flame,
  HelpCircle,
  FileSpreadsheet,
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
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import {
  HEALTH_LINK_VOLUMES,
  VIRTUAL_MD_COHORT_STUDY,
  VIRTUAL_MD_DISPOSITIONS,
  EMS_811_DIVERSION_DATA,
  ADJACENT_HELPLINES,
  VIRTUAL_CARE_METADATA
} from '../virtualCareData';
import { DataTimestamp } from './DataTimestamp';

export default function VirtualCareDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'demand' | 'access-modes' | 'virtual-md' | 'ems-diversion' | 'adjacent-lines'>('demand');
  const [activeFiscalYear, setActiveFiscalYear] = useState<string>('2024-2025');

  // Chart colors matching the emerald/teal virtual care theme
  const COLORS = {
    clinical: '#10b981',      // Emerald
    nonClinical: '#3b82f6',   // Blue
    outboundClinical: '#84cc16', // Lime
    outboundNonClinical: '#f59e0b', // Amber
    padis: '#ec4899',         // Pink
    accent: '#8b5cf6',        // Violet
    teal: '#06b6d4',          // Teal
    slate: '#64748b'          // Slate
  };

  const selectedYearData = useMemo(() => {
    return HEALTH_LINK_VOLUMES.find(v => v.fiscalYear === activeFiscalYear) || HEALTH_LINK_VOLUMES[3];
  }, [activeFiscalYear]);

  // Aggregate totals
  const totalReceived = selectedYearData.clinicalReceived + selectedYearData.nonClinicalReceived;
  const totalOutbound = selectedYearData.clinicalOutbound + selectedYearData.nonClinicalOutbound;

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-emerald-400" />
            <span>Virtual Care & 811 Navigation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Track Health Link 811 performance, Virtual MD outcomes, and EMS diversions.
          </p>
          <DataTimestamp metadata={VIRTUAL_CARE_METADATA} arrayKey="HEALTH_LINK_VOLUMES" />
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('demand')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'demand'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Health Link 811</span>
        </button>
        <button
          onClick={() => setActiveSubTab('access-modes')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'access-modes'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Patient Access Modes</span>
        </button>
        <button
          onClick={() => setActiveSubTab('virtual-md')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'virtual-md'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Virtual MD Cohort</span>
        </button>
        <button
          onClick={() => setActiveSubTab('ems-diversion')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'ems-diversion'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>EMS 811 Diversion</span>
        </button>
        <button
          onClick={() => setActiveSubTab('adjacent-lines')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'adjacent-lines'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Adjacent Helplines</span>
        </button>
      </div>

      {/* 1. 811 DEMAND TRENDS */}
      {activeSubTab === 'demand' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Received Inbound</p>
                  <p className="text-2xl font-black text-white mt-1">{(totalReceived).toLocaleString()}</p>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <Phone size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-mono">Fiscal {activeFiscalYear}</span>
                <span className="text-xs text-emerald-400 font-bold">Inbound Call Center</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Clinical (Nurse Triage)</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{selectedYearData.clinicalReceived.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <Activity size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Share of Inbound</span>
                <span className="text-xs text-blue-400 font-bold">{((selectedYearData.clinicalReceived / totalReceived) * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Outbound Calls</p>
                  <p className="text-2xl font-black text-white mt-1">{(totalOutbound).toLocaleString()}</p>
                </div>
                <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                  <Clock size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Clinical Outbound</span>
                <span className="text-xs text-violet-400 font-bold">{selectedYearData.clinicalOutbound.toLocaleString()} calls</span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">PADIS Calls</p>
                  <p className="text-2xl font-black text-pink-400 mt-1">{selectedYearData.padisCalls.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400">
                  <ShieldAlert size={20} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Poison & Drug Info</span>
                <span className="text-xs text-pink-400 font-bold">24/7 Tri-Territory</span>
              </div>
            </div>
          </div>

          {/* Historical Demand Chart & Methodology Warning */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">811 Volume Trends (AHS Quick Facts)</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Comparing Clinical vs. Non-Clinical inbound call volumes</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {HEALTH_LINK_VOLUMES.map(v => (
                    <button
                      key={v.fiscalYear}
                      onClick={() => setActiveFiscalYear(v.fiscalYear)}
                      className={`px-2 py-1 rounded text-[10px] font-bold font-mono transition-all ${
                        activeFiscalYear === v.fiscalYear 
                          ? 'bg-emerald-600 text-white' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {v.fiscalYear.split('-')[1]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={HEALTH_LINK_VOLUMES} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClinical" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.clinical} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.clinical} stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNonClinical" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.nonClinical} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={COLORS.nonClinical} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" style={{ fontSize: 11, fontFamily: 'monospace' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 11 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                      labelClassName="text-white font-bold font-mono text-xs"
                      itemStyle={{ color: '#fff', fontSize: 11 }}
                    />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="clinicalReceived" name="Clinical Inbound" stroke={COLORS.clinical} fillOpacity={1} fill="url(#colorClinical)" />
                    <Area type="monotone" dataKey="nonClinicalReceived" name="Non-Clinical Inbound" stroke={COLORS.nonClinical} fillOpacity={1} fill="url(#colorNonClinical)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Warning & Core Context Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">Methodology Alert & Caveats</span>
                </div>
                
                <h4 className="text-sm font-bold text-slate-200">AHS Data Inconsistencies</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  AHS warns that Health Link metrics varied significantly in recent periods due to <strong>growing call complexity</strong> from new processes like Virtual MD, the EMS/811 shared response line, and Mobile Integrated Health, alongside persistent staff vacancies.
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Because of <strong>quarter-to-quarter methodology changes</strong>, direct comparisons over time can be unreliable. AHS has advised against drawing straight historical trend comparisons without context.
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400 mb-1">
                    <Sparkles size={14} />
                    <span className="text-xs font-bold font-mono">25-Year Milestone Context</span>
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Health Link 811 surpassed 27 million lifetime calls since launching in Edmonton in 2000. It has scaled from 277,000 calls in its first fiscal year to over 1.2 million calls in 2024–25.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/60 mt-4 flex justify-between text-[11px] text-slate-500 font-mono">
                <span>Active Staff: ~800 Pros</span>
                <span>Peak Pandemic Day: 12k Calls</span>
              </div>
            </div>
          </div>

          {/* Outbound & PADIS detailed chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-bold text-white mb-4">Outbound Outreach & Specialty Advice Volumes</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={HEALTH_LINK_VOLUMES} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="fiscalYear" stroke="#64748b" style={{ fontSize: 11, fontFamily: 'monospace' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                    labelClassName="text-white font-bold font-mono text-xs"
                    itemStyle={{ color: '#fff', fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="clinicalOutbound" name="Clinical Outbound Callbacks" fill={COLORS.outboundClinical} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nonClinicalOutbound" name="Non-Clinical Bookings Outbound" fill={COLORS.outboundNonClinical} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="padisCalls" name="PADIS Toxicology Consultations" fill={COLORS.padis} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 2. ACCESS MODES */}
      {activeSubTab === 'access-modes' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main program description */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles size={20} />
                <h3 className="text-base font-bold text-white">Modernizing Ingress Pathways</h3>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Health Link has moved beyond traditional voice-only queues to reduce caller abandonment and telephone hold times. Two major digital initiatives launched provincially to improve public convenience and capacity management:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <MessageSquare size={18} />
                    <h4 className="text-sm font-bold text-white">Health Information Chat</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Enables real-time, text-based interactive conversations with a clinical information nurse directly on the MyHealth Alberta portal.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 font-mono">Business Hours</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">Interactive Web Chat</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                  <div className="flex items-center gap-2 text-teal-400 mb-2">
                    <Clock size={18} />
                    <h4 className="text-sm font-bold text-white">Automated Nurse Callback</h4>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-3">
                    Allows patients waiting in high-volume queues to preserve their place and opt to receive an automated callback from an RN when their turn arises.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 font-mono">24/7 Enabled</span>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-400 font-mono">Queue-Hold Mitigator</span>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong>Urgent Exclusions:</strong> Digital channels and core 811 triage strictly filter out emergency conditions. Digital landing pages explicitly state: <em>"If you have a life-threatening emergency, call 911 immediately or go to the nearest emergency department."</em>
                </p>
              </div>
            </div>

            {/* Ingress Channels Availability Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Access Channels & Capabilities</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-emerald-400" />
                    <span className="text-xs text-slate-200">Interactive Nurse Advice</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">24/7 VOICE</span>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} className="text-blue-400" />
                    <span className="text-xs text-slate-200">Interactive Clinical Chat</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">WEEKDAYS</span>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-teal-400" />
                    <span className="text-xs text-slate-200">Automated Nurse Callback</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold">24/7 QUEUE</span>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-amber-400" />
                    <span className="text-xs text-slate-200">Translation Support</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-bold">130+ LANGS</span>
                </div>

                <div className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-pink-400" />
                    <span className="text-xs text-slate-200">Hearing & Speech Support</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 font-bold">TTY ENABLED</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-850 text-center">
                <p className="text-[10px] text-slate-500">FALLBACK DIRECT LINE</p>
                <p className="text-sm font-mono font-bold text-white mt-0.5">1-866-408-5465</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. VIRTUAL MD OUTCOMES */}
      {activeSubTab === 'virtual-md' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Main facts about program */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Daily Referrals</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">~125</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded bg-emerald-500/10 text-emerald-400">Daily Demand</span>
              </div>
              <p className="text-slate-400 text-xs mt-2">Average 811 callers referred by clinical nurses directly to Virtual MD physicians daily.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Physician Staffing</p>
                  <p className="text-2xl font-black text-teal-400 mt-1">90</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded bg-teal-500/10 text-teal-400">Core Roster</span>
              </div>
              <p className="text-slate-400 text-xs mt-2">Active licensed Alberta physicians participating in assessments from 6 a.m. to 2 a.m. daily.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Initial Milestones</p>
                  <p className="text-2xl font-black text-blue-400 mt-1">100,000</p>
                </div>
                <span className="px-2 py-0.5 text-[9px] font-mono font-black uppercase rounded bg-blue-500/10 text-blue-400">Total Assessed</span>
              </div>
              <p className="text-slate-400 text-xs mt-2">Milestone dataset showing routing dispositions across the province.</p>
            </div>
          </div>

          {/* CJEM Study Evaluation Outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Peer-Reviewed Cohort Study Results */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <Award size={18} className="text-emerald-400" />
                    CJEM Peer-Reviewed Evaluation Study
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">April 1, 2022 to March 31, 2023 • Unique Cohort: 19,312 patients</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 border border-slate-800 text-slate-500 font-mono font-semibold">
                  Source: Springer Link (2025)
                </span>
              </div>
              
              <p className="text-slate-400 text-xs leading-relaxed">
                A validation study tracked whether patients referred to Virtual MD followed physician instructions or subsequently flooded emergency departments. 
              </p>
              <div className="mt-1">
                <DataTimestamp metadata={VIRTUAL_CARE_METADATA} arrayKey="VIRTUAL_MD_COHORT_STUDY" compact />
              </div>

              <div className="space-y-4 pt-2">
                {VIRTUAL_MD_COHORT_STUDY.map((s, index) => (
                  <div key={index} className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-white">{s.adviceCategory}</span>
                      <span className="text-xs text-emerald-400 font-mono font-bold">{s.followThroughPct}% Follow-Through</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                        style={{ width: `${s.followThroughPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1.5 text-[10px] text-slate-500">
                      <span>Measurement: {s.metricLabel}</span>
                      <span>Timeframe: {s.timeframe}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                <h4 className="text-xs font-bold text-slate-300 mb-1">Study-linked data sources integrated:</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Health Link 811 triage records • NACRS (Emergency Visits) • DAD (Hospital Admissions) • Practitioner claims registry • Alberta Population registry.
                </p>
              </div>
            </div>

            {/* Dispositions of 100,000 patients */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Virtual MD Dispositions</h3>
                <p className="text-slate-400 text-xs mb-4">Aesthetic breakdown of final advice categories across first 100,000 patients</p>
                <div className="mb-4">
                  <DataTimestamp metadata={VIRTUAL_CARE_METADATA} arrayKey="VIRTUAL_MD_DISPOSITIONS" compact />
                </div>
                
                <div className="space-y-3.5">
                  {VIRTUAL_MD_DISPOSITIONS.map((d, index) => {
                    const barColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
                    return (
                      <div key={index} className="flex gap-3 items-start">
                        <div className="w-12 text-right text-xs font-mono font-bold shrink-0 pt-0.5" style={{ color: barColors[index] }}>
                          {d.percentageShare.toFixed(1)}%
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <h4 className="text-xs font-bold text-slate-200">{d.outcome}</h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed">{d.description}</p>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1">
                            <div 
                              className="h-full rounded-full" 
                              style={{ width: `${d.percentageShare}%`, backgroundColor: barColors[index] }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 flex items-start gap-3">
                <Info size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  <strong>Does Virtual MD keep people out of ER?</strong> Yes. According to evaluation studies, approximately half (50%) of all assessed patients are safely redirected to home-based self-care, completely avoiding physical system reliance.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. EMS-811 DIVERSION */}
      {activeSubTab === 'ems-diversion' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Headline Diversion Milestone */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  911 EMS Redirect Program
                </span>
                <h3 className="text-base font-bold text-white mt-1">EMS-811 Shared Response Line</h3>
                <p className="text-slate-400 text-xs">Connecting low-acuity 911 calls directly to Health Link 811 nursing triage</p>
              </div>
              <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-850 flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-mono uppercase">Cumulative Diversions</p>
                  <p className="text-lg font-black text-white font-mono">&gt; 50,000</p>
                </div>
                <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400">
                  <TrendingUp size={20} />
                </div>
              </div>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              If a 911 caller requests an ambulance for a condition that does not meet emergency dispatch criteria, 
              dispatchers utilize international triage guidelines to connect the caller directly to a registered nurse at Health Link 811, 
              preventing unnecessary ambulance dispatches and hospital Emergency Room logjams.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-center">
                <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Home Self-Care Advice</p>
                <p className="text-xl font-black text-emerald-400 mt-1">25.0%</p>
                <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">About 1 in 4 patients are advised to care for themselves at home.</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-center">
                <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Family Physician Consult</p>
                <p className="text-xl font-black text-blue-400 mt-1">33.3%</p>
                <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">About 1 in 3 patients are directed to check in with their family doctor.</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 text-center">
                <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">Community Referrals</p>
                <p className="text-xl font-black text-amber-400 mt-1">41.7%</p>
                <p className="text-slate-400 text-[11px] mt-1.5 leading-relaxed">Remaining patients are referred to dentists, pharmacists, or public health.</p>
              </div>
            </div>
          </div>

          {/* Graphic layout of outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2">
              <h3 className="text-sm font-bold text-white mb-4">Estimated Diversion Outcome Split (50,000+ Redirections)</h3>
              <div className="mb-4">
                <DataTimestamp metadata={VIRTUAL_CARE_METADATA} arrayKey="EMS_811_DIVERSION_DATA" compact />
              </div>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={EMS_811_DIVERSION_DATA} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis type="number" stroke="#64748b" style={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="disposition" stroke="#64748b" width={140} style={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                      itemStyle={{ color: '#fff', fontSize: 11 }}
                    />
                    <Bar dataKey="percentageShare" name="Outcome Share (%)" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white mb-2">EMS Policy Caveat</h3>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  The EMS-811 Shared Response Line values are published as a program milestone and are <strong>not part of a recurring monthly open dataset</strong>. 
                </p>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                  To trace detailed ongoing performance, analysts should monitor the EMS returned-to-service rates and file official Freedom of Information (FOIP) requests for monthly raw metrics.
                </p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <ShieldAlert size={14} />
                  <span className="text-[11px] font-bold font-mono">Ongoing Demands</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Integrating low-acuity cases protects frontline paramedic dispatch times and directly saves ED physician hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADJACENT HELPLINE ECOSYSTEM */}
      {activeSubTab === 'adjacent-lines' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Brief explanatory line */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-bold text-white mb-2">Adjacent Navigation & Specialty Lines</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Health Link 811 acts as a central triage gateway. Callers can dial 811 to be seamlessly transferred to clinical specialists
              across a range of provincial sub-lines. This prevents redundant inquiries and reduces friction for patients seeking specialized care.
            </p>
            <div className="mt-3">
              <DataTimestamp metadata={VIRTUAL_CARE_METADATA} arrayKey="ADJACENT_HELPLINES" compact />
            </div>
          </div>

          {/* Grid layout of helplines */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADJACENT_HELPLINES.map((l, index) => (
              <div key={index} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-white max-w-[70%]">{l.lineName}</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono font-bold text-slate-400">
                      {l.availability}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mb-2">Triage Mode: {l.clinicalType}</p>
                </div>
                <div className="pt-3 border-t border-slate-800/60 mt-3 flex justify-between items-center">
                  <span className="text-xs text-slate-400">Est. Annual Intake:</span>
                  <span className="text-sm font-black font-mono text-emerald-400">{l.annualCalls.toLocaleString()}</span>
                </div>
              </div>
            ))}

            {/* PADIS Specialty Service */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-pink-400 max-w-[70%]">PADIS Poison & Drug Info</h4>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/20 font-mono font-bold text-pink-400">
                    24/7 Tri-Territory
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mb-2">Triage Mode: Toxicology consultations</p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 mt-3 flex justify-between items-center">
                <span className="text-xs text-slate-400">Exposure Consults:</span>
                <span className="text-sm font-black font-mono text-pink-400">~45,000</span>
              </div>
            </div>
          </div>

          {/* Social Navigation 211 Adjacent Layer */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-bold text-white mb-2">Adjacent Social Determinants: 211 Alberta</h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-4">
              While 211 Alberta is not under Health Link, unmet social determinants of health (housing instability, food insecurity, financial constraints, and mental health crises) heavily contribute to physical Emergency Department and EMS utilization. Planners analyze 211 social request contacts alongside 811 health lines to map gaps in upstream safety nets.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <p className="text-slate-500 text-[9px] font-mono uppercase">Key Social Needs</p>
                <p className="text-xs font-bold text-white mt-1">Housing / Shelter</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <p className="text-slate-500 text-[9px] font-mono uppercase">Key Social Needs</p>
                <p className="text-xs font-bold text-white mt-1">Food Security</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <p className="text-slate-500 text-[9px] font-mono uppercase">Key Social Needs</p>
                <p className="text-xs font-bold text-white mt-1">Financial Support</p>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                <p className="text-slate-500 text-[9px] font-mono uppercase">Key Social Needs</p>
                <p className="text-xs font-bold text-white mt-1">Mental Wellbeing</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Veracity and Audit Reference Section */}
      <div id="vc-audit-references" className="bg-slate-900/60 border border-slate-850 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-slate-400">
          <FileSpreadsheet size={16} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Data Source & Audit Verification Ledger</h4>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          The dataset displayed above represents high-fidelity metrics integrated directly from official public sources: 
          (1) <em>AHS Quick Facts Annual Reports (2021-2025)</em> reporting actual Clinical Received, Non-Clinical, and Outbound metrics; 
          (2) <em>The Canadian Journal of Emergency Medicine (2025)</em> peer-reviewed evaluation study of 19,312 unique Virtual MD patients (April 2022 to March 2023); 
          (3) <em>Alberta Health Services official announcements</em> on cumulative 911-to-811 Shared Response Line diversion numbers.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[11px] text-slate-400">
          <a 
            href="https://www.primarycarealberta.ca/page14176.aspx" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Primary Care 811 Portal <ExternalLink size={10} />
          </a>
          <a 
            href="https://www.albertahealthservices.ca/about/Page11905.aspx" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            AHS Quick Facts <ExternalLink size={10} />
          </a>
          <a 
            href="https://link.springer.com/article/10.1007/s43678-025-00928-z" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            CJEM Study Publication <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
}
