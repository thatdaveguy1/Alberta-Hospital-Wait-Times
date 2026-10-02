import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SurgicalRecord } from '../../src/surgicalData';
import {
  dedupeLatestMedians,
  findMatchingP90,
  parseBenchmarkWeeks,
  pctOfBenchmark,
  periodEndMs,
  pickLatestProvincialRecord,
  resolveBenchmarkValue,
  toWeeks,
  CIHI_PRIORITY_BENCHMARKS,
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
    assert.strictEqual(periodEndMs('2026-03-31'), Date.parse('2026-03-31'));
    assert.strictEqual(periodEndMs('April 2026'), Date.UTC(2026, 4, 0));
    assert.ok(periodEndMs('April 2026') > periodEndMs('2026-03-31'));
  });
});

describe('pickLatestProvincialRecord', () => {
  it('prefers fresher Power BI hip 90th over older AWR', () => {
    const hit = pickLatestProvincialRecord(sample, 'Total Hip Arthroplasty', '90th percentile');
    assert.strictEqual(hit?.metric_value, 58.1);
    assert.strictEqual(hit?.unit, 'weeks');
  });

  it('prefers fresher Power BI breast 90th in days over CIHI weeks', () => {
    const hit = pickLatestProvincialRecord(sample, 'Breast Cancer Surgery', '90th percentile');
    assert.strictEqual(hit?.metric_value, 51);
    assert.strictEqual(hit?.unit, 'days');
  });

  it('resolves cataract aliases to Power BI 90th', () => {
    const hit = pickLatestProvincialRecord(sample, 'Cataract Extraction & Lens Implant', '90th percentile');
    assert.strictEqual(hit?.metric_value, 42.4);
    assert.strictEqual(hit?.procedure_name, 'Cataract Surgery 1st Eye');
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
    assert.strictEqual(hip?.metric_value, 16.6);
    assert.strictEqual(breast?.metric_value, 28);
    assert.strictEqual(breast?.unit, 'days');
    assert.strictEqual(cataract?.metric_value, 8.7);
    assert.strictEqual(medians.length, 3);
  });

  it('pairs p90 from same source/period as median', () => {
    const breastMed = sample.find(r => r.id === 'breast-pbi-med')!;
    const p90 = findMatchingP90(sample, breastMed);
    assert.strictEqual(p90?.metric_value, 51);
    assert.strictEqual(p90?.unit, 'days');
    assert.ok(p90?.source_name.includes('Power BI'));
  });
});

describe('unit-aware benchmark math', () => {
  it('parses week and day benchmarks into weeks', () => {
    assert.strictEqual(parseBenchmarkWeeks('26 weeks (182 days)'), 26);
    assert.ok(Math.abs((parseBenchmarkWeeks('28 days')) - (4)) < 10 ** -5 / 2);
  });

  it('converts days before comparing to week benchmarks', () => {
    assert.ok(Math.abs((toWeeks(28, 'days')) - (4)) < 10 ** -5 / 2);
    assert.strictEqual(pctOfBenchmark(28, 'days', '4 weeks (28 days)'), 100);
    assert.ok(Math.abs((pctOfBenchmark(51, 'days', '4 weeks (28 days)')) - (182.1)) < 10 ** -1 / 2);
  });
});

describe('CIHI published priority benchmarks', () => {
  it('exposes hip/knee/cataract national Wait-2 targets only', () => {
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Total Hip Arthroplasty'], '26 weeks (182 days)');
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Total Knee Arthroplasty'], '26 weeks (182 days)');
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Cataract Extraction & Lens Implant'], '16 weeks (112 days)');
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Breast Cancer Surgery'], undefined);
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Bariatric Surgery'], undefined);
    assert.strictEqual(CIHI_PRIORITY_BENCHMARKS['Coronary Artery Bypass Graft'], undefined);
  });

  it('falls back to CIHI map when no record carries benchmark_value', () => {
    const rows = [
      rec({
        id: 'hip-only',
        source_name: 'Alberta Health System Dashboard (Power BI)',
        reporting_period_end: 'April 2026',
        procedure_name: 'Total Hip Arthroplasty',
        metric_name: '90th percentile',
        metric_value: 58.1,
        unit: 'weeks',
      }),
      rec({
        id: 'breast-only',
        source_name: 'Alberta Health System Dashboard (Power BI)',
        reporting_period_end: 'April 2026',
        procedure_name: 'Breast Cancer Surgery',
        metric_name: '90th percentile',
        metric_value: 51,
        unit: 'days',
      }),
    ];
    assert.strictEqual(resolveBenchmarkValue(rows, 'Total Hip Arthroplasty'), '26 weeks (182 days)');
    assert.strictEqual(resolveBenchmarkValue(rows, 'Cataract Surgery 1st Eye'), '16 weeks (112 days)');
    assert.strictEqual(resolveBenchmarkValue(rows, 'Breast Cancer Surgery'), undefined);
    assert.ok(
      Math.abs(pctOfBenchmark(58.1, 'weeks', resolveBenchmarkValue(rows, 'Total Hip Arthroplasty')) - 223.5) <
        10 ** -1 / 2,
    );
  });
});

describe('CABG naming + benchmark inheritance', () => {
  const cabgRows: SurgicalRecord[] = [
    rec({
      id: 'cabg-cihi-med',
      source_name: 'CIHI priority procedures',
      reporting_period_end: '2025-12-31',
      procedure_group: 'Cardiology',
      procedure_name: 'Coronary Artery Bypass Graft (CABG)',
      metric_name: 'Median wait',
      metric_value: 1.8,
      unit: 'weeks',
      benchmark_value: '26 weeks (Max safety benchmark differs by severity)',
    }),
    rec({
      id: 'cabg-pbi-med',
      source_name: 'Alberta Health System Dashboard (Power BI)',
      reporting_period_end: 'April 2026',
      procedure_group: 'Cardiac Surgery',
      procedure_name: 'Coronary Artery Bypass Graft',
      metric_name: 'Median wait',
      metric_value: 11.75,
      unit: 'weeks',
    }),
    rec({
      id: 'hip-bench-only',
      source_name: 'Alberta Wait Times Reporting',
      reporting_period_end: '2026-03-31',
      procedure_group: 'Hip Replacement',
      procedure_name: 'Total Hip Arthroplasty',
      metric_name: '90th percentile',
      metric_value: 36.8,
      unit: 'weeks',
      benchmark_value: '26 weeks (182 days)',
    }),
    rec({
      id: 'hip-pbi-nobench',
      source_name: 'Alberta Health System Dashboard (Power BI)',
      reporting_period_end: 'April 2026',
      procedure_group: 'Hip Replacement',
      procedure_name: 'Total Hip Arthroplasty',
      metric_name: '90th percentile',
      metric_value: 58.1,
      unit: 'weeks',
    }),
  ];

  it('dedupes CABG aliases to freshest Power BI median', () => {
    const medians = dedupeLatestMedians(cabgRows);
    const cabg = medians.find(r => r.procedure_name.includes('Coronary'));
    assert.strictEqual(medians.filter(r => r.procedure_name.includes('Coronary')).length, 1);
    assert.strictEqual(cabg?.metric_value, 11.75);
    assert.ok(cabg?.source_name.includes('Power BI'));
  });

  it('inherits benchmark from older same-procedure row when latest lacks one', () => {
    const latest = pickLatestProvincialRecord(cabgRows, 'Total Hip Arthroplasty', '90th percentile');
    assert.strictEqual(latest?.metric_value, 58.1);
    assert.strictEqual(latest?.benchmark_value, undefined);
    assert.strictEqual(resolveBenchmarkValue(cabgRows, 'Total Hip Arthroplasty', latest?.benchmark_value), '26 weeks (182 days)');
  });
});
