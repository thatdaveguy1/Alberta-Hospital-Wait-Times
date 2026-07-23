# Lab Trends KV Budget & Per-Lab Trend Decision

Last updated: 2026-07-23.

## Cloudflare KV limits (official)

- Maximum value size: **25 MiB** per KV value.
- Key write rate: **1 write per second per key**.
- Workers Free plan: **1,000 KV writes/day** across different keys.
- Worker requests: **100,000/day**, **10 ms CPU time** per invocation.

Sources: Cloudflare Workers KV Limits docs.

## Local scheduler cadence

- ER wait times and lab waits run every **10 minutes**.
- Trend KV pushes are throttled to once every **60 minutes** (`TRENDS_MIN_INTERVAL_MS`).
- Therefore the `lab-trends` KV key is written at most **24 times/day**, well under the 1,000 writes/day and 1 write/sec/key limits.

## Payload measurement

### Current real data

Using the on-disk `data-lab-snapshots.json` (56 unique labs, 12 unique timestamps):

- Serialized `lab-trends` blob with per-lab ranges: **42,437 bytes**.
- Conservative in-code budget: **5 MiB** (`LAB_TRENDS_BLOB_BUDGET_BYTES`).

### Projected worst-case 90-day/153-lab dataset

Synthesized 153 labs with one snapshot every 10 minutes for 90 days (~1.98M snapshots), then downsampled:

- 24h: raw 10-minute points (144 points/lab max).
- 7d: hourly buckets (168 points/lab max).
- 30d: 4-hour buckets (180 points/lab max).
- Serialized size: **~4.4 MiB** (random values 0–90) and **~4.5 MiB** (high values 180–300).

This is comfortably under the 5 MiB conservative budget and far under the Cloudflare 25 MiB hard limit.

## Decision

**GO.** Per-lab downsampled trends can safely be added to the existing single `lab-trends` KV blob. No new KV keys are required. If a future dataset ever exceeds the 5 MiB budget, `buildLabTrendsBlob` returns `null` and the push is skipped rather than risking a 25 MiB failure.

## Implementation notes

- `trendsPusher.ts` computes `provincial` and `labs` ranges.
- `cloudflare/worker.ts` serves `/api/trends/labs/:labId?range=24h|7d|30d` from `blob.labs[labId][range]`.
- Unknown lab or range returns `[]` with HTTP 200.
- Payload budget gate is enforced at build time in `buildLabTrendsBlob`.
