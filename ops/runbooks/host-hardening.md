# Host hardening runbook

Last known state: 2026-07-23.

## Boot / preflight verification

`scripts/preflight.sh` checks:

1. `dist/server.cjs` exists and is not older than any build input.
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

`scripts/start-server.sh` refuses to start only when `dist/server.cjs` is
missing.  When the bundle is older than the source tree (someone edited code
without rebuilding), it logs a `Warning:` line to stderr and **still starts**.

This is deliberate. The previous rule refused any bundle older than 168 hours,
which turned a stable site into a crash loop on day 8 — a KeepAlive job that
exits at startup restarts forever, and the site is down until an operator
notices. Age is not evidence of a problem; the bundle can be arbitrarily old
and still correct. Source drift is the real signal, so that is what is checked:

```bash
find server.ts src index.html vite.config.ts package.json tsconfig.json \
  -type f -newer dist/server.cjs -print -quit
```

Serving a working older bundle beats a dead server. Nothing runs `npm run build`
automatically, so rebuild explicitly after changing runtime code — otherwise the
warning is the only signal that the running server predates your edit.
`scripts/preflight.sh` reports the same drift as a hard `FAIL`, and is the place
to check before a deployment.

## LaunchAgents (not LaunchDaemons)

The three agents run in the user login session:

- `com.davemini.alberta-hospital-wait-times` — KeepAlive server
- `com.davemini.alberta-hospital-pipeline-daily` — daily sync at 06:00
- `com.davemini.alberta-hospital-uptime` — health probe every 10 minutes

**Production supervision is launchd.** `npm run dev` / `tsx` and any OMP `hub`
process are **dev-only**; `scripts/preflight.sh` warns if `:3004` is held by
a non-production listener.

Install or refresh with:

```bash
scripts/install-launchd.sh
```

**Warning:** Do not blindly migrate these to `LaunchDaemons`.  Several pipelines
(`powerbiScraper.ts` with Puppeteer, user `.env` paths, and GUI context) depend
on a logged-in user session.  A migration requires design review and is out of
scope for this runbook.

### Homebrew node upgrades silently break the calendar job

Every plist launches `/Users/davemini/.local/bin/node`, a symlink into the
Homebrew Cellar. macOS attaches a launch constraint (LWCR) to that binary, and
**the constraint goes stale the moment Homebrew replaces it** — `brew upgrade
node` swaps 26.8.1 for 26.9.0 behind the symlink.

Symptom: the next spawn is killed by the kernel before it produces any output.
Nothing appears in `alberta-pipeline.*.log`; `launchctl list` shows exit code
`-9` and `launchctl print` reports:

```
properties = ... | needs LWCR update | managed LWCR | has LWCR
last exit reason = OS_REASON_CODESIGNING
```

The KeepAlive server and the 10-minute uptime probe recover on their own,
because they respawn after the upgrade and pick up a fresh constraint. The
daily sync has no `RunAtLoad`, so it only spawns at 06:00 and dies there.

Recovery is a re-bootstrap, which regenerates the constraint:

```bash
launchctl bootout  gui/$(id -u)/com.davemini.alberta-hospital-pipeline-daily
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.davemini.alberta-hospital-pipeline-daily.plist
```

`scripts/preflight.sh` fails on `needs LWCR update` for any agent, so run it
after any Homebrew upgrade that touches node. Data freshness is still covered
while the calendar job is down — the server runs the same daily cycle in-process
at 06:00 — but the redundancy is gone until the job is re-bootstrapped.

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
