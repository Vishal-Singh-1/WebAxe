# WebAxe

**WebAxe** — lightweight accessibility scanner for websites.  
Runs real browser-based scans (Playwright + `axe-core`), captures reports and screenshots, and provides a simple web UI for running and viewing results.

> Fast demo-ready MVP for placements & portfolio. Built with a small team — backend (Node/Express + Playwright) and frontend (React).

---

## Demo / Quick links
- Backend API: `http://localhost:4000`  
- Frontend (dev): `http://localhost:5173` (Vite)  
- Health: `GET /api/health` → `{ status: "ok" }`

---

## Features (MVP)
- Scan a single URL using a headless browser
- Inject `axe-core` and run accessibility checks
- Save full `axe` JSON report + screenshot per scan
- Simple REST API: create scan, query status, download artifacts
- Frontend landing page + scan trigger (React)

### Stretch / future
- Auth & user scan history
- Multi-page / full-site scan
- PDF export & shareable report links
- CI integration (GitHub Actions) to run scans on PRs

---

## Tech stack
- Frontend: React (Vite), plain CSS (no Tailwind required)
- Backend: Node.js + Express
- Browser automation: Playwright (Chromium) + `axe-core`
- Storage: Local filesystem for artifacts (MVP). S3 / R2 for production.
- Persistence: `storage/scans.json` (simple file) — replace with Mongo/Postgres later

---

## Repo layout
