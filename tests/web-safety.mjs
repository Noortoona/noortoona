import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../invitation-renderer.js', import.meta.url), 'utf8');
const sandbox = { window: {}, URL };
vm.runInNewContext(renderer, sandbox);
const N = sandbox.window.NOORTOONA;

test('custom images cannot escape the style attribute or execute scripts', () => {
  for (const image of ['x" onpointerover="alert(1)', 'javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '//evil.test/a.png']) {
    assert.equal(N.safeImageUrl(image), '');
    const html = N.canvas({ design: { image } });
    assert.doesNotMatch(html, /onpointerover|onload|javascript:|evil\.test/);
  }
  assert.equal(N.safeImageUrl('data:image/jpeg;base64,YWJj'), 'data:image/jpeg;base64,YWJj');
  const html = N.canvas({ design: { image: 'https://example.test/image.png?q=" onclick="oops' } });
  assert.doesNotMatch(html, /" onclick=/);
  assert.match(html, /%22/);
});

test('Google Maps opens location and directions without collecting location', () => {
  const links = N.mapsLinks('', 'قاعة الرياض & مدخل 2');
  assert.equal(new URL(links.map).searchParams.get('query'), 'قاعة الرياض & مدخل 2');
  assert.equal(new URL(links.directions).searchParams.get('destination'), 'قاعة الرياض & مدخل 2');
  assert.equal(N.mapsLinks('https://maps.app.goo.gl/Example', '').map, 'https://maps.app.goo.gl/Example');
  assert.equal(N.mapsLinks('javascript:alert(1)', '').map, '');
  assert.equal(N.mapsLinks('https://maps.google.com.attacker.test/a', '').map, '');
  assert.equal(N.mapsLinks('https://name:pass@maps.google.com/a', '').map, '');
});

test('invitation audio is embedded locally and rejects executable/external sources', () => {
  assert.equal(N.safeAudioUrl('data:audio/mpeg;base64,YWJj'), 'data:audio/mpeg;base64,YWJj');
  for (const audio of ['javascript:alert(1)', 'https://tracker.test/a.mp3', 'data:text/html;base64,YWJj']) assert.equal(N.safeAudioUrl(audio), '');
});

test('QR is generated locally from an invitation code with no network request', async () => {
  const qr = { window: {} };
  vm.runInNewContext(await readFile(new URL('../assets/vendor/hala-qr.js', import.meta.url), 'utf8'), qr);
  const data = qr.window.HALA_QR.dataUrl('AB12CD34');
  assert.match(data, /^data:image\/svg\+xml;charset=utf-8,/);
  const svg = decodeURIComponent(data.split(',').slice(1).join(','));
  assert.match(svg, /viewBox="0 0 29 29"/);
  assert.match(svg, /M4,4h1v1h-1z/);
  assert.doesNotMatch(svg, /fetch|https?:\/\/(?!www\.w3\.org)|AB12CD34/);
  assert.throws(() => qr.window.HALA_QR.dataUrl('<img>'));
  assert.equal(data, qr.window.HALA_QR.dataUrl('AB12CD34'));
});

test('closing phone OTP resolves the pending create/login operation', async () => {
  const elements = new Map();
  const button = () => ({ onclick: null });
  const close = button();
  const modal = { dataset: {}, classList: { add() {}, remove() {} }, querySelectorAll: () => [close], querySelector: selector => {
    if (!elements.has(selector)) elements.set(selector, { ...button(), classList: { toggle() {} }, focus() {} });
    return elements.get(selector);
  } };
  const context = {
    window: {}, URL, URLSearchParams, location: { search: '', pathname: '/' }, crypto: { randomUUID: () => 'synthetic-visitor' },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: { referrer: '', getElementById: () => modal, querySelectorAll: () => [], body: { appendChild() {} } },
    fetch: async () => ({ ok: true, json: async () => ({}) }), setTimeout: () => 0,
  };
  // Allow the production modal initializer to register handlers, using a minimal DOM fixture.
  context.document.getElementById = () => elements.has('created') ? modal : null;
  context.document.createElement = () => { elements.set('created', true); return modal; };
  vm.runInNewContext(await readFile(new URL('../account.js', import.meta.url), 'utf8'), context);
  const waiting = context.window.HALA_AUTH.ensureLogin('create');
  await Promise.resolve(); await Promise.resolve();
  close.onclick();
  assert.equal(await waiting, null);
});

 test('same template name uses the correct occasion artwork', () => {
  assert.notEqual(N.templateByName('مخمل ملكي', 'wedding').position, N.templateByName('مخمل ملكي', 'milkah').position);
  const html = N.canvas({occasionKey:'milkah',template:'مخمل ملكي',name1:'أحمد',name2:'سارة'});
  assert.match(html,/100% 75%/);
  assert.match(html,/أحمد و سارة/);
});

test('guest insights provide read-only guidance for an empty event', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const { items, expected } = context.window.HALA_INSIGHTS.summarize({ capacity: 25 }, []);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, 'empty');
  assert.equal(expected, 0);
});

test('guest insights distinguish failures, unanswered invitations, linked views and capacity', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const rows = [
    { rsvp_status: 'pending', phone: '' },
    { rsvp_status: 'declined', phone: '0500', whatsapp_status: 'failed' },
    { rsvp_status: 'accepted', phone: '0511', attendance_state: 'normal',
      companion_count: 2, children_count: 1, whatsapp_status: 'delivered', viewed_at: null },
    { rsvp_status: 'accepted', phone: '0522', attendance_state: 'waitlist',
      companion_count: 3, children_count: 0, whatsapp_status: 'read', viewed_at: '2026-11-01' }
  ];
  const result = context.window.HALA_INSIGHTS.summarize({ capacity: 4 }, rows);
  assert.equal(result.expected, 4, 'waitlisted companions must not count toward confirmed capacity');
  assert.equal(result.items.map(i => i.key).join(','), 'failed,pending,phone,declined,unopened,capacity');
  assert.equal(result.items.find(i => i.key === 'pending').filterValue, 'pending');
  assert.equal(result.items.find(i => i.key === 'unopened').filterValue, 'unviewed');
  assert.match(result.items.find(i => i.key === 'failed').detail, /لا تعِد الإرسال/);
});

test('guest insights do not mislabel the provider sent status as an opened invitation', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../guest-insights.js', import.meta.url), 'utf8'), context);
  const report = context.window.HALA_INSIGHTS.summarize({}, [
    { rsvp_status: 'accepted', phone: '0511', whatsapp_status: 'sent', viewed_at: null },
    { rsvp_status: 'accepted', phone: '0522', whatsapp_status: 'read', viewed_at: '2026-11-01' },
  ]);
  assert.match(report.items.find(i => i.key === 'unopened').title, /^1 /);
  assert.ok(!report.items.some(i => i.key === 'failed'));
});
