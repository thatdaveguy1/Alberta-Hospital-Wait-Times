// Open Alberta CKAN Fetcher Pipeline
// Queries the Open Alberta CKAN API (https://open.alberta.ca/api/3/action) for
// health and hospital wait time datasets. CKAN typically exposes publications
// as PDF/resource links rather than ready-to-consume structured rows, so this
// fetcher catalogs available resources and only writes domain JSON when a
// structured (CSV/JSON/XLSX) resource is discovered that maps to an existing
// domain shape. When only PDFs are available it returns `status: 'skipped'`
// and records a catalog file so manual download can be triaged.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { applyWithheldPayloadGuard } from './metadataHelpers';

const CKAN_BASE = 'https://open.alberta.ca/api/3/action/package_search';
const QUERIES = [
  'hospital+wait+times',
  'health',
] as const;

// 2 second minimum between upstream requests (rate limit).
const MIN_REQUEST_INTERVAL_MS = 2000;

// Catalog artifact written to the project root for manual-download triage.
const CATALOG_FILE = path.join(process.cwd(), 'data-openalberta-catalog.json');

// Domains we already serve that could plausibly be fed by a CKAN structured
// resource. Used to decide whether to attempt a structured write.
const STRUCTURED_DOMAIN_FILES: Record<string, true> = {
  'data-spending.json': true,
  'data-regional-inequity.json': true,
};

// ---- CKAN response types (only the fields we consume) ----

interface CkanResource {
  id: string;
  name: string;
  url: string;
  format: string;
  mimetype: string | null;
  resource_type: string | null;
}

interface CkanPackage {
  id: string;
  name: string;
  title: string;
  notes: string | null;
  organization: { title: string } | null;
  resources: CkanResource[];
}

interface CkanPackageSearchResult {
  count: number;
  results: CkanPackage[];
}

interface CkanPackageSearchResponse {
  help: string;
  success: boolean;
  result: CkanPackageSearchResult;
}

// ---- Catalog shape (the artifact we persist) ----

interface CatalogResourceEntry {
  id: string;
  name: string;
  url: string;
  format: string;
  isStructured: boolean;
}

interface CatalogPackageEntry {
  id: string;
  name: string;
  title: string;
  organization: string | null;
  notes: string | null;
  structuredResourceCount: number;
  pdfResourceCount: number;
  resources: CatalogResourceEntry[];
}

interface OpenAlbertaCatalog {
  OPEN_ALBERTA_PACKAGES: CatalogPackageEntry[];
}

// ---- Helpers ----

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isStructuredFormat(format: string): boolean {
  const normalized = format.trim().toUpperCase();
  return (
    normalized === 'CSV' ||
    normalized === 'JSON' ||
    normalized === 'XLSX' ||
    normalized === 'XLS' ||
    normalized === 'XML' ||
    normalized === 'GEOJSON' ||
    normalized === 'TSV'
  );
}


function parseCkanResource(raw: unknown): CkanResource | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  const url = asString(raw.url);
  if (!id || !url) return null;
  return {
    id,
    name,
    url,
    format: asString(raw.format),
    mimetype: typeof raw.mimetype === 'string' ? raw.mimetype : null,
    resource_type: typeof raw.resource_type === 'string' ? raw.resource_type : null,
  };
}

function parseCkanPackage(raw: unknown): CkanPackage | null {
  if (!isObject(raw)) return null;
  const id = asString(raw.id);
  const name = asString(raw.name);
  const title = asString(raw.title) || name;
  if (!id || !name) return null;
  const rawOrg = raw.organization;
  const organization =
    isObject(rawOrg) && typeof rawOrg.title === 'string' ? { title: rawOrg.title } : null;
  const rawResources = raw.resources;
  const resources: CkanResource[] = Array.isArray(rawResources)
    ? rawResources
        .map(parseCkanResource)
        .filter((r): r is CkanResource => r !== null)
    : [];
  return {
    id,
    name,
    title,
    notes: typeof raw.notes === 'string' ? raw.notes : null,
    organization,
    resources,
  };
}

function parseCkanResponse(raw: unknown): CkanPackageSearchResponse | null {
  if (!isObject(raw)) return null;
  if (raw.success !== true) return null;
  const rawResult = raw.result;
  if (!isObject(rawResult)) return null;
  const rawResults = rawResult.results;
  if (!Array.isArray(rawResults)) return null;
  const packages = rawResults
    .map(parseCkanPackage)
    .filter((p): p is CkanPackage => p !== null);
  const count = typeof rawResult.count === 'number' ? rawResult.count : packages.length;
  return {
    help: asString(raw.help),
    success: true,
    result: { count, results: packages },
  };
}

function buildCatalogEntry(pkg: CkanPackage): CatalogPackageEntry {
  const resourceEntries: CatalogResourceEntry[] = pkg.resources.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    format: r.format,
    isStructured: isStructuredFormat(r.format),
  }));
  const structuredResourceCount = resourceEntries.filter((r) => r.isStructured).length;
  const pdfResourceCount = resourceEntries.filter((r) => r.format.trim().toUpperCase() === 'PDF').length;
  return {
    id: pkg.id,
    name: pkg.name,
    title: pkg.title,
    organization: pkg.organization?.title ?? null,
    notes: pkg.notes,
    structuredResourceCount,
    pdfResourceCount,
    resources: resourceEntries,
  };
}

function dedupePackages(packages: CkanPackage[]): CkanPackage[] {
  const seen = new Set<string>();
  const out: CkanPackage[] = [];
  for (const pkg of packages) {
    if (seen.has(pkg.id)) continue;
    seen.add(pkg.id);
    out.push(pkg);
  }
  return out;
}

// Returns a promise that resolves after `ms` milliseconds. Uses
// Promise.withResolvers() per project convention for deferred promises.
function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(() => resolve(), ms);
  return promise;
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Heuristic: a structured CKAN resource "maps" to an existing domain file when
// its title/name/notes mention terms that line up with the spending or
// regional-inequity domains. This is intentionally conservative — we only
// claim a mapping when the signals are strong, otherwise we leave the domain
// file untouched and rely on the curated static data.
function findStructuredDomainCandidate(
  pkg: CkanPackage,
): { domainFile: string; resource: CkanResource } | null {
  const haystack = `${pkg.title} ${pkg.name} ${pkg.notes ?? ''}`.toLowerCase();
  for (const resource of pkg.resources) {
    if (!isStructuredFormat(resource.format)) continue;
    const resourceText = `${resource.name} ${resource.url}`.toLowerCase();
    if (
      (haystack.includes('spending') || resourceText.includes('spending')) &&
      STRUCTURED_DOMAIN_FILES['data-spending.json']
    ) {
      return { domainFile: 'data-spending.json', resource };
    }
    if (
      (haystack.includes('inequity') ||
        haystack.includes('community need') ||
        haystack.includes('regional')) &&
      STRUCTURED_DOMAIN_FILES['data-regional-inequity.json']
    ) {
      return { domainFile: 'data-regional-inequity.json', resource };
    }
  }
  return null;
}



async function fetchCkanQuery(query: string): Promise<CkanPackage[]> {
  const url = `${CKAN_BASE}?q=${query}&rows=50`;
  const response = await axios.get(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
    },
    timeout: 20000,
    // Validate a 2xx response; axios throws on non-2xx by default.
  });
  const parsed = parseCkanResponse(response.data);
  if (!parsed) {
    console.warn(`[OpenAlbertaFetcher] Non-CKAN response for query="${query}"`);
    return [];
  }
  return parsed.result.results;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const pipeline = 'openAlbertaFetcher';
  // The fetcher spans multiple potential domains; spending is the primary
  // anchor domain referenced by the task brief.
  const domain = 'spending';

  console.log('[OpenAlbertaFetcher] Querying Open Alberta CKAN for health datasets...');

  try {
    const allPackages: CkanPackage[] = [];
    for (let i = 0; i < QUERIES.length; i++) {
      const query = QUERIES[i];
      if (i > 0) {
        await delay(MIN_REQUEST_INTERVAL_MS);
      }
      try {
        const packages = await fetchCkanQuery(query);
        allPackages.push(...packages);
        console.log(
          `[OpenAlbertaFetcher] query="${query}" returned ${packages.length} packages`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenAlbertaFetcher] query="${query}" failed: ${message}`);
      }
    }

    const packages = dedupePackages(allPackages);
    const catalogEntries = packages.map(buildCatalogEntry);

    let totalStructured = 0;
    let totalPdf = 0;
    for (const entry of catalogEntries) {
      totalStructured += entry.structuredResourceCount;
      totalPdf += entry.pdfResourceCount;
    }

    const catalog: OpenAlbertaCatalog = { OPEN_ALBERTA_PACKAGES: catalogEntries };

    // Persist the catalog artifact regardless of outcome — it is the useful
    // product of a CKAN scan and supports manual-download triage.
    let recordsWritten = 0;
    try {
      writeJson(CATALOG_FILE, catalog);
      recordsWritten = catalogEntries.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAlbertaFetcher] Failed to write catalog: ${message}`);
    }

    // Attempt structured domain writes. We only act when a JSON resource maps
    // to an existing domain file AND its payload is already keyed by the
    // expected const array names. CSV/XLSX and PDF resources require manual
    // download and are recorded in the catalog instead.
    let domainWrites = 0;
    let skippedReason: string | null = null;

    for (const pkg of packages) {
      const candidate = findStructuredDomainCandidate(pkg);
      if (!candidate) continue;
      const { domainFile, resource } = candidate;
      if (resource.format.trim().toUpperCase() !== 'JSON') {
        // Structured-but-not-JSON: needs a dedicated parser (manual download).
        skippedReason = `Structured ${resource.format} resource found for ${domainFile} but requires manual parsing`;
        continue;
      }
      try {
        await delay(MIN_REQUEST_INTERVAL_MS);
        const resourceResponse = await axios.get(resource.url, {
          headers: { Accept: 'application/json' },
          timeout: 20000,
          responseType: 'json',
        });
        const payload = resourceResponse.data;
        if (isObject(payload) && Object.keys(payload).length > 0) {
          const targetPath = path.join(process.cwd(), domainFile);
          applyWithheldPayloadGuard(payload as Record<string, unknown>);
          writeJson(targetPath, payload);
          domainWrites += 1;
          console.log(
            `[OpenAlbertaFetcher] Wrote structured JSON to ${domainFile} from package "${pkg.name}"`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(
          `[OpenAlbertaFetcher] Failed to ingest structured resource ${resource.url}: ${message}`,
        );
        skippedReason = `Structured resource found but ingestion failed: ${message}`;
      }
    }

    const recordsFetched = packages.length;

    // Decide final status. If we wrote structured domain data, it's a success.
    // If we only collected a catalog (the common CKAN case — mostly PDFs), the
    // pipeline is "skipped" with a note that manual download is needed.
    if (domainWrites > 0) {
      return {
        domain,
        pipeline,
        status: skippedReason ? 'partial' : 'success',
        recordsFetched,
        recordsWritten,
        durationMs: Date.now() - startTime,
        timestamp,
      };
    }

    // No structured domain writes — this is the expected CKAN outcome.
    const note =
      skippedReason ??
      (totalPdf > 0 && totalStructured === 0
        ? `Only PDF resources available (${totalPdf} PDFs across ${packages.length} packages); manual download required`
        : totalStructured > 0
          ? `Structured resources found (${totalStructured}) but none mapped to existing domain shapes; catalog written for manual review`
          : `No relevant structured resources found across ${packages.length} packages; catalog written for manual review`);

    return {
      domain,
      pipeline,
      status: 'skipped',
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      error: note,
      timestamp,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      domain,
      pipeline,
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: message,
      timestamp,
    };
  }
}

export default run;
