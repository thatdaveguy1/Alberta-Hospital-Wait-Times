#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${ALBERTA_HOSPITALS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_ROOT"
mkdir -p logs

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

LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3004/api/health}"
PROD_URL="${PROD_URL:-https://alberta-hospital-wait-times.longmad.workers.dev/api/health}"
LOG_FILE="logs/uptime.jsonl"
MONITOR_STATE_DIR="${MONITOR_STATE_DIR:-logs}"
overall_exit=0

# Self-heal: launchd KeepAlive does not restart a server that is still "up" but
# broken. After Homebrew deletes the Node binary a running server is still
# listening, yet every file read fails with EPERM and GET / returns 500.
# Restart the server job when its binary is deleted or when GET / returns 5xx.
PORT="${PORT:-3004}"
SERVER_LABEL="com.davemini.alberta-hospital-wait-times"

port_pids() {
  /usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | sort -u || true
}

restart_server() {
  local reason="$1" old_pid="$2" pid
  echo "Self-heal: restarting $SERVER_LABEL (was pid $old_pid): $reason" >&2
  if ! launchctl kickstart -k "gui/$(id -u)/$SERVER_LABEL"; then
    echo "Self-heal: launchctl kickstart failed; continuing with checks" >&2
    return 0
  fi
  for _ in {1..30}; do
    pid="$(port_pids | head -n1)"
    if [[ -n "$pid" && "$pid" != "$old_pid" ]]; then
      break
    fi
    sleep 1
  done
  return 0
}

self_heal() {
  local pid code exe
  pid="$(port_pids | head -n1)"
  # Nothing listening: KeepAlive handles that, so do nothing here.
  [[ -n "$pid" ]] || return 0

  # The first mapped text file is the executable. Its path is the real Cellar
  # path (not the ~/.local/bin symlink, which Homebrew repoints to the new build).
  exe="$(/usr/sbin/lsof -nP -p "$pid" -a -d txt -Fn 2>/dev/null | sed -n 's/^n//p' | head -n1 || true)"
  if [[ "$exe" == /* && ! -e "$exe" ]]; then
    restart_server "pid $pid is running a Node binary that was deleted from disk ($exe)" "$pid"
    return 0
  fi

  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:$PORT/" 2>/dev/null || true)"
  if [[ "$code" =~ ^5[0-9][0-9]$ ]]; then
    restart_server "GET / returned HTTP $code" "$pid"
  fi
  return 0
}

# Notify using a per-endpoint monitor ID. Webhook is read from env only
# (never passed as CLI argument) to avoid ps leakage.
notify() {
  local result_json="$1"
  node scripts/notifier.mjs \
    --health-json "$result_json" \
    --state-dir "$MONITOR_STATE_DIR" \
    --monitor-id "$(node -e 'console.log(JSON.parse(process.argv[1]).monitorId || "default")' "$result_json")"
}

check_url() {
  local url="$1"
  local label="$2"
  local stderr_file exit_code result_json ts json_line ok

  stderr_file="$(mktemp)"
  set +e
  result_json="$(node scripts/check-data-health.mjs --json "$url" 2>"$stderr_file")"
  exit_code=$?
  set -e

  if [[ -s "$stderr_file" ]]; then
    cat "$stderr_file" >&2
  fi
  rm -f "$stderr_file"

  if [[ "$exit_code" -ne 0 ]]; then
    overall_exit=1
    ok="false"
  else
    ok="true"
  fi

  # Alert even when the JSON parse itself failed, so notifier sees endpoint failures.
  if [[ -z "$result_json" ]]; then
    result_json="$(node -e 'console.log(JSON.stringify({ok:false,overall:"down",criticalDomains:[],summary:"check-data-health produced no JSON",url:process.argv[1],httpStatus:null,error:"no_json",monitorId:process.argv[2]}))' "$url" "$label")"
  fi

  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  json_line="$(
    node -e '
      const [ts, resultJson, ok] = process.argv.slice(1);
      const r = JSON.parse(resultJson);
      console.log(JSON.stringify({
        ts,
        label: r.monitorId,
        url: r.url,
        ok: ok === "true" && r.ok === true,
        exit: ok === "true" ? 0 : 1,
        summary: r.summary,
      }));
    ' "$ts" "$result_json" "$ok"
  )"
  echo "$json_line" >>"$LOG_FILE"
  echo "$json_line"

  # Notify with the full machine-readable result.
  notify "$result_json" || true
}

self_heal || true
check_url "$LOCAL_URL" local
check_url "$PROD_URL" prod

exit "$overall_exit"
