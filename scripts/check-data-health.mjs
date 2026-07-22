#!/usr/bin/env node
/**
 * Uptime helper for /api/health.
 *
 * Usage:
 *   node scripts/check-data-health.mjs [url]
 *   node scripts/check-data-health.mjs --strict [url]
 *
 * Default URL: http://127.0.0.1:3004/api/health
 * Exit 0 when overall is ok or degraded.
 * Exit 1 when overall is down, or on HTTP/network/parse failure.
 * With --strict, degraded also exits 1.
 */

const DEFAULT_URL = 'http://127.0.0.1:3004/api/health';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const url = args.find((a) => a !== '--strict') || DEFAULT_URL;

function summarize(body) {
  const status = body?.status ?? 'unknown';
  const syncStale = body?.syncStale === true;
  const age =
    body?.lastSyncAgeHours == null ? 'n/a' : `${body.lastSyncAgeHours}h`;
  const domains = Array.isArray(body?.domains) ? body.domains.length : 0;
  const critical = Array.isArray(body?.criticalIssues) ? body.criticalIssues.length : 0;
  const soft = Array.isArray(body?.softIssues) ? body.softIssues.length : 0;
  const checks = Array.isArray(body?.checks) ? body.checks.join(',') : '';
  const edge = body?.edge === true ? ' edge' : '';
  return `health=${status} syncStale=${syncStale} lastSyncAge=${age} domains=${domains} critical=${critical} soft=${soft} checks=[${checks}]${edge}`;
}

try {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    console.error(`FAIL http=${res.status} url=${url}`);
    process.exit(1);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    console.error(`FAIL parse_error url=${url}`);
    process.exit(1);
  }

  const overall = body?.status;
  console.log(summarize(body));

  if (overall === 'ok') {
    process.exit(0);
  }
  if (overall === 'degraded') {
    process.exit(strict ? 1 : 0);
  }
  // down or unexpected
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`FAIL network url=${url} error=${message}`);
  process.exit(1);
}
