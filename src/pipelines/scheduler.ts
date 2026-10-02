// Scheduler — manages timed execution of fast-tier pipelines.
// ER wait times and lab waits: every 10 minutes.
// Daily full sync: the launchd job (`npm run daily-sync`, 06:00) is the primary
// runner. This process only acts as a staleness fallback: an hourly check (and
// a check on startup) runs the daily flow if the last daily sync is older than
// 26 hours, so a launchd calendar/codesign failure cannot freeze disruptions.

import fs from "fs";
import path from "path";
import {
	fetchErWaitTimes,
	getHospitals,
	getSnapshots,
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
let dailyFallbackIntervalId: NodeJS.Timeout | null = null;
let dailyInFlight = false;

const DAILY_SYNC_FALLBACK_CHECK_MS = 60 * 60 * 1000;
/** Daily sync counts as stale after 26h (24h cadence plus 2h grace for launchd). */
export const DAILY_SYNC_FALLBACK_STALE_MS = 26 * 60 * 60 * 1000;

/** Pure helper: true when the last daily sync is missing, unparseable, or too old. */
export function isDailySyncStale(
	lastSyncTimestamp: string | null,
	nowMs: number,
	thresholdMs = DAILY_SYNC_FALLBACK_STALE_MS,
): boolean {
	if (!lastSyncTimestamp) return true;
	const parsed = Date.parse(lastSyncTimestamp);
	if (!Number.isFinite(parsed)) return true;
	return nowMs - parsed >= thresholdMs;
}

let lastErTrendsPushMs = 0;
let lastLabTrendsPushMs = 0;
// Live boards can refresh every 10 min; trend KV keys change every cycle and
// are the write-budget killers. Cap trend pushes at 60 min.
const TRENDS_MIN_INTERVAL_MS = 60 * 60 * 1000;
// Fast-tier watchdog — self-heal if the 10-min ER/lab timers ever stop firing
// (wedged event loop, swallowed timer error, or a persistently throwing tick).
// 2026-09-25: both tiers went ~35h without a finished attempt while the
// process stayed up; nothing re-fired them until the process restarted.
export const FAST_TIER_WATCHDOG_INTERVAL_MS = 60 * 1000;
export const FAST_TIER_OVERDUE_MS = 15 * 60 * 1000;
let watchdogIntervalId: NodeJS.Timeout | null = null;
let lastErFinishMs = 0;
let lastLabFinishMs = 0;
let erInFlight = false;
let labInFlight = false;

/** Pure helper: true when a fast-tier pipeline has not finished recently. */
export function isFastTierOverdue(
	lastFinishMs: number,
	nowMs = Date.now(),
	thresholdMs = FAST_TIER_OVERDUE_MS,
): boolean {
	return nowMs - lastFinishMs > thresholdMs;
}

/** Snapshot of fast-tier liveness for /api/health. */
export function getFastTierState(nowMs = Date.now()) {
	return {
		erLastFinish: lastErFinishMs ? new Date(lastErFinishMs).toISOString() : null,
		labLastFinish: lastLabFinishMs ? new Date(lastLabFinishMs).toISOString() : null,
		erInFlight,
		labInFlight,
		erOverdue: isFastTierOverdue(lastErFinishMs, nowMs),
		labOverdue: isFastTierOverdue(lastLabFinishMs, nowMs),
		watchdogIntervalMs: FAST_TIER_WATCHDOG_INTERVAL_MS,
		overdueThresholdMs: FAST_TIER_OVERDUE_MS,
	};
}

// Graceful shutdown state.
let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;
const activePipelinePromises = new Set<Promise<unknown>>();

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
	if (shuttingDown || erInFlight) return;
	erInFlight = true;
	try {
		await runErWaitTimesCycle();
	} finally {
		lastErFinishMs = Date.now();
		erInFlight = false;
	}
}

async function runErWaitTimesCycle(): Promise<void> {
	if (shuttingDown) return;
	const result = await fetchErWaitTimes();
	recordErWaitTimesUpdate(result);

	// On success, push fresh domain data and throttled trends BEFORE sync-status
	// so a quota/cooldown on the status write cannot strand the new public data.
	if (result.status === "success") {
		try {
			await pushToCloudflare("er-waittimes", {
				hospitals: getHospitals(),
				lastUpdated: result.timestamp,
			});
		} catch (err) {
			console.error("[Scheduler] ER domain push failed (trends + status still attempted):", err);
		}

		// Provincial/zone trend blob — throttle hourly for free-tier KV budget.
		const now = Date.now();
		if (now - lastErTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			try {
				await pushErTrends(getSnapshots(), getHospitals());
				lastErTrendsPushMs = now;
			} catch (err) {
				console.error("[Scheduler] ER trends push failed (status still attempted):", err);
			}
		} else {
			const waitMin = Math.ceil(
				(TRENDS_MIN_INTERVAL_MS - (now - lastErTrendsPushMs)) / 60000,
			);
			console.log(
				`[Scheduler] Skipping ER trends push (next in ~${waitMin}m) to conserve KV writes`,
			);
		}

		// Publish sync-status after domain data is in KV. Lab pipeline no longer
		// pushes sync-status (ER-only) to avoid duplicate KV writes (~144/day).
		try {
			await pushToCloudflare("sync-status", getSyncStatus());
		} catch (err) {
			console.error("[Scheduler] ER sync-status push failed:", err);
		}
	} else {
		// Failure path: still publish sync-status so the failure is visible immediately.
		try {
			await pushToCloudflare("sync-status", getSyncStatus());
		} catch (err) {
			console.error("[Scheduler] ER failure sync-status push failed:", err);
		}
	}
}

async function runDailySyncPipeline(): Promise<void> {
	if (shuttingDown) return;
	if (dailyInFlight) {
		console.log("[Scheduler] Daily sync already in flight — skipping.");
		return;
	}
	dailyInFlight = true;
	try {
		console.log("[Scheduler] Starting daily sync cycle...");
		await runDailySyncFlow();
	} finally {
		dailyInFlight = false;
	}
}

/** Hourly fallback: refresh status from disk (launchd job writes it from another process), run only if stale. */
async function runDailyFallbackCheck(): Promise<void> {
	if (shuttingDown || dailyInFlight) return;
	loadSyncStatusFromDisk();
	if (!isDailySyncStale(getSyncStatus().lastSyncTimestamp, Date.now())) return;
	console.log("[Scheduler] Daily sync is stale (>26h) — running fallback.");
	await runDailySyncPipeline();
}

async function runLabWaitsPipeline(): Promise<void> {
	if (shuttingDown || labInFlight) return;
	labInFlight = true;
	try {
		await runLabWaitsCycle();
	} finally {
		lastLabFinishMs = Date.now();
		labInFlight = false;
	}
}

async function runLabWaitsCycle(): Promise<void> {
	if (shuttingDown) return;
	const result = await runAplLabWaits();
	recordLabWaitsUpdate(result);
	// Edge sync-status is published by the ER pipeline only (KV write budget).

	if (result.status === "success") {
		try {
			const diagnosticFile = path.join(process.cwd(), "data-diagnostic.json");
			const data = fs.readFileSync(diagnosticFile, "utf8");
			await pushToCloudflare("diagnostic", JSON.parse(data));
		} catch (err) {
			console.warn("[Scheduler] Failed to push diagnostic data to Cloudflare:", err);
		}

		// Lab trend aggregates — throttle hourly for free-tier KV budget.
		const now = Date.now();
		if (now - lastLabTrendsPushMs >= TRENDS_MIN_INTERVAL_MS) {
			try {
				await pushLabTrends(getLabSnapshots());
				lastLabTrendsPushMs = now;
			} catch (err) {
				console.error("[Scheduler] Lab trends push failed:", err);
			}
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

function runFastTierWatchdog(): void {
	if (shuttingDown) return;
	const now = Date.now();
	for (const tier of [
		{ label: "ER wait times", inFlight: erInFlight, lastFinishMs: lastErFinishMs, rerun: runErWaitTimesPipeline },
		{ label: "Lab waits", inFlight: labInFlight, lastFinishMs: lastLabFinishMs, rerun: runLabWaitsPipeline },
	] as const) {
		if (!isFastTierOverdue(tier.lastFinishMs, now)) continue;
		if (tier.inFlight) {
			console.error(
				`[Scheduler] Watchdog: ${tier.label} stuck in-flight for ${Math.round((now - tier.lastFinishMs) / 60000)}m — leaving it alone, needs operator look.`,
			);
			continue;
		}
		console.warn(
			`[Scheduler] Watchdog: ${tier.label} overdue (${Math.round((now - tier.lastFinishMs) / 60000)}m since last finish) — re-firing.`,
		);
		scheduleWrapped(tier.rerun, `${tier.label} (watchdog)`)();
	}
}

export async function startScheduler(): Promise<void> {
	shuttingDown = false;
	shutdownPromise = null;
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

	// Watchdog: if a fast-tier tick ever stops finishing (wedged loop or a
	// persistently throwing tick), re-fire it within ~1 min instead of waiting
	// for the next restart. Skips tiers already running.
	lastErFinishMs = lastLabFinishMs = Date.now();
	watchdogIntervalId = setInterval(runFastTierWatchdog, FAST_TIER_WATCHDOG_INTERVAL_MS);

	dailyFallbackIntervalId = setInterval(
		scheduleWrapped(runDailyFallbackCheck, "Daily sync fallback"),
		DAILY_SYNC_FALLBACK_CHECK_MS,
	);

	if (isDailySyncStale(getSyncStatus().lastSyncTimestamp, Date.now())) {
		console.log(
			"[Scheduler] Daily sync is stale on startup — running catch-up in background.",
		);
		scheduleWrapped(runDailySyncPipeline, "Daily sync catch-up")();
	}

	console.log(
		"[Scheduler] Running. ER wait times: every 10 min. Lab waits: every 10 min. Daily sync: launchd primary; in-process fallback checks hourly (runs if last sync >26h old).",
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
	if (watchdogIntervalId) {
		clearInterval(watchdogIntervalId);
		watchdogIntervalId = null;
	}
	if (dailyFallbackIntervalId) {
		clearInterval(dailyFallbackIntervalId);
		dailyFallbackIntervalId = null;
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
	closeAllConnections?: () => void;
}): Promise<void> {
	if (shutdownPromise) {
		return shutdownPromise;
	}

	shutdownPromise = doShutdown(server);
	return shutdownPromise;
}

async function doShutdown(server?: {
	close: (cb?: (err?: Error) => void) => void;
	closeAllConnections?: () => void;
}): Promise<void> {
	if (shuttingDown) {
		// Already in progress from another signal; shared shutdownPromise awaits.
		return;
	}
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
		const closeStart = Date.now();
		const closeTimeout = 5_000;
		await new Promise<void>((resolve) => {
			const timeout = setTimeout(() => {
				console.warn(`[Scheduler] HTTP server close timed out after ${closeTimeout}ms; forcing sockets closed.`);
				if (typeof server.closeAllConnections === 'function') {
					server.closeAllConnections();
				}
				resolve();
			}, closeTimeout);

			server.close((err) => {
				clearTimeout(timeout);
				if (err) {
					console.warn("[Scheduler] HTTP server close error:", err);
				} else {
					console.log("[Scheduler] HTTP server closed.");
				}
				resolve();
			});
		});
		console.log(`[Scheduler] Server close took ${Date.now() - closeStart}ms`);
	}
}

// Manual trigger for daily sync (used by POST /api/sync/trigger).
// Reuses the same standalone flow as the launchd one-shot.
export async function triggerDailySync(): Promise<SyncResult[]> {
	if (shuttingDown) {
		console.log("[Scheduler] Refusing daily sync trigger during shutdown.");
		return getSyncStatus().results;
	}
	if (dailyInFlight) {
		console.log("[Scheduler] Daily sync already in flight — ignoring manual trigger.");
		return getSyncStatus().results;
	}
	console.log("[Scheduler] Manual daily sync trigger via API...");
	dailyInFlight = true;
	try {
		await trackPromise(runDailySyncFlow());
	} finally {
		dailyInFlight = false;
	}
	return getSyncStatus().results;
}
