// Push Client — sends local JSON data to Cloudflare KV via authenticated POST.
// Used after each pipeline writes its local JSON file.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  writeFileAtomicSync,
  withCollectorLockSync,
} from '../lib/atomicFile';

const PUSH_SECRET = process.env.PUSH_SECRET ?? '';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL ?? '';

function cooldownFile(): string {
  return path.join(process.cwd(), '.kv-write-cooldown.json');
}
function hashesFile(): string {
  return path.join(process.cwd(), '.kv-push-hashes.json');
}
function lastPushFile(): string {
  return path.join(process.cwd(), '.kv-last-push.json');
}

export interface PushOutcome {
  domain: string;
  /** True only when the public edge is in the desired terminal state:
   *  an actual success, or a deliberate skip that is NOT a cooldown.
   */
  ok: boolean;
  pushedAt: string;
  result: PushResult;
  /** Most recent local file hash for this domain, when known. */
  contentHash?: string | null;
}

export interface PushResult {
  domain: string;
  success: boolean;
  error?: string;
  attempts: number;
  skipped?: boolean;
  cooldown?: boolean;
  contentHash?: string | null;
}

function loadKvWriteCooldownFromDisk(): number {
  try {
    const file = cooldownFile();
    if (!fs.existsSync(file)) return 0;
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as { untilMs?: number };
    const untilMs = typeof parsed.untilMs === 'number' ? parsed.untilMs : 0;
    if (untilMs <= Date.now()) return 0;
    return untilMs;
  } catch {
    return 0;
  }
}

/** Write cooldown file. Call inside the collector lock for RMW isolation. */
function persistKvWriteCooldownLocked(untilMs: number): void {
  writeFileAtomicSync(cooldownFile(), JSON.stringify({ untilMs }, null, 2));
}

function loadPushHashesFromDisk(): Record<string, string> {
  try {
    const file = hashesFile();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Write hashes file. Call inside the collector lock for RMW isolation. */
function persistPushHashesLocked(hashes: Record<string, string>): void {
  writeFileAtomicSync(hashesFile(), JSON.stringify(hashes, null, 2));
}

function loadLastPushOutcomesFromDisk(): Record<string, PushOutcome> {
  try {
    const file = lastPushFile();
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, PushOutcome>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Write one last-push outcome. Call inside the collector lock for RMW isolation. */
function persistLastPushOutcomeLocked(
  domain: string,
  outcome: PushOutcome,
): void {
  const all = loadLastPushOutcomesFromDisk();
  all[domain] = outcome;
  writeFileAtomicSync(lastPushFile(), JSON.stringify(all, null, 2));
}

function persistLastPushOutcome(domain: string, outcome: PushOutcome): void {
  try {
    withCollectorLockSync(() => {
      persistLastPushOutcomeLocked(domain, outcome);
    });
  } catch (err) {
    console.warn(
      `[PushClient] Failed to persist last push outcome: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function getLastPushOutcomes(): Record<string, PushOutcome> {
  return loadLastPushOutcomesFromDisk();
}

export function getLastPushOutcome(domain: string): PushOutcome | null {
  return loadLastPushOutcomesFromDisk()[domain] ?? null;
}

function nextUtcMidnightMs(fromMs = Date.now()): number {
  const d = new Date(fromMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

function isKvQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  const lower = body.toLowerCase();
  return (
    lower.includes('limit') ||
    lower.includes('quota') ||
    lower.includes('exceed') ||
    lower.includes('too many')
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function buildOutcome(result: PushResult): PushOutcome {
  return {
    domain: result.domain,
    ok: result.success || Boolean(result.skipped && !result.cooldown),
    pushedAt: nowIso(),
    result,
    contentHash: result.contentHash ?? null,
  };
}

function recordOutcome(domain: string, result: PushResult): void {
  const outcome = buildOutcome(result);
  persistLastPushOutcome(domain, outcome);
}

// Push a single domain's data to Cloudflare KV
export async function pushToCloudflare(domain: string, data: unknown): Promise<PushResult> {
  const body = JSON.stringify(data);
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');

  const now = Date.now();

  // RMW read for hashes and cooldown happens under the collector lock so the
  // persisted outcome file cannot interleave with another writer in the same
  // or a different process.
  const state = withCollectorLockSync(() => {
    return {
      kvWriteCooldownUntilMs: loadKvWriteCooldownFromDisk(),
      pushContentHashes: loadPushHashesFromDisk(),
    };
  });

  // Content-hash deduplication takes precedence: no need to write if nothing changed.
  if (state.pushContentHashes[domain] === bodyHash) {
    console.log(`[PushClient] Skipping ${domain} — payload unchanged (content hash match)`);
    const result: PushResult = {
      domain,
      success: true,
      attempts: 0,
      skipped: true,
      contentHash: bodyHash,
    };
    // Re-enter the lock under recordOutcome so load+merge+write is atomic.
    recordOutcome(domain, result);
    return result;
  }

  // Honor a persisted KV cooldown even when the environment is currently unconfigured,
  // because a previous configured run may have hit the daily write limit.
  if (now < state.kvWriteCooldownUntilMs) {
    const mins = Math.ceil((state.kvWriteCooldownUntilMs - now) / 60000);
    console.log(
      `[PushClient] Skipping ${domain} — KV write cooldown active (~${mins}m left; resumes after UTC midnight)`,
    );
    const result: PushResult = {
      domain,
      success: false,
      attempts: 0,
      skipped: true,
      cooldown: true,
      contentHash: bodyHash,
      error: `KV write cooldown active (~${mins}m left; resumes after UTC midnight)`,
    };
    recordOutcome(domain, result);
    return result;
  }

  if (!CLOUDFLARE_WORKER_URL || !PUSH_SECRET) {
    const result: PushResult = {
      domain,
      success: true,
      attempts: 0,
      skipped: true,
      contentHash: bodyHash,
      error: 'Push not configured (CLOUDFLARE_WORKER_URL or PUSH_SECRET missing)',
    };
    recordOutcome(domain, result);
    return result;
  }

  const timestamp = Date.now().toString();
  const signature = crypto
    .createHmac('sha256', PUSH_SECRET)
    .update(`${domain}:${timestamp}:${body}`)
    .digest('hex');

  const url = `${CLOUDFLARE_WORKER_URL}/api/push/${domain}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Push-Signature': signature,
          'X-Push-Timestamp': timestamp,
        },
        body,
      });

      if (response.ok) {
        // Network write is done; now update hashes and last-push atomically. The
        // actual fetch happened without holding the lock, satisfying the rule
        // not to hold a lock during network I/O.
        const result: PushResult = {
          domain,
          success: true,
          attempts: attempt,
          contentHash: bodyHash,
        };
        const outcome = buildOutcome(result);
        withCollectorLockSync(() => {
          const pushContentHashes = loadPushHashesFromDisk();
          pushContentHashes[domain] = bodyHash;
          persistPushHashesLocked(pushContentHashes);
          persistLastPushOutcomeLocked(domain, outcome);
        });
        console.log(`[PushClient] Pushed ${domain} to Cloudflare KV (attempt ${attempt})`);
        return result;
      }

      const errorText = await response.text();
      console.warn(`[PushClient] Push ${domain} failed (attempt ${attempt}): ${response.status} ${errorText}`);

      if (isKvQuotaError(response.status, errorText)) {
        const untilMs = nextUtcMidnightMs();
        const result: PushResult = {
          domain,
          success: false,
          attempts: attempt,
          cooldown: true,
          contentHash: bodyHash,
          error: `HTTP ${response.status}: ${errorText}`,
        };
        // Persist cooldown and outcome atomically under one lock so another
        // process cannot observe the cooldown without the matching outcome.
        const outcome = buildOutcome(result);
        withCollectorLockSync(() => {
          persistKvWriteCooldownLocked(untilMs);
          persistLastPushOutcomeLocked(domain, outcome);
        });
        console.error(
          `[PushClient] Cloudflare KV daily write limit hit — cooling down until ${new Date(untilMs).toISOString()}`,
        );
        return result;
      }

      // Auth / bad payload — don't thrash retries
      if (response.status === 400 || response.status === 401 || response.status === 404) {
        const result: PushResult = {
          domain,
          success: false,
          attempts: attempt,
          contentHash: bodyHash,
          error: `HTTP ${response.status}: ${errorText}`,
        };
        recordOutcome(domain, result);
        return result;
      }

      if (attempt < 3) {
        const backoffMs = 4 ** (attempt - 1) * 1000; // 1s, 4s, 16s
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, backoffMs);
        await promise;
      } else {
        const result: PushResult = {
          domain,
          success: false,
          attempts: attempt,
          contentHash: bodyHash,
          error: `HTTP ${response.status}: ${errorText}`,
        };
        recordOutcome(domain, result);
        return result;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[PushClient] Push ${domain} error (attempt ${attempt}): ${errorMsg}`);

      if (attempt < 3) {
        const backoffMs = 4 ** (attempt - 1) * 1000;
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, backoffMs);
        await promise;
      } else {
        const result: PushResult = {
          domain,
          success: false,
          attempts: attempt,
          contentHash: bodyHash,
          error: errorMsg,
        };
        recordOutcome(domain, result);
        return result;
      }
    }
  }

  const result: PushResult = {
    domain,
    success: false,
    attempts: 3,
    contentHash: bodyHash,
    error: 'Max retries exceeded',
  };
  recordOutcome(domain, result);
  return result;
}

// Push all local JSON data files to Cloudflare KV (one-shot sync)
export async function pushAllToCloudflare(): Promise<PushResult[]> {
  const domains = [
    'er-waittimes',
    'disruptions',
    'surgical',
    'diagnostic',
    'primary-care',
    'public-health',
    'regional-inequity',
    'spending',
  ];

  const results: PushResult[] = [];

  for (const domain of domains) {
    const filePath = path.join(process.cwd(), `data-${domain}.json`);
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[PushClient] Skipping ${domain} — file not found`);
        const result: PushResult = {
          domain,
          success: false,
          attempts: 0,
          error: 'File not found',
        };
        recordOutcome(domain, result);
        results.push(result);
        continue;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      const result = await pushToCloudflare(domain, parsed);
      results.push(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const result: PushResult = {
        domain,
        success: false,
        attempts: 0,
        error: errorMsg,
      };
      recordOutcome(domain, result);
      results.push(result);
    }
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`[PushClient] Bulk push complete: ${successCount}/${results.length} succeeded`);
  return results;
}

// CLI entry point: tsx src/pipelines/pushClient.ts [domain]
if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.argv[2];
  if (domain) {
    const filePath = path.join(process.cwd(), `data-${domain}.json`);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    pushToCloudflare(domain, data).then(r => {
      console.log(JSON.stringify(r, null, 2));
      process.exit(r.success ? 0 : 1);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  } else {
    pushAllToCloudflare().then(results => {
      console.log(JSON.stringify(results, null, 2));
      const failed = results.filter(r => !r.success).length;
      process.exit(failed > 0 ? 1 : 0);
    }).catch(err => {
      console.error(err);
      process.exit(1);
    });
  }
}
