# Hala Mobile

Native iOS/Android app for Hala. The app lives under `mobile/` and uses the existing Netlify backend.

## Current roles

- Customer: self registration, events, templates, guests, WhatsApp status and payment.
- Supervisor: assigned events only, QR check-in.
- Admin: user management, supervisor accounts and event assignments.

## Local run

```bash
cd mobile
npm install
npx expo start
```

The default API origin is `https://noortoona.com`. Override it only when needed:

```bash
EXPO_PUBLIC_API_URL=https://your-preview.example npx expo start
```

## Payment configuration

The mobile checkout uses Moyasar. Never place a secret API key in the mobile app.

Netlify runtime variables:

- `MOYASAR_PUBLISHABLE_KEY` — publishable key returned to an authenticated customer only when checkout starts.
- `MOYASAR_SECRET_KEY` — server-only verification key.
- `MOYASAR_WEBHOOK_SECRET` — secret token configured on the Moyasar webhook.
- `MOYASAR_APPLE_MERCHANT_ID` — Apple Merchant ID; enables Apple Pay in the API response.
- `MOYASAR_STCPAY_ENABLED=true` — expose STC Pay only after it is enabled on the merchant account.

Native build variable:

- `EXPO_PUBLIC_APPLE_MERCHANT_ID` — must match `MOYASAR_APPLE_MERCHANT_ID` and the Apple Developer Merchant ID used to sign the iOS app.

Webhook URL:

```
https://noortoona.com/api/payments/webhook
```

The server independently fetches the Moyasar payment and validates payment ID, amount and currency before marking an order paid.

## Packages

Prices and guest limits are server-owned in `netlify/functions/_shared/payments.mjs`:

- البداية — SAR 29 — up to 50 guests
- الأساسية — SAR 99 — up to 200 guests
- الملكية — SAR 149 — up to 500 guests

One accepted WhatsApp send is allowed as the free test before payment. Remaining sends require a paid order.

## Native builds

```bash
cd mobile
npx expo prebuild --clean
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Moyasar contains native modules, so payment testing should use a native development/preview build rather than relying on Expo Go. Apple Pay additionally requires the signed Apple Merchant entitlement and a supported physical device.
