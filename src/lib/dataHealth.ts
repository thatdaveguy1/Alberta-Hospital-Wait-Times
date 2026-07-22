// Shared data-feed health assessment for API + UI.
// Pure helpers only — no Node/DOM APIs. Option A: global banner is reserved for
// hard failures / critically stale feeds; soft staleness stays per-tab.

export type HealthLevel = 'ok' | 'degraded' | 'down';
export type DomainHealthState = 'healthy' | 'soft_stale' | 'critical_stale' | 'failed' | 'partial' | 'never_run' | 'skipped';

export interface SyncResultLike {
  domain: string;
  pipeline: string;
  status: 'success' | 'failed' | 'partial' | 'skipped' | 'manual' | string;
  recordsFetched?: number;
  recordsWritten?: number;
  durationMs?: number;
  error?: string;
  timestamp: string;
}

export interface SyncStatusLike {
  status: 'never_run' | 'running' | 'success' | 'partial_success' | 'failed' | 'manual' | string;
  lastSyncTimestamp: string | null;
  nextSyncTimestamp?: string | null;
  results: SyncResultLike[];
  erWaitTimesLastUpdate?: string | null;
  erWaitTimesNextUpdate?: string | null;
  labWaitsLastUpdate?: string | null;
  labWaitsNextUpdate?: string | null;
}

export interface DomainHealth {
  domain: string;
  label: string;
  state: DomainHealthState;
  /** True → eligible for the global site banner (option A). */
  critical: boolean;
  /** Timestamp of the last success, or the last event used to compute age. */
  lastSuccessAt: string | null;
  ageMinutes: number | null;
  softTtlMinutes: number;
  criticalTtlMinutes: number;
  message: string;
}

export interface DataHealthSummary {
  overall: HealthLevel;
  syncStatusAvailable: boolean;
  lastSyncTimestamp: string | null;
  domains: DomainHealth[];
  criticalIssues: DomainHealth[];
  softIssues: DomainHealth[];
  /** Non-null only for hard failures / critically stale feeds. */
  bannerMessage: string | null;
  checks: string[];
}

/** UI view id → sync-status domain key. */
export const VIEW_TO_SYNC_DOMAIN: Record<string, string> = {
  'er-waits': 'er-waittimes',
  'urgent-care': 'er-waittimes',
  'erWaitTimes': 'er-waittimes',
  disruptions: 'disruptions',
  'surgical-waits': 'surgical',
  diagnostics: 'diagnostic',
  'primary-care': 'primary-care',
  'public-health': 'public-health',
  'regional-inequity': 'regional-inequity',
  'health-spending': 'spending',
};

const DOMAIN_LABELS: Record<string, string> = {
  'er-waittimes': 'ER / Urgent Care',
  diagnostic: 'Labs / Diagnostics',
  disruptions: 'Service Disruptions',
  surgical: 'Surgical Waitlists',
  'primary-care': 'Primary Care',
  'public-health': 'Public Health',
  'regional-inequity': 'Regional Inequity',
  spending: 'Health Spending',
};

interface DomainPolicy {
  softTtlMinutes: number;
  criticalTtlMinutes: number;
  /** Prefer these timestamps over the latest pipeline result. */
  timestampKeys?: Array<keyof SyncStatusLike>;
}

const DOMAIN_POLICIES: Record<string, DomainPolicy> = {
  'er-waittimes': {
    softTtlMinutes: 20,
    criticalTtlMinutes: 45,
    timestampKeys: ['erWaitTimesLastUpdate'],
  },
  diagnostic: {
    softTtlMinutes: 30,
    criticalTtlMinutes: 60,
    timestampKeys: ['labWaitsLastUpdate'],
  },
  disruptions: { softTtlMinutes: 30 * 60, criticalTtlMinutes: 48 * 60 },
  surgical: { softTtlMinutes: 45 * 24 * 60, criticalTtlMinutes: 90 * 24 * 60 },
  'primary-care': { softTtlMinutes: 45 * 24 * 60, criticalTtlMinutes: 90 * 24 * 60 },
  'public-health': { softTtlMinutes: 14 * 24 * 60, criticalTtlMinutes: 30 * 24 * 60 },
  'regional-inequity': { softTtlMinutes: 45 * 24 * 60, criticalTtlMinutes: 90 * 24 * 60 },
  spending: { softTtlMinutes: 45 * 24 * 60, criticalTtlMinutes: 90 * 24 * 60 },
};

const MONITORED_DOMAINS = Object.keys(DOMAIN_POLICIES);

function parseTimestampMs(iso: string): number {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function ageMinutesFrom(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const ms = parseTimestampMs(iso);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round((nowMs - ms) / 60_000));
}

function latestResultForDomain(status: SyncStatusLike, domain: string): SyncResultLike | null {
  const matches = status.results.filter((r) => r.domain === domain);
  if (matches.length === 0) return null;
  return matches.reduce((best, cur) => {
    const bestMs = parseTimestampMs(best.timestamp);
    const curMs = parseTimestampMs(cur.timestamp);
    if (Number.isNaN(curMs)) return best;
    if (Number.isNaN(bestMs) || curMs > bestMs) return cur;
    return best;
  });
}

function latestNonFailedResultForDomain(
  status: SyncStatusLike,
  domain: string,
): SyncResultLike | null {
  const matches = status.results.filter((r) => r.domain === domain && r.status !== 'failed');
  if (matches.length === 0) return null;
  return matches.reduce((best, cur) => {
    const bestMs = parseTimestampMs(best.timestamp);
    const curMs = parseTimestampMs(cur.timestamp);
    if (Number.isNaN(curMs)) return best;
    if (Number.isNaN(bestMs) || curMs > bestMs) return cur;
    return best;
  });
}

function hasMoreRecentFailure(
  status: SyncStatusLike,
  domain: string,
  referenceTimestamp: string | null,
): boolean {
  const refMs = referenceTimestamp ? parseTimestampMs(referenceTimestamp) : NaN;
  if (Number.isNaN(refMs)) return true;
  return status.results.some((r) => {
    if (r.domain !== domain || r.status !== 'failed') return false;
    const rMs = parseTimestampMs(r.timestamp);
    return Number.isFinite(rMs) && rMs > refMs;
  });
}

function formatAge(ageMinutes: number): string {
  if (ageMinutes < 60) return `${ageMinutes}m old`;
  const hours = Math.round(ageMinutes / 60);
  if (hours < 48) return `${hours}h old`;
  const days = Math.round(hours / 24);
  return `${days}d old`;
}

function assessDomain(status: SyncStatusLike, domain: string, nowMs: number): DomainHealth {
  const policy = DOMAIN_POLICIES[domain];
  const label = DOMAIN_LABELS[domain] ?? domain;
  const latest = latestResultForDomain(status, domain);
  const latestNonFailed = latestNonFailedResultForDomain(status, domain);

  // Build the strongest success anchor: dedicated domain timestamp (ER/lab) or latest non-failed result.
  let lastSuccessAt: string | null = null;
  let successFromTimestampKey = false;
  for (const key of policy.timestampKeys ?? []) {
    const value = status[key];
    if (typeof value === 'string' && value) {
      lastSuccessAt = value;
      successFromTimestampKey = true;
      break;
    }
  }

  if (latestNonFailed) {
    const nonFailedMs = parseTimestampMs(latestNonFailed.timestamp);
    const currentMs = lastSuccessAt ? parseTimestampMs(lastSuccessAt) : NaN;
    if (Number.isFinite(nonFailedMs) && (!Number.isFinite(currentMs) || nonFailedMs > currentMs)) {
      lastSuccessAt = latestNonFailed.timestamp;
      successFromTimestampKey = false;
    }
  }

  // If still no success anchor, the latest event is a failure (or missing).
  const lastEventAt = lastSuccessAt ?? latest?.timestamp ?? null;
  const ageMinutes = ageMinutesFrom(lastEventAt, nowMs);

  // No evidence at all for this domain.
  if (!latest && !lastSuccessAt) {
    return {
      domain,
      label,
      state: 'never_run',
      critical: domain === 'er-waittimes' || domain === 'diagnostic',
      lastSuccessAt: null,
      ageMinutes: null,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} has never reported a successful sync`,
    };
  }

  // No success anchor at all: every recorded result failed.
  if (!lastSuccessAt) {
    return {
      domain,
      label,
      state: 'failed',
      critical: true,
      lastSuccessAt: lastEventAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} feed failed`,
    };
  }

  const failedAfterSuccess = hasMoreRecentFailure(status, domain, lastSuccessAt);

  if (ageMinutes != null && ageMinutes > policy.criticalTtlMinutes) {
    return {
      domain,
      label,
      state: 'critical_stale',
      critical: true,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} is critically stale (${formatAge(ageMinutes)})`,
    };
  }

  // A failed pipeline ran after our success anchor. If no non-failed result exists at
  // all, the domain is down; otherwise it is only degraded (secondary pipeline failure).
  if (failedAfterSuccess && !latestNonFailed) {
    return {
      domain,
      label,
      state: 'failed',
      critical: true,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} feed failed`,
    };
  }

  if (failedAfterSuccess) {
    return {
      domain,
      label,
      state: 'partial',
      critical: false,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} returned a partial update`,
    };
  }

  // Timestamp-key success without a matching non-failed result record.
  if (successFromTimestampKey && (!latestNonFailed || latestNonFailed.timestamp !== lastSuccessAt)) {
    if (ageMinutes != null && ageMinutes > policy.softTtlMinutes) {
      return {
        domain,
        label,
        state: 'soft_stale',
        critical: false,
        lastSuccessAt,
        ageMinutes,
        softTtlMinutes: policy.softTtlMinutes,
        criticalTtlMinutes: policy.criticalTtlMinutes,
        message: `${label} may be stale (${formatAge(ageMinutes)})`,
      };
    }
    return {
      domain,
      label,
      state: 'healthy',
      critical: false,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} is fresh`,
    };
  }

  if (!latestNonFailed) {
    // Should be unreachable because we already handled !lastSuccessAt, but keep safe.
    return {
      domain,
      label,
      state: 'failed',
      critical: true,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} feed failed`,
    };
  }

  if (latestNonFailed.status === 'partial' || latestNonFailed.status === 'manual') {
    return {
      domain,
      label,
      state: 'partial',
      critical: false,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message:
        latestNonFailed.status === 'manual'
          ? `${label} is manual / partially automated`
          : `${label} returned a partial update`,
    };
  }

  if (latestNonFailed.status === 'skipped') {
    return {
      domain,
      label,
      state: 'skipped',
      critical: false,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} was skipped in the last sync`,
    };
  }

  if (ageMinutes != null && ageMinutes > policy.softTtlMinutes) {
    return {
      domain,
      label,
      state: 'soft_stale',
      critical: false,
      lastSuccessAt,
      ageMinutes,
      softTtlMinutes: policy.softTtlMinutes,
      criticalTtlMinutes: policy.criticalTtlMinutes,
      message: `${label} may be stale (${formatAge(ageMinutes)})`,
    };
  }

  return {
    domain,
    label,
    state: 'healthy',
    critical: false,
    lastSuccessAt,
    ageMinutes,
    softTtlMinutes: policy.softTtlMinutes,
    criticalTtlMinutes: policy.criticalTtlMinutes,
    message: `${label} is fresh`,
  };
}

function buildBannerMessage(criticalIssues: DomainHealth[], syncStatusAvailable: boolean): string | null {
  if (!syncStatusAvailable) {
    return 'Live data status is unreachable. Showing last received data where available.';
  }
  if (criticalIssues.length === 0) return null;

  const labels = criticalIssues.slice(0, 3).map((d) => d.label);
  const more = criticalIssues.length > 3 ? ` +${criticalIssues.length - 3} more` : '';
  const joined = labels.join(', ') + more;

  const hasFailure = criticalIssues.some((d) => d.state === 'failed');
  if (hasFailure) {
    return `Data refresh is failing for ${joined}. Showing last received data.`;
  }

  const hasNeverRun = criticalIssues.some((d) => d.state === 'never_run');
  if (hasNeverRun) {
    return `${joined} ${criticalIssues.length === 1 ? 'has' : 'have'} never completed. Showing last received data where available.`;
  }

  return `Some feeds are critically stale (${joined}). Showing last received data.`;
}

/**
 * Assess pipeline/sync health for uptime checks and UI banners.
 * @param syncStatus null when `/api/sync/status` is unreachable or missing
 */
export function assessDataHealth(
  syncStatus: SyncStatusLike | null,
  nowMs: number = Date.now(),
): DataHealthSummary {
  if (!syncStatus) {
    return {
      overall: 'down',
      syncStatusAvailable: false,
      lastSyncTimestamp: null,
      domains: [],
      criticalIssues: [],
      softIssues: [],
      bannerMessage: buildBannerMessage([], false),
      checks: ['sync_status_missing'],
    };
  }

  const domains = MONITORED_DOMAINS.map((domain) => assessDomain(syncStatus, domain, nowMs));
  const criticalIssues = domains.filter((d) => d.critical);
  const softIssues = domains.filter(
    (d) => !d.critical && (d.state === 'soft_stale' || d.state === 'partial'),
  );

  const dailyAge = ageMinutesFrom(syncStatus.lastSyncTimestamp, nowMs);
  const dailyCritical = dailyAge == null || dailyAge > 48 * 60;
  const dailySoft = dailyAge != null && dailyAge > 26 * 60;
  const checks: string[] = [];

  if (syncStatus.lastSyncTimestamp) checks.push('daily_sync_present');
  else checks.push('daily_sync_missing');

  if (dailyAge != null && dailyAge <= 26 * 60) checks.push('daily_sync_fresh');
  else if (dailyCritical) checks.push('daily_sync_critical');
  else checks.push('daily_sync_soft_stale');

  const er = domains.find((d) => d.domain === 'er-waittimes');
  if (er?.state === 'healthy') checks.push('er_feed_fresh');
  else if (er?.critical) checks.push('er_feed_critical');
  else checks.push('er_feed_soft_stale');

  let overall: HealthLevel = 'ok';
  if (!syncStatus.lastSyncTimestamp || criticalIssues.length > 0 || dailyCritical) {
    overall = 'down';
  } else if (softIssues.length > 0 || dailySoft) {
    overall = 'degraded';
  }

  // Daily sync missing/critically old is itself a critical banner issue.
  const syntheticCritical = [...criticalIssues];
  if (dailyCritical) {
    syntheticCritical.push({
      domain: 'daily-sync',
      label: 'Daily sync',
      state: dailyAge == null ? 'never_run' : 'critical_stale',
      critical: true,
      lastSuccessAt: syncStatus.lastSyncTimestamp,
      ageMinutes: dailyAge,
      softTtlMinutes: 26 * 60,
      criticalTtlMinutes: 48 * 60,
      message:
        dailyAge == null
          ? 'Daily sync has never completed'
          : `Daily sync is critically stale (${formatAge(dailyAge)})`,
    });
    if (overall === 'ok') overall = 'down';
  }

  return {
    overall,
    syncStatusAvailable: true,
    lastSyncTimestamp: syncStatus.lastSyncTimestamp,
    domains,
    criticalIssues: syntheticCritical,
    softIssues,
    bannerMessage: buildBannerMessage(syntheticCritical, true),
    checks,
  };
}

export function syncDomainForView(viewId: string): string | null {
  return VIEW_TO_SYNC_DOMAIN[viewId] ?? null;
}

export function getDomainHealth(
  summary: DataHealthSummary,
  domainOrView: string,
): DomainHealth | null {
  const domain = VIEW_TO_SYNC_DOMAIN[domainOrView] ?? domainOrView;
  return summary.domains.find((d) => d.domain === domain) ?? null;
}
