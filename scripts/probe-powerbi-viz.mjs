// Probe Power BI — properly parse DSR C/S values for Wait_viz vs Wait_viz2
import puppeteer from 'puppeteer';

const POWERBI_REPORT_URL =
  'https://app.powerbi.com/view?r=eyJrIjoiMjUzNjc1MWQtYjcxZC00NTMzLWIwNDctZTA0ZTNiMWQzODBlIiwidCI6IjJiYjUxYzA2LWFmOWItNDJjNS04YmY1LTNjM2I3YjEwODUwYiJ9';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function parseDsrRows(dsrData) {
  const ph = dsrData?.dsr?.DS?.[0]?.PH?.[0];
  if (!ph) return [];
  const dm0 = ph.DM0;
  if (!dm0) return [];
  const schemaEntry = dm0.find((r) => r.S);
  const schema = schemaEntry?.S?.map((s) => s.N) ?? [];
  const rows = [];
  for (const entry of dm0) {
    const cells = entry.C;
    if (!cells || cells.length === 0) continue;
    const row = {};
    schema.forEach((key, i) => { row[key] = cells[i]; });
    // Also capture G0 and M0 if present directly
    if (entry.G0 !== undefined) row._G0 = entry.G0;
    if (entry.M0 !== undefined) row._M0 = entry.M0;
    rows.push(row);
  }
  return rows;
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

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

          // Only capture Type + Wait_viz (exact) or Type + Wait_viz2
          if (selectStr.includes('SurgWait_v2.Type') &&
              (selectStr.includes('Wait_viz') || selectStr.includes('Wait_viz2'))) {

            const isViz2 = selectStr.includes('Wait_viz2');
            const label = isViz2 ? 'Wait_viz2' : 'Wait_viz (exact, no viz2)';

            // Check if StatLabel is in the query
            const hasStatLabel = selectStr.includes('StatLabel');

            const rows = parseDsrRows(data);
            console.log(`\n=== ${label} | hasStatLabel=${hasStatLabel} | selects: ${selectNames.join(', ')} ===`);
            console.log(`  Schema: ${rows.length} rows`);
            for (const r of rows.slice(0, 12)) {
              console.log(`  row:`, JSON.stringify(r));
            }

            // Also try hierarchical parse
            const ph = data?.dsr?.DS?.[0]?.PH?.[0];
            if (ph?.DM0) {
              for (const entry of ph.DM0.slice(0, 3)) {
                if (entry.G0 || entry.X) {
                  console.log(`  hier: G0=${entry.G0} X=${JSON.stringify(entry.X?.slice(0,3))}`);
                }
              }
            }
          }
        }
      } catch (err) { /* ignore */ }
    });

    console.log('Navigating to Power BI report...');
    await page.goto(POWERBI_REPORT_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 15000));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const surgBtn = buttons.find((b) => b.textContent.trim() === 'Surgery');
      if (surgBtn) surgBtn.click();
    });
    await new Promise((r) => setTimeout(r, 15000));

    console.log('\nDone.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
