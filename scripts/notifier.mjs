// notifier.mjs — state-transition alerting for local monitoring.
// Reads a health check JSON object, maintains deduplicated monitor state keyed
// by monitorId, and sends a Discord webhook only for actionable transitions.
// Missing webhook config is safe: state is still updated and logged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DEDUPE_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_STATE_DIR = 'logs';

export function defaultState() {
  return {
    overall: null,
    criticalAlerted: [],
    endpointFailureSentAt: null,
    lastAlert: null,
  };
}

function monitorStateFile(stateDir, monitorId) {
  const safeId = monitorId.replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(stateDir, `monitor-state-${safeId}.json`);
}

export function loadMonitorState(stateFile) {
  try {
    const raw = fs.readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      criticalAlerted: Array.isArray(parsed?.criticalAlerted)
        ? parsed.criticalAlerted
        : [],
      lastAlert: parsed?.lastAlert
        ? { ...parsed.lastAlert }
        : null,
    };
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('[Notifier] Failed to load state:', err.message);
    }
    return defaultState();
  }
}

export function saveMonitorState(stateFile, state) {
  try {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[Notifier] Failed to save state:', err.message);
  }
}

export function buildEndpointFailurePayload(input, now = Date.now()) {
  const summary = input.summary || `error=${input.error}` || 'unknown failure';
  return {
    username: 'AlbertaHospitals Monitor',
    content: `🚨 Endpoint failure: ${input.url}`,
    embeds: [
      {
        title: 'Endpoint / network / parse failure',
        description: summary,
        color: 0xff0000,
        timestamp: new Date(now).toISOString(),
        fields: [
          { name: 'URL', value: input.url, inline: true },
          {
            name: 'HTTP status',
            value: String(input.httpStatus ?? 'n/a'),
            inline: true,
          },
        ],
      },
    ],
  };
}

export function buildDownPayload(input, previousOverall, now = Date.now()) {
  const criticalList =
    input.criticalDomains.length > 0
      ? input.criticalDomains.join(', ')
      : 'none';
  return {
    username: 'AlbertaHospitals Monitor',
    content: `🔴 Data health is down`,
    embeds: [
      {
        title: `Health down${previousOverall ? ` (was ${previousOverall})` : ''}`,
        color: 0xff0000,
        timestamp: new Date(now).toISOString(),
        fields: [
          { name: 'Overall', value: input.overall, inline: true },
          { name: 'URL', value: input.url, inline: true },
          { name: 'Critical domains', value: criticalList },
          {
            name: 'Summary',
            value: input.summary || 'No summary',
          },
        ],
      },
    ],
  };
}

export function buildNewCriticalPayload(
  input,
  domain,
  previousOverall,
  now = Date.now(),
) {
  return {
    username: 'AlbertaHospitals Monitor',
    content: `⚠️ New critical issue: ${domain}`,
    embeds: [
      {
        title: 'Newly observed critical issue',
        color: 0xffa500,
        timestamp: new Date(now).toISOString(),
        fields: [
          { name: 'Domain', value: domain, inline: true },
          { name: 'Overall', value: input.overall, inline: true },
          {
            name: 'Summary',
            value: input.summary || 'No summary',
          },
        ],
      },
    ],
  };
}

export function buildRecoveryPayload(input, previousOverall, now = Date.now()) {
  return {
    username: 'AlbertaHospitals Monitor',
    content: `✅ Data health recovered to ${input.overall}`,
    embeds: [
      {
        title: 'Recovery',
        color: 0x00aa00,
        timestamp: new Date(now).toISOString(),
        fields: [
          { name: 'Previous', value: previousOverall, inline: true },
          { name: 'Current', value: input.overall, inline: true },
          {
            name: 'Summary',
            value: input.summary || 'No summary',
          },
        ],
      },
    ],
  };
}

export function downFingerprint(overall, criticalDomains) {
  const sorted = [...criticalDomains].sort();
  return `down:${overall}:${sorted.join('|')}`;
}

export function decideAlerts({
  input,
  state,
  dedupeMs = DEFAULT_DEDUPE_MS,
  now = Date.now(),
}) {
  const events = [];
  const next = {
    overall: state.overall,
    criticalAlerted: [...state.criticalAlerted],
    endpointFailureSentAt: state.endpointFailureSentAt,
    lastAlert: state.lastAlert ? { ...state.lastAlert } : null,
  };

  const previousOverall = next.overall;
  const criticalDomains = Array.isArray(input.criticalDomains)
    ? [...input.criticalDomains].sort()
    : [];

  // Endpoint / network / JSON parse failure.
  if (input.error) {
    const fp = `endpoint:${input.url}`;
    if (
      next.endpointFailureSentAt &&
      now - next.endpointFailureSentAt < dedupeMs
    ) {
      events.push({
        type: 'deduped',
        fingerprint: fp,
        reason: 'endpoint failure within dedupe window',
      });
    } else {
      events.push({
        type: 'endpoint',
        fingerprint: fp,
        payload: buildEndpointFailurePayload(input, now),
      });
      // sentAt is only set once the send is confirmed in sendAlerts.
      // We leave endpointFailureSentAt alone here; it will be set on confirmed send.
    }
    if (next.overall !== 'down') {
      next.overall = 'down';
    }
    return { state: next, events };
  }

  const currentOverall =
    input.overall === 'ok' || input.overall === 'degraded'
      ? input.overall
      : 'down';

  // Successful fetch path.
  next.endpointFailureSentAt = null;

  const newCritical = criticalDomains.filter(
    (d) => !next.criticalAlerted.includes(d),
  );

  if (currentOverall === 'down') {
    const isTransition = previousOverall !== 'down';
    const fp = downFingerprint(currentOverall, criticalDomains);
    const last = next.lastAlert;
    const sameFp = last?.fingerprint === fp;
    const withinDedupe = last?.sentAt && now - last.sentAt < dedupeMs;

    if (isTransition) {
      events.push({
        type: 'down-transition',
        fingerprint: fp,
        payload: buildDownPayload(input, previousOverall, now),
      });
      next.criticalAlerted = criticalDomains;
    } else if (newCritical.length > 0) {
      for (const domain of newCritical) {
        events.push({
          type: 'new-critical',
          fingerprint: `critical:${domain}`,
          payload: buildNewCriticalPayload(
            input,
            domain,
            previousOverall,
            now,
          ),
        });
      }
      next.criticalAlerted = criticalDomains;
      next.lastAlert = { fingerprint: fp, sentAt: null, type: 'new-critical' };
      return { state: next, events };
    } else if (!sameFp || !withinDedupe) {
      // Either fingerprint changed or dedupe window elapsed.
      events.push({
        type: 'down-transition',
        fingerprint: fp,
        payload: buildDownPayload(input, previousOverall, now),
      });
      next.criticalAlerted = criticalDomains;
    } else {
      events.push({
        type: 'deduped',
        fingerprint: fp,
        reason: 'repeated down within dedupe window',
      });
    }

    next.lastAlert = { fingerprint: fp, sentAt: null, type: 'down-transition' };
  } else {
    // currentOverall is ok or degraded.
    if (previousOverall === 'down') {
      const fp = `recovery:${currentOverall}:${criticalDomains.join('|')}`;
      events.push({
        type: 'recovery',
        fingerprint: fp,
        payload: buildRecoveryPayload(input, previousOverall, now),
      });
      next.lastAlert = { fingerprint: fp, sentAt: null, type: 'recovery' };
    } else {
      events.push({
        type: 'none',
        fingerprint: `ok:${currentOverall}`,
        reason: 'no state transition',
      });
    }
    next.criticalAlerted = [];
  }

  next.overall = currentOverall;
  return { state: next, events };
}

export async function defaultSendImpl(webhookUrl, payload) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord HTTP ${res.status}: ${text}`);
  }
  return res;
}

export async function sendAlerts({
  events,
  webhookUrl,
  sendImpl = defaultSendImpl,
  log = console.error,
}) {
  let sent = 0;
  let skipped = 0;
  const results = [];

  for (const event of events) {
    if (!event.payload) {
      continue;
    }
    if (!webhookUrl) {
      log(
        `[Notifier] ${event.type} alert queued but not sent (ALERT_DISCORD_WEBHOOK_URL not configured).`,
      );
      results.push({
        event: event.type,
        fingerprint: event.fingerprint,
        sent: false,
        reason: 'no_webhook',
      });
      skipped++;
      continue;
    }
    try {
      const res = await sendImpl(webhookUrl, event.payload);
      results.push({
        event: event.type,
        fingerprint: event.fingerprint,
        sent: true,
        status: res.status,
      });
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`[Notifier] Failed to send ${event.type}:`, msg);
      results.push({
        event: event.type,
        fingerprint: event.fingerprint,
        sent: false,
        error: msg,
      });
    }
  }

  return { sent, skipped, results };
}

// Update alert-state timestamps/endpointFailureSentAt only for confirmed sends.
// This ensures that a failed send leaves state ready to retry on the next run.
function applySendSuccess(state, events, results) {
  const next = { ...state };
  const resultByFingerprint = new Map(results.map((r) => [r.fingerprint, r]));

  for (const event of events) {
    if (!event.payload) continue;
    const result = resultByFingerprint.get(event.fingerprint);
    if (!result || !result.sent) continue;

    if (event.type === 'endpoint') {
      next.endpointFailureSentAt = result.sentAt;
    }

    if (['down-transition', 'new-critical', 'recovery'].includes(event.type)) {
      next.lastAlert = {
        fingerprint: event.fingerprint,
        sentAt: result.sentAt,
        type: event.type,
      };
    }
  }
  return next;
}

export async function runNotifier({
  input,
  stateDir = DEFAULT_STATE_DIR,
  stateFile = '',
  monitorId = '',
  webhookUrl = '',
  dedupeMs = DEFAULT_DEDUPE_MS,
  sendImpl = defaultSendImpl,
  log = console.error,
  now = Date.now(),
}) {
  const resolvedStateFile =
    stateFile ||
    monitorStateFile(
      stateDir,
      monitorId || input.monitorId || input.url || 'default',
    );
  const state = loadMonitorState(resolvedStateFile);
  const { state: nextState, events } = decideAlerts({
    input,
    state,
    dedupeMs,
    now,
  });
  const { sent, skipped, results } = await sendAlerts({
    events,
    webhookUrl,
    sendImpl,
    log,
  });

  const resultsWithTimestamp = results.map((r) => ({
    ...r,
    sentAt: r.sent ? now : undefined,
  }));

  const stateAfterSend = applySendSuccess(nextState, events, resultsWithTimestamp);
  saveMonitorState(resolvedStateFile, stateAfterSend);
  return { state: stateAfterSend, events, sent, skipped, results: resultsWithTimestamp, stateFile: resolvedStateFile };
}

function parseArgs(argv) {
  const args = {
    stateDir:
      process.env.MONITOR_STATE_DIR || DEFAULT_STATE_DIR,
    stateFile:
      process.env.MONITOR_STATE_FILE || '',
    monitorId: '',
    webhookUrl: process.env.ALERT_DISCORD_WEBHOOK_URL || '',
    dedupeMs: Number(
      process.env.ALERT_DEDUPE_MS || DEFAULT_DEDUPE_MS,
    ),
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--health-json' || a === '-j') && i + 1 < argv.length) {
      args.healthJson = argv[++i];
    } else if (a === '--state-dir' && i + 1 < argv.length) {
      args.stateDir = argv[++i];
    } else if (a === '--state-file' && i + 1 < argv.length) {
      args.stateFile = argv[++i];
    } else if (a === '--monitor-id' && i + 1 < argv.length) {
      args.monitorId = argv[++i];
    } else if (a === '--dedupe-ms' && i + 1 < argv.length) {
      args.dedupeMs = Number(argv[++i]);
    }
  }

  return args;
}

function isMain() {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (isMain()) {
  const args = parseArgs(process.argv);
  if (!args.healthJson) {
    console.error(
      'Usage: node notifier.mjs --health-json <json> [--monitor-id <id>] [--state-dir <dir>] [--state-file <path>] [--dedupe-ms <ms>]',
    );
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(args.healthJson);
  } catch (err) {
    console.error('[Notifier] Invalid health JSON:', err.message);
    process.exit(0);
  }

  runNotifier({
    input,
    stateDir: args.stateDir,
    stateFile: args.stateFile,
    monitorId: args.monitorId,
    webhookUrl: args.webhookUrl,
    dedupeMs: args.dedupeMs,
  })
    .then(({ events, sent, skipped }) => {
      for (const event of events) {
        if (event.payload) {
          console.error(`[Notifier] ${event.type} alert: ${event.fingerprint}`);
        } else if (event.type === 'deduped') {
          console.error(
            `[Notifier] deduped (${event.reason}): ${event.fingerprint}`,
          );
        }
      }
      if (sent > 0 || skipped > 0) {
        console.error(JSON.stringify({ sent, skipped }));
      }
    })
    .catch((err) => {
      console.error('[Notifier] Unexpected error:', err.message);
    });
}
