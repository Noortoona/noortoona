# HALA — Meta WhatsApp Cloud API integration handoff (2 Nov 2026)

This branch prepares **booking notifications only**. Existing invitation and OTP traffic remains on 360dialog. No Meta account, number, template, credential, subscription, or production deployment was changed by this branch.

## Identity and onboarding

| Purpose | Value |
| --- | --- |
| Cloud API sending phone | +966510654663 |
| Desired display name | HALA (subject to Meta review) |
| Customer service and booking alert recipient | +966532763736 |
| Website | https://halainvites.com |
| Business email | hello@halainvites.com |
| Desired notification email | bookings@halainvites.com (mailbox and sending integration unverified) |
| Time zone | Asia/Riyadh |
| Brand | Use approved repository assets in assets/brand/; do not substitute an approximate logo |

Meta Business/Developers was not signed in from the available browser. The account owner should open https://business.facebook.com/ on local Safari in Saudi Arabia, select HALA's existing business portfolio, inspect WhatsApp Accounts and any 360dialog ownership, and only then add the dedicated sending number. If the number is already used in WhatsApp, check the supported migration or coexistence route before changing its registration. Complete phone ownership and two-step verification **inside Meta**. Do not provide a login password, SMS code, PIN, access token, or app secret in a chat or issue.

## Message templates to submit for approval

Language **Arabic (ar)**. Select the appropriate **utility** category and follow Meta's classification if it differs. The seven body placeholders in the admin template must remain in this exact order for the code.

Template name: `hala_new_booking_admin_ar`

```text
HALA | حجز جديد
رقم الحجز: {{1}}
اسم العميل: {{2}}
رقم التواصل: {{3}}
نوع المناسبة: {{4}}
التاريخ: {{5}}
الباقة: {{6}}
قيمة الطلب: {{7}} ر.س
الحالة: بانتظار التواصل واستكمال الدفع
```

Proposed customer template for **future implementation after approved opt-in and privacy review**; this branch does not send it:

```text
هلا، تم استلام طلب حجزك رقم {{1}}.
طلبك مبدئي وبانتظار استكمال الدفع والتأكيد النهائي. يمكنك متابعة تفاصيله في حسابك لدى هلا.
لحظتك .. تبدأ بهلا.
```

The admin notification contains customer contact details. Confirm that this recipient is an authorized HALA staff device and that the template/content is accepted by Meta before enabling. No marketing or bulk sends are implemented.

## Production configuration (Netlify secret environment variables)

Once the sending number is active, the admin template is **approved**, and the authorized recipient is confirmed, configure Netlify secrets directly in the site UI:

```text
HALA_BOOKING_WA_PROVIDER=meta
HALA_BOOKING_NOTIFICATIONS_ENABLED=true
HALA_BOOKING_NOTIFICATION_RECIPIENT_CONFIRMED=true
META_WA_BOOKING_TEMPLATE_APPROVED=true
META_WA_GRAPH_VERSION=<supported Graph version, for example v24.0 after checking Meta>
META_WA_PHONE_NUMBER_ID=<sending Phone Number ID, numeric>
META_WA_SENDER_PHONE=966510654663
META_WA_ACCESS_TOKEN=<system-user token with whatsapp_business_messaging permission>
META_WA_APP_SECRET=<app secret for webhook HMAC verification>
META_WA_VERIFY_TOKEN=<random secret chosen for webhook challenge>
META_WA_BOOKING_TEMPLATE=hala_new_booking_admin_ar
META_WA_TEMPLATE_LANGUAGE=ar
```

Do not paste actual secrets in a repository, PR, chat, or logs. The admin can update the recipient in HALA's booking settings; confirm the saved recipient is the dedicated customer-service phone before enabling. Keep `HALA_BOOKING_NOTIFICATIONS_PREVIEW` unset unless testing intentionally in an isolated preview. Production credentials must not be put in a preview context. Existing `D360_*` variables remain for invitations and OTP. Check the current 360dialog contract and actual WABA ownership before changing or cancelling anything.

After review/deployment, set Meta's callback to `https://halainvites.com/api/whatsapp/webhook`, use the same verify token, and subscribe to the `messages` webhook field. The endpoint responds to Meta's GET challenge and authenticates POST callbacks with `X-Hub-Signature-256` computed on the raw body using the app secret. Configure Meta's subscription on the correct WABA and verify the callback in the Meta console. The existing D360 bearer-authenticated callback remains available.

## Operational semantics

- A booking is committed before any provider request; its internal notice and WhatsApp `pending_setup` outbox row are stored transactionally.
- Exactly one dispatch attempt is claimed per booking. API acceptance with a message ID yields `queued`; authenticated status events can advance it to `sent`, `delivered`, `read`, or `failed`. Timeout is `DISPATCH_UNCERTAIN` and is not automatically retried.
- The admin panel reads actual outbox and booking rows from the database; the customer gets the booking reference irrespective of WhatsApp outcome.
- The email integration for bookings@halainvites.com is **not active or tested**. Do not label an email as delivered until a verified mail provider and a separate email outbox are implemented.
- Test end-to-end with an authorized booking and the authorized recipient **after** number registration and template approval. Confirm the sender Phone Number ID, API response ID, signed callback, database status, and receipt on the recipient device. The local tests use synthetic credentials and do not deliver real messages.
- The direct Meta route avoids adding a new BSP subscription in code, but actual Meta message charges and any existing 360dialog contract must be checked in the business billing panels before activation.
