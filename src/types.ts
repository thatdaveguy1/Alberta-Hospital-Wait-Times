export interface ServiceDisruption {
  id: string;
  facilityId?: string;
  facilityName: string;
  city: string;
  zone: 'North Zone' | 'Edmonton Zone' | 'Central Zone' | 'Calgary Zone' | 'South Zone' | string;
  serviceAffected: string;
  disruptionType: 'Closure' | 'Reduced Hours' | 'Bed Reduction' | 'Service Suspension' | string;
  status: 'Active' | 'Resolved' | 'Upcoming';
  startDate: string;
  endDate: string;
  reason: string;
  details: string;
  alternativeCare: string;
  sourceUrl: string;
  updatedAt: string;
}

export interface Hospital {
  id: string;
  name: string;
  city: string;
  region: string;
  waitTime: number; // in minutes
  waitTimeLabel: string;
  status: 'Green' | 'Yellow' | 'Red';
  updatedAt: string;
  category?: string;
  address?: string;
  note?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  driveMins?: number;
}

export interface WaitTimeSnapshot {
  hospitalId: string;
  waitTime: number;
  timestamp: string;
}

export interface AHSFeed {
  waittimes: {
    facility: Array<{
      Name: string[];
      City: string[];
      Region: string[];
      WaitTime: string[]; // e.g. "1h 30m"
      Status: string[]; // e.g. "Yellow"
      Updated: string[]; // e.g. "2026-06-26 01:30"
    }>;
  };
}
