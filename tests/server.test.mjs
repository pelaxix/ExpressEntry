import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("production HTTP API protects settings, checks origins, authenticates and serves the build", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-api-"));
  const port = 31077;
  const url = "http://127.0.0.1:" + port;
  const origin = "https://ee.example.test";
  const child = spawn(
    process.execPath,
    ["--import", "./tests/mock-network.mjs", "server/index.mjs"],
    {
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: dir,
        PUBLIC_URL: origin,
        ADMIN_PASSWORD: "test-only-password",
        BREVO_API_KEY: "",
        ALERT_FROM_EMAIL: "",
        DEV_ORIGIN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  t.after(async () => {
    child.kill("SIGTERM");
    await new Promise((r) => child.once("exit", r));
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server did not start")),
      10000,
    );
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once("error", reject);
  });
  let r = await fetch(url + "/api/data");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.draws.length >= 400);
  assert.ok(d.poolSnapshots.length > 10);
  assert.equal(d.monitoring.intervalMinutes, 5);
  // Visitors can refresh shared results and subscribe without an account.
  r = await fetch(url + "/api/sync", {
    method: "POST",
    headers: { Origin: origin },
  });
  assert.equal(r.status, 200);
  const checked = (await (await fetch(url + "/api/data")).json()).fetchedAt;
  r = await fetch(url + "/api/sync", {
    method: "POST",
    headers: { Origin: origin },
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).cached, true);
  assert.equal(
    (await (await fetch(url + "/api/data")).json()).fetchedAt,
    checked,
  );
  const streamAbort = new AbortController();
  const stream = await fetch(url + "/api/events", {
    signal: streamAbort.signal,
  });
  assert.match(stream.headers.get("content-type"), /text\/event-stream/);
  const reader = stream.body.getReader();
  await reader.read();
  const pushed = reader.read();
  r = await fetch(url + "/api/sync", {
    method: "POST",
    headers: { Origin: origin },
  });
  assert.equal(r.status, 200);
  const update = await pushed;
  assert.match(new TextDecoder().decode(update.value), /event: updated/);
  streamAbort.abort();
  r = await fetch(url + "/api/subscribers");
  assert.equal(r.status, 401);
  for (const email of ["Person@Example.test", "person@example.test"]) {
    r = await fetch(url + "/api/subscribe", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(r.status, 200);
  }
  r = await fetch(url + "/api/subscribe", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ email: "invalid" }),
  });
  assert.equal(r.status, 400);
  r = await fetch(url + "/api/settings");
  assert.equal(r.status, 401);
  r = await fetch(url + "/api/login", {
    method: "POST",
    headers: {
      Origin: "https://wrong.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password: "test-only-password" }),
  });
  assert.equal(r.status, 403);
  r = await fetch(url + "/api/login", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "test-only-password" }),
  });
  assert.equal(r.status, 200);
  const setCookie = r.headers.get("set-cookie");
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(";")[0];
  r = await fetch(url + "/api/settings", { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  const s = await r.json();
  assert.equal(s.providers.email, false);
  assert.equal("brevoApiKey" in s, false);
  r = await fetch(url + "/api/settings", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      enabled: true,
      email: "test@example.test",
      categories: [],
    }),
  });
  assert.equal(r.status, 400);
  r = await fetch(url + "/api/settings", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      enabled: false,
      email: "test@example.test",
      categories: ["CEC"],
    }),
  });
  assert.equal(r.status, 200);
  r = await fetch(url + "/api/subscribers", { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  const list = (await r.json()).subscribers;
  assert.equal(list.length, 1);
  assert.equal(list[0].email, "person@example.test");
  assert.equal("unsubscribe_token" in list[0], false);
  r = await fetch(url + "/api/data");
  assert.equal(
    JSON.stringify(await r.json()).includes("person@example.test"),
    false,
  );
  r = await fetch(url + "/api/subscribers", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: list[0].id, action: "pause" }),
  });
  assert.equal(r.status, 200);
  r = await fetch(url + "/api/subscribers", { headers: { Cookie: cookie } });
  assert.equal((await r.json()).subscribers[0].status, "paused");
  r = await fetch(url + "/api/subscribers", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: list[0].id, action: "remove" }),
  });
  assert.equal(r.status, 200);
  r = await fetch(url + "/api/subscribers", { headers: { Cookie: cookie } });
  assert.equal((await r.json()).subscribers.length, 0);
  r = await fetch(url + "/");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Express Entry/);
  r = await fetch(url + "/api/logout", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie },
  });
  assert.equal(r.status, 200);
  r = await fetch(url + "/api/settings", { headers: { Cookie: cookie } });
  assert.equal(r.status, 401);
});
