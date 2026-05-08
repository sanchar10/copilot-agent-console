/**
 * Retry a function with exponential backoff, optionally capped at `maxDelayMs`.
 *
 * Default behaviour: exponential — delays 2s, 4s, 8s (4 attempts → ~14s budget).
 *
 * For the cold-start polling case (server is booting, we know it'll be there
 * soon, we just don't know exactly when), pass `maxDelayMs` equal to
 * `initialDelayMs` to get linear polling instead. Example for a 14s budget at
 * 2s intervals: `{ maxAttempts: 8, initialDelayMs: 2000, maxDelayMs: 2000 }`.
 * That way the post-ready wait window is always ≤ initialDelayMs, instead of
 * up to 8s with default exponential growth.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    maxAttempts = 4,
    initialDelayMs = 2000,
    maxDelayMs = Infinity,
  }: { maxAttempts?: number; initialDelayMs?: number; maxDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        console.warn(`[retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
