import { cp, lstat, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const publicFiles = [
  'index.html', 'admin.html', 'customer.html', 'dashboard.html', 'guest.html', 'partner.html', 'supervisor.html',
  'account.js', 'admin.js', 'app.js', 'customer.js', 'dashboard.js', 'guest.js',
  'invitation-renderer.js', 'invitation-schemas.js', 'partner.js', 'supervisor.js',
  'styles.css', 'v2.css',
];

async function assertRegularTree(path) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) throw new Error('Public assets must not contain symbolic links.');
  if (stat.isDirectory()) {
    for (const entry of await readdir(path)) await assertRegularTree(join(path, entry));
  } else if (!stat.isFile()) {
    throw new Error('Public assets must contain regular files only.');
  }
}

export async function buildStatic(sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const destination = join(sourceRoot, 'dist');
  // A fixed output path prevents a caller from deleting arbitrary directories.
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  for (const name of [...publicFiles, 'assets']) {
    const source = join(sourceRoot, name);
    await assertRegularTree(source);
    await cp(source, join(destination, name), { recursive: true, dereference: false });
  }
  return destination;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Static website built: ${await buildStatic()}`);
}
