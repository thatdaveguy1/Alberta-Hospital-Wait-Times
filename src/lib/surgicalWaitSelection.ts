import type { SurgicalRecord } from '../surgicalData';

/** Procedure-name aliases across AWR/CIHI vs Power BI naming. */
export const PROCEDURE_NAME_ALIASES: Record<string, string[]> = {
  'Cataract Extraction & Lens Implant': ['Cataract Surgery 1st Eye'],
  'Cataract Surgery 1st Eye': ['Cataract Extraction & Lens Implant'],
  'Coronary Artery Bypass Graft': ['Coronary Artery Bypass Graft (CABG)'],
  'Coronary Artery Bypass Graft (CABG)': ['Coronary Artery Bypass Graft'],
};

/**
 * Public Wait-2 access targets for priority procedures reported by CIHI and used
 * in Alberta performance reporting. Only procedures with an established published
 * national benchmark are listed — ACATS case-level targets and cancer urgency
 * bands are not single public numbers and must stay blank.
 *
 * Source: CIHI priority-procedure wait-time methodology
 * (hip/knee replacement 182 days; cataract surgery 112 days).
 */
export const CIHI_PRIORITY_BENCHMARKS: Record<string, string> = {
  'Total Hip Arthroplasty': '26 weeks (182 days)',
  'Total Knee Arthroplasty': '26 weeks (182 days)',
  'Cataract Extraction & Lens Implant': '16 weeks (112 days)',
  'Cataract Surgery 1st Eye': '16 weeks (112 days)',
  // Group-name aliases used by some historical/CIHI rows
  'Hip Replacement': '26 weeks (182 days)',
  'Knee Replacement': '26 weeks (182 days)',
  'Cataract Surgery': '16 weeks (112 days)',
};

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

/** Convert reporting_period_end (ISO date or "April 2026") to epoch ms. */
export function periodEndMs(period: string | undefined): number {
  if (!period) return 0;
  const trimmed = period.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? ms : 0;
  }
  const match = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return 0;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  if (month == null) return 0;
  // End of named month (UTC).
  return Date.UTC(Number(match[2]), month + 1, 0);
}

export function procedureNameMatches(candidate: string, target: string): boolean {
  if (candidate === target) return true;
  const aliases = PROCEDURE_NAME_ALIASES[target] ?? [];
  if (aliases.includes(candidate)) return true;
  const reverse = PROCEDURE_NAME_ALIASES[candidate] ?? [];
  return reverse.includes(target);
}

/** Collapse known aliases onto one preferred procedure_name for dedupe keys. */
export function canonicalProcedureName(name: string): string {
  // Fixed preferred names for Power BI / registry spelling drift.
  if (name === 'Cataract Surgery 1st Eye') return 'Cataract Extraction & Lens Implant';
  if (name === 'Coronary Artery Bypass Graft (CABG)') return 'Coronary Artery Bypass Graft';
  return name;
}

/** Parse benchmark strings like "26 weeks (182 days)" or "28 days" into weeks. */
export function parseBenchmarkWeeks(benchmark?: string): number | null {
  if (!benchmark) return null;
  const weeks = benchmark.match(/(\d+(?:\.\d+)?)\s*weeks?/i);
  if (weeks) return parseFloat(weeks[1]);
  const days = benchmark.match(/(\d+(?:\.\d+)?)\s*days?/i);
  if (days) return parseFloat(days[1]) / 7;
  return null;
}

export function toWeeks(value: number, unit: SurgicalRecord['unit']): number {
  return unit === 'days' ? value / 7 : value;
}

export function unitDisplayLabel(unit: SurgicalRecord['unit'] | undefined): string {
  return unit === 'days' ? 'Days' : 'Weeks';
}

export function unitAbbr(unit: SurgicalRecord['unit'] | undefined): string {
  return unit === 'days' ? 'days' : 'wks';
}

function isFresher(a: SurgicalRecord, b: SurgicalRecord): boolean {
  const aEnd = periodEndMs(a.reporting_period_end);
  const bEnd = periodEndMs(b.reporting_period_end);
  if (aEnd !== bEnd) return aEnd > bEnd;
  // Tie-break: prefer Power BI (fresher monthly feed) over older registry/CIHI rows.
  const aPbi = a.source_name.includes('Power BI') ? 1 : 0;
  const bPbi = b.source_name.includes('Power BI') ? 1 : 0;
  return aPbi > bPbi;
}

/** Pick the latest provincial Wait-2 record for a metric + procedure (with aliases). */
export function pickLatestProvincialRecord(
  records: SurgicalRecord[],
  procedureName: string,
  metricName: SurgicalRecord['metric_name'],
): SurgicalRecord | undefined {
  let best: SurgicalRecord | undefined;
  for (const r of records) {
    if (r.geography_type !== 'Province') continue;
    if (r.geography_name !== 'Alberta') continue;
    if (r.wait_segment !== 'Decision-to-surgery') continue;
    if (r.metric_name !== metricName) continue;
    if (!procedureNameMatches(r.procedure_name, procedureName)) continue;
    if (!best || isFresher(r, best)) best = r;
  }
  return best;
}

/** Keep one median row per procedure_name, preferring the latest period/source. */
export function dedupeLatestMedians(records: SurgicalRecord[]): SurgicalRecord[] {
  const byProc = new Map<string, SurgicalRecord>();
  for (const r of records) {
    if (r.geography_type !== 'Province') continue;
    if (r.wait_segment !== 'Decision-to-surgery') continue;
    if (r.metric_name !== 'Median wait') continue;
    // Canonicalize aliases so cataract AWR/Power BI collapse to one row.
    const key = canonicalProcedureName(r.procedure_name);
    const existing = byProc.get(key);
    if (!existing || isFresher(r, existing)) byProc.set(key, r);
  }
  return Array.from(byProc.values());
}

/** Pair a 90th-percentile row from the same source + period as the median row. */
export function findMatchingP90(
  records: SurgicalRecord[],
  medianRec: SurgicalRecord,
): SurgicalRecord | undefined {
  let best: SurgicalRecord | undefined;
  for (const r of records) {
    if (r.geography_type !== 'Province') continue;
    if (r.wait_segment !== medianRec.wait_segment) continue;
    if (r.metric_name !== '90th percentile') continue;
    if (r.source_name !== medianRec.source_name) continue;
    if (!procedureNameMatches(r.procedure_name, medianRec.procedure_name)) continue;
    // Prefer exact period match; otherwise latest from same source.
    if (r.reporting_period_end === medianRec.reporting_period_end) return r;
    if (!best || isFresher(r, best)) best = r;
  }
  return best;
}

/** Prefer an explicit benchmark; else same-procedure row; else CIHI published target. */
export function resolveBenchmarkValue(
  records: SurgicalRecord[],
  procedureName: string,
  preferred?: string,
): string | undefined {
  if (preferred) return preferred;
  let best: SurgicalRecord | undefined;
  for (const r of records) {
    if (r.geography_type !== 'Province') continue;
    if (!r.benchmark_value) continue;
    if (!procedureNameMatches(r.procedure_name, procedureName)) continue;
    if (!best || isFresher(r, best)) best = r;
  }
  if (best?.benchmark_value) return best.benchmark_value;
  const canon = canonicalProcedureName(procedureName);
  return (
    CIHI_PRIORITY_BENCHMARKS[procedureName] ??
    CIHI_PRIORITY_BENCHMARKS[canon] ??
    undefined
  );
}

export function pctOfBenchmark(
  value: number,
  unit: SurgicalRecord['unit'],
  benchmark?: string,
): number | null {
  const benchWeeks = parseBenchmarkWeeks(benchmark);
  if (benchWeeks == null || benchWeeks <= 0) return null;
  const valueWeeks = toWeeks(value, unit);
  return Math.round((valueWeeks / benchWeeks) * 1000) / 10;
}
