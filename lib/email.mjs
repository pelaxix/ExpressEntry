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
  const subject = `${test ? "[TEST] " : ""}Express Entry #${draw.id}: ${draw.category} · ${draw.crs} CRS points`;
  const siteLabel = dashboard === "#" ? "Express Entry by Pelaxix" : new URL(dashboard).host;
  const html = `<!doctype html><html lang="en" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title><!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--><style>body{margin:0;padding:0}table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}td{font-family:Arial,Helvetica,sans-serif}a{color:${c.teal}}@media only screen and (max-width:480px){.outer-pad{padding:16px 12px!important}.card-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:26px!important;line-height:32px!important}.score-number{font-size:88px!important;line-height:96px!important}.invite-number{font-size:26px!important;line-height:34px!important}}</style></head><body bgcolor="${c.ground}" style="margin:0;padding:0;background:${c.ground};font-family:Arial,Helvetica,sans-serif;color:${c.ink};"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(category)} · ${cutoff} CRS points · ${invitations} invitations · ${esc(date)}</div><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" bgcolor="${c.ground}" style="width:100%;background:${c.ground};"><tr><td class="outer-pad" align="center" style="padding:24px 16px;"><!--[if mso]><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="520" align="center"><tr><td><![endif]--><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" align="center" style="width:100%;max-width:520px;">${test ? `<tr><td align="center" style="padding:0 16px 12px;font-size:12px;line-height:18px;color:${c.muted};">Test preview. No new draw is being announced.</td></tr>` : ""}<tr><td bgcolor="${c.paper}" style="background:${c.paper};"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr><td class="card-pad" style="padding:24px 32px 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%"><tr><td valign="middle"><a href="${esc(dashboard)}" target="_blank" style="display:block;font-size:16px;line-height:24px;font-weight:bold;color:${c.ink};text-decoration:none;">Express Entry</a></td><td align="right" valign="middle"><a href="${esc(dashboard)}" target="_blank" style="display:block;font-size:13px;line-height:24px;color:${c.muted};text-decoration:none;">Round #${esc(draw.id)}</a></td></tr></table></td></tr><tr><td class="card-pad" align="center" style="padding:30px 32px 12px;"><h1 class="email-title" style="margin:0;font-size:30px;line-height:38px;font-weight:normal;color:${c.ink};">${esc(category)}</h1></td></tr><tr><td align="center" bgcolor="${c.paper}" style="padding:0 16px;background:${c.paper};"><p class="score-number" style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:112px;line-height:120px;font-weight:bold;letter-spacing:-4px;color:${c.teal};">${cutoff}</p><p style="margin:0;font-size:14px;line-height:22px;color:${c.muted};">CRS cutoff</p></td></tr><tr><td class="card-pad" align="center" style="padding:24px 32px 0;"><p class="invite-number" style="margin:0;font-size:30px;line-height:38px;font-weight:bold;color:${c.ink};">${invitations} invitations</p><p style="margin:10px 0 0;font-size:16px;line-height:24px;color:${c.ink};">${esc(date)}</p></td></tr><tr><td class="card-pad" align="center" style="padding:26px 32px 24px;"><a href="${esc(dashboard)}" target="_blank" style="font-size:13px;line-height:20px;color:${c.teal};text-decoration:none;">${esc(siteLabel)} · by Pelaxix</a><p style="margin:5px 0 0;font-size:11px;line-height:16px;color:${c.muted};">Source: IRCC · Independent tracker</p></td></tr></table></td></tr><tr><td align="center" style="padding:20px 0 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" width="190" align="center" style="width:190px;margin:0 auto;"><tr><td align="center" valign="middle" bgcolor="${c.ink}" style="background:${c.ink};border-radius:4px;text-align:center;"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(official)}" style="height:48px;v-text-anchor:middle;width:190px;" arcsize="8%" strokecolor="${c.ink}" fillcolor="${c.ink}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;">View official draw</center></v:roundrect><![endif]--><!--[if !mso]><!--><a href="${esc(official)}" target="_blank" style="display:block;border:1px solid ${c.ink};border-radius:4px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-align:center;text-decoration:none;line-height:48px;mso-hide:all;">View official draw</a><!--<![endif]--></td></tr></table></td></tr><tr><td align="center" style="padding:16px 12px 0;font-size:12px;line-height:19px;color:${c.muted};"><p style="margin:0 0 10px;">Tie-breaking rule: ${esc(draw.tieBreak || "See official instructions")}</p><p style="margin:0;">A CRS score alone does not confirm eligibility.<br>The round’s program, category and tie-breaking requirements apply.</p><p style="margin:12px 0 0;font-size:11px;line-height:17px;">Not affiliated with the Government of Canada.</p><p style="margin:12px 0 0;">You subscribed to Express Entry draw alerts.${preview ? ` <span style="color:${c.teal};text-decoration:underline;">Unsubscribe</span>` : unsubscribe ? ` <a href="${esc(unsubscribe)}" target="_blank" style="color:${c.teal};text-decoration:underline;">Unsubscribe</a>` : ""}</p></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
  const text = `${test ? "TEST PREVIEW — latest published round, not a new draw announcement.\n\n" : ""}${draw.name}\n\nDraw #${draw.id}\nDate: ${date}\nCRS cutoff: ${cutoff}\nInvitations: ${invitations}\nDate and time: ${draw.time || "See official instructions"}\nTie-breaking rule: ${draw.tieBreak || "See official instructions"}\nEligible programs: ${draw.programs || "See official instructions"}\n\nOfficial instructions: ${official}\nYour dashboard: ${dashboard}\n\nProgram, category and tie-breaking requirements still apply.${unsubscribe ? "\n\nUnsubscribe: " + unsubscribe : ""}`;
  return { subject, htmlContent: html, textContent: text };
}
