import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  MapPin, 
  Users, 
  DollarSign, 
  AlertTriangle, 
  Building2, 
  Activity, 
  FileSpreadsheet,
  Layers,
  HeartPulse,
  Coins,
  Scale
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
  NATIONAL_SPENDING_COMPARE, 
  ALBERTA_ACTIVITY_VOLUME_TREND, 
  HOSPITAL_EFFICIENCY_TREND, 
  PHYSICIAN_SPECIALTY_BILLING, 
  ALBERTA_USE_OF_FUNDS
} from '../spendingData';
import { DataTimestamp } from './DataTimestamp';
import { _dataMetadata as spendingDataMetadata } from '../spendingData';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SpendingDashboard() {
  const [activeSpendingTab, setActiveSpendingTab] = useState<'spending-access' | 'national-scoreboard' | 'hospital-efficiency' | 'physician-payments'>('spending-access');
  const [selectedProvince, setSelectedProvince] = useState<string>('Alberta');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('General Practice / Family Medicine');

  const selectedProvinceData = useMemo(() => {
    return NATIONAL_SPENDING_COMPARE.find(p => p.province === selectedProvince) || NATIONAL_SPENDING_COMPARE[0];
  }, [selectedProvince]);

  const selectedSpecialtyData = useMemo(() => {
    return PHYSICIAN_SPECIALTY_BILLING.find(s => s.specialtyGroup === selectedSpecialty) || PHYSICIAN_SPECIALTY_BILLING[0];
  }, [selectedSpecialty]);

  // Derived growth index calculations relative to 2021-2022 baseline (index = 100)
  const derivedGrowthIndexes = useMemo(() => {
    const baseline = ALBERTA_ACTIVITY_VOLUME_TREND[0];
    return ALBERTA_ACTIVITY_VOLUME_TREND.map(year => {
      return {
        fiscalYear: year.fiscalYear,
        'Spending Index': (year.totalExpenseBillions / baseline.totalExpenseBillions) * 100,
        'Surgeries Index': (year.surgeriesCount / baseline.surgeriesCount) * 100,
        'CT Exams Index': (year.ctExamsCount / baseline.ctExamsCount) * 100,
        'Lab Tests Index': (year.labTestsMillions / baseline.labTestsMillions) * 100,
        'ED Visits Index': (year.edVisitsMillions / baseline.edVisitsMillions) * 100,
        'Admissions Index': (year.hospitalAdmissions / baseline.hospitalAdmissions) * 100,
        'Physicians Index': (year.physiciansCount / baseline.physiciansCount) * 100
      };
    });
  }, []);

  const latestAlbertaActivity = ALBERTA_ACTIVITY_VOLUME_TREND[ALBERTA_ACTIVITY_VOLUME_TREND.length - 1];

  return (
    <div id="spending-dashboard-container" className="space-y-6">
      {/* Tab bar header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            <span>Health Expenditures & Efficiency</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Analyze fiscal allocations, national scoreboards, and physician billings.
          </p>
          <DataTimestamp metadata={spendingDataMetadata} arrayKey="NATIONAL_SPENDING_COMPARE" />
        </div>
      </div>

      {/* Primary Sub-Tab Navigation */}
      <div className="border-b border-slate-800/80 flex items-center overflow-x-auto gap-2 pb-px no-scrollbar">
        <button
          onClick={() => setActiveSpendingTab('spending-access')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'spending-access'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Spending & Access</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('national-scoreboard')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'national-scoreboard'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>National Scoreboard</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('hospital-efficiency')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'hospital-efficiency'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Hospital Efficiency</span>
        </button>
        <button
          onClick={() => setActiveSpendingTab('physician-payments')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
            activeSpendingTab === 'physician-payments'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Physician Payments</span>
        </button>
      </div>

      {/* Warning Narrative Chain / Ingestion Insights */}
      <div id="sd-narrative-callout" className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <Scale className="w-4.5 h-4.5 text-emerald-400" />
            <span>Value for Money & Macro Efficiency Signal</span>
          </h4>
          <p className="text-[11px] text-slate-400 max-w-4xl leading-normal">
            <strong>System Productivity Gap:</strong> While Alberta’s per capita expenditure of <strong>$8,540</strong> is the highest among major provinces, patient wait-times and staffed bed shortages persist. This indicates that rising spending is increasingly absorbed by legacy operational structures, personnel premium pay, and service-delivery inflation rather than proportionate physical-capacity expansions.
          </p>
        </div>
        <span className="text-[9px] bg-emerald-950/40 border border-emerald-500/25 text-emerald-400 px-2 py-1 rounded font-mono font-extrabold shrink-0">
          CIHI VALUE BENCHMARK
        </span>
      </div>

      {/* Primary Panels based on Tabs */}
      {activeSpendingTab === 'spending-access' && (
        <div id="sd-spending-access-panel" className="space-y-6">
          <DataTimestamp compact metadata={spendingDataMetadata} arrayKey="ALBERTA_USE_OF_FUNDS" />
          {/* Key Alberta Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">AHS Expense</span>
                <Coins className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-emerald-400">${latestAlbertaActivity.totalExpenseBillions}B</span>
                </div>
                <span className="text-[10px] text-emerald-500 font-mono font-semibold">+8.1% vs prev</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Annual budget consumed by health infrastructure.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Annual Surgeries</span>
                <Activity className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-indigo-400">{latestAlbertaActivity.surgeriesCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">cases</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Total day-surgeries and inpatient procedures.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">CT Scan Imaging</span>
                <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-amber-500">{latestAlbertaActivity.ctExamsCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">exams</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Annual CT scanning exams executed.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Laboratory Tests</span>
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-cyan-400">{latestAlbertaActivity.labTestsMillions}M</div>
                <span className="text-[10px] text-slate-500 font-mono">tests</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Insured clinical lab test volume.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">ER Dept Visits</span>
                <HeartPulse className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-emerald-400">{latestAlbertaActivity.edVisitsMillions}M</div>
                <span className="text-[10px] text-slate-500 font-mono">visits</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Total annual emergency visits.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospital Admissions</span>
                <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-rose-400">{latestAlbertaActivity.hospitalAdmissions.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">stays</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Acute standard admissions handled.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 flex flex-col justify-between hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start gap-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Physicians (FTE)</span>
                <Users className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              </div>
              <div>
                <div className="text-xl font-black text-pink-400">{latestAlbertaActivity.physiciansCount.toLocaleString()}</div>
                <span className="text-[10px] text-slate-500 font-mono">FTEs</span>
              </div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-800/80 font-medium">
                Physicians receiving clinical payments.
              </p>
            </div>
          </div>

          {/* Productivity Disconnect: Index Growth Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Alberta Health spending vs Service activity growth (Cumulative % Change)
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Base Year 2021-22 indexed at 100. Disconnects indicate spending outpacing service delivery yields.
                </p>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={derivedGrowthIndexes}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" domain={[95, 145]} fontSize={9} label={{ value: 'Indexed Growth (Base 100)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="Spending Index" stroke="#ef4444" strokeWidth={3} name="Total Spending" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="Surgeries Index" stroke="#6366f1" strokeWidth={2} name="Surgical Volume" />
                    <Line type="monotone" dataKey="CT Exams Index" stroke="#f59e0b" strokeWidth={2} name="CT Scans Volume" />
                    <Line type="monotone" dataKey="Lab Tests Index" stroke="#06b6d4" strokeWidth={2} name="Lab Tests Volume" />
                    <Line type="monotone" dataKey="ED Visits Index" stroke="#10b981" strokeWidth={2} name="Emergency Room Volume" />
                    <Line type="monotone" dataKey="Admissions Index" stroke="#8b5cf6" strokeWidth={2} name="Hospital Admissions" />
                    <Line type="monotone" dataKey="Physicians Index" stroke="#ec4899" strokeWidth={2} name="Physician Headcount" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* In-depth Allocation of Funds */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Use of Alberta Health Public Funds
                </h3>
                <p className="text-[10px] text-slate-500">
                  Distribution of public health expenditure by category (CIHI NHEX Profile)
                </p>
              </div>

              <div className="h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ALBERTA_USE_OF_FUNDS}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="amountBillions"
                    >
                      {ALBERTA_USE_OF_FUNDS.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value} Billion`} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-2">
                {ALBERTA_USE_OF_FUNDS.map((fund, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] py-1 px-1.5 rounded-md hover:bg-slate-850/60 transition-all">
                    <div className="flex items-center gap-2 text-slate-300 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate font-medium">{fund.category}</span>
                    </div>
                    <span className="text-white font-mono font-bold shrink-0">${fund.amountBillions.toFixed(2)}B ({fund.percentageShare}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'national-scoreboard' && (
        <div id="sd-national-scoreboard-panel" className="space-y-6">
          <DataTimestamp compact metadata={spendingDataMetadata} arrayKey="CIHI_SPENDING_PER_PERSON" />
          {/* Province focus row */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Canada-Wide Spending & Efficiency Scoreboard
                </h3>
                <p className="text-[10px] text-slate-500">
                  Select a province to examine comparative CIHI metrics relative to Alberta's profile
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850">
                {NATIONAL_SPENDING_COMPARE.map((prov, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedProvince(prov.province)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedProvince === prov.province
                        ? 'bg-indigo-600 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {prov.province}
                  </button>
                ))}
              </div>
            </div>

            {/* granular scoreboard comparisons */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Total Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.spendingPerCapita.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-mono mt-2">
                  {selectedProvince === 'Alberta' ? (
                    <span className="text-emerald-400 font-semibold">Highest in Major Provinces</span>
                  ) : (
                    <span>AB spends <strong className="text-emerald-400">+${(NATIONAL_SPENDING_COMPARE[0].spendingPerCapita - selectedProvinceData.spendingPerCapita).toLocaleString()}</strong> more</span>
                  )}
                </div>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Cost per Standard Stay</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.costPerStandardStay.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Adjusted unit cost per clinical admission.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Staffed Beds / 100k</span>
                <div className="text-xl font-black text-white">{selectedProvinceData.bedsPer100k}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Staffed acute beds per 100k residents.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospital Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.hospitalSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Dedicated hospital funding per person.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Physician Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.physicianSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Gross insured physician costs per person.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Drug Spend / Capita</span>
                <div className="text-xl font-black text-white">${selectedProvinceData.drugSpendingPerCapita.toLocaleString()}</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Public and private pharmaceutical costs.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Health Spend % of GDP</span>
                <div className="text-xl font-black text-white">{selectedProvinceData.spendingAsPercentGdp}%</div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Total health spending share of GDP.
                </p>
              </div>
            </div>
          </div>

          {/* National charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Total Health Spending per Capita (CAD) vs % of GDP
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={NATIONAL_SPENDING_COMPARE}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis yAxisId="left" stroke="#10b981" fontSize={9} label={{ value: 'Per Capita Spending ($)', angle: -90, position: 'insideLeft', fill: '#10b981', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6366f1" fontSize={9} label={{ value: '% of GDP', angle: 90, position: 'insideRight', fill: '#6366f1', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="spendingPerCapita" name="Per Capita Spending ($)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="spendingAsPercentGdp" name="Spending as % of GDP" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Cost of Standard Hospital Stay (CIHI CSHS)
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={NATIONAL_SPENDING_COMPARE}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="province" stroke="#64748b" fontSize={9} />
                    <YAxis stroke="#64748b" domain={[5000, 8000]} fontSize={9} label={{ value: 'Cost per stay ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, offset: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="costPerStandardStay" name="Standard Acute Stay Cost ($)" fill="#ef4444" radius={[4, 4, 0, 0]}>
                      {NATIONAL_SPENDING_COMPARE.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.province === 'Alberta' ? '#ef4444' : '#64748b'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'hospital-efficiency' && (
        <div id="sd-hospital-efficiency-panel" className="space-y-6">
          <DataTimestamp compact metadata={spendingDataMetadata} arrayKey="HOSPITAL_EFFICIENCY_TREND" />
          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between hover:border-slate-700 transition-all">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Standard Stay Cost</span>
              <div className="text-xl font-black text-rose-400">${HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].standardStayCost.toLocaleString()}</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Adjusted unit cost of standard acute-care hospitalization in Alberta.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between hover:border-slate-700 transition-all">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Spend per Staffed Bed</span>
              <div className="text-xl font-black text-orange-400">${HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].spendingPerStaffedBed.toLocaleString()}</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Annual clinical overhead, supply, and nurse staffing expense per operating bed.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between hover:border-slate-700 transition-all">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Staff Hours per Bed</span>
              <div className="text-xl font-black text-amber-500">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].hoursWorkedPerBed.toLocaleString()} hrs</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Cumulative annual hours worked by healthcare practitioners per operating bed.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between hover:border-slate-700 transition-all">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Hospitalizations / Bed</span>
              <div className="text-xl font-black text-cyan-400">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].hospitalizationsPerBed.toLocaleString()} stays</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Average acute stays/admissions handled annually per staffed bed.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1 flex flex-col justify-between hover:border-slate-700 transition-all">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Surgeries per Bed</span>
              <div className="text-xl font-black text-indigo-400">{HOSPITAL_EFFICIENCY_TREND[HOSPITAL_EFFICIENCY_TREND.length - 1].surgeriesPerBed.toLocaleString()} cases</div>
              <p className="text-[9px] text-slate-400 pt-1.5 border-t border-slate-850 font-medium mt-2">
                Total operations and surgeries performed annually divided by staffed beds.
              </p>
            </div>
          </div>

          {/* Efficiency trend chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Staffing Hours Worked vs. Inpatient Admissions per Bed
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={HOSPITAL_EFFICIENCY_TREND}
                    margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="fiscalYear" stroke="#64748b" fontSize={9} />
                    <YAxis yAxisId="left" stroke="#f59e0b" fontSize={9} label={{ value: 'Staffing Hours Worked', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={9} label={{ value: 'Admissions per Operating Bed', angle: 90, position: 'insideRight', fill: '#ef4444', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line yAxisId="left" type="monotone" dataKey="hoursWorkedPerBed" name="Staff Hours per Bed" stroke="#f59e0b" strokeWidth={2.5} />
                    <Line yAxisId="right" type="monotone" dataKey="hospitalizationsPerBed" name="Admissions per Bed" stroke="#ef4444" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Hospital Overhead Efficiency Analysis
                </h3>
                <p className="text-[10px] text-slate-500">
                  Explaining rising staffing intensity paired with declining admissions yield
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-rose-400 font-mono font-bold uppercase block">
                    Productivity Squeeze
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    Annual spending per staffed bed surged from <strong>$212,000</strong> to <strong>$292,000</strong> (+37%), but the admissions handled per bed decreased from <strong>42.4</strong> to <strong>37.8</strong>. This demonstrates a decline in hospital asset productivity, driven by systemic inpatient bottlenecks and patient flow delays.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-amber-500 font-mono font-bold uppercase block">
                    CIHI Standard Stay Cost Spike
                  </span>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    The Cost of a Standard Hospital Stay rose by 13.4% to <strong>$7,420</strong>. This indicates rising underlying operational cost-per-case, influenced heavily by staffing shortages forcing premium-rate overtime usage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSpendingTab === 'physician-payments' && (
        <div id="sd-physician-payments-panel" className="space-y-6">
          <DataTimestamp compact metadata={spendingDataMetadata} arrayKey="PHYSICIAN_SPECIALTY_BILLING" />
          {/* Selector & Details row */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Physician Insured Clinical Billing & Intensity
                </h3>
                <p className="text-[10px] text-slate-500">
                  Compare total gross fee-for-service allocations and service intensity by medical specialty
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-850">
                {PHYSICIAN_SPECIALTY_BILLING.map((spec, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSpecialty(spec.specialtyGroup)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      selectedSpecialty === spec.specialtyGroup
                        ? 'bg-emerald-600 text-white font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spec.specialtyGroup.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialty metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">FTE Clinical Count</span>
                  <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{selectedSpecialtyData.physicianCount}</div>
                  <span className="text-[10px] text-slate-500 font-mono">practitioners</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Rostered physicians practicing in this category.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Total Payments</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">${selectedSpecialtyData.totalPaymentsMillions}M</div>
                  <span className="text-[10px] text-slate-500 font-mono">annual billings</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Sum of clinical fees and program expenditures.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug font-mono">Avg Gross Payment / MD</span>
                  <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-emerald-400">${selectedSpecialtyData.averagePaymentGross.toLocaleString()}</div>
                  <span className="text-[10px] text-slate-500 font-mono">per physician</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Clinical billings before clinic overhead costs.
                </p>
              </div>

              <div className="bg-slate-955 border border-slate-850 p-4 rounded-xl space-y-1 hover:border-emerald-500/30 transition-all flex flex-col justify-between">
                <div className="flex justify-between items-start gap-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-extrabold block leading-snug">Services per Patient / Year</span>
                  <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                </div>
                <div>
                  <div className="text-xl font-black text-white">{selectedSpecialtyData.servicesPerPatient}</div>
                  <span className="text-[10px] text-slate-500 font-mono">avg annual services</span>
                </div>
                <p className="text-[9px] text-slate-500 pt-1.5 border-t border-slate-850 font-medium mt-2">
                  Average consults/procedures per unique patient.
                </p>
              </div>
            </div>
          </div>

          {/* Specialty charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                Average Gross Clinical Payment per Physician (CAD)
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={PHYSICIAN_SPECIALTY_BILLING}
                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="specialtyGroup" stroke="#64748b" fontSize={9} tickFormatter={(val) => val.split(' ')[0]} />
                    <YAxis stroke="#64748b" fontSize={9} label={{ value: 'Average Gross Payment ($)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="averagePaymentGross" name="Avg Gross Payment ($)" fill="#10b981" radius={[4, 4, 0, 0]}>
                      {PHYSICIAN_SPECIALTY_BILLING.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.specialtyGroup === selectedSpecialty ? '#10b981' : '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest font-mono">
                  Billing & Retention Analytics
                </h3>
                <p className="text-[10px] text-slate-500">
                  Insights from the AHCIP Statistical Supplement Tables
                </p>
              </div>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-indigo-400 font-mono font-bold uppercase block">
                    Specialty Allocation Gap
                  </span>
                  <p className="text-xs text-white font-bold mt-1">General Practice vs. Surgery</p>
                  <p className="text-[10px] text-slate-400 leading-normal mt-1">
                    While General Practice commands the largest collective pool (<strong>$1.42 Billion</strong>), the average gross payment is <strong>$262,000</strong>. Surgical specialties average over <strong>$539,000</strong>. This creates significant commercial pressures for primary care practices facing rising clinic operational overheads.
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                  <span className="text-[8px] text-rose-400 font-mono font-bold uppercase block">
                    Insured Fee Reform Impact
                  </span>
                  <p className="text-[10px] text-slate-400 leading-normal mt-1">
                    Insured FFS billing data highlights high-intensity clinical activities. Current primary care reform targets shifting family physicians from pure FFS (fee-for-service) to blended capitation models to encourage comprehensive community medicine.
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
