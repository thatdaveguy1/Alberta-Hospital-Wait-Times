#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

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

if [[ -z "${PUSH_SECRET:-}" || -z "${CLOUDFLARE_WORKER_URL:-}" ]]; then
  echo "Error: .env must define PUSH_SECRET and CLOUDFLARE_WORKER_URL" >&2
  exit 1
fi

PORT="${PORT:-3004}"
export PORT
export NODE_ENV=production

port_pids() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
}

port_in_use() {
  [[ -n "$(port_pids)" ]]
}

# KeepAlive jobs must stay long-running. Never exit 0 while another listener
# holds the port — take it over so this launchd process owns the server.
if port_in_use; then
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
    echo "Port $PORT held by pid $pid — stopping: $cmd" >&2
    kill "$pid" 2>/dev/null || true
  done < <(port_pids)

  for _ in {1..10}; do
    port_in_use || break
    sleep 0.5
  done

  if port_in_use; then
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      echo "Force-killing leftover pid $pid on port $PORT" >&2
      kill -9 "$pid" 2>/dev/null || true
    done < <(port_pids)

    for _ in {1..10}; do
      port_in_use || break
      sleep 0.5
    done
  fi

  if port_in_use; then
    echo "Error: port $PORT still in use after kill (pids: $(port_pids | tr '\n' ' '))" >&2
    exit 1
  fi
fi

if [[ ! -f dist/server.cjs ]]; then
  echo "Error: dist/server.cjs not found — run: npm run build" >&2
  exit 1
fi

# Preflight: dist artifact must not be older than 7 days, otherwise an
# unexpected KeepAlive restart could serve stale code after source drift.
ARTIFACT_AGE_HOURS="$(node -e '
  const fs = require("fs");
  const s = fs.statSync(process.argv[1]);
  const ageMs = Date.now() - s.mtimeMs;
  console.log(Math.round(ageMs / (1000 * 60 * 60)));
' dist/server.cjs 2>/dev/null || echo 9999)"

if [[ "$ARTIFACT_AGE_HOURS" -gt 168 ]]; then
  echo "Error: dist/server.cjs is ${ARTIFACT_AGE_HOURS}h old — run: npm run build" >&2
  exit 1
fi

exec node dist/server.cjs
