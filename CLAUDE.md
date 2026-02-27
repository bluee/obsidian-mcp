# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An MCP (Model Context Protocol) server that gives AI assistants read/write access to Obsidian vaults. Supports multiple vaults simultaneously (up to 10). Communicates over stdio using the MCP SDK.

## Build & Development Commands

```bash
npm install                        # Install dependencies (uses bun.lockb)
npm run build                      # Bundle src/main.ts → build/main.js via Bun
bun test                           # Run all tests (Bun's built-in runner)
bun test src/utils/path.test.ts    # Run a specific test file
```

Build uses `bun build ./src/main.ts --outdir build --target node`. The output is a single bundled JS file, not tsc output. The build script also runs `chmod +x` which will fail on Windows — this is harmless; the build output is still usable.

To test locally, the server needs vault path arguments:
```bash
node build/main.js /path/to/vault                    # Run with one vault
node build/main.js /path/to/vault1 /path/to/vault2   # Multiple vaults
npm run inspect -- /path/to/vault                     # MCP Inspector with a vault
```

## Architecture

### Entry Flow

`src/main.ts` → parses CLI vault args, validates paths/security, creates `ObsidianServer` → registers all 11 tools → starts stdio transport. Note: `manage-tags` has a directory in `src/tools/` but is not imported or registered.

`src/server.ts` → `ObsidianServer` class wraps `@modelcontextprotocol/sdk` Server. Handles MCP protocol (ListTools, CallTool, ListResources, ReadResource, ListPrompts, GetPrompt). Each request goes through rate limiting, message size validation, and connection monitoring.

### Tool System

Each tool lives in `src/tools/<tool-name>/index.ts` and exports a `create<Name>Tool(vaults: Map<string, string>)` factory function. Tools are registered in `main.ts` by calling `server.registerTool()`.

The `Tool` interface (`src/types.ts`) requires:
- `name`, `description`
- `inputSchema` with both `.parse()` (Zod validation) and `.jsonSchema` (JSON Schema for MCP)
- `handler` returning `{ content: [{ type: "text", text: string }] }`

Two factory helpers in `src/utils/tool-factory.ts`:
- `createTool<T>()` — standard tool with vault resolution. The generic `T` must extend `{ vault: string }`. The factory creates a `VaultResolver`, validates args via Zod, resolves the vault name to a path, then calls your handler with `(args, vaultPath, vaultName)`.
- `createToolNoArgs()` — for tools needing no input (e.g., list-available-vaults).

### Schema Pipeline

Zod schema → `createSchemaHandler()` (`src/utils/schema.ts`) → produces object with `.parse()` and `.jsonSchema`. Uses `zod-to-json-schema` for conversion. Schemas must use `.strict()` and have `.describe()` on all fields. Avoid complex `.superRefine()` — prefer discriminated unions for conditional validation since refinements don't translate to JSON Schema.

### Multi-Vault Resolution

`VaultResolver` (`src/utils/vault-resolver.ts`) maps vault names to filesystem paths. Every tool receives a `vault` parameter from the user. Vault names are auto-generated from directory basenames, sanitized to lowercase with hyphens. Duplicates get numeric suffixes.

### Key Utilities

| Module | Purpose |
|--------|---------|
| `utils/tool-factory.ts` | `createTool<T>()` and `createToolNoArgs()` — standardized tool creation with vault resolution |
| `utils/schema.ts` | `createSchemaHandler()` — Zod↔JSON Schema bridge |
| `utils/path.ts` | Path validation: traversal prevention, symlink checks, system dir blocking, network drive detection |
| `utils/security.ts` | Rate limiting (1000 req/min), connection monitoring (5min timeout, 30s heartbeat), message size validation (5MB) |
| `utils/errors.ts` | `handleFsError()` — converts Node.js fs errors to `McpError` |
| `utils/responses.ts` | `createToolResponse()`, `formatFileResult()` — standardized response formatting |

### Resources & Prompts

- Resources use `obsidian-vault://` URI scheme (`src/resources/`)
- Prompts registered via `prompt-factory.ts`, currently just `list-vaults` (`src/prompts/list-vaults/`)

## Adding a New Tool

See `docs/creating-tools.md` for the full guide with examples and anti-patterns. In short:

1. Create `src/tools/<tool-name>/index.ts`
2. Define a Zod schema with `.strict()` and `.describe()` on every field
3. Export a `create<Name>Tool(vaults)` factory using `createTool<T>()` from `utils/tool-factory.ts`
4. Import and register in `src/main.ts` by adding to the `tools` array

## Important Conventions

- ES Modules throughout (`"type": "module"`, `.js` extensions in imports even for `.ts` files)
- All vault paths validated against traversal, symlinks, system dirs, and network paths before use
- `.md` extension auto-appended to note filenames
- Tags normalized before any operation
- Errors logged to stderr; stdout reserved exclusively for MCP JSON-RPC protocol messages
