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
