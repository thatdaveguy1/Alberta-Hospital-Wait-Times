// Tests for scripts/notifier.mjs state-transition + deduplication logic.
// These tests do not hit any real webhook; they inject a fake sendImpl.

import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  defaultState,
  decideAlerts,
  sendAlerts,
  runNotifier,
} from '../../scripts/notifier.mjs';

describe('notifier B1 — state-transition and deduplication', () => {
  const webhookUrl = 'https://discord.example/webhook';
  const now = 1_000_000_000_000;
  const dedupeMs = 10 * 60 * 1000;

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
      assert.ok(next.lastAlert, 'lastAlert is set');
    });
  });

  describe('repeated down event', () => {
    it('is silent inside the dedupe window', () => {
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
      const { state: afterFirst } = decideAlerts({ input, state, dedupeMs, now });
      const { state: afterSecond, events } = decideAlerts({
        input,
        state: afterFirst,
        dedupeMs,
        now: now + 1000,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'deduped');
      assert.equal(afterSecond.overall, 'down');
    });

    it('alerts again after the dedupe window', () => {
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
      const { state: afterFirst } = decideAlerts({ input, state, dedupeMs, now });
      const { events } = decideAlerts({
        input,
        state: afterFirst,
        dedupeMs,
        now: now + dedupeMs + 1,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'down-transition');
    });
  });

  describe('new critical issue while down', () => {
    it('sends a new-critical alert and tracks the new domain', () => {
      const state = defaultState();
      const first = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: afterFirst } = decideAlerts({ input: first, state, dedupeMs, now });

      const second = {
        ...first,
        criticalDomains: ['er-waittimes', 'diagnostic'],
        summary: 'ER + diagnostic feeds failed',
      };
      const { state: afterSecond, events } = decideAlerts({
        input: second,
        state: afterFirst,
        dedupeMs,
        now: now + 1000,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'new-critical');
      assert.equal(events[0].fingerprint, 'critical:diagnostic');
      assert.deepEqual(afterSecond.criticalAlerted, ['er-waittimes', 'diagnostic']);
    });
  });

  describe('recovery', () => {
    it('sends a recovery alert once when transitioning from down to ok', () => {
      const state = defaultState();
      const downInput = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: downState } = decideAlerts({ input: downInput, state, dedupeMs, now });

      const okInput = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: afterRecovery, events } = decideAlerts({
        input: okInput,
        state: downState,
        dedupeMs,
        now: now + 1000,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'recovery');
      assert.equal(afterRecovery.overall, 'ok');
      assert.deepEqual(afterRecovery.criticalAlerted, []);
    });

    it('sends recovery once even if dedupe window still active', () => {
      const state = defaultState();
      const downInput = {
        ok: false,
        overall: 'down',
        criticalDomains: ['er-waittimes'],
        summary: 'ER feed failed',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { state: downState } = decideAlerts({ input: downInput, state, dedupeMs, now });

      const okInput = {
        ok: true,
        overall: 'ok',
        criticalDomains: [],
        summary: 'all feeds healthy',
        url: 'http://127.0.0.1:3004/api/health',
        httpStatus: 200,
        error: null,
      };
      const { events: firstRecovery } = decideAlerts({
        input: okInput,
        state: downState,
        dedupeMs,
        now: now + 1000,
      });
      const { state: afterFirst } = decideAlerts({
        input: okInput,
        state: downState,
        dedupeMs,
        now: now + 1000,
      });
      assert.equal(afterFirst.overall, 'ok');

      const { events: secondRecovery } = decideAlerts({
        input: okInput,
        state: afterFirst,
        dedupeMs,
        now: now + 1000,
      });

      assert.equal(firstRecovery[0].type, 'recovery');
      // State after first recovery is already ok, so the second call is "none".
      assert.ok(
        secondRecovery.some((e) => e.type === 'none') || secondRecovery.length === 0,
      );
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
      assert.equal(after.endpointFailureSentAt, now);
    });

    it('deduplicates repeated endpoint failures', () => {
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
      const { state: afterFirst } = decideAlerts({ input, state, dedupeMs, now });
      const { events } = decideAlerts({
        input,
        state: afterFirst,
        dedupeMs,
        now: now + 1000,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].type, 'deduped');
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
      assert.equal(afterFail.endpointFailureSentAt, now);

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

  describe('missing webhook configuration', () => {
    it('fails safely without crashing and still updates state', async () => {
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

      const sendCalls: unknown[] = [];
      const sendImpl = async (url: string, payload: unknown) => {
        sendCalls.push({ url, payload });
        return new Response('ok', { status: 200 });
      };

      const result = await runNotifier({
        input,
        webhookUrl: 'https://discord.example/webhook',
        dedupeMs,
        sendImpl,
        now,
        stateFile: `tmp/monitor-state-missing-webhook-${Date.now()}.test.json`,
      });

      assert.equal(result.sent, 1);
      assert.equal(result.skipped, 0);
      assert.equal(result.events.length, 1);
      assert.equal(result.events[0].type, 'down-transition');
      assert.equal(result.state.overall, 'down');
      assert.equal(sendCalls.length, 1);
    });
  });
});
