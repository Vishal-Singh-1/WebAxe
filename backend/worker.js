// src/worker.js
// Real Playwright + axe-core accessibility worker

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import axeSource from "axe-core"; // loads axe-core script

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const STORAGE_DIR = path.join(__dirname, "../storage");
const SCANS_FILE = path.join(STORAGE_DIR, "scans.json");

// Helper: read scans.json
async function readScans() {
  const raw = await fs.readFile(SCANS_FILE, "utf8");
  return JSON.parse(raw || "{}");
}

// Helper: write scans.json
async function writeScans(data) {
  await fs.writeFile(SCANS_FILE, JSON.stringify(data, null, 2));
}

async function processScan(scanId, scan) {
  console.log(`🔍 Processing scan: ${scanId}`);

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Mark scan as running
  scan.status = "running";
  scan.startedAt = new Date().toISOString();

  const startTime = Date.now();

  try {
    // Navigate
    await page.goto(scan.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    // Inject axe-core script
    await page.addScriptTag({
      content: axeSource.source
    });

    // Run axe scan inside the browser
    const results = await page.evaluate(async () => {
      return await axe.run();
    });

    // Create folder for artifacts
    const scanDir = path.join(STORAGE_DIR, scanId);
    await fs.mkdir(scanDir, { recursive: true });

    // Write JSON report
    const reportPath = path.join(scanDir, "report.json");
    await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

    // Screenshot
    const screenshotPath = path.join(scanDir, "screenshot.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Build summary
    const summary = {
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length
    };

    // Update DB record
    scan.status = "complete";
    scan.finishedAt = new Date().toISOString();
    scan.durationMs = Date.now() - startTime;
    scan.summary = summary;

    scan.artifacts = {
      json: `/storage/${scanId}/report.json`,
      screenshot: `/storage/${scanId}/screenshot.png`
    };

    console.log(`✅ Scan complete: ${scanId}`);
  } catch (err) {
    console.error(`❌ Worker error for ${scanId}:`, err);
    scan.status = "failed";
    scan.error = err.message;
  } finally {
    await browser.close();
  }

  return scan;
}

async function workerLoop() {
  console.log("🔁 Worker started. Scanning for queued jobs...");

  while (true) {
    try {
      let scans = await readScans();

      // Find queued job
      const entries = Object.entries(scans);
      const queued = entries.find(([id, scan]) => scan.status === "queued");

      if (queued) {
        const [scanId, scan] = queued;

        // Process scan
        const updatedScan = await processScan(scanId, scan);

        // Save updated DB
        scans[scanId] = updatedScan;
        await writeScans(scans);
      }

      // Worker checks every 3 seconds
      await new Promise((r) => setTimeout(r, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

workerLoop();
