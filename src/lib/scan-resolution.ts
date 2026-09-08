/** Unified barcode canonicalization and product-resolution orchestrator. */

import { detectLabelDomain } from './food-knowledge/domain';
import { parseGtin, gtinIdentity, type BarcodeCandidate, type CanonicalGtin, type GtinErrorCode } from './gtin';
import type { LookupOutcome } from './product-lookup';
import type { RemoteProductInfo, RestrictedCirculationConfig } from './course-session';
import { parseVariableMeasurePrice } from './course-session';
import type { Product, ProductDomain, ProductFieldProvenance, ProductSource } from './store';

const DEFAULT_DEADLINE_MS = 12_000;
const CATALOG_FRESH_MS = 7 * 24 * 60 * 60_000;

export interface ResolvedProduct extends RemoteProductInfo {
  barcode: string;
  gtin14: string;
  name: string;
  domain: ProductDomain;
  domainSource: 'source' | 'inferred' | 'user';
  source: ProductSource;
  retrievedAt: string;
  staleAfter: string;
  provenance: Record<string, ProductFieldProvenance>;
}

export type ScanResolution =
  | { kind: 'invalid'; candidate: BarcodeCandidate; error: GtinErrorCode }
  | {
      kind: 'found';
      canonical: CanonicalGtin;
      product: ResolvedProduct;
      source: 'catalog' | 'seed' | 'remote';
      stale: boolean;
      /** Stale-while-revalidate update. Consumers must bind it to request ID. */
      revalidate?: Promise<ResolvedProduct | null>;
    }
  | {
      kind: 'restricted-circulation';
      canonical: CanonicalGtin;
      issuer: string;
      currency: string;
      itemRef: string;
      rawAmount: string;
      amount: number;
      requiresConfirmation: true;
    }
  | {
      kind: 'not-found';
      canonical: CanonicalGtin;
      reason: 'not-found' | 'lookup-failed' | 'aborted';
    };

function freshUntil(retrievedAt: string): string {
  const base = Date.parse(retrievedAt);
  return new Date((Number.isFinite(base) ? base : Date.now()) + CATALOG_FRESH_MS).toISOString();
}

function productToRemote(product: Product): RemoteProductInfo {
  return {
    name: product.name,
    ...(product.brand ? { brand: product.brand } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
    ...(product.quantity ? { quantity: product.quantity } : {}),
    ...(product.ranking ? { ranking: { ...product.ranking } } : {}),
    ...(product.ingredientsText ? { ingredientsText: product.ingredientsText } : {}),
    ...(product.beauty ? { beauty: true } : {}),
    ...(product.cosmeticForm ? { cosmeticForm: product.cosmeticForm } : {}),
    ...(product.domain ? { domain: product.domain } : {}),
    ...(product.allergenTags ? { allergenTags: [...product.allergenTags] } : {}),
    source: product.source,
    ...(product.sourceUrl ? { sourceUrl: product.sourceUrl } : {}),
    ...(product.sourceDatabase ? { sourceDatabase: product.sourceDatabase } : {}),
    retrievedAt: product.retrievedAt ?? product.updatedAt,
    ...(product.provenance ? { provenance: { ...product.provenance } } : {}),
  };
}

function sourceProvenance(source: ProductSource, retrievedAt: string, sourceUrl?: string): ProductFieldProvenance {
  return { source, retrievedAt, ...(sourceUrl ? { sourceUrl } : {}) };
}

function domainFor(
  remote: RemoteProductInfo,
  override?: ProductDomain,
): { domain: ProductDomain; source: ResolvedProduct['domainSource'] } {
  // `undefined` means no user decision. `unknown` is itself an explicit and
  // persistable decision, not a sentinel that authorizes inference.
  if (override !== undefined) return { domain: override, source: 'user' };
  if (remote.domain && remote.domain !== 'unknown') return { domain: remote.domain, source: 'source' };
  return {
    domain: detectLabelDomain({
      category: remote.category,
      name: remote.name,
      ingredientsText: remote.ingredientsText,
    }),
    source: 'inferred',
  };
}

function materialize(
  canonical: CanonicalGtin,
  remote: RemoteProductInfo,
  source: ProductSource,
  override?: ProductDomain,
): ResolvedProduct {
  const retrievedAt = remote.retrievedAt ?? new Date().toISOString();
  const domain = domainFor(remote, override);
  const baseProvenance = sourceProvenance(source, retrievedAt, remote.sourceUrl);
  return {
    ...remote,
    barcode: canonical.gtin,
    gtin14: canonical.gtin14,
    name: remote.name,
    domain: domain.domain,
    domainSource: domain.source,
    source,
    retrievedAt,
    staleAfter: freshUntil(retrievedAt),
    provenance: {
      name: baseProvenance,
      ...(remote.brand ? { brand: baseProvenance } : {}),
      ...(remote.category ? { category: baseProvenance } : {}),
      ...(remote.imageUrl ? { imageUrl: baseProvenance } : {}),
      ...(remote.quantity ? { quantity: baseProvenance } : {}),
      ...(remote.ingredientsText ? { ingredientsText: baseProvenance } : {}),
      ...(remote.ranking ? { ranking: baseProvenance } : {}),
      ...(remote.allergenTags ? { allergenTags: baseProvenance } : {}),
      ...(remote.provenance ?? {}),
    },
  };
}

function isManualProvenance(value: ProductFieldProvenance | undefined): boolean {
  return value?.source === 'manual';
}

/** Merge a refresh without replacing explicit user corrections with stale or
 * provider text. Remote data still fills gaps and updates provider-owned fields. */
export function mergeResolvedProduct(
  baseline: ResolvedProduct,
  refresh: ResolvedProduct,
  domainOverride?: ProductDomain,
): ResolvedProduct {
  const fields = ['name', 'brand', 'category', 'imageUrl', 'quantity', 'ingredientsText', 'cosmeticForm', 'ranking', 'allergenTags'] as const;
  const merged: ResolvedProduct = {
    ...baseline,
    retrievedAt: refresh.retrievedAt,
    staleAfter: refresh.staleAfter,
    provenance: { ...baseline.provenance },
  };
  for (const field of fields) {
    const incoming = refresh[field];
    if (incoming === undefined || incoming === null || incoming === '') continue;
    if (isManualProvenance(baseline.provenance[field])) continue;
    Object.assign(merged, { [field]: Array.isArray(incoming) ? [...incoming] : incoming });
    const provenance = refresh.provenance[field];
    if (provenance) merged.provenance[field] = provenance;
  }
  if (domainOverride !== undefined) {
    merged.domain = domainOverride;
    merged.domainSource = 'user';
  } else if (baseline.domainSource !== 'user' && refresh.domain !== 'unknown') {
    merged.domain = refresh.domain;
    merged.domainSource = refresh.domainSource;
  }
  merged.beauty = merged.domain === 'cosmetic' || undefined;
  return merged;
}

function catalogMatch(catalog: readonly Product[], gtin14: string): Product | undefined {
  return catalog.find((product) => (product.gtin14 ?? gtinIdentity(product.barcode)) === gtin14 && product.name.trim());
}

function isStale(product: Product, now: number): boolean {
  if (product.staleAfter) return Date.parse(product.staleAfter) <= now;
  const retrieved = product.retrievedAt ?? product.updatedAt;
  return !retrieved || now - Date.parse(retrieved) >= CATALOG_FRESH_MS;
}

export interface ResolveScanOptions {
  candidate: BarcodeCandidate;
  catalog: readonly Product[];
  lang?: string;
  domainOverride?: ProductDomain;
  domainHint?: ProductDomain;
  lookupSeed?: (barcode: string) => RemoteProductInfo | null;
  lookupRemote?: (
    barcode: string,
    options: { lang?: string; domainHint?: ProductDomain; signal: AbortSignal; timeoutMs: number },
  ) => Promise<LookupOutcome>;
  restrictedCirculation?: RestrictedCirculationConfig;
  signal?: AbortSignal;
  timeoutMs?: number;
  now?: Date;
}

export async function resolveScan(options: ResolveScanOptions): Promise<ScanResolution> {
  const parsed = parseGtin(options.candidate);
  if (!parsed.ok) {
    const error = 'error' in parsed ? parsed.error : 'invalid-character';
    return { kind: 'invalid', candidate: options.candidate, error };
  }
  const canonical = parsed.value;
  if (options.signal?.aborted) return { kind: 'not-found', canonical, reason: 'aborted' };

  const restricted = parseVariableMeasurePrice(canonical.gtin, options.restrictedCirculation);
  if (restricted) {
    return {
      kind: 'restricted-circulation',
      canonical,
      issuer: restricted.issuer,
      currency: restricted.currency,
      itemRef: restricted.itemRef,
      rawAmount: restricted.rawAmount,
      amount: restricted.price,
      requiresConfirmation: true,
    };
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_DEADLINE_MS;
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  const now = options.now?.getTime() ?? Date.now();
  const cached = catalogMatch(options.catalog, canonical.gtin14);
  const seed = options.lookupSeed?.(canonical.lookupCode) ?? null;

  const fetchRemote = async (baseline?: ResolvedProduct): Promise<ResolvedProduct | null> => {
    if (!options.lookupRemote || signal.aborted) return null;
    const outcome = await options.lookupRemote(canonical.lookupCode, {
      ...(options.lang ? { lang: options.lang } : {}),
      ...(options.domainHint ? { domainHint: options.domainHint } : {}),
      signal,
      timeoutMs,
    });
    if (outcome.kind !== 'found') return null;
    const source = outcome.product.source ?? 'off';
    const resolved = materialize(canonical, outcome.product, source, options.domainOverride);
    return baseline ? mergeResolvedProduct(baseline, resolved, options.domainOverride) : resolved;
  };

  if (cached) {
    const materialized = materialize(canonical, productToRemote(cached), cached.source, options.domainOverride);
    // RemoteProductInfo intentionally does not carry local edit metadata, so
    // restore the persisted domain decision after materializing a catalog row.
    const baseline: ResolvedProduct = options.domainOverride === undefined && cached.domainSource
      ? {
          ...materialized,
          ...(cached.domain ? { domain: cached.domain } : {}),
          domainSource: cached.domainSource,
        }
      : materialized;
    const stale = isStale(cached, now);
    return {
      kind: 'found',
      canonical,
      product: baseline,
      source: 'catalog',
      stale,
      ...(stale && options.lookupRemote ? { revalidate: fetchRemote(baseline) } : {}),
    };
  }

  if (seed?.name) {
    const baseline = materialize(canonical, seed, seed.source ?? 'seed', options.domainOverride);
    return {
      kind: 'found',
      canonical,
      product: baseline,
      source: 'seed',
      stale: true,
      ...(options.lookupRemote ? { revalidate: fetchRemote(baseline) } : {}),
    };
  }

  if (!options.lookupRemote) return { kind: 'not-found', canonical, reason: 'not-found' };
  try {
    const outcome = await options.lookupRemote(canonical.lookupCode, {
      ...(options.lang ? { lang: options.lang } : {}),
      ...(options.domainHint ? { domainHint: options.domainHint } : {}),
      signal,
      timeoutMs,
    });
    if (outcome.kind === 'found') {
      const product = materialize(
        canonical,
        outcome.product,
        outcome.product.source ?? 'off',
        options.domainOverride,
      );
      return { kind: 'found', canonical, product, source: 'remote', stale: false };
    }
    if (outcome.kind === 'not-found') return { kind: 'not-found', canonical, reason: 'not-found' };
    return { kind: 'not-found', canonical, reason: outcome.reason === 'aborted' ? 'aborted' : 'lookup-failed' };
  } catch {
    return { kind: 'not-found', canonical, reason: signal.aborted ? 'aborted' : 'lookup-failed' };
  }
}
