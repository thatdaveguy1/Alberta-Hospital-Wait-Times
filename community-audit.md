# Community Care Dashboard Audit (Group 3)

**Scope:** `primary-care`, `long-term-care` (`continuing-care`), `patient-experience`, `virtual-care`  
**Date:** 2026-07-09  
**Method:** Code + `data-*.json` / `_dataMetadata` cross-check (read-only; no headed browser in this pass)

---

## Summary

| Module | P0 | P1 | P2 | P3 |
|--------|----|----|----|-----|
| long-term-care | 0 | 3 | 2 | 0 |
| patient-experience | 0 | 1 | 3 | 0 |
| primary-care | 0 | 0 | 4 | 1 |
| virtual-care | 0 | 0 | 1 | 1 |

**Highest priority:** LTC **modulo filter regression** on Clinical Quality (hides 8/11 CIHI rows). Zone **“All”** still means Calgary+Edmonton only on LTC placement and PX safety.

---

## Findings

### 1. long-term-care — Modulo filter hides resident quality rows (REGRESSION)

| Field | Value |
|-------|-------|
| **tab** | `long-term-care` (`ContinuingCareDashboard`) |
| **severity** | **P1** |
| **file** | `src/components/ContinuingCareDashboard.tsx` |
| **line** | 593 |
| **issue** | Sidebar “benchmark” list uses `.filter((_, i) => i % 3 === 2)` while the bar chart correctly uses `filteredQualityData` (all 11 rows). Only 3 of 11 `RESIDENT_QUALITY_OUTCOMES` rows render in the sidebar. |
| **evidence** | `data-continuing-care.json` has 11 quality rows; modulo indices `[2,5,8]` show one row per metric name, dropping zone/year variants. `lessons.md` (2026-07-08) documents removal of this pattern; chart at line 566 uses full data. |
| **suggestedFixOwner** | **task** (designer for copy/layout after data fix) |

---

### 2. long-term-care — Placement zone “All” is Calgary+Edmonton subset

| Field | Value |
|-------|-------|
| **tab** | `long-term-care` |
| **severity** | **P1** |
| **file** | `src/components/ContinuingCareDashboard.tsx` |
| **line** | 153–158, 448–451 |
| **issue** | `selectedZone === 'All'` filters to `Calgary Zone` \| `Edmonton Zone` only. Dropdown label says “Calgary & Edmonton (Combined)” but audit matrix expects honest “All” or explicit subset labeling. Data includes `Central Zone`, `South Zone`, `North Zone`, `Alberta` (eval: 6 zones). |
| **evidence** | `filteredPlacementData` lines 154–156; options omit Central/South though North is selectable alone. KPI cards (288–289, 321–322) hard-limit to Calgary+Edmonton 2025 averages. |
| **suggestedFixOwner** | **task** |

---

### 3. patient-experience — Safety zone “All Main Zones” drops Central/South

| Field | Value |
|-------|-------|
| **tab** | `patient-experience` |
| **severity** | **P1** |
| **file** | `src/components/PatientExperienceDashboard.tsx` |
| **line** | 167–171, 668–671 |
| **issue** | `safetyZoneFilter === 'All'` returns only Calgary+Edmonton `CLINICAL_SAFETY_TRENDS`. JSON has 15 zone-year rows across 5 zones; Central and South never appear when filter is “All”. Dropdown offers North but not Central/South. |
| **evidence** | `data-patient-experience.json` `CLINICAL_SAFETY_TRENDS` includes `Central Zone` and `South Zone` (lines 281–314 in sample). |
| **suggestedFixOwner** | **task** |

---

### 4. long-term-care — Missing wait years trend as `0` not gap

| Field | Value |
|-------|-------|
| **tab** | `long-term-care` |
| **severity** | **P2** |
| **file** | `src/components/ContinuingCareDashboard.tsx` |
| **line** | 78–87, 135–143 |
| **issue** | KPI trend `useMemo` sets `yearlyData` to `0` when no valid values (`values.length > 0 ? avg : 0`). Detail cards/charts use `null` → N/A for P50 (lines 73–74, 498). Trend panel can show misleading zero wait days for years without data. |
| **evidence** | `placementStats` null-guards zeros for chart; `trendData` / `kpiStats` do not. |
| **suggestedFixOwner** | **task** |

---

### 5. primary-care — Continuity KPIs default missing data to `0%`

| Field | Value |
|-------|-------|
| **tab** | `primary-care` |
| **severity** | **P2** |
| **file** | `src/components/PrimaryCareDashboard.tsx` |
| **line** | 160–161, 203–207, 414, 607 |
| **issue** | `attachmentRate`, `sameDayAccess`, `waitSatisfaction`, etc. use `?? 0`. If `CONTINUITY_SATISFACTION` lacks `zone === 'Alberta'` or load fails partially, UI shows **0%** not N/A. |
| **evidence** | `albertaContinuity?.sameNextDayAccessPct ?? 0`; attachment hero uses `attachmentRate` from same pattern. |
| **suggestedFixOwner** | **designer** + **task** |

---

### 6. primary-care — No `DataTimestamp` on continuity / attachment-access KPIs

| Field | Value |
|-------|-------|
| **tab** | `primary-care` |
| **severity** | **P2** |
| **file** | `src/components/PrimaryCareDashboard.tsx` |
| **line** | 203–207 (KPIs); no `arrayKey="CONTINUITY_SATISFACTION"` |
| **issue** | Attachment subtab shows same-day access and satisfaction from `CONTINUITY_SATISFACTION` without compact `DataTimestamp`. `_dataMetadata.CONTINUITY_SATISFACTION` exists in `data-primary-care.json` but is not referenced in UI. |
| **evidence** | `DataTimestamp` only on ATTACHMENT_RATES, ACCEPTING_PROVIDERS, PCN_CAPACITY, ED_RELIANCE (grep). JSON metadata includes `CONTINUITY_SATISFACTION`, `CONTINUITY_SATISFACTION_HQCA`, `CIHI_SAME_DAY_ACCESS` — latter two arrays unused in component type. |
| **suggestedFixOwner** | **designer** |

---

### 7. primary-care — Custom fetch vs `useDomainData` (no error/retry shell)

| Field | Value |
|-------|-------|
| **tab** | `primary-care` |
| **severity** | **P2** |
| **file** | `src/components/PrimaryCareDashboard.tsx` |
| **line** | 59–83, 274 |
| **issue** | Only community tab using manual `fetch('/api/data/primary-care')` instead of `useDomainData`. Failed fetch sets `isLoading` false with empty arrays → **0%** KPIs; no error/retry UI like sibling dashboards. |
| **evidence** | `catch(() => { if (!cancelled) setIsLoading(false); })` with no error state. |
| **suggestedFixOwner** | **task** |

---

### 8. patient-experience — Specialist wait weeks plotted as “%” satisfaction bars

| Field | Value |
|-------|-------|
| **tab** | `patient-experience` (Patient Voice) |
| **severity** | **P2** |
| **file** | `src/components/PatientExperienceDashboard.tsx` |
| **line** | 481–482 |
| **issue** | `PATIENT_VOICE_BY_SETTING` mixes survey % and **median wait weeks** in `albertaRatePct` (e.g. Orthopedics 64 weeks). Bar chart labels both series as “Performance Rate (%)” / “National Average (%)”. `canadaRatePct: null` for all Specialist Access rows. |
| **evidence** | `data-patient-experience.json` setting `Specialist Access`, metrics `*Median Wait (weeks)*`. |
| **suggestedFixOwner** | **designer** |

---

### 9. patient-experience — Extra JSON datasets not in dashboard type (latent / hidden)

| Field | Value |
|-------|-------|
| **tab** | `patient-experience` |
| **severity** | **P2** |
| **file** | `src/components/PatientExperienceDashboard.tsx` |
| **line** | 50–56 (type); `data-patient-experience.json` |
| **issue** | File contains `INPATIENT_EXPERIENCE_TRENDS_HQCA`, `CIHI_ALL_READMISSION_RATES`, `CIHI_ACSC_HOSPITALIZATIONS`, `CIHI_WAIT_TIME_SATISFACTION` with full `_dataMetadata`; component `PatientExperienceData` omits them — no subtabs, no disclosure. |
| **evidence** | Eval: data arrays ⊇ component bindings; metadata keys complete for all arrays. |
| **suggestedFixOwner** | **explore** / **task** (wire or document) |

---

### 10. virtual-care — Inbound share divides by zero if volumes empty

| Field | Value |
|-------|-------|
| **tab** | `virtual-care` |
| **severity** | **P3** |
| **file** | `src/components/VirtualCareDashboard.tsx` |
| **line** | 122, 217 |
| **issue** | `clinicalReceived / totalReceived` when `totalReceived === 0` yields `NaN%` in KPI card. `DEFAULT_VOLUME` uses zeros; edge case if `HEALTH_LINK_VOLUMES` empty. |
| **evidence** | Line 217 `.toFixed(1)}%` without guard. |
| **suggestedFixOwner** | **designer** |

---

### 11. virtual-care — Metadata pipeline IDs (mitigated in UI)

| Field | Value |
|-------|-------|
| **tab** | `virtual-care` |
| **severity** | **P3** |
| **file** | `data-virtual-care.json`, `src/components/DataTimestamp.tsx` |
| **line** | metadata `source`: `virtualCareFetcher`, `alberta211Scraper`; map lines 33, 60 |
| **issue** | Raw `_dataMetadata.source` still stores fetcher filenames; **DataTimestamp** maps them to user-facing labels. Verify header/subtab timestamps after any new array keys. |
| **evidence** | Eval pipeline-like sources; `sanitizeSource` entries present. |
| **suggestedFixOwner** | **task** (writers emit human labels at source) |

---

## Passed / no new issue

- **LTC P50 detail:** `0` → `null` + **N/A** on placement cards (498) — aligns with lessons.
- **LTC placement KPIs:** Computed from `placementStats` arrays, not hardcoded trio (287–291, 321–324).
- **LTC metadata:** All four UI `arrayKey`s exist in `_dataMetadata` (eval).
- **PX voice filter:** `settingFilter === 'All'` returns full `PATIENT_VOICE_BY_SETTING` (162–163).
- **PX voice disclaimer:** Narrative block on voice subtab (323–332).
- **PX hospitals:** `/api/hospitals` merge with normalization for complaints simulator (86–157).
- **Primary attachment KPIs:** Derived from `ATTACHMENT_RATES` latest Alberta row (154–161), not static constants.
- **Primary metadata:** All seven data arrays in JSON have matching `_dataMetadata` keys (eval).
- **Virtual:** `useMemo` guarded by loading gate; cohort/disposition subtabs use `DataTimestamp` with correct keys.
- **Imports:** No missing `cn` / `formatMinutesToHm` in these four components.

---

## Metadata ↔ `DataTimestamp` matrix (component-used keys)

| Module | DashboardHeader / DataTimestamp `arrayKey` | In `_dataMetadata` |
|--------|---------------------------------------------|-------------------|
| primary-care | ATTACHMENT_RATES, ACCEPTING_PROVIDERS, PCN_CAPACITY, ED_RELIANCE_BY_CONTINUITY | Yes (CONTINUITY_SATISFACTION **not** stamped in UI) |
| long-term-care | CONTINUING_CARE_PLACEMENT_STATS, RESIDENT_QUALITY_OUTCOMES, HOME_CARE_EXPERIENCE, CONTINUING_CARE_COMPLIANCE | Yes |
| patient-experience | PATIENT_VOICE_BY_SETTING, INPATIENT_*, ED_*, CLINICAL_SAFETY_*, PATIENT_COMPLAINTS | Yes |
| virtual-care | HEALTH_LINK_VOLUMES, VIRTUAL_MD_*, EMS_*, ADJACENT_HELPLINES | Yes |

---

## Recommended Phase F order

1. Remove LTC line 593 modulo; use `filteredQualityData` for sidebar list.
2. Fix zone “All” semantics (LTC placement + PX safety) or rename labels and add missing zone options.
3. Align LTC trend null handling with chart; primary-care `?? 0` → N/A + `useDomainData`.
4. Split PX Specialist Access from satisfaction chart or dual-axis / separate panel.
5. Virtual inbound % guard when `totalReceived === 0`.