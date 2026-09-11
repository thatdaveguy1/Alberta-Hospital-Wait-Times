#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${ALBERTA_HOSPITALS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
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

# Stale-build preflight: warn when the bundle predates its sources, which means
# someone edited code without rebuilding. This is deliberately NOT fatal — a
# KeepAlive job that exits here crash-loops the site until an operator notices,
# and serving a working older bundle beats a dead server. Drift is surfaced
# instead via this warning and a hard failure in scripts/preflight.sh.
NEWEST_SOURCE="$(find server.ts src index.html vite.config.ts package.json tsconfig.json \
  -type f -newer dist/server.cjs -print -quit 2>/dev/null || true)"

if [[ -n "$NEWEST_SOURCE" ]]; then
  echo "Warning: dist/server.cjs predates ${NEWEST_SOURCE} — running an older build. Run: npm run build" >&2
fi

exec node dist/server.cjs
