/**
 * Shared rate limiter: in-memory fallback semantics + Upstash Redis backend.
 *
 * The Redis path is exercised against a stubbed `fetch` so tests stay hermetic;
 * the contract under test is the fail-open behaviour (any Redis problem falls
 * back to the in-memory counter, never to "deny everything" or "allow forever").
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimited, resetMemoryRateLimits } from '../src/lib/server/rate-limit';

const realFetch = globalThis.fetch;

beforeEach(() => {
  resetMemoryRateLimits();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

test('memory: allows up to the limit, then blocks within the window', async () => {
  for (let i = 0; i < 3; i += 1) {
    assert.equal(await isRateLimited('t1', 'ip-a', 3, 60_000), false, `hit ${i + 1} allowed`);
  }
  assert.equal(await isRateLimited('t1', 'ip-a', 3, 60_000), true, 'hit 4 blocked');
  assert.equal(await isRateLimited('t1', 'ip-b', 3, 60_000), false, 'other key unaffected');
});

test('memory: limiters with different names are isolated', async () => {
  for (let i = 0; i < 4; i += 1) await isRateLimited('t2-contact', 'ip', 3, 60_000);
  assert.equal(await isRateLimited('t2-errors', 'ip', 3, 60_000), false);
});

test('redis: counts from the pipeline response decide the verdict', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  let count = 0;
  const calls: Array<{ url: string; auth: string | undefined; body: string }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    count += 1;
    calls.push({
      url: String(url),
      auth: (init?.headers as Record<string, string>)?.Authorization,
      body: String(init?.body),
    });
    return new Response(JSON.stringify([{ result: count }, { result: 1 }]), { status: 200 });
  }) as typeof fetch;

  assert.equal(await isRateLimited('t3', 'uid', 2, 60_000), false); // count 1
  assert.equal(await isRateLimited('t3', 'uid', 2, 60_000), false); // count 2
  assert.equal(await isRateLimited('t3', 'uid', 2, 60_000), true); // count 3 > 2

  assert.equal(calls[0].url, 'https://fake.upstash.io/pipeline');
  assert.equal(calls[0].auth, 'Bearer token');
  const commands = JSON.parse(calls[0].body) as string[][];
  assert.equal(commands[0][0], 'INCR');
  assert.equal(commands[1][0], 'PEXPIRE');
  assert.match(commands[0][1], /^rl:t3:\d+:uid$/);
});

test('redis: network failure falls back to in-memory counting (fail-open)', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  globalThis.fetch = (async () => {
    throw new Error('redis down');
  }) as typeof fetch;

  assert.equal(await isRateLimited('t4', 'ip', 1, 60_000), false, 'first hit still allowed');
  assert.equal(await isRateLimited('t4', 'ip', 1, 60_000), true, 'memory fallback still limits');
});

test('redis: non-OK and malformed responses fall back to memory', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
  globalThis.fetch = (async () => new Response('nope', { status: 500 })) as typeof fetch;
  assert.equal(await isRateLimited('t5', 'ip', 5, 60_000), false);

  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{ error: 'WRONGTYPE' }]), { status: 200 })) as typeof fetch;
  assert.equal(await isRateLimited('t5', 'ip', 5, 60_000), false);
});
