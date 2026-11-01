import test from 'node:test';
import assert from 'node:assert/strict';
import redirect, { config } from '../netlify/edge-functions/canonical-domain.js';

test('legacy invitation navigation retains path and referral/query data on the new HTTPS domain', () => {
  for (const host of ['noortoona.com', 'www.noortoona.com']) {
    for (const method of ['GET', 'HEAD']) {
      const response = redirect(new Request(`https://${host}/i/AB12CD34?ref=VENUE01&source=qr`, { method }));
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), 'https://halainvites.com/i/AB12CD34?ref=VENUE01&source=qr');
    }
  }
  assert.equal(redirect(new Request('http://noortoona.com/?ref=VENUE01')).headers.get('location'), 'https://halainvites.com/?ref=VENUE01');
});

test('API, webhook and mutation requests retain their original method and origin', () => {
  for (const path of ['/api/catalog', '/api/whatsapp/webhook', '/.netlify/functions/whatsapp-webhook']) {
    for (const method of ['GET', 'POST']) assert.equal(redirect(new Request('https://noortoona.com'+path, { method })), undefined);
  }
  assert.equal(redirect(new Request('https://noortoona.com/admin', { method: 'POST' })), undefined);
  assert.ok(config.path.every(path => !path.includes('/api') && !path.includes('/assets')));
});

test('new domain and previews never redirect or accept lookalike hosts', () => {
  for (const host of ['halainvites.com', 'www.halainvites.com', 'deploy-preview-6--noortoona.netlify.app', 'noortoona.com.evil.test']) {
    assert.equal(redirect(new Request(`https://${host}/?ref=VENUE01`)), undefined);
  }
});
