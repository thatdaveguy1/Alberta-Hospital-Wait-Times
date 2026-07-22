# Alberta Hospital Wait Times Dashboard

Unofficial public dashboard for Alberta ER and lab waits, surgical queues, and related health-system indicators.

**Live site:** [alberta-hospital-wait-times.pages.dev](https://alberta-hospital-wait-times.pages.dev)

Not affiliated with or endorsed by Alberta Health Services. For emergencies, call 911.

## Modules

| Module | Cadence |
|--------|---------|
| ER Wait Times | ~every 10 minutes |
| Service Disruptions | Daily scrape |
| Surgical Waitlists | Monthly / release-driven |
| Diagnostic Imaging + Labs | Labs ~every 10 minutes; imaging annual/manual |
| Primary Care Access | Directory daily; CIHI/HQCA annual |
| Public Health & Outbreaks | Weekly |
| Regional Health Inequity | Annual |
| Health Spending & Productivity | Annual |

## Recent Changes

- **2026-07-22 — Urgent Care tab:** primary nav is ER Waits | Urgent Care | Diagnostics & Labs; UC sites (5 feed-backed Calgary-area centres) use the shared wait dashboard with `scope`. Pages production deploys must use `--branch test`.
- **2026-07-21 — GitHub hygiene:** scrubbed local LAN IP / home-path identifiers from tracked files; Nominatim User-Agent points at this repo instead of a personal email.
- **2026-07 — ER & Labs UX:** prefetch/warm cache for smoother page transitions; lab freshness stamps; 10-minute lab polling aligned with ER; drive+wait headline; outside-AB location handling; Diagnostics & Labs promoted next to ER in the top bar.
- **2026-07-09 — Diagnostics & Lab fix:** live lab stats cards compute real averages; `LabCard` badges show `Walk-In`, `Closed`, or `Appt Req`; shared manual location modal; sanitized `DataTimestamp` sources across diagnostics subtabs (`Laboratory Waits`, `Imaging Gaps`, `Diagnostic Sites`, `Lab Turnaround`).

## Architecture

- **Frontend:** React 19 + Vite + TailwindCSS + Recharts + Leaflet
  - Interactive overview metric cards toggle historical trend panels (`AreaChart` / `LineChart`) where trend data exists
  - Diagnostics & Labs includes a provincial lab-wait trend chart and per-lab trend panels on site selection
- **Backend:** Express server (`server.ts`) with 28 pipeline modules under `src/pipelines/` that fetch, scrape, and parse provincial/federal sources
- **Read layer:** Cloudflare Worker (`cloudflare/worker.ts`) serving from KV, deployed with the frontend on Cloudflare Pages via a Pages Function proxy (`functions/api/[[path]].js`)
- **Scheduling:** Local launchd jobs run fast ER/lab cycles (~10 min) and a daily orchestrator; pipelines push updates to Cloudflare KV via HMAC-signed requests

## Data Sources

AHS, CIHI, HQCA, StatsCan, Open Alberta, PHAC, Alberta Health, CPSA, Fraser Institute, 211 Alberta, Alberta Find a Provider, Alberta Respiratory Virus Dashboard, Alberta Substance Use Surveillance, APL QMe.

## Run Locally

**Prerequisites:** Node.js 20+, Python 3 (CIHI workbook extraction), `pdftotext` (poppler), Google Chrome (Power BI scraper).

```bash
npm install
npm run dev          # Express + Vite on port 3004
```

## Build

```bash
npm run build        # Vite frontend + esbuild server → dist/server.cjs
npm start            # run the built server
```

## Deploy

```bash
npm run deploy:worker   # Cloudflare Worker
npm run deploy:pages    # frontend → Cloudflare Pages (branch test = production)
npm run seed:kv         # seed KV namespaces
```

## Environment Variables

See `.env.example`:

- `PUSH_SECRET` — HMAC secret for signing push requests (`npm run gen:push-secret`)
- `CLOUDFLARE_WORKER_URL` — URL of the deployed Worker

## Pipeline Operations

```bash
npm run pipeline        # full orchestrator (all pipelines)
npm run daily-sync      # standalone daily sync job
npm run push:all        # push all data files to Cloudflare KV
```

## Project Structure

```
src/
  components/     Dashboard modules + shared UI (ER, labs, maps, headers, …)
  pipelines/      28 fetchers/scrapers/downloaders + orchestrator/scheduler
  hooks/          useDomainData, useSyncStatus, useTheme
  lib/            dashboardRegistry, geo, prefetch, wait helpers
  *Data.ts        TypeScript interfaces per domain
server.ts         Express API server
cloudflare/       Worker + wrangler config
functions/api/    Pages Function proxy to Worker
scripts/          Headed audit helpers + data extraction utilities
data-*.json       Runtime on disk + KV (gitignored except disruption-overrides + zone-by-city)
```
