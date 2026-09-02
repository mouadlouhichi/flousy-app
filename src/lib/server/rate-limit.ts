/**
 * Shared API rate limiter — durable when Upstash Redis is configured,
 * per-instance in-memory otherwise.
 *
 * Why: every serverless instance previously kept its own `Map` of hits, so a
 * horizontally scaled deployment multiplied each route's real limit by the
 * instance count and forgot everything on cold start. When
 * `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are set, counting
 * moves to Redis (fixed window via INCR + PEXPIRE over Upstash's REST
 * pipeline — one round trip, no SDK). Without the env vars — or on ANY Redis
 * error/timeout — it falls back to the exact in-memory behaviour the routes
 * always had, so keyless deploys, CI and local dev are unaffected and a Redis
 * outage can never take the API down with it (fail-open to local counting).
 *
 * Semantics: a call both RECORDS the hit and reports whether the caller is
 * now over `limit` hits per `windowMs` (matching the old per-route helpers).
 */

const REDIS_TIMEOUT_MS = 2000;

// --- In-memory fallback (the historical per-route behaviour) ---------------

const memoryStores = new Map<string, Map<string, number[]>>();

function memoryLimited(name: string, key: string, limit: number, windowMs: number): boolean {
  let store = memoryStores.get(name);
  if (!store) {
    store = new Map();
    memoryStores.set(name, store);
  }
  const now = Date.now();
  const hits = (store.get(key) || []).filter((at) => now - at < windowMs);
  hits.push(now);
  store.set(key, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (store.size > 5000) {
    for (const [k, times] of store) {
      if (!times.some((at) => now - at < windowMs)) store.delete(k);
    }
  }
  return hits.length > limit;
}

// --- Upstash Redis REST backend ---------------------------------------------

/**
 * Fixed-window count in Redis. Returns null when Upstash is not configured or
 * the call failed — the caller then falls back to in-memory counting.
 */
async function redisLimited(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const windowStart = Math.floor(Date.now() / windowMs);
  // Key includes the window index so windows expire naturally; the extra
  // PEXPIRE is a safety net against clock-boundary stragglers.
  const redisKey = `rl:${name}:${windowStart}:${key}`;
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, String(windowMs * 2)],
      ]),
      signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    if (!Array.isArray(rows) || rows[0]?.error) return null;
    const count = Number(rows[0]?.result);
    if (!Number.isFinite(count)) return null;
    return count > limit;
  } catch {
    return null; // network error / timeout → fail open to memory counting
  }
}

/**
 * Record a hit for `key` in the limiter named `name` and report whether the
 * caller is now over `limit` hits per `windowMs`.
 */
export async function isRateLimited(
  name: string,
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const viaRedis = await redisLimited(name, key, limit, windowMs);
  if (viaRedis !== null) return viaRedis;
  return memoryLimited(name, key, limit, windowMs);
}

/** Test hook: wipe the in-memory fallback stores. */
export function resetMemoryRateLimits(): void {
  memoryStores.clear();
}
