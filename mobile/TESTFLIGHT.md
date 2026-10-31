# Hala iOS / TestFlight

Current EAS project:
- Expo owner: `hala.app`
- Slug: `hala`
- Project ID: `5aeba34d-6f95-424b-92b1-5519b5d20197`
- Bundle ID: `com.noortoona.hala`
- Build profile: `testflight`

## One-time Apple signing setup

The CI workflow is already authenticated to Expo through `EXPO_TOKEN` and can link the Hala EAS project. The first store build still requires Apple signing credentials to exist on EAS.

From `mobile/` run:

```bash
npm run ios:credentials
```

When prompted:
1. Select the `testflight` build profile.
2. Sign in to the Apple Developer account.
3. Choose **Build Credentials**.
4. Choose **All: Set up all the required credentials to build your project**.
5. Allow EAS to create/reuse the Distribution Certificate and create the App Store provisioning profile for `com.noortoona.hala`.

After this one-time setup, the GitHub workflow `Hala iOS TestFlight` can build non-interactively and submit the successful build.

Do not commit Apple passwords, 2FA codes, private keys, certificates, or provisioning profiles to Git.

## Verified blocker and trial alternatives (2026-10-31)

The latest inspected TestFlight run failed before creating a signed archive:
`Distribution Certificate is not validated for non-interactive builds` and
`Credentials are not set up. Run this command again in interactive mode.`
This is a signing prerequisite, not a TypeScript fix. Apple Developer membership,
valid signing assets and App Store Connect access have not been verified in this audit.

Do not assume a paid Apple Developer membership exists. Configure signing only
through the account owner's Apple authentication flow; do not store passwords or
2FA codes. No subscription purchase or production upload was performed.

For an earlier iPhone trial, start Expo against an isolated staging backend:

```bash
EXPO_PUBLIC_API_URL=https://your-staging.example EXPO_PUBLIC_PAYMENTS_ENABLED=false npx expo start
```

Open the resulting QR in a compatible Expo Go app. Payment stays disabled and
the native checkout SDK loads only when explicitly enabled in a native build.
This path still requires an on-device verification; a successful JS export alone
is not an installable IPA or a completed TestFlight upload.

EAS `preview` generates an Android APK; iOS internal distribution still needs
signing and registered test devices. The `simulator` profile produces an iOS
simulator build without distribution signing, which cannot be installed on an iPhone.
Set `EXPO_PUBLIC_API_URL` in the EAS preview/production build environment before
starting any preview, simulator or TestFlight build.
