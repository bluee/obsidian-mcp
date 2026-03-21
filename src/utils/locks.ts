import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { normalizePath } from "./path.js";

const locks = new Map<string, { acquiredAt: number }>();
const LOCK_TIMEOUT_MS = 30000; // auto-expire
const POLL_INTERVAL_MS = 100;

/**
 * Execute a function while holding an advisory lock on a file path.
 * Locks auto-expire after LOCK_TIMEOUT_MS to prevent deadlocks.
 */
export async function withLock<T>(filePath: string, fn: () => Promise<T>, timeout = 5000): Promise<T> {
  const key = normalizePath(filePath);
  const deadline = Date.now() + timeout;

  // Wait for lock
  while (locks.has(key)) {
    const lock = locks.get(key)!;
    if (Date.now() - lock.acquiredAt > LOCK_TIMEOUT_MS) {
      locks.delete(key); // expired
      break;
    }
    if (Date.now() > deadline) {
      throw new McpError(ErrorCode.InternalError, `File is locked: ${filePath}`);
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  locks.set(key, { acquiredAt: Date.now() });
  try {
    return await fn();
  } finally {
    locks.delete(key);
  }
}
