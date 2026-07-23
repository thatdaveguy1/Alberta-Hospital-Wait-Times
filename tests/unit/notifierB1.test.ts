// Tests for scripts/notifier.mjs state-transition + deduplication logic.
// These tests do not hit any real webhook; they inject a fake sendImpl.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  defaultState,
  decideAlerts,
  sendAlerts,
  runNotifier,
  downFingerprint,
} from '../../scripts/notifier.mjs';

describe('notifier B1 — state-transition and deduplication', () => {
  const dedupeMs = 10 * 60 * 1000;
  const now = 1_000_000_000_000;

  describe('first down event', () => {
    it('sends a down-transition alert and updates state', () => {
      const state = defaultState();
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: next, events } = decideAlerts({ input, state, dedupeMs, now });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'down-transition');
      assert.equal(next.overall, 'down');
      assert.deepEqual(next.criticalAlerted, ['er-waittimes']);
      assert.equal(next.lastAlert?.sentAt, null); // sentAt is set after confirmed send
    });
  });

  describe('repeated down event', () => {
    it('is silent inside the dedupe window', async () => {
      const state = defaultState();
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const first = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: `tmp/notifier-dedup-${Date.now()}.json`,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });
      assert.equal(first.sent, 1);
      assert.equal(first.events[0].type, 'down-transition');

      const second = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: first.stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });

      assert.equal(second.sent, 0);
      assert.equal(second.events.length, 1);
      assert.equal(second.events[0].type, 'deduped');
      assert.equal(second.state.overall, 'down');
    });

    it('alerts again after the dedupe window', async () => {
      const state = defaultState();
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const first = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: `tmp/notifier-window-${Date.now()}.json`,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });
      assert.equal(first.sent, 1);

      const second = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: first.stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + dedupeMs + 1,
      });

      assert.equal(second.sent, 1);
      assert.equal(second.events[0].type, 'down-transition');
    });
  });

  describe('new critical issue while down', () => {
    it('sends a new-critical alert and tracks the new domain', async () => {
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const first = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: `tmp/notifier-newcrit-${Date.now()}.json`,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });

      const secondInput = {
        ...input,
        criticalDomains: ['er-waittimes', 'diagnostic'],
        summary: 'ER + diagnostic feeds failed',
      };
      const second = await runNotifier({
        input: secondInput,
        stateDir: 'tmp',
        stateFile: first.stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });

      assert.equal(second.sent, 1);
      assert.equal(second.events[0].type, 'new-critical');
      assert.equal(second.events[0].fingerprint, 'critical:diagnostic');
      assert.deepEqual(second.state.criticalAlerted, ['diagnostic', 'er-waittimes']);
    });
  });

  describe('recovery', () => {
    it('sends a recovery alert once when transitioning from down to ok', async () => {
      const downInput = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };
      const okInput = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const stateFile = `tmp/notifier-recovery-${Date.now()}.json`;
      const down = await runNotifier({
        input: downInput,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });
      assert.equal(down.sent, 1);

      const recover = await runNotifier({
        input: okInput,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });

      assert.equal(recover.sent, 1);
      assert.equal(recover.events[0].type, 'recovery');
      assert.equal(recover.state.overall, 'ok');
      assert.deepEqual(recover.state.criticalAlerted, []);
    });

    it('sends recovery once even if dedupe window still active', async () => {
      const downInput = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };
      const okInput = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const stateFile = `tmp/notifier-recovery-dedup-${Date.now()}.json`;
      const down = await runNotifier({
        input: downInput,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });

      const first = await runNotifier({
        input: okInput,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });
      assert.equal(first.sent, 1);
      assert.equal(first.events[0].type, 'recovery');

      const second = await runNotifier({
        input: okInput,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 2000,
      });
      assert.equal(second.sent, 0);
      assert.ok(second.events.every((e) => e.type === 'none'));
    });
  });

  describe('steady degraded health', () => {
    it('does not page', () => {
      const state = defaultState();
      const degraded = {
        ok: true,
        overall: 'degraded',
        criticalDomains: [],
        summary: 'daily sync soft stale',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: after, events } = decideAlerts({ input: degraded, state, dedupeMs, now });

      assert.equal(after.overall, 'degraded');
      assert.ok(events.every((e) => e.type === 'none'));
    });

    it('does not page on repeated degraded checks', () => {
      const state = defaultState();
      const degraded = {
        ok: true,
        overall: 'degraded',
        criticalDomains: [],
        summary: 'daily sync soft stale',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: afterFirst } = decideAlerts({ input: degraded, state, dedupeMs, now });
      const { events } = decideAlerts({
        input: degraded,
        state: afterFirst,
        dedupeMs,
        now: now + 1000,
      });

      assert.ok(events.every((e) => e.type === 'none'));
    });
  });

  describe('endpoint/network/json failure', () => {
    it('sends an endpoint-failure alert', () => {
      const state = defaultState();
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: [],
        summary: 'network failure',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: null,
        error: 'connect ECONNREFUSED',
      };
      const { state: after, events } = decideAlerts({ input, state, dedupeMs, now });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'endpoint');
      assert.equal(after.endpointFailureSentAt, null); // confirmed on send only
    });

    it('deduplicates repeated endpoint failures', async () => {
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: [],
        summary: 'network failure',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: null,
        error: 'connect ECONNREFUSED',
        monitorId: 'local',
      };
      const sendImpl = async () => new Response('ok', { status: 200 });
      const stateFile = `tmp/notifier-endpoint-${Date.now()}.json`;

      const first = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });
      assert.equal(first.sent, 1);
      assert.equal(first.events[0].type, 'endpoint');
      assert.equal(first.state.endpointFailureSentAt, now);

      const second = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });

      assert.equal(second.sent, 0);
      assert.equal(second.events.length, 1);
      assert.equal(second.events[0].type, 'deduped');
    });

    it('recovers and resets endpoint failure dedupe', () => {
      const state = defaultState();
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: [],
        summary: 'network failure',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: null,
        error: 'connect ECONNREFUSED',
      };
      const { state: afterFail } = decideAlerts({ input, state, dedupeMs, now });

      const okInput = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: afterOk } = decideAlerts({
        input: okInput,
        state: afterFail,
        dedupeMs,
        now: now + 1000,
      });
      assert.equal(afterOk.endpointFailureSentAt, null);
    });
  });

  describe('local and prod state isolation', () => {
    it('does not emit recovery or clear local-down state when prod is ok', async () => {
      const localDown = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed locally',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };
      const prodOk = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'https://alberta-hospital-wait-times.longmad.workers.dev/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'prod',
      };

      const sendImpl = async () => new Response('ok', { status: 200 });
      const dir = `tmp/isolation-${Date.now()}`;

      const local = await runNotifier({
        input: localDown,
        stateDir: dir,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });
      assert.equal(local.sent, 1);
      assert.equal(local.events[0].type, 'down-transition');
      assert.equal(local.state.overall, 'down');

      const prod = await runNotifier({
        input: prodOk,
        stateDir: dir,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 1000,
      });
      assert.equal(prod.sent, 0); // prod was never down, so no recovery alert
      assert.ok(prod.events.every((e) => e.type === 'none'));
      assert.equal(prod.state.overall, 'ok');

      // Re-run local down; it should be deduped because its state is still down.
      const localAgain = await runNotifier({
        input: localDown,
        stateDir: dir,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now: now + 2000,
      });
      assert.equal(localAgain.sent, 0);
      assert.equal(localAgain.events[0].type, 'deduped');
      assert.equal(localAgain.state.overall, 'down');
    });
  });

  describe('failed send retry', () => {
    it('does not mark down alert as sent and retries on next run', async () => {
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendImpl = async () => {
        throw new Error('Discord 500');
      };
      const stateFile = `tmp/notifier-failed-send-${Date.now()}.json`;

      const first = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
      });

      assert.equal(first.sent, 0);
      assert.equal(first.results[0].sent, false);
      assert.equal(first.state.lastAlert?.sentAt, null); // not marked as sent
      assert.equal(first.state.overall, 'down');

      const okSend = async () => new Response('ok', { status: 200 });
      const second = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl: okSend,
        now: now + 1000,
      });

      assert.equal(second.sent, 1); // retry succeeds
      assert.equal(second.state.lastAlert?.type, 'down-transition');
      assert.equal(second.state.lastAlert?.sentAt, now + 1000);
    });
  });

  describe('missing webhook configuration', () => {
    it('fails safely without crashing and still updates state', async () => {
      const input = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
        monitorId: 'local',
      };

      const sendCalls: unknown[] = [];
      const sendImpl = async (url: string, payload: unknown) => {
        sendCalls.push({ url, payload });
        return new Response('ok', { status: 200 });
      };

      const result = await runNotifier({
        input,
        stateDir: 'tmp',
        stateFile: `tmp/monitor-state-missing-webhook-${Date.now()}.test.json`,
        webhookUrl: '',
        dedupeMs,
        sendImpl,
        now,
      });

      assert.equal(result.sent, 0);
      assert.equal(result.skipped, 1);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].type, 'down-transition');
      assert.equal(result.state.overall, 'down');
      assert.equal(sendCalls.length, 0); // truly absent
    });
  });

  describe('down fingerprint', () => {
    it('sorts criticalDomains before joining', () => {
      assert.equal(
        downFingerprint('down', ['diagnostic', 'er-waittimes']),
        'down:down:diagnostic|er-waittimes',
      );
      assert.equal(
        downFingerprint('down', ['er-waittimes', 'diagnostic']),
        'down:down:diagnostic|er-waittimes',
      );
    });
  });
});
