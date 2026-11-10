# HALA SEO and official digital presence — 10 November 2026

## Scope and baseline

PR #31 was already merged into `main` as `f385dd14fddaa8675128b80803a5870659e58605` and published by Netlify deploy `6af2c6db8ca0e2096bd51143`. Its working Arabic metadata, guides, robots and sitemap were retained.

Before release, this change was merged with current production commit `59e1693d220a6bfb3fac2f54d2fff2e52ccdc476`, retaining the newer pricing policy, entry organization, mobile updates and full iPhone/Desktop/Android test matrix.

Relative to that production baseline, the homepage `<main>`, invitation modal, styles.css, v2.css, app.js, booking.js, booking-client.js and account.js remain byte-for-byte unchanged. Browser comparison of the header and every main section returned identical positions and sizes at the same desktop viewport. The requested social/contact links are the only visible homepage addition, within its existing footer paragraph.

## Delivered in this change

- Official Instagram and TikTok links open in a separate tab with `noopener noreferrer`, clear accessible names, SVG icons and 44px minimum targets. Email uses `mailto:hello@halainvites.com`.
- Organization schema consistently identifies the approved email, official social URLs in `sameAs`, and Saudi service market. No invented rating, address or customer count is added.
- Three English translations of the existing occasion guides retain the same page stylesheet. Each pair declares self-canonical URLs and reciprocal `ar-SA`, `en-SA` and Arabic `x-default` alternatives. These serve the existing invitation categories; no thin keyword or city pages are created.
- Sitemap contains the homepage and all six occasion guides, including language alternatives. `robots.txt` remains crawlable so search engines can discover private-page noindex instructions.
- Static private portals, booking and `/i/*` invitation aliases receive HTTP `X-Robots-Tag: noindex, nofollow, noarchive`, in addition to existing HTML noindex. This complements authentication and does not replace it.
- Existing optional first-party analytics records public guide page views, `invitation_cta_clicked` and the existing `booking_started` event, carrying marketing source between pages. Declining measurement still permits the full journey. Query strings, contact fields and guest invitation codes are excluded; private portal and guest paths are ignored before analytics database writes. English guides use English privacy copy. No Google tracking library or new privacy setting is activated.

## Public URLs

| Language | Wedding | Milkah/engagement | Graduation |
|---|---|---|---|
| Arabic | https://halainvites.com/wedding-invitations.html | https://halainvites.com/engagement-invitations.html | https://halainvites.com/graduation-invitations.html |
| English | https://halainvites.com/wedding-invitations-en.html | https://halainvites.com/engagement-invitations-en.html | https://halainvites.com/graduation-invitations-en.html |

Homepage: https://halainvites.com/

Sitemap: https://halainvites.com/sitemap.xml

Robots: https://halainvites.com/robots.txt

## External integrations: observed state

| Integration | Evidence | Remaining action |
|---|---|---|
| Search Console | OpenSEO sees Google account `shinko77@gmail.com` and URL-prefix `https://halainvites.com/`, with permission `siteUnverifiedUser`, not selected | Sign in to Google, obtain its actual verification artifact, deploy it, click Verify, then submit sitemap. Never fabricate a token. |
| Search Console in OpenSEO | Project exists at https://app.openseo.so/p/1c0cfdbf-d9cf-4b01-b3c2-f8feaf20fb40 ; property is not bound | Select the property only after ownership is verified; confirm via performance and URL Inspection APIs. |
| GA4 | No GA4 account/property is available through OpenSEO; measurement health returns `ga4_not_connected`; public source contains no G- measurement ID | After Google sign-in, check existing approved properties. Do not create a duplicate. Activation needs the actual approved web stream and consent-respecting instrumentation. |
| Instagram | User-approved https://www.instagram.com/halainvites/ returns “Profile isn't available” to the public browser; Metricool reports `instagramData: noortoona` | Account owner needs to confirm availability/access. No username, profile image, bio, existing website link or post was changed. Footer/schema use the exact URL the user explicitly approved; public availability is not claimed. |
| TikTok | Metricool reports connected `tiktokData: halainvites`; public profile requires login because audience controls are enabled | Inspect profile name, image, bio and website after authenticated access. Do not change audience/privacy controls or username. |

Search Console sign-in: https://search.google.com/search-console

OpenSEO integration settings: https://app.openseo.so/p/1c0cfdbf-d9cf-4b01-b3c2-f8feaf20fb40/settings/integrations

## Performance and indexing

A baseline OpenSEO audit (`6d7b606c-6d4d-4330-8937-7ad321710073`) completed a 10-page crawl and 20 Lighthouse checks with no failed Lighthouse jobs. Report: https://app.openseo.so/p/1c0cfdbf-d9cf-4b01-b3c2-f8feaf20fb40/audit?auditId=6d7b606c-6d4d-4330-8937-7ad321710073 .

The audit found no critical issue. It flags metadata on intentionally noindexed private portals, canonicalized extensionless guide aliases and one heading-level skip in the existing decorative homepage preview. Its orphan warnings for `.html` guide URLs need to be interpreted alongside the direct static links and canonical aliases; the real homepage and related guides link to those URLs.

Lighthouse is a lab check. Search Console field Core Web Vitals and actual Google indexing cannot be confirmed without verified property access. HTTP 200, sitemap inclusion and `index,follow` establish eligibility, not indexing or ranking.

## Verification and release gate

- Local full `npm test` covers backend permissions, persisted prebookings, analytics consent, sanitization, private-token exclusion, web SEO and static publication boundaries.
- Netlify Functions typecheck passes.
- PR CI must pass the web test suite (including iPhone, Desktop and Android browser projects) and mobile checks (typecheck, behavior tests, Expo Doctor, native prebuild, iOS/Android JS bundles).
- Publish only after the GitHub checks and Netlify Deploy Preview pass. Verify the deployed HTML, schema, seven sitemap entries and HTTP noindex headers afterward.
- Do not submit test bookings or dispatch messages against production. Protected data checks are anonymous and read-only; behavioral booking tests use isolated local PostgreSQL fixtures in CI.
