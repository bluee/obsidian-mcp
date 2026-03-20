# Obsidian MCP HTTP Server

This is an HTTP server implementation of the Obsidian MCP using the streamable-http transport.

## Installation

```bash
npm install
```

## Building

```bash
npm run build
```

## Running

```bash
# Default port 3000
npm run start:http -- /path/to/vault1 /path/to/vault2

# Or directly with node
node build/main.js --http /path/to/vault1 /path/to/vault2

# Custom port
PORT=8080 node build/main.js --http /path/to/vault1 /path/to/vault2
```

## Docker

```bash
# Build the project first
npm run build

# Build Docker image
docker build -t obsidian-mcp .

# Run with vault mounted
docker run -p 3000:3000 -v /path/to/vault:/vault obsidian-mcp /vault

# Multiple vaults
docker run -p 3000:3000 \
  -v /path/to/vault1:/vault1 \
  -v /path/to/vault2:/vault2 \
  obsidian-mcp /vault1 /vault2
```

## Usage

The server exposes the MCP Streamable HTTP endpoint at `/mcp` supporting `POST`, `GET`, and `DELETE` methods with session management.

### Session Lifecycle

1. **Initialize** — `POST /mcp` with an `initialize` request creates a new session. The server returns an `Mcp-Session-Id` header.
2. **Requests** — Subsequent `POST /mcp` requests include the `Mcp-Session-Id` header to route to the existing session.
3. **SSE Stream** — `GET /mcp` with the `Mcp-Session-Id` header opens an SSE stream for server-initiated notifications.
4. **Terminate** — `DELETE /mcp` with the `Mcp-Session-Id` header closes the session.

### Example: Initialize and Call a Tool

```bash
# 1. Initialize — capture the session ID from response headers
curl -v -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "example", "version": "1.0" }
    }
  }'
# Look for: Mcp-Session-Id: <session-id> in response headers

# 2. Call a tool using the session ID
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "read-note",
      "arguments": {
        "vault": "my-vault",
        "filename": "example.md"
      }
    }
  }'

# 3. Terminate session
curl -X DELETE http://localhost:3000/mcp \
  -H "Mcp-Session-Id: <session-id>"
```

### Available Methods

- `initialize` - Initialize session
- `tools/list` - List all available tools
- `tools/call` - Call a specific tool
- `resources/list` - List all resources
- `resources/read` - Read a resource
- `prompts/list` - List all prompts
- `prompts/get` - Get a specific prompt

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `HOST` | localhost | Bind address |

Vault paths are passed as command-line arguments.

## Features

- Stateful session management with unique session IDs
- SSE streaming for responses and server-initiated notifications
- `GET /mcp` for persistent SSE notification stream
- `DELETE /mcp` for session teardown
- JSON-RPC 2.0 protocol
- All tools from the stdio version
- Resource and prompt support
