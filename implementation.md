# Plan: 30-Minute Diagnostic & Lab Services Updates

## Research Summary

The Diagnostic & Lab dashboard (`src/components/DiagnosticDashboard.tsx`) draws from four distinct datasets in `data-diagnostic.json`:

| Dataset | Records | Current Source | Realistic Cadence | 30-min Possible? |
|---|---|---|---|---|
| `LAB_LOCATION_WAITS` | 52 APL sites | Hand-authored static snapshot | Static (claims "15 min") | **Yes — if QMe guest flow exposes wait times** |
| `IMAGING_WAIT_TRENDS` | CT/MRI P50/P90 | CIHI annual XLSX (2008-2025) | Daily poll | No — annual publication |
| `FACILITY_IMAGING_WAITS` | 12 facilities | Dead `waittimes.alberta.ca` + hand-authored | Static | No — source shut down Jan 2026 |
| `TEST_TURNAROUND_METRICS` | 16 tests | APL test directory + lab standards | Static/manual | No — no structured public feed |

Key findings:
- **No public API** exists for APL lab wait times. Alberta Precision Labs exposes the data only through the QMe booking tool.
- QMe lives at `https://qme.albertaprecisionlabs.ca/` (the old `mylabbooking.albertaprecisionlabs.ca` subdomain no longer resolves).
- QMe is a **Blazor Server SPA** using SignalR over WebSocket — there is no REST/HTTP GET endpoint returning wait times. `_framework/blazor.server.js` is present and `/api/*` routes return the SPA shell.
- The AHS wait-times JSON API (`/Webapps/WaitTimes/api/waittimes/en`) only covers Emergency/Urgent Care, not labs.
- QMe has a **"Book as Guest"** button and a stepper UI (`1. Location → 2. Date and Time → 3. Personal Details → 4. Summary`). The Location step has a zone selector and a map/list view, suggesting per-location estimated wait times may be reachable without login.
- The existing `powerbiScraper.ts` already uses the same pattern we need: headed Puppeteer, run as a child process via `execFileSync('npx', ['tsx', 'src/pipelines/powerbiScraper.ts'])`, because Puppeteer is ESM-only and the server bundles as CJS.

## Goal

Deliver a plan that enables **genuine updates at least every 30 minutes** for the only dataset that can support it (`LAB_LOCATION_WAITS`), while correcting the false "Every 15 minutes" label and setting honest cadences for the other three datasets.

## Plan

### Phase 0 — Feasibility Probe (1-2 hours)

Use a **headed Puppeteer probe** (the same tool the eventual scraper will use) to navigate QMe and answer one question: can a non-logged-in user reach per-location lab wait times?

1. Launch Puppeteer with the existing `CHROME_PATH` used by `powerbiScraper.ts`.
2. Navigate to `https://qme.albertaprecisionlabs.ca/`.
3. Wait for Blazor circuit initialization (network idle or DOM stable).
4. Click the **"Book as Guest"** flow.
5. Select the **"General Testing"** / **"Community Lab Locations"** path.
6. Interact with the **zone selector** (Edmonton, Calgary, Central, South, North).
7. Inspect the rendered location list for wait-time text (e.g., "Estimated wait: 25 min", "Wait time: 1 hr 15 min", or similar).
8. Document the DOM structure, class names, and interaction sequence needed to collect all 52 sites.

**Go/No-go decision:**
- **Go** — wait times are visible without credentials and the DOM is stable enough to scrape. Proceed to Phase 1.
- **No-go (login wall)** — automated 30-min polling is blocked. Pivot to the **Fallback** below (manual-entry CLI or credentialled scraper with explicit user-managed session).

### Phase 1 — Build `src/pipelines/aplQmeScraper.ts`

Create a new standalone scraper, modeled on `powerbiScraper.ts`, that runs as a child process.

1. **Module shape**
   - Export `run(): Promise<SyncResult>`.
   - CLI entry point `if (import.meta.url === \`file://${process.argv[1]}\`)` so `tsx src/pipelines/aplQmeScraper.ts` works standalone.
   - Use `puppeteer` with `headless: 'shell'` (or headed if Blazor requires it) and `CHROME_PATH`.

2. **Scrape flow**
   - Launch browser → `qme.albertaprecisionlabs.ca`.
   - Wait for the Blazor circuit (e.g., `document.querySelector('.k-step-link')` or a guest button).
   - Click "Book as Guest".
   - Select the lab-services path (likely "General Testing").
   - Iterate the five AHS zones in the location selector.
   - For each zone, wait for the location list, then extract each row's:
     - `name` (PSC/lab name)
     - `city` / `address` if shown
     - `waitTimeMin` (parse text like "25 min" or "1 hr 30 min" into minutes)
     - `walkInAvailable` / `appointmentRequired` / `saveMyPlaceAvailable` (badges or button text)
   - Map scraped names to the existing `LAB_LOCATION_WAITS` records by normalized name (add aliases as needed, e.g., "Fort Sask" → "Fort Saskatchewan").
   - Preserve static fields we cannot scrape (`latitude`, `longitude`, `address`, `code`, `dailyVolume`, `peakHours`).

3. **Output and merge**
   - Read `data-diagnostic.json`.
   - Merge new `waitTimeMin`, `saveMyPlaceAvailable`, `appointmentRequired`, `walkInAvailable` into `LAB_LOCATION_WAITS` only when scraped values are present.
   - Update `_dataMetadata.LAB_LOCATION_WAITS` with `lastUpdated`, `source`, `updateType: 'auto'`, `interval: 'every 30 minutes'`.
   - Write the file atomically.
   - Return `SyncResult` with `domain: 'diagnostic'`, `pipeline: 'aplQmeScraper'`, `status: 'success'`, and `recordsWritten`.

4. **Defensive behavior**
   - If QMe returns an error, CAPTCHA, or login wall, return `status: 'skipped'` with a descriptive error, preserving existing data.
   - Add a short wait between zone interactions so we don't hammer the SignalR circuit.
   - Cap the scrape at 60 seconds per zone.

### Phase 2 — Wire into `src/pipelines/scheduler.ts`

Add a 30-minute interval alongside the existing 10-minute ER interval.

**Important:** `aplQmeScraper.ts` uses Puppeteer, which is ESM-only, while the server bundles as CJS. Therefore the scheduler **cannot directly import** the scraper. It must spawn it as a child process, exactly like `orchestrator.ts` does for `powerbiScraper.ts`.

1. Do not import `aplQmeScraper` directly. Instead, add a helper that runs it as a child process:
   ```ts
   import { execFileSync } from 'child_process';
   import type { SyncResult } from './types';

   function spawnAplQmeScraper(): SyncResult {
     const stdout = execFileSync('npx', ['tsx', 'src/pipelines/aplQmeScraper.ts'], {
       cwd: process.cwd(),
       timeout: 120000,
       encoding: 'utf-8',
     });

     // The scraper prints the JSON SyncResult as the last line of stdout.
     const lines = stdout.trim().split('\n');
     const lastLine = lines[lines.length - 1];
     return JSON.parse(lastLine) as SyncResult;
   }
   ```

2. Add a new scheduler function:
   ```ts
   async function runAplQmeScraper(): Promise<void> {
     const result = spawnAplQmeScraper();
     recordLabWaitsUpdate(result); // see Phase 3
     if (result.status === 'success') {
       const { pushToCloudflare } = await import('./pushClient');
       const fs = await import('fs');
       const diagnosticFile = path.join(process.cwd(), 'data-diagnostic.json');
       const data = JSON.parse(fs.readFileSync(diagnosticFile, 'utf8'));
       await pushToCloudflare('diagnostic', data);
     }
   }
   ```
3. Add a `labIntervalId` and schedule it every 30 minutes:
   ```ts
   labIntervalId = setInterval(() => {
     runAplQmeScraper().catch(err => console.error('[Scheduler] APL QMe scraper error:', err));
   }, 30 * 60 * 1000);
   ```
4. Update `stopScheduler()` to clear `labIntervalId`.
5. Update the startup log: `ER wait times: every 10 min. APL lab waits: every 30 min. Daily sync: every 24 hr.`
6. Run an initial non-blocking scrape after server startup so the first 30-min tick is not delayed.

### Phase 3 — Update Sync Status Tracking

Extend `src/pipelines/syncStatus.ts` to track the new cadence.

1. Add fields to `SyncStatus`:
   ```ts
   labWaitsLastUpdate: string | null;
   labWaitsNextUpdate: string | null;
   ```
2. Add `recordLabWaitsUpdate(result: SyncResult)` that sets `labWaitsLastUpdate` and `labWaitsNextUpdate = now + 30 min`, similar to `recordErWaitTimesUpdate`.
3. Ensure `recordDailySyncResults` keeps the ER and lab-waits results when it replaces the daily results array.

### Phase 4 — Correct Frontend Labels and Metadata

Update the dashboard to reflect the real cadence of each dataset.

1. `src/App.tsx` DASHBOARDS entry for `diagnostics`:
   - Change `updateFrequency: 'Every 15 minutes'` → `updateFrequency: 'Lab waits every 30 min; imaging annually'`.
2. `src/App.tsx` `DASHBOARD_METADATA['diagnostics']`:
   - Change `interval: 'every 24 hours'` → `interval: 'lab waits every 30 min; imaging & turnaround static'`.
   - Update `source` to distinguish the two sources: e.g., `'APL QMe lab waits (auto); CIHI imaging (annual); curated turnaround metrics'`.
3. `DiagnosticDashboard.tsx`:
   - Add a `DataTimestamp` for `IMAGING_WAIT_TRENDS` with an honest label.
   - Ensure `LAB_LOCATION_WAITS` timestamp is shown on the Laboratory Waits subtab.
   - Add user-facing text explaining that lab waits are refreshed every 30 minutes while imaging/turnaround are updated less frequently.

### Phase 5 — Push to Cloudflare KV

1. In `src/pipelines/scheduler.ts`, after each successful 30-min scrape, push the full `data-diagnostic.json` to KV domain `diagnostic` using `pushToCloudflare`.
2. After the push, also push updated `sync-status` to KV so the dashboard shows the correct `labWaitsLastUpdate` / `labWaitsNextUpdate`.

### Phase 6 — Verification

1. Run the scraper standalone: `npx tsx src/pipelines/aplQmeScraper.ts`. Confirm it produces a valid `SyncResult` and updates `data-diagnostic.json` without corrupting other arrays.
2. Start the server locally (`npm run dev`) and verify the scheduler fires the scraper on the 30-minute interval.
3. Check `/api/sync/status` includes `labWaitsLastUpdate` and `labWaitsNextUpdate`.
4. Load the Diagnostic dashboard in a browser. Confirm:
   - Laboratory Waits subtab shows updated timestamps and the new cadence label.
   - Imaging/turnaround subtabs show honest static/annual labels.
   - No console errors.
5. Run `npx tsc --noEmit` to confirm type safety.

## Fallback (if QMe requires login)

If Phase 0 discovers that per-location wait times are behind a login wall:

1. **Short-term:** Build a lightweight manual-entry CLI (`scripts/update-lab-waits.ts`) that reads a user-provided JSON snippet and merges it into `LAB_LOCATION_WAITS`. This still lets the user achieve 30-minute updates if they manually collect the data.
2. **Medium-term:** If the user has legitimate APL credentials (e.g., a healthcare provider account), build a **credentialled scraper** that:
   - Stores a username/password or session cookie in `.env` (never committed).
   - Logs in via Puppeteer, scrapes the authenticated location list, and logs out.
   - Clearly marks the data source as "APL QMe (authenticated)" in `_dataMetadata`.
3. **Label correction:** Even if automated scraping is impossible, implement Phase 4 immediately to fix the false "Every 15 minutes" label.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| QMe rate-limits or blocks headless Chrome | Run at 30 min (not 10 min), add polite waits between zone clicks, use a single browser session per scrape, and fall back to `skipped` on HTTP 403/429. |
| Blazor DOM changes break selector | Keep selectors loose (text-based), and add a `Phase 0` probe that runs before every scrape to detect structural changes. |
| Scraping violates APL Terms of Use | Scrape only the **guest-facing, publicly visible** wait-time text; do not submit bookings or personal data. If login is required, stop and use the fallback. |
| Puppeteer child process adds memory/CPU cost | Reuse the same `powerbiScraper.ts` pattern: launch, scrape, close, exit. The process runs once every 30 minutes, so cost is minimal. |
| 52 static sites change (new PSC opens, closes) | Add a reconciliation step that reports any unmatched scraped names in the `SyncResult.error` field so they can be added to the static location list. |

## Files to Touch

- `src/pipelines/aplQmeScraper.ts` — new
- `src/pipelines/scheduler.ts` — add 30-min interval and lab-waits push
- `src/pipelines/syncStatus.ts` — add lab-waits timestamp fields and helper
- `src/pipelines/types.ts` — no change needed (SyncResult shape is sufficient)
- `src/App.tsx` — correct `updateFrequency` and `DASHBOARD_METADATA['diagnostics']`
- `src/components/DiagnosticDashboard.tsx` — add honest cadence labels and timestamps
- `data-diagnostic.json` — updated by the scraper (metadata + `LAB_LOCATION_WAITS`)
- `data-sync-status.json` — updated by the new sync-status helper

## Success Criteria

- [ ] Phase 0 confirms QMe guest flow exposes per-location wait times without login.
- [ ] `aplQmeScraper.ts` runs standalone and returns a valid `SyncResult`.
- [ ] `LAB_LOCATION_WAITS` updates automatically every 30 minutes with fresh `waitTimeMin` values.
- [ ] Scheduler pushes `diagnostic` domain to Cloudflare KV after every successful scrape.
- [ ] Sync status exposes `labWaitsLastUpdate` / `labWaitsNextUpdate`.
- [ ] App.tsx no longer claims the whole Diagnostic tab updates every 15 minutes.
- [ ] `npx tsc --noEmit` passes.
- [ ] Browser verification shows correct timestamps and no errors.
