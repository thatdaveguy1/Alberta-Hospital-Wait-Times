# Alberta Hospital Wait Times — Auto-Update Pipeline Tracker

## Phase 0: Project Setup & Conventions
- [x] Create `lessons.md`
- [x] Update `readme.md` with real project overview
- [x] Create `src/pipelines/` directory and `types.ts`

## Phase 1: Fix ER Wait Times (10-min interval)
- [x] Change ER fetch interval from 15 min to 10 min
- [x] Move disruptions to daily schedule
- [x] Remove fake `syncOtherDatasetsDaily()` body
- [x] Add `lastUpdated`/`nextUpdate` to `/api/health`
- [x] Update DASHBOARDS `updateFrequency` label

## Phase 2: Service Disruptions — Real Scraper
- [x] Write `src/pipelines/disruptionsScraper.ts` (parse AHS HTML, discover new entries)
- [x] Replace `fetchAndSyncDisruptions()` with new scraper
- [x] Create `data-disruption-overrides.json` for hand-authored text
- [x] Move disruptions to 24-hr schedule

## Phase 3: Data Storage Refactor (JSON per domain)
- [x] Extract 13 `*Data.ts` const arrays into 13 JSON files
- [x] Add `GET /api/data/:domain` endpoint
- [x] Update 13 dashboard components to fetch from API
- [x] Add loading/error states to dashboards
- [x] Keep TypeScript interfaces in `*Data.ts`, remove consts

## Phase 4: Tier 1 API Pipelines
- [x] 4a: StatsCan WDS fetcher (rewritten to CSV download flow — SDMX endpoint was dead)
- [x] 4b: PHAC Health Infobase fetcher
- [x] 4c: Open Alberta CKAN fetcher

## Phase 5: Tier 2 Scraper Pipelines
- [x] 5a: waittimes.alberta.ca scraper (surgical)
- [x] 5b: ABJHI orthopedic scraper
- [x] 5c: AHS ASI scraper
- [x] 5d: Acute Care Alberta scraper
- [x] 5e: CPSA physician registry scraper
- [x] 5f: GoodCaring QA fallback scraper

## Phase 6: Tier 3 File Download Pipelines
- [x] 6a: CIHI XLSX downloader + parser (URL fixed to /en/national-health-expenditure-trends)
- [x] 6b: Fraser Institute PDF downloader + parser (URL fixed to /studies/health-care)
- [x] Add `xlsx` and `pdf-parse` to package.json

## Phase 7: Tier 4 Manual Update Mechanism
- [x] Manual upload endpoint `POST /api/data/:domain/upload`
- [x] `data-manual-overrides/` directory with empty JSON files
- [x] Daily merge of manual overrides into domain data

## Phase 8: Daily Sync Orchestrator
- [x] Write `src/pipelines/orchestrator.ts`
- [x] Replace fake sync with real orchestrator
- [x] Add per-domain trigger endpoint
- [x] Comprehensive `/api/sync/status` with per-pipeline breakdown

## Phase 9: Frontend — Live Data Indicators
- [x] Add "Last updated" + "Next update" to each dashboard
- [x] Add pipeline health indicator (green/yellow/red)
- [x] Add manual "Refresh data" button per dashboard
- [x] Update DASHBOARDS `updateFrequency` labels to accurate values
- [x] Add global Pipeline Status panel

## Phase 10: Cloudflare Worker + KV Deployment (Thin Read Layer)
- [x] Create `cloudflare/` directory with Worker code (Hono)
- [x] Write `cloudflare/worker.ts` — GET endpoints (read KV) + POST /api/push/:domain (auth-protected)
- [x] Create `cloudflare/wrangler.toml` with KV namespaces (no cron triggers)
- [x] Deploy Worker to Cloudflare test environment
- [x] Deploy frontend to Cloudflare Pages
- [x] Set PUSH_SECRET env var in Cloudflare dashboard
- [x] Seed KV with initial data

## Phase 11: Local Push Client + launchd Scheduling
- [x] Write `src/pipelines/pushClient.ts` (HMAC-signed POST with retry)
- [x] Integrate push call into every pipeline's write step
- [x] Write `src/pipelines/scheduler.ts` (replaces setInterval in server.ts)
- [x] Create launchd plist `com.alberta-hospital-wait-times.plist`
- [x] Add `npm run pipeline` and `npm run push:all` scripts to package.json
- [x] Document launchd setup in `src/pipelines/README.md`

## Fix 1: Env Vars & launchd
- [x] Set PUSH_SECRET and CLOUDFLARE_WORKER_URL in `.env` and plist
- [x] Add `import 'dotenv/config'` to `server.ts` line 1
- [x] Load launchd plist via `launchctl load`
- [x] Verify server running under launchd on port 3004

## Fix 2: Upstream Source URLs
- [x] StatsCan: Rewrote fetcher from dead SDMX endpoint to WDS REST CSV download flow (PID 14100371)
- [x] CIHI: Fixed URL from dead `/en/health-spending-data` to `/en/national-health-expenditure-trends`
- [x] Fraser: Fixed URL from dead `/categories/health-spending` to `/studies/health-care`

## Fix 3: Code-Splitting
- [x] Convert 13 dashboard imports to `React.lazy()` in `App.tsx`
- [x] Wrap conditional render in `<React.Suspense>` with loading fallback
- [x] Add `manualChunks` to `vite.config.ts` (recharts, leaflet, lucide-react, motion)
- [x] Entry chunk reduced from 1,609 kB → 314 kB (80% reduction)
- [x] Redeployed to Cloudflare Pages

## Phase 12: 7 New Pipelines for Static Tabs
- [x] Research data sources for all 7 tabs in parallel (CIHI, HQCA, Open Alberta, PubMed)
- [x] Build `cihiWaitTimesDownloader.ts` — CT/MRI + cancer surgery + radiation therapy from CIHI XLSX
- [x] Build `primaryCareFetcher.ts` — CIHI Indicator Library XLSX (attachment rates)
- [x] Build `hqcaContinuingCareFetcher.ts` — HQCA FOCUS CSV + CIHI antipsychotics XLSX
- [x] Build `openAlbertaInequityFetcher.ts` — Open Alberta CKAN LGA community profiles
- [x] Rewrite `cihiDownloader.ts` — CIHI NHEX 2025 ZIP (was looking for 2026)
- [x] Build `virtualCareFetcher.ts` — PubMed API + AHS news
- [x] Build `ahsCancerCentresScraper.ts` — AHS cancer centre directory
- [x] Fix XLSX.readFile → XLSX.read(buffer) for ESM compatibility
- [x] Fix CIHI XLSX !ref column clamp (16K columns → 10)
- [x] Fix CIHI indicator name casing (Title Case, not lowercase)
- [x] Fix broken AHS URLs (Page13363 → page15328, Page16490 → Page18670)
- [x] Register all 7 pipelines in orchestrator (18 total pipelines now)
- [x] Typecheck: zero errors
- [x] Run all 7 pipelines individually — all succeed or skip gracefully
- [x] Push all 15 data files to Cloudflare KV
- [x] Deploy to Cloudflare Pages and verify all 14 tabs render


## Phase 13: Surgical Dashboard Accuracy Review (2026-07-05)
- [x] Review Surgical Wait Times Portal against 3 criteria (auto-update, accuracy, all hospitals)
- [x] Verify 24-hr auto-update: powerbiScraper (119 records) + abjhiScraper (24 records) both succeed daily
- [x] Fix KPI cards: replace hardcoded values (36.8, 43.1, 15.2, 5.9) with data-driven lookups from SURGICAL_RECORDS
- [x] Fix KPI percentage-of-target: compute from data (142%, 166%, 95%) instead of hardcoded (141%, 165%, 95%)
- [x] Fix CSF Share: 34.0% hardcoded → 15.0% computed from SURGICAL_FACILITIES (3 chartered / 20 total)
- [x] Fix OR Utilization: 88.5% hardcoded → 89.9% computed as mean of non-zero facilities
- [x] Replace fake "ASI Hip/Knee Fast-Track Compliance 62.0%" with real CIHI hip within-benchmark (62%)
- [x] Fix facility count: "all 11 licensed" → data-driven "all 20" from SURGICAL_FACILITIES.length
- [x] Fix Cataract KPI showing 0: wrong record ID `rec_cataract_prov_90` → correct `rec_cat_prov_90`
- [x] Make StatsCan impact categories data-driven from STATSCAN_SATISFACTION_STATS
- [x] Review all 4 subtabs: Provincial Overview, Orthopedics & Historical Trends, Head-to-Head Comparisons, StatsCan Patient Survey
- [x] Deploy to Cloudflare Pages test branch
- [x] Update lessons.md with 3 new lessons

## Phase 14: Primary Care Dashboard Accuracy Review (2026-07-05)
- [x] Review Primary Care page against 3 criteria (auto-update, accuracy, all hospitals)
- [x] Criterion 1 (24hr auto-update): FAIL — primaryCareFetcher pipeline SKIPS every run (CIHI workbook format mismatch). Data is static hand-authored from July 4. Only ATTACHMENT_RATES would be updated; other 5 arrays always hand-authored.
- [x] Fix source label: "HQCA FOCUS" → "CIHI Shared Health Priorities" in App.tsx
- [x] Fix "Data Updated: Q2 2026" → data-driven "Data Vintage: {reportingYear}" with pipeline skip note
- [x] Add "Unofficial · Not AHS/CIHI Endorsed" provenance badge
- [x] Make 4 KPI cards data-driven (attachmentRate, totalAcceptingCount, sameDayAccess, minorConditionEdRate)
- [x] Fix "Source: Alberta Find a Provider 2026" → "Hand-authored sample · Not a live directory"
- [x] Make 4 quality indicators data-driven from CONTINUITY_SATISFACTION Alberta row
- [x] Make PCN insight text data-driven (funding, providers per 100k for all zones)
- [x] Make LGA "Prov Avg" data-driven from PCN_CAPACITY Alberta row
- [x] Fix "HQA FOCUS" attribution → "Analytical model based on CIHI & HQCA FOCUS"
- [x] Fix "Indicators verified from HQA FOCUS" → "Unofficial analytical model"
- [x] Make "16.8% unattached" data-driven from (100 - attachmentRate)
- [x] Fix "Supplement Supplement" typo in AHCIP source label
- [x] Review all 5 subtabs: Attachment & Access, Accepting Providers, Community Need (LGA), PCN Capacity, ER Overreliance Link
- [x] Update lessons.md with 5 new lessons

## Phase 15: CIHI Workbook Extraction & Real Provider Directory (2026-07-05)
- [x] Build `scripts/extract_cihi_attachment.py` — Python+openpyxl `read_only` mode for 73MB CIHI workbook (822K rows)
- [x] Rewrite `primaryCareFetcher.ts` — replace SheetJS with Python subprocess, extract 59 real CIHI attachment rates
- [x] Remove all dead SheetJS-based functions from primaryCareFetcher.ts
- [x] Build `albertaFindAProviderScraper.ts` — scrape 2,214 real providers from 547 clinics via albertafindaprovider.ca JSON API
- [x] Register albertaFindAProvider in orchestrator
- [x] Fix provider data: add `languages: []` and `gender: 'Co-ed'` defaults for all 2,214 providers
- [x] Fix null-safety: `prov.languages.join(', ')` → `(prov.languages ?? []).join(', ') || '—'`
- [x] Update PrimaryCareDashboard KPI to pick latest year (sort by reporting_year descending)
- [x] Update chart to filter to latest year only
- [x] Make Canada Avg reference line data-driven
- [x] Make "Critical Vulnerability" insight text data-driven (lowIncomeRate, youngAdultsRate, ruralRate, seniorsRate)
- [x] Update data-sync-status.json: primaryCareFetcher → success, add albertaFindAProvider result
- [x] Fix `as any` on needsSortBy select → proper union type cast
- [x] Fix `any` on Tooltip formatter → `number` type
- [x] Verify all 5 subtabs work in browser (Attachment, Providers, Community Need, PCN, ER Link)
- [x] Update lessons.md with CIHI extraction and browser testing lessons

## Phase 16: Full 15-Tab Audit & Fix Sprint (2026-07-05)
- [x] Dispatch 5 parallel auditors to review all 15 tabs against 3 criteria (auto-update, accuracy, hospital coverage)
- [x] **SpendingDashboard**: Replace hardcoded $8,540 → data-driven $9,598; remove false "highest among provinces" → rank #10 of 13; fix +8.1% growth → computed 3.9%; fix broken comparison delta; skeleton zero-value cards; add hand-authored disclosure
- [x] **CancerDashboard**: Replace hardcoded 84.1%/92.1% radiation → data-driven 93%/97%; fix P50 10d → 12d, P90 25d → 23d; fix "nearly 40%" → 45%; label compliance estimates; fix 5 duplicate cancer centre IDs
- [x] **DiagnosticDashboard**: Fix "Q1 2026 Release" → "Imaging auto-updated daily · Lab curated"; rename "Live Lab Waits" → "Lab Location Waits"; fix chart subtitle 2019 → 2018; add facility coverage disclosure
- [x] **WorkforceDashboard**: Fix wrong Alberta avg 216.4 → 320; fix source label "Open Alberta" → "CPSA"; fix "FFS Physicians" → "Registered Physicians"; replace hardcoded nursing chart with data-driven; add Hand-authored labels
- [x] **PatientExperienceDashboard**: Replace 4 hardcoded KPI cards with data-driven; fix "HQA" typo → "HQCA"; add Central + South Zone to safety subtab; add Hand-authored labels
- [x] **ContinuingCareDashboard**: Replace hardcoded 57.3%/25d/67.5% → data-driven 53.7%/25d/62.5%; derive restraint rate from data; fix "HQA" → "HQCA"; add compliance registry disclosure
- [x] **PublicHealthDashboard**: Add Edmonton-only wastewater banner; fix misleading source header; replace 10+ hardcoded respiratory/immunization values with data-driven; fix `as any`; fix Grande Prairie population 680k → 70k
- [x] **RegionalInequityDashboard**: Replace 9 hardcoded provincial averages with dynamic PROVINCIAL_BENCHMARKS; fix radar normalization constants; fix silent Wood Buffalo fallback → "Data not available"; fix "132 LGAs" → 135; fix `any` types
- [x] **MentalHealthDashboard**: Remove false "Data Feeds: Recovery Alberta & ABED Registry" → "Hand-authored static dataset"; clean SUPPORT_HELPLINES garbage data; fix frozen "Today" timestamps; fix Crisis Text Line number 741 → 741741
- [x] **VirtualCareDashboard**: Add data-vintage notice (0 records written); fix PADIS 45,000 → 46,000 from data; label program-reported estimates; add Hand-curated labels
- [x] **ServiceDisruptionsDashboard**: Fix stat-card undercount (add Service Suspension category); fix `catch (err: any)` → `unknown`; remove redundant res.ok check
- [x] Verify all 15 tabs render in browser with no console errors
- [x] `npx tsc --noEmit` passes with exit 0
- [x] Update lessons.md with 5 new audit lessons

## Phase 17: Hand-authored Content Audit & Automation Plan (2026-07-05)
- [x] Catalog 51 hand-authored data arrays across 19 data-*.json files (7 EASY, 35 MEDIUM, 9 HARD)
- [x] Write comprehensive implementation.md plan with 7 phases
- [x] **Phase 1**: Fix CancerDashboard broken target reference lines (LIVE BUG — ReferenceLine over nonexistent dataKey)
- [x] **Phase 2A**: Fix MentalHealthDashboard 3+1 duplicates (opioidSummary useMemo)
- [x] **Phase 2B**: Fix VirtualCareDashboard 4 duplicates (selfCareDispositionPct, emsDiversionByDisposition)
- [x] **Phase 2C**: Fix SpendingDashboard 1 duplicate block (billingSummary useMemo)
- [x] **Phase 2D**: Fix PublicHealthDashboard 95% target (already data-driven)
- [x] **Phase 2E**: Fix RegionalInequityDashboard 90% education target (PROVINCIAL_EDUCATION_TARGET_PCT)
- [x] **Phase 2F**: Fix SurgicalDashboard 182-day benchmark (CIHI_HIP_KNEE_BENCHMARK_DAYS)
- [x] **Phase 2G**: Fix ContinuingCareDashboard 60%/70% targets (PLACEMENT_*_TARGET_PCT constants)
- [x] **Phase 2H**: Fix WorkforceDashboard 140 normalization (alliedMaxRate useMemo)
- [x] **Phase 3A**: Extract SystemFlowDashboard quadrant thresholds (FLOW_THRESHOLDS config)
- [x] **Phase 3B**: Extract PatientExperienceDashboard complaint routing (COMPLAINT_ROUTING config)
- [x] **Phase 3C**: Extract ZONE_BY_CITY to data-zone-by-city.json
- [x] **Phase 6A**: Fix CORS whitelist env-driven (CORS_ORIGINS env binding)
- [x] **Phase 6B**: Delete dead data-manual-overrides/ directory
- [x] **Phase 6C**: Fix pipelines README (remove phantom files, add missing pipelines, document local-only deps)
- [x] **Phase 6D**: Add deploy scripts to package.json (deploy:worker, deploy:pages, seed:kv, gen:push-secret)
- [x] **Phase 4A**: Extend cihiWaitTimesDownloader (ProvincialComparator, HistoricalWaitTrend, runSurgical)
- [x] **Phase 4B**: Extend openAlbertaInequityFetcher (runPrimaryCare for LGA needs)
- [x] **Phase 4C**: New openAlbertaBillingFetcher (PHYSICIAN_SPECIALTY_BILLING)
- [x] **Phase 4D**: New alberta211Scraper (SUPPORT_HELPLINES, ADJACENT_HELPLINES)
- [x] **Phase 4E**: Extend phacFetcher for non-Edmonton wastewater (fetchNonEdmontonWastewater)
- [x] **Phase 5A**: Retarget ahs-asi scraper for continuing care compliance (standardsandlicensing.alberta.ca)
- [x] **Phase 5B**: New hqcaFocusScraper (HQCA FOCUS dashboard)
- [x] **Phase 5C**: New albertaRespiratoryVirusScraper (Alberta RVD)
- [x] **Phase 5D**: New cihiMhSafetyFetcher (mental health + clinical safety indicators)
- [x] **Phase 5E**: New cihiWorkforceFetcher (physician/nurse/allied supply)
- [x] **Phase 5F**: New albertaSubstanceUseScraper (opioid deaths, EMS responses)
- [x] Register all 10 new pipelines in orchestrator (27 total pipelines now)
- [x] `npx tsc --noEmit` passes with exit 0
- [x] Verify all 15 tabs render in browser with no errors
- [x] Verify new fetchers handle 404s gracefully (skip, preserve data)
- [x] Update lessons.md with 5 new Phase 17 lessons

## Phase 18: MEDIUM Fetcher Sprint Completion (2026-07-05)
- [x] Fix cihiWorkforceFetcher XLSX parser — 510 records (440 physicians, 40 nurses, 30 allied)
- [x] Rewrite cihiMhSafetyFetcher with real CIHI indicator XLSX URLs — 11 indicators, 2,187 records across 6 data files
  - CIHI_MH_READMISSION_RATES (200), CIHI_ALL_READMISSION_RATES (498), CIHI_ACSC_HOSPITALIZATIONS (411)
  - CIHI_OCCUPANCY_RATES (103), CIHI_RESOURCE_USE_INTENSITY (96), CIHI_SPENDING_PER_PERSON (10)
  - CIHI_SURGICAL_VOLUME_TRENDS (162), CIHI_WAIT_TIME_SATISFACTION (27), CIHI_SAME_DAY_ACCESS (27)
  - CIHI_JOINT_REPLACEMENT_WAITS (147), CIHI_ED_WAIT_INITIAL_ASSESSMENT (506)
- [x] Extend albertaRespiratoryVirusScraper with summary + immunizations tabs — 473 records
  - WASTEWATER_SIGNALS (10), RESPIRATORY_VIRUS_SURVEILLANCE (212), CHILDHOOD_IMMUNIZATION_COVERAGE (251)
- [x] New cihiWaitTimesPriorityFetcher — 1,828 records from comprehensive 2008-2025 XLSX
  - CIHI_CANCER_WAIT_TIMES (450), CIHI_PRIORITY_PROCEDURE_WAITS (934), CIHI_DIAGNOSTIC_WAIT_TIMES (444)
- [x] Fix ahs-asi URL — standardsandlicensing.alberta.ca has no public registry, use AHS continuing care page
- [x] Register cihiWaitTimesPriorityFetcher in orchestrator (28 total pipelines)
- [x] `npx tsc --noEmit` passes clean
- [x] Verify all 17 MEDIUM data arrays have records in data files
- [x] Browser verify all 15 tabs — 15/15 pass, no errors
- [x] Update lessons.md with 6 new lessons
- [x] NOTIFIABLE_DISEASE_INCIDENCE documented as hand-authored (no structured data endpoint exists)

## Phase 19: Hand-authored Data Verification (2026-07-05)
- [x] Verify 15 hand-authored arrays against real web sources
- [x] **REMOVED** `NOTIFIABLE_DISEASE_INCIDENCE` — measles 18 vs actual 2,008 (100x error)
- [x] **REMOVED** `ENVIRONMENTAL_ADVISORIES` — 2 of 4 entries fabricated (Coalhurst, Bow River)
- [x] **REMOVED** `CONTINUING_CARE_COMPLIANCE` — fabricated inspection dates and violations
- [x] Cleaned `SUBSTANCE_HARM_TRENDS` — removed garbage 2020 record
- [x] Added `_handAuthoredMetadata` blocks to 7 data files with source/vintage/lastVerified/verification
- [x] Added "Hand-authored · Verified" timestamp badges to 8 dashboard components
- [x] Removed 'notifiable' and 'advisories' subtabs from PublicHealthDashboard
- [x] Removed 'compliance' subtab from ContinuingCareDashboard
- [x] Fixed RVD scraper key clash — renamed to RVD_RESPIRATORY_CASE_COUNTS / RVD_IMMUNIZATION_DOSES
- [x] Restored hand-authored RESPIRATORY_VIRUS_SURVEILLANCE and CHILDHOOD_IMMUNIZATION_COVERAGE from publicHealthData.ts
- [x] `npx tsc --noEmit` passes clean
- [x] All 15 tabs verified in browser — 15/15 pass, no errors
- [x] Updated lessons.md with 4 new verification lessons

## Phase 20: Category 3 Workforce XLSX Sheet Parsing (2026-07-05)
- [x] Extend cihiWorkforceFetcher to parse 4 additional sheets from the CIHI workforce XLSX
- [x] NURSING_SUPPLY_TRENDS_CIHI (38 records) — NursProfileData: RN/LPN/NP/RPN 2015-2024, activePermits + growthRatePct + vacancyRatePct (joined from VacancyData) + directCarePct + ruralRemotePct
- [x] WORKFORCE_AGE_PROFILE_CIHI (10 records) — Phyprofile + NursProfileData + PT/OT/PH profile sheets: age bins (under35/35-54/55-64/over65) + retirementRiskLevel
- [x] JOB_VACANCY_TRENDS_CIHI (39 records) — VacancyData: Alberta annual vacancies by provider type 2015-2024
- [x] ALLIED_HEALTH_SUPPLY_CIHI (3 records) — PH/PT/OT profile sheets + VacancyData: Pharmacists/Physiotherapists/OT with Alberta count + Canada supply + vacancy postings
- [x] Renamed old Supply_WF_Flow allied records to ALLIED_HEALTH_FLOW_CIHI (30 records) to avoid shape clash
- [x] Fixed Phyprofile column-truncation bug (was truncating to col P, dropping 65-69/70+/<25 age bands)
- [x] `npx tsc --noEmit` passes clean
- [x] Fetcher runs end-to-end: 600 records written to data-workforce.json

## Phase 21: Category 2 Array Verification (2026-07-05)
- [x] Verify 18 Category 2 arrays against real web sources
- [x] **REMOVED** `SPECIALISTS_LIST` — 8 fabricated doctor names (Dr. James Arbour, Dr. Sarah Tremblay don't exist in CPSA)
- [x] **REMOVED** `SPECIALIST_COMPARISONS` — Same fake doctor names
- [x] **REMOVED** `CANCER_SCREENING_RATES` — Zone-level data not publicly available; numbers didn't match provincial rates
- [x] **REMOVED** `REGIONAL_LGA_DEMAND` — Placeholder data with population: 0
- [x] **REMOVED** `SERVICE_ACCESS_METRICS` — Fabricated LGA names and metrics
- [x] **REMOVED** `TRAVEL_FOR_CARE` — Fabricated LGA names and metrics
- [x] **REMOVED** `LGA_COMMUNITY_NEEDS` — Non-standard LGA names, fabricated rates
- [x] **FIXED** `ADDICTION_BED_CAPACITIES` — Replaced 7 records: removed fake sites (Adanac, GP Youth), fixed bed counts (George Spady 41 not 30, Red Deer 75 not 40), added real sites (Lakeview, Adeara), set availableBeds to null (not publicly available)
- [x] Updated `AddictionBedStatus` interface: availableBeds now `number | null`, added `notes?` field, expanded bedType/gender unions
- [x] Added `_handAuthoredMetadata` to 10 arrays across 6 data files (PCN_CAPACITY, ED_RELIANCE_BY_CONTINUITY, CONTINUITY_SATISFACTION, PRIORITY_TARGET_COMPLIANCE, LAB_LOCATION_WAITS, FACILITY_IMAGING_WAITS, HISTORICAL_FLOW_TIMELINES, HOSPITAL_EFFICIENCY_TREND, SURGICAL_FACILITIES, FACILITY_COMPARISONS)
- [x] Marked SURGICAL_FACILITIES, FACILITY_COMPARISONS, FACILITY_IMAGING_WAITS metrics as "estimated" (facility names real, metrics fabricated)
- [x] 5 subagents removed fabricated array references from 5 dashboards (Cancer, PrimaryCare, RegionalInequity, Surgical, SystemFlow)
- [x] `npx tsc --noEmit` passes clean
- [x] All 15 tabs verified in browser — 15/15 pass, no errors
- [x] Updated lessons.md with 5 new verification lessons
## Phase 22: Data Timestamps — All Dashboards (2026-07-05)
- [x] Audited all 20 data-*.json files — 14 domain data dicts with data arrays
- [x] Added `_dataMetadata` to all 14 domain data files (source, sourceVintage, lastUpdated, updateType, verification)
- [x] Created `src/components/DataTimestamp.tsx` — universal component with full mode (two-line: "Auto-updated · {date} ({relative})" / "Source data: {date} · {source}") and compact mode (single line). Manual data shows "Manually updated · {sourceDate}" with amber FileText icon.
- [x] Added DataTimestamp to all 15 dashboards via 7 subagents (5 original + 2 fix-up):
  - FixGroup1: Surgical, SystemFlow, Diagnostic (static imports — exported _dataMetadata from data files)
  - FixGroup2: PrimaryCare, Workforce, Cancer (fetch-based — _dataMetadata from API response)
  - FixGroup3: MentalHealth, ContinuingCare, PatientExperience (static imports — required fix-up)
  - FixGroup4: PublicHealth, RegionalInequity, Spending (static imports — required fix-up)
  - FixGroup5: VirtualCare, ServiceDisruptions, App.tsx ER waits
  - FixMH-CC-PE: MentalHealth, ContinuingCare, PatientExperience (fix-up for FixGroup3's incomplete work)
  - FixPH-RI-SP: PublicHealth, RegionalInequity, Spending (fix-up for FixGroup4's incomplete work)
- [x] Exported `_dataMetadata` from 6 TS data files (mentalHealthData, continuingCareData, patientExperienceData, publicHealthData, regionalInequityData, spendingData)
- [x] Added `/api/data/:domain` endpoint to server.ts (was missing — fetch-based dashboards were getting HTML instead of JSON)
- [x] Fixed `getDomainResult` in useSyncStatus.ts — added null check for syncStatus and syncStatus.results
- [x] Changed server.ts PORT to use env var (default 3004)
- [x] `npx tsc --noEmit` — 18 pre-existing errors only (cloudflare/worker.ts, src/pipelines/*.ts), 0 in dashboards/data files
- [x] All 15 tabs verified in browser — 15/15 pass, no errors, 13/15 show DataTimestamp components
- [x] Updated lessons.md with 5 new Phase 22 lessons

## Phase 23: Diagnostic Lab Waits — 30-Minute Updates via APL REST API (2026-07-07)
- [x] Discovered hidden APL REST API: `GET https://qmeapi.albertaprecisionlabs.ca/api/location` — 153 lab sites, no auth, no captcha, open CORS
- [x] Built `src/pipelines/aplLabWaitTimesFetcher.ts` — axios GET, parses WaitTime strings to minutes, derives walkIn/appointmentRequired booleans, replaces 52 hand-authored sites with 153 live API sites
- [x] Made `dailyVolume` and `peakHours` optional in `LabLocationWait` interface (API doesn't provide them)
- [x] Converted `DiagnosticDashboard.tsx` from static TS imports to `fetch('/api/data/diagnostic')` + useState/useEffect (was reading bundled constants, not the JSON file)
- [x] Hidden Peak Hours / Daily Volume boxes when fields absent (153 API sites lack them)
- [x] Added 30-min lab tier to `scheduler.ts` (third interval alongside 10-min ER and 24-hr daily)
- [x] Added `recordLabWaitsUpdate` to `syncStatus.ts` + `labWaitsLastUpdate`/`labWaitsNextUpdate` to SyncStatus type
- [x] Registered `apl-lab-waits` in orchestrator (daily bonus refresh)
- [x] Corrected cadence labels in App.tsx: "Lab waits: every 30 min · Imaging/turnaround: annual/manual"
- [x] `npx tsc --noEmit` passes with exit 0
- [x] Browser verified: 153 sites render, APL QMe REST API source label, auto-updated timestamp, zero console errors
