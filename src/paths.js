// Discovery-file locations, pure. Mirrors dayGLANCE's spec §3.4 (revision 6):
// the app writes {port, token} to a platform-appropriate mcp.json; the bridge
// reads it when no explicit configuration is given.
//
// THE MAS RULE, two layers deep (spec Phase 0.5, docs/mcp-phase0.5-findings.md
// in the dayGLANCE repo): reading into another app's macOS sandbox container
// triggers a TCC consent prompt attributed to "node", naming neither Claude
// nor dayGLANCE, which a careful user correctly denies. So:
//   1. The darwin candidate list contains ONLY the direct-download path.
//      There is no container path here to read.
//   2. isContainerPath() guards every candidate anyway, so a future edit
//      cannot reintroduce the read by adding a path under ~/Library/Containers.
import { join } from 'node:path';
import { APPS } from './apps.js';

/**
 * Candidate discovery-file paths for a platform, in read order, for one app's
 * profile (src/apps.js; dayGLANCE's by default). The file is mcp.json in the
 * app's own data folder. MAS builds write no discovery file at all, so there
 * is no container path in this list by design, not by omission.
 */
export function discoveryPaths(platform, env, home, app = APPS.dayglance) {
  switch (platform) {
    case 'win32':
      return env.APPDATA ? [join(env.APPDATA, app.dirs.win32, 'mcp.json')] : [];
    case 'darwin':
      return [join(home, 'Library', 'Application Support', app.dirs.darwin, 'mcp.json')];
    case 'linux': {
      const base = env.XDG_CONFIG_HOME || join(home, '.config');
      return [join(base, app.dirs.linux, 'mcp.json')];
    }
    default:
      return [];
  }
}

/**
 * True when a path resolves inside a macOS app sandbox container
 * (~/Library/Containers/...). The bridge refuses to read discovery
 * candidates for which this holds: that read is what fires the misattributed
 * TCC prompt. Purely shape-based, which is sufficient because sandbox
 * containers live under exactly this prefix.
 */
export function isContainerPath(path, home) {
  const containerRoot = join(home, 'Library', 'Containers') + '/';
  return path.startsWith(containerRoot);
}

/** dayGLANCE's default port (spec §3.4), kept for callers from before app profiles; each profile has its own. */
export const DEFAULT_PORT = APPS.dayglance.defaultPort;
