// User-facing failure copy, pure. Every message names the LIKELY CAUSE first,
// because the raw symptom misleads: "connection refused" reads as a bridge
// bug when the actual situation is that dayGLANCE is not running or its MCP
// server is switched off. No em dashes anywhere in these strings.

/** No token from args, env, or discovery. Where to get one, per platform. */
export function missingTokenMessage(platform) {
  const where = 'In dayGLANCE, open Settings, then Local Integrations, enable the MCP server, and copy the token.';
  if (platform === 'darwin') {
    return (
      'No MCP token is configured. ' + where + ' ' +
      'If you installed dayGLANCE from the Mac App Store, the token must be provided manually: ' +
      'paste it into this extension\'s Token setting in Claude Desktop, or pass --token, or set DAYGLANCE_MCP_TOKEN. ' +
      'Direct-download builds write a discovery file automatically once the MCP server is enabled.'
    );
  }
  return (
    'No MCP token is configured. ' + where + ' ' +
    'dayGLANCE then writes a discovery file this bridge finds automatically. ' +
    'You can also pass --token or set DAYGLANCE_MCP_TOKEN.'
  );
}

/** The listener did not answer at all: not running, or MCP switched off. */
export function unreachableMessage(port) {
  return (
    `Could not reach dayGLANCE on 127.0.0.1:${port}. ` +
    'The likely cause: dayGLANCE is not running, or its MCP server is not enabled. ' +
    'Start dayGLANCE, open Settings, then Local Integrations, and enable the MCP server. ' +
    'If you set a custom port there, pass the same port to this bridge.'
  );
}

/** The listener answered 401/403: the token is wrong or was rotated. */
export function unauthorizedMessage() {
  return (
    'dayGLANCE rejected the token. The likely cause: the token was rotated in Settings, ' +
    'or the configured token has a typo. Copy the current token from dayGLANCE Settings, ' +
    'then Local Integrations, and update this bridge\'s configuration.'
  );
}

/** Unexpected HTTP status from the listener. */
export function unexpectedStatusMessage(status) {
  return `dayGLANCE answered with unexpected HTTP status ${status}. Check that port and token point at dayGLANCE's MCP server and not another local service.`;
}
