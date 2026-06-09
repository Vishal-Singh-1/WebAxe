# WebAxe Project Documentation

## 1. Project Overview

**WebAxe** is a web accessibility scanning platform built to help teams identify accessibility issues, understand compliance risk, and track scan results over time. The product combines:

- A React frontend for authentication, scan submission, scan history, and report viewing
- An Express backend API for user management, scan management, history, and report retrieval
- A background Playwright worker that visits websites, runs `axe-core`, collects page signals, performs custom audits, and stores artifacts
- MongoDB for persistent storage of users and scans

The overall goal of the project is to move beyond a raw accessibility checker and provide a more readable, compliance-oriented workflow around:

- WCAG awareness
- EAA-oriented messaging
- scan history and comparison
- sector-based scoring
- remediation suggestions
- exportable reports

## 2. Core Value Proposition

WebAxe is positioned as an accessibility compliance platform rather than only a technical scanner. It focuses on three layers of value:

1. **Detection**  
   It identifies accessibility violations using `axe-core` and groups them by severity.

2. **Interpretation**  
   It converts raw scan output into summaries, grades, health scores, category scores, trust indicators, and fix suggestions.

3. **Tracking**  
   It stores scans over time so users can review history, compare runs, and monitor progress for a specific URL.

## 3. Technology Stack

### Frontend

- React `19`
- React Router `7`
- Vite `7`
- Vanilla CSS modules/files per component

### Backend

- Node.js with ES modules
- Express `4`
- Mongoose `9`
- CORS
- dotenv

### Scanning and Analysis

- Playwright
- `axe-core`
- custom audit rules implemented in backend utilities

### Database

- MongoDB

## 4. High-Level Architecture

The application is split into three runtime parts:

### 4.1 Frontend App

Location: `webaxe-frontend/`

Responsibilities:

- show the marketing site and informational pages
- handle login and registration
- allow an authenticated user to queue a scan
- poll scan status until the report is ready
- display detailed scan results
- show history analytics and comparison views
- provide account and logout actions

### 4.2 Backend API

Location: `backend/`

Responsibilities:

- connect to MongoDB
- authenticate users with JWT
- expose scan APIs
- expose history and comparison APIs
- expose recommendation report APIs
- serve generated scan artifacts from `/storage`
- expose worker heartbeat health endpoint

### 4.3 Background Worker

Location: `backend/worker.js`

Responsibilities:

- continuously watch for queued scans
- open target URLs in a Playwright browser
- inject and run `axe-core`
- collect browser/page signals
- run custom security/privacy/performance/content audits
- store raw JSON reports and screenshots
- update scan documents with final results or failure states

## 5. Repository Structure

```text
WebAxe/
  backend/
    config/
    middleware/
    models/
    routes/
    utils/
    worker/
    server.js
    worker.js
  webaxe-frontend/
    src/
      components/
    package.json
  scans.json
```

### Important Backend Files

- `backend/server.js`  
  Express server entry point

- `backend/worker.js`  
  background scanning loop

- `backend/routes/auth.routes.js`  
  registration, login, current user

- `backend/routes/scans.routes.js`  
  scan creation, report retrieval, history, comparison, recommendations

- `backend/routes/worker.routes.js`  
  worker health endpoint

- `backend/models/scan.js`  
  MongoDB schema for stored scans

- `backend/models/user.js`  
  MongoDB schema for users

- `backend/utils/processAxeResults.js`  
  transforms raw `axe-core` violations into internal issue groups

- `backend/utils/customAudit.js`  
  computes category scores, rule results, trust indicators, and overall rating

- `backend/utils/buildCombinedReport.js`  
  transforms stored scan data into the frontend-facing report format

### Important Frontend Files

- `webaxe-frontend/src/App.jsx`  
  app shell, routes, auth state, and marketing pages

- `webaxe-frontend/src/components/Hero.jsx`  
  scan submission form and polling flow

- `webaxe-frontend/src/components/AuthPage.jsx`  
  login and registration page

- `webaxe-frontend/src/components/ScanResults.jsx`  
  detailed report page with issues, charts, suggestions, screenshot, and PDF export

- `webaxe-frontend/src/components/ScanHistory.jsx`  
  recent scans, per-URL trends, and before/after comparison

- `webaxe-frontend/src/components/AccountPage.jsx`  
  logged-in user profile display and logout

## 6. Main Functional Features

### 6.1 User Authentication

The platform supports:

- user registration
- login with username or email
- JWT-based session management
- protected routes for authenticated pages

Frontend auth is stored in browser `localStorage` under `webaxe_auth`.

Backend auth is implemented with:

- custom JWT signing and verification
- Bearer token middleware
- user lookup from MongoDB on each protected request

### 6.2 Accessibility Scan Submission

An authenticated user can:

- enter a website URL
- choose a scan sector/profile
- submit a scan request

The frontend then:

- creates the scan via `POST /api/scans`
- stores the last scanned URL locally
- polls `/api/scans/:id/status`
- redirects to the final report when the scan is completed

### 6.3 Background Website Scanning

The worker performs the real scan logic. For each queued scan it:
6
1. launches Chromium through Playwright
2. opens the target page
3. injects `axe-core`
4. runs automated accessibility checks
5. collects page-level signals such as:
   - mixed content
   - tracking scripts
   - forms with password fields
   - privacy policy and cookie banner hints
   - third-party integrations
   - admin-like links
   - image counts and image optimization signals
   - performance timing and transfer size data
   - title, meta description, viewport, favicon
   - navigation landmarks
   - contact information signals
6. runs custom audit rules across five categories:
   - security
   - privacy
   - accessibility
   - performance
   - content
7. saves:
   - raw `axe-core` report JSON
   - full-page screenshot
   - processed audit data
8. marks the scan completed or failed

### 6.4 Sector-Based Scan Profiles

WebAxe supports multiple sector profiles:

- `general`
- `kids`
- `healthcare`
- `government`
- `ecommerce`

Each profile changes the relative weighting of the five scoring categories. For example:

- healthcare emphasizes security and privacy
- government emphasizes accessibility
- kids emphasizes privacy and accessibility
- ecommerce emphasizes security, privacy, and performance

This means two scans with the same low-level findings can produce different overall scores depending on the selected sector.

### 6.5 Scan Report View

The detailed report page includes:

- scan overview
- status and phase
- health score
- letter grade
- total issue count
- scan duration
- severity distribution
- category breakdown
- trust indicators
- prioritized custom rules
- issue list
- fix suggestions
- screenshot link
- recent trend chart for the same URL
- PDF export

### 6.6 Scan History and Comparison

Users can review:

- a recent scans table
- issue and health trends for a given URL
- before/after scan comparison

The comparison endpoint returns deltas in:

- total issues
- health score
- severity distribution

This makes it easier to track whether accessibility is improving over time.

### 6.7 Recommendation Reports

The backend supports generation of recommendation reports per scan. These are saved in storage and loaded by the report UI.

The current implementation:

- always supports rule-based suggestions
- includes a placeholder path for AI-based suggestions
- currently reports no usable AI key because `hasUsableAiKey()` returns `false`

As the code stands today, recommendation generation is effectively rule-based even though the system is structured for future AI enhancement.

## 7. Scan Lifecycle

The end-to-end scan flow works like this:

1. User logs in or registers
2. User submits a URL and sector from the homepage
3. Backend creates a MongoDB scan document with:
   - `status: queued`
   - `phase: waiting`
   - normalized URL
   - selected scan profile
4. Worker loop picks the oldest queued scan
5. Worker updates the scan to:
   - `status: running`
   - `phase: navigation`
6. Worker loads the page and runs `axe-core`
7. Worker collects browser and page signals
8. Worker runs custom category audits
9. Worker stores artifacts in `backend/storage/<scanId>/`
10. Worker updates the scan to:
   - `status: completed`
   - `phase: done`
11. Frontend polling detects completion and redirects to the report page

If any failure occurs, the worker saves:

- `status: failed`
- a classified `errorType`
- a user-friendly `userMessage`

## 8. Data Model

### 8.1 User Model

Fields:

- `name`
- `username`
- `email`
- `passwordHash`
- `createdAt`

### 8.2 Scan Model

Key fields:

- `scanId`
- `url`
- `urlNormalized`
- `status`
- `phase`
- `scanProfile`
- `error`
- `errorType`
- `userMessage`
- `summary`
- `issues`
- `audit`
- `artifacts`
- `timings`

### Stored Summary

- `critical`
- `warning`
- `info`
- `total`

### Stored Artifacts

- raw report path
- screenshot path

### Stored Timings

- `createdAt`
- `startedAt`
- `finishedAt`
- `durationMs`

## 9. Scoring Model

WebAxe uses a layered scoring system.

### 9.1 Severity-Based Distribution

Flattened issues are counted across:

- critical
- serious
- moderate
- minor

### 9.2 Health Score

If no custom audit score is present, the fallback score starts at `100` and subtracts weighted penalties based on issue severity.

If a custom audit score exists, that score becomes the final health score.

### 9.3 Letter Grade

Grades are assigned as:

- `A` for 90+
- `B` for 75+
- `C` for 60+
- `D` for 40+
- `F` below 40

### 9.4 Category Scores

The custom audit calculates category scores for:

- security
- privacy
- accessibility
- performance
- content

Each category score is then weighted by the chosen sector profile to compute the final overall score.

## 10. Custom Audit Categories

The audit layer expands the project beyond accessibility-only checks.

### Security

Examples:

- HTTPS enabled
- SSL visibility
- mixed content
- CSP header
- HSTS header
- X-Frame-Options
- Secure cookies
- HttpOnly cookies
- exposed admin routes

### Privacy

Examples:

- privacy policy presence
- cookie banner presence
- tracking script detection
- secure password form handling
- GET form sensitivity
- third-party integration inventory

### Accessibility

Examples:

- alt text
- heading structure
- color contrast
- button labels
- keyboard-related heuristics

### Performance

Examples:

- page load timing
- image optimization
- asset weight
- lazy loading
- request failures / broken resources

### Content

Examples:

- viewport meta signal
- title and meta description
- favicon
- navigation landmarks
- console error count

## 11. API Overview

All protected routes require `Authorization: Bearer <token>`.

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Scan Management

- `POST /api/scans`
- `GET /api/scans`
- `GET /api/scans/:id`
- `GET /api/scans/:id/status`
- `POST /api/scans/:id/rerun`
- `GET /api/scan-profiles`

### History and Analytics

- `GET /api/scans/history/recent`
- `GET /api/scans/history/by-url?url=...`
- `GET /api/scans/compare?before=...&after=...`

### Recommendation Reports

- `POST /api/scans/:id/recommendations/raw`
- `GET /api/scans/:id/recommendations/raw/latest`

### Worker Health

- `GET /api/worker/health`

## 12. Frontend Pages

### Home Page

Purpose:

- marketing landing page
- scan submission form
- WCAG/EAA/compliance positioning

### Auth Page

Purpose:

- login
- registration
- onboarding into the product

### Scan Results Page

Purpose:

- display the full scan report
- show issues and insights
- generate exportable output

### Scan History Page

Purpose:

- browse recent scans
- inspect trend charts
- compare two scans

### Account Page

Purpose:

- display current user details
- allow logout

### Informational Pages

The frontend also contains marketing pages for:

- WCAG
- EAA
- Pricing
- About

## 13. Storage and Generated Files

Generated artifacts are stored in:

`backend/storage/<scanId>/`

Typical contents:

- `raw-report.json`
- `screenshot.png`
- `recommendations.json`

The backend serves this directory statically under `/storage`.

## 14. Environment Variables

The backend explicitly depends on:

- `MONGO_URI`
- `JWT_SECRET`

Optional or implied variables:

- `PORT`
- `AI_MAX_ISSUES`

The frontend supports:

- `VITE_API_URL`

## 15. Run and Deployment Model

To run the project correctly, three pieces matter:

1. MongoDB must be available
2. The backend API must be running
3. The background worker must also be running

This is important because scan creation happens in the API, but scan execution happens in the separate worker process.

### Typical Development Commands

Backend:

```bash
cd backend
npm install
npm start
```

Worker:

```bash
cd backend
node worker.js
```

Frontend:

```bash
cd webaxe-frontend
npm install
npm run dev
```

## 16. Security and Authentication Notes

- Passwords are hashed with Node `crypto.scrypt`
- JWT creation and verification are custom-built instead of using a third-party JWT package
- Protected API routes require a valid Bearer token
- User sessions are persisted in browser local storage

## 17. Error Handling and Failure Modes

The worker classifies several common failures into user-facing categories:

- `INVALID_URL`
- `SITE_DOWN`
- `TIMEOUT`
- `ACCESS_DENIED`
- `AXE_BLOCKED_BY_CSP`
- `UNKNOWN`

These are surfaced in the scan report UI with readable explanations so the user knows why a scan did not complete.

## 18. Current Strengths

- clear split between UI, API, and worker responsibilities
- good end-to-end scan lifecycle
- history and comparison features already implemented
- structured scoring beyond raw accessibility results
- sector-based weighting gives the product a differentiated angle
- screenshot and PDF export improve reporting usefulness
- authentication and protected routes are already in place

## 19. Current Limitations and Implementation Notes

These points reflect the repository in its current form:

- AI recommendation support is scaffolded but effectively disabled because the backend reports no usable AI key
- the backend `GET /api/scans` route returns all scans without filtering by current user, so scan ownership is not enforced at the data level
- the scan schema also does not currently store a user reference
- running the API alone is not enough; the worker must also run or scans will remain queued
- the frontend README is still the default Vite template and does not yet describe the actual product
- some source files contain minor encoding artifacts in strings/comments, which do not change the main behavior but should be cleaned up later

## 20. Suggested Documentation Use Cases

This document can be used as the base for:

- project report documentation
- GitHub repository overview
- internship or academic submission
- internal technical handoff
- product requirement and architecture notes

## 21. Summary

WebAxe is a compliance-oriented accessibility scanning platform that combines automated browser scanning, accessibility rule detection, sector-aware scoring, remediation guidance, historical analytics, and exportable reporting. Architecturally, it is a React frontend paired with an Express/Mongo backend and a dedicated Playwright worker. The project already supports a meaningful end-to-end workflow and provides a strong base for future improvements such as user-owned scans, richer AI recommendations, scheduling, and broader compliance automation.
