# WebAxe

WebAxe is a web accessibility scanning platform. It scans public web pages with Playwright and axe-core, saves reports and scan history in MongoDB, and presents findings in a React interface with optional AI-generated remediation suggestions.

## Features

- Accessibility scans with severity and issue summaries
- Playwright and axe-core browser-based analysis
- Background worker queue with persisted scan status and restart recovery
- Scan history, reruns, and report comparison
- One-time and recurring scan scheduling
- Detailed reports, captured screenshots, and downloadable artifacts
- Optional Gemini-powered, issue-specific remediation suggestions
- User registration and authentication

## Tech stack

- **Frontend:** React 19, React Router, Vite
- **Backend:** Node.js, Express, Mongoose
- **Scanning:** Playwright, Chromium, axe-core
- **Database:** MongoDB
- **AI suggestions:** Google Gemini API (optional)

## Repository layout

```text
WebAxe/
├── backend/              # Express API, MongoDB models, and scan worker
├── webaxe-frontend/      # React application
├── PROJECT_DOCUMENTATION.md
└── README.md
```

## Run locally

### Prerequisites

- Node.js (use a current LTS release)
- npm
- MongoDB running locally, or a MongoDB Atlas database
- Chromium dependencies for Playwright (installed by the setup command below)

### 1. Configure the backend

In PowerShell, from the project root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Edit `backend/.env` and set the values for your environment:

```dotenv
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/webaxe
JWT_SECRET=replace_with_a_long_random_secret
CORS_ORIGINS=http://localhost:5173
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
AI_MAX_ISSUES=5
```

For MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string. URL-encode special characters in the database password (for example, `@` becomes `%40`). Ensure the database user has access to the chosen database and the connecting IP is allowed by Atlas Network Access. Do not commit or share `.env` files or connection strings.

`GEMINI_API_KEY` is optional. Without a usable key, the app can provide its non-AI remediation guidance.

### 2. Install and start the backend

```powershell
cd backend
npm install
npx playwright install chromium
npm start
```

`npm start` runs `start.js`, which supervises and starts both the API server and the background scan worker. Leave this terminal open while using the app. The API listens on `http://localhost:3000` by default.

Other backend scripts, if you need to run one process by itself:

```powershell
npm run start:api
npm run start:worker
```

Run those in separate terminals; the worker also needs the same MongoDB configuration.

### 3. Install and start the frontend

Open a second terminal at the project root:

```powershell
cd webaxe-frontend
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The frontend uses `http://localhost:3000` as its API by default. For a different API address, create `webaxe-frontend/.env` with:

```dotenv
VITE_API_URL=http://localhost:3000
```

Restart the Vite development server after changing frontend environment variables.

## Deploy frontend and connect it to Render

The frontend is configured for Vercel in `webaxe-frontend/vercel.json`, including a rewrite so React Router pages work when opened or refreshed directly.

1. Push the project to GitHub and import the repository in Vercel.
2. Set Vercel's **Root Directory** to `webaxe-frontend` and use the Vite defaults: build command `npm run build`, output directory `dist`.
3. In Vercel's project environment variables, set `VITE_API_URL` to the Render backend's public base URL, for example `https://your-service.onrender.com` (no `/api` suffix).
4. In Render's backend environment variables, set `CORS_ORIGINS` to the exact deployed frontend origin, for example `https://your-app.vercel.app` (no trailing slash). Add more comma-separated origins if you also use a custom domain or Vercel preview domain.
5. Redeploy both services after changing environment variables.

For local Vite development, the backend continues to allow `http://localhost:5173` and `http://127.0.0.1:5173` by default. The browser frontend uses bearer-token authentication, so CORS does not need cookie credentials.

## Production build

Build the frontend with:

```powershell
cd webaxe-frontend
npm run build
```

Set `VITE_API_URL` to the deployed API URL when building the frontend for production. Deploy the API and worker in an environment that supports long-running Node.js processes and Playwright Chromium. Configure `MONGO_URI`, `JWT_SECRET`, and optionally `GEMINI_API_KEY` as deployment environment variables; do not put secrets in frontend variables. The repository includes a `render.yaml` starting point, but production deployment still requires configured environment secrets, an accessible MongoDB instance, and a host suitable for the worker/browser workload.

## API overview

Authenticated endpoints use a bearer token returned by the auth API.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the current account |
| `POST` | `/api/scans` | Queue a scan |
| `GET` | `/api/scans/:id/status` | Check scan progress |
| `GET` | `/api/scans/:id` | Retrieve a scan report |
| `POST` | `/api/scans/:id/rerun` | Queue a rerun |
| `GET` | `/api/scans` | List scan history |
| `GET`, `POST` | `/api/schedules` | List or create scheduled scans |
| `PATCH`, `DELETE` | `/api/schedules/:scheduleId` | Update or remove a schedule |

The API root (`GET /`) returns a small server status response. Scan reports and related artifacts are served under `/storage`.

## Security and data notes

- Keep backend `.env` files and all API/database credentials out of GitHub.
- Use a strong, unique `JWT_SECRET` in production.
- Limit Atlas network access to the deployment server’s IP range where possible.
- Only submit websites you are authorized to scan; scanning may send automated browser requests to the target site.
- Scan records and generated artifacts are stored in MongoDB and the backend `storage/` directory, respectively.

## License

No license is currently specified. Add a `LICENSE` file before allowing others to reuse or distribute this project.
