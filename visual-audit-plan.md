# Plan: Visual Audit of Every Dashboard Tab & Subtab (Pipeline-First Fix Strategy)

**Goal:** Visually inspect every one of the 15 top-level dashboard modules and all of their subtabs, identify repeated/poorly presented datasets, incorrect information, and improvement opportunities. Before any empty card or dead subtab is removed, attempt to source the missing data through an automated pipeline.

**Status:** Audit complete for all 15 modules and their subtabs. Findings are in `visual-audit-findings.md`.

## Audit methodology (completed)

1. **Browser session**: Used the local dev server at `http://127.0.0.1:3004/` in a headless Playwright session. One fresh session (`audit2`) was used for the remaining 10 modules.
2. **Navigation**: Opened the module selector, clicked each top-level module, then clicked each subtab in order using the `border-b-2` subtab button class.
3. **Capture**: Extracted the first ~4,500 characters of page text per subtab and saved viewport screenshots for key states.
4. **Review criteria**: repeated datasets, poorly presented datasets, incorrect information, improvement opportunities.
5. **Verification**: Re-audit affected modules after fixes; run `npx tsc --noEmit` and `npm run build`.

## Complete issue inventory (highlights)

### Repeated content blocks across subtabs
- Patient Experience: "THE NARRATIVE CHAIN OF QUALITY EFFICACY"
- Virtual Care: "DATA SOURCE & AUDIT VERIFICATION LEDGER"
- System Flow: "AHS WEEKLY ED LOS PDF OUTPUT RELEASES"
- Public Health: "COMMUNITY PREVENTION & PATHOGEN TRANSMISSION DYNAMICS" + outbreak protocol
- Health Spending: "VALUE FOR MONEY & MACRO EFFICIENCY SIGNAL"
- Regional Inequity: full LGA selector + "SOCIOECONOMIC STATUS & HEALTH INEQUITY DYNAMICS"
- Health Workforce: same four KPI cards at the top of every subtab

### Missing / zero data presented poorly
- Diagnostics Lab Waits: all 153 sites show `Unavailable` / `0:00` at night.
- Long Term Care historical P50 wait times: `0d` for missing years.
- System Flow Benchmarks: LGA demand cards show `ED VISITS 0`, `POPULATION 0`, `VISIT RATE NaN`.
- Mental Health Addiction Beds: `Available Beds: / 41` (blank numerator) and `0 vacancies`.
- Public Health Wastewater: tiny decimal values (e.g., `0.000248…`) and `0` signals with `Low Load` label.
- ER Waits: some facilities show `0:00` at night without "closed" explanation.
- ER Waits historical peaks: 24H/7D/30D max all identical (`13:39` at Rockyview).

### Incorrect / misleading information
- `HQA` → `HQCA` typo (Patient Experience, LTC, System Flow).
- Primary Care attachment-rate chart attributed to "Alberta Find a Provider" instead of CIHI.
- Health Spending repeated paragraph says `$8,540` per capita, but National Scoreboard shows `$9,598`.
- Service Disruptions: `Hinton Healthcare Centre` location shown as `Smoky Lake, AB`.
- Cancer Care Tumor Burden: `2026 projected diagnoses ~13,880` seems low for Alberta.
- Mental Health Substance Harms: KPI says `~1,960` deaths in 2025, table shows `610`.
- Surgical Waitlists: `Chartered Surgical Facilities Share 34.0%` and `OR Utilization 88.5%` may be regressions from Phase 13 fixes.
- Pipeline-name source labels (e.g., `cihiDownloader`, `openAlbertaBillingFetcher`) instead of human-readable sources.

### Dead / empty cards and subtabs
- Long Term Care → Compliance Registry: "No compliance data available".
- System Flow → Benchmarks & Profiles: LGA demand cards are empty placeholders.
- Public Health: `notifiable` and `advisories` subtabs were already removed in Phase 19, but the data arrays behind them were deleted because no public source could be found. Restoring them would require a new pipeline first.

### UI / duplication bugs
- Patient Experience Clinical Safety chart repeats `Calgary Zone` / `Edmonton Zone` labels.
- Patient Complaints facility dropdown has duplicate `Fort Sask` / `Fort Saskatchewan` entries.
- Cancer Care Therapy Centers duplicate city names (`Barrhead, Barrhead`).
- Mental Health Crisis Helplines: footer/legal text duplicated multiple times with malformed variants.
- Regional Inequity: the LGA selector is repeated on every subtab and hides the actual data.
- Health Workforce: top KPI cards are repeated on every subtab even when not relevant.

## Phased execution plan (pipeline-first)

### Phase 1 — Visual audit (DONE)
- All 15 modules and subtabs visited.
- Findings documented in `visual-audit-findings.md`.
- Screenshots saved to `screenshots/` for key states.

### Phase 2 — Pipeline investigation for missing data sources
Before any dead subtab or empty card is removed, attempt to source the data automatically. For each missing dataset, identify the authoritative source, build or extend a fetcher, and run it end-to-end. Only if the source is genuinely unavailable/undocumented should deletion be considered.

| Missing data | Candidate source | Pipeline action | Fallback if unavailable |
|---|---|---|---|
| **LTC Compliance Registry** | Alberta Health `standardsandlicensing.alberta.ca` continuing care facility registry / AHS continuing care compliance reports | Investigate `ahsAsiScraper` or build a new standards-and-licensing parser; check if the public portal has a searchable list or downloadable dataset. If a parseable HTML/JSON endpoint exists, write `continuingCareComplianceFetcher.ts` and populate `CONTINUING_CARE_COMPLIANCE`. | Replace the dead subtab with a data-vintage notice explaining the source is not publicly available. |
| **System Flow LGA demand profiles** | Open Alberta `Table 10.1` (already used by `openAlbertaInequityFetcher.ts`) | Extend `openAlbertaInequityFetcher.ts` to also pull ED visit rate, population, and CTAS profile fields by LGA. Map LGAs to the facility cards in `SystemFlowDashboard.tsx`. | Hide the LGA demand cards from System Flow and link users to the Regional Inequity dashboard where the data lives. |
| **Mental Health live addiction bed vacancies** | `findaddictionbeds.alberta.ca` | Verify the existing `albertaFindAProviderScraper` is not the right tool; check if the ABED site has a JSON API or HTML scraper for `availableBeds`. If it exists, extend the existing fetcher. | Display `availability not publicly reported` and show total bed allocation only. |
| **Public Health notifiable disease incidence** | Alberta Health notifiable disease summaries / PHAC annual reports | Search for a public AHS/PHAC table of notifiable diseases by year. If a structured endpoint exists, build a new fetcher. | Keep the subtab removed; document the missing source in `lessons.md`. |
| **Public Health environmental advisories** | Alberta Health / AHS environmental health advisories | Search for a public advisory feed (RSS, API, or scrapeable page). If found, build a fetcher. | Keep the subtab removed; document the missing source. |
| **Health Spending physician billing data** | `openAlbertaBillingFetcher.ts` currently returns 0 records | Debug the fetcher: check the CKAN endpoint, resource IDs, and CSV format. If the dataset is reachable, fix the parser. Otherwise, label the Physician Payments subtab as hand-authored. | Label data as hand-authored/estimated and remove the misleading `openAlbertaBillingFetcher` source label. |
| **Cancer Care projected incidence** | Alberta Cancer Registry annual surveillance report | Verify the 13,880 figure against the registry report. If it is a subset or wrong, correct it or replace it with the full annual incidence. | Add a clear note that the figure is a specific subset or use the most recent registry total. |
| **Surgical Waitlists capacity metrics** | `cihiWaitTimesDownloader.ts`, `powerbiScraper.ts`, AHS facility data | Verify whether chartered-facility share and OR utilization are derivable from existing pipelines. If not, label them as estimated/hand-authored. | Update the manual badge and source text to say "estimated / facility-reported". |
| **Service Disruptions Hinton location** | AHS emergency advisories | Check the raw scraped data; fix the city name in the source or in a normalization map. | Hardcode a location override if the upstream data is wrong. |

**Phase 2 acceptance:**
- For each missing dataset, a source has been investigated and either (a) a pipeline is written and producing records, or (b) a clear note documents why the source is unavailable.
- No empty placeholder cards or dead subtabs are removed without this attempt.

### Phase 3 — Cross-cutting cleanup
- Fix the `HQA` → `HQCA` typo globally (search all `*.tsx` files).
- Consolidate repeated narrative blocks: move them to a single intro panel or subtab, or remove them if they add no value.
- Fix typos (`Occumpancy` → `Occupancy`, duplicate facility names, etc.).
- Correct source labels: replace pipeline filenames with human-readable sources.
- Fix duplicate zone labels and duplicate city names in charts/cards.
- Regional Inequity: move the LGA selector out of every subtab (e.g., sticky sidebar or Community Profile only).

### Phase 4 — Data presentation fixes
- Lab waits: add business-hours/closed state so `0:00` / `Unavailable` is explained; show next opening time.
- LTC historical waits: render missing years as `N/A` or omit them from the chart.
- Mental Health Addiction Beds: render `availability not reported` when the numerator is blank/null.
- Public Health Wastewater: format viral-load values as scientific notation or normalized index; distinguish zero-data from low-load.
- ER Waits historical peaks: fix the max-stats endpoint to return distinct values per range, or label the card as a single all-time peak.
- KPI / detail mismatches: align LTC placement KPIs, Mental Health substance-death KPI/table, and Health Spending per-capita value.

### Phase 5 — Verification
- Re-run the browser audit for every module that changed.
- Run `npx tsc --noEmit`.
- Run `npm run build`.
- Update `tasks/todo.md` and `lessons.md` with audit and pipeline lessons.

## Success criteria
- All 15 modules and subtabs visited and documented.
- Every missing-data issue has a pipeline-source attempt documented before deletion.
- Repeated/poorly presented datasets and incorrect information are fixed or explicitly labeled.
- TypeScript and build pass.
- No unexplained `0`, `NaN`, or empty placeholder cards remain.

## Risks & notes
- Several missing datasets (LTC compliance, environmental advisories, live bed vacancies) may not have public endpoints. The fallback is honest disclosure, not fabricated data.
- The local dev server is on `127.0.0.1:3004`. Browser sessions may need refresh if the server restarts or if multiple agents conflict.
- Full-page screenshots are slow; viewport screenshots and text extraction are the primary evidence.
