# HALA staging verification

This branch is review-only. Do not merge to main or deploy production without the owner's approval. Do not use production customer data for fixtures.

## Reproduce checks

Use Node 24 and the committed lockfiles:

```sh
npm ci
npm test
npm run build
npx tsc --noEmit --skipLibCheck --allowJs false --module nodenext --moduleResolution nodenext --target ES2022 --lib ES2022,DOM netlify/functions/*.mts
npm ci --prefix mobile
npm run typecheck --prefix mobile
npm test --prefix mobile
```

After changing invitation-renderer.js or v2.css, run `node mobile/scripts/sync-invitation-preview.mjs` and review the generated source. Do not commit node_modules, .env, signing files, native generated projects or build outputs.

## Backend isolation

Confirm the Netlify Deploy Preview uses a separate database branch before applying migrations or creating fixtures. Registering a secret is not proof that the database is isolated. Apply all tracked migrations in order, including `20261101063000_customer-free-trial` and `20261101063100_catalog-order-entitlements`, `20261101023000_supervisor-price-pitch-deck`, and `20261101024000_supervisor-price-599`. New supervisor requests use the configured current price and require a male/female preference; previously agreed request amounts must remain unchanged. Verify the durable ledger and backfill before sender tests. Never run the migration against production as part of this task.

The Vercel deployment serves the public dist frontend. It has no Netlify Functions runtime. Do not direct it to production APIs to make staging appear functional. Use a real staging Netlify backend for integrated review.

## Providers

Keep `HALA_PAYMENT_MODE=disabled`. Test-mode payments, if explicitly required later, must use only pk_test/sk_test credentials. Live requires separate approval and is outside this review.

Check existing 360dialog sender activation, authentication/invitation template approval, language, mode, and webhook authentication. Keep provider keys in platform secret storage. Sandbox mode is not proof of delivery. Use a designated test recipient with authorization, then verify queued → sent → delivered/read from authenticated callbacks. Do not auto-resend an uncertain provider outcome.

## Device trial

Use `EXPO_PUBLIC_API_URL` with a verified HTTPS staging origin, not a production domain. Trial config rejects known production domains. Keep `EXPO_PUBLIC_PAYMENTS_ENABLED=false`. APK/internal and simulator profiles are configured. A simulator archive cannot be installed on an iPhone. See `mobile/TESTFLIGHT.md` for the signing blocker and exact flow.

The read-only EAS status workflow can inspect the existing project/build list using the existing GitHub secret without printing credentials or artifact URLs. It does not create builds, signing credentials or subscriptions. A missing/expired secret is a blocker to record, not a reason to create another project.

The TestFlight workflow is manual; do not select signing-ready until Apple membership, distribution certificate and provisioning were actually checked. Submission is an independent checkbox defaulting false. Do not guess App Store Connect identifiers.

## Required release evidence

- Customer/admin/supervisor/partner OTP and role denial on the isolated backend.
- Event creation and uploaded design/music retained after reload on both device families.
- One customer trial remains consumed across event creation and guest deletion; no repeated sends.
- Two independent PostgreSQL sessions and two devices concurrently scanning the same QR; only one initial arrival.
- Supervisor scoped to assigned events, including after suspension or role change.
- Verified payment sandbox callback, server amount/currency comparison, and one eligible partner commission if payment testing is enabled later.
- Real iPhone camera, photo/audio selection, invitation opening and Maps directions.
- Logs and device/build links associated with the exact commit, plus rollback and production approval.

Catalog edits use an expected revision; reload on HTTP409. Test a paid order before and after changing current prices/limits and verify the saved guest_limit remains unchanged. Native review APK uses only generated debug signing and is not a Play Store release.

Production migration order repair: the pending trial/catalog migrations were renamed after the already-applied production watermark20261101024000. Previously applied production migrations remain byte-for-byte unchanged. Validate in a new Deploy Preview database branch, not the closedPR6 branch that already applied the original names. Never reset production or edit its migration history.
