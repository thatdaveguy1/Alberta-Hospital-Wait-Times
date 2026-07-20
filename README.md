# Alberta Hospital Wait Times Dashboard

## Recent Changes

- **2026-07-09 — Diagnostics & Lab fix:** live lab stats cards now compute real averages; `LabCard` badges correctly show `Walk-In`, `Closed`, or `Appt Req` based on lab state; `Manual`/`Set Location` buttons open the shared manual location modal; `DataTimestamp` sources are sanitized across all four diagnostics subtabs (`Laboratory Waits`, `Imaging Gaps`, `Diagnostic Sites`, `Lab Turnaround`).


A 13-tab dashboard visualizing Alberta's healthcare system performance — ER wait times, surgical waits, diagnostic imaging, primary care, cancer, continuing care, public health, workforce, spending, patient experience, regional inequity, system flow, and service disruptions.

## Architecture

- **Frontend:** React 19 + Vite + TailwindCSS + Recharts + Leaflet
  - **Interactive Trends:** Dashboard overview metrics cards are clickable and keyboard-accessible, toggling dynamic `AnimatePresence`-wrapped historical trend panels (`AreaChart` and `LineChart`) directly below the cards grid where trend data is available. The Diagnostic & Lab Services tab also includes a provincial lab wait trend chart (30-min sampled snapshots) and per-lab trend panels on site selection.
- **Backend:** Express server (`server.ts`) with 28 data pipelines (`src/pipelines/`) that fetch, scrape, and parse data from provincial and federal sources
- **Read layer:** Cloudflare Worker (`cloudflare/worker.ts`) serving from KV, deployed alongside the frontend on Cloudflare Pages with a Pages Function proxy (`functions/api/[[path]].js`)
- **Scheduling:** Local launchd job runs the orchestrator on intervals; pipelines push updates to Cloudflare KV via HMAC-signed requests

## Data Sources

AHS, CIHI, HQCA, StatsCan, Open Alberta, PHAC, Alberta Health, CPSA, Fraser Institute, 211 Alberta, Alberta Find a Provider, Alberta Respiratory Virus Dashboard, Alberta Substance Use Surveillance.

## Run Locally

**Prerequisites:** Node.js 20+, Python 3 (for CIHI workbook extraction), `pdftotext` (poppler), Google Chrome (for Power BI scraper).

```bash
npm install
npm run dev          # starts Express server on port 3004
```

## Build

```bash
npm run build        # Vite build + esbuild server bundle
npm start            # run the built server
```

## Deploy

```bash
npm run deploy:worker   # deploy Cloudflare Worker
npm run deploy:pages    # deploy frontend to Cloudflare Pages
npm run seed:kv         # seed KV namespaces
```

## Environment Variables

See `.env.example`:
- `PUSH_SECRET` — HMAC secret for signing push requests (generate with `npm run gen:push-secret`)
- `CLOUDFLARE_WORKER_URL` — URL of the deployed Worker

## Pipeline Operations

```bash
npm run pipeline        # run the full orchestrator (all 28 pipelines)
npm run push:all        # push all data files to Cloudflare KV
```

## Project Structure

```
src/
  components/     15 dashboard components + shared UI
  pipelines/      28 data fetchers/scrapers/downloaders + orchestrator
  hooks/          useSyncStatus hook
  *Data.ts        TypeScript interfaces for each domain
server.ts         Express API server
cloudflare/       Worker + wrangler config
functions/api/    Pages Function proxy
scripts/          Python/TS data extraction helpers
data-*.json       Seed data files (refreshed by pipelines at runtime)
```
