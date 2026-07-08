#!/usr/bin/env node
/**
 * Visual re-audit: set location T8N 7W7, tour four remediated subtabs, save PNGs.
 * Run: node scripts/visual-reaudit-puppeteer.mjs
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots/visual-reaudit-2026-07-08');
const BASE = process.env.REAUDIT_URL || 'http://127.0.0.1:3004/';

fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickButtonByText(page, text, { exact = false } = {}) {
  return page.evaluate(
    (t, exact) => {
      const buttons = [...document.querySelectorAll('button')];
      const visible = buttons.filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const el = visible.find((b) => {
        const c = (b.textContent || '').replace(/\s+/g, ' ').trim();
        const needle = t.replace(/\s+/g, ' ').trim();
        return exact ? c.toLowerCase() === needle.toLowerCase() : c.toLowerCase().includes(needle.toLowerCase());
      });
      if (!el) {
        return { ok: false, reason: 'no visible button: ' + t, sample: visible.map((b) => b.textContent?.trim().slice(0, 40)).slice(0, 12) };
      }
      el.scrollIntoView({ block: 'center', inline: 'center' });
      el.click();
      return { ok: true };
    },
    text,
    exact
  );
}

async function bodySnippet(page, max = 4000) {
  return page.evaluate((max) => document.body.innerText.slice(0, max), max);
}

async function setLocationT8N(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.setItem(
      'alberta_hospital_user_location',
      JSON.stringify({
        lat: 53.6303,
        lng: -113.6253,
        city: 'St. Albert',
        region: 'AB',
        isGPS: false,
      })
    );
    localStorage.setItem('alberta_hospital_location_prompt_dismissed', '1');
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);

  const hasModal = await page.evaluate(() =>
    (document.body.innerText || '').includes('Set Your Location')
  );

  if (hasModal) {
    const input = await page.$('input[placeholder*="postal"]');
    if (input) {
      await input.click({ clickCount: 3 });
      await input.type('T8N 7W7', { delay: 25 });
      await clickButtonByText(page, 'Set Location');
      await page
        .waitForFunction(() => !(document.body.innerText || '').includes('Set Your Location'), {
          timeout: 30000,
        })
        .catch(() => {});
      await sleep(2000);
    }
  }

  const stored = await page.evaluate(() => localStorage.getItem('alberta_hospital_user_location'));
  const body = await bodySnippet(page, 600);
  return {
    modal: hasModal,
    stored: stored ? JSON.parse(stored) : null,
    modalVisible: body.includes('Set Your Location'),
    cityLine: body.match(/St\. Albert|St Albert|T8N/i)?.[0] ?? null,
  };
}


const MODULE_NAV = {
  ltc: { category: 'Community Care', shortName: 'Long Term Care' },
  mh: { category: 'Prevention', shortName: 'Mental Health' },
  flow: { category: 'System Capacity', shortName: 'System Flow' },
  spending: { category: 'Equity & Outcomes', shortName: 'Health Spending' },
};

async function ensureModulePickerOpen(page) {
  const isOpen = () =>
    page.evaluate(
      () =>
        (document.body.innerText || '').includes('Select a module below') ||
        (document.body.innerText || '').includes('Minimize')
    );
  if (await isOpen()) return;

  const handle = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find((b) => {
      const label = (b.textContent || '').replace(/\s+/g, ' ').trim();
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && /^Change Module$/i.test(label);
    });
  });
  const el = handle.asElement();
  if (!el) throw new Error('Change Module button not found');
  await el.click();
  await sleep(3000);
  if (!(await isOpen())) {
    const snippet = await bodySnippet(page, 800);
    throw new Error('Module picker did not open. Body: ' + snippet.slice(0, 400));
  }
}

async function openModule(page, key) {
  const nav = MODULE_NAV[key];
  if (!nav) throw new Error('Unknown module key: ' + key);

  await ensureModulePickerOpen(page);
  await sleep(600);

  const search = await page.$('input[placeholder*="Search modules"]');
  if (search) {
    await search.click({ clickCount: 3 });
    await search.evaluate((el) => {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await search.type(nav.shortName, { delay: 25 });
    await sleep(900);
  }

  if (nav.category !== 'All') {
    await clickButtonByText(page, nav.category);
    await sleep(600);
  }

  const r = await page.evaluate((want) => {
    const wantLc = want.toLowerCase();
    const buttons = [...document.querySelectorAll('button')];
    const visible = buttons.filter((b) => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const el = visible.find((b) => {
      const t = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (t === 'change module' || t === 'minimize') return false;
      return t.includes(wantLc);
    });
    if (!el) {
      return { ok: false, sample: visible.map((b) => b.textContent?.trim().slice(0, 55)).slice(0, 20) };
    }
    el.scrollIntoView({ block: 'center' });
    el.click();
    return { ok: true };
  }, nav.shortName);
  if (!r.ok) throw new Error('Module tile not found: ' + nav.shortName + ' ' + JSON.stringify(r));
  await sleep(4500);
  await page
    .waitForFunction(
      () => !(document.body.innerText || '').includes('Select a module below'),
      { timeout: 20000 }
    )
    .catch(() => {});
}

async function captureStep(page, name, subtabText, checks) {
  if (subtabText) {
    const st = await clickButtonByText(page, subtabText);
    if (!st.ok) throw new Error('Subtab not found: ' + subtabText + ' — ' + JSON.stringify(st));
    await sleep(2800);
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 12000 }).catch(() => {});
  }
  const png = path.join(OUT, name);
  await page.screenshot({ path: png, fullPage: false });
  await sleep(300);
  const text = await bodySnippet(page, 12000);
  const result = {
    file: name,
    nan: /\bNaN\b/.test(text),
    locationModal: text.includes('Set Your Location'),
    checks: {},
  };
  for (const [k, re] of Object.entries(checks)) {
    result.checks[k] = re.test(text);
  }
  fs.writeFileSync(path.join(OUT, name.replace('.png', '.txt')), text.slice(0, 6000));
  return result;
}

const chromePaths = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];
const executablePath = chromePaths.find((p) => fs.existsSync(p));

const browser = await puppeteer.launch({
  headless: process.env.HEADED === '1' ? false : 'new',
  executablePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 1920, height: 1080 },
});

async function runSubtabAudit(moduleKey, pngName, subtabText, checks) {
  const page = await browser.newPage();
  try {
    await setLocationT8N(page);
    await openModule(page, moduleKey);
    return await captureStep(page, pngName, subtabText, checks);
  } finally {
    await page.close();
  }
}

const report = { base: BASE, location: null, steps: [] };

try {
  const locPage = await browser.newPage();
  try {
    report.location = await setLocationT8N(locPage);
  } finally {
    await locPage.close();
  }

  report.steps.push(
    await runSubtabAudit('ltc', '01-ltc-compliance.png', 'Compliance Registry', {
      compliance: /Compliance Registry|Accommodation Standards/i,
      openAlberta: /Open Government|Open Alberta/i,
    })
  );

  report.steps.push(
    await runSubtabAudit('mh', '02-mh-addiction-beds.png', 'Addiction Beds', {
      abed: /ABED|findaddictionbeds/i,
      beds: /Available|vacanc|Bed/i,
    })
  );

  report.steps.push(
    await runSubtabAudit('flow', '03-system-flow-lga.png', 'Benchmarks & Profiles', {
      lga: /Upstream LGA Demand Profiles/i,
      cihi: /CIHI National Comparators/i,
    })
  );

  report.steps.push(
    await runSubtabAudit('spending', '04-spending-physician.png', 'Physician Payments', {
      physician: /Physician Payments|AHCIP|statistical supplement/i,
    })
  );

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}