# Data Pipelines

All data fetching, scraping, and parsing runs locally on the Mac mini. Results are written to local JSON files (source of truth) and pushed to Cloudflare KV.

## Architecture

```
Scheduler (launchd)
  ├── every 10 min: ER wait times fetcher → write local → push to KV
  └── every 24 hr:  Daily orchestrator
      ├── Tier 1 API fetchers (StatsCan, PHAC, Open Alberta)
      ├── Tier 2 HTML scrapers (waittimes.alberta.ca, ABJHI, CPSA, etc.)
      ├── Tier 3 File downloaders (CIHI XLSX, Fraser PDF)
      ├── Disruptions scraper
      └── Push all results to Cloudflare KV
```

## Pipeline Modules

| Module | Type | Domain | Cadence |
|---|---|---|---|
| `erWaitTimesFetcher.ts` | API | er-waittimes | 10 min |
| `disruptionsScraper.ts` | Scraper | disruptions | 24 hr |
| `statscanFetcher.ts` | API | workforce, spending | 24 hr |
| `phacFetcher.ts` | API | public-health | 24 hr |
| `openAlbertaFetcher.ts` | API | spending | 24 hr |
| `waittimesAlbertaScraper.ts` | Scraper | surgical | 24 hr |
| `abjhiScraper.ts` | Scraper | surgical | 24 hr |
| `cpsaScraper.ts` | Scraper | primary-care, workforce | 24 hr |
| `cihiWaitTimesDownloader.ts` | Download | diagnostic, surgical | 24 hr |
| `cihiNhexDownloader.ts` | Download | spending | 24 hr |
| `fraserDownloader.ts` | Download | surgical | 24 hr (skipped — 403 blocked) |
| `primaryCareFetcher.ts` | Download | primary-care | 24 hr |
| `albertaFindAProviderScraper.ts` | Scraper | primary-care | 24 hr |
| `openAlbertaInequityFetcher.ts` | API | regional-inequity | 24 hr |
| `powerbiScraper.ts` | Scraper | surgical | 24 hr |
| `pushClient.ts` | Push | all | after each pipeline |
| `scheduler.ts` | Orchestrator | all | 10 min + 24 hr |
| `orchestrator.ts` | Orchestrator | all | 24 hr |

## Local-Only Pipeline Dependencies

Some pipelines require local Mac mini resources and cannot run on Cloudflare Workers:

| Pipeline | Dependency | Reason |
|---|---|---|
| `powerbiScraper.ts` | Local Chrome browser | Hardcoded path `/Applications/Google Chrome.app/...` for Power BI rendering |
| `primaryCareFetcher.ts` | Python + openpyxl | Parses 73MB CIHI workbook with `read_only` mode (SheetJS cannot handle it) |

## Rules

1. Every pipeline writes to local JSON first, then pushes to Cloudflare KV.
2. Local JSON files are the source of truth. KV is a read replica.
3. All pipelines must be idempotent (running twice = same result).
4. All pipelines must fail gracefully (one failure doesn't block others).
5. Rate limit all scrapers: 1 request per 2 seconds minimum.
6. Log everything: start time, URL, records fetched, records written, duration, errors.

## Manual Overrides

Manual data overrides are handled via `data-disruption-overrides.json` — an intentional editorial-override seam for service disruptions. There is no deep-merge step; the disruptions scraper merges overrides at serve time. No `manualOverrideMerge.ts` pipeline exists.

## Cloudflare Deployment

The Cloudflare Worker (`cloudflare/worker.ts`) is a thin read layer:
- GET endpoints read from KV
- POST `/api/push/:domain` (HMAC-authenticated) writes to KV
- No scraping, no cron triggers, no business logic

The Mac mini pushes data to KV after each pipeline run. If push fails, local JSON is still correct and the next run will re-push.
