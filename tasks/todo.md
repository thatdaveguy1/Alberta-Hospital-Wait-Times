
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