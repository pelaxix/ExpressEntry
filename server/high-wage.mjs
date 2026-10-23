import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
export const HIGH_WAGE_SOURCE =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html";
export const HIGH_WAGE_RULES =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html";
export function parseHighWage(html) {
  const plain = (s) =>
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  if (!/Comes into effect on November 3, 2026/i.test(plain(html)))
    throw Error("High-wage effective date changed; review rules");
  const entries = {},
    tiers = new Set();
  for (const match of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const caption = plain(
      match[1].match(/<caption[^>]*>([\s\S]*?)<\/caption>/i)?.[1] || "",
    );
    if (!caption.startsWith("NOCs with a median wage")) continue;
    const tier = caption.includes("1.3")
      ? "1.3"
      : caption.includes("1.5")
        ? "1.5"
        : caption.includes("at least twice")
          ? "2"
          : null;
    if (!tier || tiers.has(tier)) throw Error("Unknown high-wage tier");
    tiers.add(tier);
    const points = {
      1.3: { experienceBonus: 20, offerPoints: 50 },
      1.5: { experienceBonus: 40, offerPoints: 70 },
      2: { experienceBonus: 70, offerPoints: 100 },
    }[tier];
    let count = 0;
    for (const row of match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => plain(m[1]),
      );
      if (!cells.length) continue;
      const code = cells[0];
      if (!/^\d{5}$/.test(code) || !cells[1] || entries[code])
        throw Error("Invalid high-wage NOC row");
      entries[code] = { tier, ...points };
      count++;
    }
    if (count < 10) throw Error("Incomplete high-wage tier");
  }
  if (tiers.size !== 3 || Object.keys(entries).length < 100)
    throw Error("Incomplete high-wage list");
  return {
    entries,
    effectiveDate: "2026-11-03",
    source: HIGH_WAGE_SOURCE,
    rules: HIGH_WAGE_RULES,
  };
}
export function createHighWageFeed(dataDir, fetcher = fetch) {
  const file = join(dataDir, "noc-high-wage.json");
  let cached = {
      entries: null,
      effectiveDate: "2026-11-03",
      source: HIGH_WAGE_SOURCE,
      rules: HIGH_WAGE_RULES,
      updatedAt: null,
    },
    pending,
    nextAt = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (
      saved.effectiveDate === cached.effectiveDate &&
      Object.keys(saved.entries || {}).length >= 100
    )
      cached = { ...saved, error: undefined };
  } catch {}
  return async () => {
    if (Date.now() < nextAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const r = await fetcher(HIGH_WAGE_SOURCE, {
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) throw Error();
        const next = {
          ...parseHighWage(await r.text()),
          updatedAt: new Date().toISOString(),
        };
        writeFileSync(file + ".tmp", JSON.stringify(next));
        renameSync(file + ".tmp", file);
        cached = next;
        nextAt = Date.now() + 24 * 60 * 60000;
      } catch {
        cached = {
          ...cached,
          error:
            "Could not verify the current IRCC high-wage list. Saved results may be outdated; confirm on IRCC.",
        };
        nextAt = Date.now() + 5 * 60000;
      }
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
