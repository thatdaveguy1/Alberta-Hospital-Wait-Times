// DataHealthBanner — global hard-failure / critically-stale feed banner.
// Option A: reserved for assessDataHealth.bannerMessage only (not soft staleness).

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useDataHealth } from '../hooks/useDataHealth';

export function DataHealthBanner(): React.ReactElement | null {
  const { loading, syncStatus, bannerMessage } = useDataHealth();

  // Avoid flashing the unreachable banner while the first poll is in flight.
  if (loading && !syncStatus) return null;
  if (!bannerMessage) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <div
        role="status"
        className="flex items-center gap-2 rounded-xl border border-line bg-warn-soft p-3 text-sm text-ink-2"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-warn" aria-hidden />
        <span>{bannerMessage}</span>
      </div>
    </div>
  );
}
