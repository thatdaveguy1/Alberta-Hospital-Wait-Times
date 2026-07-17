// Alberta Continuing Care Accommodation Standards Compliance Fetcher
//
// Downloads the "Continuing Care Accommodation Standards compliance reporting"
// XLSX dataset from the Alberta Open Government Portal (CKAN resource) and
// aggregates the per-visit/per-standard rows into one CareFacilityCompliance
// record per facility, then merges the result into data-continuing-care.json
// while preserving the placement, quality, and home-care arrays owned by the
// sibling hqcaContinuingCareFetcher pipeline.
//
// Source dataset (OGL-A licensed, quarterly):
//   https://open.alberta.ca/dataset/2003f13d-33ad-4d3f-865d-0d9488ace84d
// The resource URL embeds a YYYY-MM vintage suffix that changes each quarter,
// so the fetcher first queries the CKAN package_show API to discover the
// current XLSX resource URL rather than hard-coding a stale filename.
//
// The XLSX has ~31 K rows of one (facility × standard × visit) tuple each.
// We collapse to one record per facility keyed by (Site Name + City):
//   - lastInspectionDate = most recent Visit Date for the facility
//   - violationsCount    = count of rows whose Non-Compliance Current Status
//                          is one of the open/unresolved statuses
//   - standardsCompliant = violationsCount === 0
//   - majorViolationsDesc = up to three distinct open Substandard labels,
//                          joined with '; '
//
// All failures are caught and returned as SyncResult — run() never throws.

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  applyWithheldPayloadGuard,
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type {
  PlacementMetric,
  ResidentOutcomeQuality,
  HomeCareContinuity,
  CareFacilityCompliance,
} from '../continuingCareData';

// CKAN package id for the dataset. The resource URL changes each quarter
// (the filename embeds a YYYY-MM vintage), so we discover it at runtime.
const CKAN_PACKAGE_ID = '2003f13d-33ad-4d3f-865d-0d9488ace84d';
const CKAN_PACKAGE_SHOW_URL = `https://open.alberta.ca/api/3/action/package_show?id=${CKAN_PACKAGE_ID}`;
const CONTINUING_CARE_FILE = path.join(process.cwd(), 'data-continuing-care.json');
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Statuses that represent an unresolved/open non-compliance at the time of
// the dataset extract. "Rectified", "Resolved", and "No Longer Relevant" are
// treated as closed; "N/A" only appears on Compliant rows.
const OPEN_NONCOMPLIANCE_STATUSES = new Set([
  'Issued',
  'In Progress',
  'Ongoing',
]);

// Map facility city → AHS zone. Unmapped cities stay as 'Alberta' rather than
// inventing a default zone (previous code stamped every row 'Alberta' always).
type AlbertaZone = CareFacilityCompliance['zone'];

const ZONE_BY_CITY: Record<string, AlbertaZone> = {
  // Calgary Zone
  Calgary: 'Calgary Zone', Airdrie: 'Calgary Zone', Cochrane: 'Calgary Zone',
  Okotoks: 'Calgary Zone', Chestermere: 'Calgary Zone', 'High River': 'Calgary Zone',
  Canmore: 'Calgary Zone', Banff: 'Calgary Zone', Strathmore: 'Calgary Zone',
  'Black Diamond': 'Calgary Zone', 'Diamond Valley': 'Calgary Zone',
  Crossfield: 'Calgary Zone', 'Rocky View County': 'Calgary Zone',
  Carstairs: 'Calgary Zone', Didsbury: 'Calgary Zone', Olds: 'Calgary Zone',
  Sundre: 'Calgary Zone', Linden: 'Calgary Zone', Nanton: 'Calgary Zone',
  Claresholm: 'Calgary Zone',
  // Edmonton Zone
  Edmonton: 'Edmonton Zone', 'St. Albert': 'Edmonton Zone',
  'Sherwood Park': 'Edmonton Zone', Leduc: 'Edmonton Zone',
  'Spruce Grove': 'Edmonton Zone', 'Stony Plain': 'Edmonton Zone',
  'Fort Saskatchewan': 'Edmonton Zone', Beaumont: 'Edmonton Zone',
  Morinville: 'Edmonton Zone', Devon: 'Edmonton Zone', Gibbons: 'Edmonton Zone',
  Legal: 'Edmonton Zone', Redwater: 'Edmonton Zone',
  'Parkland County': 'Edmonton Zone', 'Sturgeon County': 'Edmonton Zone',
  Villeneuve: 'Edmonton Zone', Keephills: 'Edmonton Zone', Onoway: 'Edmonton Zone',
  Warburg: 'Edmonton Zone',
  // Central Zone
  'Red Deer': 'Central Zone', Camrose: 'Central Zone', Lacombe: 'Central Zone',
  Wetaskiwin: 'Central Zone', Ponoka: 'Central Zone', Innisfail: 'Central Zone',
  'Sylvan Lake': 'Central Zone', Stettler: 'Central Zone',
  'Rocky Mountain House': 'Central Zone', Drumheller: 'Central Zone',
  Wainwright: 'Central Zone', Vegreville: 'Central Zone', Vermilion: 'Central Zone',
  Lloydminster: 'Central Zone', Bashaw: 'Central Zone', Bentley: 'Central Zone',
  Castor: 'Central Zone', Consort: 'Central Zone', Coronation: 'Central Zone',
  Daysland: 'Central Zone', Eckville: 'Central Zone', Forestburg: 'Central Zone',
  Hanna: 'Central Zone', Hardisty: 'Central Zone', Killam: 'Central Zone',
  Provost: 'Central Zone', Rimbey: 'Central Zone', 'Three Hills': 'Central Zone',
  Tofield: 'Central Zone', Trochu: 'Central Zone', Viking: 'Central Zone',
  // South Zone
  Lethbridge: 'South Zone', 'Medicine Hat': 'South Zone', Brooks: 'South Zone',
  Taber: 'South Zone', Cardston: 'South Zone', 'Pincher Creek': 'South Zone',
  'Fort Macleod': 'South Zone', Magrath: 'South Zone', Raymond: 'South Zone',
  Coaldale: 'South Zone', 'Milk River': 'South Zone', 'Picture Butte': 'South Zone',
  'Bow Island': 'South Zone', Bassano: 'South Zone', Vulcan: 'South Zone',
  Blairmore: 'South Zone', Coleman: 'South Zone', 'Stand Off': 'South Zone',
  Carmangay: 'South Zone', 'Cypress County': 'South Zone',
  'Lethbridge County': 'South Zone',
  // North Zone
  'Grande Prairie': 'North Zone', 'Fort Mcmurray': 'North Zone',
  'Fort McMurray': 'North Zone', 'Cold Lake': 'North Zone',
  'Peace River': 'North Zone', 'High Level': 'North Zone',
  'Slave Lake': 'North Zone', Athabasca: 'North Zone', Westlock: 'North Zone',
  Whitecourt: 'North Zone', Hinton: 'North Zone', Edson: 'North Zone',
  Bonnyville: 'North Zone', 'Grande Cache': 'North Zone',
  'Grand Cache': 'North Zone', Barrhead: 'North Zone', Boyle: 'North Zone',
  'Drayton Valley': 'North Zone', Fairview: 'North Zone', Falher: 'North Zone',
  'Fort Chipewyan': 'North Zone', 'Fort Vermilion': 'North Zone',
  Grimshaw: 'North Zone', 'High Prairie': 'North Zone',
  'Hines Creek': 'North Zone', Hythe: 'North Zone', Jasper: 'North Zone',
  'Lac LA Biche': 'North Zone', 'LA Crete': 'North Zone', Manning: 'North Zone',
  Mayerthorpe: 'North Zone', Mclennan: 'North Zone', 'Smoky Lake': 'North Zone',
  'Spirit River': 'North Zone', 'St. Paul': 'North Zone', Valleyview: 'North Zone',
  Wabasca: 'North Zone',
};

function deduceZone(city: string): AlbertaZone {
  if (!city) return 'Alberta';
  const direct = ZONE_BY_CITY[city];
  if (direct) return direct;
  const lower = city.trim().toLowerCase();
  for (const [k, z] of Object.entries(ZONE_BY_CITY)) {
    if (k.toLowerCase() === lower) return z;
  }
  return 'Alberta';
}

// ---- Utilities ------------------------------------------------------------

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : value == null ? undefined : String(value);
}

// Convert an Excel serial date number to a YYYY-MM-DD string.
// Excel epoch is 1899-12-30; serial = days since that epoch.
function excelSerialToDateStr(serial: number): string | undefined {
  if (!Number.isFinite(serial)) return undefined;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

// Title-case a SHOUTY operator/site name, preserving short tokens (initials).
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();
}

// Classify an operator string into the CareFacilityCompliance['operator'] union.
function classifyOperator(raw: string): CareFacilityCompliance['operator'] {
  const lower = raw.toLowerCase();
  if (lower.includes('covenant')) return 'Covenant Health';
  if (lower.includes('alberta health services') || lower === 'ahs') return 'AHS';
  if (
    lower.includes('foundation') ||
    lower.includes('society') ||
    lower.includes('non-profit') ||
    lower.includes('good samaritan') ||
    lower.includes('bethany') ||
    lower.includes('shepherd') ||
    lower.includes('capital care') ||
    lower.includes('carewest') ||
    lower.includes('excel society') ||
    lower.includes('catholic social') ||
    lower.includes('robin hood')
  ) {
    return 'Non-Profit';
  }
  return 'Private/Contracted';
}

// Classify an accommodation type/subtype string into the type union.
function classifyType(
  accType: string,
  accSub: string,
): CareFacilityCompliance['type'] {
  const t = `${accType} ${accSub}`.toLowerCase();
  if (
    t.includes('long term care') ||
    t.includes('long-term care') ||
    t.includes('continuing care home type a') ||
    t.includes('nursing')
  ) {
    return 'Type A (Long-Term Care)';
  }
  return 'Type B (Designated Supportive Living)';
}

// ---- CKAN resource discovery ---------------------------------------------

interface CkanResource {
  url: string;
  format: string;
  name: string;
}

async function discoverXlsxUrl(): Promise<{ url: string; vintage: string } | undefined> {
  try {
    const resp = await axios.get(CKAN_PACKAGE_SHOW_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
      },
      timeout: 30000,
    });
    const pkg = resp.data?.result;
    if (!pkg || !Array.isArray(pkg.resources)) return undefined;
    const isColumnDescriptions = (r: CkanResource) => {
      const hay = `${r.name ?? ''} ${r.url ?? ''}`.toLowerCase();
      return hay.includes('column description') || hay.includes('column-description');
    };
    const xlsx = (pkg.resources as CkanResource[]).find(
      (r) =>
        r.format?.toUpperCase() === 'XLSX' &&
        r.url.toLowerCase().endsWith('.xlsx') &&
        !isColumnDescriptions(r),
    );
    if (!xlsx) return undefined;
    // Vintage label from the resource name, e.g. "...as of March 2026".
    const vintage = asString(pkg.time_coverage_to) ?? asString(pkg.date_modified) ?? 'latest';
    return { url: xlsx.url, vintage };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CcCompliance] CKAN package_show failed: ${msg}`);
    return undefined;
  }
}

// ---- XLSX parsing ---------------------------------------------------------

interface FacilityAggregate {
  name: string;
  operator: string;
  city: string;
  province: string;
  accType: string;
  accSub: string;
  units: number | null;
  lastVisitSerial: number;
  openViolations: number;
  openSubstandards: Set<string>;
}

function parseComplianceXlsx(buffer: Buffer): CareFacilityCompliance[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (rows.length < 2) return [];

  const header = rows[0] as string[];
  const col: Record<string, number> = {};
  header.forEach((h, i) => {
    if (typeof h === 'string') col[h.trim()] = i;
  });

  const cSite = col['Site Name'];
  const cOperator = col['Operator'];
  const cCity = col['City'];
  const cProvince = col['Province'];
  const cAccType = col['Accommodation Type'];
  const cAccSub = col['Accommodation Subtype'];
  const cUnits = col['Units'];
  const cVisitDate = col['Visit Date'];
  const cVisitResult = col['Visit Result'];
  const cStandardDesc = col['Standard Description'];
  const cSubstandard = col['Substandard'];
  const cStandard = col['Standard'];
  const cStatus = col['Non-Compliance Current Status'];

  if (cSite === undefined || cCity === undefined || cVisitDate === undefined) {
    console.warn('[CcCompliance] Required columns missing in XLSX header.');
    return [];
  }

  const byFacility = new Map<string, FacilityAggregate>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const siteName = asString(row[cSite])?.trim();
    if (!siteName) continue;
    const city = (asString(row[cCity])?.trim() || '').replace(/,\s*$/, '');
    const key = `${siteName.toLowerCase()}|${city.toLowerCase()}`;

    const visitSerial = typeof row[cVisitDate] === 'number' ? (row[cVisitDate] as number) : NaN;
    const visitResult = asString(row[cVisitResult])?.trim() ?? '';
    const status = asString(row[cStatus])?.trim() ?? '';
    // Pick the most human-readable label available for the violated standard.
    // CCHSS rows carry the label in Standard Description (Substandard is
    // numeric); Accommodation Standard rows carry it in Substandard (Standard
    // Description is "N/A"). Fall back to the Standard category name.
    const descRaw = asString(row[cStandardDesc])?.trim() ?? '';
    const substandardRaw = asString(row[cSubstandard])?.trim() ?? '';
    const standardRaw = asString(row[cStandard])?.trim() ?? '';
    const violationLabel =
      (descRaw && descRaw !== 'N/A' ? descRaw : '') ||
      (substandardRaw && substandardRaw !== 'N/A' ? substandardRaw : '') ||
      (standardRaw && standardRaw !== 'N/A' ? standardRaw : '');


    let agg = byFacility.get(key);
    if (!agg) {
      agg = {
        name: titleCase(siteName),
        operator: titleCase(asString(row[cOperator])?.trim() ?? siteName),
        city: titleCase(city),
        province: asString(row[cProvince])?.trim() ?? 'Alberta',
        accType: asString(row[cAccType])?.trim() ?? '',
        accSub: asString(row[cAccSub])?.trim() ?? '',
        units: typeof row[cUnits] === 'number' ? (row[cUnits] as number) : null,
        lastVisitSerial: NaN,
        openViolations: 0,
        openSubstandards: new Set<string>(),
      };
      byFacility.set(key, agg);
    }

    if (Number.isFinite(visitSerial) && (Number.isNaN(agg.lastVisitSerial) || visitSerial > agg.lastVisitSerial)) {
      agg.lastVisitSerial = visitSerial;
    }

    // Count an open violation only when the row is flagged Non-Compliant AND
    // the current status is one of the open/unresolved values. This avoids
    // counting historical issues that have since been Rectified/Resolved.
    if (
      visitResult.toLowerCase() === 'non-compliant' &&
      OPEN_NONCOMPLIANCE_STATUSES.has(status)
    ) {
      agg.openViolations += 1;
      if (violationLabel) {
        agg.openSubstandards.add(violationLabel);
      }
    }
  }

  const facilities: CareFacilityCompliance[] = [];
  let idx = 0;
  for (const agg of byFacility.values()) {
    const lastInspection = excelSerialToDateStr(agg.lastVisitSerial) ?? '';
    const openDescs = [...agg.openSubstandards].slice(0, 3);
    facilities.push({
      id: `FAC-CC-${String(++idx).padStart(3, '0')}`,
      name: agg.name,
      type: classifyType(agg.accType, agg.accSub),
      operator: classifyOperator(agg.operator),
      city: agg.city,
      zone: deduceZone(agg.city),
      lastInspectionDate: lastInspection,
      standardsCompliant: agg.openViolations === 0,
      violationsCount: agg.openViolations,
      majorViolationsDesc: openDescs.length > 0 ? openDescs.join('; ') : null,
    });
  }

  // Sort: non-compliant first (most violations), then by name for stability.
  facilities.sort((a, b) => {
    if (a.standardsCompliant !== b.standardsCompliant) return a.standardsCompliant ? 1 : -1;
    if (b.violationsCount !== a.violationsCount) return b.violationsCount - a.violationsCount;
    return a.name.localeCompare(b.name);
  });

  return facilities;
}

// ---- JSON merge -----------------------------------------------------------

interface ContinuingCareJson {
  CONTINUING_CARE_PLACEMENT_STATS: PlacementMetric[];
  RESIDENT_QUALITY_OUTCOMES: ResidentOutcomeQuality[];
  HOME_CARE_EXPERIENCE: HomeCareContinuity[];
  CONTINUING_CARE_COMPLIANCE: CareFacilityCompliance[];
  _dataMetadata?: DataMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceJson(raw: unknown): ContinuingCareJson {
  const base: ContinuingCareJson = {
    CONTINUING_CARE_PLACEMENT_STATS: [],
    RESIDENT_QUALITY_OUTCOMES: [],
    HOME_CARE_EXPERIENCE: [],
    CONTINUING_CARE_COMPLIANCE: [],
  };
  if (isRecord(raw)) {
    if (Array.isArray(raw.CONTINUING_CARE_PLACEMENT_STATS))
      base.CONTINUING_CARE_PLACEMENT_STATS = raw.CONTINUING_CARE_PLACEMENT_STATS as PlacementMetric[];
    if (Array.isArray(raw.RESIDENT_QUALITY_OUTCOMES))
      base.RESIDENT_QUALITY_OUTCOMES = raw.RESIDENT_QUALITY_OUTCOMES as ResidentOutcomeQuality[];
    // Withheld: never rehydrate HOME_CARE_EXPERIENCE from raw.
    if (Array.isArray(raw.CONTINUING_CARE_COMPLIANCE))
      base.CONTINUING_CARE_COMPLIANCE = raw.CONTINUING_CARE_COMPLIANCE as CareFacilityCompliance[];
    if (isRecord(raw._dataMetadata)) base._dataMetadata = raw._dataMetadata as DataMetadata;
  }
  return base;
}

function loadExisting(): ContinuingCareJson {
  try {
    const text = fs.readFileSync(CONTINUING_CARE_FILE, 'utf8');
    return coerceJson(JSON.parse(text));
  } catch {
    return {
      CONTINUING_CARE_PLACEMENT_STATS: [],
      RESIDENT_QUALITY_OUTCOMES: [],
      HOME_CARE_EXPERIENCE: [],
      CONTINUING_CARE_COMPLIANCE: [],
    };
  }
}

// ---- Main run -------------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CcCompliance] Starting Alberta Open Data compliance fetch');

  try {
    // 1. Discover the current XLSX resource URL via CKAN.
    const discovered = await discoverXlsxUrl();
    if (!discovered) {
      return {
        domain: 'continuing-care',
        pipeline: 'continuingCareComplianceFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'Could not discover XLSX resource URL from CKAN package_show API',
      };
    }
    console.log(`[CcCompliance] XLSX resource: ${discovered.url}`);

    // 2. Download the XLSX.
    let facilities: CareFacilityCompliance[] = [];
    try {
      const resp = await axios.get(discovered.url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
          Accept:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
        },
        timeout: 60000,
        maxContentLength: 20 * 1024 * 1024,
        maxRedirects: 5,
      });
      const buf = Buffer.from(resp.data as ArrayBuffer);
      console.log(`[CcCompliance] Downloaded ${buf.length} bytes; parsing...`);
      facilities = parseComplianceXlsx(buf);
      console.log(`[CcCompliance] Aggregated ${facilities.length} facilities from XLSX.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[CcCompliance] XLSX download/parse failed: ${msg}`);
      return {
        domain: 'continuing-care',
        pipeline: 'continuingCareComplianceFetcher',
        status: 'failed',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: `XLSX download/parse failed: ${msg}`,
      };
    }

    if (facilities.length === 0) {
      console.warn('[CcCompliance] No facilities parsed — leaving data file unchanged.');
      return {
        domain: 'continuing-care',
        pipeline: 'continuingCareComplianceFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No facility records extracted from XLSX',
      };
    }

    // 3. Merge into data-continuing-care.json, preserving sibling-owned arrays.
    const existing = loadExisting();
    const mergedMetadata = mergeDataMetadata(existing._dataMetadata, {
      CONTINUING_CARE_COMPLIANCE: buildMetadataEntry({
        updateType: 'auto',
        source: 'Alberta Open Government — Continuing Care Accommodation Standards compliance reporting',
        sourceVintage: `Dataset vintage: ${discovered.vintage}`,
        lastUpdated: timestamp,
        verification:
          'Aggregated from open.alberta.ca XLSX (OGL-A). Per-facility record collapsed from per-visit/per-standard rows; violationsCount counts only open/unresolved non-compliances.',
      }),
    });

    const merged: ContinuingCareJson = {
      ...existing,
      CONTINUING_CARE_COMPLIANCE: facilities,
      _dataMetadata: mergedMetadata,
    };

    applyWithheldPayloadGuard(merged as unknown as Record<string, unknown>);
    fs.writeFileSync(CONTINUING_CARE_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log(
      `[CcCompliance] Complete. wrote ${facilities.length} facilities in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'continuing-care',
      pipeline: 'continuingCareComplianceFetcher',
      status: 'success',
      recordsFetched: facilities.length,
      recordsWritten: facilities.length,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CcCompliance] FAILED:', errorMsg);
    return {
      domain: 'continuing-care',
      pipeline: 'continuingCareComplianceFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point: tsx src/pipelines/continuingCareComplianceFetcher.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  });
}
