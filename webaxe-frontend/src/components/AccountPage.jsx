import { Link } from "react-router-dom";

export default function AccountPage({ user, onLogout }) {
  const name = user?.name || "WebAxe user";
  const username = user?.username || "Not available";
  const email = user?.email || "Not available";

  return (
    <main className="account-page">
      <section className="account-shell">
        <div className="account-header">
          <p className="account-eyebrow">Account</p>
          <h1>{name}</h1>
          <p className="account-copy">
            Manage your signed-in session and review the account details currently stored in WebAxe.
          </p>
        </div>

        <div className="account-grid">
          <article className="account-card">
            <h2>Profile details</h2>
            <div className="account-row">
              <span>Name</span>
              <strong>{name}</strong>
            </div>
            <div className="account-row">
              <span>Username</span>
              <strong>{username}</strong>
            </div>
            <div className="account-row">
              <span>Email</span>
              <strong>{email}</strong>
            </div>
          </article>

          <article className="account-card">
            <h2>Session</h2>
            <p className="account-copy">
              You can continue scanning from the dashboard or sign out from here when you are done.
            </p>
            <div className="account-actions">
              <Link to="/" className="account-link">
                Back to home
              </Link>
              <button type="button" className="account-logout" onClick={onLogout}>
                Log out
              </button>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
