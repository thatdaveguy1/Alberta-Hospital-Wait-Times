# Group 4 Audit: Prevention + Equity/Outcomes

**Scope:** Cancer, Public Health, Mental Health, Regional Inequity, Spending  
**Mode:** Read-only (Phase F remediation)  
**Date:** 2026-07-09

## Summary

| Tab | New findings | Already addressed (lessons.md) |
|-----|--------------|------------------------------|
| Cancer Care & Screening | 2 | 1 |
| Public Health & Surveillance | 4 | 1 |
| Mental Health & Addiction | 1 | 1 |
| Health Inequity (Regional) | 3 | 1 |
| Health Spending & Efficiency | 2 | 0 |

---

## Findings

### 1. Cancer Care & Screening (`CancerDashboard.tsx`)

| # | Severity | File | Line | Issue | Evidence | suggestedFixOwner |
|---|----------|------|------|-------|----------|-------------------|
| C1 | **P1** | `src/components/CancerDashboard.tsx` | 227–228 | Header promises **screening participation rates** but no screening UI or data binding exists. | Title/description mention screening; component never reads `CANCER_SCREENING_RATES`. `data-cancer.json` has `CANCER_SCREENING_RATES: []` with metadata `sourceVintage: "Hand-authored baseline"`. | pipeline + UI |
| C2 | **P2** | `src/components/CancerDashboard.tsx` | 192–196 | `hasNoData` requires **all four** arrays non-empty; empty screening alone does not block render, but any single empty core array fails the **entire** dashboard. | Unlike partial-empty patterns elsewhere, one missing series shows global "No cancer data available" even if burden/surgery/radiation/centres are populated. | UI |
| C3 | *(fixed)* | `src/components/CancerDashboard.tsx` | 287–293 | Subset totals labeled as major-cancer subset. | Per lessons.md (2026-07-08): "2026 Projected Major Cancer Diagnoses" + footnote — **no re-flag**. | — |

---

### 2. Public Health & Surveillance (`PublicHealthDashboard.tsx`)

| # | Severity | File | Line | Issue | Evidence | suggestedFixOwner |
|---|----------|------|------|-------|----------|-------------------|
| PH1 | **P1** | `src/components/PublicHealthDashboard.tsx` | 227–262 vs 640–1038 | **Hidden subtabs:** nav exposes only Respiratory / Wastewater / Immunization; **Notifiable** and **Advisories** panels remain in code but are unreachable via UI. | No `setActiveSubTab('notifiable'|'advisories')` buttons; `activeSubTab` union still includes those values. Header discloses removal (line 222) — partial fix per lessons.md; dead panels still confuse audits. | UI |
| PH2 | **P1** | `src/components/PublicHealthDashboard.tsx` | 932–956 | **Hardcoded immunization KPIs** (68.5%, 76.2%) in notifiable subtab narrative, not tied to `CHILDHOOD_IMMUNIZATION_COVERAGE`. | Inline `style={{ width: '68.5%' }}` and fixed `<strong>` values while live immunization data exists on another subtab. | UI |
| PH3 | **P2** | `data-public-health.json` | 268–269, 310–319 | `NOTIFIABLE_DISEASE_INCIDENCE` and `ENVIRONMENTAL_ADVISORIES` are **empty**; metadata still `updateType: "manual"`, `Hand-authored baseline`. | Arrays length 0; panels would show empty KPIs/charts if navigable. | pipeline |
| PH4 | **P2** | `src/components/PublicHealthDashboard.tsx` | 974–975 | Advisories subtab uses `DataTimestamp` with `arrayKey="OUTBREAK_PROTOCOLS"` while content is `ENVIRONMENTAL_ADVISORIES`. | Timestamp/source line does not match displayed dataset. | UI |
| PH5 | *(partial fix)* | `PublicHealthDashboard.tsx` | 222 | Module/header copy updated for Phase 19. | lessons.md — disclosure present; PH1 remains for unreachable code. | — |

---

### 3. Mental Health & Addiction (`MentalHealthDashboard.tsx`)

| # | Severity | File | Line | Issue | Evidence | suggestedFixOwner |
|---|----------|------|------|-------|----------|-------------------|
| MH1 | **P2** | `src/components/MentalHealthDashboard.tsx` | 97–100 | `substanceHarmStats` uses `filteredHarmData[0]` as `reduce` seed; **empty filter** yields invalid `latest`/`peak`. | No `filteredHarmData.length === 0` guard before `[length - 1]` and reduce. | UI |
| MH2 | *(fixed)* | `MentalHealthDashboard.tsx` | 630–633 | ABED `availableBeds: null` → "Live availability not currently reported", not `0`. | lessons.md ABED fix — **no re-flag**. | — |

---

### 4. Health Inequity (`RegionalInequityDashboard.tsx`)

| # | Severity | File | Line | Issue | Evidence | suggestedFixOwner |
|---|----------|------|------|-------|----------|-------------------|
| RI1 | **P0** | `data-regional-inequity.json` | *(absent keys)* | **`TRAVEL_FOR_CARE` and `SERVICE_ACCESS_METRICS` missing** from API JSON; component defaults to `[]`. | `grep` on JSON: no keys; `_dataMetadata` only 3 entries (need/disease/ED). Access-travel subtab mostly `—` / disclosure text. | pipeline |
| RI2 | **P1** | `src/components/RegionalInequityDashboard.tsx` | 123–163 | Comment says **"5 REPRESENTATIVE LGAs"** but `n = COMMUNITY_NEED_PROFILES.length` (135); disease/ED/travel/access averages divide sums by **need-profile count**, not per-dataset length. | Stale comment; if travel/access arrays were partial-length, benchmarks would be wrong. Currently 0/135 → all travel/access provincial benchmarks **0**. | UI + data |
| RI3 | **P2** | `src/components/RegionalInequityDashboard.tsx` | — | **`population` in JSON** (`COMMUNITY_NEED_PROFILES[].population`) not surfaced in UI for annual ED visit derivation. | Type allows `population?` in `regionalInequityData.ts`; cards use rates (`totalEdVisitsPer1000`) — OK if intentional; lessons population fix may be data-only. | UI (if annual counts desired) |
| RI4 | *(fixed)* | `RegionalInequityDashboard.tsx` | 138–163 | No hardcoded `/ 5` divisor. | lessons.md — uses `.length` — **no re-flag**. | — |

---

### 5. Health Spending & Efficiency (`SpendingDashboard.tsx`)

| # | Severity | File | Line | Issue | Evidence | suggestedFixOwner |
|---|----------|------|------|-------|----------|-------------------|
| SP1 | **P1** | `src/components/SpendingDashboard.tsx` | 182, 471–473 | **`latestAlbertaActivity` unchecked**; KPI shows hardcoded **`+8.1% vs prev`** not derived from trend. | `ALBERTA_ACTIVITY_VOLUME_TREND[ length - 1 ]` without empty guard; growth string is static. | UI |
| SP2 | **P2** | `src/components/SpendingDashboard.tsx` | 304+ | No `hasNoData` / partial-empty gate (only `isLoading` / `error`). | Empty activity array → undefined property access on KPI row. | UI |
| SP3 | **P2** | `data-spending.json` | multiple | Several provinces have `spendingAsPercentGdp: null`; detail card handles N/A; **bar chart** still plots `spendingAsPercentGdp` (may show gaps). | Lines 26, 36, 46, etc. UI line 975–978 guards detail KPI. | UI |

---

## Cross-cutting (Group 4)

| Check | Status |
|-------|--------|
| `formatMinutesToHm` / `cn` imports in these tabs | Not required in audited files |
| Source-label pipeline ID leakage | Group 4 metadata uses user-facing strings (e.g. Open Alberta, CIHI); cancer screening still "Hand-authored baseline" |
| `DataTimestamp` `arrayKey` vs visible data | PH4 (advisories), cancer header uses surgery waits not burden/screening |
| Zone filter `'All'` = all zones | Not audited in depth this group; no new issue in sampled tabs |
| `useMemo` null guards | MH1, SP1–SP2 gaps; RI travel/access guarded with `length === 0` |

---

## Metadata completeness

| File | Arrays in JSON | `_dataMetadata` keys | Gap |
|------|----------------|----------------------|-----|
| `data-cancer.json` | burden, surgery, radiation, centres, screening (empty) | Includes screening | Screening empty + hand-authored |
| `data-public-health.json` | RVD, wastewater, immunization, notifiable (empty), advisories (empty), protocols | All keys present | Empty notifiable/advisories |
| `data-mental-health.json` | Full set incl. addiction beds | Complete | — |
| `data-regional-inequity.json` | 3 arrays + population on profiles | 3 keys only | Missing travel/access metadata & data |
| `data-spending.json` | National compare + activity trends | Per implementation matrix | Partial null GDP fields |

---

## Recommended Phase F priority

1. **P0:** Restore or explicitly retire `TRAVEL_FOR_CARE` / `SERVICE_ACCESS_METRICS` (pipeline + metadata).  
2. **P1:** Remove or gate unreachable PH subtabs; wire or remove hardcoded 68.5%/76.2%; fix cancer screening copy vs data; fix spending `latestAlbertaActivity` + derived YoY.  
3. **P2:** MH empty harm guard; RI benchmark divisor per dataset; spending empty-state.

**Total new actionable findings: 12** (excluding items marked fixed in lessons.md).