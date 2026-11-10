# HALA GA4 activation

Status: prepared and fail-closed until the owner completes Google account terms and a real web measurement ID is issued. No GA4 property existed in the approved Google account at the initial check. Google account creation is staged for HALA | هلا, property HALA Web — halainvites.com, Saudi Arabia timezone (UTC+3), currency SAR, Internet/Telecom category and small-business size. Goals are lead generation and traffic understanding. Optional account data sharing is unchecked.

## Activation gate

1. The account owner reviews and accepts Google's Analytics account terms in the staged wizard. Account creation/terms acceptance is not performed automatically.
2. Create one Web stream for https://halainvites.com named HALA Website. **Turn off Enhanced Measurement**, including automatic pageviews/history, forms, searches, outbound links, downloads and media. Only the explicitly sanitized events below should be sent. Do not enable Google Signals, advertising personalization, user-provided data collection or Ads links.
3. Record the actual property ID, stream ID and G- measurement ID supplied by Google. Put the issued measurement ID in ga4-config.js and set enabled:true. Never substitute a fabricated or sample ID. The current null/disabled configuration sends no Google requests.
4. Run checks and review a preview. Only the real production hostname can load Google; previews and localhost remain disabled. The automated browser tests use isolated production-origin fixtures and a fake Google SDK, never the production database or real Google collection.
5. Merge after passing CI, verify the Netlify production tag/config and test an explicitly consented public session in GA4 Realtime/DebugView. Do not submit a fabricated production booking to test completion. Use an isolated fixture for booking success/failure flows.
6. Connect the existing approved Google account to GA4 in OpenSEO, select this exact property, and verify measurement health. Google permission prompts require the owner's consent if they request new account access.

## Consent and privacy

- Google is loaded only after a visitor explicitly agrees to the updated notice naming Google Analytics 4. Legacy first-party consent alone never authorizes Google.
- A refusal or withdrawal disables Google measurement, drops queued commands and clears GA cookies without touching login or booking cookies. No denied-consent pings are intentionally enabled.
- Guest links, admin/customer/partner/supervisor portals, dashboards, private booking pages, unknown paths, previews and non-HTTPS origins never initialize GA4.
- Page locations are fixed canonical public URLs. Query strings, fragments, invitation codes, event/booking IDs, names, phone numbers, emails, custom text, full referrers and arbitrary campaign labels are not sent to Google.
- Only known occasion/package identifiers and allowlisted acquisition source/medium values are forwarded. Page titles are static constants, not user content. Advertising storage, ad user data and personalization are denied; Google Signals is off.
- No GA or GTM script is added to private-page HTML. The existing first-party metrics and full booking functionality remain available independently of GA4.

## Events

| Event | Meaning |
|---|---|
| page_view | One explicitly sent public-page view; default pageview is disabled |
| invitation_cta_clicked | Guide CTA clicked |
| booking_started | Invitation builder opened |
| occasion_selected | Occasion selection changed |
| package_viewed / price_viewed | Package or pricing step viewed |
| template_selected | Template selection occurred; custom template text is omitted |
| contact_started | Contact step started; field content is omitted |
| booking_request_completed | API successfully saved a preliminary booking request; this is **not** a payment or confirmed booking |
| lead_request_completed | API successfully saved a contact/interest/quote request; field contents are omitted |

Completion events run only after the successful corresponding API result. Rejected requests do not produce a completion event. They carry no entity or contact identifiers.

## Validation

Node privacy tests cover informed consent, legacy consent migration, allowlisted payloads, private paths, previews, malformed/unissued IDs and withdrawal. Browser tests simulate the approved hostname with a local database fixture and intercept the Google SDK to check that neither a page visit nor legacy consent triggers Google automatically. Existing booking/UI/mobile CI gates remain in place. The original marketing design and booking business logic are preserved; only the consent copy is clarified.
