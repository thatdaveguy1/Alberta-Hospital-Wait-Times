#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
mkdir -p logs

LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3004/api/health}"
PROD_URL="${PROD_URL:-https://alberta-hospital-wait-times.longmad.workers.dev/api/health}"
LOG_FILE="logs/uptime.jsonl"
overall_exit=0

check_url() {
  local url="$1"
  local stdout_file stderr_file exit_code last_line ts json_line ok

  stdout_file="$(mktemp)"
  stderr_file="$(mktemp)"
  set +e
  node scripts/check-data-health.mjs "$url" >"$stdout_file" 2>"$stderr_file"
  exit_code=$?
  set -e

  if [[ -s "$stderr_file" ]]; then
    cat "$stderr_file" >&2
  fi

  last_line="$(tail -1 "$stdout_file" 2>/dev/null || true)"
  rm -f "$stdout_file" "$stderr_file"

  if [[ "$exit_code" -ne 0 ]]; then
    overall_exit=1
    ok="false"
  else
    ok="true"
  fi

  ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  json_line="$(
    node -e '
      const [ts, url, ok, exitCode, summary] = process.argv.slice(1);
      console.log(JSON.stringify({
        ts,
        url,
        ok: ok === "true",
        exit: Number(exitCode),
        summary,
      }));
    ' "$ts" "$url" "$ok" "$exit_code" "${last_line:-}"
  )"
  echo "$json_line" >>"$LOG_FILE"
  echo "$json_line"
}

check_url "$LOCAL_URL"
check_url "$PROD_URL"

exit "$overall_exit"
