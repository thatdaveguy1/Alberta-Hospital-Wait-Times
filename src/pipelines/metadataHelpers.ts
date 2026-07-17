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
//
// Freshness rule: `lastUpdated` may change only when the corresponding array
// content actually changes. Verify-only / preserve paths must reuse the prior
// timestamp so a no-op check never looks like a fresh scrape.

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
 * Build a single `_dataMetadata` entry.
 *
 * Content-refresh path (default): mints a fresh `lastUpdated` unless an
 * explicit `lastUpdated` is passed.
 *
 * Verify-only / preserve path: pass `contentChanged: false` and the prior
 * entry via `previous` so `lastUpdated` is retained. Never invents freshness
 * for a no-op check.
 */
export function buildMetadataEntry(opts: {
  updateType: DataMetadataUpdateType;
  source: string;
  sourceVintage: string;
  verification?: string;
  lastUpdated?: string;
  /** Prior entry for this array key (used when content is unchanged). */
  previous?: DataMetadataEntry;
  /**
   * When false, keep `previous.lastUpdated` (or explicit `lastUpdated`)
   * instead of minting a new timestamp. Defaults to true.
   */
  contentChanged?: boolean;
}): DataMetadataEntry {
  const contentChanged = opts.contentChanged !== false;

  let lastUpdated: string;
  if (contentChanged) {
    lastUpdated = opts.lastUpdated ?? new Date().toISOString();
  } else {
    // Preserve prior freshness. Prefer previous.lastUpdated, then explicit
    // lastUpdated; never mint Date.now() on a no-op/verify-only path.
    lastUpdated = opts.previous?.lastUpdated ?? opts.lastUpdated ?? '';
  }

  return {
    updateType: opts.updateType,
    lastUpdated,
    source: opts.source,
    sourceVintage: opts.sourceVintage,
    verification: opts.verification,
  };
}

/**
 * Return an existing metadata entry unchanged (verify-only / preserve path).
 * Does not bump `lastUpdated`. Prefer this over `buildMetadataEntry` when the
 * array content was not rewritten.
 */
export function preserveMetadataEntry(existing: DataMetadataEntry): DataMetadataEntry {
  return {
    updateType: existing.updateType,
    lastUpdated: existing.lastUpdated,
    source: existing.source,
    sourceVintage: existing.sourceVintage,
    verification: existing.verification,
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

/**
 * Domain-JSON keys that must stay empty/unavailable after payload scrub.
 * RMW writers MUST force these empty (or `{}` for object maps) and MUST NOT
 * re-stamp `_dataMetadata` as a verified feed for them.
 *
 * Real upstream-owned arrays (CIHI/AHS/OpenAlberta live feeds) are intentionally
 * absent from this list.
 */
export const WITHHELD_PAYLOAD_KEYS = [
  // cancer
  'CANCER_BURDEN_STATS',
  'CANCER_SCREENING_RATES',
  // continuing care
  'HOME_CARE_EXPERIENCE',
  // diagnostic estimated panels
  'TEST_TURNAROUND_METRICS',
  'FACILITY_IMAGING_WAITS',
  'PRIORITY_TARGET_COMPLIANCE',
  // mental health burden
  'COMMUNITY_MH_WAITS',
  'HOSPITAL_MHSU_BURDEN',
  // patient experience hand residuals
  'INPATIENT_EXPERIENCE_TRENDS',
  'ED_EXPERIENCE_TRENDS',
  'CLINICAL_SAFETY_TRENDS',
  'PATIENT_COMPLAINTS',
  // primary care hand residuals
  'PCN_CAPACITY',
  'ED_RELIANCE_BY_CONTINUITY',
  'CONTINUITY_SATISFACTION',
  // public health hand residuals
  'RESPIRATORY_VIRUS_SURVEILLANCE',
  'CHILDHOOD_IMMUNIZATION_COVERAGE',
  'NOTIFIABLE_DISEASE_INCIDENCE',
  'ENVIRONMENTAL_ADVISORIES',
  'OUTBREAK_PROTOCOLS',
  // spending
  'HOSPITAL_EFFICIENCY_TREND',
  // surgical estimated facility panels + unverified StatsCan survey
  'SURGICAL_FACILITIES',
  'FACILITY_COMPARISONS',
  'STATSCAN_SATISFACTION_STATS',
  'STATSCAN_DEMOGRAPHICS',
  // system-flow historical estimates (facility identity is rewritten by acuteCare)
  'HISTORICAL_FLOW_TIMELINES',
  // virtual care study/proxy panels (HEALTH_LINK_VOLUMES is a real upstream)
  'VIRTUAL_MD_DISPOSITIONS',
  'EMS_811_DIVERSION_DATA',
  'ADJACENT_HELPLINES',
  // workforce illustrative / hand-authored trend arrays
  // (CIHI-suffixed siblings like NURSING_SUPPLY_TRENDS_CIHI stay intact)
  'NURSING_SUPPLY_TRENDS',
  'WORKFORCE_AGE_PROFILE',
  'SPECIALIST_RECRUITMENT_NEEDS',
  'ALLIED_HEALTH_SUPPLY',
] as const;

export type WithheldPayloadKey = (typeof WITHHELD_PAYLOAD_KEYS)[number];

const WITHHELD_KEY_SET: ReadonlySet<string> = new Set(WITHHELD_PAYLOAD_KEYS);

/** Object-map withheld keys (empty as `{}`, not `[]`). */
const WITHHELD_OBJECT_KEYS: Record<string, true> = {
  OUTBREAK_PROTOCOLS: true,
  STATSCAN_SATISFACTION_STATS: true,
};

/**
 * Force withheld payload keys empty and strip their `_dataMetadata` entries so
 * a read-modify-write cannot reintroduce scrubbed rows or claim a verified feed.
 *
 * Mutates and returns `payload` for call-site convenience. Real upstream arrays
 * not in {@link WITHHELD_PAYLOAD_KEYS} are left untouched.
 */
export function applyWithheldPayloadGuard<T extends Record<string, unknown>>(
  payload: T,
): T {
  for (const key of WITHHELD_PAYLOAD_KEYS) {
    if (WITHHELD_OBJECT_KEYS[key]) {
      (payload as Record<string, unknown>)[key] = {};
    } else {
      (payload as Record<string, unknown>)[key] = [];
    }
  }

  const meta = payload._dataMetadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    const next: DataMetadata = { ...(meta as DataMetadata) };
    for (const key of WITHHELD_PAYLOAD_KEYS) {
      delete next[key];
    }
    // Also drop any owned-stamp attempts that slipped into the merge object.
    (payload as Record<string, unknown>)._dataMetadata = next;
  }

  return payload;
}

/**
 * Drop withheld keys from a metadata map before merge/write so writers cannot
 * re-stamp scrubbed arrays as auto/manual verified feeds.
 */
export function omitWithheldMetadata(meta: DataMetadata | undefined): DataMetadata {
  if (!meta) return {};
  const next: DataMetadata = { ...meta };
  for (const key of WITHHELD_PAYLOAD_KEYS) {
    delete next[key];
  }
  return next;
}

export function isWithheldPayloadKey(key: string): boolean {
  return WITHHELD_KEY_SET.has(key);
}
