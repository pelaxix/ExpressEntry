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
type HighWage = {
  entries: Record<
    string,
    { tier: string; experienceBonus: number; offerPoints: number }
  > | null;
  updatedAt?: string;
  error?: string;
};
const wageSource =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/high-wage.html";
const wageRules =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html";
export default function Noc() {
  const [wages, setWages] = useState<HighWage>({ entries: null }),
    [wageFilter, setWageFilter] = useState("All"),
    [wageBusy, setWageBusy] = useState(true);
  async function loadWages() {
    setWageBusy(true);
    try {
      const r = await fetch("/api/high-wage");
      if (!r.ok) throw Error();
      setWages(await r.json());
    } catch {
      setWages((w) => ({
        ...w,
        error: "High-wage status unavailable. Check the official IRCC list.",
      }));
    } finally {
      setWageBusy(false);
    }
  }
  function wageLabel(code: string) {
    if (!wages.entries) return "Unverified";
    const w = wages.entries[code];
    return w ? `${w.tier}× tier` : "Not listed";
  }

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
    void loadWages();
  }, []);
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const filtered = data.items.filter(
    (i) =>
      (wageFilter === "All" ||
        (!!wages.entries &&
          (wageFilter === "Listed"
            ? !!wages.entries[i.code]
            : wages.entries[i.code]?.tier === wageFilter))) &&
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
        <section className="notice">
          <strong>High-wage CRS changes · Effective November 3, 2026</strong>
          <p>
            Shown as announced rules. Experience column: extra points after at
            least 12 months (1,560 hours) of qualifying Canadian experience in
            that tier. Offer column: points for a qualifying offer, not an extra
            bonus on top of Canadian experience.
          </p>
          <p>
            IRCC compares total Canadian work-experience points (work-length +
            high-wage bonus) with qualifying-offer points and uses the higher
            score. They are not added together. The tier comes from the NOC’s
            national median wage, not your salary.
          </p>
          <a href={wageRules} target="_blank" rel="noreferrer">
            Read IRCC’s eligibility and scoring rules
          </a>
        </section>
        {wageBusy && <p role="status">Checking the official high-wage list…</p>}
        {wages.error && (
          <p className="notice" role="status">
            {wages.error}
          </p>
        )}
        {wages.updatedAt && (
          <p className="source-note">
            High-wage list fetched {new Date(wages.updatedAt).toLocaleString()}{" "}
            ·{" "}
            <a href={wageSource} target="_blank" rel="noreferrer">
              Official IRCC list
            </a>
          </p>
        )}
        <div className="noc-controls">
          <label>
            High-wage status
            <select
              disabled={!wages.entries}
              value={wageFilter}
              onChange={(e) => {
                setWageFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="All">All occupations</option>
              <option value="Listed">All listed high-wage occupations</option>
              <option value="2">2× tier</option>
              <option value="1.5">1.5× tier</option>
              <option value="1.3">1.3× tier</option>
            </select>
          </label>
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
            onClick={() => {
              void load();
              void loadWages();
            }}
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
                <th>High-wage list</th>
                <th>12-month Canadian bonus</th>
                <th>Qualifying offer points</th>
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
                  <td>{wageLabel(i.code)}</td>
                  <td>
                    {!wages.entries
                      ? "—"
                      : wages.entries[i.code]
                        ? `+${wages.entries[i.code].experienceBonus}`
                        : "0"}
                  </td>
                  <td>
                    {!wages.entries
                      ? "—"
                      : wages.entries[i.code]?.offerPoints || "0"}
                  </td>
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
            <div className="notice">
              <strong>High-wage status: {wageLabel(item.code)}</strong>
              {wages.entries?.[item.code] ? (
                <p>
                  Under the rules effective November 3, 2026: +
                  {wages.entries[item.code].experienceBonus} points after
                  qualifying Canadian experience of at least 12 months in this
                  tier, or {wages.entries[item.code].offerPoints}{" "}
                  qualifying-offer points. The offer replaces the Canadian
                  work-experience component if higher; it is not added to it.
                </p>
              ) : (
                <p>
                  {wages.entries
                    ? "No high-wage bonus or high-wage offer points listed for this NOC. Ordinary qualifying Canadian work-length points may still apply."
                    : "This status has not been verified. Do not interpret it as ineligible."}
                </p>
              )}
              <a href={wageSource} target="_blank" rel="noreferrer">
                Verify with IRCC
              </a>
            </div>
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
