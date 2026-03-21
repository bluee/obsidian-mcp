import path from "path";
import { normalizePath } from "./path.js";
import { getVaultIndex } from "./vault-index.js";

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
 * Convert a value to a comparable string, handling Date objects from YAML parsing.
 */
function toComparableString(value: any): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  return String(value);
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
            toComparableString(item).toLowerCase() === target
          );
        }
        // Scalar exact match (case-insensitive)
        return toComparableString(fieldValue).toLowerCase() === condition.value.toLowerCase();
      }

      case '!=': {
        if (Array.isArray(fieldValue)) {
          const target = condition.value.toLowerCase();
          return !fieldValue.some((item: any) =>
            toComparableString(item).toLowerCase() === target
          );
        }
        return toComparableString(fieldValue).toLowerCase() !== condition.value.toLowerCase();
      }

      case '>':
      case '<':
      case '>=':
      case '<=': {
        const strField = toComparableString(fieldValue);
        const isDate = fieldValue instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(condition.value);

        // Use numeric comparison only if neither side looks like a date
        if (!isDate) {
          const numField = parseFloat(strField);
          const numValue = parseFloat(condition.value);
          if (!isNaN(numField) && !isNaN(numValue)) {
            switch (condition.operator) {
              case '>': return numField > numValue;
              case '<': return numField < numValue;
              case '>=': return numField >= numValue;
              case '<=': return numField <= numValue;
            }
          }
        }

        // String comparison (works for ISO dates)
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
 * Scan vault notes and return those matching all query conditions.
 * Uses the vault index for fast cached lookups.
 */
export async function queryNotes(
  vaultPath: string,
  conditions: QueryCondition[],
  subfolder?: string
): Promise<QueryResult[]> {
  const notes = await getVaultIndex(vaultPath, subfolder);
  const results: QueryResult[] = [];

  for (const note of notes) {
    if (note.hasFrontmatter && matchesFrontmatter(note.frontmatter, conditions)) {
      results.push({
        file: note.relativePath,
        frontmatter: note.frontmatter
      });
    }
  }

  return results;
}
