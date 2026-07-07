# Implementation Plan: 30-Minute APL Community Lab Wait Times Updates

We have discovered that instead of scraping the protected Blazor SPA booking site (`qme.albertaprecisionlabs.ca`), Alberta Precision Laboratories (APL) exposes a public, unauthenticated, and CAPTCHA-free REST API that provides community lab site listings and real-time wait times:

```
GET https://qmeapi.albertaprecisionlabs.ca/api/location
```

This endpoint returns `application/json` with CORS headers open. It lists 153 sites under `{ Sites: [...] }`. Each site contains fields including `Code`, `Name`, `Address`, `City`, `Region`, `WaitTime` (e.g. `"Closed"`, `"25 min"`, or `"1 hr 30 min"`), and `SaveMyPlace` (boolean).

This allows us to implement a lightweight, robust, high-frequency pipeline (every 30 minutes) mirroring `erWaitTimesFetcher.ts` without browser automation.

---

## Files to Touch and Create

*   `src/pipelines/aplLabWaitTimesFetcher.ts` (New)
*   `src/pipelines/types.ts` (Modify)
*   `src/pipelines/syncStatus.ts` (Modify)
*   `src/pipelines/scheduler.ts` (Modify)
*   `src/components/DiagnosticDashboard.tsx` (Modify)
*   `src/App.tsx` (Modify)

---

## Detailed Phases

### Phase 1 — Create `src/pipelines/aplLabWaitTimesFetcher.ts`

Create a new file `src/pipelines/aplLabWaitTimesFetcher.ts`. This module will fetch from the APL REST API, parse the `WaitTime` values, and merge them into `data-diagnostic.json`'s `LAB_LOCATION_WAITS` array.

1.  **Wait Time Parser**:
    Write a parser that converts wait-time strings to minutes:
    *   If wait-time matches `"Closed"` (case-insensitive), return `"Closed"`.
    *   If wait-time matches `"Appointments Only"` or `"Appt Only"`, return `"Appointments Only"`.
    *   If wait-time contains hour/min indicators, parse and sum them (e.g. `"1 hr 30 min"` → `90`, `"45 min"` → `45`).
    *   If it's just a number, parse it as a number.
    *   Fallback to `"Closed"` if empty or unparseable.

2.  **Code Mappings**:
    Since codes in the local `diagnosticData.ts` and the REST API do not align perfectly, use a hardcoded mapping dictionary to match local clinic codes to the API's site codes:
    ```typescript
    const CODE_MAPPING: Record<string, string> = {
      'LCH-L': 'LEDUC', // Leduc Community Hospital Lab -> Leduc
      'FSCH': 'FSCC',  // Fort Saskatchewan Community Hospital Lab -> Fort Saskatchewan
      'STAH': 'STAB',  // St. Albert Sturgeon Community Hospital Lab -> St. Albert
      'SMCC': 'SMC',   // Sheldon M. Chumir Health Centre Lab -> Sheldon M Chumir
      'SPBL': 'SUN',   // Sunridge Professional Building Lab -> Sunridge
      'CCHC': 'COCH',  // Cochrane Community Health Centre Lab -> Cochrane
      'ACHC': 'AIR',   // Airdrie Community Health Centre Lab -> Airdrie
      'OHWC': 'OK',    // Okotoks Health and Wellness Centre Lab -> Okotoks
      'HRGH': 'HRIV',  // High River General Hospital Lab -> High River
      'COLB': 'CMR',   // Camrose Outpatient Lab -> Camrose
      'DHCL': 'DRUM',  // Drumheller Health Centre Lab -> Drumheller Health Centre
      'SHCC': 'SHCC',  // Stettler Hospital and Care Centre Lab -> Stettler Hospital & Care Centre
      'WHCL': 'WNW',   // Wainwright Health Centre Lab -> Wainwright Health Centre
      'RMHC': 'RMH',   // Rocky Mountain House Health Centre Lab -> Rocky Mountain House Health Centre
      'BHCL': 'BROOK', // Brooks Health Centre Lab -> Brooks Lab Patient Collection Site
      'THCL': 'TAB',   // Taber Health Centre Lab -> Taber
      'CHCL': 'CARD',  // Cardston Health Centre Lab -> Cardston
      'PCHC': 'PINCH', // Pincher Creek Health Centre Lab -> Pincher Creek
      'PRCH': 'PRC',   // Peace River Community Health Centre Lab -> Peace River
      'AHCC': 'ATHA',  // Athabasca Healthcare Centre Lab -> Athabasca
      'NWHC': 'HLIV',  // High Level - Northwest Health Centre Lab -> High Level
      'CLHC': 'CLAK',  // Cold Lake Healthcare Centre Lab -> Cold Lake
      'BHCB': 'BONN',  // Bonnyville Healthcare Centre Lab -> Bonnyville
      'SPTH': 'STP',   // St. Paul - Therese Healthcare Centre Lab -> St. Therese - St. Paul Healthcare Centre
    };
    ```

3.  **Merge Strategy**:
    *   Read existing `data-diagnostic.json`.
    *   For each location in the `LAB_LOCATION_WAITS` array:
        *   Determine the matching API code (`CODE_MAPPING[local.code] || local.code`).
        *   Find the site in the API response matching this code (case-insensitively).
        *   If found:
            *   Update `waitTimeMin` with the parsed wait time.
            *   Update `saveMyPlaceAvailable` to `apiSite.SaveMyPlace`.
            *   If wait time is `"Appointments Only"`, set `appointmentRequired: true` and `walkInAvailable: false`.
        *   If not found (e.g. hospital outpatient clinics that do not use QMe booking), preserve its current values.
    *   Update `_dataMetadata.LAB_LOCATION_WAITS`:
        *   `source: 'APL QMe API'`
        *   `sourceVintage`: `'Live data'`
        *   `lastUpdated`: Current timestamp
        *   `updateType`: `'auto'`
    *   Write the updated JSON atomically back to `data-diagnostic.json`.
    *   Return a standard `SyncResult`.

---

### Phase 2 — Update Sync Status Tracking

1.  **Modify `src/pipelines/types.ts`**:
    Add the new timestamp trackers to the `SyncStatus` interface:
    ```typescript
    export interface SyncStatus {
      // ... existing fields
      labWaitsLastUpdate: string | null;
      labWaitsNextUpdate: string | null;
    }
    ```

2.  **Modify `src/pipelines/syncStatus.ts`**:
    *   Initialize `labWaitsLastUpdate: null` and `labWaitsNextUpdate: null` in the `currentStatus` object.
    *   Implement `recordLabWaitsUpdate(result: SyncResult)`:
        ```typescript
        export function recordLabWaitsUpdate(result: SyncResult): void {
          currentStatus.labWaitsLastUpdate = result.timestamp;
          currentStatus.labWaitsNextUpdate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          
          const existingIdx = currentStatus.results.findIndex(r => r.pipeline === result.pipeline);
          if (existingIdx >= 0) {
            currentStatus.results[existingIdx] = result;
          } else {
            currentStatus.results.push(result);
          }
          saveToDisk();
        }
        ```
    *   Update `recordDailySyncResults(results: SyncResult[])` to protect both high-frequency pipelines from deletion:
        ```typescript
        // Keep ER wait times and Lab wait times results (different cadences)
        const keepPipelines = ['erWaitTimesFetcher', 'aplLabWaitTimesFetcher'];
        const preservedResults = currentStatus.results.filter(r => keepPipelines.includes(r.pipeline));
        currentStatus.results = [...preservedResults, ...results];
        ```

---

### Phase 3 — Wire Scheduler and Cloudflare Push

1.  **Modify `src/pipelines/scheduler.ts`**:
    *   Import the new fetcher: `import { run as runAplLabWaitTimes } from './aplLabWaitTimesFetcher';`
    *   Import `recordLabWaitsUpdate` from `./syncStatus`.
    *   Implement `runLabWaitTimesPipeline()`:
        ```typescript
        async function runLabWaitTimesPipeline(): Promise<void> {
          const result = await runAplLabWaitTimes();
          recordLabWaitsUpdate(result);
          
          if (result.status === 'success') {
            const { pushToCloudflare } = await import('./pushClient');
            const fs = await import('fs');
            const path = await import('path');
            const diagnosticFile = path.join(process.cwd(), 'data-diagnostic.json');
            try {
              const data = fs.readFileSync(diagnosticFile, 'utf8');
              const parsed = JSON.parse(data);
              await pushToCloudflare('diagnostic', parsed);
            } catch (err) {
              console.warn('[Scheduler] Failed to push diagnostic to Cloudflare:', err);
            }
          }
        }
        ```
    *   In `startScheduler()`:
        *   Trigger an initial run of `runLabWaitTimesPipeline()` after server boots up (non-blocking).
        *   Schedule `runLabWaitTimesPipeline()` on a 30-minute interval:
            ```typescript
            labIntervalId = setInterval(() => {
              runLabWaitTimesPipeline().catch(err => {
                console.error('[Scheduler] Lab wait times pipeline error:', err);
              });
            }, 30 * 60 * 1000);
            ```
    *   In `stopScheduler()`, clear `labIntervalId`.
    *   Update the startup logging statement to include APL labs.

---

### Phase 4 — Refactor `DiagnosticDashboard.tsx` for Runtime Data

We must replace the static import of diagnostic data with a dynamic fetch from `/api/data/diagnostic` at runtime, using a React state and loading spinner:

1.  **Imports**:
    Remove static array imports (`LAB_LOCATION_WAITS`, `TEST_TURNAROUND_METRICS`, `IMAGING_WAIT_TRENDS`, `FACILITY_IMAGING_WAITS`, `PRIORITY_TARGET_COMPLIANCE`, `_dataMetadata`) from `../diagnosticData`.
    Keep only the TypeScript interfaces: `LabLocationWait`, `TestTurnaround`, `ImagingWaitTrend`, `FacilityImagingWait`, `PriorityTarget`.

2.  **Add State**:
    Add `domainData` state:
    ```typescript
    const [domainData, setDomainData] = useState<{
      LAB_LOCATION_WAITS: LabLocationWait[];
      TEST_TURNAROUND_METRICS: TestTurnaround[];
      IMAGING_WAIT_TRENDS: ImagingWaitTrend[];
      FACILITY_IMAGING_WAITS: FacilityImagingWait[];
      PRIORITY_TARGET_COMPLIANCE: PriorityTarget[];
      _dataMetadata?: DataMetadataMap;
    }>({
      LAB_LOCATION_WAITS: [],
      TEST_TURNAROUND_METRICS: [],
      IMAGING_WAIT_TRENDS: [],
      FACILITY_IMAGING_WAITS: [],
      PRIORITY_TARGET_COMPLIANCE: [],
    });
    const [isLoading, setIsLoading] = useState(true);
    ```

3.  **Fetch Data in `useEffect`**:
    ```typescript
    useEffect(() => {
      fetch('/api/data/diagnostic')
        .then(res => res.json())
        .then(data => {
          setDomainData(data);
          setIsLoading(false);
        })
        .catch(err => {
          console.error('Failed to load diagnostic data:', err);
          setIsLoading(false);
        });
    }, []);
    ```

4.  **Replace Array Access**:
    Modify all references inside render/logic from:
    *   `LAB_LOCATION_WAITS` → `domainData.LAB_LOCATION_WAITS`
    *   `TEST_TURNAROUND_METRICS` → `domainData.TEST_TURNAROUND_METRICS`
    *   `IMAGING_WAIT_TRENDS` → `domainData.IMAGING_WAIT_TRENDS`
    *   `FACILITY_IMAGING_WAITS` → `domainData.FACILITY_IMAGING_WAITS`
    *   `PRIORITY_TARGET_COMPLIANCE` → `domainData.PRIORITY_TARGET_COMPLIANCE`
    *   `diagnosticDataMetadata` → `domainData._dataMetadata`

5.  **Update `useMemo` Dependencies**:
    For all `useMemo` hooks (such as `labStats`, `filteredLabs`, `filteredFacilities`, `filteredTrendData`, `trendKpiStats`), add `domainData` as a dependency.

6.  **Add Loading State Rendering**:
    ```typescript
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px] text-slate-400 text-sm">
          Loading diagnostic and lab data...
        </div>
      );
    }
    ```

---

### Phase 5 — Adjust Cadence Labels in Frontend

1.  **Modify `src/App.tsx`**:
    *   In the `DASHBOARDS` array:
        Change `updateFrequency: 'Every 15 minutes'` → `updateFrequency: 'Every 30 minutes'` (or `'Lab waits every 30 min'`).
    *   In `DASHBOARD_METADATA['diagnostics']`:
        Change `interval: 'every 24 hours'` → `interval: 'lab waits every 30 min; imaging annually'`.
        Change `source` → `'APL QMe API & CIHI CT/MRI wait-times'`.

---

## Verification & Acceptance Criteria

1.  **Type Check**: Run `npm run lint` (`tsc --noEmit`) and ensure it compiles without errors.
2.  **Standalone Fetcher Run**: Execute `npx tsx src/pipelines/aplLabWaitTimesFetcher.ts` to confirm it fetches wait times from `qmeapi.albertaprecisionlabs.ca`, merges them successfully, and writes a correctly structured file to `data-diagnostic.json`.
3.  **Local Run & API Verification**:
    *   Start local server with `npm run dev`.
    *   Confirm in the server logs: `[Scheduler] Running. ER wait times: every 10 min. APL lab waits: every 30 min. Daily sync: every 24 hr.`
    *   Check `/api/sync/status` contains `labWaitsLastUpdate` and `labWaitsNextUpdate`.
    *   Confirm `/api/data/diagnostic` loads the merged JSON.
4.  **UI Verification**:
    *   Load the dashboard in the browser and navigate to **Diagnostics & Labs**.
    *   Ensure the Laboratory tab mounts, displays a spinner/loading indicator briefly, and then renders location cards with wait times.
    *   Confirm the updated cadence ("Every 30 minutes") and source labels are clearly displayed.
