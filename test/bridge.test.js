import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The real bridge process, end to end: JSON-RPC lines on stdin, a local HTTP
// server standing in for the app, answers on stdout. Proves the profile reaches
// the wire (the lastglance bin finds lastGLANCE's discovery file and sends its
// token) and that a failure names the right app.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function listen(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler);
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/** Run a bridge bin with one request on stdin; resolve with its stdout lines and stderr. */
function run(bin, args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, bin), ...args], { env: { PATH: process.env.PATH, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, lines: out.split('\n').filter(Boolean).map((l) => JSON.parse(l)), err }));
    child.stdin.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
  });
}

test('the lastglance bin finds lastGLANCE through its discovery file and relays the answer', async () => {
  const seen = [];
  const srv = await listen((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      seen.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'lastglance_get_overview' }] } }));
    });
  });
  const config = mkdtempSync(join(tmpdir(), 'bridge-test-'));
  try {
    mkdirSync(join(config, 'lastGLANCE'));
    writeFileSync(join(config, 'lastGLANCE', 'mcp.json'), JSON.stringify({ port: srv.address().port, token: 'lg-token' }));
    const r = await run('lastglance-mcp-bridge.js', [], { HOME: config, XDG_CONFIG_HOME: config, APPDATA: config });
    if (process.platform === 'darwin') return; // discovery is under ~/Library there; the paths test covers it
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(r.lines, [{ jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'lastglance_get_overview' }] } }]);
    assert.deepEqual(seen.map((s) => [s.url, s.auth, s.body.method]), [['/mcp', 'Bearer lg-token', 'tools/list']]);
    assert.match(r.err, /^\[lastglance-mcp-bridge\] lastGLANCE, port \d+ \(discovery\), token from discovery/m);
  } finally {
    rmSync(config, { recursive: true, force: true });
    srv.close();
  }
});

test('an unreachable app is a JSON-RPC error naming that app', async () => {
  const srv = await listen(() => {});
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));   // a port nothing listens on now
  const r = await run('bridge.js', ['--app', 'lastglance', '--token', 't', '--port', String(port)], {});
  assert.equal(r.lines[0].id, 1);
  assert.match(r.lines[0].error.message, /^Could not reach lastGLANCE on 127\.0\.0\.1:/);
  assert.doesNotMatch(r.lines[0].error.message, /dayGLANCE/);
});

test('an unknown --app exits before reaching anything', async () => {
  const r = await run('bridge.js', ['--app', 'nextglance', '--token', 't'], {});
  assert.equal(r.code, 1);
  assert.deepEqual(r.lines, []);
  assert.match(r.err, /Unknown --app "nextglance"/);
});
