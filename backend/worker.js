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
  await fs.writeFile(SCANS_FILE, JSON.stringify(scans, null, 2));
}

/* ---------------- SCAN PROCESS ---------------- */

async function processScan(scan) {
  console.log(`🔍 Processing scan: ${scan.id}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  scan.status = "running";
  scan.startedAt = new Date().toISOString();

  const startTime = Date.now();

  try {
    await page.goto(scan.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

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
    scan.finishedAt = new Date().toISOString();
    scan.durationMs = Date.now() - startTime;

    console.log(`✅ Scan completed: ${scan.id}`);
  } catch (err) {
    scan.status = "failed";
    scan.error = err.message;
    console.error(`❌ Scan failed (${scan.id}):`, err.message);
  } finally {
    await browser.close();
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
        await processScan(queuedScan);
        await writeScans(scans);
      }

      await new Promise(r => setTimeout(r, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
    }  
  }
}

workerLoop();
