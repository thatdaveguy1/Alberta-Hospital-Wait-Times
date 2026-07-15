// Open Alberta CKAN Inequity Fetcher Pipeline
// Downloads LGA-level community profile XLSX tables published on Open Alberta
// (Table 10.1 Community Need + Figure 4.2 Chronic Disease) and pivots them into
// the COMMUNITY_NEED_PROFILES, CHRONIC_DISEASE_BURDEN, and ED_RELIANCE_METRICS
// datasets, merging into data-regional-inequity.json while preserving the
// TRAVEL_FOR_CARE and SERVICE_ACCESS_METRICS arrays.
//
// The Open Alberta workbooks are published in a tidy/long layout (one row per
// LGA × indicator), so the parser pivots by LOCAL_NAME and extracts the LGA
// Value for each indicator of interest. Indicators not present in the source
// (e.g. medianHouseholdIncome, highSchoolGradPct, infantMortalityPer1000) are
// preserved from the existing curated record for that LGA so a refresh never
// clobbers hand-curated fields with zeros. All failures are caught and
// returned as SyncResult — run() never throws.

import axios from 'axios';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';
import type {
  CommunityNeedMetric,
  ChronicDiseaseBurden,
  EDRelianceMetric,
} from '../regionalInequityData';

const CKAN_PACKAGE_SHOW_BASE = 'https://open.alberta.ca/api/3/action/package_show?id=';

const TABLE_10_1_PACKAGE_ID = '28492ab1-7912-4ad1-8988-c666bee26c33';
const FIGURE_4_2_PACKAGE_ID = 'fd9674ed-e672-4ffa-bb63-9d9a9ce13fe5';
const FIGURE_2_2_PACKAGE_ID = '34236eee-06a6-49aa-a328-71dcfafc6fc1';

// Fallback download URLs when CKAN package_show is unavailable.
const TABLE_10_1_FALLBACK_URL =
  'https://open.alberta.ca/dataset/28492ab1-7912-4ad1-8988-c666bee26c33/resource/178a681a-ade5-494d-a09a-509ba1b65548/download/table-10.1.xlsx';
const FIGURE_4_2_FALLBACK_URL =
  'https://open.alberta.ca/dataset/fd9674ed-e672-4ffa-bb63-9d9a9ce13fe5/resource/2f1e0166-322f-476b-b0bb-f774dcdec080/download/figure-4.2.xlsx';
const FIGURE_2_2_FALLBACK_URL =
  'https://open.alberta.ca/dataset/34236eee-06a6-49aa-a328-71dcfafc6fc1/resource/2280f78f-d253-453b-95ac-7952118727f4/download/figure-2.2.xlsx';

const INEQUITY_FILE = path.join(process.cwd(), 'data-regional-inequity.json');
const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

type Zone = CommunityNeedMetric['zone'];
type LgaType = CommunityNeedMetric['type'];

// Indicator labels we match against in Table 10.1. Matched case-insensitively
// by substring so minor year-to-year wording changes don't break the pivot.
const INDICATOR_VOLUME_FP = 'volume of family physicians';
const INDICATOR_TRAVEL_CLAIMS = 'travel';
const INDICATOR_CLAIMS_OUTSIDE = 'outside home lga';
const INDICATOR_ACSC = 'ambulatory care sensitive conditions';
const INDICATOR_DEPRIVATION = 'deprivation index';
const INDICATOR_LIFE_EXPECTANCY = 'life expectancy';
const INDICATOR_MOOD_ANXIETY = 'mood and anxiety';

// Chronic disease indicator fragments matched in Figure 4.2.
const INDICATOR_DIABETES = 'diabetes';
const INDICATOR_COPD = 'copd';
const INDICATOR_HYPERTENSION = 'hypertension';

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    if (cleaned === '' || cleaned === '-' || cleaned === '.') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Derive an AHS zone from an LGA name. Falls back to 'Central Zone' when no
// signal is present (central is the most demographically average zone).
function deriveZone(lgaName: string): Zone {
  const n = normalizeLabel(lgaName);
  
  if (n.includes('twin brooks')) return 'Edmonton Zone';
  if (n.includes('calgary')) return 'Calgary Zone';
  if (n.includes('edmonton')) return 'Edmonton Zone';
  
  const calgaryTowns = ['okotoks', 'priddis', 'black diamond', 'high river', 'chestermere', 'strathmore', 'crossfield', 'didsbury', 'cochrane', 'springbank', 'canmore', 'banff'];
  const edmontonTowns = ['sturgeon', 'beaumont', 'thorsby', 'devon', 'leduc', 'sherwood', 'st. albert', 'spruce grove', 'stony plain', 'lamont', 'morinville', 'fort saskatchewan'];
  const southTowns = ['claresholm', 'vulcan', 'crowsnest', 'pincher', 'macleod', 'cardston', 'kainai', 'lethbridge', 'taber', 'warner', 'forty mile', 'newell', 'oyen', 'cypress', 'medicine hat', 'milk river', 'bow island', 'raymond', 'vauxhall', 'brooks'];
  const centralTowns = ['drayton valley', 'sundre', 'innisfail', 'wetaskiwin', 'ponoka', 'lacombe', 'camrose', 'tofield', 'flagstaff', 'red deer', 'olds', 'stettler', 'drumheller', 'sylvan', 'rocky mountain', 'rimbey', 'three hills', 'coronation', 'hardisty', 'consort', 'wainwright', 'vermilion', 'provost', 'hanna', 'special area 2'];
  const northTowns = [
    'mayerthorpe', 'westlock', 'barrhead', 'athabasca', 'boyle', 'smoky lake', 'cold lake', 'bonnyville', 'lac la biche', 'st. paul', 'two hills', 'vegreville', 'minburn', 'viking', 'edson', 'hinton', 'jasper', 'whitecourt', 'grande prairie', 'wood buffalo', 'fort mcmurray', 'mckay', 'high level', 'high prairie', 'slave lake', 'grimshaw', 'berwyn', 'peace', 'fairview', 'fort vermilion', 'la crete', 'beaverlodge', 'elk point', 'wabasca', 'red earth', 'valleyview', 'peace river', 'manning', 'fort chipewyan', 'falcon', 'spirit river', 'frog lake', 'grande cache', 'fox creek', 'falher', 'swan hills'
  ];

  for (const town of calgaryTowns) {
    if (n.includes(town)) return 'Calgary Zone';
  }
  for (const town of edmontonTowns) {
    if (n.includes(town)) return 'Edmonton Zone';
  }
  for (const town of southTowns) {
    if (n.includes(town)) return 'South Zone';
  }
  for (const town of centralTowns) {
    if (n.includes(town)) return 'Central Zone';
  }
  for (const town of northTowns) {
    if (n.includes(town)) return 'North Zone';
  }

  try {
    const zoneByCityPath = path.join(process.cwd(), 'data-zone-by-city.json');
    if (fs.existsSync(zoneByCityPath)) {
      const zoneByCity = JSON.parse(fs.readFileSync(zoneByCityPath, 'utf8'));
      for (const [city, zone] of Object.entries(zoneByCity)) {
        if (n.includes(city.toLowerCase())) {
          return zone as Zone;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return 'Central Zone';
}

// Derive a community type from an LGA name. Conservative: only flags obvious
// rural/remote signals; otherwise defaults to 'Urban Hub' per the spec.
function deriveType(lgaName: string): LgaType {
  const n = normalizeLabel(lgaName);
  if (n.includes('fort mckay') || n.includes('remote') || n.includes('indigenous') || n.includes('reserve') || n.includes('wood buffalo')) {
    return 'Remote / Indigenous';
  }
  if (n.includes('rural') || n.includes('county') || n.includes('municipal district')) {
    return 'Rural';
  }
  if (n.includes('suburban') || n.includes('west bow') || n.includes('sherwood') || n.includes('st. albert') || n.includes('spruce grove')) {
    return 'Suburban';
  }
  return 'Urban Hub';
}

interface CkanResource {
  url: string;
  format: string;
  name: string;
}

// Resolve the live XLSX download URL for a community-profile dataset via CKAN
// package_show. Matches resources whose download path ends with the expected
// workbook filename (e.g. table-10.1.xlsx).
async function discoverXlsxByFilename(
  packageId: string,
  filenameSuffix: string,
  fallbackUrl: string,
): Promise<string> {
  try {
    const resp = await axios.get(`${CKAN_PACKAGE_SHOW_BASE}${packageId}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
      },
      timeout: 30000,
    });
    const pkg = resp.data?.result;
    if (!pkg || !Array.isArray(pkg.resources)) return fallbackUrl;
    const suffix = filenameSuffix.toLowerCase();
    const match = (pkg.resources as CkanResource[]).find((r) => {
      if (r.format?.toUpperCase() !== 'XLSX') return false;
      const url = (r.url ?? '').toLowerCase();
      return url.endsWith(suffix) || url.includes(`/download/${suffix}`);
    });
    if (match?.url) return match.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OpenAlbertaInequity] CKAN package_show (${packageId}): ${msg}`);
  }
  return fallbackUrl;
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    headers: {
      'User-Agent': 'AlbertaHospitals-Pipeline/1.0 (data sync)',
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*',
    },
    maxRedirects: 5,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return Buffer.from(res.data as Uint8Array);
}

// Read a worksheet into a 2D array of cell values (first row = row 1).
function sheetToRows(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: null,
    blankrows: false,
  });
}

// Parse an in-memory XLSX buffer into a SheetJS workbook. Uses `XLSX.read`
// with type 'buffer' so we never touch the filesystem — avoids temp-file
// roundtrips and the `readFile` path that is unavailable in some ESM bundles.
function parseWorkbook(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'buffer' });
}

interface ColumnMap {
  localName: number;
  indicator: number;
  lgaValue: number;
}

// Locate the columns we need by scanning the first ~40 rows for a header row
// that carries LOCAL_NAME, Indicator, and an LGA Value column. Returns the
// header row index and a column map, or null if no header is found.
function findHeaderRow(rows: unknown[][]): { headerRow: number; columns: ColumnMap } | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r];
    if (!row) continue;
    const norm = row.map((c) => normalizeLabel(asString(c) ?? ''));
    let localName = -1;
    let indicator = -1;
    let lgaValue = -1;
    for (let i = 0; i < norm.length; i++) {
      const label = norm[i];
      if (label === '') continue;
      if (localName === -1 && (label === 'local_name' || label === 'local name' || label === 'lga' || label === 'local_geographic_area' || label === 'community')) {
        localName = i;
      }
      if (indicator === -1 && (label === 'indicator' || label === 'indicator_name' || label === 'measure' || label === 'metric')) {
        indicator = i;
      }
      if (lgaValue === -1 && (label === 'lga value' || label === 'lga_value' || label === 'value' || label === 'local value' || label === 'lga')) {
        lgaValue = i;
      }
    }
    if (localName !== -1 && indicator !== -1 && lgaValue !== -1) {
      return { headerRow: r, columns: { localName, indicator, lgaValue } };
    }
  }
  return null;
}

interface PivotedLga {
  lgaName: string;
  indicators: Map<string, number>;
}

// Pivot a tidy Table 10.1 / Figure 4.2 sheet into a map keyed by LGA name,
// where each entry carries the set of indicator values found for that LGA.
function pivotSheet(rows: unknown[][]): Map<string, PivotedLga> {
  const header = findHeaderRow(rows);
  if (!header) return new Map();
  const { headerRow, columns } = header;
  const byLga = new Map<string, PivotedLga>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    let name = asString(row[columns.localName]);
    const indicator = asString(row[columns.indicator]);
    const value = asNumber(row[columns.lgaValue]);
    if (!name || !indicator || value === undefined) continue;
    if (name === "Edmonton - Woodcroft") {
      name = "Edmonton - Woodcroft (North Central)";
    } else if (name === "Edmonton - Woodcroft East") {
      name = "Edmonton - Woodcroft East (North Central)";
    } else if (name === "Edmonton - Woodcroft West") {
      name = "Edmonton - Woodcroft West (North Central)";
    }
    let entry = byLga.get(name);
    if (!entry) {
      entry = { lgaName: name, indicators: new Map<string, number>() };
      byLga.set(name, entry);
    }
    // First occurrence wins; later duplicates for the same indicator are
    // ignored to avoid sub-rows (e.g. confidence intervals) overwriting the
    // headline value.
    const key = normalizeLabel(indicator);
    if (!entry.indicators.has(key)) {
      entry.indicators.set(key, value);
    }
  }
  return byLga;
}

// Pick the first indicator key in the pivoted map whose normalized label
// contains every fragment (case/space-insensitive substring match).
function pickIndicator(indicators: Map<string, number>, fragments: string[]): number | undefined {
  for (const [key, value] of indicators) {
    const n = normalizeLabel(key);
    if (fragments.every((f) => n.includes(f))) return value;
  }
  return undefined;
}

// Parse a Figure 2.2 population workbook (tidy layout: LOCAL CODE, LOCAL NAME,
// Fiscal Year, LGA Population, Alberta Population) into a map of LGA name →
// population for the latest available fiscal year. Applies the same Woodcroft
// rename convention as pivotSheet so names align with COMMUNITY_NEED_PROFILES.
function parsePopulationSheet(rows: unknown[][]): Map<string, number> {
  // Find the header row carrying LOCAL NAME and Fiscal Year.
  let headerRow = -1;
  let nameCol = -1;
  let yearCol = -1;
  let popCol = -1;
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const label = normalizeLabel(String(row[c] ?? ''));
      if (label.includes('local name')) nameCol = c;
      if (label.includes('fiscal year')) yearCol = c;
      if (label.includes('lga population')) popCol = c;
    }
    if (nameCol >= 0 && yearCol >= 0 && popCol >= 0) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return new Map();

  // Determine the latest fiscal year present in the data.
  let latestYear = '';
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const year = asString(row[yearCol]);
    if (year && year > latestYear) latestYear = year;
  }
  if (!latestYear) return new Map();

  const byLga = new Map<string, number>();
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const year = asString(row[yearCol]);
    if (year !== latestYear) continue;
    let name = asString(row[nameCol]);
    const pop = asNumber(row[popCol]);
    if (!name || pop === undefined || pop <= 0) continue;
    // Apply the same rename convention as pivotSheet.
    if (name === 'Edmonton - Woodcroft') {
      name = 'Edmonton - Woodcroft (North Central)';
    } else if (name === 'Edmonton - Woodcroft East') {
      name = 'Edmonton - Woodcroft East (North Central)';
    } else if (name === 'Edmonton - Woodcroft West') {
      name = 'Edmonton - Woodcroft West (North Central)';
    }
    byLga.set(name, Math.round(pop));
  }
  return byLga;
}

interface LoadedJson {
  [key: string]: unknown;
}

function loadJsonFile(file: string): LoadedJson {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LoadedJson;
    }
  } catch {
    /* file missing or invalid — start empty */
  }
  return {};
}

function asRecordArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => typeof v === 'object' && v !== null) as T[];
}

// Merge new records into an existing array keyed by lgaName. Existing records
// supply defaults for fields the source does not provide (medianHouseholdIncome,
// highSchoolGradPct, infantMortalityPer1000, totalEdVisitsPer1000, etc.), and
// the new record's defined fields override them. LGAs only in the existing
// array are preserved; LGAs only in the new data are appended.
function mergeByLga<T extends { lgaName: string }>(
  existing: T[],
  fresh: T[],
): T[] {
  const byName = new Map<string, T>();
  for (const rec of existing) byName.set(rec.lgaName, rec);
  for (const rec of fresh) {
    const prev = byName.get(rec.lgaName);
    if (!prev) {
      byName.set(rec.lgaName, rec);
      continue;
    }
    const merged: Record<string, unknown> = { ...prev };
    for (const [key, value] of Object.entries(rec)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      merged[key] = value;
    }
    byName.set(rec.lgaName, merged as unknown as T);
  }
  return Array.from(byName.values());
}

// Build COMMUNITY_NEED_PROFILES records from the pivoted Table 10.1 data,
// preserving zone/type/income/graduation from existing records when present.
function buildCommunityNeed(
  pivoted: Map<string, PivotedLga>,
  existing: CommunityNeedMetric[],
  populationByLga?: Map<string, number>,
): CommunityNeedMetric[] {
  const existingByName = new Map<string, CommunityNeedMetric>();
  for (const rec of existing) existingByName.set(rec.lgaName, rec);
  const out: CommunityNeedMetric[] = [];
  for (const [, entry] of pivoted) {
    const { lgaName, indicators } = entry;
    const fpPer1000 = pickIndicator(indicators, [INDICATOR_VOLUME_FP]);
    const travelPct = pickIndicator(indicators, [INDICATOR_TRAVEL_CLAIMS, INDICATOR_CLAIMS_OUTSIDE]) ??
      pickIndicator(indicators, [INDICATOR_CLAIMS_OUTSIDE]);
    const acsc = pickIndicator(indicators, [INDICATOR_ACSC]);
    const deprivation = pickIndicator(indicators, [INDICATOR_DEPRIVATION]);
    // Only emit a record if at least one community-need indicator was found.
    if (fpPer1000 === undefined && travelPct === undefined && acsc === undefined && deprivation === undefined) {
      continue;
    }
    const prev = existingByName.get(lgaName);
    const physiciansPer100k = fpPer1000 !== undefined ? fpPer1000 * 100 : prev?.physiciansPer100k ?? 0;
    out.push({
      lgaName,
      zone: prev?.zone ?? deriveZone(lgaName),
      type: prev?.type ?? deriveType(lgaName),
      physiciansPer100k,
      claimsOutsideLgaPct: travelPct ?? prev?.claimsOutsideLgaPct ?? 0,
      acscRatePer100k: acsc ?? prev?.acscRatePer100k ?? 0,
      deprivationIndex: deprivation ?? prev?.deprivationIndex ?? 0,
      medianHouseholdIncome: prev?.medianHouseholdIncome ?? 0,
      highSchoolGradPct: prev?.highSchoolGradPct ?? 0,
      population: populationByLga?.get(lgaName) ?? prev?.population,
    });
  }
  return out;
}

// Build CHRONIC_DISEASE_BURDEN records from Figure 4.2 + the life-expectancy
// indicator in Table 10.1. infantMortalityPer1000 is preserved from existing.
function buildChronicDisease(
  chronicPivoted: Map<string, PivotedLga>,
  needPivoted: Map<string, PivotedLga>,
  existing: ChronicDiseaseBurden[],
): ChronicDiseaseBurden[] {
  const existingByName = new Map<string, ChronicDiseaseBurden>();
  for (const rec of existing) existingByName.set(rec.lgaName, rec);
  // Collect every LGA name appearing in either source.
  const lgaNames = new Set<string>();
  for (const name of chronicPivoted.keys()) lgaNames.add(name);
  for (const name of needPivoted.keys()) lgaNames.add(name);
  const out: ChronicDiseaseBurden[] = [];
  for (const lgaName of lgaNames) {
    const chronic = chronicPivoted.get(lgaName)?.indicators;
    const need = needPivoted.get(lgaName)?.indicators;
    const diabetes = chronic ? pickIndicator(chronic, [INDICATOR_DIABETES]) : undefined;
    const copd = chronic ? pickIndicator(chronic, [INDICATOR_COPD]) : undefined;
    const hypertension = chronic ? pickIndicator(chronic, [INDICATOR_HYPERTENSION]) : undefined;
    const lifeExp = need ? pickIndicator(need, [INDICATOR_LIFE_EXPECTANCY]) : undefined;
    // Only emit if at least one chronic-disease or life-expectancy value exists.
    if (diabetes === undefined && copd === undefined && hypertension === undefined && lifeExp === undefined) {
      continue;
    }
    const prev = existingByName.get(lgaName);
    out.push({
      lgaName,
      diabetesPrevalencePct: diabetes ?? prev?.diabetesPrevalencePct ?? 0,
      copdPrevalencePct: copd ?? prev?.copdPrevalencePct ?? 0,
      hypertensionPrevalencePct: hypertension ?? prev?.hypertensionPrevalencePct ?? 0,
      infantMortalityPer1000: prev?.infantMortalityPer1000 ?? 0,
      lifeExpectancyYears: lifeExp ?? prev?.lifeExpectancyYears ?? 0,
    });
  }
  return out;
}

// Build ED_RELIANCE_METRICS from the mood/anxiety ED-visit indicator in
// Table 10.1. The other ED-reliance fields are preserved from existing.
function buildEdReliance(
  needPivoted: Map<string, PivotedLga>,
  existing: EDRelianceMetric[],
): EDRelianceMetric[] {
  const existingByName = new Map<string, EDRelianceMetric>();
  for (const rec of existing) existingByName.set(rec.lgaName, rec);
  const out: EDRelianceMetric[] = [];
  for (const [, entry] of needPivoted) {
    const { lgaName, indicators } = entry;
    const moodAnxiety = pickIndicator(indicators, [INDICATOR_MOOD_ANXIETY]);
    if (moodAnxiety === undefined) continue;
    const prev = existingByName.get(lgaName);
    out.push({
      lgaName,
      totalEdVisitsPer1000: prev?.totalEdVisitsPer1000 ?? 0,
      lowAcuityCtas45Pct: prev?.lowAcuityCtas45Pct ?? 0,
      afterHoursEdPct: prev?.afterHoursEdPct ?? 0,
      moodAnxietyEdRatePer100k: moodAnxiety,
    });
  }
  return out;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[OpenAlbertaInequity] Starting LGA community profile download + parse');

  try {
    // 1. Download Table 10.1 (Community Need).
    let table101Buffer: Buffer | null = null;
    try {
      const table101Url = await discoverXlsxByFilename(
        TABLE_10_1_PACKAGE_ID,
        'table-10.1.xlsx',
        TABLE_10_1_FALLBACK_URL,
      );
      console.log(`[OpenAlbertaInequity] Downloading Table 10.1: ${table101Url}`);
      table101Buffer = await downloadBuffer(table101Url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAlbertaInequity] Table 10.1 download failed: ${msg}`);
    }

    // 2. Rate-limit before the second request.
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    // 3. Download Figure 4.2 (Chronic Disease).
    let figure42Buffer: Buffer | null = null;
    try {
      const figure42Url = await discoverXlsxByFilename(
        FIGURE_4_2_PACKAGE_ID,
        'figure-4.2.xlsx',
        FIGURE_4_2_FALLBACK_URL,
      );
      console.log(`[OpenAlbertaInequity] Downloading Figure 4.2: ${figure42Url}`);
      figure42Buffer = await downloadBuffer(figure42Url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAlbertaInequity] Figure 4.2 download failed: ${msg}`);
    }

    // 4. Rate-limit before the third request.
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    // 5. Download Figure 2.2 (LGA Population).
    let figure22Buffer: Buffer | null = null;
    try {
      const figure22Url = await discoverXlsxByFilename(
        FIGURE_2_2_PACKAGE_ID,
        'figure-2.2.xlsx',
        FIGURE_2_2_FALLBACK_URL,
      );
      console.log(`[OpenAlbertaInequity] Downloading Figure 2.2: ${figure22Url}`);
      figure22Buffer = await downloadBuffer(figure22Url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenAlbertaInequity] Figure 2.2 download failed: ${msg}`);
    }
    if (!table101Buffer && !figure42Buffer) {
      console.warn('[OpenAlbertaInequity] Both sources unavailable — skipping.');
      return {
        domain: 'regional-inequity',
        pipeline: 'openAlbertaInequityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'Both Open Alberta XLSX sources unavailable',
      };
    }

    // 4. Parse workbooks and pivot by LGA.
    let needPivoted = new Map<string, PivotedLga>();
    let chronicPivoted = new Map<string, PivotedLga>();

    if (table101Buffer) {
      try {
        const workbook = parseWorkbook(table101Buffer);
        // Table 10.1 may carry multiple sheets; scan all of them and merge
        // pivoted LGAs so supplemental sheets (e.g. a notes tab) don't drop
        // data. First occurrence of an LGA+indicator wins.
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows = sheetToRows(sheet);
          const pivoted = pivotSheet(rows);
          if (pivoted.size === 0) continue;
          if (needPivoted.size === 0) {
            needPivoted = pivoted;
          } else {
            for (const [name, entry] of pivoted) {
              if (!needPivoted.has(name)) needPivoted.set(name, entry);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenAlbertaInequity] Table 10.1 parse failed: ${msg}`);
      }
    }

    if (figure42Buffer) {
      try {
        const workbook = parseWorkbook(figure42Buffer);
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows = sheetToRows(sheet);
          const pivoted = pivotSheet(rows);
          if (pivoted.size === 0) continue;
          if (chronicPivoted.size === 0) {
            chronicPivoted = pivoted;
          } else {
            for (const [name, entry] of pivoted) {
              if (!chronicPivoted.has(name)) chronicPivoted.set(name, entry);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenAlbertaInequity] Figure 4.2 parse failed: ${msg}`);
      }
    }

    // Parse Figure 2.2 population data if downloaded.
    let populationByLga = new Map<string, number>();
    if (figure22Buffer) {
      try {
        const workbook = parseWorkbook(figure22Buffer);
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;
          const rows = sheetToRows(sheet);
          const popMap = parsePopulationSheet(rows);
          if (popMap.size > 0) {
            populationByLga = popMap;
            break;
          }
        }
        console.log(`[OpenAlbertaInequity] Parsed ${populationByLga.size} LGA populations from Figure 2.2.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[OpenAlbertaInequity] Figure 2.2 parse failed: ${msg}`);
      }
    }

    if (needPivoted.size === 0 && chronicPivoted.size === 0) {
      console.warn('[OpenAlbertaInequity] No LGA rows parsed from either workbook — leaving data file unchanged.');
      return {
        domain: 'regional-inequity',
        pipeline: 'openAlbertaInequityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No LGA rows matched the expected tidy layout',
      };
    }

    // 5. Load existing JSON so we can preserve curated fields and other arrays.
    const existingJson = loadJsonFile(INEQUITY_FILE);
    const existingCommunityNeed = asRecordArray<CommunityNeedMetric>(existingJson['COMMUNITY_NEED_PROFILES']);
    const existingChronicDisease = asRecordArray<ChronicDiseaseBurden>(existingJson['CHRONIC_DISEASE_BURDEN']);
    const existingEdReliance = asRecordArray<EDRelianceMetric>(existingJson['ED_RELIANCE_METRICS']);

    const freshCommunityNeed = buildCommunityNeed(needPivoted, existingCommunityNeed, populationByLga);
    const freshChronicDisease = buildChronicDisease(chronicPivoted, needPivoted, existingChronicDisease);
    const freshEdReliance = buildEdReliance(needPivoted, existingEdReliance);

    const recordsFetched =
      freshCommunityNeed.length + freshChronicDisease.length + freshEdReliance.length;

    if (recordsFetched === 0) {
      console.warn('[OpenAlbertaInequity] No target records produced — leaving data file unchanged.');
      return {
        domain: 'regional-inequity',
        pipeline: 'openAlbertaInequityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No records matched the three target shapes',
      };
    }

    // 6. Per-LGA merge: preserve existing fields the source cannot supply, and
    // preserve TRAVEL_FOR_CARE / SERVICE_ACCESS_METRICS untouched.
    const mergedCommunityNeed = mergeByLga(existingCommunityNeed, freshCommunityNeed);
    const mergedChronicDisease = mergeByLga(existingChronicDisease, freshChronicDisease);
    const mergedEdReliance = mergeByLga(existingEdReliance, freshEdReliance);

    const merged: LoadedJson = {
      COMMUNITY_NEED_PROFILES: mergedCommunityNeed,
      CHRONIC_DISEASE_BURDEN: mergedChronicDisease,
      ED_RELIANCE_METRICS: mergedEdReliance,
    };
    // Preserve any other arrays already in the file (TRAVEL_FOR_CARE,
    // SERVICE_ACCESS_METRICS, and anything added later).
    for (const [key, value] of Object.entries(existingJson)) {
      if (merged[key] === undefined) merged[key] = value;
    }

    // Refresh _dataMetadata for the three arrays this fetcher owns; preserve
    // any sibling entries (e.g. TRAVEL_FOR_CARE, SERVICE_ACCESS_METRICS) via
    // mergeDataMetadata so a read-modify-write never strips them.
    const ownedMetadata: DataMetadata = {
      COMMUNITY_NEED_PROFILES: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta CKAN LGA community profiles (Table 10.1)',
        sourceVintage: 'Latest Open Alberta Table 10.1 release',
        lastUpdated: timestamp,
      }),
      CHRONIC_DISEASE_BURDEN: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta CKAN chronic disease indicators (Figure 4.2 + Table 10.1)',
        sourceVintage: 'Latest Open Alberta Figure 4.2 release',
        lastUpdated: timestamp,
      }),
      ED_RELIANCE_METRICS: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta CKAN LGA community profiles (Table 10.1 mood/anxiety)',
        sourceVintage: 'Latest Open Alberta Table 10.1 release',
        lastUpdated: timestamp,
      }),
    };
    merged._dataMetadata = mergeDataMetadata(
      existingJson['_dataMetadata'] as DataMetadata | undefined,
      ownedMetadata,
    );

    fs.writeFileSync(INEQUITY_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    const recordsWritten =
      mergedCommunityNeed.length + mergedChronicDisease.length + mergedEdReliance.length;

    const status: SyncResult['status'] = recordsWritten > 0 ? 'success' : 'skipped';
    console.log(
      `[OpenAlbertaInequity] Complete. fetched=${recordsFetched} written=${recordsWritten} in ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'regional-inequity',
      pipeline: 'openAlbertaInequityFetcher',
      status,
      recordsFetched,
      recordsWritten,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAlbertaInequity] FAILED:', errorMsg);
    return {
      domain: 'regional-inequity',
      pipeline: 'openAlbertaInequityFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

const PRIMARY_CARE_FILE = path.join(process.cwd(), 'data-primary-care.json');

// Primary Care domain: derive LGA_COMMUNITY_NEEDS from the COMMUNITY_NEED_PROFILES
// already written to data-regional-inequity.json. Maps the regional-inequity fields
// to the primary-care subset, preserving existing population/socioeconomic fields.
export async function runPrimaryCare(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[OpenAlbertaInequity] Starting primary-care LGA community needs derivation');

  try {
    // Load the regional inequity data (written by run())
    const inequityJson = loadJsonFile(INEQUITY_FILE);
    const communityNeed = asRecordArray<CommunityNeedMetric>(inequityJson['COMMUNITY_NEED_PROFILES']);
    if (communityNeed.length === 0) {
      console.warn('[OpenAlbertaInequity] No COMMUNITY_NEED_PROFILES in regional-inequity data — skipping primary-care derivation.');
      return {
        domain: 'primary-care',
        pipeline: 'openAlbertaInequityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No COMMUNITY_NEED_PROFILES to derive from',
      };
    }

    // Load existing primary-care data to preserve LGA_COMMUNITY_NEEDS fields
    // the source cannot supply (population, fcscRatePer100k, etc.)
    const pcJson = loadJsonFile(PRIMARY_CARE_FILE);
    const existingLgaNeeds = asRecordArray<{
      lgaName: string;
      zone: string;
      population: number;
      familyPhysiciansPer100k: number;
      pctClaimsOutsideLGA: number;
      acscHospitalizationRatePer100k: number;
      fcscRatePer100k: number;
      moodAnxietyEdRatePer100k: number;
      substanceAbuseEdRatePer100k: number;
      socioeconomicRiskIndex: string;
    }>(pcJson['LGA_COMMUNITY_NEEDS']);

    const existingByName = new Map<string, typeof existingLgaNeeds[number]>();
    for (const rec of existingLgaNeeds) existingByName.set(rec.lgaName, rec);

    // Derive LGA_COMMUNITY_NEEDS from COMMUNITY_NEED_PROFILES
    // Only include LGAs that already exist in the hand-authored subset (curated 9 LGAs)
    const fresh = communityNeed
      .filter(c => existingByName.has(c.lgaName))
      .map(c => {
        const prev = existingByName.get(c.lgaName);
        return {
          lgaName: c.lgaName,
          zone: c.zone,
          population: prev?.population ?? 0,
          familyPhysiciansPer100k: c.physiciansPer100k,
          pctClaimsOutsideLGA: c.claimsOutsideLgaPct,
          acscHospitalizationRatePer100k: c.acscRatePer100k,
          fcscRatePer100k: prev?.fcscRatePer100k ?? 0,
          moodAnxietyEdRatePer100k: prev?.moodAnxietyEdRatePer100k ?? 0,
          substanceAbuseEdRatePer100k: prev?.substanceAbuseEdRatePer100k ?? 0,
          socioeconomicRiskIndex: prev?.socioeconomicRiskIndex ?? 'Moderate',
        };
      });

    if (fresh.length === 0) {
      console.warn('[OpenAlbertaInequity] No LGA_COMMUNITY_NEEDS records derived — leaving data-primary-care.json unchanged.');
      return {
        domain: 'primary-care',
        pipeline: 'openAlbertaInequityFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No matching LGAs between COMMUNITY_NEED_PROFILES and existing LGA_COMMUNITY_NEEDS',
      };
    }

    // Merge: preserve all other arrays in data-primary-care.json
    const merged: LoadedJson = { ...pcJson, LGA_COMMUNITY_NEEDS: fresh };
    // Refresh _dataMetadata for LGA_COMMUNITY_NEEDS; preserve all sibling
    // entries (albertaFindAProviderScraper, hand-authored PCN_CAPACITY, etc.)
    // via mergeDataMetadata so a read-modify-write never strips them.
    const ownedMetadata: DataMetadata = {
      LGA_COMMUNITY_NEEDS: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta CKAN LGA community profiles (derived from regional-inequity)',
        sourceVintage: 'Latest Open Alberta release',
        lastUpdated: timestamp,
      }),
    };
    merged._dataMetadata = mergeDataMetadata(
      pcJson['_dataMetadata'] as DataMetadata | undefined,
      ownedMetadata,
    );

    fs.writeFileSync(PRIMARY_CARE_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    console.log(
      `[OpenAlbertaInequity] Primary-care complete. written=${fresh.length} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'primary-care',
      pipeline: 'openAlbertaInequityFetcher',
      status: 'success',
      recordsFetched: communityNeed.length,
      recordsWritten: fresh.length,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAlbertaInequity] Primary-care FAILED:', errorMsg);
    return {
      domain: 'primary-care',
      pipeline: 'openAlbertaInequityFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point: tsx src/pipelines/openAlbertaInequityFetcher.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'success' ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
