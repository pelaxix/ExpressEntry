import { createServer } from "node:http";
import { createReadStream, existsSync, statSync, mkdirSync } from "node:fs";
import { resolve, join, extname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { openStore } from "./store.mjs";
import { createTracker } from "./tracker.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataDir = resolve(
  process.env.DATA_DIR ||
    (process.platform === "win32"
      ? "D:\\DevData\\ExpressEntry"
      : join(root, "data")),
);
mkdirSync(dataDir, { recursive: true });
const envPath = join(dataDir, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);
const config = {
  dataDir,
  port: Number(process.env.PORT || 31007),
  host: process.env.HOST || "127.0.0.1",
  publicUrl: process.env.PUBLIC_URL || "https://ee.pelaxix.com",
  pollMinutes: Math.max(1, Number(process.env.POLL_MINUTES) || 5),
  brevoApiKey: process.env.BREVO_API_KEY || "",
  fromEmail: process.env.ALERT_FROM_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
};
const store = openStore(dataDir),
  tracker = createTracker(store, config);
const hash = (s) => createHash("sha256").update(s).digest("hex");
const sessions = store.db;
const passwordFingerprint = hash(config.adminPassword);
if (store.read("adminPasswordFingerprint") !== passwordFingerprint) {
  sessions.prepare("DELETE FROM sessions").run();
  store.write("adminPasswordFingerprint", passwordFingerprint);
}
const failures = new Map();
let lastManual = 0;
function admin(req) {
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("ee_session="));
  if (!cookie) return false;
  const token = cookie.slice(11);
  const s = sessions
    .prepare("SELECT expires_at FROM sessions WHERE token_hash=?")
    .get(hash(token));
  return !!s && s.expires_at > Date.now();
}
function json(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 16384) throw new Error("Request too large");
  }
  return JSON.parse(text || "{}");
}
function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const allowed = new Set([
    config.publicUrl,
    "http://127.0.0.1:" + config.port,
    "http://localhost:" + config.port,
    ...(process.env.DEV_ORIGIN ? [process.env.DEV_ORIGIN] : []),
  ]);
  return allowed.has(origin);
}
function safeEqual(a, b) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      if (req.method === "POST" && !allowedOrigin(req))
        return json(res, 403, { error: "Invalid request origin." });
      if (url.pathname === "/api/data" && req.method === "GET")
        return json(res, 200, tracker.dataset());
      if (url.pathname === "/api/auth" && req.method === "GET")
        return json(res, 200, {
          authenticated: admin(req),
          configured: !!config.adminPassword,
        });
      if (url.pathname === "/api/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress || "local";
        const fail = failures.get(ip);
        if (fail && fail.until > Date.now() && fail.count >= 10)
          return json(res, 429, {
            error: "Too many attempts. Try again in 15 minutes.",
          });
        const b = await body(req);
        if (
          !config.adminPassword ||
          typeof b.password !== "string" ||
          !safeEqual(b.password, config.adminPassword)
        ) {
          failures.set(ip, {
            count: (fail?.until > Date.now() ? fail.count : 0) + 1,
            until: Date.now() + 900000,
          });
          return json(res, 401, { error: "Incorrect administrator password." });
        }
        failures.delete(ip);
        const token = randomBytes(32).toString("hex");
        sessions
          .prepare("DELETE FROM sessions WHERE expires_at<?")
          .run(Date.now());
        sessions
          .prepare("INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)")
          .run(hash(token), Date.now() + 7 * 86400000);
        const secure =
          config.publicUrl.startsWith("https:") && !process.env.DEV_ORIGIN
            ? "; Secure"
            : "";
        return json(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie": `ee_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`,
          },
        );
      }
      if (url.pathname === "/api/logout" && req.method === "POST") {
        const cookie = (req.headers.cookie || "")
          .split(";")
          .map((s) => s.trim())
          .find((s) => s.startsWith("ee_session="));
        if (cookie)
          sessions
            .prepare("DELETE FROM sessions WHERE token_hash=?")
            .run(hash(cookie.slice(11)));
        return json(
          res,
          200,
          { ok: true },
          {
            "Set-Cookie":
              "ee_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
          },
        );
      }
      if (url.pathname === "/api/sync" && req.method === "POST") {
        if (!admin(req))
          return json(res, 401, {
            error:
              "Sign in under Notifications to check IRCC manually. Automatic monitoring continues in the background.",
          });
        if (Date.now() - lastManual < 60000)
          return json(res, 429, {
            error:
              "IRCC was checked recently. Wait one minute before checking again.",
          });
        lastManual = Date.now();
        return json(res, 200, await tracker.sync());
      }
      if (
        ["/api/settings", "/api/test-alert", "/api/alert-history"].includes(
          url.pathname,
        ) &&
        !admin(req)
      )
        return json(res, 401, { error: "Administrator sign-in required." });
      if (url.pathname === "/api/settings" && req.method === "GET")
        return json(res, 200, {
          settings: tracker.settings(),
          providers: tracker.providers(),
          monitoring: { intervalMinutes: config.pollMinutes, background: true },
        });
      if (url.pathname === "/api/settings" && req.method === "POST") {
        const s = await body(req);
        if (
          typeof s.enabled !== "boolean" ||
          typeof s.email !== "string" ||
          s.email.length > 254 ||
          (s.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) ||
          !Array.isArray(s.categories) ||
          s.categories.length > 30 ||
          s.categories.some((c) => typeof c !== "string" || c.length > 150)
        )
          return json(res, 400, { error: "Enter valid email preferences." });
        if (s.enabled && (!s.email || !tracker.providers().email))
          return json(res, 400, {
            error:
              "Add an email address and configure Brevo before enabling alerts.",
          });
        tracker.saveSettings({
          enabled: s.enabled,
          email: s.email,
          categories: s.categories,
        });
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/test-alert" && req.method === "POST") {
        await tracker.sendEmail(
          tracker.settings(),
          tracker.dataset().draws[0],
          true,
        );
        return json(res, 200, { ok: true });
      }
      if (url.pathname === "/api/alert-history" && req.method === "GET")
        return json(res, 200, { alerts: tracker.history() });
      return json(res, 404, { error: "Not found." });
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      return json(res, 405, { error: "Method not allowed." });
    const dist = join(root, "dist");
    const path = resolve(dist, "." + decodeURIComponent(url.pathname));
    const rel = relative(dist, path);
    if (rel.startsWith("..") || isAbsolute(rel))
      return json(res, 403, { error: "Invalid path" });
    const file =
      existsSync(path) && statSync(path).isFile()
        ? path
        : join(dist, "index.html");
    if (!existsSync(file))
      return json(res, 503, {
        error: "Build the dashboard first: npm run build",
      });
    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
      ".png": "image/png",
    };
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Cache-Control": url.pathname.startsWith("/assets/")
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    });
    if (req.method === "HEAD") return res.end();
    createReadStream(file).pipe(res);
  } catch (e) {
    console.error(new Date().toISOString(), e.message);
    json(res, 500, { error: e.message || "Request failed" });
  }
});
const timer = setInterval(
  () => tracker.sync().catch(() => {}),
  config.pollMinutes * 60000,
);
timer.unref();
server.listen(config.port, config.host, () => {
  console.log(
    `Express Entry listening on http://${config.host}:${config.port}`,
  );
  console.log(`Persistent data: ${dataDir}`);
  console.log(
    `Checking IRCC every ${config.pollMinutes} minutes. Email provider: ${tracker.providers().email ? "configured" : "not configured"}.`,
  );
  if (!config.adminPassword)
    console.log("Admin sign-in disabled until ADMIN_PASSWORD is configured.");
  tracker.sync().catch((e) => console.error("Initial IRCC check:", e.message));
});
function shutdown() {
  clearInterval(timer);
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
