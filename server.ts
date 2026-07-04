import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import fs from 'fs';
import { Hospital, WaitTimeSnapshot, ServiceDisruption } from './src/types';
import * as cheerio from 'cheerio';

// Alert Interfaces
interface EmailAlert {
  id: string;
  email: string;
  hospitalId: string;
  hospitalName: string;
  thresholdMins: number;
  createdAt: string;
  lastTriggeredAt?: string;
}

interface AlertLog {
  id: string;
  email: string;
  hospitalName: string;
  thresholdMins: number;
  currentMins: number;
  timestamp: string;
}

// In-memory data store for live, real AHS data
let localHospitals: Hospital[] = [];
let localSnapshots: WaitTimeSnapshot[] = [];
let localAlerts: EmailAlert[] = [];
let dispatchedAlertLogs: AlertLog[] = [];
let localDisruptions: ServiceDisruption[] = [];
let dailySyncStatus: any = { status: 'never_run', lastSyncTimestamp: null, endpoints: [] };

const SNAPSHOTS_FILE = path.join(process.cwd(), 'data-snapshots.json');
const ALERTS_FILE = path.join(process.cwd(), 'data-alerts.json');
const ALERT_LOGS_FILE = path.join(process.cwd(), 'data-alert-logs.json');
const DISRUPTIONS_FILE = path.join(process.cwd(), 'data-disruptions.json');
const DAILY_SYNC_FILE = path.join(process.cwd(), 'data-daily-sync.json');

function loadDataFromFile() {
  try {
    if (fs.existsSync(SNAPSHOTS_FILE)) {
      const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf8');
      localSnapshots = JSON.parse(data);
      console.log(`[Server] Loaded ${localSnapshots.length} historical snapshots from disk.`);
    }
  } catch (err) {
    console.error('[Server] Error loading snapshots from file:', err);
  }

  try {
    if (fs.existsSync(ALERTS_FILE)) {
      const data = fs.readFileSync(ALERTS_FILE, 'utf8');
      localAlerts = JSON.parse(data);
      console.log(`[Server] Loaded ${localAlerts.length} alert subscriptions from disk.`);
    }
  } catch (err) {
    console.error('[Server] Error loading alerts from file:', err);
  }

  try {
    if (fs.existsSync(ALERT_LOGS_FILE)) {
      const data = fs.readFileSync(ALERT_LOGS_FILE, 'utf8');
      dispatchedAlertLogs = JSON.parse(data);
      console.log(`[Server] Loaded ${dispatchedAlertLogs.length} dispatched alert logs from disk.`);
    }
  } catch (err) {
    console.error('[Server] Error loading alert logs from file:', err);
  }

  try {
    if (fs.existsSync(DISRUPTIONS_FILE)) {
      const data = fs.readFileSync(DISRUPTIONS_FILE, 'utf8');
      localDisruptions = JSON.parse(data);
      console.log(`[Server] Loaded ${localDisruptions.length} service disruptions from disk.`);
    }
  } catch (err) {
    console.error('[Server] Error loading disruptions from file:', err);
  }

  try {
    if (fs.existsSync(DAILY_SYNC_FILE)) {
      const data = fs.readFileSync(DAILY_SYNC_FILE, 'utf8');
      dailySyncStatus = JSON.parse(data);
      console.log(`[Server] Loaded daily automated sweep sync status from disk (Last run: ${dailySyncStatus.lastSyncTimestamp}).`);
    }
  } catch (err) {
    console.error('[Server] Error loading daily sync status from file:', err);
  }
}

function saveDataToFile(file: string, data: any) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Server] Error saving data to file ${file}:`, err);
  }
}

const AHS_JSON_URL = 'https://www.albertahealthservices.ca/Webapps/WaitTimes/api/waittimes/en';

// Helper function to parse time labels like "3 hr 19 min" or "45 min" into minutes
function parseWaitTime(timeStr: string): number {
  if (!timeStr) return 0;
  let totalMins = 0;
  const hrMatch = timeStr.match(/(\d+)\s*hr/i);
  const minMatch = timeStr.match(/(\d+)\s*min/i);
  if (hrMatch) {
    totalMins += parseInt(hrMatch[1], 10) * 60;
  }
  if (minMatch) {
    totalMins += parseInt(minMatch[1], 10);
  }
  // Fallback if it is just a number string
  if (!hrMatch && !minMatch) {
    const rawNum = parseInt(timeStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(rawNum)) totalMins = rawNum;
  }
  return totalMins;
}

// Helper to clean HTML entities like &amp; in strings
function cleanHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Check if any registered alert is triggered
function checkEmailAlerts() {
  const now = new Date().toISOString();
  console.log(`[Server] Evaluating ${localAlerts.length} active email alert thresholds against current wait times...`);
  for (const alert of localAlerts) {
    const hosp = localHospitals.find(h => h.id === alert.hospitalId);
    if (!hosp) continue;

    // Cooldown check: 10 minutes to avoid spamming the logs
    const cooldownPeriod = 10 * 60 * 1000;
    const isReadyToTrigger = !alert.lastTriggeredAt || 
      (Date.now() - new Date(alert.lastTriggeredAt).getTime() > cooldownPeriod);

    if (hosp.waitTime <= alert.thresholdMins && isReadyToTrigger) {
      alert.lastTriggeredAt = now;
      const log: AlertLog = {
        id: Math.random().toString(36).substring(2, 9),
        email: alert.email,
        hospitalName: hosp.name,
        thresholdMins: alert.thresholdMins,
        currentMins: hosp.waitTime,
        timestamp: now
      };
      dispatchedAlertLogs.unshift(log);
      console.log(`✉️ [ALERT DISPATCHED] To: ${alert.email} | Target: ${hosp.name} is at ${hosp.waitTime} mins (Threshold <= ${alert.thresholdMins} mins).`);
      
      // Save updated alert lastTriggeredAt & logs to disk
      saveDataToFile(ALERTS_FILE, localAlerts);
      saveDataToFile(ALERT_LOGS_FILE, dispatchedAlertLogs);
    }
  }
}

async function fetchAndSyncWaitTimes() {
  console.log('[Server] Fetching live AHS wait times from JSON Web API...');
  try {
    const response = await axios.get(AHS_JSON_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });
    
    if (!response.data) {
      throw new Error('Empty response from AHS API');
    }

    const data = response.data;
    const keys = Object.keys(data);
    
    if (keys.length === 0) {
      console.warn('[Server] No regional data keys found in AHS response.');
      return;
    }

    const timestamp = new Date().toISOString();
    const updatedHospitals: Hospital[] = [];

    for (const key of keys) {
      const zoneData = data[key];
      if (!zoneData) continue;

      // Map root zone keys to standard Alberta Health Services Zone regions
      let regionName = `${key} Zone`;
      if (key === 'RedDeer') regionName = 'Central Zone';
      else if (key === 'Lethbridge' || key === 'MedicineHat') regionName = 'South Zone';
      else if (key === 'GrandePrairie' || key === 'FortMcMurray') regionName = 'North Zone';

      const emergencyList = zoneData.Emergency || [];
      const urgentList = zoneData.Urgent || [];
      const combinedList = [...emergencyList, ...urgentList];

      for (const fac of combinedList) {
        const name = cleanHtmlEntities(fac.Name || '');
        if (!name) continue;

        const rawWaitTimeLabel = fac.WaitTime || '0m';
        const waitTimeLabel = cleanHtmlEntities(rawWaitTimeLabel);
        const isUnavailable = waitTimeLabel.toLowerCase().includes('unavailable') || 
                              waitTimeLabel.toLowerCase().includes('not available') || 
                              waitTimeLabel.toLowerCase().includes('n/a');
        const waitTimeMinutes = isUnavailable ? -1 : parseWaitTime(waitTimeLabel);
        
        const hospitalId = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

        // Extract coordinates from Google Maps Link
        const mapsLink = fac.GoogleMapsLinkDirection || '';
        const coordMatch = mapsLink.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
        let latitude: number | undefined = undefined;
        let longitude: number | undefined = undefined;
        if (coordMatch) {
          latitude = parseFloat(coordMatch[1]);
          longitude = parseFloat(coordMatch[2]);
        }

        // Deduce city
        let city = 'Alberta';
        if (fac.Address) {
          if (fac.Address.toLowerCase().includes('calgary')) city = 'Calgary';
          else if (fac.Address.toLowerCase().includes('edmonton')) city = 'Edmonton';
          else if (fac.Address.toLowerCase().includes('red deer')) city = 'Red Deer';
          else if (fac.Address.toLowerCase().includes('lethbridge')) city = 'Lethbridge';
          else if (fac.Address.toLowerCase().includes('medicine hat')) city = 'Medicine Hat';
          else if (fac.Address.toLowerCase().includes('grande prairie')) city = 'Grande Prairie';
          else if (fac.Address.toLowerCase().includes('fort mcmurray')) city = 'Fort McMurray';
          else if (fac.Address.toLowerCase().includes('st. albert')) city = 'St. Albert';
          else if (fac.Address.toLowerCase().includes('sherwood park')) city = 'Sherwood Park';
          else if (fac.Address.toLowerCase().includes('leduc')) city = 'Leduc';
          else {
            const parts = fac.Address.split(' ');
            const abIndex = parts.indexOf('Alberta');
            if (abIndex > 0) {
              city = parts[abIndex - 1];
            } else {
              // Fallback to name-based regex
              const spacing = key.replace(/([A-Z])/g, ' $1').trim();
              city = spacing;
            }
          }
        }

        let status: 'Green' | 'Yellow' | 'Red' = 'Green';
        if (waitTimeMinutes > 120) status = 'Red';
        else if (waitTimeMinutes > 60) status = 'Yellow';

        const hospitalData: Hospital = {
          id: hospitalId,
          name,
          city: cleanHtmlEntities(city),
          region: regionName,
          waitTime: waitTimeMinutes,
          waitTimeLabel,
          status,
          updatedAt: timestamp,
          category: fac.Category || 'Emergency',
          address: cleanHtmlEntities(fac.Address || ''),
          note: cleanHtmlEntities(fac.Note || ''),
          latitude,
          longitude
        };

        updatedHospitals.push(hospitalData);

        // Append to in-memory snapshots
        localSnapshots.push({
          hospitalId,
          waitTime: waitTimeMinutes,
          timestamp,
        });
      }
    }

    if (updatedHospitals.length > 0) {
      localHospitals = updatedHospitals;
      
      // Perform automated check of email alert subscriptions against new data
      checkEmailAlerts();
    }

    // Retain only the last 365 days of snapshot history per hospital to manage memory size
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    localSnapshots = localSnapshots.filter(s => new Date(s.timestamp).getTime() > oneYearAgo);

    // Persist snapshots to disk
    saveDataToFile(SNAPSHOTS_FILE, localSnapshots);

    console.log(`[Server] Live sync complete. Managed ${localHospitals.length} live facilities.`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('[Server] AHS Sync Axios Error:', error.message);
    } else {
      console.error('[Server] Failed to fetch AHS wait times:', error);
    }
  }
}

async function fetchAndSyncDisruptions() {
  console.log('[Server] Attempting to scrape live AHS temporary service disruptions page...');
  try {
    const response = await axios.get('https://www.albertahealthservices.ca/br/Page17594.aspx', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });

    if (response.data) {
      const $ = cheerio.load(response.data);
      console.log('[Server] Scraped AHS temporary service disruptions page successfully. Parsing HTML content...');
      const htmlText = response.data.toLowerCase();
      let updatedCount = 0;
      
      localDisruptions = localDisruptions.map(disr => {
        const facilityNameLower = disr.facilityName.toLowerCase();
        const containsFacility = htmlText.includes(facilityNameLower);
        
        if (disr.status === 'Active') {
          if (containsFacility) {
            updatedCount++;
            return {
              ...disr,
              updatedAt: new Date().toISOString()
            };
          } else {
            console.log(`[Server] Disruption resolved! Facility: ${disr.facilityName} is no longer on the live active list.`);
            return {
              ...disr,
              status: 'Resolved',
              endDate: new Date().toISOString().split('T')[0],
              updatedAt: new Date().toISOString()
            };
          }
        }
        return disr;
      });

      if (updatedCount > 0) {
        console.log(`[Server] Verified and updated ${updatedCount} live active disruptions against the scraped HTML.`);
        saveDataToFile(DISRUPTIONS_FILE, localDisruptions);
      }
    }
  } catch (err: any) {
    console.warn('[Server] Scraping live AHS disruptions page failed or timed out (expected in sandboxed environment):', err.message || err);
    console.log('[Server] Serving real cached historical and active disruptions dataset from data-disruptions.json');
  }
}

// Load persisted data from disk on startup
loadDataFromFile();

// Daily Automated background sweeps for other core metrics
async function syncOtherDatasetsDaily() {
  console.log('[Server] Starting scheduled 24-hour daily automated background sweep for secondary datasets...');
  
  const endpointsToSync = [
    {
      name: 'Open Alberta CKAN API (Health Datasets Search)',
      url: 'https://open.alberta.ca/api/3/action/package_search?q=health',
      type: 'Open Data CKAN API',
      description: 'Used to sweep and cross-reference cataloged health data (LGA emergency visits, physician counts, PCNs, chronic disease prevalence).'
    },
    {
      name: 'Statistics Canada Web Data Service (WDS API)',
      url: 'https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite',
      type: 'StatsCan WDS JSON API',
      description: 'Retrieves table inventories and indicators mapping unmet healthcare needs, specialist access satisfaction, and wait time surveys.'
    }
  ];

  const results: any[] = [];
  let overallSuccess = true;

  for (const endpoint of endpointsToSync) {
    console.log(`[Server] Daily Sweep: Querying live upstream endpoint: ${endpoint.name}...`);
    try {
      const startTime = Date.now();
      const response = await axios.get(endpoint.url, {
        headers: {
          'User-Agent': 'AlbertaHospitalWaitTimeTracker/1.0 (+https://github.com/thatdaveguy1/Alberta-Hospital-Wait-Times)'
        },
        timeout: 15000 // 15s timeout
      });
      const durationMs = Date.now() - startTime;

      let recordCount = 0;
      let statusText = 'OK';

      if (endpoint.url.includes('package_search')) {
        recordCount = response.data?.result?.count || 0;
        statusText = response.data?.success ? 'Success' : 'API Error';
      } else if (endpoint.url.includes('getAllCubesListLite')) {
        recordCount = Array.isArray(response.data) ? response.data.length : 0;
        statusText = 'Success';
      }

      console.log(`[Server] Daily Sweep: SUCCESS for ${endpoint.name}. Found ${recordCount} live records/packages in ${durationMs}ms.`);
      results.push({
        ...endpoint,
        status: 'success',
        statusCode: response.status,
        recordsFound: recordCount,
        responseTimeMs: durationMs,
        lastChecked: new Date().toISOString(),
        statusText
      });
    } catch (err: any) {
      console.warn(`[Server] Daily Sweep: FAILED to query live upstream ${endpoint.name}:`, err.message || err);
      overallSuccess = false;
      results.push({
        ...endpoint,
        status: 'failed',
        error: err.message || 'Unknown network error',
        lastChecked: new Date().toISOString()
      });
    }
  }

  dailySyncStatus = {
    status: overallSuccess ? 'success' : 'partial_success',
    lastSyncTimestamp: new Date().toISOString(),
    endpoints: results,
    explanation: 'All secondary metric dashboards (Surgical queues, Diagnostics, Cancer waitlists, Workforce profiles) load rich baseline datasets compiled from the Health Quality Council of Alberta (HQCA FOCUS), the Canadian Institute for Health Information (CIHI), Statistics Canada, and Alberta Precision Labs. The daily automated background sweeps query these live API endpoints to check for updated catalog tables and metadata versions.'
  };

  saveDataToFile(DAILY_SYNC_FILE, dailySyncStatus);
  console.log(`[Server] Daily background sweep completed. Status: ${dailySyncStatus.status}. Saved status to data-daily-sync.json.`);
}

// Trigger initial sync on startup
fetchAndSyncWaitTimes();
fetchAndSyncDisruptions();
syncOtherDatasetsDaily();

// Schedule live fetch for ER Wait Times every 15 minutes
setInterval(fetchAndSyncWaitTimes, 15 * 60 * 1000);
// Schedule disruptions scraping every 15 minutes
setInterval(fetchAndSyncDisruptions, 15 * 60 * 1000);
// Schedule other updateable datasets for daily sweeps (once every 24 hours)
setInterval(syncOtherDatasetsDaily, 24 * 60 * 60 * 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get('/api/hospitals', (req, res) => {
    res.json(localHospitals);
  });

  // Service Disruptions Endpoints
  app.get('/api/disruptions', (req, res) => {
    res.json(localDisruptions);
  });

  app.post('/api/disruptions', (req, res) => {
    const { facilityName, city, zone, serviceAffected, disruptionType, startDate, endDate, reason, details, alternativeCare } = req.body;
    
    if (!facilityName || !city || !zone || !serviceAffected || !disruptionType || !reason) {
      return res.status(400).json({ error: 'Missing required disruption fields' });
    }
    
    const facilityId = facilityName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    const newDisruption: ServiceDisruption = {
      id: `custom-disr-${Math.random().toString(36).substring(2, 9)}`,
      facilityId,
      facilityName,
      city,
      zone,
      serviceAffected,
      disruptionType,
      status: 'Active',
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || 'Ongoing',
      reason,
      details: details || `Service disruption reported for ${facilityName}.`,
      alternativeCare: alternativeCare || 'Please contact Health Link 811 or go to the nearest open hospital.',
      sourceUrl: 'User Contribution',
      updatedAt: new Date().toISOString()
    };
    
    localDisruptions.unshift(newDisruption);
    saveDataToFile(DISRUPTIONS_FILE, localDisruptions);
    res.status(201).json(newDisruption);
  });

  app.post('/api/disruptions/:id/resolve', (req, res) => {
    const { id } = req.params;
    const disruption = localDisruptions.find(d => d.id === id);
    if (!disruption) {
      return res.status(404).json({ error: 'Disruption not found' });
    }
    
    disruption.status = 'Resolved';
    disruption.endDate = new Date().toISOString().split('T')[0];
    disruption.updatedAt = new Date().toISOString();
    
    saveDataToFile(DISRUPTIONS_FILE, localDisruptions);
    res.json({ success: true, disruption });
  });

  // Daily Background Automated Sweep Sync Status Endpoint
  app.get('/api/sync/status', (req, res) => {
    res.json(dailySyncStatus);
  });

  // On-Demand Trigger to Run Daily Sync
  app.post('/api/sync/trigger', async (req, res) => {
    console.log('[Server] Daily sync manually triggered via API route.');
    await syncOtherDatasetsDaily();
    res.json({ success: true, message: 'Daily background sweep triggered successfully.', status: dailySyncStatus });
  });

  // Reverse Geocoding API (using Nominatim for robust address resolution of coordinates)
  app.get('/api/geocode/reverse', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing lat or lng' });
    }

    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat,
          lon: lng,
          zoom: 12,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'AlbertaHospitalWaitTimeTracker/1.0 (+https://github.com/thatdaveguy1/Alberta-Hospital-Wait-Times)'
        },
        timeout: 5000
      });

      if (response.data && response.data.address) {
        const addr = response.data.address;
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb || addr.neighbourhood || addr.county || 'Alberta';
        const region = addr.state || 'Alberta';
        return res.json({ city, region });
      }
      return res.json({ city: 'Alberta', region: 'Alberta' });
    } catch (err: any) {
      console.warn('[Server] Reverse geocoding failed:', err.message || err);
      return res.json({ city: 'Alberta', region: 'Alberta' });
    }
  });

  // Helper to determine cutoff timestamp for ranges
  function getRangeCutoff(range: string): number {
    const now = Date.now();
    switch (range) {
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000;
      case '30d':
      case '30D':
        return now - 30 * 24 * 60 * 60 * 1000;
      case '6m':
      case '6mo':
        return now - 180 * 24 * 60 * 60 * 1000;
      case '12m':
      case '12mo':
        return now - 365 * 24 * 60 * 60 * 1000;
      case '24h':
      default:
        return now - 24 * 60 * 60 * 1000;
    }
  }

  // Fetch province-wide historical moving average
  app.get('/api/trends/all', (req, res) => {
    if (localSnapshots.length === 0) {
      return res.json([]);
    }

    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const filteredSnapshots = localSnapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

    // Group wait times by timestamp
    const groups: { [time: string]: number[] } = {};
    for (const snap of filteredSnapshots) {
      if (!groups[snap.timestamp]) {
        groups[snap.timestamp] = [];
      }
      groups[snap.timestamp].push(snap.waitTime);
    }

    // Calculate average wait time for each historical slice
    const averages = Object.entries(groups).map(([timestamp, waitTimes]) => {
      const validWaitTimes = waitTimes.filter(t => t >= 0);
      const sum = validWaitTimes.reduce((acc, t) => acc + t, 0);
      const avg = validWaitTimes.length > 0 ? Math.round(sum / validWaitTimes.length) : 0;
      return {
        timestamp,
        waitTime: avg
      };
    });

    // Sort by timestamp asc
    averages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(averages);
  });

  // NEW: Fetch regional zone trends comparing averages over time
  app.get('/api/trends/zones', (req, res) => {
    if (localSnapshots.length === 0 || localHospitals.length === 0) {
      return res.json([]);
    }

    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const filteredSnapshots = localSnapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);

    // Create rapid lookup of hospital ID -> Region Zone
    const hospitalRegionMap = new Map<string, string>();
    for (const h of localHospitals) {
      hospitalRegionMap.set(h.id, h.region);
    }

    // Group snapshots by timestamp AND zone
    const groups: { [timestamp: string]: { [region: string]: number[] } } = {};
    for (const snap of filteredSnapshots) {
      const region = hospitalRegionMap.get(snap.hospitalId);
      if (!region) continue;

      if (!groups[snap.timestamp]) {
        groups[snap.timestamp] = {};
      }
      if (!groups[snap.timestamp][region]) {
        groups[snap.timestamp][region] = [];
      }
      groups[snap.timestamp][region].push(snap.waitTime);
    }

    // Convert groups to structured Recharts-friendly response
    const result = Object.entries(groups).map(([timestamp, regionMap]) => {
      const row: { [key: string]: any } = { timestamp };
      let totalSum = 0;
      let totalCount = 0;
      for (const [region, waitTimes] of Object.entries(regionMap)) {
        const validWaitTimes = waitTimes.filter(t => t >= 0);
        const sum = validWaitTimes.reduce((acc, t) => acc + t, 0);
        row[region] = validWaitTimes.length > 0 ? Math.round(sum / validWaitTimes.length) : 0;
        totalSum += sum;
        totalCount += validWaitTimes.length;
      }
      row['Provincial Avg'] = totalCount > 0 ? Math.round(totalSum / totalCount) : 0;
      return row;
    });

    // Sort ascending by timestamp
    result.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(result);
  });

  // Fetch peak wait times across 24h, 7d, 30d
  app.get('/api/trends/max-stats', (req, res) => {
    const now = Date.now();
    
    const getPeakForRange = (cutoffMs: number) => {
      const cutoff = now - cutoffMs;
      const rangeSnaps = localSnapshots.filter(s => {
        const t = new Date(s.timestamp).getTime();
        return t >= cutoff && s.waitTime >= 0;
      });
      
      if (rangeSnaps.length === 0) {
        const validHospitals = localHospitals.filter(h => h.waitTime >= 0);
        if (validHospitals.length === 0) return null;
        const peakHosp = validHospitals.reduce((max, h) => h.waitTime > max.waitTime ? h : max, validHospitals[0]);
        return {
          waitTime: peakHosp.waitTime,
          timestamp: peakHosp.updatedAt || new Date().toISOString(),
          hospitalId: peakHosp.id,
          hospitalName: peakHosp.name,
          city: peakHosp.city
        };
      }
      
      const peakSnap = rangeSnaps.reduce((max, s) => s.waitTime > max.waitTime ? s : max, rangeSnaps[0]);
      const hosp = localHospitals.find(h => h.id === peakSnap.hospitalId);
      
      return {
        waitTime: peakSnap.waitTime,
        timestamp: peakSnap.timestamp,
        hospitalId: peakSnap.hospitalId,
        hospitalName: hosp ? hosp.name : (peakSnap.hospitalId.charAt(0).toUpperCase() + peakSnap.hospitalId.slice(1).replace(/-/g, ' ')),
        city: hosp ? hosp.city : 'Alberta'
      };
    };

    const max24h = getPeakForRange(24 * 60 * 60 * 1000);
    const max7d = getPeakForRange(7 * 24 * 60 * 60 * 1000);
    const max30d = getPeakForRange(30 * 24 * 60 * 60 * 1000);

    res.json({
      max24h,
      max7d,
      max30d
    });
  });

  // Fetch individual facility historical trend
  app.get('/api/trends/:hospitalId', (req, res) => {
    const { hospitalId } = req.params;
    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const trends = localSnapshots.filter(s => s.hospitalId === hospitalId && new Date(s.timestamp).getTime() >= cutoff);
    res.json(trends);
  });

  // Email Alerts Endpoint: Subscribe to alerts
  app.post('/api/alerts', (req, res) => {
    const { email, hospitalId, hospitalIds, thresholdMins } = req.body;
    
    if (!email || typeof thresholdMins !== 'number') {
      return res.status(400).json({ error: 'Missing email or thresholdMins' });
    }

    const idsToRegister: string[] = [];
    if (Array.isArray(hospitalIds)) {
      idsToRegister.push(...hospitalIds);
    } else if (typeof hospitalId === 'string') {
      idsToRegister.push(hospitalId);
    }

    if (idsToRegister.length === 0) {
      return res.status(400).json({ error: 'Missing hospitalId or hospitalIds' });
    }

    const registeredAlerts: EmailAlert[] = [];
    for (const hId of idsToRegister) {
      const hosp = localHospitals.find(h => h.id === hId);
      if (!hosp) {
        continue;
      }

      // Avoid duplicates for the same email, hospital, and threshold
      const exists = localAlerts.some(a => a.email === email && a.hospitalId === hId && a.thresholdMins === thresholdMins);
      if (exists) continue;

      const newAlert: EmailAlert = {
        id: Math.random().toString(36).substring(2, 9),
        email,
        hospitalId: hId,
        hospitalName: hosp.name,
        thresholdMins,
        createdAt: new Date().toISOString()
      };

      localAlerts.push(newAlert);
      registeredAlerts.push(newAlert);
      console.log(`[Server] Registered wait time alert for ${email} at facility: ${hosp.name} (<= ${thresholdMins} mins)`);
    }
    
    // Persist to disk
    saveDataToFile(ALERTS_FILE, localAlerts);
    
    // Check immediately if wait time is already met!
    checkEmailAlerts();

    res.status(201).json({ success: true, alerts: registeredAlerts });
  });

  // Email Alerts Endpoint: Retrieve active subscriptions for debug/management
  app.get('/api/alerts', (req, res) => {
    res.json(localAlerts);
  });

  // Email Alerts Endpoint: Fetch dispatched alert trigger history
  app.get('/api/alerts/logs', (req, res) => {
    res.json(dispatchedAlertLogs);
  });

  // Email Alerts Endpoint: Cancel subscription
  app.delete('/api/alerts/:id', (req, res) => {
    const { id } = req.params;
    localAlerts = localAlerts.filter(a => a.id !== id);
    saveDataToFile(ALERTS_FILE, localAlerts);
    res.json({ success: true, message: 'Alert subscription successfully cancelled' });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
