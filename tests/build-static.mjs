import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStatic, publicFiles } from '../scripts/build-static.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hala-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const file of publicFiles) await writeFile(join(root, file), file);
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'brand.svg'), '<svg/>');
  return root;
}

test('public output includes the entire web surface and excludes server, source and credentials', async t => {
  const root = await fixture(t);
  for (const file of ['.env', 'secret.mjs', 'README.md', 'package.json']) await writeFile(join(root, file), 'private fixture');
  for (const dir of ['netlify', 'mobile', 'tests', '.github']) {
    await mkdir(join(root, dir));
    await writeFile(join(root, dir, 'private.txt'), 'private fixture');
  }
  await mkdir(join(root, 'dist'));
  await writeFile(join(root, 'dist', 'old-private.txt'), 'stale output');
  const output = await buildStatic(root);
  assert.deepEqual((await readdir(output)).sort(), [...publicFiles, 'assets'].sort());
  for (const file of publicFiles) assert.equal(await readFile(join(output, file), 'utf8'), file);
  assert.equal(await readFile(join(output, 'assets', 'brand.svg'), 'utf8'), '<svg/>');
});

test('a symlink cannot smuggle a secret into the public assets tree', async t => {
  const root = await fixture(t);
  await writeFile(join(root, '.env'), 'private fixture');
  await symlink(join(root, '.env'), join(root, 'assets', 'leak.txt'));
  await assert.rejects(buildStatic(root), /symbolic links/);
});
