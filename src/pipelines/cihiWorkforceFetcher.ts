// CIHI Workforce Fetcher
// Fetches health workforce data from CIHI's Health Workforce in Canada
// data tables (https://www.cihi.ca/en/health-workforce-canada).
//
// Downloads the "Health Workforce Quick Stats 2024 Data Tables" XLSX
// and parses physician, nurse, and allied health supply data.
//
// Writes to:
//   - data-workforce.json: PHYSICIAN_SUPPLY, NURSE_SUPPLY, ALLIED_HEALTH_SUPPLY
//
// Uses SheetJS (xlsx) for parsing — the file is ~1.6MB, well within SheetJS limits.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

const OUTPUT_FILE = path.join(process.cwd(), 'data-workforce.json');

const CIHI_WORKFORCE_XLSX_URL =
  'https://www.cihi.ca/sites/default/files/document/health-workforce-quickstats-2024-data-tables-en.xlsx';

const RATE_LIMIT_MS = 2000;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
// July 2024 population estimates (Statistics Canada) for per-100k allied supply rates.
const ALBERTA_POPULATION_2024 = 4_800_000;
const CANADA_POPULATION_2024 = 41_000_000;

function alliedRatePer100k(count: number | null, population: number): number | null {
  if (count == null || count <= 0 || population <= 0) return null;
  return round1((count / population) * 100_000);
}

interface LoadedJson {
  [key: string]: unknown;
}

function loadJsonFile(file: string): LoadedJson {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Download the CIHI workforce XLSX file
async function downloadWorkforceData(): Promise<Buffer | null> {
  try {
    const response = await axios.get<Buffer>(CIHI_WORKFORCE_XLSX_URL, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: { 'User-Agent': USER_AGENT },
      maxContentLength: 50 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CihiWorkforce] Download failed: ${msg}`);
    return null;
  }
}

// Parse the workforce XLSX using SheetJS
interface WorkforceData {
  physicians: Record<string, unknown>[];
  nurses: Record<string, unknown>[];
  allied: Record<string, unknown>[];
  nursingSupplyTrends: Record<string, unknown>[];
  workforceAgeProfile: Record<string, unknown>[];
  jobVacancyTrends: Record<string, unknown>[];
  alliedHealthSupply: Record<string, unknown>[];
}

// CIHI uses "—" (em dash) for suppressed/missing values, plus "X" and "F" flags.
// Treat all of these as "no number available".
function cihiNumber(value: unknown): number | null {
  const s = asString(value);
  if (s === '' || s === '—' || s === '–' || s === '-' || s === 'X' || s === 'F' || s === 'x' || s === 'f') {
    return null;
  }
  return asNumber(s);
}

// Read a sheet into row objects using row 2 as the header (row 1 is column numbers).
function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    range: 1, // skip row 1 (column-number row); row 2 becomes the header
  });
}

// Round to 1 decimal place for percentages.
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── NursProfileData → NURSING_SUPPLY_TRENDS_CIHI ──────────────────────────────
// Columns: provider, registration_location_code, workplace, data_year,
// female, male, unk_sex, age bands (25-29 … 70+, <25, age_unk),
// direct care, rural, urban, Total workforce.
//
// Output shape mirrors the hand-authored NURSING_SUPPLY_TRENDS:
//   { year, profession, activePermits, growthRatePct, vacancyRatePct,
//     directCarePct, ruralRemotePct }
//
// vacancyRatePct is joined from VacancyData (annual, Alberta) by year+profession.
const NURSE_PROFESSION_MAP: Record<string, string> = {
  'Registered nurses': 'Registered Nurse (RN)',
  'Licensed practical nurses': 'Licensed Practical Nurse (LPN)',
  'Nurse practitioners': 'Nurse Practitioner (NP)',
  'Registered psychiatric nurses': 'Registered Psychiatric Nurse (RPN)',
};

function parseNursingSupply(
  workbook: XLSX.WorkBook,
  vacancyByProf: Map<string, Map<string, { rate: number | null; count: number | null }>>,
): Record<string, unknown>[] {
  const rows = sheetRows(workbook, 'NursProfileData');
  const providerCol = 'provider - THIS TAB IS FOR NURSING ONLY';

  // Collect Alberta, "All places of work" rows keyed by profession→year.
  const byProf = new Map<string, Map<string, { total: number | null; directCare: number | null; rural: number | null }>>();

  for (const row of rows) {
    if (asString(row['registration_location_code']) !== 'Alberta') continue;
    if (asString(row['workplace']) !== 'All places of work') continue;
    const provider = asString(row[providerCol]);
    const profession = NURSE_PROFESSION_MAP[provider];
    if (!profession) continue;
    const year = asString(row['data_year']);
    if (!year) continue;
    const total = cihiNumber(row['Total workforce']);
    const directCare = cihiNumber(row['direct care']);
    const rural = cihiNumber(row['rural']);
    if (total === null) continue; // skip suppressed years (e.g. RN 2024)

    let yearMap = byProf.get(profession);
    if (!yearMap) { yearMap = new Map(); byProf.set(profession, yearMap); }
    yearMap.set(year, { total, directCare, rural });
  }

  const out: Record<string, unknown>[] = [];
  for (const [profession, yearMap] of byProf) {
    const years = [...yearMap.keys()].sort();
    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      const entry = yearMap.get(year)!;
      const prev = i > 0 ? yearMap.get(years[i - 1]) : undefined;
      const growthRatePct = prev && prev.total
        ? round1(((entry.total! - prev.total) / prev.total) * 100)
        : null;

      const vacMap = vacancyByProf.get(profession);
      const vac = vacMap?.get(year);
      const vacancyRatePct = vac?.rate != null ? round1(vac.rate * 100) : null;

      const directCarePct = entry.directCare != null && entry.total
        ? round1((entry.directCare / entry.total) * 100) : null;
      const ruralRemotePct = entry.rural != null && entry.total
        ? round1((entry.rural / entry.total) * 100) : null;

      out.push({
        year,
        profession,
        activePermits: entry.total,
        growthRatePct,
        vacancyRatePct,
        directCarePct,
        ruralRemotePct,
        source: 'CIHI Health Workforce Quick Stats 2024 (NursProfileData)',
      });
    }
  }
  return out;
}

// ── Phyprofile (+ NursProfileData + allied profile sheets) → WORKFORCE_AGE_PROFILE_CIHI
// Age bands: <25, 25-29, 30-34, 35-39, 40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70+
// Bins:  under35 = <25 + 25-29 + 30-34
//        age35to54 = 35-39 + 40-44 + 45-49 + 50-54
//        age55to64 = 55-59 + 60-64
//        over65 = 65-69 + 70+
// retirementRiskLevel derived from over55 share (age55to64 + over65):
//   <15% Low, 15–25% Moderate, 25–35% High, >35% Critical
function ageRiskLevel(over55Pct: number): 'Low' | 'Moderate' | 'High' | 'Critical' {
  if (over55Pct > 35) return 'Critical';
  if (over55Pct > 25) return 'High';
  if (over55Pct > 15) return 'Moderate';
  return 'Low';
}

function parseAgeProfile(
  workbook: XLSX.WorkBook,
  sheetName: string,
  providerCol: string,
  professionGroupMap: Record<string, string>,
  workplaceFilter: boolean,
): Record<string, unknown>[] {
  const rows = sheetRows(workbook, sheetName);
  // For each provider, pick the latest year with a usable total.
  const latestByProf = new Map<string, { year: string; total: number; bands: Record<string, number> }>();
  for (const row of rows) {
    if (asString(row['registration_location_code']) !== 'Alberta') continue;
    if (workplaceFilter && asString(row['workplace']) !== 'All places of work') continue;
    const provider = asString(row[providerCol]);
    const group = professionGroupMap[provider];
    if (!group) continue;
    const year = asString(row['data_year']);
    if (!year) continue;
    const total = cihiNumber(row['Number of Physicians'] ?? row['Total workforce']);
    if (total === null || total <= 0) continue;
    const existing = latestByProf.get(group);
    if (!existing || year > existing.year) {
      const bands: Record<string, number> = {};
      for (const b of ['<25', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65-69', '70+']) {
        bands[b] = cihiNumber(row[b]) ?? 0;
      }
      latestByProf.set(group, { year, total, bands });
    }
  }

  const out: Record<string, unknown>[] = [];
  for (const [group, entry] of latestByProf) {
    const t = entry.total;
    const under35 = entry.bands['<25'] + entry.bands['25-29'] + entry.bands['30-34'];
    const age35to54 = entry.bands['35-39'] + entry.bands['40-44'] + entry.bands['45-49'] + entry.bands['50-54'];
    const age55to64 = entry.bands['55-59'] + entry.bands['60-64'];
    const over65 = entry.bands['65-69'] + entry.bands['70+'];
    const over55 = age55to64 + over65;
    out.push({
      professionGroup: group,
      under35Pct: round1((under35 / t) * 100),
      age35to54Pct: round1((age35to54 / t) * 100),
      age55to64Pct: round1((age55to64 / t) * 100),
      over65Pct: round1((over65 / t) * 100),
      retirementRiskLevel: ageRiskLevel(round1((over55 / t) * 100)),
      dataYear: entry.year,
      source: `CIHI Health Workforce Quick Stats 2024 (${sheetName})`,
    });
  }
  return out;
}

// ── VacancyData → JOB_VACANCY_TRENDS_CIHI ─────────────────────────────────────
// Columns: Year, Province_Territory, Type_of_provider, Supply, Workforce,
// vacancies, vacancy_proportion, Year_over_year_change.
//
// Output shape mirrors JOB_VACANCY_TRENDS:
//   { quarter, sector, vacanciesCount, vacancyRatePct, avgOfferedHourlyWage }
// CIHI data is annual (no quarter); quarter is set to `${year}-Q4`.
// avgOfferedHourlyWage is not in the CIHI sheet → null (never zero-filled).
function parseVacancyTrends(workbook: XLSX.WorkBook): Record<string, unknown>[] {
  const rows = sheetRows(workbook, 'VacancyData');
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (asString(row['Province_Territory']) !== 'Alberta') continue;
    const year = asString(row['Year']);
    if (!year) continue;
    const vacancies = cihiNumber(row['vacancies']);
    if (vacancies === null) continue; // skip X/F/— rows; never invent a count
    const prop = cihiNumber(row['vacancy_proportion']);
    out.push({
      quarter: `${year}-Q4`,
      sector: asString(row['Type_of_provider']),
      vacanciesCount: vacancies,
      vacancyRatePct: prop != null ? round1(prop * 100) : null,
      avgOfferedHourlyWage: null,
      supply: cihiNumber(row['Supply']),
      workforce: cihiNumber(row['Workforce']),
      yearOverYearChange: cihiNumber(row['Year_over_year_change']),
      source: 'CIHI Health Workforce Quick Stats 2024 (VacancyData)',
    });
  }
  return out;
}

// Build a vacancy lookup: profession → year → { rate, count } for nursing join.
function buildVacancyLookup(workbook: XLSX.WorkBook): Map<string, Map<string, { rate: number | null; count: number | null }>> {
  const rows = sheetRows(workbook, 'VacancyData');
  const lookup = new Map<string, Map<string, { rate: number | null; count: number | null }>>();
  // Map VacancyData provider names to the NURSE_PROFESSION_MAP values.
  const vacProfMap: Record<string, string> = {
    'Registered nurses and registered psychiatric nurses*': 'Registered Nurse (RN)',
    'Licensed practical nurses': 'Licensed Practical Nurse (LPN)',
    'Nurse practitioners': 'Nurse Practitioner (NP)',
  };
  for (const row of rows) {
    if (asString(row['Province_Territory']) !== 'Alberta') continue;
    const provider = asString(row['Type_of_provider']);
    const profession = vacProfMap[provider];
    if (!profession) continue;
    const year = asString(row['Year']);
    if (!year) continue;
    const rate = cihiNumber(row['vacancy_proportion']);
    const count = cihiNumber(row['vacancies']);
    let m = lookup.get(profession);
    if (!m) { m = new Map(); lookup.set(profession, m); }
    m.set(year, { rate, count });
  }
  return lookup;
}

// ── PTProfileData / OTProfileData / PHProfileData + VacancyData → ALLIED_HEALTH_SUPPLY_CIHI
// Output shape mirrors ALLIED_HEALTH_SUPPLY:
//   { profession, albertaCount, nationalComparisonRatePer100k:{alberta,canadaAvg},
//     vacancyActivePostings }
// Per-100k rates use fixed 2024 Alberta/Canada population denominators (not in the XLSX).
function parseAlliedHealthSupply(workbook: XLSX.WorkBook): Record<string, unknown>[] {
  const vacRows = sheetRows(workbook, 'VacancyData');
  // Latest-year Alberta + Canada vacancies by provider type.
  const vacAB = new Map<string, { year: string; count: number | null }>();
  const vacCA = new Map<string, { year: string; supply: number | null; workforce: number | null }>();
  for (const row of vacRows) {
    const provider = asString(row['Type_of_provider']);
    const year = asString(row['Year']);
    if (!provider || !year) continue;
    if (asString(row['Province_Territory']) === 'Alberta') {
      const ex = vacAB.get(provider);
      if (!ex || year > ex.year) vacAB.set(provider, { year, count: cihiNumber(row['vacancies']) });
    } else if (asString(row['Province_Territory']) === 'Canada') {
      const ex = vacCA.get(provider);
      if (!ex || year > ex.year) vacCA.set(provider, { year, supply: cihiNumber(row['Supply']), workforce: cihiNumber(row['Workforce']) });
    }
  }

  const out: Record<string, unknown>[] = [];
  const sheets: { name: string; providerCol: string; profession: string }[] = [
    { name: 'PHProfileData', providerCol: 'provider', profession: 'Pharmacists' },
    { name: 'PTProfileData', providerCol: 'provider', profession: 'Physiotherapists' },
    { name: 'OTProfileData', providerCol: 'provider', profession: 'Occupational therapists' },
  ];

  for (const { name, providerCol, profession } of sheets) {
    const rows = sheetRows(workbook, name);
    let albertaCount: number | null = null;
    let albertaYear = '';
    for (const row of rows) {
      if (asString(row[providerCol]) !== profession) continue;
      if (asString(row['workplace']) !== 'All places of work') continue;
      const year = asString(row['data_year']);
      if (!year) continue;
      if (asString(row['registration_location_code']) === 'Alberta') {
        const wf = cihiNumber(row['Total workforce']);
        if (wf != null && wf > 0 && year > albertaYear) { albertaCount = wf; albertaYear = year; }
      }
    }
    // Canada supply from VacancyData (profile sheets have no Canada rows).
    const ca = vacCA.get(profession);
    const canadaCount = ca?.supply ?? null;

    // Skip professions with no measured Alberta supply — never invent counts.
    if (albertaCount == null || albertaCount <= 0) continue;
    const abVac = vacAB.get(profession);
    const albertaRate = alliedRatePer100k(albertaCount, ALBERTA_POPULATION_2024);
    const canadaRate = alliedRatePer100k(canadaCount, CANADA_POPULATION_2024);
    out.push({
      profession,
      albertaCount,
      albertaDataYear: albertaYear,
      canadaSupply: canadaCount,
      nationalComparisonRatePer100k: {
        alberta: albertaRate,
        canadaAvg: canadaRate,
      },
      // CIHI vacancy count when present; null when suppressed/missing (no zero-fill).
      vacancyActivePostings: abVac?.count ?? null,
      source: `CIHI Health Workforce Quick Stats 2024 (${name} + VacancyData)`,
    });
  }
  return out;
}

function parseWorkforceData(buffer: Buffer): WorkforceData {
  const result: WorkforceData = {
    physicians: [],
    nurses: [],
    allied: [],
    nursingSupplyTrends: [],
    workforceAgeProfile: [],
    jobVacancyTrends: [],
    alliedHealthSupply: [],
  };

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log(`[CihiWorkforce] Sheets: ${workbook.SheetNames.join(', ')}`);

    // The "Supply_WF_Flow" sheet has the main supply data with columns:
    // 1=ID, 2=Year, 3=Province/Territory, 4=Type of provider,
    // 5=Supply: number of providers, 6=Supply: inflow, 7=Supply: outflow,
    // 8=Supply: renewal, 9=Workforce: number of providers, 10=Inflow %, 11=Outflow %
    const supplySheet = workbook.Sheets['Supply_WF_Flow'];
    if (supplySheet) {
      const ref = supplySheet['!ref'];
      if (ref) {
        const decoded = XLSX.utils.decode_range(ref);
        if (decoded.e.c > 15) decoded.e.c = 15;
        supplySheet['!ref'] = XLSX.utils.encode_range(decoded);
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(supplySheet, {
        defval: '',
        raw: false,
      });

      // Skip the header row (row 0 has column names as values)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const year = asString(row['2']);
        const province = asString(row['3']);
        const providerType = asString(row['4']).toLowerCase();
        const supplyCount = asNumber(row['5']);
        const workforceCount = asNumber(row['9']);

        if (!province || !year || supplyCount === null) continue;

        // Filter to Alberta only
        if (!province.includes('Alberta') && province !== 'AB') continue;

        const record: Record<string, unknown> = {
          zone: 'Alberta',
          year,
          providerType: asString(row['4']),
          headcount: supplyCount,
          workforceCount: workforceCount ?? supplyCount,
          source: 'CIHI Health Workforce Quick Stats 2024',
        };

        // Categorize by provider type
        if (providerType.includes('physician') || providerType.includes('doctor')) {
          result.physicians.push(record);
        } else if (providerType.includes('nurse') || providerType.includes('rn') || providerType.includes('lpn') || providerType.includes('registered')) {
          result.nurses.push(record);
        } else if (
          providerType.includes('pharmacist') || providerType.includes('therapist') ||
          providerType.includes('psychologist') || providerType.includes('social work') ||
          providerType.includes('dietitian') || providerType.includes('allied')
        ) {
          result.allied.push(record);
        }
      }
    }

    // Phyprofile sheet for physician demographics (kept for PHYSICIAN_SUPPLY_CIHI).
    const phySheet = workbook.Sheets['Phyprofile'];
    if (phySheet) {
      // Note: no column truncation — the age-band columns (65-69, 70+, <25)
      // live in columns Q–T and are needed by parseAgeProfile below.
      const phyRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(phySheet, {
        defval: '',
        raw: false,
      });

      for (let i = 1; i < phyRows.length; i++) {
        const row = phyRows[i];
        const year = asString(row['4']);
        const numPhysicians = asNumber(row['5']);
        if (year && numPhysicians !== null) {
          result.physicians.push({
            zone: 'Alberta',
            year,
            providerType: 'Physician',
            headcount: numPhysicians,
            workforceCount: numPhysicians,
            source: 'CIHI Health Workforce Quick Stats 2024 (Phyprofile)',
            female: asNumber(row['6']) ?? 0,
            male: asNumber(row['7']) ?? 0,
          });
        }
      }
    }

    // ── New: parse the additional sheets for the Category 3 arrays ──
    const vacancyLookup = buildVacancyLookup(workbook);

    result.nursingSupplyTrends = parseNursingSupply(workbook, vacancyLookup);

    // Age profiles: physicians from Phyprofile, nursing from NursProfileData,
    // allied from PT/OT/PH profile sheets.
    result.workforceAgeProfile = [
      ...parseAgeProfile(workbook, 'Phyprofile', 'provider', {
        'All physicians': 'All Physicians',
        'Family medicine physicians': 'Family Physicians',
        'Specialists': 'Surgical Specialists',
      }, false),
      ...parseAgeProfile(workbook, 'NursProfileData', 'provider - THIS TAB IS FOR NURSING ONLY', {
        'Registered nurses': 'Registered Nurses (RN)',
        'Licensed practical nurses': 'LPNs & HCAs',
        'Nurse practitioners': 'Nurse Practitioners (NP)',
        'Registered psychiatric nurses': 'Registered Psychiatric Nurses (RPN)',
      }, true),
      ...parseAgeProfile(workbook, 'PTProfileData', 'provider', {
        'Physiotherapists': 'Physiotherapists',
      }, true),
      ...parseAgeProfile(workbook, 'OTProfileData', 'provider', {
        'Occupational therapists': 'Occupational Therapists',
      }, true),
      ...parseAgeProfile(workbook, 'PHProfileData', 'provider', {
        'Pharmacists': 'Pharmacists',
      }, true),
    ];

    result.jobVacancyTrends = parseVacancyTrends(workbook);
    result.alliedHealthSupply = parseAlliedHealthSupply(workbook);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[CihiWorkforce] XLSX parse failed: ${msg}`);
  }

  return result;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[CihiWorkforce] Starting CIHI workforce data fetch');

  try {
    console.log('[CihiWorkforce] Downloading workforce XLSX...');
    const buffer = await downloadWorkforceData();
    await new Promise<void>((resolve) => setTimeout(resolve, RATE_LIMIT_MS));

    if (!buffer) {
      console.warn('[CihiWorkforce] No data downloaded — leaving data files unchanged.');
      return {
        domain: 'workforce',
        pipeline: 'cihiWorkforceFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'CIHI workforce XLSX download failed',
      };
    }

    console.log(`[CihiWorkforce] Downloaded ${buffer.length} bytes. Parsing...`);
    const parsed = parseWorkforceData(buffer);
    const totalRecords =
      parsed.physicians.length + parsed.nurses.length + parsed.allied.length +
      parsed.nursingSupplyTrends.length + parsed.workforceAgeProfile.length +
      parsed.jobVacancyTrends.length + parsed.alliedHealthSupply.length;

    console.log(
      `[CihiWorkforce] Parsed: ${parsed.physicians.length} physicians, ${parsed.nurses.length} nurses, ${parsed.allied.length} allied (flow), ${parsed.nursingSupplyTrends.length} nursingSupply, ${parsed.workforceAgeProfile.length} ageProfile, ${parsed.jobVacancyTrends.length} vacancy, ${parsed.alliedHealthSupply.length} alliedSupply`,
    );

    if (totalRecords === 0) {
      console.warn('[CihiWorkforce] No records parsed — leaving data files unchanged.');
      return {
        domain: 'workforce',
        pipeline: 'cihiWorkforceFetcher',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'CIHI workforce XLSX parsing returned no records',
      };
    }

    // Merge into workforce file
    const existing = loadJsonFile(OUTPUT_FILE);
    const merged = { ...existing };

    if (parsed.physicians.length > 0) merged.PHYSICIAN_SUPPLY_CIHI = parsed.physicians;
    if (parsed.nurses.length > 0) merged.NURSE_SUPPLY_CIHI = parsed.nurses;
    // Supply_WF_Flow allied records (per-year headcount) → ALLIED_HEALTH_FLOW_CIHI
    if (parsed.allied.length > 0) merged.ALLIED_HEALTH_FLOW_CIHI = parsed.allied;
    // Profile-sheet allied supply (matches hand-authored ALLIED_HEALTH_SUPPLY shape)
    if (parsed.alliedHealthSupply.length > 0) merged.ALLIED_HEALTH_SUPPLY_CIHI = parsed.alliedHealthSupply;
    if (parsed.nursingSupplyTrends.length > 0) merged.NURSING_SUPPLY_TRENDS_CIHI = parsed.nursingSupplyTrends;
    if (parsed.workforceAgeProfile.length > 0) merged.WORKFORCE_AGE_PROFILE_CIHI = parsed.workforceAgeProfile;
    if (parsed.jobVacancyTrends.length > 0) merged.JOB_VACANCY_TRENDS_CIHI = parsed.jobVacancyTrends;
    // Never reintroduce scrubbed illustrative workforce panels via RMW.
    merged.NURSING_SUPPLY_TRENDS = [];
    merged.WORKFORCE_AGE_PROFILE = [];
    merged.SPECIALIST_RECRUITMENT_NEEDS = [];
    merged.ALLIED_HEALTH_SUPPLY = [];
    // Refresh _dataMetadata for the CIHI arrays this writer owns. Only arrays
    // actually refreshed this run are stamped; every other entry (sibling
    // writers' and hand-authored arrays) is preserved via mergeDataMetadata.
    const existingMeta = existing._dataMetadata as DataMetadata | undefined;
    const ownedMetadata: DataMetadata = {};
    if (parsed.physicians.length > 0) {
      ownedMetadata.PHYSICIAN_SUPPLY_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2015–2024',
        lastUpdated: timestamp,
      });
    }
    if (parsed.nurses.length > 0) {
      ownedMetadata.NURSE_SUPPLY_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2015–2024',
        lastUpdated: timestamp,
      });
    }
    if (parsed.allied.length > 0) {
      ownedMetadata.ALLIED_HEALTH_FLOW_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2015–2024',
        lastUpdated: timestamp,
      });
    }
    if (parsed.alliedHealthSupply.length > 0) {
      ownedMetadata.ALLIED_HEALTH_SUPPLY_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage:
          'Supply counts 2015–2024; rates per 100k use 2024 population denominators (AB 4.8M / CA 41.0M)',
        lastUpdated: timestamp,
      });
    }
    if (parsed.nursingSupplyTrends.length > 0) {
      ownedMetadata.NURSING_SUPPLY_TRENDS_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2015–2024',
        lastUpdated: timestamp,
      });
    }
    if (parsed.workforceAgeProfile.length > 0) {
      ownedMetadata.WORKFORCE_AGE_PROFILE_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2023–2024',
        lastUpdated: timestamp,
      });
    }
    if (parsed.jobVacancyTrends.length > 0) {
      ownedMetadata.JOB_VACANCY_TRENDS_CIHI = buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Health Workforce Quick Stats 2024',
        sourceVintage: '2015-Q4 to 2024-Q4',
        lastUpdated: timestamp,
      });
    }
    if (Object.keys(ownedMetadata).length > 0) {
      merged._dataMetadata = mergeDataMetadata(existingMeta, ownedMetadata);
    }

    applyWithheldPayloadGuard(merged);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    console.log(
      `[CihiWorkforce] Complete. fetched=${totalRecords} written=${totalRecords} in ${Date.now() - startTime}ms`,
    );
    return {
      domain: 'workforce',
      pipeline: 'cihiWorkforceFetcher',
      status: 'success',
      recordsFetched: totalRecords,
      recordsWritten: totalRecords,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CihiWorkforce] FAILED:', errorMsg);
    return {
      domain: 'workforce',
      pipeline: 'cihiWorkforceFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// CLI entry point
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
