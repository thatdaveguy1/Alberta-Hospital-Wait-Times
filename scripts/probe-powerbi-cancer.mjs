// Probe Power BI Surgery tab — scroll and capture cancer-specific text/units.
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

    // Capture queries that might be cancer-specific
    const cancerQueries = [];
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
          // Capture any query with "cancer" in measure names or different wait measures
          if (selectStr.toLowerCase().includes('cancer') || selectStr.includes('Wait_viz')) {
            // Try to extract actual values from all possible DSR locations
            const dsr = data.dsr;
            const allValues = [];
            if (dsr?.DS) {
              for (const ds of dsr.DS) {
                if (ds?.PH) {
                  for (const ph of ds.PH) {
                    if (ph?.DM0) {
                      for (const dm of ph.DM0) {
                        allValues.push({ G0: dm.G0, M0: dm.M0, M1: dm.M1, M2: dm.M2 });
                      }
                    }
                    if (ph?.X) {
                      for (const x of ph.X) {
                        if (x?.DM0) {
                          for (const dm of x.DM0) {
                            allValues.push({ G0: dm.G0, M0: dm.M0, M1: dm.M1, M2: dm.M2 });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            cancerQueries.push({ selectNames, allValues: allValues.slice(0, 15) });
            console.log('\n=== QUERY:', selectNames.join(', '), '===');
            for (const v of allValues.slice(0, 15)) {
              console.log(`  G0=${v.G0}  M0=${v.M0}  M1=${v.M1}  M2=${v.M2}`);
            }
          }
        }
      } catch (err) { /* ignore */ }
    });

    console.log('Navigating to Power BI report...');
    await page.goto(POWERBI_REPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 15000));

    // Click Surgery tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const surgBtn = buttons.find((b) => b.textContent.trim() === 'Surgery');
      if (surgBtn) (surgBtn).click();
    });
    await new Promise((r) => setTimeout(r, 15000));

    // Scroll down to find cancer surgery section
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Capture ALL visible text mentioning cancer or days
    const allText = await page.evaluate(() => document.body?.innerText ?? '');
    const cancerLines = allText
      .split('\n')
      .filter((l) => /cancer|days|day\b/i.test(l))
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    console.log('\n=== VISIBLE TEXT mentioning cancer/days ===');
    for (const l of cancerLines.slice(0, 50)) {
      console.log('  ', l);
    }

    // Also capture context around "cancer" mentions
    const lines = allText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (/cancer.*wait|wait.*cancer|cancer.*surg|surg.*cancer|cancer.*days|days.*cancer/i.test(lines[i])) {
        console.log('\n--- Context around cancer mention (line', i, ') ---');
        for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 5); j++) {
          console.log(`  [${j}] ${lines[j].trim()}`);
        }
      }
    }

    console.log('\nDone. Cancer-related queries:', cancerQueries.length);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
