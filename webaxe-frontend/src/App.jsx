import { useEffect, useState } from "react";
import { Routes, Route, useLocation, Navigate, Link } from "react-router-dom";

import ScanResults from "./components/ScanResults";
import ScanHistory from "./components/ScanHistory";
import Hero from "./components/Hero";
import Features from "./components/Features";
import AuthPage from "./components/AuthPage";
import AccountPage from "./components/AccountPage";
import { clearAuth, getStoredAuth, saveAuth } from "./auth";

import "./App.css";
import "./components/AuthPage.css";

function ProtectedRoute({ token, children }) {
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function HomeSections({ lastUrl, onScan, token }) {
  return (
    <>
      <main>
        <Hero onScan={onScan} token={token} />
        <Features />

        <section id="wcag" className="info-section">
          <h2>WCAG Coverage</h2>
          <p>
            WebAxe checks high-impact accessibility issues across landmarks, labels, color
            contrast, ARIA, semantics, and other common WCAG 2.1 AA requirements.
          </p>
          <div className="info-grid">
            <article className="info-card">
              <h3>Automated checks</h3>
              <p>Run browser-based audits against real pages using the same scan flow every time.</p>
            </article>
            <article className="info-card">
              <h3>Readable reports</h3>
              <p>Review scorecards, severity splits, artifacts, and issue-level details in one place.</p>
            </article>
            <article className="info-card">
              <h3>Repeatable progress</h3>
              <p>Track whether accessibility is getting better over time instead of treating scans as one-off snapshots.</p>
            </article>
          </div>
        </section>

        <section id="eaa" className="info-section alt">
          <h2>EAA Readiness</h2>
          <p>
            WebAxe helps surface accessibility problems early so teams can move toward EAA and
            broader accessibility compliance with less guesswork.
          </p>
          <div className="info-grid">
            <article className="info-card">
              <h3>Find legal risk</h3>
              <p>Spot issues that create poor experiences and can become compliance pain later.</p>
            </article>
            <article className="info-card">
              <h3>Share findings clearly</h3>
              <p>Use screenshots, raw artifacts, and summaries to explain problems to others faster.</p>
            </article>
            <article className="info-card">
              <h3>Support remediation</h3>
              <p>Turn scans into concrete fixes with structured issue cards and suggestion flows.</p>
            </article>
          </div>
        </section>

        <section id="about">
          <h2>About WebAxe</h2>
          <p>
            WebAxe is a web-based accessibility scanning tool developed as a college project. It
            helps website owners check whether their websites follow accessibility guidelines such
            as WCAG 2.1 and EAA.
          </p>
          <p>
            The goal of this project is to spread awareness about digital accessibility and help
            developers build inclusive web applications.
          </p>
        </section>

        <section id="how-it-works">
          <h2>How It Works</h2>
          <ol>
            <li>User enters the website URL.</li>
            <li>The system scans the website using accessibility rules.</li>
            <li>Accessibility issues are detected and reported.</li>
            <li>User receives suggestions to improve accessibility.</li>
          </ol>
        </section>

        <section id="pricing" className="info-section">
          <h2>Pricing</h2>
          <p>
            WebAxe is positioned as a flexible project you can use for quick scans today and expand
            into richer reporting or team workflows later.
          </p>
          <div className="info-grid pricing-grid">
            <article className="info-card">
              <h3>Starter</h3>
              <p className="price-tag">Free</p>
              <p>Run scans, inspect issues, open artifacts, and review report summaries.</p>
            </article>
            <article className="info-card featured-plan">
              <h3>Growth</h3>
              <p className="price-tag">Best for repeat scans</p>
              <p>Use history, dynamic reports, and suggestions to improve accessibility over time.</p>
            </article>
            <article className="info-card">
              <h3>Team</h3>
              <p className="price-tag">Custom</p>
              <p>Adapt the project for demos, internal tooling, or a more polished workflow.</p>
            </article>
          </div>
        </section>

        <section id="contact" className="info-section alt">
          <h2>Contact</h2>
          <p>
            Want to try a scan right now or review historical reports? Use the actions below to
            jump straight into the working parts of the app.
          </p>
          <div className="contact-actions">
            <Link to="/#hero" className="contact-btn primary-link">Start a new scan</Link>
            <Link to="/history" className="contact-btn">Open scan history</Link>
          </div>
        </section>

        <section id="more" className="info-section">
          <h2>More Features</h2>
          <p>
            The project now includes dynamic score visuals, artifacts, suggestions, and scan-history
            graphs so the reports page feels more complete and usable.
          </p>
          <div className="info-grid">
            <article className="info-card">
              <h3>Artifacts</h3>
              <p>Open raw JSON and screenshots captured during each completed scan.</p>
            </article>
            <article className="info-card">
              <h3>Analytics</h3>
              <p>Use history views and trends to compare scores across repeated scans.</p>
            </article>
            <article className="info-card">
              <h3>Suggestions</h3>
              <p>Review remediation guidance side-by-side with the underlying accessibility findings.</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} WebAxe - Built for accessibility scanning
        {lastUrl ? <span className="last-scan"> | Last scanned: {lastUrl}</span> : null}
      </footer>
    </>
  );
}

export default function App() {
  const [lastUrl, setLastUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState(() => getStoredAuth());

  const location = useLocation();
  const isScanPage =
    location.pathname.startsWith("/scan") || location.pathname.startsWith("/history");
  const isAuthPage = location.pathname.startsWith("/auth");

  useEffect(() => {
    if (location.pathname !== "/") return;

    if (!location.hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const id = location.hash.slice(1);
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);

    return () => clearTimeout(timer);
  }, [location]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function handleAuthSuccess(nextAuth) {
    saveAuth(nextAuth);
    setAuth(nextAuth);
  }

  function handleLogout() {
    clearAuth();
    setAuth({ token: "", user: null });
    closeMenu();
  }

  return (
    <div className="app-container">
      {!isAuthPage ? (
        <header className="header">
          <div className="header-inner">
            <Link to="/" className="logo" onClick={closeMenu}>
              <div className="logo-icon">A</div>
              <span id="app-name">WebAxe</span>
            </Link>

            <nav className="nav-links">
              <Link to="/history">History</Link>
              <Link to="/#wcag">WCAG</Link>
              <Link to="/#eaa">EAA</Link>
              <Link to="/#pricing">Pricing</Link>
              {!auth.token ? (
                <Link to="/auth" className="get-started">Login</Link>
              ) : null}

              <button
                className={`hamburger ${menuOpen ? "active" : ""}`}
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            </nav>
          </div>
        </header>
      ) : null}

      {!isAuthPage ? (
        <>
          <div
            className={`menu-overlay ${menuOpen ? "show" : ""}`}
            onClick={closeMenu}
          ></div>

          <div className={`menu-panel ${menuOpen ? "open" : ""}`}>
            <button
              className="menu-close"
              onClick={closeMenu}
              aria-label="Close menu"
            >
              x
            </button>

            <Link to="/" onClick={closeMenu}>Home</Link>
            <Link to="/history" onClick={closeMenu}>History</Link>
            <Link to="/#about" onClick={closeMenu}>About</Link>
            <Link to="/#wcag" onClick={closeMenu}>WCAG</Link>
            <Link to="/#eaa" onClick={closeMenu}>EAA</Link>
            <Link to="/#pricing" onClick={closeMenu}>Pricing</Link>
            <Link to="/#contact" onClick={closeMenu}>Contact</Link>
            <Link to="/#more" onClick={closeMenu}>More</Link>
            {auth.token ? (
              <Link to="/account" onClick={closeMenu}>Account</Link>
            ) : (
              <Link to="/auth" onClick={closeMenu}>Login</Link>
            )}
          </div>
        </>
      ) : null}

      <Routes>
        <Route
          path="/auth"
          element={<AuthPage token={auth.token} onAuthSuccess={handleAuthSuccess} />}
        />
        <Route
          path="/"
          element={
            <ProtectedRoute token={auth.token}>
              <HomeSections lastUrl={lastUrl} onScan={(url) => setLastUrl(url)} token={auth.token} />
            </ProtectedRoute>
          }
        />
        <Route path="/scan" element={<Navigate to="/" />} />
        <Route
          path="/scan/:scanId"
          element={
            <ProtectedRoute token={auth.token}>
              <ScanResults token={auth.token} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute token={auth.token}>
              <ScanHistory token={auth.token} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account"
          element={
            <ProtectedRoute token={auth.token}>
              <AccountPage user={auth.user} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={auth.token ? "/" : "/auth"} />} />
      </Routes>
    </div>
  );
}
