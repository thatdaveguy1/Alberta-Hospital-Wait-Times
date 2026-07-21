import React, { useState, useMemo } from 'react';
import {
  MapPin,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle
} from 'lucide-react';
import type {
  CommunityNeedMetric,
  ChronicDiseaseBurden,
  EDRelianceMetric,
  TravelForCare,
  ServiceAccessMetric,
} from '../regionalInequityData';
import * as regionalInequityData from '../regionalInequityData';
import { DashboardHeader } from './DashboardHeader';
import { useDomainData } from '../hooks/useDomainData';

type RegionalInequityData = {
  COMMUNITY_NEED_PROFILES: CommunityNeedMetric[];
  CHRONIC_DISEASE_BURDEN: ChronicDiseaseBurden[];
  ED_RELIANCE_METRICS: EDRelianceMetric[];
  TRAVEL_FOR_CARE?: TravelForCare[];
  SERVICE_ACCESS_METRICS?: ServiceAccessMetric[];
};

const defaultDisease: ChronicDiseaseBurden = {
  lgaName: 'Loading...',
  diabetesPrevalencePct: 0,
  copdPrevalencePct: 0,
  hypertensionPrevalencePct: 0,
  infantMortalityPer1000: 0,
  lifeExpectancyYears: 0
};

const defaultEd: EDRelianceMetric = {
  lgaName: 'Loading...',
  totalEdVisitsPer1000: 0,
  lowAcuityCtas45Pct: 0,
  afterHoursEdPct: 0,
  moodAnxietyEdRatePer100k: 0
};

export default function RegionalInequityDashboard() {
  // Live data fetched from /api/data/regional-inequity — no client-side estimation.
  const { data, metadata, isLoading, error } = useDomainData<RegionalInequityData>('regional-inequity', regionalInequityData);

  // Pass through only upstream-mapped arrays. Never invent claims/income/education/ED/travel/access values.
  const COMMUNITY_NEED_PROFILES = data?.COMMUNITY_NEED_PROFILES ?? [];
  const CHRONIC_DISEASE_BURDEN = data?.CHRONIC_DISEASE_BURDEN ?? [];
  const ED_RELIANCE_METRICS = data?.ED_RELIANCE_METRICS ?? [];
  // Travel / service-access stay empty until a real upstream writer exists.
  const TRAVEL_FOR_CARE = data?.TRAVEL_FOR_CARE ?? [];
  const SERVICE_ACCESS_METRICS = data?.SERVICE_ACCESS_METRICS ?? [];

  // Selection highlight for the explorer matrix row
  const [selectedLgaDetail] = useState<string>('Wood Buffalo / Fort McKay');

  // Explorer active category state
  const [explorerCategory, setExplorerCategory] = useState<'all' | 'socioeconomics' | 'chronic' | 'ed' | 'access'>('all');
  const [sortKey, setSortKey] = useState<string>('lgaName');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Combined full table array for All Data Explorer
  const fullCombinedDataset = useMemo(() => {
    return COMMUNITY_NEED_PROFILES.map(p => {
      const disease = CHRONIC_DISEASE_BURDEN.find(d => d.lgaName === p.lgaName) || defaultDisease;
      const ed = ED_RELIANCE_METRICS.find(e => e.lgaName === p.lgaName) || defaultEd;
      const travel = TRAVEL_FOR_CARE.length > 0 ? TRAVEL_FOR_CARE.find(t => t.lgaName === p.lgaName) : null;
      const access = SERVICE_ACCESS_METRICS.length > 0 ? SERVICE_ACCESS_METRICS.find(s => s.lgaName === p.lgaName) : null;
      return {
        ...p,
        ...disease,
        ...ed,
        ...(travel ?? {
          careDeliveredOutsideLgaPct: null,
          topDestinationFacility: null,
          avgTravelDistanceKm: null,
          localBedLeakagePct: null,
        }),
        ...(access ?? {
          facilitiesPer10k: null,
          distanceToNearestEdKm: null,
          distanceToNearestImagingKm: null,
          providersAcceptingPatients: null,
        }),
        lgaName: p.lgaName
      };
    });
  }, [COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, ED_RELIANCE_METRICS, TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS]);

  // Sorted explorer dataset
  const sortedExplorerData = useMemo(() => {
    return [...fullCombinedDataset].sort((a: any, b: any) => {
      let valA = a[sortKey];
      let valB = b[sortKey];

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });
  }, [fullCombinedDataset, sortKey, sortAsc]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 h-4 w-1/3 rounded bg-neutral-chip" />
          <div className="h-3 w-3/4 rounded bg-neutral-chip" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span>Failed to load regional inequity data: {error}</span>
        </div>
      </div>
    );
  }

  // Fail closed when no upstream LGA arrays are present (empty payload / failed sync).
  if (COMMUNITY_NEED_PROFILES.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          icon={MapPin}
          title="Health Inequity & Community Need"
          description="Open Alberta LGA community profiles only. Travel/access and unpublished income fields stay empty until a verified upstream exists."
          metadata={metadata ?? undefined}
          arrayKey="COMMUNITY_NEED_PROFILES"
        variant="light"
        />
        <div className="rounded-xl border border-dashed border-line-2 bg-surface px-4 py-8 text-center text-sm text-ink-3">
          No verified community-need, chronic-disease, or ED-reliance rows are available. Values are not estimated.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <DashboardHeader
        icon={MapPin}
        title="Health Inequity & Community Need"
        description="Analyze geographic disparities, chronic disease burden, and care travel patterns."
        metadata={metadata ?? undefined}
        arrayKey="COMMUNITY_NEED_PROFILES"
        variant="light"
      />

      <div id="ri-explorer-view" className="space-y-6 animate-fadeIn">
        <div className="bg-surface border border-line p-5 rounded-xl  space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h2 className="text-sm font-semibold text-ink   flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-ok" />
                <span>Full Health Equity Diagnostic Matrix</span>
              </h2>
              <p className="text-[10px] text-ink-3 mt-0.5">Surfacing all available primary, secondary, and tertiary health disparity indicators</p>
            </div>

            {/* Filter Subtabs for the explorer */}
            <div className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-paper p-0.5">
              <button
                onClick={() => setExplorerCategory('all')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors cursor-pointer ${explorerCategory === 'all' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
              >
                All Columns
              </button>
              <button
                onClick={() => setExplorerCategory('socioeconomics')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors cursor-pointer ${explorerCategory === 'socioeconomics' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
              >
                Socioeconomics
              </button>
              <button
                onClick={() => setExplorerCategory('chronic')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors cursor-pointer ${explorerCategory === 'chronic' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
              >
                Chronic Diseases
              </button>
              <button
                onClick={() => setExplorerCategory('ed')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors cursor-pointer ${explorerCategory === 'ed' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
              >
                ER Reliance
              </button>
              <button
                onClick={() => setExplorerCategory('access')}
                className={`px-2 py-1 rounded text-[9px] font-semibold transition-colors cursor-pointer ${explorerCategory === 'access' ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink'}`}
              >
                Access & Travel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line bg-paper">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-surface border-b border-line text-[9px] font-semibold text-ink-2  ">
                  <th className="p-3 sticky left-0 bg-surface cursor-pointer hover:bg-paper transition-colors" onClick={() => handleSort('lgaName')}>
                    LGA Name {sortKey === 'lgaName' ? (sortAsc ? '▲' : '▼') : ''}
                  </th>

                  {(explorerCategory === 'all' || explorerCategory === 'socioeconomics') && (
                    <>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors" onClick={() => handleSort('zone')}>Zone {sortKey === 'zone' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors" onClick={() => handleSort('type')}>Type {sortKey === 'type' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-center" onClick={() => handleSort('deprivationIndex')}>Deprivation {sortKey === 'deprivationIndex' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('medianHouseholdIncome')}>Median Income {sortKey === 'medianHouseholdIncome' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('highSchoolGradPct')}>HS Grad % {sortKey === 'highSchoolGradPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                    </>
                  )}

                  {(explorerCategory === 'all' || explorerCategory === 'chronic') && (
                    <>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('lifeExpectancyYears')}>Life Exp. {sortKey === 'lifeExpectancyYears' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('infantMortalityPer1000')}>Infant Mort. {sortKey === 'infantMortalityPer1000' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('diabetesPrevalencePct')}>Diabetes % {sortKey === 'diabetesPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('copdPrevalencePct')}>COPD % {sortKey === 'copdPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('hypertensionPrevalencePct')}>Hypertens. % {sortKey === 'hypertensionPrevalencePct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                    </>
                  )}

                  {(explorerCategory === 'all' || explorerCategory === 'ed') && (
                    <>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('totalEdVisitsPer1000')}>ED Visits/1k {sortKey === 'totalEdVisitsPer1000' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('lowAcuityCtas45Pct')}>CTAS 4/5 % {sortKey === 'lowAcuityCtas45Pct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('afterHoursEdPct')}>After-Hrs % {sortKey === 'afterHoursEdPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('moodAnxietyEdRatePer100k')}>Mental Health ED {sortKey === 'moodAnxietyEdRatePer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                    </>
                  )}

                  {(explorerCategory === 'all' || explorerCategory === 'access') && (
                    <>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('physiciansPer100k')}>Physicians/100k {sortKey === 'physiciansPer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('claimsOutsideLgaPct')}>Outward Care % {sortKey === 'claimsOutsideLgaPct' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('acscRatePer100k')}>ACSC Rate/100k {sortKey === 'acscRatePer100k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('facilitiesPer10k')}>Clinics/10k {sortKey === 'facilitiesPer10k' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('distanceToNearestEdKm')}>ED Dist. (km) {sortKey === 'distanceToNearestEdKm' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('distanceToNearestImagingKm')}>Imaging Dist. (km) {sortKey === 'distanceToNearestImagingKm' ? (sortAsc ? '▲' : '▼') : ''}</th>
                      <th className="p-3 cursor-pointer hover:bg-paper transition-colors text-right" onClick={() => handleSort('providersAcceptingPatients')}>Accepting Practices {sortKey === 'providersAcceptingPatients' ? (sortAsc ? '▲' : '▼') : ''}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line font-mono font-medium text-ink">
                {sortedExplorerData.map((lga, idx) => (
                  <tr key={idx} className={`hover:bg-paper transition-colors ${selectedLgaDetail === lga.lgaName ? 'bg-accent-soft border-l-2 border-l-accent' : ''}`}>
                    <td className="p-3 sticky left-0 bg-surface font-sans font-semibold text-ink max-w-[180px] truncate">
                      {lga.lgaName}
                    </td>

                    {(explorerCategory === 'all' || explorerCategory === 'socioeconomics') && (
                      <>
                        <td className="p-3 font-sans text-ink-2">{lga.zone}</td>
                        <td className="p-3 font-sans text-ink-2">{lga.type}</td>
                        <td className="p-3 text-center">
                          {lga.deprivationIndex ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${lga.deprivationIndex >= 4 ? 'bg-crit-soft text-crit' : 'bg-ok-soft text-ok'}`}>
                              {lga.deprivationIndex} / 5
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-3 text-right text-ink">
                          {lga.medianHouseholdIncome ? `$${lga.medianHouseholdIncome.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.highSchoolGradPct ? `${lga.highSchoolGradPct}%` : '—'}
                        </td>
                      </>
                    )}

                    {(explorerCategory === 'all' || explorerCategory === 'chronic') && (
                      <>
                        <td className="p-3 text-right text-ink">
                          {lga.lifeExpectancyYears ? `${lga.lifeExpectancyYears} yrs` : '—'}
                        </td>
                        <td className="p-3 text-right text-warn">
                          {lga.infantMortalityPer1000 ? lga.infantMortalityPer1000 : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.diabetesPrevalencePct ? `${lga.diabetesPrevalencePct}%` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.copdPrevalencePct ? `${lga.copdPrevalencePct}%` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.hypertensionPrevalencePct ? `${lga.hypertensionPrevalencePct}%` : '—'}
                        </td>
                      </>
                    )}

                    {(explorerCategory === 'all' || explorerCategory === 'ed') && (
                      <>
                        <td className="p-3 text-right text-ink">
                          {lga.totalEdVisitsPer1000 ? lga.totalEdVisitsPer1000 : '—'}
                        </td>
                        <td className="p-3 text-right text-warn">
                          {lga.lowAcuityCtas45Pct ? `${lga.lowAcuityCtas45Pct}%` : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.afterHoursEdPct ? `${lga.afterHoursEdPct}%` : '—'}
                        </td>
                        <td className="p-3 text-right text-ink">
                          {lga.moodAnxietyEdRatePer100k ? lga.moodAnxietyEdRatePer100k : '—'}
                        </td>
                      </>
                    )}

                    {(explorerCategory === 'all' || explorerCategory === 'access') && (
                      <>
                        <td className="p-3 text-right text-ink">
                          {lga.physiciansPer100k ? Number(lga.physiciansPer100k).toFixed(1) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          {lga.claimsOutsideLgaPct ? `${lga.claimsOutsideLgaPct}%` : '—'}
                        </td>
                        <td className="p-3 text-right text-ink">
                          {lga.acscRatePer100k ? lga.acscRatePer100k : '—'}
                        </td>
                        <td className="p-3 text-right text-ink-2">
                          {(lga as { facilitiesPer10k?: number | null }).facilitiesPer10k == null ? '—' : (lga as { facilitiesPer10k: number }).facilitiesPer10k}
                        </td>
                        <td className="p-3 text-right text-warn">
                          {(lga as { distanceToNearestEdKm?: number | null }).distanceToNearestEdKm == null ? '—' : `${(lga as { distanceToNearestEdKm: number }).distanceToNearestEdKm} km`}
                        </td>
                        <td className="p-3 text-right text-warn">
                          {(lga as { distanceToNearestImagingKm?: number | null }).distanceToNearestImagingKm == null ? '—' : `${(lga as { distanceToNearestImagingKm: number }).distanceToNearestImagingKm} km`}
                        </td>
                        <td className="p-3 text-right text-ink">
                          {(lga as { providersAcceptingPatients?: number | null }).providersAcceptingPatients == null ? '—' : (lga as { providersAcceptingPatients: number }).providersAcceptingPatients}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-[10px] text-ink-3 font-sans flex items-center gap-1.5 justify-center sm:justify-start">
            <CheckCircle className="w-3.5 h-3.5 text-ok" />
            <span>Interactive grid supports sorting by clicking any column header. Highlighted row indicates the selected focus LGA.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
