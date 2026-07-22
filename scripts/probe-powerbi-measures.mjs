// Probe Power BI Surgery tab — capture DSR measure metadata to determine
// whether the wait measure is median, 90th percentile, or something else.
// Usage: node scripts/probe-powerbi-measures.mjs

import puppeteer from 'puppeteer';

const POWERBI_REPORT_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiMjUzNjc1MWQtYjcxZC00NTMzLWIwNDctZTA0ZTNiMWQzODBlIiwidCI6IjJiYjUxYzA2LWFmOWItNDJjNS04YmY1LTNjM2I3YjEwODUwYiJ9';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    const measureInfo = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('querydata') || response.status() !== 200) return;
      try {
        const text = await response.text();
        const parsed = JSON.parse(text);
        for (const result of parsed.results ?? []) {
          const data = result.result?.data;
          if (!data) continue;
          const selectNames = data.descriptor?.Select?.map((s) => s.Name) ?? [];
          const selectStr = selectNames.join('|');

          // Capture everything related to surgery wait/volume/pct measures
          if (
            selectStr.includes('SurgWait') ||
            selectStr.includes('SurgVol') ||
            selectStr.includes('SurgMap') ||
            selectStr.includes('Wait_viz') ||
            selectStr.includes('Volume_viz') ||
            selectStr.includes('PctInTarget')
          ) {
            // Extract full descriptor details for each measure
            const selects = data.descriptor?.Select ?? [];
            const measureDetails = selects.map((s) => ({
              Name: s.Name,
              DisplayName: s.DisplayName ?? null,
              Roles: s.Roles ?? null,
              Format: s.Format ?? null,
              Expression: s.Expression?.Source?.[0]?.Properties?.ExpressionText ?? null,
            }));

            // Also capture any text labels from the DSR rows
            const dsr = data.dsr;
            const sampleRows = [];
            if (dsr?.DS?.[0]?.PH?.[0]?.DM0) {
              const dm0 = dsr.DS[0].PH[0].DM0;
              for (let i = 0; i < Math.min(5, dm0.length); i++) {
                sampleRows.push({
                  G0: dm0[i].G0 ?? null,
                  M0: dm0[i].M0 ?? null,
                  M1: dm0[i].M1 ?? null,
                });
              }
            }

            measureInfo.push({
              selectNames,
              measureDetails,
              sampleRows,
            });

            console.log('\n=== QUERY:', selectNames.join(', '), '===');
            for (const m of measureDetails) {
              console.log(`  ${m.Name} | display=${m.DisplayName} | roles=${JSON.stringify(m.Roles)} | format=${m.Format} | expr=${m.Expression}`);
            }
            if (sampleRows.length > 0) {
              console.log('  Sample rows (G0/M0/M1):');
              for (const r of sampleRows) {
                console.log(`    G0=${r.G0}  M0=${r.M0}  M1=${r.M1}`);
              }
            }
          }
        }
      } catch (err) {
        // ignore parse errors
      }
    });

    console.log('Navigating to Power BI report...');
    await page.goto(POWERBI_REPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 15000));

    // Click Surgery tab
    const clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const surgBtn = buttons.find((b) => b.textContent.trim() === 'Surgery');
      if (surgBtn) { (surgBtn).click(); return true; }
      const spans = Array.from(document.querySelectorAll('span'));
      const surgSpan = spans.find((s) => s.textContent.trim() === 'Surgery');
      if (surgSpan) { const parent = surgSpan.closest('button'); if (parent) { (parent).click(); return true; } (surgSpan).click(); return true; }
      return false;
    });
    console.log('Surgery tab click:', clicked ? 'success' : 'NOT FOUND');

    await new Promise((r) => setTimeout(r, 15000));

    // Also try to read visible text labels from the page that describe the wait measure
    const bodyText = await page.evaluate(() => document.body?.innerText ?? '');
    const waitLabels = bodyText
      .split('\n')
      .filter((l) => /median|percentile|longest|shortest|wait|days|weeks|90th|50th|10%/i.test(l))
      .slice(0, 30);
    console.log('\n=== VISIBLE TEXT LABELS mentioning wait/percentile ===');
    for (const l of waitLabels) {
      console.log('  ', l.trim());
    }

    console.log('\nDone. Total surgery-related queries captured:', measureInfo.length);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
