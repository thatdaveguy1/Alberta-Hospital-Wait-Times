# Host hardening runbook

Last known state: 2026-07-23.

## Boot / preflight verification

`scripts/preflight.sh` checks:

1. `dist/server.cjs` exists and is ≤ 168 hours old.
2. All three `launchd/*.plist` files pass `plutil -lint`.
3. All three LaunchAgents are loaded in the user session.
4. `http://127.0.0.1:3004/api/health` responds with parseable JSON.
5. `ops/newsyslog/*.conf` passes syntax validation.
6. `.env` contains `PUSH_SECRET` and `CLOUDFLARE_WORKER_URL`.

Run it after any deployment or reboot:

```bash
scripts/preflight.sh
```

## Build artifact freshness

`scripts/start-server.sh` refuses to start when `dist/server.cjs` is missing or
older than 168 hours.  It does **not** run `npm run build` automatically; an
operator must rebuild explicitly so a crash loop does not silently resurrect
stale code.

## LaunchAgents (not LaunchDaemons)

The three agents run in the user login session:

- `com.davemini.alberta-hospital-wait-times` — KeepAlive server
- `com.davemini.alberta-hospital-pipeline-daily` — daily sync at 06:00
- `com.davemini.alberta-hospital-uptime` — health probe every 10 minutes

Install or refresh with:

```bash
scripts/install-launchd.sh
```

**Warning:** Do not blindly migrate these to `LaunchDaemons`.  Several pipelines
(`powerbiScraper.ts` with Puppeteer, user `.env` paths, and GUI context) depend
on a logged-in user session.  A migration requires design review and is out of
scope for this runbook.

## Auto-login / restart-after-power-loss

Last-known observed values (verify live state before trusting):

```bash
# Auto-login user
sudo fdesetup list

# Restart after power failure (only meaningful on desktop Macs with supported PSUs)
sudo pmset -g | grep -E 'autorestart|restartpowerloss'

# AC sleep policy (deliberately unchanged by user choice)
sudo pmset -g | grep -E 'sleep|displaysleep'
```

The user chose to **document only** and not change AC sleep.  AC sleep remains
enabled, which means scheduled jobs and local monitoring can pause until the
Mac wakes.  External monitoring is therefore strongly recommended.

## Log rotation

See `ops/newsyslog/README.md`.  Install manually with:

```bash
sudo cp ops/newsyslog/alberta-hospitals.conf /etc/newsyslog.d/
sudo newsyslog -v
```

## No self-heal

This runbook does **not** configure `launchctl` self-heal, automatic rebuild, or
auto-restart loops.  Repeated failures are surfaced through the notifier and
`logs/uptime.jsonl`.
