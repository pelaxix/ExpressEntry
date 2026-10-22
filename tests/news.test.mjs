import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeNews, createNewsFeed } from "../server/news.mjs";
const entry = {
  title: "Official update",
  teaser: "Details",
  publishedDate: "2026-10-16T10:00:00Z",
  link: "https://www.canada.ca/en/immigration-refugees-citizenship/news/update.html",
};
test("news rejects non-IRCC links, invalid dates, duplicate entries and HTML", () => {
  const rows = normalizeNews({
    feed: {
      entry: [
        entry,
        entry,
        { ...entry, link: "https://evil.test/post" },
        { ...entry, publishedDate: "bad" },
        { ...entry, title: "<b>New</b>", link: entry.link + "?new" },
      ],
    },
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[1].title, "New");
  assert.throws(() => normalizeNews({ feed: { entry: [] } }));
});
test("news coalesces requests, persists last good results and falls back on outage", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-news-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const feed = createNewsFeed(dir, async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return Response.json({ feed: { entry: [entry] } });
  });
  const results = await Promise.all([feed(), feed()]);
  assert.equal(calls, 1);
  assert.equal(results[0].items.length, 1);
  await feed();
  assert.equal(calls, 1);
  const offline = createNewsFeed(dir, async () => {
    throw Error("offline");
  });
  const saved = await offline();
  assert.equal(saved.items[0].title, entry.title);
  assert.ok(saved.error);
  assert.ok(saved.updatedAt);
});
