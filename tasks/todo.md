
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