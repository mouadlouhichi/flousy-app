/** One bounded, abortable same-origin product lookup client. */

import type { RemoteProductInfo } from './course-session';
import { detectLabelDomain } from './food-knowledge/domain';
import type { ProductDomain, ProductSource } from './store';
import { MAX_INGREDIENT_TEXT_LENGTH } from './ingredient-safety/types';

export const PRODUCT_LOOKUP_FIELDS =
  'code,product_name,product_name_fr,product_name_en,product_name_ar,generic_name,abbreviated_product_name,brands,image_front_url,categories,categories_tags,labels_tags,product_type,quantity,' +
  'ingredients_text,ingredients_text_en,ingredients_text_fr,ingredients_text_es,ingredients_text_ar,' +
  'allergens_tags,nutriscore_grade,nutriscore_score,nutriscore_version,countries_tags,manufacturing_places';

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
  const parts = raw.split(',').map((value) => value.trim()).filter(Boolean);
  return parts.find((part) => !PLACEHOLDER_CATEGORIES.has(part.toLowerCase()));
}

export type LookupDatabase = 'off' | 'obf' | 'opf' | 'opff' | 'vendor' | 'unknown';

function sourceFromDatabase(database: LookupDatabase): ProductSource {
  if (database === 'obf') return 'obf';
  if (database === 'opf') return 'opf';
  if (database === 'opff') return 'opff';
  if (database === 'vendor') return 'vendor';
  return 'off';
}

function defaultDomainForDatabase(database: LookupDatabase): ProductDomain {
  if (database === 'obf') return 'cosmetic';
  if (database === 'opff') return 'pet';
  if (database === 'off') return 'food';
  return 'unknown';
}

export function mapOffProduct(
  data: unknown,
  opts?: { lang?: string; database?: LookupDatabase; sourceUrl?: string; retrievedAt?: string },
): RemoteProductInfo | null {
  const root = data as {
    status?: number;
    found?: boolean;
    product?: Record<string, unknown>;
    lookupSource?: LookupDatabase;
    sourceUrl?: string;
    retrievedAt?: string;
  } | null;
  if (!root?.product || (root.status !== 1 && root.found !== true)) return null;
  const product = root.product;
  const boundedText = (value: unknown, max: number): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed && trimmed.length <= max ? trimmed : undefined;
  };
  const pick = (key: string, max = MAX_INGREDIENT_TEXT_LENGTH): string | undefined =>
    boundedText(product[key], max);

  const language = opts?.lang?.toLowerCase().split('-')[0];
  const nameKeys = [
    ...(language ? [`product_name_${language}`] : []),
    'product_name',
    'product_name_fr',
    'product_name_en',
    'product_name_ar',
    'generic_name',
    'abbreviated_product_name',
  ];
  const name = nameKeys.map((key) => pick(key, 200)).find(Boolean);
  if (!name) return null;

  const brandCandidate = pick('brands', 2_000)?.split(',')[0]?.trim();
  const brand = brandCandidate && brandCandidate.length <= 200 ? brandCandidate : undefined;
  const categoryCandidate = firstRealCategory(pick('categories', 2_000));
  const category = categoryCandidate && categoryCandidate.length <= 200 ? categoryCandidate : undefined;
  const imageUrl = pick('image_front_url', 2_000);
  const quantity = pick('quantity', 100);
  const ingredientsText = [
    ...(language ? [`ingredients_text_${language}`] : []),
    'ingredients_text',
    'ingredients_text_en',
    'ingredients_text_fr',
    'ingredients_text_ar',
    'ingredients_text_es',
  ].map((key) => pick(key, MAX_INGREDIENT_TEXT_LENGTH)).find(Boolean);
  const rawAllergenTags = product.allergens_tags;
  const allergenTags = (() => {
    if (
      !Array.isArray(rawAllergenTags)
      || rawAllergenTags.length > 50
      || rawAllergenTags.some((value) => typeof value !== 'string')
    ) return undefined;
    const tags = (rawAllergenTags as string[]).map((value) => value.trim()).filter(Boolean);
    return tags.every((value) => value.length <= 100) ? tags : undefined;
  })();

  // A raw mapOffProduct call is, by definition, an Open Food Facts payload.
  // Generic/non-food proxy responses carry an explicit lookupSource.
  const database = opts?.database ?? root.lookupSource ??
    (typeof product.lookup_source === 'string' ? product.lookup_source as LookupDatabase : 'off');
  const sourceUrl = boundedText(opts?.sourceUrl, 2_000)
    ?? boundedText(root.sourceUrl, 2_000)
    ?? pick('lookup_source_url', 2_000);
  const retrievedAt = boundedText(opts?.retrievedAt, 64)
    ?? boundedText(root.retrievedAt, 64)
    ?? pick('lookup_retrieved_at', 64)
    ?? new Date().toISOString();
  const source = sourceFromDatabase(database);

  const productType = pick('product_type', 50)?.toLowerCase();
  const declaredDomain = (() => {
    const raw = pick('domain', 20)?.toLowerCase();
    if (raw && ['food', 'cosmetic', 'household', 'pet', 'unknown'].includes(raw)) {
      return raw as ProductDomain;
    }
    if (product.beauty_hint === true || productType === 'beauty' || productType === 'cosmetic') return 'cosmetic';
    if (productType === 'pet' || productType === 'pet-food') return 'pet';
    if (productType === 'household') return 'household';
    if (productType === 'food') return 'food';
    return undefined;
  })();
  const inferred = detectLabelDomain({ domain: declaredDomain, category, name, ingredientsText });
  const domain = inferred === 'unknown' ? defaultDomainForDatabase(database) : inferred;
  const beauty = domain === 'cosmetic';

  const gradeRaw = pick('nutriscore_grade', 8);
  const grade = gradeRaw && /^[a-e]$/i.test(gradeRaw) ? gradeRaw.toLowerCase() : undefined;
  const pointsRaw = product.nutriscore_score;
  const calculationPoints = typeof pointsRaw === 'number'
    && Number.isFinite(pointsRaw)
    && Math.abs(pointsRaw) <= 1_000
    ? pointsRaw
    : undefined;
  const algorithmVersion = pick('nutriscore_version', 80);
  const provenance = {
    name: { source, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}), ...(language ? { language } : {}) },
    ...(brand ? { brand: { source, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}) } } : {}),
    ...(category ? { category: { source, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}) } } : {}),
    ...(ingredientsText ? { ingredientsText: { source, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}) } } : {}),
  } satisfies NonNullable<RemoteProductInfo['provenance']>;

  return {
    name,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(quantity ? { quantity } : {}),
    ...(grade ? { ranking: {
      grade,
      ...(calculationPoints !== undefined ? { calculationPoints } : {}),
      ...(algorithmVersion ? { algorithmVersion } : {}),
    } } : {}),
    ...(ingredientsText ? { ingredientsText } : {}),
    ...(allergenTags?.length ? { allergenTags } : {}),
    domain,
    ...(beauty ? { beauty: true } : {}),
    source,
    ...(sourceUrl ? { sourceUrl } : {}),
    sourceDatabase: database,
    retrievedAt,
    provenance,
  };
}

export type LookupOutcome =
  | { kind: 'found'; product: RemoteProductInfo }
  | { kind: 'not-found' }
  | { kind: 'error'; reason?: 'timeout' | 'aborted' | 'upstream' | 'invalid-response' };

interface LookupRoot {
  status?: number;
  found?: boolean;
  product?: Record<string, unknown>;
  error?: string;
  lookupSource?: LookupDatabase;
  sourceUrl?: string;
  retrievedAt?: string;
}

function combinedSignal(timeoutMs: number, outer?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(Math.max(1, timeoutMs));
  return outer ? AbortSignal.any([outer, timeout]) : timeout;
}

/**
 * The browser makes exactly one same-origin request. The server owns all
 * source racing and shares this deadline through request cancellation.
 */
export async function lookupOffProduct(
  barcode: string,
  opts?: {
    timeoutMs?: number;
    /** Legacy alias; used as the one total timeout. */
    proxyTimeoutMs?: number;
    proxyUrl?: string;
    lang?: string;
    domainHint?: ProductDomain;
    signal?: AbortSignal;
  },
): Promise<LookupOutcome> {
  if (opts?.signal?.aborted) return { kind: 'error', reason: 'aborted' };
  const timeoutMs = opts?.timeoutMs ?? opts?.proxyTimeoutMs ?? 12_000;
  const proxyUrl = opts?.proxyUrl ?? '/api/barcode/lookup';
  const query = new URLSearchParams({ code: barcode });
  if (opts?.lang) query.set('lang', opts.lang);
  if (opts?.domainHint && opts.domainHint !== 'unknown') query.set('domain', opts.domainHint);

  let response: Response;
  try {
    response = await fetch(`${proxyUrl}?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: combinedSignal(timeoutMs, opts?.signal),
    });
  } catch {
    return { kind: 'error', reason: opts?.signal?.aborted ? 'aborted' : 'timeout' };
  }

  let body: LookupRoot;
  try {
    body = (await response.json()) as LookupRoot;
  } catch {
    return { kind: 'error', reason: 'invalid-response' };
  }
  if (response.ok && (body.status === 1 || body.found === true)) {
    const product = mapOffProduct(body, { lang: opts?.lang });
    return product ? { kind: 'found', product } : { kind: 'error', reason: 'invalid-response' };
  }
  if (response.ok && (body.status === 0 || body.found === false) && !body.error) {
    return { kind: 'not-found' };
  }
  return { kind: 'error', reason: 'upstream' };
}
