# Surgical Data Audit — Power BI Scraper Output

Audits the surgery data scraped from the Alberta Health System Dashboard Power BI
report (`src/pipelines/powerbiScraper.ts`) as persisted to `data-surgical.json`
and rendered by `src/components/SurgicalDashboard.tsx`.

## Status (2026-07-22)

Core scraper/data defects **S1–S5** were fixed in commit `b6ede78`.

UI selection/display residuals **R1–R3** were fixed afterward:

| ID | Issue | Status |
|---|---|---|
| S1 | Segment mislabeled Referral-to-treatment | **Fixed** → `Decision-to-surgery` (ready-to-treat → surgery) |
| S2 | Cancer units forced to weeks | **Fixed** → cancer `days`, non-cancer `weeks` |
| S3 | “Median” was actually one of three percentile queries | **Fixed** → emits 10th / Median / 90th |
| S4 | Duplicate cancer record ids | **Fixed** → procedure-name slug ids |
| S5 | `% within benchmark` ×100 | **Verified OK** |
| R1 | Overview cards used first-match + hardcoded Weeks | **Fixed** → latest period + dynamic unit |
| R2 | Wait 2 table duplicated sources / mismatched p90 | **Fixed** → dedupe + same-source p90 |
| R3 | Day values divided by week benchmarks | **Fixed** → normalize via `toWeeks` |

## Ground truth (April 2026 Power BI Surgery tab)

- Measure: **Time waited between ready-to-treat and surgery date** (Wait 2)
- Non-cancer: weeks — 10th / 50th / 90th
- Cancer: days — 10th / 50th / 90th
- Example: Hip `3 / 16.6 / 58.1` weeks; Breast `13 / 28 / 51` days
- API precision may keep half-days (Bladder median `32.5`, Colorectal `28.5`) while tiles round

## Remaining optional hardening

- Pair each `querydata` response with request `StatLabel` instead of sorting three values
- Store Power BI periods as ISO dates (`2026-04-01` / `2026-04-30`)
- Do **not** relabel CIHI cancer week values as days without converting numbers

## Key files

- `src/pipelines/powerbiScraper.ts` — DSR parse + record emit
- `src/lib/surgicalWaitSelection.ts` — latest-record / dedupe / unit-aware math
- `src/components/SurgicalDashboard.tsx` — Wait 2 UI
- `tests/unit/surgicalWaitSelection.test.ts` — regression lock
