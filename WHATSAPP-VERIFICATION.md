# HALA V5.6 — WhatsApp delivery verification

Scope: `v5.6-staging` only. No production release or merge to `main`.

## Confirmed defects corrected

- API acceptance was immediately stored as `sent`. It now creates a locked,
  durable `queued` attempt and requires a nonempty provider message ID.
- Only authenticated provider callbacks advance `sent`, `delivered`, and `read`.
  Callback updates are transactional, monotonic, and match the current message ID.
- Duplicate submissions are blocked. Timeout / missing ID means uncertain, not
  rejected, and is never automatically retried.
- Provider failure code and message are displayed safely, together with message ID.
- The personal WhatsApp fallback was removed. Missing HALA configuration fails
  explicitly instead of opening the host's WhatsApp.
- Setup requires authorization in every mode; GET no longer registers a webhook.
- Mobile guest rows show status and actions without horizontal table scrolling.
- Dashboard polls every five seconds for up to 24 visible polls, including delivered
  messages awaiting optional read receipts. Manual refresh remains available.

## Verified locally

- `npm test`: smoke checks plus 14 handler tests passed.
- TypeScript no-emit check: three WhatsApp handlers passed.
- Playwright: seven Chromium iPhone-size tests passed using mocked API responses.
  These exercise creation, guest RSVP UI / share arithmetic, dashboard, simulated
  QR camera, no personal-number fallback, status progression, and safe errors.
- Mobile table / document width assertions passed.
- These are NOT a real iPhone camera test or a live database/provider integration
  test. The fixture server does not implement Netlify `/i/*` and `/dashboard`
  rewrites. Live unique-link and persisted RSVP checks remain required.

## Live configuration audit

- Existing Netlify project: `noortoona`, production domain `noortoona.com`.
- Environment audit found `D360_API_KEY` only. Key validity, sender identity,
  template approval, provider billing, and channel activation are unverified.
- Previous code silently defaulted to sandbox. Current code requires explicit mode.
- Existing preview webhook GET returned HTTP 200; this is endpoint availability,
  NOT evidence that 360dialog registered the callback URL.
- 360dialog currently requires sign-in in the available browser. No live test
  was sent in this run and no real delivered/read receipt was observed.

## Required before the single-recipient test

1. Authenticate to the existing 360dialog account securely; confirm HALA sender,
   channel health, and an approved template with five body parameters in order:
   guest name, event title, date/time, location, unique invitation URL. Do not
   invent template names or assume an approved name matches this parameter schema.
2. Configure the preview function environment only: explicit `D360_MODE`, matching
   channel key, `D360_INVITE_TEMPLATE`, `D360_TEMPLATE_LANGUAGE`, and independent
   `D360_WEBHOOK_TOKEN` / `D360_SETUP_TOKEN`. Reminder template is separate.
   Production base is `https://waba-v2.360dialog.io`; sandbox base is
   `https://waba-sandbox.360dialog.io/v1`. An override must exactly match its mode.
3. Check the existing provider webhook before replacing it. A channel webhook
   affects the sender globally; don't redirect active production traffic to a
   preview without a separate test channel or explicit coordination.
4. Register the selected stable preview origin plus `/api/whatsapp/webhook` with
   the configured Authorization header; verify registration at the provider.
5. Obtain one explicitly designated consenting test recipient. Send once, retain
   message ID, and wait for the authenticated delivered/read callback (or actual
   failed code). A timeout is unresolved, not proof of rejection.
6. Open that recipient's `/i/{code}`, submit RSVP, and verify the saved response in
   the same preview database and dashboard.

## Release gates / remaining limitations

- No bulk test until the individual delivery and persisted RSVP are proven.
- Sandbox supports only its registered test recipient; ten distinct invitees
  require an active production-mode sender and valid templates.
- After success, send ten consented test invitations sequentially and retain
  per-message IDs/statuses; stop on provider/account failure. No batch sent yet.
- Uncertain attempts with no message ID require provider reconciliation before
  retry; there is intentionally no unsafe force-resend control.
- Callback retries handle a callback arriving before its message ID is saved.
  A timeout that loses the ID still requires manual provider reconciliation.
- Read receipts may not be available. `delivered` is the delivery acceptance gate.
- No schema migrations, secret changes, production deploys, or main updates were
  performed as part of this patch.
