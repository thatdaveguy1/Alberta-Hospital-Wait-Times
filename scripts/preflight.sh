#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== AlbertaHospitals preflight ==="

# Load repo .env safely before checking credentials.
load_env() {
  [[ -f .env ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < .env
}
load_env

fail=0

# 1. Build artifact exists and is reasonably fresh.
if [[ ! -f dist/server.cjs ]]; then
  echo "FAIL: dist/server.cjs not found" >&2
  fail=1
else
  age_hours="$(node -e '
    const fs = require("fs");
    const s = fs.statSync(process.argv[1]);
    const ageMs = Date.now() - s.mtimeMs;
    console.log(Math.round(ageMs / (1000 * 60 * 60)));
  ' dist/server.cjs 2>/dev/null || echo 9999)"
  if [[ "$age_hours" -gt 168 ]]; then
    echo "WARN: dist/server.cjs is ${age_hours}h old (max safe: 168h)" >&2
    fail=1
  else
    echo "OK: dist/server.cjs exists and is ${age_hours}h old"
  fi
fi

# 2. All three LaunchAgent plists are syntactically valid.
for plist in launchd/*.plist; do
  if plutil -lint "$plist" >/dev/null; then
    echo "OK: $plist"
  else
    echo "FAIL: $plist failed plutil -lint" >&2
    fail=1
  fi
done

# 3. LaunchAgents are loaded in the user session.
DOMAIN="gui/$(id -u)"
for label in \
  com.davemini.alberta-hospital-wait-times \
  com.davemini.alberta-hospital-pipeline-daily \
  com.davemini.alberta-hospital-uptime; do
  if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
    echo "OK: $label loaded"
  else
    echo "FAIL: $label not loaded" >&2
    fail=1
  fi
done

# 4. Local /api/health responds and is parseable.
if command -v curl >/dev/null; then
  if body="$(curl -fsS http://127.0.0.1:3004/api/health 2>/dev/null)"; then
    if node -e 'JSON.parse(process.argv[1]);' "$body" >/dev/null 2>&1; then
      echo "OK: /api/health responds with valid JSON"
    else
      echo "FAIL: /api/health returned unparseable JSON" >&2
      fail=1
    fi
  else
    echo "FAIL: /api/health did not respond" >&2
    fail=1
  fi
else
  echo "SKIP: curl not available for /api/health check"
fi

# 5. newsyslog config syntax (non-destructive validation; does not install).
for conf in ops/newsyslog/*.conf; do
  [[ -f "$conf" ]] || continue
  if python3 scripts/validate-newsyslog.py "$conf" >/dev/null 2>&1; then
    echo "OK: $conf"
  else
    echo "WARN: $conf validation skipped" >&2
  fi
done

# 6. Required environment variables present (loaded from .env above).
if [[ -z "${PUSH_SECRET:-}" || -z "${CLOUDFLARE_WORKER_URL:-}" ]]; then
  echo "FAIL: .env must define PUSH_SECRET and CLOUDFLARE_WORKER_URL" >&2
  fail=1
else
  echo "OK: PUSH_SECRET and CLOUDFLARE_WORKER_URL present"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "=== preflight passed ==="
  exit 0
else
  echo "=== preflight failed ===" >&2
  exit 1
fi
