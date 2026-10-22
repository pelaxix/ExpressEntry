/** Shared, email-client-safe presentation used by real alerts, tests and the site preview. */
const palette = {
  ground: "#f1f5f6",
  paper: "#ffffff",
  ink: "#152025",
  muted: "#58656b",
  line: "#e2e9eb",
  teal: "#1b6c80",
  tint: "#eef5f6",
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function safeUrl(value) {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "#";
  } catch {
    return "#";
  }
}
/** @param {{draw:import('./ircc.ts').Draw,publicUrl:string,unsubscribeToken?:string,test?:boolean,preview?:boolean}} options */
export function drawEmail({
  draw,
  publicUrl,
  unsubscribeToken,
  test = false,
  preview = false,
}) {
  const c = palette,
    category =
      draw.category === "CEC"
        ? "Canadian Experience Class"
        : draw.category === "PNP"
          ? "Provincial Nominee Program"
          : draw.category === "French"
            ? "French-language proficiency"
            : draw.category;
  const invitations = Number(draw.invitations).toLocaleString("en-CA"),
    cutoff = Number(draw.crs).toLocaleString("en-CA");
  const date = new Date(draw.date + "T12:00:00Z").toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const dashboard = safeUrl(publicUrl),
    official = safeUrl(draw.url),
    unsubscribe = unsubscribeToken
      ? safeUrl(
          publicUrl.replace(/\/$/, "") +
            "/?unsubscribe=" +
            encodeURIComponent(unsubscribeToken),
        )
      : null;
  const subject = `${test ? "[TEST] " : ""}Express Entry #${draw.id}: ${draw.category} · CRS ${draw.crs}`;
  const heading = test ? "Latest round · Test preview" : "New invitation round";
  const rows = [
    ["Round", `#${draw.id}`],
    ["Draw date", date],
    ["Date and time", draw.time || "See official instructions"],
    ["Tie-breaking rule", draw.tieBreak || "See official instructions"],
    ["Eligible programs", draw.programs || "See official instructions"],
  ];
  const details = rows
    .map(
      ([label, value]) =>
        `<tr><td class="detail-label" style="padding:12px 12px 12px 0;border-bottom:1px solid ${c.line};font-size:13px;line-height:20px;color:${c.muted};vertical-align:top;width:34%;">${esc(label)}</td><td style="padding:12px 0;border-bottom:1px solid ${c.line};font-size:13px;line-height:20px;color:${c.ink};vertical-align:top;">${esc(value)}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title><style>body{margin:0;padding:0}table{border-collapse:collapse}a{color:${c.teal}}@media only screen and (max-width:480px){.outer-pad{padding:16px 8px!important}.content-pad{padding-left:22px!important;padding-right:22px!important}.email-title{font-size:25px!important;line-height:32px!important}.metric-number{font-size:28px!important;line-height:36px!important}.metric-cell{padding:16px 10px!important}.detail-label{width:37%!important}}</style></head><body style="margin:0;padding:0;background:${c.ground};font-family:Arial,Helvetica,sans-serif;color:${c.ink};"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(category)} · CRS ${cutoff} · ${invitations} invitations · ${esc(date)}</div><table role="presentation" width="100%" style="width:100%;background:${c.ground};"><tr><td class="outer-pad" align="center" style="padding:32px 16px;"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" style="width:100%;max-width:600px;background:${c.paper};"><tr><td class="content-pad" style="padding:28px 36px 24px;border-bottom:1px solid ${c.line};"><table role="presentation" width="100%"><tr><td width="58" style="font-size:34px;line-height:38px;font-weight:bold;letter-spacing:-3px;color:${c.teal};">ee.</td><td style="font-size:15px;line-height:21px;font-weight:bold;">Express Entry<br><span style="font-size:12px;font-weight:normal;color:${c.muted};">by Pelaxix</span></td><td align="right" style="font-size:12px;line-height:20px;color:${c.muted};">Round #${esc(draw.id)}</td></tr></table></td></tr><tr><td class="content-pad" style="padding:28px 36px 8px;">${test ? `<p style="margin:0 0 20px;padding:10px 12px;background:${c.tint};color:${c.teal};font-size:12px;line-height:18px;">Test preview using the latest published round. No new draw is being announced.</p>` : ""}<p style="margin:0 0 10px;font-size:13px;line-height:20px;color:${c.muted};">${esc(heading)}</p><h1 class="email-title" style="margin:0 0 10px;font-size:30px;line-height:38px;font-weight:normal;letter-spacing:-0.5px;color:${c.ink};">${esc(category)}</h1><p style="margin:0;font-size:14px;line-height:22px;color:${c.muted};">${esc(date)}</p></td></tr><tr><td class="content-pad" style="padding:24px 36px;"><table role="presentation" width="100%" style="background:${c.tint};"><tr><td class="metric-cell" width="50%" style="padding:18px 18px;vertical-align:top;"><p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${c.muted};">CRS cutoff</p><p class="metric-number" style="margin:0;font-size:38px;line-height:46px;font-weight:normal;color:${c.teal};">${cutoff}</p><p style="margin:4px 0 0;font-size:11px;line-height:17px;color:${c.muted};">Lowest score invited</p></td><td class="metric-cell" width="50%" style="padding:18px 18px;vertical-align:top;border-left:2px solid ${c.paper};"><p style="margin:0 0 4px;font-size:12px;line-height:18px;color:${c.muted};">Invitations issued</p><p class="metric-number" style="margin:0;font-size:38px;line-height:46px;font-weight:normal;color:${c.ink};">${invitations}</p><p style="margin:4px 0 0;font-size:11px;line-height:17px;color:${c.muted};">Invitations to apply</p></td></tr></table></td></tr><tr><td class="content-pad" style="padding:0 36px 24px;"><h2 style="margin:0 0 12px;font-size:16px;line-height:24px;font-weight:bold;">Round details</h2><table width="100%" aria-label="Draw details" style="width:100%;">${details}</table><p style="margin:14px 0 0;font-size:12px;line-height:19px;color:${c.muted};">${esc(draw.name)}</p></td></tr><tr><td class="content-pad" style="padding:0 36px 28px;"><table role="presentation"><tr><td bgcolor="${c.ink}" style="background:${c.ink};border-radius:4px;text-align:center;"><a href="${esc(official)}" target="_blank" style="display:inline-block;padding:13px 20px;border:1px solid ${c.ink};border-radius:4px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;line-height:20px;mso-padding-alt:0;">View official draw</a></td></tr></table><p style="margin:16px 0 0;font-size:13px;line-height:20px;"><a href="${esc(dashboard)}" target="_blank" style="color:${c.teal};text-decoration:underline;">Explore draws and the candidate pool</a></p></td></tr><tr><td class="content-pad" style="padding:22px 36px;border-top:1px solid ${c.line};"><p style="margin:0 0 10px;font-size:12px;line-height:19px;color:${c.muted};">A CRS score alone does not confirm eligibility. The round’s program, category and tie-breaking requirements also apply.</p><p style="margin:0;font-size:11px;line-height:18px;color:${c.muted};">Independent tracker using official IRCC data. Not affiliated with the Government of Canada.</p><p style="margin:16px 0 0;font-size:12px;line-height:19px;color:${c.muted};">You subscribed to Express Entry draw alerts.${preview ? ` <span style="color:${c.teal};text-decoration:underline;">Unsubscribe</span>` : unsubscribe ? ` <a href="${esc(unsubscribe)}" target="_blank" style="color:${c.teal};text-decoration:underline;">Unsubscribe</a>` : ""}</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = `${test ? "TEST PREVIEW — latest published round, not a new draw announcement.\n\n" : ""}${draw.name}\n\nDraw #${draw.id}\nDate: ${date}\nCRS cutoff: ${cutoff}\nInvitations: ${invitations}\nDate and time: ${draw.time || "See official instructions"}\nTie-breaking rule: ${draw.tieBreak || "See official instructions"}\nEligible programs: ${draw.programs || "See official instructions"}\n\nOfficial instructions: ${official}\nYour dashboard: ${dashboard}\n\nProgram, category and tie-breaking requirements still apply.${unsubscribe ? "\n\nUnsubscribe: " + unsubscribe : ""}`;
  return { subject, htmlContent: html, textContent: text };
}
