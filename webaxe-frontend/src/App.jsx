import { useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ScanResults from "./components/ScanResults";
import Hero from "./components/Hero";
import Features from "./components/Features";
import "./App.css";

export default function App() {

const [lastUrl, setLastUrl] = useState("");
const [menuOpen, setMenuOpen] = useState(false);

const location = useLocation();
const isScanPage = location.pathname.startsWith("/scan");

return ( <div className="app-container">

```
  {/* HEADER */}
  <header className="header">
    <div className="header-inner">

      <div className="logo">
        <div className="logo-icon">A</div>
        <span id="app-name">WebAxe</span>
      </div>

      <nav className="nav-links">
        <a href="#wcag">WCAG</a>
        <a href="#eaa">EAA</a>
        <a href="#pricing">Pricing</a>
        <button className="get-started">Get Started</button>

        <button
          className={`hamburger ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

      </nav>
    </div>
  </header>

  {/* OVERLAY */}
  <div
    className={`menu-overlay ${menuOpen ? "show" : ""}`}
    onClick={() => setMenuOpen(false)}
  ></div>

  {/* RIGHT MENU */}
  <div className={`menu-panel ${menuOpen ? "open" : ""}`}>

    <button
      className="menu-close"
      onClick={() => setMenuOpen(false)}
      aria-label="Close menu"
    >
      ✕
    </button>

    <a href="#home" onClick={() => setMenuOpen(false)}>Home</a>
    <a href="#about" onClick={() => setMenuOpen(false)}>About</a>
    <a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
    <a href="#more" onClick={() => setMenuOpen(false)}>More</a>

  </div>

  {/* ROUTES */}
  <Routes>

    {/* HOME PAGE */}
    <Route
      path="/"
      element={
        <main>
          <Hero onScan={(url) => setLastUrl(url)} />
          <Features />
        </main>
      }
    />

    {/* SCAN RESULTS PAGE */}
    <Route
      path="/scan/:scanId"
      element={<ScanResults />}
    />

  </Routes>

  {/* ABOUT */}
  {!isScanPage && (
    <section id="about">
      <h2>About WebAxe</h2>
      <p>
        WebAxe is a web-based accessibility scanning tool developed as a
        college project. It helps website owners check whether their
        websites follow accessibility guidelines such as WCAG 2.1 and EAA.
      </p>
      <p>
        The goal of this project is to spread awareness about digital
        accessibility and help developers build inclusive web applications.
      </p>
    </section>
  )}

  {/* HOW IT WORKS */}
  {!isScanPage && (
    <section id="how-it-works">
      <h2>How It Works</h2>
      <ol>
        <li>User enters the website URL.</li>
        <li>The system scans the website using accessibility rules.</li>
        <li>Accessibility issues are detected and reported.</li>
        <li>User receives suggestions to improve accessibility.</li>
      </ol>
    </section>
  )}

  {/* FOOTER */}
  {!isScanPage && (
    <footer className="footer">
      © {new Date().getFullYear()} WebAxe — Built for accessibility scanning

      {lastUrl && (
        <span className="last-scan">
          {" "} | Last scanned: {lastUrl}
        </span>
      )}

    </footer>
  )}

</div>


);
}
