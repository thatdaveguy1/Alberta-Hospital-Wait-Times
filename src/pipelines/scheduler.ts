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

// Graceful shutdown state.
let shuttingDown = false;
const activePipelinePromises = new Set<Promise<unknown>>();

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

/** Returns true if the scheduler is currently shutting down. */
export function isSchedulerShuttingDown(): boolean {
	return shuttingDown;
}

function trackPromise<T>(promise: Promise<T>): Promise<T> {
	activePipelinePromises.add(promise);
	promise.finally(() => activePipelinePromises.delete(promise)).catch(() => {});
	return promise;
}

async function runErWaitTimesPipeline(): Promise<void> {
	if (shuttingDown) return;
	const result = await fetchErWaitTimes();
	recordErWaitTimesUpdate(result);

	// On success, push fresh domain data and throttled trends BEFORE sync-status
	// so a quota/cooldown on the status write cannot strand the new public data.
	if (result.status === "success") {
		const domainPush = pushToCloudflare("er-waittimes", {
			hospitals: getHospitals(),
			lastUpdated: result.timestamp,
		});

		// Provincial/zone trend blob — throttle hourly for free-tier KV budget.
		const now = Date.now();
		let trendPromise: Promise<unknown> = Promise.resolve();
		if (now - lastErTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			trendPromise = pushErTrends(getSnapshots(), getHospitals());
			lastErTrendsPushMs = now;
		} else {
			const waitMin = Math.ceil(
				(TRENDS_MIN_INTERVAL_MS - (now - lastErTrendsPushMs)) / 60000,
			);
			console.log(
				`[Scheduler] Skipping ER trends push (next in ~${waitMin}m) to conserve KV writes`,
			);
		}

		await domainPush;
		await trendPromise;

		// Publish the current sync status after domain data is in KV.
		await pushToCloudflare("sync-status", getSyncStatus());
	} else {
		// Failure path: still publish sync-status so the failure is visible immediately.
		await pushToCloudflare("sync-status", getSyncStatus());
	}
}

async function runLabWaitsPipeline(): Promise<void> {
	if (shuttingDown) return;
	const result = await runAplLabWaits();
	recordLabWaitsUpdate(result);

	if (result.status === "success") {
		const diagnosticFile = path.join(process.cwd(), "data-diagnostic.json");
		let domainPush: Promise<unknown> = Promise.resolve();
		try {
			const data = fs.readFileSync(diagnosticFile, "utf8");
			const parsed = JSON.parse(data);
			domainPush = pushToCloudflare("diagnostic", parsed);
		} catch (err) {
			console.warn(
				"[Scheduler] Failed to push diagnostic data to Cloudflare:",
				err,
			);
		}

		// Lab trend aggregates — throttle hourly for free-tier KV budget.
		const now = Date.now();
		let trendPromise: Promise<unknown> = Promise.resolve();
		if (now - lastLabTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			trendPromise = pushLabTrends(getLabSnapshots());
			lastLabTrendsPushMs = now;
		} else {
			const waitMin = Math.ceil(
				(TRENDS_MIN_INTERVAL_MS - (now - lastLabTrendsPushMs)) / 60000,
			);
			console.log(
				`[Scheduler] Skipping lab trends push (next in ~${waitMin}m) to conserve KV writes`,
			);
		}

		await domainPush;
		await trendPromise;

		await pushToCloudflare("sync-status", getSyncStatus());
	} else {
		await pushToCloudflare("sync-status", getSyncStatus());
	}
}

function scheduleWrapped(fn: () => Promise<void>, label: string): () => void {
	return () => {
		if (shuttingDown) return;
		const p = fn();
		trackPromise(p);
		p.catch((err) => {
			console.error(`[Scheduler] ${label} pipeline error:`, err);
		});
	};
}

export async function startScheduler(): Promise<void> {
	shuttingDown = false;
	activePipelinePromises.clear();

	// Load persisted sync status
	loadSyncStatusFromDisk();

	// Initial ER wait times run — fast, await so hospitals are populated before serving
	console.log("[Scheduler] Starting initial ER wait times pipeline...");
	await trackPromise(runErWaitTimesPipeline());

	// Kick off lab waits in the background — don't block server startup
	trackPromise(runLabWaitsPipeline()).catch((err) => {
		console.error("[Scheduler] Initial lab waits pipeline error:", err);
	});

	// Schedule ER wait times and lab waits every 10 minutes
	erIntervalId = setInterval(
		scheduleWrapped(runErWaitTimesPipeline, "ER wait times"),
		10 * 60 * 1000,
	);

	labIntervalId = setInterval(
		scheduleWrapped(runLabWaitsPipeline, "Lab waits"),
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

/**
 * Initiate graceful shutdown: stop accepting new ticks, wait for in-flight
 * pipelines, then close the HTTP server. Exported so server.ts can wire it to
 * SIGTERM/SIGINT. Resolves once the drain step is done; it does not call
 * process.exit — that is the caller's responsibility.
 */
export async function shutdownScheduler(server?: {
	close: (cb?: (err?: Error) => void) => void;
}): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log("[Scheduler] Shutting down: stopping intervals...");
	stopScheduler();

	console.log(
		`[Scheduler] Waiting for ${activePipelinePromises.size} active pipeline(s)...`,
	);
	const drainStart = Date.now();
	const drainTimeout = 30_000;
	try {
		await Promise.race([
			Promise.allSettled([...activePipelinePromises]),
			new Promise<void>((resolve) => setTimeout(resolve, drainTimeout)),
		]);
	} catch (err) {
		console.error("[Scheduler] Drain promise error:", err);
	}
	console.log(
		`[Scheduler] Drained in ${Date.now() - drainStart}ms (timeout ${drainTimeout}ms)`,
	);

	if (server) {
		await new Promise<void>((resolve) => {
			server.close(() => {
				console.log("[Scheduler] HTTP server closed.");
				resolve();
			});
		});
	}
}

// Manual trigger for daily sync (used by POST /api/sync/trigger).
// Reuses the same standalone flow as the launchd one-shot.
export async function triggerDailySync(): Promise<SyncResult[]> {
	if (shuttingDown) {
		console.log("[Scheduler] Refusing daily sync trigger during shutdown.");
		return getSyncStatus().results;
	}
	console.log("[Scheduler] Manual daily sync trigger via API...");
	await trackPromise(runDailySyncFlow());
	return getSyncStatus().results;
}
