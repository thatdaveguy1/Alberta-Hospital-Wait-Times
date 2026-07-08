# Visual Dashboard Audit Findings (First 5 Tabs + System Flow)

*Audit date: 2026-07-08*
*Method: Headed browser inspection of http://127.0.0.1:3004/*
*Auditor: Agent run on Oh My Pi*

## 1. Diagnostics & Labs (Diagnostic Imaging + Labs)

### Laboratory Waits subtab
- **Repeated / poorly presented data**: All 153 APL community labs display `Unavailable` / `0:00` wait time at 03:30 AM. Provincial averages shown as `0:00`, giving the impression the dashboard is broken rather than labs being closed.
- **Opportunity**: Add a "labs closed" explanation or business-hours-aware display so zeros are not interpreted as missing data.
- **Incorrect information**: None observed yet, but the `0:00` values are misleading without context.

### Imaging Gaps subtab
- **Poorly presented data**: Chart title says "2019 – 2025" but the X-axis begins at 2018.
- **Incorrect / misleading source**: Data timestamp source reads `cihiWaitTimesDownloader` (the pipeline filename) instead of a user-facing source like "CIHI Diagnostic Imaging Tests".
- **Opportunity**: Fix the date range mismatch and source label.

### Diagnostic Sites subtab
- Manual data table is legible; source label is honest ("AHS imaging wait times (estimated from Power BI)").

### Lab Turnaround subtab
- Manual data from APL standards; labels are truncated in the chart (`Cardiac Troponi...`, `Complete Blood ...`) but tooltips likely show full names.

## 2. Primary Care Access

### Attachment & Access subtab
- **Incorrect attribution**: The chart "Primary Care Attachment Rates by Demographic Group" is labeled `Source: Alberta Find a Provider`. Alberta Find a Provider is a directory, not a source for attachment-rate statistics. Attachment rates come from CIHI Shared Health Priorities.
- **Confusing narrative**: "Critical Vulnerability identified: ... Low-income earners (84.5%), young adults (91.4%), and rural residents (77.3%) experience severe gaps compared to seniors (93.1%)." 91.4% for young adults is not a "severe gap" in this framing; the insight is contradictory.
- **Opportunity**: Correct the source attribution and rewrite the vulnerability insight to match the numbers.

### Accepting Providers subtab
- 2,241 providers shown; directory is functional but truncated in the text audit. Needs visual verification of list rendering.

### PCN Capacity subtab
- Manual data with zone networks / patient counts / GP counts. Source is honest about being approximate.

### ER Overreliance subtab
- Manual analytical model; note the "16.2% unattached" is consistent with the 83.8% attached KPI. Good.

## 3. Long Term Care & Seniors Care

### Placement & Flow subtab
- **KPI / detail mismatch**: KPI cards show `57.3% placed within 30 days`, `25 days` median, `67.5% preferred option`. The detailed "Flow & Preferred Options" panel shows 2025 Calgary `58.5%` / `68.2%` and Edmonton `56.2%` / `66.8%`. The KPIs do not match the latest zone data shown.
- **Missing data shown as zero**: Historical entries for 2019, 2020, 2022 show `P50: 0d` — missing data should be labeled `N/A`.

### Clinical Quality subtab
- Data looks reasonable; improvement trend note is specific.

### Home Care Continuity subtab
- **Typo**: "HQA FOCUS surveys" should be "HQCA FOCUS surveys".
- Manual data with zone ratings; reasonable.

### Compliance Registry subtab
- **Missing / dead subtab**: Shows `No compliance data available`. The underlying `CONTINUING_CARE_COMPLIANCE` array was removed in Phase 21 (fabricated data), but the empty subtab remains in the UI. This is a poor user experience.
- **Opportunity**: Remove the Compliance Registry subtab or replace it with a real data source.

## 4. Patient Experience & Care Quality

### All subtabs
- **Repeated block**: The "THE NARRATIVE CHAIN OF QUALITY EFFICACY" paragraph appears at the top of every subtab. It is a long, opinionated framing that is repeated on every view.
- **Typo**: "HQA" appears multiple times (e.g., "HQA FOCUS metric", "HQA Statement", "HQA FOCUS surveys") instead of "HQCA".

### Patient Voice subtab
- The comparative experience chart has many overlapping labels (surgical specialty names mixed in with patient experience indicators), suggesting a label reuse bug or poor axis scaling.

### Clinical Safety subtab
- **Poorly presented data**: Chart legend/labels repeat `Calgary Zone` three times and `Edmonton Zone` three times, making the grouped data unreadable.

### Patient Complaints subtab
- Facility dropdown has duplicate: `Fort Sask Community Hospital` and `Fort Saskatchewan Community Hospital`.

## 5. Virtual Care & 811 Access

### All subtabs
- **Repeated block**: The "DATA SOURCE & AUDIT VERIFICATION LEDGER" footer with the same three source citations is repeated verbatim on every subtab.

### Adjacent Helplines subtab
- **Poorly presented data**: The four "KEY SOCIAL NEEDS" cards use the same heading repeated four times with different labels, which is visually redundant.
- **Possible stale number**: PADIS calls shown as `45,200` vs. the source data which notes `46,000` — needs verification.

## 6. Hospital System Flow (additional tab audited)

### All subtabs
- **Typo**: "HQA FOCUS" in the data timestamp; should be "HQCA FOCUS".
- **Repeated block**: The "AHS WEEKLY ED LOS PDF OUTPUT RELEASES" section appears in Bottleneck Correlation, Historical Degradation, and Benchmarks & Profiles tabs.

### Benchmarks & Profiles subtab
- **Missing data presented as zeros/NaN**: "UPSTREAM LGA DEMAND PROFILES" cards all show `ED VISITS 0`, `POPULATION 0`, `VISIT RATE NaN / 1k`. The underlying data arrays (`REGIONAL_LGA_DEMAND`, `SERVICE_ACCESS_METRICS`, `TRAVEL_FOR_CARE`, `LGA_COMMUNITY_NEEDS`) were removed in Phase 21 as fabricated, but the dashboard still renders empty cards.
- **Typo**: In the 2026-Q1 snapshot: `Occumpancy` should be `Occupancy`.

## 7. ER Wait Times (default page, no subtabs)

- **Potential data issue**: Historical Peaks section shows `24H MAX`, `7D MAX`, and `30D MAX` all as `13:39` at Rockyview. It is unlikely that the exact same peak occurred across all three windows; this suggests the max-stats endpoint is returning the same record for all ranges or the UI is not distinguishing ranges.
- Some community health centres show `0:00` wait time (e.g., Cochrane, Okotoks, South Calgary) at 03:30 AM; this may be due to closed urgent-care hours rather than a live zero-minute wait. The presentation does not distinguish closed vs. zero wait.

## 8. Service Disruptions (no subtabs)

- **Incorrect location data**: `Hinton Healthcare Centre` is listed with location `Smoky Lake, AB` instead of `Hinton, AB`.
- **Stat card / category mismatch**: The top cards show `Active Advisories 18`, `Full Site Closures 7`, `Reduced Hours 2`, `Bed/Specialty Reductions 0`. The filter list includes `Closure`, `Reduced Hours`, `Bed Reduction`, and `Service Suspension`. The counts do not clearly map to the filter categories (e.g., Service Suspension events are not represented in the top-card breakdown).
- Some disruptions have very long durations (e.g., `Boyle Healthcare Centre` closure from Jul 2, 2024 to Aug 31, 2026; `Consort Hospital` from Aug 17, 2022 to TBD). These may be accurate long-term closures but should be visually distinguishable from short-term events.

## 9. Surgical Waitlists

### Provincial Overview subtab
- **Possible regression**: `Chartered Surgical Facilities Share` shows `34.0%` and `Provincial OR Utilization` shows `88.5%`. Phase 13 previously fixed these to `15.0%` and `89.9%` respectively. The current values may be hardcoded regressions or derived from a different dataset.
- **Facility count mismatch**: The directory text says "all 11 licensed acute care and contracted Chartered Surgical Facilities", but the dropdown lists 10 facilities and there are more than 11 surgical facilities in Alberta.
- The KPI cards (36.8 weeks, 43.1 weeks, 15.2 weeks, 5.9 weeks) match the table values, so they appear data-driven now.

### Cancer Surgeries subtab
- **Duplicate year**: The chart X-axis shows `2017` twice.
- **Estimate disclosure**: National Surgical Milestones percentages are labeled "program-reported estimate; no public registry source", which is honest but could be more clearly marked as unverified estimates.

### Therapy Centers subtab
- **Location duplication**: Cards show city names twice (e.g., `Barrhead, Barrhead (Edmonton Zone)`). This is a formatting bug.

## 10. Health Workforce & Supply

- **Repeated KPI block**: The same four top cards (14,164 physicians, 45,171 RN permits, 63,825 vacancies, 34.3% retirement cliff) appear at the top of every subtab. They are not always relevant to the subtab content (e.g., Retirement Risk subtab still shows RN permits and vacancies).
- **Inconsistent trend support**: Some cards say `NO TREND DATA AVAILABLE` while others say `CLICK TO VIEW TREND`. The trend-click behavior should be uniform or the cards should be filtered by subtab.
- **Misleading data timestamp**: The top badge says `Data Timestamp: Latest CPSA quarterly release` on every subtab, even when the content is StatCan (Job Vacancies) or manual (Allied Health).
- **Illustrative labels**: Several blocks in Job Vacancies are marked `(illustrative)`, which is good disclosure, but they sit beside real StatCan data and may confuse users.

## 11. Cancer Screening & Care

### Tumor Burden subtab
- **Suspect projection**: `2026 PROJECTED ANNUAL CANCER DIAGNOSES ~13,880` appears low for a province of ~4.8 million people (expected incidence ~24,000). The source is listed as Alberta Cancer Registry but the number may be a subset, a specific cancer type, or a data error. Needs verification.
- `2026 PROJECTED ANNUAL CANCER DEATHS ~3,670` with lung cancer noted as ~1,650 deaths (~45% of all cancer deaths). The death count is plausible if the diagnosis count is accurate, but the low diagnosis number raises questions.

### Cancer Surgeries subtab
- Duplicate year `2017` on the chart X-axis.

## 12. Public Health & Outbreaks

- **Repeated narrative blocks**: The "COMMUNITY PREVENTION & PATHOGEN TRANSMISSION DYNAMICS" paragraph and the "AHS Infection Prevention & Control Outbreak Manual" protocol steps are repeated on every subtab.
- **Wastewater formatting**: COVID viral load values are displayed as extremely small decimals (e.g., `0.0002482014404079443`), which is poor presentation. They should be formatted in scientific notation or as normalized index values.
- **Wastewater zero signals**: Some plants show all three signals as `0` but still display `Low Load`. This is misleading if no data was collected.
- **Immunization chart duplication**: The X-axis in the childhood immunization chart repeats zone labels (`Calgary Zone` and `Central Zone` appear twice).
- **Subtab count**: Only 3 subtabs remain (Respiratory, Wastewater, Immunization). The removed `notifiable` and `advisories` subtabs are correctly gone, but the data that originally populated them (now removed) might be candidates for new pipelines if sources exist.

## 13. Mental Health & Addictions

### Substance Harms subtab
- **KPI / detail mismatch**: The KPI card says `~1,960` apparent toxicity deaths in 2025, but the annual breakdown table shows `610` deaths for 2025. The KPI may be annualized/projected, but the discrepancy is not explained.

### Addiction Beds subtab
- **Missing available-bed data**: `AVAILABLE BEDS TODAY 0 vacancies` and `AVG SYSTEM BED OCCUPANCY 100.0%`. Individual site cards show `Available Beds: / 41` (blank numerator) for most sites. This suggests the scraper is not capturing live bed availability.

### Crisis Helplines subtab
- **Rendering bug / duplicated footer**: The footer/legal text appears multiple times with variations: `© 2026 Alberta Health Services`, `© 2026 ALBERTA HEALTH SERVICES`, `© 6 Alberta Health Services`. Also `call 911` is duplicated and the Crisis Text Line shows inconsistent numbers (`741741`, `741`, `202`).

## 14. Regional Health Inequity

- **Repeated LGA selector**: The full LGA dropdown list (100+ items) is rendered on every subtab, pushing the actual data below the fold. This is a poor presentation; the selector should be a persistent sidebar or limited to the Community Profile subtab.
- **Repeated narrative**: The "SOCIOECONOMIC STATUS & HEALTH INEQUITY DYNAMICS" paragraph appears on every subtab.
- **Truncated data visibility**: Because the LGA selector dominates the extracted text, the actual disease-burden, ED-reliance, and travel-for-care data could not be easily audited. The layout itself is the primary issue.

## 15. Health Spending & Productivity

- **Repeated narrative block**: The "VALUE FOR MONEY & MACRO EFFICIENCY SIGNAL" paragraph is repeated on every subtab.
- **Contradictory / stale value**: The repeated paragraph states Alberta’s per capita expenditure is `$8,540` and the highest among major provinces. The National Scoreboard subtab shows the actual CIHI value as `$9,598`. The $8,540 appears to be a stale hardcoded value.
- **Pipeline-name sources**: National Scoreboard shows `Source: cihiDownloader` and Physician Payments shows `Source: openAlbertaBillingFetcher`. These should be user-facing source names.
- **Physician Payments data**: The `openAlbertaBillingFetcher` returned 0 records in the dashboard-review-fix-plan.md, yet the Physician Payments subtab displays data. This data may be hand-authored fallback and should be labeled accordingly.

## Cross-cutting patterns (updated)
1. **Repeated narrative blocks** on nearly every multi-subtab dashboard (Patient Experience, Virtual Care, System Flow, Public Health, Health Spending, Regional Inequity).
2. **Pipeline-name source labels** instead of human-readable sources (Diagnostics, Spending, possibly others).
3. **HQA vs HQCA typo** in multiple tabs.
4. **Missing data shown as zeros/blanks** instead of `N/A` or `Closed` (Labs, LTC, Addiction Beds, LGA cards, Wastewater).
5. **KPI / detail mismatches** (LTC placement, Mental Health substance deaths).
6. **Dead/empty subtabs or cards** referencing data removed in earlier phases (LTC Compliance, System Flow LGA demand, Regional Inequity data visibility).
7. **Location / duplication bugs** (Service Disruptions Hinton, Cancer Therapy Centers duplicate city names, Patient Complaints duplicate facility, Mental Health helpline footer).

## Remaining tabs to audit
- ER Wait Times (no subtabs, but has many interactive panels)
- Service Disruptions (navigation issue encountered; needs re-audit)
- Surgical Waitlists (4 subtabs)
- Health Workforce & Supply (5 subtabs)
- Cancer Screening & Care (4 subtabs)
- Public Health & Outbreaks (5 subtabs, but `notifiable` and `advisories` were removed)
- Mental Health & Addictions (5 subtabs)
- Regional Health Inequity (6 subtabs)
- Health Spending & Productivity (4 subtabs)

## Cross-cutting patterns already identified
1. **Repeated narrative blocks** copied across subtabs (Patient Experience narrative chain, Virtual Care audit ledger, System Flow PDF releases).
2. **HQA vs HQCA typo** recurring across multiple dashboards.
3. **Removed data still rendered as empty/NaN cards** (LGA demand profiles, continuing care compliance).
4. **Misleading source attribution** (Alberta Find a Provider for attachment rates).
5. **Missing data shown as zero** instead of N/A (lab waits at night, LTC historical P50 wait times, LGA profiles).
6. **KPI cards not matching detail data** (LTC placement KPIs vs. zone detail).
