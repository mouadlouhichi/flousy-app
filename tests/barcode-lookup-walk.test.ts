import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { walkOffHosts } from '../src/app/api/barcode/lookup/route';

/**
 * The proxy walk's verdict logic — the first-scan regression guard.
 *
 * A "not found" verdict is only definitive when EVERY instance answered.
 * If one instance was down/slow, it may be the one carrying the product
 * (e.g. beauty codes): the walk must report `incomplete` so the route
 * returns a retryable 502 instead of a cached five-minute false negative.
 */
type FetchScript = (url: string, init?: { signal?: AbortSignal }) => Response | Promise<Response> | never;

const realFetch = globalThis.fetch;

function mockFetch(script: FetchScript) {
  globalThis.fetch = ((url: string | URL | Request, init?: { signal?: AbortSignal }) => {
    const u = String(url);
    return Promise.resolve(script(u, init));
  }) as typeof fetch;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function neverSettles(signal?: AbortSignal): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) return; // leak: never settles
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });
}

after(() => {
  globalThis.fetch = realFetch;
});

describe('walkOffHosts verdicts', () => {
  it('definitive not-found when every instance answers', () => {
    mockFetch(() => json(200, { status: 0, status_verbose: 'product not found' }));
    return walkOffHosts('6111035002175').then((r) => assert.deepEqual(r, { kind: 'not-found' }));
  });

  it('is INCOMPLETE (not not-found) when one instance 500s — the first-scan bug', () => {
    mockFetch((u) =>
      u.includes('openbeautyfacts') ? json(500, { error: 'upstream' }) : json(200, { status: 0 }),
    );
    return walkOffHosts('3600541177741').then((r) => {
      assert.deepEqual(r, { kind: 'incomplete' });
      assert.notEqual(r.kind, 'not-found', 'a failed instance may carry the product — never cache a miss');
    });
  });

  it('is INCOMPLETE when one instance is unreachable (network error)', () => {
    mockFetch((u) => {
      if (u.includes('openbeautyfacts')) throw new Error('ECONNRESET');
      return json(200, { status: 0 });
    });
    return walkOffHosts('3600541177741').then((r) => assert.deepEqual(r, { kind: 'incomplete' }));
  });

  it('a hit on any instance wins', () => {
    mockFetch((u) =>
      u.includes('openbeautyfacts')
        ? json(200, { status: 1, product: { product_name: '68YN5T 400ml', brands: 'Ultra doux' } })
        : json(200, { status: 0 }),
    );
    return walkOffHosts('3600541177741').then((r) => {
      assert.equal(r.kind, 'found');
      if (r.kind === 'found') assert.equal(r.product.product_name, '68YN5T 400ml');
    });
  });

  it('failed when no instance answered at all', () => {
    mockFetch(() => json(500, {}));
    return walkOffHosts('6111035002175').then((r) => assert.deepEqual(r, { kind: 'failed' }));
  });

  it('treats a 200 with a malformed body as a host failure', () => {
    mockFetch((u) => (u.includes('openproductsfacts') ? new Response('not json', { status: 200 }) : json(200, { status: 0 })));
    return walkOffHosts('3600541177741').then((r) => assert.deepEqual(r, { kind: 'incomplete' }));
  });

  it('a deadline abort is never a definitive not-found', async () => {
    mockFetch((u, init) =>
      u.includes('world.openfoodfacts.org') ? json(200, { status: 0 }) : neverSettles(init?.signal),
    );
    // The deadline is an AbortSignal.timeout (unref'd): with nothing else
    // pending the test runner would see an idle loop and cancel before it
    // fires. A ref'd timer keeps the loop alive until the walk settles.
    const keepAlive = setTimeout(() => {}, 500);
    try {
      // world answers "no"; the other four hang past the deadline
      const r = await walkOffHosts('3600541177741', { deadlineMs: 80, perHostMs: 60000 });
      assert.notEqual(r.kind, 'not-found', 'remaining hosts never answered — the verdict must be retryable');
      assert.ok(r.kind === 'incomplete' || r.kind === 'failed');
    } finally {
      clearTimeout(keepAlive);
    }
  });
});
