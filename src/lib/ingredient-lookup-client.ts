import { parseGtin } from '@/lib/gtin';

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

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('The operation was aborted.', 'AbortError');
  const error = new Error('The operation was aborted.');
  error.name = 'AbortError';
  return error;
}

function waitForSubscriber<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        if (!signal.aborted) reject(error);
      },
    );
  });
}

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
export function lookupInciForBarcode(
  barcode: string,
  options: { signal?: AbortSignal } = {},
): Promise<InciLookupResult> {
  if (options.signal?.aborted) return Promise.reject(abortError());
  const parsed = parseGtin({ rawValue: barcode, source: 'api' });
  if (!parsed.ok) return Promise.resolve({ kind: 'unavailable' });
  const key = parsed.value.gtin14;
  const cached = cacheGet(key);
  if (cached) return waitForSubscriber(Promise.resolve(cached), options.signal);
  const pending = inFlight.get(key);
  if (pending) return waitForSubscriber(pending, options.signal);

  const promise = fetchInciLookup(parsed.value.lookupCode)
    .then((value) => {
      if (value.kind !== 'unavailable') cacheSet(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return waitForSubscriber(promise, options.signal);
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
    const body = (await res.json()) as { found?: boolean; reason?: string; ingredientsText?: unknown };
    if (body.found === true && typeof body.ingredientsText === 'string') {
      const text = body.ingredientsText.trim();
      if (text) return { kind: 'found', ingredientsText: text };
    }
    // Only an explicit `not-found` verdict (provider payload with no list)
    // is treated as "we checked and there is nothing"; every other state —
    // no key, rate limit, malformed response — is `unavailable` so the UI
    // offers a retry rather than a false "the provider doesn't know it".
    if (body.found === false && body.reason === 'not-found') {
      return { kind: 'not-found' };
    }
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
