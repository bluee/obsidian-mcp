import { z } from "zod";
import { parseQueryExpression, queryNotes } from "../../utils/query.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";

const schema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to query"),
  query: z.array(z.string())
    .min(1, "At least one query condition is required")
    .describe("Array of query conditions in the format 'field:value', 'field>value', 'field>=value', 'field<value', 'field<=value', or 'field!=value'. All conditions are ANDed together."),
  path: z.string()
    .optional()
    .describe("Optional subfolder path within the vault to limit query scope"),
  maxResults: z.number()
    .optional()
    .default(50)
    .describe("Maximum number of results to return (default: 50)")
}).strict();

type QueryFrontmatterInput = z.infer<typeof schema>;

export function createQueryFrontmatterTool(vaults: Map<string, string>) {
  return createTool<QueryFrontmatterInput>({
    name: "query-frontmatter",
    description: `Query notes by their YAML frontmatter fields. Supports comparison operators for filtering.

Examples:
- Find open notes: { "vault": "my-vault", "query": ["status:open"] }
- Find high-priority open notes: { "vault": "my-vault", "query": ["status:open", "priority:high"] }
- Find notes after a date: { "vault": "my-vault", "query": ["date_reported>2024-01-01"] }
- Find notes with a tag: { "vault": "my-vault", "query": ["tags:waterproofing"] }
- Find notes not closed: { "vault": "my-vault", "query": ["status!=closed"] }
- Search in subfolder: { "vault": "my-vault", "query": ["status:open"], "path": "projects" }`,
    schema,
    handler: async (args, vaultPath, _vaultName) => {
      const conditions = args.query.map(parseQueryExpression);
      const results = await queryNotes(vaultPath, conditions, args.path);
      const limited = results.slice(0, args.maxResults);

      if (limited.length === 0) {
        return createToolResponse("No notes matched the query conditions.");
      }

      const lines: string[] = [];
      lines.push(`Found ${results.length} matching note${results.length === 1 ? '' : 's'}${results.length > limited.length ? ` (showing first ${limited.length})` : ''}`);
      lines.push('');

      for (const result of limited) {
        lines.push(`File: ${result.file}`);
        for (const [key, value] of Object.entries(result.frontmatter)) {
          const display = Array.isArray(value) ? value.join(', ') : String(value);
          lines.push(`  ${key}: ${display}`);
        }
        lines.push('');
      }

      return createToolResponse(lines.join('\n').trimEnd());
    }
  }, vaults);
}
