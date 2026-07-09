import { describe, expect, it } from 'vitest';
import type { SurgicalRecord } from '../../src/surgicalData';

/** Mirrors SurgicalDashboard findComparison90th lookup. */
function findComparison90th(records: SurgicalRecord[], procedureKey: string) {
  return records.find(
    r =>
      r.geography_name === 'Alberta' &&
      r.metric_name === '90th percentile' &&
      r.wait_segment === 'Decision-to-surgery' &&
      (r.procedure_name === procedureKey || r.procedure_group === procedureKey),
  );
}

const sample: SurgicalRecord[] = [
  {
    id: 'hip',
    source_name: 'test',
    source_url: 'https://example.com',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 36.8,
    unit: 'weeks',
  },
  {
    id: 'knee',
    source_name: 'test',
    source_url: 'https://example.com',
    reporting_period_start: '2026-01-01',
    reporting_period_end: '2026-03-31',
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: 'Knee Replacement',
    procedure_name: 'Total Knee Arthroplasty',
    wait_segment: 'Decision-to-surgery',
    metric_name: '90th percentile',
    metric_value: 43.1,
    unit: 'weeks',
  },
];

describe('surgical procedure comparison lookup', () => {
  it('finds records when dropdown uses procedure_name keys', () => {
    expect(findComparison90th(sample, 'Total Hip Arthroplasty')?.metric_value).toBe(36.8);
    expect(findComparison90th(sample, 'Total Knee Arthroplasty')?.metric_value).toBe(43.1);
  });

  it('still supports procedure_group keys for legacy defaults', () => {
    expect(findComparison90th(sample, 'Hip Replacement')?.metric_value).toBe(36.8);
    expect(findComparison90th(sample, 'Knee Replacement')?.metric_value).toBe(43.1);
  });
});