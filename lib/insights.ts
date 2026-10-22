import type { Draw } from "./ircc";
const ranges: Record<number, [number, number]> = {
  0: [601, 1200],
  1: [501, 600],
  3: [491, 500],
  4: [481, 490],
  5: [471, 480],
  6: [461, 470],
  7: [451, 460],
  9: [441, 450],
  10: [431, 440],
  11: [421, 430],
  12: [411, 420],
  13: [401, 410],
  14: [351, 400],
  15: [301, 350],
  16: [0, 300],
};
/** Bounds only: published bands do not reveal positions inside a band. */
export function aboveScore(pool: Draw, score: number) {
  let min = 0,
    max = 0;
  for (const i of Object.keys(ranges).map(Number)) {
    const [low, high] = ranges[i];
    if (low > score) {
      min += pool.pool[i];
      max += pool.pool[i];
    } else if (high > score) max += pool.pool[i];
  }
  return { min, max };
}
export function scoreOutcome(score: number, cutoff: number) {
  return score > cutoff
    ? "Above cutoff"
    : score === cutoff
      ? "At cutoff · tie-break applies"
      : "Below cutoff";
}
export function monthCells(month: string) {
  const [year, m] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) =>
    i < offset || i >= offset + days
      ? null
      : `${month}-${String(i - offset + 1).padStart(2, "0")}`,
  );
}
