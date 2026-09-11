import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { boundedInteger, calculateShareTotal, decideAttendance, partySize } from '../netlify/functions/_shared/domain.mjs';

global.window = {};
await import('../invitation-renderer.js');
const N = window.NOORTOONA;

assert.equal(N.occasions.length, 13, 'occasion coverage');
assert.equal(N.activities.length, 7, 'activity coverage');
for (const [group, templates] of Object.entries(N.catalog)) {
  assert.ok(templates.length >= 4, `${group} needs four visual templates`);
  assert.equal(new Set(templates.map(t => t.name)).size, templates.length, `${group} template names must be unique`);
}

const padel = N.catalog.padel[0];
const host = N.canvas({ occasionKey:'activity', activityKey:'padel', template:padel.name, name1:'مباراة الجمعة', date:'2026-12-14', time:'20:00', location:'الرياض', design:{ headline:'حياكم' } });
const guest = N.canvas({ occasionKey:'activity', activityKey:'padel', template:padel.name, name1:'مباراة الجمعة', date:'2026-12-14', time:'20:00', location:'الرياض', design:{ headline:'حياكم' } }, { guestName:'محمد' });
for (const value of ['مباراة الجمعة','الرياض','حياكم','invite-canvas']) assert.ok(host.includes(value), `host renderer: ${value}`);
for (const value of ['مباراة الجمعة','الرياض','حياكم','محمد','invite-canvas']) assert.ok(guest.includes(value), `guest renderer: ${value}`);
assert.ok(N.canvas({occasionKey:'custom',occasion:'ليلة خاصة',template:N.catalog.custom[0].name}).includes('ليلة خاصة'), 'custom occasion label reaches guest renderer');
assert.equal(calculateShareTotal(35, 2, true), 105, '35 SAR for guest and two companions totals 105 SAR');
assert.equal(calculateShareTotal(35, 2, false), 0, 'declined guests owe no share');
assert.equal(partySize(2, 1), 4, 'party size includes guest, companions and children');
assert.equal(boundedInteger(999, 0, 20), 20, 'numeric input is bounded');
assert.equal(decideAttendance({used:18,capacity:20,requested:3,waitlistEnabled:true}),'waitlist','overflow enters waitlist');
assert.equal(decideAttendance({used:18,capacity:20,requested:3,waitlistEnabled:false}),'full','overflow is rejected when waitlist is disabled');

for (const asset of ['atlas-activities-a.webp','atlas-social.webp','atlas-events.webp','atlas-formal.webp']) {
  await access(new URL(`../assets/templates/${asset}`, import.meta.url));
}

const [app, guestJs, guestHtml, indexHtml, dashboardJs, dashboardHtml, css, rsvp, dashboard, checkIn, whatsapp, netlifyConfig, migration] = await Promise.all([
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../guest.js', import.meta.url), 'utf8'),
  readFile(new URL('../guest.html', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard.js', import.meta.url), 'utf8'),
  readFile(new URL('../dashboard.html', import.meta.url), 'utf8'),
  readFile(new URL('../v2.css', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/functions/rsvp.mts', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/functions/event-dashboard.mts', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/functions/check-in.mts', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/functions/whatsapp-send.mts', import.meta.url), 'utf8'),
  readFile(new URL('../netlify.toml', import.meta.url), 'utf8'),
  readFile(new URL('../netlify/database/migrations/009_guest-checkin/migration.sql', import.meta.url), 'utf8'),
]);

assert.match(app, /line\.split\(\/\[,،\]\//, 'Arabic and English guest separators');
assert.match(app, /N\.canvas/, 'host must use shared invitation renderer');
assert.match(app, /محفوظ تلقائيًا/, 'draft progress is visible');
assert.match(app, /hasSavedDraft/, 'unfinished journey can be resumed');
assert.ok(app.indexOf("localStorage.setItem('noortoonaOwner'") < app.indexOf("fetch('/api/guests'"), 'owner access must be preserved before guest import');
assert.match(guestJs, /window\.NOORTOONA\.canvas/, 'guest must use shared invitation renderer');
assert.match(guestJs, /safeExternalUrl/, 'guest links must be restricted to safe web URLs');
assert.ok(guestHtml.indexOf('invitation-renderer.js') < guestHtml.indexOf('guest.js'), 'shared renderer must load before guest app');
assert.match(indexHtml, /https:\/\/noortoona\.com\//, 'official domain metadata');
assert.doesNotMatch(indexHtml, /قيد التجهيز|التحديث القادم|قالب جاهز أو محرر مرن أو AI/, 'no visible unfinished feature copy');
assert.match(css, /occasion-choice-grid\{grid-template-columns:repeat\(3,1fr\)/, 'three-column mobile occasion grid');
assert.match(css, /visual-template-grid\{grid-template-columns:repeat\(2,1fr\)/, 'two-column mobile template grid');
assert.match(rsvp, /calculateShareTotal/, 'share total uses tested domain rule');
assert.match(rsvp, /FOR UPDATE OF e, g/, 'capacity decision locks event and guest');
assert.match(rsvp, /decideAttendance/, 'waitlist behavior remains enabled');
assert.match(rsvp, /companionNames\.length !== companions/, 'named companions remain validated');
assert.match(dashboard, /payment_status/, 'payment state remains in dashboard API');
assert.match(dashboardJs, /x-noortoona-owner-token/, 'owner token is sent in a header');
assert.match(dashboardJs, /history\.replaceState/, 'legacy owner token is removed from the URL');
assert.match(dashboardJs, /decodeFromConstraints/, 'camera QR scanning is available');
assert.match(dashboardJs, /decodeFromImageUrl/, 'QR scanning from a saved image is available');
assert.match(dashboardHtml, /@zxing\/browser@0\.2\.1/, 'pinned QR decoder is loaded');
assert.match(checkIn, /WHERE event_id=\$\{eventId\} AND code=\$\{code\}/, 'check-in code is scoped to the event');
assert.match(checkIn, /already_checked_in/, 'check-in is idempotent');
assert.match(migration, /checked_in_at/, 'check-in database field exists');
assert.match(whatsapp, /message_status|whatsapp|template/i, 'WhatsApp sending remains connected');
assert.match(netlifyConfig, /from = "\/i\/\*"[\s\S]*to = "\/guest\.html\?code=:splat"/, 'unique invitation route');
assert.match(netlifyConfig, /from = "\/dashboard"[\s\S]*to = "\/dashboard\.html"/, 'dashboard route');

console.log(`NOORTOONA smoke passed: ${N.occasions.length} occasions, ${N.activities.length} activities, ${Object.values(N.catalog).flat().length} visual templates.`);
