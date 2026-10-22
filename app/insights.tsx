import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { BANDS, LEAVES, signed, type Draw } from "../lib/ircc";
import { aboveScore, scoreOutcome, monthCells } from "../lib/insights";
const fmt = (n: number) => n.toLocaleString("en-CA");
function date(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function readProfile() {
  try {
    const p = JSON.parse(localStorage.getItem("ee-profile") || "{}");
    return {
      score: typeof p.score === "string" ? p.score : "",
      categories: Array.isArray(p.categories)
        ? p.categories.filter((v: unknown) => typeof v === "string")
        : ([] as string[]),
    };
  } catch {
    return { score: "", categories: [] as string[] };
  }
}
export function Standing({
  draws,
  snapshots,
  categories,
}: {
  draws: Draw[];
  snapshots: Draw[];
  categories: string[];
}) {
  const [profile, setProfile] = useState(readProfile);
  function save(next: typeof profile) {
    setProfile(next);
    try {
      localStorage.setItem("ee-profile", JSON.stringify(next));
    } catch {}
  }
  const score =
    profile.score.trim() !== "" &&
    Number.isInteger(Number(profile.score)) &&
    Number(profile.score) >= 0 &&
    Number(profile.score) <= 1200
      ? Number(profile.score)
      : null;
  const recent = draws
      .filter((d) => profile.categories.includes(d.category))
      .slice(0, 20),
    pool = snapshots[0],
    bounds = score !== null && pool ? aboveScore(pool, score) : null;
  return (
    <div className="insight-stack">
      <section className="panel insight-panel">
        <h2>Your CRS comparison</h2>
        <p>
          Choose the draw categories you are eligible for. This comparison uses
          your selections and does not assess eligibility.
        </p>
        <label className="score-label">
          Your CRS score
          <input
            type="number"
            min="0"
            max="1200"
            step="1"
            placeholder="0–1,200"
            value={profile.score}
            onChange={(e) => save({ ...profile, score: e.target.value })}
          />
        </label>
        {profile.score !== "" && score === null && (
          <p role="alert">Enter a whole number from 0 to 1,200.</p>
        )}
        <fieldset className="category-options">
          <legend>Eligible draw categories</legend>
          {categories.map((c) => (
            <label key={c}>
              <input
                type="checkbox"
                checked={profile.categories.includes(c)}
                onChange={(e) =>
                  save({
                    ...profile,
                    categories: e.target.checked
                      ? [...profile.categories, c]
                      : profile.categories.filter((v: string) => v !== c),
                  })
                }
              />
              {c}
            </label>
          ))}
        </fieldset>
        <p className="source-note">
          Saved only in this browser. No score or category selections are sent
          to the server.
        </p>
        <button
          className="text-button"
          onClick={() => save({ score: "", categories: [] })}
        >
          Clear my selections
        </button>
      </section>
      {score !== null && (
        <>
          <section className="panel insight-panel">
            <h2>Candidates above {fmt(score)}</h2>
            {bounds ? (
              <>
                <div className="insight-number">
                  {bounds.min === bounds.max
                    ? fmt(bounds.min)
                    : `${fmt(bounds.min)}–${fmt(bounds.max)}`}
                </div>
                <p>
                  Across the entire pool as of {pool.poolDate}. The range
                  reflects candidates inside your published score band whose
                  exact scores are unknown.
                </p>
                <p className="source-note">
                  This is not your rank within a category. Pool counts include
                  candidates with different eligibility.
                </p>
              </>
            ) : (
              <p>No complete pool snapshot is available.</p>
            )}
          </section>
          <section className="panel insight-panel">
            <h2>Your latest eligible draw comparisons</h2>
            <p>
              Latest 20 published rounds matching your selections. Historical
              comparison, not a prediction or invitation decision.
            </p>
            {!recent.length ? (
              <p className="empty">
                Select a category with published rounds to see comparisons.
              </p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Round / date</th>
                      <th>Category</th>
                      <th>Cutoff</th>
                      <th>Your gap</th>
                      <th>Comparison</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <a href={d.url} target="_blank" rel="noreferrer">
                            #{d.id}
                          </a>
                          <br />
                          {date(d.date)}
                        </td>
                        <td>{d.category}</td>
                        <td>{d.crs}</td>
                        <td>{signed(score - d.crs)}</td>
                        <td>{scoreOutcome(score, d.crs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="source-note">
              At the cutoff, IRCC's tie-breaking rule applies. Eligibility and
              profile status at the time of the draw also matter.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
export function PoolCompare({ snapshots }: { snapshots: Draw[] }) {
  const [from, setFrom] = useState(String(snapshots[1]?.id || "")),
    [to, setTo] = useState(String(snapshots[0]?.id || ""));
  const a = snapshots.find((s) => String(s.id) === from) || snapshots[1],
    b = snapshots.find((s) => String(s.id) === to) || snapshots[0];
  if (snapshots.length < 2)
    return (
      <p className="empty">
        Two complete pool snapshots are needed for a comparison.
      </p>
    );
  const rows = LEAVES.map((i) => ({
    band: BANDS[i],
    before: a.pool[i],
    after: b.pool[i],
    change: b.pool[i] - a.pool[i],
  }));
  return (
    <div className="insight-stack">
      <section className="panel insight-panel">
        <h2>Compare published pool snapshots</h2>
        <div className="compare-controls">
          <label>
            From
            <select
              value={String(a.id)}
              onChange={(e) => setFrom(e.target.value)}
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.poolDate}
                </option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={String(b.id)}
              onChange={(e) => setTo(e.target.value)}
            >
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.poolDate}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Change = To minus From. Choose any two dates; reversing them reverses
          the comparison.
        </p>
        <div className="insight-number">{signed(b.pool[17] - a.pool[17])}</div>
        <p>
          Total pool change · {fmt(a.pool[17])} → {fmt(b.pool[17])} candidates
        </p>
        <div
          className="pool-change-chart"
          role="img"
          aria-label="Candidate change by CRS band; exact figures in the table below"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ left: 15, right: 25 }}
            >
              <CartesianGrid stroke="var(--border)" horizontal={false} />
              <XAxis type="number" />
              <YAxis
                type="category"
                dataKey="band"
                width={90}
                tick={{ fontSize: 12 }}
              />
              <Tooltip />
              <Bar
                dataKey="change"
                name="Candidate change"
                fill="var(--accent)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CRS band</th>
                <th>From</th>
                <th>To</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.band}>
                  <th>{r.band}</th>
                  <td>{fmt(r.before)}</td>
                  <td>{fmt(r.after)}</td>
                  <td>{signed(r.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="source-note">
          Net changes include new profiles, expiring profiles, score changes and
          invitations. They do not measure invitations alone. Detailed bands do
          not overlap.
        </p>
      </section>
    </div>
  );
}
export function DrawCalendar({
  draws,
  categories,
}: {
  draws: Draw[];
  categories: string[];
}) {
  const [month, setMonth] = useState(() =>
      new Date().toLocaleDateString("en-CA").slice(0, 7),
    ),
    [category, setCategory] = useState("All categories");
  const shown = draws.filter(
      (d) => category === "All categories" || d.category === category,
    ),
    monthDraws = shown.filter((d) => d.date.startsWith(month));
  function step(n: number) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="insight-stack">
      <section className="panel insight-panel">
        <div className="compare-controls">
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value))
                  setMonth(e.target.value);
              }}
            />
          </label>
          <button
            className="button"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            Previous
          </button>
          <button
            className="button"
            onClick={() => step(1)}
            aria-label="Next month"
          >
            Next
          </button>
          <label>
            Draw category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option>All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <h2>
          {new Date(month + "-01T12:00:00").toLocaleDateString("en-CA", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <p>
          {monthDraws.length} published rounds ·{" "}
          {fmt(monthDraws.reduce((s, d) => s + d.invitations, 0))} invitations
        </p>
        <div className="draw-calendar">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div className="calendar-weekday" key={d}>
              {d}
            </div>
          ))}
          {monthCells(month).map((day, i) => (
            <div
              key={day || i}
              className={"calendar-day" + (!day ? " calendar-blank" : "")}
            >
              {day && (
                <>
                  <time dateTime={day}>{Number(day.slice(-2))}</time>
                  {monthDraws
                    .filter((d) => d.date === day)
                    .map((d) => (
                      <a
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <strong>{d.category}</strong>
                        <span>
                          #{d.id} · CRS {d.crs}
                        </span>
                        <span>{fmt(d.invitations)} invitations</span>
                      </a>
                    ))}
                </>
              )}
            </div>
          ))}
        </div>
        {!monthDraws.length && (
          <p className="empty">
            No published rounds for this month and category.
          </p>
        )}
        <p className="source-note">
          Published draws only. Empty dates do not predict when the next draw
          will happen.
        </p>
      </section>
      <section className="panel insight-panel">
        <h2>Time since the last draw</h2>
        <p>
          As of {today.toLocaleDateString("en-CA")}. Historical gaps are not a
          schedule.
        </p>
        <div className="category-gaps">
          {categories
            .filter((c) => category === "All categories" || c === category)
            .map((c) => {
              const last = draws.find((d) => d.category === c);
              if (!last) return null;
              const days = Math.max(
                0,
                Math.round(
                  (today.getTime() -
                    new Date(last.date + "T00:00:00").getTime()) /
                    86400000,
                ),
              );
              return (
                <div key={c}>
                  <strong>{c}</strong>
                  <b>{days} days</b>
                  <span>
                    {date(last.date)} · #{last.id}
                  </span>
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );
}
