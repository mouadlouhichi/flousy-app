import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/food/analyze/route';

const TEXT = 'Lait de vache pasteurisé, Crème fraîche, ferments lactiques, Présure, Sel, Farrothus Exoticus';

const ENV_KEYS = [
  'KNOWLEDGE_API_URL',
  'KNOWLEDGE_API_KEY',
  'KNOWLEDGE_API_MODEL',
  'ARCJET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

let saved: Record<string, string | undefined>;
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  globalThis.fetch = originalFetch;
});

async function callApi(text: string, ip: string): Promise<Record<string, unknown>> {
  const req = new NextRequest('http://localhost/api/food/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ foodText: text, label: 'Fromage blanc', category: 'Dairies', language: 'fr' }),
  });
  const res = await POST(req);
  assert.equal(res.status, 200);
  return (await res.json()) as Record<string, unknown>;
}

describe('POST /api/food/analyze', () => {
  it('is purely local and never calls out without knowledge config', async () => {
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls++;
      throw new Error('must not call out');
    }) as unknown as typeof fetch;
    const res = await callApi(TEXT, '10.2.0.1');
    assert.equal(fetchCalls, 0);
    assert.equal(res.deepSearched, undefined);
    assert.deepEqual(res.external, []);
    assert.equal(res.total, 6);
    assert.deepEqual(res.allergenGroups, ['milk']);
  });

  it('posts only unknown names and returns attributed external knowledge', async () => {
    process.env.KNOWLEDGE_API_URL = 'https://knowledge.example.test/v1';
    process.env.KNOWLEDGE_API_KEY = 'sk-x';
    const calls: Array<{ url: string; init?: { headers?: Record<string, string>; body?: string } }> = [];
    globalThis.fetch = (async (url: string, init?: { headers?: Record<string, string>; body?: string }) => {
      calls.push({ url, init });
      const body = JSON.parse(init?.body ?? '{}') as { messages: { content: string }[] };
      const content = body.messages[1].content;
      const names = (content.match(/(?:\d+\. )(?:.*)$/gm) ?? []).map((l) =>
        l.replace(/^\d+\. /, '').trim(),
      );
      assert.deepEqual(names, ['Farrothus Exoticus']);
      return {
        ok: true,
        json: async () => ({
          ingredients: [{ name: 'Farrothus Exoticus', summary: 'An obscure ingredient with neutral facts.' }],
        }),
      };
    }) as unknown as typeof fetch;

    const res = await callApi(TEXT, '10.2.0.2');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://knowledge.example.test/v1/chat/completions');
    assert.equal(calls[0].init?.headers?.Authorization, 'Bearer sk-x');
    assert.equal(res.deepSearched, true);
    const external = res.external as Array<{ name: string; summary: string; source: string }>;
    assert.equal(external.length, 1);
    assert.equal(external[0].name, 'Farrothus Exoticus');
    assert.equal(external[0].source, 'knowledge.example.test');
    // External answers never change the local verdicts.
    assert.equal(res.recognized, 5);
    assert.deepEqual(res.unknownNames, ['Farrothus Exoticus']);
    assert.deepEqual(res.allergenGroups, ['milk']);
  });

  it('fails open to the exact pure-local result when the slot errors', async () => {
    process.env.KNOWLEDGE_API_URL = 'https://knowledge.example.test/v1';
    process.env.KNOWLEDGE_API_KEY = 'sk-x';
    const plain = await callApi(TEXT, '10.2.0.3');
    globalThis.fetch = (async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const res = await callApi(TEXT, '10.2.0.4');
    assert.equal(res.deepSearched, undefined);
    assert.equal(JSON.stringify(res), JSON.stringify(plain));
  });

  it('rejects an empty body', async () => {
    const req = new NextRequest('http://localhost/api/food/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.2.0.9' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
  });
});
