# Hala Mobile

Native iOS/Android app for Hala. The app lives under `mobile/` and uses the existing Netlify backend.

## Current roles

- Customer: self registration, events, templates, guests, WhatsApp status and payment.
- Supervisor: assigned events only, QR check-in.
- Admin: user management, supervisor accounts and event assignments.

## Local run

```bash
cd mobile
npm ci
npx expo start
```

Local development defaults to the production API origin `https://halainvites.com`. Use an isolated staging backend for testing:

```bash
EXPO_PUBLIC_API_URL=https://your-staging.example EXPO_PUBLIC_PAYMENTS_ENABLED=false npx expo start
```

## Trial safety and phone testing

- Payment is disabled in the mobile UI by default. `EXPO_PUBLIC_PAYMENTS_ENABLED=true` is required to load the native checkout, and the server must independently permit payments. Do not set this for the trial.
- The payment route defers loading Moyasar native components. This allows the trial screens to be bundled without evaluating the payment SDK in Expo Go. A physical iPhone/Expo Go session is still required to confirm compatibility with its installed Expo SDK.
- EAS `preview`, `simulator`, and `testflight` builds require an explicit HTTPS `EXPO_PUBLIC_API_URL` origin. Set it to an isolated staging backend in the EAS environment; do not test against customer production data.
- Creating a new event opens the event dashboard for the free trial rather than starting checkout. Trial quota and permissions remain server-controlled.
- Invitation customization supports headline/message, font/accent, a cropped custom background image (up to 600,000 data-URI characters) and a user-selected audio clip (up to 600 KiB). These are embedded in the event JSON, not uploaded to a separate media store. Guest playback requires user action.
- The review screen uses a generated copy of the shared web invitation renderer/CSS in a restricted WebView. After changing web rendering, run `npm run sync:preview` in `mobile/`; `npm test` checks synchronization. Assets/fonts require network access to the configured backend and Google Fonts.
- Location display and directions open Google Maps; they do not request background tracking or a paid Maps SDK.

```bash
npm test
npm run typecheck
```

## Payment configuration

The mobile checkout uses Moyasar. Never place a secret API key in the mobile app.

Netlify runtime variables:

- `MOYASAR_PUBLISHABLE_KEY` — publishable key returned to an authenticated customer only when checkout starts.
- `MOYASAR_SECRET_KEY` — server-only verification key.
- `MOYASAR_WEBHOOK_SECRET` — secret token configured on the Moyasar webhook.
- `MOYASAR_APPLE_MERCHANT_ID` — Apple Merchant ID; enables Apple Pay in the API response.
- `MOYASAR_STCPAY_ENABLED=true` — expose STC Pay only after it is enabled on the merchant account.

Server payment gate:

- `HALA_PAYMENT_MODE=disabled` is the default. `test` requires matching test keys. `live` additionally requires the explicit production activation gate described in the backend documentation.

Native build variables:

- `EXPO_PUBLIC_PAYMENTS_ENABLED` — absent/false for all trial builds.
- `EXPO_PUBLIC_API_URL` — HTTPS origin of the isolated staging backend.


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
# Simulator build requires no Apple signing but cannot be installed on an iPhone:
eas build --profile simulator --platform ios
eas build --profile preview --platform android
```

Moyasar contains native modules, so payment testing should use a native development/preview build rather than relying on Expo Go. Apple Pay additionally requires the signed Apple Merchant entitlement and a supported physical device.

## iOS TestFlight CI

Inspect `.github/workflows/hala-ios-testflight.yml` for its current manual build and submission controls.
Save an Expo access token in the repository Actions secret `EXPO_TOKEN`; never
commit it. Run the workflow manually on the reviewed development branch.

CI uses Node 24.19.0, EAS CLI 24.10.0, the committed npm lockfile, TypeScript and
Expo Doctor. It searches accessible Expo accounts for the existing `hala`
project before creating anything, then verifies and saves the linked owner and
project ID in the `hala-eas-project` artifact. Commit those public config values
back into `mobile/app.json` after the first link.

The `testflight` profile creates a Release build for App Store distribution with
remote signing credentials and a remote incrementing build number. CI waits for
the signed archive. Submission must be requested separately through the workflow controls.
If submission needs Apple setup, dispatch again with `build_id` set to the
successful EAS build ID to submit it without paying for another build.

First-time Apple credentials must be configured for the same EAS project and
`com.noortoona.hala`. If interactive setup is needed:

```bash
cd mobile
npx eas-cli@24.10.0 login
npx eas-cli@24.10.0 credentials --platform ios
```

Select `testflight`, set up the distribution certificate and provisioning
profile, and configure the App Store Connect API key for EAS Submit. Apple
login/2FA stays in Apple's authentication flow. No signing keys belong in Git.

## Dependency security review (1 November 2026)

The SDK57-compatible router uses `query-string@7.1.3`, which requires a callable CommonJS URI decoder. The vulnerable transitive decoder is replaced by an explicit local `@hala/decode-uri-component-cjs@0.5.1-hala.1` adaptation of the official patched upstream0.5.1 algorithm. The only adaptations are the CommonJS export and legacy plus-as-space behavior. See `vendor/decode-uri-component-cjs/PROVENANCE.md` and its unchanged upstream MIT license. This is not an unmodified upstream release or an audit suppression.

`npm test` includes four dependency regressions: actual router resolution, normal/Arabic/repeated query parameters, malformed percent encodings, and a large malformed input inside a bounded worker. iOS and Android Metro/Hermes exports were checked after the repair.

The recorded npm audit count decreased from17 alerts (5 high) to14 alerts (2 high; no critical). The remaining high entries are Zod and the propagated Expo CLI advisory. `npm ls zod` places it in the Expo CLI/build-tool dependency chain; HALA does not import it in application code. Build tools still need to be treated as affected: do not feed untrusted project/plugin configuration into these tools. Other low/moderate SDK tooling advisories also remain. This is not a claim that the entire dependency graph is vulnerability-free. A compatible upstream repair or a separately validated Expo SDK migration remains a release-hardening item; no `npm audit fix --force` or untested major Zod/Expo replacement was applied.
