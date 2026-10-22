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
  const child = spawn(process.execPath, ["server/index.mjs"], {
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
  });
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
