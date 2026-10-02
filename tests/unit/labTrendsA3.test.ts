import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLabTrendsBlob,
  LAB_TRENDS_BLOB_BUDGET_BYTES,
  computeLabTrendFacility,
  computeLabTrendProvincial,
  type LabTrendPoint,
  type LabTrendBuildResult,
} from '../../src/pipelines/trendsPusher';
import type { LabWaitSnapshot } from '../../src/pipelines/aplLabWaitTimesFetcher';

// Fixtures are relative to now (the code under test filters by Date.now() windows).
// BASE is aligned to a 4-hour boundary, at least 1h in the past, so +10/+20 minute
// offsets stay in the past and share one hourly and one 4-hour bucket.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BASE = Math.floor((Date.now() - HOUR) / (4 * HOUR)) * (4 * HOUR);
const at = (offsetMs: number) => new Date(BASE + offsetMs).toISOString();
const MIN10 = 10 * 60 * 1000;

describe('A3 lab trends builder and budget', () => {
  const snapshots: LabWaitSnapshot[] = [
    { labId: 'APL-KW', waitTime: 2, timestamp: at(0) },
    { labId: 'APL-KW', waitTime: 4, timestamp: at(MIN10) },
    { labId: 'APL-KW', waitTime: 6, timestamp: at(2 * MIN10) },
    { labId: 'APL-AIR', waitTime: 90, timestamp: at(0) },
    { labId: 'APL-AIR', waitTime: 85, timestamp: at(MIN10) },
    { labId: 'APL-AIR', waitTime: 30, timestamp: at(-DAY) },
    { labId: 'APL-AIR', waitTime: 35, timestamp: at(-3 * DAY) },
    { labId: 'APL-AIR', waitTime: 20, timestamp: at(-22 * DAY) },
  ];

  it('computes provincial averages grouped by timestamp', () => {
    const result = computeLabTrendProvincial(snapshots, '24h');
    assert.equal(result.length, 3);
    assert.equal(result[0].timestamp, at(0));
    assert.equal(result[0].waitTime, 46); // (2+90)/2
    assert.equal(result[1].timestamp, at(MIN10));
    assert.equal(result[1].waitTime, 45); // (4+85)/2 = 44.5 -> 45
    assert.equal(result[2].timestamp, at(2 * MIN10));
    assert.equal(result[2].waitTime, 6); // only KW
  });

  it('returns per-lab 24h raw points sorted', () => {
    const result = computeLabTrendFacility(snapshots, 'APL-KW', '24h');
    assert.equal(result.length, 3);
    assert.deepEqual(result.map((p: LabTrendPoint) => p.waitTime), [2, 4, 6]);
  });

  it('downsamples 7d to hourly buckets', () => {
    const result = computeLabTrendFacility(snapshots, 'APL-AIR', '7d');
    assert.equal(result.length, 3);
    // 10:00 hourly bucket averages (90+85)/2 = 87.5 -> 88
    // 10:00 on 07-22 -> 30
    // 10:00 on 07-20 -> 35
    const values = result.map((p: LabTrendPoint) => p.waitTime);
    assert.ok(values.includes(88));
    assert.ok(values.includes(30));
    assert.ok(values.includes(35));
  });

  it('downsamples 30d to 4-hour buckets', () => {
    const result = computeLabTrendFacility(snapshots, 'APL-AIR', '30d');
    assert.equal(result.length, 4);
    const values = result.map((p: LabTrendPoint) => p.waitTime);
    assert.ok(values.includes(88)); // shared 4-hour bucket (90+85)/2 = 87.5 -> 88
    assert.ok(values.includes(30));
    assert.ok(values.includes(35));
    assert.ok(values.includes(20));
  });

  it('builds a full blob with provincial and per-lab ranges', () => {
    const result = buildLabTrendsBlob(snapshots) as LabTrendBuildResult;
    assert.equal(result.mode, 'full');
    assert.ok(result.blob);
    assert.ok(Array.isArray(result.blob.provincial['24h']));
    assert.ok(Array.isArray(result.blob.labs?.['APL-KW']['24h']));
    assert.ok(Array.isArray(result.blob.labs?.['APL-AIR']['7d']));
    assert.ok(result.bytes > 0);
  });

  it('falls back to provincial-only when full payload exceeds budget but provincial fits', () => {
    const smallSnapshots: LabWaitSnapshot[] = [
      { labId: 'APL-KW', waitTime: 2, timestamp: at(0) },
      { labId: 'APL-KW', waitTime: 4, timestamp: at(MIN10) },
      { labId: 'APL-AIR', waitTime: 90, timestamp: at(0) },
    ];
    const result = buildLabTrendsBlob(smallSnapshots, 500) as LabTrendBuildResult;
    assert.equal(result.mode, 'provincial-only');
    assert.ok(Array.isArray(result.blob.provincial['24h']));
    assert.deepEqual(result.blob.labs, {});
    assert.ok(result.bytes <= 500);
  });

  it('reports oversized when even provincial-only exceeds budget', () => {
    const giantSnapshots: LabWaitSnapshot[] = Array.from({ length: 5000 }, (_, i) => ({
      labId: `APL-${i}`,
      waitTime: i % 90,
      timestamp: new Date(Date.now() - (i % 1000) * 60 * 1000).toISOString(),
    }));
    const result = buildLabTrendsBlob(giantSnapshots, 50) as LabTrendBuildResult;
    assert.equal(result.mode, 'oversized');
    assert.ok(Array.isArray(result.blob.provincial['24h']));
  });

  it('budget is conservative (5 MiB) vs Cloudflare 25 MiB limit', () => {
    assert.equal(LAB_TRENDS_BLOB_BUDGET_BYTES, 5 * 1024 * 1024);
  });
});
