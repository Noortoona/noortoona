# HALA — Meta WhatsApp Cloud API integration handoff (2 Nov 2026)

This branch prepares **booking notifications** for Meta Cloud API. HALA uses its existing 360dialog transport for invitations and OTP.

## Identity and onboarding

| Purpose | Value |
| --- | --- |
| Cloud API sending phone | Dedicated HALA sender active in the WhatsApp Business app, with Cloud API registration pending |
| Desired display name | HALA (subject to Meta review) |
| Customer service and booking alert recipient | +966532763736 |
| Website | https://halainvites.com |
| Business email | hello@halainvites.com |
| Desired notification email | bookings@halainvites.com (mailbox and sending integration unverified) |
| Time zone | Asia/Riyadh |
| Brand | Use approved repository assets in assets/brand/; do not substitute an approximate logo |

The account owner created the HALA app under Noortoona in Meta for Developers. Meta returned error `2494064` in the direct phone registration flow because the dedicated number is already registered in the WhatsApp Business app. The app on the owner's iPhone shows the Business Platform connection screen. That screen scans the QR code issued by an eligible Embedded Signup flow for an existing WhatsApp Business app number. Use Coexistence to keep the number in the app. The owner can skip chat history sharing for this booking-alert integration. [Meta's Embedded Signup overview](https://www.postman.com/meta/whatsapp-business-platform/overview)

The Netlify site currently uses the 360dialog sandbox. A live channel and its billing are still unverified. Review the existing WhatsApp account and partner setup before starting a live Coexistence flow. Once the correct channel is ready, the owner should complete the QR scan and any verification on the iPhone. Enter credentials only on the corresponding provider or hosting platform.

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
META_WA_SENDER_PHONE=<approved sender in international format, digits only>
META_WA_ACCESS_TOKEN=<system-user token with whatsapp_business_messaging permission>
META_WA_APP_SECRET=<app secret for webhook HMAC verification>
META_WA_VERIFY_TOKEN=<random secret chosen for webhook challenge>
META_WA_BOOKING_TEMPLATE=hala_new_booking_admin_ar
META_WA_TEMPLATE_LANGUAGE=ar
```

Do not paste actual secrets in a repository, PR, chat, or logs. Verify in Meta that the configured Phone Number ID belongs to the approved sender. Set the sender as a Functions environment variable without putting its value in the repository. The admin can update the recipient in HALA's booking settings; confirm the saved recipient is the dedicated customer-service phone before enabling. Keep `HALA_BOOKING_NOTIFICATIONS_PREVIEW` unset unless testing intentionally in an isolated preview. Production credentials must not be put in a preview context. Existing `D360_*` variables remain for invitations and OTP. Check the current 360dialog contract and actual WABA ownership before changing or cancelling anything.

After review/deployment, set Meta's callback to `https://halainvites.com/api/whatsapp/webhook`, use the same verify token, and subscribe to the `messages` webhook field. The endpoint responds to Meta's GET challenge and authenticates POST callbacks with `X-Hub-Signature-256` computed on the raw body using the app secret. Configure Meta's subscription on the correct WABA and verify the callback in the Meta console. The existing D360 bearer-authenticated callback remains available.

## Operational semantics

- A booking is committed before any provider request; its internal notice and WhatsApp `pending_setup` outbox row are stored transactionally.
- Exactly one dispatch attempt is claimed per booking. The admin panel shows `queued` with a provider message ID as accepted by the provider. Authenticated status events can advance it to `sent`, `delivered`, `read`, or `failed`. Timeout is `DISPATCH_UNCERTAIN` and is not automatically retried.
- The admin panel reads actual outbox and booking rows from the database; the customer gets the booking reference irrespective of WhatsApp outcome.
- The email integration for bookings@halainvites.com is **not active or tested**. Do not label an email as delivered until a verified mail provider and a separate email outbox are implemented.
- Test end-to-end with an authorized booking and the authorized recipient **after** number registration and template approval. Confirm the sender Phone Number ID, API response ID, signed callback, database status, and receipt on the recipient device. The local tests use synthetic credentials and do not deliver real messages.
- The direct Meta route avoids adding a new BSP subscription in code, but actual Meta message charges and any existing 360dialog contract must be checked in the business billing panels before activation.
