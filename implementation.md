# Plan: Update Diagnostic & Lab Services Data Every 30 Minutes

## Situation

The user wants "Diagnostic & Lab Services" data to update at least every 30 minutes. Research revealed that "diagnostic data" is six sub-datasets with wildly different source cadences — only one (`LAB_LOCATION_WAITS`) can meaningfully change every 30 min. A live browser probe of the QMe booking site confirmed no wait-in-minutes in the visible booking flow, but a competing plan discovered a **hidden open REST API** that I independently verified: `GET https://qmeapi.albertaprecisionlabs.ca/api/location` returns 153 lab locations with real-time `WaitTime` and `SaveMyPlace` fields — no auth, no captcha, open CORS, 46ms response. This eliminates the need for Puppeteer entirely and makes genuine 30-min updates straightforward.

This plan amalgamates three competing plans, verified against the live API and the codebase.

---

## Research Findings (verified 2026-07-07)

### The six diagnostic sub-datasets — only one can update every 30 min

| Array | Source | Cadence | 30-min update? |
|---|---|---|---|
| `LAB_LOCATION_WAITS` | APL QMe API (new) / was hand-authored | Intraday | **YES — this plan** |
| `IMAGING_WAIT_TRENDS` | `cihiWaitTimesDownloader` | CIHI annual | No — keep daily |
| `CIHI_DIAGNOSTIC_WAIT_TIMES` | `cihiWaitTimesPriorityFetcher` | CIHI annual | No — keep daily |
| `FACILITY_IMAGING_WAITS` | AHS imaging (estimated) | Static/manual | No |
| `PRIORITY_TARGET_COMPLIANCE` | Alberta Health reports | Static/manual | No |
| `TEST_TURNAROUND_METRICS` | APL clinical standards | Static/manual | No |

Rerunning CIHI pipelines every 30 min is pure waste — they publish once a year and already run daily.

### The APL REST API is real and verified

**Endpoint:** `GET https://qmeapi.albertaprecisionlabs.ca/api/location`
- **Verified live:** HTTP 200, 114,847 bytes, 46ms, `Content-Type: application/json; charset=utf-8`.
- **No auth, no captcha, open CORS:** `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`.
- **Shape:** `{"Sites": [...]}` — 153 sites. Each site has: `Id` (int), `Name`, `Code`, `Address`, `City`, `Province`, `PostalCode`, `AdditionalInfo` (HTML), `Phone`, `Fax`, `Hours` (HTML with `</br>`), `Region`, `WaitTime` (string), `Latitude`, `Longitude` (strings), `SaveMyPlace` (bool).
- **WaitTime field:** string. At probe time (~evening Alberta), all 153 sites returned `"Closed"` and `SaveMyPlace: false` (sites were closed). During business hours this field will populate with live wait estimates. The exact open-hours format is not yet observed — the fetcher must handle all plausible formats: `"45 min"`, `"1 hr 30 min"`, `"Appointments Only"`, `"Closed"`, and bare numbers.
- **Regions:** North Zone (37), Edmonton Zone (34), Central Zone (34), Calgary Zone (32), South Zone (16).

### Merge strategy: replace, don't map

- The API has 153 sites; the hand-authored data has 52. **Only 1 of 52 codes matches** the API codes (`SHCC`). Code mapping is infeasible — the hand-authored codes (e.g., `UAH-L`, `RAH-L`, `KECP`) are a different naming scheme from the API codes (e.g., `KW`, `AIR`, `ATHAB`).
- Name matching is also unreliable: only 22/52 fuzzy-matched, and hospital lab names in the hand-authored data (e.g., "University of Alberta Hospital Lab") don't match the API's community-site names (e.g., "Abbottsfield", "Airdrie"). The hand-authored list is hospital-based; the API is community-collection-site-based — they're largely different locations.
- **Decision: replace `LAB_LOCATION_WAITS` entirely with the 153 API sites.** The hand-authored `dailyVolume` and `peakHours` fields are unverified estimates (the metadata already admits this). The API gives 3x more locations with real data. Trying to preserve 52 hand-authored records by name-matching adds complexity for no data-quality gain.
- `dailyVolume` and `peakHours` are **rendered in the dashboard** (DiagnosticDashboard.tsx lines 538-543: "Peak Hours" and "Daily Volume ~X patients" in each lab card). The API does not provide these fields. Make them **optional** in the `LabLocationWait` interface (default `0` / empty string). The dashboard renders them with `~{lab.dailyVolume} patients` and `{lab.peakHours}` — with `0`/empty these show as `~0 patients` and blank, which is honest (no fabricated data). Alternatively, hide the fields when `dailyVolume === 0` — a minor UI tweak in Phase 2.
- The `LabLocationWait.id` field: use the API `Id` (int) converted to string, or `APL-{Code}`. The `code` field: use the API `Code`.

### Deriving booleans from the API

The API doesn't have explicit `walkInAvailable` / `appointmentRequired` booleans, but they can be derived:
- `walkInAvailable`: `true` if `AdditionalInfo` contains "walk in" / "walk-in" (case-insensitive). Most sites say "Walk ins accepted until 30 min before closing."
- `appointmentRequired`: `true` if `Hours` or `AdditionalInfo` contains "appointment only" / "by appointment" and NOT "walk in." Some sites (e.g., Airdrie) are walk-in M-F but appointment-only Saturdays.
- `saveMyPlaceAvailable`: directly from the API `SaveMyPlace` boolean.
- `waitTimeMin`: parse the `WaitTime` string — see parser below.

### Critical frontend gap — dashboard reads bundled constants, not the JSON

- `src/components/DiagnosticDashboard.tsx` lines 42-54 import `LAB_LOCATION_WAITS` etc. **directly from `../diagnosticData`** (build-time TS constants). Zero `fetch` calls in the component.
- The `/api/data/:domain` endpoint **already exists** (`server.ts:490-518`, maps `'diagnostic'` → `data-diagnostic.json`).
- `App.tsx` demonstrates the correct fetch pattern (line 751: `fetch('/api/hospitals')` → `setHospitals(data)`).
- **Without converting DiagnosticDashboard to fetch-based, a 30-min fetcher updating `data-diagnostic.json` will never reach the user's browser.** Required phase.

### Scheduler architecture — add a third tier

`src/pipelines/scheduler.ts` has two tiers: ER wait times every 10 min, daily sync every 24 hr. This plan adds a **third tier: lab waits every 30 min** — a simple `setInterval` + axios GET, not a Puppeteer child process.

---

## Phases

### Phase 1 — Build the APL lab-wait fetcher

**Target files:**
- NEW: `src/pipelines/aplLabWaitTimesFetcher.ts`
- EDIT: `src/diagnosticData.ts` — make `dailyVolume` and `peakHours` optional in `LabLocationWait`.

**Change:**

1. Build an axios-based fetcher modeled on `src/pipelines/erWaitTimesFetcher.ts` (NOT `powerbiScraper.ts` — no Puppeteer, no child process, no `execFileSync`):
   ```ts
   const APL_API_URL = 'https://qmeapi.albertaprecisionlabs.ca/api/location';
   const res = await axios.get(APL_API_URL, { timeout: 15000 });
   const sites = res.data.Sites as AplSite[];
   ```

2. Define an `AplSite` interface matching the API shape: `Id`, `Name`, `Code`, `Address`, `City`, `Province`, `PostalCode`, `AdditionalInfo`, `Phone`, `Fax`, `Hours`, `Region`, `WaitTime`, `Latitude`, `Longitude`, `SaveMyPlace`.

3. Write a `parseWaitTime(waitStr: string): number | 'Appointments Only' | 'Closed'` parser that handles all formats:
   - `"Closed"` → `'Closed'`
   - `"Appointments Only"` → `'Appointments Only'`
   - `"45 min"` / `"45min"` → `45`
   - `"1 hr 30 min"` / `"1hr 30min"` → `90`
   - `"2 hr"` → `120`
   - Bare number `"45"` → `45`
   - Unknown string → `'Closed'` (safe default; log a warning)

4. Write a `deriveBooleans(site: AplSite)` helper:
   - `walkInAvailable`: `/walk.?in/i.test(site.AdditionalInfo)` (true if the info text mentions walk-ins).
   - `appointmentRequired`: `/appointment\s*only|by appointment/i.test(site.Hours + ' ' + site.AdditionalInfo)` AND not `walkInAvailable`.
   - `saveMyPlaceAvailable`: `site.SaveMyPlace` (direct from API).

5. Map each API site to `LabLocationWait`:
   ```ts
   {
     id: `APL-${site.Code}`,
     name: site.Name,
     code: site.Code,
     address: site.Address,
     city: site.City,
     region: site.Region,  // API already uses 'Calgary Zone' etc. — matches the union type
     waitTimeMin: parseWaitTime(site.WaitTime),
     saveMyPlaceAvailable: site.SaveMyPlace,
     appointmentRequired: derived,
     walkInAvailable: derived,
     latitude: parseFloat(site.Latitude),
     longitude: parseFloat(site.Longitude),
     dailyVolume: 0,       // not provided by API — optional field
     peakHours: '',        // not provided by API — optional field
   }
   ```

6. Read the existing `data-diagnostic.json`, replace ONLY the `LAB_LOCATION_WAITS` key with the 153 mapped sites, preserve all other keys (`TEST_TURNAROUND_METRICS`, `IMAGING_WAIT_TRENDS`, `FACILITY_IMAGING_WAITS`, `PRIORITY_TARGET_COMPLIANCE`, `CIHI_DIAGNOSTIC_WAIT_TIMES`, `_handAuthoredMetadata`, `_dataMetadata`).

7. Update `_dataMetadata.LAB_LOCATION_WAITS`:
   ```json
   {
     "source": "APL QMe REST API (qmeapi.albertaprecisionlabs.ca/api/location)",
     "sourceVintage": "Live data",
     "lastUpdated": "<ISO timestamp>",
     "updateType": "auto",
     "verification": "Live wait times from APL's public location API. 153 sites. WaitTime parsed from string to minutes."
   }
   ```

8. Write the updated JSON back to `data-diagnostic.json`.

9. Push to Cloudflare KV: `pushToCloudflare('diagnostic', <full data-diagnostic.json>)` (same pattern as `scheduler.ts` line 38-42).

10. Return a `SyncResult`: `{ domain: 'diagnostic', pipeline: 'aplLabWaitTimesFetcher', status, recordsFetched: 153, timestamp }`.

11. Add a CLI entry point: `if (import.meta.url === ...) { run().then(result => console.log(JSON.stringify(result))).catch(...) }` so it can run standalone: `npx tsx src/pipelines/aplLabWaitTimesFetcher.ts`.

12. In `src/diagnosticData.ts`, change the `LabLocationWait` interface:
    ```ts
    dailyVolume?: number;   // was: dailyVolume: number;
    peakHours?: string;     // was: peakHours: string;
    ```

**Guard rails:**
- Simple axios GET — no Puppeteer, no child process, no Chrome.
- On API failure (timeout, non-200, parse error): return `status: 'skipped', recordsFetched: 0` and do NOT clobber existing data (same safe-on-failure pattern as all other fetchers).
- Handle the `WaitTime` string format gracefully — the parser must never throw on an unexpected format; default to `'Closed'` and log a warning.
- The fetcher must be idempotent: running twice produces the same result.
- Rate limit: this is a single GET — no rate-limit concern. But add a 15s timeout so a hung request doesn't stall the scheduler.

**Acceptance:**
- `npx tsx src/pipelines/aplLabWaitTimesFetcher.ts` runs standalone and writes 153 sites to `data-diagnostic.json` with `status: 'success'`.
- `data-diagnostic.json` is valid JSON after the run (all other keys preserved).
- `_dataMetadata.LAB_LOCATION_WAITS.lastUpdated` reflects the run timestamp, `updateType` is `'auto'`.
- During business hours, `waitTimeMin` shows real minute values for open sites. After hours, shows `'Closed'`.

---

### Phase 2 — Convert DiagnosticDashboard from static imports to fetch-based

**Target files:**
- EDIT: `src/components/DiagnosticDashboard.tsx`

**Change:**
1. Remove the static data imports (lines 42-54): `LAB_LOCATION_WAITS`, `TEST_TURNAROUND_METRICS`, `IMAGING_WAIT_TRENDS`, `FACILITY_IMAGING_WAITS`, `PRIORITY_TARGET_COMPLIANCE`. Keep the **type** imports (`LabLocationWait`, `TestTurnaround`, `ImagingWaitTrend`, `FacilityImagingWait`, `PriorityTarget`).
2. Add state:
   ```ts
   const [diagnosticData, setDiagnosticData] = useState<{
     LAB_LOCATION_WAITS: LabLocationWait[];
     TEST_TURNAROUND_METRICS: TestTurnaround[];
     IMAGING_WAIT_TRENDS: ImagingWaitTrend[];
     FACILITY_IMAGING_WAITS: FacilityImagingWait[];
     PRIORITY_TARGET_COMPLIANCE: PriorityTarget[];
     _dataMetadata: Record<string, {...}>;
   } | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   ```
3. Add a `useEffect` that fetches `/api/data/diagnostic` on mount (mirror `App.tsx` line 751):
   ```ts
   useEffect(() => {
     fetch('/api/data/diagnostic')
       .then(res => { if (!res.ok) throw new Error('Failed to load diagnostic data'); return res.json(); })
       .then(data => { setDiagnosticData(data); setIsLoading(false); })
       .catch(err => { setError(err.message); setIsLoading(false); });
   }, []);
   ```
4. Replace all references to `LAB_LOCATION_WAITS` with `diagnosticData?.LAB_LOCATION_WAITS ?? []` (and similarly for the other four arrays). Add null guards at the top of every `useMemo` that touches these arrays (per lessons.md "useMemo crashes before isLoading guard" — return `[]` or default values if `!diagnosticData`).
5. Add an `isLoading` early return with a loading spinner, and an `error` state with an error message.
6. For `_dataMetadata`: read from the fetched response (`data._dataMetadata`) so `lastUpdated` reflects the actual data file.
7. Add a "Refresh data" button that re-fetches `/api/data/diagnostic` (mirrors Phase 9 manual refresh pattern).
8. Handle the optional `dailyVolume`/`peakHours` fields in the lab card render (lines 536-545): hide the "Peak Hours" and "Daily Volume" boxes when `!lab.dailyVolume` / `!lab.peakHours` (since 153 API sites don't have these fields). This avoids showing `~0 patients` and blank peak hours for the new sites.

**Guard rails:**
- Every `useMemo` that accesses properties of a `.find()` or array-index result MUST have a null guard (lessons.md: hooks run before early returns).
- Do NOT change the visual layout, sub-tabs, or styling beyond the dailyVolume/peakHours conditional hide. Only change the data source.
- Preserve `DataTimestamp` usage — read `lastUpdated` from fetched `_dataMetadata`.
- Handle non-JSON responses (404 fallback to HTML) — check `res.ok` before parsing.

**Acceptance:**
- `npx tsc --noEmit` passes.
- Dashboard renders with data from `/api/data/diagnostic` (verify in browser: Network tab shows the fetch, no console errors).
- After a 30-min fetcher run, refreshing the page shows the new `lastUpdated` timestamp and any changed wait times.
- Loading and error states render correctly.
- Lab cards for API sites without `dailyVolume`/`peakHours` don't show `~0 patients` or blank fields — the boxes are hidden.

---

### Phase 3 — Wire the 30-min lab tier into the scheduler

**Target files:**
- EDIT: `src/pipelines/scheduler.ts`
- EDIT: `src/pipelines/syncStatus.ts` — add `recordLabWaitsUpdate(result)` mirroring `recordErWaitTimesUpdate`.

**Change:**
1. Add `labIntervalId: ReturnType<typeof setInterval> | null = null`.
2. Add `runLabWaitsPipeline()`:
   ```ts
   async function runLabWaitsPipeline(): Promise<void> {
     const { run: aplLabRun } = await import('./aplLabWaitTimesFetcher');
     const result = await aplLabRun();
     recordLabWaitsUpdate(result);
     if (result.status === 'success') {
       const { pushToCloudflare } = await import('./pushClient');
       const fs = await import('fs');
       const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-diagnostic.json'), 'utf8'));
       await pushToCloudflare('diagnostic', data);
     }
   }
   ```
3. In `startScheduler()`:
   - After the initial ER run, run initial `runLabWaitsPipeline()` non-blocking (`.catch(...)`, not `await`).
   - Add `labIntervalId = setInterval(() => { runLabWaitsPipeline().catch(...) }, 30 * 60 * 1000)`.
4. In `stopScheduler()`: clear `labIntervalId`.
5. Update startup log: `'[Scheduler] Running. ER: 10 min. Lab waits: 30 min. Daily sync: 24 hr.'`

**Guard rails:**
- Do NOT speed up the daily orchestrator. The 30-min tier is separate and runs only the lab fetcher.
- Initial lab run must be non-blocking so server startup isn't delayed.
- Do NOT rerun CIHI pipelines on the 30-min tier.

**Acceptance:**
- `npx tsc --noEmit` passes.
- Startup log mentions the 30-min lab schedule.
- After 30 min (or temporarily shortened to 1 min for testing), scheduler log shows a lab pipeline run.

---

### Phase 4 — Register the fetcher in the orchestrator (daily bonus refresh)

**Target files:**
- EDIT: `src/pipelines/orchestrator.ts`

**Change:**
1. Import the fetcher: `import { run as aplLabRun } from './aplLabWaitTimesFetcher';`
2. Add to `PIPELINES` (Tier 1, API fetchers): `{ name: 'apl-lab-waits', domain: 'diagnostic', run: aplLabRun }`.
3. Do NOT add to `MANUAL_PIPELINES` — it should run automatically.

**Guard rails:**
- The daily run is a secondary refresh; the 30-min scheduler tier is what satisfies the "every 30 min" requirement.

**Acceptance:**
- `npm run pipeline` (full orchestrator) includes the lab fetcher in results.
- `listPipelines()` includes `apl-lab-waits`.

---

### Phase 5 — Correct cadence labels in App.tsx and dashboard

**Target files:**
- EDIT: `src/App.tsx` — find the DASHBOARDS config entry for the diagnostic tab and set `updateFrequency` to `"Lab waits: every 30 min · Imaging/turnaround: annual/manual"`.
- EDIT: `src/components/DiagnosticDashboard.tsx` — update the "Lab Location Waits" sub-tab header to reflect the live source: "Lab Location Waits · Live (every 30 min)".

**Acceptance:**
- The diagnostic tab's update-frequency label accurately says 30 min for lab waits.
- No false "15 min" or "manual" labels on the live data.

---

## Verification

1. **Typecheck:** `npx tsc --noEmit` → expect 0 new errors (pre-existing `acuteCareScraper.ts` errors are unrelated).
2. **Standalone fetch test:** `npx tsx src/pipelines/aplLabWaitTimesFetcher.ts` → writes 153 sites to `data-diagnostic.json`, status `success`, JSON valid.
3. **Daytime wait-time format check:** During business hours (7 AM–5 PM Alberta time), run the fetcher again and verify `waitTimeMin` shows real minute values for open sites (not all `'Closed'`). This confirms the `parseWaitTime` parser handles the live format. If the format is unexpected, update the parser — but the fetcher already handles all plausible formats.
4. **Scheduler:** Start the server (`npm run dev`), confirm the startup log mentions the 30-min lab tier, wait 30 min (or temporarily shorten to 1 min for testing), confirm the lab pipeline runs.
5. **Frontend:** Open `http://localhost:3004`, navigate to the Diagnostic tab, confirm:
   - Network tab shows `GET /api/data/diagnostic` returning JSON with 153 lab sites.
   - Lab Location Waits sub-tab renders the 153 sites with wait times from the fetched data.
   - `DataTimestamp` shows the real `lastUpdated` from the fetcher run.
   - Lab cards for API sites don't show `~0 patients` or blank peak hours (fields hidden).
   - No console errors.
6. **KV push:** If `CLOUDFLARE_WORKER_URL` is configured, confirm the diagnostic data lands in KV (check Worker `/api/data/diagnostic` endpoint returns the updated `lastUpdated`).

## Files Touched Summary

| Action | Files |
|--------|-------|
| New | `src/pipelines/aplLabWaitTimesFetcher.ts` |
| Edit | `src/diagnosticData.ts` (`dailyVolume?`, `peakHours?` optional) |
| Edit | `src/pipelines/scheduler.ts` (add 30-min lab tier) |
| Edit | `src/pipelines/syncStatus.ts` (`recordLabWaitsUpdate`) |
| Edit | `src/pipelines/orchestrator.ts` (register fetcher — Phase 4) |
| Edit | `src/components/DiagnosticDashboard.tsx` (fetch conversion + optional field hide) |
| Edit | `src/App.tsx` (cadence label — Phase 5) |
| Edit | `data-diagnostic.json` (metadata + 153-site `LAB_LOCATION_WAITS` from fetcher) |
| Edit | `tasks/todo.md` (add Phase 23 tracker items) |
| Edit | `lessons.md` (record APL API discovery + frontend gap lesson) |

## Success Criteria

- [ ] `aplLabWaitTimesFetcher.ts` fetches 153 sites from `qmeapi.albertaprecisionlabs.ca/api/location` and writes them to `data-diagnostic.json`.
- [ ] Scheduler runs the lab fetcher every 30 min (third tier alongside 10-min ER and 24-hr daily).
- [ ] DiagnosticDashboard reads from `/api/data/diagnostic` at runtime, not bundled TS constants.
- [ ] CIHI diagnostic pipelines are NOT rerun every 30 min (kept on daily tier).
- [ ] `npx tsc --noEmit` passes.
- [ ] Dashboard verified in browser with no console errors.
- [ ] Cadence labels accurately say "every 30 min" for lab waits.
- [ ] `tasks/todo.md` and `lessons.md` updated.

## What was dropped from the competing plans (and why)

- **Puppeteer/Blazor/SignalR/captcha path (my original plan + Plan 3):** Obsolete. The REST API provides the data without browser automation. Dropped entirely.
- **Path A/B split and daytime re-probe gate (my original plan):** Obsolete. The API is confirmed working; `WaitTime` will populate during business hours naturally. The fetcher handles all formats.
- **Code-mapping table (Plan 2):** Infeasible — only 1 of 52 codes matches. Replaced with full replacement of `LAB_LOCATION_WAITS` with 153 API sites.
- **Name-matching to preserve 52 hand-authored records:** Dropped. The hand-authored list is hospital-based; the API is community-site-based — largely different locations. The API has 3x more sites with real data. `dailyVolume`/`peakHours` are unverified estimates not worth preserving.
