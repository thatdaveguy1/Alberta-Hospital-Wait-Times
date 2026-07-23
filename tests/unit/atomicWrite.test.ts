import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  writeFileAtomic,
  writeFileAtomicSync,
  withCollectorLockSync,
  withCollectorLock,
} from '../../src/lib/atomicFile';

describe('atomic file writes', () => {
  const tmpDir = path.join(os.tmpdir(), `atomic-write-test-${process.pid}`);
  const targetFile = path.join(tmpDir, 'target.json');
  const lockFile = path.join(tmpDir, 'test.lock');

  before(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('writes a file atomically via sync helper', () => {
    writeFileAtomicSync(targetFile, '{"ok":true}');
    assert.equal(fs.readFileSync(targetFile, 'utf8'), '{"ok":true}');
  });

  it('writes a file atomically via async helper', async () => {
    await writeFileAtomic(targetFile, '{"async":true}');
    assert.equal(fs.readFileSync(targetFile, 'utf8'), '{"async":true}');
  });

  it('does not leave temp files behind on success', () => {
    const before = fs.readdirSync(tmpDir);
    writeFileAtomicSync(targetFile, '{"clean":true}');
    const after = fs.readdirSync(tmpDir);
    assert.deepEqual(after.sort(), before.sort());
  });

  it('acquires a cross-process lock and releases it', () => {
    const result = withCollectorLockSync(
      () => 'locked',
      { lockFile, maxWaitMs: 1000, staleAfterMs: 10000 },
    );
    assert.equal(result, 'locked');
    assert.equal(fs.existsSync(lockFile), false);
  });

  it('serializes concurrent lock attempts', async () => {
    const results: number[] = [];
    const promises = Array.from({ length: 5 }, (_, i) =>
      withCollectorLock(
        async () => {
          results.push(i);
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
        { lockFile, maxWaitMs: 5000, staleAfterMs: 10000 },
      ),
    );
    await Promise.all(promises);
    assert.equal(results.length, 5);
  });

  it('recovers a stale lock', () => {
    fs.writeFileSync(lockFile, JSON.stringify({ pid: 0, startedAt: 0 }));
    const result = withCollectorLockSync(
      () => 'recovered',
      { lockFile, maxWaitMs: 1000, staleAfterMs: 10 },
    );
    assert.equal(result, 'recovered');
    assert.equal(fs.existsSync(lockFile), false);
  });
});
