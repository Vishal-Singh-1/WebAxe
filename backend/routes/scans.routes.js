import express from "express";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import Scan from "../models/scan.js";
import { cleanupScan } from "../utils/cleanupScan.js";
import buildCombinedReport from "../utils/buildCombinedReport.js";
import buildRecommendationReport from "../utils/buildRecommendationReport.js";
import { generateAiSuggestions } from "../utils/generateAiSuggestions.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, "../storage");
/** Single on-disk recommendation report per scan (replaces older latest + versioned duplicate). */
const RECOMMENDATIONS_FILENAME = "recommendations.json";
/** Legacy filename from earlier versions; still read if present. */
const LEGACY_RECOMMENDATIONS_LATEST = "latest-recommendations.json";

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

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

  res.json({ scans });   // ✅ fixed variable name
});

/* ---------------- GET SCAN BY ID ---------------- */
// GET /api/scans/:id
router.get("/scans/:id", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const formattedReport = buildCombinedReport(scan);

  res.json({
    ...formattedReport,
    aiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
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

  await cleanupScan(scan.scanId);

  await Scan.findOneAndUpdate(
    { scanId: scan.scanId },
    {
      status: "queued",
      phase: "waiting",
      summary: {
        critical: 0,
        warning: 0,
        info: 0,
        total: 0
      },
      issues: {},
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

/* ---------------- GENERATE RAW RECOMMENDATION REPORT ---------------- */
// POST /api/scans/:id/recommendations/raw
router.post("/scans/:id/recommendations/raw", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const hasIssues = Object.values(scan.issues || {}).some(
    (group) => Array.isArray(group) && group.length > 0
  );

  if (!hasIssues) {
    return res.status(409).json({
      error: "No issues available yet. Run or complete the scan first."
    });
  }

  const scanDir = path.join(STORAGE_DIR, scan.scanId);
  const existingPrimary = path.join(scanDir, RECOMMENDATIONS_FILENAME);
  const existingLegacy = path.join(scanDir, LEGACY_RECOMMENDATIONS_LATEST);
  const existingPath = (await fileExists(existingPrimary))
    ? existingPrimary
    : (await fileExists(existingLegacy))
      ? existingLegacy
      : null;

  if (existingPath) {
    const raw = await fs.readFile(existingPath, "utf-8");
    const parsed = JSON.parse(raw);
    return res.json({
      message: "Recommendation report already exists",
      reportId: parsed.reportId,
      reportPath: `/storage/${scan.scanId}/${RECOMMENDATIONS_FILENAME}`,
      aiUsed: parsed.meta?.aiUsed ?? false,
      cached: true
    });
  }

  const reportId = randomUUID();
  const recommendationReport = buildRecommendationReport({ scan, reportId });
  const maxAiIssues = Number(process.env.AI_MAX_ISSUES || 5);
  const aiInput = recommendationReport.recommendations.slice(0, maxAiIssues);

  const aiResult = await generateAiSuggestions({
    scan,
    recommendations: aiInput
  });

  recommendationReport.meta = {
    aiEnabled: Boolean(process.env.OPENAI_API_KEY),
    aiUsed: aiResult.aiUsed,
    aiReason: aiResult.reason,
    aiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    aiIssueLimit: maxAiIssues
  };

  recommendationReport.recommendations = recommendationReport.recommendations.map((item, index) => {
    const aiData = aiResult.suggestionsByIssueId[item.issueId];
    const aiProcessed = index < maxAiIssues && !!aiData;

    return {
      ...item,
      whyItMatters: aiProcessed && aiData.whyItMatters ? aiData.whyItMatters : item.whyItMatters,
      suggestedFix: aiProcessed && aiData.suggestedFix ? aiData.suggestedFix : item.suggestedFix,
      problemCode: aiProcessed ? aiData.problemCode || "" : "",
      generatedBy: aiProcessed ? "ai" : "rule-based"
    };
  });

  await fs.mkdir(scanDir, { recursive: true });

  const filePath = path.join(scanDir, RECOMMENDATIONS_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(recommendationReport, null, 2));

  const reportPath = `/storage/${scan.scanId}/${RECOMMENDATIONS_FILENAME}`;

  res.json({
    message: "Recommendation report generated",
    reportId,
    reportPath,
    aiUsed: recommendationReport.meta.aiUsed
  });
});

/* ---------------- GET LATEST RAW RECOMMENDATION REPORT ---------------- */
// GET /api/scans/:id/recommendations/raw/latest
router.get("/scans/:id/recommendations/raw/latest", async (req, res) => {
  const scan = await Scan.findOne({ scanId: req.params.id });

  if (!scan) {
    return res.status(404).json({ error: "Scan not found" });
  }

  const primaryPath = path.join(STORAGE_DIR, scan.scanId, RECOMMENDATIONS_FILENAME);
  const legacyPath = path.join(STORAGE_DIR, scan.scanId, LEGACY_RECOMMENDATIONS_LATEST);
  const pathToRead = (await fileExists(primaryPath))
    ? primaryPath
    : (await fileExists(legacyPath))
      ? legacyPath
      : null;

  if (!pathToRead) {
    return res.status(404).json({
      error: "Latest recommendation report not found",
      hint: "Generate one via POST /api/scans/:id/recommendations/raw"
    });
  }

  const raw = await fs.readFile(pathToRead, "utf-8");
  const parsed = JSON.parse(raw);
  res.json(parsed);
});

export default router;