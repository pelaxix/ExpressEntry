import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseX, parseYouTube, createSocialFeed } from "../server/social.mjs";
const tweet = {
  __typename: "Tweet",
  rest_id: "123456",
  core: {
    user_results: {
      result: { rest_id: "91193025", core: { screen_name: "CitImmCanada" } },
    },
  },
  details: { full_text: "Short post", created_at_ms: 1792692031000 },
  note_tweet: {
    note_tweet_results: { result: { text: "Full official post\nDetails" } },
  },
};
const html = (t) =>
  `<script>value:${JSON.stringify(JSON.stringify({ data: [t, t] }))}</script>`;
const xml = `<feed><entry><yt:channelId>UC50bi5fNoYQk11lWhfi3l4w</yt:channelId><yt:videoId>abcdefghijk</yt:videoId><title>Official &amp; public</title><published>2026-10-19T13:00:00Z</published><media:description>Details</media:description></entry></feed>`;
test("X parses public JSON safely, uses full text, verifies author and deduplicates", () => {
  const rows = parseX(html(tweet));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].summary, "Full official post\nDetails");
  assert.equal(rows[0].url, "https://x.com/CitImmCanada/status/123456");
  assert.throws(() => parseX(html({ ...tweet, core: {} })));
  assert.throws(() => parseX("<script>throw Error()</script>"));
});
test("YouTube verifies official channel and decodes XML text", () => {
  assert.equal(parseYouTube(xml)[0].title, "Official & public");
  assert.throws(() =>
    parseYouTube(xml.replace("UC50bi5fNoYQk11lWhfi3l4w", "other")),
  );
  assert.throws(() => parseYouTube("<html>Login</html>"));
});
test("social fetch coalesces and caches; outage preserves each source independently", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-social-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const feed = createSocialFeed(dir, async (url) => {
    calls++;
    return new Response(url.includes("x.com") ? html(tweet) : xml);
  });
  const [result] = await Promise.all([feed(), feed()]);
  assert.equal(calls, 2);
  assert.equal(result.items.length, 2);
  await feed();
  assert.equal(calls, 2);
  const partial = createSocialFeed(dir, async (url) => {
    if (url.includes("x.com")) throw Error();
    return new Response(xml);
  });
  const fallback = await partial();
  assert.equal(fallback.items.length, 2);
  assert.equal(fallback.sources[0].ok, false);
  assert.equal(fallback.sources[1].ok, true);
  assert.ok(fallback.sources[0].updatedAt);
});
