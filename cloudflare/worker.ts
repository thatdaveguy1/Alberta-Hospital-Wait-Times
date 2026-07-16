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
  const data = await c.env.SNAPSHOTS_KV.get(`trends-all-${range}`);
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

app.get('/api/trends/zones', async (c) => {
  const range = c.req.query('range') ?? '24h';
  const data = await c.env.SNAPSHOTS_KV.get(`trends-zones-${range}`);
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

app.get('/api/trends/max-stats', async (c) => {
  const data = await c.env.SNAPSHOTS_KV.get('trends-max-stats');
  if (!data) return c.json({ max24h: 0, max7d: 0, max30d: 0 });
  return c.json(JSON.parse(data));
});
app.get('/api/trends/labs', async (c) => {
  const range = c.req.query('range') ?? '24h';
  const data = await c.env.SNAPSHOTS_KV.get(`trends-labs-${range}`);
  if (!data) return c.json([]);
  return c.json(JSON.parse(data));
});

app.get('/api/trends/labs/:labId', async (c) => {
  const labId = c.req.param('labId');
  const range = c.req.query('range') ?? '24h';
  const data = await c.env.SNAPSHOTS_KV.get(`trends-labs-raw-${labId}`);
  if (!data) return c.json([]);
  const snapshots = JSON.parse(data) as Array<{ waitTime: number; timestamp: string }>;
  const cutoff = Date.now() - (range === '7d' ? 7 : range === '30d' ? 30 : 1) * 24 * 60 * 60 * 1000;
  return c.json(snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff));
});
app.get('/api/trends/:hospitalId', async (c) => {
  const hospitalId = c.req.param('hospitalId');
  const range = c.req.query('range') ?? '24h';
  const data = await c.env.SNAPSHOTS_KV.get(`trends-er-raw-${hospitalId}`);
  if (!data) return c.json([]);
  const snapshots = JSON.parse(data) as Array<{ waitTime: number; timestamp: string }>;
  const cutoff = Date.now() - (range === '7d' ? 7 : range === '30d' ? 30 : 1) * 24 * 60 * 60 * 1000;
  return c.json(snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff));
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
  try {
    const data = JSON.parse(bodyText);
    if (SNAPSHOT_DOMAINS.has(domain)) {
      // Snapshot trend domains: payload is a { kvKey: value } map.
      // Write each key individually to SNAPSHOTS_KV.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [kvKey, kvValue] of Object.entries(data)) {
          await c.env.SNAPSHOTS_KV.put(kvKey, JSON.stringify(kvValue));
        }
        return c.json({ success: true, domain, keysWritten: Object.keys(data).length, timestamp: new Date().toISOString() });
      }
      return c.json({ error: 'Snapshot domain payload must be a key-value map' }, 400);
    }
    await c.env.DATA_KV.put(`data-${domain}`, JSON.stringify(data));
    return c.json({ success: true, domain, timestamp: new Date().toISOString() });
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
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
