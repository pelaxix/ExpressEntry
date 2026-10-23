import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
type Occupation = {
  code: string;
  title: string;
  teer: number;
  group: string;
  description: string;
  examples: string[];
  duties: string[];
  requirements: string[];
  exclusions: string[];
  additional: string[];
  url: string;
};
type Catalogue = {
  items: Occupation[];
  updatedAt?: string;
  error?: string;
  version?: string;
};
export default function Noc() {
  const [data, setData] = useState<Catalogue>({ items: [] }),
    [busy, setBusy] = useState(true),
    [query, setQuery] = useState(""),
    [teer, setTeer] = useState("All"),
    [group, setGroup] = useState("All"),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState("");
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/noc");
      if (!r.ok) throw Error();
      setData(await r.json());
    } catch {
      setData((d) => ({
        ...d,
        error:
          "The NOC catalogue is unavailable right now. Try the official source below.",
      }));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = data.items.filter(
    (i) =>
      (teer === "All" || String(i.teer) === teer) &&
      (group === "All" || i.group === group) &&
      terms.every((t) =>
        (
          i.code +
          " " +
          i.title +
          " " +
          i.description +
          " " +
          i.examples.join(" ")
        )
          .toLowerCase()
          .includes(t),
      ),
  );
  const count = Math.max(1, Math.ceil(filtered.length / 25)),
    current = Math.min(page, count),
    item = data.items.find((i) => i.code === selected);
  return (
    <div className="insight-stack">
      <section className="panel insight-panel">
        <h2>Find an occupation</h2>
        <p>
          Browse all five-digit NOC 2021 occupation groups. Search codes,
          titles, descriptions and official example job titles.
        </p>
        <div className="noc-controls">
          <label>
            Search
            <input
              type="search"
              placeholder="e.g. 20012, IT manager, nurse"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            TEER
            <select
              value={teer}
              onChange={(e) => {
                setTeer(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All TEER categories</option>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <option value={n} key={n}>
                  TEER {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Occupational category
            <select
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All occupational categories</option>
              {[...new Set(data.items.map((i) => i.group))].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <button
            className="button"
            disabled={busy}
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            {busy ? "Loading…" : "Refresh catalogue"}
          </button>
        </div>
        {data.error && (
          <p className="notice" role="status">
            {data.error}
          </p>
        )}
        <p className="source-note">
          {data.version || "NOC 2021 Version 1.0"} · {data.items.length}{" "}
          occupations · {filtered.length} matches
          {data.updatedAt
            ? ` · Last fetched ${new Date(data.updatedAt).toLocaleString()}`
            : ""}
        </p>
        {busy && !data.items.length && (
          <p role="status">
            Fetching the official catalogue. The first load can take a few
            seconds.
          </p>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Occupation</th>
                <th>TEER</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 25, current * 25).map((i) => (
                <tr key={i.code}>
                  <td>{i.code}</td>
                  <td>
                    <button
                      className="text-button noc-title"
                      onClick={() => {
                        setSelected(i.code);
                        document
                          .getElementById("noc-detail")
                          ?.scrollIntoView({ block: "start" });
                      }}
                    >
                      {i.title}
                    </button>
                  </td>
                  <td>{i.teer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!busy && !filtered.length && (
          <p className="empty">
            No matching occupations. Try a related title or clear the filters.
          </p>
        )}
        <div className="noc-pagination">
          <button
            className="button"
            disabled={current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Previous
          </button>
          <span>
            Page {current} of {count}
          </span>
          <button
            className="button"
            disabled={current >= count}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      </section>
      <section
        className="panel insight-panel"
        id="noc-detail"
        aria-live="polite"
      >
        {item ? (
          <>
            <h2>
              {item.code} · {item.title}
            </h2>
            <p>
              TEER {item.teer} · {item.group}
            </p>
            <p>{item.description}</p>
            {(
              [
                ["Main duties", item.duties],
                ["Employment requirements", item.requirements],
                ["Example job titles", item.examples],
                ["Exclusions", item.exclusions],
                ["Additional information", item.additional],
              ] as [string, string[]][]
            ).map(([label, values]) =>
              values.length ? (
                <details
                  className="noc-details"
                  key={label}
                  open={label === "Main duties"}
                >
                  <summary>
                    {label} ({values.length})
                  </summary>
                  <ul>
                    {values.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                </details>
              ) : null,
            )}
            <a href={item.url} target="_blank" rel="noreferrer">
              View official NOC profile <ExternalLink size={14} />
            </a>
          </>
        ) : (
          <p>
            Select an occupation above to read its duties, requirements and
            example job titles.
          </p>
        )}
        <p className="source-note">
          Match your actual duties and responsibilities, not just your job
          title. This catalogue does not determine immigration eligibility.
        </p>
      </section>
      <p className="source-note">
        Source:{" "}
        <a
          href="https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1"
          target="_blank"
          rel="noreferrer"
        >
          Statistics Canada · NOC 2021 Version 1.0
        </a>
        . Adapted from the official classification structure and elements files
        under the Statistics Canada Open Licence. Checked automatically when
        opened, at most once per day. A newer NOC edition is not automatically
        substituted for the version used by this catalogue.
      </p>
    </div>
  );
}
