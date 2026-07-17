// AHS Service Disruptions Scraper
// Parses the AHS temporary bed/space reductions page (Page17594.aspx)
// Discovers all active disruptions from Bootstrap modal dialogs, merges with
// existing records, and writes the combined result to data-disruptions.json.
// zone and disruptionType are inferred (city map / keyword heuristics).
// alternativeCare is only written from explicit editorial overrides — never a generic template.

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'fs';
import path from 'path';
import type { ServiceDisruption } from '../types';
import type { SyncResult } from './types';

const AHS_DISRUPTIONS_URL = 'https://www.albertahealthservices.ca/br/Page17594.aspx';
const DISRUPTIONS_FILE = path.join(process.cwd(), 'data-disruptions.json');
const OVERRIDES_FILE = path.join(process.cwd(), 'data-disruption-overrides.json');

// City → zone mapping loaded from data file for editability without code changes
const ZONE_BY_CITY: Record<string, ServiceDisruption['zone']> =
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data-zone-by-city.json'), 'utf-8'));

function deduceZone(city: string): ServiceDisruption['zone'] {
  // City→zone map; unmapped cities leave zone empty rather than inventing North Zone.
  return ZONE_BY_CITY[city] ?? '';
}

function makeFacilityId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Editorial overrides for facility city/location when the upstream page groups
// facilities under the wrong city header.
const CITY_OVERRIDES: Record<string, string> = {
  'hinton-healthcare-centre': 'Hinton',
};

function normalizeCity(facilityId: string, facilityName: string, scrapedCity: string): string {
  return CITY_OVERRIDES[facilityId] ?? CITY_OVERRIDES[makeFacilityId(facilityName)] ?? scrapedCity;
}

function deduceDisruptionType(bedReductionText: string): ServiceDisruption['disruptionType'] {
  const lower = bedReductionText.toLowerCase();
  if (lower.includes('closure') || lower.includes('closed') || (lower.includes('no physician available on site') && !lower.includes('overnight'))) {
    return 'Closure';
  }
  if (lower.includes('reduced hours') || lower.includes('adjusted hours') || lower.includes('overnight') || lower.includes('hours of operation')) {
    return 'Reduced Hours';
  }
  if (lower.includes('bed reduction') || lower.includes('beds') || lower.includes('space reduction')) {
    return 'Bed Reduction';
  }
  if (lower.includes('suspension') || lower.includes('suspended') || lower.includes('no obstetrical')) {
    return 'Service Suspension';
  }
  // Unclassified — keep raw label rather than inventing a type.
  return 'Unclassified';
}

// Parse a date string like "September 8, 2025" or "December 31, 2026" into ISO format
function parseAhsDate(dateStr: string): string {
  const cleaned = dateStr.trim().replace(/\s+/g, ' ');
  // Try parsing as a natural language date
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  // Fallback: return as-is (might be "Ongoing" or "TBD")
  return cleaned;
}

// Extract text content from a <p> tag that follows a <strong> label
function extractField($: cheerio.CheerioAPI, $section: cheerio.Cheerio<AnyNode>, label: string): string {
  const strong = $section.find('strong').filter((_i, el) => {
    const text = $(el).text().toLowerCase().replace(/[:]/g, '').trim();
    return text === label.toLowerCase();
  });
  if (strong.length === 0) return '';
  // Get the text after the <strong> tag within the same <p>
  const $p = strong.parent('p');
  // Clone the p, remove the strong, get remaining text
  const cloned = $p.clone();
  cloned.find('strong').remove();
  const remainingText = cloned.text().trim();
  // Also capture text from sibling elements (ul, etc.) within the modal-body up to the next <p><strong>
  if (remainingText) return remainingText;
  // If the strong's parent p has no text after it, look for following ul/elements
  let nextNode = $p.next();
  let extraText = '';
  while (nextNode.length > 0 && nextNode.is('ul, ol')) {
    extraText += ' ' + nextNode.text().trim();
    nextNode = nextNode.next();
  }
  return extraText.trim();
}

// Parse a single disruption block (the elements between <p><strong>Program or Service</strong> ... and the next block or end)
interface ParsedDisruption {
  facilityName: string;
  city: string;
  serviceAffected: string;
  bedReductionText: string;
  reason: string;
  startDate: string;
  endDate: string;
}

function parseModalBody($: cheerio.CheerioAPI, $modal: cheerio.Cheerio<AnyNode>): { city: string; facilityName: string; disruptions: ParsedDisruption[] } {
  const city = $modal.find('h1.in-header-teal').text().trim();
  const facilityName = $modal.find('h4.modal-title').text().trim().replace(/&amp;/g, '&');

  const $body = $modal.find('.modal-body');
  const disruptions: ParsedDisruption[] = [];

  // Split the body by <hr> tags — each section is one disruption
  const sections: cheerio.Cheerio<AnyNode>[] = [];
  let currentNodes: AnyNode[] = [];

  $body.children().each((_i, el) => {
    const $el = $(el);
    if ($el.is('hr')) {
      if (currentNodes.length > 0) {
        sections.push($(currentNodes));
      }
      currentNodes = [];
    } else {
      currentNodes.push(el);
    }
  });
  if (currentNodes.length > 0) {
    sections.push($(currentNodes));
  }

  for (const $section of sections) {
    const serviceAffected = extractField($, $section, 'Program or Service');
    const bedReductionText = extractField($, $section, 'Bed or Space Reduction');
    const reason = extractField($, $section, 'Reason');
    const startDate = extractField($, $section, 'Start Date');
    const endDate = extractField($, $section, 'Anticipated End Date');

    if (!serviceAffected && !bedReductionText) continue;

    disruptions.push({
      facilityName,
      city,
      serviceAffected: serviceAffected || '',
      bedReductionText,
      reason: reason || '',
      startDate: parseAhsDate(startDate),
      endDate: parseAhsDate(endDate),
    });
  }

  return { city, facilityName, disruptions };
}

function loadOverrides(): Record<string, { details?: string; alternativeCare?: string }> {
  try {
    if (fs.existsSync(OVERRIDES_FILE)) {
      const raw = fs.readFileSync(OVERRIDES_FILE, 'utf8');
      return JSON.parse(raw) as Record<string, { details?: string; alternativeCare?: string }>;
    }
  } catch (err) {
    console.warn('[DisruptionsScraper] Error loading overrides:', err);
  }
  return {};
}

function loadExisting(): ServiceDisruption[] {
  try {
    if (fs.existsSync(DISRUPTIONS_FILE)) {
      const raw = fs.readFileSync(DISRUPTIONS_FILE, 'utf8');
      return JSON.parse(raw) as ServiceDisruption[];
    }
  } catch (err) {
    console.warn('[DisruptionsScraper] Error loading existing disruptions:', err);
  }
  return [];
}

export async function scrapeDisruptions(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[DisruptionsScraper] Fetching AHS disruptions page...');

  try {
    const response = await axios.get(AHS_DISRUPTIONS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 20000,
    });

    const $ = cheerio.load(response.data);
    const overrides = loadOverrides();
    const existing = loadExisting();

    // Build a lookup of existing disruptions by facilityId + serviceAffected
    const existingByKey = new Map<string, ServiceDisruption>();
    for (const disr of existing) {
      const key = `${disr.facilityId ?? makeFacilityId(disr.facilityName)}|${disr.serviceAffected}`;
      existingByKey.set(key, disr);
    }

    // Track which existing disruptions we've seen in this scrape
    const seenKeys = new Set<string>();
    const newDisruptions: ServiceDisruption[] = [];

    // Parse all modals on the page
    $('div.fade.modal[role="dialog"]').each((_i, modalEl) => {
      const $modal = $(modalEl);
      const { city, facilityName, disruptions } = parseModalBody($, $modal);

      for (const parsed of disruptions) {
        const facilityId = makeFacilityId(facilityName);
        const key = `${facilityId}|${parsed.serviceAffected}`;
        seenKeys.add(key);

        const normalizedCity = normalizeCity(facilityId, facilityName, city);
        const override = overrides[facilityId];
        const disruptionType = deduceDisruptionType(parsed.bedReductionText);
        const zone = deduceZone(normalizedCity);

        // Check if we already have this disruption
        const existingDisr = existingByKey.get(key);

        if (existingDisr) {
          // Update with scraped fields only. alternativeCare only from overrides.
          newDisruptions.push({
            ...existingDisr,
            facilityName,
            city: normalizedCity,
            zone,
            serviceAffected: parsed.serviceAffected,
            disruptionType,
            status: 'Active',
            startDate: parsed.startDate || existingDisr.startDate,
            endDate: parsed.endDate || existingDisr.endDate,
            reason: parsed.reason || existingDisr.reason,
            details: override?.details ?? (parsed.bedReductionText || existingDisr.details),
            alternativeCare: override?.alternativeCare ?? '',
            sourceUrl: AHS_DISRUPTIONS_URL,
            updatedAt: timestamp,
          });
        } else {
          // New disruption discovered from the page
          newDisruptions.push({
            id: `disr-${facilityId}-${Date.now().toString(36)}`,
            facilityId,
            facilityName,
            city: normalizedCity,
            zone,
            serviceAffected: parsed.serviceAffected,
            disruptionType,
            status: 'Active',
            startDate: parsed.startDate,
            endDate: parsed.endDate,
            reason: parsed.reason,
            details: override?.details ?? parsed.bedReductionText,
            alternativeCare: override?.alternativeCare ?? '',
            sourceUrl: AHS_DISRUPTIONS_URL,
            updatedAt: timestamp,
          });
          console.log(`[DisruptionsScraper] NEW disruption discovered: ${facilityName} - ${parsed.serviceAffected}`);
        }
      }
    });

    // Mark existing disruptions not seen on the page as Resolved
    for (const [key, disr] of existingByKey) {
      if (!seenKeys.has(key) && disr.status === 'Active') {
        console.log(`[DisruptionsScraper] Disruption resolved: ${disr.facilityName} - ${disr.serviceAffected}`);
        newDisruptions.push({
          ...disr,
          status: 'Resolved',
          endDate: timestamp.split('T')[0],
          updatedAt: timestamp,
        });
      } else if (!seenKeys.has(key)) {
        // Keep already-resolved disruptions as-is
        newDisruptions.push(disr);
      }
    }

    // Sort: Active first, then by facility name
    newDisruptions.sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      return a.facilityName.localeCompare(b.facilityName);
    });

    // Write to file
    fs.writeFileSync(DISRUPTIONS_FILE, JSON.stringify(newDisruptions, null, 2), 'utf8');

    const activeCount = newDisruptions.filter(d => d.status === 'Active').length;
    const durationMs = Date.now() - startTime;
    console.log(`[DisruptionsScraper] Complete. ${newDisruptions.length} total disruptions (${activeCount} active). ${durationMs}ms`);

    return {
      domain: 'disruptions',
      pipeline: 'disruptionsScraper',
      status: 'success',
      recordsFetched: newDisruptions.filter(d => d.status === 'Active').length,
      recordsWritten: newDisruptions.length,
      durationMs,
      timestamp,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[DisruptionsScraper] FAILED:', errorMsg);

    return {
      domain: 'disruptions',
      pipeline: 'disruptionsScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}
