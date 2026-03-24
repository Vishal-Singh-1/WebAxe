import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import { getAuthHeaders } from "../auth.js";
import "./ScanResults.css";

const SEVERITY_ORDER = ["critical", "serious", "moderate", "minor"];
const SEVERITY_COLORS = {
  critical: "#c45a6a",
  serious: "#ea8d4f",
  moderate: "#f0c35a",
  minor: "#67ad72"
};
const CATEGORY_ORDER = ["security", "privacy", "accessibility", "performance", "content"];

function formatLabel(value) {
  return String(value || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function failureContextLine(errorType) {
  switch (errorType) {
    case "AXE_BLOCKED_BY_CSP":
      return "Strict Content Security Policy blocked the scanner script. The worker bypasses CSP only inside the automation browser so axe can run.";
    case "TIMEOUT":
      return "The page took too long to load or finish rendering.";
    case "INVALID_URL":
      return "The URL may be mistyped or the domain does not resolve.";
    case "SITE_DOWN":
      return "The server refused the connection or appears offline.";
    case "ACCESS_DENIED":
      return "The site returned 401/403 or blocked automated access.";
    default:
      return null;
  }
}

function formatDuration(durationMs) {
  if (typeof durationMs !== "number" || Number.isNaN(durationMs)) {
    return "In progress";
  }

  const totalSeconds = Math.max(Math.round(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function parseHistoryLabel(dateValue) {
  if (!dateValue) return "Pending";
  return new Date(dateValue).toLocaleDateString();
}

function buildDonutStyle(distribution) {
  const total = SEVERITY_ORDER.reduce((sum, key) => sum + (distribution[key] || 0), 0);
  if (total <= 0) {
    return {
      background: "conic-gradient(#eadfe7 0deg 360deg)"
    };
  }

  let current = 0;
  const segments = SEVERITY_ORDER.map((key) => {
    const value = distribution[key] || 0;
    const start = current;
    current += (value / total) * 360;
    return `${SEVERITY_COLORS[key]} ${start}deg ${current}deg`;
  });

  return {
    background: `conic-gradient(${segments.join(", ")})`
  };
}

function buildScoreStyle(score) {
  const safeScore = Math.max(0, Math.min(score ?? 0, 100));
  const primaryStop = safeScore * 2.6;
  const secondaryStop = Math.min(primaryStop + 28, 330);

  return {
    background: `conic-gradient(#67ad72 0deg ${primaryStop}deg, #f0c35a ${primaryStop}deg ${secondaryStop}deg, #eadfe7 ${secondaryStop}deg 360deg)`
  };
}

function buildTrendGeometry(points, width, height, padding) {
  if (points.length === 0) {
    return { path: "", circles: [] };
  }

  const values = points.map((point) => point.healthScore ?? 0);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const span = max - min || 1;
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const circles = points.map((point, index) => {
    const x = padding.left + (innerWidth * index) / Math.max(points.length - 1, 1);
    const y = padding.top + innerHeight - (((point.healthScore ?? 0) - min) / span) * innerHeight;
    return { ...point, x, y };
  });

  const path = circles
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  return { path, circles };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrintDate(dateValue) {
  if (!dateValue) return "Pending";
  try {
    return new Date(dateValue).toLocaleString();
  } catch {
    return "Pending";
  }
}

function buildRuleFallbackIssues(ruleResults = []) {
  return ruleResults
    .filter((rule) => ["fail", "warn"].includes(String(rule.status || "").toLowerCase()))
    .map((rule) => ({
      id: rule.id || "audit-finding",
      impact: String(rule.status || "").toLowerCase() === "fail" ? "serious" : "moderate",
      description:
        rule.message ||
        "This is a high-level audit finding from the scan rules rather than a direct axe element violation.",
      helpUrl: null,
      elementsAffected: 0,
      wcag: {},
      isAuditFinding: true
    }));
}

function buildPdfHtml({ report, summary, issues, suggestions, screenshotUrl }) {
  const severityDistribution = summary?.severityDistribution || {};
  const severityItems = SEVERITY_ORDER.map((level) => `
    <div class="severity-item">
      <span>${escapeHtml(level.charAt(0).toUpperCase() + level.slice(1))}</span>
      <strong>${escapeHtml(severityDistribution[level] ?? 0)}</strong>
    </div>
  `).join("");

  const issuesMarkup =
    issues.length > 0
      ? issues
          .map(
            (issue, index) => `
              <article class="list-card">
                <div class="list-head">
                  <strong>${index + 1}. ${escapeHtml(issue.id || "unknown-rule")}</strong>
                  <span class="pill">${escapeHtml(issue.impact || "minor")}</span>
                </div>
                <p>${escapeHtml(issue.description || "No description available.")}</p>
                <p class="meta-line">Affected elements: ${escapeHtml(issue.elementsAffected || 0)}</p>
              </article>
            `
          )
          .join("")
      : `<p class="empty-copy">No issues were recorded for this report.</p>`;

  const suggestionsMarkup =
    suggestions.length > 0
      ? suggestions
          .map(
            (item, index) => `
              <article class="list-card">
                <div class="list-head">
                  <strong>${index + 1}. ${escapeHtml(item.issueId || "unknown-rule")}</strong>
                  <span class="pill">${escapeHtml(item.generatedBy || "rule-based")}</span>
                </div>
                <p><strong>Why it matters:</strong> ${escapeHtml(
                  item.whyItMatters || "No explanation available."
                )}</p>
                <p><strong>Suggested fix:</strong> ${escapeHtml(
                  item.suggestedFix || "No fix suggestion available."
                )}</p>
              </article>
            `
          )
          .join("")
      : `<p class="empty-copy">No suggestions were available for this report.</p>`;

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>WebAxe report export</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #341f2d;
          --muted: #705766;
          --accent: #b55668;
          --panel: #fff8f7;
          --line: rgba(181, 122, 143, 0.24);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 28px;
          font-family: "Segoe UI", sans-serif;
          color: var(--ink);
          background: #f7f1f3;
        }
        .sheet {
          max-width: 980px;
          margin: 0 auto;
        }
        .hero, .section, .metric-card, .list-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
        }
        .hero, .section {
          padding: 24px;
          margin-bottom: 18px;
        }
        h1, h2, h3, p { margin-top: 0; }
        h1 { margin-bottom: 10px; font-size: 2rem; }
        .subtitle, .meta-line, .empty-copy { color: var(--muted); }
        .metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-top: 18px;
        }
        .metric-card {
          padding: 16px;
          min-height: 110px;
        }
        .metric-label {
          display: block;
          margin-bottom: 10px;
          color: var(--muted);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .metric-value {
          font-size: 2rem;
          font-weight: 800;
        }
        .severity-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .severity-item {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 14px 16px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: #fff;
        }
        .screenshot {
          width: 100%;
          border-radius: 16px;
          border: 1px solid var(--line);
          overflow: hidden;
          background: #fff;
        }
        .screenshot img {
          display: block;
          width: 100%;
          height: auto;
        }
        .list-grid {
          display: grid;
          gap: 12px;
        }
        .list-card {
          padding: 16px;
          break-inside: avoid;
        }
        .list-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 10px;
        }
        .pill {
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(181, 86, 104, 0.12);
          color: var(--accent);
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: capitalize;
          white-space: nowrap;
        }
        @media print {
          body { padding: 0; background: #fff; }
          .sheet { max-width: none; }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="hero">
          <h1>Accessibility report export</h1>
          <p class="subtitle">${escapeHtml(report?.url || "Unknown URL")}</p>
          <p class="meta-line">Scan ID: ${escapeHtml(report?.scanId || "-")}</p>
          <p class="meta-line">Generated: ${escapeHtml(
            formatPrintDate(report?.timings?.finishedAt || report?.timings?.createdAt)
          )}</p>
          <div class="metrics">
            <div class="metric-card">
              <span class="metric-label">Score</span>
              <div class="metric-value">${escapeHtml(summary?.healthScore ?? 100)}%</div>
            </div>
            <div class="metric-card">
              <span class="metric-label">Grade</span>
              <div class="metric-value">${escapeHtml(summary?.grade || "-")}</div>
            </div>
            <div class="metric-card">
              <span class="metric-label">Issues</span>
              <div class="metric-value">${escapeHtml(summary?.totalIssues ?? issues.length)}</div>
            </div>
            <div class="metric-card">
              <span class="metric-label">Status</span>
              <div class="metric-value">${escapeHtml(report?.status || "-")}</div>
            </div>
          </div>
        </section>

        ${
          screenshotUrl
            ? `<section class="section">
                <h2>Captured page screenshot</h2>
                <div class="screenshot">
                  <img src="${escapeHtml(screenshotUrl)}" alt="Captured page screenshot" />
                </div>
              </section>`
            : ""
        }

        <section class="section">
          <h2>Severity breakdown</h2>
          <div class="severity-grid">${severityItems}</div>
        </section>

        <section class="section">
          <h2>Issues</h2>
          <div class="list-grid">${issuesMarkup}</div>
        </section>

        <section class="section">
          <h2>Suggestions</h2>
          <div class="list-grid">${suggestionsMarkup}</div>
        </section>
      </main>
      <script>
        window.addEventListener("load", () => {
          const images = Array.from(document.images || []);
          let settled = false;

          const printNow = () => {
            if (settled) return;
            settled = true;
            setTimeout(() => {
              window.print();
            }, 250);
          };

          if (images.length === 0) {
            printNow();
            return;
          }

          let loaded = 0;
          const markReady = () => {
            loaded += 1;
            if (loaded >= images.length) {
              printNow();
            }
          };

          images.forEach((img) => {
            if (img.complete) {
              markReady();
            } else {
              img.addEventListener("load", markReady, { once: true });
              img.addEventListener("error", markReady, { once: true });
            }
          });

          setTimeout(printNow, 1800);
        });
      </script>
    </body>
  </html>`;
}

export default function ScanResults({ token }) {
  const { scanId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pollWarning, setPollWarning] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestionsMeta, setSuggestionsMeta] = useState(null);
  const [historySeries, setHistorySeries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const suggestionsLoadedKeyRef = useRef("");
  const fetchSeqRef = useRef(0);
  const reportRef = useRef(null);

  async function parseJsonResponse(res, fallbackMessage) {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await res.json();
    }

    const text = await res.text();
    throw new Error(`${fallbackMessage} ${text.slice(0, 120)}`.trim());
  }

  useEffect(() => {
    let cancelled = false;
    let timerId;

    if (!scanId) {
      setError("Missing scan ID.");
      setLoading(false);
      return;
    }

    async function fetchReport() {
      try {
        const res = await fetch(`${API_BASE}/api/scans/${scanId}`, {
          headers: getAuthHeaders(token)
        });
        const data = await parseJsonResponse(res, "Scan report API did not return JSON.");

        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch report.");
        }

        if (cancelled) return;

        reportRef.current = data;
        setReport(data);
        setError("");
        setPollWarning("");
        setLoading(false);

        const status = (data?.status || "").toLowerCase();
        if (status === "queued" || status === "running") {
          timerId = setTimeout(fetchReport, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch scan result:", err);
        setLoading(false);

        if (reportRef.current) {
          setPollWarning("Live scan updates were interrupted. Retrying...");
          timerId = setTimeout(fetchReport, 3000);
          return;
        }

        setError(err.message || "Failed to fetch scan result.");
      }
    }

    fetchReport();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [scanId, token]);

  useEffect(() => {
    if (!scanId) return;

    suggestionsLoadedKeyRef.current = "";
    reportRef.current = null;
    setSuggestions([]);
    setSuggestionsMeta(null);
    setSuggestionsError("");
    setHistorySeries([]);
    setHistoryLoading(false);
  }, [scanId]);

  const summary = report?.summary || {};
  const severityDistribution = summary.severityDistribution || {};
  const timings = report?.timings || {};
  const status = report?.status || "unknown";
  const phase = report?.phase || "waiting";
  const rating = report?.rating || {};
  const categoryScores = rating?.categories || {};
  const trustIndicators = Array.isArray(rating?.trustIndicators) ? rating.trustIndicators : [];
  const sectorLabel = rating?.profile?.label || "General website";
  const appliedWeights = rating?.profile?.weights || {};
  const ruleResults = Array.isArray(report?.audit?.ruleResults) ? report.audit.ruleResults : [];

  const issues = Array.isArray(report?.issues)
    ? report.issues
    : Object.values(report?.rawIssueGroups || {})
        .flat()
        .map((item) => ({
          id: item?.ruleId || item?.id || "unknown-rule",
          impact: (item?.impact || "minor").toLowerCase(),
          description: item?.description || item?.help || "No description available.",
          helpUrl: item?.helpUrl || null,
          elementsAffected: item?.occurrences || item?.nodes?.length || 0,
          wcag: item?.wcag || {}
        }));
  const fallbackRuleIssues = issues.length === 0 ? buildRuleFallbackIssues(ruleResults) : [];
  const displayedIssues = issues.length > 0 ? issues : fallbackRuleIssues;
  const hasDisplayedIssues = displayedIssues.length > 0;

  useEffect(() => {
    if (!scanId || !hasDisplayedIssues) return;

    const scanStatus = (report?.status || "").toLowerCase();
    if (scanStatus !== "completed") return;

    const loadKey = `${scanId}|${displayedIssues.length}`;
    if (suggestionsLoadedKeyRef.current === loadKey) return;

    let cancelled = false;
    const seq = ++fetchSeqRef.current;

    async function fetchSuggestions() {
      setSuggestionsLoading(true);
      setSuggestionsError("");

      try {
        const latestRes = await fetch(`${API_BASE}/api/scans/${scanId}/recommendations/raw/latest`, {
          headers: getAuthHeaders(token)
        });

        let suggestionData;
        if (latestRes.ok) {
          suggestionData = await parseJsonResponse(
            latestRes,
            "Latest suggestion report is not valid JSON."
          );
        } else if (latestRes.status === 404) {
          const createRes = await fetch(`${API_BASE}/api/scans/${scanId}/recommendations/raw`, {
            method: "POST",
            headers: getAuthHeaders(token)
          });
          const createData = await parseJsonResponse(createRes, "Suggestion API did not return JSON.");

          if (!createRes.ok) {
            throw new Error(createData?.error || "Failed to generate suggestions.");
          }

          const refetchLatestRes = await fetch(
            `${API_BASE}/api/scans/${scanId}/recommendations/raw/latest`,
            {
              headers: getAuthHeaders(token)
            }
          );
          suggestionData = await parseJsonResponse(
            refetchLatestRes,
            "Latest suggestion report is not valid JSON."
          );

          if (!refetchLatestRes.ok) {
            throw new Error("Failed to load generated recommendation report.");
          }
        } else {
          const latestData = await parseJsonResponse(
            latestRes,
            "Latest suggestions API did not return JSON."
          );
          throw new Error(latestData?.error || "Failed to load latest suggestions.");
        }

        if (cancelled || seq !== fetchSeqRef.current) return;

        setSuggestions(suggestionData?.recommendations || []);
        setSuggestionsMeta(suggestionData?.meta || null);
        suggestionsLoadedKeyRef.current = loadKey;
      } catch (err) {
        if (cancelled || seq !== fetchSeqRef.current) return;
        setSuggestionsError(err.message || "Unable to load suggestions.");
      } finally {
        if (!cancelled && seq === fetchSeqRef.current) {
          setSuggestionsLoading(false);
        }
      }
    }

    fetchSuggestions();

    return () => {
      cancelled = true;
    };
  }, [scanId, report?.status, hasDisplayedIssues, displayedIssues.length, token]);

  useEffect(() => {
    const url = report?.url;
    const scanStatus = (report?.status || "").toLowerCase();

    if (!url || scanStatus !== "completed") return;

    let cancelled = false;

    async function fetchHistorySeries() {
      setHistoryLoading(true);

      try {
        const q = encodeURIComponent(url);
        const res = await fetch(`${API_BASE}/api/scans/history/by-url?url=${q}`, {
          headers: getAuthHeaders(token)
        });
        const data = await parseJsonResponse(res, "History API did not return JSON.");

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load scan history.");
        }

        if (cancelled) return;
        setHistorySeries(Array.isArray(data?.series) ? data.series : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load report history:", err);
        setHistorySeries([]);
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    }

    fetchHistorySeries();

    return () => {
      cancelled = true;
    };
  }, [report?.url, report?.status, token]);

  if (loading) {
    return <div className="dashboard">Loading scan results...</div>;
  }

  if (error) {
    return <div className="dashboard">{error}</div>;
  }

  if (!report) {
    return <div className="dashboard">No report found</div>;
  }

  const isFailed = status.toLowerCase() === "failed";
  const isInProgress = ["queued", "running"].includes(status.toLowerCase());
  const totalIssues = summary.totalIssues ?? issues.length;
  const userFailMsg = report.userMessage || "";
  const failExtra = failureContextLine(report.errorType);
  const scoreStyle = buildScoreStyle(summary.healthScore ?? 100);
  const donutStyle = buildDonutStyle(severityDistribution);
  const categoryItems = CATEGORY_ORDER.filter((key) => categoryScores[key]).map((key) => ({
    key,
    ...categoryScores[key]
  }));
  const historyPoints = historySeries.slice(-6).map((item) => ({
    scanId: item.scanId,
    healthScore: item.healthScore ?? 0,
    label: parseHistoryLabel(item.finishedAt || item.createdAt)
  }));
  const trendChart = buildTrendGeometry(historyPoints, 760, 220, {
    top: 20,
    right: 16,
    bottom: 34,
    left: 16
  });

  function handleExportPdf() {
    if (!report) return;

    const screenshotUrl = report?.artifacts?.screenshotPath
      ? `${API_BASE}${report.artifacts.screenshotPath}`
      : "";

    const printWindow = window.open("", "_blank", "width=1100,height=900");
    if (!printWindow) {
      setExportError("The PDF export window was blocked. Please allow pop-ups and try again.");
      return;
    }

    setExportError("");
    setIsExporting(true);
    const html = buildPdfHtml({
      report,
      summary,
      issues,
      suggestions,
      screenshotUrl
    });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      setIsExporting(false);
    }, 800);
  }

  return (
    <div className="dashboard report-page">
      <div className="report-toolbar">
        <div>
          <p className="report-eyebrow">Report export</p>
          <h2>Deep scan report</h2>
          {exportError ? <p className="report-export-error">{exportError}</p> : null}
        </div>
        <button
          type="button"
          className="report-export-button"
          onClick={handleExportPdf}
          disabled={isInProgress || isExporting}
        >
          {isExporting ? "Preparing PDF..." : "Export as PDF"}
        </button>
      </div>

      {isFailed ? (
        <div className="card scan-failure-banner" role="alert">
          <h3>Scan did not complete</h3>
          <p className="scan-failure-primary">
            {userFailMsg || "This scan could not be completed."}
          </p>
          {failExtra ? <p className="scan-failure-context">{failExtra}</p> : null}
          {report.errorType ? (
            <p className="scan-failure-meta">
              <span className="scan-failure-label">Reason code:</span> {report.errorType}
            </p>
          ) : null}
        </div>
      ) : null}

      {pollWarning && isInProgress ? (
        <div className="card scan-failure-banner" role="status">
          <p className="scan-failure-primary">{pollWarning}</p>
        </div>
      ) : null}

      <div className="top-cards">
        <div className="card overview">
          <h3>Overview</h3>
          <p className="site">{report.url}</p>

          <div className="status-row">
            <p>
              Status: <strong>{status}</strong> ({phase})
            </p>
            <span className="status-chip">{summary.healthScore ?? 100}% score</span>
          </div>

          <div className="circle-wrap">
            <div className="circle" style={scoreStyle}>
              <span>{summary.healthScore ?? 100}%</span>
            </div>
            <div className="overview-info">
              <div className="grade">Grade: {summary.grade || "-"}</div>
              <p>Sector Profile: {sectorLabel}</p>
              <p>Total Issues: {totalIssues}</p>
              <p>Scan Duration: {formatDuration(timings.durationMs)}</p>
              <p>Last Scan: {timings.finishedAt ? parseHistoryLabel(timings.finishedAt) : "In progress"}</p>
              <div className="score-bar-shell" aria-hidden="true">
                <div
                  className="score-bar-fill"
                  style={{ width: `${Math.max(0, Math.min(summary.healthScore ?? 100, 100))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card severity">
          <h3>Severity Distribution</h3>
          <div className="severity-layout">
            <div className="donut" style={donutStyle}>
              <div className="donut-center">
                <strong>{totalIssues}</strong>
                <span>issues</span>
              </div>
            </div>
            <ul className="severity-list">
              {SEVERITY_ORDER.map((level) => {
                const count = severityDistribution[level] ?? 0;
                const percentage = totalIssues > 0 ? Math.round((count / totalIssues) * 100) : 0;

                return (
                  <li key={level}>
                    <div className="severity-list-row">
                      <span className={`dot ${level}`}></span>
                      <span className="severity-name">
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </span>
                      <strong>{count}</strong>
                    </div>
                    <div className="severity-meter">
                      <div
                        className={`severity-meter-fill ${level}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <div className="card category-breakdown">
        <div className="section-heading">
          <div>
            <h3>Category Breakdown</h3>
            <p className="history-blurb">
              Sector-aware weighting is applied to the five rating pillars for this scan.
            </p>
          </div>
        </div>
        {categoryItems.length === 0 ? (
          <p>Category scoring will appear after the scan completes.</p>
        ) : (
          <div className="category-grid">
            {categoryItems.map((item) => (
              <article className="category-card" key={item.key}>
                <div className="category-card-top">
                  <strong>{item.label || formatLabel(item.key)}</strong>
                  <span>{item.score}%</span>
                </div>
                <div className="score-bar-shell" aria-hidden="true">
                  <div className="score-bar-fill" style={{ width: `${item.score}%` }} />
                </div>
                <p className="category-meta">
                  Weight: {Math.round((appliedWeights[item.key] || 0) * 100)}% | Pass: {item.pass} | Warn: {item.warn} | Fail: {item.fail}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="top-cards">
        <div className="card trust-card">
          <h3>Trust Indicators</h3>
          {trustIndicators.length === 0 ? (
            <p>Trust indicators will be generated after a completed scan.</p>
          ) : (
            <div className="trust-list">
              {trustIndicators.map((item) => (
                <div className="trust-item" key={item.id}>
                  <div className="trust-item-top">
                    <strong>{item.label}</strong>
                    <span className={`badge ${item.status === "fail" ? "critical" : item.status === "warn" ? "moderate" : "minor"}`}>
                      {item.status}
                    </span>
                  </div>
                  <p>{item.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card rules-card">
          <h3>Priority Rules</h3>
          {ruleResults.length === 0 ? (
            <p>Custom rule results are not available for this scan yet.</p>
          ) : (
            <div className="rule-list">
              {ruleResults
                .slice()
                .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
                .slice(0, 8)
                .map((rule) => (
                  <div className="rule-item" key={rule.id}>
                    <div className="rule-item-top">
                      <strong>{rule.name}</strong>
                      <span className={`badge ${rule.status === "fail" ? "critical" : rule.status === "warn" ? "moderate" : "minor"}`}>
                        {rule.status}
                      </span>
                    </div>
                    <p>{rule.message}</p>
                    <span className="rule-meta">
                      {formatLabel(rule.category)} | Priority {rule.priorityScore}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="card issues">
        <h3>Issues List</h3>
        {!hasDisplayedIssues ? (
          <p>
            {isFailed
              ? "No issues were recorded before the scan stopped."
              : "No issues yet. Waiting for scanner output..."}
          </p>
        ) : (
          <>
            {issues.length === 0 ? (
              <p className="history-blurb">
                No direct axe issues were detected for this scan. Showing custom audit findings instead.
              </p>
            ) : null}
            {displayedIssues.map((issue, index) => (
            <div className="issue-card" key={`${issue.id}-${index}`}>
              <div className="issue-top">
                <div className="issue-title-row">
                  <strong>{issue.id}</strong>
                  <span className={`badge ${issue.impact || "minor"}`}>{issue.impact || "minor"}</span>
                  {issue?.wcag?.level ? <span className="wcag">WCAG: {issue.wcag.level}</span> : null}
                </div>
                <span className="issue-count">
                  {issue.isAuditFinding ? "Audit finding" : `${issue.elementsAffected || 0} elements`}
                </span>
              </div>
              <div className="issue-middle">
                <p>{issue.description || "No description available."}</p>
              </div>
              {issue.helpUrl ? (
                <div className="issue-actions">
                  <a href={issue.helpUrl} target="_blank" rel="noreferrer" className="btn">
                    Learn more
                  </a>
                </div>
              ) : null}
            </div>
            ))}
          </>
        )}
      </div>

      {!isFailed &&
      status.toLowerCase() === "completed" &&
      report.artifacts &&
      report.artifacts.screenshotPath ? (
        <div className="card artifacts-card">
          <div className="section-heading">
            <div>
              <h3>Screenshot</h3>
              <p className="artifact-hint">
                Check the rendered page snapshot captured during the scan.
              </p>
            </div>
          </div>
          <div className="artifact-grid artifact-grid-single">
            <article className="artifact-tile">
              <span className="artifact-label">Visual capture</span>
              <h4>Full-page screenshot</h4>
              <p>Open the page snapshot captured alongside the report.</p>
              <a
                className="artifact-link"
                href={`${API_BASE}${report.artifacts.screenshotPath}`}
                target="_blank"
                rel="noreferrer"
              >
                Open screenshot
              </a>
            </article>
          </div>
        </div>
      ) : null}

      <div className="card issues suggestions-card">
        <h3>Fix suggestions</h3>

        {isFailed ? (
          <p>Fix suggestions are not generated for failed scans.</p>
        ) : !hasDisplayedIssues ? (
          <p>No accessibility issues were found, so there is nothing to suggest.</p>
        ) : suggestionsLoading ? (
          <p>Loading suggestions...</p>
        ) : suggestionsError ? (
          <p>{suggestionsError}</p>
        ) : suggestions.length === 0 ? (
          <p>No suggestions loaded yet.</p>
        ) : (
          suggestions.map((item, index) => (
            <div className="issue-card suggestion-card" key={`${item.issueId || "suggestion"}-${index}`}>
              <div className="issue-top">
                <div className="issue-title-row">
                  <strong>{item.issueId || "unknown-rule"}</strong>
                </div>
              </div>
              <div className="issue-middle">
                <p>
                  <strong>Why it matters: </strong>
                  {item.whyItMatters || "No explanation available."}
                </p>
                <p>
                  <strong>Suggested fix: </strong>
                  {item.suggestedFix || "No fix suggestion available."}
                </p>
                {item.problemCode ? <pre>{item.problemCode}</pre> : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card history-card">
        <div className="section-heading">
          <div>
            <h3>Scan history</h3>
            <p className="history-blurb">
              Score movement for this URL across recent completed scans.
            </p>
          </div>
          <Link to="/history" className="history-analytics-link">
            Open analytics &amp; scan history
          </Link>
        </div>

        {historyLoading ? (
          <p>Loading history...</p>
        ) : historyPoints.length === 0 ? (
          <p>No history available for this URL yet.</p>
        ) : (
          <div className="history-container">
            <div className="graph-shell">
              <svg viewBox="0 0 760 220" className="graph" role="img" aria-label="Accessibility score trend">
                {[0, 1, 2, 3].map((step) => {
                  const y = 20 + 48 * step;
                  return (
                    <line key={step} x1="16" x2="744" y1={y} y2={y} className="graph-grid" />
                  );
                })}
                <path d={trendChart.path} className="graph-line" />
                {trendChart.circles.map((point) => (
                  <g key={point.scanId}>
                    <circle cx={point.x} cy={point.y} r="6" className="graph-point" />
                    <text x={point.x} y="210" textAnchor="middle" className="graph-label">
                      {point.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <div className="history-list">
              {historyPoints
                .slice()
                .reverse()
                .map((point) => (
                  <div className="history-row" key={point.scanId}>
                    <span>{point.label}</span>
                    <strong>{point.healthScore}%</strong>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
