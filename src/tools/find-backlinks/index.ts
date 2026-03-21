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
    .describe("Whether to include the line content for each backlink (default: true)"),
  searchMode: z.enum(['links', 'text', 'all'])
    .optional()
    .default('all')
    .describe("Search mode: 'links' (wikilinks/markdown links only), 'text' (plain text mentions), 'all' (both, default)")
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
    description: `Find all notes that reference a target note. Searches wikilinks, markdown links, and plain text mentions.

Examples:
- Find all references: { "vault": "v", "target": "A-007" }
- Links only: { "vault": "v", "target": "meeting-notes", "searchMode": "links" }
- Text mentions only: { "vault": "v", "target": "A-007", "searchMode": "text" }
- In subfolder: { "vault": "v", "target": "A-007", "path": "DEFECTS" }`,
    schema,
    handler: async (args, vaultPath, _vaultName) => {
      const normalizedVaultPath = normalizePath(vaultPath);
      const searchDir = args.path
        ? await safeJoinPath(normalizedVaultPath, args.path)
        : normalizedVaultPath;

      const files = await getAllMarkdownFiles(normalizedVaultPath, searchDir);
      const targetLower = args.target.toLowerCase();

      // Build regex patterns for case-insensitive matching
      const escapedTarget = args.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchLinks = args.searchMode === 'links' || args.searchMode === 'all';
      const searchText = args.searchMode === 'text' || args.searchMode === 'all';

      // Wikilink: [[target]] or [[target|display text]]
      const wikilinkPattern = searchLinks ? new RegExp(`\\[\\[${escapedTarget}(\\|[^\\]]*)?\\]\\]`, 'gi') : null;
      // Markdown link: [any text](target.md) or [any text](path/to/target.md)
      const mdLinkPattern = searchLinks ? new RegExp(`\\[[^\\]]*\\]\\([^)]*${escapedTarget}\\.md\\)`, 'gi') : null;
      // Plain text: word-boundary match for the target string
      const textPattern = searchText ? new RegExp(`\\b${escapedTarget}\\b`, 'gi') : null;

      const backlinkFiles: BacklinkFile[] = [];
      let totalMatches = 0;

      for (const file of files) {
        // Skip the target note itself
        const relativePath = path.relative(normalizedVaultPath, file);
        const basename = path.basename(file, '.md');
        if (basename.toLowerCase() === targetLower) continue;

        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");
          const matches: BacklinkMatch[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let matched = false;

            if (wikilinkPattern) {
              wikilinkPattern.lastIndex = 0;
              if (wikilinkPattern.test(line)) matched = true;
            }
            if (!matched && mdLinkPattern) {
              mdLinkPattern.lastIndex = 0;
              if (mdLinkPattern.test(line)) matched = true;
            }
            if (!matched && textPattern) {
              textPattern.lastIndex = 0;
              if (textPattern.test(line)) matched = true;
            }

            if (matched) {
              matches.push({
                line: i + 1,
                text: line.trim()
              });
            }
          }

          if (matches.length > 0) {
            backlinkFiles.push({
              file: relativePath,
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
