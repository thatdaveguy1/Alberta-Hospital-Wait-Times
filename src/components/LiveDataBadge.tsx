// LiveDataBadge — small inline indicator showing data freshness for a domain.
// Uses assessDataHealth / getDomainHealth so labels match option A health states.

import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useSyncStatus, formatRelativeTime } from '../hooks/useSyncStatus';
import { assessDataHealth, getDomainHealth, type DomainHealthState } from '../lib/dataHealth';

interface LiveDataBadgeProps {
  domain: string;
  /** Override label for the data source (e.g. "AHS API", "StatsCan") */
  sourceLabel?: string;
}

/** Map legacy / view ids onto sync-status domain keys. */
const DOMAIN_ALIASES: Record<string, string> = {
  'er-waits': 'er-waittimes',
  'urgent-care': 'er-waittimes',
  erWaitTimes: 'er-waittimes',
  'er-waittimes': 'er-waittimes',
};

function resolveDomain(domain: string): string {
  return DOMAIN_ALIASES[domain] ?? domain;
}

function statusPresentation(state: DomainHealthState | 'unreachable'): {
  label: string;
  tone: string;
  Icon: typeof CheckCircle;
} {
  switch (state) {
    case 'healthy':
      return {
        label: 'Active',
        tone: 'text-ok border-ok/20 bg-ok-soft',
        Icon: CheckCircle,
      };
    case 'partial':
      return {
        label: 'Partial',
        tone: 'text-warn border-warn/20 bg-warn-soft',
        Icon: AlertCircle,
      };
    case 'soft_stale':
      return {
        label: 'Stale',
        tone: 'text-warn border-warn/20 bg-warn-soft',
        Icon: AlertCircle,
      };
    default:
      return {
        label: 'Feed issue',
        tone: 'text-warn border-warn/30 bg-warn-soft',
        Icon: AlertCircle,
      };
  }
}

export function LiveDataBadge({ domain, sourceLabel }: LiveDataBadgeProps): React.ReactElement | null {
  const { syncStatus, loading } = useSyncStatus();

  if (loading && !syncStatus) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
        <Clock className="h-3 w-3" aria-hidden />
        Checking feed…
      </span>
    );
  }

  const health = assessDataHealth(syncStatus);
  const resolved = resolveDomain(domain);
  const domainHealth = getDomainHealth(health, resolved);
  const timestamp = domainHealth?.lastSuccessAt ?? null;
  const relative = formatRelativeTime(timestamp);
  const source = sourceLabel ?? 'AHS Feed';

  const state: DomainHealthState | 'unreachable' =
    !health.syncStatusAvailable || !domainHealth ? 'unreachable' : domainHealth.state;
  const { label, tone, Icon } = statusPresentation(state);
  const title = domainHealth?.message ?? (state === 'unreachable' ? 'Feed unavailable' : undefined);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone}`}
      title={title}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {state === 'healthy' ? `${source} ${label}` : label}
      {timestamp ? (
        <span className="font-mono normal-case tracking-normal opacity-80">· {relative}</span>
      ) : null}
    </span>
  );
}
