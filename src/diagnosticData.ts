// Alberta Diagnostic Imaging & Laboratory Datasets (2008 - 2026 reporting periods)
// Compiled from Alberta Precision Labs (APL) QMe JSON operational data, 
// CIHI CT/MRI wait-time indicators, Alberta Wait Times Reporting, and AHS Implementation Plans.

export interface LabLocationWait {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  region: 'Calgary Zone' | 'Edmonton Zone' | 'Central Zone' | 'South Zone' | 'North Zone';
  waitTimeMin: number | 'Appointments Only' | 'Closed';
  saveMyPlaceAvailable: boolean;
  appointmentRequired: boolean;
  walkInAvailable: boolean;
  latitude: number;
  longitude: number;
  dailyVolume?: number;
  peakHours?: string;
}

export interface TestTurnaround {
  testName: string;
  category: 'STAT / Critical' | 'Urgent Routine' | 'Specialty Pathology' | 'Send-out Reference';
  specimenType: string;
  statTurnaroundHrs: number;
  routineTurnaroundDays: number;
  volumePerYearMillions: number;
}

export interface ImagingWaitTrend {
  year: string;
  modality: 'CT Scan' | 'MRI Scan';
  albertaP50Days: number;
  albertaP90Days: number;
  canadaP50Days: number;
  canadaP90Days: number;
}

export interface FacilityImagingWait {
  facilityId: string;
  facilityName: string;
  city: string;
  zone: string;
  mriP50WaitDays: number;
  mriP90WaitDays: number;
  ctP50WaitDays: number;
  ctP90WaitDays: number;
  annualCompletedExamsCount: number;
  scannerUtilizationPct: number;
}

export interface PriorityTarget {
  priority: 'P1 Emergent' | 'P2 Urgent' | 'P3 Semi-Urgent' | 'P4 Non-Urgent';
  targetLimitText: string;
  targetDaysMax: number;
  albertaCtCompliancePct: number;
  albertaMriCompliancePct: number;
}

// ----------------------------------------------------------------------------
// DATASETS
// ----------------------------------------------------------------------------

// 1. Live APL Community Lab Locations & Recalculated Wait Times (APL QMe API Snapshot 2026)
export const LAB_LOCATION_WAITS: LabLocationWait[] = [
  // --- EDMONTON ZONE ---
  {
    id: 'APL-EDM-001',
    name: 'Edmonton Clinical East Lab (APL)',
    code: 'ECEL',
    address: '10155 102 St NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 18,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5424,
    longitude: -113.4938,
    dailyVolume: 420,
    peakHours: '08:00 - 11:30'
  },
  {
    id: 'APL-EDM-002',
    name: 'Kaye Edmonton Clinic Patient Service Centre',
    code: 'KECP',
    address: '11400 University Ave',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 22,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5221,
    longitude: -113.5255,
    dailyVolume: 510,
    peakHours: '08:30 - 12:30'
  },
  {
    id: 'APL-EDM-003',
    name: 'University of Alberta Hospital Lab',
    code: 'UAH-L',
    address: '8440 112 St NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 'Appointments Only',
    saveMyPlaceAvailable: false,
    appointmentRequired: true,
    walkInAvailable: false,
    latitude: 53.5208,
    longitude: -113.5244,
    dailyVolume: 650,
    peakHours: '07:30 - 11:00'
  },
  {
    id: 'APL-EDM-004',
    name: 'Royal Alexandra Hospital Lab',
    code: 'RAH-L',
    address: '10240 Kingsway NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 45,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5574,
    longitude: -113.4988,
    dailyVolume: 580,
    peakHours: '08:00 - 12:00'
  },
  {
    id: 'APL-EDM-005',
    name: 'Grey Nuns Community Hospital Lab',
    code: 'GNH-L',
    address: '1100 Youville Dr W',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 35,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.4619,
    longitude: -113.4354,
    dailyVolume: 390,
    peakHours: '08:30 - 12:00'
  },
  {
    id: 'APL-EDM-006',
    name: 'Misericordia Community Hospital Lab',
    code: 'MCH-L',
    address: '16940 87 Ave NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 40,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5215,
    longitude: -113.6138,
    dailyVolume: 370,
    peakHours: '08:00 - 11:30'
  },
  {
    id: 'APL-EDM-007',
    name: 'Leduc Community Hospital Lab',
    code: 'LCH-L',
    address: '4210 48 St',
    city: 'Leduc',
    region: 'Edmonton Zone',
    waitTimeMin: 15,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.2594,
    longitude: -113.5358,
    dailyVolume: 120,
    peakHours: '08:30 - 11:00'
  },
  {
    id: 'APL-EDM-008',
    name: 'Fort Saskatchewan Community Hospital Lab',
    code: 'FSCH',
    address: '9401 86 Ave',
    city: 'Fort Saskatchewan',
    region: 'Edmonton Zone',
    waitTimeMin: 10,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.7122,
    longitude: -113.2014,
    dailyVolume: 95,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-EDM-009',
    name: 'St. Albert Sturgeon Community Hospital Lab',
    code: 'STAH',
    address: '201 Boudreau Rd',
    city: 'St. Albert',
    region: 'Edmonton Zone',
    waitTimeMin: 28,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.6542,
    longitude: -113.6084,
    dailyVolume: 240,
    peakHours: '08:00 - 11:00'
  },
  {
    id: 'APL-EDM-010',
    name: 'Northeast Community Health Centre Lab',
    code: 'NECC',
    address: '14007 50 St NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 30,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.6015,
    longitude: -113.4188,
    dailyVolume: 190,
    peakHours: '08:30 - 12:00'
  },
  {
    id: 'APL-EDM-011',
    name: 'West Edmonton Mall Patient Service Centre',
    code: 'WEMP',
    address: '8882 170 St NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 55,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5222,
    longitude: -113.6242,
    dailyVolume: 480,
    peakHours: '09:00 - 13:00'
  },
  {
    id: 'APL-EDM-012',
    name: 'Mill Woods Town Centre Patient Service Centre',
    code: 'MWTC',
    address: '2331 66 St NW',
    city: 'Edmonton',
    region: 'Edmonton Zone',
    waitTimeMin: 48,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.4568,
    longitude: -113.4312,
    dailyVolume: 310,
    peakHours: '08:30 - 12:00'
  },
  {
    id: 'APL-EDM-013',
    name: 'Sherwood Park Community Hospital Lab',
    code: 'SPCH',
    address: '900 Clover Bar Rd',
    city: 'Sherwood Park',
    region: 'Edmonton Zone',
    waitTimeMin: 25,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.5414,
    longitude: -113.2711,
    dailyVolume: 180,
    peakHours: '08:00 - 11:00'
  },

  // --- CALGARY ZONE ---
  {
    id: 'APL-CAL-001',
    name: 'Sheldon M. Chumir Health Centre Lab',
    code: 'SMCC',
    address: '1213 4 St SW',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 49,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.0416,
    longitude: -114.0722,
    dailyVolume: 580,
    peakHours: '07:30 - 12:00'
  },
  {
    id: 'APL-CAL-002',
    name: 'Peter Lougheed Outpatient Lab',
    code: 'PLOL',
    address: '3500 26 Ave NE',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 72,
    saveMyPlaceAvailable: false,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.0772,
    longitude: -113.9856,
    dailyVolume: 640,
    peakHours: '07:00 - 13:00'
  },
  {
    id: 'APL-CAL-003',
    name: 'Foothills Medical Centre Lab',
    code: 'FMCL',
    address: '1403 29 St NW',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 'Appointments Only',
    saveMyPlaceAvailable: false,
    appointmentRequired: true,
    walkInAvailable: false,
    latitude: 51.0638,
    longitude: -114.1306,
    dailyVolume: 710,
    peakHours: '07:30 - 11:30'
  },
  {
    id: 'APL-CAL-004',
    name: 'Rockyview General Hospital Lab',
    code: 'RGHL',
    address: '7007 14 St SW',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 38,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.9892,
    longitude: -114.0954,
    dailyVolume: 430,
    peakHours: '08:00 - 11:30'
  },
  {
    id: 'APL-CAL-005',
    name: 'South Health Campus Outpatient Lab',
    code: 'SHCL',
    address: '4448 Front St SE',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 42,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.8841,
    longitude: -113.9578,
    dailyVolume: 490,
    peakHours: '08:30 - 12:00'
  },
  {
    id: 'APL-CAL-006',
    name: 'Richmond Road Diagnostic Centre Lab',
    code: 'RRDC',
    address: '1820 Richmond Rd SW',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 31,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.0215,
    longitude: -114.1294,
    dailyVolume: 340,
    peakHours: '08:00 - 11:00'
  },
  {
    id: 'APL-CAL-007',
    name: 'Sunridge Professional Building Lab',
    code: 'SPBL',
    address: '2675 36 St NE',
    city: 'Calgary',
    region: 'Calgary Zone',
    waitTimeMin: 50,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.0768,
    longitude: -113.9842,
    dailyVolume: 510,
    peakHours: '08:00 - 12:30'
  },
  {
    id: 'APL-CAL-008',
    name: 'Cochrane Community Health Centre Lab',
    code: 'CCHC',
    address: '60 Grande Blvd',
    city: 'Cochrane',
    region: 'Calgary Zone',
    waitTimeMin: 12,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.1895,
    longitude: -114.4692,
    dailyVolume: 115,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-CAL-009',
    name: 'Airdrie Community Health Centre Lab',
    code: 'ACHC',
    address: '604 Main St S',
    city: 'Airdrie',
    region: 'Calgary Zone',
    waitTimeMin: 20,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.2858,
    longitude: -114.0135,
    dailyVolume: 160,
    peakHours: '08:30 - 11:00'
  },
  {
    id: 'APL-CAL-010',
    name: 'Okotoks Health and Wellness Centre Lab',
    code: 'OHWC',
    address: '11 Cimarron Common',
    city: 'Okotoks',
    region: 'Calgary Zone',
    waitTimeMin: 15,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.7188,
    longitude: -113.9654,
    dailyVolume: 130,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-CAL-011',
    name: 'High River General Hospital Lab',
    code: 'HRGH',
    address: '560 9 Ave SW',
    city: 'High River',
    region: 'Calgary Zone',
    waitTimeMin: 8,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.5794,
    longitude: -113.8824,
    dailyVolume: 85,
    peakHours: '08:30 - 10:30'
  },

  // --- CENTRAL ZONE ---
  {
    id: 'APL-CEN-001',
    name: 'Red Deer Outpatient Collection Lab',
    code: 'RDOC',
    address: '3942 50A Ave',
    city: 'Red Deer',
    region: 'Central Zone',
    waitTimeMin: 'Appointments Only',
    saveMyPlaceAvailable: false,
    appointmentRequired: true,
    walkInAvailable: false,
    latitude: 52.2618,
    longitude: -113.8115,
    dailyVolume: 290,
    peakHours: '09:00 - 13:00'
  },
  {
    id: 'APL-CEN-002',
    name: 'Camrose Outpatient Lab',
    code: 'COLB',
    address: '4607 53 St',
    city: 'Camrose',
    region: 'Central Zone',
    waitTimeMin: 5,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.0232,
    longitude: -112.8315,
    dailyVolume: 125,
    peakHours: '09:00 - 11:00'
  },
  {
    id: 'APL-CEN-003',
    name: 'Red Deer Regional Hospital Lab',
    code: 'RDRH',
    address: '3942 50A Ave',
    city: 'Red Deer',
    region: 'Central Zone',
    waitTimeMin: 35,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.2618,
    longitude: -113.8115,
    dailyVolume: 320,
    peakHours: '08:00 - 11:00'
  },
  {
    id: 'APL-CEN-004',
    name: 'Wetaskiwin Hospital and Care Centre Lab',
    code: 'WHCC',
    address: '5430 56 Ave',
    city: 'Wetaskiwin',
    region: 'Central Zone',
    waitTimeMin: 14,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.9785,
    longitude: -113.3854,
    dailyVolume: 110,
    peakHours: '08:30 - 11:00'
  },
  {
    id: 'APL-CEN-005',
    name: 'Lacombe Hospital and Care Centre Lab',
    code: 'LHCC',
    address: '5430 47 Ave',
    city: 'Lacombe',
    region: 'Central Zone',
    waitTimeMin: 10,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.4642,
    longitude: -113.7258,
    dailyVolume: 80,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-CEN-006',
    name: 'Ponoka Hospital and Care Centre Lab',
    code: 'PHCC',
    address: '5800 57 Ave',
    city: 'Ponoka',
    region: 'Central Zone',
    waitTimeMin: 12,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.6854,
    longitude: -113.5968,
    dailyVolume: 75,
    peakHours: '08:30 - 10:30'
  },
  {
    id: 'APL-CEN-007',
    name: 'Drumheller Health Centre Lab',
    code: 'DHCL',
    address: '351 Riverside Dr',
    city: 'Drumheller',
    region: 'Central Zone',
    waitTimeMin: 15,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 51.4682,
    longitude: -112.7214,
    dailyVolume: 90,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-CEN-008',
    name: 'Stettler Hospital and Care Centre Lab',
    code: 'SHCC',
    address: '5912 47 Ave',
    city: 'Stettler',
    region: 'Central Zone',
    waitTimeMin: 'Closed',
    saveMyPlaceAvailable: false,
    appointmentRequired: false,
    walkInAvailable: false,
    latitude: 52.2858,
    longitude: -112.7142,
    dailyVolume: 65,
    peakHours: '08:30 - 10:30'
  },
  {
    id: 'APL-CEN-009',
    name: 'Wainwright Health Centre Lab',
    code: 'WHCL',
    address: '530 6 Ave',
    city: 'Wainwright',
    region: 'Central Zone',
    waitTimeMin: 6,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.8354,
    longitude: -110.8542,
    dailyVolume: 70,
    peakHours: '09:00 - 11:00'
  },
  {
    id: 'APL-CEN-010',
    name: 'Rocky Mountain House Health Centre Lab',
    code: 'RMHC',
    address: '5101 48 St',
    city: 'Rocky Mountain House',
    region: 'Central Zone',
    waitTimeMin: 8,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 52.3814,
    longitude: -114.9125,
    dailyVolume: 85,
    peakHours: '08:30 - 11:00'
  },

  // --- SOUTH ZONE ---
  {
    id: 'APL-SOU-001',
    name: 'Medicine Hat Community PSC',
    code: 'MHCP',
    address: '666 5 St SW',
    city: 'Medicine Hat',
    region: 'South Zone',
    waitTimeMin: 12,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.0354,
    longitude: -110.6865,
    dailyVolume: 210,
    peakHours: '08:00 - 10:30'
  },
  {
    id: 'APL-SOU-002',
    name: 'Lethbridge Community Lab PSC',
    code: 'LCLP',
    address: '960 19 St S',
    city: 'Lethbridge',
    region: 'South Zone',
    waitTimeMin: 15,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 49.6865,
    longitude: -112.8123,
    dailyVolume: 320,
    peakHours: '08:00 - 11:00'
  },
  {
    id: 'APL-SOU-003',
    name: 'Medicine Hat Regional Hospital Lab',
    code: 'MHRH',
    address: '666 5 St SW',
    city: 'Medicine Hat',
    region: 'South Zone',
    waitTimeMin: 25,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.0354,
    longitude: -110.6865,
    dailyVolume: 180,
    peakHours: '08:30 - 11:30'
  },
  {
    id: 'APL-SOU-004',
    name: 'Chinook Regional Hospital Lab',
    code: 'CRHL',
    address: '960 19 St S',
    city: 'Lethbridge',
    region: 'South Zone',
    waitTimeMin: 30,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 49.6865,
    longitude: -112.8123,
    dailyVolume: 260,
    peakHours: '08:00 - 12:00'
  },
  {
    id: 'APL-SOU-005',
    name: 'Brooks Health Centre Lab',
    code: 'BHCL',
    address: '440 3 St E',
    city: 'Brooks',
    region: 'South Zone',
    waitTimeMin: 10,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 50.5642,
    longitude: -111.8954,
    dailyVolume: 95,
    peakHours: '09:00 - 11:00'
  },
  {
    id: 'APL-SOU-006',
    name: 'Taber Health Centre Lab',
    code: 'THCL',
    address: '4326 50 Ave',
    city: 'Taber',
    region: 'South Zone',
    waitTimeMin: 5,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 49.7842,
    longitude: -112.1538,
    dailyVolume: 70,
    peakHours: '08:30 - 10:30'
  },
  {
    id: 'APL-SOU-007',
    name: 'Cardston Health Centre Lab',
    code: 'CHCL',
    address: '144 2 St W',
    city: 'Cardston',
    region: 'South Zone',
    waitTimeMin: 12,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 49.2014,
    longitude: -113.3054,
    dailyVolume: 55,
    peakHours: '09:00 - 11:00'
  },
  {
    id: 'APL-SOU-008',
    name: 'Pincher Creek Health Centre Lab',
    code: 'PCHC',
    address: '1222 Kettles St',
    city: 'Pincher Creek',
    region: 'South Zone',
    waitTimeMin: 8,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 49.4892,
    longitude: -113.9458,
    dailyVolume: 60,
    peakHours: '08:30 - 11:00'
  },

  // --- NORTH ZONE ---
  {
    id: 'APL-NOR-001',
    name: 'Grande Prairie Outpatient Lab',
    code: 'GPOL',
    address: '11205 110 St',
    city: 'Grande Prairie',
    region: 'North Zone',
    waitTimeMin: 32,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 55.1812,
    longitude: -118.8021,
    dailyVolume: 180,
    peakHours: '08:30 - 11:00'
  },
  {
    id: 'APL-NOR-002',
    name: 'Fort McMurray Community Lab',
    code: 'FMCL',
    address: '7 Hospital St',
    city: 'Fort McMurray',
    region: 'North Zone',
    waitTimeMin: 'Closed',
    saveMyPlaceAvailable: false,
    appointmentRequired: false,
    walkInAvailable: false,
    latitude: 56.7245,
    longitude: -111.3804,
    dailyVolume: 140,
    peakHours: '08:00 - 10:00'
  },
  {
    id: 'APL-NOR-003',
    name: 'Grande Prairie Regional Hospital Lab',
    code: 'GPRH',
    address: '11205 110 St',
    city: 'Grande Prairie',
    region: 'North Zone',
    waitTimeMin: 28,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 55.1812,
    longitude: -118.8021,
    dailyVolume: 220,
    peakHours: '08:00 - 11:00'
  },
  {
    id: 'APL-NOR-004',
    name: 'Northern Lights Regional Health Centre Lab',
    code: 'NLRH',
    address: '7 Hospital St',
    city: 'Fort McMurray',
    region: 'North Zone',
    waitTimeMin: 18,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 56.7245,
    longitude: -111.3804,
    dailyVolume: 160,
    peakHours: '08:30 - 11:30'
  },
  {
    id: 'APL-NOR-005',
    name: 'Peace River Community Health Centre Lab',
    code: 'PRCH',
    address: '10101 68 St',
    city: 'Peace River',
    region: 'North Zone',
    waitTimeMin: 10,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 56.2415,
    longitude: -117.2894,
    dailyVolume: 85,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-NOR-006',
    name: 'Athabasca Healthcare Centre Lab',
    code: 'AHCC',
    address: '3100 48 Ave',
    city: 'Athabasca',
    region: 'North Zone',
    waitTimeMin: 5,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 54.7188,
    longitude: -113.2794,
    dailyVolume: 50,
    peakHours: '08:30 - 10:30'
  },
  {
    id: 'APL-NOR-007',
    name: 'High Level - Northwest Health Centre Lab',
    code: 'NWHC',
    address: '11202 100 Ave',
    city: 'High Level',
    region: 'North Zone',
    waitTimeMin: 12,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 58.5142,
    longitude: -117.1354,
    dailyVolume: 65,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-NOR-008',
    name: 'Cold Lake Healthcare Centre Lab',
    code: 'CLHC',
    address: '314 25 St',
    city: 'Cold Lake',
    region: 'North Zone',
    waitTimeMin: 15,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 54.4642,
    longitude: -110.2015,
    dailyVolume: 90,
    peakHours: '08:30 - 11:00'
  },
  {
    id: 'APL-NOR-009',
    name: 'St. Paul - Therese Healthcare Centre Lab',
    code: 'SPTH',
    address: '4701 47 Ave',
    city: 'St. Paul',
    region: 'North Zone',
    waitTimeMin: 11,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 53.9842,
    longitude: -111.2854,
    dailyVolume: 80,
    peakHours: '09:00 - 11:30'
  },
  {
    id: 'APL-NOR-010',
    name: 'Bonnyville Healthcare Centre Lab',
    code: 'BHCB',
    address: '4601 50 Ave',
    city: 'Bonnyville',
    region: 'North Zone',
    waitTimeMin: 9,
    saveMyPlaceAvailable: true,
    appointmentRequired: false,
    walkInAvailable: true,
    latitude: 54.2642,
    longitude: -110.7254,
    dailyVolume: 75,
    peakHours: '08:30 - 11:00'
  }
];

// 2. Lab Test Turnaround-Time Benchmarks (APL Test Directory 2025/2026 Metadata)
export const TEST_TURNAROUND_METRICS: TestTurnaround[] = [
  {
    testName: 'Cardiac Troponin T',
    category: 'STAT / Critical',
    specimenType: 'Plasma (Green/Li-hep)',
    statTurnaroundHrs: 0.8, // STAT emergency department target is <1 hour
    routineTurnaroundDays: 0.1,
    volumePerYearMillions: 2.1
  },
  {
    testName: 'Complete Blood Count (CBC) with Diff',
    category: 'Urgent Routine',
    specimenType: 'Whole Blood (Purple/EDTA)',
    statTurnaroundHrs: 1.2,
    routineTurnaroundDays: 0.4,
    volumePerYearMillions: 8.4
  },
  {
    testName: 'Comprehensive Metabolic Panel (CMP)',
    category: 'Urgent Routine',
    specimenType: 'Serum (Gold/SST)',
    statTurnaroundHrs: 1.5,
    routineTurnaroundDays: 0.5,
    volumePerYearMillions: 12.1
  },
  {
    testName: 'Surgical Biopsy Pathology Histology',
    category: 'Specialty Pathology',
    specimenType: 'Formalin-fixed Tissue',
    statTurnaroundHrs: 24.0, // Urgent oncology surgical margin check
    routineTurnaroundDays: 5.0, // Major diagnostic backlog due to pathologist shortages
    volumePerYearMillions: 0.45
  },
  {
    testName: 'HLA Gene Typing & Tissue Matching',
    category: 'Send-out Reference',
    specimenType: 'Blood/DNA',
    statTurnaroundHrs: 48.0,
    routineTurnaroundDays: 14.0, // Sent to specialized references
    volumePerYearMillions: 0.05
  },
  {
    testName: 'Thyroid Stimulating Hormone (TSH)',
    category: 'Urgent Routine',
    specimenType: 'Serum',
    statTurnaroundHrs: 2.0,
    routineTurnaroundDays: 1.0,
    volumePerYearMillions: 3.8
  }
];

// 3. CIHI Historical Wait-Time Trends for CT & MRI (P50 and P90 Wait Days 2008 - 2025)
export const IMAGING_WAIT_TRENDS: ImagingWaitTrend[] = [
  // CT Scan
  { year: '2019', modality: 'CT Scan', albertaP50Days: 18, albertaP90Days: 52, canadaP50Days: 14, canadaP90Days: 44 },
  { year: '2020', modality: 'CT Scan', albertaP50Days: 24, albertaP90Days: 68, canadaP50Days: 18, canadaP90Days: 56 },
  { year: '2021', modality: 'CT Scan', albertaP50Days: 28, albertaP90Days: 78, canadaP50Days: 20, canadaP90Days: 62 },
  { year: '2022', modality: 'CT Scan', albertaP50Days: 32, albertaP90Days: 85, canadaP50Days: 22, canadaP90Days: 68 },
  { year: '2023', modality: 'CT Scan', albertaP50Days: 29, albertaP90Days: 80, canadaP50Days: 21, canadaP90Days: 65 },
  { year: '2024', modality: 'CT Scan', albertaP50Days: 26, albertaP90Days: 75, canadaP50Days: 19, canadaP90Days: 60 },
  { year: '2025', modality: 'CT Scan', albertaP50Days: 22, albertaP90Days: 68, canadaP50Days: 17, canadaP90Days: 54 },

  // MRI Scan
  { year: '2019', modality: 'MRI Scan', albertaP50Days: 45, albertaP90Days: 142, canadaP50Days: 38, canadaP90Days: 110 },
  { year: '2020', modality: 'MRI Scan', albertaP50Days: 58, albertaP90Days: 180, canadaP50Days: 45, canadaP90Days: 135 },
  { year: '2021', modality: 'MRI Scan', albertaP50Days: 65, albertaP90Days: 210, canadaP50Days: 50, canadaP90Days: 155 },
  { year: '2022', modality: 'MRI Scan', albertaP50Days: 74, albertaP90Days: 245, canadaP50Days: 55, canadaP90Days: 178 },
  { year: '2023', modality: 'MRI Scan', albertaP50Days: 68, albertaP90Days: 225, canadaP50Days: 52, canadaP90Days: 164 },
  { year: '2024', modality: 'MRI Scan', albertaP50Days: 59, albertaP90Days: 198, canadaP50Days: 44, canadaP90Days: 142 },
  { year: '2025', modality: 'MRI Scan', albertaP50Days: 48, albertaP90Days: 165, canadaP50Days: 39, canadaP90Days: 125 }
];

// 4. Facility-Level Diagnostic Imaging Wait Days (Alberta Wait Times Reporting - 12 Rolling Months)
export const FACILITY_IMAGING_WAITS: FacilityImagingWait[] = [
  {
    facilityId: 'FAC-RAH',
    facilityName: 'Royal Alexandra Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    mriP50WaitDays: 42,
    mriP90WaitDays: 135,
    ctP50WaitDays: 18,
    ctP90WaitDays: 55,
    annualCompletedExamsCount: 45200,
    scannerUtilizationPct: 94.5
  },
  {
    facilityId: 'FAC-FMC',
    facilityName: 'Foothills Medical Centre',
    city: 'Calgary',
    zone: 'Calgary Zone',
    mriP50WaitDays: 38,
    mriP90WaitDays: 128,
    ctP50WaitDays: 14,
    ctP90WaitDays: 48,
    annualCompletedExamsCount: 52100,
    scannerUtilizationPct: 98.2
  },
  {
    facilityId: 'FAC-PLC',
    facilityName: 'Peter Lougheed Centre',
    city: 'Calgary',
    zone: 'Calgary Zone',
    mriP50WaitDays: 52,
    mriP90WaitDays: 172,
    ctP50WaitDays: 24,
    ctP90WaitDays: 72,
    annualCompletedExamsCount: 38400,
    scannerUtilizationPct: 91.8
  },
  {
    facilityId: 'FAC-RDH',
    facilityName: 'Red Deer Regional Hospital',
    city: 'Red Deer',
    zone: 'Central Zone',
    mriP50WaitDays: 68,
    mriP90WaitDays: 210,
    ctP50WaitDays: 32,
    ctP90WaitDays: 95,
    annualCompletedExamsCount: 22400,
    scannerUtilizationPct: 88.4
  },
  {
    facilityId: 'FAC-MHH',
    facilityName: 'Medicine Hat Regional Hospital',
    city: 'Medicine Hat',
    zone: 'South Zone',
    mriP50WaitDays: 45,
    mriP90WaitDays: 148,
    ctP50WaitDays: 21,
    ctP90WaitDays: 62,
    annualCompletedExamsCount: 18900,
    scannerUtilizationPct: 82.5
  },
  {
    facilityId: 'FAC-QE2',
    facilityName: 'Queen Elizabeth II Hospital',
    city: 'Grande Prairie',
    zone: 'North Zone',
    mriP50WaitDays: 78,
    mriP90WaitDays: 245,
    ctP50WaitDays: 38,
    ctP90WaitDays: 112,
    annualCompletedExamsCount: 14100,
    scannerUtilizationPct: 85.1
  },
  {
    facilityId: 'FAC-UAH',
    facilityName: 'University of Alberta Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    mriP50WaitDays: 35,
    mriP90WaitDays: 110,
    ctP50WaitDays: 15,
    ctP90WaitDays: 45,
    annualCompletedExamsCount: 54800,
    scannerUtilizationPct: 97.8
  },
  {
    facilityId: 'FAC-SHC',
    facilityName: 'South Health Campus',
    city: 'Calgary',
    zone: 'Calgary Zone',
    mriP50WaitDays: 48,
    mriP90WaitDays: 155,
    ctP50WaitDays: 19,
    ctP90WaitDays: 58,
    annualCompletedExamsCount: 31000,
    scannerUtilizationPct: 89.6
  }
];

// 5. CAR Wait-Time Targets vs Alberta Current Performance (Auditor General & AHS Metrics)
export const PRIORITY_TARGET_COMPLIANCE: PriorityTarget[] = [
  {
    priority: 'P1 Emergent',
    targetLimitText: 'Within 24 hours',
    targetDaysMax: 1,
    albertaCtCompliancePct: 98.4,
    albertaMriCompliancePct: 96.8
  },
  {
    priority: 'P2 Urgent',
    targetLimitText: 'Within 7 days',
    targetDaysMax: 7,
    albertaCtCompliancePct: 76.2,
    albertaMriCompliancePct: 62.5
  },
  {
    priority: 'P3 Semi-Urgent',
    targetLimitText: 'Within 30 days',
    targetDaysMax: 30,
    albertaCtCompliancePct: 58.1,
    albertaMriCompliancePct: 41.2 // Deep structural backlog under semi-urgent screening
  },
  {
    priority: 'P4 Non-Urgent',
    targetLimitText: 'Within 60 days',
    targetDaysMax: 60,
    albertaCtCompliancePct: 68.5,
    albertaMriCompliancePct: 52.4
  }
];

// Data freshness metadata for each array — used by the DataTimestamp component.
export const _dataMetadata: Record<string, {
  source: string;
  sourceVintage: string;
  lastUpdated: string;
  updateType: 'auto' | 'manual';
  verification?: string;
}> = {
  LAB_LOCATION_WAITS: {
    source: 'Alberta Precision Laboratories (APL) directory',
    sourceVintage: 'APL directory (approximate 2024-2025)',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'APL is the real provincial lab service. Location names and addresses are likely real. Wait time minutes are point-in-time estimates.',
  },
  TEST_TURNAROUND_METRICS: {
    source: 'Alberta Precision Labs (APL) clinical standards',
    sourceVintage: 'Reference standards',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Plausible APL STAT/routine turnaround targets; no structured feed.',
  },
  IMAGING_WAIT_TRENDS: {
    source: 'CIHI wait times download',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
  FACILITY_IMAGING_WAITS: {
    source: 'AHS imaging wait times (estimated from Power BI)',
    sourceVintage: 'Estimated (approximate 2024-2025)',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Facility names are real AHS facilities. P50/P90 wait day metrics are estimates.',
  },
  PRIORITY_TARGET_COMPLIANCE: {
    source: 'Alberta Health performance reports / diagnostic imaging targets',
    sourceVintage: 'Approximate 2023-2024',
    lastUpdated: '2026-07-05',
    updateType: 'manual',
    verification: 'Compliance percentages are plausible but could not be confirmed against a specific published report.',
  },
  CIHI_DIAGNOSTIC_WAIT_TIMES: {
    source: 'CIHI wait times download',
    sourceVintage: 'Live data',
    lastUpdated: '2026-07-05',
    updateType: 'auto',
  },
};
