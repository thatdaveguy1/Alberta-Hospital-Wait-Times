import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Heart, 
  AlertTriangle, 
  Building2,
  Layers,
  ShieldAlert,
  Info,
  Activity,
  HeartHandshake,
  TrendingUp,
  FileText,
  UserCheck,
  Search,
  Scale,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
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
  PATIENT_VOICE_BY_SETTING, 
  INPATIENT_EXPERIENCE_TRENDS, 
  ED_EXPERIENCE_TRENDS, 
  CLINICAL_SAFETY_TRENDS, 
  PATIENT_COMPLAINTS,
  SettingExperience,
  InpatientDetail,
  EDExperienceTrend,
  HospitalHarmMetric,
  ComplaintCategory
} from '../patientExperienceData';
import { DataTimestamp } from './DataTimestamp';
import { _dataMetadata as patientExperienceDataMetadata } from '../patientExperienceData';

export default function PatientExperienceDashboard() {
  const [activeSubTab, setActiveSubTab] = useState<'voice' | 'inpatient' | 'emergency' | 'safety' | 'complaints'>('voice');
  
  // Filters & State
  const [settingFilter, setSettingFilter] = useState<string>('All');
  const [safetyZoneFilter, setSafetyZoneFilter] = useState<string>('All');
  const [complaintSearch, setComplaintSearch] = useState<string>('');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  // Complaint routing simulator state
  const [simulatedComplaintText, setSimulatedComplaintText] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<string>('');
  const [simulationResponse, setSimulationResponse] = useState<{
    stage: string;
    targetEntity: string;
    timeline: string;
    advice: string;
  } | null>(null);

  const [hospitalsList, setHospitalsList] = useState<{ name: string; city: string; id: string }[]>([]);

  useEffect(() => {
    let active = true;
    
    const localFacilities = [
      { name: "Foothills Medical Centre", city: "Calgary", id: "foothills" },
      { name: "Royal Alexandra Hospital", city: "Edmonton", id: "royal-alex" },
      { name: "University of Alberta Hospital", city: "Edmonton", id: "uah" },
      { name: "Peter Lougheed Centre", city: "Calgary", id: "plc" },
      { name: "Rockyview General Hospital", city: "Calgary", id: "rgh" },
      { name: "South Health Campus", city: "Calgary", id: "shc" },
      { name: "Grey Nuns Community Hospital", city: "Edmonton", id: "gnh" },
      { name: "Misericordia Community Hospital", city: "Edmonton", id: "mch" },
      { name: "Stollery Children's Hospital", city: "Edmonton", id: "stollery" },
      { name: "Alberta Children's Hospital", city: "Calgary", id: "ach" },
      { name: "Sturgeon Community Hospital", city: "St. Albert", id: "sturgeon" },
      { name: "Leduc Community Hospital", city: "Leduc", id: "leduc" },
      { name: "Fort Saskatchewan Community Hospital", city: "Fort Saskatchewan", id: "fort-sask" },
      { name: "Red Deer Regional Hospital", city: "Red Deer", id: "rdr" },
      { name: "Chinook Regional Hospital", city: "Lethbridge", id: "crh" },
      { name: "Medicine Hat Regional Hospital", city: "Medicine Hat", id: "mhrh" },
      { name: "Grande Prairie Regional Hospital", city: "Grande Prairie", id: "gprh" },
      { name: "Queen Elizabeth II Hospital", city: "Grande Prairie", id: "qe2" },
      { name: "Northern Lights Regional Health Centre", city: "Fort McMurray", id: "nlrhc" }
    ];

    setHospitalsList(localFacilities);

    fetch('/api/hospitals')
      .then(res => res.json())
      .then(data => {
        if (!active || !Array.isArray(data)) return;
        
        const uniqueHospitals = new Map<string, { name: string; city: string; id: string }>();
        
        localFacilities.forEach(f => uniqueHospitals.set(f.name.toLowerCase(), f));
        
        data.forEach((h: any) => {
          if (h && h.name) {
            const cleanName = h.name.replace(/\s*\(AHS\)\s*/g, '').trim();
            uniqueHospitals.set(cleanName.toLowerCase(), {
              name: h.name,
              city: h.city || 'Alberta',
              id: h.id || cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')
            });
          }
        });

        const sortedMerged = Array.from(uniqueHospitals.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        setHospitalsList(sortedMerged);
      })
      .catch(err => {
        console.error('[PatientExperience] Error fetching live hospitals:', err);
      });

    return () => {
      active = false;
    };
  }, []);

  // Filtered voice metrics
  const filteredVoiceData = useMemo(() => {
    if (settingFilter === 'All') return PATIENT_VOICE_BY_SETTING;
    return PATIENT_VOICE_BY_SETTING.filter(v => v.setting === settingFilter);
  }, [settingFilter]);

  // Filtered safety metrics
  const filteredSafetyData = useMemo(() => {
    if (safetyZoneFilter === 'All') {
      return CLINICAL_SAFETY_TRENDS.filter(s => s.zone === 'Calgary Zone' || s.zone === 'Edmonton Zone');
    }
    return CLINICAL_SAFETY_TRENDS.filter(s => s.zone === safetyZoneFilter);
  }, [safetyZoneFilter]);

  // Filtered complaints categories
  const filteredComplaints = useMemo(() => {
    return PATIENT_COMPLAINTS.filter(c => 
      c.category.toLowerCase().includes(complaintSearch.toLowerCase()) ||
      c.description.toLowerCase().includes(complaintSearch.toLowerCase())
    );
  }, [complaintSearch]);

  const COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444'];

  const handleSimulateComplaintRouting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedComplaintText || !selectedFacility) return;

    const lowerText = simulatedComplaintText.toLowerCase();
    let determinedCategory = 'General Inquiry';
    let targetEntity = 'AHS Patient Relations (Local Facility Case Manager)';
    let timeline = 'Acknowledged within 3 business days; Resolution within 30 days';
    let advice = 'Always document names, dates, and specifically request a formal letter of summary once findings are complete.';

    if (lowerText.includes('wait') || lowerText.includes('time') || lowerText.includes('delay') || lowerText.includes('cancel')) {
      determinedCategory = 'Access & Timeliness';
      targetEntity = 'Facility Unit Manager + AHS Patient Relations';
      timeline = 'Immediate triage; full review of access logs within 15-20 business days';
      advice = 'For systemic wait time escalations, patients can submit their log files or clinic records to the Office of the Alberta Health Advocate.';
    } else if (lowerText.includes('rude') || lowerText.includes('attitude') || lowerText.includes('respect') || lowerText.includes('dismiss')) {
      determinedCategory = 'Staff Attitude & Conduct';
      targetEntity = 'Department Clinical Director / Chief of Medicine Office';
      timeline = 'Staff consultation meeting scheduled within 7 business days';
      advice = 'Under the Alberta Patient Charter, you have a right to feel safe and respected. Ensure you request an advocate representation.';
    } else if (lowerText.includes('mistake') || lowerText.includes('wrong') || lowerText.includes('pain') || lowerText.includes('pill') || lowerText.includes('harm')) {
      determinedCategory = 'Clinical Care Quality & Safety';
      targetEntity = 'AHS Quality Safety and Outcomes Department (QID)';
      timeline = 'Formal clinical safety incident review initiated; 45 to 90 days audit timeline';
      advice = 'If a preventable harm is confirmed, the hospital is required to initiate a formal disclosure process. You can escalate unresolved clinical harm findings to the Health Professions Regulator (e.g., CPSA, CARNA).';
    } else if (lowerText.includes('explain') || lowerText.includes('understand') || lowerText.includes('discharge') || lowerText.includes('tell')) {
      determinedCategory = 'Communication & Information';
      targetEntity = 'AHS Discharge Planning and Local Unit Leadership';
      timeline = 'Care plan audit completed within 10 business days';
      advice = 'Ask for an Alternate Level of Care (ALC) coordinator or a multidisciplinary case conference to clarify follow-up steps.';
    }

    setSimulationResponse({
      stage: determinedCategory,
      targetEntity,
      timeline,
      advice
    });
  };

  const handleResetSimulation = () => {
    setSimulatedComplaintText('');
    setSelectedFacility('');
    setSimulationResponse(null);
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Patient Experience & Care Quality</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor patient-reported satisfaction, communication quality, and clinical safety.
          </p>
          <DataTimestamp metadata={patientExperienceDataMetadata} arrayKey="PATIENT_SATISFACTION_STATS" />
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSubTab('voice')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'voice'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Patient Voice</span>
        </button>
        <button
          onClick={() => setActiveSubTab('inpatient')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'inpatient'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Inpatient Surveys</span>
        </button>
        <button
          onClick={() => setActiveSubTab('emergency')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'emergency'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Emergency Surveys</span>
        </button>
        <button
          onClick={() => setActiveSubTab('safety')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'safety'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical Safety</span>
        </button>
        <button
          onClick={() => setActiveSubTab('complaints')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSubTab === 'complaints'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Patient Complaints</span>
        </button>
      </div>

      {/* Narrative quality impact disclaimer */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5">
            <HeartHandshake className="w-4.5 h-4.5 text-cyan-400" />
            <span>The Narrative Chain of Quality Efficacy</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            Crowding and access strain directly trigger severe degradations in staff communication efficiency, 
            resulting in worse follow-up coordination, elevated medication and hospital-preventable harm occurrences, 
            which subsequently amplifies patient advocate escalations and administrative complaint backlogs.
          </p>
        </div>
        <span className="text-[9px] bg-cyan-950/40 border border-cyan-500/25 text-cyan-400 px-2 py-1 rounded font-mono font-extrabold shrink-0">
          PROVINCIAL FOCUS INDEX
        </span>
      </div>

      {/* SUBTAB 1: Voice of the Patient */}
      {activeSubTab === 'voice' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Primary Care Listen Index</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">78.4%</span>
                <span className="text-[10px] text-slate-400">National: 79.1%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850">
                Patients who reporting family doctors "Always" listen carefully to their medical concerns.
              </p>
            </div>

            <button
              onClick={() => setExpandedCard(expandedCard === 'ed-communication' ? null : 'ed-communication')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-rose-500/50 ${
                expandedCard === 'ed-communication' ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Emergency Dept Communication</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-400">56.4%</span>
                <span className="text-[10px] text-slate-400">National: 59.2%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850">
                Strained by waiting room bottlenecks and staff rotation frequencies. Click to view historical trend.
              </p>
              {expandedCard === 'ed-communication' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ED_EXPERIENCE_TRENDS} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} domain={[30, 80]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="overallCommunication" name="Communication %" stroke="#f43f5e" strokeWidth={2} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>

            <button
              onClick={() => setExpandedCard(expandedCard === 'inpatient-nurse' ? null : 'inpatient-nurse')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-cyan-500/50 ${
                expandedCard === 'inpatient-nurse' ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Inpatient Nurse Responsiveness</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400">72.8%</span>
                <span className="text-[10px] text-slate-400">National: 74.2%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850">
                Slight gains in late 2025 as ward resource retention models began stabilizing teams. Click to view historical trend.
              </p>
              {expandedCard === 'inpatient-nurse' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={INPATIENT_EXPERIENCE_TRENDS} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} domain={[50, 90]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="nursesCommunication" name="Responsiveness %" stroke="#22d3ee" strokeWidth={2} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>

            <button
              onClick={() => setExpandedCard(expandedCard === 'transition-planning' ? null : 'transition-planning')}
              className={`bg-slate-900 border text-left p-4 rounded-xl space-y-1 cursor-pointer transition-all hover:border-amber-500/50 ${
                expandedCard === 'transition-planning' ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-slate-800'
              }`}
            >
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-extrabold block">Transition & Discharge Planning</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-500">58.2%</span>
                <span className="text-[10px] text-slate-400">National: 61.4%</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1 border-t border-slate-850">
                A chronic system gap. Nearly 42% of patients leave without clear home help guidelines. Click to view historical trend.
              </p>
              {expandedCard === 'transition-planning' && (
                <div className="h-40 mt-3 pt-3 border-t border-slate-850 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={INPATIENT_EXPERIENCE_TRENDS} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" fontSize={9} />
                      <YAxis stroke="#64748b" fontSize={9} domain={[40, 80]} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: 10 }} />
                      <Line type="monotone" dataKey="dischargeInformation" name="Discharge Planning %" stroke="#fbbf24" strokeWidth={2} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Setting comparison chart */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Comparative Experience Ratings</h3>
                  <p className="text-[10px] text-slate-500">Percent reporting positive outcomes across different Alberta settings</p>
                </div>

                <div className="relative">
                  <select
                    value={settingFilter}
                    onChange={(e) => setSettingFilter(e.target.value)}
                    className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1 text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="All">All Care Settings</option>
                    <option value="Primary Care">Primary Care Clinic</option>
                    <option value="Emergency Dept">Emergency Department</option>
                    <option value="Hospital Inpatient">Hospital Inpatient</option>
                  </select>
                </div>
              </div>

              {/* Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredVoiceData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="metric" stroke="#64748b" fontSize={9} interval={0} tickFormatter={(value) => value.length > 20 ? `${value.substring(0, 18)}...` : value} />
                    <YAxis label={{ value: 'Positive %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="albertaRatePct" name="Alberta Performance Rate (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="canadaRatePct" name="Canadian National Average (%)" fill="#475569" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Insight cards */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">FOCUS Survey Demographics</h3>
                <p className="text-[10px] text-slate-500">Data tracking & survey cohort criteria</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[9px] text-cyan-400 font-mono font-bold uppercase">Sampling Frame</span>
                  <p className="text-xs text-white font-bold">Random Stratified Phone & Digital Surveys</p>
                  <p className="text-[10px] text-slate-400">Ensures accurate representation across rural zones (North, South, Central) and urban hubs.</p>
                </div>

                <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[9px] text-emerald-400 font-mono font-bold uppercase">Clinical Context Linkage</span>
                  <p className="text-xs text-white font-bold">Patient-reported Experience (PREMs)</p>
                  <p className="text-[10px] text-slate-400">Linked to patient clinical outcomes (PROMs) to determine if higher communication quality speeds medical recovery.</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>HQA Statement:</strong> System metrics show that when clinicians introduce themselves and invite decision input, patient compliance with follow-up prescription protocols increases by 24%.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: Hospital Inpatient Care */}
      {activeSubTab === 'inpatient' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={patientExperienceDataMetadata} arrayKey="INPATIENT_EXPERIENCE_TRENDS" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Inpatient Care Experience Trends (2021 - 2025)</h3>
                <p className="text-[10px] text-slate-500">Tracking long-term trends from the Inpatient CPES-IC surveys across key communication domains</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={INPATIENT_EXPERIENCE_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Always %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="nursesCommunication" name="Nurse Comm (% Always)" stroke="#06b6d4" strokeWidth={2.5} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="doctorsCommunication" name="Doctor Comm (% Always)" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="painHelpfulness" name="Pain Efficacy (% Always)" stroke="#f59e0b" strokeWidth={2} />
                    <Line type="monotone" dataKey="dischargeInformation" name="Discharge Info Received" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inpatient details cards */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Hospital Stay Ratings</h3>
              
              <div className="space-y-3">
                {INPATIENT_EXPERIENCE_TRENDS.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white">Fiscal Year {item.year}</span>
                      <p className="text-[10px] text-slate-400">Excellent hospital rating (9 or 10 / 10)</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-black ${
                        item.overallExcellentRating > 65 
                          ? 'text-emerald-400' 
                          : item.overallExcellentRating > 60 
                          ? 'text-cyan-400' 
                          : 'text-rose-400'
                      }`}>
                        {item.overallExcellentRating}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-950/20 border border-amber-500/20 text-amber-300 text-[10px] rounded-lg space-y-1">
                <span className="font-extrabold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Core Diagnostic
                </span>
                <p className="leading-normal">
                  The correlation between low nurse communication scores in 2023 and high vacancy/occupancy peaks shows that clinical burnout degrades patient experience immediately, even when medical care remains competent.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Emergency Department Experience */}
      {activeSubTab === 'emergency' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={patientExperienceDataMetadata} arrayKey="ED_EXPERIENCE_TRENDS" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Emergency Patient Experience Trends (EDPEC)</h3>
                <p className="text-[10px] text-slate-500">Tracking communication indicators inside busy urban and regional emergency wards</p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ED_EXPERIENCE_TRENDS}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="overallCommunication" name="General ED Comm" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="staffIntroducedThemselves" name="Staff Introduced" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="helpedWithPain" name="Staff Helped Pain" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="dischargedClearInstructions" name="Discharge Instructions" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ED Context insights */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">The "Crowding Impact"</h3>
                <p className="text-[10px] text-slate-500">How physical emergency room pressure impacts clinical empathy</p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-slate-300">Staff Introductions Threshold</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Fewer than 48.2% of patients reported staff formally introducing their names/titles in 2025. This rate drops below 30% during periods of high "Patients Waiting for Beds" counts.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-slate-300">Prescription Side-Effects Gap</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Explaining potential prescription drug side effects remains the lowest-performing HQA FOCUS metric (averaging only 39.5% in 2025), presenting a clear medication-mishap risk.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-rose-950/15 border border-rose-500/25 rounded-xl text-rose-300 text-[10px] leading-relaxed">
                🚨 <strong>Safety Correlation:</strong> Unclear follow-up/discharge instructions correlate to a 14.8% increase in emergency department return rates within 72 hours.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Hospital Harm & Clinical Safety */}
      {activeSubTab === 'safety' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={patientExperienceDataMetadata} arrayKey="CLINICAL_SAFETY_TRENDS" />
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">CIHI Hospital Harm Rate & Unplanned Readmissions</h3>
              <p className="text-[10px] text-slate-500">Measuring potentially preventable patient safety events by health zone</p>
            </div>

            <div className="relative">
              <select
                value={safetyZoneFilter}
                onChange={(e) => setSafetyZoneFilter(e.target.value)}
                className="bg-slate-950 text-xs border border-slate-800 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="All">All Main Zones</option>
                <option value="Calgary Zone">Calgary Zone</option>
                <option value="Edmonton Zone">Edmonton Zone</option>
                <option value="North Zone">North Zone</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Safety charts */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase">Preventable Harm Rates & 30-Day Readmissions (%)</h4>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={filteredSafetyData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="zone" stroke="#64748b" fontSize={10} />
                    <YAxis label={{ value: 'Rate %', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} stroke="#64748b" fontSize={9} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="hospitalHarmRate" name="Hospital Preventable Harm Rate" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="readmissionRate30Day" name="Unplanned 30-Day Readmissions" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Safety metrics guidelines */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Defining Hospital Harm</h3>
                <p className="text-[10px] text-slate-500">CIHI clinical measurement definitions</p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-rose-400 block">Preventable Harm Categories</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Includes medication-associated errors, post-procedure infections, pressure ulcers acquired during stay, and patient falls inside acute wards.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <span className="text-[10px] font-bold text-amber-500 block">Unplanned Readmissions</span>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Measures patients returning to acute care within 30 days of discharge. High rates suggest inadequate follow-up communication or home coordination.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Clinical Trend:</strong> Edmonton and Calgary saw a safety outcome improvement in 2025 due to standardized checklists and strict central-line infection audits.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: Complaints & Advocacy Routing */}
      {activeSubTab === 'complaints' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={patientExperienceDataMetadata} arrayKey="PATIENT_COMPLAINTS" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-6 lg:col-span-2">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">AHS Patient Relations Feedback Categories</h3>
                  <p className="text-[10px] text-slate-500">Distribution of patient complaints/feedback files logged</p>
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search complaint category..."
                    value={complaintSearch}
                    onChange={(e) => setComplaintSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Complaints List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredComplaints.map((item, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-white block">{item.category}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${
                          item.trend === 'increasing' 
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                            : item.trend === 'decreasing'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}>
                          {item.trend} trend
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">{item.description}</p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Share of Concerns:</span>
                        <span className="font-bold text-slate-300">{item.percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full" style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  </div>
                ))}

                {filteredComplaints.length === 0 && (
                  <div className="col-span-full bg-slate-900 border border-slate-800 p-8 text-center rounded-xl">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-slate-400 text-xs">No complaints categories matched your search criteria.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Complaint Routing Simulator */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Advocacy Triage & Advice Guide</span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Determine the formal resolution path for Patient Relations escalations under the Patient Concerns Regulation.</p>
              </div>

              {!simulationResponse ? (
                <form onSubmit={handleSimulateComplaintRouting} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase">1. Facility or Service Involved</label>
                    <select
                      required
                      value={selectedFacility}
                      onChange={(e) => setSelectedFacility(e.target.value)}
                      className="w-full bg-slate-950 text-xs border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="">-- Select Facility --</option>
                      {hospitalsList.map(h => (
                        <option key={h.id} value={h.name}>{h.name} ({h.city})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-extrabold uppercase">2. Describe Complaint / Concern</label>
                    <textarea
                      required
                      rows={3}
                      value={simulatedComplaintText}
                      onChange={(e) => setSimulatedComplaintText(e.target.value)}
                      placeholder="e.g. 'discharge instructions were unclear and we had to return to emergency', or 'staff was dismissing our questions about safety'"
                      className="w-full bg-slate-950 text-xs border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                    <p className="text-[9px] text-slate-500 italic">Keywords such as "wait", "harm", "dismiss", or "explain" will trigger specific triage pathways.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Determine Resolution Path</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div className="space-y-3.5 bg-slate-950/60 border border-slate-850 p-4 rounded-xl">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase">
                      Triage Result
                    </span>
                    <button
                      onClick={handleResetSimulation}
                      className="text-[10px] text-slate-500 hover:text-white font-bold"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-extrabold block">Triage Category:</span>
                      <span className="text-xs font-bold text-white block">{simulationResponse.stage}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-extrabold block">Primary Case Owner:</span>
                      <span className="text-xs font-bold text-slate-300 block">{simulationResponse.targetEntity}</span>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 uppercase font-extrabold block">Official Regulatory Timeline:</span>
                      <span className="text-xs font-bold text-slate-300 block">{simulationResponse.timeline}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-850/60 space-y-2">
                      <span className="text-[9px] text-cyan-400 uppercase font-extrabold block">Advocacy Advice:</span>
                      <p className="text-[10px] text-slate-400 leading-normal">{simulationResponse.advice}</p>
                      
                      <div className="pt-2 border-t border-slate-900">
                        <a
                          href="https://www.albertahealthservices.ca/about/patientrelations.aspx"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/25 text-[10px] font-bold py-1.5 rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          Submit to AHS Patient Relations Portal
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
