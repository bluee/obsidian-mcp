import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { parseQueryExpression, queryNotes } from "../../utils/query.js";
import { withLock } from "../../utils/locks.js";
import { parseNote, stringifyNote } from "../../utils/tags.js";
import { normalizePath } from "../../utils/path.js";
import { invalidateVaultIndex } from "../../utils/vault-index.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";

const schema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to update"),
  query: z.array(z.string())
    .min(1, "At least one query condition is required")
    .describe("Array of query conditions to find notes to update (same format as query-frontmatter)"),
  updates: z.record(z.any())
    .describe("Key-value pairs to merge into each matching note's frontmatter"),
  path: z.string()
    .optional()
    .describe("Optional subfolder path within the vault to limit scope"),
  dryRun: z.boolean()
    .optional()
    .default(false)
    .describe("If true, preview changes without writing to files (default: false)")
}).strict();

type BatchUpdateInput = z.infer<typeof schema>;

export function createBatchUpdateTool(vaults: Map<string, string>) {
  return createTool<BatchUpdateInput>({
    name: "batch-update",
    description: `Update frontmatter fields on multiple notes matching a query. Supports dry-run mode to preview changes before applying.

Examples:
- Set status on matching notes: { "vault": "my-vault", "query": ["status:open"], "updates": { "status": "in-progress" } }
- Dry run preview: { "vault": "my-vault", "query": ["priority:high"], "updates": { "assigned_to": "Alice" }, "dryRun": true }
- Update in subfolder: { "vault": "my-vault", "query": ["tags:review"], "updates": { "reviewed": true }, "path": "projects" }`,
    schema,
    handler: async (args, vaultPath, _vaultName) => {
      const normalizedVaultPath = normalizePath(vaultPath);
      const conditions = args.query.map(parseQueryExpression);
      const matchingNotes = await queryNotes(vaultPath, conditions, args.path);

      if (matchingNotes.length === 0) {
        return createToolResponse("No notes matched the query conditions. Nothing to update.");
      }

      if (args.dryRun) {
        const lines: string[] = [];
        lines.push(`Dry run: ${matchingNotes.length} note${matchingNotes.length === 1 ? '' : 's'} would be updated`);
        lines.push('');
        lines.push('Changes to apply:');
        for (const [key, value] of Object.entries(args.updates)) {
          lines.push(`  ${key}: ${JSON.stringify(value)}`);
        }
        lines.push('');
        lines.push('Matching files:');
        for (const note of matchingNotes) {
          lines.push(`  ${note.file}`);
          // Show current values for fields being updated
          for (const key of Object.keys(args.updates)) {
            const current = note.frontmatter[key];
            lines.push(`    ${key}: ${current !== undefined ? JSON.stringify(current) : '(not set)'} -> ${JSON.stringify(args.updates[key])}`);
          }
        }
        return createToolResponse(lines.join('\n'));
      }

      // Apply updates
      const updated: string[] = [];
      const errors: Array<{ file: string; error: string }> = [];
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      for (const note of matchingNotes) {
        const fullPath = path.join(normalizedVaultPath, note.file);
        try {
          await withLock(fullPath, async () => {
            const content = await fs.readFile(fullPath, "utf-8");
            const parsed = parseNote(content);

            // Merge updates into frontmatter
            for (const [key, value] of Object.entries(args.updates)) {
              parsed.frontmatter[key] = value;
            }

            // Auto-set last_updated if the field already exists
            if ('last_updated' in parsed.frontmatter) {
              parsed.frontmatter.last_updated = today;
            }

            parsed.hasFrontmatter = true;
            const updatedContent = stringifyNote(parsed);
            await fs.writeFile(fullPath, updatedContent, "utf-8");
          });
          updated.push(note.file);
        } catch (error) {
          errors.push({
            file: note.file,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      const lines: string[] = [];
      lines.push(`Updated ${updated.length} of ${matchingNotes.length} note${matchingNotes.length === 1 ? '' : 's'}`);

      if (updated.length > 0) {
        lines.push('');
        lines.push('Updated files:');
        for (const file of updated) {
          lines.push(`  ${file}`);
        }
      }

      if (errors.length > 0) {
        lines.push('');
        lines.push('Errors:');
        for (const err of errors) {
          lines.push(`  ${err.file}: ${err.error}`);
        }
      }

      if (updated > 0) invalidateVaultIndex(vaultPath);
      return createToolResponse(lines.join('\n'));
    }
  }, vaults);
}
