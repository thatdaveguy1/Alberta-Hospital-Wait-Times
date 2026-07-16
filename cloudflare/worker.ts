// Cloudflare Worker — thin read layer for Alberta Hospital Wait Times.
// Reads from KV, serves the React SPA, and accepts authenticated data pushes from the Mac mini.
// No scraping, no cron, no business logic — just reads and push-receive.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Cloudflare Workers environment bindings
interface Env {
  DATA_KV: KVNamespace;
  SNAPSHOTS_KV: KVNamespace;
  ALERTS_KV: KVNamespace;
  PUSH_SECRET: string;
  CORS_ORIGINS?: string; // comma-separated allowed origins (defaults to Pages + dev server)
}

const DEFAULT_CORS_ORIGINS = [
  'https://alberta-hospital-wait-times.pages.dev',
  'http://localhost:3004',
  'http://127.0.0.1:3004',
];

const app = new Hono<{ Bindings: Env }>();

// CORS — allow the Pages frontend and local dev server (env-driven)
app.use('*', cors({
  origin: (origin, c) => {
    const raw = c.env.CORS_ORIGINS;
    const allowed = raw ? raw.split(',').map(s => s.trim()) : DEFAULT_CORS_ORIGINS;
    return allowed.includes(origin) ? origin : allowed[0];
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Push-Signature', 'X-Push-Timestamp'],
}));

// Domain whitelist — must match the local server whitelist
const DOMAIN_WHITELIST = new Set([
  'er-waittimes', 'disruptions', 'surgical', 'diagnostic', 'cancer',
  'continuing-care', 'mental-health', 'patient-experience', 'primary-care',
  'public-health', 'regional-inequity', 'spending', 'system-flow',
  'virtual-care', 'workforce', 'sync-status',
  // Snapshot trend domains — written to SNAPSHOTS_KV, not DATA_KV
  'er-trends', 'lab-trends',
]);

// Domains that go to SNAPSHOTS_KV instead of DATA_KV
const SNAPSHOT_DOMAINS = new Set(['er-trends', 'lab-trends']);

type ErTrendsBlob = {
  all?: Record<string, unknown[]>;
  zones?: Record<string, unknown[]>;
  maxStats?: { max24h: unknown; max7d: unknown; max30d: unknown };
};

type LabTrendsBlob = {
  provincial?: Record<string, unknown[]>;
};

async function readErTrendsBlob(kv: KVNamespace): Promise<ErTrendsBlob | null> {
  const raw = await kv.get('er-trends');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ErTrendsBlob;
  } catch {
    return null;
  }
}

async function readLabTrendsBlob(kv: KVNamespace): Promise<LabTrendsBlob | null> {
  const raw = await kv.get('lab-trends');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LabTrendsBlob;
  } catch {
    return null;
  }
}


// --- Health ---
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    time: new Date().toISOString(),
    edge: true,
  });
});

// --- ER Wait Times ---
app.get('/api/hospitals', async (c) => {
  const data = await c.env.DATA_KV.get('data-er-waittimes');
  if (!data) return c.json([]);
  const parsed = JSON.parse(data) as { hospitals?: unknown[] };
  return c.json(parsed.hospitals ?? []);
});

// --- Service Disruptions ---
app.get('/api/disruptions', async (c) => {
  const data = await c.env.DATA_KV.get('data-disruptions');
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

// --- Generic Domain Data ---
app.get('/api/data/:domain', async (c) => {
  const domain = c.req.param('domain');
  if (!DOMAIN_WHITELIST.has(domain)) {
    return c.json({ error: `Unknown domain: ${domain}` }, 404);
  }
  const data = await c.env.DATA_KV.get(`data-${domain}`);
  if (!data) return c.json({ error: `No data for domain: ${domain}` }, 404);
  c.header('Cache-Control', 'public, max-age=300, s-maxage=300');
  return c.json(JSON.parse(data));
});

// --- Sync Status ---
app.get('/api/sync/status', async (c) => {
  const data = await c.env.DATA_KV.get('data-sync-status');
  if (!data) {
    return c.json({ status: 'never_run', lastSyncTimestamp: null, results: [] });
  }
  return c.json(JSON.parse(data));
});

// --- Trends (from snapshots KV) ---
app.get('/api/trends/all', async (c) => {
  const range = c.req.query('range') ?? '24h';
  const blob = await readErTrendsBlob(c.env.SNAPSHOTS_KV);
  if (blob?.all?.[range]) return c.json(blob.all[range]);
  const legacy = await c.env.SNAPSHOTS_KV.get(`trends-all-${range}`);
  if (!legacy) return c.json([]);
  return c.json(JSON.parse(legacy));
});

app.get('/api/trends/zones', async (c) => {
  const range = c.req.query('range') ?? '24h';
  const blob = await readErTrendsBlob(c.env.SNAPSHOTS_KV);
  if (blob?.zones?.[range]) return c.json(blob.zones[range]);
  const legacy = await c.env.SNAPSHOTS_KV.get(`trends-zones-${range}`);
  if (!legacy) return c.json([]);
  return c.json(JSON.parse(legacy));
});

app.get('/api/trends/max-stats', async (c) => {
  const blob = await readErTrendsBlob(c.env.SNAPSHOTS_KV);
  if (blob?.maxStats) return c.json(blob.maxStats);
  const legacy = await c.env.SNAPSHOTS_KV.get('trends-max-stats');
  if (!legacy) return c.json({ max24h: 0, max7d: 0, max30d: 0 });
  return c.json(JSON.parse(legacy));
});
app.get('/api/trends/labs', async (c) => {
  const range = c.req.query('range') ?? '24h';
  const blob = await readLabTrendsBlob(c.env.SNAPSHOTS_KV);
  if (blob?.provincial?.[range]) return c.json(blob.provincial[range]);
  const legacy = await c.env.SNAPSHOTS_KV.get(`trends-labs-${range}`);
  if (!legacy) return c.json([]);
  return c.json(JSON.parse(legacy));
});

app.get('/api/trends/labs/:labId', async (c) => {
  return c.json([]);
});
app.get('/api/trends/:hospitalId', async (c) => {
  return c.json([]);
});

// --- Alerts ---
app.get('/api/alerts', async (c) => {
  const data = await c.env.ALERTS_KV.get('alerts');
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

app.get('/api/alerts/logs', async (c) => {
  const data = await c.env.ALERTS_KV.get('alert-logs');
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

app.post('/api/alerts', async (c) => {
  const body = await c.req.json();
  const { email, hospitalId, hospitalIds, thresholdMins } = body;

  if (!email || typeof thresholdMins !== 'number') {
    return c.json({ error: 'Missing email or thresholdMins' }, 400);
  }

  const ids: string[] = [];
  if (Array.isArray(hospitalIds)) ids.push(...hospitalIds);
  else if (typeof hospitalId === 'string') ids.push(hospitalId);

  if (ids.length === 0) {
    return c.json({ error: 'Missing hospitalId or hospitalIds' }, 400);
  }

  // Load existing alerts
  const existingRaw = await c.env.ALERTS_KV.get('alerts');
  const existing = existingRaw ? JSON.parse(existingRaw) : [];

  const newAlerts = [];
  for (const hId of ids) {
    const exists = existing.some(
      (a: { email: string; hospitalId: string; thresholdMins: number }) =>
        a.email === email && a.hospitalId === hId && a.thresholdMins === thresholdMins
    );
    if (exists) continue;

    newAlerts.push({
      id: Math.random().toString(36).substring(2, 9),
      email,
      hospitalId: hId,
      thresholdMins,
      createdAt: new Date().toISOString(),
    });
  }

  const updated = [...newAlerts, ...existing];
  await c.env.ALERTS_KV.put('alerts', JSON.stringify(updated));

  return c.json({ success: true, alerts: newAlerts }, 201);
});

app.delete('/api/alerts/:id', async (c) => {
  const id = c.req.param('id');
  const existingRaw = await c.env.ALERTS_KV.get('alerts');
  const existing = existingRaw ? JSON.parse(existingRaw) : [];
  const updated = existing.filter((a: { id: string }) => a.id !== id);
  await c.env.ALERTS_KV.put('alerts', JSON.stringify(updated));
  return c.json({ success: true });
});

// --- Authenticated Push Endpoint (receives data from Mac mini) ---
app.post('/api/push/:domain', async (c) => {
  const domain = c.req.param('domain');
  if (!DOMAIN_WHITELIST.has(domain)) {
    return c.json({ error: `Unknown domain: ${domain}` }, 404);
  }

  const signature = c.req.header('X-Push-Signature');
  const timestamp = c.req.header('X-Push-Timestamp');
  const pushSecret = c.env.PUSH_SECRET;

  if (!signature || !timestamp || !pushSecret) {
    return c.json({ error: 'Missing authentication headers' }, 401);
  }

  // Verify timestamp is not too old (prevent replay attacks — 5 min window)
  const tsNum = parseInt(timestamp, 10);
  if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
    return c.json({ error: 'Timestamp expired or invalid' }, 401);
  }

  // Read body as text for signature verification
  const bodyText = await c.req.text();

  // Verify HMAC signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pushSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${domain}:${timestamp}:${bodyText}`)
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  if (signature !== expectedHex) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  // Parse and store in KV
  let data: unknown;
  try {
    data = JSON.parse(bodyText);
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    if (SNAPSHOT_DOMAINS.has(domain)) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return c.json({ error: 'Snapshot domain payload must be a JSON object' }, 400);
      }
      const next = JSON.stringify(data);
      const existing = await c.env.SNAPSHOTS_KV.get(domain);
      if (existing === next) {
        return c.json({
          success: true,
          domain,
          skipped: true,
          keysWritten: 0,
          timestamp: new Date().toISOString(),
        });
      }
      await c.env.SNAPSHOTS_KV.put(domain, next);
      return c.json({
        success: true,
        domain,
        keysWritten: 1,
        timestamp: new Date().toISOString(),
      });
    }
    const dataKey = `data-${domain}`;
    const next = JSON.stringify(data);
    const existing = await c.env.DATA_KV.get(dataKey);
    if (existing === next) {
      return c.json({ success: true, domain, skipped: true, timestamp: new Date().toISOString() });
    }
    await c.env.DATA_KV.put(dataKey, next);
    return c.json({ success: true, domain, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    // Cloudflare free-tier daily put quota (and similar write failures) must not
    // be misreported as bad JSON — clients need a real signal to back off.
    if (
      lower.includes('limit') ||
      lower.includes('quota') ||
      lower.includes('exceed') ||
      lower.includes('429') ||
      lower.includes('too many')
    ) {
      return c.json({ error: 'KV write limit exceeded', detail: message }, 429);
    }
    console.error(`[push/${domain}] KV write failed:`, message);
    return c.json({ error: 'KV write failed', detail: message }, 500);
  }
});

// --- SPA Fallback (for Cloudflare Pages integration) ---
// In production, static assets are served by Pages.
// This fallback handles client-side routing for SPA routes.
app.get('*', async (c) => {
  // If running as a Pages Function, this would serve the SPA.
  // For Worker-only deployment, return a simple redirect to Pages.
  return c.json({
    error: 'Frontend not served by Worker. Visit the Pages URL.',
    api: 'Use /api/* endpoints',
  });
});

export default app;
