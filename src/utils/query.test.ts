import { describe, test, expect } from "bun:test";
import { parseQueryExpression, matchesFrontmatter, QueryCondition } from "./query.js";

describe("parseQueryExpression", () => {
  test("parses colon operator", () => {
    expect(parseQueryExpression("status:open")).toEqual({
      field: "status", operator: ":", value: "open"
    });
  });

  test("parses greater than", () => {
    expect(parseQueryExpression("priority>3")).toEqual({
      field: "priority", operator: ">", value: "3"
    });
  });

  test("parses greater than or equal", () => {
    expect(parseQueryExpression("date_reported>=2024-01-01")).toEqual({
      field: "date_reported", operator: ">=", value: "2024-01-01"
    });
  });

  test("parses not equal", () => {
    expect(parseQueryExpression("status!=closed")).toEqual({
      field: "status", operator: "!=", value: "closed"
    });
  });

  test("parses less than", () => {
    expect(parseQueryExpression("count<10")).toEqual({
      field: "count", operator: "<", value: "10"
    });
  });

  test("throws on invalid expression", () => {
    expect(() => parseQueryExpression("invalid")).toThrow();
    expect(() => parseQueryExpression("")).toThrow();
    expect(() => parseQueryExpression(":value")).toThrow();
  });

  test("handles values with colons", () => {
    // "field:value:with:colons" — first colon is the operator
    const result = parseQueryExpression("url:https://example.com");
    expect(result.field).toBe("url");
    expect(result.operator).toBe(":");
    expect(result.value).toBe("https://example.com");
  });
});

describe("matchesFrontmatter", () => {
  const fm = {
    status: "open",
    priority: "high",
    defect_id: 7,
    tags: ["waterproofing", "kitchen", "ventilation"],
    qbcc_case_id: [2532951, 2368481],
    date_reported: new Date("2023-05-15"),  // YAML parser produces Date objects
    assigned_to: null,
  };

  test("exact match on scalar (case-insensitive)", () => {
    expect(matchesFrontmatter(fm, [{ field: "status", operator: ":", value: "open" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "status", operator: ":", value: "Open" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "status", operator: ":", value: "closed" }])).toBe(false);
  });

  test("array membership", () => {
    expect(matchesFrontmatter(fm, [{ field: "tags", operator: ":", value: "waterproofing" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "tags", operator: ":", value: "Waterproofing" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "tags", operator: ":", value: "structural" }])).toBe(false);
  });

  test("numeric array membership", () => {
    expect(matchesFrontmatter(fm, [{ field: "qbcc_case_id", operator: ":", value: "2532951" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "qbcc_case_id", operator: ":", value: "9999999" }])).toBe(false);
  });

  test("not equal operator", () => {
    expect(matchesFrontmatter(fm, [{ field: "status", operator: "!=", value: "closed" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "status", operator: "!=", value: "open" }])).toBe(false);
  });

  test("numeric comparison", () => {
    expect(matchesFrontmatter(fm, [{ field: "defect_id", operator: ">", value: "5" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "defect_id", operator: "<", value: "5" }])).toBe(false);
    expect(matchesFrontmatter(fm, [{ field: "defect_id", operator: ">=", value: "7" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "defect_id", operator: "<=", value: "7" }])).toBe(true);
  });

  test("date comparison (string lexicographic)", () => {
    expect(matchesFrontmatter(fm, [{ field: "date_reported", operator: ">", value: "2023-01-01" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "date_reported", operator: "<", value: "2024-01-01" }])).toBe(true);
    expect(matchesFrontmatter(fm, [{ field: "date_reported", operator: ">", value: "2024-01-01" }])).toBe(false);
  });

  test("AND logic — all conditions must match", () => {
    expect(matchesFrontmatter(fm, [
      { field: "status", operator: ":", value: "open" },
      { field: "priority", operator: ":", value: "high" }
    ])).toBe(true);

    expect(matchesFrontmatter(fm, [
      { field: "status", operator: ":", value: "open" },
      { field: "priority", operator: ":", value: "low" }
    ])).toBe(false);
  });

  test("missing field returns false", () => {
    expect(matchesFrontmatter(fm, [{ field: "nonexistent", operator: ":", value: "x" }])).toBe(false);
  });

  test("null field returns false", () => {
    expect(matchesFrontmatter(fm, [{ field: "assigned_to", operator: ":", value: "alice" }])).toBe(false);
  });

  test("empty conditions matches everything", () => {
    expect(matchesFrontmatter(fm, [])).toBe(true);
    expect(matchesFrontmatter({}, [])).toBe(true);
  });
});
