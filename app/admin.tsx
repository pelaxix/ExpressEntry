import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
type Subscriber = {
  id: string;
  email: string;
  status: string;
  categories: string[];
  created_at: string;
};
type Delivery = {
  id: string;
  draw_id: number;
  status: string;
  email: string;
  sent_at?: string;
  created_at: string;
  error?: string;
};
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false),
    [configured, setConfigured] = useState(true),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false),
    [enabled, setEnabled] = useState(true),
    [emailReady, setEmailReady] = useState(false),
    [subscribers, setSubscribers] = useState<Subscriber[]>([]),
    [history, setHistory] = useState<Delivery[]>([]);
  async function load() {
    const [settings, subs, delivery] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/subscribers"),
      fetch("/api/alert-history"),
    ]);
    if (!settings.ok) {
      setAuthenticated(false);
      return;
    }
    const s = await settings.json();
    setEnabled(s.settings.enabled);
    setEmailReady(s.providers.email);
    setSubscribers((await subs.json()).subscribers);
    setHistory((await delivery.json()).alerts);
    setReady(true);
  }
  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((j) => {
        setConfigured(j.configured);
        setAuthenticated(j.authenticated);
        if (j.authenticated) load().catch((e) => setMessage(e.message));
      })
      .catch(() => setMessage("Could not check administrator access."));
  }, []);
  async function request(path: string, body: unknown) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Request failed.");
    return j;
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await request("/api/login", { password });
      setPassword("");
      setAuthenticated(true);
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, action: string, email: string) {
    if (
      action === "remove" &&
      !window.confirm("Remove " + email + " from draw notifications?")
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      await request("/api/subscribers", { id, action });
      await load();
      setMessage(
        action === "remove"
          ? "Subscriber removed."
          : action === "pause"
            ? "Subscription paused."
            : "Subscription resumed.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle() {
    setBusy(true);
    setMessage("");
    try {
      await request("/api/settings", { enabled: !enabled, categories: [] });
      await load();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function test(id: string) {
    setBusy(true);
    setMessage("");
    try {
      await request("/api/test-alert", { id });
      setMessage("Test email sent.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!authenticated)
    return (
      <section className="settings-panel admin-login">
        <h2>Administrator sign-in</h2>
        <p className="note">Manage subscribers and email delivery.</p>
        {!configured && (
          <p className="notice">
            Administrator access has not been configured on the server.
          </p>
        )}
        <form onSubmit={login}>
          <label className="field">
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={busy || !configured}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {message && (
          <p className="message" role="status">
            {message}
          </p>
        )}
      </section>
    );
  return (
    <div className="admin-content">
      <div className="admin-toolbar">
        <span>
          {subscribers.filter((s) => s.status === "active").length} active ·{" "}
          {subscribers.length} subscribers
        </span>
        <div>
          <button
            className="button"
            onClick={() => load().catch((e) => setMessage(e.message))}
          >
            <RefreshCw size={14} />
            Refresh list
          </button>
          <button
            className="button"
            onClick={async () => {
              await request("/api/logout", {});
              setAuthenticated(false);
              setReady(false);
              setMessage("");
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <div className="delivery-settings">
        <div>
          <h2>Email delivery</h2>
          <p>
            {emailReady
              ? "Brevo connected"
              : "Brevo needs an API key and verified sender on the server"}
          </p>
        </div>
        <button
          className="button"
          disabled={!ready || busy || (!emailReady && !enabled)}
          onClick={toggle}
        >
          {enabled ? "Pause all delivery" : "Resume all delivery"}
        </button>
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Subscribers</h2>
            <p>
              Visitors join from Notifications. Pause or remove addresses here.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="subscriber-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Subscription</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.email}
                    <span className="subline">
                      {s.categories.length
                        ? s.categories.join(", ")
                        : "All categories"}
                    </span>
                  </td>
                  <td>{s.status}</td>
                  <td>{new Date(s.created_at).toLocaleDateString("en-CA")}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() =>
                          action(
                            s.id,
                            s.status === "active" ? "pause" : "resume",
                            s.email,
                          )
                        }
                      >
                        {s.status === "active" ? "Pause" : "Resume"}
                      </button>
                      <button
                        className="text-button"
                        disabled={busy || !emailReady}
                        onClick={() => test(s.id)}
                      >
                        Send test
                      </button>
                      <button
                        className="text-button error-text"
                        disabled={busy}
                        onClick={() => action(s.id, "remove", s.email)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!subscribers.length && (
            <p className="empty">
              No subscribers yet. Use the public Notifications form to join.
            </p>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Recent email delivery</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>#{h.draw_id}</td>
                  <td>{h.email}</td>
                  <td>
                    {h.status}
                    {h.error && <span className="subline">{h.error}</span>}
                  </td>
                  <td>
                    {new Date(h.sent_at || h.created_at).toLocaleString(
                      "en-CA",
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length && <p className="empty">No draw emails yet.</p>}
        </div>
      </section>
    </div>
  );
}
