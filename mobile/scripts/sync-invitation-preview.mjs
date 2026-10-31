import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(new URL('../../invitation-renderer.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../v2.css', import.meta.url), 'utf8');
const target = new URL('../src/invitationSource.ts', import.meta.url);
const generated = `// Generated from the shared web invitation renderer. Run npm run sync:preview.\nexport const invitationRenderer = ${JSON.stringify(source)};\nexport const invitationCss = ${JSON.stringify(css)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== generated) throw new Error('Mobile preview source is stale. Run npm run sync:preview from mobile/.');
} else {
  writeFileSync(target, generated);
  process.stdout.write(`Updated ${fileURLToPath(target)}\n`);
}
