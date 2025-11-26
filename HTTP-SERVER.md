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

The server exposes an MCP endpoint at `POST /mcp` that accepts JSON-RPC 2.0 requests.

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Available Methods

- `tools/list` - List all available tools
- `tools/call` - Call a specific tool
- `resources/list` - List all resources
- `resources/read` - Read a resource
- `prompts/list` - List all prompts
- `prompts/get` - Get a specific prompt

### Example Tool Call

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
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
```

## Configuration

- `PORT` - Server port (default: 3000)
- Vault paths are passed as command-line arguments

## Features

- Stateless request handling (new transport per request)
- JSON-RPC 2.0 protocol
- All tools from the stdio version
- Resource and prompt support
