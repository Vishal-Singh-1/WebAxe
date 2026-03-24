import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import { getAuthHeaders } from "../auth.js";
import "./Hero.css";

const SECTOR_OPTIONS = [
  { value: "general", label: "General website" },
  { value: "kids", label: "Kids website" },
  { value: "healthcare", label: "Healthcare" },
  { value: "government", label: "Government" },
  { value: "ecommerce", label: "E-commerce" }
];

const SCAN_POLL_INTERVAL_MS = 3000;
const SCAN_POLL_MAX_ATTEMPTS = 60;

export default function Hero({ onScan, token }) {
  const [url, setUrl] = useState("");
  const [sector, setSector] = useState("general");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  async function parseJsonResponse(res, fallbackMessage) {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await res.json();
    }

    const text = await res.text();
    throw new Error(`${fallbackMessage} ${text.slice(0, 120)}`.trim());
  }

  async function waitForScanCompletion(scanId) {
    for (let attempt = 0; attempt < SCAN_POLL_MAX_ATTEMPTS; attempt += 1) {
      const res = await fetch(`${API_BASE}/api/scans/${scanId}/status`, {
        headers: getAuthHeaders(token)
      });
      const data = await parseJsonResponse(res, "Scan status API did not return JSON.");

      if (!res.ok) {
        throw new Error(data?.error || "Unable to check scan status.");
      }

      const status = String(data?.status || "").toLowerCase();
      if (status === "completed" || status === "failed") {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, SCAN_POLL_INTERVAL_MS));
    }

    return "timeout";
  }

  const handleScan = async (e) => {
    e.preventDefault();
    if (!token) {
      navigate("/auth");
      return;
    }

    if (!url.trim()) {
      setMsg("Please enter a valid URL.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res;

      try {
        res = await fetch(`${API_BASE}/api/scans`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(token)
          },
          body: JSON.stringify({ url: url.trim(), sector }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await parseJsonResponse(res, "Scan API did not return JSON.");

      if (!res.ok || !data?.scanId) {
        throw new Error(data?.error || "Unable to start scan.");
      }

      onScan(url.trim());
      localStorage.setItem("scannedUrl", url.trim());
      setMsg("Scan started. Staying on the homepage until the report is ready...");

      const finalStatus = await waitForScanCompletion(data.scanId);

      if (finalStatus === "completed") {
        navigate(`/scan/${data.scanId}`);
        return;
      }

      if (finalStatus === "failed") {
        setMsg("Scan failed before the report was ready. You can review it later from History.");
        return;
      }

      setMsg("The scan is taking longer than expected. You can check its progress later from History.");
    } catch (error) {
      if (error.name === "AbortError") {
        setMsg("Starting the scan took too long. Please check that the backend is running and try again.");
      } else {
        setMsg(error.message || "Failed to start scan. Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hero-container" id="hero">
      <div className="hero-badge">Accessibility Compliance Platform</div>

      <h1 className="hero-title">
        Beyond scanning - into real accessibility.
      </h1>

      <p className="hero-desc">
        Review legal compliance risk, run deep accessibility scans, and move from raw issues to a clearer remediation plan.
      </p>

      <form className="hero-form" onSubmit={handleScan}>
        <input
          type="text"
          placeholder="https://example.com"
          className="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <select
          className="sector-select"
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          aria-label="Website sector"
        >
          {SECTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button className="scan-btn" type="submit" disabled={loading}>
          {loading ? "Scanning..." : token ? "Scan" : "Login to Start"}
        </button>
      </form>

      {msg ? <div className="msg">{msg}</div> : null}
    </section>
  );
}
