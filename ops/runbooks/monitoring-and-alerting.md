# Monitoring and alerting runbook

Last known state: 2026-07-23.

## Components

| Component | Path | Role |
| --- | --- | --- |
| Health endpoint | `/api/health` | Returns overall status, critical/soft issues, banner message, and edge push outcomes. Always HTTP 200. |
| Health check | `scripts/check-data-health.mjs` | Exits 0 on `ok` or `degraded` (or 1 with `--strict`), 1 on `down`/network/parse failure. `--json` mode emits a single line for the notifier. |
| Uptime runner | `scripts/run-uptime-check.sh` | Probes local and production `/api/health` every 10 minutes via the `com.davemini.alberta-hospital-uptime` LaunchAgent. |
| Notifier | `scripts/notifier.mjs` | Reads health check JSON, persists `logs/monitor-state.json`, and sends Discord webhook for actionable state transitions only. |
| LaunchAgent | `launchd/com.davemini.alberta-hospital-uptime.plist` | Runs `run-uptime-check.sh` every 600 seconds. |
| Logs | `logs/uptime.jsonl` | One JSON line per probe with `ts`, `url`, `ok`, `exit`, `summary`. |

## Alert rules

The notifier sends a Discord webhook **only** for:

- `ok`/`degraded` → `down`
- Newly observed `criticalIssues` domain while already `down`
- Endpoint / network / JSON parse failure (HTTP/network/parse failure)
- `down` → `ok`/`degraded` (recovery)

It **does not** alert for:

- Repeated identical failures inside the dedupe window
- Steady `degraded` state
- Soft-stale domains

## Deduplication

- `DEFAULT_DEDUPE_MS` is 10 minutes.
- Down states are fingerprinted by `overall` plus sorted `criticalDomains`.
- Endpoint failures are deduped by the probe URL.
- State is stored per endpoint in `logs/monitor-state-<id>.json`
  (gitignored, never `data-sync-status.json`).  `local` and `prod` have
  independent state files so a local failure and a production recovery cannot
  interfere with each other.

## Missing webhook

If `ALERT_DISCORD_WEBHOOK_URL` is absent, the notifier logs the would-be alert,
updates state, and exits successfully.  Monitoring continues and the state file
remains accurate.

## Environment variables

See `.env.example`:

- `ALERT_DISCORD_WEBHOOK_URL` — optional Discord webhook (to be wired later)
- `MONITOR_STATE_DIR` — optional override for state directory (default
  `logs`)
- `ALERT_DEDUPE_MS` — optional override (default 600000 ms)

## Manual checks

```bash
# One-shot local health check
npm run health:check

# JSON output for notifier
node scripts/check-data-health.mjs --json http://127.0.0.1:3004/api/health

# Simulate notifier manually
node scripts/notifier.mjs --health-json '{"ok":false,"overall":"down","criticalDomains":["er-waittimes"],"url":"http://127.0.0.1:3004/api/health","monitorId":"local"}'

# Preflight
scripts/preflight.sh
```
