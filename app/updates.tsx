import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
type Item = {
  title: string;
  summary: string;
  date: string;
  url: string;
  source?: string;
};
const sources = [
  [
    "Newsroom",
    "Announcements, statements and backgrounders",
    "https://www.canada.ca/en/immigration-refugees-citizenship/news.html",
  ],
  [
    "Notices",
    "Public notices and program announcements",
    "https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.html",
  ],
  [
    "Program delivery updates",
    "Changes to operational guidance",
    "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/updates.html",
  ],
  [
    "Publications and manuals",
    "Reports, research and program guidance",
    "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals.html",
  ],
  [
    "Official social channels",
    "Facebook, Instagram, X, LinkedIn and YouTube",
    "https://www.canada.ca/en/immigration-refugees-citizenship/news/social-media.html",
  ],
];
export default function Updates() {
  const [social, setSocial] = useState<{
    items: Item[];
    sources: {
      id: string;
      name: string;
      ok: boolean;
      updatedAt: string | null;
    }[];
  }>({ items: [], sources: [] });
  const [socialBusy, setSocialBusy] = useState(true),
    [socialError, setSocialError] = useState(""),
    [source, setSource] = useState("All sources");
  async function loadSocial() {
    setSocialBusy(true);
    try {
      const r = await fetch("/api/social");
      if (!r.ok) throw Error();
      setSocial(await r.json());
      setSocialError("");
    } catch {
      setSocialError(
        "Social feeds are unavailable right now. Try the official channel links.",
      );
    } finally {
      setSocialBusy(false);
    }
  }
  const [feed, setFeed] = useState<{
    items: Item[];
    updatedAt?: string;
    error?: string;
  }>({ items: [] });
  const [busy, setBusy] = useState(true),
    [query, setQuery] = useState(""),
    [ee, setEe] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/news");
      if (!r.ok) throw Error();
      setFeed(await r.json());
    } catch {
      setFeed((f) => ({
        ...f,
        error:
          "Updates are unavailable right now. Use the official sources below.",
      }));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
    void loadSocial();
    const timer = setInterval(() => {
      void load();
      void loadSocial();
    }, 15 * 60000);
    return () => clearInterval(timer);
  }, []);
  const items = [
    ...feed.items.map((i) => ({ ...i, source: "IRCC · Canada.ca" })),
    ...social.items,
  ]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .filter(
      (i) =>
        (source === "All sources" || i.source === source) &&
        (!ee ||
          /express entry|\bCRS\b|comprehensive ranking/i.test(
            i.title + " " + i.summary,
          )) &&
        (i.title + " " + i.summary).toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <div className="updates-layout">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Official IRCC updates</h2>
            <p>
              Publications, X posts and YouTube videos, newest first. Open an
              item to view the original.
            </p>
          </div>
          <button
            className="button"
            disabled={busy || socialBusy}
            onClick={() => {
              void load();
              void loadSocial();
            }}
          >
            <RefreshCw size={14} />
            {busy || socialBusy ? "Loading…" : "Refresh updates"}
          </button>
        </div>
        <div className="updates-controls">
          <select
            aria-label="Filter by source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {[
              "All sources",
              "IRCC · Canada.ca",
              "X · @CitImmCanada",
              "YouTube · IRCC",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <input
            aria-label="Search IRCC updates"
            placeholder="Search updates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={ee}
              onChange={(e) => setEe(e.target.checked)}
            />{" "}
            Express Entry only
          </label>
        </div>
        {socialBusy && (
          <p className="source-note" role="status">
            Fetching public social posts…
          </p>
        )}
        {socialError && (
          <p className="notice" role="status">
            {socialError}
          </p>
        )}
        <div className="social-feed-status">
          {social.sources.map((s) => (
            <p className="source-note" key={s.id}>
              {s.name}:{" "}
              {s.ok
                ? "Fetched"
                : "Refresh unavailable; saved posts shown if available"}
              {s.updatedAt
                ? ` · Last successful fetch ${new Date(s.updatedAt).toLocaleString()}`
                : ""}
            </p>
          ))}
        </div>
        {feed.error && (
          <p className="notice" role="status">
            {feed.error}
          </p>
        )}
        {feed.updatedAt && (
          <p className="source-note">
            Newsroom fetched {new Date(feed.updatedAt).toLocaleString()} ·
            Refreshes every 15 minutes · {items.length} results
          </p>
        )}
        <div className="updates-list">
          {items.map((i) => (
            <article key={i.url}>
              <time dateTime={i.date}>
                {new Date(i.date).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
              <h3>
                <a href={i.url} target="_blank" rel="noreferrer">
                  {i.title} <ExternalLink size={14} />
                </a>
              </h3>
              <p>{i.summary}</p>
              <span className="source-note">{i.source}</span>
            </article>
          ))}
        </div>
        {!busy && !socialBusy && !items.length && (
          <p className="empty">
            No updates match this selection. Try another search or browse the
            official sources.
          </p>
        )}
      </section>
      <aside className="panel updates-sources">
        <h2>Official sources</h2>
        <p>
          Explore notices, publications and social posts directly from IRCC.
        </p>
        {sources.map(([title, description, url]) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <strong>
              {title} <ExternalLink size={14} />
            </strong>
            <span>{description}</span>
          </a>
        ))}
        <p className="source-note">
          X uses posts available on IRCC’s public profile; YouTube uses its
          public video feed. These may contain a limited selection, not a
          complete archive. Facebook, Instagram and LinkedIn remain available
          through the official channels link. Updates do not trigger draw alert
          emails.
        </p>
      </aside>
    </div>
  );
}
