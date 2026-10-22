# Pelaxix Express Entry

A self-hosted draw tracker for **ee.pelaxix.com**. React + Vite frontend, Node.js 24 server and built-in SQLite. No Docker, paid data API, external database or ChatGPT runtime required.

## Windows installation

Prerequisites: Node.js **24 LTS or newer**, Git, and your existing Caddy reverse proxy. Run in PowerShell:

```powershell
cd C:\Dev\ExpressEntry
git clone https://github.com/pelaxix/ExpressEntry.git .
.\scripts\setup.ps1
```

If the folder already contains a clone, use `git pull --ff-only` instead. Setup installs dependencies, builds the UI, and creates the persistent configuration without overwriting an existing file. A new admin password is printed once and saved in the config.

To install an automatic startup task, run **PowerShell as Administrator**:

```powershell
cd C:\Dev\ExpressEntry
.\scripts\setup.ps1 -InstallTask
```

The `Pelaxix-ExpressEntry` Windows task starts at boot under SYSTEM, restarts after failure, and requires no signed-in user. Without a task, run `.\scripts\run.ps1` in a window that stays open. Windows PowerShell's script execution policy may require invoking these scripts using `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1` for that invocation.

## Persistent data

Code belongs in `C:\Dev\ExpressEntry`; data belongs in **`D:\DevData\ExpressEntry`**:

| File/folder | Purpose |
| --- | --- |
| `.env` | Admin password, Brevo API key, verified sender, port and polling interval |
| `express-entry.sqlite` | Historical draws, distinct pool snapshots, email settings, sessions and alert history |
| `backups/` | Daily consistent SQLite backups, last 30 days |
| `logs/` | Monthly application and server logs |

`DATA_DIR` can override the default before startup. Updates preserve the data directory. Back up `.env` separately to a secure location; database backups include email preferences and administrator sessions. Stop the app before manually copying a live SQLite database, or use its consistent daily backup instead.

## Email notifications

1. Reuse a transactional API key in **your Brevo account**, with a verified sender email/domain.
2. Keep `BREVO_API_KEY` as a Windows **Machine** environment variable. The task launcher reads the current Machine value on each start, including when it runs under SYSTEM. Configure `ALERT_FROM_EMAIL` in `D:\DevData\ExpressEntry\.env` or as a Machine environment variable. A local `.env` key is also supported but unnecessary when the environment variable is present. Never commit credentials.
3. Restart the task after changing configuration: `Stop-ScheduledTask Pelaxix-ExpressEntry` then `Start-ScheduledTask Pelaxix-ExpressEntry`.
4. Visitors open **Notifications**, enter an email address and subscribe. No account or administrator password is needed. Optional category selections narrow their alerts.
5. The **Admin** link in the footer opens subscriber management. Sign in with the existing admin password to pause/resume/remove subscribers, pause all delivery, view delivery history or send a test to a listed subscriber. There is no separate admin recipient field. **Send latest-round test** sends the latest published round using the real alert template, with `[TEST]` in the subject and a test notice; it does not record a new draw alert.

The server checks IRCC on startup and every five minutes. **Check now is public** and refreshes the same shared database for everyone. Simultaneous checks share one request; a successful check in the last ten seconds is reused without showing a lock or asking visitors to sign in. Open dashboards receive an update event and reload saved results; a one-minute fallback poll remains available if the stream disconnects.

Emails use a shared inline-styled HTML template with a plain-text fallback, draw metrics and official details. The Notifications page previews the same template. Each matching active subscriber receives a separate email, never a visible group recipient list. Draw/subscriber pairs are deduplicated. Historical imports and new signups never send an old-draw backlog. Paused, removed and unsubscribed addresses are skipped. Each draw email has an unsubscribe link that opens a confirmation page without requiring an account. Confirming removes the subscriber and their queued deliveries and recipient-specific delivery history from the live database. Existing status-based unsubscribed records are removed on upgrade. Stored backups age out under the normal 30-day retention. Repeated signups for the same address do not create duplicate subscriptions. An earlier configured single recipient is migrated into the subscriber list once.

Provider failures retry on the next check and appear in admin delivery history. Delivery is at-least-once: an ambiguous provider timeout or crash after Brevo accepts an email can produce a duplicate on retry. Successful deliveries are not resent. Keeping the process running, working internet and an operational Brevo account are required. Five-minute checks are not an instant-publication guarantee.

## Caddy

Matches the existing setup:

```caddy
 ee.pelaxix.com {
     reverse_proxy 127.0.0.1:31007
 }
```

The application binds to loopback. Keep `PUBLIC_URL=https://ee.pelaxix.com` so the origin checks and secure session cookie match your deployment. Draws, manual checks, email signup and token-based unsubscribe are public. Subscriber lists, recipient management, provider status and test emails require administrator sign-in.

## Updating

From an elevated PowerShell if using the Windows task:

```powershell
cd C:\Dev\ExpressEntry
.\scripts\update.ps1
```

This stops the task, pulls without force, installs locked dependencies, builds and restarts. Do not edit production code in place. If a build fails, review the output before retrying; persistent data is untouched.

## Data and charts

Source: [official IRCC JSON](https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json), with links to each round's ministerial instructions. An official snapshot is bundled so the first page remains usable before the first successful fetch. The last successful fetch is shown independently of the draw date and pool snapshot date. Incomplete, older or malformed feed responses leave the last good data intact.

- Draw overview, searchable and filtered history, CSV export and detailed draw dialog.
- CRS trend for a selected category; all-category mode uses dots rather than connecting unrelated programs.
- Invitation share ring, calculated from filtered invitation counts.
- Historical pool snapshots, broad-band chart and full detailed table with changes from the previous distinct snapshot.
- Subtotals are never added again to their child rows. Pool chart bars show counts per unequal published band, not a histogram or score density.
- Personal CRS reference is device-local and is not a ranking or invitation prediction. IRCC publishes the overall pool, not counts by program/category or exact single-score ranks.
- Responsive layout, light/dark appearance, accessible chart descriptions and keyboard controls.

Existing archived draws and snapshots are retained in SQLite even when a later feed omits them. The dashboard reads the durable archive, so historical draws and complete snapshots remain available even if IRCC later omits them from its feed. Public draw records contain no applicant-level information.

## Development and validation

```sh
npm ci
npm run dev
npm test
npm run build
npm start
```

Development starts the API automatically and keeps data under ignored `.local-data/`. Production uses the external data directory. For local admin testing set `ADMIN_PASSWORD` before `npm run dev`. Configure `DEV_ORIGIN` for a different dev origin as needed.

Tests use a temporary database and mocked IRCC/Brevo responses. They verify pool arithmetic, unique draw ordering, no historical alert backlog, matching-category delivery, concurrent check deduplication, retry handling and preservation of last-good data. They do not send real email.

Design follows TasteSkill's **Framed sheet**, seed `2070027195`: IBM Plex Sans, neutral framing, data-led teal and restrained chart chrome. No generated or fabricated chart data.

## Official IRCC updates

The IRCC updates section reads the public Canada.ca newsroom API server-side, caches results for 15 minutes, and stores the latest successful feed in `DATA_DIR/ircc-news.json`. It supports text search and an Express Entry keyword filter over the latest 100 newsroom entries. Official notices, program guidance and publications are linked separately. Public X posts and YouTube uploads are aggregated alongside newsroom items, with a source filter. News does not send notification emails. Failed refreshes retain the saved feed and show a warning.

## Personal comparisons and calendar

My CRS comparison stores score and self-selected eligible categories only in browser local storage. It compares the latest 20 matching rounds and distinguishes cutoff ties. Candidates above a score are shown as bounds from non-overlapping published pool bands, not as an exact category rank. Compare pools shows arbitrary snapshot pairs with net change per detailed band and total. Draw calendar groups published rounds by month, filters categories, and shows elapsed days since the last published draw; it does not predict future dates.

Social feeds cache for 15 minutes in `DATA_DIR/ircc-social.json`, with independent per-source fetch status and last-success times. X parses JSON already present in the public @CitImmCanada profile HTML and verifies the official account ID. It is best-effort and may break when X changes its public page. YouTube uses the official channel’s public Atom feed. Neither feed is a complete social archive. Facebook, Instagram and LinkedIn remain links only. No API keys or logins are used, and no social emails are sent.
