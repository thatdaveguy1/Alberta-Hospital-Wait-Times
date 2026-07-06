// DataTimestamp — universal component showing data freshness for any array.
// Shows BOTH our update time AND source data vintage for auto-updated data.
// Shows only source data timestamp with "Manually updated" tag for static data.

import React from 'react';
import { RefreshCw, FileText } from 'lucide-react';

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
}

const EDMONTON_TIMEZONE = 'America/Edmonton';

/** Maps internal pipeline IDs and raw source strings to human-readable names so "Scraper" never leaks to the UI. */
function sanitizeSource(source: string): string {
  const map: Record<string, string> = {
    goodcaringScraper: 'GoodCaring.ca',
    ahsAsiScraper: 'AHS ASI',
    albertaSubstanceUseScraper: 'Alberta Substance Use Surveillance',
    alberta211Scraper: 'Alberta 211',
    albertaFindAProviderScraper: 'Alberta Find a Provider',
    albertaRespiratoryVirusScraper: 'Alberta Respiratory Virus Dashboard',
    ahsCancerCentresScraper: 'AHS Cancer Centre Directory',
    ahsWeeklyEdLosScraper: 'AHS Weekly ED LOS Reports',
    cpsaScraper: 'CPSA',
    disruptionsScraper: 'AHS Service Disruptions',
    powerbiScraper: 'Alberta Wait Times Reporting',
    'Alberta Wait Times Reporting (Power BI scraper)': 'Alberta Wait Times Reporting',
    waittimesAlbertaScraper: 'Alberta Wait Times',
    abjhiScraper: 'ABJHI',
    acuteCareScraper: 'AHS Acute Care Capacity',
    hqcaContinuingCareScraper: 'HQCA Continuing Care',
    hqcaFocusScraper: 'HQCA FOCUS',
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

function formatTimestamp(ts: string): string {
  if (!ts || ts === 'Unknown') return 'Unknown';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts; // Not a date — show as-is (e.g. "2024-2025 fiscal year")
    return d.toLocaleString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: EDMONTON_TIMEZONE,
      timeZoneName: 'short',
    });
  } catch {
    return ts;
  }
}

function formatRelative(ts: string): string {
  if (!ts || ts === 'Unknown') return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);
    if (diffHrs < 1) return 'just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

export function DataTimestamp({ metadata, arrayKey, compact = false }: DataTimestampProps): React.ReactElement | null {
  const entry = metadata?.[arrayKey];
  if (!entry) return null;

  const isAuto = entry.updateType === 'auto';
  const sanitizedSource = sanitizeSource(entry.source);
  const lastUpdated = formatTimestamp(entry.lastUpdated);
  const relative = formatRelative(entry.lastUpdated);

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-slate-400">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
            isAuto
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {isAuto ? <RefreshCw className="w-2.5 h-2.5" /> : <FileText className="w-2.5 h-2.5" />}
          {isAuto ? 'Auto' : 'Manual'}
        </span>
        <span className="font-medium">
          Updated: <span className="font-mono text-slate-200 font-semibold">{lastUpdated}</span>
          {relative && <span className="text-slate-500 ml-1">({relative})</span>}
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">Source: <span className="text-slate-200 font-semibold">{sanitizedSource}</span></span>
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
            Last Update: <span className="font-mono text-white font-black">{lastUpdated}</span>
            {relative && <span className="text-slate-500 ml-1 font-normal">({relative})</span>}
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">·</span>
          <span className="text-[11px] text-slate-400">
            Data Timestamp: <span className="font-extrabold text-slate-200">{entry.sourceVintage}</span>
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
