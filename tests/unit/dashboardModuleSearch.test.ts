import { describe, expect, it } from 'vitest';
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
    expect(dashboardMatchesSearch(diagnosticsTile, 'diagnostics')).toBe(true);
    expect(dashboardMatchesSearch(surgicalTile, 'diagnostics')).toBe(false);
  });

  it('matches shortName Diagnostics & Labs', () => {
    expect(dashboardMatchesSearch(diagnosticsTile, 'labs')).toBe(true);
  });

  it('does not search description text (health spending NHEX physician)', () => {
    const healthSpending = {
      id: 'health-spending',
      title: 'Health Spending & Productivity',
      shortName: 'Health Spending',
    };
    // description mentions NHEX / physician clinical payments; title/shortName/id do not
    expect(dashboardMatchesSearch(healthSpending, 'NHEX')).toBe(false);
    expect(dashboardMatchesSearch(healthSpending, 'physician')).toBe(false);
  });
});

describe('readDashboardModuleFromUrl', () => {
  it('returns null when module param absent', () => {
    expect(readDashboardModuleFromUrl(['diagnostics', 'er-waits', 'urgent-care'])).toBeNull();
  });

  it('accepts urgent-care module id from URL', () => {
    const previous = window.location.search;
    window.history.replaceState({}, '', '?module=urgent-care');
    try {
      expect(readDashboardModuleFromUrl(['diagnostics', 'er-waits', 'urgent-care'])).toBe(
        'urgent-care',
      );
    } finally {
      window.history.replaceState({}, '', previous || '/');
    }
  });
});