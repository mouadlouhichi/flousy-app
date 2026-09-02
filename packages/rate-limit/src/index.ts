/**
 * Per-instance sliding-window limiter.
 *
 * Enough to stop a scripted flood on a single Vercel isolate. Not a
 * distributed limit — Resend / Open Food Facts account caps are the outer
 * bound. Swap the store for Upstash later without changing callers.
 */

export interface MemoryRateLimiterOptions {
  windowMs: number;
  max: number;
  /** Drop idle keys when the map grows past this. */
  maxKeys?: number;
}

export interface MemoryRateLimiter {
  /** Record a hit. Returns true when the caller should be rejected. */
  limited(key: string, now?: number): boolean;
  size(): number;
}

export function createMemoryRateLimiter(options: MemoryRateLimiterOptions): MemoryRateLimiter {
  const windowMs = options.windowMs;
  const max = options.max;
  const maxKeys = options.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();

  function prune(now: number) {
    if (hits.size <= maxKeys) return;
    for (const [key, times] of hits) {
      if (!times.some((at) => now - at < windowMs)) hits.delete(key);
    }
  }

  return {
    limited(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) || []).filter((at) => now - at < windowMs);
      recent.push(now);
      hits.set(key, recent);
      prune(now);
      return recent.length > max;
    },
    size() {
      return hits.size;
    },
  };
}
