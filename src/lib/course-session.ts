/**
 * Course session — pure logic for the shopping-trip capture flow.
 *
 * Everything here is framework-free and unit-testable: barcode
 * normalization + validation, the session line reducer, deterministic bill
 * rendering, and the product resolution cascade (catalog → remote → manual).
 */
import type { CourseSession, MoneyPlace, Product, ProductRanking, SessionItem, SessionItemQuality } from './store';
import type { LookupOutcome } from './product-lookup';
import type { ProductAssessment } from './ingredient-safety/types';
import { isAllocatedByGs1Morocco, isValidGtin, parseGtin, type BarcodeSymbology } from './gtin';

/** Round to 2 decimals without float drift (0.1 + 0.2 safe). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** lineTotal = round2(unitPrice × qty), floored at zero. */
export function computeLineTotal(qty: number, unitPrice: number): number {
  return round2(Math.max(0, qty) * Math.max(0, unitPrice));
}

/** session total = round2(Σ lineTotal) — the bill always reads stored values. */
export function computeSessionTotal(items: Pick<SessionItem, 'lineTotal'>[]): number {
  return round2(
    items.reduce((acc, item) => acc + (Number.isFinite(item.lineTotal) ? item.lineTotal : 0), 0),
  );
}

// --- Barcode normalization & validation ---------------------------------------

export type BarcodeWarning = 'bad-checksum' | 'unknown-length' | 'invalid-format' | null;

export interface NormalizedBarcode {
  /** A verified native GTIN (UPC-E is expanded to GTIN-12), or null. */
  barcode: string | null;
  warning: BarcodeWarning;
  gtin14?: string;
}

/** Shared right-aligned GS1 Mod-10 validator for GTIN-8/12/13/14. */
export const barcodeChecksumValid = isValidGtin;

export interface RestrictedCirculationConfig {
  /** Explicit opt-in for one known store/issuer layout. */
  enabled: true;
  issuer: string;
  prefix: string;
  itemStart: number;
  itemLength: number;
  amountStart: number;
  amountLength: number;
  amountDecimals: number;
  currency: string;
}

/** Parse a restricted-circulation amount only under an explicit issuer layout. */
export function parseVariableMeasurePrice(
  barcode: string,
  config?: RestrictedCirculationConfig,
): { itemRef: string; price: number; issuer: string; currency: string; rawAmount: string } | null {
  if (!config?.enabled || !barcodeChecksumValid(barcode) || barcode.length !== 13) return null;
  if (!barcode.startsWith(config.prefix)) return null;
  const dataEnd = barcode.length - 1;
  const itemEnd = config.itemStart + config.itemLength;
  const amountEnd = config.amountStart + config.amountLength;
  if (config.itemStart < 0 || config.amountStart < 0 || itemEnd > dataEnd || amountEnd > dataEnd) return null;
  const itemRef = barcode.slice(config.itemStart, itemEnd);
  const rawAmount = barcode.slice(config.amountStart, amountEnd);
  if (!/^\d+$/.test(itemRef) || !/^\d+$/.test(rawAmount)) return null;
  const divisor = 10 ** Math.max(0, Math.min(6, config.amountDecimals));
  return {
    itemRef,
    price: Number(rawAmount) / divisor,
    issuer: config.issuer,
    currency: config.currency,
    rawAmount,
  };
}

/** Strict compatibility wrapper used by manual fields. Invalid checksums no
 * longer produce a usable barcode. */
export function normalizeBarcode(
  raw: string,
  format?: BarcodeSymbology | string,
): NormalizedBarcode {
  const parsed = parseGtin({ rawValue: raw, format, source: 'manual' });
  if (parsed.ok) {
    return { barcode: parsed.value.gtin, warning: null, gtin14: parsed.value.gtin14 };
  }
  const error = 'error' in parsed ? parsed.error : 'invalid-character';
  if (error === 'empty' || (error === 'invalid-character' && !/\p{Nd}/u.test(raw))) {
    return { barcode: null, warning: null };
  }
  if (error === 'bad-checksum' || error === 'invalid-upce') {
    return { barcode: null, warning: 'bad-checksum' };
  }
  if (error === 'unsupported-length') return { barcode: null, warning: 'unknown-length' };
  return { barcode: null, warning: 'invalid-format' };
}

/** @deprecated Name retained for callers; this means GS1 allocation, not origin. */
export function isMoroccanBarcode(barcode: string): boolean {
  return isAllocatedByGs1Morocco(barcode);
}

export { isAllocatedByGs1Morocco };

// --- Session creation & mutation ----------------------------------------------

/** Deterministic-ish id (time + random tail); injectable for tests. */
export function makeSessionId(now: Date = new Date(), rand: () => number = Math.random): string {
  return `sess_${now.getTime()}_${Math.floor(rand() * 1e6).toString(36)}`;
}

/** Today's YYYY-MM-DD in local time (the trip date). */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createSession(opts: {
  currency: string;
  place: MoneyPlace;
  now?: Date;
  rand?: () => number;
}): CourseSession {
  const now = opts.now ?? new Date();
  return {
    id: makeSessionId(now, opts.rand),
    status: 'active',
    startedAt: now.toISOString(),
    date: localDateKey(now),
    currency: opts.currency,
    place: opts.place,
    items: [],
    total: 0,
  };
}

/** Build a new line; the key is the barcode when present, else generated. */
export function createSessionItem(input: {
  barcode?: string;
  name: string;
  category?: string;
  unitPrice: number;
  qty?: number;
  ranking?: ProductRanking;
  /** Cosmetic quality summary (already scored), when the caller has one. */
  quality?: SessionItemQuality;
  now?: Date;
  rand?: () => number;
}): SessionItem {
  const now = input.now ?? new Date();
  const rand = input.rand ?? Math.random;
  const qty = Math.max(1, Math.round(input.qty ?? 1));
  const unitPrice = round2(Math.max(0, input.unitPrice));
  const hasBarcode = Boolean(input.barcode && input.barcode.length > 0);
  const key = hasBarcode
    ? (input.barcode as string)
    : `row_${now.getTime()}_${Math.floor(rand() * 1e6).toString(36)}`;
  return {
    key,
    ...(hasBarcode ? { barcode: input.barcode as string } : {}),
    name: input.name,
    ...(input.category ? { category: input.category } : {}),
    qty,
    unitPrice,
    lineTotal: computeLineTotal(qty, unitPrice),
    ...(input.ranking ? { ranking: { ...input.ranking } } : {}),
    ...(input.quality ? { quality: { ...input.quality } } : {}),
  };
}

function withTotal(session: CourseSession): CourseSession {
  return { ...session, total: computeSessionTotal(session.items) };
}

/**
 * Append a line — or increment its quantity when the same barcode is
 * scanned again (classic POS behaviour: re-scan = add one).
 */
export function addItemToSession(session: CourseSession, item: SessionItem): CourseSession {
  if (item.barcode) {
    const existing = session.items.find((line) => line.barcode === item.barcode);
    if (existing) {
      const items = session.items.map((line) =>
        line.key === existing.key
          ? { ...line, qty: line.qty + 1, lineTotal: computeLineTotal(line.qty + 1, line.unitPrice) }
          : line,
      );
      return withTotal({ ...session, items });
    }
  }
  return withTotal({ ...session, items: [...session.items, item] });
}

export function setItemQty(session: CourseSession, key: string, qty: number): CourseSession {
  const safeQty = Math.max(1, Math.round(qty));
  const items = session.items.map((line) =>
    line.key === key ? { ...line, qty: safeQty, lineTotal: computeLineTotal(safeQty, line.unitPrice) } : line,
  );
  return withTotal({ ...session, items });
}

export function setItemPrice(session: CourseSession, key: string, unitPrice: number): CourseSession {
  const safePrice = round2(Math.max(0, unitPrice));
  const items = session.items.map((line) =>
    line.key === key ? { ...line, unitPrice: safePrice, lineTotal: computeLineTotal(line.qty, safePrice) } : line,
  );
  return withTotal({ ...session, items });
}

/** Rename a line (manual corrections after the fact). */
export function setItemName(session: CourseSession, key: string, name: string): CourseSession {
  const trimmed = name.trim();
  if (!trimmed) return session;
  const items = session.items.map((line) => (line.key === key ? { ...line, name: trimmed } : line));
  return { ...session, items };
}

export function removeSessionItem(session: CourseSession, key: string): CourseSession {
  return withTotal({ ...session, items: session.items.filter((line) => line.key !== key) });
}

/**
 * Store the cosmetic quality summary on a line (set once the async
 * ingredient analysis resolves after the line was added).
 */
export function setItemQuality(
  session: CourseSession,
  key: string,
  quality: SessionItemQuality,
): CourseSession {
  const items = session.items.map((line) =>
    line.key === key ? { ...line, quality: { ...quality } } : line,
  );
  return { ...session, items };
}

/**
 * Collapse an engine assessment onto the line's quality summary: the 0–100
 * score + band, and the five RiskTiers folded into the chip's three colours
 * (clean → green, watch/restricted → yellow, caution/prohibited → orange).
 * Unrecognized ingredients count in the engine's coverage, not here.
 * Returns null when nothing could be scored (unknown score/band).
 */
export function summarizeQuality(analysis: ProductAssessment): SessionItemQuality {
  // API assessments are JSON data. Snapshot them now so later UI/cache
  // mutation cannot rewrite the evidence displayed on a historical bill.
  const snapshot = JSON.parse(JSON.stringify(analysis)) as ProductAssessment;
  const tiers: NonNullable<SessionItemQuality['tiers']> = {
    clean: 0,
    watch: 0,
    caution: 0,
    restricted: 0,
    prohibited: 0,
    unassessed: 0,
  };
  for (const ingredient of snapshot.ingredients) {
    if (ingredient.tier) tiers[ingredient.tier] += 1;
    else tiers.unassessed += 1;
  }
  return {
    schemaVersion: 2,
    assessmentId: `assessment-${snapshot.assessedAt}-${snapshot.dataset.engineVersion ?? snapshot.dataset.version}`,
    score: snapshot.score,
    scoreStatus: snapshot.scoreStatus,
    band: snapshot.band,
    assessedAt: snapshot.assessedAt,
    form: snapshot.form,
    dataset: { ...snapshot.dataset },
    recognitionCoverage: snapshot.coverage,
    assessmentCoverage: snapshot.assessmentCoverage,
    worstTier: snapshot.worstTier,
    unknownCount: snapshot.unknownIngredients.length,
    tiers,
    assessment: snapshot,
    // Legacy readers only; exact tiers above are authoritative.
    good: tiers.clean,
    caution: tiers.watch,
    concern: tiers.caution,
  };
}

/** Mark the session finished — the document becomes its bill. */
export function completeSession(session: CourseSession, now: Date = new Date()): CourseSession {
  return withTotal({ ...session, status: 'completed', endedAt: now.toISOString() });
}

/** Link the session to the variable expense its total was logged as (idempotent). */
export function markSessionLogged(session: CourseSession, expenseId: string): CourseSession {
  return { ...session, loggedExpenseId: expenseId };
}

// --- Budget logging -------------------------------------------------------------

/** Category names a finished course prefers, in priority order (case-insensitive). */
const COURSE_CATEGORY_CANDIDATES = [
  'Groceries',
  'Courses',
  'Épicerie',
  'Epicerie',
  'Supermarché',
  'Supermarket',
  'Food',
];

/** Used when the month has no active categories at all. */
export const COURSE_FALLBACK_CATEGORY = 'Groceries';

/**
 * Pick the category a finished course is logged under: the first grocery-like
 * category the user actually has, else their first active category, else the
 * built-in default. Never returns an empty string.
 */
export function resolveCourseCategory(categories: readonly string[]): string {
  const list = categories.map((name) => name.trim()).filter(Boolean);
  const lower = list.map((name) => name.toLowerCase());
  for (const candidate of COURSE_CATEGORY_CANDIDATES) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx !== -1) return list[idx];
  }
  return list[0] ?? COURSE_FALLBACK_CATEGORY;
}

export function sessionUnits(session: CourseSession): number {
  return session.items.reduce((acc, line) => acc + line.qty, 0);
}

// --- Bill rendering -------------------------------------------------------------

function padEnd(value: string, width: number): string {
  return value.length >= width ? `${value.slice(0, width - 1)}…` : value + ' '.repeat(width - value.length);
}

function padStart(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}

/**
 * Deterministic plain-text bill (receipt layout, ~46 columns of monospace).
 * Raw number formatting (toFixed(2)) on purpose — identical in every
 * locale, which matters for shared/copied bills.
 */
export interface CourseBillTextLabels {
  course?: string;
  line?: string;
  lines?: string;
  item?: string;
  items?: string;
  total?: string;
  paidFrom?: string;
  place?: string;
  locale?: string;
  date?: string;
}

/**
 * Deterministic plain-text bill for the Copy action. The default remains
 * English for callers outside the interface; the UI supplies localized labels.
 */
export function renderBillText(
  session: CourseSession,
  opts?: { appName?: string; labels?: CourseBillTextLabels },
): string {
  const appName = (opts?.appName ?? 'SMARTJIB').toUpperCase();
  const labels = opts?.labels;
  const unitCount = sessionUnits(session);
  const lineLabel = session.items.length === 1 ? (labels?.line ?? 'line') : (labels?.lines ?? 'lines');
  const itemLabel = unitCount === 1 ? (labels?.item ?? 'item') : (labels?.items ?? 'items');
  const totalLabel = labels?.total ?? 'TOTAL';
  const paidFrom = labels?.paidFrom ?? 'Paid from';
  const place = labels?.place ?? session.place;
  const number = new Intl.NumberFormat(labels?.locale);
  const lines = [
    padStart(`${appName} — ${labels?.course ?? 'COURSE'}`, 46),
    `${labels?.date ?? session.date} · ${number.format(session.items.length)} ${lineLabel} · ${number.format(unitCount)} ${itemLabel} · ${session.currency}`,
    '-'.repeat(46),
    ...session.items.map((line) =>
      padEnd(line.name, 24) +
      padStart(`${number.format(line.qty)} × ${line.unitPrice.toFixed(2)}`, 14) +
      padStart(line.lineTotal.toFixed(2), 8),
    ),
    '-'.repeat(46),
    padStart(`${totalLabel} (${number.format(unitCount)} ${itemLabel})`, 36) + padStart(session.total.toFixed(2), 10),
    `${paidFrom}: ${place}`,
  ];
  return lines.join('\n');
}

/** CSV export of the bill: one row per line item. */
export function renderBillCsv(session: CourseSession): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = [
    ['name', 'barcode', 'qty', 'unit_price', 'line_total'].join(','),
    ...session.items.map((line) =>
      [escape(line.name), line.barcode ?? '', line.qty, line.unitPrice.toFixed(2), line.lineTotal.toFixed(2)].join(','),
    ),
    ['', '', sessionUnits(session), '', session.total.toFixed(2)].join(','),
  ];
  return rows.join('\n');
}

// --- Product resolution cascade ---------------------------------------------------

export interface RemoteProductInfo {
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  quantity?: string;
  ranking?: ProductRanking;
  ingredientsText?: string;
  beauty?: boolean;
  cosmeticForm?: import('./ingredient-safety/types').ProductForm;
  domain?: import('./store').ProductDomain;
  allergenTags?: string[];
  source?: import('./store').ProductSource;
  sourceUrl?: string;
  sourceDatabase?: string;
  retrievedAt?: string;
  provenance?: Record<string, import('./store').ProductFieldProvenance>;
}

export type ProductResolution =
  | {
      kind: 'found';
      product: {
        name: string;
        brand?: string;
        category?: string;
        imageUrl?: string;
        /** Pack size / net content when the source exposes it. */
        quantity?: string;
        /** Quality ranking (Nutri-Score) when the source provides one. */
        ranking?: ProductRanking;
        /**
         * Full INCI list from the record (cosmetics). Persisted to the
         * catalog product when the scanned line is confirmed; the per-device
         * overlay is the offline fallback for records without a list.
         */
        ingredientsText?: string;
        /** Source hint that the record is cosmetic/beauty (see RemoteProductInfo). */
        beauty?: boolean;
      };
      /** Last recorded price from the local catalog, when available. */
      lastPrice?: number;
      source: 'catalog' | 'seed' | 'remote';
    }
  | {
      kind: 'not-found';
      barcode: string;
      /** `lookup-failed` = network/timeout (retry-able); `not-found` = no source knew it. */
      reason: 'not-found' | 'lookup-failed';
      /**
       * Set only for in-store variable-measure codes (leading `2`): the price
       * is printed *inside* the barcode, so even though no catalog knows the
       * product name, the amount is already known and can be prefilled.
       */
      embeddedPrice?: number;
    };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('product lookup timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Resolve a barcode to a product:
 *   1. local catalog (instant, offline)
 *   2. bundled Moroccan seed (instant, offline — common MA products)
 *   3. remote lookup (Open Food Facts) — only for first-time products
 *   4. not-found → the UI offers manual entry with the code attached
 *
 * `lookupSeed` and `lookupRemote` are injected so tests can stub them; any
 * remote failure (timeout, network, bad payload) degrades to `not-found`
 * with `reason: 'lookup-failed'`, never to a thrown error.
 *
 * `remoteTimeoutMs` must cover the whole remote cascade (direct attempt +
 * proxy walk), not just one request — the default below matches
 * `lookupOffProduct`'s own 4s + 14s budgets with margin.
 */
export async function resolveProduct(opts: {
  barcode: string;
  catalog: Product[];
  /** UI language — lets the remote source prefer the matching name field. */
  lang?: string;
  lookupSeed?: (barcode: string) => RemoteProductInfo | null;
  lookupRemote?: (barcode: string, lang?: string) => Promise<LookupOutcome>;
  remoteTimeoutMs?: number;
  restrictedCirculation?: RestrictedCirculationConfig;
}): Promise<ProductResolution> {
  const hit = opts.catalog.find((product) => product.barcode === opts.barcode && product.name);
  if (hit) {
    return {
      kind: 'found',
      product: {
        name: hit.name,
        brand: hit.brand,
        category: hit.category,
        imageUrl: hit.imageUrl,
        ...(hit.ranking ? { ranking: { ...hit.ranking } } : {}),
        ...(hit.ingredientsText ? { ingredientsText: hit.ingredientsText } : {}),
        ...(hit.beauty ? { beauty: true } : {}),
      },
      lastPrice: hit.lastPrice,
      source: 'catalog',
    };
  }

  // In-store variable-measure codes (butcher/cheese scale labels) encode the
  // price inside the barcode and never exist in Open Food Facts, so skip the
  // seed/remote lookups entirely and hand the printed price back for
  // prefilling. The name still has to be typed by the user.
  const variable = parseVariableMeasurePrice(opts.barcode, opts.restrictedCirculation);
  if (variable) {
    return {
      kind: 'not-found',
      barcode: opts.barcode,
      reason: 'not-found',
      embeddedPrice: variable.price,
    };
  }

  const seedHit = opts.lookupSeed?.(opts.barcode);
  if (seedHit && seedHit.name) {
    return {
      kind: 'found',
      product: {
        name: seedHit.name,
        brand: seedHit.brand,
        category: seedHit.category,
        imageUrl: seedHit.imageUrl,
        ...(seedHit.quantity ? { quantity: seedHit.quantity } : {}),
        ...(seedHit.ranking ? { ranking: { ...seedHit.ranking } } : {}),
        ...(seedHit.ingredientsText ? { ingredientsText: seedHit.ingredientsText } : {}),
      },
      source: 'seed',
    };
  }

  if (opts.lookupRemote) {
    try {
      const outcome = await withTimeout(opts.lookupRemote(opts.barcode, opts.lang), opts.remoteTimeoutMs ?? 20000);
      if (outcome.kind === 'found') {
        const remote = outcome.product;
        if (remote.name) {
          return {
            kind: 'found',
            product: {
              name: remote.name,
              brand: remote.brand,
              category: remote.category,
              imageUrl: remote.imageUrl,
              ...(remote.quantity ? { quantity: remote.quantity } : {}),
              ...(remote.ranking ? { ranking: { ...remote.ranking } } : {}),
              ...(remote.ingredientsText ? { ingredientsText: remote.ingredientsText } : {}),
              ...(remote.beauty ? { beauty: true } : {}),
            },
            source: 'remote',
          };
        }
      } else if (outcome.kind === 'error') {
        // transient failure (network / timeout / upstream) → retry-able miss,
        // NOT a claim that the product does not exist
        return { kind: 'not-found', barcode: opts.barcode, reason: 'lookup-failed' };
      }
      // `not-found` falls through to the final return below
    } catch {
      // timeout / thrown error → surface as a retry-able miss
      return { kind: 'not-found', barcode: opts.barcode, reason: 'lookup-failed' };
    }
  }

  return { kind: 'not-found', barcode: opts.barcode, reason: 'not-found' };
}
