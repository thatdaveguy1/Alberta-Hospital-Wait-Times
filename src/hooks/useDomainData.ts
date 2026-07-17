import { useState, useEffect, useCallback } from 'react';
import type { DataMetadataMap } from '../components/DataTimestamp';

export interface DomainData<T> {
  data: T | null;
  metadata: DataMetadataMap | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch domain JSON from `/api/data/:domain`.
 *
 * The optional second argument is accepted only for call-site compatibility with
 * legacy `*Data.ts` modules. It is intentionally ignored: empty or failed
 * upstream payloads must surface as empty/null, never silent seed fallbacks.
 */
export function useDomainData<T = unknown>(
  domain: string,
  _legacySeedIgnored?: Record<string, unknown>
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
        // Fail closed: never fill empty arrays or missing keys from hand-authored seeds.
        setMetadata(fetchedMetadata ?? null);
        setData(rest as T);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Failed fetch → empty surface, no seed substitution.
        setData(null);
        setMetadata(null);
        setError(err instanceof Error ? err.message : `Failed to load ${domain} data`);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [domain, refreshNonce]);

  return { data, metadata, isLoading, error, refresh };
}
