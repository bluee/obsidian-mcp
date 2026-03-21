import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { getAllMarkdownFiles } from "../../utils/files.js";
import { parseNote } from "../../utils/tags.js";
import { normalizePath, safeJoinPath } from "../../utils/path.js";
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
      const normalizedVaultPath = normalizePath(vaultPath);
      const searchDir = args.path
        ? await safeJoinPath(normalizedVaultPath, args.path)
        : normalizedVaultPath;

      const files = await getAllMarkdownFiles(normalizedVaultPath, searchDir);

      const folderCounts = new Map<string, number>();
      const tagCounts = new Map<string, number>();
      const keyCounts = new Map<string, number>();
      let totalNotes = 0;
      let notesWithFrontmatter = 0;

      for (const file of files) {
        try {
          totalNotes++;

          // Count by top-level folder (relative to search root)
          const relativePath = path.relative(searchDir, file);
          const topFolder = relativePath.split(path.sep)[0] || relativePath.split('/')[0];
          // If file is directly in root, use "(root)"
          const folderKey = path.dirname(relativePath) === '.' ? '(root)' : topFolder;
          folderCounts.set(folderKey, (folderCounts.get(folderKey) || 0) + 1);

          const content = await fs.readFile(file, "utf-8");
          const parsed = parseNote(content);

          if (parsed.hasFrontmatter) {
            notesWithFrontmatter++;

            // Count frontmatter keys
            for (const key of Object.keys(parsed.frontmatter)) {
              keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
            }

            // Count tags from frontmatter tags array
            const tags = parsed.frontmatter.tags;
            if (Array.isArray(tags)) {
              for (const tag of tags) {
                const tagStr = String(tag);
                tagCounts.set(tagStr, (tagCounts.get(tagStr) || 0) + 1);
              }
            }
          }
        } catch (error) {
          console.error(`Skipping file ${file}: ${error instanceof Error ? error.message : String(error)}`);
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
