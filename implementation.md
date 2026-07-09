# 15-Tab Dashboard Audit & Fix Plan

This is the living plan for a complete, file-by-file, tab-by-tab audit of the Alberta Hospital Wait Times dashboard. The audit evaluates **visual quality**, **data quality**, and **pipeline (updater) quality** for every module.

**Initial blocker already cleared during planning:**
- `src/App.tsx` was missing `cn` and `formatMinutesToHm` imports, causing a blank page in headless browsers and `npx tsc --noEmit` failures. Fixed.
- `tsconfig.json` included `tests` without `vitest` installed, causing `tsc` failures. Excluded `tests` and `**/*.test.ts`.
- `npx tsc --noEmit` and `npm run build` now pass and the dev server renders.

# Alberta Hospitals — 15-Tab Dashboard Audit Plan

**Scope:** All `DASHBOARDS` tabs in `src/App.tsx` plus shared shell (`DashboardHeader`, `DataTimestamp`, `LiveDataBadge`, `MapComponent`, footer, module picker, `ContributionsSection`, Data Sources modal).  
**Out of scope for this plan:** Editing source/data; full `npm test` / full `runAllPipelines()`.

---

## 0. Prerequisites (every auditor)

1. Confirm dev server: `http://127.0.0.1:3004` (or `REAUDIT_URL`).
2. Seed location once per session: `localStorage` key `alberta_hospital_user_location` → St. Albert / **T8N 7W7** (see `lessons.md` headed-audit pattern); dismiss location modal if shown.
3. Navigate modules via **`?module=<id>`** deep link (`readDashboardModuleFromUrl`) — not description-based search (`dashboardModuleSearch` title/shortName/id only).
4. Cross-check `data-sync-status.json` and `/api/sync/status` (or `useSyncStatus`) against `TAB_METADATA_MAP` auto/manual claims.
5. Log findings to a single artifact (e.g. `local://dashboard-audit-findings.md`) with: tab, severity, evidence (screenshot path / JSON key / line ref).

**Pipeline inventory:** 28 jobs in `src/pipelines/orchestrator.ts` `PIPELINES` + **ER** (`erWaitTimesFetcher` / `scheduler.ts` ~10 min) + **disruptions** (`disruptionsScraper` / `dailySync.ts`) + **lab waits** (`aplLabWaitTimesFetcher` / scheduler ~30 min). Daily bulk: `dailySync.ts` → `recordDailySyncResults` → `pushAllToCloudflare`.

---

## 1. Shared shell audit (Owner: **explore** + **designer**)

| Area | Visual checks | Data/code checks |
|------|---------------|------------------|
| Module picker | Category chips, `data-dashboard-id` tiles, mobile “Change Module”, search uses title/shortName/id only | `DASHBOARDS` copy matches each `*Dashboard` header; no ER-only wording on other modules |
| Footer | `#site-footer` title/blurb switches with `activeTab` (ER vs generic monitor) | `footerBlurb` source/cadence matches `DASHBOARDS[].source` / `updateFrequency` |
| Data Sources modal | All 15 rows from `TAB_METADATA_MAP`; auto vs static badges | Intervals match scheduler/daily-sync reality (ER 30m vs comment “10 min” in scheduler — document mismatch) |
| `DashboardHeader` | Auto pulse vs static pill; Last Update / Data Timestamp readable | `arrayKey` exists in `_dataMetadata`; badge aligns with `updateType` |
| `DataTimestamp` | No pipeline IDs visible; compact vs full | `sanitizeSource()` map covers all `source` strings in JSON metadata |
| `LiveDataBadge` | N/A (returns `null`) | Dead component / should not be relied on in UI |
| `MapComponent` | Markers, user pin, selected hospital pan, resize/fullscreen | Hospitals with null lat/lng excluded; wait/proximity sort labels |
| `ContributionsSection` | Renders below all tabs without layout break | — |

---

## 2. Tab-by-tab audit matrix

| Tab (`module=` ) | Files | Subtabs / views to screenshot | Visual checks | Data checks | Pipeline / updater checks | Owner |
|------------------|-------|------------------------------|---------------|-------------|---------------------------|-------|
| **er-waits** | `App.tsx` (inline), `MapComponent.tsx`, `data-er-waittimes.json`, `types.ts` | Default: stats grid, facility list, map, trends (24h/7d/30d) | Map fullscreen; facility cards; peak boxes not cloning 24h value; mobile list/map stack | `/api/hospitals` array shape; snapshots trends; empty hospitals | `scheduler.ts` → `fetchErWaitTimes`; KV push; `erWaitTimesMetadata` vs sync timestamp | **designer** (visual), **task** (pipeline) |
| **disruptions** | `ServiceDisruptionsDashboard.tsx`, `data-disruptions.json`, `data-disruption-overrides.json` | Single view + stats row | Header metadata; resolve actions; “Invalid Date” on dates | Active vs resolved; city/zone; overrides applied | `disruptionsScraper.ts` + `dailySync`; header `source: disruptionsScraper` → human label | **designer**, **task** |
| **system-flow** | `SystemFlowDashboard.tsx`, `systemFlowData.ts`, `data-system-flow.json` | `ranked`, `scatterplot`, `trends-weekly`, `cihi-lga` | Weekly ED LOS empty states; scatter quadrants; deep-dive panel | KPIs vs table; null guards in `useMemo`; 29 ER sites coverage | `acute-care`, `ahs-weekly-edlos` | **explore** (data), **designer** |
| **surgical-waits** | `SurgicalDashboard.tsx`, `surgicalData.ts`, `data-surgical.json` | `overview`, `ortho`, `comparisons`, `statscan` | Facility name match (no `(AHS)`); comparison selectors | `SURGICAL_RECORDS` vs KPI cards; StatsCan segment optional | `powerbi-scraper`, `abjhi`, `cihi-wait-times-surgical`, `cihi-wait-times-priority` | **designer**, **task** |
| **workforce** | `WorkforceDashboard.tsx`, `workforceData.ts`, `data-workforce.json` | `physicians`, `nursing`, `allied`, `retirement`, `vacancies` | Chart axes; retirement cohort labels | `useMemo` null guards; vacancy quarters | `statscan`, `cpsa`, `cihi-workforce` | **explore**, **designer** |
| **diagnostics** | `DiagnosticDashboard.tsx`, `diagnosticData.ts`, `data-diagnostic.json`, `LabCard.tsx` | `labs`, `imaging-waits`, `facilities`, `turnaround` | Lab **Closed** vs `0:00`; proximity sort with T8N; refresh button | `LAB_LOCATION_WAITS` live via `/api/data/diagnostic`; trends APIs | `apl-lab-waits` (scheduler 30m) + `cihi-wait-times` (daily) | **designer**, **task** |
| **primary-care** | `PrimaryCareDashboard.tsx`, `primaryCareData.ts`, `data-primary-care.json` | `attachment`, `directory`, `pcn`, `er-link` | Directory filters; map/cards if any | Attachment year; accepting providers count | `primary-care`, `alberta-find-a-provider`, `open-alberta-inequity-primary-care` | **designer**, **task** |
| **long-term-care** | `ContinuingCareDashboard.tsx`, `continuingCareData.ts`, `data-continuing-care.json` | `placement`, `resident-quality`, `home-care`, `compliance` | Zone filter **All** = all zones; all 11 quality rows (no modulo) | `null` wait days → N/A not 0; KPIs from same arrays as tables | `ahs-asi`, `hqca-continuing-care`, `continuing-care-compliance` | **explore**, **designer** |
| **patient-experience** | `PatientExperienceDashboard.tsx`, `patientExperienceData.ts`, `data-patient-experience.json` | `voice`, `inpatient`, `emergency`, `safety`, `complaints` | Zone filter All; disclaimer on voice tab | Hospital cross-ref `/api/hospitals` | `hqca-focus`, `goodcaring` | **designer**, **task** |
| **virtual-care** | `VirtualCareDashboard.tsx`, `virtualCareData.ts`, `data-virtual-care.json` | `demand`, `virtual-md`, `ems-diversion`, `adjacent-lines` | Fiscal year toggle; audit reference block | Cohort study fields populated | `virtual-care` | **designer** |
| **cancer** | `CancerDashboard.tsx`, `cancerData.ts`, `data-cancer.json` | `burden`, `surgery`, `radiation`, `facilities` | “Major cancer” subset label; no duplicate city on cards | Projected totals not implied province-wide | `ahs-cancer-centres`, `cihi-wait-times-cancer` | **designer**, **task** |
| **public-health** | `PublicHealthDashboard.tsx`, `publicHealthData.ts`, `data-public-health.json` | **Visible nav:** `respiratory`, `wastewater`, `immunization` only | Header note on hidden subtabs; wastewater scientific notation | Hidden `notifiable` / `advisories` — if reachable, must show empty/disclosure not stale junk | `phac`, `alberta-rvd` | **explore**, **designer** |
| **mental-health** | `MentalHealthDashboard.tsx`, `mentalHealthData.ts`, `data-mental-health.json` | `substance-harms`, `addiction-beds`, `community-access`, `er-pressure`, `helplines` | Vacancy `null` → “not reported” not 0%; helpline rows sane | KPI from `SUBSTANCE_HARM_TRENDS` latest year | `ahs-asi` (ABED beds), `alberta-211`, `cihi-mh-safety`, `phac` (domain) | **designer**, **task** |
| **regional-inequity** | `RegionalInequityDashboard.tsx`, `regionalInequityData.ts`, `data-regional-inequity.json` | `lga-needs`, `disease-burden`, `ed-reliance`, `access-travel`, `compare-matrix`, `data-explorer` | LGA sidebar; compare matrix; narrative callouts per subtab | No `/5` averages; population for ED visits; `TRAVEL_FOR_CARE` empty handling | `open-alberta-inequity` | **explore**, **designer** |
| **health-spending** | `SpendingDashboard.tsx`, `spendingData.ts`, `data-spending.json` | `spending-access`, `national-scoreboard`, `hospital-efficiency`, `physician-payments` | CIHI national scoreboard; specialty billing table | National compare row count; billing records | `open-alberta`, `cihi-nhex`, `open-alberta-billing` (manual), `fraser` (manual) | **designer**, **task** |

**TAB_METADATA_MAP keys (modal):** all 15 ids above — verify each matches runtime metadata for the header `arrayKey` used on that tab.

---

## 3. Cross-cutting anti-patterns (re-check every tab)

From `lessons.md` and prior audits — explicit pass/fail per tab where applicable:

1. **Footer/header chrome** not module-aware (ER copy on non-ER tabs).
2. **Source labels** leaking pipeline filenames (`cihiDownloader`, `disruptionsScraper`, etc.) — UI and `_dataMetadata.source`.
3. **KPI hardcoded** or stale vs detail tables/charts (compute from same arrays).
4. **Missing data as `0`** or blank instead of `null` / **N/A** / “Closed” / “No historical data”.
5. **Zone/filter “All”** that is a subset (Calgary+Edmonton only).
6. **Modulo / index hacks** hiding rows (`i % 3`).
7. **Hardcoded divisors** (`/ 5`) instead of `.length`.
8. **Subset totals** presented as province-wide (cancer burden, etc.).
9. **Historical range fallback** to current snapshot (ER 7d/30d peaks).
10. **Scraper garbage rows** (footer phone numbers, copyright in helplines).
11. **Facility/city normalization** (wrong upstream city, duplicate labels).
12. **`useMemo` before `isLoading`** — `.find()` on empty arrays without guards.
13. **Hidden subtabs** still in code/marketing copy without disclosure (Public Health notifiable/advisories).
14. **`LiveDataBadge`** stub — do not expect live badge outside `DashboardHeader`/`DataTimestamp`.
15. **Module search** matching description text (wrong module navigation).
16. **API shape** mismatches (bare array vs `{ hospitals: [] }`) for `/api/hospitals`.
17. **Manual pipelines** (`MANUAL_PIPELINES`: `fraser`, `open-alberta-billing`, `alberta-211`) marked success but partial/manual in UI.
18. **Scheduler vs UI cadence** text (10 min ER fetch vs “30 minutes” in copy).

---

## 4. Visual audit protocol (precise)

### 4.1 Tooling

- **Primary:** `browser` tool → `open` `http://127.0.0.1:3004/?module=<id>` (viewport **1440×900** desktop).
- **Mobile pass:** second viewport **390×844** for tabs marked high-risk: `er-waits`, `diagnostics`, `regional-inequity`, `long-term-care`, module picker.
- **Evidence:** `tab.screenshot({ fullPage: true, save: 'screenshots/audit-2026-07-09/<module>-<subtab>.png' })` then **`inspect_image`** on each PNG with a fixed rubric (below).
- **Optional batch:** extend `scripts/visual-reaudit-puppeteer.mjs` (`setLocationT8N`, `openModule`, new page per module) for regression parity with 2026-07-08 run.

### 4.2 Location

- **Required:** T8N 7W7 (St. Albert) for any tab using proximity, drive time, or LGA context: `er-waits`, `diagnostics` (labs), `regional-inequity`, `primary-care` (directory distance if shown).
- **Other tabs:** same location for consistency across screenshots.

### 4.3 Per-module screenshot checklist

For each of the 15 `module` ids:

1. Land on default subtab (first in component state).
2. Capture **full page** including `#site-footer` and subtab bar.
3. Click **each subtab** listed in §2; wait for `animate-fadeIn` / chart render (~1–2s); screenshot.
4. Open **Data Sources** modal once per session — verify row for this module.
5. `inspect_image` questions (copy into each call):
   - “Quote visible **Auto-updated** vs **Static** badge and Last Update / Data Timestamp verbatim.”
   - “Any **0**, **0:00**, **NaN**, **undefined**, or empty chart where labels imply data?”
   - “Any internal pipeline/scraper name visible to users?”
   - “Do KPI headline numbers visually match the largest table/chart below (yes/no + values)?”
   - “Footer: does title/blurb describe this module (not ER-only)?”

### 4.4 High-priority `inspect_image` targets

| Module | Must-inspect regions |
|--------|----------------------|
| er-waits | KPI cards, 7d/30d peak tiles, map legend |
| diagnostics | Lab cards at night/off-hours, provincial lab trend |
| long-term-care | Placement KPI trio vs detail panel |
| mental-health | Substance KPI vs table; bed occupancy % |
| public-health | Wastewater Y-axis labels; immunization cards |
| regional-inequity | LGA demand cards (0/0); compare matrix header |
| health-spending | National scoreboard Alberta column |
| disruptions | Date fields on active cards |

---

## 5. Data-quality audit method (Owner: **explore**)

Per tab:

1. Load `data-<domain>.json` (or `data-disruptions.json` / ER files).
2. Validate `_dataMetadata` keys ⊇ all `DataTimestamp` / `DashboardHeader` `arrayKey`s used in that component.
3. Spot-check: empty arrays, null vs 0, string dates ISO-parseable.
4. Compare record counts to last `data-sync-status.json` entry for domain pipelines.
5. For live tabs, `fetch` `/api/data/<domain>` and diff `_dataMetadata.lastUpdated` vs file mtime.

---

## 6. Pipeline / updater audit method (Owner: **task**)

**Do not** run full orchestrator in plan phase. Targeted:

| Trigger | Command / action | Verify |
|---------|------------------|--------|
| Single domain | `npx tsx src/pipelines/orchestrator.ts` subset or `runPipelineByName('<name>')` via small script | `data-*.json` mtime, `recordsWritten`, no throw |
| ER | observe `scheduler` / manual `fetchErWaitTimes` | `data-er-waittimes.json`, `data-snapshots.json` |
| Labs | `apl-lab-waits` | `data-diagnostic.json` `LAB_LOCATION_WAITS` |
| Disruptions | `scrapeDisruptions()` or daily sync step 1 | `data-disruptions.json` active count |
| Status file | read `data-sync-status.json` | every domain has recent timestamp or documented `manual`/`failed` |
| KV | inspect `pushClient.ts` / worker logs if configured | domain list matches 15 data files |

Map each pipeline to tab(s) using `orchestrator.ts` `domain` field (§2 implicit).

---

## 7. Fix-plan phase — subagent divisions (after audit)

| Finding type | Owner agent | Examples |
|--------------|-------------|----------|
| Visual/layout/copy, empty states, chart formatting | **designer** | Closed labs, footer, cancer subset label, PH disclosure |
| Pipeline/fetcher/scraper/metadata writers | **task** | Wrong CKAN set, ABED parser, disruptions dates, `_dataMetadata` sources |
| Data JSON integrity, KPI derivation, filters | **task** (or main) | null vs 0, All-zone filter, remove modulo |
| Tests for regressions | **Tester** | Filter logic, metadata sanitize, API shape guards |
| Final pass / severity triage | **reviewer** | Sign-off against §3 checklist |
| Read-only discovery only | **explore** | No edits — maps gaps to §2 matrix |

**Order:** P0 user-misleading data → P1 crashes (`useMemo`) → P2 polish. Re-run §4 visual subset for touched tabs only.

---

## 8. Phased schedule (audit only)

| Phase | Days | Work |
|-------|------|------|
| A | 0.5 | Shell + `TAB_METADATA_MAP` + location seed script check |
| B | 1 | Acute + capacity tabs (5): visual + data |
| C | 1 | Community tabs (4) |
| D | 1 | Prevention + equity (6) |
| E | 0.5 | Targeted pipeline reruns for failed domains |
| F | 0.5 | Consolidated findings → fix backlog for phase 7 |

---

*Audit plan — the blocker fixes above are already committed; remaining work follows this plan.*