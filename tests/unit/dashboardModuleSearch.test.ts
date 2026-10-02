import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardMatchesSearch,
  readDashboardModuleFromUrl,
} from '../../src/lib/dashboardModuleSearch';

const diagnosticsTile = {
  id: 'diagnostics',
  title: 'Diagnostic Imaging + Labs',
  shortName: 'Diagnostics & Labs',
};

const surgicalTile = {
  id: 'surgical-waits',
  title: 'Surgical Waitlists',
  shortName: 'Surgical waits',
};

describe('dashboardMatchesSearch', () => {
  it('matches diagnostics by id without matching surgical description noise', () => {
    assert.strictEqual(dashboardMatchesSearch(diagnosticsTile, 'diagnostics'), true);
    assert.strictEqual(dashboardMatchesSearch(surgicalTile, 'diagnostics'), false);
  });

  it('matches shortName Diagnostics & Labs', () => {
    assert.strictEqual(dashboardMatchesSearch(diagnosticsTile, 'labs'), true);
  });

  it('does not search description text (health spending NHEX physician)', () => {
    const healthSpending = {
      id: 'health-spending',
      title: 'Health Spending & Productivity',
      shortName: 'Health Spending',
    };
    // description mentions NHEX / physician clinical payments; title/shortName/id do not
    assert.strictEqual(dashboardMatchesSearch(healthSpending, 'NHEX'), false);
    assert.strictEqual(dashboardMatchesSearch(healthSpending, 'physician'), false);
  });
});

describe('readDashboardModuleFromUrl', () => {
  it('returns null when module param absent', () => {
    assert.strictEqual(readDashboardModuleFromUrl(['diagnostics', 'er-waits', 'urgent-care']), null);
  });

  it('accepts urgent-care module id from URL', () => {
    const g = globalThis as { window?: unknown };
    const hadWindow = 'window' in g;
    const previous = g.window;
    g.window = { location: { search: '?module=urgent-care' } };
    try {
      assert.strictEqual(readDashboardModuleFromUrl(['diagnostics', 'er-waits', 'urgent-care']), 'urgent-care');
    } finally {
      if (hadWindow) g.window = previous;
      else delete g.window;
    }
  });
});