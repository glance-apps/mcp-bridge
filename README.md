# @glance-apps/mcp-bridge

stdio to Streamable HTTP bridge for the [dayGLANCE](https://glance-apps.com) MCP server. This README is the canonical setup guide for connecting AI clients to dayGLANCE; the site page explains what the capability is, this page covers how to install and configure it.

Claude Desktop and most editor integrations launch MCP servers over stdio. dayGLANCE serves MCP over local HTTP at `127.0.0.1:7893/mcp`. This bridge is the pipe between the two: stdio on one side, HTTP on the other. It is stateless and contains no tools, no business logic, and no data handling. Everything lives in dayGLANCE.

## Before any path: enable the server

In dayGLANCE, open **Settings**, then **Local Integrations**, and enable the **MCP server**. Reads, writes, and device calendar access are separate opt-ins on the same screen. Nothing below works until the server is enabled, and dayGLANCE must be running for any client to connect: on macOS the window can be closed because the app stays alive in the background, but a quit app means no listener.

## Pick your install path

| Path | Applies to |
|---|---|
| [Setup button](#setup-button-in-dayglance) | Direct-download dayGLANCE on macOS and Windows, with Claude Desktop |
| [`.mcpb` bundle](#mcpb-bundle) | Any dayGLANCE build, with Claude Desktop |
| [`npx` manual entry](#manual-entry-with-npx) | Anyone the other paths do not fit, and the only Claude Desktop path on Linux |
| [Claude Code](#claude-code-no-bridge-needed) | No bridge at all; direct HTTP |

### Setup button in dayGLANCE

Direct-download builds of dayGLANCE on macOS and Windows ship this bridge inside the app and offer a one-click **Set up Claude Desktop** button in Settings, then Local Integrations. It writes the Claude Desktop config entry pointing at the bundled bridge. No download, no Node install, nothing else to do; restart Claude Desktop and the dayGLANCE tools appear.

Mac App Store builds do not have this button (the sandbox does not permit writing another app's configuration), so MAS users take the `.mcpb` path below.

### `.mcpb` bundle

Download `dayglance-mcp-bridge.mcpb` from [Releases](https://github.com/glance-apps/mcp-bridge/releases) and drag it into Claude Desktop's Settings, Extensions page. Works with every dayGLANCE build on macOS and Windows.

The bundle is unsigned. `mcpb verify` reports "ERROR: Extension is not signed" because of an upstream bug in the mcpb CLI's signing (it corrupts the archive for strict zip readers, so signing is disabled until the fix ships). Claude Desktop installs unsigned bundles; some enterprise policies block them, in which case use the `npx` path below.

Token field: leave it empty for direct-download builds of dayGLANCE (see automatic discovery below). Mac App Store builds require it; see the MAS section.

### Manual entry with `npx`

For anyone the other two paths do not fit, and the only path on Linux. Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dayglance": {
      "command": "npx",
      "args": ["-y", "@glance-apps/mcp-bridge"]
    }
  }
}
```

Requires Node 20 or later on your PATH. Mac App Store installs of dayGLANCE additionally need the token, either as an argument (`"args": ["-y", "@glance-apps/mcp-bridge", "--token", "YOUR_TOKEN"]`) or via a `DAYGLANCE_MCP_TOKEN` environment variable in an `"env"` block.

### Claude Code (no bridge needed)

Claude Code speaks Streamable HTTP directly, so it connects straight to dayGLANCE:

```
claude mcp add --transport http dayglance http://127.0.0.1:7893/mcp --header "Authorization: Bearer YOUR_TOKEN"
```

Or as a static entry in `.mcp.json` (this is Claude Code's config, not `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "dayglance": {
      "type": "http",
      "url": "http://127.0.0.1:7893/mcp",
      "headers": { "Authorization": "Bearer YOUR_TOKEN" }
    }
  }
}
```

The token is shown in dayGLANCE Settings, then Local Integrations.

## How the bridge finds dayGLANCE

Configuration sources in priority order; later sources fill only what earlier ones left unset.

1. `--port` and `--token` arguments
2. `DAYGLANCE_MCP_TOKEN` and `DAYGLANCE_MCP_PORT` environment variables
3. The discovery file dayGLANCE's direct-download builds write when the MCP server is enabled:
   - Windows: `%APPDATA%\dayGLANCE\mcp.json`
   - Linux: `$XDG_CONFIG_HOME/dayglance/mcp.json`, falling back to `~/.config/dayglance/mcp.json`
   - macOS (direct download): `~/Library/Application Support/dayGLANCE/mcp.json`

Values that are unexpanded `${user_config.*}` templates are treated as unset. Claude Desktop passes the manifest's env templates through literally when the corresponding field is left blank, and a literal template must not shadow the discovery file.

### Mac App Store builds: the token is manual, on purpose

MAS builds write no discovery file, and the bridge never reads inside a macOS app sandbox container. On macOS 15 and later, that read would trigger a system consent prompt attributed to "node" that names neither Claude nor dayGLANCE, which is worse than asking you to paste a token once. So on MAS the token must be provided explicitly: copy it from dayGLANCE Settings, then Local Integrations, into the `.mcpb` extension's Token field or your config entry. Everything else works identically.

## Troubleshooting

Every bridge error names its likely cause; these are the failures that actually occur.

**dayGLANCE is not running.** The listener lives inside the app. Errors say dayGLANCE is "not running or the MCP server is not enabled". Launch dayGLANCE. On macOS, a closed window is fine (the app stays alive in the menu bar); a quit app is not.

**The MCP server is not enabled.** Same error as above with the app visibly running. Settings, then Local Integrations, enable the MCP server. It is off by default on every install.

**Wrong tier for the operation.** Reads work but writes return a `read_only_mode` error, or device calendar events are missing from schedules. Reads, writes, and device calendar access are three separate opt-ins in Local Integrations; enable the tier the operation needs.

**Port collision.** Another process holds 7893 and dayGLANCE settings show a port error, or the bridge reports the server unreachable while dayGLANCE is running. Change the port in Local Integrations. Direct-download builds propagate it through the discovery file automatically; `.mcpb` users update the extension's Port field, manual entries pass `--port`, and Claude Code entries update the URL.

**Stale token after rotation.** Errors say dayGLANCE "rejected the token", likely rotated. Direct-download builds rewrite the discovery file on rotation, so a bridge restart (restart Claude Desktop) picks up the new token. Anywhere the token was pasted manually (MAS Token field, `--token`, Claude Code header), re-copy it from Local Integrations.

**Wrong transport type in the client config.** Claude Desktop launches stdio commands; it cannot call an HTTP endpoint from its config file, so a Desktop entry must be a `command` (this bridge), never a URL. The reverse also fails: pointing Claude Code's HTTP transport at the bridge binary, or configuring the dayGLANCE endpoint as stdio. Desktop gets the bridge; Claude Code gets the HTTP endpoint directly.

**Both the `.mcpb` and the setup button registered at once.** Two dayglance servers appear, tools show up twice, and one of them may hold a stale config. Keep one: either uninstall the extension in Claude Desktop's Extensions page, or remove the `dayglance` entry the setup button wrote from `claude_desktop_config.json`.

**dayGLANCE is running but calls fail with `renderer_unavailable`.** The listener is up but the app's window process is not answering, typically right after a crash or during startup. Wait for the app to finish loading, or relaunch dayGLANCE. The error is deliberate: a dead renderer must never masquerade as an empty schedule.

## License

MIT
