#!/usr/bin/env bash
# Headed visual re-audit: T8N 7W7 location + four remediated subtabs.
# Uses system Chrome via puppeteer (HEADED=1 opens a visible window).
set -euo pipefail
cd "$(dirname "$0")/.."
export HEADED=1
export REAUDIT_URL="${REAUDIT_URL:-http://127.0.0.1:3004/}"
exec node scripts/visual-reaudit-puppeteer.mjs