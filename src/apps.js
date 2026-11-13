// The GLANCE apps this bridge connects to, one profile each. Everything that
// names an app lives here: its display name, the port it listens on by
// default, the folders its discovery file is written to, its environment
// variables, and where in its Settings the MCP server is turned on. The pipe
// itself (bridge.js) is the same for every app.
//
// A user of one app sees only that app: each app's own setup writes only its
// own entry and passes its own --app, each app has its own .mcpb, and every
// message the bridge prints names the app it was started for.
//
// With no --app, the profile is dayGLANCE's, so every setup written before
// profiles existed keeps working unchanged.

export const APPS = Object.freeze({
  dayglance: Object.freeze({
    id: 'dayglance',
    name: 'dayGLANCE',
    defaultPort: 7893,
    envPrefix: 'DAYGLANCE_MCP',
    // The folder the app's userData lives in, per platform.
    dirs: Object.freeze({ win32: 'dayGLANCE', darwin: 'dayGLANCE', linux: 'dayglance' }),
    settings: 'Settings, then Local Integrations',
    enable: 'enable the MCP server',
  }),
  lastglance: Object.freeze({
    id: 'lastglance',
    name: 'lastGLANCE',
    defaultPort: 7900,
    envPrefix: 'LASTGLANCE_MCP',
    dirs: Object.freeze({ win32: 'lastGLANCE', darwin: 'lastGLANCE', linux: 'lastGLANCE' }),
    settings: 'Settings, then Integrations',
    enable: 'turn on AI assistants (MCP)',
  }),
});

export const DEFAULT_APP_ID = 'dayglance';

/** The profile for an --app value, or null for one this bridge does not know. Case does not matter. */
export function appProfile(id) {
  if (id === undefined || id === null || id === '') return APPS[DEFAULT_APP_ID];
  const key = String(id).toLowerCase();
  return Object.prototype.hasOwnProperty.call(APPS, key) ? APPS[key] : null;
}
