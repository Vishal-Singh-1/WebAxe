
import dotenv from "dotenv";
dotenv.config(); // ✅ REQUIRED for worker process

/* ---------------- IMPORTS ---------------- */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import axeSource from "axe-core";

import connectDB from "./config/db.js";
import Scan from "./models/scan.js";
import { startHeartbeat } from "./worker/heartbeat.js";

/* ---------------- INIT ---------------- */

startHeartbeat();
await connectDB();

/* ---------------- PATHS ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, "storage");

/* ---------------- ERROR CLASSIFIER ---------------- */

function classifyError(message = "") {
  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return {
      phase: "navigation",
      errorType: "INVALID_URL",
      userMessage: "The website URL is invalid or the domain does not exist."
    };
  }

  if (message.includes("ERR_CONNECTION_REFUSED")) {
    return {
      phase: "navigation",
      errorType: "SITE_DOWN",
      userMessage: "The website refused the connection."
    };
  }

  if (message.includes("ERR_TIMED_OUT") || message.includes("Timeout")) {
    return {
      phase: "navigation",
      errorType: "TIMEOUT",
      userMessage: "The website took too long to respond."
    };
  }

  if (message.includes("403") || message.includes("401")) {
    return {
      phase: "navigation",
      errorType: "ACCESS_DENIED",
      userMessage: "Access to the website was denied."
    };
  }

  if (
    message.includes("Content Security Policy") ||
    message.includes("page.addScriptTag")
  ) {
    return {
      phase: "axe",
      errorType: "AXE_BLOCKED_BY_CSP",
      userMessage:
        "The website blocks accessibility scanning due to strict Content Security Policy."
    };
  }

  return {
    phase: "unknown",
    errorType: "UNKNOWN",
    userMessage: "The scan could not be completed."
  };
}

/* ---------------- SCAN PROCESS ---------------- */

async function processScan(scan) {
  console.log(`🔍 Processing scan: ${scan.scanId}`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const startTime = Date.now();

  // ▶ mark as running
  await Scan.findOneAndUpdate(
    { scanId: scan.scanId },
    {
      status: "running",
      phase: "navigation",
      "timings.startedAt": new Date()
    }
  );

  try {
    /* ---------- NAVIGATION ---------- */
    await page.goto(scan.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    /* ---------- AXE SCAN ---------- */
    await Scan.findOneAndUpdate(
      { scanId: scan.scanId },
      { phase: "axe" }
    );

    await page.addScriptTag({ content: axeSource.source });

    const results = await page.evaluate(async () => {
      return await axe.run();
    });

    const scanDir = path.join(STORAGE_DIR, scan.scanId);
    await fs.mkdir(scanDir, { recursive: true });

    await fs.writeFile(
      path.join(scanDir, "report.json"),
      JSON.stringify(results, null, 2)
    );

    await page.screenshot({
      path: path.join(scanDir, "screenshot.png"),
      fullPage: true
    });

    await Scan.findOneAndUpdate(
      { scanId: scan.scanId },
      {
        status: "completed",
        phase: "done",
        artifacts: {
          reportPath: `/storage/${scan.scanId}/report.json`,
          screenshotPath: `/storage/${scan.scanId}/screenshot.png`
        },
        summary: {
          violations: results.violations.length,
          passes: results.passes.length,
          incomplete: results.incomplete.length
        },
        "timings.finishedAt": new Date(),
        "timings.durationMs": Date.now() - startTime
      }
    );

    console.log(`✅ Scan completed: ${scan.scanId}`);
  } catch (err) {
    const classified = classifyError(err.message);

    await Scan.findOneAndUpdate(
      { scanId: scan.scanId },
      {
        status: "failed",
        phase: classified.phase,
        errorType: classified.errorType,
        userMessage: classified.userMessage,
        error: err.message,
        "timings.finishedAt": new Date(),
        "timings.durationMs": Date.now() - startTime
      }
    );

    console.error(`❌ Scan failed (${scan.scanId}):`, err.message);
  } finally {
    await browser.close();
  }
}

/* ---------------- WORKER LOOP ---------------- */

async function workerLoop() {
  console.log("🧵 Worker started...");

  while (true) {
    try {
      const scan = await Scan.findOne({ status: "queued" }).sort({
        "timings.createdAt": 1
      });

      if (scan) {
        await processScan(scan);
      }

      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

workerLoop();
