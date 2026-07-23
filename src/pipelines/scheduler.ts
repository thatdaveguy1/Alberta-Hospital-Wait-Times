// Scheduler — manages timed execution of fast-tier pipelines.
// ER wait times and lab waits: every 10 minutes.
// The daily full sync is run by the standalone `npm run daily-sync` script
// (src/pipelines/dailySync.ts), scheduled via launchd — not by this scheduler.

import fs from "fs";
import path from "path";
import {
	fetchErWaitTimes,
	getHospitals,
	getSnapshots,
	setAlertChecker,
} from "./erWaitTimesFetcher";
import {
	getLabSnapshots,
	run as runAplLabWaits,
} from "./aplLabWaitTimesFetcher";
import { pushToCloudflare } from "./pushClient";
import { pushErTrends, pushLabTrends } from "./trendsPusher";
import { runDailySyncFlow } from "./dailySync";
import {
	recordErWaitTimesUpdate,
	recordLabWaitsUpdate,
	loadSyncStatusFromDisk,
	getSyncStatus,
} from "./syncStatus";
import type { SyncResult } from "./types";

let erIntervalId: NodeJS.Timeout | null = null;
let labIntervalId: NodeJS.Timeout | null = null;
let lastErTrendsPushMs = 0;
let lastLabTrendsPushMs = 0;
// Live boards can refresh every 10 min; trend KV keys change every cycle and
// are the write-budget killers. Cap trend pushes at 60 min.
const TRENDS_MIN_INTERVAL_MS = 60 * 60 * 1000;

export function setAlertCheckFn(fn: () => void): void {
	setAlertChecker(fn);
}

export function getHospitalsData() {
	return getHospitals();
}
export function getSnapshotsData() {
	return getSnapshots();
}
export function getLabSnapshotsData() {
	return getLabSnapshots();
}

async function runErWaitTimesPipeline(): Promise<void> {
	const result = await fetchErWaitTimes();
	recordErWaitTimesUpdate(result);

	// Always publish the current sync status so failures propagate immediately.
	await pushToCloudflare("sync-status", getSyncStatus());

	// Push domain data and trends only on success.
	if (result.status === "success") {
		await pushToCloudflare("er-waittimes", {
			hospitals: getHospitals(),
			lastUpdated: result.timestamp,
		});
		// Provincial/zone trend blob — throttle hourly for free-tier KV budget.
		const now = Date.now();
		if (now - lastErTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			await pushErTrends(getSnapshots(), getHospitals());
			lastErTrendsPushMs = now;
		} else {
			const waitMin = Math.ceil(
				(TRENDS_MIN_INTERVAL_MS - (now - lastErTrendsPushMs)) / 60000,
			);
			console.log(
				`[Scheduler] Skipping ER trends push (next in ~${waitMin}m) to conserve KV writes`,
			);
		}
	}
}

async function runLabWaitsPipeline(): Promise<void> {
	const result = await runAplLabWaits();
	recordLabWaitsUpdate(result);

	// Always publish the current sync status so failures propagate immediately.
	await pushToCloudflare("sync-status", getSyncStatus());

	// Push domain data and trends only on success.
	if (result.status === "success") {
		const diagnosticFile = path.join(process.cwd(), "data-diagnostic.json");
		try {
			const data = fs.readFileSync(diagnosticFile, "utf8");
			const parsed = JSON.parse(data);
			await pushToCloudflare("diagnostic", parsed);
		} catch (err) {
			console.warn(
				"[Scheduler] Failed to push diagnostic data to Cloudflare:",
				err,
			);
		}
		// Lab trend aggregates — throttle hourly for free-tier KV budget.
		const now = Date.now();
		if (now - lastLabTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			await pushLabTrends(getLabSnapshots());
			lastLabTrendsPushMs = now;
		} else {
			const waitMin = Math.ceil(
				(TRENDS_MIN_INTERVAL_MS - (now - lastLabTrendsPushMs)) / 60000,
			);
			console.log(
				`[Scheduler] Skipping lab trends push (next in ~${waitMin}m) to conserve KV writes`,
			);
		}
	}
}

export async function startScheduler(): Promise<void> {
	// Load persisted sync status
	loadSyncStatusFromDisk();

	// Initial ER wait times run — fast, await so hospitals are populated before serving
	console.log("[Scheduler] Starting initial ER wait times pipeline...");
	await runErWaitTimesPipeline();

	// Kick off lab waits in the background — don't block server startup
	runLabWaitsPipeline().catch((err) => {
		console.error("[Scheduler] Initial lab waits pipeline error:", err);
	});

	// Schedule ER wait times and lab waits every 10 minutes
	erIntervalId = setInterval(
		() => {
			runErWaitTimesPipeline().catch((err) => {
				console.error("[Scheduler] ER wait times pipeline error:", err);
			});
		},
		10 * 60 * 1000,
	);

	labIntervalId = setInterval(
		() => {
			runLabWaitsPipeline().catch((err) => {
				console.error("[Scheduler] Lab waits pipeline error:", err);
			});
		},
		10 * 60 * 1000,
	);

	console.log(
		"[Scheduler] Running. ER wait times: every 10 min. Lab waits: every 10 min.",
	);
}

export function stopScheduler(): void {
	if (erIntervalId) {
		clearInterval(erIntervalId);
		erIntervalId = null;
	}
	if (labIntervalId) {
		clearInterval(labIntervalId);
		labIntervalId = null;
	}
	console.log("[Scheduler] Stopped.");
}

// Manual trigger for daily sync (used by POST /api/sync/trigger).
// Reuses the same standalone flow as the launchd one-shot.
export async function triggerDailySync(): Promise<SyncResult[]> {
	console.log("[Scheduler] Manual daily sync trigger via API...");
	await runDailySyncFlow();
	return getSyncStatus().results;
}
