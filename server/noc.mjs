import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
export const NOC_SOURCE =
  "https://www.statcan.gc.ca/en/subjects/standard/noc/2021/indexV1";
export const NOC_URLS = [
  `${NOC_SOURCE}/noc-2021-v1.0-classification-structure.csv`,
  `${NOC_SOURCE}/noc-2021-v1.0-elements.csv`,
];
export function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') {
      if (field) throw Error("Invalid CSV quotes");
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw Error("Incomplete CSV");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  if (!rows.length) throw Error("Empty CSV");
  const headers = rows.shift().map((s) => s.replace(/^\uFEFF/, ""));
  return rows.map((cells) => {
    if (cells.length !== headers.length) throw Error("Invalid CSV columns");
    return Object.fromEntries(headers.map((h, i) => [h, cells[i].trim()]));
  });
}
export function normalizeNoc(structure, elements) {
  const rows = parseCSV(structure),
    groups = new Map(
      rows
        .filter((r) => r.Level === "1")
        .map((r) => [r["Code - NOC 2021 V1.0"], r["Class title"]]),
    );
  const codes = new Map();
  for (const r of rows) {
    const code = r["Code - NOC 2021 V1.0"];
    if (r.Level !== "5") continue;
    if (
      !/^\d{5}$/.test(code) ||
      !r["Class title"] ||
      !r["Class definition"] ||
      !/[0-5]/.test(code[1]) ||
      codes.has(code)
    )
      throw Error("Invalid NOC structure");
    codes.set(code, {
      code,
      title: r["Class title"],
      description: r["Class definition"],
      teer: Number(code[1]),
      group: groups.get(code[0]) || "",
      examples: [],
      duties: [],
      requirements: [],
      exclusions: [],
      additional: [],
      url: `https://noc.esdc.gc.ca/Structure/NOCProfile?Code=${code}&Version=2021.0&GocTemplateCulture=en-CA`,
    });
  }
  for (const r of parseCSV(elements)) {
    const item = codes.get(r["Code - NOC 2021 V1.0"]);
    if (!item) continue;
    const key = {
      "All examples": "examples",
      "Main duties": "duties",
      "Employment requirements": "requirements",
      "Exclusion(s)": "exclusions",
      "Additional information": "additional",
    }[r["Element Type Label English"]];
    const value = r["Element Description English"];
    if (key && value && !item[key].includes(value)) item[key].push(value);
  }
  if (
    codes.size !== 516 ||
    [...codes.values()].some((i) => !i.examples.length || !i.duties.length)
  )
    throw Error("Incomplete NOC 2021 catalogue");
  return [...codes.values()].sort((a, b) => a.code.localeCompare(b.code));
}
export function createNocFeed(dataDir, fetcher = fetch) {
  const file = join(dataDir, "noc-2021.json");
  let cached = {
      items: [],
      updatedAt: null,
      version: "NOC 2021 Version 1.0",
      source: NOC_SOURCE,
    },
    pending,
    nextAt = 0;
  try {
    const saved = JSON.parse(readFileSync(file, "utf8"));
    if (saved.version === cached.version && saved.items?.length === 516)
      cached = { ...saved, error: undefined };
  } catch {}
  return async () => {
    if (Date.now() < nextAt) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const texts = await Promise.all(
          NOC_URLS.map(async (url) => {
            const r = await fetcher(url, {
              signal: AbortSignal.timeout(25000),
            });
            if (!r.ok) throw Error("Source unavailable");
            return r.text();
          }),
        );
        const next = {
          version: cached.version,
          source: NOC_SOURCE,
          updatedAt: new Date().toISOString(),
          items: normalizeNoc(...texts),
        };
        writeFileSync(file + ".tmp", JSON.stringify(next));
        renameSync(file + ".tmp", file);
        cached = next;
        nextAt = Date.now() + 24 * 60 * 60000;
      } catch {
        cached = {
          ...cached,
          error:
            "Could not refresh Statistics Canada data. Showing the last saved catalogue, if available.",
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
