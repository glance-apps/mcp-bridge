// Configuration resolution, pure. Priority order (spec §3.4):
//   1. --port / --token command line arguments
//   2. DAYGLANCE_MCP_TOKEN and DAYGLANCE_MCP_PORT environment variables
//   3. the discovery file dayGLANCE writes (direct-download builds only)
// Sources may mix: a token from the environment combines with a port from
// discovery. The discovery reader is injected so this stays pure.
import { discoveryPaths, isContainerPath, DEFAULT_PORT } from './paths.js';

/** Parse --port/--token in both "--port 7893" and "--port=7893" forms. */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    for (const key of ['port', 'token']) {
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
 * Resolve {port, token, sources} from args, env, and discovery.
 * `readFile` is fs.readFileSync-shaped, injected for testability; `paths`
 * overrides the candidate list so tests can prove the container guard holds
 * even against a list that wrongly includes a container path. Discovery
 * candidates under a macOS app container are NEVER read; see src/paths.js.
 */
export function resolveConfig({ argv, env, platform, home, readFile, paths }) {
  const args = parseArgs(argv);
  for (const key of ['port', 'token']) {
    if (isUnexpandedTemplate(args[key])) delete args[key];
  }
  const envPort = isUnexpandedTemplate(env.DAYGLANCE_MCP_PORT) ? undefined : env.DAYGLANCE_MCP_PORT;
  const envToken = isUnexpandedTemplate(env.DAYGLANCE_MCP_TOKEN) ? undefined : env.DAYGLANCE_MCP_TOKEN;
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
    for (const candidate of paths ?? discoveryPaths(platform, env, home)) {
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

  return { port: port ?? DEFAULT_PORT, token, sources, discoveryError };
}
