# External synthetic monitoring runbook

Last known state: 2026-07-23.

## Why external monitoring is required

The local Mac mini collector and local uptime agent share the same power and
network failure domain.  If the Mac sleeps, loses power, or loses network, the
local uptime checks cannot alert anyone.  An **off-Mac** monitor is therefore a
P0 requirement for reliable outage notification.

## What must be monitored

Run two checks at a cadence of your choosing (e.g. every 1–5 minutes):

1. **Pages/site availability**
   - Target the public Pages URL or Worker URL.
   - Requirement: HTTP 200 and a recognizable body marker (e.g. page title or
     `text/html` content).  A status-code-only check is insufficient if the
     edge returns a generic 200 for a stale or empty site.

2. **`/api/health` JSON semantics**
   - Target `https://<your-domain>/api/health`.
   - Must assert **all** of the following:
     - HTTP 200
     - Response body parses as JSON
     - `status !== "down"`
     - `criticalIssues` is empty
     - `bannerMessage` is null
   - Why: `server.ts` intentionally returns HTTP 200 even when the backend is
     unhealthy, so a status-code-only check would miss failures.

## Recommended triggers

Alert when either check fails for more than one consecutive probe.  The local
monitor (`scripts/run-uptime-check.sh`) writes per-endpoint
`logs/monitor-state-<id>.json` files and uses a 30-minute dedupe window.
An external monitor should have its own separate state and not depend on local
files.

## Provider-neutral requirements

Any provider can satisfy the above if it supports:

- Request interval (e.g. 60–300 seconds).
- Custom HTTP headers (`Accept: application/json`).
- JSON response assertions or body regex checks.
- Retry count before alerting.
- Webhook or email notification endpoint (e.g. Discord/Slack/Pushover).

## Vendor guidance

Because the user has chosen provider-neutral documentation, this runbook does
not configure a specific service.  Vendors that meet the above include
Better Stack, UptimeRobot, Pingdom, Datadog Synthetics, Checkly, and Grafana
Cloud k6/synthetic monitoring.

## Activation

This is a user-owned manual step.  Once a provider is chosen:

1. Create two checks with the targets and assertions above.
2. Point notifications at a channel you will actually see immediately.
3. Test the alert by temporarily stopping `dist/server.cjs` or blocking the
   Worker URL, then confirm the probe fires and the notification is delivered.
4. Record the provider name and check IDs in `.env` or `ops/runbooks/` for the
   next operator.

## Manual fallback

You can perform a manual off-Mac check from any other machine:

```bash
curl -fsS https://<your-domain>/api/health | \
  python3 -c 'import json,sys; h=json.load(sys.stdin); print(h["status"], len(h.get("criticalIssues",[])), h.get("bannerMessage"))'
```
