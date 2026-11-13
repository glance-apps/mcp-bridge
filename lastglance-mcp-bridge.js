#!/usr/bin/env node
// The bridge with lastGLANCE's profile (src/apps.js): the `lastglance-mcp-bridge`
// bin, so `npx -p @glance-apps/mcp-bridge lastglance-mcp-bridge` needs no --app.
// An --app already given wins.
import process from 'node:process';

if (!process.argv.slice(2).some((a) => a === '--app' || a.startsWith('--app='))) process.argv.push('--app', 'lastglance');
await import('./bridge.js');
