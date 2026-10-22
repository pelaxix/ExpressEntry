export const SOURCE =
  "https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json";
export const OFFICIAL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/rounds-invitations.html";
export type Raw = Record<string, string>;
export type Draw = {
  id: number;
  date: string;
  name: string;
  category: string;
  invitations: number;
  crs: number;
  time: string;
  tieBreak: string;
  programs: string;
  poolDate: string;
  pool: number[];
  url: string;
};
export const BANDS = [
  "601–1,200",
  "501–600",
  "451–500",
  "491–500",
  "481–490",
  "471–480",
  "461–470",
  "451–460",
  "401–450",
  "441–450",
  "431–440",
  "421–430",
  "411–420",
  "401–410",
  "351–400",
  "301–350",
  "0–300",
];
export const LEAVES = [0, 1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16];
export const BROAD = [0, 1, 2, 8, 14, 15, 16];
export function num(v: unknown): number {
  return Number(String(v ?? "").replace(/,/g, ""));
}
export function category(name: string) {
  const n = name.toLowerCase();
  if (n.includes("provincial nominee")) return "PNP";
  if (n.includes("canadian experience")) return "CEC";
  if (n.includes("french")) return "French";
  if (n.includes("healthcare")) return "Healthcare & social services";
  if (n.includes("trade"))
    return n.includes("federal skilled") ? "Federal Skilled Trades" : "Trades";
  if (n.includes("stem")) return "STEM";
  if (n.includes("education")) return "Education";
  if (n.includes("transport")) return "Transport";
  if (n.includes("agriculture")) return "Agriculture";
  if (n.includes("federal skilled worker")) return "Federal Skilled Worker";
  if (n.includes("no program") || n === "general") return "General";
  return name.replace(/,?\s*202\d.*$/, "").trim();
}
export function normalize(raw: Raw[]): Draw[] {
  const map = new Map<number, Draw>();
  for (const r of raw) {
    const id = num(r.drawNumber),
      invitations = num(r.drawSize),
      crs = num(r.drawCRS);
    if (
      !Number.isInteger(id) ||
      id < 1 ||
      !/^\d{4}-\d\d-\d\d$/.test(r.drawDate) ||
      !Number.isInteger(crs) ||
      crs < 0 ||
      crs > 1200 ||
      !Number.isInteger(invitations) ||
      invitations < 0
    )
      continue;
    if (map.has(id)) continue;
    map.set(id, {
      id,
      date: r.drawDate,
      name: r.drawName,
      category: category(r.drawName),
      invitations,
      crs,
      time: r.drawDateTime || "",
      tieBreak: r.drawCutOff || "",
      programs: r.drawText2 || "",
      poolDate: r.drawDistributionAsOn || "",
      pool: Array.from({ length: 18 }, (_, i) =>
        r["dd" + (i + 1)] ? num(r["dd" + (i + 1)]) : NaN,
      ),
      url:
        OFFICIAL.replace(
          "/services/immigrate-canada/express-entry/rounds-invitations.html",
          "/corporate/mandate/policies-operational-instructions-agreements/ministerial-instructions/express-entry-rounds/invitations.html",
        ) +
        "?q=" +
        id,
    });
  }
  return [...map.values()].sort((a, b) => b.id - a.id);
}
export function poolValid(d: Draw) {
  return (
    d.pool.length === 18 &&
    d.pool.every(Number.isFinite) &&
    LEAVES.reduce((s, i) => s + d.pool[i], 0) === d.pool[17]
  );
}
export function poolSnapshots(draws: Draw[]) {
  const seen = new Set<string>();
  return draws.filter(
    (d) =>
      poolValid(d) &&
      d.poolDate &&
      !seen.has(d.poolDate) &&
      !!seen.add(d.poolDate),
  );
}
export function signed(n: number) {
  return (n > 0 ? "+" : "") + n.toLocaleString("en-CA");
}

/** Padded CRS bounds for the visible results; never flatten a narrow trend to 0–1200. */
export function crsDomain(values: number[], reference: number | null = null): [number, number] {
  const finite = values.filter((n) => Number.isFinite(n) && n >= 0 && n <= 1200);
  if (reference !== null && Number.isFinite(reference) && reference >= 0 && reference <= 1200) finite.push(reference);
  if (!finite.length) return [0, 1200];
  const min = Math.min(...finite), max = Math.max(...finite);
  const padding = Math.max(3, (max - min) * 0.12);
  const roughStep = (max - min + padding * 2) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = ([1, 2, 5, 10].find((n) => n * magnitude >= roughStep) ?? 10) * magnitude;
  return [Math.max(0, Math.floor((min - padding) / step) * step), Math.min(1200, Math.ceil((max + padding) / step) * step)];
}
