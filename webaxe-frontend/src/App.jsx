import { useState } from "react";
import Hero from "./components/Hero";
import Features from "./components/Features";
import "./App.css";

export default function App() {
  const [lastUrl, setLastUrl] = useState("");

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">A</div>
            <span>WebAxe</span>
          </div>

          <nav className="nav-links">
            <a href="#wcag">WCAG</a>
            <a href="#eaa">EAA</a>
            <a href="#pricing">Pricing</a>
            <button className="get-started">Get Started</button>
          </nav>
        </div>
      </header>

      <main>
        <Hero onScan={(url) => setLastUrl(url)} />
        <Features />
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} WebAxe — Built for accessibility scanning  
        {lastUrl && (
          <span className="last-scan"> | Last scanned: {lastUrl}</span>
        )}
      </footer>
    </div>
  );
}
