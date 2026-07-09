/** Module picker search — title, shortName, and id only (not description).
 *  Avoids false positives e.g. searching "diagnostic" matching Surgical + Patient Experience tiles. */

export interface DashboardSearchFields {
  id: string;
  title: string;
  shortName: string;
}

export function dashboardMatchesSearch(
  d: DashboardSearchFields,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    d.title.toLowerCase().includes(q) ||
    d.shortName.toLowerCase().includes(q) ||
    d.id.toLowerCase().includes(q)
  );
}

export function readDashboardModuleFromUrl(
  validIds: readonly string[],
): string | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('module');
  if (!param) return null;
  return validIds.includes(param) ? param : null;
}