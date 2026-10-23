import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCSV, normalizeNoc, createNocFeed } from "../server/noc.mjs";
const structure =
  "Level,Code - NOC 2021 V1.0,Class title,Class definition\n1,0,Management,Description\n" +
  Array.from(
    { length: 516 },
    (_, i) =>
      `5,${String(i).padStart(5, "0")},Occupation ${i},Official description`,
  ).join("\n");
const elements =
  "Code - NOC 2021 V1.0,Element Type Label English,Element Description English\n" +
  Array.from(
    { length: 516 },
    (_, i) =>
      `${String(i).padStart(5, "0")},All examples,Example title\n${String(i).padStart(5, "0")},Main duties,Official duties`,
  ).join("\n");
test("CSV preserves leading zeros, BOM headers, quoted commas and newlines", () => {
  assert.deepEqual(
    parseCSV(
      '\uFEFFCode,Title\r\n00010,"Legislators, elected\nwith ""quotes"""\r\n',
    ),
    [{ Code: "00010", Title: 'Legislators, elected\nwith "quotes"' }],
  );
  assert.throws(() => parseCSV('A,B\n"unfinished'));
  assert.throws(() => parseCSV("A,B\none"));
});
test("NOC import combines structure with details and rejects incomplete catalogues", () => {
  const items = normalizeNoc(structure, elements);
  assert.equal(items.length, 516);
  assert.equal(items[0].code, "00000");
  assert.equal(items[0].teer, 0);
  assert.deepEqual(items[0].duties, ["Official duties"]);
  assert.ok(items[0].url.includes("Code=00000"));
  assert.throws(() =>
    normalizeNoc(structure.split("\n").slice(0, -1).join("\n"), elements),
  );
  assert.throws(() =>
    normalizeNoc(
      structure,
      "Code - NOC 2021 V1.0,Element Type Label English,Element Description English\n",
    ),
  );
});
test("official NOC fetch coalesces, caches and preserves saved catalogue during outage", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ee-noc-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let calls = 0;
  const feed = createNocFeed(dir, async (url) => {
    calls++;
    return new Response(url.includes("structure.csv") ? structure : elements);
  });
  const [a, b] = await Promise.all([feed(), feed()]);
  assert.equal(calls, 2);
  assert.equal(a.items.length, 516);
  assert.equal(b.items.length, 516);
  await feed();
  assert.equal(calls, 2);
  const offline = createNocFeed(dir, async () => {
    throw Error("offline");
  });
  const result = await offline();
  assert.equal(result.items.length, 516);
  assert.ok(result.error);
  assert.equal(result.updatedAt, a.updatedAt);
});
