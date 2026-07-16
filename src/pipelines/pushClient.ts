// Push Client — sends local JSON data to Cloudflare KV via authenticated POST.
// Used after each pipeline writes its local JSON file.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PUSH_SECRET = process.env.PUSH_SECRET ?? '';
const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL ?? '';

const COOLDOWN_FILE = path.join(process.cwd(), '.kv-write-cooldown.json');
const HASHES_FILE = path.join(process.cwd(), '.kv-push-hashes.json');

function loadKvWriteCooldownFromDisk(): number {
  try {
    if (!fs.existsSync(COOLDOWN_FILE)) return 0;
    const raw = fs.readFileSync(COOLDOWN_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { untilMs?: number };
    const untilMs = typeof parsed.untilMs === 'number' ? parsed.untilMs : 0;
    if (untilMs <= Date.now()) return 0;
    return untilMs;
  } catch {
    return 0;
  }
}

function persistKvWriteCooldown(untilMs: number): void {
  try {
    fs.writeFileSync(COOLDOWN_FILE, JSON.stringify({ untilMs }), 'utf8');
  } catch (err) {
    console.warn(
      `[PushClient] Failed to persist KV cooldown: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function loadPushHashesFromDisk(): Record<string, string> {
  try {
    if (!fs.existsSync(HASHES_FILE)) return {};
    const raw = fs.readFileSync(HASHES_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function persistPushHashes(hashes: Record<string, string>): void {
  try {
    fs.writeFileSync(HASHES_FILE, JSON.stringify(hashes), 'utf8');
  } catch (err) {
    console.warn(
      `[PushClient] Failed to persist push hashes: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}



interface PushResult {
  domain: string;
  success: boolean;
  error?: string;
  attempts: number;
  skipped?: boolean;
}

// Once Cloudflare returns a daily KV put-limit error, stop all pushes until the
// next UTC day. Retries just thrash logs and waste remaining budget.
let kvWriteCooldownUntilMs = loadKvWriteCooldownFromDisk();
let pushContentHashes: Record<string, string> = loadPushHashesFromDisk();


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

// Push a single domain's data to Cloudflare KV
export async function pushToCloudflare(domain: string, data: unknown): Promise<PushResult> {
  if (!CLOUDFLARE_WORKER_URL || !PUSH_SECRET) {
    // Push not configured — silently skip (local-only mode)
    return { domain, success: false, attempts: 0, error: 'Push not configured (CLOUDFLARE_WORKER_URL or PUSH_SECRET missing)' };
  }

  const now = Date.now();
  if (now < kvWriteCooldownUntilMs) {
    const mins = Math.ceil((kvWriteCooldownUntilMs - now) / 60000);
    console.log(
      `[PushClient] Skipping ${domain} — KV write cooldown active (~${mins}m left; resumes after UTC midnight)`,
    );
    return {
      domain,
      success: true,
      attempts: 0,
      skipped: true,
      error: `KV write cooldown active (~${mins}m left; resumes after UTC midnight)`,
    };
  }


  const body = JSON.stringify(data);

  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  if (pushContentHashes[domain] === bodyHash) {
    console.log(`[PushClient] Skipping ${domain} — payload unchanged (content hash match)`);
    return { domain, success: true, attempts: 0, skipped: true };
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
        pushContentHashes[domain] = bodyHash;
        persistPushHashes(pushContentHashes);
        console.log(`[PushClient] Pushed ${domain} to Cloudflare KV (attempt ${attempt})`);
        return { domain, success: true, attempts: attempt };
      }

      const errorText = await response.text();
      console.warn(`[PushClient] Push ${domain} failed (attempt ${attempt}): ${response.status} ${errorText}`);

      if (isKvQuotaError(response.status, errorText)) {
        kvWriteCooldownUntilMs = nextUtcMidnightMs();
        persistKvWriteCooldown(kvWriteCooldownUntilMs);
        console.error(
          `[PushClient] Cloudflare KV daily write limit hit — cooling down until ${new Date(kvWriteCooldownUntilMs).toISOString()}`,
        );
        return {
          domain,
          success: false,
          attempts: attempt,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      // Auth / bad payload — don't thrash retries
      if (response.status === 400 || response.status === 401 || response.status === 404) {
        return { domain, success: false, attempts: attempt, error: `HTTP ${response.status}: ${errorText}` };
      }

      if (attempt < 3) {
        const backoffMs = Math.pow(4, attempt - 1) * 1000; // 1s, 4s, 16s
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, backoffMs);
        await promise;
      } else {
        return { domain, success: false, attempts: attempt, error: `HTTP ${response.status}: ${errorText}` };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[PushClient] Push ${domain} error (attempt ${attempt}): ${errorMsg}`);

      if (attempt < 3) {
        const backoffMs = Math.pow(4, attempt - 1) * 1000;
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, backoffMs);
        await promise;
      } else {
        return { domain, success: false, attempts: attempt, error: errorMsg };
      }
    }
  }

  return { domain, success: false, attempts: 3, error: 'Max retries exceeded' };
}

// Push all local JSON data files to Cloudflare KV (one-shot sync)
export async function pushAllToCloudflare(): Promise<PushResult[]> {
  const domains = [
    'er-waittimes',
    'disruptions',
    'surgical',
    'diagnostic',
    'cancer',
    'continuing-care',
    'mental-health',
    'patient-experience',
    'primary-care',
    'public-health',
    'regional-inequity',
    'spending',
    'system-flow',
    'virtual-care',
    'workforce',
  ];

  const results: PushResult[] = [];

  for (const domain of domains) {
    const filePath = path.join(process.cwd(), `data-${domain}.json`);
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`[PushClient] Skipping ${domain} — file not found`);
        results.push({ domain, success: false, attempts: 0, error: 'File not found' });
        continue;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(data);
      const result = await pushToCloudflare(domain, parsed);
      results.push(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({ domain, success: false, attempts: 0, error: errorMsg });
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
