import { useState } from "react";
import { Navigate } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import "./AuthPage.css";

function initialRegisterState() {
  return {
    name: "",
    username: "",
    email: "",
    password: ""
  };
}

export default function AuthPage({ token, onAuthSuccess }) {
  const [mode, setMode] = useState("login");
  const [loginState, setLoginState] = useState({ identifier: "", password: "" });
  const [registerState, setRegisterState] = useState(initialRegisterState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (token) {
    return <Navigate to="/" replace />;
  }

  async function parseJsonResponse(res, fallbackMessage) {
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      return await res.json();
    }

    const text = await res.text();
    throw new Error(`${fallbackMessage} ${text.slice(0, 120)}`.trim());
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? loginState
          : {
              ...registerState,
              name: registerState.name.trim(),
              username: registerState.username.trim(),
              email: registerState.email.trim()
            };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonResponse(res, "Authentication API did not return JSON.");

      if (!res.ok) {
        throw new Error(data?.error || "Authentication failed");
      }

      onAuthSuccess({
        token: data.token,
        user: data.user
      });
    } catch (submitError) {
      setError(submitError.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className={`auth-shell ${mode === "register" ? "register-mode" : ""}`}>
        <section className="auth-hero-panel">
          <div className="auth-brand">
            <div className="auth-brand-icon">A</div>
            <div>
              <h1>WebAxe</h1>
              <p>Secure accessibility scanning for modern teams.</p>
            </div>
          </div>

          <div className="auth-copy">
            <span className="auth-pill">JWT Authentication</span>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Sign in to continue scanning, reviewing reports, and tracking accessibility progress."
                : "Register once to start running scans, opening reports, and saving your workflow."}
            </p>
          </div>

          <div className="auth-switcher">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              Register
            </button>
          </div>
        </section>

        <section className="auth-form-panel">
          <div className="auth-forms-track">
            <form className="auth-form" onSubmit={handleSubmit}>
              <header>
                <h3>Login</h3>
                <p>Use your username or email and password.</p>
              </header>

              <label>
                Username or Email
                <input
                  type="text"
                  value={loginState.identifier}
                  onChange={(event) =>
                    setLoginState((current) => ({ ...current, identifier: event.target.value }))
                  }
                  placeholder="username or email"
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginState.password}
                  onChange={(event) =>
                    setLoginState((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </label>

              {error && mode === "login" ? <p className="auth-error">{error}</p> : null}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && mode === "login" ? "Signing in..." : "Login"}
              </button>
            </form>

            <form className="auth-form" onSubmit={handleSubmit}>
              <header>
                <h3>Register</h3>
                <p>Create your account with the details below.</p>
              </header>

              <label>
                Name
                <input
                  type="text"
                  value={registerState.name}
                  onChange={(event) =>
                    setRegisterState((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Your full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label>
                Username
                <input
                  type="text"
                  value={registerState.username}
                  onChange={(event) =>
                    setRegisterState((current) => ({ ...current, username: event.target.value }))
                  }
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={registerState.email}
                  onChange={(event) =>
                    setRegisterState((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={registerState.password}
                  onChange={(event) =>
                    setRegisterState((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </label>

              {error && mode === "register" ? <p className="auth-error">{error}</p> : null}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading && mode === "register" ? "Creating account..." : "Register"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
