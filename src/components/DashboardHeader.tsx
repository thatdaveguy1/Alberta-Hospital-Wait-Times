// DashboardHeader — standardized header for every main dashboard tab.
// Matches the style used on the ER Wait Times tab: icon + title + description
// plus an inline metadata row with auto/manual badge, last update, and data timestamp.
// Renders only the per-array metadata entry for `arrayKey` — never invents a
// tab-wide auto claim when the entry is missing or manual.

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { sanitizeSource, type DataMetadataMap } from './DataTimestamp';
import { formatDataTimestamp } from '../lib/dataTimestampFormat';

interface DashboardHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  metadata: DataMetadataMap | undefined;
  arrayKey: string;
  /** 'dark' preserves the legacy look for not-yet-redesigned dashboards. */
  variant?: 'dark' | 'light';
  children?: React.ReactNode;
}


export function DashboardHeader({
  icon: Icon,
  title,
  description,
  metadata,
  arrayKey,
  variant = 'dark',
  children,
}: DashboardHeaderProps): React.ReactElement {
  const light = variant === 'light';
  const entry = metadata?.[arrayKey];
  const hasEntry = Boolean(entry);
  const isAuto = entry?.updateType === 'auto';
  const lastUpdated = entry?.lastUpdated ? formatDataTimestamp(entry.lastUpdated) : 'Unavailable';
  const sourceVintage = entry?.sourceVintage ? formatDataTimestamp(entry.sourceVintage) : '—';
  const source = entry?.source ? sanitizeSource(entry.source) : '—';
  const statusLabel = !hasEntry
    ? 'No verified feed'
    : isAuto
      ? 'Auto-updated'
      : 'Manual';
  const updatedLabel = isAuto ? 'Last pipeline refresh' : 'Last recorded update';

  if (!light) {
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Icon className="w-5 h-5 text-blue-400" />
            <span>{title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 flex-wrap">
            {isAuto ? (
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-slate-600 border border-slate-700 flex items-center justify-center shrink-0" />
            )}
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                isAuto
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-800/60 text-slate-400 border-slate-750'
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-slate-600">·</span>
            <span>
              {updatedLabel}: <span className="font-mono text-white font-black">{lastUpdated}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span>
              Source period: <span className="font-extrabold text-slate-200">{sourceVintage}</span>
            </span>
            <span className="text-slate-600">·</span>
            <span>
              Source: <span className="font-extrabold text-slate-200">{source}</span>
            </span>
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    );
  }

  // Light variant — Clinical Ledger chrome for redesigned surfaces.
  return (
    <div className="flex flex-col justify-between gap-3 pb-3 md:flex-row md:items-center">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Icon className="h-5 w-5 text-accent" />
          <span>{title}</span>
        </h2>
        <p className="mt-0.5 text-sm text-ink-2">{description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              isAuto ? 'bg-ok-soft text-ok' : 'bg-neutral-chip text-ink-3'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            {statusLabel}
          </span>
          <span>
            {updatedLabel}: <span className="font-mono tabular-nums text-ink">{lastUpdated}</span>
            {' · '}Source period: <span className="text-ink">{sourceVintage}</span>
            {' · '}Source: <span className="text-ink">{source}</span>
          </span>
        </div>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
