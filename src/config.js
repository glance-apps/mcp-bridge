// Configuration resolution, pure. Which app is chosen first (--app; dayGLANCE
// when absent), then, for that app (src/apps.js), in priority order (spec §3.4):
//   1. --port / --token command line arguments
//   2. the app's environment variables (DAYGLANCE_MCP_TOKEN and
//      DAYGLANCE_MCP_PORT; LASTGLANCE_MCP_* for lastGLANCE)
//   3. the discovery file the app writes (direct-download builds only)
//   4. the app's default port
// Sources may mix: a token from the environment combines with a port from
// discovery. The discovery reader is injected so this stays pure.
import { discoveryPaths, isContainerPath } from './paths.js';
import { appProfile } from './apps.js';

/** Parse --app/--port/--token in both "--port 7893" and "--port=7893" forms. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    for (const key of ['app', 'port', 'token']) {
      const flag = `--${key}`;
      if (arg === flag) out[key] = argv[++i];
      else if (arg.startsWith(flag + '=')) out[key] = arg.slice(flag.length + 1);
    }
  }
  return out;
}

/**
 * Claude Desktop passes manifest env templates through unexpanded when the
 * corresponding user_config field is left blank: the bridge then sees the
 * literal string "${user_config.token}". Such values must behave exactly
 * like unset values — a literal template sent as a Bearer token gets a 401
 * that reads like a rotated token. Ports only escape by accident (the
 * literal fails integer validation), so both fields are guarded uniformly.
 */
const isUnexpandedTemplate = (value) => typeof value === 'string' && value.startsWith('${');

/** A syntactically usable port, or null. */
function asPort(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : null;
}

/**
 * Resolve {app, port, token, sources} from args, env, and discovery. `app` is
 * null for an --app this bridge does not know (with `unknownApp` naming it),
 * and nothing else is resolved then: guessing another app's port would be worse.
 * `readFile` is fs.readFileSync-shaped, injected for testability; `paths`
 * overrides the candidate list so tests can prove the container guard holds
 * even against a list that wrongly includes a container path. Discovery
 * candidates under a macOS app container are NEVER read; see src/paths.js.
 */
export function resolveConfig({ argv, env, platform, home, readFile, paths }) {
  const args = parseArgs(argv);
  for (const key of ['app', 'port', 'token']) {
    if (isUnexpandedTemplate(args[key])) delete args[key];
  }
  const app = appProfile(args.app);
  if (!app) return { app: null, unknownApp: args.app, port: null, token: null, sources: { port: null, token: null }, discoveryError: null };
  const rawPort = env[`${app.envPrefix}_PORT`];
  const rawToken = env[`${app.envPrefix}_TOKEN`];
  const envPort = isUnexpandedTemplate(rawPort) ? undefined : rawPort;
  const envToken = isUnexpandedTemplate(rawToken) ? undefined : rawToken;
  let port = asPort(args.port);
  let token = args.token || null;
  const sources = { port: port !== null ? 'args' : null, token: token ? 'args' : null };

  if (port === null && asPort(envPort) !== null) {
    port = asPort(envPort);
    sources.port = 'env';
  }
  if (!token && envToken) {
    token = envToken;
    sources.token = 'env';
  }

  let discoveryError = null;
  if (port === null || !token) {
    for (const candidate of paths ?? discoveryPaths(platform, env, home, app)) {
      if (isContainerPath(candidate, home)) continue; // never read into a sandbox container
      try {
        const parsed = JSON.parse(readFile(candidate));
        if (port === null && asPort(parsed.port) !== null) {
          port = asPort(parsed.port);
          sources.port = 'discovery';
        }
        if (!token && typeof parsed.token === 'string' && parsed.token) {
          token = parsed.token;
          sources.token = 'discovery';
        }
        break;
      } catch (err) {
        if (err?.code !== 'ENOENT') discoveryError = { path: candidate, code: err?.code ?? 'parse', message: String(err?.message ?? err) };
      }
    }
  }

  return { app, port: port ?? app.defaultPort, token, sources, discoveryError };
}
