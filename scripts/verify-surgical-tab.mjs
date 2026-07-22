#!/usr/bin/env node
/**
 * Headless WebKit smoke test for Surgical Waitlists module.
 * Usage: node scripts/verify-surgical-tab.mjs [baseUrl]
 */
import { webkit } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:3004';

const browser = await webkit.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(`${base}/?module=surgical-waits`, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => {
  const btn = document.querySelector('[data-dashboard-id="surgical-waits"]');
  if (btn) btn.click();
});
await page.waitForTimeout(2500);

const body = await page.innerText('body');
const checks = {
  surgicalHeader: body.includes('Surgical Wait Times'),
  hip90: body.includes('36.8'),
  knee90: body.includes('43.1'),
  noLoadError: !body.includes('Failed to load surgical data'),
  noConsoleCrash: errors.length === 0,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok);
console.log(JSON.stringify({ base, checks, consoleErrors: errors }, null, 2));
await browser.close();
process.exit(failed.length ? 1 : 0);