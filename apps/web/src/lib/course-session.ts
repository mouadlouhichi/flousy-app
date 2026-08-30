/**
 * Course session — pure logic for the shopping-trip capture flow.
 *
 * Everything here is framework-free and unit-testable: barcode
 * normalization + validation, the session line reducer, deterministic bill
 * rendering, and the product resolution cascade (catalog → remote → manual).
 */
import type { CourseSession, MoneyPlace, Product, SessionItem } from './store';

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

export type BarcodeWarning = 'bad-checksum' | 'unknown-length' | null;

export interface NormalizedBarcode {
  /** Usable barcode (EAN-8, EAN-13, or UPC-A zero-padded to 13) or null. */
  barcode: string | null;
  warning: BarcodeWarning;
}

/**
 * EAN-8 / EAN-13 mod-10 checksum (alternating 1/3 weights from the left,
 * check digit included; valid when the sum is a multiple of 10).
 */
export function barcodeChecksumValid(digits: string): boolean {
  if (!/^[0-9]+$/.test(digits) || (digits.length !== 8 && digits.length !== 13)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/**
 * Normalize a raw scanner/manual input into a usable barcode.
 * Strips spaces and hyphens, keeps digits, pads 12-digit UPC-A to EAN-13.
 * Never throws: bad input yields a warning so the UI can still offer
 * manual entry.
 */
export function normalizeBarcode(raw: string): NormalizedBarcode {
  const digits = (raw || '').replace(/[^0-9]/g, '');
  if (digits.length === 0) return { barcode: null, warning: null };

  if (digits.length === 12) {
    const padded = `0${digits}`;
    return barcodeChecksumValid(padded)
      ? { barcode: padded, warning: null }
      : { barcode: padded, warning: 'bad-checksum' };
  }

  if (digits.length === 8 || digits.length === 13) {
    return barcodeChecksumValid(digits)
      ? { barcode: digits, warning: null }
      : { barcode: digits, warning: 'bad-checksum' };
  }

  return { barcode: null, warning: 'unknown-length' };
}

/** GS1 prefix 611 = Morocco — drives the "Fabriqué au Maroc" badge. */
export function isMoroccanBarcode(barcode: string): boolean {
  return barcode.startsWith('611');
}

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
export function renderBillText(session: CourseSession, opts?: { appName?: string }): string {
  const appName = (opts?.appName ?? 'SMARTJIB').toUpperCase();
  const lines = [
    padStart(`${appName} — COURSE`, 46),
    `${session.date} · ${session.items.length} line${session.items.length === 1 ? '' : 's'} · ${sessionUnits(session)} item${sessionUnits(session) === 1 ? '' : 's'} · ${session.currency}`,
    '-'.repeat(46),
    ...session.items.map((line) =>
      padEnd(line.name, 24) +
      padStart(`${line.qty} × ${line.unitPrice.toFixed(2)}`, 14) +
      padStart(line.lineTotal.toFixed(2), 8),
    ),
    '-'.repeat(46),
    padStart(`TOTAL (${sessionUnits(session)} items)`, 36) + padStart(session.total.toFixed(2), 10),
    `Paid from: ${session.place}`,
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
}

export type ProductResolution =
  | {
      kind: 'found';
      product: { name: string; brand?: string; category?: string; imageUrl?: string };
      /** Last recorded price from the local catalog, when available. */
      lastPrice?: number;
      source: 'catalog' | 'remote';
    }
  | { kind: 'not-found'; barcode: string };

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
 *   2. remote lookup (Open Food Facts) — only for first-time products
 *   3. not-found → the UI offers manual entry with the code attached
 *
 * `lookupRemote` is injected so tests can stub the network; any failure
 * (timeout, network, bad payload) degrades to `not-found`, never to an error.
 */
export async function resolveProduct(opts: {
  barcode: string;
  catalog: Product[];
  lookupRemote?: (barcode: string) => Promise<RemoteProductInfo | null>;
  remoteTimeoutMs?: number;
}): Promise<ProductResolution> {
  const hit = opts.catalog.find((product) => product.barcode === opts.barcode && product.name);
  if (hit) {
    return {
      kind: 'found',
      product: { name: hit.name, brand: hit.brand, category: hit.category, imageUrl: hit.imageUrl },
      lastPrice: hit.lastPrice,
      source: 'catalog',
    };
  }

  if (opts.lookupRemote) {
    try {
      const remote = await withTimeout(opts.lookupRemote(opts.barcode), opts.remoteTimeoutMs ?? 4000);
      if (remote && remote.name) {
        return {
          kind: 'found',
          product: {
            name: remote.name,
            brand: remote.brand,
            category: remote.category,
            imageUrl: remote.imageUrl,
          },
          source: 'remote',
        };
      }
    } catch {
      // timeout / network error → manual entry
    }
  }

  return { kind: 'not-found', barcode: opts.barcode };
}
