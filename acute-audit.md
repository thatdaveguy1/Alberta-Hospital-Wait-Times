# Acute & Urgent + Shared Shell Audit (Group 1)

**Scope:** `er-waits`, `disruptions`, `system-flow` (audit matrix §2) plus shared shell listed in assignment.  
**Method:** Static code + JSON review per `implementation.md` §3; no edits, no full pipeline/test runs.  
**Date:** 2026-07-09

---

## Summary

| Tab / area | New P0 | New P1 | New P2/P3 |
|------------|--------|--------|-----------|
| er-waits | 1 | 1 | 2 |
| disruptions | 1 | 1 | 1 |
| system-flow | 2 | 2 | 3 |
| shared shell | 0 | 2 | 2 |

**Already addressed (not re-filed as new):** `cn` / `formatMinutesToHm` imports (`lessons.md` 2026-07-09); module-aware footer for non-ER tabs (`lessons.md` 2026-07-08); ER 7d/30d peak fallback removed in trends pusher (lessons.md); Map null lat/lng skip (`MapComponent.tsx` L109).

---

## Findings

### 1 — er-waits — ER scheduler cadence vs user-facing copy (P2)

| Field | Value |
|-------|-------|
| **tab** | er-waits |
| **severity** | P2 |
| **file** | `src/pipelines/syncStatus.ts`, `src/App.tsx`, `implementation.md` |
| **line** | syncStatus L41–42; DASHBOARDS L123; TAB_METADATA_MAP L399; footer L1238 |
| **issue** | UI and Data Sources modal claim **every 30 minutes**; `recordErWaitTimesResult` sets `erWaitTimesNextUpdate` to **+10 minutes** (`10 * 60 * 1000`). `pipelines/README.md` documents ER fetch as **10 min**. Users and operators see inconsistent cadence. |
| **evidence** | `erWaitTimesNextUpdate: new Date(Date.now() + 10 * 60 * 1000)`; copy: "Every 30 minutes" / `interval: 'every 30 mins'`. |
| **suggestedFixOwner** | task (align scheduler interval + copy + TAB_METADATA_MAP) |

---

### 2 — er-waits — `lastUpdated` falls back to literal "Live Feed" (P1)

| Field | Value |
|-------|-------|
| **tab** | er-waits |
| **severity** | P1 |
| **file** | `src/App.tsx` |
| **line** | 505–511 |
| **issue** | `erWaitTimesMetadata.ER_WAIT_TIMES.lastUpdated` uses `syncStatus?.erWaitTimesLastUpdate ?? 'Live Feed'`. `DashboardHeader` passes that string through `formatTimestamp`; non-ISO `"Live Feed"` is shown as-is for **Last Update**, not a parsed time. |
| **evidence** | `lastUpdated: syncStatus?.erWaitTimesLastUpdate ?? 'Live Feed'`; `DashboardHeader.tsx` L50–51, L22–25 (`isNaN(d.getTime())` → return raw `ts`). |
| **suggestedFixOwner** | designer / task (use ISO from `data-er-waittimes.json` `lastUpdated` or "Unknown" until sync loads) |

---

### 3 — er-waits — Provincial avg wait treats `waitTime === 0` as valid (P0)

| Field | Value |
|-------|-------|
| **tab** | er-waits |
| **severity** | P0 |
| **issue** | Misleading KPI when upstream reports zero minutes without an unavailable label. |
| **file** | `src/App.tsx` |
| **line** | 1207–1217 |
| **issue** | `validHospitals = hospitals.filter(h => h.waitTime >= 0)` includes **0**; `isWaitTimeUnavailable` only treats negative wait or label text. A true **0:00** wait displays in averages/max UI as zero wait, not "Unav"/N/A. |
| **evidence** | `waitTime >= 0` vs `isWaitTimeUnavailable` using `< 0` and labels only (L357–360). |
| **suggestedFixOwner** | task (align validity with unavailable semantics or explicit zero policy) |

---

### 4 — er-waits — `data-er-waittimes.json` has no `_dataMetadata` (P3)

| Field | Value |
|-------|-------|
| **tab** | er-waits |
| **severity** | P3 |
| **file** | `data-er-waittimes.json` |
| **line** | 1–440 |
| **issue** | File shape is `{ hospitals, lastUpdated }` only. Header uses synthetic `ER_WAIT_TIMES` key in App, not file metadata — OK for header, but Data Sources / cross-tab metadata parity (§5) is weaker than domain JSON pattern. |
| **evidence** | No `_dataMetadata` key in file. |
| **suggestedFixOwner** | task (optional metadata writer on ER fetch) |

---

### 5 — disruptions — Pipeline ID in header metadata; `DashboardHeader` does not sanitize (P1)

| Field | Value |
|-------|-------|
| **tab** | disruptions |
| **severity** | P1 |
| **file** | `src/components/ServiceDisruptionsDashboard.tsx`, `src/components/DashboardHeader.tsx` |
| **line** | ServiceDisruptions L43–49; DashboardHeader L48–51, L84 |
| **issue** | Inline `metadata.disruptions.source` is **`disruptionsScraper`**. `DataTimestamp.sanitizeSource` maps this to "AHS Service Disruptions", but **`DashboardHeader` only shows `sourceVintage`**, not `source` — so scraper ID is not shown in header row. **Data Timestamp** line shows `sourceVintage: 'Live Feed'` (acceptable). Risk: if `source` is ever surfaced in header, it would leak. **arrayKey mismatch:** metadata key is `disruptions` but `arrayKey="disruptions"` — consistent. |
| **evidence** | `source: 'disruptionsScraper'`; `DataTimestamp.tsx` L39 maps `disruptionsScraper`. Header never calls `sanitizeSource`. |
| **suggestedFixOwner** | designer (use human-readable `source` in metadata object; or wire `DataTimestamp` / shared sanitize in header) |

---

### 6 — disruptions — `data-disruptions.json` missing `_dataMetadata` (P2)

| Field | Value |
|-------|-------|
| **tab** | disruptions |
| **severity** | P2 |
| **file** | `data-disruptions.json` |
| **line** | 1 (root array) |
| **issue** | Root is a **bare array**; no `_dataMetadata` for `DataTimestamp` / modal verification. Header timestamps come only from `useSyncStatus` + hardcoded vintage. |
| **evidence** | `grep _dataMetadata data-disruptions.json` — no matches. |
| **suggestedFixOwner** | task (`disruptionsScraper` should append metadata block) |

---

### 7 — disruptions — Resolved records with `status: Resolved` still in JSON; default filter Active (P3)

| Field | Value |
|-------|-------|
| **tab** | disruptions |
| **severity** | P3 |
| **file** | `data-disruptions.json`, `ServiceDisruptionsDashboard.tsx` |
| **line** | e.g. JSON L316+; dashboard L55, L158 |
| **issue** | Not a bug: resolved rows kept for history; UI defaults to **Active**. Some resolved rows use date-only `endDate` (`"2026-07-05"`) — `formatDate` handles via `Date` parse. |
| **evidence** | `selectedStatus` default `'Active'`; mixed ISO/date-only end dates. |
| **suggestedFixOwner** | — (informational) |

---

### 8 — system-flow — `selectedHospital` deep-dive may render without guard (P1)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P1 |
| **file** | `src/components/SystemFlowDashboard.tsx` |
| **line** | 271–274, ~940–1090 (ranked deep-dive; scatter panel L1308 guarded) |
| **issue** | `selectedHospital = find(id) || facilities[0]` can be **undefined** if `FACILITY_FLOW_METRICS` is empty. `selectedHospitalZoneAvg` guards `!selectedHospital`; **ranked subtab deep-dive** uses `selectedHospital.name` etc. without a top-level guard (scatter uses `{selectedHospital && (...)}` only). Empty API/error edge case → crash. |
| **evidence** | `useMemo` L271–274; `isLoading`/`error` return L363–370 runs **after** all `useMemo` hooks (hooks still run on failed load with `systemFlowData` null → `facilities[0]` undefined). |
| **suggestedFixOwner** | task (null guard on deep-dive panel; optional early return pattern) |

---

### 9 — system-flow — `provincialOverview.avgOccupancy` NaN when `totalBeds === 0` (P0)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P0 |
| **file** | `src/components/SystemFlowDashboard.tsx`, `data-system-flow.json` |
| **line** | 198–204, 481–485 |
| **issue** | Weighted occupancy divides by `totalBeds` with **no zero guard**. Many community sites have `staffedAcuteBeds: 0` but non-zero `hospitalOccupancy` in JSON; if **all** beds sum to 0 in a bad payload, UI shows **`NaN%`**. |
| **evidence** | `avgOccupancy = ... / totalBeds`; multiple `"staffedAcuteBeds": 0` entries in `data-system-flow.json`. |
| **suggestedFixOwner** | task (guard `totalBeds === 0`; exclude zero-bed facilities from weighted avg) |

---

### 10 — system-flow — Hardcoded KPI narrative "+12.4h since 2021" (P0)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P0 |
| **file** | `src/components/SystemFlowDashboard.tsx` |
| **line** | 517–520 |
| **issue** | P90 provincial KPI subtitle **`+12.4h since 2021`** is static copy, not derived from `HISTORICAL_FLOW_TIMELINES` or `provincialOverview` (violates §3 KPI/table alignment). |
| **evidence** | Literal string adjacent to `{provincialOverview.avgP90Wait}h`. |
| **suggestedFixOwner** | designer / task (compute delta from timeline or remove) |

---

### 11 — system-flow — Header omits per-array `source`; no `DataTimestamp` on tab (P2)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P2 |
| **file** | `src/components/SystemFlowDashboard.tsx`, `src/components/DashboardHeader.tsx` |
| **line** | 389–394 |
| **issue** | `data-system-flow.json` `_dataMetadata` has rich `source` strings for `FACILITY_FLOW_METRICS`, `AHS_WEEKLY_ED_LOS`, etc. Header shows only **`sourceVintage`** from `FACILITY_FLOW_METRICS` entry. Subtabs do not render `DataTimestamp` (unlike Surgical/Workforce). Users cannot see HQCA vs weekly PDF provenance in UI. |
| **evidence** | `_dataMetadata` L1301–1350; no `DataTimestamp` import usage in `SystemFlowDashboard.tsx`. |
| **suggestedFixOwner** | designer |

---

### 12 — system-flow — `AHS_WEEKLY_ED_LOS` facilityId slug mismatch (P2)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P2 |
| **file** | `data-system-flow.json` |
| **line** | FACILITY `id` L533 `rah-edmonton` vs weekly L1044 `facilityId` `royal-alexandra-hospital` |
| **issue** | Weekly ED LOS rows may not join to `FACILITY_FLOW_METRICS` if any UI matches on `facilityId` === `id`. |
| **evidence** | Dual IDs for same facility name. |
| **suggestedFixOwner** | task (normalizer in scraper or join layer) |

---

### 13 — system-flow — TAB_METADATA_MAP vs DASHBOARDS cadence (P3)

| Field | Value |
|-------|-------|
| **tab** | system-flow |
| **severity** | P3 |
| **file** | `src/App.tsx` |
| **line** | DASHBOARDS L152–153; TAB_METADATA_MAP L409–412 |
| **issue** | Tile: "Daily updates"; modal: `interval: 'daily at 06:00 MT'`, `updateType: 'auto'`. Footer uses DASHBOARDS `updateFrequency`. Largely consistent; marketing source "AHS Clinical Operations DB" vs metadata "AHS public wait-times API + HQCA FOCUS…" is vague. |
| **evidence** | Copy strings differ in specificity not interval. |
| **suggestedFixOwner** | designer (copy alignment) |

---

### 14 — shared shell — `DashboardHeader` never uses `DataTimestamp` / `sanitizeSource` (P1)

| Field | Value |
|-------|-------|
| **tab** | shell |
| **severity** | P1 |
| **file** | `src/components/DashboardHeader.tsx` |
| **line** | 40–86 |
| **issue** | Shared header duplicates timestamp formatting; does not expose **`source`** from metadata and does not reuse `sanitizeSource`. Tabs that pass pipeline IDs in `source` (disruptions) rely on vintage line only. |
| **evidence** | Only `entry?.sourceVintage` rendered L84. |
| **suggestedFixOwner** | designer |

---

### 15 — shared shell — `LiveDataBadge` is a no-op (P2)

| Field | Value |
|-------|-------|
| **tab** | shell |
| **severity** | P2 |
| **file** | `src/components/LiveDataBadge.tsx` |
| **line** | 14–16 |
| **issue** | Component always `return null`. Plan §1 notes dead component — do not rely on it for freshness (use `DashboardHeader` / `useSyncStatus`). |
| **evidence** | `return null`. |
| **suggestedFixOwner** | task (remove dead code or implement) |

---

### 16 — shared shell — ER metadata `arrayKey` vs file convention (P3)

| Field | Value |
|-------|-------|
| **tab** | shell / er-waits |
| **severity** | P3 |
| **file** | `src/App.tsx` |
| **line** | 505–508, 1738 |
| **issue** | `arrayKey="ER_WAIT_TIMES"` does not exist in any JSON `_dataMetadata` map; synthetic map only. Acceptable but differs from other tabs. |
| **evidence** | `erWaitTimesMetadata` inline object. |
| **suggestedFixOwner** | task |

---

### 17 — shared shell — `ContributionsSection` global (OK)

| Field | Value |
|-------|-------|
| **tab** | shell |
| **severity** | — |
| **file** | `src/App.tsx` |
| **line** | 2545 |
| **issue** | Renders below all modules; no acute-specific defect found in static review. |
| **evidence** | Single mount after tab switcher. |
| **suggestedFixOwner** | — |

---

### 18 — shared shell — `MapComponent` (OK with notes)

| Field | Value |
|-------|-------|
| **tab** | er-waits |
| **severity** | P3 note |
| **file** | `src/components/MapComponent.tsx` |
| **line** | 109, 252–255, 308 |
| **issue** | Null coordinates skipped; selected hospital pan guarded. **Note:** `waitTime` in map type is `number` only — unavailable ER sites may still plot if lat/lng present (parent filters in list, not map input). |
| **evidence** | `if (h.latitude === null || h.longitude === null) return`. |
| **suggestedFixOwner** | designer (optional: grey out unavailable on map) |

---

## TAB_METADATA_MAP consistency (acute-related)

| Module id | In TAB_METADATA_MAP | Header `arrayKey` / metadata source | Match? |
|-----------|---------------------|-------------------------------------|--------|
| er-waits | yes, auto, 30m | `ER_WAIT_TIMES` — App/sync | Partial (interval 10m vs 30m) |
| disruptions | yes, auto, 24h | `disruptions` — inline scraper id | Partial (no file `_dataMetadata`) |
| system-flow | yes, auto, daily 06:00 MT | `FACILITY_FLOW_METRICS` — API `_dataMetadata` | Yes |

---

## Files reviewed

- `src/App.tsx`, `src/components/MapComponent.tsx`, `ServiceDisruptionsDashboard.tsx`, `SystemFlowDashboard.tsx`, `DashboardHeader.tsx`, `DataTimestamp.tsx`, `LiveDataBadge.tsx`, `ContributionsSection.tsx`, `useSyncStatus.ts`, `systemFlowData.ts`
- `data-er-waittimes.json`, `data-disruptions.json`, `data-system-flow.json`, `data-snapshots.json` (sample)
- No dedicated `*Data.ts` for ER/disruptions; `systemFlowData.ts` is compile-time reference; runtime system-flow uses API JSON.

---

## Verdict

**Not** "no new issues" — **18 numbered items** (14 actionable, 4 informational/OK). Highest priority: system-flow **NaN occupancy** and **hardcoded P90 delta**, ER **zero wait in averages**, disruptions/system-flow **metadata & header sanitization**, system-flow **selectedHospital** crash edge case.