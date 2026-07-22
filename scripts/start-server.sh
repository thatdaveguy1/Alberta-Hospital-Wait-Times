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

port_pid() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

existing_pid="$(port_pid)"
if [[ -n "$existing_pid" ]]; then
  cmd="$(ps -p "$existing_pid" -o args= 2>/dev/null || true)"
  if [[ "$cmd" == *"dist/server.cjs"* ]]; then
    echo "already running on port $PORT (pid $existing_pid)"
    exit 0
  fi
  echo "Port $PORT held by pid $existing_pid — stopping: $cmd" >&2
  kill "$existing_pid" 2>/dev/null || true
  for _ in {1..10}; do
    [[ -z "$(port_pid)" ]] && break
    sleep 0.5
  done
  if [[ -n "$(port_pid)" ]]; then
    echo "Error: port $PORT still in use after 5s" >&2
    exit 1
  fi
fi

if [[ ! -f dist/server.cjs ]]; then
  echo "Error: dist/server.cjs not found — run: npm run build" >&2
  exit 1
fi

exec node dist/server.cjs
