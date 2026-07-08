import type { WaitTimeSnapshot } from '../types';

export function isValidErWaitMinutes(waitTime: number): boolean {
  return typeof waitTime === 'number' && waitTime >= 0 && Number.isFinite(waitTime);
}

export function averageFacilityWaitMinutes(snapshots: WaitTimeSnapshot[]): number | null {
  const valid = snapshots.filter((s) => isValidErWaitMinutes(s.waitTime));
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, s) => acc + s.waitTime, 0);
  return Math.round(sum / valid.length);
}

export type BusiestHourResult = {
  hour: number;
  hourLabel: string;
  avgWaitMinutes: number;
  sampleCount: number;
};

function formatHourLabel(hour24: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:00 ${period}`;
}

/** Hour-of-day (local) with highest mean wait in the snapshot set. */
export function busiestHourOfDay(snapshots: WaitTimeSnapshot[]): BusiestHourResult | null {
  const valid = snapshots.filter((s) => isValidErWaitMinutes(s.waitTime));
  if (valid.length === 0) return null;

  const byHour = new Map<number, { sum: number; count: number }>();
  for (const snap of valid) {
    const hour = new Date(snap.timestamp).getHours();
    const prev = byHour.get(hour) ?? { sum: 0, count: 0 };
    byHour.set(hour, { sum: prev.sum + snap.waitTime, count: prev.count + 1 });
  }

  let bestHour = 0;
  let bestAvg = -Infinity;
  let bestCount = 0;
  for (const [hour, { sum, count }] of byHour.entries()) {
    const avg = sum / count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestHour = hour;
      bestCount = count;
    }
  }

  return {
    hour: bestHour,
    hourLabel: formatHourLabel(bestHour),
    avgWaitMinutes: Math.round(bestAvg),
    sampleCount: bestCount,
  };
}

export function facilityTrendYDomain(snapshots: WaitTimeSnapshot[]): [number, number | 'auto'] {
  const valid = snapshots.map((s) => s.waitTime).filter(isValidErWaitMinutes);
  if (valid.length === 0) return [0, 'auto'];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const pad = Math.max(15, Math.round((max - min) * 0.15));
  return [Math.max(0, min - pad), max + pad];
}