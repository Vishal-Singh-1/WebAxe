import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import "./ScanResults.css";

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

export default function ScanResults() {
  const { scanId } = useParams();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [suggestionsMeta, setSuggestionsMeta] = useState(null);

  const suggestionsLoadedKeyRef = useRef("");
  const fetchSeqRef = useRef(0);

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
        const res = await fetch(`${API_BASE}/api/scans/${scanId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch report.");
        }

        if (cancelled) return;

        setReport(data);
        setError("");
        setLoading(false);

        const status = (data?.status || "").toLowerCase();
        if (status === "queued" || status === "running") {
          timerId = setTimeout(fetchReport, 3000);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch scan result:", err);
        setError(err.message || "Failed to fetch scan result.");
        setLoading(false);
      }
    }

    fetchReport();

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [scanId]);

  const summary = report?.summary || {};
  const severityDistribution = summary.severityDistribution || {};
  const timings = report?.timings || {};
  const status = report?.status || "unknown";
  const phase = report?.phase || "waiting";

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

  useEffect(() => {
    if (!scanId) return;
    if (issues.length === 0) return;

    const scanStatus = (report?.status || "").toLowerCase();
    if (scanStatus !== "completed") return;

    const loadKey = `${scanId}|${issues.length}`;
    if (suggestionsLoadedKeyRef.current === loadKey) return;

    let cancelled = false;
    const seq = ++fetchSeqRef.current;

    async function fetchSuggestions() {
      setSuggestionsLoading(true);
      setSuggestionsError("");

      try {
        const latestRes = await fetch(
          `${API_BASE}/api/scans/${scanId}/recommendations/raw/latest`
        );

        let suggestionData;
        if (latestRes.ok) {
          suggestionData = await parseJsonResponse(
            latestRes,
            "Latest suggestion report is not valid JSON."
          );
        } else if (latestRes.status === 404) {
          const createRes = await fetch(`${API_BASE}/api/scans/${scanId}/recommendations/raw`, {
            method: "POST"
          });
          const createData = await parseJsonResponse(
            createRes,
            "Suggestion API did not return JSON."
          );

          if (!createRes.ok) {
            throw new Error(createData?.error || "Failed to generate suggestions.");
          }

          const refetchLatestRes = await fetch(
            `${API_BASE}/api/scans/${scanId}/recommendations/raw/latest`
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

        if (cancelled) return;
        if (seq !== fetchSeqRef.current) return;

        setSuggestions(suggestionData?.recommendations || []);
        setSuggestionsMeta(suggestionData?.meta || null);
        suggestionsLoadedKeyRef.current = loadKey;
      } catch (err) {
        if (cancelled) return;
        if (seq !== fetchSeqRef.current) return;
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
  }, [scanId, report?.status, issues.length]);

  useEffect(() => {
    suggestionsLoadedKeyRef.current = "";
    setSuggestions([]);
    setSuggestionsMeta(null);
    setSuggestionsError("");
  }, [scanId]);

  if (loading) {
    return <div className="dashboard">Loading scan results...</div>;
  }

  if (error) {
    return <div className="dashboard">{error}</div>;
  }

  if (!report) {
    return <div className="dashboard">No report found</div>;
  }

  const isFailed = (status || "").toLowerCase() === "failed";
  const userFailMsg = report.userMessage || "";
  const failExtra = failureContextLine(report.errorType);
  const needsAiKeyHint =
    report.aiConfigured !== true ||
    (Boolean(suggestionsMeta) && suggestionsMeta.aiEnabled === false);
  const showAiFailureHint =
    suggestionsMeta?.aiEnabled === true &&
    suggestionsMeta?.aiUsed === false &&
    suggestionsMeta?.aiReason;

  return (
    <div className="dashboard">
      {isFailed && (
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
      )}

      {/* TOP CARDS */}
      <div className="top-cards">
        {/* OVERVIEW CARD */}
        <div className="card overview">
          <h3>Overview</h3>
          <p className="site">{report.url}</p>

          <p>
            Status: <strong>{status}</strong> ({phase})
          </p>

          <div className="circle-wrap">
            <div className="circle">
              <span>{summary.healthScore ?? 100}%</span>
            </div>
            <div className="overview-info">
              <div className="grade">Grade: {summary.grade || "-"}</div>
              <p>Total Issues: {summary.totalIssues ?? issues.length}</p>
              <p>
                Scan Duration:{" "}
                {typeof timings.durationMs === "number"
                  ? `${Math.round(timings.durationMs / 1000)}s`
                  : "In progress"}
              </p>
              <p>
                Last Scan:{" "}
                {timings.finishedAt
                  ? new Date(timings.finishedAt).toLocaleDateString()
                  : "In progress"}
              </p>
            </div>
          </div>
        </div>
        {/* SEVERITY CARD */}
        <div className="card severity">
          <h3>Severity Distribution</h3>
          <ul>
            <li>
              <span className="dot critical"></span>
              Critical - {severityDistribution.critical ?? 0}
            </li>
            <li>
              <span className="dot serious"></span>
              Serious - {severityDistribution.serious ?? 0}
            </li>
            <li>
              <span className="dot moderate"></span>
              Moderate - {severityDistribution.moderate ?? 0}
            </li>
            <li>
              <span className="dot minor"></span>
              Minor - {severityDistribution.minor ?? 0}
            </li>
          </ul>
        </div>
      </div>

      {/* ISSUES LIST */}
      <div className="card issues">
        <h3>Issues List</h3>
        {issues.length === 0 ? (
          <p>
            {isFailed
              ? "No issues were recorded before the scan stopped."
              : "No issues yet. Waiting for scanner output..."}
          </p>
        ) : (
          issues.map((issue, index) => (
            <div className="issue-card" key={`${issue.id}-${index}`}>
              <div className="issue-top">
                <div>
                  <strong>{issue.id}</strong>
                  <span className={`badge ${issue.impact || "minor"}`}>
                    {issue.impact || "minor"}
                  </span>
                  {issue?.wcag?.level && (
                    <span className="wcag">WCAG: {issue.wcag.level}</span>
                  )}
                </div>
              </div>
              <div className="issue-middle">
                <span>{issue.elementsAffected || 0} elements</span>
                <p>{issue.description || "No description available."}</p>
              </div>
              {issue.helpUrl && (
                <div className="issue-actions">
                  <a href={issue.helpUrl} target="_blank" rel="noreferrer" className="btn">
                    Learn more
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ARTIFACTS (completed scans) */}
      {!isFailed &&
        status.toLowerCase() === "completed" &&
        report.artifacts &&
        (report.artifacts.rawReportPath || report.artifacts.screenshotPath) && (
        <div className="card artifacts-card">
          <h3>Artifacts</h3>
          <p className="artifact-hint">
            Files are served by the API under <code>/storage</code>. Use the same host as your backend
            ({API_BASE}).
          </p>
          <ul className="artifact-links">
            {report.artifacts.rawReportPath ? (
              <li>
                <a
                  href={`${API_BASE}${report.artifacts.rawReportPath}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Raw axe report (JSON)
                </a>
              </li>
            ) : null}
            {report.artifacts.screenshotPath ? (
              <li>
                <a
                  href={`${API_BASE}${report.artifacts.screenshotPath}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Full-page screenshot
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      )}

      {/* AI SUGGESTIONS */}
      <div className="card issues">
        <h3>Fix suggestions</h3>
        {needsAiKeyHint && !isFailed ? (
          <p className="ai-config-hint">
            <strong>AI not enabled:</strong> set <code>OPENAI_API_KEY</code> on the backend to
            enable AI-generated fixes. Until then, suggestions use rule-based text only.
          </p>
        ) : null}

        {isFailed ? (
          <p>Fix suggestions are not generated for failed scans.</p>
        ) : issues.length === 0 ? (
          <p>No accessibility issues were found, so there is nothing to suggest.</p>
        ) : suggestionsLoading ? (
          <p>Loading suggestions…</p>
        ) : suggestionsError ? (
          <p>{suggestionsError}</p>
        ) : suggestions.length === 0 ? (
          <p>No suggestions loaded yet.</p>
        ) : (
          suggestions.map((item, index) => (
            <div className="issue-card" key={`${item.issueId || "suggestion"}-${index}`}>
              <div className="issue-top">
                <div>
                  <strong>{item.issueId || "unknown-rule"}</strong>
                  <span className={`badge ${item.impact || "minor"}`}>
                    {item.generatedBy || "rule-based"}
                  </span>
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
                {item.problemCode ? (
                  <pre>{item.problemCode}</pre>
                ) : null}
              </div>
            </div>
          ))
        )}
        {suggestionsMeta && !isFailed && issues.length > 0 ? (
          <div className="suggestions-meta">
            <p>
              Source:{" "}
              {suggestionsMeta.aiUsed
                ? "AI-assisted"
                : suggestionsMeta.aiEnabled
                  ? "Rule-based (AI unavailable)"
                  : "Rule-based"}
            </p>
            {showAiFailureHint ? (
              <p className="ai-key-hint">
                AI did not run: {suggestionsMeta.aiReason}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* SCAN HISTORY */}
      <div className="card history">
        <h3>Scan History</h3>
        <div className="history-container">
          <svg className="graph" viewBox="0 0 300 100">
            <polyline
              fill="none"
              stroke="#6b5b95"
              strokeWidth="3"
              points="10,70 60,50 110,60 160,40 210,45 260,30"
            />
          </svg>
          <div className="history-list">
            <div className="history-row">
              <span>Current Scan</span>
              <strong>{summary.healthScore ?? 100}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
