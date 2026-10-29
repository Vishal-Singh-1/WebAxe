import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../apiBase.js";
import { getAuthHeaders } from "../auth.js";
import "./ScanHistory.css";

function asLocalInputValue(value) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultStartTime() {
  const value = new Date(Date.now() + 10 * 60 * 1000);
  value.setSeconds(0, 0);
  value.setMinutes(Math.ceil(value.getMinutes() / 5) * 5);
  return asLocalInputValue(value);
}

function defaultEndTime(startValue) {
  const value = new Date(startValue);
  value.setDate(value.getDate() + 7);
  return asLocalInputValue(value);
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function scheduleDescription(schedule) {
  if (schedule.completedAt) {
    if (!schedule.lastEnqueuedAt) return "Schedule ended before a scan could be queued.";
    return `${schedule.scheduleType === "once" ? "One-time scan queued" : "Schedule ended"} · last scan queued ${formatDate(schedule.lastEnqueuedAt)}`;
  }
  if (schedule.scheduleType === "once") return `One-time scan · scheduled ${formatDate(schedule.nextRunAt)}`;
  const frequency = schedule.intervalHours === 24
    ? "Daily"
    : schedule.intervalHours === 168
      ? "Weekly"
      : `Every ${schedule.intervalHours} hours`;
  return `${frequency} · next run ${formatDate(schedule.nextRunAt)}${schedule.endsAt ? ` · until ${formatDate(schedule.endsAt)}` : " · no end date"}`;
}

export default function ScheduledScans({ token }) {
  const [schedules, setSchedules] = useState([]);
  const [url, setUrl] = useState("");
  const [scheduleType, setScheduleType] = useState("once");
  const [intervalHours, setIntervalHours] = useState("24");
  const [customIntervalHours, setCustomIntervalHours] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStartTime);
  const [endsAt, setEndsAt] = useState(() => defaultEndTime(defaultStartTime()));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSchedules() {
    const response = await fetch(`${API_BASE}/api/schedules`, {
      headers: getAuthHeaders(token)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load schedules.");
    setSchedules(data.schedules || []);
  }

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    fetch(`${API_BASE}/api/schedules`, { headers: getAuthHeaders(token) })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Could not load schedules.");
        if (active) setSchedules(data.schedules || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load schedules.");
      });
    return () => { active = false; };
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify({
          url: url.trim(),
          scheduleType,
          ...(scheduleType === "recurring" ? {
            intervalHours: Number(intervalHours === "custom" ? customIntervalHours : intervalHours),
            endsAt: new Date(endsAt).toISOString()
          } : {}),
          startsAt: new Date(startsAt).toISOString(),
          sector: "general"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not create schedule.");
      setUrl("");
      const nextStart = defaultStartTime();
      setStartsAt(nextStart);
      setEndsAt(defaultEndTime(nextStart));
      setMessage(scheduleType === "once" ? "One-time scan scheduled." : "Recurring scan schedule created.");
      await loadSchedules();
    } catch (err) {
      setError(err.message || "Could not create schedule.");
    } finally {
      setLoading(false);
    }
  }

  async function updateSchedule(schedule, patch) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/schedules/${schedule.scheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders(token) },
        body: JSON.stringify(patch)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not update schedule.");
      await loadSchedules();
    } catch (err) {
      setError(err.message || "Could not update schedule.");
    }
  }

  async function deleteSchedule(schedule) {
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/schedules/${schedule.scheduleId}`, {
        method: "DELETE",
        headers: getAuthHeaders(token)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not delete schedule.");
      await loadSchedules();
    } catch (err) {
      setError(err.message || "Could not delete schedule.");
    }
  }

  if (!token) {
    return (
      <section className="history-section card-like scheduled-scans" id="scheduled-scans">
        <h2>Schedule automated scans</h2>
        <p className="section-hint">Choose a one-time scan or repeat scans over a date range. Sign in to create and manage schedules.</p>
        <Link className="schedule-login-link" to="/auth">Sign in to schedule a scan</Link>
      </section>
    );
  }

  return (
    <section className="history-section card-like scheduled-scans" id="scheduled-scans">
      <h2>Schedule automated scans</h2>
      <p className="section-hint">Run a scan once at a chosen time, or repeat it on a schedule until your selected end date.</p>
      <form className="schedule-form" onSubmit={submit}>
        <label>
          Website URL
          <input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
        </label>
        <label>
          Schedule type
          <select value={scheduleType} onChange={(event) => setScheduleType(event.target.value)}>
            <option value="once">One-time scan</option>
            <option value="recurring">Repeat scans</option>
          </select>
        </label>
        {scheduleType === "recurring" ? (
          <>
            <label>
              Repeat every
              <select value={intervalHours} onChange={(event) => setIntervalHours(event.target.value)}>
                <option value="12">12 hours</option>
                <option value="24">1 day</option>
                <option value="168">1 week</option>
                <option value="custom">Custom hours…</option>
              </select>
            </label>
            {intervalHours === "custom" ? (
              <label>
                Interval in hours
                <input type="number" required min="1" max="720" step="1" value={customIntervalHours} onChange={(event) => setCustomIntervalHours(event.target.value)} placeholder="1–720" />
              </label>
            ) : null}
          </>
        ) : null}
        <label>
          {scheduleType === "once" ? "Run at" : "First run"}
          <input type="datetime-local" required min={defaultStartTime()} value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </label>
        {scheduleType === "recurring" ? (
          <label>
            Repeat until
            <input type="datetime-local" required min={startsAt} value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </label>
        ) : null}
        <button type="submit" disabled={loading}>{loading ? "Saving…" : scheduleType === "once" ? "Schedule one scan" : "Create recurring schedule"}</button>
      </form>
      {message && <p className="schedule-message" role="status">{message}</p>}
      {error && <p className="history-error" role="alert">{error}</p>}
      {schedules.length ? (
        <ul className="schedule-list">
          {schedules.map((schedule) => (
            <li key={schedule.scheduleId}>
              <div>
                <strong>{schedule.url}</strong>
                <span>{scheduleDescription(schedule)}</span>
                {!schedule.active && !schedule.completedAt ? <span>Paused</span> : null}
              </div>
              <div className="schedule-actions">
                {!schedule.completedAt ? (
                  <button type="button" onClick={() => updateSchedule(schedule, { active: !schedule.active })}>
                    {schedule.active ? "Pause" : "Resume"}
                  </button>
                ) : null}
                <button type="button" className="schedule-delete" onClick={() => deleteSchedule(schedule)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      ) : !error ? <p className="section-hint">No automated scans scheduled yet.</p> : null}
    </section>
  );
}
