import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire, registerHooks } from 'node:module';
import { normalizeSaudiPhone, normalizeDigits } from '../src/input.ts';
import { isGoogleMapsUrl, mapsLinks } from '../src/links.ts';
import { api, ApiError, BASE_URL } from '../src/api.ts';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { templateCatalog, occasionForApi } from '../src/templateCatalog.ts';
import { imageDataUri, audioDataUri, MAX_AUDIO_BYTES } from '../src/designMedia.ts';
registerHooks({resolve(specifier,context,next){if(specifier==='./templateCatalog'&&context.parentURL.endsWith('/catalog.ts'))return {url:new URL('./templateCatalog.ts',context.parentURL).href,shortCircuit:true};return next(specifier,context)}});
const { DEFAULT_PACKAGES, publicCatalog, availableTemplatesFor } = await import('../src/catalog.ts');

test('Saudi OTP accepts local, international and Arabic input without accepting incomplete numbers', () => {
  for (const value of ['050 000 0001', '+966500000001', '00966500000001', '٥٠٠٠٠٠٠٠١', '۰۵۰۰۰۰۰۰۰۱']) {
    assert.equal(normalizeSaudiPhone(value), '966500000001');
  }
  for (const value of ['', '50000', '971500000001', '966150000001']) assert.equal(normalizeSaudiPhone(value), null);
  assert.equal(normalizeDigits('١۲٣۴٥۶'), '123456');
});

test('Maps links support venue search and directions with encoded input, reject unsafe saved links', () => {
  assert.equal(isGoogleMapsUrl('https://maps.app.goo.gl/example'), true);
  assert.equal(isGoogleMapsUrl('https://www.google.com/maps?q=24,46'), true);
  for (const value of ['javascript:alert(1)', 'https://google.com.evil.test/maps', 'https://user:pass@google.com/maps', 'http://google.com/maps']) assert.equal(isGoogleMapsUrl(value), false);
  const links = mapsLinks('قاعة هلا & الرياض', 'javascript:alert(1)');
  assert.equal(new URL(links.view).searchParams.get('query'), 'قاعة هلا & الرياض');
  assert.equal(new URL(links.directions).searchParams.get('destination'), 'قاعة هلا & الرياض');
  assert.deepEqual(mapsLinks(), { view: null, directions: null });
});

test('API propagates authorization, rejects HTML success responses and preserves server denial', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, `${BASE_URL}/api/auth/me`);
      assert.equal(options.headers.get('authorization'), 'Bearer fixture-token');
      assert.equal(options.headers.get('accept'), 'application/json');
      assert.ok(options.signal);
      return Response.json({ user: { role: 'customer' } });
    };
    assert.deepEqual(await api('/api/auth/me', {}, 'fixture-token'), { user: { role: 'customer' } });
    globalThis.fetch = async () => new Response('<html>static fallback</html>', { status: 200 });
    await assert.rejects(api('/api/auth/me'), error => error instanceof ApiError && error.status === 502);
    globalThis.fetch = async () => Response.json({ error: 'denied' }, { status: 403 });
    await assert.rejects(api('/api/auth/me'), error => error instanceof ApiError && error.status === 403 && error.message === 'denied');
  } finally { globalThis.fetch = previous; }
});

test('trial build requires explicit staging origin and omits payment entitlement by default', () => {
  const require = createRequire(import.meta.url);
  const configure = require('../app.config.js');
  const saved = { ...process.env };
  try {
    process.env.EAS_BUILD_PROFILE = 'preview';
    delete process.env.EXPO_PUBLIC_API_URL;
    assert.throws(() => configure({ config: {} }), /staging/);
    process.env.EXPO_PUBLIC_API_URL = 'http://example.test';
    assert.throws(() => configure({ config: {} }), /HTTPS/);
    for (const origin of ['https://noortoona.com', 'https://halainvites.com', 'https://www.halainvites.com']) {
      process.env.EXPO_PUBLIC_API_URL = origin;
      assert.throws(() => configure({ config: {} }), /production domain/);
    }
    process.env.EXPO_PUBLIC_API_URL = 'https://staging.example.test';
    process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID = 'merchant.example.hala';
    delete process.env.EXPO_PUBLIC_PAYMENTS_ENABLED;
    assert.equal(configure({ config: {} }).ios.entitlements, undefined);
    process.env.EXPO_PUBLIC_PAYMENTS_ENABLED = 'true';
    assert.deepEqual(configure({ config: {} }).ios.entitlements['com.apple.developer.in-app-payments'], ['merchant.example.hala']);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('mobile activity/milkah payload and template artwork match the actual web guest contract', () => {
  const context = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../../invitation-renderer.js', import.meta.url), 'utf8'), context);
  vm.runInNewContext(readFileSync(new URL('../../invitation-schemas.js', import.meta.url), 'utf8'), context);
  const web = context.window.NOORTOONA;
  assert.equal(occasionForApi('activity', 'نشاط / تجمع'), 'تجمع ونشاط');
  assert.equal(occasionForApi('milkah', 'ملكة / عقد قران'), 'ملكة');
  assert.ok(context.window.HALA_V6_SCHEMA.schemaFor('milkah').fields.some(field => field.key === 'name2'));
  const html = web.canvas({ occasionKey: 'milkah', name1: 'الأول', name2: 'الثاني', template: templateCatalog.milkah[0].name });
  assert.ok(html.includes('الأول و الثاني'));
  for (const [key, options] of Object.entries(templateCatalog)) {
    for (const [index, option] of options.entries()) {
      const expected = web.catalog[key][index];
      assert.equal(option.name, expected.name, key);
      assert.ok(expected.atlas.endsWith(`atlas-${{ activities: 'activities-a', social: 'social', events: 'events', formal: 'formal' }[option.atlas]}.webp`));
      assert.equal(expected.position, `${['0%', '33.333%', '66.667%', '100%'][option.col]} ${['0%', '25%', '50%', '75%', '100%'][option.row]}`);
    }
  }
});

test('custom image/audio use guest-compatible data URIs and enforce combined payload bounds', () => {
  assert.ok(imageDataUri('/9j/AAAA').startsWith('data:image/jpeg;base64,'));
  assert.ok(imageDataUri('iVBORAAAAAAA').startsWith('data:image/png;base64,'));
  assert.throws(() => imageDataUri('AAAA'), /JPEG/);
  assert.throws(() => imageDataUri('/9j/' + 'A'.repeat(600_000)), /كبيرة/);
  assert.ok(audioDataUri('AAAA', 'audio/x-m4a', 'clip.m4a').startsWith('data:audio/mp4;base64,'));
  assert.throws(() => audioDataUri('AAAA', 'text/html', 'script.html'), /MP3/);
  assert.throws(() => audioDataUri('A'.repeat((MAX_AUDIO_BYTES + 3) / 3 * 4), 'audio/mpeg', 'clip.mp3'), /600/);
  const image = imageDataUri('/9j/' + 'A'.repeat(599_940));
  const audio = audioDataUri('A'.repeat(MAX_AUDIO_BYTES / 3 * 4), 'audio/mpeg', 'clip.mp3');
  assert.ok(JSON.stringify({ design: { image, audio }, message: 'دعوة' }).length < 1_500_000);
});

test('mobile consumes admin catalog prices and hides only matching template groups', () => {
  const response={version:1,packages:DEFAULT_PACKAGES.map(pkg=>({...pkg,amount:pkg.amount+1000})),hiddenTemplateKeys:['wedding:مخمل ملكي'],services:[{id:'service',name:'تنسيق',description:'خدمة المناسبة',enabled:true},{id:'hidden',name:'غير متاحة',description:'موقوفة',enabled:false}]};
  const catalog=publicCatalog(response);
  assert.equal(catalog.packages[0].amountSar,459);
  assert.equal(catalog.services.length,1);
  assert.equal(availableTemplatesFor('wedding','padel',catalog.hiddenTemplateKeys).some(item=>item.name==='مخمل ملكي'),false);
  assert.equal(availableTemplatesFor('milkah','padel',catalog.hiddenTemplateKeys).some(item=>item.name==='مخمل ملكي'),true);
  assert.equal(publicCatalog({...response,packages:[null,...DEFAULT_PACKAGES.slice(1)]}),null);
  assert.equal(publicCatalog({...response,hiddenTemplateKeys:['unknown:template']}),null);
  const context={window:{},URL};vm.runInNewContext(readFileSync(new URL('../../invitation-renderer.js',import.meta.url),'utf8'),context);
  const web=context.window.NOORTOONA.catalogData(response);
  assert.equal(JSON.stringify(web),JSON.stringify(catalog));
});
