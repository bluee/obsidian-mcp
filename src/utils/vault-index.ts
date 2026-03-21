import { promises as fs, watch, FSWatcher } from "fs";
import path from "path";
import { getAllMarkdownFiles } from "./files.js";
import { parseNote, extractTags } from "./tags.js";
import { normalizePath } from "./path.js";

export interface IndexedNote {
  /** Absolute path */
  absolutePath: string;
  /** Relative path from vault root */
  relativePath: string;
  /** Parsed YAML frontmatter */
  frontmatter: Record<string, any>;
  /** Whether the note has frontmatter */
  hasFrontmatter: boolean;
  /** Inline tags extracted from content */
  inlineTags: string[];
  /** Last modified time (ms since epoch) */
  mtime: number;
}

interface VaultCache {
  notes: Map<string, IndexedNote>; // keyed by absolute path
  builtAt: number;
  watcher: FSWatcher | null;
  dirty: boolean;
}

const vaultCaches = new Map<string, VaultCache>();

const DEBOUNCE_MS = 500;
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Get or build the index for a vault. Returns cached version if clean.
 */
export async function getVaultIndex(vaultPath: string, subfolder?: string): Promise<IndexedNote[]> {
  const normalizedVault = normalizePath(vaultPath);
  let cache = vaultCaches.get(normalizedVault);

  if (!cache || cache.dirty) {
    cache = await buildIndex(normalizedVault);
    vaultCaches.set(normalizedVault, cache);
  }

  if (subfolder) {
    const subPath = normalizePath(path.join(normalizedVault, subfolder));
    return Array.from(cache.notes.values()).filter(
      (n) => n.absolutePath.startsWith(subPath)
    );
  }

  return Array.from(cache.notes.values());
}

/**
 * Invalidate the cache for a vault (e.g. after a write operation).
 */
export function invalidateVaultIndex(vaultPath: string): void {
  const normalizedVault = normalizePath(vaultPath);
  const cache = vaultCaches.get(normalizedVault);
  if (cache) {
    cache.dirty = true;
  }
}

async function buildIndex(vaultPath: string): Promise<VaultCache> {
  const existing = vaultCaches.get(vaultPath);
  const oldNotes = existing?.notes;

  const files = await getAllMarkdownFiles(vaultPath);
  const notes = new Map<string, IndexedNote>();

  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      const mtime = stat.mtimeMs;

      // Reuse cached entry if file hasn't changed
      const cached = oldNotes?.get(file);
      if (cached && cached.mtime === mtime) {
        notes.set(file, cached);
        continue;
      }

      const content = await fs.readFile(file, "utf-8");
      const parsed = parseNote(content);
      const inlineTags = extractTags(content);

      notes.set(file, {
        absolutePath: file,
        relativePath: path.relative(vaultPath, file),
        frontmatter: parsed.frontmatter,
        hasFrontmatter: parsed.hasFrontmatter,
        inlineTags,
        mtime,
      });
    } catch (err) {
      console.error(`Index: skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Set up file watcher if not already watching
  let watcher = existing?.watcher ?? null;
  if (!watcher) {
    try {
      watcher = watch(vaultPath, { recursive: true }, (_event, filename) => {
        if (!filename || !filename.endsWith(".md")) return;

        // Debounce: mark dirty after a short delay to batch rapid changes
        const key = vaultPath;
        const existing = debounceTimers.get(key);
        if (existing) clearTimeout(existing);
        debounceTimers.set(
          key,
          setTimeout(() => {
            const cache = vaultCaches.get(vaultPath);
            if (cache) cache.dirty = true;
            debounceTimers.delete(key);
          }, DEBOUNCE_MS)
        );
      });
      watcher.on("error", (err) => {
        console.error(`Watcher error for ${vaultPath}: ${err.message}`);
      });
    } catch (err) {
      console.error(`Failed to watch ${vaultPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.error(`Index: ${notes.size} notes indexed for ${vaultPath}`);

  return {
    notes,
    builtAt: Date.now(),
    watcher,
    dirty: false,
  };
}

/**
 * Stop all watchers and clear caches. Call on shutdown.
 */
export function closeAllIndexes(): void {
  for (const [, cache] of vaultCaches) {
    cache.watcher?.close();
  }
  vaultCaches.clear();
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}
