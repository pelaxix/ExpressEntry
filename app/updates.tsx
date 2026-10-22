import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
type Item = { title: string; summary: string; date: string; url: string };
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
    const timer = setInterval(() => void load(), 15 * 60000);
    return () => clearInterval(timer);
  }, []);
  const items = feed.items.filter(
    (i) =>
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
            <h2>From the IRCC newsroom</h2>
            <p>
              Official publications, newest first. Open a headline to read the
              original.
            </p>
          </div>
          <button
            className="button"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            {busy ? "Loading…" : "Refresh news"}
          </button>
        </div>
        <div className="updates-controls">
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
        {feed.error && (
          <p className="notice" role="status">
            {feed.error}
          </p>
        )}
        {feed.updatedAt && (
          <p className="source-note">
            Last fetched {new Date(feed.updatedAt).toLocaleString()} · Refreshes
            every 15 minutes · {items.length} results
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
              <span className="source-note">IRCC · Canada.ca</span>
            </article>
          ))}
        </div>
        {!busy && !items.length && (
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
          The news feed contains newsroom publications. Social posts and program
          notices are available through the official links above. News updates
          do not trigger draw alert emails.
        </p>
      </aside>
    </div>
  );
}
