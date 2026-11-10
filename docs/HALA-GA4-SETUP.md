# HALA GA4 activation

Status: the owner completed Google account terms. The approved HALA web stream was created and its issued ID configured for production activation after CI.

- Account: `415828502` (HALA | هلا)
- Property: `563711310` (HALA Web — halainvites.com)
- Web stream: `16315279411` (HALA Website), `https://halainvites.com`
- Measurement ID: `G-Q630WGGXZ5`
- Timezone: Saudi Arabia (UTC+3); currency: SAR.
- Enhanced Measurement: confirmed OFF in stream details. Optional account data sharing and email subscriptions were not enabled.

## Release verification

Merge only after CI passes. Verify the Netlify production configuration, then check an explicitly consented public session in GA4 Realtime. Production completion events must not be tested by submitting fabricated bookings. Automated tests use isolated booking fixtures and an intercepted Google SDK. Previews and localhost never initialize the real SDK. OpenSEO must select this exact property; new Google permission grants require the owner's consent.

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
