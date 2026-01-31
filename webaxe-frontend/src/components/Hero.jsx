import { useState } from "react";
import "./Hero.css";

export default function Hero({ onScan }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleScan = async (e) => {
    e.preventDefault();

    if (!url.trim()) {
      setMsg("Please enter a valid URL.");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("http://localhost:3000/api/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to queue scan");
      }

      // Notify parent (for footer display etc.)
      onScan(url);

      setMsg("Scan queued successfully 🚀");
      setUrl("");
    } catch (error) {
      setMsg(error.message || "Something went wrong");
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
          disabled={loading}
        />

        <button className="scan-btn" type="submit" disabled={loading}>
          {loading ? "Scanning…" : "Check Accessibility"}
        </button>
      </form>

      {msg && <div className="msg">{msg}</div>}
    </section>
  );
}
