# WebAxe

**WebAxe** — a lightweight, real-browser accessibility scanner for websites.  
Runs Playwright + `axe-core` in a background worker, stores scan metadata in MongoDB, and captures reports & screenshots for inspection via a simple web UI.

> Built as a **portfolio-grade system** demonstrating backend architecture (API + worker + DB) with a React frontend.

---

## Demo / Quick links
- Backend API: `http://localhost:3000`
- Frontend (dev): `http://localhost:5173` (Vite)
- Health check: `GET /` → `{ status: "WebAxe backend running" }`

---

## What WebAxe does
1. Frontend submits a website URL
2. Backend queues a scan in MongoDB
3. Worker process:
   - launches a real Chromium browser
   - injects `axe-core`
   - runs accessibility checks
   - captures full report + screenshot
4. Results are persisted and available via API

---

## Features (current)
- Real browser-based accessibility scans (Playwright + `axe-core`)
- Background worker architecture (separate from API)
- MongoDB-backed scan queue & lifecycle tracking
- Scan states: `queued → running → completed / failed`
- Error classification (timeouts, CSP blocks, invalid URLs, etc.)
- Stores:
  - full `axe` JSON report
  - full-page screenshot
- REST API to:
  - create scans
  - fetch scan history
  - fetch scan status
  - re-run scans
- Frontend UI to trigger scans (React)

---

## Architecture overview

Frontend (React)
|
v
Backend API (Express)
|
v
MongoDB (scan metadata, status, timings)
|
v
Worker (Playwright + axe-core)
|
v
Local / Cloud Storage (reports & screenshots)


- **MongoDB** stores only metadata (JSON, small & queryable)
- **Filesystem / object storage** stores heavy artifacts
- Worker and API run as **separate Node processes**

---

## Tech stack
- **Frontend:** React (Vite), plain CSS
- **Backend:** Node.js, Express
- **Worker:** Playwright (Chromium)
- **Accessibility engine:** `axe-core`
- **Database:** MongoDB (Mongoose)
- **Artifacts:** Local filesystem (MVP)  
  → S3 / Cloudflare R2 recommended for production
- **Dev tools:** MongoDB Compass / VS Code MongoDB extension

---

## Configuration

Set variables in `backend/.env` (API and worker load the same file from the backend directory).

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string for scan metadata. |
| `PORT` | API port (default `3000`). |
| `GEMINI_API_KEY` | Preferred API key for Gemini-powered AI suggestions. |
| `GEMINI_MODEL` | Gemini model id (default `gemini-2.5-flash`). |
| `OPENAI_API_KEY` | Backward-compatible fallback variable name for the same AI suggestion feature. |
| `OPENAI_MODEL` | Backward-compatible fallback model variable. |
| `AI_MAX_ISSUES` | Max number of issues sent to the model per report (default `5`, cost control). |
| `AI_TIMEOUT_MS` | Timeout for the OpenAI request in ms (default `20000`). |

**Worker (Playwright + axe):** the worker creates the browser with `bypassCSP: true` so `axe-core` can be injected on sites with strict Content Security Policy. That applies only to the automated Chromium session, not to end users’ browsers.

**Static artifacts:** the API serves `backend/storage` at `GET /storage/...`. Raw JSON and screenshots are linked as `/storage/<scanId>/raw-report.json` and `screenshot.png`. The Vite app uses `VITE_API_URL` (see below) so those links match your deployed API host.

**Frontend:** optional `webaxe-frontend/.env`:

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL of the backend (e.g. `http://localhost:3000`). Defaults to `http://localhost:3000` if omitted. |

### Analytics API (Week 6)

- `GET /api/scans/history/recent?limit=100` — lightweight list of recent scans (totals, health, grades).
- `GET /api/scans/history/by-url?url=` — all scans for a normalized URL, chronological (for trends).
- `GET /api/scans/compare?before=&after=` — two scan IDs; returns summaries and deltas (issues, health, severity).

Each new scan stores `urlNormalized` (derived from the submitted URL) so repeated scans of the same site group together. Existing documents get `urlNormalized` the next time they are saved.
