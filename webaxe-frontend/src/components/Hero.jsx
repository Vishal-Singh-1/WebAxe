import { useState } from "react";
import "./Hero.css";

export default function Hero({ onScan }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleScan = (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setMsg("Please enter a valid URL.");
      return;
    }

    setLoading(true);
    setMsg("");

    // Replace with real backend API call
    setTimeout(() => {
      setLoading(false);
      onScan(url);
      setMsg("Demo scan completed. Connect backend later.");
    }, 1000);
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
