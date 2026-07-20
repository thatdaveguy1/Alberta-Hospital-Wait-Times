// DataTimestamp — universal component showing data freshness for any array.
// Auto: shows pipeline refresh time + source vintage.
// Manual: shows recorded update time with a Manual badge — never claims "scrape".
// Missing metadata: renders nothing (empty/honest surface).

import React from 'react';
import { RefreshCw, FileText } from 'lucide-react';
import { formatDataTimestamp } from '../lib/dataTimestampFormat';

export interface ArrayMetadata {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}

interface DataTimestampProps {
  /** The _dataMetadata object from the domain data file */
  metadata?: Record<string, ArrayMetadata>;
  /** Which array key to show the timestamp for */
  arrayKey: string;
  /** Optional compact mode — single line instead of two */
  compact?: boolean;
  /** Visual theme variant */
  variant?: 'dark' | 'light';
}

/** Maps internal pipeline IDs and raw source strings to human-readable names so "Scraper" never leaks to the UI. */
export function sanitizeSource(source: string): string {
  const map: Record<string, string> = {
    goodcaringScraper: 'GoodCaring.ca',
    ahsAsiScraper: 'AHS ASI',
    albertaFindAProviderScraper: 'Alberta Find a Provider',
    albertaRespiratoryVirusScraper: 'Alberta Respiratory Virus Dashboard',
    ahsCancerCentresScraper: 'AHS Cancer Centres',
    ahsWeeklyEdLosScraper: 'AHS Weekly ED LOS',
    acuteCareScraper: 'AHS Acute Care',
    abjhiScraper: 'ABJHI',
    aplLabWaitTimesFetcher: 'APL QMe Lab Waits',
    cihiDownloader: 'CIHI',
    cihiMhSafetyFetcher: 'CIHI Clinical Safety Indicators',
    cihiNationalCapacity: 'CIHI National Capacity',
    cihiWaitTimesDownloader: 'CIHI Wait Times',
    cihiWaitTimesPriorityFetcher: 'CIHI Priority Wait Times',
    cihiWorkforceFetcher: 'CIHI Workforce',
    continuingCareComplianceFetcher: 'Continuing Care Compliance',
    cpsaScraper: 'CPSA',
    disruptionsScraper: 'AHS Service Disruptions',
    erWaitTimesFetcher: 'AHS ER Wait Times',
    fraserDownloader: 'Fraser Institute',
    hqcaContinuingCareFetcher: 'HQCA Continuing Care',
    hqcaFocusScraper: 'HQCA FOCUS',
    openAlbertaBillingFetcher: 'Open Alberta Billing',
    openAlbertaInequityFetcher: 'Open Alberta Inequity',
    phacFetcher: 'PHAC',
    powerbiScraper: 'AHS Power BI',
    primaryCareFetcher: 'Primary Care',
    statscanFetcher: 'Statistics Canada',
    virtualCareFetcher: 'Virtual Care',
  };

  const normalized = source.trim();
  if (map[normalized]) return map[normalized];

  // Fallback: strip "Scraper" suffix/parentheticals and tidy up for any future pipeline IDs.
  return normalized
    .replace(/\s*\(\s*\bscraper\b\s*\)/gi, '')
    .replace(/\s*\bscraper\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}


export function DataTimestamp({ metadata, arrayKey, compact = false, variant = 'dark' }: DataTimestampProps): React.ReactElement | null {
  const entry = metadata?.[arrayKey];
  if (!entry) return null;

  const isAuto = entry.updateType === 'auto';
  const sanitizedSource = sanitizeSource(entry.source);
  const lastUpdated = entry.lastUpdated
    ? formatDataTimestamp(entry.lastUpdated)
    : 'Unavailable';
  const sourceVintage = entry.sourceVintage
    ? formatDataTimestamp(entry.sourceVintage)
    : '—';
  const updatedLabel = isAuto ? 'Last pipeline refresh' : 'Last recorded update';

  if (compact) {
    if (variant === 'light') {
      return (
        <div className="flex items-center gap-2 text-xs text-ink-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              isAuto ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
            }`}
          >
            {isAuto ? 'Auto-updated\u00A0' : 'Manual\u00A0'}
          </span>
          <span className="text-ink-3">
            {updatedLabel}: <span className="font-mono tabular-nums text-ink">{lastUpdated}</span>
          </span>
          {' · '}
          <span className="text-ink-3">
            Source period: <span className="font-mono tabular-nums text-ink">{sourceVintage}</span>
          </span>
          {' · '}
          <span className="text-ink-3">Source: <span className="font-mono tabular-nums text-ink">{sanitizedSource}</span></span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
            isAuto
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {isAuto ? 'Auto-updated\u00A0' : 'Manual\u00A0'}
        </span>
        <span className="font-medium">
          {updatedLabel}: <span className="font-mono text-slate-200 font-semibold">{lastUpdated}</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">
          Source period: <span className="text-slate-200 font-semibold">{sourceVintage}</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">Source: <span className="text-slate-200 font-semibold">{sanitizedSource}</span></span>
      </div>
    );
  }

  if (variant === 'light') {
    return (
      <div className="rounded-xl border border-line bg-surface px-3 py-2.5 flex items-center gap-3 mt-2 mb-4">
        <div
          className={`p-1.5 rounded-lg shrink-0 border border-line ${
            isAuto ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
          }`}
        >
          {isAuto ? <RefreshCw className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                isAuto ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
              }`}
            >
              {isAuto ? 'Auto-updated' : 'Manual update'}
            </span>
            <span className="text-xs font-semibold text-ink">
              {updatedLabel}: <span className="font-mono tabular-nums text-ink">{lastUpdated}</span>
            </span>
            <span className="text-xs text-ink-3 hidden sm:inline">·</span>
            <span className="text-xs text-ink-3">
              Source period: <span className="font-mono tabular-nums text-ink">{sourceVintage}</span>
            </span>
          </div>
          <div className="text-xs text-ink-3">
            Source: <span className="font-mono tabular-nums text-ink">{sanitizedSource}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 px-3 py-2.5 rounded-xl flex items-center gap-3 mt-2 mb-4 shadow-sm">
      <div
        className={`p-1.5 rounded-lg shrink-0 border ${
          isAuto
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}
      >
        {isAuto ? <RefreshCw className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${
              isAuto
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isAuto ? 'Auto-updated' : 'Manual update'}
          </span>
          <span className="text-xs font-bold text-slate-200">
            {updatedLabel}: <span className="font-mono text-white font-black">{lastUpdated}</span>
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">·</span>
          <span className="text-[11px] text-slate-400">
            Source period: <span className="font-extrabold text-slate-200">{sourceVintage}</span>
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          Source: <span className="font-semibold text-slate-200">{sanitizedSource}</span>
        </div>
      </div>
    </div>
  );
}

// Convenience type for dashboard data interfaces
export type DataMetadataMap = Record<string, ArrayMetadata>;
