# Log rotation with newsyslog

macOS ships with `newsyslog` (a BSD log rotator) and reads config files from
`/etc/newsyslog.conf` plus `/etc/newsyslog.d/*.conf`.  LaunchAgent stdout/stderr
files can grow without bound if the server is restarted frequently, so rotation
keeps disk usage predictable.

## What is covered

`ops/newsyslog/alberta-hospitals.conf` configures rotation for:

- `logs/wait-times.out.log` and `.err.log` (server KeepAlive)
- `logs/daily-sync.out.log` and `.err.log` (daily sync calendar agent)
- `logs/uptime-agent.out.log` and `.err.log` (uptime check agent)
- `logs/uptime.jsonl` (probe JSONL output from `run-uptime-check.sh`)

Each log keeps the current file plus up to 7 archives (`count 7`) and rotates
daily at midnight (`$D0`).  `logs/uptime.jsonl` keeps 14 archives.

## Installation (manual, requires admin)

Do not silently edit `/etc` during normal setup.  Run this as an explicit
install step:

```bash
sudo cp ops/newsyslog/alberta-hospitals.conf /etc/newsyslog.d/
sudo newsyslog -v
```

`newsyslog` normally runs from `launchd` daily, but you can force a dry run
without rotating:

```bash
sudo newsyslog -n -f /etc/newsyslog.conf
```

To test only this file:

```bash
sudo newsyslog -n -f /etc/newsyslog.d/alberta-hospitals.conf
```

## Verifying the config without installing

```bash
python3 scripts/validate-newsyslog.py ops/newsyslog/alberta-hospitals.conf
plutil -lint launchd/*.plist
scripts/preflight.sh
```

## Important caveats

- Log paths are absolute and include the current username.  If this repo moves
  or the username changes, update the paths before installing.
- `newsyslog` can only rotate files it can read/write.  LaunchAgent logs are
  owned by the logged-in user, so `davemini:staff` is used in the template.
- The `G` flag means the old log file is compressed with `gzip` after rotation.
- The `Z` flag on `uptime.jsonl` rotates by size or age only (it does not
  compress).
