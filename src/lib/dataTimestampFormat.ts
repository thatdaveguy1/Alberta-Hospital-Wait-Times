/** Shared formatting for scrape times and source vintages shown in the UI. */

export const EDMONTON_TIMEZONE = 'America/Edmonton';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i;
const YEAR_MONTH_RE =
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/i;

/**
 * Format a scrape/update timestamp or source-period label for display.
 *
 * - Full ISO datetimes → Edmonton local date+time with short TZ
 * - Date-only `YYYY-MM-DD` → calendar date only (no TZ day-shift)
 * - Month/year labels and free-text vintages → shown as-is
 */
export function formatDataTimestamp(ts: string | null | undefined): string {
  if (!ts || ts === 'Unknown') return 'Unknown';

  const value = ts.trim();
  if (!value) return 'Unknown';

  // Date-only: never run through Date() — UTC midnight would render as prior evening MDT.
  if (DATE_ONLY_RE.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
    return utcNoon.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  // Month + year labels parse as day 1 in engines; keep the label verbatim.
  if (YEAR_MONTH_RE.test(value)) {
    return value;
  }

  // Only machine-parse pure ISO datetimes. Free-text like
  // "Reporting period ending 2026-03-31" must not become a clock time.
  if (!ISO_DATETIME_RE.test(value)) {
    return value;
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return value;
  }

  // ISO at UTC midnight or noon (hand-authored day stamps) → calendar date only.
  const isoTime = value.match(/T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
  if (isoTime) {
    const hh = Number(isoTime[1]);
    const mm = Number(isoTime[2]);
    const ss = Number(isoTime[3] ?? '0');
    if (mm === 0 && ss === 0 && (hh === 0 || hh === 12)) {
      return d.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
  }

  return d.toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EDMONTON_TIMEZONE,
    timeZoneName: 'short',
  });
}
