import 'dotenv/config';
import { fetchErWaitTimes, getHospitals, getSnapshots } from '../src/pipelines/erWaitTimesFetcher';
import { pushErTrends } from '../src/pipelines/trendsPusher';

async function main() {
  console.log('[PushTrends] Initializing ER wait times and loading snapshots...');
  const result = await fetchErWaitTimes();
  if (result.status !== 'success') {
    throw new Error(`Failed to initialize wait times: ${result.error}`);
  }
  
  const snaps = getSnapshots();
  const hosps = getHospitals();
  console.log(`[PushTrends] Loaded ${snaps.length} snapshots for ${hosps.length} hospitals.`);
  
  console.log('[PushTrends] Compiling and pushing er-trends blob (with per-facility slices) to Cloudflare...');
  await pushErTrends(snaps, hosps);
  console.log('[PushTrends] Push complete!');
}

main().catch(err => {
  console.error('[PushTrends] FAILED:', err);
  process.exit(1);
});
