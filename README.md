# Obsidian MCP Server

> Originally inspired by [StevenStavrakis/obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp). This project has since diverged significantly with new tools, a vault index, file locking, and relaxed requirements.

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that enables AI assistants to interact with Obsidian vaults or any folder of markdown files — reading, creating, editing, searching, and managing notes and tags.

**Please backup your vault before use.** This MCP has read and write access. Git or any other backup method is recommended.

## Features

- Read, create, edit, move, and delete notes
- Search vault contents (full-text, tag-based, and regex)
- Query notes by frontmatter fields (e.g. `status:open`, `priority:high`)
- Find backlinks — discover which notes link to a target note
- Vault statistics — tag frequency, folder distribution, frontmatter key analysis
- Batch update frontmatter across multiple notes with dry-run preview
- Manage tags (add, remove, rename) with file locking
- Partial note reads (frontmatter-only or content-only)
- Multi-vault support (up to 10 vaults)
- HTTP server mode via Streamable HTTP transport
- Works with any markdown folder (Obsidian not required)

## Requirements

- Node.js 20+
- A folder containing markdown files (Obsidian vault optional)

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
| `read-note` | Read a note (full, frontmatter-only, or content-only) |
| `create-note` | Create a new note |
| `edit-note` | Edit an existing note (with file locking) |
| `delete-note` | Delete a note |
| `move-note` | Move a note to a different location |
| `create-directory` | Create a new directory |
| `search-vault` | Search notes (text, regex, tags) with frontmatter filtering |
| `query-frontmatter` | Filter notes by YAML frontmatter fields |
| `find-backlinks` | Find all notes linking to a target note |
| `vault-stats` | Vault analytics: note counts, tag frequency, key distribution |
| `batch-update` | Bulk update frontmatter across matching notes |
| `add-tags` | Add tags to a note (with file locking) |
| `remove-tags` | Remove tags from a note (with file locking) |
| `manage-tags` | Add or remove tags with advanced options |
| `rename-tag` | Rename a tag across all notes (with file locking) |
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
