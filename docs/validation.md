# Validation

- Production TypeScript check and Vite build pass in Node 24 on Linux.
- Thirty-six Node tests pass, covering chart scaling, public refresh and signup, live update events, subscriber-list authorization, multiple recipients, subscriber pause/removal/unsubscribe, old-recipient migration, unsubscribe deletion and queue cancellation (including in-progress batches), HTML/plain-text email facts, test/latest-round parity, HTML escaping and link sanitization, and the original checks: official pool arithmetic; archive import without historical email backlog; once-per-draw successful delivery under concurrent checks; category filtering; delivery retries; last-good-data preservation; official email links; production HTTP authentication/origin checks and static serving.
- Tests mock Brevo and IRCC responses. No real email was sent.
- TasteSkill source lint: zero failures or warnings on the final application source.
- Browser preview became unavailable under this session's browser access policy. Screenshot inspection at desktop/tablet/mobile sizes could not be completed; the TasteSkill browser inspector was not run as an alternative to that policy block.
- Windows PowerShell installation/startup scripts were reviewed but cannot be executed in this Linux environment. Verify on the target Windows server.
- Live deployment, Caddy routing and Brevo delivery require the owner to run setup and add local email credentials. They are not claimed as verified by these checks.

- News feed tests cover official URL filtering, malformed entries, deduplication, concurrent request coalescing, caching, persistence and outage fallback. The live Canada.ca API was fetched successfully during implementation.

- Personal comparison tests cover boundary scores, non-overlapping pool counts, cutoff ties, Monday-first calendar alignment and leap years. Browser visual verification remains unavailable in this session.

- Public IRCC X HTML and YouTube Atom feed were retrieved; parsers extracted 5 official X posts and 15 videos. Social tests cover author/channel verification, long-form post text, deduplication, JSON-only parsing, request coalescing, persistence and independent source failures.

- Instagram public profile embed returned six official posts. Tests verify nested JSON parsing, account ownership, deduplication and login-only response rejection. Facebook profile and Page Plugin returned no importable dated post data during the check.

- Email compatibility pass replaces the table-wrapping header anchor with three linked header cells, adds explicit legacy table spacing/background/alignment attributes, inline font fallbacks, Outlook 96-DPI settings and a centered VML button with a standard HTML fallback. Automated markup checks pass; the external compatibility percentage and real Outlook rendering have not been retested.

- Compact email redesign follows the existing TasteSkill Framed sheet direction (seed 2070027195), adapted to a screenshot card: category, oversized teal CRS cutoff, invitation count, date and source identity. Tie-break and actions sit outside the card. The shared email/website preview preserves HTML escaping, unsubscribe, test labeling, Outlook VML and table fallbacks. Build and all 33 tests pass. Browser screenshot inspection and actual inbox rendering remain unverified; no visual score or new external compatibility percentage is claimed.

- Vite production bundles now separate application code (~58 kB minified), React (~190 kB) and other libraries (~388 kB). Build completes without the oversized-chunk warning; warning limits remain unchanged. Production HTTP/static-serving test passes. Browser interaction verification remains unavailable.

- NOC import verified against both official CSVs: 516 unit groups, with linked elements. Tests cover BOM, quoted commas/newlines, leading zeros, completeness rejection, concurrency, caching and persisted-data fallback. Browser visual checks remain unavailable.

- Diagnosed live NOC failure: `/api/noc` returned HTTP 404, indicating the running API lacked the newly deployed route. Updater now terminates lingering node.exe processes only when their command line contains this project’s absolute server entry point, after stopping the scheduled task. Windows execution cannot be verified from this Linux environment.
