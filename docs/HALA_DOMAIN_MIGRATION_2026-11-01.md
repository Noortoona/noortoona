# HALA domain migration

Owner-approved new primary domain: https://halainvites.com. Existing Netlify project/database remain in place; Vercel remains registrar and authoritative DNS provider. No hosting migration, new purchase, or payment activation.

Netlify-provided DNS targets:
- Apex ALIAS: apex-loadbalancer.netlify.com
- www CNAME: noortoona.netlify.app

Custom Vercel records override the default system records; unrelated CAA and wildcard records remain unchanged. Verify both names and valid HTTPS before making the domain primary.

Source updates canonical/OG metadata, the mobile default API origin and partner link. Explicit staging build guards cover both old and new production hosts. Existing review APKs still use their explicit preview API; a source change alone does not update an installed binary.

Legacy human-facing GET/HEAD routes use a permanent301 redirect preserving path/query. API/webhook routes and mutations bypass the redirect to retain original-origin authentication and callback behavior. No cross-domain session or browser-local draft migration is implied; users may need to sign in again on the new origin. Never send bearer/owner tokens to third-party migration services.

Pre-merge checks: root tests including actual production-order migration regression and domain-routing regression, mobile tests/typecheck, Netlify preview edge deployment. After publishing verify HTTPS, catalogue/pricing API, canonical metadata, old invitation/referral redirects, old API no-redirect behavior, and primary domain status.
