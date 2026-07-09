
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
- [ ] Phase A: Shared shell + `TAB_METADATA_MAP` + location seed script check
- [ ] Phase B: Acute & capacity tabs (er-waits, disruptions, system-flow, surgical-waits, workforce, diagnostics)
- [ ] Phase C: Community tabs (primary-care, long-term-care, patient-experience, virtual-care)
- [ ] Phase D: Prevention + equity tabs (cancer, public-health, mental-health, regional-inequity, health-spending)
- [ ] Phase E: Targeted pipeline reruns for failed domains
- [ ] Phase F: Consolidate findings, triage P0/P1/P2, and execute fix plan with subagents
- [ ] Phase G: Update `lessons.md` with new audit mistakes