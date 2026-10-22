import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
export const SOCIAL_SOURCES = [
  { id: "x", name: "X · @CitImmCanada", url: "https://x.com/CitImmCanada" },
  {
    id: "youtube",
    name: "YouTube · IRCC",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC50bi5fNoYQk11lWhfi3l4w",
  },
  {
    id: "instagram",
    name: "Instagram · @citimmcanada",
    url: "https://www.instagram.com/citimmcanada/embed/",
  },
];
export function parseInstagram(html) {
  const items = new Map();
  function walk(v, depth = 0) {
    if (depth > 70 || v == null) return;
    if (typeof v === "string" && /^[{[]/.test(v)) {
      try {
        walk(JSON.parse(v), depth + 1);
      } catch {}
      return;
    }
    if (typeof v !== "object") return;
    if (v.shortcode && v.taken_at_timestamp) {
      const owner = v.owner;
      const text = v.edge_media_to_caption?.edges?.[0]?.node?.text;
      const date = new Date(v.taken_at_timestamp * 1000);
      if (
        owner?.id === "2179206737" &&
        owner.username === "citimmcanada" &&
        /^[A-Za-z0-9_-]+$/.test(v.shortcode) &&
        Number.isFinite(date.getTime())
      ) {
        const caption =
          typeof text === "string"
            ? text
            : "View this official IRCC post on Instagram.";
        items.set(v.shortcode, {
          title: caption.split("\n")[0].slice(0, 160),
          summary: caption,
          date: date.toISOString(),
          url: `https://www.instagram.com/p/${v.shortcode}/`,
          source: "Instagram · @citimmcanada",
        });
      }
      return;
    }
    for (const child of Object.values(v)) walk(child, depth + 1);
  }
  // Read a balanced JSON object from ServerJS; no page JavaScript is executed.
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(script[1]));
    } catch {}
    for (const match of script[1].matchAll(/\.handle\((\{)/g)) {
      const start = match.index + match[0].length - 1;
      let depth = 0,
        quoted = false,
        escaped = false;
      for (let i = start; i < script[1].length; i++) {
        const ch = script[1][i];
        if (quoted) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') quoted = false;
          continue;
        }
        if (ch === '"') quoted = true;
        else if (ch === "{") depth++;
        else if (ch === "}" && --depth === 0) {
          try {
            walk(JSON.parse(script[1].slice(start, i + 1)));
          } catch {}
          break;
        }
      }
    }
  }
  if (!items.size) throw Error("No readable official Instagram posts");
  return [...items.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 30);
}
export function parseX(html) {
  const items = new Map();
  function walk(v, depth = 0) {
    if (!v || typeof v !== "object" || depth > 70) return;
    if (v.__typename === "Tweet") {
      const user = v.core?.user_results?.result;
      const text =
        v.note_tweet?.note_tweet_results?.result?.text ||
        v.details?.full_text ||
        v.legacy?.full_text;
      const timestamp = v.details?.created_at_ms;
      const date = timestamp
        ? new Date(timestamp)
        : new Date(v.legacy?.created_at);
      if (
        user?.rest_id === "91193025" &&
        (user.core?.screen_name || user.legacy?.screen_name) ===
          "CitImmCanada" &&
        /^\d+$/.test(v.rest_id) &&
        typeof text === "string" &&
        Number.isFinite(date.getTime())
      ) {
        items.set(v.rest_id, {
          title: text.split("\n")[0].slice(0, 160),
          summary: text,
          date: date.toISOString(),
          url: `https://x.com/CitImmCanada/status/${v.rest_id}`,
          source: "X · @CitImmCanada",
        });
      }
      return;
    }
    for (const child of Object.values(v)) walk(child, depth + 1);
  }
  // Decode only JSON string literals; never execute scripts from the source page.
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = script[1];
    if (body.includes("full_text"))
      for (const match of body.matchAll(/\bvalue:("(?:\\.|[^"\\])*")/g)) {
        try {
          walk(JSON.parse(JSON.parse(match[1])));
        } catch {}
      }
    if (/__INITIAL_STATE__/.test(body)) {
      const match = body.match(/__INITIAL_STATE__\s*=\s*({[\s\S]*?});/);
      if (match)
        try {
          walk(JSON.parse(match[1]));
        } catch {}
    }
  }
  if (!items.size) throw Error("No readable official X posts");
  return [...items.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 30);
}
const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, n) => {
      const c =
        n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n);
      return c <= 0x10ffff ? String.fromCodePoint(c) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
export function parseYouTube(xml) {
  const items = [];
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1],
      tag = (name) =>
        entry.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1] || "";
    const id = tag("yt:videoId"),
      channel = tag("yt:channelId"),
      date = tag("published");
    if (
      !/^[\w-]{11}$/.test(id) ||
      !["UC50bi5fNoYQk11lWhfi3l4w", "50bi5fNoYQk11lWhfi3l4w"].includes(
        channel,
      ) ||
      !Number.isFinite(Date.parse(date))
    )
      continue;
    items.push({
      title: decode(tag("title")),
      summary: decode(tag("media:description")).slice(0, 4000),
      date,
      url: `https://www.youtube.com/watch?v=${id}`,
      source: "YouTube · IRCC",
    });
  }
  if (!items.length) throw Error("No readable official YouTube videos");
  return items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}
export function createSocialFeed(dataDir, fetcher = fetch) {
  const file = join(dataDir, "ircc-social.json");
  let cached = { items: [], sources: [] },
    pending,
    nextAt = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (Array.isArray(saved.items) && Array.isArray(saved.sources))
      cached = saved;
  } catch {}
  return async () => {
    if (Date.now() < nextAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      const results = await Promise.all(
        SOCIAL_SOURCES.map(async (source) => {
          try {
            const response = await fetcher(source.url, {
              signal: AbortSignal.timeout(15000),
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (compatible; PelaxixExpressEntry/1.0)",
              },
            });
            if (!response.ok) throw Error();
            const body = await response.text();
            const items =
              source.id === "x"
                ? parseX(body)
                : source.id === "instagram"
                  ? parseInstagram(body)
                  : parseYouTube(body);
            return {
              items,
              status: {
                id: source.id,
                name: source.name,
                ok: true,
                updatedAt: new Date().toISOString(),
              },
            };
          } catch {
            const old = cached.sources.find((s) => s.id === source.id);
            return {
              items: cached.items.filter((i) => i.source === source.name),
              status: {
                id: source.id,
                name: source.name,
                ok: false,
                updatedAt: old?.updatedAt || null,
              },
            };
          }
        }),
      );
      cached = {
        items: results
          .flatMap((r) => r.items)
          .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)),
        sources: results.map((r) => r.status),
      };
      try {
        writeFileSync(file + ".tmp", JSON.stringify(cached));
        renameSync(file + ".tmp", file);
      } catch {}
      nextAt = Date.now() + 15 * 60000;
      return cached;
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
