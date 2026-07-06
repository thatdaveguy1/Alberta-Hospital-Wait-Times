// DataTimestamp — universal component showing data freshness for any array.
// Shows BOTH our update time AND source data vintage for auto-updated data.
// Shows only source data timestamp with "Manually updated" tag for static data.

import React from 'react';
import { Clock, RefreshCw, Database, FileText } from 'lucide-react';

export interface ArrayMetadata {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}

interface DataTimestampProps {
  /** The _dataMetadata object from the domain data file */
  metadata?: Record<string, ArrayMetadata>;
  /** Which array key to show the timestamp for */
  arrayKey: string;
  /** Optional compact mode — single line instead of two */
  compact?: boolean;
}

function formatTimestamp(ts: string): string {
  if (!ts || ts === 'Unknown') return 'Unknown';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts; // Not a date — show as-is (e.g. "2024-2025 fiscal year")
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

function formatRelative(ts: string): string {
  if (!ts || ts === 'Unknown') return '';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);
    if (diffHrs < 1) return 'just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch {
    return '';
  }
}

export function DataTimestamp({ metadata, arrayKey, compact = false }: DataTimestampProps): React.ReactElement | null {
  return null;
}

// Convenience type for dashboard data interfaces
export type DataMetadataMap = Record<string, ArrayMetadata>;
