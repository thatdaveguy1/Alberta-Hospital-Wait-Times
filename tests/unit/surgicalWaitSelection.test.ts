import { describe, expect, it } from 'vitest';
import type { SurgicalRecord } from '../../src/surgicalData';
import {
  dedupeLatestMedians,
  findMatchingP90,
  parseBenchmarkWeeks,
  pctOfBenchmark,
  periodEndMs,
  pickLatestProvincialRecord,
  toWeeks,
} from '../../src/lib/surgicalWaitSelection';

function rec(partial: Partial<SurgicalRecord> & Pick<SurgicalRecord, 'id' | 'procedure_name' | 'metric_name' | 'metric_value' | 'unit' | 'source_name' | 'reporting_period_end'>): SurgicalRecord {
  return {
    source_url: 'https://example.com',
    reporting_period_start: partial.reporting_period_end,
    geography_type: 'Province',
    geography_name: 'Alberta',
    procedure_group: partial.procedure_group ?? partial.procedure_name,
    wait_segment: 'Decision-to-surgery',
    ...partial,
  };
}

const sample: SurgicalRecord[] = [
  rec({
    id: 'hip-awr-90',
    source_name: 'Alberta Wait Times Reporting',
    reporting_period_end: '2026-03-31',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    metric_name: '90th percentile',
    metric_value: 36.8,
    unit: 'weeks',
  }),
  rec({
    id: 'hip-pbi-90',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    metric_name: '90th percentile',
    metric_value: 58.1,
    unit: 'weeks',
  }),
  rec({
    id: 'hip-awr-med',
    source_name: 'Alberta Wait Times Reporting',
    reporting_period_end: '2026-03-31',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    metric_name: 'Median wait',
    metric_value: 19.4,
    unit: 'weeks',
    benchmark_value: '26 weeks (182 days)',
  }),
  rec({
    id: 'hip-pbi-med',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Hip Replacement',
    procedure_name: 'Total Hip Arthroplasty',
    metric_name: 'Median wait',
    metric_value: 16.6,
    unit: 'weeks',
  }),
  rec({
    id: 'breast-cihi-90',
    source_name: 'CIHI priority procedures',
    reporting_period_end: '2025-12-31',
    procedure_group: 'Oncology',
    procedure_name: 'Breast Cancer Surgery',
    metric_name: '90th percentile',
    metric_value: 5.9,
    unit: 'weeks',
  }),
  rec({
    id: 'breast-pbi-90',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Cancer Surgery',
    procedure_name: 'Breast Cancer Surgery',
    metric_name: '90th percentile',
    metric_value: 51,
    unit: 'days',
  }),
  rec({
    id: 'breast-cihi-med',
    source_name: 'CIHI priority procedures',
    reporting_period_end: '2025-12-31',
    procedure_group: 'Oncology',
    procedure_name: 'Breast Cancer Surgery',
    metric_name: 'Median wait',
    metric_value: 3.1,
    unit: 'weeks',
    benchmark_value: '4 weeks (28 days)',
  }),
  rec({
    id: 'breast-pbi-med',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Cancer Surgery',
    procedure_name: 'Breast Cancer Surgery',
    metric_name: 'Median wait',
    metric_value: 28,
    unit: 'days',
    benchmark_value: '4 weeks (28 days)',
  }),
  rec({
    id: 'cat-awr-med',
    source_name: 'Alberta Wait Times Reporting',
    reporting_period_end: '2026-03-31',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Extraction & Lens Implant',
    metric_name: 'Median wait',
    metric_value: 8.6,
    unit: 'weeks',
  }),
  rec({
    id: 'cat-pbi-med',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Surgery 1st Eye',
    metric_name: 'Median wait',
    metric_value: 8.7,
    unit: 'weeks',
  }),
  rec({
    id: 'cat-pbi-90',
    source_name: 'Alberta Health System Dashboard (Power BI)',
    reporting_period_end: 'April 2026',
    procedure_group: 'Cataract Surgery',
    procedure_name: 'Cataract Surgery 1st Eye',
    metric_name: '90th percentile',
    metric_value: 42.4,
    unit: 'weeks',
  }),
];

describe('periodEndMs', () => {
  it('parses ISO and month-year labels', () => {
    expect(periodEndMs('2026-03-31')).toBe(Date.parse('2026-03-31'));
    expect(periodEndMs('April 2026')).toBe(Date.UTC(2026, 4, 0));
    expect(periodEndMs('April 2026')).toBeGreaterThan(periodEndMs('2026-03-31'));
  });
});

describe('pickLatestProvincialRecord', () => {
  it('prefers fresher Power BI hip 90th over older AWR', () => {
    const hit = pickLatestProvincialRecord(sample, 'Total Hip Arthroplasty', '90th percentile');
    expect(hit?.metric_value).toBe(58.1);
    expect(hit?.unit).toBe('weeks');
  });

  it('prefers fresher Power BI breast 90th in days over CIHI weeks', () => {
    const hit = pickLatestProvincialRecord(sample, 'Breast Cancer Surgery', '90th percentile');
    expect(hit?.metric_value).toBe(51);
    expect(hit?.unit).toBe('days');
  });

  it('resolves cataract aliases to Power BI 90th', () => {
    const hit = pickLatestProvincialRecord(sample, 'Cataract Extraction & Lens Implant', '90th percentile');
    expect(hit?.metric_value).toBe(42.4);
    expect(hit?.procedure_name).toBe('Cataract Surgery 1st Eye');
  });
});

describe('dedupeLatestMedians + findMatchingP90', () => {
  it('collapses duplicate procedures to latest median', () => {
    const medians = dedupeLatestMedians(sample);
    const hip = medians.find(r => r.procedure_name === 'Total Hip Arthroplasty');
    const breast = medians.find(r => r.procedure_name === 'Breast Cancer Surgery');
    const cataract = medians.find(r =>
      r.procedure_name === 'Cataract Extraction & Lens Implant' ||
      r.procedure_name === 'Cataract Surgery 1st Eye',
    );
    expect(hip?.metric_value).toBe(16.6);
    expect(breast?.metric_value).toBe(28);
    expect(breast?.unit).toBe('days');
    expect(cataract?.metric_value).toBe(8.7);
    expect(medians).toHaveLength(3);
  });

  it('pairs p90 from same source/period as median', () => {
    const breastMed = sample.find(r => r.id === 'breast-pbi-med')!;
    const p90 = findMatchingP90(sample, breastMed);
    expect(p90?.metric_value).toBe(51);
    expect(p90?.unit).toBe('days');
    expect(p90?.source_name).toContain('Power BI');
  });
});

describe('unit-aware benchmark math', () => {
  it('parses week and day benchmarks into weeks', () => {
    expect(parseBenchmarkWeeks('26 weeks (182 days)')).toBe(26);
    expect(parseBenchmarkWeeks('28 days')).toBeCloseTo(4, 5);
  });

  it('converts days before comparing to week benchmarks', () => {
    expect(toWeeks(28, 'days')).toBeCloseTo(4, 5);
    expect(pctOfBenchmark(28, 'days', '4 weeks (28 days)')).toBe(100);
    expect(pctOfBenchmark(51, 'days', '4 weeks (28 days)')).toBeCloseTo(182.1, 1);
  });
});
