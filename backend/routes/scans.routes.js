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
import normalizeUrl from "../utils/normalizeUrl.js";
import { listScanProfiles, resolveScanProfile } from "../config/scanProfiles.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STORAGE_DIR = path.join(__dirname, "../storage");
/** Single on-disk recommendation report per scan (replaces older latest + versioned duplicate). */
const RECOMMENDATIONS_FILENAME = "recommendations.json";
/** Legacy filename from earlier versions; still read if present. */
const LEGACY_RECOMMENDATIONS_LATEST = "latest-recommendations.json";

function hasUsableOpenAiKey() {
  const key = (process.env.OPENAI_API_KEY || "").trim();
  if (!key) return false;
  return !["your_key_here", "your-api-key-here", "replace_me"].includes(key.toLowerCase());
}

function shouldRefreshCachedRecommendationReport(parsed) {
  const aiEnabledNow = hasUsableOpenAiKey();
  const aiWasEnabled = parsed?.meta?.aiEnabled === true;
  const aiWasUsed = parsed?.meta?.aiUsed === true;

  if (!aiEnabledNow) return false;
  return !aiWasEnabled || !aiWasUsed;
}

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
  try {
    const { url, sector } = req.body;

    if (!url || !isValidUrl(url)) {
      return res.status(400).json({ error: "Valid URL required" });
    }

    const scanId = randomUUID();
    const scanProfile = resolveScanProfile(sector);

    await Scan.create({
      scanId,
      url,
      urlNormalized: normalizeUrl(url),
      status: "queued",
      phase: "waiting",
      scanProfile,
      timings: {
        createdAt: new Date()
      }
    });

    res.json({
      message: "Scan queued successfully",
      scanId,
      scanProfile
    });
  } catch (error) {
    console.error("Failed to create scan:", error);
    res.status(500).json({
      error: "Unable to queue scan right now. Please try again."
    });
  }
});

router.get("/scan-profiles", async (req, res) => {
  res.json({
    profiles: listScanProfiles()
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

/* ---------------- HISTORY & ANALYTICS (must be before /scans/:id) ---------------- */

// GET /api/scans/history/recent — lightweight list for dashboard
router.get("/scans/history/recent", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const scans = await Scan.find({})
    .sort({ "timings.createdAt": -1 })
    .limit(limit)
    .lean();

  const rows = scans.map((s) => {
    const r = buildCombinedReport(s);
    return {
      scanId: r.scanId,
      url: r.url,
      urlNormalized: s.urlNormalized || normalizeUrl(s.url || ""),
      status: r.status,
      createdAt: s.timings?.createdAt,
      finishedAt: s.timings?.finishedAt,
      totalIssues: r.summary.totalIssues,
      healthScore: r.summary.healthScore,
      grade: r.summary.grade,
      severityDistribution: r.summary.severityDistribution,
      sector: r.rating?.profile?.key || s.scanProfile?.key || "general"
    };
  });

  res.json({ count: rows.length, scans: rows });
});

// GET /api/scans/history/by-url?url= — time series for one site (multiple scans)
router.get("/scans/history/by-url", async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return res.status(400).json({ error: "Query parameter url is required" });
  }
  if (!isValidUrl(rawUrl)) {
    return res.status(400).json({ error: "Invalid url" });
  }

  const n = normalizeUrl(rawUrl);
  const scans = await Scan.find({
    $or: [{ urlNormalized: n }, { url: rawUrl.trim() }, { url: n }]
  })
    .sort({ "timings.createdAt": 1 })
    .limit(200)
    .lean();

  const series = scans.map((s) => {
    const r = buildCombinedReport(s);
    return {
      scanId: r.scanId,
      url: r.url,
      status: r.status,
      createdAt: s.timings?.createdAt,
      finishedAt: s.timings?.finishedAt,
      totalIssues: r.summary.totalIssues,
      healthScore: r.summary.healthScore,
      grade: r.summary.grade,
      severityDistribution: r.summary.severityDistribution,
      sector: r.rating?.profile?.key || s.scanProfile?.key || "general"
    };
  });

  res.json({
    urlNormalized: n,
    urlRequested: rawUrl.trim(),
    count: series.length,
    series
  });
});

// GET /api/scans/compare?before=&after= — before vs after
router.get("/scans/compare", async (req, res) => {
  const beforeId = req.query.before;
  const afterId = req.query.after;
  if (!beforeId || !afterId || typeof beforeId !== "string" || typeof afterId !== "string") {
    return res.status(400).json({
      error: "Query parameters before and after (scan IDs) are required"
    });
  }
  if (beforeId === afterId) {
    return res.status(400).json({ error: "before and after must be different scan IDs" });
  }

  const [scanBefore, scanAfter] = await Promise.all([
    Scan.findOne({ scanId: beforeId }).lean(),
    Scan.findOne({ scanId: afterId }).lean()
  ]);

  if (!scanBefore || !scanAfter) {
    return res.status(404).json({ error: "One or both scans not found" });
  }

  const before = buildCombinedReport(scanBefore);
  const after = buildCombinedReport(scanAfter);

  const distB = before.summary.severityDistribution;
  const distA = after.summary.severityDistribution;

  const deltaTotal = after.summary.totalIssues - before.summary.totalIssues;
  const deltaHealth = after.summary.healthScore - before.summary.healthScore;

  let interpretation = "No change in total issue count.";
  if (deltaTotal < 0) interpretation = "Total issues decreased (improvement).";
  else if (deltaTotal > 0) interpretation = "Total issues increased.";

  res.json({
    before: {
      scanId: before.scanId,
      url: before.url,
      status: before.status,
      finishedAt: scanBefore.timings?.finishedAt,
      summary: before.summary
    },
    after: {
      scanId: after.scanId,
      url: after.url,
      status: after.status,
      finishedAt: scanAfter.timings?.finishedAt,
      summary: after.summary
    },
    delta: {
      totalIssues: deltaTotal,
      healthScore: deltaHealth,
      severityDistribution: {
        critical: distA.critical - distB.critical,
        serious: distA.serious - distB.serious,
        moderate: distA.moderate - distB.moderate,
        minor: distA.minor - distB.minor
      },
      interpretation
    }
  });
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
    aiConfigured: hasUsableOpenAiKey()
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
      audit: null,
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

    if (!shouldRefreshCachedRecommendationReport(parsed)) {
      return res.json({
        message: "Recommendation report already exists",
        reportId: parsed.reportId,
        reportPath: `/storage/${scan.scanId}/${RECOMMENDATIONS_FILENAME}`,
        aiUsed: parsed.meta?.aiUsed ?? false,
        cached: true
      });
    }
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
    aiEnabled: hasUsableOpenAiKey(),
    aiUsed: aiResult.aiUsed,
    aiReason: aiResult.reason,
    aiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
    aiIssueLimit: maxAiIssues
  };

  recommendationReport.recommendations = recommendationReport.recommendations.map((item, index) => {
    const aiData = aiResult.suggestionsByIssueId[item.issueId];
    const aiProcessed = index < maxAiIssues && !!aiData;
    const generatedBy = aiResult.aiUsed ? "ai" : "rule-based";

    return {
      ...item,
      whyItMatters: aiProcessed && aiData.whyItMatters ? aiData.whyItMatters : item.whyItMatters,
      suggestedFix: aiProcessed && aiData.suggestedFix ? aiData.suggestedFix : item.suggestedFix,
      problemCode: aiProcessed ? aiData.problemCode || "" : "",
      generatedBy
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
