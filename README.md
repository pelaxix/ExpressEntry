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

1. Create a transactional API key in **your Brevo account** and verify the sender email/domain there.
2. Open `D:\DevData\ExpressEntry\.env` and fill `BREVO_API_KEY` and `ALERT_FROM_EMAIL`. Do not put credentials in GitHub or frontend code.
3. Restart the task: `Stop-ScheduledTask Pelaxix-ExpressEntry` then `Start-ScheduledTask Pelaxix-ExpressEntry`.
4. Open **Notifications**, sign in with the admin password, save the recipient email and categories, enable alerts, and send a test using the saved preferences.

The server checks IRCC on startup and every five minutes, independent of browsers. New matching draws queue one email per draw number. Historical imports never create a backlog. Provider failures retry on the next check and appear in delivery history. As with most email systems, delivery is at-least-once: a crash or ambiguous timeout after Brevo accepts a message can produce a duplicate on retry. Successful deliveries are not resent. Test messages do not enter draw history. A new category is automatically included when “All categories” is selected.

The application only sends email after a recipient is configured and alerts are enabled, or an administrator explicitly sends a test. Keeping the process running, working internet and an operational Brevo account are required; five-minute checks are not an instant publication guarantee.

## Caddy

Matches the existing setup:

```caddy
 ee.pelaxix.com {
     reverse_proxy 127.0.0.1:31007
 }
```

The application binds to loopback. Keep `PUBLIC_URL=https://ee.pelaxix.com` so the origin checks and secure session cookie match your deployment. Public visitors may read the draw data; notification settings and manual IRCC checks require administrator sign-in.

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
