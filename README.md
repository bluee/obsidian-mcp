# Obsidian MCP Server

> This is a fork of [StevenStavrakis/obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp) with the following upstream PRs merged:
> - [#31](https://github.com/StevenStavrakis/obsidian-mcp/pull/31) — Streamable HTTP transport
> - [#32](https://github.com/StevenStavrakis/obsidian-mcp/pull/32) — Unicode vault name support

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that enables AI assistants to interact with Obsidian vaults — reading, creating, editing, and managing notes and tags.

**Please backup your vault before use.** This MCP has read and write access. Git or any other backup method is recommended.

## Features

- Read, create, edit, move, and delete notes
- Search vault contents (full-text and tag-based)
- Manage tags (add, remove, rename)
- Create directories
- Multi-vault support (up to 10 vaults)
- HTTP server mode via streamable-http transport

## Requirements

- Node.js 20+
- An Obsidian vault (opened in Obsidian at least once)

## Install

### Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
    "mcpServers": {
        "obsidian": {
            "command": "npx",
            "args": ["-y", "obsidian-mcp", "/path/to/your/vault"]
        }
    }
}
```

Multiple vaults are supported — just add more paths to the `args` array.

Restart Claude Desktop after saving. The hammer icon should appear, indicating the server is connected.

### HTTP Server

For web-based integrations, use the `--http` flag. See [HTTP-SERVER.md](HTTP-SERVER.md) for full details.

```bash
node build/main.js --http /path/to/your/vault
```

## Available Tools

| Tool | Description |
|------|-------------|
| `read-note` | Read the contents of a note |
| `create-note` | Create a new note |
| `edit-note` | Edit an existing note |
| `delete-note` | Delete a note |
| `move-note` | Move a note to a different location |
| `create-directory` | Create a new directory |
| `search-vault` | Search notes in the vault |
| `add-tags` | Add tags to a note |
| `remove-tags` | Remove tags from a note |
| `rename-tag` | Rename a tag across all notes |
| `list-available-vaults` | List all configured vaults |

## Development

```bash
git clone https://github.com/bluee/obsidian-mcp
cd obsidian-mcp
npm install
npm run build
```

Then point Claude Desktop at your local build:

```json
{
    "mcpServers": {
        "obsidian": {
            "command": "node",
            "args": ["<absolute-path-to-obsidian-mcp>/build/main.js", "/path/to/your/vault"]
        }
    }
}
```

Additional docs in the `docs/` directory: [creating-tools.md](docs/creating-tools.md), [tool-examples.md](docs/tool-examples.md).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Server not showing in Claude Desktop | Check config syntax, ensure vault path is absolute, restart Claude Desktop |
| Permission errors | Ensure the vault path is readable/writable |
| Tool execution failures | Check logs: `~/Library/Logs/Claude/mcp*.log` (macOS) or `%APPDATA%\Claude\logs\mcp*.log` (Windows) |

## License

MIT
