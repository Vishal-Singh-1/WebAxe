# 🌐 WebAxe — Accessibility Audit Platform

**WebAxe** is a full-stack accessibility auditing platform that scans real websites using a headless browser, detects WCAG issues, and presents results through a clean, modern dashboard.

It combines **Playwright + axe-core**, **MongoDB scan tracking**, and a **React-based UI** to deliver a complete accessibility analysis workflow.

---

## 🚀 Features

* 🔍 Real browser scanning with Playwright (Chromium)
* ♿ Accessibility audits powered by axe-core
* 📊 Clean dashboard with scoring & severity breakdown
* 🧠 Rule-based remediation suggestions (no AI dependency required)
* 🗂 Scan history + trend comparison
* 🔐 JWT-based authentication
* ⚙️ Background worker architecture
* 📸 Full-page screenshots + raw reports
* 📄 PDF report export

---

## 🧱 Tech Stack

**Frontend**

* React (Vite)
* CSS

**Backend**

* Node.js
* Express

**Worker**

* Playwright
* axe-core

**Database**

* MongoDB (Mongoose)

**Auth**

* JWT

---

## 🏗 Architecture

```
Frontend (React)
      ↓
Backend API (Express)
      ↓
MongoDB (Scan metadata)
      ↓
Worker (Playwright + axe-core)
      ↓
Storage (Reports + screenshots)
```

---

## ⚙️ Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/your-username/webaxe.git
cd webaxe
```

---

### 2. Backend setup

```bash
cd backend
npm install
```

Create `.env` file:

```
PORT=3000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key

# Optional (for AI integration)
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-1.5-flash
```

Run backend:

```bash
npm run dev
```

---

### 3. Worker setup

```bash
cd worker
npm install
npm run start
```

---

### 4. Frontend setup

```bash
cd webaxe-frontend
npm install
npm run dev
```

---

## 🌍 Local URLs

* Frontend: http://localhost:5173
* Backend: http://localhost:3000
* Health Check: `GET /`

---

## 📡 API Overview

### Scan APIs

* `POST /api/scans` → Start scan
* `GET /api/scans/:id` → Get report
* `GET /api/scans/:id/status` → Get status
* `POST /api/scans/:id/rerun` → Re-run scan

### History APIs

* `GET /api/scans/history/recent`
* `GET /api/scans/history/by-url`
* `GET /api/scans/compare`

### Auth APIs

* `POST /api/auth/register`
* `POST /api/auth/login`

---

## 📊 Report Includes

* Accessibility score & grade
* Severity distribution
* Issue list
* Category-based scoring
* Rule-based suggestions
* Full-page screenshot
* Historical trends
* PDF export functionality

---

## 🤖 Gemini API (Optional)

WebAxe **does NOT require AI** to function.

However, you can optionally integrate **Google Gemini API (free tier available)** for:

* AI-powered fix suggestions
* Issue explanations
* Enhanced reporting

### Current Status

* Gemini is **optional**
* System uses **deterministic rule-based suggestions by default**

### If enabled:

* Uses Gemini free tier (with limits)
* Requires `GEMINI_API_KEY`

---

## 🔐 Security Notes

* Never commit `.env`
* Keep API keys private
* Use a strong `JWT_SECRET`

---

## 📈 Project Status

✅ Fully working full-stack application
✅ Real browser scanning
✅ Authentication system
✅ Scan history + analytics
✅ PDF export support
✅ Production-ready architecture (dev mode)

---

## 🔮 Future Improvements

* Scheduled scans
* Team workspaces
* Cloud storage (S3 / R2)
* AI-assisted explanations (Gemini integration)
* Advanced accessibility trend analytics

---

## 💡 Why WebAxe?

WebAxe focuses on making accessibility:

* Easier to understand
* Easier to track over time
* More actionable for developers

---

## 🧪 Example Flow

1. User submits URL
2. Scan is queued
3. Worker runs Playwright + axe-core
4. Results stored in MongoDB
5. Dashboard displays report + trends

---

## 🙌 Author

Built as a portfolio project to demonstrate:

* Full-stack architecture
* Background workers
* Accessibility tooling
* Scalable design patterns

---

