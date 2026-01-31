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
