// User-facing failure copy, pure. Every message names the LIKELY CAUSE first,
// because the raw symptom misleads: "connection refused" reads as a bridge
// bug when the actual situation is that the app is not running or its MCP
// server is switched off. Every message names the app the bridge was started
// for (src/apps.js; dayGLANCE's wording is unchanged from before profiles).
// No em dashes anywhere in these strings.
import { APPS } from './apps.js';

/** No token from args, env, or discovery. Where to get one, per platform. */
export function missingTokenMessage(platform, app = APPS.dayglance) {
  const where = `In ${app.name}, open ${app.settings}, ${app.enable}, and copy the token.`;
  if (platform === 'darwin') {
    return (
      'No MCP token is configured. ' + where + ' ' +
      `If you installed ${app.name} from the Mac App Store, the token must be provided manually: ` +
      `paste it into this extension's Token setting in Claude Desktop, or pass --token, or set ${app.envPrefix}_TOKEN. ` +
      'Direct-download builds write a discovery file automatically once the MCP server is enabled.'
    );
  }
  return (
    'No MCP token is configured. ' + where + ' ' +
    `${app.name} then writes a discovery file this bridge finds automatically. ` +
    `You can also pass --token or set ${app.envPrefix}_TOKEN.`
  );
}

/** The listener did not answer at all: not running, or MCP switched off. */
export function unreachableMessage(port, app = APPS.dayglance) {
  return (
    `Could not reach ${app.name} on 127.0.0.1:${port}. ` +
    `The likely cause: ${app.name} is not running, or its MCP server is not enabled. ` +
    `Start ${app.name}, open ${app.settings}, and ${app.enable}. ` +
    'If you set a custom port there, pass the same port to this bridge.'
  );
}

/** The listener answered 401/403: the token is wrong or was rotated. */
export function unauthorizedMessage(app = APPS.dayglance) {
  return (
    `${app.name} rejected the token. The likely cause: the token was rotated in Settings, ` +
    `or the configured token has a typo. Copy the current token from ${app.name} ${app.settings}, ` +
    'and update this bridge\'s configuration.'
  );
}

/** Unexpected HTTP status from the listener. */
export function unexpectedStatusMessage(status, app = APPS.dayglance) {
  return `${app.name} answered with unexpected HTTP status ${status}. Check that port and token point at ${app.name}'s MCP server and not another local service.`;
}

/** An --app this bridge does not know. */
export function unknownAppMessage(id) {
  return `Unknown --app ${JSON.stringify(String(id))}. This bridge connects to: ${Object.keys(APPS).join(', ')}.`;
}
