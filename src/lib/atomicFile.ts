// Dependency-free atomic file writes and cross-process lock helper.
// Used by pipeline collectors, pushClient, and sync-status to avoid
// truncated JSON and interleaved read-modify-write cycles.

import fs from 'fs';
import path from 'path';

export interface WriteFileOptions {
  encoding?: BufferEncoding;
  mode?: number;
}

export interface LockOptions {
  lockFile?: string;
  maxWaitMs?: number;
  staleAfterMs?: number;
  pollMs?: number;
}

function defaultCollectorLockFile(): string {
  return path.join(process.cwd(), '.collector-write.lock');
}

// --- atomic write helpers ---------------------------------------------------

let tempCounter = 0;

/** Exported for focused collision-coverage tests only. */
export function tempPathFor(filePath: string): string {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const counter = ++tempCounter;
  const suffix = `${process.pid}.${Date.now()}.${counter}.${Math.random().toString(36).slice(2, 8)}`;
  return path.join(dir, `.${base}.${suffix}.tmp`);
}

export function writeFileAtomicSync(
  filePath: string,
  data: string,
  options: WriteFileOptions = {},
): void {
  const tmp = tempPathFor(filePath);
  const encoding = options.encoding ?? 'utf8';
  try {
    fs.writeFileSync(tmp, data, { encoding, mode: options.mode });
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

export async function writeFileAtomic(
  filePath: string,
  data: string,
  options: WriteFileOptions = {},
): Promise<void> {
  const tmp = tempPathFor(filePath);
  const encoding = options.encoding ?? 'utf8';
  try {
    await fs.promises.writeFile(tmp, data, { encoding, mode: options.mode });
    await fs.promises.rename(tmp, filePath);
  } catch (err) {
    try {
      await fs.promises.unlink(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

// --- lock helpers -----------------------------------------------------------

// Track locks held by this process to avoid self-deadlock if lock-aware
// helper boundaries are accidentally nested.
const heldLocks = new Set<string>();

function sleepSync(ms: number): void {
  // Atomics.wait blocks the thread for a bounded time without busy-waiting.
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, Math.max(0, ms));
}

function lockContent(): string {
  return JSON.stringify({ pid: process.pid, startedAt: Date.now() });
}

function isStaleLock(
  lockFile: string,
  staleAfterMs: number,
  now: number,
): boolean {
  try {
    const stat = fs.statSync(lockFile);
    if (now - stat.mtimeMs > staleAfterMs) return true;
    const raw = fs.readFileSync(lockFile, 'utf8');
    const parsed = JSON.parse(raw) as { startedAt?: number };
    if (typeof parsed.startedAt === 'number' && now - parsed.startedAt > staleAfterMs) {
      return true;
    }
  } catch {
    // If we cannot read/stat the lock file, treat it as stale so the caller
    // can try to recreate it.
    return true;
  }
  return false;
}

function tryAcquireLock(lockFile: string, staleAfterMs: number): boolean {
  const now = Date.now();
  while (true) {
    try {
      fs.writeFileSync(lockFile, lockContent(), { flag: 'wx' });
      return true;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      if (isStaleLock(lockFile, staleAfterMs, now)) {
        try {
          fs.unlinkSync(lockFile);
        } catch {
          return false;
        }
        continue;
      }
      return false;
    }
  }
}

function releaseLock(lockFile: string): void {
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // ignore double-release
  }
}

export function withCollectorLockSync<T>(
  operation: () => T,
  options: LockOptions = {},
): T {
  const lockFile = options.lockFile ?? defaultCollectorLockFile();
  const maxWaitMs = options.maxWaitMs ?? 10000;
  const staleAfterMs = options.staleAfterMs ?? 60000;
  const pollMs = options.pollMs ?? 50;

  // Reentrant call from the same process — the outer lock holder is still
  // responsible for releasing the lock.
  if (heldLocks.has(lockFile)) {
    return operation();
  }

  const deadline = Date.now() + maxWaitMs;

  while (true) {
    if (tryAcquireLock(lockFile, staleAfterMs)) {
      heldLocks.add(lockFile);
      try {
        return operation();
      } finally {
        heldLocks.delete(lockFile);
        releaseLock(lockFile);
      }
    }

    const now = Date.now();
    if (now >= deadline) {
      throw new Error(
        `Could not acquire collector lock ${lockFile} within ${maxWaitMs}ms`,
      );
    }
    sleepSync(Math.min(pollMs, deadline - now));
  }
}

export async function withCollectorLock<T>(
  operation: () => Promise<T>,
  options: LockOptions = {},
): Promise<T> {
  const lockFile = options.lockFile ?? defaultCollectorLockFile();
  const maxWaitMs = options.maxWaitMs ?? 10000;
  const staleAfterMs = options.staleAfterMs ?? 60000;
  const pollMs = options.pollMs ?? 50;

  // Reentrant call from the same process.
  if (heldLocks.has(lockFile)) {
    return operation();
  }

  const deadline = Date.now() + maxWaitMs;

  while (true) {
    if (tryAcquireLock(lockFile, staleAfterMs)) {
      heldLocks.add(lockFile);
      try {
        return await operation();
      } finally {
        heldLocks.delete(lockFile);
        releaseLock(lockFile);
      }
    }

    const now = Date.now();
    if (now >= deadline) {
      throw new Error(
        `Could not acquire collector lock ${lockFile} within ${maxWaitMs}ms`,
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(pollMs, deadline - now)),
    );
  }
}
