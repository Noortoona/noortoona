import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

const require = createRequire(import.meta.url);
// Expo Router SDK 58 no longer exposes the previous query-string dependency.
// Test standard URL query behavior rather than depending on router internals.
const decoder = require('decode-uri-component');

test('SDK58 preserves reviewed fallback URI decoder without relying on old router dependencies', () => {
  assert.equal(typeof decoder, 'function');
  assert.match(realpathSync(require.resolve('decode-uri-component')), /vendor\/decode-uri-component-cjs\/index\.cjs$/);
  const manifest = JSON.parse(readFileSync(new URL('../vendor/decode-uri-component-cjs/package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, '@hala/decode-uri-component-cjs');
  assert.equal(manifest.version, '0.5.1-hala.1');
  const app = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(app.dependencies.expo, /58/);
  assert.match(app.dependencies['expo-router'], /58/);
});

test('native URL query parser preserves Arabic, repeated, space and encoded-plus semantics', () => {
  const p = new URLSearchParams('name=%D9%87%D9%84%D8%A7&city=Riyadh+City&note=a%2Bb&x=1&x=2');
  assert.equal(p.get('name'), 'هلا');
  assert.equal(p.get('city'), 'Riyadh City');
  assert.equal(p.get('note'), 'a+b');
  assert.deepEqual(p.getAll('x'), ['1', '2']);
  assert.equal(decoder('a+b'), 'a b');
  assert.equal(decoder('a%2Bb'), 'a+b');
  assert.throws(() => decoder(5), TypeError);
});

test('malformed UTF-8 URL parameters are safe and never double decoded', () => {
  assert.equal(new URLSearchParams('note=%C2').get('note'), '\uFFFD');
  assert.equal(new URLSearchParams('note=%FE%FF').get('note'), '\uFFFD\uFFFD');
  assert.equal(new URLSearchParams('note=%E0%A4%A').get('note'), '\uFFFD%A');
  assert.equal(new URLSearchParams('note=%25C2').get('note'), '%C2');
  assert.equal(new URLSearchParams('note=%ZZ').get('note'), '%ZZ');
});

test('large malformed URL parameter completes in bounded worker', async () => {
  const result = await new Promise((resolve, reject) => {
    const workerSource = 'const { parentPort } = require("node:worker_threads");' +
      'const input = Array.from({length: 25000}, (_, i) => "%C2%" + (i % 256).toString(16).padStart(2, "0") + "x").join("");' +
      'const value = new URLSearchParams("note=" + input).get("note");' +
      'parentPort.postMessage({length:value.length,hasText:value.includes("x")});';
    const worker = new Worker(workerSource, { eval: true });
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Malformed URL decoding exceeded 4 seconds')); }, 4000);
    worker.once('message', value => { clearTimeout(timeout); worker.terminate(); resolve(value); });
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
  });
  assert.ok(result.length > 25000);
  assert.equal(result.hasText, true);
});
