# Alberta Hospital Wait Times — Repo Agent Instructions

This file is repo-specific guidance layered on top of the system-wide `~/Desktop/AGENTS.md`. Read that first.

## Autonomy

- Commit work to `main` after every change order. Do not leave completed work sitting uncommitted in the working tree — once a change order is done and verified, stage and commit it with a clear message. Push to `origin` only when the user explicitly approves.

## Server

- After any change that affects runtime behavior (scheduler, pipelines, Express routes, server bundle, or env-dependent startup), rebuild if needed and restart the local AlbertaHospitals server yourself. Do not ask the user to restart it.
- Default local server: port `3004`. Production-style process is typically `node dist/server.cjs` (`npm run build` then `npm start`). Prefer that when `dist/server.cjs` is already what is listening; otherwise use `npm run dev`.
- Restart procedure: kill whatever is bound to `:3004` (and the matching AlbertaHospitals `server`/`dist/server.cjs` process), start the server again, then verify with a quick health check (e.g. `curl -sS http://127.0.0.1:3004/` or `/api/sync/status`).
