# Validation

- Production TypeScript check and Vite build pass in Node 24 on Linux.
- Twenty-four Node tests pass, covering chart scaling, public refresh and signup, live update events, subscriber-list authorization, multiple recipients, subscriber pause/removal/unsubscribe, old-recipient migration, unsubscribe deletion and queue cancellation (including in-progress batches), HTML/plain-text email facts, test/latest-round parity, HTML escaping and link sanitization, and the original checks: official pool arithmetic; archive import without historical email backlog; once-per-draw successful delivery under concurrent checks; category filtering; delivery retries; last-good-data preservation; official email links; production HTTP authentication/origin checks and static serving.
- Tests mock Brevo and IRCC responses. No real email was sent.
- TasteSkill source lint: zero failures or warnings on the final application source.
- Browser preview became unavailable under this session's browser access policy. Screenshot inspection at desktop/tablet/mobile sizes could not be completed; the TasteSkill browser inspector was not run as an alternative to that policy block.
- Windows PowerShell installation/startup scripts were reviewed but cannot be executed in this Linux environment. Verify on the target Windows server.
- Live deployment, Caddy routing and Brevo delivery require the owner to run setup and add local email credentials. They are not claimed as verified by these checks.
