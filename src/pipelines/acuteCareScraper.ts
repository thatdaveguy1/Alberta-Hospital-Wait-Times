// Acute Care Capacity Scraper
// Refreshes data-system-flow.json from live sources:
//   - Facility list (name/city/zone/type): AHS public wait-times JSON API
//   - CIHI comparators (Alberta vs Canada): derived from data-diagnostic.json
//     + data-cancer.json (populated by cihiWaitTimesDownloader)
//   - Regional LGA demand: derived from data-regional-inequity.json
//     (populated by openAlbertaInequityFetcher)
//
// Facility-level flow metrics (occupancy, ALC, LWBS, bed wait, ICU) are NOT
// published by AHS in scrapeable form. Do NOT preserve hand-authored estimates —
// identity fields only; numeric metrics stay empty until a verified HQCA FOCUS
// feed is wired. Historical quarterly timelines are never invented here.
// The weekly ED LOS PDF parse is handled by ahsWeeklyEdLosScraper.ts.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import type {
  FacilityFlow,
  WeeklyEDLOS,
  CIHIComparator,
  LGADemand,
  HistoricalFlowSnapshot,
} from '../systemFlowData';
import type { DataMetadata } from './metadataHelpers';
import { buildMetadataEntry, mergeDataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

// ---- Configuration --------------------------------------------------------

const AHS_JSON_URL = 'https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en';
const SYSTEM_FLOW_FILE = path.join(process.cwd(), 'data-system-flow.json');
const DIAGNOSTIC_FILE = path.join(process.cwd(), 'data-diagnostic.json');
const CANCER_FILE = path.join(process.cwd(), 'data-cancer.json');
const REGIONAL_INEQUITY_FILE = path.join(process.cwd(), 'data-regional-inequity.json');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ---- Types ----------------------------------------------------------------

interface SystemFlowJson {
  FACILITY_FLOW_METRICS: FacilityFlow[];
  AHS_WEEKLY_ED_LOS: WeeklyEDLOS[];
  CIHI_COMPARATORS: CIHIComparator[];
  REGIONAL_LGA_DEMAND: LGADemand[];
  HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[];
  _dataMetadata?: DataMetadata;
}

type AlbertaZone = 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';

// ---- Helpers --------------------------------------------------------------

function loadSystemFlow(): SystemFlowJson {
  try {
    const raw = fs.readFileSync(SYSTEM_FLOW_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SystemFlowJson>;
    return {
      FACILITY_FLOW_METRICS: parsed.FACILITY_FLOW_METRICS ?? [],
      AHS_WEEKLY_ED_LOS: parsed.AHS_WEEKLY_ED_LOS ?? [],
      CIHI_COMPARATORS: parsed.CIHI_COMPARATORS ?? [],
      REGIONAL_LGA_DEMAND: parsed.REGIONAL_LGA_DEMAND ?? [],
      // Never seed hand-authored historical estimates from disk or *Data.ts.
      HISTORICAL_FLOW_TIMELINES: [],
      _dataMetadata: parsed._dataMetadata,
    };
  } catch {
    return {
      FACILITY_FLOW_METRICS: [],
      AHS_WEEKLY_ED_LOS: [],
      CIHI_COMPARATORS: [],
      REGIONAL_LGA_DEMAND: [],
      HISTORICAL_FLOW_TIMELINES: [],
    };
  }
}

function loadJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function makeFacilityId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function deduceZoneFromKey(key: string): AlbertaZone {
  if (key === 'RedDeer') return 'Central Zone';
  if (key === 'Lethbridge' || key === 'MedicineHat') return 'South Zone';
  if (key === 'GrandePrairie' || key === 'FortMcMurray') return 'North Zone';
  return 'Calgary Zone'; // Calgary + Edmonton keys map below
}

function deduceZoneFromCity(city: string): AlbertaZone {
  const c = city.toLowerCase();
  if (c.includes('calgary') || c.includes('airdrie') || c.includes('cochrane') || c.includes('okotoks')) return 'Calgary Zone';
  if (c.includes('edmonton') || c.includes('st. albert') || c.includes('sherwood park') || c.includes('leduc') || c.includes('devon') || c.includes('stony plain') || c.includes('fort saskatchewan')) return 'Edmonton Zone';
  if (c.includes('red deer') || c.includes('innisfail') || c.includes('lacombe') || c.includes('wetaskiwin')) return 'Central Zone';
  if (c.includes('lethbridge') || c.includes('medicine hat') || c.includes('brooks')) return 'South Zone';
  if (c.includes('grande prairie') || c.includes('fort mcmurray') || c.includes('westlock')) return 'North Zone';
  return 'North Zone';
}

function deduceFacilityType(name: string): FacilityFlow['type'] {
  const lower = name.toLowerCase();
  if (lower.includes("children") || lower.includes('stollery')) return 'Childrens';
  if (lower.includes('foothills') || lower.includes('university') || lower.includes('royal alexandra') || lower.includes('peter lougheed') || lower.includes('rockyview') || lower.includes('south health') || lower.includes('grey nuns') || lower.includes('misericordia')) return 'Metro';
  if (lower.includes('regional') || lower.includes('fort mcmurray') || lower.includes('grande prairie') || lower.includes('medicine hat') || lower.includes('lethbridge') || lower.includes('red deer')) return 'Regional';
  return 'Community';
}

function deduceCityFromAddress(address: string, fallbackKey: string): string {
  const a = address.toLowerCase();
  if (a.includes('calgary')) return 'Calgary';
  if (a.includes('edmonton')) return 'Edmonton';
  if (a.includes('red deer')) return 'Red Deer';
  if (a.includes('lethbridge')) return 'Lethbridge';
  if (a.includes('medicine hat')) return 'Medicine Hat';
  if (a.includes('grande prairie')) return 'Grande Prairie';
  if (a.includes('fort mcmurray')) return 'Fort McMurray';
  if (a.includes('st. albert')) return 'St. Albert';
  if (a.includes('sherwood park')) return 'Sherwood Park';
  if (a.includes('leduc')) return 'Leduc';
  if (a.includes('fort saskatchewan')) return 'Fort Saskatchewan';
  if (a.includes('stony plain')) return 'Stony Plain';
  if (a.includes('airdrie')) return 'Airdrie';
  if (a.includes('cochrane')) return 'Cochrane';
  if (a.includes('okotoks')) return 'Okotoks';
  if (a.includes('devon')) return 'Devon';
  if (a.includes('innisfail')) return 'Innisfail';
  if (a.includes('lacombe')) return 'Lacombe';
  // Fallback: word before "Alberta"
  const parts = address.split(' ');
  const abIndex = parts.indexOf('Alberta');
  if (abIndex > 0) return parts[abIndex - 1];
  return fallbackKey.replace(/([A-Z])/g, ' $1').trim();
}

function cleanHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/\[;\].*/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

// ---- Facility list refresh (AHS JSON API) ---------------------------------

interface AhsFacility {
  Name?: string;
  Address?: string;
  Category?: string;
  Emergency?: unknown[];
  Urgent?: unknown[];
}

async function fetchFacilityList(): Promise<
  { id: string; name: string; city: string; zone: AlbertaZone; type: FacilityFlow['type'] }[]
> {
  const response = await axios.get(AHS_JSON_URL, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 15000,
  });
  const data = response.data as Record<string, AhsFacility>;
  const found: { id: string; name: string; city: string; zone: AlbertaZone; type: FacilityFlow['type'] }[] = [];
  const seen = new Set<string>();

  for (const key of Object.keys(data)) {
    const zoneData = data[key];
    if (!zoneData) continue;
    const zone: AlbertaZone = key === 'Edmonton' ? 'Edmonton Zone' : deduceZoneFromKey(key);
    const combined = [...(zoneData.Emergency ?? []), ...(zoneData.Urgent ?? [])] as AhsFacility[];

    for (const fac of combined) {
      const name = cleanHtmlEntities(fac.Name ?? '');
      if (!name) continue;
      const id = makeFacilityId(name);
      if (seen.has(id)) continue;
      seen.add(id);
      const address = cleanHtmlEntities(fac.Address ?? '');
      const city = deduceCityFromAddress(address, key);
      found.push({
        id,
        name,
        city,
        zone: city !== key.replace(/([A-Z])/g, ' $1').trim() ? deduceZoneFromCity(city) : zone,
        type: deduceFacilityType(name),
      });
    }
  }

  return found;
}

const NAME_ALIASES: Record<string, string> = {
  'fortsaskcommunityhospital': 'fortsaskatchewancommunityhospital',
  'fortsask': 'fortsaskatchewan',
};

function normalizeName(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\s+/g, '');
  return NAME_ALIASES[base] ?? base;
}

function emptyFacilityMetrics(
  id: string,
  name: string,
  city: string,
  zone: AlbertaZone,
  type: FacilityFlow['type'],
): FacilityFlow {
  return {
    id,
    name,
    city,
    zone,
    type,
    edDailyVolume: 0,
    lwbsRate: 0,
    medianLosDischarged: 0,
    p90LosDischarged: 0,
    medianLosAdmitted: 0,
    p90LosAdmitted: 0,
    medianBedWait: 0,
    p90BedWait: 0,
    avgHourlyAdmittedWaiting: 0,
    hospitalOccupancy: 0,
    alcRate: 0,
    continuingCare30DayPlacements: 0,
    staffedAcuteBeds: 0,
    icuBedsOpen: 0,
    icuOccupancy: 0,
    returnedWithin72h: 0,
  };
}

function mergeFacilityFlow(
  existing: FacilityFlow[],
  scraped: { id: string; name: string; city: string; zone: AlbertaZone; type: FacilityFlow['type'] }[],
): FacilityFlow[] {
  // Identity-only: never preserve hand-authored occupancy/ALC/LOS metrics.
  // Prefer stable facilityId from a prior row when the same site is rematched.
  const prevIdByNorm = new Map<string, string>();
  for (const f of existing) prevIdByNorm.set(normalizeName(f.name), f.id);

  const byNormName = new Map<string, FacilityFlow>();
  for (const s of scraped) {
    const norm = normalizeName(s.name);
    const stableId = prevIdByNorm.get(norm) ?? s.id;
    byNormName.set(norm, emptyFacilityMetrics(stableId, s.name, s.city, s.zone, s.type));
  }
  return Array.from(byNormName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---- CIHI comparators writer (from diagnostic + cancer JSON) --------------

interface ImagingWaitTrend {
  year: string;
  modality: string;
  albertaP50Days: number;
  albertaP90Days: number;
  canadaP50Days: number;
  canadaP90Days: number;
}

interface CancerSurgeryWaitTrend {
  cancerType: string;
  year: string;
  albertaP50Days: number;
  albertaP90Days: number;
  canadaP50Days: number;
  canadaP90Days: number;
  volume: number;
}

interface RadiationTherapyCompliance {
  year: string;
  albertaPctWithinBenchmark: number;
  canadaPctWithinBenchmark: number;
  albertaP50WaitDays: number;
  albertaP90WaitDays: number;
}

function buildCihiComparators(): { comparators: CIHIComparator[]; years: string[] } {
  const comparators: CIHIComparator[] = [];
  const years: string[] = [];

  const diagnostic = loadJson<Record<string, unknown>>(DIAGNOSTIC_FILE);
  if (diagnostic) {
    const imaging = (diagnostic.IMAGING_WAIT_TRENDS as ImagingWaitTrend[] | undefined) ?? [];
    // Use the most recent year for CT and MRI P90
    for (const modality of ['CT Scan', 'MRI Scan']) {
      const rows = imaging.filter(r => r.modality === modality).sort((a, b) => b.year.localeCompare(a.year));
      const latest = rows[0];
      if (latest) {
        comparators.push({
          metric: `${modality} Wait (90th percentile)`,
          albertaValue: latest.albertaP90Days,
          canadaValue: latest.canadaP90Days,
          unit: 'days',
          description: `Days that 90% of patients wait for a ${modality} in Alberta vs the Canadian average (CIHI Wait Times, ${latest.year}).`,
        });
        years.push(latest.year);
      }
    }
  }

  const cancer = loadJson<Record<string, unknown>>(CANCER_FILE);
  if (cancer) {
    const surgery = (cancer.CANCER_SURGERY_WAIT_TRENDS as CancerSurgeryWaitTrend[] | undefined) ?? [];
    // Blend all cancer types for the most recent year
    const byYear = new Map<string, CancerSurgeryWaitTrend[]>();
    for (const r of surgery) {
      const arr = byYear.get(r.year) ?? [];
      arr.push(r);
      byYear.set(r.year, arr);
    }
    const sortedSurgeryYears = Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a));
    const latestYear = sortedSurgeryYears[0];
    const latestRows = byYear.get(latestYear) ?? [];
    if (latestRows.length > 0) {
      const avgAlberta = latestRows.reduce((s, r) => s + r.albertaP90Days, 0) / latestRows.length;
      const avgCanada = latestRows.reduce((s, r) => s + r.canadaP90Days, 0) / latestRows.length;
      comparators.push({
        metric: 'Cancer Surgery Wait (90th percentile, blended)',
        albertaValue: parseFloat(avgAlberta.toFixed(1)),
        canadaValue: parseFloat(avgCanada.toFixed(1)),
        unit: 'days',
        description: `Blended 90th-percentile wait days across cancer surgery types in Alberta vs Canada (CIHI, ${latestYear}).`,
      });
      years.push(latestYear);
    }

    const radiation = (cancer.RADIATION_THERAPY_WAIT_TRENDS as RadiationTherapyCompliance[] | undefined) ?? [];
    const latestRad = radiation.sort((a, b) => b.year.localeCompare(a.year))[0];
    if (latestRad) {
      comparators.push({
        metric: 'Radiation Therapy Within Benchmark (28 days)',
        albertaValue: latestRad.albertaPctWithinBenchmark,
        canadaValue: latestRad.canadaPctWithinBenchmark,
        unit: 'percent',
        description: `Percentage of radiation therapy patients treated within the 28-day benchmark (CIHI, ${latestRad.year}).`,
      });
      years.push(latestRad.year);
    }
  }

  const uniqueYears = Array.from(new Set(years)).sort();
  return { comparators, years: uniqueYears };
}

// ---- Regional LGA demand writer (from regional-inequity JSON) -------------

interface EdRelianceMetric {
  lgaName: string;
  totalEdVisitsPer1000: number;
  lowAcuityCtas45Pct: number;
  afterHoursEdPct: number;
  moodAnxietyEdRatePer100k: number;
}

interface CommunityNeedProfile {
  lgaName: string;
  zone: string;
  type: string;
  physiciansPer100k: number;
  population?: number;
}

function buildRegionalLgaDemand(): LGADemand[] {
  const ri = loadJson<Record<string, unknown>>(REGIONAL_INEQUITY_FILE);
  if (!ri) return [];

  const edReliance = (ri.ED_RELIANCE_METRICS as EdRelianceMetric[] | undefined) ?? [];
  const needProfiles = (ri.COMMUNITY_NEED_PROFILES as CommunityNeedProfile[] | undefined) ?? [];
  const needByLga = new Map(needProfiles.map(p => [p.lgaName, p]));

  // Build a normalized name → population lookup for fuzzy matching of composite
  // LGA names (e.g. "South rural (Lethbridge/Cardston area)") that don't appear
  // verbatim in the population source. Strips parenthetical descriptors and
  // attempts prefix matching against the population map.
  const popByLga = new Map<string, number>();
  for (const p of needProfiles) {
    if (p.population && p.population > 0) popByLga.set(p.lgaName, p.population);
  }
  const popByNormName = new Map<string, number>();
  for (const [name, pop] of popByLga) {
    popByNormName.set(name.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim(), pop);
  }
  function lookupPopulation(lgaName: string): number {
    if (popByLga.has(lgaName)) return popByLga.get(lgaName)!;
    const base = lgaName.toLowerCase().replace(/\s*\([^)]*\)\s*/g, '').trim();
    if (popByNormName.has(base)) return popByNormName.get(base)!;
    // Prefix match for composite names. When the normalized query is a prefix
    // of multiple entries (e.g. "edmonton - woodcroft" matches both
    // "edmonton - woodcroft west" and "edmonton - woodcroft east"), sum the
    // populations of all matching sub-areas to get the combined total.
    const prefixMatches: number[] = [];
    for (const [normName, pop] of popByNormName) {
      if (normName.startsWith(base)) prefixMatches.push(pop);
      else if (base.startsWith(normName)) return pop;
    }
    if (prefixMatches.length > 0) return prefixMatches.reduce((a, b) => a + b, 0);
    return 0;
  }

  const candidates = edReliance.map(ed => {
    const profile = needByLga.get(ed.lgaName);
    const zone = profile?.zone ?? 'North Zone';
    const population = lookupPopulation(ed.lgaName);
    const annualEdVisits = population > 0
      ? Math.round((ed.totalEdVisitsPer1000 * population) / 1000)
      : 0;
    const lowAcuity = ed.lowAcuityCtas45Pct;
    return {
      lgaName: ed.lgaName,
      zone,
      population,
      annualEdVisits,
      edVisitsPer1000: ed.totalEdVisitsPer1000,
      ctas1_2_Pct: 0,
      ctas3_Pct: parseFloat(Math.max(0, 100 - lowAcuity).toFixed(1)),
      ctas4_5_Pct: lowAcuity,
      topDiagnosis: 'See Regional Inequity dashboard for full profile',
    };
  });

  // Pick one representative LGA per zone — the highest ED-visit-rate per 1000
  const zones: AlbertaZone[] = ['Calgary Zone', 'Edmonton Zone', 'Central Zone', 'South Zone', 'North Zone'];
  const picked: LGADemand[] = [];
  for (const zone of zones) {
    const inZone = candidates.filter(c => c.zone === zone);
    if (inZone.length === 0) continue;
    inZone.sort((a, b) => b.edVisitsPer1000 - a.edVisitsPer1000);
    const best = inZone[0];
    if (best) {
      picked.push({
        lgaName: best.lgaName,
        zone: best.zone,
        population: best.population,
        annualEdVisits: best.annualEdVisits,
        edVisitsPer1000: best.edVisitsPer1000,
        ctas1_2_Pct: best.ctas1_2_Pct,
        ctas3_Pct: best.ctas3_Pct,
        ctas4_5_Pct: best.ctas4_5_Pct,
        topDiagnosis: best.topDiagnosis,
      });
    }
  }

  return picked;
}


// ---- Main pipeline --------------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AcuteCareScraper] Starting acute care capacity refresh...');

  let recordsFetched = 0;
  let updated = false;
  const errors: string[] = [];
  let cihiYears: string[] = [];

  const data = loadSystemFlow();

  // --- Facility list refresh from AHS JSON API ---
  try {
    console.log('[AcuteCareScraper] Fetching facility list from AHS JSON API...');
    const facilities = await fetchFacilityList();
    if (facilities.length > 0) {
      data.FACILITY_FLOW_METRICS = mergeFacilityFlow(data.FACILITY_FLOW_METRICS, facilities);
      updated = true;
      recordsFetched += facilities.length;
      console.log(`[AcuteCareScraper] Refreshed ${facilities.length} facilities from live API.`);
    } else {
      console.log('[AcuteCareScraper] AHS JSON API returned no facilities.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`facility-list: ${msg}`);
    console.error('[AcuteCareScraper] Facility list fetch failed:', msg);
  }

  // --- CIHI comparators (derived from diagnostic + cancer JSON) ---
  try {
    const { comparators, years } = buildCihiComparators();
    cihiYears = years;
    if (comparators.length > 0) {
      data.CIHI_COMPARATORS = comparators;
      updated = true;
      recordsFetched += comparators.length;
      console.log(`[AcuteCareScraper] Built ${comparators.length} CIHI comparators.`);
    } else {
      console.log('[AcuteCareScraper] No CIHI comparator data available.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`cihi-comparators: ${msg}`);
    console.error('[AcuteCareScraper] CIHI comparators build failed:', msg);
  }

  // --- Regional LGA demand (derived from regional-inequity JSON) ---
  try {
    const lgaDemand = buildRegionalLgaDemand();
    if (lgaDemand.length > 0) {
      data.REGIONAL_LGA_DEMAND = lgaDemand;
      updated = true;
      recordsFetched += lgaDemand.length;
      console.log(`[AcuteCareScraper] Built ${lgaDemand.length} LGA demand profiles.`);
    } else {
      console.log('[AcuteCareScraper] No LGA demand data available.');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`lga-demand: ${msg}`);
    console.error('[AcuteCareScraper] LGA demand build failed:', msg);
  }

  // --- Metadata ---
  if (updated) {
    const ri = loadJson<Record<string, unknown>>(REGIONAL_INEQUITY_FILE);
    const meta = (ri?._dataMetadata ?? {}) as Record<string, unknown>;
    const regionalEntry = meta.COMMUNITY_NEED_PROFILES as { sourceVintage?: string } | undefined;
    const regionalVintage = regionalEntry?.sourceVintage;
    const regionalSourceVintage =
      regionalVintage && !regionalVintage.toLowerCase().startsWith('latest')
        ? regionalVintage
        : '2022 Open Alberta Community Profiles, biennial';
    const ownedMetadata: DataMetadata = {
      FACILITY_FLOW_METRICS: buildMetadataEntry({
        updateType: 'auto',
        source: 'AHS public wait-times API (facility identity only)',
        sourceVintage: 'Live AHS facility list; no facility-level occupancy/ALC feed',
        verification:
          'Names/cities/zones refreshed from AHS API only. Occupancy, ALC, LWBS, bed wait, and ICU metrics are intentionally empty — prior hand-authored estimates are not preserved.',
      }),
      CIHI_COMPARATORS: buildMetadataEntry({
        updateType: 'auto',
        source: 'CIHI Wait Times Priority Procedures (imaging + cancer series via diagnostic/cancer JSON)',
        sourceVintage: cihiYears.length > 0 ? `${cihiYears.join(', ')} (CIHI priority-procedure comparator years; annual)` : 'No CIHI priority-procedure comparator years available',
        verification:
          'Derived only from IMAGING_WAIT_TRENDS, CANCER_SURGERY_WAIT_TRENDS, and RADIATION_THERAPY_WAIT_TRENDS. Not NACRS bed/ALC indicators.',
      }),
      REGIONAL_LGA_DEMAND: buildMetadataEntry({
        updateType: 'auto',
        source: 'Open Alberta CKAN LGA community profiles: Table 10.1 (ED visit rates) + Figure 2.2 (population)',
        sourceVintage: regionalSourceVintage,
        verification: 'Derived from data-regional-inequity.json populated by openAlbertaInequityFetcher (Table 10.1 + Figure 2.2).',
      }),
    };
    data._dataMetadata = mergeDataMetadata(data._dataMetadata, ownedMetadata);
    // Drop hand-authored historical estimates from the payload.
    data.HISTORICAL_FLOW_TIMELINES = [];
  }

  // --- Write file ---
  let recordsWritten = 0;
  if (updated) {
    try {
      applyWithheldPayloadGuard(data as unknown as Record<string, unknown>);
      fs.writeFileSync(SYSTEM_FLOW_FILE, JSON.stringify(data, null, 2), 'utf8');
      recordsWritten =
        data.FACILITY_FLOW_METRICS.length +
        data.AHS_WEEKLY_ED_LOS.length +
        data.CIHI_COMPARATORS.length +
        data.REGIONAL_LGA_DEMAND.length +
        data.HISTORICAL_FLOW_TIMELINES.length;
      console.log(`[AcuteCareScraper] Wrote data-system-flow.json (${recordsWritten} total records).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`write: ${msg}`);
      console.error('[AcuteCareScraper] Failed to write system flow JSON:', msg);
    }
  }

  const durationMs = Date.now() - startTime;

  let status: SyncResult['status'];
  if (errors.length > 0 && recordsFetched > 0) {
    status = 'partial';
  } else if (errors.length > 0 && recordsFetched === 0) {
    status = 'failed';
  } else if (recordsFetched === 0) {
    status = 'skipped';
  } else {
    status = 'success';
  }

  console.log(
    `[AcuteCareScraper] Complete. status=${status} fetched=${recordsFetched} written=${recordsWritten} ${durationMs}ms`,
  );

  return {
    domain: 'system-flow',
    pipeline: 'acuteCareScraper',
    status,
    recordsFetched,
    recordsWritten,
    durationMs,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    timestamp,
  };
}

// CLI entry point: tsx src/pipelines/acuteCareScraper.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'failed' ? 1 : 0);
  }).catch((err) => {
    console.error('[AcuteCareScraper] Unhandled error:', err);
    process.exit(1);
  });
}
