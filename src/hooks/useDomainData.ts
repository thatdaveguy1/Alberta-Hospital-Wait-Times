import { useState, useEffect, useCallback } from 'react';
import type { DataMetadataMap } from '../components/DataTimestamp';
import { getCachedDomainPayload, setCachedDomainPayload } from '../lib/pageDataPrefetch';

export interface DomainData<T> {
  data: T | null;
  metadata: DataMetadataMap | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

function splitPayload<T>(payload: { _dataMetadata?: DataMetadataMap } & T): {
  data: T;
  metadata: DataMetadataMap | null;
} {
  const { _dataMetadata: fetchedMetadata, ...rest } = payload;
  return {
    data: rest as T,
    metadata: fetchedMetadata ?? null,
  };
}

/**
 * Fetch domain JSON from `/api/data/:domain`.
 *
 * The optional second argument is accepted only for call-site compatibility with
 * legacy `*Data.ts` modules. It is intentionally ignored: empty or failed
 * upstream payloads must surface as empty/null, never silent seed fallbacks.
 *
 * Warm cache hits paint immediately; a background refresh updates quietly.
 */
export function useDomainData<T = unknown>(
  domain: string,
  _legacySeedIgnored?: Record<string, unknown>
): DomainData<T> {
  const cached = getCachedDomainPayload<{ _dataMetadata?: DataMetadataMap } & T>(domain);
  const initial = cached ? splitPayload(cached) : null;

  const [data, setData] = useState<T | null>(initial?.data ?? null);
  const [metadata, setMetadata] = useState<DataMetadataMap | null>(initial?.metadata ?? null);
  const [isLoading, setIsLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const refresh = useCallback(() => setRefreshNonce(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const warm = getCachedDomainPayload(domain) != null;
    if (!warm) setIsLoading(true);
    setError(null);

    fetch(`/api/data/${domain}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((payload: { _dataMetadata?: DataMetadataMap } & T) => {
        if (cancelled) return;
        setCachedDomainPayload(domain, payload);
        const next = splitPayload(payload);
        // Fail closed: never fill empty arrays or missing keys from hand-authored seeds.
        setMetadata(next.metadata);
        setData(next.data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Failed fetch → empty surface only when we have nothing cached to show.
        if (!getCachedDomainPayload(domain)) {
          setData(null);
          setMetadata(null);
          setError(err instanceof Error ? err.message : `Failed to load ${domain} data`);
        }
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [domain, refreshNonce]);

  return { data, metadata, isLoading, error, refresh };
}
