import type { Hospital } from '../types';

export type CareType = 'emergency' | 'urgent-care' | 'pediatric-emergency';
export type OpenState = 'open' | 'closed' | 'unknown';
export type WaitBand = 'low' | 'moderate' | 'high' | 'unavailable' | 'closed';

export type EnrichedHospital = Hospital & {
  careType: CareType;
  openState: OpenState;
  waitBand: WaitBand;
  /** null when closed or unavailable — never treat as a real queue */
  effectiveWaitMinutes: number | null;
  ageMaxYears?: number;
  ageMinYears?: number;
  hoursSummary: string;
  servesLabel: string;
};

const PEDIATRIC_NAME_RE = /children'?s|stollery|pediatric/i;
const ADULT_MIN_RE = /patients?\s+(\d+)\s+and\s+older/i;
const PEDS_MAX_RE = /patients?\s+(\d+)\s*&\s*under|patients?\s+(\d+)\s+and\s+under|(\d+)\s*&\s*under/i;

/** Clean AHS note HTML into plain multi-line text. */
export function formatHospitalHours(note: string | undefined): string {
  if (!note) return '';
  let cleaned = note
    .replace(/&lt;br\s*\/?&gt;/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/operational\s+advisory\s*:?/gi, '');
  cleaned = cleaned.trim().replace(/^[:\-\s\n]+/, '');
  return cleaned.trim();
}

export function deriveCareType(hospital: Hospital): CareType {
  const category = (hospital.category || '').toLowerCase();
  const name = hospital.name || '';
  const note = hospital.note || '';

  if (category.includes('urgent')) return 'urgent-care';
  if (PEDIATRIC_NAME_RE.test(name) || /17\s*&\s*under|pediatrician/i.test(note)) {
    return 'pediatric-emergency';
  }
  return 'emergency';
}

export function deriveOpenState(hospital: Hospital): OpenState {
  const label = (hospital.waitTimeLabel || '').toLowerCase();
  if (label.includes('closed')) return 'closed';
  if (label.includes('unavailable') || label.includes('not available') || label.includes('n/a')) {
    return 'unknown';
  }
  if (typeof hospital.waitTime === 'number' && hospital.waitTime < 0) return 'unknown';
  // AHS often reports 0 with "Closed" already handled; bare 0 on urgent care off-hours
  // without a closed label still means no live queue — treat as closed only when note
  // implies limited hours and wait is exactly 0.
  if (hospital.waitTime === 0 && /am\s*[–-]\s*\d|am\s*-\s*\d|pm\b/i.test(hospital.note || '')) {
    return 'closed';
  }
  return 'open';
}

export function isWaitTimeUnavailable(hospital: Hospital | null | undefined): boolean {
  if (!hospital) return true;
  const openState = deriveOpenState(hospital);
  if (openState === 'closed') return true;
  const label = (hospital.waitTimeLabel || '').toLowerCase();
  if (
    label.includes('unavailable') ||
    label.includes('not available') ||
    label.includes('n/a')
  ) {
    return true;
  }
  return typeof hospital.waitTime !== 'number' || !Number.isFinite(hospital.waitTime) || hospital.waitTime < 0;
}

/** Minutes used for ranking/averages — null when not a real open queue. */
export function effectiveWaitMinutes(hospital: Hospital): number | null {
  if (isWaitTimeUnavailable(hospital)) return null;
  if (deriveOpenState(hospital) === 'closed') return null;
  if (typeof hospital.waitTime !== 'number' || !Number.isFinite(hospital.waitTime)) return null;
  return Math.max(0, hospital.waitTime);
}

export function waitBandFor(hospital: Hospital): WaitBand {
  const openState = deriveOpenState(hospital);
  if (openState === 'closed') return 'closed';
  const mins = effectiveWaitMinutes(hospital);
  if (mins === null) return 'unavailable';
  if (hospital.status === 'Red' || mins >= 180) return 'high';
  if (hospital.status === 'Yellow' || mins >= 90) return 'moderate';
  return 'low';
}

export function waitBandLabel(band: WaitBand): string {
  switch (band) {
    case 'low':
      return 'Quieter';
    case 'moderate':
      return 'Busy';
    case 'high':
      return 'Very busy';
    case 'closed':
      return 'Closed';
    default:
      return 'Unavailable';
  }
}

export function careTypeLabel(careType: CareType): string {
  switch (careType) {
    case 'urgent-care':
      return 'Urgent care';
    case 'pediatric-emergency':
      return 'Pediatric ER';
    default:
      return 'Emergency';
  }
}

function parseAgeRules(hospital: Hospital): { ageMaxYears?: number; ageMinYears?: number } {
  const note = hospital.note || '';
  const maxMatch = note.match(PEDS_MAX_RE);
  const minMatch = note.match(ADULT_MIN_RE);
  const ageMaxYears = maxMatch
    ? Number(maxMatch[1] || maxMatch[2] || maxMatch[3])
    : PEDIATRIC_NAME_RE.test(hospital.name)
      ? 17
      : undefined;
  const ageMinYears = minMatch ? Number(minMatch[1]) : undefined;
  return {
    ageMaxYears: Number.isFinite(ageMaxYears) ? ageMaxYears : undefined,
    ageMinYears: Number.isFinite(ageMinYears) ? ageMinYears : undefined,
  };
}

export function servesLabel(hospital: Hospital, careType: CareType): string {
  const { ageMaxYears, ageMinYears } = parseAgeRules(hospital);
  if (careType === 'pediatric-emergency' || ageMaxYears != null) {
    return `Ages ${ageMaxYears ?? 17} & under`;
  }
  if (ageMinYears != null) {
    return `Ages ${ageMinYears}+`;
  }
  if (careType === 'urgent-care') return 'Urgent / minor emergencies';
  return 'All ages';
}

export function enrichHospital(hospital: Hospital): EnrichedHospital {
  const careType = deriveCareType(hospital);
  const openState = deriveOpenState(hospital);
  const waitBand = waitBandFor(hospital);
  const { ageMaxYears, ageMinYears } = parseAgeRules(hospital);
  return {
    ...hospital,
    careType,
    openState,
    waitBand,
    effectiveWaitMinutes: effectiveWaitMinutes(hospital),
    ageMaxYears,
    ageMinYears,
    hoursSummary: formatHospitalHours(hospital.note),
    servesLabel: servesLabel(hospital, careType),
  };
}

export function netMinutes(hospital: Pick<Hospital, 'waitTime' | 'driveMins'> & { effectiveWaitMinutes?: number | null }): number | null {
  const wait =
    hospital.effectiveWaitMinutes !== undefined
      ? hospital.effectiveWaitMinutes
      : typeof hospital.waitTime === 'number' && hospital.waitTime >= 0
        ? hospital.waitTime
        : null;
  if (wait === null) return null;
  if (hospital.driveMins === undefined) return null;
  return wait + hospital.driveMins;
}

/** Short display name — strips common institutional suffixes. */
export function shortHospitalName(name: string): string {
  return name
    .replace('Community Hospital', '')
    .replace('General Hospital', '')
    .replace('Health Centre', '')
    .replace('Regional Hospital', '')
    .replace('Regional Health Centre', '')
    .trim();
}

export function directionsUrl(hospital: Hospital): string {
  const q = encodeURIComponent(`${hospital.name} ${hospital.address || hospital.city || 'Alberta'}`);
  return `https://maps.google.com/?daddr=${q}`;
}

export function mapsPlaceUrl(hospital: Hospital): string {
  const q = encodeURIComponent(`${hospital.name} ${hospital.address || hospital.city || 'Alberta'}`);
  return `https://maps.google.com/?q=${q}`;
}
