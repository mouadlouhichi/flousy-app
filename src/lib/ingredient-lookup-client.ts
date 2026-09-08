/**
 * Client for the missing-INCI fallback route.
 *
 * When a scanned cosmetic resolves without an ingredient list the scan flow
 * asks GET /api/inci/lookup?code=… to fill the list from the key-gated
 * provider. Thin wrapper with a small in-memory cache (a basket repeats the
 * same code; provider results are deterministic for a barcode). Results are
 * never persisted here — the paste/record path decides where a list is saved.
 */

export type InciLookupResult =
  | { kind: 'found'; ingredientsText: string }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 100;
const REQUEST_TIMEOUT_MS = 6_000;

const cache = new Map<string, { at: number; value: InciLookupResult }>();
// In-flight promise dedupe: while a barcode lookup is running, any other part
// of the scan UI (collapsed preview + opened panel) shares the same request.
const inFlight = new Map<string, Promise<InciLookupResult>>();

function cacheGet(key: string): InciLookupResult | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  cache.delete(key);
  cache.set(key, hit); // refresh LRU
  return hit.value;
}

function cacheSet(key: string, value: InciLookupResult): void {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/** Empty the lookup cache + any pending in-flight request (tests/logout). */
export function clearInciLookupCache(): void {
  cache.clear();
  inFlight.clear();
}

/**
 * Ask the app's server for the INCI list of a barcode. Returns:
 *  - `found` — a provider answered with an ingredient text;
 *  - `not-found` — the provider did not have this code (safe to show a manual
 *    paste/OCR fallback);
 *  - `unavailable` — no key is configured or the request failed (network,
 *    rate limit, malformed response). The UI must degrade to the existing
 *    paste/OCR path, never show a risk verdict.
 */
export function lookupInciForBarcode(barcode: string): Promise<InciLookupResult> {
  const key = barcode.trim();
  if (!/^[0-9]{8}$/.test(key) && !/^[0-9]{13}$/.test(key)) {
    return Promise.resolve({ kind: 'unavailable' });
  }
  const cached = cacheGet(key);
  if (cached) return Promise.resolve(cached);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetchInciLookup(key)
    .then((value) => {
      if (value.kind !== 'unavailable') cacheSet(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function fetchInciLookup(key: string): Promise<InciLookupResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/inci/lookup?code=${encodeURIComponent(key)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { kind: 'unavailable' };
    const body = (await res.json()) as { found?: boolean; ingredientsText?: unknown };
    if (body.found === true && typeof body.ingredientsText === 'string') {
      const text = body.ingredientsText.trim();
      if (text) return { kind: 'found', ingredientsText: text };
    }
    if (body.found === false) return { kind: 'not-found' };
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
