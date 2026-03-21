import { promises as fs } from "fs";
import path from "path";
import { getAllMarkdownFiles } from "./files.js";
import { parseNote } from "./tags.js";
import { normalizePath, safeJoinPath } from "./path.js";

export interface QueryCondition {
  field: string;
  operator: ':' | '>' | '<' | '>=' | '<=' | '!=';
  value: string;
}

export interface QueryResult {
  file: string;          // relative path from vault root
  frontmatter: Record<string, any>;
}

/**
 * Parse a query expression like "status:open" or "date_reported>2024-01-01"
 */
export function parseQueryExpression(expr: string): QueryCondition {
  const match = expr.match(/^([a-zA-Z_]\w*)(>=|<=|!=|[:><])(.+)$/);
  if (!match) {
    throw new Error(`Invalid query expression: "${expr}". Expected format: field:value, field>value, field>=value, field<value, field<=value, or field!=value`);
  }
  return {
    field: match[1],
    operator: match[2] as QueryCondition['operator'],
    value: match[3]
  };
}

/**
 * Check if a frontmatter object matches all conditions (AND logic)
 */
export function matchesFrontmatter(frontmatter: Record<string, any>, conditions: QueryCondition[]): boolean {
  return conditions.every(condition => {
    const fieldValue = frontmatter[condition.field];

    // If field doesn't exist in frontmatter, condition fails
    if (fieldValue === undefined || fieldValue === null) {
      return false;
    }

    switch (condition.operator) {
      case ':': {
        if (Array.isArray(fieldValue)) {
          // Array membership check (case-insensitive)
          const target = condition.value.toLowerCase();
          return fieldValue.some((item: any) =>
            String(item).toLowerCase() === target
          );
        }
        // Scalar exact match (case-insensitive)
        return String(fieldValue).toLowerCase() === condition.value.toLowerCase();
      }

      case '!=': {
        if (Array.isArray(fieldValue)) {
          const target = condition.value.toLowerCase();
          return !fieldValue.some((item: any) =>
            String(item).toLowerCase() === target
          );
        }
        return String(fieldValue).toLowerCase() !== condition.value.toLowerCase();
      }

      case '>':
      case '<':
      case '>=':
      case '<=': {
        const numField = parseFloat(String(fieldValue));
        const numValue = parseFloat(condition.value);

        // Use numeric comparison if both parse as numbers
        if (!isNaN(numField) && !isNaN(numValue)) {
          switch (condition.operator) {
            case '>': return numField > numValue;
            case '<': return numField < numValue;
            case '>=': return numField >= numValue;
            case '<=': return numField <= numValue;
          }
        }

        // Fall back to string comparison (works for ISO dates)
        const strField = String(fieldValue);
        const strValue = condition.value;
        switch (condition.operator) {
          case '>': return strField > strValue;
          case '<': return strField < strValue;
          case '>=': return strField >= strValue;
          case '<=': return strField <= strValue;
        }
      }
    }

    return false;
  });
}

/**
 * Scan vault notes and return those matching all query conditions
 */
export async function queryNotes(
  vaultPath: string,
  conditions: QueryCondition[],
  subfolder?: string
): Promise<QueryResult[]> {
  const normalizedVaultPath = normalizePath(vaultPath);
  const searchDir = subfolder
    ? await safeJoinPath(normalizedVaultPath, subfolder)
    : normalizedVaultPath;

  const files = await getAllMarkdownFiles(normalizedVaultPath, searchDir);
  const results: QueryResult[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      const parsed = parseNote(content);

      if (parsed.hasFrontmatter && matchesFrontmatter(parsed.frontmatter, conditions)) {
        results.push({
          file: path.relative(normalizedVaultPath, file),
          frontmatter: parsed.frontmatter
        });
      }
    } catch (error) {
      console.error(`Skipping file ${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return results;
}
