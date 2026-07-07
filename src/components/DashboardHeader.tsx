// DashboardHeader — standardized header for every main dashboard tab.
// Matches the style used on the ER Wait Times tab: icon + title + description
// plus an inline metadata row with auto/manual badge, last update, and data timestamp.

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { RefreshCw, FileText } from 'lucide-react';
import type { DataMetadataMap } from './DataTimestamp';

interface DashboardHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  metadata: DataMetadataMap | undefined;
  arrayKey: string;
  children?: React.ReactNode;
}

const EDMONTON_TIMEZONE = 'America/Edmonton';

function formatTimestamp(ts: string): string {
  if (!ts || ts === 'Unknown') return 'Unknown';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
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
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays === 1) return '1d';
    if (diffDays < 30) return `${diffDays}d`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
  } catch {
    return '';
  }
}

export function DashboardHeader({
  icon: Icon,
  title,
  description,
  metadata,
  arrayKey,
  children,
}: DashboardHeaderProps): React.ReactElement {
  const entry = metadata?.[arrayKey];
  const isAuto = entry?.updateType === 'auto';
  const lastUpdated = entry?.lastUpdated ? formatTimestamp(entry.lastUpdated) : 'Unknown';
  const relative = entry?.lastUpdated ? formatRelative(entry.lastUpdated) : '';
  const sourceVintage = entry?.sourceVintage || '—';

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
      <div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Icon className="w-5 h-5 text-blue-400" />
          <span>{title}</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
        <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 relative">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse absolute left-0.5 top-0.5" />
          </span>
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
              isAuto
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isAuto ? 'Auto-updated' : 'Manual update'}
            {relative && ` (${relative})`}
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Last Update: <span className="font-mono text-white font-black">{lastUpdated}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            Data Timestamp: <span className="font-extrabold text-slate-200">{sourceVintage}</span>
          </span>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
