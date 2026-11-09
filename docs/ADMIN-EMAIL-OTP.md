# HALA administration — email OTP rollout

The admin portal defaults to **email verification**. Customer phone/WhatsApp OTP remains unchanged.

## Required production configuration (Netlify)

1. `HALA_ADMIN_EMAILS=shinko77@gmail.com` — comma-separated allowlist of verified administration mailboxes, configured in Netlify Functions runtime environment.
2. `RESEND_API_KEY` — secret from the Resend account; never place in GitHub, a frontend bundle, or this document.
3. `HALA_AUTH_EMAIL_FROM` — verified sender on a domain validated with Resend, such as `HALA <login@halainvites.com>` if that sending address is configured.
4. Existing `HALA_OTP_SECRET` must remain set to a secret with at least 24 characters.
5. The `users` table must contain an **existing, active, privileged account**. It can already have email `shinko77@gmail.com` and role `admin` or `customer_service`, or be an existing `admin` with a null email and a phone that matches the server-managed `HALA_ADMIN_PHONES`. Only after a successful OTP sent to an allowlisted mailbox may that null email be linked to the same existing admin ID. **Never insert a new admin account, grant an admin role, or replace an existing non-empty account email via this flow.** If no such account exists, this flow intentionally cannot grant access.
6. Apply `20261109010000_admin-email-otp` database migration before deploying serverless functions.

## Testing and deployment

- Run `node --test tests/admin-email-otp.mjs`, `npm test` and Netlify preview build.
- On a deploy preview, request a code using the approved email; confirm delivery, correct code, wrong code, 5-minute expiry, 5-attempt limit, reuse rejection, and inability of a non-allowlisted address to create admin access.
- Check revoked sessions and standard admin authorization still work.
- Promote only after the verified mailer and database linkage are confirmed.
- Web login path: `/admin.html`; existing phone OTP remains supported for customers and as an admin fallback.

## Security

The allowlist is an additional restriction, not a way to create accounts. An approved email that is not attached to an existing authorized admin record **cannot log in**. The app does not expose raw OTP values or API keys to the browser. Remove access for an admin by suspending the linked account and updating the allowlist.
