import { randomBytes } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { appendFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { backup } from "node:sqlite";
import { normalize, poolValid, SOURCE } from "../lib/ircc.ts";
const bundled = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../lib/data/ircc-snapshot.json.gz", import.meta.url)),
  ).toString("utf8"),
);
export const DEFAULT_SETTINGS = { enabled: true, categories: [] };
export function createTracker(store, config, { fetchImpl = fetch } = {}) {
  let active = null;
  let lastBackup = "";
  const settings = () => ({ ...DEFAULT_SETTINGS, ...store.read("settings") });
  function subscribe(email, categories = []) {
    const normalized = email.trim().toLowerCase();
    const existing = store.db
      .prepare("SELECT id FROM subscribers WHERE email=?")
      .get(normalized);
    if (existing) return existing.id;
    const id = randomBytes(16).toString("hex"),
      token = randomBytes(32).toString("hex"),
      now = new Date().toISOString();
    store.db
      .prepare(
        "INSERT INTO subscribers(id,email,status,categories,unsubscribe_token,created_at,updated_at) VALUES(?,?,'active',?,?,?,?)",
      )
      .run(id, normalized, JSON.stringify(categories), token, now, now);
    return id;
  }
  // Preserve an earlier single-recipient setup as a subscriber during upgrade.
  if (!store.read("subscriberMigration")) {
    const old = store.read("settings");
    if (old?.email) {
      const id = subscribe(old.email, old.categories || []);
      if (!old.enabled)
        store.db
          .prepare("UPDATE subscribers SET status='paused' WHERE id=?")
          .run(id);
      const legacy = store.db.prepare("SELECT * FROM alerts").all();
      for (const a of legacy)
        store.db
          .prepare(
            "INSERT OR IGNORE INTO deliveries(id,draw_id,subscriber_id,status,created_at,sent_at,error,attempts) VALUES(?,?,?,?,?,?,?,?)",
          )
          .run(
            "draw-" + a.draw_id + "-" + id,
            a.draw_id,
            id,
            a.status,
            a.created_at,
            a.sent_at,
            a.error,
            a.attempts,
          );
    }
    store.write("settings", { enabled: true, categories: [] });
    store.write("subscriberMigration", true);
  }
  // Clean up records left by the previous status-based unsubscribe behavior.
  store.db.prepare("DELETE FROM subscribers WHERE status='unsubscribed'").run();
  const providers = () => ({
    email: !!(config.brevoApiKey && config.fromEmail),
  });
  function dataset() {
    const saved = store.read("dataset") || bundled;
    return {
      draws: store.db
        .prepare("SELECT json FROM draws ORDER BY id DESC")
        .all()
        .map((r) => JSON.parse(r.json)),
      poolSnapshots: store.db
        .prepare("SELECT json FROM pool_snapshots")
        .all()
        .map((r) => JSON.parse(r.json))
        .sort((a, b) => b.id - a.id),
      fetchedAt: saved.fetchedAt,
      mode: store.read("dataset") ? "cached" : "bundled",
      monitor: store.read("monitor"),
      monitoring: { intervalMinutes: config.pollMinutes, background: true },
      archive: {
        draws: store.db.prepare("SELECT COUNT(*) AS n FROM draws").get().n,
        poolSnapshots: store.db
          .prepare("SELECT COUNT(*) AS n FROM pool_snapshots")
          .get().n,
      },
    };
  }
  async function log(type, message) {
    await mkdir(join(config.dataDir, "logs"), { recursive: true });
    await appendFile(
      join(
        config.dataDir,
        "logs",
        new Date().toISOString().slice(0, 7) + ".log",
      ),
      JSON.stringify({ time: new Date().toISOString(), type, message }) + "\n",
    );
  }
  async function sendEmail(s, draw, test = false) {
    // Read current consent immediately before dispatch, rather than trusting a queued batch.
    const subscriberId = s.subscriber_id || s.id;
    if (subscriberId) {
      const current = store.db
        .prepare("SELECT * FROM subscribers WHERE id=?")
        .get(subscriberId);
      if (!current || current.status !== "active") return false;
      s = current;
    }
    if (!providers().email)
      throw new Error(
        "Email delivery needs a Brevo API key and verified sender in the server configuration.",
      );
    if (!s.email) throw new Error("Save an email address first.");
    const subject = test
      ? "Express Entry · Test notification"
      : `Express Entry #${draw.id}: ${draw.category} · CRS ${draw.crs}`;
    let text = test
      ? "Your Express Entry email notifications are connected. New draw alerts will be sent here when monitoring detects a matching round."
      : `${draw.name}\n\nDraw #${draw.id}\nDate: ${draw.date}\nCRS cutoff: ${draw.crs}\nInvitations: ${draw.invitations.toLocaleString("en-CA")}\nTie-breaking rule: ${draw.tieBreak}\n\nOfficial instructions: ${draw.url}\nYour dashboard: ${config.publicUrl}\n\nThis alert reports public draw results. Program, category and tie-breaking requirements still apply.`;
    if (s.unsubscribe_token)
      text += `\n\nUnsubscribe: ${config.publicUrl}/?unsubscribe=${s.unsubscribe_token}`;
    const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Pelaxix Express Entry", email: config.fromEmail },
        to: [{ email: s.email }],
        subject,
        textContent: text,
        tags: ["express-entry", test ? "test" : "draw-" + draw.id],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok)
      throw new Error(
        "Brevo rejected the email (HTTP " +
          res.status +
          "). Check the API key and verified sender.",
      );
    return true;
  }
  function archive(draws, now) {
    store.db.exec("BEGIN IMMEDIATE");
    try {
      const seenPoolDates = new Set();
      for (const d of draws) {
        store.db
          .prepare(
            "INSERT INTO draws(id,date,category,json,first_seen,last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,category=excluded.category,json=excluded.json,last_seen=excluded.last_seen",
          )
          .run(d.id, d.date, d.category, JSON.stringify(d), now, now);
        if (
          poolValid(d) &&
          d.poolDate &&
          !seenPoolDates.has(d.poolDate) &&
          seenPoolDates.add(d.poolDate)
        )
          store.db
            .prepare(
              "INSERT INTO pool_snapshots(date,json,first_seen) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET json=excluded.json",
            )
            .run(d.poolDate, JSON.stringify(d), now);
      }
      store.db.exec("COMMIT");
    } catch (e) {
      store.db.exec("ROLLBACK");
      throw e;
    }
  }
  // Seed the archive once; this is historical data, never an alert backlog.
  if (!store.db.prepare("SELECT 1 FROM draws LIMIT 1").get())
    archive(normalize(bundled.rounds), new Date().toISOString());
  async function run() {
    const now = new Date().toISOString();
    try {
      const res = await fetchImpl(SOURCE, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) throw new Error("IRCC returned HTTP " + res.status);
      const raw = await res.json();
      if (!Array.isArray(raw.rounds))
        throw new Error("IRCC feed format changed.");
      const draws = normalize(raw.rounds);
      const previous = store.read("dataset");
      const baseline = normalize((previous || bundled).rounds);
      if (
        draws.length < 100 ||
        draws[0].id < baseline[0].id ||
        draws.length < baseline.length * 0.9
      )
        throw new Error(
          "IRCC returned an incomplete or older feed; retained last good data.",
        );
      const known = new Set(baseline.map((d) => d.id));
      const added = draws.filter(
        (d) => !known.has(d.id) && d.id > baseline[0].id,
      );
      const s = settings();
      archive(draws, now);
      // Queue and advance the baseline together, so a restart cannot lose a newly detected alert.
      store.db.exec("BEGIN IMMEDIATE");
      try {
        const subscribers = store.db
          .prepare("SELECT * FROM subscribers WHERE status='active'")
          .all();
        for (const d of added) {
          if (
            !s.enabled ||
            (s.categories.length && !s.categories.includes(d.category))
          )
            continue;
          for (const sub of subscribers) {
            const categories = JSON.parse(sub.categories);
            if (categories.length && !categories.includes(d.category)) continue;
            store.db
              .prepare(
                "INSERT OR IGNORE INTO deliveries(id,draw_id,subscriber_id,status,created_at) VALUES(?,?,?,'pending',?)",
              )
              .run("draw-" + d.id + "-" + sub.id, d.id, sub.id, now);
          }
        }
        store.write("dataset", { rounds: raw.rounds, fetchedAt: now });
        store.db.exec("COMMIT");
      } catch (e) {
        store.db.exec("ROLLBACK");
        throw e;
      }
      let delivered = 0,
        deliveryError = null;
      const pending = store.db
        .prepare(
          "SELECT d.*,s.email,s.status AS subscriber_status,s.categories,s.unsubscribe_token FROM deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE d.status='pending' ORDER BY d.draw_id LIMIT 100",
        )
        .all();
      for (const a of pending) {
        if (!s.enabled) break;
        const d = draws.find((d) => d.id === a.draw_id);
        if (!d) continue;
        const categories = JSON.parse(a.categories);
        if (
          a.subscriber_status !== "active" ||
          (categories.length && !categories.includes(d.category)) ||
          (s.categories.length && !s.categories.includes(d.category))
        ) {
          store.db
            .prepare("UPDATE deliveries SET status='skipped' WHERE id=?")
            .run(a.id);
          continue;
        }
        const claimed = store.db
          .prepare(
            "UPDATE deliveries SET status='sending',attempts=attempts+1 WHERE id=? AND status='pending'",
          )
          .run(a.id);
        if (!claimed.changes) continue;
        try {
          const sent = await sendEmail(a, d);
          if (!sent) {
            store.db
              .prepare("UPDATE deliveries SET status='skipped' WHERE id=?")
              .run(a.id);
            continue;
          }
          store.db
            .prepare(
              "UPDATE deliveries SET status='sent',sent_at=?,error=NULL WHERE id=?",
            )
            .run(now, a.id);
          delivered++;
          await log("email-sent", "Draw #" + d.id);
        } catch (e) {
          deliveryError = e.message;
          store.db
            .prepare(
              "UPDATE deliveries SET status='pending',error=? WHERE id=?",
            )
            .run(deliveryError, a.id);
          await log("email-failed", deliveryError);
        }
      }
      const monitor = {
        checkedAt: now,
        ok: true,
        error: null,
        deliveryError,
        newDraws: added.length,
        delivered,
      };
      store.write("monitor", monitor);
      await log(
        "check",
        `${draws.length} draws; ${added.length} new; ${delivered} emails`,
      );
      const day = now.slice(0, 10);
      if (lastBackup !== day) {
        try {
          const dir = join(config.dataDir, "backups");
          await mkdir(dir, { recursive: true });
          await backup(store.db, join(dir, "express-entry-" + day + ".sqlite"));
          lastBackup = day;
          const files = (await readdir(dir))
            .filter((n) => /^express-entry-\d{4}-\d{2}-\d{2}\.sqlite$/.test(n))
            .sort()
            .reverse();
          for (const name of files.slice(30)) await unlink(join(dir, name));
        } catch (e) {
          await log("backup-failed", e.message);
        }
      }
      return monitor;
    } catch (e) {
      store.write("monitor", { checkedAt: now, ok: false, error: e.message });
      await log("check-failed", e.message);
      throw e;
    }
  }
  function sync() {
    if (active) return active;
    active = run().finally(() => {
      active = null;
    });
    return active;
  }
  return {
    dataset,
    settings,
    providers,
    sync,
    sendEmail,
    subscribe,
    subscribers() {
      return store.db
        .prepare(
          "SELECT id,email,status,categories,created_at,updated_at FROM subscribers ORDER BY created_at DESC",
        )
        .all()
        .map((s) => ({ ...s, categories: JSON.parse(s.categories) }));
    },
    subscriber(id) {
      return store.db.prepare("SELECT * FROM subscribers WHERE id=?").get(id);
    },
    manageSubscriber(id, action) {
      if (action === "remove") {
        store.db.prepare("DELETE FROM subscribers WHERE id=?").run(id);
        return;
      }
      store.db
        .prepare("UPDATE subscribers SET status=?,updated_at=? WHERE id=?")
        .run(
          action === "pause" ? "paused" : "active",
          new Date().toISOString(),
          id,
        );
      if (action === "pause")
        store.db
          .prepare(
            "UPDATE deliveries SET status='skipped' WHERE subscriber_id=? AND status='pending'",
          )
          .run(id);
    },
    unsubscribe(token) {
      // Foreign-key cascade removes queued deliveries and recipient-specific history too.
      return !!store.db
        .prepare("DELETE FROM subscribers WHERE unsubscribe_token=?")
        .run(token).changes;
    },
    saveSettings(s) {
      if (s.email) subscribe(s.email, s.categories || []);
      store.write("settings", {
        enabled: s.enabled,
        categories: s.categories || [],
      });
    },
    history() {
      return store.db
        .prepare(
          "SELECT d.id,d.draw_id,d.status,d.created_at,d.sent_at,d.error,d.attempts,s.email FROM deliveries d JOIN subscribers s ON s.id=d.subscriber_id ORDER BY d.created_at DESC LIMIT 50",
        )
        .all();
    },
  };
}
