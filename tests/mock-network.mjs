// Only used by child-process HTTP tests; production never imports this file.
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
const raw = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../lib/data/ircc-snapshot.json.gz", import.meta.url)),
  ).toString("utf8"),
);
const original = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).includes("canada.ca/content/dam/ircc/"))
    return Response.json(raw);
  if (String(url).includes("api.brevo.com"))
    return Response.json({ messageId: "mock-email-id" }, { status: 201 });
  return original(url, options);
};
