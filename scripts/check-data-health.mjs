#!/usr/bin/env node
/**
 * Uptime helper for /api/health.
 *
 * Usage:
 *   node scripts/check-data-health.mjs [url]
 *   node scripts/check-data-health.mjs --strict [url]
 *   node scripts/check-data-health.mjs --json [url]
 *
 * Default URL: http://127.0.0.1:3004/api/health
 * Exit 0 when overall is ok or degraded.
 * Exit 1 when overall is down, or on HTTP/network/parse failure.
 * With --strict, degraded also exits 1.
 * With --json, prints a single machine-readable JSON line (used by the
 * notifier and uptime.jsonl).
 */

const DEFAULT_URL = 'http://127.0.0.1:3004/api/health';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const json = args.includes('--json');
const url = args.find((a) => a !== '--strict' && a !== '--json') || DEFAULT_URL;

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

function makeMonitorId(url) {
  // Distinct ID per endpoint so local and prod state never share a dedupe window.
  if (url.includes('127.0.0.1') || url.includes('localhost')) return 'local';
  if (url.includes('workers.dev')) return 'prod';
  return 'other';
}

function makeResult({ ok, overall, body, url: u, httpStatus, error }) {
  const criticalDomains = Array.isArray(body?.criticalIssues)
    ? body.criticalIssues.map((d) => d.domain)
    : [];
  return {
    ok,
    overall: overall ?? body?.status ?? 'unknown',
    criticalDomains,
    summary: error || summarize(body),
    url: u,
    httpStatus: httpStatus ?? null,
    error: error ?? null,
    monitorId: makeMonitorId(u),
  };
}

function finish(result) {
  if (json) {
    console.log(JSON.stringify(result));
  } else {
    if (result.error) {
      console.error(result.error);
    } else {
      console.log(result.summary);
    }
  }
  process.exit(result.ok ? 0 : 1);
}

try {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const error = `FAIL http=${res.status} url=${url}`;
    finish(
      makeResult({ ok: false, overall: 'down', url, httpStatus: res.status, error }),
    );
  }

  let body;
  try {
    body = await res.json();
  } catch {
    const error = `FAIL parse_error url=${url}`;
    finish(makeResult({ ok: false, overall: 'down', url, httpStatus: res.status, error }));
  }

  const overall = body?.status;
  const ok = overall === 'ok' || (overall === 'degraded' && !strict);
  finish(makeResult({ ok, overall, body, url, httpStatus: res.status, error: null }));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  const error = `FAIL network url=${url} error=${message}`;
  finish(makeResult({ ok: false, overall: 'down', url, httpStatus: null, error }));
}
