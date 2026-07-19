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
      <div className="space-y-4">
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-4 w-1/3 rounded bg-neutral-chip mb-3" />
          <div className="h-3 w-1/2 rounded bg-neutral-chip" />
        </div>
        <div className="animate-pulse rounded-xl border border-line bg-surface p-4">
          <div className="h-8 w-full rounded bg-neutral-chip" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <DashboardHeader
          icon={PhoneCall}
          title="Virtual Care & 811 Navigation"
          description="Health Link volumes only when scraped from a verified AHS publication. Cohort study, diversion proxies, and adjacent-helpline estimates are not shown."
          metadata={metadata ?? undefined}
          arrayKey="HEALTH_LINK_VOLUMES"
          variant="light"
        />
        <div className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
          <span className="flex-1">Failed to load virtual care data: {error}</span>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:bg-paper cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
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
        variant="light"
      />

      {!volumesAreAuto ? (
        <div className="rounded-xl border border-line bg-surface p-6">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-ink-2" />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">No verified virtual-care metrics available</h3>
              <p className="text-xs leading-relaxed text-ink-2">
                The virtual-care pipeline verifies PubMed PMID 40465166 and scans AHS news for Health Link volume announcements.
                It does not re-derive Virtual MD cohort percentages, EMS diversion splits, or adjacent helpline volumes.
                Those manual study/proxy panels were removed so the dashboard never presents fabricated or one-time estimates as live data.
              </p>
              <p className="font-mono text-[11px] text-ink-3">
                Status: waiting for an AHS fiscal-year volume publication that the fetcher can map to HEALTH_LINK_VOLUMES.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <DataTimestamp
            compact
            variant="light"
            metadata={metadata ?? undefined}
            arrayKey="HEALTH_LINK_VOLUMES"
          />
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper text-ink-2">
                <tr>
                  <th className="p-3 font-medium">Fiscal year</th>
                  <th className="p-3 text-right font-medium">Clinical inbound</th>
                  <th className="p-3 text-right font-medium">Non-clinical inbound</th>
                  <th className="p-3 text-right font-medium">Clinical outbound</th>
                  <th className="p-3 text-right font-medium">PADIS</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((row) => (
                  <tr key={row.fiscalYear} className="border-t border-line">
                    <td className="p-3 font-mono font-semibold text-ink">{row.fiscalYear}</td>
                    <td className="p-3 text-right font-mono tabular-nums text-ok">
                      {row.clinicalReceived > 0 ? row.clinicalReceived.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-ink">
                      {row.nonClinicalReceived > 0 ? row.nonClinicalReceived.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-ink">
                      {row.clinicalOutbound > 0 ? row.clinicalOutbound.toLocaleString() : '—'}
                    </td>
                    <td className="p-3 text-right font-mono tabular-nums text-accent">
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
