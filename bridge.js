#!/usr/bin/env node
// dayGLANCE MCP bridge: stdio on one side, Streamable HTTP on the other.
// Stateless, no business logic, no tool definitions. It is a pipe. Every
// tool, resource, and permission decision lives in dayGLANCE's own MCP
// listener (spec §3.2); this process exists only because Claude Desktop
// spawns stdio servers and cannot speak to a local HTTP endpoint.
//
// Wire shape: each newline-delimited JSON-RPC message from stdin becomes one
// POST to http://127.0.0.1:<port>/mcp with the bearer token. JSON responses
// and SSE-framed responses both stream back to stdout as newline-delimited
// messages. Failures are answered as JSON-RPC errors whose messages name the
// LIKELY CAUSE (dayGLANCE not running, MCP off, token rotated), never a bare
// connection error.
//
// Runs on Node 20+ (built-in fetch) and equally under ELECTRON_RUN_AS_NODE=1,
// which is how the copy bundled inside dayGLANCE's direct-download builds is
// spawned. Dependency-free by design.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import process from 'node:process';
import { resolveConfig } from './src/config.js';
import { missingTokenMessage, unreachableMessage, unauthorizedMessage, unexpectedStatusMessage } from './src/errors.js';

const config = resolveConfig({
  argv: process.argv.slice(2),
  env: process.env,
  platform: process.platform,
  home: homedir(),
  readFile: (p) => readFileSync(p, 'utf-8'),
});

if (config.discoveryError) {
  console.error(`[dayglance-mcp-bridge] discovery file problem at ${config.discoveryError.path}: ${config.discoveryError.message}`);
}
if (!config.token) {
  console.error(`[dayglance-mcp-bridge] ${missingTokenMessage(process.platform)}`);
  process.exit(1);
}
console.error(`[dayglance-mcp-bridge] port ${config.port} (${config.sources.port ?? 'default'}), token from ${config.sources.token}`);

const ENDPOINT = `http://127.0.0.1:${config.port}/mcp`;
// Sent on requests after initialize negotiates it, per the Streamable HTTP
// transport rules. The server side enforces sanity; we just echo faithfully.
let protocolVersion = null;

const writeLine = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const jsonRpcError = (id, message) => writeLine({ jsonrpc: '2.0', id, error: { code: -32000, message } });

/** Emit every JSON-RPC message in an SSE body to stdout. */
function pumpSse(text) {
  for (const chunk of text.split('\n\n')) {
    const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    if (!data) continue;
    try {
      relayResponse(JSON.parse(data));
    } catch {
      console.error(`[dayglance-mcp-bridge] unparseable SSE data from listener: ${data.slice(0, 120)}`);
    }
  }
}

function relayResponse(msg) {
  // Capture the negotiated protocol version from the initialize result so
  // subsequent requests carry the MCP-Protocol-Version header.
  if (msg?.result?.protocolVersion) protocolVersion = msg.result.protocolVersion;
  writeLine(msg);
}

async function forward(msg) {
  const hasId = msg.id !== undefined;
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: `Bearer ${config.token}`,
        ...(protocolVersion ? { 'mcp-protocol-version': protocolVersion } : {}),
      },
      body: JSON.stringify(msg),
    });
  } catch (err) {
    const message = unreachableMessage(config.port);
    console.error(`[dayglance-mcp-bridge] ${message} (${err?.cause?.code ?? err?.message ?? err})`);
    if (hasId) jsonRpcError(msg.id, message);
    return;
  }

  if (res.status === 401 || res.status === 403) {
    const message = unauthorizedMessage();
    console.error(`[dayglance-mcp-bridge] ${message}`);
    if (hasId) jsonRpcError(msg.id, message);
    return;
  }
  if (res.status === 202 || res.status === 204) {
    await res.arrayBuffer().catch(() => {});
    return; // accepted notification, nothing to relay
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const message = unexpectedStatusMessage(res.status);
    console.error(`[dayglance-mcp-bridge] ${message} ${body.slice(0, 200)}`);
    if (hasId) jsonRpcError(msg.id, message);
    return;
  }

  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (!text.trim()) return;
  if (contentType.includes('text/event-stream')) {
    pumpSse(text);
  } else {
    try {
      relayResponse(JSON.parse(text));
    } catch {
      console.error(`[dayglance-mcp-bridge] unparseable response from listener: ${text.slice(0, 120)}`);
      if (hasId) jsonRpcError(msg.id, unexpectedStatusMessage(res.status));
    }
  }
}

// In-flight forwards, so an EOF on stdin drains pending responses instead of
// killing them mid-request (a client that closes stdin still deserves the
// answers to everything it already sent).
const inFlight = new Set();
function track(promise) {
  inFlight.add(promise);
  promise.finally(() => inFlight.delete(promise));
}

let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.error(`[dayglance-mcp-bridge] skipping unparseable stdin line: ${line.slice(0, 120)}`);
      continue;
    }
    // Concurrent per message: each response carries its request id, and
    // serializing would stall every tool call behind the slowest one.
    track(forward(msg));
  }
});
process.stdin.on('end', async () => {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
  process.exit(0);
});
