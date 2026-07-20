// Shared lab wait sentinels and helpers for LabCard / DiagnosticDashboard / HomePage.
// Numeric waits are minutes; string sentinels are non-queue states excluded from averages.
//
// APL QMe WaitTime strings include "Closed", "Appointments Only", "Not Available",
// and formats like "45 min" / "1 hr 30 min". "Not Available" means no live estimate —
// not that the site is closed.

export type LabWaitValue = number | 'Appointments Only' | 'Closed' | 'Not Available';

export type LabWaitBand = 'low' | 'moderate' | 'high' | 'closed' | 'unavailable';

export type LabWaitFields = {
  waitTimeMin: LabWaitValue;
  walkInAvailable: boolean;
};

const LAB_WAIT_SENTINELS = ['Closed', 'Appointments Only', 'Not Available'] as const;

/**
 * Parse an APL QMe WaitTime string into minutes or a sentinel.
 * "Not Available" / n/a / unavailable stay as Not Available — never collapse to Closed.
 */
export function parseAplWaitTime(waitStr: string | null | undefined): LabWaitValue {
  if (waitStr == null || typeof waitStr !== 'string') return 'Not Available';

  const lower = waitStr.toLowerCase().trim();
  if (!lower) return 'Not Available';

  if (lower === 'closed') return 'Closed';
  if (lower.includes('appointment')) return 'Appointments Only';
  if (
    lower === 'not available' ||
    lower === 'n/a' ||
    lower === 'na' ||
    lower === 'unavailable' ||
    lower.includes('not avail')
  ) {
    return 'Not Available';
  }

  let totalMins = 0;
  const hrMatch = lower.match(/(\d+)\s*hr/);
  const minMatch = lower.match(/(\d+)\s*min/);

  if (hrMatch) totalMins += parseInt(hrMatch[1], 10) * 60;
  if (minMatch) totalMins += parseInt(minMatch[1], 10);
  if (hrMatch || minMatch) return totalMins;

  const bareNum = parseInt(lower.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(bareNum) && bareNum > 0) return bareNum;

  // Unknown format — do not claim the site is closed.
  console.warn(`[labWait] Unknown WaitTime format: "${waitStr}" — defaulting to Not Available`);
  return 'Not Available';
}

/** True for non-numeric wait sentinels stored on LabLocationWait.waitTimeMin. */
export function isLabWaitSentinel(
  value: unknown,
): value is 'Closed' | 'Appointments Only' | 'Not Available' {
  return (
    value === 'Closed' || value === 'Appointments Only' || value === 'Not Available'
  );
}

/** True when the site has no numeric walk-in wait to average or rank on. */
export function isLabWaitUnavailable(lab: LabWaitFields): boolean {
  if (isLabWaitSentinel(lab.waitTimeMin)) return true;
  if (typeof lab.waitTimeMin === 'number') {
    return lab.waitTimeMin === 0 && !lab.walkInAvailable;
  }
  return true;
}

/**
 * Short label for unavailable wait cells.
 * Not Available displays as "No Estimate" so UI never confuses it with Closed.
 */
export function unavailableWaitLabel(lab: LabWaitFields): string {
  if (lab.waitTimeMin === 'Closed' || lab.waitTimeMin === 'Appointments Only') {
    return lab.waitTimeMin;
  }
  if (lab.waitTimeMin === 'Not Available') {
    return 'No Estimate';
  }
  if (typeof lab.waitTimeMin === 'number' && lab.waitTimeMin === 0 && !lab.walkInAvailable) {
    return 'Closed';
  }
  return 'Unavailable';
}

/** Human detail for unavailable status — Not Available is not described as closed. */
export function labWaitUnavailableDetail(lab: LabWaitFields): string {
  if (lab.waitTimeMin === 'Appointments Only') {
    return 'Appointment-only site; no walk-in wait estimate';
  }
  if (lab.waitTimeMin === 'Not Available') {
    return 'Wait estimate is not available for this site right now';
  }
  return 'Lab is closed or has no open walk-in hours right now';
}

/**
 * Band for chips / sorting.
 * Closed → closed; Not Available / Appointments Only / zero-no-walk-in → unavailable.
 */
export function labWaitBand(lab: LabWaitFields): LabWaitBand {
  if (lab.waitTimeMin === 'Closed') return 'closed';
  if (isLabWaitUnavailable(lab)) return 'unavailable';
  // After unavailable guard, wait is a usable numeric queue length.
  const mins = lab.waitTimeMin as number;
  if (mins > 45) return 'high';
  if (mins > 30) return 'moderate';
  return 'low';
}

export { LAB_WAIT_SENTINELS };
