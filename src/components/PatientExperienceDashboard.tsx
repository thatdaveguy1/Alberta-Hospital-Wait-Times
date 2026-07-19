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

const CHART_GRID = 'oklch(0.28 0.02 255)';
const CHART_TICK = 'oklch(0.62 0.02 255)';
const CHART_ACCENT = 'oklch(0.68 0.13 252)';
const CHART_WARN = 'oklch(0.82 0.12 85)';
const CHART_OK = 'oklch(0.78 0.12 155)';

const tooltipStyle = {
  backgroundColor: 'oklch(0.2 0.022 255)',
  border: '1px solid oklch(0.28 0.02 255)',
  borderRadius: '8px',
};

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
      <div className="space-y-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-neutral-chip" />
          <div className="mt-3 h-3 w-1/2 rounded bg-neutral-chip" />
        </div>
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-48 rounded bg-neutral-chip" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center">
        <AlertTriangle className="h-8 w-8 text-warn" />
        <p className="text-sm text-ink-2">Failed to load patient experience data: {error}</p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardHeader
        icon={Users}
        title="Patient Experience & Care Quality"
        description="Verified specialist access waits, HQCA inpatient ratings, and CIHI readmission rates."
        metadata={metadata ?? undefined}
        arrayKey={headerArrayKey}
        variant="light"
      >
        <button
          onClick={refresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-paper"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </DashboardHeader>

      <div className="inline-flex w-fit rounded-lg border border-line bg-paper p-0.5">
        <button
          onClick={() => setActiveSubTab('voice')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeSubTab === 'voice'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Specialist access</span>
        </button>
        <button
          onClick={() => setActiveSubTab('inpatient')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeSubTab === 'inpatient'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Inpatient surveys</span>
        </button>
        <button
          onClick={() => setActiveSubTab('safety')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            activeSubTab === 'safety'
              ? 'bg-accent text-white'
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Clinical safety</span>
        </button>
      </div>

      {activeSubTab === 'voice' && (
        <div className="space-y-4">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="PATIENT_VOICE_BY_SETTING"
          />
          {specialistChartData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warn" />
              No verified specialist access wait data is available.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Specialist median wait times
                  </h3>
                  <p className="text-xs text-ink-3">
                    GoodCaring median waits in weeks by specialty field (Alberta)
                  </p>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={specialistChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis
                        dataKey="metric"
                        stroke={CHART_TICK}
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
                          fill: CHART_TICK,
                          fontSize: 10,
                        }}
                        stroke={CHART_TICK}
                        fontSize={9}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                        formatter={(value: number) => [`${value} weeks`, 'Median wait']}
                      />
                      <Bar
                        dataKey="waitWeeks"
                        name="Median wait (weeks)"
                        fill={CHART_ACCENT}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5 space-y-3 max-h-[28rem] overflow-y-auto">
                <h3 className="text-sm font-semibold text-ink">Specialty waits</h3>
                {specialistChartData.map((row) => (
                  <div
                    key={row.metric}
                    className="rounded-xl border border-line bg-paper p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="block text-xs font-medium text-ink">{row.metric}</span>
                      <p className="text-[10px] text-ink-3">{row.year}</p>
                    </div>
                    <span className="shrink-0 text-lg font-semibold font-mono tabular-nums text-accent">
                      {row.waitWeeks}
                      <span className="ml-1 text-xs font-medium text-ink-3">wks</span>
                    </span>
                  </div>
                ))}
                <div className="flex items-start gap-1.5 border-t border-line pt-2 text-[10px] text-ink-3 leading-relaxed">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
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
        <div className="space-y-4">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="INPATIENT_EXPERIENCE_TRENDS_HQCA"
          />
          {!hasHqcaInpatient ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warn" />
              No verified HQCA inpatient experience ratings are available.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface p-5 md:col-span-2 lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Inpatient care experience trends (HQCA FOCUS)
                  </h3>
                  <p className="text-xs text-ink-3">
                    Overall excellent hospital rating (9–10) from HQCA FOCUS
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={inpatientRatingsFromHqca}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="year" stroke={CHART_TICK} fontSize={10} />
                      <YAxis
                        label={{
                          value: 'Excellent %',
                          angle: -90,
                          position: 'insideLeft',
                          fill: CHART_TICK,
                          fontSize: 10,
                        }}
                        stroke={CHART_TICK}
                        fontSize={9}
                        domain={[40, 80]}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="overallExcellentRating"
                        name="Excellent rating (9–10)"
                        stroke={CHART_ACCENT}
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5 space-y-3 md:col-span-2 lg:col-span-1">
                <h3 className="text-sm font-semibold text-ink">Hospital stay ratings</h3>
                {inpatientRatingsFromHqca.map((item) => (
                  <div
                    key={item.year}
                    className="rounded-xl border border-line bg-paper p-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="block text-xs font-semibold text-ink">{item.year}</span>
                      <p className="text-[10px] text-ink-3">Excellent hospital rating (9 or 10 / 10)</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-lg font-semibold font-mono tabular-nums ${
                          item.overallExcellentRating > 65
                            ? 'text-ok'
                            : item.overallExcellentRating > 60
                              ? 'text-warn'
                              : 'text-crit'
                        }`}
                      >
                        {item.overallExcellentRating}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'safety' && (
        <div className="space-y-4">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="CIHI_ALL_READMISSION_RATES"
          />
          {readmissionChartData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
              <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-warn" />
              No verified CIHI Alberta all-patient readmission rates are available.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    CIHI all-patient hospital readmissions
                  </h3>
                  <p className="text-xs text-ink-3">
                    Alberta province/territory risk-adjusted rate by fiscal year
                  </p>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={readmissionChartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="timeFrame" stroke={CHART_TICK} fontSize={10} />
                      <YAxis
                        label={{
                          value: 'Risk-adjusted %',
                          angle: -90,
                          position: 'insideLeft',
                          fill: CHART_TICK,
                          fontSize: 10,
                        }}
                        stroke={CHART_TICK}
                        fontSize={9}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        itemStyle={{ color: 'oklch(0.96 0.008 255)' }}
                        labelStyle={{ color: 'oklch(0.78 0.015 255)' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line
                        type="monotone"
                        dataKey="riskAdjustedRate"
                        name="Risk-adjusted readmission rate"
                        stroke={CHART_WARN}
                        strokeWidth={2.5}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-5 space-y-3">
                <h3 className="text-sm font-semibold text-ink">Alberta trend points</h3>
                {readmissionChartData.map((row) => (
                  <div
                    key={row.timeFrame}
                    className="rounded-xl border border-line bg-paper p-3 flex items-center justify-between"
                  >
                    <span className="text-xs font-semibold text-ink">{row.timeFrame}</span>
                    <span className="text-lg font-semibold font-mono tabular-nums text-warn">
                      {row.riskAdjustedRate}%
                    </span>
                  </div>
                ))}
                <div className="flex items-start gap-1.5 border-t border-line pt-2 text-[10px] text-ink-3 leading-relaxed">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
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
