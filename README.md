# SLOT

A little time. One private pass, one proposal, one calendar attachment.

The public page accepts a name, a date/time in Europe/Berlin, a short note and a one-use pass. A successful submission emails the owner a 30-minute `.ics` event from the owner's own Gmail account. Importing that attachment remains a manual choice. No Calendar API, guest email, guest account, availability checks or booking approval.

## Security boundary

- 128-bit cryptographic passes, hashed in storage; validity 15 or 30 minutes.
- One SQL acceptance statement with transactional guards/triggers and independent code uniqueness.
- Immutable request ID + code hash + payload digest for retries.
- Recipient fixed by server configuration. Visitors cannot choose recipients or upload files.
- Text-only MIME and escaped RFC 5545 events; UTF-8 lines folded by octets.
- Private generator requires a signed Access JWT, the expected application/issuer and the owner identity. CSRF Origin checks on administrative changes.
- Refresh token encrypted with AES-GCM in D1; encryption key and OAuth client secret in Worker secrets. Local recovery material uses Windows DPAPI and is ignored by Git.
- Persisted, HMAC-pseudonymized attempt limits; daily acceptance cap (20 initially). CORS is not authentication.
- Gmail has no exactly-once send primitive. A timeout after sending begins is held as `uncertain`, never automatically replayed. Known pre-send preparation failures use bounded retries. The private desk displays failed/uncertain counts.

The authorization is send-only (`gmail.send`) plus basic Google identity to verify the configured owner. No inbox-reading or calendar permission is requested. Revocation/invalid refresh tokens require reconnecting from the desk. Google testing-mode authorizations can expire weekly; a personal-use production consent configuration is intended, subject to the actual account configuration.

## Development

Node 24. `npm ci`, `npm test`, `npm run db:local`, `npm run dev`.

`wrangler.jsonc` describes the Worker and its dedicated D1 database. Never commit `.dev.vars`, `.secrets/`, OAuth callbacks or real visitor payloads. Keep Wrangler's auth in the OS keyring.

Server secrets: `MAILBOX`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (32 random bytes, Base64URL), `RATE_SECRET`. Access configuration: `ACCESS_TEAM`, `ACCESS_AUD`. Gmail setup is done through the private desk after Access is operational; its redirect is `/api/admin/gmail/callback` on the Worker origin.

For GitHub Pages set `public/config.js` to the Worker origin. The workflow publishes only `public/`; private API data and credentials are never part of the Pages artifact. The desk itself runs at the Worker origin, not through Pages. Its HTML/JS copies in a public repository contain no secrets; authorization always happens on the server.

`tools/configure-secrets.ps1` uploads an ignored, DPAPI-protected local OAuth configuration. It preserves existing encryption keys when rerun. Changes to encryption keys require an explicit token migration or reconnect.

## Operation

The one-minute Cron handles queued mail. No active PC is needed. Provider failure may delay or prevent a notification; accepted proposals stay recorded. The code does not become usable again. Do not requeue `uncertain` work without manually checking the Gmail Sent folder. Re-importing an ICS may create duplicates depending on the calendar client; SLOT cannot modify an already imported event.

## Design and verification

Original ticket/orbit design and native browser animation. Reference credits are in the page and [decisions](docs/decisions.md). Reduced-motion users receive the same outcomes without the collapse. Empty-code submission is a playful UI transition; backend validation applies independently.

The initial self-email ICS test imported correctly on the owner's iPhone with the expected Berlin time. Unit/integration tests use synthetic data and mocked Gmail; they do not prove delivery by the deployed Gmail OAuth flow. Deployment evidence and remaining checks must be recorded separately.
