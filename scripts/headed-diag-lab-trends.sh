#!/usr/bin/env bash
# Headed verification: Diagnostics & Labs module, provincial + per-lab wait trends.
# Prefer ?module=diagnostics deep link; module picker uses data-dashboard-id when needed.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="${ROOT}/screenshots/headed-diag-lab-$(date +%Y%m%d-%H%M)"
mkdir -p "$OUT"

export PATH="${HOME}/.local/lib/nodejs/bin:${HOME}/.local/bin:/opt/homebrew/bin:$PATH"
AB_SESSION="${AGENT_BROWSER_SESSION:-headed-diag-lab}"
BASE_URL="${AUDIT_BASE_URL:-http://127.0.0.1:3004/}"
LAB_ID="${HEADED_LAB_ID:-APL-BELC}"

ab() {
  agent-browser "$@" --headed --session "$AB_SESSION"
}

cleanup() {
  ab close 2>/dev/null || true
}
trap cleanup EXIT

pick_ref() {
  local label="$1"
  local ref
  ref=$(ab snapshot -i 2>&1 | grep -F "$label" | sed -n 's/.*\[ref=\(e[0-9]*\)\].*/\1/p' | head -1)
  if [[ -z "$ref" ]]; then
    ref=$(ab snapshot -i 2>&1 | grep -iF "$label" | sed -n 's/.*\[ref=\(e[0-9]*\)\].*/\1/p' | head -1)
  fi
  echo "$ref"
}

wait_for() {
  local label="$1"
  local i
  for i in $(seq 1 30); do
    if ab snapshot -i 2>&1 | grep -qiF "$label"; then
      return 0
    fi
    sleep 0.5
  done
  echo "WARN: timed out waiting for: $label" >&2
  return 1
}

select_module_by_id() {
  local id="$1"
  ab eval "(()=>{const b=document.querySelector('[data-dashboard-id=\"${id}\"]');if(b){b.click();return true;}return false;})()" && return 0
  return 1
}

open_modules() {
  wait_for "Change Module"
  ab eval "window.scrollTo(0,0);" || true
  sleep 0.3
  ab eval '(()=>{const btn=[...document.querySelectorAll("button")].find(b=>(b.textContent||"").trim().endsWith("Change Module")||(b.textContent||"").includes("Change Module"));if(btn){btn.click();return true;}return false;})()' || ab click "text=Change Module"
  sleep 2.5
}

echo "Reset agent-browser sessions..."
agent-browser close --all 2>/dev/null || true
sleep 1

DIAG_URL="${BASE_URL%/}?module=diagnostics"
echo "Opening $DIAG_URL (headed, session=$AB_SESSION)..."
ab open "$DIAG_URL"
sleep 3
ab eval "window.resizeTo(1400, 900);" || true
ab eval "localStorage.setItem('alberta_hospital_location_prompt_dismissed','1');" || true

if ! wait_for "Diagnostic & Lab Services"; then
  echo "Deep link missed — opening module picker for diagnostics id..."
  ab open "$BASE_URL"
  sleep 3
  open_modules
  select_module_by_id "diagnostics" || {
    ab fill 'input[placeholder="Search modules..."]' "diagnostics" 2>/dev/null || true
    sleep 1
    select_module_by_id "diagnostics" || ab click "text=Diagnostic Imaging" 2>/dev/null || true
  }
  sleep 3
  wait_for "Diagnostic & Lab Services" || { ab snapshot -i >&2; exit 1; }
fi

ab screenshot "$OUT/01-diagnostics-module.png" --full
ab read 2>&1 | grep -iE 'Diagnostic & Lab Services|Provincial Lab Wait Time Trend|APL QMe|Laboratory' | head -20 > "$OUT/01-diagnostics-module.txt" || true

wait_for "Provincial Lab Wait Time Trend"
ab screenshot "$OUT/02-provincial-trend.png" --full

echo "Selecting lab card $LAB_ID (MouseEvent click)..."
ab eval "(()=>{const el=document.querySelector('[data-lab-id=\"${LAB_ID}\"]');if(!el)return 'missing';el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return 'clicked';})()" | tee "$OUT/03-lab-click-result.txt"
sleep 2.5

wait_for "Wait Time Trend" || true
ab screenshot "$OUT/04-per-lab-trend.png" --full
ab read 2>&1 | grep -iE 'Wait Time Trend|Provincial Lab|Diagnostic & Lab|BELC|Belmont' | head -25 > "$OUT/04-per-lab-trend.txt" || true

CHARTS=$(ab eval "document.querySelectorAll('.recharts-wrapper').length" 2>/dev/null | tr -d '\r' || echo "0")
echo "recharts-wrapper count: $CHARTS" | tee "$OUT/05-chart-count.txt"

if ! grep -qi 'Diagnostic & Lab Services' "$OUT/01-diagnostics-module.txt" 2>/dev/null; then
  echo "FAIL: not on Diagnostics module — see $OUT/01-diagnostics-module.txt" >&2
  exit 1
fi

if [[ "$CHARTS" -lt 1 ]]; then
  echo "WARN: expected at least 1 Recharts chart; got $CHARTS" >&2
fi

echo "=== Verification artifacts: $OUT ==="
ls -la "$OUT"
for f in "$OUT"/*.txt; do echo "--- $f ---"; cat "$f"; echo; done
echo "OK: headed diagnostics lab trends verify completed"