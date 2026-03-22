import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import "./Hero.css";

export default function Hero({ onScan }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setMsg("Please enter a valid URL.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(`${API_BASE}/api/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await res.json();

      if (!res.ok || !data?.scanId) {
        throw new Error(data?.error || "Unable to start scan.");
      }

      onScan(url.trim());
      localStorage.setItem("scannedUrl", url.trim());
      navigate(`/scan/${data.scanId}`);
    } catch (error) {
      setMsg(error.message || "Failed to start scan. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="hero-container">
      <div className="hero-badge">Accessibility Scanner</div>

      <h1 className="hero-title">
        Is your website legally accessible?
        <span className="highlight">Find out in 60 seconds.</span>
      </h1>

      <p className="hero-desc">
        Run WCAG 2.1 AA & EAA compliance scans instantly with real-time fixes.
      </p>

      <form className="hero-form" onSubmit={handleScan}>
        <input
          type="text"
          placeholder="https://example.com"
          className="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <button className="scan-btn" type="submit" disabled={loading}>
          {loading ? "Scanning…" : "Check Accessibility"}
        </button>
      </form>

      {msg && <div className="msg">{msg}</div>}
      
    </section>
  );
}
