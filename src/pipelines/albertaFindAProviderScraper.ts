// Alberta Find a Provider scraper.
// Fetches real clinic/provider data from the official Primary Care Alberta
// directory API (albertafindaprovider.ca) and replaces data-primary-care.json's
// ACCEPTING_PROVIDERS with the fresh accepting-new-patients list (deduped).
//
// The API is the same XHR endpoint the public directory map UI calls. It
// returns clean JSON with no auth required. We paginate through all clinics
// with anp=1 (accepting new patients), extract per-provider rows, and map
// them to the AcceptingProvider interface.
//
// All failures are caught and returned as a SyncResult — run() never throws.

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import type { AcceptingProvider } from '../primaryCareData';
import type { SyncResult } from './types';
import { buildMetadataEntry, mergeDataMetadata, type DataMetadata,
  applyWithheldPayloadGuard } from './metadataHelpers';

const API_ENDPOINT = 'https://albertafindaprovider.ca/search/directory/clinics';
const DATA_FILE = path.join(process.cwd(), 'data-primary-care.json');
const RATE_LIMIT_MS = 500; // be polite to the server
const PAGE_SIZE = 25;
const MAX_PAGES = 80; // safety cap (547 clinics / 25 = 22 pages)
const MAX_API_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3000];

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const SOURCE_NAME = 'Alberta Find a Provider (Primary Care Alberta)';
const SOURCE_URL = 'https://albertafindaprovider.ca/';
function isRetryableApiError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const code = err.code;
    const status = err.response?.status;
    if (status && status >= 500 && status < 600) return true;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') return true;
  }
  return false;
}

interface ApiClinic {
  id: number;
  name: string;
  street_address: string;
  city: string;
  province: string;
  postal_code: string;
  lat: string;
  lng: string;
  phone_number: string;
  phone_extension?: string;
  email?: string;
  website?: string;
  is_access_clinic: boolean;
  is_dedicated_walk_in: boolean;
  anp_behaviour: number;
  limited_panel_message?: string | null;
  is_clinic_always_anp: boolean;
  is_clinic_never_anp: boolean;
  pcn?: {
    id: number;
    zone_id: number;
    name: string;
    acronym: string;
    display_name: string;
    website?: string;
    zone?: { name: string };
  };
  physicians?: ApiPhysician[];
  services?: { id: number; name: string }[];
  specialties?: { id: number; name: string }[];
}

interface ApiPhysician {
  id: number;
  first_name: string;
  last_name: string;
  gender: 'm' | 'f';
  nurse_practitioner: number;
  friendly_name: string;
  clinical_name: string;
  languages?: { id: number; name: string }[];
  specialties?: { id: number; name: string }[];
}

interface ApiResponse {
  items: ApiClinic[];
  limit: number;
  total: number;
  offset: number;
  pages: number;
  page: number;
}

interface LoadedJson {
  [key: string]: unknown;
}

function loadJsonFile(file: string): LoadedJson {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function formatPostalCode(raw: string | null | undefined): string {
  if (!raw) return '';
  if (raw.length === 6) {
    return `${raw.slice(0, 3)} ${raw.slice(3)}`;
  }
  return raw;
}

function hasService(
  services: { id: number; name: string }[] | undefined,
  serviceName: string,
): boolean {
  const target = serviceName.toLowerCase();
  return (services ?? []).some(s => s.name.toLowerCase() === target);
}

function mapClinicFeatures(clinic: ApiClinic): AcceptingProvider['features'] {
  const services = clinic.services;
  const virtualHeuristic = (services ?? []).some(s => {
    const name = s.name.toLowerCase();
    return name.includes('virtual') || name.includes('telehealth');
  });

  return {
    walkIn:
      clinic.is_dedicated_walk_in ||
      clinic.is_access_clinic ||
      hasService(services, 'Walk-in Services'),
    afterHours: hasService(services, 'Open After Hours'),
    virtualAppointments:
      hasService(services, 'Virtual Appointments') || virtualHeuristic,
    wheelchairAccess: hasService(services, 'Wheelchair Access'),
    onlineBooking: hasService(services, 'Clinic offers online booking'),
  };
}

function limitedPanelMessageFromClinic(
  clinic: ApiClinic,
): string | null | undefined {
  const trimmed = clinic.limited_panel_message?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function mapClinicToProviders(clinic: ApiClinic): AcceptingProvider[] {
  const zone = (clinic.pcn?.zone?.name ?? 'Calgary Zone') as AcceptingProvider['zone'];
  const pcnName = clinic.pcn?.display_name;
  const physicians = clinic.physicians ?? [];
  const features = mapClinicFeatures(clinic);
  const limitedPanelMessage = limitedPanelMessageFromClinic(clinic);

  // If no physicians listed, create one clinic-level entry
  if (physicians.length === 0) {
    return [{
      id: `anp-clinic-${clinic.id}`,
      name: clinic.name ?? 'Unknown Clinic',
      type: 'Primary Care Clinic',
      clinicName: clinic.name ?? 'Unknown Clinic',
      city: clinic.city ?? '',
      zone,
      address: clinic.street_address ?? '',
      postalCode: formatPostalCode(clinic.postal_code),
      phone: formatPhone(clinic.phone_number),
      acceptingNewPatients: true,
      languages: [],
      features,
      pcnName,
      ...(limitedPanelMessage !== undefined ? { limitedPanelMessage } : {}),
    }];
  }

  // Create one entry per physician
  return physicians.map(phys => ({
    id: `anp-${clinic.id}-${phys.id}`,
    name: phys.nurse_practitioner === 1 ? (phys.friendly_name ?? phys.clinical_name ?? 'Unknown') : (phys.clinical_name ?? phys.friendly_name ?? 'Unknown'),
    type: (phys.nurse_practitioner === 1 ? 'Nurse Practitioner' : 'Family Doctor') as AcceptingProvider['type'],
    clinicName: clinic.name ?? 'Unknown Clinic',
    city: clinic.city ?? '',
    zone,
    address: clinic.street_address ?? '',
    postalCode: formatPostalCode(clinic.postal_code),
    phone: formatPhone(clinic.phone_number),
    acceptingNewPatients: true,
    gender: phys.gender === 'm' ? 'Male' : 'Female',
    languages: (phys.languages ?? []).map(l => l.name),
    features,
    pcnName,
    ...(limitedPanelMessage !== undefined ? { limitedPanelMessage } : {}),
  }));
}

function providerDedupeKey(provider: AcceptingProvider): string {
  return [
    provider.name,
    provider.clinicName,
    provider.address,
    provider.phone,
    provider.type,
  ]
    .map(part => part.trim().toLowerCase())
    .join('|');
}

/** Keep first occurrence of each normalized identity from the fresh fetch. */
function dedupeProviders(providers: AcceptingProvider[]): AcceptingProvider[] {
  const seen = new Set<string>();
  const deduped: AcceptingProvider[] = [];
  for (const provider of providers) {
    const key = providerDedupeKey(provider);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(provider);
  }
  return deduped;
}

// Replace ACCEPTING_PROVIDERS with the fresh fetch (no merge-retain of absent
// IDs). Preserve other JSON keys. Force withheld primary-care residual arrays
// empty so RMW never reintroduces them. Dedupe by normalized identity.
function mergeAndWrite(file: string, newProviders: AcceptingProvider[]): number {
  const existing = loadJsonFile(file);
  // Force primary-care withheld residual arrays empty so RMW never reintroduces them.
  existing.PCN_CAPACITY = [];
  existing.ED_RELIANCE_BY_CONTINUITY = [];
  existing.CONTINUITY_SATISFACTION = [];

  const replaced = dedupeProviders(newProviders);
  existing.ACCEPTING_PROVIDERS = replaced;

  const ownedMetadata: DataMetadata = {
    ACCEPTING_PROVIDERS: buildMetadataEntry({
      updateType: 'auto',
      source: SOURCE_NAME,
      sourceVintage: 'Live directory',
    }),
  };
  existing._dataMetadata = mergeDataMetadata(
    existing._dataMetadata as DataMetadata | undefined,
    ownedMetadata,
    ['ACCEPTING_PROVIDERS'],
  );

  applyWithheldPayloadGuard(existing);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2));
  return replaced.length;
}

export async function run(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  console.log('[AlbertaFindAProvider] Starting clinic directory fetch');

  try {
    const allProviders: AcceptingProvider[] = [];
    const seenClinicIds = new Set<number>();
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages && page <= MAX_PAGES) {
      if (page > 1) {
        await new Promise<void>(resolve => setTimeout(resolve, RATE_LIMIT_MS));
      }

      const url = `${API_ENDPOINT}?page=${page}&limit=${PAGE_SIZE}&anp=1&with[]=pcn&with[]=physicians&with[]=physicians.languages&with[]=physicians.specialties&with[]=services&with[]=specialties`;

      let response: { data: ApiResponse } | undefined;
      let lastError: unknown;

      for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
        try {
          response = await axios.get<ApiResponse>(url, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            timeout: 30000,
          });
          break;
        } catch (err) {
          lastError = err;
          if (!isRetryableApiError(err) || attempt === MAX_API_RETRIES) {
            break;
          }
          const delayMs = RETRY_DELAYS_MS[attempt];
          console.warn(`[AlbertaFindAProvider] Retry ${attempt + 1}/${MAX_API_RETRIES} for page ${page} failed (${err instanceof Error ? err.message : String(err)}); waiting ${delayMs}ms`);
          await new Promise<void>(resolve => setTimeout(resolve, delayMs));
        }
      }

      if (!response) {
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        console.warn(`[AlbertaFindAProvider] API fetch failed on page ${page} after ${MAX_API_RETRIES} retries: ${msg}`);
        return {
          domain: 'primary-care',
          pipeline: 'albertaFindAProviderScraper',
          status: 'skipped',
          recordsFetched: allProviders.length,
          recordsWritten: 0,
          durationMs: Date.now() - startTime,
          timestamp,
          error: `API fetch failed on page ${page}: ${msg}`,
        };
      }

      const data = response.data;
      totalPages = data.pages;
      console.log(`[AlbertaFindAProvider] Page ${page}/${totalPages}: ${data.items.length} clinics (total: ${data.total})`);

      for (const clinic of data.items) {
        if (seenClinicIds.has(clinic.id)) continue;
        seenClinicIds.add(clinic.id);
        allProviders.push(...mapClinicToProviders(clinic));
      }

      page++;
    }

    if (allProviders.length === 0) {
      console.warn('[AlbertaFindAProvider] No providers fetched — leaving data file unchanged.');
      return {
        domain: 'primary-care',
        pipeline: 'albertaFindAProviderScraper',
        status: 'skipped',
        recordsFetched: 0,
        recordsWritten: 0,
        durationMs: Date.now() - startTime,
        timestamp,
        error: 'No accepting-new-patient providers found in API response',
      };
    }

    const written = mergeAndWrite(DATA_FILE, allProviders);
    console.log(
      `[AlbertaFindAProvider] Complete. ${allProviders.length} providers from ${seenClinicIds.size} clinics, ${written} total in file. ${Date.now() - startTime}ms`,
    );

    return {
      domain: 'primary-care',
      pipeline: 'albertaFindAProviderScraper',
      status: 'success',
      recordsFetched: allProviders.length,
      recordsWritten: written,
      durationMs: Date.now() - startTime,
      timestamp,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[AlbertaFindAProvider] FAILED:', errorMsg);
    return {
      domain: 'primary-care',
      pipeline: 'albertaFindAProviderScraper',
      status: 'failed',
      recordsFetched: 0,
      recordsWritten: 0,
      durationMs: Date.now() - startTime,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(result => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'failed' ? 1 : 0);
  });
}
