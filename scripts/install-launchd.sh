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

if [[ -z "${PUSH_SECRET:-}" || -z "${CLOUDFLARE_WORKER_URL:-}" ]]; then
  echo "Error: .env must define PUSH_SECRET and CLOUDFLARE_WORKER_URL" >&2
  exit 1
fi

LABELS=(
  com.davemini.alberta-hospital-wait-times
  com.davemini.alberta-hospital-pipeline-daily
  com.davemini.alberta-hospital-uptime
)

DOMAIN="gui/$(id -u)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$AGENTS_DIR"

for plist in "$REPO_ROOT"/launchd/*.plist; do
  cp "$plist" "$AGENTS_DIR/"
  echo "Installed $(basename "$plist")"
done

for label in "${LABELS[@]}"; do
  launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
  # bootstrap can return I/O error (5) if the agent is mid-transition; retry once.
  if ! launchctl bootstrap "$DOMAIN" "$AGENTS_DIR/$label.plist" 2>/dev/null; then
    sleep 1
    launchctl bootout "$DOMAIN/$label" 2>/dev/null || true
    if ! launchctl bootstrap "$DOMAIN" "$AGENTS_DIR/$label.plist"; then
      # Already loaded is acceptable after a race.
      if launchctl print "$DOMAIN/$label" >/dev/null 2>&1; then
        echo "Warning: bootstrap raced for $label but agent is loaded" >&2
      else
        echo "Error: failed to bootstrap $label" >&2
        exit 1
      fi
    fi
  fi
  launchctl enable "$DOMAIN/$label" 2>/dev/null || true
done

for label in "${LABELS[@]}"; do
  echo "--- launchctl print $DOMAIN/$label ---"
  launchctl print "$DOMAIN/$label" 2>/dev/null | head -25
done

launchctl kickstart -k "$DOMAIN/com.davemini.alberta-hospital-wait-times"
launchctl kickstart -k "$DOMAIN/com.davemini.alberta-hospital-uptime"

echo "Done. Wait-times and uptime agents kickstarted."
