
## Phase 30: Diagnostics & Lab Fix (2026-07-09)
- [x] Fix `DiagnosticDashboard` `labStats` dead zero-return so lab stats cards show real averages
- [x] Fix `LabCard` contradictory `Walk-In`/`Closed`/`Appt Req` badges
- [x] Fix `DiagnosticDashboard` `Manual`/`Set Location` buttons to dispatch `open-location-modal` and open the manual location modal
- [x] Add `APL QMe REST API (qmeapi.albertaprecisionlabs.ca/api/location)` → `APL QMe REST API` mapping in `DataTimestamp`
- [x] Switch `Imaging Gaps` `DataTimestamp` to `IMAGING_WAIT_TRENDS`, add `DataTimestamp` to `Diagnostic Sites` (`FACILITY_IMAGING_WAITS`) and `Lab Turnaround` (`TEST_TURNAROUND_METRICS`), and remove hardcoded `Source: APL Test Directory` badge
- [x] Fix `DataTimestamp` compact spacing between `Auto-updated`/`Manual` and `Updated:`
- [x] Run `npx tsc --noEmit` and `npm run build`
- [x] Re-run headed diagnostics browser audit (`agent-browser`) and verify stats, badges, manual location modal, and `DataTimestamp` sources across all four subtabs
- [x] Update `lessons.md` with diagnostics fixes
- [x] Commit source + docs to `main` (revert runtime `data-*.json`)

## Phase 28: CIHI National Scoreboard + Audit Finish (2026-07-09)
- [x] Wire CIHI indicator 823 (province CSHS) and 877 (acute beds, ON/QC corporation rollup) in `cihiNationalCapacity.ts` / `cihiDownloader.ts` (`d16f9cc`)
- [x] Re-run `continuingCareComplianceFetcher` — 941 facilities in `CONTINUING_CARE_COMPLIANCE`
- [x] Re-run `openAlbertaBillingFetcher` — 20 physician specialty billing records
- [x] Document `alberta211Scraper` skip when 211 API behind Cloudflare
- [x] Surgical provincial overview: data-driven CSF share, OR utilization, hip benchmark (remove 34%/88.5% hardcode)
- [x] Primary Care: CIHI source on attachment chart; directory KPI source clarified
- [x] `DataTimestamp`: human-readable AHCIP billing source label
- [x] `spendingData.ts` fallback Alberta per-capita aligned to NHEX 9598
- [x] `npx tsc --noEmit` + `npm run build` pass

## Phase 29: Complete 15-Tab Audit & Fix (2026-07-09)
- [x] Fix `App.tsx` missing `cn` / `formatMinutesToHm` imports and `tsconfig.json` test exclusion; verify `npx tsc --noEmit` + `npm run build`
- [x] Write `implementation.md` with the full 15-tab audit plan and fix-plan subagent divisions
- [x] Phase A-D: Visual, data, and pipeline audits read for all groups
- [x] Phase E: Confirmed `phac`, `open-alberta-inequity`, and `cihi-wait-times-cancer` are manual/stubbed; gaps to be filled by `useDomainData` static-seed fallback
- [x] Phase F (shared): `useDomainData` fallback parameter, `DataTimestamp.sanitizeSource` exported, `DashboardHeader` shows sanitized `Source`, `App.tsx` treats `Closed` as unavailable
- [x] Phase F (acute/capacity): `SystemFlowDashboard`, `SurgicalDashboard`, `DiagnosticDashboard`, `LabCard`, `WorkforceDashboard` fixes (subagent + avg-wait `—` when no open labs)
- [x] Phase F (community): `ContinuingCareDashboard`, `PatientExperienceDashboard`, `PrimaryCareDashboard` fixes (subagent)
- [x] Phase F (prevention/equity): `CancerDashboard` screening, `PublicHealthDashboard` fallback, `MentalHealthDashboard` guard, `RegionalInequityDashboard` fallback, `SpendingDashboard` hardcoded KPI, `VirtualCareDashboard` fallback (subagent)
- [x] Phase G: `lessons.md` updated; visual reaudit script pass; `npx tsc` + `npm run build` pass; commit source/plan/docs (revert runtime `data-*.json`)