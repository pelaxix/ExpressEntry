import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
export const NEWS_URL =
  "https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=100";
export function normalizeNews(payload) {
  if (!Array.isArray(payload?.feed?.entry))
    throw new Error("Invalid IRCC news response");
  const items = new Map();
  for (const entry of payload.feed.entry) {
    let url;
    try {
      url = new URL(entry.link);
    } catch {
      continue;
    }
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.canada.ca" ||
      !url.pathname.startsWith("/en/immigration-refugees-citizenship/")
    )
      continue;
    if (
      typeof entry.title !== "string" ||
      !Number.isFinite(Date.parse(entry.publishedDate))
    )
      continue;
    const clean = (value) =>
      String(value || "")
        .replace(/<[^>]*>/g, "")
        .trim();
    items.set(url.href, {
      title: clean(entry.title),
      summary: clean(entry.teaser),
      date: entry.publishedDate,
      url: url.href,
    });
  }
  if (!items.size) throw new Error("IRCC news returned no valid entries");
  return [...items.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 100);
}
export function createNewsFeed(dataDir, fetcher = fetch) {
  const file = join(dataDir, "ircc-news.json");
  let cached = { items: [], updatedAt: null },
    pending,
    retryAt = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    cached = {
      items: normalizeNews({
        feed: {
          entry: saved.items.map((i) => ({
            title: i.title,
            teaser: i.summary,
            publishedDate: i.date,
            link: i.url,
          })),
        },
      }),
      updatedAt: saved.updatedAt,
    };
  } catch {}
  return async function news() {
    if (Date.now() < retryAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(NEWS_URL, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error("IRCC news is temporarily unavailable");
        const next = {
          items: normalizeNews(await response.json()),
          updatedAt: new Date().toISOString(),
        };
        writeFileSync(file + ".tmp", JSON.stringify(next));
        renameSync(file + ".tmp", file);
        cached = next;
        retryAt = Date.now() + 15 * 60000;
      } catch {
        cached = {
          ...cached,
          error:
            "Could not refresh IRCC news. Showing the last saved updates, if available.",
        };
        retryAt = Date.now() + 60000;
      } finally {
        pending = null;
      }
      return cached;
    })();
    return pending;
  };
}
