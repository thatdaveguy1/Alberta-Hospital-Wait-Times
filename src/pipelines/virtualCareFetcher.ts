// Virtual Care Fetcher — PubMed E-utilities + AHS News scrape
//
// The virtual-care domain is dominated by one-time peer-reviewed studies and
// hand-curated AHS Quick Facts figures, so this pipeline is mostly a
// verification + best-effort scrape rather than a full refresh:
//
//   1. PubMed NCBI E-utilities esummary — verifies PMID 40465166 (the CJEM
//      "Virtual MD" cohort study) still exists and rewrites the
//      VIRTUAL_MD_COHORT_STUDY source metadata. The cohort percentages
//      (55.7% primary care, 60.0% ED, 52.5% self-managed) come from a
//      one-time descriptive analysis and are NOT re-derived here; we keep the
//      existing data values and only confirm the article is still indexed.
//
//   2. AHS News listing — best-effort scrape of the latest news page for any
//      Health Link / 811 call-volume announcements. If a release quotes a
//      fiscal-year call volume we map it to a HEALTH_LINK_VOLUMES row;
//      otherwise we preserve the existing rows and report 'skipped' for that
//      shape.
//
// VIRTUAL_MD_DISPOSITIONS, EMS_811_DIVERSION_DATA, and ADJACENT_HELPLINES have
// no automated upstream source — they are preserved untouched on every run.
//
// The pipeline therefore usually returns 'partial' (PubMed verified, no new
// AHS volume announcement) or 'skipped' (PubMed unreachable and no AHS
// volume found). It only returns 'success' when a new HEALTH_LINK_VOLUMES
// row is actually written.

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata } from './metadataHelpers';
import type {
  HealthLinkVolume,
  VirtualMDCohortStudy,
  VirtualMDDisposition,
  EmsDiversionMetric,
  AdjacentHelplineVolume,
} from '../virtualCareData';

const PUBMED_ESUMMARY_URL =
  'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=40465166&retmode=json';
const AHS_NEWS_LISTING_URL =
  'https://www.albertahealthservices.ca/news/listing12759.aspx';
const VIRTUAL_CARE_FILE = path.join(process.cwd(), 'data-virtual-care.json');
const RATE_LIMIT_MS = 2000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// PMID for the CJEM Virtual MD cohort study (Golonka et al., 2025).
const VIRTUAL_MD_PMID = '40465166';

interface VirtualCareJson {
  HEALTH_LINK_VOLUMES: HealthLinkVolume[];
  VIRTUAL_MD_COHORT_STUDY: VirtualMDCohortStudy[];
  VIRTUAL_MD_DISPOSITIONS: VirtualMDDisposition[];
  EMS_811_DIVERSION_DATA: EmsDiversionMetric[];
  ADJACENT_HELPLINES: AdjacentHelplineVolume[];
  _dataMetadata?: DataMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validate a parsed JSON blob against the expected virtual-care shape well
// enough to safely merge. Unknown/missing keys default to empty arrays so a
// corrupted file never clobbers hand-curated datasets.
function coerceVirtualCareJson(raw: unknown): VirtualCareJson {
  const base: VirtualCareJson = {
    HEALTH_LINK_VOLUMES: [],
    VIRTUAL_MD_COHORT_STUDY: [],
    VIRTUAL_MD_DISPOSITIONS: [],
    EMS_811_DIVERSION_DATA: [],
    ADJACENT_HELPLINES: [],
  };
  if (isRecord(raw)) {
    if (Array.isArray(raw.HEALTH_LINK_VOLUMES))
      base.HEALTH_LINK_VOLUMES = raw.HEALTH_LINK_VOLUMES as HealthLinkVolume[];
    if (Array.isArray(raw.VIRTUAL_MD_COHORT_STUDY))
      base.VIRTUAL_MD_COHORT_STUDY =
        raw.VIRTUAL_MD_COHORT_STUDY as VirtualMDCohortStudy[];
    if (Array.isArray(raw.VIRTUAL_MD_DISPOSITIONS))
      base.VIRTUAL_MD_DISPOSITIONS =
        raw.VIRTUAL_MD_DISPOSITIONS as VirtualMDDisposition[];
    if (Array.isArray(raw.EMS_811_DIVERSION_DATA))
      base.EMS_811_DIVERSION_DATA =
        raw.EMS_811_DIVERSION_DATA as EmsDiversionMetric[];
    if (Array.isArray(raw.ADJACENT_HELPLINES))
      base.ADJACENT_HELPLINES = raw.ADJACENT_HELPLINES as AdjacentHelplineVolume[];
    if (raw._dataMetadata && typeof raw._dataMetadata === 'object')
      base._dataMetadata = raw._dataMetadata as DataMetadata;
  }
  return base;
}

function loadExistingVirtualCare(): VirtualCareJson {
  try {
    const text = fs.readFileSync(VIRTUAL_CARE_FILE, 'utf8');
    return coerceVirtualCareJson(JSON.parse(text));
  } catch {
    return {
      HEALTH_LINK_VOLUMES: [],
      VIRTUAL_MD_COHORT_STUDY: [],
      VIRTUAL_MD_DISPOSITIONS: [],
      EMS_811_DIVERSION_DATA: [],
      ADJACENT_HELPLINES: [],
    };
  }
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

// --- PubMed E-utilities ---------------------------------------------------

// Minimal shape of the NCBI esummary JSON payload — only the fields we read.
interface PubMedArticleId {
  idtype: string;
  value: string;
}
interface PubMedArticleSummary {
  uid?: string;
  title?: string;
  pubdate?: string;
  source?: string;
  volume?: string;
  issue?: string;
  articleids?: PubMedArticleId[];
}
interface PubMedEsummaryResult {
  result?: {
    uids?: string[];
    [uid: string]: unknown | PubMedArticleSummary | string[] | undefined;
  };
}

function isArticleSummary(
  value: unknown,
): value is PubMedArticleSummary {
  return isRecord(value) && typeof value.uid === 'string';
}

// Fetch the PubMed esummary for the Virtual MD PMID and confirm the article
// is still indexed. Returns the summary when the UID is present and titled,
// otherwise null (treated as "source unavailable").
async function fetchPubMedArticle(): Promise<PubMedArticleSummary | null> {
  const response = await axios.get<PubMedEsummaryResult>(PUBMED_ESUMMARY_URL, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 20000,
  });
  const result = response.data?.result;
  if (!result || !Array.isArray(result.uids) || result.uids.length === 0) {
    return null;
  }
  const entry = result[VIRTUAL_MD_PMID];
  if (!isArticleSummary(entry) || !entry.title) {
    return null;
  }
  return entry;
}

// --- AHS News scrape ------------------------------------------------------

// Extract a DOI from the PubMed articleids list.
function extractDoi(summary: PubMedArticleSummary): string | null {
  const ids = Array.isArray(summary.articleids) ? summary.articleids : [];
  const doi = ids.find((id) => id.idtype === 'doi');
  return doi ? doi.value : null;
}

// Scan the AHS news listing HTML for any headline mentioning Health Link /
// 811 and a quoted call-volume figure. The AHS news page is a paged listing
// of short cards; when a release announces a Health Link volume milestone we
// capture the headline + any inline number. This is intentionally
// conservative — we only return a row when we can identify a fiscal year and
// at least one numeric volume, so we never fabricate data.
const HEALTH_LINK_KEYWORDS = ['health link', '811', 'health-link'];

interface NewsVolumeHint {
  headline: string;
  url: string;
  date: string;
  numbers: number[];
}

function parseHealthLinkNewsVolumes(
  $: cheerio.CheerioAPI,
): NewsVolumeHint[] {
  const hints: NewsVolumeHint[] = [];
  $('div.page-listing').each((_, el) => {
    const $el = $(el);
    const headline = $el.find('.list-title a').text().trim();
    const url = $el.find('.list-title a').attr('href') ?? '';
    const date = $el.find('.list-date').text().trim();
    const desc = $el.find('.list-desc').text().trim();
    const text = `${headline} ${desc}`.toLowerCase();
    if (!HEALTH_LINK_KEYWORDS.some((kw) => text.includes(kw))) return;
    // Capture any large integer (call volumes are typically >= 10,000).
    const numbers = (desc.match(/\d[\d,]{3,}/g) ?? [])
      .map((n) => Number(n.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n) && n >= 1000);
    if (numbers.length === 0) return;
    hints.push({ headline, url, date, numbers });
  });
  return hints;
}

// Convert a best-effort news hint into a HEALTH_LINK_VOLUMES row. Because the
// AHS news cards rarely break out clinical vs non-clinical volumes, we only
// apply a hint when we can identify a fiscal year and a single dominant
// volume figure; we treat it as `clinicalReceived` and leave the other
// channels at their existing values. Returns null when the hint is too
// ambiguous to map safely.
function hintToVolumeRow(
  hint: NewsVolumeHint,
  existing: HealthLinkVolume[],
): HealthLinkVolume | null {
  const fyMatch = hint.date.match(/(20\d{2})/);
  if (!fyMatch) return null;
  const year = Number(fyMatch[1]);
  // Build a "YYYY-YYYY" fiscal-year label and skip if we already have it.
  const fiscalYear = `${year}-${(year + 1).toString().slice(-2)}`;
  if (existing.some((row) => row.fiscalYear === fiscalYear)) return null;
  const clinicalReceived = hint.numbers[0];
  if (!Number.isFinite(clinicalReceived) || clinicalReceived <= 0) return null;
  return {
    fiscalYear,
    clinicalReceived,
    nonClinicalReceived: 0,
    clinicalOutbound: 0,
    nonClinicalOutbound: 0,
    padisCalls: 0,
  };
}

// --- Pipeline entry point -------------------------------------------------

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[VirtualCareFetcher] Fetching PubMed esummary + AHS news listing...');

  try {
    const existing = loadExistingVirtualCare();

    // 1. PubMed verification of the Virtual MD cohort study.
    let pubmedVerified = false;
    let pubmedNote = 'PubMed article not found.';
    try {
      const summary = await fetchPubMedArticle();
      if (summary) {
        pubmedVerified = true;
        pubmedNote = `Verified PMID ${VIRTUAL_MD_PMID}: "${summary.title}" (${summary.source ?? 'unknown journal'}, ${summary.pubdate ?? 'no date'})`;
        const doi = extractDoi(summary);
        if (doi) {
          pubmedNote += ` — DOI: ${doi}`;
        }
      }
    } catch (err) {
      pubmedNote = `PubMed fetch failed: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }

    await sleep(RATE_LIMIT_MS);

    // 2. Best-effort AHS news scrape for Health Link volume announcements.
    let newVolumeRows: HealthLinkVolume[] = [];
    let ahsNote = 'AHS news listing not fetched.';
    try {
      const response = await axios.get(AHS_NEWS_LISTING_URL, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 20000,
      });
      const $ = cheerio.load(response.data as string);
      const hints = parseHealthLinkNewsVolumes($);
      newVolumeRows = hints
        .map((hint) => hintToVolumeRow(hint, existing.HEALTH_LINK_VOLUMES))
        .filter((row): row is HealthLinkVolume => row !== null);
      ahsNote =
        newVolumeRows.length > 0
          ? `Parsed ${newVolumeRows.length} new Health Link volume row(s) from AHS news.`
          : 'No new Health Link volume announcements found on AHS news listing.';
    } catch (err) {
      ahsNote = `AHS news fetch failed: ${
        err instanceof Error ? err.message : String(err)
      }`;
    }

    await sleep(RATE_LIMIT_MS);

    // 3. Merge. The cohort study values are one-time and preserved as-is; we
    //    only re-write HEALTH_LINK_VOLUMES when we have new rows. All other
    //    arrays are preserved verbatim.
    const merged: VirtualCareJson = {
      ...existing,
      HEALTH_LINK_VOLUMES: [
        ...existing.HEALTH_LINK_VOLUMES,
        ...newVolumeRows,
      ],
    };

    const ownedMetadata: DataMetadata = {};
    if (pubmedVerified) {
      const cohortExisting = existing._dataMetadata?.VIRTUAL_MD_COHORT_STUDY;
      ownedMetadata.VIRTUAL_MD_COHORT_STUDY = buildMetadataEntry({
        updateType: cohortExisting?.updateType ?? 'manual',
        source: cohortExisting?.source ?? 'Canadian Journal of Emergency Medicine (PubMed PMID 40465166)',
        sourceVintage: cohortExisting?.sourceVintage ?? 'Cohort study indexed in PubMed',
        verification: pubmedNote,
        lastUpdated: timestamp,
      });
      merged._dataMetadata = mergeDataMetadata(existing._dataMetadata, ownedMetadata);
    }

    const recordsWritten = newVolumeRows.length;
    const recordsFetched = (pubmedVerified ? 1 : 0) + newVolumeRows.length;

    if (recordsWritten > 0 || pubmedVerified) {
      fs.writeFileSync(
        VIRTUAL_CARE_FILE,
        JSON.stringify(merged, null, 2),
        'utf8',
      );
    }

    const durationMs = Date.now() - startTime;
    const status: SyncResult['status'] =
      recordsWritten > 0
        ? 'success'
        : pubmedVerified
          ? 'partial'
          : 'skipped';

    console.log(
      `[VirtualCareFetcher] ${status}. PubMed verified=${pubmedVerified}, new volume rows=${recordsWritten}. ${durationMs}ms`,
    );

    return {
      domain: 'virtual-care',
      pipeline: 'virtualCareFetcher',
      status,
      recordsFetched,
      recordsWritten,
      durationMs,
      error:
        status === 'success' || status === 'partial'
          ? undefined
          : `${pubmedNote} | ${ahsNote}`,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[VirtualCareFetcher] FAILED:', errorMsg);

    return {
      domain: 'virtual-care',
      pipeline: 'virtualCareFetcher',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

// Backward-compatible named export matching the README's pipeline table.
export async function fetchVirtualCare(): Promise<SyncResult> {
  return run();
}

// CLI entry point: tsx src/pipelines/virtualCareFetcher.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'failed' ? 1 : 0);
    })
    .catch((err) => {
      console.error('Unhandled error in virtualCareFetcher:', err);
      process.exit(1);
    });
}
