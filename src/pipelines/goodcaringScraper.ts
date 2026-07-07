// GoodCaring.ca Scraper — Alberta patient experience / access metrics
// Scrapes the GoodCaring.ca Alberta specialist wait times page for median
// specialist wait times by field, parses them into PATIENT_VOICE_BY_SETTING
// access metrics, and merges the result into data-patient-experience.json
// while preserving all other patient-experience datasets
// (INPATIENT_EXPERIENCE_TRENDS, ED_EXPERIENCE_TRENDS, CLINICAL_SAFETY_TRENDS,
// PATIENT_COMPLAINTS) and all non-GoodCaring PATIENT_VOICE_BY_SETTING rows.
//
// The GoodCaring page publishes median wait times in weeks for each specialty
// field (cardiovascular, oncology, ENT, ophthalmology, general surgery,
// gynecology, internal medicine, neurosurgery, orthopedics, plastic surgery,
// urology). These are access/timeliness metrics — a core patient experience
// dimension. We store them as PATIENT_VOICE_BY_SETTING rows with
// setting="Specialist Access" and a metric name that clearly identifies the
// specialty and unit ("<Specialty> Median Wait (weeks)"). The albertaRatePct
// field holds the numeric wait-weeks (the metric name documents the unit);
// canadaRatePct is null since the page has no national comparator.

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import type { SyncResult } from './types';
import {
  buildMetadataEntry,
  mergeDataMetadata,
  type DataMetadata,
} from './metadataHelpers';
import type {
  SettingExperience,
  InpatientDetail,
  EDExperienceTrend,
  HospitalHarmMetric,
  ComplaintCategory,
} from '../patientExperienceData';

const GOODCARING_ALBERTA_SPECIALIST_URL =
  'https://goodcaring.ca/alberta-specialist-care-wait-times/';
const PATIENT_EXPERIENCE_FILE = path.join(
  process.cwd(),
  'data-patient-experience.json',
);
const RATE_LIMIT_MS = 2000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// GoodCaring-sourced rows are tagged with this setting so we can identify
// and replace them on re-scrape without touching hand-curated rows from
// other sources (HQA FOCUS, CIHI, AHS Patient Relations).
const GOODCARING_SETTING = 'Specialist Access';

interface PatientExperienceJson {
  PATIENT_VOICE_BY_SETTING: SettingExperience[];
  INPATIENT_EXPERIENCE_TRENDS: InpatientDetail[];
  ED_EXPERIENCE_TRENDS: EDExperienceTrend[];
  CLINICAL_SAFETY_TRENDS: HospitalHarmMetric[];
  PATIENT_COMPLAINTS: ComplaintCategory[];
  _dataMetadata?: DataMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coercePatientExperienceJson(raw: unknown): PatientExperienceJson {
  const base: PatientExperienceJson = {
    PATIENT_VOICE_BY_SETTING: [],
    INPATIENT_EXPERIENCE_TRENDS: [],
    ED_EXPERIENCE_TRENDS: [],
    CLINICAL_SAFETY_TRENDS: [],
    PATIENT_COMPLAINTS: [],
  };
  if (isRecord(raw)) {
    if (Array.isArray(raw.PATIENT_VOICE_BY_SETTING)) base.PATIENT_VOICE_BY_SETTING = raw.PATIENT_VOICE_BY_SETTING as SettingExperience[];
    if (Array.isArray(raw.INPATIENT_EXPERIENCE_TRENDS)) base.INPATIENT_EXPERIENCE_TRENDS = raw.INPATIENT_EXPERIENCE_TRENDS as InpatientDetail[];
    if (Array.isArray(raw.ED_EXPERIENCE_TRENDS)) base.ED_EXPERIENCE_TRENDS = raw.ED_EXPERIENCE_TRENDS as EDExperienceTrend[];
    if (Array.isArray(raw.CLINICAL_SAFETY_TRENDS)) base.CLINICAL_SAFETY_TRENDS = raw.CLINICAL_SAFETY_TRENDS as HospitalHarmMetric[];
    if (Array.isArray(raw.PATIENT_COMPLAINTS)) base.PATIENT_COMPLAINTS = raw.PATIENT_COMPLAINTS as ComplaintCategory[];
    if (isRecord(raw._dataMetadata)) base._dataMetadata = raw._dataMetadata as DataMetadata;
  }
  return base;
}

function loadExistingPatientExperience(): PatientExperienceJson {
  try {
    const text = fs.readFileSync(PATIENT_EXPERIENCE_FILE, 'utf8');
    return coercePatientExperienceJson(JSON.parse(text));
  } catch {
    return {
      PATIENT_VOICE_BY_SETTING: [],
      INPATIENT_EXPERIENCE_TRENDS: [],
      ED_EXPERIENCE_TRENDS: [],
      CLINICAL_SAFETY_TRENDS: [],
      PATIENT_COMPLAINTS: [],
    };
  }
}

// Specialty label → normalized display name used in the metric string.
// Keys correspond to the section anchors on the GoodCaring page.
const SPECIALTY_LABELS: ReadonlyArray<{ anchor: string; label: string }> = [
  { anchor: 'cardiovascular', label: 'Cardiovascular' },
  { anchor: 'cancer', label: 'Cancer (Medical Oncology)' },
  { anchor: 'cancer', label: 'Cancer (Radiation Oncology)' },
  { anchor: 'ent', label: 'ENT' },
  { anchor: 'eye', label: 'Eye (Ophthalmology)' },
  { anchor: 'general-surgery', label: 'General Surgery' },
  { anchor: 'gynecology', label: 'Gynecology' },
  { anchor: 'internal-medicine', label: 'Internal Medicine' },
  { anchor: 'neurosurgery', label: 'Neurosurgery' },
  { anchor: 'orthopedics', label: 'Orthopedics' },
  { anchor: 'plastic-surgery', label: 'Plastic Surgery' },
  { anchor: 'urology', label: 'Urology' },
];

// Keyword map for matching a wait-time sentence to a specialty by proximity.
const SPECIALTY_KEYWORDS: Record<string, string[]> = {
  cardiovascular: ['cardiovascular', 'cardiac'],
  'cancer (medical oncology)': ['medical oncology', 'chemotherapy'],
  'cancer (radiation oncology)': ['radiation oncology', 'radiation'],
  ent: ['ent', 'otolaryngology', 'ear, nose'],
  'eye (ophthalmology)': ['ophthalmology', 'eye', 'cataract', 'glaucoma'],
  'general surgery': ['general surgery', 'general surgeon'],
  gynecology: ['gynecolog', 'gynaecolog'],
  'internal medicine': ['internal medicine', 'internist'],
  neurosurgery: ['neurosurgery', 'neurosurgeon', 'brain', 'spine'],
  orthopedics: ['orthopedic', 'orthopaedic', 'joint', 'knee', 'hip'],
  'plastic surgery': ['plastic surgery', 'reconstructive'],
  urology: ['urolog', 'urinary', 'kidney stone', 'prostate'],
};

// Extract the reporting year from the page title, e.g. "Specialist Wait Times
// in Alberta (2025)".
function extractReportingYear($: cheerio.CheerioAPI): string {
  const title = $('title').first().text() ?? '';
  const match = title.match(/\((\d{4})\)/);
  return match ? match[1] : new Date().getFullYear().toString();
}

// Parse median wait time sentences from the page body. The page renders each
// specialty's median wait as a bold sentence like:
//   "The median cardiovascular specialist wait time in Alberta is 19 weeks."
//   "The median wait time for medical oncology is 7 weeks."
//   "Similarly, radiation oncology has a median wait time of 8 weeks."
// We scan all text for the pattern "median ... is <N> weeks" / "median
// wait time of <N> weeks" and map them to specialties by keyword proximity.
function parseSpecialistWaitTimes(
  $: cheerio.CheerioAPI,
  year: string,
): SettingExperience[] {
  const results: SettingExperience[] = [];
  const bodyText = $('body').text() ?? '';

  const medianIsPattern = /median[^.]*?(?:is|of)\s+(\d+)\s+weeks/gi;
  const matches: Array<{ weeks: number; snippet: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = medianIsPattern.exec(bodyText)) !== null) {
    const weeks = parseInt(m[1], 10);
    if (Number.isFinite(weeks)) {
      const start = Math.max(0, m.index - 200);
      const end = Math.min(bodyText.length, m.index + m[0].length + 50);
      matches.push({ weeks, snippet: bodyText.slice(start, end).toLowerCase() });
    }
  }

  const usedSpecialties = new Set<string>();
  for (const { weeks, snippet } of matches) {
    let bestLabel: string | null = null;
    for (const { label } of SPECIALTY_LABELS) {
      if (usedSpecialties.has(label)) continue;
      const labelKey = label.toLowerCase();
      const kwList = SPECIALTY_KEYWORDS[labelKey] ?? [];
      if (kwList.some((kw) => snippet.includes(kw))) {
        bestLabel = label;
        break;
      }
    }
    if (!bestLabel) continue;
    usedSpecialties.add(bestLabel);
    results.push({
      setting: GOODCARING_SETTING,
      metric: `${bestLabel} Median Wait (weeks)`,
      albertaRatePct: weeks,
      canadaRatePct: null,
      year,
    });
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[GoodCaringScraper] Fetching GoodCaring Alberta specialist wait times page...');

  try {
    const response = await axios.get(GOODCARING_ALBERTA_SPECIALIST_URL, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 20000,
    });
    const $ = cheerio.load(response.data as string);
    const year = extractReportingYear($);

    const scrapedRows = parseSpecialistWaitTimes($, year);
    await sleep(RATE_LIMIT_MS);

    if (scrapedRows.length === 0) {
      const durationMs = Date.now() - startTime;
      console.warn('[GoodCaringScraper] No specialist wait times could be parsed from page.');
      return {
        domain: 'patient-experience',
        pipeline: 'goodcaringScraper',
        status: 'partial',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs,
        error: 'No specialist wait times could be parsed from the GoodCaring Alberta page.',
        timestamp,
      };
    }

    // Merge-and-preserve: load existing patient-experience JSON, drop only the
    // GoodCaring-sourced PATIENT_VOICE_BY_SETTING rows (identified by setting),
    // append the fresh scrape, and keep every other dataset intact.
    const existing = loadExistingPatientExperience();
    const preservedVoiceRows = existing.PATIENT_VOICE_BY_SETTING.filter(
      (row) => row.setting !== GOODCARING_SETTING,
    );
    const mergedVoiceRows = [...preservedVoiceRows, ...scrapedRows];

    const ownedMetadata: DataMetadata = {
      PATIENT_VOICE_BY_SETTING: buildMetadataEntry({
        updateType: 'auto',
        source: 'GoodCaring.ca Alberta specialist wait times',
        sourceVintage: 'Live GoodCaring scrape',
        lastUpdated: timestamp,
      }),
    };

    const merged: PatientExperienceJson = {
      ...existing,
      PATIENT_VOICE_BY_SETTING: mergedVoiceRows,
      _dataMetadata: mergeDataMetadata(existing._dataMetadata, ownedMetadata),
    };

    fs.writeFileSync(
      PATIENT_EXPERIENCE_FILE,
      JSON.stringify(merged, null, 2),
      'utf8',
    );

    const durationMs = Date.now() - startTime;
    console.log(
      `[GoodCaringScraper] Complete. ${scrapedRows.length} Specialist Access rows written. ${durationMs}ms`,
    );

    return {
      domain: 'patient-experience',
      pipeline: 'goodcaringScraper',
      status: 'success',
      recordsFetched: scrapedRows.length,
      recordsWritten: scrapedRows.length,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[GoodCaringScraper] FAILED:', errorMsg);

    return {
      domain: 'patient-experience',
      pipeline: 'goodcaringScraper',
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
export async function scrapeGoodCaring(): Promise<SyncResult> {
  return run();
}
