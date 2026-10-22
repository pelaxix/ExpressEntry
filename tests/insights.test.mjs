import test from "node:test";
import assert from "node:assert/strict";
import { aboveScore, scoreOutcome, monthCells } from "../lib/insights.ts";
const pool = { pool: Array(18).fill(10) };
test("above-score bounds account for unknown scores within a band without double counting", () => {
  assert.deepEqual(aboveScore(pool, 513), { min: 10, max: 20 });
  assert.deepEqual(aboveScore(pool, 500), { min: 20, max: 20 });
  assert.deepEqual(aboveScore(pool, 1200), { min: 0, max: 0 });
  assert.deepEqual(aboveScore(pool, 0), { min: 140, max: 150 });
  assert.deepEqual(aboveScore(pool, 490), { min: 30, max: 30 });
});
test("cutoff equality is distinguished from clearing the cutoff", () => {
  assert.equal(scoreOutcome(513, 512), "Above cutoff");
  assert.equal(scoreOutcome(513, 513), "At cutoff · tie-break applies");
  assert.equal(scoreOutcome(513, 514), "Below cutoff");
});
test("calendar uses Monday-first weeks, leap years and month boundaries", () => {
  const oct = monthCells("2026-10");
  assert.equal(oct[3], "2026-10-01");
  assert.equal(oct.filter(Boolean).length, 31);
  assert.equal(oct.length % 7, 0);
  const leap = monthCells("2028-02");
  assert.ok(leap.includes("2028-02-29"));
  assert.equal(monthCells("2027-02").filter(Boolean).length, 28);
  assert.equal(monthCells("2026-06")[0], "2026-06-01");
});
