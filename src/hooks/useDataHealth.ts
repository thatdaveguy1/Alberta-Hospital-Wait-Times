// useDataHealth — wraps useSyncStatus with pipeline health assessment for banners/tabs.

import { useCallback, useMemo } from 'react';
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
 */
export function useDataHealth(): UseDataHealthReturn {
  const { syncStatus, loading, error, isStale, refresh } = useSyncStatus();

  const health = useMemo(
    () => assessDataHealth(error ? null : syncStatus),
    [error, syncStatus],
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
