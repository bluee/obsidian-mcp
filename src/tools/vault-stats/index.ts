import { z } from "zod";
import path from "path";
import { normalizePath } from "../../utils/path.js";
import { getVaultIndex } from "../../utils/vault-index.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";

const schema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to get statistics for"),
  path: z.string()
    .optional()
    .describe("Optional subfolder path within the vault to limit statistics scope")
}).strict();

type VaultStatsInput = z.infer<typeof schema>;

export function createVaultStatsTool(vaults: Map<string, string>) {
  return createTool<VaultStatsInput>({
    name: "vault-stats",
    description: `Get statistics about notes in a vault, including note counts by folder, tag frequency, and frontmatter key usage.

Examples:
- Full vault stats: { "vault": "my-vault" }
- Stats for subfolder: { "vault": "my-vault", "path": "projects" }`,
    schema,
    handler: async (args, vaultPath, _vaultName) => {
      const notes = await getVaultIndex(vaultPath, args.path);

      const folderCounts = new Map<string, number>();
      const tagCounts = new Map<string, number>();
      const keyCounts = new Map<string, number>();
      let totalNotes = 0;
      let notesWithFrontmatter = 0;

      for (const note of notes) {
        totalNotes++;

        // Count by top-level folder
        const parts = note.relativePath.split('/');
        const folderKey = parts.length <= 1 ? '(root)' : parts[0];
        folderCounts.set(folderKey, (folderCounts.get(folderKey) || 0) + 1);

        if (note.hasFrontmatter) {
          notesWithFrontmatter++;

          for (const key of Object.keys(note.frontmatter)) {
            keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
          }

          const tags = note.frontmatter.tags;
          if (Array.isArray(tags)) {
            for (const tag of tags) {
              tagCounts.set(String(tag), (tagCounts.get(String(tag)) || 0) + 1);
            }
          }
        }
      }

      // Build output
      const lines: string[] = [];
      lines.push(`Vault Statistics${args.path ? ` (${args.path})` : ''}`);
      lines.push('='.repeat(40));
      lines.push('');
      lines.push(`Total notes: ${totalNotes}`);
      lines.push(`Notes with frontmatter: ${notesWithFrontmatter}`);

      // Notes by folder
      if (folderCounts.size > 0) {
        lines.push('');
        lines.push('Notes by folder:');
        const sortedFolders = [...folderCounts.entries()].sort((a, b) => b[1] - a[1]);
        for (const [folder, count] of sortedFolders) {
          lines.push(`  ${folder}: ${count}`);
        }
      }

      // Top 20 tags
      if (tagCounts.size > 0) {
        lines.push('');
        lines.push(`Tags (${tagCounts.size} unique, top 20):`);
        const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
        for (const [tag, count] of sortedTags) {
          lines.push(`  ${tag}: ${count}`);
        }
      }

      // Frontmatter key frequency
      if (keyCounts.size > 0) {
        lines.push('');
        lines.push('Frontmatter keys:');
        const sortedKeys = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]);
        for (const [key, count] of sortedKeys) {
          lines.push(`  ${key}: ${count}`);
        }
      }

      return createToolResponse(lines.join('\n'));
    }
  }, vaults);
}
