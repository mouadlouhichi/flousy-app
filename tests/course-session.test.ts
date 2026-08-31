import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  round2,
  computeLineTotal,
  computeSessionTotal,
  barcodeChecksumValid,
  normalizeBarcode,
  isMoroccanBarcode,
  createSession,
  createSessionItem,
  addItemToSession,
  setItemQty,
  setItemPrice,
  setItemName,
  removeSessionItem,
  completeSession,
  sessionUnits,
  renderBillText,
  renderBillCsv,
  resolveProduct,
  resolveCourseCategory,
  markSessionLogged,
  COURSE_FALLBACK_CATEGORY,
} from '../src/lib/course-session';
import type { Product } from '../src/lib/store';
import {
  courseBillImageFilename,
  renderCourseBillImageSvg,
  svgToImageDataUrl,
} from '../src/lib/course-bill-image';

const MA_PRODUCT: Product = {
  barcode: '6111246721261',
  name: 'Fromage blanc nature 500g',
  brand: 'Milky Food',
  category: 'Fromages',
  lastPrice: 12.9,
  source: 'off',
  origin: 'MA',
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

const NOW = new Date(2026, 7, 30, 18, 30, 0); // local 2026-08-30

function makeSession() {
  return createSession({ currency: 'MAD', place: 'bank', now: NOW, rand: () => 0.5 });
}

function makeItem(partial: { barcode?: string; name: string; unitPrice: number; qty?: number }) {
  return createSessionItem({ ...partial, now: NOW, rand: () => 0.25 });
}

// --- Rounding & totals -----------------------------------------------------------

describe('rounding', () => {
  it('rounds half cents without float drift', () => {
    assert.equal(round2(0.1 + 0.2), 0.3);
    assert.equal(round2(2.675), 2.68);
    assert.equal(round2(57.5), 57.5);
  });

  it('line total = round2(unitPrice * qty)', () => {
    assert.equal(computeLineTotal(2, 17), 34);
    assert.equal(computeLineTotal(3, 0.07), 0.21);
    assert.equal(computeLineTotal(3, 33.33), 99.99);
    assert.equal(computeLineTotal(1, 0.1), 0.1);
  });

  it('floors negative inputs at zero', () => {
    assert.equal(computeLineTotal(-1, 10), 0);
    assert.equal(computeLineTotal(1, -10), 0);
  });

  it('session total = round2(sum of line totals)', () => {
    assert.equal(computeSessionTotal([{ lineTotal: 34 }, { lineTotal: 8 }, { lineTotal: 15.5 }]), 57.5);
    assert.equal(computeSessionTotal([]), 0);
    assert.equal(computeSessionTotal([{ lineTotal: 0.1 }, { lineTotal: 0.2 }]), 0.3);
  });
});

// --- Barcode normalization & checksum --------------------------------------------

describe('barcodeChecksumValid', () => {
  it('accepts valid EAN-13 codes', () => {
    assert.equal(barcodeChecksumValid('3017620422003'), true); // Nutella FR
    assert.equal(barcodeChecksumValid('6111246721261'), true); // Moroccan product
  });

  it('accepts a valid EAN-8 code', () => {
    assert.equal(barcodeChecksumValid('96385078'), true);
  });

  it('rejects corrupted check digits', () => {
    assert.equal(barcodeChecksumValid('3017620422004'), false);
    assert.equal(barcodeChecksumValid('6111246721262'), false);
  });

  it('rejects wrong lengths and non-digits', () => {
    assert.equal(barcodeChecksumValid('1234567'), false);
    assert.equal(barcodeChecksumValid('123456789'), false);
    assert.equal(barcodeChecksumValid('301762a422003'), false);
    assert.equal(barcodeChecksumValid(''), false);
  });
});

describe('normalizeBarcode', () => {
  it('keeps a clean EAN-13 as-is', () => {
    assert.deepEqual(normalizeBarcode('6111246721261'), { barcode: '6111246721261', warning: null });
  });

  it('strips spaces and hyphens', () => {
    assert.equal(normalizeBarcode(' 611 124 672 126 1 ').barcode, '6111246721261');
    assert.equal(normalizeBarcode('611-1246-7212-61').barcode, '6111246721261');
  });

  it('pads 12-digit UPC-A to EAN-13', () => {
    const result = normalizeBarcode('012345678905');
    assert.equal(result.barcode, '0012345678905');
    assert.equal(result.warning, null);
  });

  it('flags a bad checksum but keeps the code for manual entry', () => {
    const result = normalizeBarcode('6111246721262');
    assert.equal(result.barcode, '6111246721262');
    assert.equal(result.warning, 'bad-checksum');
  });

  it('flags unknown lengths', () => {
    assert.deepEqual(normalizeBarcode('12345'), { barcode: null, warning: 'unknown-length' });
    assert.deepEqual(normalizeBarcode('1234567890123456'), { barcode: null, warning: 'unknown-length' });
  });

  it('handles empty / non-digit input', () => {
    assert.deepEqual(normalizeBarcode(''), { barcode: null, warning: null });
    assert.deepEqual(normalizeBarcode('abc'), { barcode: null, warning: null });
  });
});

describe('isMoroccanBarcode', () => {
  it('detects the GS1 Morocco prefix 611', () => {
    assert.equal(isMoroccanBarcode('6111246721261'), true);
    assert.equal(isMoroccanBarcode('6110000000000'), true);
    assert.equal(isMoroccanBarcode('3017620422003'), false);
    assert.equal(isMoroccanBarcode('6110'), true); // prefix only
  });
});

// --- Session lifecycle --------------------------------------------------------------

describe('createSession', () => {
  it('creates an empty active session with today\u2019s local date', () => {
    const session = makeSession();
    assert.equal(session.status, 'active');
    assert.equal(session.date, '2026-08-30');
    assert.equal(session.currency, 'MAD');
    assert.equal(session.place, 'bank');
    assert.deepEqual(session.items, []);
    assert.equal(session.total, 0);
    assert.equal(session.endedAt, undefined);
    assert.ok(session.id.startsWith('sess_'));
  });

  it('produces distinct ids for distinct inputs', () => {
    const a = createSession({ currency: 'MAD', place: 'bank', now: NOW, rand: () => 0.1 });
    const b = createSession({ currency: 'MAD', place: 'bank', now: NOW, rand: () => 0.9 });
    assert.notEqual(a.id, b.id);
  });
});

describe('createSessionItem', () => {
  it('uses the barcode as the line key when present', () => {
    const item = makeItem({ barcode: '6111246721261', name: 'Fromage', unitPrice: 12.9 });
    assert.equal(item.key, '6111246721261');
    assert.equal(item.qty, 1);
    assert.equal(item.lineTotal, 12.9);
  });

  it('generates a row key for name-only items', () => {
    const item = makeItem({ name: 'Tomates', unitPrice: 5 });
    assert.ok(item.key.startsWith('row_'));
    assert.equal(item.barcode, undefined);
  });

  it('clamps quantity to at least 1 and price to non-negative', () => {
    const item = createSessionItem({ name: 'X', unitPrice: -3, qty: 0, now: NOW, rand: () => 0 });
    assert.equal(item.qty, 1);
    assert.equal(item.unitPrice, 0);
    assert.equal(item.lineTotal, 0);
  });
});

describe('addItemToSession', () => {
  it('appends a new line and updates the total', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: '1', name: 'Lait', unitPrice: 17 }));
    assert.equal(session.items.length, 1);
    assert.equal(session.total, 17);
  });

  it('re-scanning the same barcode increments quantity (POS behaviour)', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: '6111246721261', name: 'Fromage', unitPrice: 12.9 }));
    session = addItemToSession(session, makeItem({ barcode: '6111246721261', name: 'Fromage', unitPrice: 99 }));
    assert.equal(session.items.length, 1);
    assert.equal(session.items[0].qty, 2);
    // price from the FIRST scan is preserved
    assert.equal(session.items[0].unitPrice, 12.9);
    assert.equal(session.items[0].lineTotal, 25.8);
    assert.equal(session.total, 25.8);
  });

  it('keeps name-only items as separate lines', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Tomates', unitPrice: 5 }));
    session = addItemToSession(session, makeItem({ name: 'Tomates', unitPrice: 5 }));
    assert.equal(session.items.length, 2);
  });
});

describe('line mutations', () => {
  it('setItemQty recomputes the line and session totals (min 1)', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: 'a', name: 'Lait', unitPrice: 17 }));
    session = setItemQty(session, 'a', 3);
    assert.equal(session.items[0].lineTotal, 51);
    assert.equal(session.total, 51);
    session = setItemQty(session, 'a', -5);
    assert.equal(session.items[0].qty, 1);
    assert.equal(session.items[0].lineTotal, 17);
  });

  it('setItemPrice recomputes with rounding', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: 'a', name: 'Lait', unitPrice: 17 }));
    session = setItemPrice(session, 'a', 0.07);
    assert.equal(session.items[0].unitPrice, 0.07);
    session = setItemQty(session, 'a', 3);
    assert.equal(session.items[0].lineTotal, 0.21);
    assert.equal(session.total, 0.21);
  });

  it('setItemName trims and ignores blank names', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: 'a', name: 'Lait', unitPrice: 1 }));
    session = setItemName(session, 'a', '  Lait entier  ');
    assert.equal(session.items[0].name, 'Lait entier');
    session = setItemName(session, 'a', '   ');
    assert.equal(session.items[0].name, 'Lait entier');
  });

  it('removeSessionItem drops the line and its total', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: 'a', name: 'Lait', unitPrice: 10 }));
    session = addItemToSession(session, makeItem({ barcode: 'b', name: 'Pain', unitPrice: 8 }));
    assert.equal(session.total, 18);
    session = removeSessionItem(session, 'a');
    assert.equal(session.items.length, 1);
    assert.equal(session.total, 8);
  });
});

describe('completeSession', () => {
  it('marks the session completed with endedAt and keeps the total', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Lait', unitPrice: 12.5 }));
    session = completeSession(session, NOW);
    assert.equal(session.status, 'completed');
    assert.equal(session.endedAt, NOW.toISOString());
    assert.equal(session.total, 12.5);
  });
});

// --- Bill rendering ------------------------------------------------------------------

describe('renderBillText', () => {
  it('renders a deterministic 46-column receipt', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Lait 1L', unitPrice: 17, qty: 2 }));
    session = addItemToSession(session, makeItem({ name: 'Pain', unitPrice: 8 }));
    session = addItemToSession(session, makeItem({ name: 'Oeufs x6', unitPrice: 15.5 }));
    session = completeSession(session, NOW);

    const bill = renderBillText(session);
    const lines = bill.split('\n');

    assert.equal(lines.length, 9);
    assert.equal(lines[0].trim(), 'SMARTJIB — COURSE');
    assert.ok(lines[0].endsWith('SMARTJIB — COURSE'));
    assert.equal(lines[1], '2026-08-30 · 3 lines · 4 items · MAD');
    assert.equal(lines[2], '-'.repeat(46));
    assert.ok(lines[3].startsWith('Lait 1L'));
    assert.ok(lines[3].includes('2 × 17.00'));
    assert.ok(lines[3].endsWith('34.00'));
    assert.ok(lines[4].endsWith('8.00'));
    assert.ok(lines[5].endsWith('15.50'));
    assert.equal(lines[6], '-'.repeat(46));
    assert.ok(lines[7].includes('TOTAL (4 items)'));
    assert.ok(lines[7].endsWith('57.50'));
    assert.equal(lines[8], 'Paid from: bank');
    // monospace alignment: every line is at most 46 chars wide
    for (const line of lines) assert.ok(line.length <= 46, `line too long: "${line}" (${line.length})`);
  });

  it('truncates long names but keeps the grid width', () => {
    let session = makeSession();
    session = addItemToSession(
      session,
      makeItem({ name: 'Un produit vraiment très très long pour le test', unitPrice: 1 }),
    );
    const lines = renderBillText(session).split('\n');
    assert.equal(lines[3].length, 46);
    assert.ok(lines[3].includes('…'));
  });

  it('is deterministic across calls and honours the app name', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Milk', unitPrice: 12.5 }));
    assert.equal(renderBillText(session), renderBillText(session));
    const branded = renderBillText(session, { appName: 'smartjib' });
    assert.ok(branded.split('\n')[0].trim().startsWith('SMARTJIB'));
  });

  it('singles render as "1 line" / "1 item"', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Milk', unitPrice: 12.5 }));
    assert.equal(renderBillText(session).split('\n')[1], '2026-08-30 · 1 line · 1 item · MAD');
  });
});

describe('renderCourseBillImageSvg', () => {
  it('encodes the SVG as a data: URL (CSP img-src allows data:, not blob:)', () => {
    const url = svgToImageDataUrl('<svg><text>Pain & <lait> "spécial"</text></svg>');
    assert.ok(url.startsWith('data:image/svg+xml;charset=utf-8,'));
    assert.ok(!url.includes('<'));
    assert.ok(!url.includes('#'));
    assert.ok(!url.startsWith('blob:'));
  });

  it('renders the same course as a self-contained, escaped visual receipt', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Pain & <jam>', unitPrice: 8, qty: 2 }));
    session = completeSession(session, NOW);

    const image = renderCourseBillImageSvg(session, {
      title: 'Course bill',
      items: 'items',
      total: 'Total',
      paidFrom: 'Paid from',
      place: 'Bank',
      locale: 'en-US',
    });

    assert.match(image, /^<svg /);
    assert.match(image, /width="1080"/);
    assert.match(image, /Pain &amp; &lt;jam&gt;/);
    assert.match(image, /Paid from: Bank/);
    assert.match(image, /TOTAL/);
    assert.equal(courseBillImageFilename(session), 'smartjib-course-2026-08-30.png');
  });

  it('renders as a paper receipt (torn edge + faux barcode)', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ name: 'Sidi Ali 2L', unitPrice: 6, qty: 2 }));
    session = completeSession(session, NOW);

    const image = renderCourseBillImageSvg(session, {
      title: 'Course bill',
      items: 'items',
      total: 'Total',
      paidFrom: 'Paid from',
      place: 'Bank',
      locale: 'en-US',
      thanks: 'Thank you for your visit!',
    });

    assert.match(image, /<path d="M 114 56/); // paper with rounded top corners
    assert.match(image, /No\. \d{12}/); // receipt number under the barcode
    assert.match(image, /feDropShadow/); // paper shadow
    assert.match(image, /Thank you for your visit!/);
    // torn bottom edge: backdrop-coloured notches cut into the paper
    assert.match(image, /fill="#efece4"/);
  });

  it('mirrors the visual receipt for right-to-left share images', () => {
    const image = renderCourseBillImageSvg(makeSession(), {
      title: 'فاتورة التسوق',
      items: 'عناصر',
      total: 'المجموع',
      paidFrom: 'الدفع من',
      place: 'البنك',
      direction: 'rtl',
      locale: 'ar-MA',
    });

    assert.match(image, /direction="rtl"/);
    assert.match(image, /فاتورة التسوق/);
  });
});

describe('renderBillCsv', () => {
  it('exports one row per item plus a totals row', () => {
    let session = makeSession();
    session = addItemToSession(session, makeItem({ barcode: '6111246721261', name: 'Fromage', unitPrice: 12.9 }));
    session = addItemToSession(session, makeItem({ name: 'Pain "spécial"', unitPrice: 8 }));

    const csv = renderBillCsv(session);
    const lines = csv.split('\n');
    assert.equal(lines[0], 'name,barcode,qty,unit_price,line_total');
    assert.equal(lines[1], '"Fromage",6111246721261,1,12.90,12.90');
    assert.equal(lines[2], '"Pain ""spécial""",,1,8.00,8.00');
    assert.equal(lines[3], ',,2,,20.90');
  });
});

// --- Resolution cascade -----------------------------------------------------------------

describe('resolveProduct', () => {
  it('resolves from the local catalog first (no remote call)', async () => {
    let remoteCalls = 0;
    const resolution = await resolveProduct({
      barcode: MA_PRODUCT.barcode,
      catalog: [MA_PRODUCT],
      lookupRemote: async () => {
        remoteCalls++;
        return { name: 'WRONG' };
      },
    });
    assert.equal(remoteCalls, 0);
    assert.deepEqual(resolution, {
      kind: 'found',
      product: {
        name: 'Fromage blanc nature 500g',
        brand: 'Milky Food',
        category: 'Fromages',
        imageUrl: undefined,
      },
      lastPrice: 12.9,
      source: 'catalog',
    });
  });

  it('falls back to the remote lookup for first-time products', async () => {
    const resolution = await resolveProduct({
      barcode: '3017620422003',
      catalog: [],
      lookupRemote: async () => ({ name: 'Nutella', brand: 'Ferrero' }),
    });
    assert.deepEqual(resolution, {
      kind: 'found',
      product: { name: 'Nutella', brand: 'Ferrero', category: undefined, imageUrl: undefined },
      source: 'remote',
    });
  });

  it('resolves from the bundled seed before the network', async () => {
    let remoteCalls = 0;
    const resolution = await resolveProduct({
      barcode: '6111035002175',
      catalog: [],
      lookupSeed: (code) => (code === '6111035002175' ? { name: 'Sidi Ali', brand: 'Sidi Ali' } : null),
      lookupRemote: async () => {
        remoteCalls++;
        return { name: 'WRONG' };
      },
    });
    assert.equal(remoteCalls, 0);
    assert.deepEqual(resolution, {
      kind: 'found',
      product: { name: 'Sidi Ali', brand: 'Sidi Ali', category: undefined, imageUrl: undefined },
      source: 'seed',
    });
  });

  it('reports not-found (clean miss) when the remote misses', async () => {
    const resolution = await resolveProduct({
      barcode: '1111111111111',
      catalog: [],
      lookupRemote: async () => null,
    });
    assert.deepEqual(resolution, { kind: 'not-found', barcode: '1111111111111', reason: 'not-found' });
  });

  it('reports lookup-failed when the remote throws or times out', async () => {
    const failing = await resolveProduct({
      barcode: '2222222222222',
      catalog: [],
      lookupRemote: async () => {
        throw new Error('network down');
      },
    });
    assert.deepEqual(failing, { kind: 'not-found', barcode: '2222222222222', reason: 'lookup-failed' });

    const slow = await resolveProduct({
      barcode: '3333333333333',
      catalog: [],
      lookupRemote: () =>
        new Promise((resolve) => setTimeout(() => resolve({ name: 'Too late' }), 200)),
      remoteTimeoutMs: 30,
    });
    assert.deepEqual(slow, { kind: 'not-found', barcode: '3333333333333', reason: 'lookup-failed' });
  });

  it('ignores catalog entries without a name and uses the remote', async () => {
    const nameless: Product = {
      barcode: '4444444444444',
      name: '',
      source: 'manual',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const resolution = await resolveProduct({
      barcode: '4444444444444',
      catalog: [nameless],
      lookupRemote: async () => ({ name: 'Recovered' }),
    });
    assert.deepEqual(resolution, {
      kind: 'found',
      product: { name: 'Recovered', brand: undefined, category: undefined, imageUrl: undefined },
      source: 'remote',
    });
  });

  it('works with no remote configured (offline / demo)', async () => {
    const resolution = await resolveProduct({ barcode: '5555555555555', catalog: [] });
    assert.deepEqual(resolution, {
      kind: 'not-found',
      barcode: '5555555555555',
      reason: 'not-found',
    });
  });
});

describe('budget logging (course → variable expense)', () => {
  it('prefers a grocery-like category when the user has one', () => {
    assert.equal(
      resolveCourseCategory(['Transport', 'Rent', 'Groceries', 'Health']),
      'Groceries',
    );
  });

  it('matches candidates case-insensitively and keeps the user spelling', () => {
    assert.equal(resolveCourseCategory(['groceries']), 'groceries');
    assert.equal(resolveCourseCategory(['Épicerie', 'Transport']), 'Épicerie');
  });

  it('falls back to the first active category when none is grocery-like', () => {
    assert.equal(resolveCourseCategory(['Rent', 'Transport', 'Health']), 'Rent');
  });

  it('falls back to the built-in default when there are no categories', () => {
    assert.equal(resolveCourseCategory([]), COURSE_FALLBACK_CATEGORY);
    assert.equal(resolveCourseCategory(['  ', '']), COURSE_FALLBACK_CATEGORY);
  });

  it('links the session to its logged expense without touching the total', () => {
    const session = createSession({ currency: 'MAD', place: 'wallet' });
    const withItem = addItemToSession(session, createSessionItem({ name: 'Pain', unitPrice: 6, qty: 2 }));
    const logged = markSessionLogged(withItem, 'exp_123');
    assert.equal(logged.loggedExpenseId, 'exp_123');
    assert.equal(logged.total, withItem.total);
    assert.equal(logged.status, withItem.status);
  });
});
