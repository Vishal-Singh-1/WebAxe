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

  const handleScan = async (e) => {
    e.preventDefault();
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
      navigate(`/scan/${data.scanId}`);
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
      <div className="hero-badge">Deep Website Scanner</div>

      <h1 className="hero-title">
        Audit credibility, trust, and compliance
        <span className="highlight">with sector-aware rules in one scan.</span>
      </h1>

      <p className="hero-desc">
        Run sector-aware website audits across security, privacy, accessibility, performance, and trust.
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
          {loading ? "Scanning..." : "Run Deep Scan"}
        </button>
      </form>

      {msg ? <div className="msg">{msg}</div> : null}
    </section>
  );
}
