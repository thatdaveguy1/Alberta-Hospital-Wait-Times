// useDataHealth — wraps useSyncStatus with pipeline health assessment for banners/tabs.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  assessDataHealth,
  getDomainHealth,
  type DataHealthSummary,
  type DomainHealth,
} from '../lib/dataHealth';
import { useSyncStatus } from './useSyncStatus';

export interface UseDataHealthReturn {
  syncStatus: ReturnType<typeof useSyncStatus>['syncStatus'];
  loading: boolean;
  error: string | null;
  isStale: boolean;
  refresh: () => void;
  health: DataHealthSummary;
  domainHealth: (domainOrView: string) => DomainHealth | null;
  bannerMessage: string | null;
}

/**
 * Sync status plus assessed feed health.
 * Poll failure (`error` set) is treated as unreachable even if a prior status
 * is still cached, so the global banner can surface connectivity loss.
 *
 * A 60-second wall-clock tick is passed to `assessDataHealth` so the same
 * cached `syncStatus` object is re-evaluated as time advances. `useSyncStatus`
 * still deduplicates identical API payloads, but elapsed minutes now
 * independently trigger soft/critical stale transitions.
 */
export function useDataHealth(): UseDataHealthReturn {
  const { syncStatus, loading, error, isStale, refresh } = useSyncStatus();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const health = useMemo(
    () => assessDataHealth(error ? null : syncStatus, nowMs),
    [error, syncStatus, nowMs],
  );

  const domainHealth = useCallback(
    (domainOrView: string): DomainHealth | null => getDomainHealth(health, domainOrView),
    [health],
  );

  return {
    syncStatus,
    loading,
    error,
    isStale,
    refresh,
    health,
    domainHealth,
    bannerMessage: health.bannerMessage,
  };
}
