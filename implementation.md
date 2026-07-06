# Git Cleanup & Commit Plan — Alberta Hospital Wait Times

## Situation

All 22 phases of work (Phases 0–22 in `tasks/todo.md`) sit as **uncommitted working-tree changes** on `main`. There are no feature branches — "merge everything back into main" means committing the work in logical groups, then pushing to `origin/main`.

**Current git state (verified):**
- 2 commits in history: `e08dbf5` Initial commit + `a813992` feat: initialize project
- 3 files staged (CancerDashboard, PrimaryCareDashboard, WorkforceDashboard) — from partial earlier work; will be unstaged and re-committed in logical groups
- 28 files modified (unstaged)
- 44 untracked paths
- Remote: `github.com/thatdaveguy1/Alberta-Hospital-Wait-Times.git`
- No stashes, no feature branches

**Repo size note:** `data-*.json` files total 5.5 MB (largest: `data-primary-care.json` at 1.4 MB). These are pipeline-generated seed data that the app needs to render dashboards on first load. **Decision: commit them** — they're functional seed data, not disposable build artifacts. The pipelines refresh them in-place at runtime.

---

## Phase 1: .gitignore + Junk Cleanup

### 1A. Update `.gitignore`

Add entries for:
- `.wrangler/` (root + `cloudflare/.wrangler/`) — contains local Miniflare SQLite KV state, should never be committed
- `tmp/` — scratch dir
- `assets/.aistudio/` — AI Studio internal metadata
- `*_top.png`, `*_mid.png` — 8 generated chart screenshots (195 KB each, regeneratable, not source assets)

**Keep ignoring (already present):** `node_modules/`, `build/`, `dist/`, `coverage/`, `.DS_Store`, `*.log`, `.env*` (with `!.env.example` exception).

**Do NOT gitignore:** `data-*.json` (seed data), `cloudflare/` (source), `functions/` (source), `scripts/` (source), `src/` (source), `tasks/` (project tracking).

### 1B. Remove junk files

Delete (with `trash` or safe `rm --`):
- `test.txt` (13 B junk)
- `:\n/` and `:\ntest.txt` — files with literal colon+newline in names, created by botched shell redirect. Remove carefully with `rm -- ':\n/' ':\ntest.txt'`
- `firebase-applet-config.json` — AI Studio Firebase scaffolding, project uses server.ts + cloudflare/worker.ts
- `firebase-blueprint.json` — same
- `firestore.rules` — same
- `metadata.json` — AI Studio app metadata (283 B), not used by the actual app

**Keep:** `functions/api/[[path]].js` — this is the Cloudflare Pages Function that proxies `/api/*` to the Worker. It IS used in production.

### 1C. Fix dependencies in `package.json`

**Remove stale deps** (verified unused — zero imports in `src/` and `cloudflare/`):

From `dependencies`:
- `@google/genai` ^2.4.0 — AI Studio Gemini scaffolding, no Gemini API calls in the app
- `firebase` ^12.15.0 — no Firebase usage
- `firebase-admin` ^14.1.0 — no Firebase admin usage
- `@vis.gl/react-google-maps` ^1.8.3 — project uses `leaflet` for maps, no Google Maps imports

From `devDependencies`:
- `@types/google.maps` ^3.65.2 — type stubs for the removed Google Maps dep

**Add missing deps** (installed in `node_modules/` and imported by pipelines, but never declared in `package.json` — `tasks/todo.md` Phase 6 claims they were added but they weren't):

To `dependencies`:
- `xlsx` — imported by 9 pipeline files (cihiDownloader, cihiMhSafetyFetcher, cihiWaitTimesDownloader, cihiWaitTimesPriorityFetcher, cihiWorkforceFetcher, hqcaContinuingCareFetcher, openAlbertaBillingFetcher, openAlbertaInequityFetcher, primaryCareFetcher)
- `pdf-parse` ^2.4.5 — imported by `fraserDownloader.ts` as `import { PDFParse } from 'pdf-parse'` (v2 named export, confirmed correct)
- `adm-zip` — imported by `cihiDownloader.ts` and `statscanFetcher.ts` for ZIP extraction
- `domhandler` — imported as `import type { AnyNode } from 'domhandler'` by 5 scraper files (abjhiScraper, ahsAsiScraper, cpsaScraper, disruptionsScraper, waittimesAlbertaScraper). Resolves transitively via cheerio but must be declared explicitly since it's imported directly.
- `puppeteer` ^25.3.0 — imported by `powerbiScraper.ts` for headless Chrome Power BI scraping. ESM-only, runs as child process (see lessons.md). Local-only dependency — cannot run on Cloudflare.

**After editing `package.json`, run `npm install`** to regenerate `package-lock.json` with the correct dependency tree.

### 1D. Clean up `vite.config.ts`

Remove the `define` block entry for `process.env.GOOGLE_MAPS_PLATFORM_KEY` — leftover from the removed `@vis.gl/react-google-maps` dep. The app doesn't read this env var anywhere.

Also remove the stale AI Studio comments about `DISABLE_HMR` (the project no longer runs under AI Studio).

### 1E. Fix `tsconfig.json`

Two fixes needed:

1. **Add `"exclude": ["cloudflare"]`** — `cloudflare/worker.ts` uses `hono` and `@cloudflare/workers-types` not installed in the main project. Without the exclude, `npx tsc --noEmit` from the root tries to typecheck the Worker and fails with 4 `KVNamespace` errors. (Lessons.md says this was done but the current `tsconfig.json` has no `exclude` field — it was lost.)

2. **Add `"ES2024"` to `lib`** — 10 pipeline files use `Promise.withResolvers()`, which requires ES2024. Current `lib` is `["ES2022", "DOM", "DOM.Iterable"]` → 10 `TS2550` errors. Adding `"ES2024"` resolves all 10.

---

## Phase 2: README + .env.example Refresh

### 2A. Rewrite `README.md`

Replace the AI Studio boilerplate (references GEMINI_API_KEY, AI Studio app URL) with an accurate project overview:

- **Project name:** Alberta Hospital Wait Times Dashboard
- **What it is:** A 15-tab dashboard visualizing Alberta healthcare system data (ER wait times, surgical waits, diagnostic imaging, primary care, cancer, mental health, continuing care, public health, workforce, spending, patient experience, regional inequity, virtual care, system flow, service disruptions)
- **Architecture:** React + Vite frontend, Express server (`server.ts`) with 28 data pipelines (`src/pipelines/`), Cloudflare Worker thin read layer (`cloudflare/worker.ts`) reading from KV, Cloudflare Pages deployment with `functions/api/[[path]].js` proxy
- **Run locally:** `npm install` → `npm run dev` (port 3004)
- **Build:** `npm run build`
- **Deploy:** Cloudflare Pages (frontend) + Cloudflare Worker (read layer)
- **Env vars:** `PUSH_SECRET`, `CLOUDFLARE_WORKER_URL` (see `.env.example`)
- **Data sources:** AHS, CIHI, HQCA, StatsCan, Open Alberta, PHAC, Alberta Health, CPSA, Fraser Institute, 211 Alberta

### 2B. Rewrite `.env.example`

Replace GEMINI_API_KEY/APP_URL with the actual env vars the project uses:
```
# HMAC secret for signing push requests from local server to Cloudflare Worker
PUSH_SECRET="generate with: openssl rand -hex 24"

# Cloudflare Worker URL for the push client
CLOUDFLARE_WORKER_URL="https://alberta-hospital-wait-times.longmad.workers.dev"
```

---

## Phase 3: Add Missing npm Scripts

`tasks/todo.md` Phase 11 and Phase 17 claim these scripts were added, but `package.json` only has `dev`, `build`, `start`, `clean`, `lint`. Re-add them:

```json
"pipeline": "tsx src/pipelines/orchestrator.ts",
"push:all": "tsx src/pipelines/pushClient.ts --all",
"deploy:worker": "cd cloudflare && wrangler deploy",
"deploy:pages": "wrangler pages deploy dist --project-name alberta-hospital-wait-times",
"seed:kv": "cd cloudflare && wrangler kv key put --remote",
"gen:push-secret": "openssl rand -hex 24"
```

**Verification:** `npm run` lists all scripts without error.

---

## Phase 4: Logical Commits

Unstage the 3 currently-staged files first: `git reset HEAD --`.

Then commit in this order (each commit is self-contained and typechecks):

### Commit 1: chore: clean up scaffolding, gitignore, stale deps
- `.gitignore` (updated)
- `package.json` (deps removed + missing deps added + scripts added)
- `package-lock.json` (regenerated)
- `vite.config.ts` (Google Maps define removed)
- `tsconfig.json` (cloudflare exclude + ES2024 lib added)
- `README.md` (rewritten)
- `.env.example` (rewritten)
- Deleted: `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`, `metadata.json`, `test.txt`, `:\n/`, `:\ntest.txt`

### Commit 2: feat: add data layer (JSON seed files + TS interfaces)
- `data-*.json` (21 files, 5.5 MB — seed data for all 15 dashboards)
- `data-shapes-reference.md`
- `data-disruption-overrides.json`
- `hand-authored-catalog.json`
- `data-zone-by-city.json`
- All `src/*Data.ts` files (13 files — TypeScript interfaces + empty/seed arrays)
- `src/types.ts`

### Commit 3: feat: add 28 data pipelines + orchestrator
- `src/pipelines/` (entire directory — 35 files including README.md, types.ts, orchestrator.ts, scheduler.ts, pushClient.ts, syncStatus.ts, and 28 fetcher/scraper/downloader pipelines)
- `src/hooks/useSyncStatus.ts`
- `scripts/extract_cihi_attachment.py`
- `scripts/extract-data-to-json.ts`

### Commit 4: feat: add frontend (15 dashboards + App + components)
- `src/App.tsx`
- `src/main.tsx`
- `src/index.css`
- `src/components/` (17 dashboard components + DataTimestamp.tsx, LiveDataBadge.tsx, MapComponent.tsx)
- `index.html`

### Commit 5: feat: add Express server with API endpoints + scheduler
- `server.ts`

### Commit 6: feat: add Cloudflare Worker + Pages deployment
- `cloudflare/worker.ts`
- `cloudflare/wrangler.toml`
- `cloudflare/tsconfig.json`
- `cloudflare/package.json`
- `cloudflare/package-lock.json`
- `functions/api/[[path]].js` (Pages proxy)

### Commit 7: docs: add project tracking (tasks, lessons, implementation plan)
- `tasks/todo.md`
- `lessons.md`
- `implementation.md`

---

## Phase 5: Verify Before Push

1. **Typecheck:** `npx tsc --noEmit` from root → expect exactly 4 pre-existing errors in `src/pipelines/acuteCareScraper.ts` only (2x `"days"` unit not in union type `count|percent|hours|beds_per_1000`, 2x `edVisitsPer1000` property missing from `LGADemand`). These are pre-existing type bugs unrelated to the cleanup — the `exclude: ["cloudflare"]` fix removes 4 Worker errors and the `ES2024` lib fix removes 10 `withResolvers` errors, bringing the total from 18 down to 4.
2. **Build:** `npm run build` → must succeed (produces `dist/`)
3. **Git status:** `git status` → clean working tree, 7 new commits on `main`
4. **Git log:** `git log --oneline -10` → verify 7 commits + 2 original = 9 total

---

## Phase 6: Push to Origin (REQUIRES USER APPROVAL)

Per AGENTS.md: never deploy to production unless asked. Pushing to `origin/main` is a production action.

**Action:** `git push origin main`

**After push:** verify on GitHub that all 7 commits landed and the repo tree looks correct (no `.wrangler/`, no junk files, no Firebase scaffolding).

---

## Files Touched Summary

| Action | Files |
|--------|-------|
| Edit | `.gitignore`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `README.md`, `.env.example` |
| Delete | `firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`, `metadata.json`, `test.txt`, `:\n/`, `:\ntest.txt` |
| Commit (new) | 21 `data-*.json`, 13 `src/*Data.ts`, `src/types.ts`, 35 `src/pipelines/*`, 17 `src/components/*`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/hooks/useSyncStatus.ts`, `server.ts`, `index.html`, `cloudflare/*`, `functions/api/[[path]].js`, `scripts/*`, `tasks/todo.md`, `lessons.md`, `implementation.md`, `data-shapes-reference.md`, `hand-authored-catalog.json`, `data-disruption-overrides.json`, `data-zone-by-city.json` |
| Gitignore (new) | `.wrangler/`, `tmp/`, `assets/.aistudio/`, `*_top.png`, `*_mid.png` |

## Success Criteria

- [ ] `npx tsc --noEmit` shows only 4 pre-existing `acuteCareScraper.ts` errors (down from 18)
- [ ] `npm run build` succeeds
- [ ] `git status` shows clean working tree
- [ ] 7 logical commits on `main`
- [ ] No junk files, Firebase scaffolding, or `.wrangler/` in the repo
- [ ] No stale deps (`@google/genai`, `firebase`, `firebase-admin`, `@vis.gl/react-google-maps`) in `package.json`
- [ ] Missing deps (`xlsx`, `pdf-parse`, `adm-zip`, `domhandler`, `puppeteer`) declared in `package.json`
- [ ] README.md reflects actual project (no AI Studio references)
- [ ] `.env.example` has correct vars (PUSH_SECRET, CLOUDFLARE_WORKER_URL)
- [ ] **User approves before `git push origin main`**
