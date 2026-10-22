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
