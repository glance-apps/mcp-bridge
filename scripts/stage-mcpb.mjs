// Stage one app's .mcpb bundle directory: its manifest (mcpb/<app>.json) at
// the root, the bridge under server/. `npm run mcpb` stages and packs one
// bundle per app, each with its own name, so a user of one app installs an
// extension that names only that app. The manifest's version is synchronized
// from package.json so a bundle can never drift from the npm release it wraps.
//
// Usage: node scripts/stage-mcpb.mjs <app>   (dayglance when omitted)
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.argv[2] ?? 'dayglance';
const source = join(root, 'mcpb', `${app}.json`);
if (!existsSync(source)) {
  console.error(`no manifest for ${app} at ${source}`);
  process.exit(2);
}
const out = join(root, 'dist-mcpb', app);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'server'), { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const manifest = JSON.parse(readFileSync(source, 'utf-8'));
manifest.version = pkg.version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

cpSync(join(root, 'bridge.js'), join(out, 'server', 'bridge.js'));
cpSync(join(root, 'src'), join(out, 'server', 'src'), { recursive: true });
cpSync(join(root, 'LICENSE'), join(out, 'LICENSE'));

console.log(`staged ${out} at version ${manifest.version}`);
