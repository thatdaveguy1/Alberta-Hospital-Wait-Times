import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  pushToCloudflare,
  getLastPushOutcome,
  getLastPushOutcomes,
  type PushResult,
} from '../../src/pipelines/pushClient';

describe('pushClient C3 — cooldown, hash skip, and last-push persistence', () => {
  const tmpDir = path.join(os.tmpdir(), `push-client-test-${process.pid}`);
  const originalCwd = process.cwd();

  before(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  after(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('returns success:true, skipped:true when push is unconfigured', async () => {
    delete process.env.CLOUDFLARE_WORKER_URL;
    delete process.env.PUSH_SECRET;
    const result: PushResult = await pushToCloudflare('er-waittimes', { x: 1 });
    assert.equal(result.success, true);
    assert.equal(result.skipped, true);
    assert.equal(result.attempts, 0);

    const outcome = getLastPushOutcome('er-waittimes');
    assert.ok(outcome);
    assert.equal(outcome!.ok, true);
    assert.equal(outcome!.result.success, true);
  });

  it('returns success:false, skipped:true, cooldown:true when KV cooldown active', async () => {
    delete process.env.CLOUDFLARE_WORKER_URL;
    delete process.env.PUSH_SECRET;
    fs.writeFileSync('.kv-write-cooldown.json', JSON.stringify({ untilMs: Date.now() + 60_000 }));
    const result: PushResult = await pushToCloudflare('diagnostic', { x: 1 });
    assert.equal(result.success, false);
    assert.equal(result.skipped, true);
    assert.equal(result.cooldown, true);
    assert.equal(result.attempts, 0);

    const outcome = getLastPushOutcome('diagnostic');
    assert.ok(outcome);
    // Cooldown keeps overall health from marking as down, but the push itself
    // is not a desired terminal success for the public edge.
    assert.equal(outcome!.ok, false);
    assert.equal(outcome!.result.success, false);
    assert.equal(outcome!.result.cooldown, true);
  });

  it('returns success:true, skipped:true and records hash on unchanged payload', async () => {
    delete process.env.CLOUDFLARE_WORKER_URL;
    delete process.env.PUSH_SECRET;
    // Clear any persisted cooldown.
    if (fs.existsSync('.kv-write-cooldown.json')) {
      fs.unlinkSync('.kv-write-cooldown.json');
    }
    const payload = { a: 1, b: 2 };
    const first: PushResult = await pushToCloudflare('er-waittimes', payload);
    assert.equal(first.success, true);
    assert.equal(first.skipped, true);

    const second: PushResult = await pushToCloudflare('er-waittimes', payload);
    assert.equal(second.success, true);
    assert.equal(second.skipped, true);
    assert.ok(second.contentHash);
    assert.equal(second.contentHash, first.contentHash);

    const outcome = getLastPushOutcome('er-waittimes');
    assert.ok(outcome);
    assert.equal(outcome!.ok, true);
    assert.equal(outcome!.contentHash, first.contentHash);
  });

  it('persists last push outcomes across calls', async () => {
    delete process.env.CLOUDFLARE_WORKER_URL;
    delete process.env.PUSH_SECRET;
    if (fs.existsSync('.kv-write-cooldown.json')) {
      fs.unlinkSync('.kv-write-cooldown.json');
    }

    await pushToCloudflare('public-health', { x: 'a' });
    const outcomes = getLastPushOutcomes();
    assert.ok(outcomes['public-health']);
    assert.ok(fs.existsSync('.kv-last-push.json'));
  });
});
