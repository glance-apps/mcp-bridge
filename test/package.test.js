import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPS } from '../src/apps.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));

test('npx @glance-apps/mcp-bridge still runs: one bin is named after the package', () => {
  // With more than one bin, npx runs the one named after the package and
  // fails ("could not determine executable to run") when there is none: every
  // `npx -y @glance-apps/mcp-bridge` setup written for 0.1.x depends on this.
  const unscoped = pkg.name.split('/').pop();
  assert.equal(pkg.bin[unscoped], 'bridge.js');
  assert.equal(pkg.bin['dayglance-mcp-bridge'], 'bridge.js');
});

test('every app has its bin, its .mcpb manifest, and the files they need are published', () => {
  for (const id of Object.keys(APPS)) {
    assert.ok(pkg.bin[`${id}-mcp-bridge`], `bin for ${id}`);
    assert.ok(existsSync(join(root, pkg.bin[`${id}-mcp-bridge`])), `bin file for ${id}`);
    assert.ok(pkg.files.includes(pkg.bin[`${id}-mcp-bridge`]), `${id}'s bin is published`);
    const manifest = JSON.parse(readFileSync(join(root, 'mcpb', `${id}.json`), 'utf-8'));
    assert.equal(manifest.name, id);
    assert.equal(manifest.user_config.port.default, APPS[id].defaultPort);
    const env = Object.keys(manifest.server.mcp_config.env);
    assert.deepEqual(env.sort(), [`${APPS[id].envPrefix}_PORT`, `${APPS[id].envPrefix}_TOKEN`]);
    if (id !== 'dayglance') assert.deepEqual(manifest.server.mcp_config.args.slice(-2), ['--app', id]);
    assert.ok(!JSON.stringify(manifest).includes('—'), `em dash in ${id}'s manifest`);
  }
});
