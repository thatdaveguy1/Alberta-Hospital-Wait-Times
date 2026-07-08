#!/usr/bin/env bash
# Headed visual verification: set location T8N7W7 (or T8N 7W7), contributions on-page, Public Health wastewater, Health Inequity compare.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="${ROOT}/screenshots/headed-verify-$(date +%Y%m%d)"
mkdir -p "$OUT"

export PATH="${HOME}/.local/lib/nodejs/bin:${HOME}/.local/bin:/opt/homebrew/bin:$PATH"
export BROWSER_HEADED=1
export AGENT_BROWSER_HEADED=1
export AGENT_BROWSER_SESSION=headed-audit-verify

BASE_URL="${AUDIT_BASE_URL:-http://127.0.0.1:3004/}"

ab() { agent-browser "$@"; }

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
  CM=$(pick_ref 'button "Change Module"')
  if [[ -n "$CM" ]]; then
    ab click "@$CM"
  else
    ab click "text=Change Module"
  fi
  sleep 1.5
}

echo "Opening $BASE_URL (headed)..."
ab open "$BASE_URL"
sleep 3
ab eval "window.resizeTo(1400, 900);" || true
sleep 1

echo "Setting location to T8N 7W7 (St. Albert)..."
ab eval "localStorage.setItem('alberta_hospital_user_location', JSON.stringify({lat:53.6303,lng:-113.6287,city:'St. Albert',region:'Alberta',isGPS:false})); localStorage.setItem('alberta_hospital_location_prompt_dismissed','1'); location.reload();" || true
sleep 5

if ab snapshot -i 2>&1 | grep -q "Set Your Location"; then
  INREF=$(ab snapshot -i 2>&1 | grep -F 'postal code' | sed -n 's/.*\[ref=\(e[0-9]*\)\].*/\1/p' | head -1)
  if [[ -n "$INREF" ]]; then
    ab fill "@$INREF" "T8N 7W7" || true
    sleep 0.5
    ab eval '(()=>{const b=[...document.querySelectorAll("button")].find(x=>(x.textContent||"").trim()==="Set Location"&&!x.disabled);if(b){b.click();return true;}return false;})()' || true
    sleep 3
  fi
fi

ab screenshot "$OUT/00-after-location.png" --full
ab read 2>&1 | grep -iE 'St\.? Albert|Sturgeon|T8N|Location|GPS|Manual' | head -15 > "$OUT/00-after-location.txt" || true

# --- Contributions: always on-page (not a modal) ---
echo "Contributions section (#contributions)..."
ab eval "document.getElementById('contributions')?.scrollIntoView({ behavior: 'instant', block: 'start' });" || true
sleep 1.5
ab screenshot "$OUT/03-contributions-visible.png" --full
ab read 2>&1 | grep -iE 'Help keep this dashboard alive|Ways you can contribute|Copy dashboard link|Share on Reddit|Star on GitHub|Report a bug|Contribute' | head -20 > "$OUT/03-contributions-visible.txt" || true
if ! grep -qi 'Help keep this dashboard alive' "$OUT/03-contributions-visible.txt" 2>/dev/null; then
  echo "FAIL: contributions section not found in page text — rebuild dist and restart server on $BASE_URL" >&2
  exit 1
fi

# --- Public Health > Wastewater Signals ---
echo "Public Health / Wastewater..."
open_modules
PH=$(pick_ref "Public Health Respiratory")
[[ -z "$PH" ]] && PH=$(pick_ref "Public Health")
[[ -n "$PH" ]] || { echo "Public Health tile ref missing"; ab snapshot -i >&2; exit 1; }
ab click "@$PH"
wait_for "Wastewater Signals"
ab click "@$(pick_ref 'WASTEWATER SIGNALS')"
sleep 2.5
ab screenshot "$OUT/01-public-health-wastewater.png" --full
ab read 2>&1 | grep -iE 'Wastewater early warning|Left axis|COVID|Public Health|Health Data Monitor|Emergency Department Monitor|×10' | head -20 > "$OUT/01-public-health-wastewater.txt" || true

# --- Health Inequity > Compare Matrix ---
echo "Health Inequity / Compare Matrix..."
open_modules
HI=$(pick_ref "Health Inequity")
[[ -n "$HI" ]] || { echo "Health Inequity tile ref missing"; ab snapshot -i >&2; exit 1; }
ab click "@$HI"
sleep 3
wait_for "Compare Matrix"
ab click "@$(pick_ref 'COMPARE MATRIX')"
sleep 2.5
ab screenshot "$OUT/02-health-inequity-compare.png" --full
ab read 2>&1 | grep -iE 'Compare Matrix|Interactive Health Equity|LGA Selection Navigator|Cycle of Disparity|Health Data Monitor|Emergency Department Monitor' | head -20 > "$OUT/02-health-inequity-compare.txt" || true

echo "=== Verification artifacts: $OUT ==="
ls -la "$OUT"
for f in "$OUT"/*.txt; do echo "--- $f ---"; cat "$f"; echo; done