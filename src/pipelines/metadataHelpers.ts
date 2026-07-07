// Shared helpers for the `_dataMetadata` block written into the domain data
// JSON files (e.g. data-system-flow.json).
//
// Several pipeline writers (acuteCareScraper, ahsWeeklyEdLosScraper,
// cihiMhSafetyFetcher) each refresh a different subset of the arrays in
// data-system-flow.json via read-modify-write. Without coordination, one
// writer would clobber the `_dataMetadata` entries written by the others.
//
// The shape mirrors `ArrayMetadata` in src/components/DataTimestamp.tsx so the
// frontend can consume it directly:
//   { source, sourceVintage, lastUpdated, updateType, verification? }

export type DataMetadataUpdateType = 'auto' | 'manual';

export interface DataMetadataEntry {
  source: string;
  sourceVintage: string;
  lastUpdated: string; // ISO 8601 timestamp
  updateType: DataMetadataUpdateType;
  verification?: string;
}

export type DataMetadata = Record<string, DataMetadataEntry>;

/**
 * Build a single `_dataMetadata` entry with a fresh `lastUpdated` timestamp.
 *
 * Pass an explicit `lastUpdated` only when reusing an already-computed
 * pipeline timestamp; otherwise the current time is used.
 */
export function buildMetadataEntry(opts: {
  updateType: DataMetadataUpdateType;
  source: string;
  sourceVintage: string;
  verification?: string;
  lastUpdated?: string;
}): DataMetadataEntry {
  return {
    updateType: opts.updateType,
    lastUpdated: opts.lastUpdated ?? new Date().toISOString(),
    source: opts.source,
    sourceVintage: opts.sourceVintage,
    verification: opts.verification,
  };
}

/**
 * Merge this writer's owned metadata entries into the existing `_dataMetadata`
 * object, preserving entries owned by other writers.
 *
 * Keys present in `owned` overwrite the same keys in `existing` (this writer is
 * refreshing them now); every other key is passed through untouched so sibling
 * writers' metadata survives the read-modify-write cycle.
 */
export function mergeDataMetadata(
  existing: DataMetadata | undefined,
  owned: DataMetadata,
): DataMetadata {
  return { ...(existing ?? {}), ...owned };
}
