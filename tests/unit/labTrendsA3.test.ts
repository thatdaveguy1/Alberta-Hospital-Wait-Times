import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLabTrendsBlob,
  LAB_TRENDS_BLOB_BUDGET_BYTES,
  computeLabTrendFacility,
  computeLabTrendProvincial,
  type LabTrendPoint,
} from '../../src/pipelines/trendsPusher';
import type { LabWaitSnapshot } from '../../src/pipelines/aplLabWaitTimesFetcher';

describe('A3 lab trends builder and budget', () => {
  const snapshots: LabWaitSnapshot[] = [
    { labId: 'APL-KW', waitTime: 2, timestamp: '2026-07-23T10:00:00Z' },
    { labId: 'APL-KW', waitTime: 4, timestamp: '2026-07-23T10:10:00Z' },
    { labId: 'APL-KW', waitTime: 6, timestamp: '2026-07-23T10:20:00Z' },
    { labId: 'APL-AIR', waitTime: 90, timestamp: '2026-07-23T10:00:00Z' },
    { labId: 'APL-AIR', waitTime: 85, timestamp: '2026-07-23T10:10:00Z' },
    { labId: 'APL-AIR', waitTime: 30, timestamp: '2026-07-22T10:00:00Z' },
    { labId: 'APL-AIR', waitTime: 35, timestamp: '2026-07-20T10:00:00Z' },
    { labId: 'APL-AIR', waitTime: 20, timestamp: '2026-07-01T10:00:00Z' },
  ];

  it('computes provincial averages grouped by timestamp', () => {
    const result = computeLabTrendProvincial(snapshots, '24h');
    assert.equal(result.length, 3);
    assert.equal(result[0].timestamp, '2026-07-23T10:00:00Z');
    assert.equal(result[0].waitTime, 46); // (2+90)/2
    assert.equal(result[1].timestamp, '2026-07-23T10:10:00Z');
    assert.equal(result[1].waitTime, 45); // (4+85)/2 = 44.5 -> 45
    assert.equal(result[2].timestamp, '2026-07-23T10:20:00Z');
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
    assert.ok(values.includes(88)); // 07-23 08:00 bucket (90+85)/2 = 87.5 -> 88
    assert.ok(values.includes(30));
    assert.ok(values.includes(35));
    assert.ok(values.includes(20));
  });

  it('builds a blob with provincial and per-lab ranges', () => {
    const blob = buildLabTrendsBlob(snapshots);
    assert.ok(blob);
    assert.ok(Array.isArray(blob!.provincial['24h']));
    assert.ok(Array.isArray(blob!.labs['APL-KW']['24h']));
    assert.ok(Array.isArray(blob!.labs['APL-AIR']['7d']));
  });

  it('returns null when payload exceeds budget', () => {
    const smallSnapshots: LabWaitSnapshot[] = Array.from({ length: 1000 }, (_, i) => ({
      labId: `APL-${i}`,
      waitTime: i % 90,
      timestamp: new Date(Date.now() - (i % 1000) * 60 * 1000).toISOString(),
    }));
    const blob = buildLabTrendsBlob(smallSnapshots, 100);
    assert.equal(blob, null);
  });

  it('budget is conservative (5 MiB) vs Cloudflare 25 MiB limit', () => {
    assert.equal(LAB_TRENDS_BLOB_BUDGET_BYTES, 5 * 1024 * 1024);
  });
});
