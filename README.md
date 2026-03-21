# Markdown Vault MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants full read/write access to a folder of markdown files. Works with Obsidian vaults, any PKM tool, or plain markdown folders.

Query notes by frontmatter, find backlinks, search with regex, batch-update metadata, and manage tags — all through a standard MCP interface that works with Claude Desktop, claude.ai, or any MCP client.

**Please backup your files before use.** This server has read and write access. Git or any other backup method is recommended.

## Features

- **Read, create, edit, move, and delete** markdown notes
- **Search** with full-text, regex, and tag queries
- **Query frontmatter** — filter notes by YAML fields (`status:open`, `priority:high`, `date>2024-01-01`)
- **Find backlinks** — discover which notes reference a target (wikilinks, markdown links, and plain text)
- **Batch update** frontmatter across multiple matching notes with dry-run preview
- **Vault statistics** — tag frequency, folder distribution, frontmatter key analysis
- **Tag management** — add, remove, rename tags with file locking
- **Partial reads** — get just frontmatter (as JSON) or content without frontmatter
- **In-memory vault index** with file watching for fast repeated queries
- **Multi-vault support** — up to 10 folders simultaneously
- **HTTP mode** — Streamable HTTP transport with session management
- **No Obsidian dependency** — works with any folder of `.md` files

## Requirements

- Node.js 20+
- A folder containing markdown files

## Install

### Claude Desktop

Add to your config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
    "mcpServers": {
        "markdown-vault": {
            "command": "npx",
            "args": ["-y", "obsidian-mcp", "/path/to/your/folder"]
        }
    }
}
```

Multiple folders are supported — just add more paths to the `args` array.

Restart Claude Desktop after saving. The hammer icon should appear, indicating the server is connected.

### HTTP Server

For web-based integrations or remote access, use the `--http` flag. See [HTTP-SERVER.md](HTTP-SERVER.md) for full details.

```bash
node build/main.js --http /path/to/your/folder
```

### Docker

```bash
docker build -t markdown-vault-mcp .
docker run -p 3000:3000 -v /path/to/folder:/vault markdown-vault-mcp /vault
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
| `find-backlinks` | Find all notes referencing a target (links and plain text) |
| `vault-stats` | Analytics: note counts, tag frequency, key distribution |
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
        "markdown-vault": {
            "command": "node",
            "args": ["<absolute-path>/build/main.js", "/path/to/your/folder"]
        }
    }
}
```

Run tests:

```bash
bun test
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Server not showing in Claude Desktop | Check config syntax, ensure path is absolute, restart Claude Desktop |
| Permission errors | Ensure the folder path is readable/writable |
| Tool execution failures | Check logs: `~/Library/Logs/Claude/mcp*.log` (macOS) or `%APPDATA%\Claude\logs\mcp*.log` (Windows) |

## Acknowledgements

Originally inspired by [StevenStavrakis/obsidian-mcp](https://github.com/StevenStavrakis/obsidian-mcp).

## License

MIT
