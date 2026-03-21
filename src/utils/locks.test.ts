import { describe, test, expect } from "bun:test";
import { withLock } from "./locks.js";

describe("withLock", () => {
  test("executes function and returns result", async () => {
    const result = await withLock("/test/file.md", async () => "hello");
    expect(result).toBe("hello");
  });

  test("releases lock after completion", async () => {
    await withLock("/test/file.md", async () => "first");
    // Should not block since lock was released
    const result = await withLock("/test/file.md", async () => "second");
    expect(result).toBe("second");
  });

  test("releases lock on error", async () => {
    try {
      await withLock("/test/file.md", async () => {
        throw new Error("oops");
      });
    } catch { /* expected */ }

    // Should not block since lock was released on error
    const result = await withLock("/test/file.md", async () => "recovered");
    expect(result).toBe("recovered");
  });

  test("blocks concurrent access to same file", async () => {
    const order: number[] = [];

    const slow = withLock("/test/concurrent.md", async () => {
      await new Promise(r => setTimeout(r, 200));
      order.push(1);
      return "slow";
    });

    // Small delay to ensure slow starts first
    await new Promise(r => setTimeout(r, 10));

    const fast = withLock("/test/concurrent.md", async () => {
      order.push(2);
      return "fast";
    }, 1000);

    const [slowResult, fastResult] = await Promise.all([slow, fast]);
    expect(slowResult).toBe("slow");
    expect(fastResult).toBe("fast");
    expect(order).toEqual([1, 2]); // slow finishes before fast starts
  });

  test("allows concurrent access to different files", async () => {
    const order: string[] = [];

    const a = withLock("/test/a.md", async () => {
      await new Promise(r => setTimeout(r, 50));
      order.push("a");
      return "a";
    });

    const b = withLock("/test/b.md", async () => {
      order.push("b");
      return "b";
    });

    await Promise.all([a, b]);
    expect(order[0]).toBe("b"); // b finishes first since no contention
  });

  test("throws on timeout", async () => {
    // Hold a lock
    const holder = withLock("/test/timeout.md", async () => {
      await new Promise(r => setTimeout(r, 500));
      return "held";
    });

    // Small delay to ensure holder acquires lock
    await new Promise(r => setTimeout(r, 10));

    // Try to acquire with short timeout
    try {
      await withLock("/test/timeout.md", async () => "should-fail", 100);
      expect(true).toBe(false); // should not reach here
    } catch (err: any) {
      expect(err.message).toContain("locked");
    }

    await holder; // clean up
  });
});
