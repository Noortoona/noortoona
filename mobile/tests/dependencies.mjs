import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { realpathSync, readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const queryString = require('query-string');
const decoder = require('decode-uri-component');
const requireFromQueryString = createRequire(require.resolve('query-string'));

test('router query parser resolves the reviewed CJS compatibility decoder', () => {
  assert.equal(typeof decoder, 'function');
  assert.equal(realpathSync(require.resolve('decode-uri-component')), realpathSync(requireFromQueryString.resolve('decode-uri-component')));
  assert.match(realpathSync(require.resolve('decode-uri-component')), /vendor\/decode-uri-component-cjs\/index\.cjs$/);
  const manifest = JSON.parse(readFileSync(new URL('../vendor/decode-uri-component-cjs/package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.name, '@hala/decode-uri-component-cjs');
  assert.equal(manifest.version, '0.5.1-hala.1');
});

test('normal, Arabic, repeated and literal-plus route parameters retain their contract', () => {
  assert.deepEqual({ ...queryString.parse('name=%D9%87%D9%84%D8%A7&city=Riyadh+City&note=a%2Bb&x=1&x=2') }, {
    name: 'هلا', city: 'Riyadh City', note: 'a+b', x: ['1', '2'],
  });
  assert.equal(decoder('a+b'), 'a b');
  assert.equal(decoder('a%2Bb'), 'a+b');
  assert.equal(queryString.parse('note=a+b', { decode: false }).note, 'a+b');
  assert.throws(() => decoder(5), TypeError);
});

test('malformed UTF-8 route parameters remain tolerant without recursive rescanning', () => {
  assert.equal(queryString.parse('note=%C2').note, '\uFFFD');
  assert.equal(queryString.parse('note=%FE%FF').note, '\uFFFD\uFFFD');
  assert.equal(queryString.parse('note=%E0%A4%A').note, '%E0%A4%A');
  assert.equal(queryString.parse('note=%25C2').note, '%C2');
  assert.equal(queryString.parse('note=%ZZ').note, '%ZZ');
});

test('large malformed route input completes inside a bounded worker', async () => {
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort } = require('node:worker_threads');
      const parser = require(${JSON.stringify(require.resolve('query-string'))});
      const input = Array.from({length: 25000}, (_, i) => '%C2%' + (i % 256).toString(16).padStart(2, '0') + 'x').join('');
      const value = parser.parse('note=' + input).note;
      parentPort.postMessage({length:value.length,hasText:value.includes('x')});
    `, { eval: true });
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Malformed route decoding exceeded 4 seconds')); }, 4000);
    worker.once('message', value => { clearTimeout(timeout); worker.terminate(); resolve(value); });
    worker.once('error', error => { clearTimeout(timeout); reject(error); });
  });
  assert.ok(result.length > 25000);
  assert.equal(result.hasText, true);
});
