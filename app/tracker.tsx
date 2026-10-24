import Calculator from "./calculator";
import Noc from "./noc";
import { Standing, PoolCompare, DrawCalendar } from "./insights";
import Updates from "./updates";
import Notifications, { Unsubscribe } from "./notifications";
import Admin from "./admin";
("use client");
import { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Table2,
  Bell,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  Download,
  Search,
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Check,
  Info,
  ExternalLink,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  crsDomain,
  BANDS,
  BROAD,
  LEAVES,
  OFFICIAL,
  poolSnapshots,
  signed,
  type Draw,
} from "../lib/ircc";

type Data = {
  poolSnapshots?: Draw[];
  monitoring?: { intervalMinutes: number; background: boolean };
  archive?: { draws: number; poolSnapshots: number };
  draws: Draw[];
  fetchedAt: string;
  mode: string;
  monitor?: {
    checkedAt: string;
    ok: boolean;
    error?: string;
    deliveryError?: string;
  };
};
type Prefs = { enabled: boolean; email: string; categories: string[] };
const fmt = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString("en-CA") : "—";
const date = (s: string) =>
  new Date(s + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const shortDate = (s: number) =>
  new Date(s).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const colors = [
  "var(--accent)",
  "var(--chart2)",
  "var(--chart3)",
  "var(--chart4)",
  "var(--chart5)",
];
const titles = {
  overview: "Draw overview",
  draws: "Draw history",
  pool: "CRS pool distribution",
  standing: "Where do I stand?",
  compare: "Compare pool snapshots",
  calendar: "Draw calendar",
  calculator: "CRS calculator",
  noc: "NOC occupation search",
  updates: "IRCC updates",
  alerts: "Notifications",
  admin: "Administration",
  unsubscribe: "Unsubscribe",
};
const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "draws", label: "Draw history", icon: Table2 },
  { id: "pool", label: "Candidate pool", icon: ChartNoAxesCombined },
  { id: "standing", label: "My CRS comparison", icon: Info },
  { id: "compare", label: "Compare pools", icon: ChartNoAxesCombined },
  { id: "calendar", label: "Draw calendar", icon: Table2 },
  { id: "calculator", label: "CRS calculator", icon: Table2 },
  { id: "noc", label: "NOC codes", icon: Search },
  { id: "updates", label: "IRCC updates", icon: ExternalLink },
  { id: "alerts", label: "Notifications", icon: Bell },
] as const;
function Panel({
  title,
  sub,
  action,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="select-label">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}
function Details({ draw, onClose }: { draw: Draw; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="draw-title"
    >
      <div className="dialog-head">
        <span>Round #{draw.id}</span>
        <button aria-label="Close draw details" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <h2 id="draw-title">{draw.name}</h2>
      <p>{date(draw.date)}</p>
      <div className="detail-nums">
        <Metric
          label="CRS cutoff"
          value={fmt(draw.crs)}
          detail="Lowest-ranked candidate invited"
        />
        <Metric
          label="Invitations"
          value={fmt(draw.invitations)}
          detail="Invitations to apply issued"
        />
      </div>
      <dl>
        <dt>Date and time</dt>
        <dd>{draw.time || "Not published"}</dd>
        <dt>Tie-breaking rule</dt>
        <dd>{draw.tieBreak || "Not published"}</dd>
        <dt>Eligible programs</dt>
        <dd>{draw.programs || "See ministerial instructions"}</dd>
        <dt>Pool snapshot</dt>
        <dd>{draw.poolDate || "Not published"}</dd>
      </dl>
      <p className="note">
        Meeting the CRS cutoff alone does not establish eligibility. The draw’s
        program, category and tie-breaking rule also apply.
      </p>
      <a
        className="button primary"
        target="_blank"
        rel="noreferrer"
        href={draw.url}
      >
        Read ministerial instructions <ArrowUpRight size={16} />
      </a>
    </dialog>
  );
}
function DrawTable({
  draws,
  onSelect,
}: {
  draws: Draw[];
  onSelect: (d: Draw) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="draw-table">
        <thead>
          <tr>
            <th>Round / date</th>
            <th>Invitation round</th>
            <th className="num">Invitations</th>
            <th className="num">CRS cutoff</th>
            <th>
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {draws.map((d) => (
            <tr key={d.id}>
              <td>
                <button
                  className="text-button round"
                  onClick={() => onSelect(d)}
                >
                  #{d.id}
                </button>
                <span className="subline">{date(d.date)}</span>
              </td>
              <td>
                <span className="category">{d.category}</span>
                <span className="subline long-name">{d.name}</span>
              </td>
              <td className="num">{fmt(d.invitations)}</td>
              <td className="num cutoff">{fmt(d.crs)}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={"View draw " + d.id}
                  onClick={() => onSelect(d)}
                >
                  <ArrowUpRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!draws.length && (
        <p className="empty">
          No draws match these filters. Try another year or category.
        </p>
      )}
    </div>
  );
}
function Trend({ draws, score }: { draws: Draw[]; score: number | null }) {
  const data = [...draws]
    .reverse()
    .map((d) => ({ ...d, t: Date.parse(d.date + "T12:00:00Z") }));
  const categories = new Set(draws.map((d) => d.category));
  const mixed = categories.size > 1;
  const yDomain = crsDomain(
    draws.map((d) => d.crs),
    score,
  );
  const shared = (
    <>
      <CartesianGrid
        vertical={false}
        stroke="var(--border)"
        strokeDasharray="3 4"
      />
      <XAxis
        dataKey="t"
        type="number"
        domain={["dataMin", "dataMax"]}
        tickFormatter={shortDate}
        tick={{ fill: "var(--muted)", fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        minTickGap={35}
        tickCount={5}
      />
      <YAxis
        dataKey="crs"
        domain={yDomain}
        allowDecimals={false}
        tickCount={5}
        tick={{ fill: "var(--muted)", fontSize: 12 }}
        axisLine={false}
        tickLine={false}
        width={42}
      />
      <Tooltip
        content={({ active, payload }) => {
          const d = payload?.[0]?.payload as Draw;
          return active && d ? (
            <div className="chart-tip">
              <strong>
                {d.category} · #{d.id}
              </strong>
              <span>
                {date(d.date)} · CRS {d.crs}
              </span>
              <span>{fmt(d.invitations)} invitations</span>
            </div>
          ) : null;
        }}
      />
      {score !== null && (
        <ReferenceLine
          y={score}
          stroke="var(--text)"
          strokeDasharray="4 4"
          label={{
            value: "Your CRS " + score,
            fill: "var(--text)",
            fontSize: 11,
            position: "insideTopRight",
          }}
        />
      )}
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={
        "CRS cutoffs over time, " +
        draws.length +
        " draws. " +
        (mixed
          ? "Separate dots represent different draw categories."
          : "Line connects draws in the same category.")
      }
    >
      <span className="axis-caption">CRS points</span>
      {!data.length ? (
        <div className="empty">No draws in this selection.</div>
      ) : (
        <ResponsiveContainer width="100%" height={214}>
          {mixed ? (
            <ScatterChart margin={{ top: 8, right: 15, bottom: 4, left: 0 }}>
              {shared}
              <Scatter
                data={data}
                fill="var(--accent)"
                isAnimationActive={false}
              />
            </ScatterChart>
          ) : (
            <LineChart
              data={data}
              margin={{ top: 8, right: 15, bottom: 4, left: 0 }}
            >
              {shared}
              <Line
                dataKey="crs"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={data.length === 1}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}
      <span className="axis-bottom">
        Draw date{mixed ? " · Categories shown as separate observations" : ""}
      </span>
    </div>
  );
}
function Share({ draws }: { draws: Draw[] }) {
  const parts = useMemo(() => {
    const map = new Map<string, number>();
    draws.forEach((d) =>
      map.set(d.category, (map.get(d.category) || 0) + d.invitations),
    );
    const rows = [...map].sort((a, b) => b[1] - a[1]);
    const first = rows.slice(0, 4).map(([name, value]) => ({ name, value }));
    if (rows.length > 4)
      first.push({
        name: "Other",
        value: rows.slice(4).reduce((s, d) => s + d[1], 0),
      });
    return first;
  }, [draws]);
  const total = parts.reduce((s, d) => s + d.value, 0);
  return (
    <div className="share-body">
      {total ? (
        <>
          <div
            className="donut"
            role="img"
            aria-label="Share of invitations by draw category"
          >
            <ResponsiveContainer width="100%" height={136}>
              <PieChart>
                <Pie
                  data={parts}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={57}
                  paddingAngle={2}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {parts.map((p, i) => (
                    <Cell key={p.name} fill={colors[i]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => fmt(Number(v))}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="legend-table">
            {parts.map((p, i) => (
              <div key={p.name}>
                <span>
                  <i style={{ background: colors[i] }} />
                  {p.name}
                </span>
                <strong>
                  {((p.value / total) * 100).toFixed(1)}%
                  <small>{fmt(p.value)}</small>
                </strong>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="empty">No invitations in this selection.</p>
      )}
    </div>
  );
}
function PoolBars({ draw }: { draw: Draw }) {
  const values = BROAD.map((i) => ({ name: BANDS[i], value: draw.pool[i] }));
  return (
    <div
      className="pool-bars"
      role="img"
      aria-label="Candidates by published CRS score band. Band widths differ; bars show total candidates, not density."
    >
      <ResponsiveContainer width="100%" height={244}>
        <BarChart
          data={values}
          layout="vertical"
          margin={{ left: 2, right: 16, top: 0, bottom: 0 }}
        >
          <CartesianGrid
            horizontal={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            type="number"
            tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(v))}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={82}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(v) => [fmt(Number(v)), "Candidates"]}
            cursor={{ fill: "var(--raised)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              color: "var(--text)",
            }}
          />
          <Bar
            dataKey="value"
            fill="var(--accent)"
            barSize={13}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <span className="axis-bottom">
        Number of candidates · Published bands have unequal widths
      </span>
    </div>
  );
}
function PoolTable({
  draw,
  previous,
  full = false,
}: {
  draw: Draw;
  previous?: Draw;
  full?: boolean;
}) {
  const [expanded, setExpanded] = useState(full);
  const ids = expanded ? Array.from({ length: 17 }, (_, i) => i) : BROAD;
  const total = draw.pool[17];
  return (
    <>
      <div className="table-wrap">
        <table className="pool-table">
          <thead>
            <tr>
              <th>CRS score range</th>
              <th className="num">Candidates</th>
              <th className="num">Share</th>
              {previous && <th className="num">Change</th>}
            </tr>
          </thead>
          <tbody>
            {ids.map((i) => (
              <tr
                key={i}
                className={
                  i === 2 || i === 8
                    ? "subtotal"
                    : [3, 4, 5, 6, 7, 9, 10, 11, 12, 13].includes(i) && expanded
                      ? "child-row"
                      : ""
                }
              >
                <td>
                  {BANDS[i]}
                  {(i === 2 || i === 8) && expanded && <small> subtotal</small>}
                </td>
                <td className="num">{fmt(draw.pool[i])}</td>
                <td className="num muted">
                  {((draw.pool[i] / total) * 100).toFixed(1)}%
                </td>
                {previous && (
                  <td className="num muted">
                    {signed(draw.pool[i] - previous.pool[i])}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>Total pool</th>
              <td className="num">{fmt(total)}</td>
              <td className="num">100%</td>
              {previous && (
                <td className="num">{signed(total - previous.pool[17])}</td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      {!full && (
        <button
          className="text-button more"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Hide detailed bands" : "Show detailed 10-point bands"}{" "}
          <ArrowRight size={14} />
        </button>
      )}
    </>
  );
}
export default function Dashboard() {
  const [view, setView] = useState<keyof typeof titles>(
      new URLSearchParams(window.location.search).has("unsubscribe")
        ? "unsubscribe"
        : "overview",
    ),
    [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(() => {
      try {
        return localStorage.getItem("ee-theme-choice") === "dark";
      } catch {
        return false;
      }
    }),
    [year, setYear] = useState(String(new Date().getFullYear())),
    [cat, setCat] = useState("All categories"),
    [trendCat, setTrendCat] = useState("CEC"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Draw | null>(null),
    [poolId, setPoolId] = useState(""),
    [scoreText, setScoreText] = useState(""),
    [message, setMessage] = useState("");
  const unsubscribeToken = new URLSearchParams(window.location.search).get(
    "unsubscribe",
  );
  const score =
    scoreText !== "" && Number(scoreText) >= 0 && Number(scoreText) <= 1200
      ? Number(scoreText)
      : null;
  async function load() {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Could not load draw data.");
    setData(await res.json());
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/sync", { method: "POST" });
      const j = (await r.json()) as { error?: string; cached?: boolean };
      await load();
      if (!r.ok) throw new Error(j.error || "IRCC refresh failed.");
      setMessage(
        j.cached
          ? "IRCC was checked just now. These are the latest shared results."
          : "IRCC checked. Shared results updated.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load().catch((e) => setError(e.message));
    const s = localStorage.getItem("ee-score");
    if (s) setScoreText(s);
    const timer = setInterval(() => load().catch(() => {}), 60000);
    const events = new EventSource("/api/events");
    events.addEventListener("updated", () => load().catch(() => {}));
    return () => {
      clearInterval(timer);
      events.close();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem("ee-theme-choice", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    localStorage.setItem("ee-score", scoreText);
  }, [scoreText]);
  useEffect(() => {
    setPage(1);
  }, [year, cat, query]);
  const draws = data?.draws || [],
    latest = draws[0];
  const categories = [...new Set(draws.map((d) => d.category))].sort();
  const years = [...new Set(draws.map((d) => d.date.slice(0, 4)))]
    .sort()
    .reverse();
  const scoped = draws.filter(
    (d) =>
      (year === "All years" || d.date.startsWith(year)) &&
      (cat === "All categories" || d.category === cat),
  );
  const filtered = scoped.filter((d) =>
    (d.name + " " + d.category + " " + d.id + " " + d.date)
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const trend = draws.filter(
    (d) =>
      (year === "All years" || d.date.startsWith(year)) &&
      (trendCat === "All categories" || d.category === trendCat),
  );
  const snapshots = useMemo(
    () => data?.poolSnapshots || poolSnapshots(draws),
    [data],
  );
  const pool = snapshots.find((d) => String(d.id) === poolId) || snapshots[0];
  const poolIndex = pool ? snapshots.findIndex((d) => d.id === pool.id) : -1;
  const prevPool = snapshots[poolIndex + 1];
  const cec = draws.find((d) => d.category === "CEC"),
    priorCEC = draws.filter((d) => d.category === "CEC")[1];
  const invitations = scoped.reduce((s, d) => s + d.invitations, 0);
  function go(v: keyof typeof titles) {
    setView(v);
    setMenu(false);
    setMessage("");
    window.scrollTo({ top: 0 });
  }
  function exportCSV() {
    const rows = [
      [
        "Round",
        "Date",
        "Category",
        "Official round name",
        "Invitations",
        "CRS cutoff",
        "Tie-breaking rule",
        "Source",
      ],
      ...filtered.map((d) => [
        d.id,
        d.date,
        d.category,
        d.name,
        d.invitations,
        d.crs,
        d.tieBreak,
        d.url,
      ]),
    ];
    const csv = rows
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n");
    const u = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = u;
    a.download = "express-entry-draws-" + year + ".csv";
    a.click();
    URL.revokeObjectURL(u);
  }
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/" aria-label="Express Entry by Pelaxix">
          <span className="brand-mark">
            ee<span>.</span>
          </span>
          <div>
            Express Entry<small>by Pelaxix</small>
          </div>
        </a>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.6} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-card">
            <span className="source-dot" />
            Official IRCC data
            <p>
              Public draw results.
              <br />
              Straight from the source.
            </p>
            <a href={OFFICIAL} target="_blank" rel="noreferrer">
              Canada.ca <ArrowUpRight size={13} />
            </a>
          </div>
          <button className="nav-item" onClick={() => setDark(!dark)}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}{" "}
            {dark ? "Light appearance" : "Dark appearance"}
          </button>
          <a
            className="repo-link"
            href="https://github.com/pelaxix/ExpressEntry"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub <ArrowUpRight size={13} />
          </a>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-scrim"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Toggle menu"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
          <a href={OFFICIAL} target="_blank" rel="noreferrer">
            IRCC source <ExternalLink size={13} />
          </a>
        </header>
        <main className={view === "calculator" ? "crs-page" : undefined}>
          <div className="page-heading">
            <div>
              <h1>{titles[view]}</h1>
              <p>
                {view === "overview"
                  ? "The latest invitations, and the pool behind them."
                  : view === "draws"
                    ? "Every published round. The detail behind every cutoff."
                    : view === "pool"
                      ? "Candidates in the pool, by published CRS score band."
                      : view === "standing"
                        ? "Your score alongside published cutoffs and pool bands."
                        : view === "compare"
                          ? "See how the candidate pool changes between snapshots."
                          : view === "calendar"
                            ? "Published rounds by date and category."
                            : view === "calculator"
                              ? "Your points under current and November 3, 2026 rules."
                            : view === "noc"
                              ? "Official occupation codes, duties and TEER categories."
                              : view === "updates"
                                ? "Announcements and publications, straight from IRCC."
                                : view === "admin"
                                  ? "Manage subscribers and email delivery."
                                  : view === "unsubscribe"
                                    ? "Control the emails you receive."
                                    : "Get new draw results by email. No account needed."}
              </p>
            </div>
            <div className="header-actions">
              <button
                onClick={refresh}
                disabled={busy || !data}
                className="button"
              >
                <RefreshCw size={14} className={busy ? "spinning" : ""} />
                {busy ? "Checking IRCC…" : "Check now"}
              </button>
              {view !== "alerts" &&
                view !== "admin" &&
                view !== "unsubscribe" && (
                  <button
                    onClick={() => go("alerts")}
                    className="button primary"
                  >
                    <Bell size={14} />
                    Set up alerts
                  </button>
                )}
            </div>
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error} {data ? "The last saved data remains available." : ""}
              <button className="text-button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {data && (
            <div className="freshness">
              <span
                className={
                  "status-dot " + (data.mode === "bundled" ? "pending" : "")
                }
              />
              {data.mode === "bundled"
                ? "Official snapshot saved"
                : "Last successful IRCC fetch"}{" "}
              {new Date(data.fetchedAt).toLocaleString("en-CA", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZoneName: "short",
              })}
              <span className="freshness-extra">
                Public results · Updates after IRCC publishes
              </span>
            </div>
          )}
          {message && (
            <p className="refresh-note" role="status">
              {message}
            </p>
          )}
          {view === "calculator" && <Calculator />}
          {view === "calculator" ? null : !data ? (
            <div className="loading" aria-live="polite">
              <div className="loading-line" />
              <h2>Loading official draw data</h2>
              <p>Connecting to your saved IRCC results.</p>
            </div>
          ) : (
            <>
              {(view === "overview" || view === "draws") && (
                <>
                  <div className="filterbar">
                    <div>
                      <Select label="Draw year" value={year} onChange={setYear}>
                        <option>All years</option>
                        {years.map((y) => (
                          <option key={y}>{y}</option>
                        ))}
                      </Select>
                      <Select
                        label="Draw category"
                        value={cat}
                        onChange={setCat}
                      >
                        <option>All categories</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </Select>
                    </div>
                    <span>
                      {fmt(scoped.length)} rounds ·{" "}
                      {year === "All years" ? "All time" : year}
                    </span>
                  </div>
                  {view === "overview" && (
                    <>
                      <section
                        className="summary-strip"
                        aria-label="Draw summary"
                      >
                        <Metric
                          label="Latest round"
                          value={latest ? "#" + latest.id : "—"}
                          detail={
                            latest
                              ? date(latest.date) + " · " + latest.category
                              : "No published draws"
                          }
                        />
                        <Metric
                          label="Latest CEC cutoff"
                          value={cec ? fmt(cec.crs) : "—"}
                          detail={
                            cec && priorCEC
                              ? signed(cec.crs - priorCEC.crs) +
                                " vs previous CEC draw"
                              : "No comparison available"
                          }
                        />
                        <Metric
                          label="Invitations in selection"
                          value={fmt(invitations)}
                          detail={
                            cat === "All categories"
                              ? "Across all draw categories"
                              : cat
                          }
                        />
                        <Metric
                          label="Rounds in selection"
                          value={fmt(scoped.length)}
                          detail={
                            year === "All years"
                              ? "Since Express Entry began"
                              : year + " published rounds"
                          }
                        />
                      </section>
                      {latest && (
                        <div className="latest-strip">
                          <div>
                            <span className="label">
                              Latest invitation round
                            </span>
                            <strong>{latest.name}</strong>
                            <span>
                              {fmt(latest.invitations)} invitations · CRS{" "}
                              {latest.crs}
                            </span>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => setSelected(latest)}
                          >
                            Round details <ArrowUpRight size={15} />
                          </button>
                        </div>
                      )}
                      <div className="two-col">
                        <Panel
                          title="CRS cutoff over time"
                          sub={
                            year === "All years"
                              ? "All published draws in selection"
                              : year + " invitation rounds"
                          }
                          action={
                            <Select
                              label="Trend category"
                              value={trendCat}
                              onChange={setTrendCat}
                            >
                              <option>All categories</option>
                              {categories.map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </Select>
                          }
                        >
                          <Trend draws={trend} score={score} />
                          <div className="score-control">
                            <label htmlFor="score">Your CRS reference</label>
                            <input
                              id="score"
                              aria-describedby="score-note"
                              type="number"
                              min="0"
                              max="1200"
                              placeholder="Add score"
                              value={scoreText}
                              onChange={(e) => setScoreText(e.target.value)}
                            />
                            <span id="score-note">Saved on this device</span>
                          </div>
                        </Panel>
                        <Panel
                          title="Invitations by category"
                          sub={year + " · " + fmt(invitations) + " invitations"}
                        >
                          <Share draws={scoped} />
                        </Panel>
                      </div>
                      <div className="two-col lower">
                        <Panel
                          title="Recent draws"
                          sub={year + " · " + cat}
                          action={
                            <button
                              className="text-button"
                              onClick={() => go("draws")}
                            >
                              View all <ArrowRight size={14} />
                            </button>
                          }
                        >
                          <DrawTable
                            draws={scoped.slice(0, 5)}
                            onSelect={setSelected}
                          />
                        </Panel>
                        {pool && (
                          <Panel
                            title="Candidate pool"
                            sub={"As of " + pool.poolDate}
                            action={
                              <button
                                className="text-button"
                                onClick={() => go("pool")}
                              >
                                Explore <ArrowRight size={14} />
                              </button>
                            }
                          >
                            <div className="pool-total">
                              <strong>{fmt(pool.pool[17])}</strong>
                              <span>candidates in the pool</span>
                            </div>
                            <PoolTable draw={pool} />
                          </Panel>
                        )}
                      </div>
                    </>
                  )}
                  {view === "draws" && (
                    <Panel
                      title="Invitation rounds"
                      sub={fmt(filtered.length) + " matching rounds"}
                      action={
                        <button className="button" onClick={exportCSV}>
                          <Download size={14} />
                          Export CSV
                        </button>
                      }
                    >
                      <div className="searchbar">
                        <Search size={16} />
                        <input
                          aria-label="Search draws"
                          placeholder="Search round, date or category"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <DrawTable
                        draws={filtered.slice((page - 1) * 20, page * 20)}
                        onSelect={setSelected}
                      />
                      <div className="pagination">
                        <span>
                          {filtered.length
                            ? (page - 1) * 20 +
                              1 +
                              "–" +
                              Math.min(page * 20, filtered.length)
                            : "0"}{" "}
                          of {fmt(filtered.length)}
                        </span>
                        <div>
                          <button
                            className="button"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                          >
                            <ChevronLeft size={14} />
                            Previous
                          </button>
                          <button
                            className="button"
                            disabled={page * 20 >= filtered.length}
                            onClick={() => setPage(page + 1)}
                          >
                            Next
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </Panel>
                  )}
                </>
              )}
              {view === "pool" && pool && (
                <>
                  <div className="filterbar">
                    <Select
                      label="Pool snapshot date"
                      value={String(pool.id)}
                      onChange={setPoolId}
                    >
                      {snapshots.map((d) => (
                        <option value={d.id} key={d.id}>
                          {d.poolDate}
                        </option>
                      ))}
                    </Select>
                    <span>{snapshots.length} distinct published snapshots</span>
                  </div>
                  <section className="summary-strip pool-summary">
                    <Metric
                      label="Candidates in the pool"
                      value={fmt(pool.pool[17])}
                      detail={"As of " + pool.poolDate}
                    />
                    <Metric
                      label="CRS 501 and above"
                      value={fmt(pool.pool[0] + pool.pool[1])}
                      detail={
                        (
                          ((pool.pool[0] + pool.pool[1]) / pool.pool[17]) *
                          100
                        ).toFixed(1) + "% of the total pool"
                      }
                    />
                    <Metric
                      label="Change in total pool"
                      value={
                        prevPool
                          ? signed(pool.pool[17] - prevPool.pool[17])
                          : "—"
                      }
                      detail={
                        prevPool
                          ? "Since " + prevPool.poolDate
                          : "No earlier snapshot available"
                      }
                    />
                  </section>
                  <div className="two-col pool-layout">
                    <Panel
                      title="CRS score distribution"
                      sub={"Published bands · " + pool.poolDate}
                    >
                      <PoolBars draw={pool} />
                      <p className="note">
                        Each bar is the total in an official score band. The
                        bands cover different score ranges.
                      </p>
                      <div className="pool-context">
                        <Info size={16} />
                        <p>
                          IRCC publishes the pool overall. It does not break
                          this table down by program or category, so it cannot
                          tell us your exact rank within a CEC or category draw.
                        </p>
                      </div>
                    </Panel>
                    <Panel
                      title="Full distribution table"
                      sub={
                        prevPool
                          ? "Change since " + prevPool.poolDate
                          : "No earlier snapshot for comparison"
                      }
                    >
                      <PoolTable
                        key={pool.id}
                        draw={pool}
                        previous={prevPool}
                        full
                      />
                      <p className="note">
                        451–500 and 401–450 are subtotals. Their detailed rows
                        are already included in those totals and are counted
                        once.
                      </p>
                    </Panel>
                  </div>
                  <p className="source-note">
                    Pool snapshots can predate a draw. New profiles and expiring
                    profiles change the pool between published snapshots.
                  </p>
                </>
              )}
              {view === "pool" && !pool && (
                <p className="empty">
                  No complete pool distribution is available from the saved IRCC
                  data.
                </p>
              )}
              {view === "alerts" && (
                <Notifications
                  latest={latest}
                  categories={categories}
                  checkedAt={data.monitor?.checkedAt}
                  interval={data.monitoring?.intervalMinutes || 5}
                />
              )}
              {view === "standing" && (
                <Standing
                  draws={draws}
                  snapshots={snapshots}
                  categories={categories}
                />
              )}
              {view === "compare" && <PoolCompare snapshots={snapshots} />}
              {view === "calendar" && (
                <DrawCalendar draws={draws} categories={categories} />
              )}
              {view === "noc" && <Noc />}
              {view === "updates" && <Updates />}
              {view === "admin" && <Admin />}
              {view === "unsubscribe" && (
                <Unsubscribe token={unsubscribeToken || ""} />
              )}
            </>
          )}
          <footer>
            <span>Pelaxix · Express Entry</span>
            <p>
              Independent tracker using official IRCC data. Not affiliated with
              the Government of Canada.
            </p>
            <a href={OFFICIAL} target="_blank" rel="noreferrer">
              Verify with IRCC <ArrowUpRight size={12} />
            </a>
            <button className="text-button" onClick={() => go("admin")}>
              Admin
            </button>
          </footer>
        </main>
      </div>
      {selected && (
        <Details draw={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
