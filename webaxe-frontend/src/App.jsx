import { useState } from "react";
import { Routes, Route, useLocation, Navigate, Link, NavLink } from "react-router-dom";

import ScanResults from "./components/ScanResults";
import ScanHistory from "./components/ScanHistory";
import Hero from "./components/Hero";
import Features from "./components/Features";
import AuthPage from "./components/AuthPage";
import AccountPage from "./components/AccountPage";
import { clearAuth, getStoredAuth, saveAuth } from "./auth";

import "./App.css";
import "./components/AuthPage.css";

const CONTACT_EMAIL = "vishalsingh67864@gamail.com";

const pageContent = {
  wcag: {
    eyebrow: "WCAG standards",
    title: "Understand the accessibility rules teams are expected to meet.",
    intro:
      "WCAG, or Web Content Accessibility Guidelines, is the core accessibility framework used by regulators, procurement teams, and auditors worldwide.",
    cards: [
      {
        title: "Perceivable content",
        body: "Text alternatives, captions, contrast, and adaptable layouts help people access information in different ways."
      },
      {
        title: "Operable experiences",
        body: "Keyboard support, focus visibility, timing controls, and predictable interactions reduce barriers across the interface."
      },
      {
        title: "Understandable patterns",
        body: "Clear labels, helpful errors, and consistent navigation make tasks easier to complete for more users."
      },
      {
        title: "Robust implementation",
        body: "Semantic HTML and valid ARIA help assistive technologies interpret your site correctly."
      }
    ]
  },
  eaa: {
    eyebrow: "EAA readiness",
    title: "Prepare digital products for the European Accessibility Act.",
    intro:
      "The EAA raises the bar for accessible digital products and services in the EU, making accessibility a business requirement instead of an optional enhancement.",
    cards: [
      {
        title: "Broader business impact",
        body: "E-commerce, banking, transport, media, telecom, and self-service platforms can all fall into scope."
      },
      {
        title: "Shared accountability",
        body: "Legal, design, engineering, QA, and product teams all play a role in demonstrating accessibility readiness."
      },
      {
        title: "Evidence matters",
        body: "Clear reports, repeatable scans, and issue history make it easier to show progress over time."
      },
      {
        title: "Earlier fixes cost less",
        body: "Finding accessibility issues before launch reduces remediation cost and compliance stress."
      }
    ]
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Choose a workflow that matches where your compliance program is today.",
    intro:
      "Use WebAxe for quick validation, ongoing scan monitoring, or a more formal reporting workflow as the project grows.",
    cards: [
      {
        title: "Starter",
        body: "$490 per year. Best for smaller sites that need scheduled checks, core WCAG coverage, and a lightweight compliance baseline."
      },
      {
        title: "Growth",
        body: "$990 per year. Designed for recurring scans, scan history, issue tracking, and reporting across a growing website."
      },
      {
        title: "Scale",
        body: "$2,990 per year. Better for larger estates that need deeper monitoring, stronger documentation, and broader compliance visibility."
      },
      {
        title: "Enterprise",
        body: "Custom pricing. For complex websites, large page counts, and teams that need managed accessibility support."
      }
    ]
  },
  about: {
    eyebrow: "About WebAxe",
    title: "WebAxe helps teams reduce accessibility risk with simple, readable scanning workflows.",
    intro:
      "This project focuses on giving website owners a practical way to audit accessibility, understand standards like WCAG and EAA, and act on issues before they become expensive.",
    cards: [
      {
        title: "Compliance-first messaging",
        body: "The UI is designed to explain why accessibility matters, not just list technical checks."
      },
      {
        title: "Deep scanning workflow",
        body: "Users can run scans, inspect reports, and revisit historical results from the same product."
      },
      {
        title: "Project direction",
        body: "The goal is to keep improving clarity, trust, and usefulness for accessibility-focused teams."
      }
    ]
  }
};

const complianceAreas = [
  "Government and public sector websites",
  "E-commerce and online marketplaces",
  "Banking, fintech, and payment flows",
  "Healthcare and patient service portals",
  "Education platforms and admissions portals",
  "Transport, travel, and booking systems"
];

function ProtectedRoute({ token, children }) {
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function PageHero({ eyebrow, title, intro }) {
  return (
    <section className="page-hero">
      <p className="page-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-intro">{intro}</p>
    </section>
  );
}

function InsightGrid({ items }) {
  return (
    <div className="info-grid">
      {items.map((item) => (
        <article className="info-card" key={item.title}>
          <h3>{item.title}</h3>
          <p>{item.body}</p>
        </article>
      ))}
    </div>
  );
}

function MarketingPage({ pageKey }) {
  const page = pageContent[pageKey];

  return (
    <main className="marketing-main">
      <PageHero eyebrow={page.eyebrow} title={page.title} intro={page.intro} />

      <section className="info-section">
        <h2>Key takeaways</h2>
        <InsightGrid items={page.cards} />
      </section>
    </main>
  );
}

function Footer({ lastUrl }) {
  return (
    <footer className="footer">
      <div>
        <strong>WebAxe</strong> helps teams scan for accessibility risk with a cleaner compliance-first workflow.
      </div>
      <div>
        Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </div>
      {lastUrl ? <div className="last-scan">Last scanned: {lastUrl}</div> : null}
    </footer>
  );
}

function HomeSections({ lastUrl, onScan, token }) {
  return (
    <>
      <main className="marketing-main">
        <Hero onScan={onScan} token={token} />
        <Features />

        <section className="info-section split-section">
          <div>
            <p className="section-label">What are WCAG and EAA</p>
            <h2>Know the standards behind digital accessibility compliance.</h2>
          </div>
          <div className="split-card-group">
            <article className="info-card split-info-card">
              <h3>What is WCAG</h3>
              <p>
                WCAG defines how digital experiences should work for people with disabilities and is the benchmark used in audits and legal reviews.
              </p>
            </article>
            <article className="info-card split-info-card">
              <h3>What is EAA</h3>
              <p>
                The European Accessibility Act turns accessibility expectations into legal obligations for many digital products and services in the EU market.
              </p>
            </article>
          </div>
        </section>

        <section className="info-section cost-section">
          <p className="section-label">High cost of non-compliance</p>
          <h2>Non-compliance gets expensive fast.</h2>
          <div className="info-grid">
            <article className="info-card emphasis-card">
              <h3>Legal exposure</h3>
              <p>Complaints, enforcement action, and procurement blockers can slow business growth.</p>
            </article>
            <article className="info-card emphasis-card">
              <h3>Revenue loss</h3>
              <p>Inaccessible journeys create drop-off in checkout, onboarding, and key conversion flows.</p>
            </article>
            <article className="info-card emphasis-card">
              <h3>Brand trust impact</h3>
              <p>Poor accessibility signals weak product quality and can damage customer confidence.</p>
            </article>
          </div>
        </section>

        <section className="info-section">
          <p className="section-label">Where is compliance required</p>
          <h2>Where compliance is required.</h2>
          <div className="compliance-list">
            {complianceAreas.map((item) => (
              <article className="compliance-pill" key={item}>
                {item}
              </article>
            ))}
          </div>
        </section>
      </main>

      <Footer lastUrl={lastUrl} />
    </>
  );
}

export default function App() {
  const [lastUrl, setLastUrl] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [auth, setAuth] = useState(() => getStoredAuth());

  const location = useLocation();
  const isAuthPage = location.pathname.startsWith("/auth");

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
              <div className="logo-icon">
                <span className="logo-glyph">W</span>
              </div>
              <span id="app-name">WebAxe</span>
            </Link>

            <nav className="nav-links" aria-label="Primary navigation">
              <NavLink to="/history" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                History
              </NavLink>
              <NavLink to="/wcag" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                WCAG
              </NavLink>
              <NavLink to="/eaa" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                EAA
              </NavLink>
              <NavLink to="/pricing" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                Pricing
              </NavLink>
              <NavLink to="/about" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                About
              </NavLink>
              {!auth.token ? (
                <NavLink to="/auth" className={({ isActive }) => `get-started${isActive ? " active-nav" : ""}`}>
                  Login
                </NavLink>
              ) : (
                <NavLink to="/account" className={({ isActive }) => (isActive ? "active-nav" : "")}>
                  Account
                </NavLink>
              )}

              <button
                className={`hamburger ${menuOpen ? "active" : ""}`}
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="Menu"
                aria-expanded={menuOpen}
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
          <div className={`menu-overlay ${menuOpen ? "show" : ""}`} onClick={closeMenu}></div>

          <div className={`menu-panel ${menuOpen ? "open" : ""}`}>
            <button className="menu-close" onClick={closeMenu} aria-label="Close menu">
              x
            </button>

            <Link to="/" onClick={closeMenu}>
              Home
            </Link>
            <Link to="/history" onClick={closeMenu}>
              History
            </Link>
            {auth.token ? (
              <Link to="/account" onClick={closeMenu}>
                Account
              </Link>
            ) : (
              <Link to="/auth" onClick={closeMenu}>
                Login
              </Link>
            )}
          </div>
        </>
      ) : null}

      <Routes>
        <Route path="/auth" element={<AuthPage token={auth.token} onAuthSuccess={handleAuthSuccess} />} />
        <Route path="/" element={<HomeSections lastUrl={lastUrl} onScan={(url) => setLastUrl(url)} token={auth.token} />} />
        <Route path="/wcag" element={<MarketingPage pageKey="wcag" />} />
        <Route path="/eaa" element={<MarketingPage pageKey="eaa" />} />
        <Route path="/pricing" element={<MarketingPage pageKey="pricing" />} />
        <Route path="/about" element={<MarketingPage pageKey="about" />} />
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
