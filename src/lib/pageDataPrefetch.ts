/**
 * In-memory prefetch/cache for care-seeking pages (ER + diagnostics).
 * Avoids blank skeleton flashes when switching modules after a warm visit.
 */

type CacheEntry = { payload: unknown; at: number };

const domainCache = new Map<string, CacheEntry>();
let hospitalsCache: CacheEntry | null = null;
const inflight = new Map<string, Promise<void>>();

export function getCachedDomainPayload<T = unknown>(domain: string): T | null {
  const hit = domainCache.get(domain);
  return hit ? (hit.payload as T) : null;
}

export function setCachedDomainPayload(domain: string, payload: unknown): void {
  domainCache.set(domain, { payload, at: Date.now() });
}

export function getCachedHospitals<T = unknown>(): T | null {
  return hospitalsCache ? (hospitalsCache.payload as T) : null;
}

export function setCachedHospitals(payload: unknown): void {
  hospitalsCache = { payload, at: Date.now() };
}

function prefetchOnce(key: string, run: () => Promise<void>): void {
  if (inflight.has(key)) return;
  const p = run()
    .catch(() => {
      /* best-effort */
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
}

export function prefetchDomain(domain: string): void {
  if (domainCache.has(domain)) return;
  prefetchOnce(`domain:${domain}`, async () => {
    const res = await fetch(`/api/data/${domain}`);
    if (!res.ok) return;
    setCachedDomainPayload(domain, await res.json());
  });
}

export function prefetchHospitals(): void {
  if (hospitalsCache) return;
  prefetchOnce('hospitals', async () => {
    const res = await fetch('/api/hospitals');
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setCachedHospitals(data);
  });
}

/** Warm ER + Labs before the user clicks through. */
export function prefetchCareSeekingPages(): void {
  prefetchHospitals();
  prefetchDomain('diagnostic');
}
