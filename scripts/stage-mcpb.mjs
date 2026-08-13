// Stage the .mcpb bundle directory: manifest at the root, the bridge under
// server/. Run through `npm run mcpb` which packs and self-signs the result.
// The manifest's version is synchronized from package.json so the bundle can
// never drift from the npm release it wraps.
import { mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-mcpb', 'bundle');

rmSync(join(root, 'dist-mcpb'), { recursive: true, force: true });
mkdirSync(join(out, 'server'), { recursive: true });

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const manifest = JSON.parse(readFileSync(join(root, 'mcpb', 'manifest.json'), 'utf-8'));
manifest.version = pkg.version;
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

cpSync(join(root, 'bridge.js'), join(out, 'server', 'bridge.js'));
cpSync(join(root, 'src'), join(out, 'server', 'src'), { recursive: true });
cpSync(join(root, 'LICENSE'), join(out, 'LICENSE'));

console.log(`staged ${out} at version ${manifest.version}`);
