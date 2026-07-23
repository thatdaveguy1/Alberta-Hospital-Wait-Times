#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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
MONITOR_STATE_FILE="${MONITOR_STATE_FILE:-logs/monitor-state.json}"
overall_exit=0

notify() {
  local result_json="$1"
  local webhook_url="${ALERT_DISCORD_WEBHOOK_URL:-}"
  node scripts/notifier.mjs \
    --health-json "$result_json" \
    --state-file "$MONITOR_STATE_FILE" \
    ${webhook_url:+"--webhook-url" "$webhook_url"}
}

check_url() {
  local url="$1"
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
    result_json="$(node -e 'console.log(JSON.stringify({ok:false,overall:"down",criticalDomains:[],summary:"check-data-health produced no JSON",url:process.argv[1],httpStatus:null,error:"no_json"}))' "$url")"
  fi

  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  json_line="$(
    node -e '
      const [ts, resultJson, ok] = process.argv.slice(1);
      const r = JSON.parse(resultJson);
      console.log(JSON.stringify({
        ts,
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

check_url "$LOCAL_URL"
check_url "$PROD_URL"

exit "$overall_exit"
