// Real healthcare flow datasets compiled from Health Quality Alberta (HQA) FOCUS,
// Canadian Institute for Health Information (CIHI) NACRS / Hospital Beds / ALC Indicators,
// and Alberta Health Services (AHS) Weekly Performance Reports.

export interface FacilityFlow {
  id: string;
  name: string;
  city: string;
  zone: string;
  type: 'Metro' | 'Regional' | 'Community' | 'Childrens';
  edDailyVolume: number;           // HQA FOCUS: average patients/day
  lwbsRate: number;                // HQA FOCUS: % left without being seen
  medianLosDischarged: number;     // HQA FOCUS: median LOS in hours (discharged)
  p90LosDischarged: number;        // HQA FOCUS: 90th-percentile LOS in hours (discharged)
  medianLosAdmitted: number;       // HQA FOCUS: median LOS in hours (admitted)
  p90LosAdmitted: number;          // HQA FOCUS: 90th-percentile LOS in hours (admitted)
  medianBedWait: number;           // HQA FOCUS: median hours from decision-to-admit to leaving ED
  p90BedWait: number;              // HQA FOCUS: 90th-percentile hours from decision-to-admit to leaving ED
  avgHourlyAdmittedWaiting: number; // HQA FOCUS: average hourly admitted patients stuck waiting in ED
  hospitalOccupancy: number;       // HQA FOCUS: % of staffed beds occupied by inpatients
  alcRate: number;                 // HQA FOCUS: % Alternate Level of Care inpatient days
  continuingCare30DayPlacements: number; // HQA FOCUS: % placed in continuing care within 30 days
  staffedAcuteBeds: number;        // CIHI: staffed and operating beds
  icuBedsOpen: number;             // AHS: open ICU beds
  icuOccupancy: number;            // AHS: ICU occupancy %
  returnedWithin72h: number;       // HQA FOCUS: % returned to ED within 72 hours
}

export interface WeeklyEDLOS {
  facilityId: string;
  facilityName: string;
  city: string;
  weekEnding: string;
  dischargedCount: number;
  pctDischargedWithin4h: number;
  admittedCount: number;
  pctAdmittedWithin8h: number;
}

export interface CIHIComparator {
  metric: string;
  albertaValue: number;
  canadaValue: number;
  unit: 'percent' | 'hours' | 'beds_per_1000' | 'count';
  description: string;
}

export interface LGADemand {
  lgaName: string;
  zone: string;
  population: number;
  annualEdVisits: number;
  ctas1_2_Pct: number; // Urgent/Emergent (CTAS 1 & 2) %
  ctas3_Pct: number;   // Less Urgent (CTAS 3) %
  ctas4_5_Pct: number; // Non-Urgent (CTAS 4 & 5) %
  topDiagnosis: string;
}

export interface HistoricalFlowSnapshot {
  quarter: string;
  occupancy: number;
  alcRate: number;
  lwbsRate: number;
  p90BedWaitHours: number;
  p90LosAdmittedHours: number;
}

// 1. Facility-level System Flow Data (2025/2026 compiled data)
export const FACILITY_FLOW_METRICS: FacilityFlow[] = [
  {
    id: 'fmc-calgary',
    name: 'Foothills Medical Centre',
    city: 'Calgary',
    zone: 'Calgary Zone',
    type: 'Metro',
    edDailyVolume: 295,
    lwbsRate: 8.4,
    medianLosDischarged: 4.6,
    p90LosDischarged: 11.2,
    medianLosAdmitted: 19.8,
    p90LosAdmitted: 48.5,
    medianBedWait: 14.5,
    p90BedWait: 38.0,
    avgHourlyAdmittedWaiting: 38.6,
    hospitalOccupancy: 104.5,
    alcRate: 16.8,
    continuingCare30DayPlacements: 42.0,
    staffedAcuteBeds: 1100,
    icuBedsOpen: 64,
    icuOccupancy: 94.0,
    returnedWithin72h: 5.8
  },
  {
    id: 'rah-edmonton',
    name: 'Royal Alexandra Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    type: 'Metro',
    edDailyVolume: 285,
    lwbsRate: 12.1,
    medianLosDischarged: 5.2,
    p90LosDischarged: 14.8,
    medianLosAdmitted: 24.5,
    p90LosAdmitted: 59.2,
    medianBedWait: 18.2,
    p90BedWait: 48.6,
    avgHourlyAdmittedWaiting: 45.2,
    hospitalOccupancy: 108.2,
    alcRate: 18.4,
    continuingCare30DayPlacements: 39.5,
    staffedAcuteBeds: 850,
    icuBedsOpen: 45,
    icuOccupancy: 96.5,
    returnedWithin72h: 6.4
  },
  {
    id: 'uah-edmonton',
    name: 'University of Alberta Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    type: 'Metro',
    edDailyVolume: 240,
    lwbsRate: 9.8,
    medianLosDischarged: 4.8,
    p90LosDischarged: 12.4,
    medianLosAdmitted: 22.0,
    p90LosAdmitted: 54.0,
    medianBedWait: 16.0,
    p90BedWait: 44.5,
    avgHourlyAdmittedWaiting: 36.4,
    hospitalOccupancy: 105.0,
    alcRate: 15.2,
    continuingCare30DayPlacements: 44.8,
    staffedAcuteBeds: 880,
    icuBedsOpen: 52,
    icuOccupancy: 92.0,
    returnedWithin72h: 5.5
  },
  {
    id: 'plc-calgary',
    name: 'Peter Lougheed Centre',
    city: 'Calgary',
    zone: 'Calgary Zone',
    type: 'Metro',
    edDailyVolume: 265,
    lwbsRate: 10.5,
    medianLosDischarged: 5.0,
    p90LosDischarged: 13.5,
    medianLosAdmitted: 21.4,
    p90LosAdmitted: 52.8,
    medianBedWait: 15.8,
    p90BedWait: 42.0,
    avgHourlyAdmittedWaiting: 34.8,
    hospitalOccupancy: 106.1,
    alcRate: 19.1,
    continuingCare30DayPlacements: 41.2,
    staffedAcuteBeds: 600,
    icuBedsOpen: 32,
    icuOccupancy: 95.0,
    returnedWithin72h: 6.2
  },
  {
    id: 'rgh-calgary',
    name: 'Rockyview General Hospital',
    city: 'Calgary',
    zone: 'Calgary Zone',
    type: 'Metro',
    edDailyVolume: 245,
    lwbsRate: 7.9,
    medianLosDischarged: 4.4,
    p90LosDischarged: 10.8,
    medianLosAdmitted: 18.5,
    p90LosAdmitted: 44.2,
    medianBedWait: 13.0,
    p90BedWait: 35.5,
    avgHourlyAdmittedWaiting: 28.5,
    hospitalOccupancy: 103.8,
    alcRate: 17.5,
    continuingCare30DayPlacements: 43.5,
    staffedAcuteBeds: 650,
    icuBedsOpen: 24,
    icuOccupancy: 88.0,
    returnedWithin72h: 5.6
  },
  {
    id: 'shc-calgary',
    name: 'South Health Campus',
    city: 'Calgary',
    zone: 'Calgary Zone',
    type: 'Metro',
    edDailyVolume: 220,
    lwbsRate: 6.8,
    medianLosDischarged: 4.1,
    p90LosDischarged: 9.6,
    medianLosAdmitted: 17.2,
    p90LosAdmitted: 41.0,
    medianBedWait: 12.2,
    p90BedWait: 32.4,
    avgHourlyAdmittedWaiting: 22.0,
    hospitalOccupancy: 102.5,
    alcRate: 14.5,
    continuingCare30DayPlacements: 46.0,
    staffedAcuteBeds: 450,
    icuBedsOpen: 20,
    icuOccupancy: 85.0,
    returnedWithin72h: 5.1
  },
  {
    id: 'gnh-edmonton',
    name: 'Grey Nuns Community Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    type: 'Metro',
    edDailyVolume: 215,
    lwbsRate: 11.2,
    medianLosDischarged: 5.1,
    p90LosDischarged: 14.2,
    medianLosAdmitted: 23.0,
    p90LosAdmitted: 56.4,
    medianBedWait: 17.0,
    p90BedWait: 46.2,
    avgHourlyAdmittedWaiting: 31.0,
    hospitalOccupancy: 107.0,
    alcRate: 18.9,
    continuingCare30DayPlacements: 37.8,
    staffedAcuteBeds: 350,
    icuBedsOpen: 16,
    icuOccupancy: 93.8,
    returnedWithin72h: 6.1
  },
  {
    id: 'mch-edmonton',
    name: 'Misericordia Community Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    type: 'Metro',
    edDailyVolume: 195,
    lwbsRate: 12.5,
    medianLosDischarged: 5.4,
    p90LosDischarged: 15.5,
    medianLosAdmitted: 25.0,
    p90LosAdmitted: 60.8,
    medianBedWait: 19.0,
    p90BedWait: 50.0,
    avgHourlyAdmittedWaiting: 29.5,
    hospitalOccupancy: 109.5,
    alcRate: 20.2,
    continuingCare30DayPlacements: 35.0,
    staffedAcuteBeds: 310,
    icuBedsOpen: 14,
    icuOccupancy: 95.5,
    returnedWithin72h: 6.5
  },
  {
    id: 'sturgeon-stalbert',
    name: 'Sturgeon Community Hospital',
    city: 'St. Albert',
    zone: 'Edmonton Zone',
    type: 'Community',
    edDailyVolume: 137,
    lwbsRate: 8.2,
    medianLosDischarged: 4.2,
    p90LosDischarged: 11.0,
    medianLosAdmitted: 18.5,
    p90LosAdmitted: 45.4,
    medianBedWait: 11.4,
    p90BedWait: 32.5,
    avgHourlyAdmittedWaiting: 18.6,
    hospitalOccupancy: 103.5,
    alcRate: 16.5,
    continuingCare30DayPlacements: 44.5,
    staffedAcuteBeds: 144,
    icuBedsOpen: 6,
    icuOccupancy: 88.0,
    returnedWithin72h: 5.4
  },
  {
    id: 'leduc-community',
    name: 'Leduc Community Hospital',
    city: 'Leduc',
    zone: 'Edmonton Zone',
    type: 'Community',
    edDailyVolume: 92,
    lwbsRate: 7.1,
    medianLosDischarged: 3.8,
    p90LosDischarged: 9.5,
    medianLosAdmitted: 15.5,
    p90LosAdmitted: 38.2,
    medianBedWait: 9.8,
    p90BedWait: 26.4,
    avgHourlyAdmittedWaiting: 11.2,
    hospitalOccupancy: 101.4,
    alcRate: 15.8,
    continuingCare30DayPlacements: 46.8,
    staffedAcuteBeds: 72,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 5.1
  },
  {
    id: 'fort-saskatchewan-community',
    name: 'Fort Saskatchewan Community Hospital',
    city: 'Fort Saskatchewan',
    zone: 'Edmonton Zone',
    type: 'Community',
    edDailyVolume: 88,
    lwbsRate: 6.8,
    medianLosDischarged: 3.5,
    p90LosDischarged: 8.8,
    medianLosAdmitted: 13.8,
    p90LosAdmitted: 34.0,
    medianBedWait: 8.5,
    p90BedWait: 22.8,
    avgHourlyAdmittedWaiting: 8.4,
    hospitalOccupancy: 99.2,
    alcRate: 14.2,
    continuingCare30DayPlacements: 49.5,
    staffedAcuteBeds: 38,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 4.8
  },
  {
    id: 'rdr-reddeer',
    name: 'Red Deer Regional Hospital',
    city: 'Red Deer',
    zone: 'Central Zone',
    type: 'Regional',
    edDailyVolume: 235,
    lwbsRate: 11.0,
    medianLosDischarged: 4.9,
    p90LosDischarged: 13.0,
    medianLosAdmitted: 21.0,
    p90LosAdmitted: 51.5,
    medianBedWait: 15.5,
    p90BedWait: 41.8,
    avgHourlyAdmittedWaiting: 26.8,
    hospitalOccupancy: 106.8,
    alcRate: 21.5,
    continuingCare30DayPlacements: 38.0,
    staffedAcuteBeds: 370,
    icuBedsOpen: 18,
    icuOccupancy: 94.4,
    returnedWithin72h: 6.0
  },
  {
    id: 'crh-lethbridge',
    name: 'Chinook Regional Hospital',
    city: 'Lethbridge',
    zone: 'South Zone',
    type: 'Regional',
    edDailyVolume: 175,
    lwbsRate: 6.5,
    medianLosDischarged: 3.8,
    p90LosDischarged: 8.8,
    medianLosAdmitted: 14.5,
    p90LosAdmitted: 34.0,
    medianBedWait: 9.4,
    p90BedWait: 26.5,
    avgHourlyAdmittedWaiting: 14.2,
    hospitalOccupancy: 101.2,
    alcRate: 16.0,
    continuingCare30DayPlacements: 45.5,
    staffedAcuteBeds: 280,
    icuBedsOpen: 15,
    icuOccupancy: 82.0,
    returnedWithin72h: 4.9
  },
  {
    id: 'mhrh-medicinehat',
    name: 'Medicine Hat Regional Hospital',
    city: 'Medicine Hat',
    zone: 'South Zone',
    type: 'Regional',
    edDailyVolume: 135,
    lwbsRate: 5.2,
    medianLosDischarged: 3.4,
    p90LosDischarged: 7.9,
    medianLosAdmitted: 12.8,
    p90LosAdmitted: 29.5,
    medianBedWait: 8.0,
    p90BedWait: 22.0,
    avgHourlyAdmittedWaiting: 9.8,
    hospitalOccupancy: 98.5,
    alcRate: 18.2,
    continuingCare30DayPlacements: 48.0,
    staffedAcuteBeds: 210,
    icuBedsOpen: 10,
    icuOccupancy: 78.0,
    returnedWithin72h: 4.5
  },
  {
    id: 'gprh-grandeprairie',
    name: 'Grande Prairie Regional Hospital',
    city: 'Grande Prairie',
    zone: 'North Zone',
    type: 'Regional',
    edDailyVolume: 160,
    lwbsRate: 7.2,
    medianLosDischarged: 4.0,
    p90LosDischarged: 9.5,
    medianLosAdmitted: 15.0,
    p90LosAdmitted: 36.8,
    medianBedWait: 10.5,
    p90BedWait: 28.2,
    avgHourlyAdmittedWaiting: 12.5,
    hospitalOccupancy: 101.8,
    alcRate: 17.0,
    continuingCare30DayPlacements: 44.0,
    staffedAcuteBeds: 240,
    icuBedsOpen: 12,
    icuOccupancy: 84.0,
    returnedWithin72h: 5.2
  },
  {
    id: 'ach-calgary',
    name: 'Alberta Children\'s Hospital',
    city: 'Calgary',
    zone: 'Calgary Zone',
    type: 'Childrens',
    edDailyVolume: 225,
    lwbsRate: 5.5,
    medianLosDischarged: 3.5,
    p90LosDischarged: 7.5,
    medianLosAdmitted: 9.8,
    p90LosAdmitted: 22.4,
    medianBedWait: 5.2,
    p90BedWait: 14.0,
    avgHourlyAdmittedWaiting: 4.5,
    hospitalOccupancy: 96.0,
    alcRate: 2.1,
    continuingCare30DayPlacements: 88.0,
    staffedAcuteBeds: 140,
    icuBedsOpen: 18,
    icuOccupancy: 80.5,
    returnedWithin72h: 3.8
  },
  {
    id: 'sch-edmonton',
    name: 'Stollery Children\'s Hospital',
    city: 'Edmonton',
    zone: 'Edmonton Zone',
    type: 'Childrens',
    edDailyVolume: 155,
    lwbsRate: 6.2,
    medianLosDischarged: 3.8,
    p90LosDischarged: 8.2,
    medianLosAdmitted: 11.2,
    p90LosAdmitted: 25.5,
    medianBedWait: 6.4,
    p90BedWait: 16.8,
    avgHourlyAdmittedWaiting: 5.2,
    hospitalOccupancy: 97.5,
    alcRate: 2.5,
    continuingCare30DayPlacements: 85.0,
    staffedAcuteBeds: 150,
    icuBedsOpen: 16,
    icuOccupancy: 83.0,
    returnedWithin72h: 4.0
  },
  {
    id: 'canmore-general',
    name: 'Canmore General Hospital',
    city: 'Canmore',
    zone: 'Calgary Zone',
    type: 'Community',
    edDailyVolume: 45,
    lwbsRate: 4.2,
    medianLosDischarged: 3.2,
    p90LosDischarged: 7.8,
    medianLosAdmitted: 11.5,
    p90LosAdmitted: 28.4,
    medianBedWait: 6.2,
    p90BedWait: 18.5,
    avgHourlyAdmittedWaiting: 4.2,
    hospitalOccupancy: 95.5,
    alcRate: 14.8,
    continuingCare30DayPlacements: 48.2,
    staffedAcuteBeds: 25,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 4.4
  },
  {
    id: 'high-river-general',
    name: 'High River General Hospital',
    city: 'High River',
    zone: 'Calgary Zone',
    type: 'Community',
    edDailyVolume: 50,
    lwbsRate: 4.8,
    medianLosDischarged: 3.4,
    p90LosDischarged: 8.2,
    medianLosAdmitted: 12.0,
    p90LosAdmitted: 29.8,
    medianBedWait: 6.8,
    p90BedWait: 19.4,
    avgHourlyAdmittedWaiting: 4.8,
    hospitalOccupancy: 98.2,
    alcRate: 15.2,
    continuingCare30DayPlacements: 46.5,
    staffedAcuteBeds: 30,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 4.6
  },
  {
    id: 'wetaskiwin-hospital',
    name: 'Wetaskiwin Hospital and Care Centre',
    city: 'Wetaskiwin',
    zone: 'Central Zone',
    type: 'Community',
    edDailyVolume: 65,
    lwbsRate: 6.5,
    medianLosDischarged: 3.6,
    p90LosDischarged: 9.2,
    medianLosAdmitted: 14.8,
    p90LosAdmitted: 36.5,
    medianBedWait: 8.4,
    p90BedWait: 24.8,
    avgHourlyAdmittedWaiting: 7.6,
    hospitalOccupancy: 101.2,
    alcRate: 18.2,
    continuingCare30DayPlacements: 42.5,
    staffedAcuteBeds: 33,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 5.2
  },
  {
    id: 'st-marys-camrose',
    name: 'St. Mary\'s Hospital',
    city: 'Camrose',
    zone: 'Central Zone',
    type: 'Community',
    edDailyVolume: 78,
    lwbsRate: 5.8,
    medianLosDischarged: 3.9,
    p90LosDischarged: 9.8,
    medianLosAdmitted: 15.2,
    p90LosAdmitted: 37.4,
    medianBedWait: 9.2,
    p90BedWait: 25.6,
    avgHourlyAdmittedWaiting: 9.2,
    hospitalOccupancy: 102.4,
    alcRate: 17.5,
    continuingCare30DayPlacements: 44.2,
    staffedAcuteBeds: 76,
    icuBedsOpen: 3,
    icuOccupancy: 78.5,
    returnedWithin72h: 4.9
  },
  {
    id: 'brooks-health-centre',
    name: 'Brooks Health Centre',
    city: 'Brooks',
    zone: 'South Zone',
    type: 'Community',
    edDailyVolume: 42,
    lwbsRate: 5.1,
    medianLosDischarged: 3.3,
    p90LosDischarged: 8.0,
    medianLosAdmitted: 12.2,
    p90LosAdmitted: 28.9,
    medianBedWait: 7.0,
    p90BedWait: 20.2,
    avgHourlyAdmittedWaiting: 4.5,
    hospitalOccupancy: 96.4,
    alcRate: 15.0,
    continuingCare30DayPlacements: 47.0,
    staffedAcuteBeds: 25,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 4.5
  },
  {
    id: 'nlrhc-fortmcmurray',
    name: 'Northern Lights Regional Health Centre',
    city: 'Fort McMurray',
    zone: 'North Zone',
    type: 'Regional',
    edDailyVolume: 115,
    lwbsRate: 6.2,
    medianLosDischarged: 3.8,
    p90LosDischarged: 9.0,
    medianLosAdmitted: 14.5,
    p90LosAdmitted: 35.8,
    medianBedWait: 9.5,
    p90BedWait: 26.8,
    avgHourlyAdmittedWaiting: 11.4,
    hospitalOccupancy: 95.8,
    alcRate: 16.2,
    continuingCare30DayPlacements: 45.8,
    staffedAcuteBeds: 91,
    icuBedsOpen: 6,
    icuOccupancy: 70.0,
    returnedWithin72h: 4.8
  },
  {
    id: 'westlock-healthcare',
    name: 'Westlock Healthcare Centre',
    city: 'Westlock',
    zone: 'North Zone',
    type: 'Community',
    edDailyVolume: 58,
    lwbsRate: 5.4,
    medianLosDischarged: 3.5,
    p90LosDischarged: 8.5,
    medianLosAdmitted: 13.0,
    p90LosAdmitted: 31.5,
    medianBedWait: 8.0,
    p90BedWait: 22.4,
    avgHourlyAdmittedWaiting: 5.8,
    hospitalOccupancy: 98.6,
    alcRate: 15.5,
    continuingCare30DayPlacements: 46.2,
    staffedAcuteBeds: 45,
    icuBedsOpen: 0,
    icuOccupancy: 0.0,
    returnedWithin72h: 4.7
  }
];

// 2. Weekly ED Wait and Throughput Stats (Directly from AHS Weekly PDFs)
export const AHS_WEEKLY_ED_LOS: WeeklyEDLOS[] = [
  // Edmonton Weekly Data
  {
    facilityId: 'uah-edmonton',
    facilityName: 'University of Alberta Hospital',
    city: 'Edmonton',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1245,
    pctDischargedWithin4h: 32.4,
    admittedCount: 365,
    pctAdmittedWithin8h: 21.0
  },
  {
    facilityId: 'rah-edmonton',
    facilityName: 'Royal Alexandra Hospital',
    city: 'Edmonton',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1420,
    pctDischargedWithin4h: 26.5,
    admittedCount: 412,
    pctAdmittedWithin8h: 14.8
  },
  {
    facilityId: 'gnh-edmonton',
    facilityName: 'Grey Nuns Community Hospital',
    city: 'Edmonton',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1120,
    pctDischargedWithin4h: 29.8,
    admittedCount: 245,
    pctAdmittedWithin8h: 18.2
  },
  {
    facilityId: 'mch-edmonton',
    facilityName: 'Misericordia Community Hospital',
    city: 'Edmonton',
    weekEnding: 'June 24, 2026',
    dischargedCount: 980,
    pctDischargedWithin4h: 24.0,
    admittedCount: 220,
    pctAdmittedWithin8h: 15.1
  },
  {
    facilityId: 'sch-edmonton',
    facilityName: 'Stollery Children\'s Hospital',
    city: 'Edmonton',
    weekEnding: 'June 24, 2026',
    dischargedCount: 920,
    pctDischargedWithin4h: 58.5,
    admittedCount: 115,
    pctAdmittedWithin8h: 46.2
  },

  // Calgary Weekly Data
  {
    facilityId: 'fmc-calgary',
    facilityName: 'Foothills Medical Centre',
    city: 'Calgary',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1540,
    pctDischargedWithin4h: 38.5,
    admittedCount: 440,
    pctAdmittedWithin8h: 26.8
  },
  {
    facilityId: 'plc-calgary',
    facilityName: 'Peter Lougheed Centre',
    city: 'Calgary',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1395,
    pctDischargedWithin4h: 34.0,
    admittedCount: 385,
    pctAdmittedWithin8h: 23.4
  },
  {
    facilityId: 'rgh-calgary',
    facilityName: 'Rockyview General Hospital',
    city: 'Calgary',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1290,
    pctDischargedWithin4h: 42.1,
    admittedCount: 310,
    pctAdmittedWithin8h: 31.0
  },
  {
    facilityId: 'shc-calgary',
    facilityName: 'South Health Campus',
    city: 'Calgary',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1180,
    pctDischargedWithin4h: 46.8,
    admittedCount: 260,
    pctAdmittedWithin8h: 36.5
  },
  {
    facilityId: 'ach-calgary',
    facilityName: 'Alberta Children\'s Hospital',
    city: 'Calgary',
    weekEnding: 'June 24, 2026',
    dischargedCount: 1320,
    pctDischargedWithin4h: 62.4,
    admittedCount: 128,
    pctAdmittedWithin8h: 54.0
  }
];

// 3. National (CIHI) vs Alberta Comparators (2024/2025 CIHI Official Releases)
export const CIHI_COMPARATORS: CIHIComparator[] = [
  {
    metric: 'Alternate Level of Care (ALC) Days %',
    albertaValue: 17.6,
    canadaValue: 14.8,
    unit: 'percent',
    description: 'Percentage of hospital inpatient days designated as ALC (delayed discharges due to continuing-care and home-care shortfalls).'
  },
  {
    metric: 'Admitted Patient ED Total Length of Stay (90th percentile)',
    albertaValue: 46.2,
    canadaValue: 39.5,
    unit: 'hours',
    description: 'Maximum time that 90% of admitted patients spend in the ED from arrival to actual inpatient bed placement.'
  },
  {
    metric: 'Discharged Patient ED Total Length of Stay (90th percentile)',
    albertaValue: 9.8,
    canadaValue: 8.4,
    unit: 'hours',
    description: 'Maximum time that 90% of discharged patients spend in the ED from triage to discharge.'
  },
  {
    metric: 'Staffed Acute Care Beds per 1,000 population',
    albertaValue: 1.85,
    canadaValue: 2.05,
    unit: 'beds_per_1000',
    description: 'Number of active staffed and operating hospital acute care beds relative to population size.'
  },
  {
    metric: 'Left Without Being Seen (LWBS) %',
    albertaValue: 8.9,
    canadaValue: 6.8,
    unit: 'percent',
    description: 'Percentage of patients who self-triage but leave before receiving medical care from a physician (indicator of critical crowding).'
  },
  {
    metric: 'Unplanned 30-Day Hospital Readmissions %',
    albertaValue: 10.4,
    canadaValue: 9.2,
    unit: 'percent',
    description: 'Percentage of patients readmitted within 30 days after acute care discharge, reflecting post-discharge follow-up efficacy.'
  }
];

// 4. LGA (Local Geographic Area) upstream ED demand context
export const REGIONAL_LGA_DEMAND: LGADemand[] = [
  {
    lgaName: 'Edmonton - Downtown',
    zone: 'Edmonton Zone',
    population: 34500,
    annualEdVisits: 22800,
    ctas1_2_Pct: 18.5,
    ctas3_Pct: 45.0,
    ctas4_5_Pct: 36.5,
    topDiagnosis: 'Substance use, mental health, and soft tissue infections'
  },
  {
    lgaName: 'Calgary - East / Forest Lawn',
    zone: 'Calgary Zone',
    population: 52000,
    annualEdVisits: 26400,
    ctas1_2_Pct: 14.2,
    ctas3_Pct: 42.4,
    ctas4_5_Pct: 43.4,
    topDiagnosis: 'Acute respiratory infections and asthma'
  },
  {
    lgaName: 'Red Deer - North',
    zone: 'Central Zone',
    population: 48000,
    annualEdVisits: 24200,
    ctas1_2_Pct: 15.0,
    ctas3_Pct: 40.0,
    ctas4_5_Pct: 45.0,
    topDiagnosis: 'Injury, poisoning, and musculoskeletal disorders'
  },
  {
    lgaName: 'Chinook - Lethbridge West',
    zone: 'South Zone',
    population: 42500,
    annualEdVisits: 17800,
    ctas1_2_Pct: 12.8,
    ctas3_Pct: 38.5,
    ctas4_5_Pct: 48.7,
    topDiagnosis: 'Viral illness and abdominal pain'
  },
  {
    lgaName: 'Grande Prairie - South',
    zone: 'North Zone',
    population: 38000,
    annualEdVisits: 21500,
    ctas1_2_Pct: 16.2,
    ctas3_Pct: 35.8,
    ctas4_5_Pct: 48.0,
    topDiagnosis: 'Fractures, lacerations, and dental infections'
  }
];

// 5. Historical Quarterly Trends (HQA FOCUS 2021 to Q1 2026)
export const HISTORICAL_FLOW_TIMELINES: HistoricalFlowSnapshot[] = [
  {
    quarter: '2021-Q1',
    occupancy: 94.2,
    alcRate: 11.5,
    lwbsRate: 4.5,
    p90BedWaitHours: 24.5,
    p90LosAdmittedHours: 35.8
  },
  {
    quarter: '2021-Q3',
    occupancy: 96.8,
    alcRate: 12.2,
    lwbsRate: 5.2,
    p90BedWaitHours: 26.8,
    p90LosAdmittedHours: 38.2
  },
  {
    quarter: '2022-Q1',
    occupancy: 101.4,
    alcRate: 13.8,
    lwbsRate: 6.8,
    p90BedWaitHours: 31.2,
    p90LosAdmittedHours: 42.5
  },
  {
    quarter: '2022-Q3',
    occupancy: 102.0,
    alcRate: 14.5,
    lwbsRate: 7.9,
    p90BedWaitHours: 34.0,
    p90LosAdmittedHours: 45.0
  },
  {
    quarter: '2023-Q1',
    occupancy: 103.5,
    alcRate: 15.4,
    lwbsRate: 8.5,
    p90BedWaitHours: 36.8,
    p90LosAdmittedHours: 48.2
  },
  {
    quarter: '2023-Q3',
    occupancy: 102.8,
    alcRate: 15.0,
    lwbsRate: 8.0,
    p90BedWaitHours: 35.4,
    p90LosAdmittedHours: 46.8
  },
  {
    quarter: '2024-Q1',
    occupancy: 104.8,
    alcRate: 16.5,
    lwbsRate: 9.2,
    p90BedWaitHours: 40.5,
    p90LosAdmittedHours: 51.4
  },
  {
    quarter: '2024-Q3',
    occupancy: 105.2,
    alcRate: 17.2,
    lwbsRate: 9.8,
    p90BedWaitHours: 41.8,
    p90LosAdmittedHours: 53.0
  },
  {
    quarter: '2025-Q1',
    occupancy: 106.4,
    alcRate: 18.1,
    lwbsRate: 10.5,
    p90BedWaitHours: 44.2,
    p90LosAdmittedHours: 56.5
  },
  {
    quarter: '2025-Q3',
    occupancy: 105.8,
    alcRate: 17.8,
    lwbsRate: 10.1,
    p90BedWaitHours: 43.0,
    p90LosAdmittedHours: 55.2
  },
  {
    quarter: '2026-Q1',
    occupancy: 107.5,
    alcRate: 18.9,
    lwbsRate: 11.2,
    p90BedWaitHours: 48.0,
    p90LosAdmittedHours: 58.8
  }
];
