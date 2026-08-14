# @glance-apps/mcp-bridge

stdio to Streamable HTTP bridge for the [dayGLANCE](https://glance-apps.com) MCP server.

Claude Desktop and most editor integrations spawn MCP servers over stdio. dayGLANCE serves MCP over local HTTP at `127.0.0.1:7893/mcp`. This bridge is the pipe between the two: stdio on one side, HTTP on the other. It is stateless and contains no tools, no business logic, and no data handling. Everything lives in dayGLANCE.

## Setup

First, in dayGLANCE: open **Settings**, then **Local Integrations**, and enable the **MCP server**.

### Claude Desktop, one click

Install the `dayglance-mcp-bridge.mcpb` bundle from [Releases](https://github.com/glance-apps/mcp-bridge/releases): drag it into Claude Desktop's Settings, Extensions page. Direct-download builds of dayGLANCE are discovered automatically. If you installed dayGLANCE from the Mac App Store, copy the token from dayGLANCE's settings into the extension's **Token** field.

The bundle is self-signed. `mcpb verify` reports "ERROR: Extension is not signed" for it: the CLI validates the certificate against the OS trust store and does not distinguish an untrusted self-signed certificate from no signature at all. That output is expected; the install test that matters is dragging the bundle into Claude Desktop. Some enterprise policies block unsigned or self-signed extensions; in managed environments, use the npx path below instead.

### Claude Desktop, manual entry

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

Requires Node 20 or later on your PATH. Mac App Store installs of dayGLANCE additionally need the token, either as an argument (`"args": ["-y", "@glance-apps/mcp-bridge", "--token", "YOUR_TOKEN"]`) or via the `DAYGLANCE_MCP_TOKEN` environment variable.

Direct-download builds of dayGLANCE also bundle this bridge and offer a one-click **Set up Claude Desktop** button in the same settings screen. No Node install is needed on that path.

### Claude Code

Claude Code speaks HTTP directly, so it does not need this bridge:

```
claude mcp add --transport http dayglance http://127.0.0.1:7893/mcp --header "Authorization: Bearer YOUR_TOKEN"
```

## Configuration

Sources in priority order. Later sources fill only what earlier ones left unset.

1. `--port` and `--token` arguments
2. `DAYGLANCE_MCP_TOKEN` and `DAYGLANCE_MCP_PORT` environment variables
3. The discovery file dayGLANCE's direct-download builds write when the MCP server is enabled:
   - Windows: `%APPDATA%\dayGLANCE\mcp.json`
   - Linux: `$XDG_CONFIG_HOME/dayglance/mcp.json`, falling back to `~/.config/dayglance/mcp.json`
   - macOS (direct download): `~/Library/Application Support/dayGLANCE/mcp.json`

Mac App Store builds of dayGLANCE write no discovery file, and this bridge never reads into a macOS app sandbox container. On macOS 15 and later, that read would trigger a consent prompt attributed to "node" that names neither Claude nor dayGLANCE. The token must be provided explicitly on MAS, and dayGLANCE's settings show it for copying.

## License

MIT
