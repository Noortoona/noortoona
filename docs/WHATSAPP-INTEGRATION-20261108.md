# HALA WhatsApp integration audit — 2026-11-08

## Release status: INCOMPLETE, NOT APPROVED FOR PRODUCTION

Requested sender: `+966510654663`, business name `HALA | هلا`, contact URL
`https://wa.me/966510654663`, email `hello@halainvites.com`.

The number and display name above are requested identity, not verified Meta data.
No live message was sent, no production setting was changed, and no webhook was
registered or replaced. Existing customer contact numbers are preserved until
the replacement number is proven ready. No direct Meta sender was added.

## Audited baseline

- Repository branches were enumerated. The independent development branch starts
  from `main` commit `5f4be889c3e905761b4f11c0f47dca302a73e092`.
- Netlify confirmed that exact commit is the currently published `halainvites.com`
  deploy (`6aef770f25f3537059841022`), published 2026-11-07.
- Its GitHub web workflow passed. Its mobile workflow failed before this patch;
  therefore this baseline is verified as deployed, not asserted globally stable.
- Existing 360dialog sending, invitation retries, OTP cooldowns, authentication,
  booking outbox, approved-template configuration and provider callbacks are reused.

## External account findings

| Item | Observed status |
| --- | --- |
| Meta Business Portfolio / WABA | No authenticated account access obtained; unverified |
| 360dialog account | No authenticated Hub access obtained; account status unverified |
| Existing production runtime mode | `sandbox` in the readable Netlify site configuration |
| Stored production channel key | Read-only webhook requests returned HTTP 401 on both the configured sandbox host and the production 360dialog host |
| OTP template | `D360_OTP_TEMPLATE` absent from readable site variables |
| Webhook authentication | `D360_WEBHOOK_TOKEN` absent from readable site variables |
| Official number / display name | Ownership, eligibility, coexistence, registration and approval unverified |
| Existing provider / migration | Unverified; no number migration attempted |
| Send / receive / OTP delivery | Not live-tested; no provider message ID or delivery receipt obtained |

The environment audit describes site variables returned by the connector; it is
not proof that no team-shared setting exists. HTTP 401 proves those attempted
requests were unauthorized, not that the customer account is closed or unpaid.
API keys and OTPs are excluded from this report and source changes.

## Implemented in this development branch

- Admin-only WhatsApp Management: actual configuration completeness, unverified
  Meta/identity state, last authenticated webhook observation, separate read-only
  provider diagnostics and first-page template status, incoming inbox, invitation,
  booking and OTP status logs with masked phone numbers.
- Incoming webhook persistence with provider-ID deduplication, authenticated
  callbacks and transactional acknowledgement. Only support-required fields are
  retained; raw media and full payloads are excluded. Six-digit numeric tokens
  in incoming text are redacted. Incoming messages can be marked resolved with an
  audit entry. Marking resolved does not send a response to the customer.
- Manual retry of definitively failed invitation attempts uses the original
  sender, locks, authorization and duplicate protection. Uncertain queued attempts
  cannot be force-resent. Single-recipient invitation testing uses an existing
  guest and requires the administrator to attest to test consent.
- OTP delivery callbacks are monotonic under a row lock; delayed `sent`/`failed`
  events cannot downgrade `read`/`delivered`.
- Provider error text cannot leak a generated OTP through the OTP request route.
  OTP dispatch requires webhook protection. Code generation uses rejection
  sampling. Existing five-minute expiry, phone cooldown and hourly quota remain;
  request/verify endpoints also add platform IP/domain rate limits.
- Additive migration creates `whatsapp_inbox` and `whatsapp_webhook_state` only;
  it does not change customer data, account roles, contact numbers or credentials.
- Browser test harness path containment is made compatible with Windows.

## Validation

- 26 embedded-PostgreSQL tests passed, including real migrations and handlers:
  incoming authentication/deduplication/redaction, role isolation, resolution,
  OTP callback ordering, provider 401 handling, secret non-disclosure, existing
  booking/event/payment/OTP flows and migration preservation.
- 87 other existing tests passed when run independently of the platform-specific
  build test. Smoke checks and static build passed. All Netlify functions passed
  TypeScript no-emit validation.
- Local `npm test` is not fully green: the existing symlink containment test
  cannot create a symlink on this Windows session (`EPERM`). It was not removed
  or weakened. Linux CI must run the complete suite.
- Two iPhone-size browser tests passed against the local real handlers/database:
  actual admin loading/access restrictions and escaped incoming text. These do
  not use a real WhatsApp account or prove delivery.
- None of these checks demonstrate a real WhatsApp delivery, phone registration,
  live Meta account approval or production database migration.

## Work still required

1. Obtain usable authenticated access to the existing official Meta and 360dialog
   accounts. The in-app browser encountered timeouts and an application permission
   prompt; no usable signed-in provider session was obtained.
2. Inspect existing WABA, sender ownership, subscription, template schema and
   coexistence before any registration, migration or webhook change. Use the
   existing account, never create a duplicate or disconnect the Business app.
3. Provision a valid channel key and independent webhook secret in the intended
   isolated environment; configure approved invitation, reminder, Authentication
   and booking templates with their actual language/components.
4. Apply the additive migration to an isolated database and verify live sender,
   consented single-recipient delivery, inbound message persistence, OTP receipt
   and verification, and booking notification end to end.
5. The full requested customer lifecycle automation (booking confirmation/details,
   verified payment, booking status changes, RSVP preference routing), admin
   supervisor/human-intervention/failure notifications, automatic reminder schedule,
   retry/backoff dispatcher and secure administrative recovery are **not implemented
   by this patch**. Existing invitation/reminder sending and booking-created admin
   notification are not substitutes for those missing flows.
6. The new management section displays notification settings but does not add a
   new configuration editor or mobile-native administration screen. Existing
   booking settings remain in their existing section.
7. Change customer-facing contacts across web/mobile only after sender readiness;
   obtain user review and passing checks before production publication.

## Provider references

- Webhook configuration and custom authentication headers:
  https://docs.360dialog.com/docs/messaging/webhook
- Message-template status/category enumeration:
  https://docs.360dialog.com/docs/messaging-api/api-reference/templates

These references support the read-only provider diagnostic routes, not the
unverified state of HALA's accounts.
