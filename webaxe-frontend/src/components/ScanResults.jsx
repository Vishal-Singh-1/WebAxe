import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./ScanResults.css";

export default function ScanResults() {

const { scanId } = useParams();

const [report, setReport] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function fetchReport() {
try {


    const res = await fetch(`http://localhost:3000/api/scans/${scanId}`);
    const data = await res.json();

    setReport(data);
    setLoading(false);

  } catch (err) {
    console.error("Failed to fetch scan result:", err);
    setLoading(false);
  }
}

fetchReport();


}, [scanId]);

if (loading) {
return <div className="dashboard">Loading scan results...</div>;
}

if (!report) {
return <div className="dashboard">No report found</div>;
}

const { summary, issues, url, timings } = report;

return ( <div className="dashboard">

```
  {/* TOP CARDS */}

  <div className="top-cards">

    {/* OVERVIEW CARD */}

    <div className="card overview">

      <h3>Overview</h3>

      <p className="site">{url}</p>

      <div className="circle-wrap">

        <div className="circle">
          <span>{summary.healthScore}%</span>
        </div>

        <div className="overview-info">

          <div className="grade">
            Grade: {summary.grade}
          </div>

          <p>Total Issues: {summary.totalIssues}</p>

          <p>
            Scan Duration: {Math.round(timings.durationMs / 1000)}s
          </p>

          <p>
            Last Scan: {new Date(timings.finishedAt).toLocaleDateString()}
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
          Critical — {summary.severityDistribution.critical}
        </li>

        <li>
          <span className="dot serious"></span>
          Serious — {summary.severityDistribution.serious}
        </li>

        <li>
          <span className="dot moderate"></span>
          Moderate — {summary.severityDistribution.moderate}
        </li>

        <li>
          <span className="dot minor"></span>
          Minor — {summary.severityDistribution.minor}
        </li>

      </ul>

    </div>

  </div>


  {/* ISSUES LIST */}

  <div className="card issues">

    <h3>Issues List</h3>

    {issues.map((issue, index) => (

      <div className="issue-card" key={index}>

        <div className="issue-top">

          <div>

            <strong>{issue.id}</strong>

            <span className={`badge ${issue.impact}`}>
              {issue.impact}
            </span>

            {issue.wcag.level && (
              <span className="wcag">
                WCAG: {issue.wcag.level}
              </span>
            )}

          </div>

          <label className="switch">
            <input type="checkbox"/>
            <span className="slider"></span>
          </label>

        </div>

        <div className="issue-middle">

          <span>{issue.elementsAffected} elements</span>

          <p>{issue.description}</p>

        </div>

        <div className="issue-actions">

          <button className="btn primary">
            View elements
          </button>

          {issue.helpUrl && (
            <a
              href={issue.helpUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
            >
              Learn more
            </a>
          )}

        </div>

      </div>

    ))}

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
          <strong>{summary.healthScore}%</strong>
        </div>

      </div>

    </div>

  </div>

</div>

);
}
