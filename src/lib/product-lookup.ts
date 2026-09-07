/**
 * Open Food Facts / Open Beauty Facts barcode lookup (client side).
 *
 * Tries the OFF world API directly from the browser (the fast path when OFF
 * is reachable from this network); when that yields no product it falls back
 * to the app's own `/api/barcode/lookup` proxy, which walks every instance
 * (world, Morocco, beauty, products) server-side. All payloads go through
 * the single `mapOffProduct` mapper, and the outcome distinguishes a
 * definitive "no such product" from a transient "no answer" (see
 * `LookupOutcome`) so a cold/overloaded first scan is retryable instead of
 * a misleading "not found".
 *
 * Cosmetics: beauty/product records carry their INCI list in the
 * `ingredients_text*` fields, which the mapper exposes as `ingredientsText`
 * so a first-time scan can score the label locally. When the configured
 * vendor key is present the proxy also fills an INCI-less cosmetics record
 * and can synthesize a vendor-only product — the proxy stays the single
 * place that ever touches the vendor. Privacy: only the barcode digits
 * leave the device — never user data.
 */
import type { RemoteProductInfo } from './course-session';

const OFF_HOSTS: ReadonlyArray<{ base: string; beauty: boolean }> = [
  { base: 'https://world.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://ma-fr.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://ma.openfoodfacts.org/api/v2/product/', beauty: false },
  { base: 'https://world.openbeautyfacts.org/api/v2/product/', beauty: true },
  { base: 'https://fr.openbeautyfacts.org/api/v2/product/', beauty: true },
  { base: 'https://world.openproductsfacts.org/api/v2/product/', beauty: true },
];
const FIELDS =
  'code,product_name,product_name_fr,product_name_en,generic_name,brands,image_front_url,categories,quantity,' +
  'ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_es,ingredients_text_ar,' +
  'nutriscore_grade,nutriscore_score';

/**
 * Placeholder tags OFF attaches to products filed under the wrong database
 * (or pending proper categorization) — "Incorrect product type,
 * non-food-products, open-beauty-facts" for a shower gel is not useful UI
 * copy, so the first REAL category wins and all-placeholder lists yield
 * no category at all.
 */
const PLACEHOLDER_CATEGORIES = new Set([
  'incorrect product type',
  'non-food-products',
  'open-food-facts',
  'open-beauty-facts',
  'open-products-facts',
  'no nutrition facts',
]);

function firstRealCategory(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (!PLACEHOLDER_CATEGORIES.has(part.toLowerCase())) return part;
  }
  return undefined;
}

/**
 * Map an OFF v2 product payload to our fields. Accepts both the raw OFF
 * shape (`{ status: 1, product }`) and the app-proxy shape
 * (`{ found: true, product }`) — historically the proxy only returned
 * `found`, which made every proxied lookup read as "not found".
 *
 * Name field: the first non-empty of the UI-language name
 * (`product_name_<lang>` when a lang is given), then the default
 * `product_name`, then the other language variants, then the generic name.
 * OFF's `product_name` is whatever language was entered first (for a
 * Moroccan shower gel that was a code-like "68YN5T 400ml" while the French
 * name "utra doux avocat" sat unused in `product_name_fr`).
 */
export function mapOffProduct(data: unknown, opts?: { lang?: string }): RemoteProductInfo | null {
  const root = data as
    | { status?: number; found?: boolean; product?: Record<string, unknown> }
    | null
    | undefined;
  if (!root || !root.product) return null;
  const ok = root.status === 1 || root.found === true;
  if (!ok) return null;
  const p = root.product;

  const pick = (key: string): string | undefined => {
    const value = p[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };

  const nameKeys = ['product_name', 'product_name_fr', 'product_name_en', 'product_name_ar', 'generic_name', 'abbreviated_product_name'];
  if (opts?.lang) {
    const own = `product_name_${opts.lang}`;
    const idx = nameKeys.indexOf(own);
    if (idx !== -1 && idx !== 0) {
      // The UI-language name takes priority over the default product_name
      nameKeys.splice(idx, 1);
      nameKeys.splice(0, 0, own);
    }
  }
  let name: string | undefined;
  for (const key of nameKeys) {
    name = pick(key);
    if (name) break;
  }
  if (!name) return null;

  const brands = pick('brands')?.split(',')[0]?.trim();
  const category = firstRealCategory(pick('categories'));
  const imageUrl = pick('image_front_url');
  const quantity = pick('quantity');
  const ingredientsText = [
    'ingredients_text',
    'ingredients_text_en',
    'ingredients_text_fr',
    'ingredients_text_es',
    'ingredients_text_ar',
  ]
    .map((key) => pick(key))
    .find((v): v is string => Boolean(v));

  // Nutri-Score ranking: only the real letter grades (a–e) are surfaced. OFF
  // also emits 'not-applicable' / 'unknown' / 'not-computed', which must never
  // render as a grade chip.
  const gradeRaw = pick('nutriscore_grade');
  const grade = gradeRaw && /^[a-eA-E]$/.test(gradeRaw) ? gradeRaw.toLowerCase() : undefined;
  const scoreRaw = p.nutriscore_score;
  const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : undefined;

  return {
    name,
    ...(brands ? { brand: brands } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
    ...(grade ? { ranking: { grade, ...(score !== undefined ? { score } : {}) } } : {}),
    ...(ingredientsText ? { ingredientsText } : {}),
  };
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Like `fetchJson` but keeps the HTTP status, so the caller can tell a
    definitive "no such product" (200 + status 0) apart from a transient
    failure (timeout, 429, 502, …) — null means "no answer at all". */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Outcome of a remote lookup.
 *  - `found` — a source answered with the product.
 *  - `not-found` — a source definitively answered "no such product".
 *  - `error` — no answer could be obtained (network, timeout, upstream
 *    failure). The UI must offer a retry, not pretend the product does not
 *    exist — a cold/overloaded first lookup previously surfaced as a false
 *    "not found" that a re-scan immediately contradicted.
 */
export type LookupOutcome =
  | { kind: 'found'; product: RemoteProductInfo }
  | { kind: 'not-found' }
  | { kind: 'error' };

interface OffRoot {
  status?: number;
  found?: boolean;
  product?: Record<string, unknown>;
  error?: string;
}

/**
 * Look up a barcode on Open Food Facts, then via the app proxy.
 *
 * Budgets: the direct world attempt is a fast path (4s); the proxy gets 14s,
 * covering its own 12s request deadline plus cold-start headroom. (An earlier
 * 4s proxy timeout aborted the first lookup on every cold edge function, so
 * the very first scan of a session often read as "not found" and the
 * re-scan — with a warm function — succeeded.)
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: { directTimeoutMs?: number; proxyTimeoutMs?: number; proxyUrl?: string; lang?: string },
): Promise<LookupOutcome> {
  const directTimeoutMs = opts?.directTimeoutMs ?? 4000;
  const proxyTimeoutMs = opts?.proxyTimeoutMs ?? 14000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';

  // 1) direct from the browser — the fast path when OFF is reachable from
  //    this network. Only the world instance is tried client-side: the MA
  //    and beauty/products instances are walked server-side by the proxy, so
  //    the client never burns 20s on dead-end fetches before the fallback.
  //    A direct `status: 0` is NOT final — another instance may know the
  //    code — it just falls through to the proxy.
  const direct = await fetchJson(`${OFF_HOSTS[0].base}${barcode}.json?fields=${FIELDS}`, directTimeoutMs);
  const mapped = direct ? mapOffProduct(direct, { lang: opts?.lang }) : null;
  if (mapped) return { kind: 'found', product: mapped };

  // 2) through the app proxy — the authoritative multi-host walk.
  const res = await fetchWithTimeout(`${proxyUrl}?code=${encodeURIComponent(barcode)}`, proxyTimeoutMs);
  if (!res) return { kind: 'error' };

  let body: OffRoot | null = null;
  try {
    body = (await res.json()) as OffRoot;
  } catch {
    return { kind: 'error' };
  }

  if (res.status === 200 && body && (body.status === 1 || body.found === true)) {
    const product = mapOffProduct(body, { lang: opts?.lang });
    if (product) return { kind: 'found', product };
    return { kind: 'not-found' };
  }
  if (res.status === 200 && body && (body.status === 0 || body.found === false) && !body.error) {
    return { kind: 'not-found' };
  }
  // 400/403/429 (invalid, blocked, rate-limited), 502 (upstream walk failed),
  // or a malformed body — none of these is evidence about the product.
  return { kind: 'error' };
}
