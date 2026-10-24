import { drawEmail } from "../lib/email.mjs";
import { useState } from "react";
import { ArrowRight, Bell, Check } from "lucide-react";
import type { Draw } from "../lib/ircc";
export default function Notifications({
  latest,
  categories,
  checkedAt,
  interval,
}: {
  latest?: Draw;
  categories: string[];
  checkedAt?: string;
  interval: number;
}) {
  const [email, setEmail] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  const previewEmail = latest ? drawEmail({draw: latest, publicUrl: window.location.origin, preview: true}) : null;
  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, categories: selected }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not subscribe.");
      setMessage(j.message);
      setError(false);
      setEmail("");
    } catch (e) {
      setMessage((e as Error).message);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-layout">
      <div className="settings-intro">
        <h2>Know when the next draw lands</h2>
        <p>
          Get the category, CRS cutoff and invitation count by email. No account
          or password needed.
        </p>
        {latest && (
          <div className="email-preview">
            <p className="preview-label">
              Actual email layout · Latest published round
            </p>
            <p className="email-preview-subject"><strong>Subject:</strong> {previewEmail?.subject}</p>
            <iframe
              title="Preview of draw notification email"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={previewEmail?.htmlContent}
            />
          </div>
        )}
        <p className="note">
          IRCC is checked every {interval} minutes.{" "}
          {checkedAt
            ? "Last check: " + new Date(checkedAt).toLocaleString("en-CA") + "."
            : ""}
        </p>
      </div>
      <section className="settings-panel">
        <h2>Email me new draws</h2>
        <form onSubmit={subscribe}>
          <label className="field">
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <details className="category-options">
            <summary>
              {selected.length
                ? selected.length + " selected categories"
                : "All draw categories"}{" "}
              · Change
            </summary>
            <p className="note">
              Leave every category unchecked to receive all draws.
            </p>
            <div className="category-checks">
              {categories.map((c) => (
                <label className="check-row" key={c}>
                  <input
                    type="checkbox"
                    checked={selected.includes(c)}
                    onChange={() =>
                      setSelected(
                        selected.includes(c)
                          ? selected.filter((v) => v !== c)
                          : [...selected, c],
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </details>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Subscribing…" : "Subscribe to draw alerts"}
            <ArrowRight size={15} />
          </button>
          <p className="note">
            By subscribing, you request new draw alerts at this address,
            delivered through Brevo. Unsubscribe any time. Read our{" "}
            <a href="/privacy">Privacy policy</a>, including email tracking and retention.
          </p>
          {message && (
            <p
              className={error ? "message error-text" : "message"}
              role={error ? "alert" : "status"}
            >
              {message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
export function Unsubscribe({ token }: { token: string }) {
  const [done, setDone] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    setBusy(true);
    try {
      const r = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-panel unsubscribe-panel">
      <h2>{done ? "You’re unsubscribed" : "Unsubscribe from draw alerts?"}</h2>
      <p className="note">
        {done
          ? "You will no longer receive new draw emails."
          : "Confirm below to stop receiving Express Entry draw emails."}
      </p>
      {!done && (
        <button className="button primary" disabled={busy} onClick={remove}>
          {busy ? "Updating…" : "Unsubscribe"}
        </button>
      )}
      {error && (
        <p className="message error-text" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
