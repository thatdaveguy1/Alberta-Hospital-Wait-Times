import React from 'react';
import { PhoneCall, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import type { HealthLinkVolume } from '../virtualCareData';
import * as virtualCareData from '../virtualCareData';
import { DashboardHeader } from './DashboardHeader';
import { DataTimestamp } from './DataTimestamp';
import { useDomainData } from '../hooks/useDomainData';

type VirtualCareData = {
  HEALTH_LINK_VOLUMES: HealthLinkVolume[];
  VIRTUAL_MD_COHORT_STUDY?: unknown[];
  VIRTUAL_MD_DISPOSITIONS?: unknown[];
  EMS_811_DIVERSION_DATA?: unknown[];
  ADJACENT_HELPLINES?: unknown[];
};

/**
 * Virtual care domain has no reliable automated metric feed.
 * PubMed only verifies a study exists; AHS news rarely yields fiscal volumes.
 * Manual study / proxy / forecast panels are removed — fail closed.
 */
export default function VirtualCareDashboard() {
  const { data, metadata, isLoading, error, refresh } = useDomainData<VirtualCareData>(
    'virtual-care',
    virtualCareData,
  );

  const volumes = data?.HEALTH_LINK_VOLUMES ?? [];
  const volumesMeta = metadata?.HEALTH_LINK_VOLUMES;
  const volumesAreAuto =
    volumes.length > 0 && volumesMeta?.updateType === 'auto';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
        Loading virtual care data...
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-400 text-sm gap-3">
        <AlertTriangle className="w-6 h-6 text-amber-400" />
        <span>Failed to load virtual care data: {error}</span>
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
        icon={PhoneCall}
        title="Virtual Care & 811 Navigation"
        description="Health Link volumes only when scraped from a verified AHS publication. Cohort study, diversion proxies, and adjacent-helpline estimates are not shown."
        metadata={metadata ?? undefined}
        arrayKey="HEALTH_LINK_VOLUMES"
      />

      {!volumesAreAuto ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white">No verified virtual-care metrics available</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The virtual-care pipeline verifies PubMed PMID 40465166 and scans AHS news for Health Link volume announcements.
                It does not re-derive Virtual MD cohort percentages, EMS diversion splits, or adjacent helpline volumes.
                Those manual study/proxy panels were removed so the dashboard never presents fabricated or one-time estimates as live data.
              </p>
              <p className="text-[11px] text-slate-500 font-mono">
                Status: waiting for an AHS fiscal-year volume publication that the fetcher can map to HEALTH_LINK_VOLUMES.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTimestamp compact metadata={metadata ?? undefined} arrayKey="HEALTH_LINK_VOLUMES" />
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3 font-bold">Fiscal year</th>
                  <th className="p-3 font-bold text-right">Clinical inbound</th>
                  <th className="p-3 font-bold text-right">Non-clinical inbound</th>
                  <th className="p-3 font-bold text-right">Clinical outbound</th>
                  <th className="p-3 font-bold text-right">PADIS</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((row) => (
                  <tr key={row.fiscalYear} className="border-t border-slate-800">
                    <td className="p-3 text-white font-mono font-bold">{row.fiscalYear}</td>
                    <td className="p-3 text-right text-emerald-400 font-mono">
                      {row.clinicalReceived > 0 ? row.clinicalReceived.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right text-slate-300 font-mono">
                      {row.nonClinicalReceived > 0 ? row.nonClinicalReceived.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right text-slate-300 font-mono">
                      {row.clinicalOutbound > 0 ? row.clinicalOutbound.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right text-pink-400 font-mono">
                      {row.padisCalls > 0 ? row.padisCalls.toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
