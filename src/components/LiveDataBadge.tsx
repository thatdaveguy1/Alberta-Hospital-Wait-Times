// LiveDataBadge — small inline indicator showing data freshness for a domain.
// Placed in dashboard headers to show last-updated time and pipeline status.

import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useSyncStatus, formatRelativeTime, getDomainResult } from '../hooks/useSyncStatus';

interface LiveDataBadgeProps {
  domain: string;
  /** Override label for the data source (e.g. "AHS API", "StatsCan") */
  sourceLabel?: string;
}

export function LiveDataBadge({ domain, sourceLabel }: LiveDataBadgeProps): React.ReactElement | null {
  const { syncStatus, loading, error } = useSyncStatus();
  const domainResult = getDomainResult(syncStatus, domain);

  if (loading && !syncStatus) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" />
        Checking feed…
      </span>
    );
  }

  const failed =
    Boolean(error) ||
    domainResult?.status === 'failed' ||
    syncStatus?.status === 'failed';
  const partial =
    domainResult?.status === 'partial' ||
    syncStatus?.status === 'partial_success';
  const neverRun = !domainResult && (syncStatus?.status === 'never_run' || !syncStatus);

  const timestamp =
    domainResult?.timestamp ??
    (domain === 'er-waits' || domain === 'urgent-care' || domain === 'erWaitTimes'
      ? syncStatus?.erWaitTimesLastUpdate
      : syncStatus?.lastSyncTimestamp) ??
    null;

  const relative = formatRelativeTime(timestamp);
  const label = sourceLabel ?? 'AHS Feed';

  if (failed || neverRun) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full"
        title={error ?? domainResult?.error ?? 'Feed unavailable'}
      >
        <AlertCircle className="w-3 h-3" />
        Stale Feed
        {timestamp ? <span className="font-mono normal-case tracking-normal text-amber-300/80">· {relative}</span> : null}
      </span>
    );
  }

  if (partial) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        Partial · {label}
        {timestamp ? <span className="font-mono normal-case tracking-normal text-slate-400">· {relative}</span> : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />
      {label} Active
      {timestamp ? <span className="font-mono normal-case tracking-normal text-emerald-300/80">· {relative}</span> : null}
    </span>
  );
}
