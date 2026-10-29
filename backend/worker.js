import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { chromium } from "playwright";
import axeSource from "axe-core";

import connectDB from "./config/db.js";
import { loadBackendEnv } from "./config/loadEnv.js";
import { resolveScanProfile } from "./config/scanProfiles.js";
import Scan from "./models/scan.js";
import { processAxeResults } from "./utils/processAxeResults.js";
import { runCustomAudit } from "./utils/customAudit.js";
import { startHeartbeat } from "./worker/heartbeat.js";
import {
  claimNextJob,
  enqueueDueSchedule,
  LEASE_DURATION_MS,
  recoverExpiredJobs
} from "./worker/jobQueue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadBackendEnv();

await connectDB();
const workerId = `${process.pid}-${randomUUID()}`;
await recoverExpiredJobs();
let currentScanId = null;
const stopHeartbeat = await startHeartbeat(5000, workerId, () => currentScanId);

const STORAGE_DIR = path.join(__dirname, "storage");

function classifyError(message = "") {
  if (message.includes("ERR_NAME_NOT_RESOLVED")) {
    return {
      phase: "navigation",
      errorType: "INVALID_URL",
      userMessage: "The website URL is invalid or the domain does not exist.",
      retryable: false
    };
  }

  if (message.includes("ERR_CONNECTION_REFUSED")) {
    return {
      phase: "navigation",
      errorType: "SITE_DOWN",
      userMessage: "The website refused the connection.",
      retryable: true
    };
  }

  if (message.includes("ERR_TIMED_OUT") || message.includes("Timeout")) {
    return {
      phase: "navigation",
      errorType: "TIMEOUT",
      userMessage: "The website took too long to respond.",
      retryable: true
    };
  }

  if (message.includes("403") || message.includes("401")) {
    return {
      phase: "navigation",
      errorType: "ACCESS_DENIED",
      userMessage: "Access to the website was denied.",
      retryable: false
    };
  }

  if (message.includes("Content Security Policy") || message.includes("page.addScriptTag")) {
    return {
      phase: "axe",
      errorType: "AXE_BLOCKED_BY_CSP",
      userMessage: "The website blocks accessibility scanning due to strict Content Security Policy.",
      retryable: false
    };
  }

  return {
    phase: "unknown",
    errorType: "UNKNOWN",
    userMessage: "The scan could not be completed.",
    retryable: true
  };
}

async function collectPageSignals(page) {
  return await page.evaluate(() => {
    const absUrl = (value) => {
      try {
        return new URL(value, window.location.href).href;
      } catch {
        return null;
      }
    };

    const srcValues = [
      ...Array.from(document.querySelectorAll("[src]")).map((el) => el.getAttribute("src")),
      ...Array.from(document.querySelectorAll("link[href]")).map((el) => el.getAttribute("href"))
    ]
      .map((value) => absUrl(value))
      .filter(Boolean);

    const scripts = Array.from(document.scripts || []).map((script) => ({
      src: absUrl(script.src) || "",
      inline: !script.src,
      text: script.textContent?.slice(0, 200) || ""
    }));

    const trackingScripts = [];
    scripts.forEach((script) => {
      const haystack = `${script.src} ${script.text}`.toLowerCase();
      if (
        haystack.includes("googletagmanager") ||
        haystack.includes("google-analytics") ||
        haystack.includes("gtag(")
      ) {
        trackingScripts.push("Google Analytics");
      }
      if (haystack.includes("facebook.net") || haystack.includes("fbq(")) {
        trackingScripts.push("Facebook Pixel");
      }
      if (haystack.includes("hotjar")) {
        trackingScripts.push("Hotjar");
      }
    });

    const forms = Array.from(document.forms || []).map((form) => ({
      action: absUrl(form.getAttribute("action") || window.location.href),
      method: (form.getAttribute("method") || "get").toLowerCase(),
      hasPassword: !!form.querySelector('input[type="password"]')
    }));

    const anchors = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => ({
        href: absUrl(anchor.getAttribute("href")),
        text: (anchor.textContent || "").trim().toLowerCase()
      }))
      .filter((anchor) => anchor.href);

    const externalHosts = new Set();
    Array.from(document.querySelectorAll("script[src], img[src], iframe[src], link[href]")).forEach((node) => {
      const rawUrl = node.getAttribute("src") || node.getAttribute("href");
      const url = absUrl(rawUrl);
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.hostname && parsed.hostname !== window.location.hostname) {
          externalHosts.add(parsed.hostname);
        }
      } catch {
        return;
      }
    });

    const imageEls = Array.from(document.images || []);
    const imageDetails = imageEls.map((img) => {
      const src = absUrl(img.currentSrc || img.src || "");
      const ext = src ? src.split("?")[0].split(".").pop()?.toLowerCase() || "" : "";
      return {
        src,
        loading: (img.getAttribute("loading") || "").toLowerCase(),
        ext
      };
    });

    const modernCount = imageDetails.filter((img) => ["webp", "avif", "svg"].includes(img.ext)).length;
    const lazyCount = imageDetails.filter((img) => img.loading === "lazy").length;
    const title = document.querySelector("title")?.textContent?.trim() || "";
    const metaDescription =
      document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "";
    const metaViewport =
      document.querySelector('meta[name="viewport"]')?.getAttribute("content")?.trim() || "";
    const favicon = !!document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
    const navCount = document.querySelectorAll("nav, [role='navigation']").length;
    const pageText = document.body?.innerText?.toLowerCase() || "";
    const pageHtml = document.documentElement?.outerHTML?.toLowerCase() || "";

    const perfEntries = performance.getEntriesByType("resource") || [];
    const totalTransferSize = perfEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const jsTransferSize = perfEntries
      .filter((entry) => entry.name.includes(".js"))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const cssTransferSize = perfEntries
      .filter((entry) => entry.name.includes(".css"))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const navigation = performance.getEntriesByType("navigation")?.[0];

    const hasEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(pageText);
    const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(pageText);
    const hasContactPage = anchors.some((anchor) => anchor.text.includes("contact"));

    return {
      mixedContent: srcValues.filter(
        (value) => window.location.protocol === "https:" && value.startsWith("http://")
      ),
      trackingScripts: [...new Set(trackingScripts)],
      passwordForms: forms.filter((form) => form.hasPassword),
      privacyPolicy: {
        exists:
          anchors.some((anchor) => anchor.text.includes("privacy")) || pageText.includes("privacy policy"),
        match: anchors.find((anchor) => anchor.text.includes("privacy"))?.href || null
      },
      cookieBanner: {
        present:
          pageText.includes("cookie consent") ||
          pageText.includes("accept cookies") ||
          pageText.includes("manage cookies") ||
          pageHtml.includes("cookie-banner")
      },
      thirdPartyIntegrations: [...externalHosts].sort(),
      adminLinks: anchors
        .filter(
          (anchor) =>
            anchor.href.includes("/admin") ||
            anchor.href.includes("/wp-admin") ||
            anchor.href.includes("/login")
        )
        .map((anchor) => anchor.href)
        .slice(0, 10),
      imageCount: imageDetails.length,
      imageOptimization: {
        modernFormatRatio: imageDetails.length > 0 ? modernCount / imageDetails.length : 0,
        lazyImageRatio: imageDetails.length > 0 ? lazyCount / imageDetails.length : 0
      },
      performance: {
        totalTransferSize,
        jsTransferSize,
        cssTransferSize,
        loadEventEndMs: navigation?.loadEventEnd || 0,
        domContentLoadedMs: navigation?.domContentLoadedEventEnd || 0
      },
      title,
      metaDescription,
      metaViewport,
      favicon,
      navCount,
      contactSignals: {
        hasEmail,
        hasPhone,
        hasContactPage,
        hasContactInfo: hasEmail || hasPhone || hasContactPage
      }
    };
  });
}

async function processScan(scan) {
  console.log(`Processing scan: ${scan.scanId}`);

  const consoleErrors = [];
  const requestFailures = [];
  const startTime = Date.now();
  let mainResponse = null;
  let browser = null;

  let leaseLost = false;
  const leaseTimer = setInterval(async () => {
    try {
      const result = await Scan.updateOne(
        { scanId: scan.scanId, status: "running", workerId },
        { $set: { leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS) } }
      );
      if (result.matchedCount === 0) leaseLost = true;
    } catch (error) {
      console.error(`Could not renew lease for ${scan.scanId}:`, error.message);
    }
  }, Math.floor(LEASE_DURATION_MS / 3));
  leaseTimer.unref?.();

  const ensureLease = () => {
    if (leaseLost) throw new Error("Worker lost ownership of this scan.");
  };

  try {
    browser = await chromium.launch({
      headless: true
    });

    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      consoleErrors.push(msg.text());
    });

    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        errorText: request.failure()?.errorText || "Request failed"
      });
    });

    mainResponse = await page.goto(scan.url, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });

    ensureLease();

    await Scan.findOneAndUpdate(
      { scanId: scan.scanId, status: "running", workerId },
      { phase: "axe" }
    );

    await page.addScriptTag({ content: axeSource.source });

    const results = await page.evaluate(async () => {
      return await axe.run();
    });
    ensureLease();

    const issues = processAxeResults(results);
    const pageSignals = await collectPageSignals(page);
    const profile = resolveScanProfile(scan.scanProfile?.key);
    const headers = mainResponse?.allHeaders ? await mainResponse.allHeaders() : {};
    const securityDetails = mainResponse?.securityDetails
      ? await mainResponse.securityDetails()
      : null;

    const audit = runCustomAudit({
      url: scan.url,
      profile,
      headers,
      securityDetails,
      cookies: await context.cookies(),
      consoleErrors,
      requestFailures,
      pageSignals,
      axeIssues: Object.values(issues).flat()
    });

    const summary = {
      critical: issues.CRITICAL.length,
      warning: issues.WARNING.length,
      info: issues.INFO.length,
      total: issues.CRITICAL.length + issues.WARNING.length + issues.INFO.length
    };

    const scanDir = path.join(STORAGE_DIR, scan.scanId);
    await fs.mkdir(scanDir, { recursive: true });

    await fs.writeFile(path.join(scanDir, "raw-report.json"), JSON.stringify(results, null, 2));

    await page.screenshot({
      path: path.join(scanDir, "screenshot.png"),
      fullPage: true
    });

    const completion = await Scan.findOneAndUpdate(
      { scanId: scan.scanId, status: "running", workerId },
      {
        $set: {
          status: "completed",
          phase: "done",
          scanProfile: profile,
          issues,
          summary,
          audit,
          artifacts: {
            rawReportPath: `/storage/${scan.scanId}/raw-report.json`,
            screenshotPath: `/storage/${scan.scanId}/screenshot.png`
          },
          "timings.finishedAt": new Date(),
          "timings.durationMs": Date.now() - startTime
        },
        $unset: { workerId: 1, leaseExpiresAt: 1, nextAttemptAt: 1 }
      },
      { new: true }
    );

    if (completion) console.log(`Scan completed: ${scan.scanId}`);
    else console.warn(`Scan ${scan.scanId} finished after its worker lease was lost; result was discarded.`);
  } catch (err) {
    const classified = classifyError(err.message);
    const attempts = scan.attempts || 1;
    const maxAttempts = scan.maxAttempts || 3;
    const retry = classified.retryable && attempts < maxAttempts && !leaseLost;
    const retryDelayMs = Math.min(15_000 * (2 ** Math.max(0, attempts - 1)), 5 * 60_000);

    const update = {
      status: retry ? "queued" : "failed",
      phase: retry ? "waiting" : classified.phase,
      errorType: classified.errorType,
      userMessage: retry
        ? `${classified.userMessage} Retrying automatically (attempt ${attempts + 1} of ${maxAttempts}).`
        : classified.userMessage,
      error: err.message,
      "timings.durationMs": Date.now() - startTime
    };
    if (retry) update.nextAttemptAt = new Date(Date.now() + retryDelayMs);
    else update["timings.finishedAt"] = new Date();

    const failedOrRetried = await Scan.findOneAndUpdate(
      { scanId: scan.scanId, status: "running", workerId },
      { $set: update, $unset: { workerId: 1, leaseExpiresAt: 1 } }
    );

    if (!failedOrRetried) {
      console.warn(`Ignored failure update for ${scan.scanId}; this worker no longer owns the scan.`);
    } else if (retry) {
      console.warn(`Scan ${scan.scanId} failed; retry ${attempts + 1}/${maxAttempts} is scheduled.`);
    } else {
      console.error(`Scan failed (${scan.scanId}):`, err.message);
    }
  } finally {
    clearInterval(leaseTimer);
    try {
      await browser?.close();
    } catch (error) {
      console.error(`Could not close browser for ${scan.scanId}:`, error.message);
    }
    currentScanId = null;
  }
}

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

async function workerLoop() {
  console.log("Worker started...");
  let lastRecoveryAt = 0;

  while (!stopping) {
    try {
      if (Date.now() - lastRecoveryAt > 15_000) {
        await recoverExpiredJobs();
        lastRecoveryAt = Date.now();
      }
      await enqueueDueSchedule();
      const scan = await claimNextJob(workerId);
      if (scan) {
        currentScanId = scan.scanId;
        await processScan(scan);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  stopHeartbeat();
  await mongoose.disconnect();
  console.log("Worker stopped cleanly.");
}

workerLoop();
