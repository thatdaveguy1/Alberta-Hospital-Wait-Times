#!/usr/bin/env node
/**
 * GPS spoof repro for the Red Deer → Calgary mis-pin report.
 *
 * Symptom: precise/soft GPS lands the user in Calgary, so Red Deer Regional
 * (≈10 min away) shows ~90+ min drive. Typing "Red Deer" works.
 *
 * Phases:
 *   1) API — reverse geocode + OSRM from spoofed pins (fast, deterministic)
 *   2) UI  — Puppeteer overrides browser geolocation and hits ER waits
 *
 * Usage:
 *   node scripts/repro-gps-spoof.mjs
 *   BASE_URL=http://127.0.0.1:3004 node scripts/repro-gps-spoof.mjs
 *   SKIP_UI=1 node scripts/repro-gps-spoof.mjs   # API phase only
 */
import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:3004').replace(/\/$/, '');
const SKIP_UI = process.env.SKIP_UI === '1';
const RD_HOSP = { id: 'red-deer-regional-hospital', lat: 52.26046, lng: -113.8173 };
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PINS = {
  red_deer: { lat: 52.2681, lng: -113.8112, expectCity: /red deer/i, maxDriveMins: 20 },
  calgary: { lat: 51.0447, lng: -114.0719, expectCity: /calgary/i, minDriveMins: 80 },
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function reverseCity(lat, lng) {
  const data = await fetchJson(`${BASE}/api/geocode/reverse?lat=${lat}&lng=${lng}`);
  return String(data.city || '');
}

async function osrmDriveMins(fromLat, fromLng, toLat, toLng) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
  const data = await fetchJson(url);
  return Math.round(data.routes[0].duration / 60);
}

async function phaseApi() {
  console.log('=== Phase 1: API spoof (reverse geocode + OSRM → Red Deer Regional) ===');
  const results = {};

  for (const [name, pin] of Object.entries(PINS)) {
    const city = await reverseCity(pin.lat, pin.lng);
    const mins = await osrmDriveMins(pin.lat, pin.lng, RD_HOSP.lat, RD_HOSP.lng);
    results[name] = { city, driveMins: mins };

    if (!pin.expectCity.test(city)) {
      fail(`${name}: city ${JSON.stringify(city)} did not match ${pin.expectCity}`);
    }
    if (pin.maxDriveMins != null && mins > pin.maxDriveMins) {
      fail(`${name}: drive ${mins}m > max ${pin.maxDriveMins}m`);
    }
    if (pin.minDriveMins != null && mins < pin.minDriveMins) {
      fail(`${name}: drive ${mins}m < min ${pin.minDriveMins}m (symptom not reproduced)`);
    }
    const tag =
      pin.minDriveMins != null && mins >= pin.minDriveMins ? 'REPRO_MATCH' : 'OK_NEAR';
    console.log(`  ${name}: city=${JSON.stringify(city)} drive=${mins}min → ${tag}`);
  }

  // Red-capable assertion: Calgary pin must look like the user report.
  if (
    /calgary/i.test(results.calgary.city) &&
    results.calgary.driveMins >= 80 &&
    /red deer/i.test(results.red_deer.city) &&
    results.red_deer.driveMins <= 20
  ) {
    console.log(
      '  LOOP_RED_CAPABLE: Calgary spoof reproduces 90+min; Red Deer spoof stays local.\n',
    );
  } else {
    fail('API loop lost red-capability for the reported symptom');
  }
  return results;
}

async function waitForText(page, re, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await page.evaluate(() => document.body?.innerText || '');
    if (re.test(text)) return text;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${re}`);
}

async function runUiCase(browser, name, pin, { accuracy = 10 } = {}) {
  const page = await browser.newPage();
  const origin = new URL(BASE).origin;
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(origin, ['geolocation']);
  await page.setGeolocation({
    latitude: pin.lat,
    longitude: pin.lng,
    accuracy,
  });

  await page.goto(`${BASE}/?module=er-waits`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem('alberta_hospital_user_location');
    localStorage.setItem('alberta_hospital_location_prompt_dismissed', '1');
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });

  // Soft GPS may already apply; also force the explicit "Use current location" path.
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const btn = buttons.find((b) =>
      /use current location/i.test((b.textContent || '').replace(/\s+/g, ' ')),
    );
    btn?.click();
  });

  const body = await waitForText(page, pin.expectCity, 45000);
  const stored = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('alberta_hospital_user_location') || 'null');
    } catch {
      return null;
    }
  });

  // Parse drive from the Red Deer Regional card text (not a prior card's Drive line).
  const driveNearRd = await page.evaluate((hospId) => {
    const text = document.body?.innerText || '';
    const needle = 'red deer regional';
    const idx = text.toLowerCase().indexOf(needle);
    // Take text AFTER the hospital name so we don't steal the previous card's Drive.
    const window =
      idx >= 0 ? text.slice(idx, idx + needle.length + 280) : text.slice(0, 800);
    const compact = window.replace(/\s+/g, ' ').trim();
    // Formats seen: "Drive 0:03" or "Drive + wait 1:36 + 2:37"
    const m =
      compact.match(/Drive\s+(\d+:\d{2})\b/i) ||
      compact.match(/Drive\s*\+\s*wait\s+(\d+:\d{2})\b/i);
    return {
      snippet: compact.slice(0, 220),
      driveLabel: m?.[1] || null,
      hasHospitalId: Boolean(document.querySelector(`[data-hospital-id="${hospId}"]`)),
      distanceKm: (() => {
        const dm = compact.match(/([\d.]+)\s*km/i);
        return dm ? Number(dm[1]) : null;
      })(),
    };
  }, RD_HOSP.id);

  await page.close();
  return { name, bodyCityHit: pin.expectCity.test(body), stored, driveNearRd };
}

function hmToMins(hm) {
  if (!hm) return null;
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function chromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  if (existsSync(MAC_CHROME)) return MAC_CHROME;
  return undefined;
}

async function phaseUiCoarseReject(browser) {
  console.log('=== Phase 2b: coarse network pin must NOT be accepted as GPS ===');
  // Calgary coords with cell/network-class accuracy — the Red Deer reporter case.
  const pin = PINS.calgary;
  const page = await browser.newPage();
  const origin = new URL(BASE).origin;
  await browser.defaultBrowserContext().overridePermissions(origin, ['geolocation']);
  await page.setGeolocation({
    latitude: pin.lat,
    longitude: pin.lng,
    accuracy: 15000,
  });
  await page.goto(`${BASE}/?module=er-waits`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.removeItem('alberta_hospital_user_location');
    localStorage.setItem('alberta_hospital_location_prompt_dismissed', '1');
  });
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const btn = buttons.find((b) =>
      /use current location/i.test((b.textContent || '').replace(/\s+/g, ' ')),
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 2500));
  const stored = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('alberta_hospital_user_location') || 'null');
    } catch {
      return null;
    }
  });
  const body = await page.evaluate(() => document.body?.innerText || '');
  await page.close();

  const acceptedCalgaryGps =
    stored &&
    typeof stored.lat === 'number' &&
    Math.abs(stored.lat - pin.lat) < 0.05 &&
    stored.isGPS === true;
  if (acceptedCalgaryGps) {
    fail(
      `coarse Calgary pin was accepted as GPS (lat=${stored.lat}, city=${stored.city}) — fix regressing`,
    );
  } else {
    console.log(
      `  coarse reject OK: stored=${JSON.stringify(stored?.city ?? null)}` +
        ` prompted=${/approximate|postal code|city/i.test(body)}`,
    );
  }
  console.log('');
}

async function phaseUi() {
  console.log('=== Phase 2: UI geolocation spoof (Puppeteer) ===');
  const executablePath = chromeExecutable();
  const browser = await puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    for (const [name, pin] of Object.entries(PINS)) {
      const result = await runUiCase(browser, name, pin);
      const mins = hmToMins(result.driveNearRd.driveLabel);
      console.log(
        `  ${name}: storedCity=${JSON.stringify(result.stored?.city)}` +
          ` lat=${result.stored?.lat} lng=${result.stored?.lng}` +
          ` isGPS=${result.stored?.isGPS}` +
          ` driveLabel=${JSON.stringify(result.driveNearRd.driveLabel)}` +
          ` mins=${mins}`,
      );
      console.log(`    snippet: ${result.driveNearRd.snippet}`);

      if (!result.stored || typeof result.stored.lat !== 'number') {
        fail(`${name}: no saved location after GPS spoof`);
        continue;
      }
      if (Math.abs(result.stored.lat - pin.lat) > 0.05 || Math.abs(result.stored.lng - pin.lng) > 0.05) {
        fail(
          `${name}: saved coords ${result.stored.lat},${result.stored.lng} != spoof ${pin.lat},${pin.lng}`,
        );
      }
      if (!pin.expectCity.test(String(result.stored.city || ''))) {
        fail(`${name}: saved city ${JSON.stringify(result.stored.city)} mismatch`);
      }
      const km = result.driveNearRd.distanceKm;
      if (mins != null) {
        if (pin.maxDriveMins != null && mins > pin.maxDriveMins) {
          fail(`${name}: UI drive ${mins}m > max ${pin.maxDriveMins}m`);
        }
        if (pin.minDriveMins != null && mins < pin.minDriveMins) {
          fail(`${name}: UI drive ${mins}m did not reproduce 90+min symptom`);
        }
      } else if (pin.minDriveMins != null) {
        // Fallback: straight-line km on the card still proves the Calgary pin.
        if (km != null && km >= 100) {
          console.log(`  ${name}: no Drive label; distanceKm=${km} still matches far pin`);
        } else {
          fail(`${name}: could not read drive/distance for Red Deer Regional`);
        }
      }
      if (pin.maxDriveMins != null && km != null && km > 30) {
        fail(`${name}: UI distance ${km}km too far for a Red Deer pin`);
      }
    }
    await phaseUiCoarseReject(browser);
  } finally {
    await browser.close();
  }
  console.log('');
}

const api = await phaseApi();
if (!SKIP_UI) {
  await phaseUi();
} else {
  console.log('=== Phase 2 skipped (SKIP_UI=1) ===\n');
}

console.log(
  JSON.stringify(
    {
      base: BASE,
      ok: process.exitCode ? false : true,
      api,
      note:
        'Precise Calgary spoof still shows ~90+min (expected). Coarse network-class accuracy must be rejected (Phase 2b).',
    },
    null,
    2,
  ),
);
process.exit(process.exitCode || 0);
