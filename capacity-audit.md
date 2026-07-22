# Group 2 — System Capacity Audit (surgical, workforce, diagnostics)

**Scope:** `SurgicalDashboard`, `WorkforceDashboard`, `DiagnosticDashboard`, `LabCard`; `data-surgical.json`, `data-workforce.json`, `data-diagnostic.json`; `surgicalData.ts`, `workforceData.ts`, `diagnosticData.ts`.

**Method:** Static code + JSON review per `implementation.md` §3; no edits; no full pipeline/test run.

---

## Summary

| Tab | New P0 | New P1 | New P2/P3 |
|-----|--------|--------|-----------|
| surgical-waits | 1 | 2 | 2 |
| workforce | 0 | 1 | 3 |
| diagnostics | 0 | 2 | 3 |

---

## surgical-waits (`SurgicalDashboard.tsx`)

| tab | severity | file | line | issue | evidence | suggestedFixOwner |
|-----|----------|------|------|-------|----------|-------------------|
| surgical-waits | **P0** | `src/components/SurgicalDashboard.tsx` | 274–280, 871–872 | Hip “% within benchmark” KPI always **—** | Lookup uses `procedure_name === 'Hip Replacement'`; JSON uses **`Total Hip Arthroplasty`** (`data-surgical.json` rec_hip_prov_bench, metric 62%). `surgicalCapacityStats.hipBenchPct` is always `null`. | **task** |
| surgical-waits | **P1** | `src/components/SurgicalDashboard.tsx` | 227–228, 426–427, 1461–1475 | Procedure comparison dropdowns / defaults **never match** records | State defaults `Total Hip Replacement` / `Total Knee Replacement`; province 90th records use **`Total Hip Arthroplasty`** / **`Total Knee Arthroplasty`**. `.find()` misses; falls back to `SURGICAL_RECORDS[0]`/`[1]` (wrong procedure). | **task** |
| surgical-waits | **P1** | `src/components/SurgicalDashboard.tsx` | 548, 582, 616, 636 | Overview KPI cards **hardcoded** | Cards show `36.8`, `43.1`, `15.2`, `5.9` weeks inline; table below derives from `SURGICAL_RECORDS`. Values currently match JSON but violate KPI-from-same-array rule; drift risk on pipeline refresh. | **designer** / **task** |
| surgical-waits | **P2** | `src/components/SurgicalDashboard.tsx` | 910–923 | StatsCan life-impact mini-grid **hardcoded** | `78.5%`, `28.4%` not read from `STATSCAN_SATISFACTION_STATS.metrics_alberta.life_impact_categories`. | **task** |
| surgical-waits | **P2** | `src/components/SurgicalDashboard.tsx` | 1137–1139, 699 | Historical trend chart on overview **no `DataTimestamp`** for `HISTORICAL_WAIT_TRENDS` | `_dataMetadata` includes `HISTORICAL_WAIT_TRENDS`; UI only stamps `SURGICAL_RECORDS`. Ortho subtab reuses same series without ABJHI/CIHI vintage on chart. | **designer** |
| surgical-waits | **P3** | `src/components/SurgicalDashboard.tsx` | 132 | Historical pivot: `medianWaitDays \|\| 0` | Missing days coerced to **0 weeks** in pivot path (not `null` gap). | **task** |

**useMemo / loading:** `useDomainData` + `isLoading` guard at ~435; memos use `data?.… ?? []` — **no pre-load crash** on empty arrays. `zonePieData` guarded when `physicianZoneData` missing (N/A on workforce pattern).

**Imports:** Surgical dashboard does not use `formatMinutesToHm`/`cn` (not required here). No missing-import crash pattern from `lessons.md`.

**Facility names:** No `(AHS)` suffix observed in surgical facility flow in this pass (prior lesson applied).

---

## workforce (`WorkforceDashboard.tsx`)

| tab | severity | file | line | issue | evidence | suggestedFixOwner |
|-----|----------|------|------|-------|----------|-------------------|
| workforce | **P1** | `src/components/WorkforceDashboard.tsx` | 124 | RN headline **fallback hardcode** | `totalRNs` uses `…activePermits \|\| **45171**` if 2025 RN row missing — shows stale count instead of 0/N/A. | **task** |
| workforce | **P2** | `src/components/WorkforceDashboard.tsx` | 126–132 | `avgNursingVacancy = 9.0` **hardcoded** | Computed in `aggregateStats` but not wired to visible KPI in grep pass; still a misleading aggregate if surfaced later. | **task** |
| workforce | **P2** | `src/components/WorkforceDashboard.tsx` | 345 | Physician card claims **+2.4% Annual Increase (illustrative)** | Not derived from `PHYSICIAN_SPECIALTY_ZONE` or CIHI series; labeled illustrative but reads as metric. | **designer** |
| workforce | **P2** | `src/components/WorkforceDashboard.tsx` | 91–92 | Zone fallback uses **index `[5]`** | `find(zone) \|\| PHYSICIAN_SPECIALTY_ZONE[5]` — fragile if zone list order/count changes (Alberta is index 5 today). Prefer explicit `zone === 'Alberta'`. | **task** |
| workforce | **P3** | `src/components/WorkforceDashboard.tsx` | 939–943 | Retirement subtab **Hand-authored** badge | `WORKFORCE_AGE_PROFILE` metadata exists; UI correctly discloses hand-authored — OK; ensure `_handAuthoredMetadata` stays in sync. | **designer** |

**useMemo / loading:** `isLoading` return at 265 **after** all memos; memos use `?? 0`, `if (!physicianZoneData) return []`, `if (trends.length === 0) return 0` — **aligned with lessons.md** null-guard pattern.

**Zone filter “All”:** Physician zone selector uses named zones + Alberta; not a Calgary+Edmonton-only “All” trap.

**DataTimestamp `arrayKey`:** All UI keys present in `data-workforce.json` `_dataMetadata` (verified: `PHYSICIAN_SPECIALTY_ZONE`, `NURSING_SUPPLY_TRENDS`, `ALLIED_HEALTH_SUPPLY`, `WORKFORCE_AGE_PROFILE`, `JOB_VACANCY_TRENDS`, `SPECIALIST_RECRUITMENT_NEEDS`). Extra metadata keys for `*_CIHI` arrays not shown in UI (acceptable).

**Source labels:** Workforce metadata uses human-facing sources (e.g. CPSA/StatCan/CIHI via fetchers); no raw `cihiDownloader` in component paths reviewed.

---

## diagnostics (`DiagnosticDashboard.tsx`, `LabCard.tsx`)

| tab | severity | file | line | issue | evidence | suggestedFixOwner |
|-----|----------|------|------|-------|----------|-------------------|
| diagnostics | **P1** | `src/components/DiagnosticDashboard.tsx` | 241–242, 572–597 | Provincial/zone lab averages **exclude all `Closed` labs** | `validLabs = filter(typeof waitTimeMin === 'number')`; when snapshot is mostly `waitTimeMin: "Closed"` (e.g. after hours), `avgWait`/`edmontonAvg`/… → **0:00** via `formatMinutesToHm(0)`, looks like instant wait not “no numeric data”. | **designer** / **task** |
| diagnostics | **P1** | `src/components/LabCard.tsx` | 183–184 | Closed / non-numeric wait shows **“Unavailable”**, not **“Closed”** | `getLabStatus()` in dashboard maps `'Closed'` → label Closed; `LabCard` uses generic Unavailable for any non-number (including `'Closed'` and `'Appointments Only'`). Inconsistent with audit matrix (Closed vs 0:00). | **designer** |
| diagnostics | **P2** | `src/components/DiagnosticDashboard.tsx` | 1411–1480, 1118+ | **Facilities** / **Turnaround** subtabs lack `DataTimestamp` | Data exists: `FACILITY_IMAGING_WAITS`, `TEST_TURNAROUND_METRICS`, `PRIORITY_TARGET_COMPLIANCE`, `IMAGING_WAIT_TRENDS` in `_dataMetadata`; only labs + imaging-waits (CIHI) stamped. | **designer** |
| diagnostics | **P2** | `src/components/DiagnosticDashboard.tsx` | 1119 | Imaging-waits uses `CIHI_DIAGNOSTIC_WAIT_TIMES` timestamp while KPIs/chart use **`IMAGING_WAIT_TRENDS`** | KPI cards read `IMAGING_WAIT_TRENDS` latest `albertaP90Days`; compact stamp is CIHI array — vintage may not match chart source. | **designer** |
| diagnostics | **P3** | `src/components/LabCard.tsx` | 51 | Unavailable path sets `waitTime = 0` for math | Only affects drive/net helpers when `hasDrive && !isUnavailable`; display uses Unavailable — OK; document if extending net-wait sort to closed labs. | **designer** |

**useMemo / loading:** `diagnosticData` nullable; memos use `diagnosticData?.… ?? []` and early `if (!diagnosticData)` in `labStats`; `isLoading` at 483 — **safe**.

**Live data:** Fetches `/api/data/diagnostic`; `LAB_LOCATION_WAITS` metadata `lastUpdated` **2026-07-09** (auto). Refresh button re-fetches API — OK.

**Region filter “All”:** `selectedRegion === 'All'` returns full `processedLabs` — **true All**.

**Imports:** `formatMinutesToHm`, `cn` imported from `./lib/utils` — OK.

---

## Cross-cutting (Group 2)

1. **KPI vs tables:** Surgical overview cards and workforce illustrative deltas remain the main **hardcoded / non-derived** risks (§3 items 3–4).
2. **0 vs null vs Closed:** Diagnostics lab averages and LabCard labeling; surgical historical `medianWaitDays || 0`.
3. **DataTimestamp coverage:** Diagnostic facilities/turnaround; surgical `HISTORICAL_WAIT_TRENDS` on charts.
4. **Procedure naming:** Single canonical `procedure_name` (group vs clinical name) must be used in lookups and comparison UI.

---

## Already in good shape (no new issue)

- Workforce `useMemo` null guards post-2026-07-04 lesson.
- Diagnostic `getLabStatus()` for closed numeric `0` + `!walkInAvailable`.
- `data-*._dataMetadata` keys for every `DataTimestamp` `arrayKey` **used in UI** (script-verified OK).
- Surgical `SURGICAL_RECORDS` table + capacity stats (except hip benchmark key) derive from same filtered arrays.
- No `tsc`-blocking missing imports in these four components.

---

*Audit artifact for Phase F fix backlog. Owner agents per `implementation.md` §7.*