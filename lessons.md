# Lessons Learned

Record mistakes and their solutions here. Read before each sprint to avoid repeating.

---

## Session: 2026-07-06 (Python Environment & Launchd PATH Conflicts)

### Lesson: Launchd PATH overrides can redirect python3 execution to Homebrew versions
- **Mistake:** Assuming that `python3` resolved inside the `primaryCareFetcher` pipeline matches the user's terminal default (`/usr/local/bin/python3` -> Python 3.13). When launched via launchd, the plist `PATH` variable had `/opt/homebrew/bin` before `/usr/local/bin`, leading `python3` to execute Homebrew's Python 3.14 instead, which lacked the `openpyxl` dependency.
- **Solution:** Installed `openpyxl` using `/opt/homebrew/bin/python3 -m pip install openpyxl --user --break-system-packages` to ensure the library is present in Python 3.14's user site-packages.
- **Prevention:** Always check which python executable and version are resolved under the specific daemon environment (`PATH` and `HOME`) when troubleshooting imports in child processes.

## Session: 2026-07-06 (Scheduler Dead Code — 18h KV Outage)

### Lesson: Scheduler module was dead code — never wired into the server
- **Mistake:** `src/pipelines/scheduler.ts` had the correct logic to fetch ER wait times, update `data-sync-status.json`, and push to Cloudflare KV every 10 minutes, but `startScheduler()` was never called by anything. Meanwhile, `server.ts` had inline `setInterval` calls that only updated in-memory state and `data-snapshots.json`, so the dashboard (which reads from KV) went stale after the last manual `npm run pipeline` run at 2026-07-05T18:17:44Z.
- **Solution:** Wired `startScheduler()` + `setDailyOrchestrator(runAllPipelines)` into `startServer()` after `app.listen()`. Removed the inline `fetchAndSyncWaitTimes`, `fetchAndSyncDisruptions`, `syncOtherDatasetsDaily`, and their `setInterval` calls. Routed API endpoints to `getHospitalsData()`/`getSnapshotsData()` from the scheduler. Fixed the `require()` ESM bug in `scheduler.ts` and made the initial daily sync non-blocking.
- **Prevention:** When a module is written to replace inline code, verify it's actually imported and called. Dead code that duplicates live code is worse than no code — it creates a false sense of completeness. Also confirm the production server is scheduled by a real job (launchd/cron), not just a dev process.

## Session: 2026-07-04 (Initial Analysis & Planning)

### Finding: Fake daily sync
- **Mistake:** The `syncOtherDatasetsDaily()` function in `server.ts` appeared to update 13 datasets but only pinged two catalog endpoints to count records. It never downloaded, parsed, or updated any data.
- **Solution:** Replace with a real orchestrator that runs actual fetchers/scrapers/downloaders per domain. (Planned in Phase 8.)
- **Prevention:** Always verify that a "sync" function actually writes data to storage, not just logs success.

### Finding: Disruptions scraper only verifies, doesn't discover
- **Mistake:** `fetchAndSyncDisruptions()` only checks if existing seed entries still appear on the AHS page. New disruptions are never discovered automatically.
- **Solution:** Write a real HTML parser that extracts all disruption entries from the page. (Planned in Phase 2.)
- **Prevention:** When a function claims to "sync," verify it handles the full create-read-update-delete lifecycle, not just updates.

### Finding: AHS disruptions page updates only Tue/Fri at 5pm
- **Fact:** The AHS service disruptions page is not real-time. It updates on a fixed schedule.
- **Implication:** A 24-hr daily sync is sufficient. No need for 10-minute polling.

## Session: 2026-07-04 (Implementation & Deployment)

### Lesson: cheerio AnyNode type comes from domhandler, not cheerio
- **Mistake:** Used `cheerio.AnyNode` in type annotations — cheerio doesn't export `AnyNode` as a namespace member.
- **Solution:** `import type { AnyNode } from 'domhandler'` — cheerio re-exports it but the type must be imported from domhandler directly.
- **Prevention:** When a type isn't found in a package's namespace, check its dependency chain.

### Lesson: Cloudflare Worker tsconfig must be excluded from main project
- **Mistake:** `cloudflare/worker.ts` uses `hono` and `KVNamespace` types not installed in the main project, causing tsc errors.
- **Solution:** Added `"exclude": ["cloudflare"]` to the main `tsconfig.json` and gave `cloudflare/` its own `tsconfig.json` with `@cloudflare/workers-types`.
- **Prevention:** Separate deployment targets need separate tsconfigs.

### Lesson: wrangler kv key put needs --remote flag
- **Mistake:** `wrangler kv key put` without `--remote` writes to local Miniflare, not the actual Cloudflare KV.
- **Solution:** Always pass `--remote` when writing to production KV namespaces.
- **Prevention:** Check wrangler's "Resource location" output — it says "local" vs "remote".

### Lesson: Pages Functions proxy for API calls
- **Mistake:** Frontend deployed to Cloudflare Pages uses relative `/api/*` URLs, but Pages doesn't have the Express server.
- **Solution:** Created `functions/api/[[path]].js` Pages Function that proxies all `/api/*` requests to the Worker URL.
- **Prevention:** When deploying a split frontend/backend, ensure the frontend can reach the API. Relative URLs need a proxy on the same origin.

### Lesson: Port conflicts on the Mac mini
- **Mistake:** Server tried port 3000 (Poly/homerun vite) and 3001 (another process) — both in use.
- **Solution:** Used port 3004 instead. Check `lsof -ti :PORT` before binding.
- **Prevention:** Always check port availability before starting a server. The Mac mini runs many dev servers.

### Lesson: Subagent brace mismatches in generated code
- **Mistake:** A subagent wrote `});` where `}` was needed to close a for-loop, causing TS1128 syntax errors.
- **Solution:** Read the exact error lines, traced the brace nesting, and fixed the mismatched closer.
- **Prevention:** Always run `npx tsc --noEmit` after subagent work and fix syntax errors before proceeding.

## Session: 2026-07-04 (Upstream Fixes & Code-Splitting)

### Lesson: StatsCan SDMX endpoint is dead — use WDS REST CSV flow
- **Mistake:** `statscanFetcher.ts` used the SDMX 2.1 REST endpoint `.../sdmx/statcan/rest/data/DF_JVQ/14-10-0443-01.AB..` which returns 404. Both the old table number AND the SDMX path/flow combo are dead.
- **Solution:** Rewrote to use the WDS REST CSV download flow: `GET https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/14100371/en` → returns JSON with ZIP URL → download ZIP → extract CSV → parse. Added `adm-zip` for ZIP extraction.
- **Key details:** Product ID `14100371` = "Job vacancies by province and territory, monthly, unadjusted". Monthly data must be aggregated into quarters (Jan-Mar=Q1, etc.) to match the `JobVacancyTrend` interface. The table has no NAICS sector breakdown, so all records use sector 'All Alberta Sectors'.
- **Prevention:** StatsCan's SDMX endpoint is unreliable. The WDS REST API (`getAllCubesListLite`, `getFullTableDownloadCSV`, `getDataFromCubePidCoordAndLatestNPeriods`) is the documented, working contract. See the WDS user guide for method shapes — `getFullTableDownloadCSV` is a GET, not POST.

### Lesson: CIHI and Fraser Institute landing pages change
- **Mistake:** `cihiDownloader.ts` pointed at `https://www.cihi.ca/en/health-spending-data` (404). `fraserDownloader.ts` pointed at `https://www.fraserinstitute.org/categories/health-spending` (404).
- **Solution:** CIHI → `https://www.cihi.ca/en/national-health-expenditure-trends` (NHEX reports). Fraser → `https://www.fraserinstitute.org/studies/health-care`. Note: CIHI 2026 data releases November 2026; Fraser's spending-specific reports may not exist anymore — the downloader gracefully returns 'skipped' when the PDF doesn't contain the expected spending metrics.
- **Prevention:** External landing page URLs rot. Fetchers must handle 404 gracefully (return 'skipped' SyncResult, never throw). Don't force unrelated study data into a dataset with a different shape.

### Lesson: React.lazy import ordering in ESM
- **Mistake:** Inserted `const X = React.lazy(...)` statements before the last `import` statement in `App.tsx`. ESM requires all `import` declarations before any top-level statements.
- **Solution:** Moved `import { LiveDataBadge }` above the `React.lazy` const declarations.
- **Prevention:** In ESM/TSX, all imports must come first. When converting static imports to `React.lazy()`, ensure no `import` statements remain below the lazy const block.

### Lesson: Code-splitting requires React.lazy, not just manualChunks
- **Mistake:** Advisory warned that `manualChunks` alone in `vite.config.ts` wouldn't reduce first-load size — the dashboards would still be bundled into the entry chunk.
- **Solution:** Combined `React.lazy(() => import(...))` for 13 dashboard components with `<React.Suspense>` wrapper around the conditional render, PLUS `manualChunks` for vendor libs (recharts, leaflet, lucide-react, motion). Entry chunk dropped from 1,609 kB → 314 kB (80% reduction).
- **Key detail:** App.tsx still imports Recharts and MapComponent directly for the ER-waits default tab. Recharts is now in its own 478 kB chunk loaded async. The ER-waits view (default tab, ~800 lines) stays in the entry chunk since it's the first thing users see.
- **Prevention:** `manualChunks` splits vendor code but doesn't create route-level splits. For route-level splitting, use `React.lazy()` + `Suspense`. Measure with actual build output, not assumptions.

### Lesson: API response shape mismatch between local server and Cloudflare Worker
- **Mistake:** The local server's `/api/hospitals` endpoint returns a bare array `[{...}, {...}]`, but the scheduler's push to KV wraps it as `{ hospitals: [...], lastUpdated: "..." }`. The Worker returned the wrapped object, but the frontend expected a bare array (`Array.isArray(data)` check failed silently, setting `hospitals` to `[]`).
- **Solution:** Fixed the Worker's `/api/hospitals` endpoint to extract `parsed.hospitals` and return the bare array. Also added the missing `/api/trends/max-stats` endpoint (was 404ing because the `:hospitalId` route caught it).
- **Prevention:** When splitting a monolith into local server + Cloudflare Worker, verify every API endpoint returns the same response shape on both sides. The push layer can wrap data with metadata — the read layer must unwrap it to match the frontend's contract.

### Lesson: useMemo crashes before isLoading guard on first render
- **Mistake:** Three dashboard components (WorkforceDashboard, SystemFlowDashboard, RegionalInequityDashboard) crashed on first render with "Cannot read properties of undefined" errors. The `useMemo` hooks called `.find()` or array indexing on state arrays initialized to `[]`, getting `undefined`, then accessed properties like `d.familyMedicine` or `selectedHospital.zone`.
- **Root cause:** React hooks execute during render, BEFORE the `if (isLoading) return <div>Loading...</div>` early return. So even though the loading guard exists, the `useMemo` runs on the first render with empty data and crashes.
- **Solution:** Added null guards at the start of each affected `useMemo`: `if (!variable) return [];` or `if (!variable) return { ...defaults };`.
- **Prevention:** Any `useMemo` that accesses properties of a `.find()` or array-index result MUST have a null guard. The `isLoading` guard does NOT protect against this because hooks run before early returns. This pattern is especially dangerous with `React.lazy()` because the crash takes down the entire Suspense boundary.

## Session: 2026-07-04 (Power BI Scraper)

### Lesson: waittimes.alberta.ca is dead — replaced by Power BI dashboard
- **Mistake:** `waittimesAlbertaScraper.ts` pointed at `https://waittimes.alberta.ca/` which was shut down in January 2026. The site was replaced by the Alberta Health System Dashboard at `https://www.alberta.ca/health-system-dashboard`, which embeds a Power BI report.
- **Solution:** Built `powerbiScraper.ts` using Puppeteer to launch headless Chrome, navigate to the Power BI report, click the "Surgery" tab, and intercept `querydata` API responses. Parses the DAX Serialized Results (DSR) format to extract surgical wait times, volumes, % within benchmark, and facility-level data (89 sites with coordinates).
- **Key details:** Power BI renders data via JavaScript canvas elements — not scrapable via HTTP. The `querydata` endpoint returns DSR format: `data.dsr.DS[0].PH[0].DM0[]` with `G0` (group/dimension), `M0`/`M1` (measures), `S` (schema), `C` (cells). Text labels (surgery type names) are in `G0`, numeric values in `M0`. Period label ("April 2026") extracted from DOM text, not DSR (DSR `period_label` returns numeric IDs, `title_period_label` has display text but different DSR structure).
- **Prevention:** Government data sites can be replaced at any time. When a source URL dies, check if the replacement uses a JS-rendered framework (Power BI, Tableau, etc.) — these require headless browser automation, not HTTP scraping.

### Lesson: Puppeteer ESM-only — can't bundle into CJS server
- **Mistake:** Tried to import Puppeteer directly in the orchestrator, but the server bundles as CJS via esbuild and Puppeteer v25 is ESM-only.
- **Solution:** The Power BI scraper runs as a child process spawned by the orchestrator via `execFileSync('npx', ['tsx', 'src/pipelines/powerbiScraper.ts'])`. The scraper outputs a JSON `SyncResult` as the last line of stdout, which the orchestrator parses.
- **Prevention:** When a dependency is ESM-only and the server bundles as CJS, run it as a child process. Use `execFileSync` with `npx tsx` for TypeScript ESM execution. The child process approach also isolates heavy dependencies (Puppeteer downloads ~300MB of Chrome) from the server bundle.

### Lesson: Power BI DSR data deduplication
- **Mistake:** The Power BI report fires multiple `querydata` requests for the same data (e.g., 6 separate queries all returning surgical wait times). Without deduplication, 30 raw wait time records became only 10 unique entries.
- **Solution:** Use `Map<string, T>` keyed by procedure type to deduplicate wait times, volumes, and facilities. Keep the last value for each key (latest query wins).
- **Prevention:** Power BI reports fire redundant queries for the same data. Always deduplicate by natural key (procedure type, site name) when aggregating intercepted API responses.

## Session: 2026-07-04 (7 New Pipelines for Static Tabs)

### Lesson: XLSX.readFile hangs under tsx/ESM — use XLSX.read(buffer) instead
- **Mistake:** `XLSX.readFile(tempPath, { type: 'file' })` hangs indefinitely when run via `npx tsx` in ESM mode. The call never returns and the pipeline times out.
- **Solution:** Use `XLSX.read(buffer, { type: 'buffer' })` with the downloaded `Buffer` directly. No temp file needed.
- **Prevention:** Always use `XLSX.read(buffer, { type: 'buffer' })` for SheetJS parsing in tsx/ESM contexts. Avoid `XLSX.readFile` which relies on Node's fs module in ways that break under ESM bundling.

### Lesson: CIHI XLSX !ref spans 16K columns — sheet_to_json hangs on 336M cells
- **Mistake:** CIHI's Wait Times Priority Procedures XLSX has `!ref = A1:XFC20511` (16383 columns × 20511 rows = 336M cells) even though only 8 columns carry data. `XLSX.utils.sheet_to_json` iterates every cell in the range, hanging for minutes.
- **Solution:** Clamp the sheet's `!ref` to the first 10 columns before calling `sheet_to_json`: `decoded.e.c = Math.min(decoded.e.c, 9); sheet['!ref'] = XLSX.utils.encode_range(decoded);`
- **Prevention:** Always check `!ref` dimensions before parsing XLSX sheets. CIHI workbooks have padded ranges. Clamp columns to the data-bearing range to avoid massive empty-cell scans.

### Lesson: CIHI indicator names are Title Case, not lowercase
- **Mistake:** The `SURGERY_INDICATOR_TO_TYPE` lookup used lowercase keys ("Bladder cancer surgery") but the actual XLSX data uses Title Case ("Bladder Cancer Surgery"). Zero rows matched.
- **Solution:** Match the exact casing from the XLSX: "Bladder Cancer Surgery", "Breast Cancer Surgery", "Radiation Therapy", etc.
- **Prevention:** Always inspect a few sample rows from the source data to verify exact string values before building lookup tables. Don't assume casing.

### Lesson: AHS page URLs change — Page13363.aspx is now 404
- **Mistake:** The `ahsAsiScraper` used `Page13363.aspx` for continuing care and `Page16490.aspx` for mental health. Both now redirect to `NotFound.aspx`.
- **Solution:** Found current URLs: continuing care at `/cc/page15328.aspx`, mental health at `/amh/Page18670.aspx`, helplines at `/amh/Page16759.aspx`.
- **Prevention:** AHS reorganizes their site frequently. Verify URLs are live before each pipeline run. The scraper should detect 404 redirects and return 'skipped' gracefully.

### Lesson: CIHI NHEX 2025 is published — don't look for 2026
- **Mistake:** The existing `cihiDownloader.ts` was looking for NHEX 2026 data which doesn't exist yet (releases November 2026). It returned 'skipped' every run.
- **Solution:** Use the NHEX 2025 full data tables ZIP: `https://www.cihi.ca/sites/default/files/document/nhex-2025-full-data-tables-en.zip`. Contains finalized 2023 actuals + preliminary 2024-2025 forecasts.
- **Prevention:** Check the current release year before hardcoding NHEX URLs. CIHI publishes NHEX annually in late November.

### Lesson: Open Alberta CKAN has LGA-level health inequity data
- **Mistake:** Assumed health inequity data was only available in PDF reports. Actually, Open Alberta CKAN API has 91 structured XLSX tables at LGA (Local Government Area) level.
- **Solution:** Download XLSX tables directly from `open.alberta.ca/dataset/.../resource/.../download/table-10.1.xlsx`. Pivot the tidy/long layout by LOCAL_NAME to build per-LGA profiles.
- **Prevention:** Always check `open.alberta.ca/api/3/action/package_search` for structured data before concluding a dataset is PDF-only.

## Session: 2026-07-04 (Hospital Completeness Audit)

### Lesson: 'All' zone filter was silently dropping zones
- **Mistake:** ContinuingCareDashboard and PatientExperienceDashboard had zone filters where 'All' actually filtered to only Calgary Zone + Edmonton Zone, silently dropping Central, South, and North zones.
- **Solution:** Changed 'All' branch to return the full unfiltered array. Added missing Central Zone and South Zone options to the LTC dropdown.
- **Prevention:** When a filter says 'All', it must show ALL data. Never hardcode a subset under an 'All' label. Test with data from all zones.

### Lesson: Modulo filter hid 64% of resident quality data
- **Mistake:** ContinuingCareDashboard used `.filter((_, i) => i % 3 === 2)` on RESIDENT_QUALITY_OUTCOMES, showing only every 3rd row (4 of 11 records). This was likely a UI spacing hack that became a data-hiding bug.
- **Solution:** Removed the modulo filter entirely. All 11 rows now render.
- **Prevention:** Never use array index modulo as a filter. If you need UI spacing, use CSS or group by metric type.

### Lesson: Hardcoded divisor /5 instead of array.length
- **Mistake:** RegionalInequityDashboard computed provincial averages by dividing sums by hardcoded 5 (from when there were 5 representative LGAs). After adding 135 LGAs, the averages were understated by 27x.
- **Solution:** Replaced every `/ 5` with `/ array.length` per dataset.
- **Prevention:** Never hardcode array lengths. Always use `.length` for dynamic collections.

### Lesson: 13 ER hospitals missing from System Flow data
- **Mistake:** System Flow had 24 facilities but the canonical ER list has 29 hospitals. 13 community/urgent care centres were absent from FACILITY_FLOW_METRICS.
- **Solution:** Added all 11 missing facilities (2 were duplicates under different names) with `staffedAcuteBeds: 0` and `type: 'Community'` for urgent care centres.
- **Prevention:** Cross-reference every hospital-level dataset against the canonical ER wait times list. Community health centres should appear with zero acute beds, not be absent.

### Lesson: Surgical facility names had '(AHS)' suffix preventing matching
- **Mistake:** SURGICAL_FACILITIES names like 'Foothills Medical Centre (AHS)' didn't match ER list names like 'Foothills Medical Centre', breaking cross-dashboard hospital matching.
- **Solution:** Stripped all '(AHS)' suffixes from facility names in SURGICAL_FACILITIES, FACILITY_COMPARISONS, and SPECIALIST_COMPARISONS.
- **Prevention:** Normalize facility names across all datasets. Never include source attribution in the name field — use a separate `source` field.
- ### Lesson: Hand-authored AHS_WEEKLY_ED_LOS data was fabricated
- **Mistake:** The `AHS_WEEKLY_ED_LOS` array in `systemFlowData.ts` had 10 hand-authored entries with fabricated numbers (e.g., UAH discharged=1245, 32.4%). The comment said "Directly from AHS Weekly PDFs" but the data was not from any real AHS PDF.
- **Solution:** Built `ahsWeeklyEdLosScraper.ts` that downloads the two real AHS PDFs (Edmonton + Calgary), parses them with `pdftotext`, and extracts real weekly ED LOS data. The real numbers were completely different (e.g., UAH discharged=582, 8%).
- **Prevention:** Never hand-author data that claims to be from an upstream source. Either build a real scraper or clearly label it as illustrative/sample data.

### Lesson: pdftotext fragments PDF text across lines
- **Mistake:** `pdftotext` output from AHS PDFs splits words across multiple lines (e.g., "Grey Nuns Community Hospital" becomes "Gr\neyNunsCommuni\nt\nyHos\npi\nt\nal"). Numbers and percentages are on separate lines with blank lines between them. Comma-formatted numbers like "1,314" are split as "1,\n314".
- **Solution:** Pre-process lines to join comma-split numbers ("1," + "314" → "1,314"). Scan for number lines followed by percentage lines (skipping blank lines). Pairs are interleaved: discharged, admitted, discharged, admitted — assign by even/odd index.
- **Prevention:** Always inspect raw `pdftotext` output before building a parser. PDF text extraction is inherently messy — test with real data, not assumptions.

### Lesson: pdf-parse v2 API change (PDFParse class, not default function)
- **Mistake:** `pdf-parse` v2.4.5 exports `PDFParse` class, not a default function. `const pdfParse = require('pdf-parse')` returns an object with `PDFParse` property, not a callable. The old `pdfParse(buffer)` pattern from v0.x fails with "pdfParse is not a function".
- **Solution:** Switched to `pdftotext` (poppler binary) via `child_process.execFileSync` instead. More reliable for table-style PDFs and avoids the API confusion.
- **Prevention:** Check the installed package version and API before using it. When a library API changes, consider whether a simpler tool (like a CLI binary) would be more robust.

### Lesson: "Edmonton & Calgary sites only" was misleading
- **Mistake:** The no-data message said "AHS publishes weekly PDFs for Edmonton & Calgary sites only" but 9 Edmonton/Calgary zone sites (Sheldon Chumir, South Calgary, Northeast, Sturgeon, etc.) had no data. The real distinction is "10 major acute centres", not zone.
- **Solution:** Changed message to "AHS weekly PDFs cover 10 major acute centres only" and "Not included in AHS weekly PDF" for the per-hospital note.
- **Prevention:** When writing user-facing messages about data gaps, describe the actual filtering criteria, not a proxy that doesn't match.

## Session: 2026-07-05 (Disruptions "Invalid Date" Bug)

### Lesson: formatDate didn't handle "TBD" endDate from AHS scraper
- **Mistake:** `ServiceDisruptionsDashboard.tsx` formatDate used `new Date(isoString).toLocaleDateString()` with only an `'Ongoing'` special-case in the render. The disruptions scraper returns `endDate: "TBD"` when AHS lists no anticipated end date (`parseAhsDate` fallback). `new Date("TBD")` → Invalid Date → displayed as "Invalid Date" for 4 active advisories (Consort, Hardisty, Rimbey, Three Hills).
- **Solution:** Added `isNaN(date.getTime())` guard in formatDate to return the raw string. Inlined the open-ended check in the render: `['ongoing','tbd','indefinite',''].includes((disr.endDate ?? '').toLowerCase())` → shows pulsing "Ongoing" badge.
- **Prevention:** Date formatters must handle non-ISO strings gracefully. When a scraper has a fallback path that returns placeholder strings (TBD, Ongoing, N/A), the renderer must know about every placeholder variant, not just one. Always check `isNaN(date.getTime())` before calling `toLocaleDateString`.

## Session: 2026-07-05 (System Flow Dashboard Accuracy Audit & Scraper Repair)

### Lesson: acuteCareScraper targeted dead AHS pages
- **Mistake:** `acuteCareScraper.ts` scraped 3 AHS HTML pages (`Page16574.aspx`, `Page3166.aspx`, `Page24264.aspx`). Two of those now 302-redirect to an error handler (dead pages), and the third has no structured tables matching the parsers. Result: every run returned `status: "skipped", recordsFetched: 0` — the facility list, CIHI comparators, and LGA demand never refreshed. The header comment said "hand-authored data is never clobbered" which masked the failure as intentional.
- **Solution:** Rewrote the scraper to use the live AHS wait-times JSON API (`/Webapps/WaitTimes/api/waittimes/en`) for the facility list, and derived CIHI comparators from `data-diagnostic.json` + `data-cancer.json` (already populated by `cihiWaitTimesDownloader`) and LGA demand from `data-regional-inequity.json` (already populated by `openAlbertaInequityFetcher`). Added a CLI entry point so it can be run standalone for debugging.
- **Prevention:** When a scraper's design says "preserve existing data on failure," verify the failure isn't permanent. A scraper that always skips is a dead scraper disguised as a safe one. Always have a CLI entry point for standalone testing.

### Lesson: Facility merge by ID created duplicates
- **Mistake:** The scraper merged scraped facilities with hand-authored ones by `facilityId`. The AHS API generates IDs from the full name (`alberta-children-s-hospital`) while hand-authored data used short codes (`ach-calgary`). Same hospital, different IDs → 24 duplicate zero-metric stubs.
- **Solution:** Merge by normalized facility name (lowercase, alphanumeric-only) with a `NAME_ALIASES` map for abbreviations like "Fort Sask" → "Fort Saskatchewan". Keep the hand-authored ID on merge so deep-dive links and weekly-ED-LOS joins stay stable.
- **Prevention:** When merging records from two sources, never assume IDs match. Match on a normalized natural key (name) and alias known abbreviations.

### Lesson: ER city parser fell into "word before Alberta" fallback
- **Mistake:** `erWaitTimesFetcher.ts` deduced city from address by checking `includes('calgary')`, `includes('edmonton')`, etc., then falling back to `parts[abIndex - 1]` (the word before "Alberta"). "Fort Saskatchewan Alberta" → "Saskatchewan". "Stony Plain Alberta" → "Plain". Two hospitals got wrong cities.
- **Solution:** Added explicit `includes('fort saskatchewan')` and `includes('stony plain')` rules (plus Airdrie, Okotoks, Cochrane, Devon, Innisfail, Lacombe) before the generic fallback.
- **Prevention:** The "word before Alberta" fallback is a last resort, not a primary strategy. Every Alberta city with a multi-word name needs an explicit rule. Audit the fallback by testing against every facility in the live API.

### Lesson: AHS API uses `[;]` separator for parent/child facilities
- **Mistake:** The AHS wait-times API returns `South Health Campus Children[;]South Health Campus` — a `[;]`-delimited pair where the first is the children's ED and the second is the adult ED. Without stripping, the name rendered as the full string with the separator.
- **Solution:** `cleanHtmlEntities` now strips `\[;\].*` (keeps the first name). The children's ED is a genuine separate facility and gets its own stub.
- **Prevention:** When an API uses a delimiter to pack multiple values into one field, strip it at the parsing layer, not the display layer. Check whether each packed value represents a distinct entity.

### Lesson: Fake certification labels on static data
- **Mistake:** The System Flow dashboard displayed "HQA FOCUS Live Feed", "CIHI / AHS Certified", "Live Data Verified", "AHS Certified Performance Data Feed" badges on data that was hand-authored and never refreshed. The "Mathematical Non-Linear Model" badge described a decorative slider formula, not a fitted model.
- **Solution:** Replaced with honest labels: "Analytical Model · Static Metrics", "Unofficial · Not AHS/CIHI Endorsed", "Illustrative Simulation (not a fitted model)", "Unofficial Analytical Model". LGA panel relabeled "Curated static sample" with pointer to the full 135-LGA Regional Inequity dashboard.
- **Prevention:** Never put "Live" or "Certified" on data that isn't live or certified. If data is hand-authored, say so. If a model is decorative, call it a simulation.

### Lesson: KPI label contradicted its own chart data
- **Mistake:** The "Average ED Bed Wait (P90)" KPI card said "+12.4h since 2021" (hardcoded). The `HISTORICAL_FLOW_TIMELINES` data showed p90BedWaitHours going from 24.5h → 48.0h = +23.5h. The chart footer correctly said "95.9% expansion" — so the chart and footer agreed, but the KPI label was wrong by nearly 2×.
- **Solution:** Made the label data-driven: `+{bedWaitDelta}h since {firstQuarter}` where `bedWaitDelta` is computed from the historical timelines array.
- **Prevention:** Never hardcode a derived statistic that can be computed from data already in the component. If a label and a chart disagree, one of them is wrong — pick the one backed by data.

### Lesson: Zone averages used unweighted means, provincial used bed-weighted
- **Mistake:** `provincialOverview.avgOccupancy` was bed-weighted (`sum(occupancy * staffedAcuteBeds) / totalBeds`) but `zoneAverages.avgOccupancy` used unweighted means (`sum(occupancy) / count`). The provincial 104.3% was not the mean of the 5 zone means shown beside it. A 25-bed community hospital counted the same as 1100-bed Foothills.
- **Solution:** Bed-weighted both `zoneAverages` and `selectedHospitalZoneAvg` to match `provincialOverview`.
- **Prevention:** When aggregating rates across facilities of different sizes, use weighted averages. Document the weighting choice and apply it consistently across all aggregation levels.

## Session: 2026-07-05 (Full System Flow Page Review — Weekly ED LOS Fixes)

### Lesson: Weekly ED LOS had duplicate facilities with fabricated dates
- **Mistake:** The `AHS_WEEKLY_ED_LOS` array in `data-system-flow.json` had 39 entries — 10 real entries from the AHS PDF scraper (June 13, 2026) plus 29 hand-authored entries with a fabricated "June 24, 2026" date. The hand-authored entries used different facilityIds (`uah-edmonton`) than the scraper (`university-of-alberta-hospital`), so the merge by facilityId didn't match them. The page displayed the fabricated June 24 data as "latest" with a "Direct Parser Feed" label, even though it never came from any parser. The real AHS PDF only contains "Week of June 7-13, 2026".
- **Solution:** Fixed the weekly ED LOS merge in `ahsWeeklyEdLosScraper.ts` to use normalized facility name matching (same pattern as `mergeFacilityFlow`). Removed the fabricated June 24 entries. Re-ran the scraper to populate real June 13 PDF data. Cleared the weekEnding for non-PDF facilities (zero-data entries) so they don't display a fake date. Replaced the hand-authored `AHS_WEEKLY_ED_LOS` in `systemFlowData.ts` with an empty array + comment.
- **Prevention:** When two data sources produce records for the same entities, never assume IDs match. Match on a normalized natural key (name). Never put a date on hand-authored data that implies it came from a live source. If data is hand-authored, leave the date empty or mark it as "placeholder".

### Lesson: Stale hand-authored constants in systemFlowData.ts
- **Mistake:** `systemFlowData.ts` exported hand-authored constants (`AHS_WEEKLY_ED_LOS`, `CIHI_COMPARATORS`, `REGIONAL_LGA_DEMAND`) that were stale — they didn't match what the scrapers actually produce. The `CIHI_COMPARATORS` had 6 old metrics (ALC Days, ED LOS, Staffed Beds, LWBS, Readmissions) while the scraper now produces 4 different metrics (CT Scan, MRI, Cancer Surgery, Radiation Therapy). The `REGIONAL_LGA_DEMAND` had different LGA names than what the scraper produces. These constants weren't used at runtime (only types are imported), but they were misleading as code reference.
- **Solution:** Replaced all three stale constants with empty arrays + comments explaining how the data is actually populated. Added `HISTORICAL_FLOW_TIMELINES` as a value import in `acuteCareScraper.ts` as a fallback when `data-system-flow.json` doesn't have historical data, preventing data loss.
- **Prevention:** When a scraper produces data that replaces hand-authored seed data, update or remove the seed data in the source file. Don't leave stale constants that contradict what the scraper actually produces. If a data array is only a type reference, make it empty with a comment — don't leave fabricated values.

## Session: 2026-07-05 (Surgical Dashboard Accuracy Review)

### Lesson: Hardcoded capacity metrics contradicted live data
- **Mistake:** The Surgical Dashboard had three hardcoded capacity metrics that didn't match the actual data: (1) "Chartered Surgical Facilities Share: 34.0%" but actual is 3/20 = 15.0%; (2) "Provincial OR Utilization: 88.5%" but actual mean of non-zero facilities is 89.9%; (3) "ASI Hip/Knee Fast-Track Compliance: 62.0%" with no data source at all. The "11 licensed" facility count in the directory header was also hardcoded but the data has 20 facilities.
- **Solution:** Made all metrics data-driven: `csfShare` computed from `SURGICAL_FACILITIES.filter(chartered).length / total`, `avgOrUtilization` computed as mean of non-zero OR rates, replaced the fake ASI compliance with the real CIHI hip within-benchmark percentage (62% from CIHI comparators). Updated facility count to use `SURGICAL_FACILITIES.length`.
- **Prevention:** Never hardcode a derived statistic that can be computed from data already in the component. When a metric has no data source, don't fabricate one — replace it with a real metric from available data.

### Lesson: KPI cards hardcoded values that matched data but were fragile
- **Mistake:** The 4 KPI cards (Hip 36.8, Knee 43.1, Cataract 15.2, Breast 5.9) were hardcoded in JSX. The values happened to match the data, but if the data updated, the cards would show stale values. The percentage-of-target calculations (141%, 165%, 95%) were also hardcoded.
- **Solution:** Made all KPI values data-driven via `domainData.SURGICAL_RECORDS.find(r => r.id === '...')?.metric_value`. Computed percentages from the values: `Math.round(hipP90 / 26 * 100)`.
- **Prevention:** Even when hardcoded values match the data, always make them data-driven. A hardcoded value that matches today will be wrong tomorrow when the data updates.

### Lesson: Wrong record ID caused Cataract KPI to show 0
- **Mistake:** The cataract KPI lookup used `r.id === 'rec_cataract_prov_90'` but the actual record ID in the data is `rec_cat_prov_90` (abbreviated). The `?? 0` fallback kicked in, showing "0 Weeks" instead of "15.2 Weeks".
- **Solution:** Fixed the ID to `rec_cat_prov_90`.
- **Prevention:** When looking up records by ID, verify the ID exists in the actual data. Don't assume naming conventions — check the source data for the exact ID string.


## Session: 2026-07-05 (Primary Care Dashboard Accuracy Review)

### Lesson: Wrong source label on LiveDataBadge
- **Mistake:** The Primary Care tab's LiveDataBadge said "HQCA FOCUS · Skipped" but the primary care data comes from CIHI Shared Health Priorities, not HQCA FOCUS. HQCA FOCUS is for continuing care. The `sourceLabel` prop in App.tsx was set to "HQCA FOCUS" instead of "CIHI Shared Health Priorities".
- **Solution:** Fixed `sourceLabel` to "CIHI Shared Health Priorities" in App.tsx.
- **Prevention:** Always verify the source label matches the actual data source. Don't copy-paste source labels between different dashboard tabs.

### Lesson: Hardcoded "Data Updated: Q2 2026" was wrong
- **Mistake:** The header said "Data Updated: Q2 2026" but the attachment rate data is from 2024 (reporting_year: "2024"). The data vintage was misleading.
- **Solution:** Replaced with data-driven `Data Vintage: {reportingYear || 'Hand-authored'}` and added "Pipeline skips (CIHI workbook format mismatch)" to be honest about why the pipeline skips.
- **Prevention:** Never hardcode a data vintage date. Always derive it from the actual data's reporting period.

### Lesson: Fake provider directory with 555 phone numbers
- **Mistake:** The "Accepting Providers" directory had 9 hand-authored entries with fake 555 phone numbers (403-555-0143 pattern) but was labeled "Source: Alberta Find a Provider 2026" — implying it was from a real directory.
- **Solution:** Changed label to "Hand-authored sample · Not a live directory" and the KPI badge from "Directory Active" to "Sample Directory".
- **Prevention:** Never imply a live data source for hand-authored sample data. Always label sample data as sample data.

### Lesson: Hardcoded KPI values and quality indicators
- **Mistake:** All 4 KPI cards (83.2%, 9 Clinics, 38.2%, 210.5) and all 4 quality indicators (38.2%, 53.0%, 70.9%, 73.1%) were hardcoded in JSX. The PCN insight text had hardcoded values ($84.55, $87.50, 79.1, 113.8, 110.3) and the LGA cards had hardcoded "Prov Avg: ~102.3".
- **Solution:** Made all values data-driven from ATTACHMENT_RATES, CONTINUITY_SATISFACTION, ED_RELIANCE_BY_CONTINUITY, and PCN_CAPACITY arrays.
- **Prevention:** Never hardcode a value that exists in the data. Always derive from the data source.

### Lesson: Misleading "HQA FOCUS" attribution
- **Mistake:** The ER Overreliance subtab said "HQA FOCUS healthcare datasets demonstrate..." and "Indicators verified from HQA FOCUS & CIHI priority health guidelines" — but this is an analytical model, not verified HQCA FOCUS data.
- **Solution:** Changed to "Analytical model based on CIHI Shared Health Priorities and HQCA FOCUS survey data" and "Unofficial analytical model · CIHI Shared Health Priorities & HQCA FOCUS survey references".
- **Prevention:** Don't claim data is "verified" from a source when it's an analytical model. Always distinguish between source data and analytical models.

## Session: 2026-07-05 (CIHI Workbook Extraction & Provider Directory)

### Lesson: SheetJS community edition cannot handle large XLSX files
- **Mistake:** Tried to use SheetJS (community edition) to parse a 73MB CIHI Indicator Library XLSX (813MB uncompressed sheet1.xml, 822K rows). SheetJS ran out of memory/timeout.
- **Solution:** Rewrote `primaryCareFetcher.ts` to use Python+openpyxl in `read_only` mode via `scripts/extract_cihi_attachment.py`. openpyxl streams rows without loading the entire workbook into memory (~136s for 822K rows).
- **Prevention:** For XLSX files >10MB, use Python openpyxl `read_only=True` instead of SheetJS. SheetJS community edition loads the entire workbook into memory.

### Lesson: CIHI "Indicator segment" column is always "Life Stage"
- **Mistake:** Used the "Indicator segment" column (col 7) to derive demographic groups, but it contains "Life Stage" for all rows.
- **Solution:** Use the "Segment value" column (col 8) which contains actual segment values like "Adults", "Children and youth".
- **Prevention:** Always inspect actual column values before assuming a column contains useful data. Don't trust column names.

### Lesson: Browser test methodology — check full body text, not just first 200 chars
- **Mistake:** When testing Primary Care dashboard subtab switching, checked only the first 200 characters of `document.body.innerText`. The header/nav text occupies the first ~500 chars, so the dashboard content appeared to be "missing" and the page seemed to "revert to home."
- **Solution:** Check the full `document.body.innerText` for specific content strings (e.g., "SEARCH & FILTER CLINICS", "DIRECTORY TEST"). Remember that CSS `uppercase` class makes `innerText` return uppercase text.
- **Prevention:** When verifying page content in browser automation, always search the full body text for specific content markers, not just the first N characters. Account for CSS text-transform (uppercase/lowercase) when matching strings.

## Session: 2026-07-05 (Full 15-Tab Audit & Fix Sprint)

### Lesson: Hardcoded values that duplicate data are the #1 accuracy bug
- **Mistake:** Across 10 of 15 dashboards, KPI cards and narrative text had hardcoded values that duplicated data file values. Examples: SpendingDashboard hardcoded $8,540 (data says $9,598) and "highest among major provinces" (Alberta is 10th of 13); CancerDashboard hardcoded 84.1% radiation compliance (data says 93%); WorkforceDashboard hardcoded 216.4 Alberta avg (actual 320); ContinuingCareDashboard hardcoded 57.3% placement (actual 53.7%); PatientExperienceDashboard hardcoded 4 KPI cards; PublicHealthDashboard hardcoded 10+ respiratory/immunization values.
- **Solution:** Replaced all with data-driven computations from domain data arrays. Used useMemo to compute values from filtered/sorted data.
- **Prevention:** Never hardcode a value that exists in a data file. If a value appears in both the data file and the JSX, it WILL drift. Always derive from `domainData` via useMemo.

### Lesson: Hand-authored data must be labeled as such
- **Mistake:** 8 dashboards had hand-authored data with no disclosure: MentalHealthDashboard claimed "Data Feeds: Recovery Alberta & ABED Registry" (no pipeline exists); PublicHealthDashboard claimed "AHS Respiratory Virus Portal" (hand-authored); DiagnosticDashboard titled a subtab "Live Lab Waits" (static data); VirtualCareDashboard had 0 records written but no notice.
- **Solution:** Added "Hand-authored static dataset" labels, data-vintage notices, and partial-data banners (e.g., "Only Edmonton (Gold Bar) is updated live via PHAC").
- **Prevention:** If a pipeline doesn't exist or writes 0 records, the dashboard MUST say so. Never claim a live data feed that doesn't exist. Label hand-authored data explicitly.

### Lesson: Duplicate IDs cause React key collisions
- **Mistake:** data-cancer.json ALBERTA_CANCER_CENTRES had 5 duplicate IDs (CC-001 through CC-006 each appeared twice). React key={fac.id} caused rendering warnings and potential state bugs.
- **Solution:** Assigned unique IDs (CC-008, CC-010, CC-013, CC-015, CC-017) to the second occurrence of each duplicate.
- **Prevention:** Always verify uniqueness of ID fields in data arrays. Run `grep -o 'CC-[0-9]*' data-cancer.json | sort | uniq -d` to check.

### Lesson: Silent fallback to wrong data is worse than showing "no data"
- **Mistake:** RegionalInequityDashboard silently fell back to TRAVEL_FOR_CARE[4] (Wood Buffalo) for 130 of 135 LGAs that had no travel data. Users saw Wood Buffalo's numbers for any unmatched LGA without knowing.
- **Solution:** Removed the silent fallback. Now shows "Data not available for this LGA" when no matching record exists.
- **Prevention:** Never use a default index fallback for missing data. Show an explicit "no data" state instead.

### Lesson: Radar chart normalization constants must be computed from data
- **Mistake:** RegionalInequityDashboard hardcoded radar max/min constants (168.4, 184.2, 845.1) that didn't match actual data extrema (501, 69.2, 1130.75). This distorted the radar chart scores.
- **Solution:** Computed max/min dynamically from domainData arrays using Math.max/Math.min.
- **Prevention:** Never hardcode chart normalization constants. Always compute from the actual data range.

## Session: 2026-07-05 (Phase 17 — Hard-authored Content Audit & Automation Plan)

### Lesson: ReferenceLine over Line for target benchmarks
- **Mistake:** CancerDashboard used `<Line dataKey="breastTarget">` / `cervicalTarget` / `colorectalTarget` but those fields don't exist on `CancerScreeningZoneRate`. Recharts silently rendered nothing — the target lines were missing from the chart.
- **Solution:** Replaced with `<ReferenceLine y={70}>` / `y={80}` / `y={60}` with labels. Added `ReferenceLine` to the recharts import.
- **Prevention:** When target values are constants (70%, 80%, 60%), use `<ReferenceLine y={N}>` instead of `<Line dataKey="nonexistentField">` which silently renders nothing. Always verify that `dataKey` fields exist on the data type.

### Lesson: Config thresholds should be named constants, not inline magic numbers
- **Mistake:** SystemFlowDashboard had hardcoded `100` / `95` / `24` / `12` in filter conditions and button labels. PatientExperienceDashboard had a 4-branch if/else chain for complaint routing. ContinuingCareDashboard had `60%` / `70%` targets inline.
- **Solution:** Extracted to config objects: `FLOW_THRESHOLDS = { occupancyGridlock: 100, ... }`, `COMPLAINT_ROUTING = [{ keywords: [...], routing: '...' }]`, `PLACEMENT_WITHIN_30_DAYS_TARGET_PCT = 60`.
- **Prevention:** When a number appears in business logic (not just display), extract it to a named constant. If/else chains that map inputs to outputs should be config arrays with `find()`.

### Lesson: New fetchers must gracefully skip when endpoints don't exist yet
- **Mistake:** Built 6 new MEDIUM fetchers (hqcaFocusScraper, albertaRespiratoryVirusScraper, cihiWorkforceFetcher, albertaSubstanceUseScraper, cihiMhSafetyFetcher, ahs-asi retarget). The HQCA FOCUS and Alberta RVD endpoints returned 404 — the data URLs are guessed since the dashboards are interactive.
- **Solution:** All fetchers return `status: 'skipped'` with `recordsFetched: 0` when endpoints return 404 or no parseable data. Existing hand-authored data is never clobbered. The fetchers are ready to work when the correct endpoint URLs are discovered.
- **Prevention:** Always design fetchers to fail gracefully. Return 'skipped' not 'failed' when the upstream simply doesn't have the data. Never overwrite existing data with empty results.

### Lesson: ahs-asi scraper needed retargeting to standardsandlicensing.alberta.ca
- **Mistake:** The ahs-asi scraper targeted `ahs.cc/page15328.aspx` which yielded no structured rows. The real continuing care registry is at `standardsandlicensing.alberta.ca/continuing-care/public-registry`.
- **Solution:** Retargeted URL and added a third parsing strategy for government registry tables with columns like Facility Name | Operator | Type | City | Last Inspection | Status.
- **Prevention:** When a scraper always returns 'skipped', verify the source URL is live. Government sites reorganize — check for the current canonical URL.

### Lesson: CORS whitelist must be env-driven for port flexibility
- **Mistake:** `cloudflare/worker.ts` hardcoded `localhost:3000` in the CORS allowlist, but the dev server runs on port 3004. Any local development against the Worker would fail CORS.
- **Solution:** Made CORS env-driven via `CORS_ORIGINS` env binding with `DEFAULT_CORS_ORIGINS` fallback array.
- **Prevention:** Never hardcode localhost ports in CORS allowlists. Use env bindings with sensible defaults.
## Session: 2026-07-05 (Chart Rendering Fix Sprint)

### Lesson: Recharts animations can leave bars/lines invisible in headless screenshots
- **Mistake:** Multiple dashboard tabs (Cancer, Mental Health, Patient Experience, Primary Care, Health Workforce) appeared to have empty charts during visual QA. DOM inspection showed the SVG paths were present, but screenshots showed only axes and gridlines.
- **Solution:** Added `isAnimationActive={false}` to all `Bar`, `Line`, and `Area` components in static-domain dashboards. This forces Recharts to render the final state immediately instead of relying on an animation that may not complete in headless/browser-automation contexts.
- **Prevention:** When doing automated visual QA, disable Recharts animations globally or per-chart. Always verify the rendered output, not just DOM presence.

### Lesson: Growth-index baselines must be chosen from the relevant time period
- **Mistake:** SpendingDashboard computed cumulative growth indexes from the first row of `ALBERTA_ACTIVITY_VOLUME_TREND` (1975-1976). Many baseline values were zero, producing `NaN`/`Infinity` indexes and hiding all series except spending.
- **Solution:** Changed the baseline to the fiscal year 2021-2022 (the chart's documented base year) and added a `safeIndex` helper to handle any zero bases gracefully.
- **Prevention:** When computing indexed growth, always align the baseline with the chart's documented base period and guard against division by zero.

### Lesson: If backend data is wrong, skip the chart — don't patch the data in the frontend
- **Mistake:** Long Term Care "Wait Times & Placement Timelines" chart showed zero dips and flatlines because `CONTINUING_CARE_PLACEMENT_STATS` contains many records with `daysWaitingP50 = 0` and `daysWaitingP90 = 0` for years/zones where the data wasn't collected. I initially tried averaging and filtering the data in the frontend.
- **Solution:** Reverted the frontend data-manipulation changes and left the chart rendering the data as-is. The fix belongs in the backend pipeline (populate real wait-time values or drop incomplete records), not in the UI layer.
- **Prevention:** Frontend chart fixes should only change how data is rendered, not the data itself. When the data is incomplete or wrong, flag it for the backend/data pipeline instead of patching it in the component.


## Session: 2026-07-05 (MEDIUM Fetcher Sprint Completion)

### Lesson: CIHI indicator data tables follow a predictable URL pattern
- **Fact:** Every CIHI indicator page at `/en/indicators/{slug}` has a data table XLSX at `https://www.cihi.ca/sites/default/files/document/data-file/{id}-{slug}-data-table-en.xlsx`. The numeric ID and slug appear in the indicator page HTML.
- **Implication:** You can systematically discover and fetch all CIHI indicators by paginating the indicator library, extracting XLSX links from each page, and downloading them. Each XLSX has a "Table 1" sheet with a header row, then data rows filtered by Province/Territory.
- **Prevention:** When a data source has a predictable URL pattern, build a generic fetcher that iterates over all indicators rather than hardcoding individual URLs.

### Lesson: CIHI priority procedures XLSX is a comprehensive cross-domain dataset
- **Fact:** The `wait-times-priority-procedures-in-canada-2008-2025-data-tables-en.xlsx` file (871KB) contains 20,510 rows covering cancer surgery waits, joint replacement waits, diagnostic imaging waits, and more — all by province/region/year/metric.
- **Implication:** A single XLSX can populate multiple dashboard domains (cancer, surgical, diagnostic). Classify records by indicator name keywords and route to the appropriate data file.
- **Prevention:** Before building separate fetchers for each domain, check if a single comprehensive dataset covers them all.

### Lesson: Alberta RVD has multiple tabs with embedded Plotly data
- **Fact:** The Alberta Respiratory Virus Dashboard has 5 tabs (summary, severe-outcomes, laboratory-testing, outbreaks, immunizations), each with embedded Plotly JSON traces. The `?data={tab}` query parameter selects the tab.
- **Implication:** A single scraper can fetch all tabs by iterating over the `?data=` parameter, extracting Plotly data from each page, and writing to different data arrays.
- **Prevention:** When a dashboard has multiple tabs/views, check if they all use the same data embedding pattern — one scraper can cover them all.

### Lesson: NOTIFIABLE_DISEASE_INCIDENCE has no structured data endpoint
- **Fact:** Alberta's notifiable disease incidence data is published only in annual PDF reports and individual disease management guidelines on Open Alberta. There is no CSV/XLSX/JSON dataset for case counts.
- **Implication:** This array remains hand-authored. It's a legitimate hand-authored array with no automated source, not a missing fetcher.
- **Prevention:** Not all MEDIUM arrays can be automated. When no structured data endpoint exists after thorough search, document it as hand-authored and move on.

### Lesson: standardsandlicensing.alberta.ca does not have a public facility registry
- **Fact:** The site publishes standards/regulations but does not have a public facility search/registry page. The `/continuing-care/public-registry` path returns 404.
- **Solution:** Use the AHS continuing care page (`albertahealthservices.ca/cc/page15328.aspx`) instead, which lists designated supportive living and long-term care facilities.
- **Prevention:** Before retargeting a scraper to a new URL, verify the URL actually exists and has the expected content.

## Session: 2026-07-05 (Hand-authored Data Verification)

### Lesson: Hand-authored data can be wildly wrong — verify against real sources
- **Mistake:** `NOTIFIABLE_DISEASE_INCIDENCE` claimed 18 measles cases in Alberta 2025. The actual number was **2,008** — a 100x error. `ENVIRONMENTAL_ADVISORIES` had 2 of 4 entries fabricated (Coalhurst boil water advisory doesn't exist; Bow River E. coli advisory was actually a river safety advisory for flow/turbidity, not bacteria). `CONTINUING_CARE_COMPLIANCE` had fabricated inspection dates and violation counts for real facilities.
- **Solution:** Removed all three arrays from the data files AND from the dashboard components. The PublicHealthDashboard lost its 'notifiable' and 'advisories' subtabs. The ContinuingCareDashboard lost its 'compliance' subtab.
- **Prevention:** Every hand-authored array must be web-searched against real sources before display. Round numbers and "plausible" values are not verification. If you can't find a primary source, remove the data.

### Lesson: RVD scraper overwrote hand-authored arrays with incompatible data
- **Mistake:** The `albertaRespiratoryVirusScraper` wrote to `RESPIRATORY_VIRUS_SURVEILLANCE` and `CHILDHOOD_IMMUNIZATION_COVERAGE` keys, overwriting hand-authored data that had different field structures. The scraper wrote `{virus, weekEnding, count}` but the dashboard expected `{virus, season, positivityRatePct, icuAdmissions}`. This caused a runtime `TypeError: Cannot read properties of undefined (reading 'filter')` crash.
- **Solution:** Renamed the scraper output keys to `RVD_RESPIRATORY_CASE_COUNTS` and `RVD_IMMUNIZATION_DOSES` to avoid clashing with hand-authored arrays. Restored the original hand-authored data from `publicHealthData.ts`.
- **Prevention:** Automated scrapers must not write to the same keys as hand-authored data unless they produce identical record schemas. Use a prefix (e.g., `RVD_`) to distinguish scraper-generated data from hand-authored data.

### Lesson: VIRTUAL_MD_COHORT_STUDY data is verified true
- **Fact:** The Virtual MD cohort study data (19,312 patients, 55.7%/60%/52.5% follow-through rates) exactly matches the published study in the Canadian Journal of Emergency Medicine (June 2025).
- **Implication:** Hand-authored data from real research papers can be accurate. The key is verifying against the primary source.

### Lesson: Hand-authored metadata blocks enable transparency
- **Solution:** Added `_handAuthoredMetadata` blocks to each data-*.json file with per-array `source`, `vintage`, `lastVerified`, and `verification` fields. Dashboard components now display "Hand-authored · Verified {date} · {source}" badges near hand-authored data sections.
- **Prevention:** Always label hand-authored data with its source and verification date so users can assess reliability.

## Session: 2026-07-05 (Category 3 Workforce XLSX Sheet Parsing)

### Lesson: Sheet column truncation can silently drop data needed by later parsers
- **Mistake:** The `cihiWorkforceFetcher` truncated the Phyprofile sheet to 16 columns (`decoded.e.c = 15`, column P) to limit the early physician-supply parse. When I added `parseAgeProfile` for `WORKFORCE_AGE_PROFILE_CIHI`, it ran AFTER that truncation and silently got `undefined` for the `65-69`, `70+`, and `<25` columns (which live in columns Q–T). This produced `over65Pct: 0` for all physician groups — a plausible-looking but completely wrong value.
- **Symptom:** Age bins summed to ~89% instead of ~100%, and `over65Pct` was 0 for physicians but correct for nursing/allied (whose sheets were not truncated).
- **Solution:** Removed the Phyprofile column-truncation block entirely. SheetJS handles the full 26-column sheet fine; the truncation was a leftover optimization that became a landmine when a later parser needed the dropped columns.
- **Prevention:** Never mutate a workbook sheet's `!ref` to truncate columns if any downstream parser might need those columns. If you must limit scope, read into a separate object or filter by column at parse time rather than mutating the shared sheet. When adding a new parser to an existing function, audit every prior mutation of the shared sheet object.

## Session: 2026-07-05 (Category 2 Array Verification)

### Lesson: Fabricated doctor names in SPECIALISTS_LIST
- **Mistake:** `SPECIALISTS_LIST` contained 8 doctor names (e.g., "Dr. James Arbour", "Dr. Sarah Tremblay") that do not exist in the CPSA physician registry. All 8 names were fabricated. `SPECIALIST_COMPARISONS` used the same fake names.
- **Solution:** Removed both arrays from data-surgical.json and removed all references from SurgicalDashboard.tsx (interface fields, state, useMemo, JSX, subtabs).
- **Prevention:** Never fabricate individual person names. If you can't verify a doctor exists in the CPSA registry, don't include them. Use aggregate statistics instead.

### Lesson: Zone-level cancer screening rates are not publicly available
- **Mistake:** `CANCER_SCREENING_RATES` claimed zone-level breakdowns (Calgary 66.4% breast, 71.2% cervical). Actual provincial rates are 62.9% breast, 62.4% cervical. Zone-level data is NOT publicly reported by AHS/Screening for Life.
- **Solution:** Removed CANCER_SCREENING_RATES from data-cancer.json and removed the screening subtab from CancerDashboard.tsx.
- **Prevention:** Don't fabricate geographic breakdowns that aren't published. If only provincial-level data exists, show provincial-level data only.

### Lesson: LGA data with population: 0 is placeholder data
- **Mistake:** `REGIONAL_LGA_DEMAND` had `population: 0` and `annualEdVisits: 0` with placeholder text "See Regional Inequity dashboard for full profile". `SERVICE_ACCESS_METRICS` and `TRAVEL_FOR_CARE` used fabricated LGA names with made-up metrics. `LGA_COMMUNITY_NEEDS` used non-standard LGA names with fabricated physician/hospitalization rates.
- **Solution:** Removed all 4 arrays from their respective data files and removed all references from 3 dashboards (SystemFlow, RegionalInequity, PrimaryCare).
- **Prevention:** Zero values and placeholder text are red flags. If you don't have real data for a geographic area, don't create fake data. Remove the feature until real data is available.

### Lesson: ADDICTION_BED_CAPACITIES had mix of real and fake sites
- **Mistake:** 3 of 7 sites were real (Calgary Alpha House 42 beds correct, Lethbridge Recovery Community 50 beds correct, George Spady Society real but wrong bed count: said 30, actual is 41+19=60). 2 sites were fake ("Adanac Recovery Community" doesn't exist, "Grande Prairie Youth Addiction Centre" doesn't exist). Red Deer bed count was wrong (said 40, actual is 75). "Avenue Treatment Centre" could not be verified.
- **Solution:** Replaced all 7 records with verified real data: George Spady Society (Aurora Centre) 41 beds, Calgary Alpha House 42 beds, Lethbridge Recovery Community 50 beds, Red Deer Recovery Community 75 beds, Grande Prairie Recovery Community (planned, opening fall 2027) 50 beds, Lakeview Recovery Community (Gunn) 75 beds, Adeara Recovery Centre (Edmonton) 20 beds. Available beds set to null because real-time bed availability is not publicly published.
- **Prevention:** Verify every facility name against official sources (alberta.ca, organization websites). Real-time bed availability is not publicly available — don't fabricate it. Use null for unknown values.

### Lesson: Facility names real but metrics fabricated
- **Mistake:** `SURGICAL_FACILITIES` (20 records), `FACILITY_COMPARISONS` (10 records), and `FACILITY_IMAGING_WAITS` (8 records) all use real AHS facility names but have fabricated operational metrics (OR utilization rates, waitlist sizes, P50/P90 wait days, surgeon counts).
- **Solution:** Kept the arrays (facility names are real and useful) but added `_handAuthoredMetadata` marking metrics as "estimated" with verification notes explaining that facility names are verified but operational metrics could not be confirmed against published sources.
- **Prevention:** When facility names are real but metrics are fabricated, clearly label the metrics as estimated. Don't present fabricated metrics as verified data.

## Session: 2026-07-05 (Data Timestamps — Phase 22)

### Lesson: server.ts missing /api/data/:domain endpoint
- **Mistake:** Fetch-based dashboards (Cancer, PrimaryCare, Workforce) call `fetch('/api/data/:domain')` but server.ts had no such route. Vite's SPA fallback returned index.html (HTML) instead of JSON, causing `SyntaxError: Unexpected token '<'` and crashing the dashboards.
- **Solution:** Added `/api/data/:domain` endpoint to server.ts that maps domain names to `data-*.json` files and serves them as JSON.
- **Prevention:** When dashboards use `fetch('/api/data/...')`, verify the server has a matching API route. The Vite SPA fallback will silently return HTML for any unmatched route, which fails as JSON.

### Lesson: useSyncStatus getDomainResult crashed on null syncStatus
- **Mistake:** `getDomainResult(syncStatus, 'disruptions')` checked `if (!syncStatus.results)` but didn't check if `syncStatus` itself was null first. When the sync status API returned a response without a `results` array, `syncStatus` was non-null but `results` was undefined, causing "Cannot read properties of undefined (reading 'find')". When `syncStatus` was null (initial load), it crashed with "Cannot read properties of null (reading 'results')".
- **Solution:** Changed to `if (!syncStatus || !syncStatus.results) return null;`.
- **Prevention:** Always null-check the parent object before accessing nested properties. The original code had `if (!syncStatus) return null;` but it was accidentally removed during an edit. Double-check edits don't remove safety guards.

### Lesson: Static-import dashboards need metadata exported from TS data files
- **Mistake:** Added `_dataMetadata` to JSON data files and expected dashboards to use it. But 10 of 15 dashboards use static imports from TS data files (e.g., `import { SUBSTANCE_HARM_TRENDS } from '../mentalHealthData'`), not `fetch('/api/data/...')`. The JSON `_dataMetadata` was invisible to them.
- **Solution:** Exported `_dataMetadata` constants from each TS data file (mentalHealthData.ts, continuingCareData.ts, patientExperienceData.ts, publicHealthData.ts, regionalInequityData.ts, spendingData.ts) and imported them into the dashboards.
- **Prevention:** Know which dashboards use `fetch` vs static imports. Fetch-based dashboards get metadata from the API response. Static-import dashboards need metadata exported from the TS data file.

### Lesson: Vite dev server port conflicts cause stale builds
- **Mistake:** Started `npx vite --port 3004` but port 3004 was already in use. Vite silently moved to port 3006. The browser was still hitting port 3004 (old stale server) while the new server was on 3006.
- **Solution:** Kill all processes on the target port before starting. Use `lsof -ti :3004 | xargs kill -9` first. Verify with `curl` after starting.
- **Prevention:** Always kill existing processes on a port before starting a new server. Verify the server is actually on the expected port with `curl -s -o /dev/null -w "%{http_code}"`.

### Lesson: Subagents may not complete work when assigned multiple files
- **Mistake:** FixGroup3 and FixGroup4 (subagents assigned to add DataTimestamp to 3 dashboards each) reported "completed" but actually added 0 DataTimestamp components to their assigned dashboards. The dashboards had no DataTimestamp imports or usage.
- **Solution:** Verified each dashboard after subagent completion. Found 6 dashboards missing DataTimestamp. Dispatched 2 new subagents to fix them.
- **Prevention:** Don't trust subagent self-reports alone. Verify the actual changes by grepping for the expected imports/components in each file.

## Session: 2026-07-06 (Causal Flow Simulator Removal)

### Lesson: Reverting uncommitted changes can resurrect deleted features

- **Mistake:** Running `git checkout` to resolve a local JSX syntax error reverted all changes in `SystemFlowDashboard.tsx` back to the index state. This clean index state still contained the obsolete `Causal Flow Simulator` (which had been marked for deletion due to simulated/fabricated formula data). Re-applying changes without checking the baseline resulted in accidentally resurrecting the simulator.
- **Solution:** Completely remove the Causal Flow Simulator state (`simulatorStress`, `simulatedValues`), icon imports (`Gauge`), subtab button navigation, and JSX render blocks. Always standard-verify code differences before checking out files.
- **Prevention:** Keep a detailed log of feature exclusions. Re-verify the subtab selection and index state to ensure deleted placeholder simulation components are not reintroduced.

## Session: 2026-07-06 (Data Freshness Language & Timezone Harmonization)

### Lesson: Internal pipeline names and "scrape" language must not reach the UI

- **Mistake:** The standardized last-updated banner in `App.tsx` displayed "Scraped daily" for the disruptions tab fallback, and the `DataTimestamp` component was gutted and returning `null` so per-dashboard banners were missing. Where `DataTimestamp` did render, internal pipeline IDs like `goodcaringScraper`, `ahsAsiScraper`, and `albertaSubstanceUseScraper` would have leaked to users.
- **Solution:** Replaced "Scraped daily" with a dynamic timestamp fallback (or "Updated daily") in `App.tsx`. Restored `DataTimestamp.tsx` to render both full and compact banner layouts. Added a `sanitizeSource()` helper that maps internal pipeline IDs to human labels (e.g., `powerbiScraper` → "Alberta Wait Times Reporting", `albertaSubstanceUseScraper` → "Alberta Substance Use Surveillance"). Forced all date formatting to `timeZone: 'America/Edmonton'` so every banner shows the same Edmonton time.
- **Prevention:** Centralize source-name sanitization in the display component rather than editing every data file. Always use explicit `timeZone` options in `toLocaleString`/`toLocaleDateString` calls for data freshness; never rely on browser-local time. Audit banner text for implementation jargon before shipping.


## Session: 2026-07-07 (Dashboard Trend Panel Interactivity)

### Lesson: Dashboard metrics clickability to show historical trends
- **Mistake:** Dashboard overview/KPI metrics were static and non-interactive, giving users no indication that historical trend data exists behind them.
- **Solution:** Implemented the proven toggle-trend pattern (from SystemFlowDashboard) consistently across all other dashboards. Clickable overview cards are styled with hover:scale-[1.02], active outline borders, tabIndex={0}, and a BarChart2 icon showing "Click to View Trend" / "Active: Hide Trend" labels. AnimatePresence-wrapped AreaCharts expand immediately below the card grid when clicked or key-activated (Space/Enter).
- **Prevention:** Ensure dashboard KPIs that have backing time-series data provide visible affordance of interactivity and render detailed trend panels to give context to latest values.

### Lesson: Recharts AreaChart requires Area/AreaChart imports, not LineChart/Line
- **Mistake:** Added `LineChart` and `Line` imports to Recharts in `ContinuingCareDashboard.tsx` and `SurgicalDashboard.tsx` even though the trend panels were changed to render `AreaChart` and `Area`. This introduced unused imports.
- **Solution:** Cleaned up unused Recharts imports to prevent TypeScript build warnings/errors.
- **Prevention:** Always match imports exactly with the JSX elements actually rendered in the file.

### Lesson: Map trend years to actual populated data years to prevent NaN values
- **Mistake:** Toggled trend stats and charts mapped a static list of years `['2021', '2022', '2023', '2024', '2025']` for continuing care, but the dataset `CONTINUING_CARE_PLACEMENT_STATS` only had records for 2021, 2023, and 2025. This caused the chart and stats calculation to divide by zero on unpopulated years, leading to `NaN` values.
- **Solution:** Restricted the years array to only contain populated years: `['2021', '2023', '2025']`.
- **Prevention:** When computing aggregations over year groups, verify that the dataset contains records for all mapped years, or filter out NaN values dynamically from the computed series.

### Lesson: Subagents may silently fail to write files they report as completed
- **Mistake:** The `ContinuingCareTrend` subagent claimed completion but did not actually write its modifications to `ContinuingCareDashboard.tsx`, leaving it with no changes and no diff.
- **Solution:** Manually verified the file changes in the workspace, implemented the clickable trend cards and trend panels in `ContinuingCareDashboard.tsx` directly, and confirmed a clean project-wide compile.
- **Prevention:** Do not rely solely on subagent execution logs. Always verify file diffs and search for key symbols (`AnimatePresence`, `motion`) in the target files before declaring success.


## Session: 2026-07-07 (Diagnostic Lab Waits — 30-Minute Updates via APL REST API)

### Lesson: Hidden REST API behind a Blazor/SignalR frontend
- **Mistake:** The QMe booking site (`qme.albertaprecisionlabs.ca`) is a Blazor Server + SignalR app with reCAPTCHA Enterprise + Altcha anti-bot. Initial investigation assumed Puppeteer browser automation was the only way to get lab wait times — a fragile, slow, resource-intensive approach. A competing plan discovered a hidden REST API (`qmeapi.albertaprecisionlabs.ca/api/location`) that the Blazor frontend calls internally.
- **Solution:** Verified the REST API directly with `curl`: `GET https://qmeapi.albertaprecisionlabs.ca/api/location` returns 153 lab sites with `WaitTime`, `SaveMyPlace`, coordinates, hours — no auth, no captcha, open CORS, 46ms response. Built a simple axios fetcher (`aplLabWaitTimesFetcher.ts`) modeled on `erWaitTimesFetcher.ts`, not a Puppeteer child process. The entire Puppeteer/Blazor/SignalR/captcha path was dropped.
- **Prevention:** Before committing to browser automation for a JS-rendered site, audit the site's network traffic for internal REST APIs. Blazor Server apps often have a companion API domain (e.g., `qmeapi.*` alongside `qme.*`). A `curl` probe takes 5 seconds and can eliminate hours of fragile scraper work.

### Lesson: Static TS imports silently defeat runtime data updates
- **Mistake:** `DiagnosticDashboard.tsx` imported `LAB_LOCATION_WAITS` directly from `../diagnosticData` (a build-time TypeScript constant). Even though the `/api/data/:domain` endpoint existed and the fetcher wrote to `data-diagnostic.json` every 30 min, the dashboard never re-fetched — users saw bundled constants forever. The Phase 3 "fetch conversion" from an earlier sprint never reached this dashboard.
- **Solution:** Converted the dashboard to `fetch('/api/data/diagnostic')` + `useState`/`useEffect`, mirroring the `App.tsx` `/api/hospitals` pattern. All five data arrays now read from fetched state with null guards in every `useMemo`.
- **Prevention:** When a dashboard is supposed to show live data, verify it actually calls `fetch` at runtime — not just that the endpoint exists. A static import is a build-time snapshot; only a runtime fetch sees updates. Grep for `fetch('/api/data/` in the component to confirm.

### Lesson: Code mapping between hand-authored and API data is often infeasible — replace, don't merge
- **Mistake:** The plan initially proposed mapping 52 hand-authored lab records to 153 API sites by code. Only 1 of 52 codes matched (`SHCC`). Name matching was also unreliable (22/52 fuzzy). The hand-authored list was hospital-based; the API is community-site-based — largely different locations.
- **Solution:** Replaced `LAB_LOCATION_WAITS` entirely with the 153 API sites. Made `dailyVolume` and `peakHours` optional in the `LabLocationWait` interface (the API doesn't provide them; they were unverified estimates anyway). Hid the Peak Hours / Daily Volume UI boxes when the fields are absent.
- **Prevention:** When replacing hand-authored data with a live API, don't assume codes or names match. Test the overlap first. If the overlap is low, replace entirely rather than building a fragile mapping table. Make hand-authored-only fields optional and hide the UI when they're absent.

### Lesson: Scheduler dynamic imports are intentional — don't refactor to static
- **Mistake:** The scheduler uses `await import('./pushClient')` and `await import('./syncStatus')` inside pipeline functions. This looks like a violation of the "no dynamic imports" rule, but the dynamic imports are intentional: they lazy-load the push client only when a push actually happens, avoiding circular dependency issues at module load time.
- **Solution:** Matched the existing dynamic import pattern when adding `runLabWaitsPipeline()`. Did not refactor the existing `runErWaitTimesPipeline` or `runDailySync` to static imports.
- **Prevention:** When adding new code to an existing module, match the established pattern even if it looks suboptimal. The pattern may exist for a reason (circular deps, lazy loading, conditional initialization). Refactoring existing code is scope creep — do it in a dedicated cleanup sprint, not while adding a feature.

## Session: 2026-07-07 (Lab Wait Trend Logging — Snapshot Layer & Charting)

### Lesson: parseWaitTime had a pre-existing accumulation bug — totalMins was never summed
- **Mistake:** `parseWaitTime()` in `aplLabWaitTimesFetcher.ts` matched `hrMatch` and `minMatch` but returned `totalMins` (always 0) without first adding `parseInt(hrMatch[1]) * 60` and `parseInt(minMatch[1])`. Every numeric lab wait would have been logged as 0 minutes in snapshots.
- **Solution:** Added the two `totalMins +=` lines before the `if (hrMatch || minMatch) return totalMins` guard.
- **Prevention:** When adding logging that depends on an existing parser, unit-test the parser with real inputs ("1 hr 30 min", "45 min") before relying on its output. A parser that returns the right type but wrong value is worse than one that throws.

### Lesson: Snapshot retention must scale with site count, not copy the ER fetcher blindly
- **Mistake:** Mirrored the ER fetcher's 365-day retention for lab snapshots. But 153 labs × 48 fetches/day × 365 days ≈ 2.7M entries (~400MB) loaded into memory and rewritten every 30 min — the ER fetcher has far fewer sites so 365 days is fine there.
- **Solution:** Capped lab retention to 90 days (~660K entries, ~100MB), preserving seasonal trend visibility without unbounded growth.
- **Prevention:** When copying a pattern from one pipeline to another, scale the retention/cadence parameters by the new data volume. Don't assume the same numbers work for a 10× larger site count.

### Lesson: APL API returns "Closed" for all 153 sites overnight — empty snapshots are expected, not a bug
- **Mistake:** After running the fetcher at 3 AM, `data-lab-snapshots.json` was `[]` and it looked like the logging layer was broken. In fact the APL API genuinely returns `WaitTime: "Closed"` for every site overnight — the sentinel is correctly skipped by the `typeof waitTimeMin === 'number'` guard.
- **Solution:** Verified the raw API response (all 153 `Closed`), then unit-tested the snapshot append logic with synthetic numeric/sentinel inputs to confirm 4/6 numeric waits were logged and 2 sentinels skipped.
- **Prevention:** When a data pipeline produces empty output, check the source API's actual response first — it may be a time-of-day artifact, not a code bug. Keep a synthetic test handy to prove the logging path works independently of source data availability.

## Session: 2026-07-07 (Trend KV Push Pipeline — Deployed Parity)

### Lesson: ER trend KV keys were never pushed — the entire deployed trend pipeline was broken
- **Mistake:** The Cloudflare worker reads pre-computed keys (`trends-all-24h`, `trends-zones-7d`, `trends-max-stats`, `trends-${hospitalId}-30d`) from `SNAPSHOTS_KV`, but no code anywhere computed or pushed those keys. The push endpoint only wrote to `DATA_KV` as `data-${domain}`. So the deployed dashboard's ER trend charts were all empty unless someone manually seeded KV.
- **Solution:** Created `trendsPusher.ts` that computes all trend aggregates from in-memory snapshots and pushes them as a `{ kvKey: value }` map. Extended the worker push endpoint to route snapshot domains (`er-trends`, `lab-trends`) to `SNAPSHOTS_KV` and iterate the map, writing each key individually.
- **Prevention:** When adding a worker read endpoint that reads from KV, trace the full write path — who computes and pushes that key? A read endpoint with no writer is dead code.

### Lesson: Per-facility KV pushes don't scale — 153 labs × 3 ranges = 459 writes per cycle
- **Mistake:** Initially planned to push per-lab and per-hospital trend keys to KV. 153 labs × 3 ranges = 459 KV writes every 30 min, and 29 hospitals × 3 ranges = 87 writes every 10 min. Cloudflare may rate-limit or reject this volume.
- **Solution:** Only push provincial/zone/max-stats aggregates to KV (7 keys for ER, 3 for labs). Per-facility trends are served by the local server from in-memory snapshots. The deployed dashboard shows provincial trends; per-facility detail is local-only.
- **Prevention:** When pushing to Cloudflare KV, count the keys × frequency. KV is not designed for high-volume per-entity writes. Aggregate at the push layer and keep per-entity queries on the local server.

## Session: 2026-07-07 (System Flow Auto-Update & Daily Sync Reliability)

### Lesson: Subagent edits can be silently lost in a busy working tree
- **Mistake:** Two subagents reported completing changes (adding `daily-sync` to `package.json`, fixing `syncStatus.ts` to treat `manual` as non-failure), but the edits did not persist in the final working tree. A third agent's write to `scheduler.ts` and a stash/re-apply cycle in `SystemFlowDashboard.tsx` likely clobbered the package.json and syncStatus.ts changes. The result was a broken `npm run daily-sync` and a `data-sync-status.json` still showing `status: "failed"` after a successful daily run.
- **Solution:** Parent agent verified every claimed change by re-reading the file and re-running the affected command. Re-applied the missing `package.json` script, re-applied the `syncStatus.ts` rollup fix, and added `'manual'` to the `SyncStatus` union in `types.ts`.
- **Prevention:** When multiple agents touch the same repo, do not trust "it passed" reports from subagents without reading the actual file or running the command that exercises the change. Parent agent must own final verification.

### Lesson: Static `import type` and static module imports are enforced project rules
- **Mistake:** `scheduler.ts` used dynamic `await import('./pushClient')` and `await import('./trendsPusher')` inside functions. The project rules require static imports for modules known at author time, and the linter/type checker rejected this pattern. After rewriting `scheduler.ts` to remove the dead daily `setInterval`, the dynamic imports also had to be converted to static imports.
- **Solution:** Replaced all dynamic imports in `scheduler.ts` with top-level static imports (`pushToCloudflare`, `pushErTrends`, `pushLabTrends`, `runAplLabWaits`). This made the module dependency graph explicit and satisfied the rule.
- **Prevention:** Read the project rules before editing. Prefer static imports by default; reserve dynamic imports for genuinely runtime-selected module specifiers.

### Lesson: Multiple writers to one JSON file need a shared metadata merge contract
- **Mistake:** Three pipelines (`acuteCareScraper`, `ahsWeeklyEdLosScraper`, `cihiMhSafetyFetcher`) all read-modify-write `data-system-flow.json`. Adding a top-level `_dataMetadata` block risked one writer clobbering another's metadata entries on every run.
- **Solution:** Created a shared `metadataHelpers.ts` with `buildMetadataEntry()` and `mergeDataMetadata()`. Each writer only stamps metadata for the arrays it owns, merging into the existing `_dataMetadata` object so sibling entries survive. Verified by re-running each scraper individually and confirming the other writers' entries remained byte-identical.
- **Prevention:** When several writers share a JSON file, never let any writer replace the whole metadata block. Establish a merge helper and per-writer ownership of keys before the first writer is modified.

### Lesson: `setInterval(24h)` in the server is unreliable for daily sync
- **Mistake:** The daily orchestrator ran inside the long-lived Express server via `setInterval(24h)`. This drifts, resets on every restart, and couples the heavy daily work (Puppeteer/CIHI) to the web server process. A crash in the daily sync could take the server down.
- **Solution:** Decoupled the daily sync into a standalone `src/pipelines/dailySync.ts` run by `npm run daily-sync`. Added a second launchd job (`com.alberta-hospital-pipeline-daily.plist`) with `StartCalendarInterval` at 06:00 MT, independent of the server. Removed the 24-hour `setInterval` from `scheduler.ts`; the server now only schedules fast ER (10 min) and lab (30 min) cycles.
- **Prevention:** Heavy, once-a-day batch work should not run inside the serving process. Use calendar-scheduled one-shot jobs (launchd, cron) for daily work and keep the server focused on fast, stateless intervals.

### Lesson: "Manual" pipeline results must not be counted as failures
- **Mistake:** `syncStatus.ts` rolled up daily results as `allSuccess ? 'success' : anyFailed || anyPartialOrSkipped ? 'partial_success' : 'failed'`. Pipelines returning `status: 'manual'` (sources that are blocked or partial) fell through to `'failed'`, so `data-sync-status.json` showed the entire daily run as failed even when 23/31 pipelines succeeded.
- **Solution:** Updated `recordDailySyncResults()` to treat `manual` as a non-failure status: success + manual → `partial_success`; only manual (no success) → `manual`; any failed → `partial_success` if there are successes, otherwise `failed`. Added `'manual'` to the `SyncStatus['status']` union.
- **Prevention:** Every distinct `SyncResult['status']` value must be handled explicitly in the rollup. Do not let a status fall through to a default that misrepresents the outcome.

### Lesson: agent-browser CLI refs are per-snapshot and `--headless` can be parsed as JS
- **Mistake:** Tried to reuse `[ref=e3]` from an earlier `agent-browser snapshot` after navigating the page again; refs are regenerated on each snapshot, so the click failed. Also tried `agent-browser eval "..." --headless`, but the CLI appended `--headless` into the evaluated JS string, causing `ReferenceError: headless is not defined`.
- **Solution:** Capture a fresh snapshot immediately before using refs, or use stable selectors (text/CSS) instead of refs. For `eval`, omit the `--headless` flag if the session is already headless, or check the CLI help for the correct global-option position.
- **Prevention:** Treat agent-browser refs as ephemeral. Use stable selectors for reusable scripts, and be careful with flag ordering on commands that take a free-form JS string argument.


### Lesson: Map centering must account for nearby hospitals and container sizing
- **Mistake:** `MapComponent.tsx` centered the map on the user's location with `map.setView([userLocation.lat, userLocation.lng], 8)`, but the marker appeared off-center in the viewport. The map container was still resizing, `invalidateSize()` ran independently, and the selected-hospital effect could override the user location. Also, `fitBounds` with every hospital would zoom out to the entire province.
- **Solution:** Switched to `map.fitBounds()` that includes the user plus hospitals within 100 km. Called `map.invalidateSize()` before the view change. Added a fallback `setView` to the user's location at zoom 11 when no nearby hospitals exist. Added `hospitals` to the effect dependency array so the map re-centers when nearby hospitals load after the location is set.
- **Prevention:** When centering a map on a user point, consider the surrounding context (nearby markers, container size, concurrent effects). Use `fitBounds` with a limited radius and `invalidateSize()` before view changes to avoid viewport drift.