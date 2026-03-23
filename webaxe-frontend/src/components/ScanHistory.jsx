import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import { getAuthHeaders } from "../auth.js";
import "./ScanHistory.css";

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function TrendChart({ title, points, valueKey, labelY }) {
  const w = 420;
  const h = 180;
  const pad = { t: 24, r: 16, b: 36, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const vals = points.map((p) => p[valueKey]);
  const minV = Math.min(...vals, 0);
  const maxV = Math.max(...vals, 1);
  const span = maxV - minV || 1;

  let pathD = "";
  if (points.length > 0) {
    pathD = points
      .map((p, i) => {
        const x = pad.l + (innerW * i) / Math.max(points.length - 1, 1);
        const v = p[valueKey];
        const y = pad.t + innerH - ((v - minV) / span) * innerH;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }

  if (points.length === 0) {
    return (
      <div className="trend-chart empty">
        <h4>{title}</h4>
        <p>No data points yet.</p>
      </div>
    );
  }

  return (
    <div className="trend-chart">
      <h4>{title}</h4>
      <svg viewBox={`0 0 ${w} ${h}`} className="trend-svg" role="img" aria-label={title}>
        <rect x={pad.l} y={pad.t} width={innerW} height={innerH} fill="#f5f4fa" rx="6" />
        <text x={8} y={pad.t + innerH / 2} className="axis-y" transform={`rotate(-90 8 ${pad.t + innerH / 2})`}>
          {labelY}
        </text>
        <path d={pathD} fill="none" stroke="#6b5b95" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const x = pad.l + (innerW * i) / Math.max(points.length - 1, 1);
          const v = p[valueKey];
          const y = pad.t + innerH - ((v - minV) / span) * innerH;
          return <circle key={p.scanId || i} cx={x} cy={y} r="4" fill="#4a3f8c" />;
        })}
      </svg>
      <div className="trend-legend">
        {points.map((p, i) => (
          <span key={p.scanId || i} className="trend-legend-item">
            {formatDate(p.finishedAt || p.createdAt)}: <strong>{p[valueKey]}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ScanHistory({ token }) {
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [series, setSeries] = useState([]);
  const [seriesMeta, setSeriesMeta] = useState(null);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState("");

  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [compare, setCompare] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/scans/history/recent?limit=200`, {
          headers: getAuthHeaders(token)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load history");
        if (!cancelled) setRecent(data.scans || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function loadSeries(e) {
    e?.preventDefault();
    if (!urlInput.trim()) return;
    setSeriesLoading(true);
    setSeriesError("");
    setSeries([]);
    setSeriesMeta(null);
    try {
      const q = encodeURIComponent(urlInput.trim());
      const res = await fetch(`${API_BASE}/api/scans/history/by-url?url=${q}`, {
        headers: getAuthHeaders(token)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load series");
      setSeries(data.series || []);
      setSeriesMeta({ urlNormalized: data.urlNormalized, urlRequested: data.urlRequested });
    } catch (e) {
      setSeriesError(e.message || "Failed to load");
    } finally {
      setSeriesLoading(false);
    }
  }

  async function runCompare(e) {
    e?.preventDefault();
    if (!beforeId || !afterId) return;
    setCompareLoading(true);
    setCompareError("");
    setCompare(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/scans/compare?before=${encodeURIComponent(beforeId)}&after=${encodeURIComponent(afterId)}`,
        {
          headers: getAuthHeaders(token)
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Compare failed");
      setCompare(data);
    } catch (e) {
      setCompareError(e.message || "Compare failed");
    } finally {
      setCompareLoading(false);
    }
  }

  const chartPoints = useMemo(
    () =>
      series.map((s) => ({
        scanId: s.scanId,
        finishedAt: s.finishedAt,
        createdAt: s.createdAt,
        totalIssues: s.totalIssues,
        healthScore: s.healthScore
      })),
    [series]
  );

  return (
    <main className="scan-history-page">
      <div className="history-header">
        <h1>Analytics &amp; scan history</h1>
        <p className="history-lead">
          Track accessibility over time for each URL, compare two runs, and browse all recent scans.
        </p>
        <Link to="/" className="history-back">
          ← New scan
        </Link>
      </div>

      {loading ? (
        <p>Loading history…</p>
      ) : error ? (
        <p className="history-error">{error}</p>
      ) : null}

      {/* All scans */}
      <section className="history-section card-like">
        <h2>Recent scans</h2>
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>URL</th>
                <th>Status</th>
                <th>Issues</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.scanId}>
                  <td>{formatDate(row.finishedAt || row.createdAt)}</td>
                  <td className="cell-url" title={row.url}>
                    {row.url || "—"}
                  </td>
                  <td>
                    <span className={`status-pill status-${(row.status || "").toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{row.totalIssues}</td>
                  <td>{row.healthScore}% ({row.grade})</td>
                  <td>
                    <Link to={`/scan/${row.scanId}`} className="table-link">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recent.length === 0 && !loading && <p>No scans in the database yet.</p>}
      </section>

      {/* Per-URL trends */}
      <section className="history-section card-like">
        <h2>Issue trends &amp; health for a URL</h2>
        <p className="section-hint">
          Enter the same URL you use when scanning (multiple completed scans will appear as a series).
        </p>
        <form className="url-trend-form" onSubmit={loadSeries}>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="url-input"
          />
          <button type="submit" disabled={seriesLoading}>
            {seriesLoading ? "Loading…" : "Load trends"}
          </button>
        </form>
        {seriesError ? <p className="history-error">{seriesError}</p> : null}
        {seriesMeta ? (
          <p className="series-meta">
            Normalized: <code>{seriesMeta.urlNormalized}</code> · {series.length} scan(s)
          </p>
        ) : null}

        {chartPoints.length > 0 && (
          <div className="charts-row">
            <TrendChart
              title="Total issues over time (lower is better)"
              points={chartPoints}
              valueKey="totalIssues"
              labelY="Issues"
            />
            <TrendChart
              title="Health score over time (higher is better)"
              points={chartPoints}
              valueKey="healthScore"
              labelY="Health %"
            />
          </div>
        )}
      </section>

      {/* Compare */}
      <section className="history-section card-like">
        <h2>Compare two scans (before vs after)</h2>
        <p className="section-hint">Pick an older scan as &quot;before&quot; and a newer one as &quot;after&quot;.</p>
        <form className="compare-form" onSubmit={runCompare}>
          <label>
            Before
            <select value={beforeId} onChange={(e) => setBeforeId(e.target.value)} required>
              <option value="">Select scan</option>
              {recent.map((row) => (
                <option key={`b-${row.scanId}`} value={row.scanId}>
                  {formatDate(row.finishedAt || row.createdAt)} — {row.scanId.slice(0, 8)}… ({row.totalIssues}{" "}
                  issues)
                </option>
              ))}
            </select>
          </label>
          <label>
            After
            <select value={afterId} onChange={(e) => setAfterId(e.target.value)} required>
              <option value="">Select scan</option>
              {recent.map((row) => (
                <option key={`a-${row.scanId}`} value={row.scanId}>
                  {formatDate(row.finishedAt || row.createdAt)} — {row.scanId.slice(0, 8)}… ({row.totalIssues}{" "}
                  issues)
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={compareLoading}>
            {compareLoading ? "Comparing…" : "Compare"}
          </button>
        </form>
        {compareError ? <p className="history-error">{compareError}</p> : null}

        {compare && (
          <div className="compare-grid">
            <div className="compare-card">
              <h3>Before</h3>
              <p className="mono">{compare.before.scanId}</p>
              <p>{compare.before.url}</p>
              <ul>
                <li>Total issues: {compare.before.summary.totalIssues}</li>
                <li>Health: {compare.before.summary.healthScore}%</li>
                <li>Critical: {compare.before.summary.severityDistribution.critical}</li>
                <li>Serious: {compare.before.summary.severityDistribution.serious}</li>
              </ul>
            </div>
            <div className="compare-card compare-delta">
              <h3>Delta</h3>
              <p>{compare.delta.interpretation}</p>
              <ul>
                <li>
                  Total issues:{" "}
                  <strong className={compare.delta.totalIssues <= 0 ? "good" : "bad"}>
                    {compare.delta.totalIssues > 0 ? "+" : ""}
                    {compare.delta.totalIssues}
                  </strong>
                </li>
                <li>
                  Health score:{" "}
                  <strong className={compare.delta.healthScore >= 0 ? "good" : "bad"}>
                    {compare.delta.healthScore > 0 ? "+" : ""}
                    {compare.delta.healthScore}
                  </strong>
                </li>
              </ul>
            </div>
            <div className="compare-card">
              <h3>After</h3>
              <p className="mono">{compare.after.scanId}</p>
              <p>{compare.after.url}</p>
              <ul>
                <li>Total issues: {compare.after.summary.totalIssues}</li>
                <li>Health: {compare.after.summary.healthScore}%</li>
                <li>Critical: {compare.after.summary.severityDistribution.critical}</li>
                <li>Serious: {compare.after.summary.severityDistribution.serious}</li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
