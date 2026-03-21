import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { getAllMarkdownFiles } from "../../utils/files.js";
import { normalizePath, safeJoinPath } from "../../utils/path.js";
import { createToolResponse } from "../../utils/responses.js";
import { createTool } from "../../utils/tool-factory.js";

const schema = z.object({
  vault: z.string()
    .min(1, "Vault name cannot be empty")
    .describe("Name of the vault to search in"),
  target: z.string()
    .min(1, "Target note name cannot be empty")
    .describe("Name of the target note to find backlinks for (without .md extension)"),
  path: z.string()
    .optional()
    .describe("Optional subfolder path within the vault to limit search scope"),
  includeContext: z.boolean()
    .optional()
    .default(true)
    .describe("Whether to include the line content for each backlink (default: true)")
}).strict();

type FindBacklinksInput = z.infer<typeof schema>;

interface BacklinkMatch {
  line: number;
  text: string;
}

interface BacklinkFile {
  file: string;
  matches: BacklinkMatch[];
}

export function createFindBacklinksTool(vaults: Map<string, string>) {
  return createTool<FindBacklinksInput>({
    name: "find-backlinks",
    description: `Find all notes that link to a given target note. Searches for wikilinks ([[target]]) and markdown links ([text](target.md)).

Examples:
- Find backlinks: { "vault": "my-vault", "target": "meeting-notes" }
- Without context: { "vault": "my-vault", "target": "project-plan", "includeContext": false }
- Search in subfolder: { "vault": "my-vault", "target": "API docs", "path": "projects" }`,
    schema,
    handler: async (args, vaultPath, _vaultName) => {
      const normalizedVaultPath = normalizePath(vaultPath);
      const searchDir = args.path
        ? await safeJoinPath(normalizedVaultPath, args.path)
        : normalizedVaultPath;

      const files = await getAllMarkdownFiles(normalizedVaultPath, searchDir);
      const targetLower = args.target.toLowerCase();

      // Build regex patterns for case-insensitive matching
      // Wikilink: [[target]] or [[target|display text]]
      const escapedTarget = args.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wikilinkPattern = new RegExp(`\\[\\[${escapedTarget}(\\|[^\\]]*)?\\]\\]`, 'gi');
      // Markdown link: [any text](target.md) or [any text](path/to/target.md)
      const mdLinkPattern = new RegExp(`\\[[^\\]]*\\]\\([^)]*${escapedTarget}\\.md\\)`, 'gi');

      const backlinkFiles: BacklinkFile[] = [];
      let totalMatches = 0;

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");
          const matches: BacklinkMatch[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Reset regex lastIndex for each line
            wikilinkPattern.lastIndex = 0;
            mdLinkPattern.lastIndex = 0;

            if (wikilinkPattern.test(line) || mdLinkPattern.test(line)) {
              matches.push({
                line: i + 1,
                text: line.trim()
              });
            }
          }

          if (matches.length > 0) {
            backlinkFiles.push({
              file: path.relative(normalizedVaultPath, file),
              matches
            });
            totalMatches += matches.length;
          }
        } catch (error) {
          console.error(`Skipping file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (backlinkFiles.length === 0) {
        return createToolResponse(`No backlinks found for '${args.target}'.`);
      }

      const lines: string[] = [];
      lines.push(`Found ${totalMatches} backlink${totalMatches === 1 ? '' : 's'} to '${args.target}' in ${backlinkFiles.length} file${backlinkFiles.length === 1 ? '' : 's'}`);
      lines.push('');

      for (const blFile of backlinkFiles) {
        lines.push(`File: ${blFile.file}`);
        for (const match of blFile.matches) {
          if (args.includeContext) {
            lines.push(`  Line ${match.line}: ${match.text}`);
          } else {
            lines.push(`  Line ${match.line}`);
          }
        }
        lines.push('');
      }

      return createToolResponse(lines.join('\n').trimEnd());
    }
  }, vaults);
}
