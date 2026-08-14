import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { parseArgs, resolveConfig } from '../src/config.js';
import { discoveryPaths, isContainerPath, DEFAULT_PORT } from '../src/paths.js';
import { missingTokenMessage, unreachableMessage, unauthorizedMessage } from '../src/errors.js';

// Configuration priority (spec §3.4): args, then env, then discovery. The
// MAS rule is structural: no container path in the darwin candidate list,
// and isContainerPath refuses one even if a future edit added it.

const HOME = '/Users/casey';
const noFile = () => { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; };
const base = { argv: [], env: {}, platform: 'darwin', home: HOME, readFile: noFile };

test('parseArgs handles both --key value and --key=value forms', () => {
  assert.deepEqual(parseArgs(['--port', '7900', '--token=abc']), { port: '7900', token: 'abc' });
  assert.deepEqual(parseArgs(['--token', 'abc', '--port=7900']), { port: '7900', token: 'abc' });
  assert.deepEqual(parseArgs([]), {});
});

test('args outrank env outrank discovery', () => {
  const discovery = JSON.stringify({ port: 7999, token: 'from-discovery' });
  const r = resolveConfig({
    ...base,
    argv: ['--port', '7901', '--token', 'from-args'],
    env: { DAYGLANCE_MCP_TOKEN: 'from-env', DAYGLANCE_MCP_PORT: '7902' },
    readFile: () => discovery,
  });
  assert.equal(r.port, 7901);
  assert.equal(r.token, 'from-args');
  assert.deepEqual(r.sources, { port: 'args', token: 'args' });

  const envOnly = resolveConfig({ ...base, env: { DAYGLANCE_MCP_TOKEN: 'from-env', DAYGLANCE_MCP_PORT: '7902' }, readFile: () => discovery });
  assert.equal(envOnly.port, 7902);
  assert.equal(envOnly.token, 'from-env');

  const discoveryOnly = resolveConfig({ ...base, readFile: () => discovery });
  assert.equal(discoveryOnly.port, 7999);
  assert.equal(discoveryOnly.token, 'from-discovery');
  assert.deepEqual(discoveryOnly.sources, { port: 'discovery', token: 'discovery' });
});

test('sources may mix: env token with discovery port', () => {
  const r = resolveConfig({
    ...base,
    env: { DAYGLANCE_MCP_TOKEN: 'from-env' },
    readFile: () => JSON.stringify({ port: 7999, token: 'ignored' }),
  });
  assert.equal(r.token, 'from-env');
  assert.equal(r.port, 7999);
});

test('nothing configured: default port, null token', () => {
  const r = resolveConfig(base);
  assert.equal(r.port, DEFAULT_PORT);
  assert.equal(r.token, null);
});

test('the default port is 7893, the literal from spec §3.4 (adjacent to Stream Deck on 7892)', () => {
  assert.equal(DEFAULT_PORT, 7893);
  assert.equal(resolveConfig(base).port, 7893);
});

test('discovery is not consulted at all when args supply both values', () => {
  let reads = 0;
  const r = resolveConfig({
    ...base,
    argv: ['--port', '7901', '--token', 'from-args'],
    readFile: () => { reads += 1; return '{}'; },
  });
  assert.equal(reads, 0);
  assert.equal(r.port, 7901);
});

test('invalid ports are ignored, not passed through', () => {
  for (const bad of ['0', '-1', '65536', 'abc', '70.5']) {
    const r = resolveConfig({ ...base, argv: ['--port', bad] });
    assert.equal(r.port, DEFAULT_PORT, bad);
  }
});

test('a corrupt discovery file is reported, never fatal', () => {
  const r = resolveConfig({ ...base, readFile: () => 'not json' });
  assert.equal(r.token, null);
  assert.equal(r.port, DEFAULT_PORT);
  assert.ok(r.discoveryError);
  assert.ok(r.discoveryError.path.includes('mcp.json'));
});

test('discovery paths per platform match spec §3.4', () => {
  assert.deepEqual(
    discoveryPaths('darwin', {}, HOME),
    ['/Users/casey/Library/Application Support/dayGLANCE/mcp.json'],
  );
  assert.deepEqual(
    discoveryPaths('win32', { APPDATA: 'C:\\Users\\casey\\AppData\\Roaming' }, 'C:\\Users\\casey'),
    [join('C:\\Users\\casey\\AppData\\Roaming', 'dayGLANCE', 'mcp.json')],
  );
  assert.deepEqual(
    discoveryPaths('linux', { XDG_CONFIG_HOME: '/home/casey/.cfg' }, '/home/casey'),
    ['/home/casey/.cfg/dayglance/mcp.json'],
  );
  assert.deepEqual(
    discoveryPaths('linux', {}, '/home/casey'),
    ['/home/casey/.config/dayglance/mcp.json'],
  );
  assert.deepEqual(discoveryPaths('win32', {}, 'C:\\Users\\casey'), []);
});

test('THE MAS RULE part 1: no darwin candidate is a container path', () => {
  for (const p of discoveryPaths('darwin', {}, HOME)) {
    assert.equal(isContainerPath(p, HOME), false, p);
    assert.ok(!p.includes('/Library/Containers/'), p);
  }
});

test('THE MAS RULE part 2: isContainerPath flags the container shape exactly', () => {
  assert.equal(isContainerPath(`${HOME}/Library/Containers/com.dayglance/Data/Library/Application Support/dayGLANCE/mcp.json`, HOME), true);
  assert.equal(isContainerPath(`${HOME}/Library/Containers/anything/file.json`, HOME), true);
  assert.equal(isContainerPath(`${HOME}/Library/Application Support/dayGLANCE/mcp.json`, HOME), false);
  // Prefix must be exact: a sibling directory that merely starts with the
  // word Containers is not a container.
  assert.equal(isContainerPath(`${HOME}/Library/ContainersBackup/file.json`, HOME), false);
});

test('THE MAS RULE part 3: a container candidate is never read, even if a future edit adds one', () => {
  const reads = [];
  const containerPath = `${HOME}/Library/Containers/com.dayglance/Data/mcp.json`;
  // Simulate the future mistake directly: a candidate list that wrongly
  // includes a container path. The guard inside the loop must skip it, so
  // the token it would have provided is never seen.
  const r = resolveConfig({
    ...base,
    platform: 'darwin',
    paths: [containerPath],
    readFile: (p) => { reads.push(p); return JSON.stringify({ port: 7999, token: 'leaked-from-container' }); },
  });
  assert.deepEqual(reads, []);
  assert.equal(r.token, null);
  assert.equal(r.port, DEFAULT_PORT);

  // And the real darwin walk touches no container path either.
  const realReads = [];
  resolveConfig({ ...base, platform: 'darwin', readFile: (p) => { realReads.push(p); noFile(); } });
  assert.ok(realReads.length > 0);
  assert.ok(realReads.every((p) => !isContainerPath(p, HOME)));
});

test('error copy names the likely cause and contains no em dashes', () => {
  const messages = [
    missingTokenMessage('darwin'), missingTokenMessage('win32'),
    unreachableMessage(7893), unauthorizedMessage(),
  ];
  assert.ok(missingTokenMessage('darwin').includes('Mac App Store'));
  assert.ok(missingTokenMessage('darwin').includes('Local Integrations'));
  assert.ok(unreachableMessage(7893).includes('not running'));
  assert.ok(unreachableMessage(7893).includes('not enabled'));
  assert.ok(unauthorizedMessage().includes('rotated'));
  for (const m of messages) {
    assert.ok(!m.includes('\u2014'), `em dash in: ${m}`);
    assert.ok(!m.includes('\u2013'), `en dash in: ${m}`);
  }
});

test('unexpanded Claude Desktop templates behave as unset, never as values', () => {
  const discovery = JSON.stringify({ port: 7999, token: 'from-discovery' });
  const viaEnv = resolveConfig({
    ...base,
    env: { DAYGLANCE_MCP_TOKEN: '${user_config.token}', DAYGLANCE_MCP_PORT: '${user_config.port}' },
    readFile: () => discovery,
  });
  assert.equal(viaEnv.token, 'from-discovery');
  assert.equal(viaEnv.port, 7999);
  assert.deepEqual(viaEnv.sources, { port: 'discovery', token: 'discovery' });

  const viaArgs = resolveConfig({
    ...base,
    argv: ['--token', '${user_config.token}', '--port=${user_config.port}'],
    readFile: () => discovery,
  });
  assert.equal(viaArgs.token, 'from-discovery');
  assert.equal(viaArgs.port, 7999);

  // A template alongside a real env value: only the template is discarded.
  const mixed = resolveConfig({
    ...base,
    env: { DAYGLANCE_MCP_TOKEN: 'real-token', DAYGLANCE_MCP_PORT: '${user_config.port}' },
    readFile: () => discovery,
  });
  assert.equal(mixed.token, 'real-token');
  assert.equal(mixed.port, 7999);
});
