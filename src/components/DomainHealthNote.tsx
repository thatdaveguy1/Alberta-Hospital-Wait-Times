// DomainHealthNote — quiet per-tab note for soft_stale / partial domain health.
// Hidden when the domain is critical (global DataHealthBanner covers that case).

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDataHealth } from '../hooks/useDataHealth';

interface DomainHealthNoteProps {
  viewId: string;
}

export function DomainHealthNote({ viewId }: DomainHealthNoteProps): React.ReactElement | null {
  const { loading, syncStatus, domainHealth } = useDataHealth();

  if (loading && !syncStatus) return null;

  const domain = domainHealth(viewId);
  if (!domain) return null;
  if (domain.critical) return null;
  if (domain.state !== 'soft_stale' && domain.state !== 'partial') return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-warn-soft px-3 py-2 text-xs text-ink-2"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden />
      <span>{domain.message}</span>
    </div>
  );
}
