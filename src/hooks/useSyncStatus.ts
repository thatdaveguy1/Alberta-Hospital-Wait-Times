// useSyncStatus — React hook that fetches pipeline sync status from /api/sync/status.
// Provides last-updated, next-update, and pipeline health info to dashboards.

import { useState, useEffect } from 'react';

interface PipelineResult {
  domain: string;
  pipeline: string;
  status: 'success' | 'failed' | 'partial' | 'skipped';
  recordsFetched: number;
  recordsWritten: number;
  durationMs: number;
  error?: string;
  timestamp: string;
}

interface SyncStatus {
  status: 'never_run' | 'running' | 'success' | 'partial_success' | 'failed';
  lastSyncTimestamp: string | null;
  nextSyncTimestamp: string | null;
  results: PipelineResult[];
  erWaitTimesLastUpdate: string | null;
  erWaitTimesNextUpdate: string | null;
}

interface UseSyncStatusReturn {
  syncStatus: SyncStatus | null;
  loading: boolean;
  error: string | null;
  /** True when the latest status poll failed (network/HTTP error). */
  isStale: boolean;
  refresh: () => void;
}

// Fetch sync status from the API. Returns null status if the endpoint is unavailable.
export function useSyncStatus(): UseSyncStatusReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function fetchStatus() {
      try {
        const response = await fetch('/api/sync/status');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as SyncStatus;
        if (!active) return;
        setSyncStatus((prev) => {
          // Skip re-renders when nothing meaningful changed.
          if (
            prev &&
            prev.erWaitTimesLastUpdate === data.erWaitTimesLastUpdate &&
            prev.erWaitTimesNextUpdate === data.erWaitTimesNextUpdate &&
            prev.lastSyncTimestamp === data.lastSyncTimestamp &&
            prev.status === data.status
          ) {
            return prev;
          }
          return data;
        });
        setError(null);
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchStatus();

    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  const refresh = () => {
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  return { syncStatus, loading, error, isStale: error !== null, refresh };
}

// Format an ISO timestamp as a human-readable relative time string.
export function formatRelativeTime(isoTimestamp: string | null): string {
  if (!isoTimestamp) return 'Never';
  const date = new Date(isoTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// Get the sync result for a specific domain.
export function getDomainResult(
  syncStatus: SyncStatus | null,
  domain: string
): PipelineResult | null {
  if (!syncStatus || !syncStatus.results) return null;
  return syncStatus.results.find(r => r.domain === domain) ?? null;
}
