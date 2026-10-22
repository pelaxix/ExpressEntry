import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { normalize } from "../lib/ircc.ts";
import { drawEmail } from "../lib/email.mjs";
const draw = normalize(
  JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../lib/data/ircc-snapshot.json.gz", import.meta.url),
      ),
    ).toString(),
  ).rounds,
)[0];
test("real HTML and plain-text draw alerts contain matching official facts and unsubscribe", () => {
  const mail = drawEmail({
    draw,
    publicUrl: "https://ee.example.test",
    unsubscribeToken: "a".repeat(64),
  });
  assert.ok(!mail.subject.startsWith("[TEST]"));
  assert.match(mail.htmlContent, /<h1/);
  assert.match(mail.htmlContent, new RegExp(String(draw.crs)));
  assert.ok(
    mail.htmlContent.includes(draw.invitations.toLocaleString("en-CA")),
  );
  assert.ok(mail.htmlContent.includes(draw.url.replace(/&/g, "&amp;")));
  assert.ok(mail.textContent.includes(draw.tieBreak));
  assert.ok(mail.htmlContent.includes("?unsubscribe=" + "a".repeat(64)));
  assert.ok(mail.textContent.includes("?unsubscribe=" + "a".repeat(64)));
  assert.ok(Buffer.byteLength(mail.htmlContent) < 30000);
});
test("test emails use the same complete latest-round layout with an explicit test label", () => {
  const testMail = drawEmail({
    draw,
    publicUrl: "https://ee.example.test",
    test: true,
  });
  assert.match(testMail.subject, /^\[TEST\]/);
  assert.ok(testMail.subject.includes("#" + draw.id));
  assert.match(testMail.htmlContent, /No new draw is being announced/);
  assert.match(testMail.textContent, /TEST PREVIEW/);
  assert.ok(testMail.textContent.includes(draw.name));
  assert.ok(testMail.htmlContent.includes("Round details"));
  assert.ok(testMail.htmlContent.includes("View official draw"));
});
test("draw-supplied text is escaped and unsafe URLs do not become email links", () => {
  const mail = drawEmail({
    draw: {
      ...draw,
      name: "<script>alert(1)</script>",
      category: "<img src=x onerror=alert(1)>",
      url: "javascript:alert(1)",
    },
    publicUrl: "javascript:alert(1)",
  });
  assert.ok(!mail.htmlContent.includes("<script>"));
  assert.ok(!mail.htmlContent.includes("<img"));
  assert.ok(mail.htmlContent.includes("&lt;img"));
  assert.ok(!mail.htmlContent.includes('href="javascript:'));
});
test("site preview uses the same HTML layout without a working unsubscribe token", () => {
  const mail = drawEmail({
    draw,
    publicUrl: "https://ee.example.test",
    preview: true,
  });
  assert.ok(mail.htmlContent.includes("Unsubscribe"));
  assert.ok(!mail.htmlContent.includes("?unsubscribe="));
  assert.ok(mail.htmlContent.includes("@media only screen"));
  assert.ok(!mail.htmlContent.includes("<script"));
});
