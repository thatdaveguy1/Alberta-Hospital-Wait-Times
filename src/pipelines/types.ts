// Shared pipeline interfaces for the Alberta Hospital Wait Times data update system.

export interface SyncResult {
  domain: string;
  pipeline: string;
  status: 'success' | 'failed' | 'partial' | 'skipped' | 'manual';
  recordsFetched: number;
  recordsWritten: number;
  durationMs: number;
  error?: string;
  timestamp: string;
}

export interface SyncStatus {
  status: 'never_run' | 'running' | 'success' | 'partial_success' | 'failed' | 'manual';
  lastSyncTimestamp: string | null;
  nextSyncTimestamp: string | null;
  results: SyncResult[];
  erWaitTimesLastUpdate: string | null;
  erWaitTimesNextUpdate: string | null;
  labWaitsLastUpdate: string | null;
  labWaitsNextUpdate: string | null;
}

export interface DataSourceConfig {
  id: string;
  name: string;
  url: string;
  type: 'api' | 'scraper' | 'download' | 'manual';
  cadence: '10min' | '24hr';
  domain: string;
}

// Domain whitelist — all data domains served by the API
export const DOMAINS = [
  'er-waittimes',
  'disruptions',
  'surgical',
  'diagnostic',
  'cancer',
  'primary-care',
  'public-health',
  'regional-inequity',
  'spending',
] as const;

export type Domain = typeof DOMAINS[number];

// Pipeline module interface — every pipeline implements this
export interface Pipeline {
  name: string;
  domain: string;
  run(): Promise<SyncResult>;
}
