import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import axios from 'axios';
import fs from 'fs';
import { ServiceDisruption } from './src/types';
import { startScheduler, setAlertCheckFn, getHospitalsData, getSnapshotsData, getLabSnapshotsData, triggerDailySync } from './src/pipelines/scheduler';
import { getSyncStatus, loadSyncStatusFromDisk } from './src/pipelines/syncStatus';
import { assessDataHealth } from './src/lib/dataHealth';

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
// In-memory data store for alerts and disruptions (hospitals/snapshots now managed by scheduler)
let localAlerts: EmailAlert[] = [];
let dispatchedAlertLogs: AlertLog[] = [];
let localDisruptions: ServiceDisruption[] = [];

const ALERTS_FILE = path.join(process.cwd(), 'data-alerts.json');
const ALERT_LOGS_FILE = path.join(process.cwd(), 'data-alert-logs.json');
const DISRUPTIONS_FILE = path.join(process.cwd(), 'data-disruptions.json');

function loadDataFromFile() {
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
}

function saveDataToFile(file: string, data: any) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Server] Error saving data to file ${file}:`, err);
  }
}


// Check if any registered alert is triggered
function checkEmailAlerts() {
  const now = new Date().toISOString();
  console.log(`[Server] Evaluating ${localAlerts.length} active email alert thresholds against current wait times...`);
  for (const alert of localAlerts) {
    const hosp = getHospitalsData().find(h => h.id === alert.hospitalId);
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


// Load persisted data from disk on startup
loadDataFromFile();


async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3004', 10);

  app.use(express.json());

  // API Routes — always HTTP 200 so uptime scripts can parse the body
  app.get('/api/health', (req, res) => {
    try {
      loadSyncStatusFromDisk();
      const status = getSyncStatus();
      const health = assessDataHealth(status);

      const lastSyncTimestamp = health.lastSyncTimestamp;
      let lastSyncAgeHours: number | null = null;
      if (lastSyncTimestamp) {
        const ageMs = Date.now() - new Date(lastSyncTimestamp).getTime();
        lastSyncAgeHours = Math.round((ageMs / (1000 * 60 * 60)) * 100) / 100;
        if (!Number.isFinite(lastSyncAgeHours)) lastSyncAgeHours = null;
      }

      const syncStale = health.overall !== 'ok';

      res.status(200).json({
        status: health.overall,
        time: new Date().toISOString(),
        syncStale,
        lastSyncAgeHours,
        lastSyncTimestamp,
        sync: {
          overall: health.overall,
          syncStatusAvailable: health.syncStatusAvailable,
          status: status.status,
        },
        domains: health.domains,
        criticalIssues: health.criticalIssues,
        softIssues: health.softIssues,
        bannerMessage: health.bannerMessage,
        checks: health.checks,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[Server] /api/health failed:', message);
      const health = assessDataHealth(null);
      res.status(200).json({
        status: health.overall,
        time: new Date().toISOString(),
        syncStale: true,
        lastSyncAgeHours: null,
        lastSyncTimestamp: null,
        sync: {
          overall: health.overall,
          syncStatusAvailable: health.syncStatusAvailable,
          status: 'never_run',
        },
        domains: health.domains,
        criticalIssues: health.criticalIssues,
        softIssues: health.softIssues,
        bannerMessage: health.bannerMessage,
        checks: health.checks,
      });
    }
  });

  app.get('/api/hospitals', (req, res) => {
    res.json(getHospitalsData());
  });

  // Service Disruptions Endpoints
  app.get('/api/disruptions', (req, res) => {
    try {
      const data = fs.readFileSync(DISRUPTIONS_FILE, 'utf8');
      localDisruptions = JSON.parse(data);
    } catch (err: any) {
      console.warn('[Server] Failed to read disruptions file from disk, falling back to in-memory cache:', err.message || err);
    }
    res.json(localDisruptions);
  });

  app.post('/api/disruptions', (req, res) => {
    const { facilityName, city, zone, serviceAffected, disruptionType, startDate, endDate, reason, details, alternativeCare } = req.body;
    
    if (!facilityName || !city || !zone || !serviceAffected || !disruptionType || !reason) {
      return res.status(400).json({ error: 'Missing required disruption fields' });
    }
    
    try {
      const data = fs.readFileSync(DISRUPTIONS_FILE, 'utf8');
      localDisruptions = JSON.parse(data);
    } catch (err: any) {
      console.warn('[Server] Failed to read disruptions file before POST, using in-memory cache:', err.message || err);
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
    
    try {
      const data = fs.readFileSync(DISRUPTIONS_FILE, 'utf8');
      localDisruptions = JSON.parse(data);
    } catch (err: any) {
      console.warn('[Server] Failed to read disruptions file before resolve, using in-memory cache:', err.message || err);
    }
    
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
  // Sync Status Endpoint — returns full pipeline health from the scheduler.
  // Reload from disk first so the standalone daily-sync job's updates are visible
  // without requiring a server restart.
  app.get('/api/sync/status', (req, res) => {
    loadSyncStatusFromDisk();
    res.json(getSyncStatus());
  });

  // On-Demand Trigger to Run Daily Sync
  app.post('/api/sync/trigger', async (req, res) => {
    console.log('[Server] Daily sync manually triggered via API route.');
    const results = await triggerDailySync();
    res.json({ success: true, message: 'Daily sync triggered successfully.', results });
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

  // Coarse IP geolocation — fallback when browser GPS is unavailable.
  app.get('/api/geo/ip', async (req, res) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp =
        (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined) ||
        req.socket.remoteAddress ||
        '';
      const isLocal =
        !rawIp ||
        rawIp === '::1' ||
        rawIp === '127.0.0.1' ||
        rawIp.startsWith('::ffff:127.') ||
        rawIp.startsWith('10.') ||
        rawIp.startsWith('192.168.') ||
        rawIp.startsWith('172.');

      const lookupUrl = isLocal
        ? 'http://ip-api.com/json/?fields=status,message,city,regionName,lat,lon,countryCode'
        : `http://ip-api.com/json/${encodeURIComponent(rawIp)}?fields=status,message,city,regionName,lat,lon,countryCode`;

      const response = await axios.get(lookupUrl, { timeout: 5000 });
      const data = response.data;
      if (!data || data.status !== 'success' || typeof data.lat !== 'number' || typeof data.lon !== 'number') {
        return res.status(404).json({ error: 'ip_geo_unavailable' });
      }
      return res.json({
        lat: data.lat,
        lng: data.lon,
        city: data.city || 'Your area',
        region: data.regionName || 'Alberta',
        countryCode: data.countryCode,
        source: 'ip',
      });
    } catch (err: any) {
      console.warn('[Server] IP geolocation failed:', err.message || err);
      return res.status(502).json({ error: 'ip_geo_failed' });
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
    if (getSnapshotsData().length === 0) {
      return res.json([]);
    }

    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const filteredSnapshots = getSnapshotsData().filter(s => new Date(s.timestamp).getTime() >= cutoff);

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
    if (getSnapshotsData().length === 0 || getHospitalsData().length === 0) {
      return res.json([]);
    }

    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const filteredSnapshots = getSnapshotsData().filter(s => new Date(s.timestamp).getTime() >= cutoff);

    // Create rapid lookup of hospital ID -> Region Zone
    const hospitalRegionMap = new Map<string, string>();
    for (const h of getHospitalsData()) {
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
      const rangeSnaps = getSnapshotsData().filter(s => {
        const t = new Date(s.timestamp).getTime();
        return t >= cutoff && s.waitTime >= 0;
      });
      
      if (rangeSnaps.length === 0) {
        const validHospitals = getHospitalsData().filter(h => h.waitTime >= 0);
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
      const hosp = getHospitalsData().find(h => h.id === peakSnap.hospitalId);
      
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

  // Lab wait trends — provincial average over time (grouped by timestamp)
  app.get('/api/trends/labs', (req, res) => {
    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const filtered = getLabSnapshotsData().filter(s => new Date(s.timestamp).getTime() >= cutoff);

    const groups: { [timestamp: string]: number[] } = {};
    for (const snap of filtered) {
      if (!groups[snap.timestamp]) groups[snap.timestamp] = [];
      groups[snap.timestamp].push(snap.waitTime);
    }

    const averages = Object.entries(groups).map(([timestamp, waits]) => {
      const sum = waits.reduce((acc, w) => acc + w, 0);
      return { timestamp, waitTime: waits.length > 0 ? Math.round(sum / waits.length) : 0 };
    });
    averages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json(averages);
  });

  // Lab wait trends — individual lab site over time
  app.get('/api/trends/labs/:labId', (req, res) => {
    const { labId } = req.params;
    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const trends = getLabSnapshotsData().filter(s => s.labId === labId && new Date(s.timestamp).getTime() >= cutoff);
    res.json(trends);
  });
  // Fetch individual facility historical trend
  app.get('/api/trends/:hospitalId', (req, res) => {
    const { hospitalId } = req.params;
    const range = (req.query.range as string) || '24h';
    const cutoff = getRangeCutoff(range);
    const trends = getSnapshotsData().filter(s => s.hospitalId === hospitalId && new Date(s.timestamp).getTime() >= cutoff);
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
      const hosp = getHospitalsData().find(h => h.id === hId);
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

  // Domain data endpoint — serves data-*.json files for dashboard fetch calls
  app.get('/api/data/:domain', (req, res) => {
    const domainMap: Record<string, string> = {
      'primary-care': 'data-primary-care.json',
      'surgical': 'data-surgical.json',
      'diagnostic': 'data-diagnostic.json',
      'public-health': 'data-public-health.json',
      'regional-inequity': 'data-regional-inequity.json',
      'spending': 'data-spending.json',
    };
    const filename = domainMap[req.params.domain];
    if (!filename) {
      return res.status(404).json({ error: `Unknown domain: ${req.params.domain}` });
    }
    const filePath = path.join(process.cwd(), filename);
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.json(JSON.parse(data));
    } catch (err: any) {
      console.warn(`[Server] Failed to load ${filename}:`, err.message || err);
      return res.status(500).json({ error: `Failed to load domain data: ${req.params.domain}` });
    }
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
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=300');
          }
        },
      }),
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  // Wire the pipeline scheduler — ER wait times every 10 min, daily orchestrator every 24 hr.
  // Daily sync runs in the background so it never blocks the Express server from accepting connections.
  setAlertCheckFn(checkEmailAlerts);
  startScheduler().catch(err => {
    console.error('[Server] Failed to start scheduler:', err);
  });
}

startServer();
