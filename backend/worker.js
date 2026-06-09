import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import axeSource from "axe-core";

import connectDB from "./config/db.js";
import { loadBackendEnv } from "./config/loadEnv.js";
import { resolveScanProfile } from "./config/scanProfiles.js";
import Scan from "./models/scan.js";
import { processAxeResults } from "./utils/processAxeResults.js";
import { runCustomAudit } from "./utils/customAudit.js";
import { startHeartbeat } from "./worker/heartbeat.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadBackendEnv();

startHeartbeat();
await connectDB();

const STORAGE_DIR = path.join(__dirname, "storage");

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

  if (message.includes("Content Security Policy") || message.includes("page.addScriptTag")) {
    return {
      phase: "axe",
      errorType: "AXE_BLOCKED_BY_CSP",
      userMessage: "The website blocks accessibility scanning due to strict Content Security Policy."
    };
  }

  return {
    phase: "unknown",
    errorType: "UNKNOWN",
    userMessage: "The scan could not be completed."
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

  await Scan.findOneAndUpdate(
    { scanId: scan.scanId },
    {
      status: "running",
      phase: "navigation",
      "timings.startedAt": new Date()
    }
  );

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

    await Scan.findOneAndUpdate(
      { scanId: scan.scanId },
      { phase: "axe" }
    );

    await page.addScriptTag({ content: axeSource.source });

    const results = await page.evaluate(async () => {
      return await axe.run();
    });

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

    await Scan.findOneAndUpdate(
      { scanId: scan.scanId },
      {
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
      }
    );

    console.log(`Scan completed: ${scan.scanId}`);
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

    console.error(`Scan failed (${scan.scanId}):`, err.message);
  } finally {
    await browser?.close();
  }
}

async function workerLoop() {
  console.log("Worker started...");

  while (true) {
    try {
      const scan = await Scan.findOne({ status: "queued" }).sort({
        "timings.createdAt": 1
      });

      if (scan) {
        await processScan(scan);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

workerLoop();
