import {
  averageFacilityWaitMinutes,
  busiestHourOfDay,
  facilityTrendYDomain,
} from '../src/lib/facilityWaitStats.ts';

const snapshots = [
  { hospitalId: 'a', waitTime: 60, timestamp: '2026-07-08T14:00:00.000Z' },
  { hospitalId: 'a', waitTime: 120, timestamp: '2026-07-08T15:00:00.000Z' },
  { hospitalId: 'a', waitTime: 90, timestamp: '2026-07-08T14:30:00.000Z' },
];

const avg = averageFacilityWaitMinutes(snapshots);
if (avg !== 90) throw new Error(`expected avg 90, got ${avg}`);
const busiest = busiestHourOfDay(snapshots);

if (!busiest || busiest.avgWaitMinutes !== 120) throw new Error(`expected busiest avg 120, got ${JSON.stringify(busiest)}`);

const domain = facilityTrendYDomain(snapshots);
if (domain[0] > 60 || domain[1] < 120) throw new Error(`unexpected y domain ${domain}`);

console.log('facilityWaitStats OK', { avg, busiest: busiest.hourLabel, domain });