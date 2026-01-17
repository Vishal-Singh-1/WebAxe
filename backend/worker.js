import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import axeSource from "axe-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const STORAGE_DIR = path.join(__dirname, "storage");
const SCANS_FILE = path.join(STORAGE_DIR, "scans.json");

/* ---------------- HELPERS ---------------- */

async function readScans() {
  try {
    const raw = await fs.readFile(SCANS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeScans(scans) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(SCANS_FILE, JSON.stringify(scans, null, 2));
}

/* ---------------- ERROR CLASSIFIER ---------------- */

function classifyError(message = "") {
  // ❌ INVALID URL / DNS
  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return {
      phase: "navigation",
      errorType: "INVALID_URL",
      userMessage: "The website URL is invalid or the domain does not exist."
    };
  }

  // ❌ SITE DOWN
  if (message.includes("ERR_CONNECTION_REFUSED")) {
    return {
      phase: "navigation",
      errorType: "SITE_DOWN",
      userMessage: "The website refused the connection."
    };
  }

  // ❌ TIMEOUT
  if (message.includes("ERR_TIMED_OUT") || message.includes("Timeout")) {
    return {
      phase: "navigation",
      errorType: "TIMEOUT",
      userMessage: "The website took too long to respond."
    };
  }

  // ❌ ACCESS DENIED
  if (message.includes("403") || message.includes("401")) {
    return {
      phase: "navigation",
      errorType: "ACCESS_DENIED",
      userMessage: "Access to the website was denied."
    };
  }

  // ❌ AXE BLOCKED BY CSP (IMPORTANT FIX)
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

  // ❓ UNKNOWN
  return {
    phase: "unknown",
    errorType: "UNKNOWN",
    userMessage: "The scan could not be completed."
  };
}

/* ---------------- SCAN PROCESS ---------------- */

async function processScan(scan, scans) {
  console.log(`🔍 Processing scan: ${scan.id}`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // ▶ RUNNING STATE
  scan.status = "running";
  scan.phase = "navigation";
  scan.startedAt = new Date().toISOString();
  await writeScans(scans);

  const startTime = Date.now();

  try {
    /* ---------- NAVIGATION ---------- */
    await page.goto(scan.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    /* ---------- AXE SCAN ---------- */
    scan.phase = "axe";
    await writeScans(scans);

    await page.addScriptTag({
      content: axeSource.source
    });

    const results = await page.evaluate(async () => {
      return await axe.run();
    });

    const scanDir = path.join(STORAGE_DIR, scan.id);
    await fs.mkdir(scanDir, { recursive: true });

    await fs.writeFile(
      path.join(scanDir, "report.json"),
      JSON.stringify(results, null, 2)
    );

    await page.screenshot({
      path: path.join(scanDir, "screenshot.png"),
      fullPage: true
    });

    scan.summary = {
      violations: results.violations.length,
      passes: results.passes.length,
      incomplete: results.incomplete.length
    };

    scan.artifacts = {
      report: `/storage/${scan.id}/report.json`,
      screenshot: `/storage/${scan.id}/screenshot.png`
    };

    scan.status = "complete";
    scan.phase = "done";
    scan.finishedAt = new Date().toISOString();
    scan.durationMs = Date.now() - startTime;

    console.log(`✅ Scan completed: ${scan.id}`);
  } catch (err) {
    const classified = classifyError(err.message);

    scan.status = "failed";
    scan.phase = classified.phase;
    scan.error = err.message;
    scan.errorType = classified.errorType;
    scan.userMessage = classified.userMessage;
    scan.finishedAt = new Date().toISOString();
    scan.durationMs = Date.now() - startTime;

    console.error(`❌ Scan failed (${scan.id}):`, err.message);
  } finally {
    await browser.close();
    await writeScans(scans); // ✅ FINAL SAVE
  }

  return scan;
}

/* ---------------- WORKER LOOP ---------------- */

async function workerLoop() {
  console.log("🧵 Worker started...");

  while (true) {
    try {
      const scans = await readScans();
      const queuedScan = scans.find(s => s.status === "queued");

      if (queuedScan) {
        await processScan(queuedScan, scans);
      }

      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

workerLoop();
