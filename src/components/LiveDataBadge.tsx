// LiveDataBadge — small inline indicator showing data freshness for a domain.
// Placed in dashboard headers to show last-updated time and pipeline status.

import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { useSyncStatus, formatRelativeTime, getDomainResult } from '../hooks/useSyncStatus';

interface LiveDataBadgeProps {
  domain: string;
  /** Override label for the data source (e.g. "AHS API", "StatsCan") */
  sourceLabel?: string;
}

export function LiveDataBadge({ domain, sourceLabel }: LiveDataBadgeProps): React.ReactElement | null {
  return null;
}
