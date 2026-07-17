import React, { useMemo, useState } from 'react';
import {
  Users,
  Building2,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Info,
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
} from 'recharts';
import type { SettingExperience } from '../patientExperienceData';
import * as patientExperienceData from '../patientExperienceData';
import { DataTimestamp } from './DataTimestamp';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type InpatientExperienceHqcaRow = {
  year: string;
  zone: string;
  rating: number;
  percentage: number;
};

type PatientExperienceData = {
  PATIENT_VOICE_BY_SETTING?: SettingExperience[];
  INPATIENT_EXPERIENCE_TRENDS_HQCA?: InpatientExperienceHqcaRow[];
  CIHI_ALL_READMISSION_RATES?: Record<string, unknown>[];
  CIHI_ACSC_HOSPITALIZATIONS?: Record<string, unknown>[];
};

function isAlbertaWideHqcaZone(zone: string): boolean {
  const z = zone.trim().toUpperCase();
  return z === 'ALL' || z === 'ALBERTA';
}

/** Sum rating 9–10 percentages per fiscal year (zone ALL preferred). */
function deriveHqcaOverallExcellentSeries(
  rows: InpatientExperienceHqcaRow[],
): { year: string; overallExcellentRating: number }[] {
  const byYear = new Map<string, InpatientExperienceHqcaRow[]>();
  for (const row of rows) {
    const bucket = byYear.get(row.year) ?? [];
    bucket.push(row);
    byYear.set(row.year, bucket);
  }
  const series: { year: string; overallExcellentRating: number }[] = [];
  for (const [year, yearRows] of byYear) {
    const albertaRows = yearRows.filter((r) => isAlbertaWideHqcaZone(r.zone));
    const pool = albertaRows.length > 0 ? albertaRows : yearRows;
    const excellent = pool
      .filter((r) => r.rating === 9 || r.rating === 10)
      .reduce((sum, r) => sum + r.percentage, 0);
    series.push({
      year,
      overallExcellentRating: Math.round(excellent * 10) / 10,
    });
  }
  return series.sort((a, b) => a.year.localeCompare(b.year));
}

function parseCihiNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && v.trim() !== '–' && v.trim() !== '-') {
    const n = parseFloat(v.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isAlbertaProvince(row: Record<string, unknown>): boolean {
  const prov = String(row['Province/Territory'] ?? '').trim();
  return prov === 'Alberta' || prov === 'AB' || prov.includes('Alberta');
}

function isProvinceTerritoryLevel(row: Record<string, unknown>): boolean {
  const level = String(row['Reporting level'] ?? '').trim().toLowerCase();
  return level.includes('province');
}

export default function PatientExperienceDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<PatientExperienceData>(
    'patient-experience',
    patientExperienceData,
  );

  const PATIENT_VOICE_BY_SETTING = data?.PATIENT_VOICE_BY_SETTING ?? [];
  const INPATIENT_EXPERIENCE_TRENDS_HQCA = data?.INPATIENT_EXPERIENCE_TRENDS_HQCA ?? [];
  const CIHI_ALL_READMISSION_RATES = data?.CIHI_ALL_READMISSION_RATES ?? [];

  const [activeSubTab, setActiveSubTab] = useState<'voice' | 'inpatient' | 'safety'>('voice');

  const specialistWaitRows = useMemo(
    () => PATIENT_VOICE_BY_SETTING.filter((v) => v.setting === 'Specialist Access'),
    [PATIENT_VOICE_BY_SETTING],
  );

  const specialistChartData = useMemo(
    () =>
      specialistWaitRows.map((row) => ({
        metric: row.metric.replace(/\s*Median Wait \(weeks\)\s*$/i, '').trim() || row.metric,
        waitWeeks: row.albertaRatePct,
        year: row.year,
      })),
    [specialistWaitRows],
  );

  const inpatientRatingsFromHqca = useMemo(
    () => deriveHqcaOverallExcellentSeries(INPATIENT_EXPERIENCE_TRENDS_HQCA),
    [INPATIENT_EXPERIENCE_TRENDS_HQCA],
  );

  const hasHqcaInpatient = inpatientRatingsFromHqca.length > 0;

  const readmissionChartData = useMemo(() => {
    const provincial = CIHI_ALL_READMISSION_RATES.filter(
      (r) => isAlbertaProvince(r) && isProvinceTerritoryLevel(r),
    );
    const points: { timeFrame: string; riskAdjustedRate: number }[] = [];
    for (const row of provincial) {
      const timeFrame = String(row['Time frame'] ?? '').trim();
      const rate = parseCihiNumber(row['Risk-adjusted rate']);
      if (!timeFrame || rate == null) continue;
      points.push({ timeFrame, riskAdjustedRate: rate });
    }
    return points.sort((a, b) => a.timeFrame.localeCompare(b.timeFrame));
  }, [CIHI_ALL_READMISSION_RATES]);

  const headerArrayKey =
    hasHqcaInpatient
      ? 'INPATIENT_EXPERIENCE_TRENDS_HQCA'
      : specialistWaitRows.length > 0
        ? 'PATIENT_VOICE_BY_SETTING'
        : readmissionChartData.length > 0
          ? 'CIHI_ALL_READMISSION_RATES'
          : 'INPATIENT_EXPERIENCE_TRENDS_HQCA';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading patient experience data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load patient experience data: {error}</span>
        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 hover:border-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={Users}
        title="Patient Experience & Care Quality"
        description="Verified specialist access waits, HQCA inpatient ratings, and CIHI readmission rates."
        metadata={metadata ?? undefined}
        arrayKey={headerArrayKey}
      />

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
          <span>Specialist Access</span>
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
      </div>

      {activeSubTab === 'voice' && (
        <div className="space-y-6">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="PATIENT_VOICE_BY_SETTING" />
          {specialistChartData.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">
                No verified specialist access wait data is available.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Specialist Median Wait Times
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    GoodCaring median waits in weeks by specialty field (Alberta)
                  </p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={specialistChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="metric"
                        stroke="#64748b"
                        fontSize={9}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        tickFormatter={(value: string) =>
                          value.length > 18 ? `${value.substring(0, 16)}…` : value
                        }
                      />
                      <YAxis
                        label={{
                          value: 'Weeks',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748b',
                          fontSize: 10,
                        }}
                        stroke="#64748b"
                        fontSize={9}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                        formatter={(value: number) => [`${value} weeks`, 'Median wait']}
                      />
                      <Bar
                        dataKey="waitWeeks"
                        name="Median wait (weeks)"
                        fill="#06b6d4"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 max-h-[28rem] overflow-y-auto">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Specialty Waits
                </h3>
                {specialistChartData.map((row) => (
                  <div
                    key={row.metric}
                    className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-xs font-bold text-white block">{row.metric}</span>
                      <p className="text-[10px] text-slate-500">{row.year}</p>
                    </div>
                    <span className="text-lg font-black text-cyan-400 shrink-0">
                      {row.waitWeeks}
                      <span className="text-[10px] font-bold text-slate-400 ml-1">wks</span>
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Values are median specialist referral waits in weeks. Percent-style satisfaction
                    scores are not shown on this tab.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'inpatient' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            metadata={metadata ?? undefined}
            arrayKey="INPATIENT_EXPERIENCE_TRENDS_HQCA"
          />
          {!hasHqcaInpatient ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">
                No verified HQCA inpatient experience ratings are available.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Inpatient Care Experience Trends (HQCA FOCUS)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Overall excellent hospital rating (9–10) from HQCA FOCUS
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={inpatientRatingsFromHqca}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="year" stroke="#64748b" fontSize={10} />
                      <YAxis
                        label={{
                          value: 'Excellent %',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748b',
                          fontSize: 10,
                        }}
                        stroke="#64748b"
                        fontSize={9}
                        domain={[40, 80]}
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="overallExcellentRating"
                        name="Excellent rating (9–10)"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Hospital Stay Ratings
                </h3>
                <div className="space-y-3">
                  {inpatientRatingsFromHqca.map((item) => (
                    <div
                      key={item.year}
                      className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <span className="text-xs font-bold text-white">{item.year}</span>
                        <p className="text-[10px] text-slate-400">
                          Excellent hospital rating (9 or 10 / 10)
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-lg font-black ${
                            item.overallExcellentRating > 65
                              ? 'text-emerald-400'
                              : item.overallExcellentRating > 60
                                ? 'text-cyan-400'
                                : 'text-rose-400'
                          }`}
                        >
                          {item.overallExcellentRating}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'safety' && (
        <div className="space-y-6">
          <DataTimestamp
            compact
            metadata={metadata ?? undefined}
            arrayKey="CIHI_ALL_READMISSION_RATES"
          />
          {readmissionChartData.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-slate-400 text-xs">
                No verified CIHI Alberta all-patient readmission rates are available.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    CIHI All-Patient Hospital Readmissions
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Alberta province/territory risk-adjusted rate by fiscal year
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={readmissionChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="timeFrame" stroke="#64748b" fontSize={10} />
                      <YAxis
                        label={{
                          value: 'Risk-adjusted %',
                          angle: -90,
                          position: 'insideLeft',
                          fill: '#64748b',
                          fontSize: 10,
                        }}
                        stroke="#64748b"
                        fontSize={9}
                      />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="riskAdjustedRate"
                        name="Risk-adjusted readmission rate"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Alberta Trend Points
                </h3>
                {readmissionChartData.map((row) => (
                  <div
                    key={row.timeFrame}
                    className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-white">{row.timeFrame}</span>
                    <span className="text-lg font-black text-amber-400">
                      {row.riskAdjustedRate}%
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-slate-850 text-[10px] text-slate-400 flex items-start gap-1.5 leading-relaxed">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    Source: CIHI all-patients readmitted indicator at province/territory reporting
                    level for Alberta.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
