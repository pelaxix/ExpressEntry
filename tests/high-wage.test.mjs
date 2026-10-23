import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHighWage, createHighWageFeed } from "../server/high-wage.mjs";
const captions = [
  "NOCs with a median wage at least twice the average median wage",
  "NOCs with a median wage at least 1.5 times, but less than twice, the average median wage",
  "NOCs with a median wage at least 1.3 times, but less than 1.5 times, the average median wage",
];
const html =
  "<p>Comes into effect on November 3, 2026</p>" +
  captions
    .map(
      (caption, t) =>
        `<table><caption>${caption}</caption>${Array.from({ length: 40 }, (_, i) => `<tr><td>${String(t * 10000 + i).padStart(5, "0")}</td><td>Official occupation</td></tr>`).join("")}</table>`,
    )
    .join("");
test("official high-wage captions map NOC tiers to distinct experience and offer points", () => {
  const d = parseHighWage(html);
  assert.equal(Object.keys(d.entries).length, 120);
  assert.deepEqual(d.entries["00000"], {
    tier: "2",
    experienceBonus: 70,
    offerPoints: 100,
  });
  assert.deepEqual(d.entries["10000"], {
    tier: "1.5",
    experienceBonus: 40,
    offerPoints: 70,
  });
  assert.deepEqual(d.entries["20000"], {
    tier: "1.3",
    experienceBonus: 20,
    offerPoints: 50,
  });
  assert.equal(d.entries["99999"], undefined);
  assert.equal(d.effectiveDate, "2026-11-03");
});
test("changed dates, missing tiers and duplicate codes reject the import", () => {
  assert.throws(() =>
    parseHighWage(html.replace("November 3, 2026", "January 1, 2027")),
  );
  assert.throws(() => parseHighWage(html.replace("1.3 times", "1.4 times")));
  assert.throws(() =>
    parseHighWage(html.replace("<td>10000</td>", "<td>00000</td>")),
  );
  assert.throws(() => parseHighWage("<html>Access denied</html>"));
});
test("high-wage source coalesces requests and retains last-good list on outage", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-wage-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const feed = createHighWageFeed(dir, async () => {
    calls++;
    return new Response(html);
  });
  const [a] = await Promise.all([feed(), feed()]);
  assert.equal(calls, 1);
  await feed();
  assert.equal(calls, 1);
  const offline = createHighWageFeed(dir, async () => {
    throw Error();
  });
  const saved = await offline();
  assert.ok(saved.error);
  assert.equal(saved.entries["00000"].experienceBonus, 70);
  assert.equal(saved.updatedAt, a.updatedAt);
  const emptyDir = mkdtempSync(join(tmpdir(), "ee-wage-empty-"));
  t.after(() => rmSync(emptyDir, { recursive: true, force: true }));
  const missing = await createHighWageFeed(emptyDir, async () => {
    throw Error();
  })();
  assert.equal(missing.entries, null);
  assert.ok(missing.error);
});
