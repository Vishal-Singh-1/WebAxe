import express from "express";
import { randomUUID } from "crypto";
import Scan from "../models/scan.js";
import { cleanupScan } from "../utils/cleanupScan.js";

console.log("🔥 POST /api/scans HIT");

const router = express.Router();

/* ---------------- HELPERS ---------------- */

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ---------------- CREATE SCAN ---------------- */
// POST /api/scans
router.post("/scans", async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: "Valid URL required" });
  }

  const scanId = randomUUID();

  await Scan.create({
    scanId,
    url,
    status: "queued",
    phase: "waiting",
    timings: {
      createdAt: new Date()
    }
  });
  console.log("✅ Scan inserted into MongoDB");


  res.json({
    message: "Scan queued successfully",
    scanId
  });
});

/* ---------------- GET ALL SCANS ---------------- */
// GET /api/scans
router.get("/scans", async (req, res) => {
  const scans = await Scan.find().sort({
    "timings.createdAt": -1
  });

  res.json({ scans });
});

/* ---------------- GET SCAN BY ID ---------------- */
// GET /api/scans/:id
router.get("/scans/:id", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  res.json({ scan });
});

/* ---------------- SCAN STATUS ---------------- */
// GET /api/scans/:id/status
router.get("/scans/:id/status", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  res.json({
    status: scan.status,
    phase: scan.phase || "waiting",
    startedAt: scan.timings?.startedAt || null
  });
});

/* ---------------- RERUN SCAN ---------------- */
// POST /api/scans/:id/rerun
router.post("/scans/:id/rerun", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  if (scan.status === "running") {
    return res.status(409).json({ error: "Scan already running" });
  }

  // delete old artifacts from disk
  await cleanupScan(scan.scanId);

  await Scan.findOneAndUpdate(
    { scanId: scan.scanId },
    {
      status: "queued",
      phase: "waiting",
      summary: null,
      artifacts: null,
      error: null,
      errorType: null,
      userMessage: null,
      "timings.startedAt": null,
      "timings.finishedAt": null,
      "timings.durationMs": null
    }
  );

  res.json({
    message: "Scan requeued successfully",
    scanId: scan.scanId,
    status: "queued"
  });
});

export default router;
