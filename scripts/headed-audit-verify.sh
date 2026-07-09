#!/usr/bin/env bash
# Headed visual verification: T8N7W7 location, on-page contributions, Public Health wastewater, Health Inequity compare.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="${ROOT}/screenshots/headed-verify-$(date +%Y%m%d)"
mkdir -p "$OUT"

export PATH="${HOME}/.local/lib/nodejs/bin:${HOME}/.local/bin:/opt/homebrew/bin:$PATH"
AB_SESSION="${AGENT_BROWSER_SESSION:-headed-audit-verify}"
BASE_URL="${AUDIT_BASE_URL:-http://127.0.0.1:3004/}"

# CLI needs explicit --headed + --session on every command (env alone is not enough for the daemon).
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
  for i in $(seq 1 20); do
    if ab snapshot -i 2>&1 | grep -qiF "$label"; then
      return 0
    fi
    sleep 0.5
  done
  echo "WARN: timed out waiting for: $label" >&2
  return 1
}

open_modules() {
  wait_for "Change Module"
  ab eval "window.scrollTo(0,0);" || true
  sleep 0.3
  ab eval '(()=>{const btn=[...document.querySelectorAll("button")].find(b=>(b.textContent||"").trim().endsWith("Change Module")||(b.textContent||"").includes("Change Module"));if(btn){btn.click();return true;}return false;})()' || ab click "text=Change Module"
  sleep 2.5
  wait_for "Search modules" || wait_for "Select a module" || wait_for "analytical dashboards" || true
}

select_module() {
  local needle="$1"
  local dashboard_id="${2:-}"
  if [[ -n "$dashboard_id" ]]; then
    if ab eval "(()=>{const b=document.querySelector('[data-dashboard-id="${dashboard_id}"]');if(b){b.click();return true;}return false;})()" 2>/dev/null | grep -q true; then
      return 0
    fi
  fi
  ab fill 'input[placeholder="Search modules..."]' "$needle" 2>/dev/null || true
  sleep 1
  local ref
  ref=$(pick_ref "$needle")
  if [[ -n "$ref" ]]; then
    ab click "@$ref"
    return 0
  fi
  ab click "text=$needle" 2>/dev/null && return 0
  ab eval "(()=>{const el=[...document.querySelectorAll('button[data-dashboard-id],button,h3')].find(n=>(n.textContent||'').includes('$needle'));if(el){el.click();return true;}return false;})()" || return 1
}

set_location_via_modal() {
  local postal="$1"
  ab fill "#manual-location-input" "$postal" 2>/dev/null || ab fill "input#manual-location-input" "$postal" || true
  sleep 0.5
  ab click "text=Set Location" 2>/dev/null || ab eval '(()=>{const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Set Location"&&!x.disabled);if(b){b.click();return true;}return false;})()' || true
  sleep 3
}

echo "Reset agent-browser sessions..."
agent-browser close --all 2>/dev/null || true
sleep 1

echo "Opening $BASE_URL (headed, session=$AB_SESSION)..."
ab open "$BASE_URL"
sleep 3
ab eval "window.resizeTo(1400, 900);" || true
sleep 1

echo "Setting location T8N7W7 (St. Albert) — localStorage + re-open (no location.reload in eval)..."
ab eval "localStorage.setItem('alberta_hospital_user_location', JSON.stringify({lat:53.6303,lng:-113.6287,city:'St. Albert',region:'Alberta',isGPS:false})); localStorage.setItem('alberta_hospital_location_prompt_dismissed','1');" || true
ab open "$BASE_URL"
sleep 5

if ab snapshot -i 2>&1 | grep -q "Set Your Location"; then
  echo "Location modal still visible — filling postal T8N7W7..."
  set_location_via_modal "T8N7W7"
fi

ab screenshot "$OUT/00-after-location.png" --full
ab read 2>&1 | grep -iE 'St\.? Albert|Sturgeon|T8N|Location|GPS|Manual' | head -15 > "$OUT/00-after-location.txt" || true
if ! grep -qi 'St. Albert' "$OUT/00-after-location.txt" 2>/dev/null; then
  echo "WARN: St. Albert not in location extract — check $OUT/00-after-location.txt" >&2
fi
echo "Contributions section (#contributions)..."
ab scrollintoview "#contributions" 2>/dev/null || ab eval "document.getElementById('contributions')?.scrollIntoView({ block: 'start' });" || true
sleep 1.5
ab screenshot "$OUT/03-contributions-visible.png" --full
ab read 2>&1 | grep -iE 'Help keep this dashboard alive|Ways you can contribute|Copy dashboard link|Share on Reddit|Star on GitHub|Report a bug|Contribute' | head -20 > "$OUT/03-contributions-visible.txt" || true
if ! grep -qi 'Help keep this dashboard alive' "$OUT/03-contributions-visible.txt" 2>/dev/null; then
  echo "FAIL: contributions section not found — run npm run build and serve fresh assets on $BASE_URL" >&2
  exit 1
fi

if [[ "${VERIFY_CONTRIBUTIONS_ONLY:-}" == "1" ]]; then
  echo "VERIFY_CONTRIBUTIONS_ONLY=1 — location + contributions OK; skipping module hops"
  echo "=== Verification artifacts: $OUT ==="
  ls -la "$OUT"
  exit 0
fi

echo "Public Health / Wastewater..."
open_modules
select_module "Public Health" || { echo "Public Health tile missing"; ab snapshot -i >&2; exit 1; }
sleep 3
wait_for "Wastewater"
WW=$(pick_ref 'WASTEWATER SIGNALS')
[[ -n "$WW" ]] && ab click "@$WW" || ab click "text=Wastewater Signals"
sleep 2.5
ab screenshot "$OUT/01-public-health-wastewater.png" --full
ab read 2>&1 | grep -iE 'Wastewater early warning|Left axis|COVID|Public Health|Health Data Monitor|Emergency Department Monitor|×10' | head -20 > "$OUT/01-public-health-wastewater.txt" || true

echo "Health Inequity / Compare Matrix..."
open_modules
select_module "Health Inequity" || select_module "Regional Health" || { echo "Health Inequity tile missing"; ab snapshot -i >&2; exit 1; }
sleep 3
wait_for "Compare Matrix"
CM=$(pick_ref 'COMPARE MATRIX')
[[ -n "$CM" ]] && ab click "@$CM" || ab click "text=Compare Matrix"
sleep 2.5
ab screenshot "$OUT/02-health-inequity-compare.png" --full
ab read 2>&1 | grep -iE 'Compare Matrix|Interactive Health Equity|LGA Selection Navigator|Cycle of Disparity|Health Data Monitor|Emergency Department Monitor' | head -20 > "$OUT/02-health-inequity-compare.txt" || true

echo "=== Verification artifacts: $OUT ==="
ls -la "$OUT"
for f in "$OUT"/*.txt; do echo "--- $f ---"; cat "$f"; echo; done
echo "OK: headed audit verify completed"
