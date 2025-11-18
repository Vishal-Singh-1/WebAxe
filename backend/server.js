// src/server.js
// Minimal Express server for WebAxe MVP
// POST /api/scan -> queue a scan (saved to storage/scans.json)
// GET  /api/scan/:id -> return scan status + metadata
// Serves files under /storage/*

import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { randomUUID } from "crypto";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const STORAGE_DIR = process.env.STORAGE_PATH || path.join(__dirname, "../storage");
const SCANS_FILE = path.join(STORAGE_DIR, "scans.json");

const app = express();
app.use(cors());
app.use(express.json());

// Ensure storage folder and scans.json exist
async function ensureStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    // create scans.json if missing
    try {
      await fs.access(SCANS_FILE);
    } catch {
      await fs.writeFile(SCANS_FILE, JSON.stringify({}), "utf8");
    }
  } catch (err) {
    console.error("Error ensuring storage:", err);
    process.exit(1);
  }
}

// Simple helper to read/write scans.json (no heavy concurrency handling)
// For MVP it's fine. Improve with DB / locks later.
async function readScans() {
  const raw = await fs.readFile(SCANS_FILE, "utf8");
  return JSON.parse(raw || "{}");
}
async function writeScans(obj) {
  await fs.writeFile(SCANS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

// Basic URL validation helper
function normalizeUrl(input) {
  if (!input || typeof input !== "string") return null;
  let url = input.trim();
  // add protocol if missing
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const u = new URL(url);
    // optionally block localhost/internal IPs here if desired
    return u.toString();
  } catch {
    return null;
  }
}

// POST /api/scan
// body: { url: "https://example.com" }
app.post("/api/scan", async (req, res) => {
  try {
    const { url } = req.body || {};
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid or missing URL" });
    }

    const scans = await readScans();

    const id = "scan_" + randomUUID();
    const now = new Date().toISOString();
    const scanRecord = {
      id,
      url: normalized,
      status: "queued", // queued | running | complete | failed
      createdAt: now,
      queuedAt: now,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      summary: null, // to be filled by worker
      artifacts: {}, // { json: "/storage/scan_x/report.json", screenshot: "/storage/scan_x/screenshot.png" }
      error: null,
    };

    scans[id] = scanRecord;
    await writeScans(scans);

    // ensure directory for artifacts exists (worker will fill)
    const artifactDir = path.join(STORAGE_DIR, id);
    await fs.mkdir(artifactDir, { recursive: true });

    return res.status(201).json({ id, status: scanRecord.status });
  } catch (err) {
    console.error("POST /api/scan error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/scan/:id
app.get("/api/scan/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const scans = await readScans();
    const scan = scans[id];
    if (!scan) return res.status(404).json({ error: "Scan not found" });
    return res.json(scan);
  } catch (err) {
    console.error("GET /api/scan/:id error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Serve artifact files under /storage
// Example: GET /storage/scan_x/report.json
app.use("/storage", express.static(STORAGE_DIR, {
  index: false,
  extensions: ["json", "png", "jpg", "pdf"],
}));

// Health
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

async function start() {
  await ensureStorage();
  app.listen(PORT, () => {
    console.log(`WebAxe API listening on http://localhost:${PORT}`);
    console.log(`Storage directory: ${STORAGE_DIR}`);
  });
}

start();
