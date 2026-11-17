#!/usr/bin/env node
// The bridge with thingGLANCE's profile (src/apps.js): the `thingglance-mcp-bridge`
// bin, so `npx -p @glance-apps/mcp-bridge thingglance-mcp-bridge` needs no --app.
// An --app already given wins.
import process from 'node:process';

if (!process.argv.slice(2).some((a) => a === '--app' || a.startsWith('--app='))) process.argv.push('--app', 'thingglance');
await import('./bridge.js');
