import { useState, useEffect, useCallback } from 'react';
import type { DataMetadataMap } from '../components/DataTimestamp';

export interface DomainData<T> {
  data: T | null;
  metadata: DataMetadataMap | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDomainData<T = unknown>(
  domain: string,
  fallback?: Record<string, unknown>
): DomainData<T> {
  const [data, setData] = useState<T | null>(null);
  const [metadata, setMetadata] = useState<DataMetadataMap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => setRefreshNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/data/${domain}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: { _dataMetadata?: DataMetadataMap } & T) => {
        if (cancelled) return;
        const { _dataMetadata: fetchedMetadata, ...rest } = payload;
        const merged = { ...rest } as Record<string, unknown>;

        if (fallback) {
          for (const key of Object.keys(fallback)) {
            if (key === '_dataMetadata') continue;
            const existing = merged[key];
            if (existing === undefined || (Array.isArray(existing) && existing.length === 0)) {
              merged[key] = fallback[key];
            }
          }

          const fallbackMeta = fallback._dataMetadata as DataMetadataMap | undefined;
          if (fallbackMeta) {
            const mergedMeta: DataMetadataMap = { ...(fetchedMetadata ?? {}) };
            for (const key of Object.keys(fallbackMeta)) {
              if (!mergedMeta[key]) {
                mergedMeta[key] = fallbackMeta[key];
              }
            }
            setMetadata(mergedMeta);
          } else {
            setMetadata(fetchedMetadata ?? null);
          }
        } else {
          setMetadata(fetchedMetadata ?? null);
        }

        setData(merged as T);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : `Failed to load ${domain} data`);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [domain, fallback, refreshNonce]);

  return { data, metadata, isLoading, error, refresh };
}
