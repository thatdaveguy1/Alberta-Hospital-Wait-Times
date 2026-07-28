# Monitoring and alerting runbook

Last known state: 2026-07-23.

## Components

| Health endpoint | `/api/health` | Returns overall status, `syncStale` (daily age/missing/down), optional `healthDegraded` (`overall !== 'ok'`), critical/soft issues, banner message, and edge push outcomes. Always HTTP 200. |

## Alert rules

The notifier sends a Discord webhook **only** for:

- `ok`/`degraded` → `down`
- Newly observed `criticalIssues` domain while already `down`
- Endpoint / network / JSON parse failure (HTTP/network/parse failure)
- `down` → `ok`/`degraded` (recovery)

It **does not** alert for:
- `syncStale` transitions (daily > 26h old, missing, or overall `down`)

## Expected non-alerting states

- `openAlbertaFetcher` is **skipped** when only CKAN PDF/catalog resources are available.
- `fraserDownloader` is **skipped** when the Fraser Institute blocks automated access (403).
- Public-health pipelines (`phacFetcher`, `albertaRespiratoryVirusScraper`) report **success**
  with `recordsWritten: 0` and a `note` when upstream content is unchanged.
- These skips/no-ops do **not** degrade `overall` health or set `syncStale`.

## Deduplication

- `DEFAULT_DEDUPE_MS` is 30 minutes.
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
- `ALERT_DEDUPE_MS` — optional override (default 1800000 ms)

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
