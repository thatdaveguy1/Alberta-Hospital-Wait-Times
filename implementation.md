# Plan: Make Hospital System Flow Data Auto-Update Daily

## Executive Summary

The daily pipeline is already running, but the **System Flow dashboard still shows "Manual Update"** because the frontend reads bundled static data from `src/systemFlowData.ts` instead of the live `data-system-flow.json` that the scraper updates every night. Two other reliability gaps make the dashboard look broken: `data-system-flow.json` has no `_dataMetadata` block, and `data-sync-status.json` reports `"failed"` even though 23/31 pipelines succeed because the rollup counts `status: "manual"` as failures.

This plan fixes the root causes and decouples the heavy daily orchestrator from the long-lived Express server so a Puppeteer/CIHI crash cannot take the site down.

## Current State (verified 2026-07-07)

| Check | Result |
|---|---|
| launchd server job loaded | ✅ `com.alberta-hospital-wait-times` running, pid 72435 |
| Express server on port 3004 | ✅ up |
| Daily orchestrator ran today | ✅ `Jul 7 00:05:16` — 22 success, 0 skipped, 0 failed |
| `data-system-flow.json` touched today | ✅ `Jul 7 00:05:13` |
| Dashboard reads live JSON | ❌ imports static `systemFlowData.ts` |
| `data-system-flow.json` has `_dataMetadata` | ❌ absent |
| Sync status rollup handles `"manual"` | ❌ falls through to `"failed"` |
| launchd has calendar trigger | ❌ only `RunAtLoad` + `KeepAlive` |

## Root Cause

1. **Frontend is bundled with hand-authored data.** `SystemFlowDashboard.tsx` imports `FACILITY_FLOW_METRICS`, `AHS_WEEKLY_ED_LOS`, `CIHI_COMPARATORS`, `REGIONAL_LGA_DEMAND`, `HISTORICAL_FLOW_TIMELINES` from `../systemFlowData`. That file's `_dataMetadata` hard-codes `updateType: 'manual'`, so the badge is correct for the bundled data but misleading for the live JSON.
2. **Live JSON lacks metadata.** `acuteCareScraper.ts`, `ahsWeeklyEdLosScraper.ts`, and `cihiMhSafetyFetcher.ts` all read-modify-write `data-system-flow.json`, but none writes `_dataMetadata`.
3. **Sync status rollup bug.** `recordDailySyncResults()` treats `status: 'manual'` as a failure because the status is neither `success`, `failed`, `partial`, nor `skipped`.
4. **Daily sync is tied to the server process.** `scheduler.ts` runs the daily orchestrator via `setInterval(24h)`, which drifts and resets on every restart; the existing launchd plist only keeps the server alive, it does not calendar-schedule the heavy daily work.

## Phases

### Phase 1 — Convert SystemFlowDashboard to fetch from the API

**Target:** `src/components/SystemFlowDashboard.tsx`

1. Remove static imports of the five data arrays from `../systemFlowData`; keep only the **type** imports.
2. Add state and `useEffect` mirroring `PrimaryCareDashboard.tsx`:
   ```ts
   const [systemFlowData, setSystemFlowData] = useState<{
     FACILITY_FLOW_METRICS: FacilityFlow[];
     AHS_WEEKLY_ED_LOS: WeeklyEDLOS[];
     CIHI_COMPARATORS: CIHIComparator[];
     REGIONAL_LGA_DEMAND: LGADemand[];
     HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[];
     CIHI_OCCUPANCY_RATES?: any[];
     CIHI_ED_WAIT_INITIAL_ASSESSMENT?: any[];
     _dataMetadata?: DataMetadataMap;
   } | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   ```
3. Fetch `/api/data/system-flow` on mount and on manual refresh.
4. Replace every static array reference with `systemFlowData?.ARRAY ?? []`.
5. Add null guards at the start of every `useMemo` that accesses properties of a `.find()` or array-index result (per `lessons.md` useMemo crash lesson).
6. Add loading and error states.
7. Pass `systemFlowData?._dataMetadata` to `DataTimestamp` instead of the static `systemFlowDataMetadata`.

**Guard rails:** do not change visual layout, sub-tabs, or chart styling. Only change the data source and add null guards.

**Acceptance:**
- `npx tsc --noEmit` passes.
- Network tab shows `GET /api/data/system-flow` returning JSON.
- Dashboard renders without console errors.
- Refreshing after a pipeline run shows a new `lastUpdated` timestamp.

---

### Phase 2 — Write `_dataMetadata` into `data-system-flow.json`

**Targets:** `src/pipelines/acuteCareScraper.ts`, `src/pipelines/ahsWeeklyEdLosScraper.ts`, `src/pipelines/cihiMhSafetyFetcher.ts`

Each writer already does read-modify-write on `data-system-flow.json`. They must preserve the existing `_dataMetadata` object and only update the keys they own.

1. **Shared helper** (new file `src/pipelines/metadataHelpers.ts` or inline in each file):
   ```ts
   function buildMetadata(existing: DataMetadataMap | undefined, key: string, patch: Partial<ArrayMetadata>): DataMetadataMap {
     const now = new Date().toISOString();
     return { ...existing, [key]: { source, sourceVintage, lastUpdated: now, updateType: 'auto', verification, ...patch } };
   }
   ```
2. **`acuteCareScraper.ts`** owns:
   - `FACILITY_FLOW_METRICS` (live facility list + hand-authored analytical metrics)
   - `CIHI_COMPARATORS` (derived from diagnostic/cancer files)
   - `REGIONAL_LGA_DEMAND` (derived from regional-inequity file)
   - `HISTORICAL_FLOW_TIMELINES` (preserved from `systemFlowData.ts` fallback)
   Use honest metadata: hand-authored/derived parts should say so, but `updateType: 'auto'` because the file is refreshed daily by the scraper.
3. **`ahsWeeklyEdLosScraper.ts`** owns:
   - `AHS_WEEKLY_ED_LOS` (parsed from AHS PDFs)
4. **`cihiMhSafetyFetcher.ts`** owns:
   - `CIHI_OCCUPANCY_RATES`
   - `CIHI_ED_WAIT_INITIAL_ASSESSMENT`
5. Each writer must load the existing `_dataMetadata`, merge only its own keys, and write the merged object back. No writer may replace the whole `_dataMetadata` block.

**Acceptance:**
- After `npm run pipeline`, `data-system-flow.json` contains a top-level `_dataMetadata` object with entries for all arrays.
- Each entry has `updateType: 'auto'` and a fresh `lastUpdated` ISO timestamp.
- Re-running individual pipelines does not erase metadata written by the other pipelines.

---

### Phase 3 — Fix sync status rollup for `"manual"` pipelines

**Target:** `src/pipelines/syncStatus.ts`

1. In `recordDailySyncResults()`, update the status logic:
   ```ts
   const allSuccess = results.every(r => r.status === 'success');
   const anyFailed = results.some(r => r.status === 'failed');
   const anyPartial = results.some(r => r.status === 'partial');
   const anySkipped = results.some(r => r.status === 'skipped');
   const anyManual = results.some(r => r.status === 'manual');
   const anySuccess = results.some(r => r.status === 'success');

   if (allSuccess) {
     currentStatus.status = 'success';
   } else if (anyFailed) {
     currentStatus.status = anySuccess ? 'partial_success' : 'failed';
   } else if (anyPartial || anySkipped || anyManual) {
     currentStatus.status = anySuccess ? 'partial_success' : 'manual';
   } else {
     currentStatus.status = 'failed';
   }
   ```
   Optional: add `'manual'` to the `SyncStatus['status']` union in `src/pipelines/types.ts` if it does not already exist.

**Acceptance:**
- After running a daily sync that returns 9 `manual` and 22 `success`, `data-sync-status.json` shows `status: 'partial_success'`, not `failed`.

---

### Phase 4 — Create a standalone daily-sync script

**Target:** new file `src/pipelines/dailySync.ts` + `package.json`

The server-side `runDailySync()` currently does more than the orchestrator: it runs the disruptions scraper, the full orchestrator, pushes every domain to KV, and writes/pushes `data-sync-status.json`. A launchd one-shot must replicate this entire flow.

1. Extract or replicate the `runDailySync()` logic into a standalone CLI module `src/pipelines/dailySync.ts`:
   - `await scrapeDisruptions()`
   - Push `disruptions` to KV
   - `await runAllPipelines()`
   - `recordDailySyncResults(results)`
   - Push `sync-status` to KV
2. Add `npm run daily-sync` to `package.json`:
   ```json
   "daily-sync": "tsx src/pipelines/dailySync.ts"
   ```
3. Ensure the script loads `dotenv/config` so `PUSH_SECRET` and `CLOUDFLARE_WORKER_URL` are available.

**Guard rails:** on any error, log and exit non-zero so launchd can retry; but one pipeline failure must not stop the others.

**Acceptance:**
- `npm run daily-sync` runs end-to-end from a clean terminal, writes fresh `data-sync-status.json`, and pushes updates to KV.
- It does not require the Express server to be running.

---

### Phase 5 — Calendar-schedule the daily sync with a second launchd plist

**Target:** new file `~/Library/LaunchAgents/com.alberta-hospital-pipeline-daily.plist`

1. Create a new LaunchAgent that runs once a day at 06:00 America/Edmonton, independent of the server:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" ...>
   <plist version="1.0">
   <dict>
     <key>Label</key><string>com.alberta-hospital-pipeline-daily</string>
     <key>WorkingDirectory</key><string>${HOME}/Antigravity/AlbertaHospitals</string>
     <key>EnvironmentVariables</key>
     <dict>
       <key>PATH</key><string>${HOME}/.local/bin:${HOME}/.local/lib/nodejs/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
       <key>HOME</key><string>${HOME}</string>
       <key>NODE_ENV</key><string>production</string>
       <key>PUSH_SECRET</key><string>alberta-hospital-push-ee4cc87ed9b09893850ee696aeae752cca9a735ce93bfe43</string>
       <key>CLOUDFLARE_WORKER_URL</key><string>https://alberta-hospital-wait-times.longmad.workers.dev</string>
     </dict>
     <key>ProgramArguments</key>
     <array>
       <string>${HOME}/.local/bin/node</string>
       <string>${HOME}/.local/lib/nodejs/bin/npm</string>
       <string>run</string>
       <string>daily-sync</string>
     </array>
     <key>StartCalendarInterval</key>
     <dict>
       <key>Hour</key><integer>6</integer>
       <key>Minute</key><integer>0</integer>
     </dict>
     <key>StandardOutPath</key><string>/tmp/alberta-hospital-daily-sync.log</string>
     <key>StandardErrorPath</key><string>/tmp/alberta-hospital-daily-sync.err</string>
   </dict>
   </plist>
   ```
2. Load it:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.alberta-hospital-pipeline-daily.plist
   ```
3. Optionally start it once manually to verify:
   ```bash
   launchctl start com.alberta-hospital-pipeline-daily
   ```

**Acceptance:**
- `launchctl list | grep alberta-hospital-pipeline-daily` shows the job.
- After 06:00 MT, `/tmp/alberta-hospital-daily-sync.log` shows a completed run.

---

### Phase 6 — Remove the daily orchestrator from the server's `setInterval`

**Target:** `src/pipelines/scheduler.ts`

1. Remove the daily `setInterval` (24h) that calls `runDailySync()`.
2. Keep the ER wait times 10-min interval and the lab waits 30-min interval.
3. Keep the initial non-blocking `runDailySync()` on server startup only if desired as a warm-up; otherwise remove it entirely.
4. Keep `triggerDailySync()` (POST `/api/sync/trigger`) for manual on-demand runs, but have it call the same standalone logic or import from `dailySync.ts`.
5. Update the startup log to: `"ER wait times: every 10 min. Lab waits: every 30 min."`.

**Acceptance:**
- Server startup log no longer mentions a 24-hour scheduled daily sync.
- `setInterval` calls remain only for ER and lab.

---

### Phase 7 — Update cadence labels in `App.tsx`

**Target:** `src/App.tsx` DASHBOARDS config for `'system-flow'`

1. Change:
   ```ts
   'system-flow': {
     updateType: 'auto',
     interval: 'Daily at 06:00 MT',
     sourceVintage: 'Auto-refreshed daily',
     source: 'HQA FOCUS & AHS Weekly reports'
   }
   ```

**Acceptance:**
- The System Flow tab's badge/label says it updates daily.

---

### Phase 8 — Verify end-to-end

1. `npx tsc --noEmit` — zero errors.
2. `npm run build` — produces a fresh `dist/` with the fetch-based dashboard.
3. `npm run daily-sync` — completes, writes `data-sync-status.json` with `status: 'partial_success'` or `success`, and updates `data-system-flow.json` `_dataMetadata`.
4. Start the server (`npm run dev` or `npm start`), open the System Flow tab, confirm:
   - Network tab shows `GET /api/data/system-flow`.
   - `DataTimestamp` shows an **Auto** badge with today's timestamp.
   - No console errors.
5. Load the new launchd plist and confirm the next 06:00 run produces a log file.
6. (Optional) Deploy the new frontend build to Cloudflare Pages so the published site also reads live data.

## Files Touched

| Action | Files |
|---|---|
| Edit | `src/components/SystemFlowDashboard.tsx` |
| Edit | `src/pipelines/acuteCareScraper.ts` |
| Edit | `src/pipelines/ahsWeeklyEdLosScraper.ts` |
| Edit | `src/pipelines/cihiMhSafetyFetcher.ts` |
| Edit | `src/pipelines/syncStatus.ts` |
| Edit | `src/pipelines/scheduler.ts` |
| Edit | `src/App.tsx` |
| New | `src/pipelines/dailySync.ts` |
| Edit | `package.json` (add `daily-sync` script) |
| New | `~/Library/LaunchAgents/com.alberta-hospital-pipeline-daily.plist` |
| Edit | `lessons.md` (record the static-import + metadata + manual-status pitfalls) |
| Edit | `tasks/todo.md` (track Phase 23) |

## Risks & Decisions

- **Data shape mismatch:** If `SystemFlowDashboard` uses arrays not present in `data-system-flow.json`, the fetch handler will return empty arrays. Audit every used array before converting.
- **Hand-authored vs. auto metadata:** The facility-level flow metrics are still partly analytical estimates. The metadata should say "Auto-merged daily; facility list from AHS API, metrics from HQA FOCUS estimates" so the badge is honest.
- **KV domain `er-trends`/`lab-trends` 404:** These are already failing today (see `/tmp/alberta-hospital-wait-times.err`). Not in scope for this plan, but the one-shot script should either fix or skip them to avoid log spam.
- **Server in-memory sync status:** After the standalone `daily-sync` writes `data-sync-status.json`, the running server's `/api/sync/status` endpoint will serve stale in-memory status until restart. If the sync-status panel is user-facing, add a `loadSyncStatusFromDisk()` call inside the `/api/sync/status` handler or have the server watch the file. Note this in the plan if needed.
