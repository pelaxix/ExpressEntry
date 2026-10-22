import { gunzipSync } from "node:zlib";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../server/store.mjs";
import { createTracker } from "../server/tracker.mjs";
import { normalize, poolValid, LEAVES, BROAD } from "../lib/ircc.ts";
const source = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../lib/data/ircc-snapshot.json.gz", import.meta.url)),
  ).toString("utf8"),
).rounds;
const normalized = normalize(source);
function fixture(t, handler) {
  const dataDir = mkdtempSync(join(tmpdir(), "ee-test-"));
  const store = openStore(dataDir);
  t.after(() => {
    store.close();
    rmSync(dataDir, { recursive: true, force: true });
  });
  const config = {
    dataDir,
    pollMinutes: 5,
    publicUrl: "https://example.test",
    brevoApiKey: "test-key",
    fromEmail: "sender@example.test",
  };
  return {
    store,
    tracker: createTracker(store, config, { fetchImpl: handler }),
  };
}
function nextRaw() {
  const n = structuredClone(source[0]);
  n.drawNumber = String(normalized[0].id + 1);
  n.drawDate = "2026-10-22";
  return n;
}
test("official snapshot is unique, ordered and the latest pool bands reconcile", () => {
  assert.ok(normalized.length >= 400);
  assert.equal(new Set(normalized.map((d) => d.id)).size, normalized.length);
  assert.ok(normalized.every((d, i) => !i || d.id < normalized[i - 1].id));
  const d = normalized[0];
  assert.ok(poolValid(d));
  assert.equal(
    LEAVES.reduce((s, i) => s + d.pool[i], 0),
    d.pool[17],
  );
  assert.equal(
    BROAD.reduce((s, i) => s + d.pool[i], 0),
    d.pool[17],
  );
  assert.equal(
    d.pool[2],
    d.pool.slice(3, 8).reduce((a, b) => a + b),
  );
  assert.equal(
    d.pool[8],
    d.pool.slice(9, 14).reduce((a, b) => a + b),
  );
});
test("unchanged sync archives draws but sends no historical backlog", async (t) => {
  let emails = 0;
  const { store, tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) emails++;
    return Response.json({ rounds: source });
  });
  tracker.saveSettings({
    enabled: true,
    email: "recipient@example.test",
    categories: [],
  });
  await tracker.sync();
  assert.equal(emails, 0);
  assert.ok(store.db.prepare("SELECT COUNT(*) n FROM draws").get().n >= 400);
  assert.ok(
    store.db.prepare("SELECT COUNT(*) n FROM pool_snapshots").get().n > 0,
  );
});
test("new matching draw sends once across repeated and concurrent checks", async (t) => {
  let emails = 0;
  const raw = [nextRaw(), ...source];
  const { tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) {
      emails++;
      return Response.json({ messageId: "test" });
    }
    return Response.json({ rounds: raw });
  });
  tracker.saveSettings({
    enabled: true,
    email: "recipient@example.test",
    categories: [],
  });
  await Promise.all([tracker.sync(), tracker.sync()]);
  await tracker.sync();
  assert.equal(emails, 1);
  assert.equal(tracker.history()[0].status, "sent");
});
test("category filter skips unrelated new draws", async (t) => {
  let emails = 0;
  const raw = [nextRaw(), ...source];
  const { tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) emails++;
    return Response.json({ rounds: raw });
  });
  tracker.saveSettings({
    enabled: true,
    email: "recipient@example.test",
    categories: ["CEC"],
  });
  await tracker.sync();
  assert.equal(emails, 0);
  assert.equal(tracker.history().length, 0);
});
test("failed email is retried; later checks do not duplicate successful delivery", async (t) => {
  let attempts = 0;
  const raw = [nextRaw(), ...source];
  const { tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) {
      attempts++;
      return new Response("{}", { status: attempts === 1 ? 503 : 201 });
    }
    return Response.json({ rounds: raw });
  });
  tracker.saveSettings({
    enabled: true,
    email: "recipient@example.test",
    categories: [],
  });
  await tracker.sync();
  assert.equal(tracker.history()[0].status, "pending");
  await tracker.sync();
  await tracker.sync();
  assert.equal(attempts, 2);
  assert.equal(tracker.history()[0].status, "sent");
});
test("truncated feed keeps last successful data and reports failure", async (t) => {
  let bad = false;
  const { tracker } = fixture(t, async () =>
    Response.json({ rounds: bad ? source.slice(0, 2) : source }),
  );
  await tracker.sync();
  const stamp = tracker.dataset().fetchedAt;
  bad = true;
  await assert.rejects(tracker.sync(), /incomplete/);
  assert.equal(tracker.dataset().fetchedAt, stamp);
  assert.equal(tracker.dataset().monitor.ok, false);
});
test("email content links directly to official instructions", async (t) => {
  let mail;
  const { tracker } = fixture(t, async (url, opts) => {
    mail = JSON.parse(opts.body);
    return Response.json({ messageId: "test" });
  });
  await tracker.sendEmail({ email: "recipient@example.test" }, normalized[0]);
  assert.match(mail.textContent, /https:\/\/www.canada.ca/);
  assert.match(mail.textContent, /Tie-breaking/);
  assert.equal(mail.to[0].email, "recipient@example.test");
});

test("each subscriber receives a new draw separately without exposing other recipients", async (t) => {
  const mails = [];
  const raw = [nextRaw(), ...source];
  const { tracker } = fixture(t, async (url, opts) => {
    if (url.includes("brevo")) {
      mails.push(JSON.parse(opts.body));
      return Response.json({ messageId: "test" });
    }
    return Response.json({ rounds: raw });
  });
  tracker.subscribe("first@example.test");
  tracker.subscribe("second@example.test");
  await tracker.sync();
  await tracker.sync();
  assert.equal(mails.length, 2);
  assert.ok(mails.every((m) => m.to.length === 1));
  assert.ok(mails.every((m) => m.textContent.includes("?unsubscribe=")));
  assert.equal(tracker.history().length, 2);
});
test("paused, removed and unsubscribed addresses do not get new draw alerts", async (t) => {
  let emails = 0;
  const raw = [nextRaw(), ...source];
  const { tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) {
      emails++;
      return Response.json({});
    }
    return Response.json({ rounds: raw });
  });
  const paused = tracker.subscribe("paused@example.test");
  tracker.manageSubscriber(paused, "pause");
  const removed = tracker.subscribe("removed@example.test");
  tracker.manageSubscriber(removed, "remove");
  const unsub = tracker.subscribe("unsub@example.test");
  tracker.unsubscribe(tracker.subscriber(unsub).unsubscribe_token);
  tracker.subscribe("active@example.test");
  await tracker.sync();
  assert.equal(emails, 1);
  assert.equal(tracker.subscribers().length, 3);
});
test("subscriber category selections control delivery and signup never sends old draws", async (t) => {
  let emails = 0,
    raw = source;
  const { tracker } = fixture(t, async (url) => {
    if (url.includes("brevo")) {
      emails++;
      return Response.json({});
    }
    return Response.json({ rounds: raw });
  });
  tracker.subscribe("cec@example.test", ["CEC"]);
  await tracker.sync();
  assert.equal(emails, 0);
  raw = [nextRaw(), ...source];
  await tracker.sync();
  assert.equal(emails, 0);
});
test("old single recipient migrates once without replacing the database", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-migration-"));
  const store = openStore(dir);
  t.after(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  store.write("settings", {
    enabled: true,
    email: "previous@example.test",
    categories: ["CEC"],
  });
  const cfg = { dataDir: dir, pollMinutes: 5 };
  store.db
    .prepare(
      "INSERT INTO alerts(id,draw_id,status,created_at,sent_at) VALUES('draw-old',450,'sent','2026-10-20','2026-10-20')",
    )
    .run();
  const tracker = createTracker(store, cfg);
  assert.equal(tracker.history().length, 1);
  assert.equal(tracker.history()[0].status, "sent");
  assert.equal(tracker.subscribers().length, 1);
  assert.equal(tracker.subscribers()[0].email, "previous@example.test");
  assert.deepEqual(tracker.subscribers()[0].categories, ["CEC"]);
  createTracker(store, cfg);
  assert.equal(tracker.subscribers().length, 1);
});
