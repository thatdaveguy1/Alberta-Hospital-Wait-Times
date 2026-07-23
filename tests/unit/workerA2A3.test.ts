import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import app from '../../cloudflare/worker.ts';

class FakeKV implements KVNamespace {
  private store = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.get(key) ?? null);
  }

  getWithMetadata(key: string): Promise<{ value: string | null; metadata: unknown }> {
    return Promise.resolve({ value: this.store.get(key) ?? null, metadata: null });
  }

  put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  delete(_key: string): Promise<void> {
    return Promise.resolve();
  }

  list(): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor: string }> {
    return Promise.resolve({ keys: [], list_complete: true, cursor: '' });
  }
}

function makeEnv() {
  return {
    DATA_KV: new FakeKV(),
    SNAPSHOTS_KV: new FakeKV(),
    ALERTS_KV: new FakeKV(),
    PUSH_SECRET: 'secret',
  };
}

describe('A2 Worker unknown /api/* 404 and SPA fallback', () => {
  const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
  for (const method of methods) {
    it(`returns 404 application/json for unknown ${method} /api/no-such-route`, async () => {
      const res = await app.fetch(new Request('http://localhost/api/no-such-route', { method }), makeEnv());
      assert.equal(res.status, 404);
      assert.equal(res.headers.get('content-type')?.toLowerCase().includes('application/json'), true);
      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Not found');
    });
  }

  it('returns 404 application/json for unknown /api/ path with trailing segment', async () => {
    const res = await app.fetch(new Request('http://localhost/api/admin/delete-everything'), makeEnv());
    assert.equal(res.status, 404);
    assert.ok((res.headers.get('content-type') ?? '').toLowerCase().includes('application/json'));
  });

  it('preserves non-API fallback with 200 JSON message', async () => {
    const res = await app.fetch(new Request('http://localhost/dashboard/surgical'), makeEnv());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { api: string };
    assert.equal(body.api, 'Use /api/* endpoints');
  });
});

describe('A3 Worker /api/trends/labs/:labId with fake KV', () => {
  let env: ReturnType<typeof makeEnv>;

  before(async () => {
    env = makeEnv();
    const blob = {
      provincial: {
        '24h': [{ timestamp: '2026-07-23T00:00:00Z', waitTime: 10 }],
        '7d': [{ timestamp: '2026-07-20T00:00:00Z', waitTime: 15 }],
        '30d': [{ timestamp: '2026-07-01T00:00:00Z', waitTime: 12 }],
      },
      labs: {
        'APL-KW': {
          '24h': [
            { timestamp: '2026-07-23T00:00:00Z', waitTime: 2 },
            { timestamp: '2026-07-23T00:10:00Z', waitTime: 3 },
          ],
          '7d': [{ timestamp: '2026-07-20T00:00:00Z', waitTime: 4 }],
          '30d': [{ timestamp: '2026-07-01T00:00:00Z', waitTime: 5 }],
        },
      },
    };
    await env.SNAPSHOTS_KV.put('lab-trends', JSON.stringify(blob));
  });

  it('returns the provincial array on /api/trends/labs', async () => {
    const res = await app.fetch(new Request('http://localhost/api/trends/labs?range=24h'), env);
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.equal(body.length, 1);
    assert.equal((body[0] as { waitTime: number }).waitTime, 10);
  });

  it('returns per-lab data for a known lab and range', async () => {
    const res = await app.fetch(new Request('http://localhost/api/trends/labs/APL-KW?range=24h'), env);
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.equal(body.length, 2);
    assert.equal((body[0] as { waitTime: number }).waitTime, 2);
  });

  it('returns empty array for unknown lab', async () => {
    const res = await app.fetch(new Request('http://localhost/api/trends/labs/UNKNOWN?range=24h'), env);
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.deepEqual(body, []);
  });

  it('returns empty array for unknown range', async () => {
    const res = await app.fetch(new Request('http://localhost/api/trends/labs/APL-KW?range=1y'), env);
    assert.equal(res.status, 200);
    const body = (await res.json()) as unknown[];
    assert.deepEqual(body, []);
  });
});
