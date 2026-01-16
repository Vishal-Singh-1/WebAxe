import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";

dotenv.config();

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage paths
const STORAGE_DIR = path.join(__dirname, "storage");
const SCANS_FILE = path.join(STORAGE_DIR, "scans.json");

// Serve artifacts (screenshots, reports)
app.use("/storage", express.static(STORAGE_DIR));

/* ---------------- HELPERS ---------------- */

async function readScans() {
  try {
    const raw = await readFile(SCANS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeScans(data) {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(SCANS_FILE, JSON.stringify(data, null, 2));
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ---------------- ROUTES ---------------- */

// Create new scan
app.post("/api/scan", async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Valid URL required" });
  }

  const scans = await readScans();

  const newScan = {
    id: randomUUID(),
    url,
    status: "queued",
    createdAt: new Date().toISOString()
  };

  scans.push(newScan);
  await writeScans(scans);

  return res.json({
    message: "Scan queued successfully",
    scan: newScan
  });
});

// Get all scans
app.get("/api/scans", async (req, res) => {
  const scans = await readScans();
  res.json({ scans });
});

// Get single scan by ID
app.get("/api/scans/:id", async (req, res) => {
  const scans = await readScans();
  const scan = scans.find(s => s.id === req.params.id);

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  res.json({ scan });
});

/* ---------------- START SERVER ---------------- */

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
