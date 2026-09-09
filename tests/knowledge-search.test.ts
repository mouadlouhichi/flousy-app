import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchKnowledgeSummaries,
  isKnowledgeConfigured,
  parseKnowledgeBody,
} from '../src/lib/server/knowledge-search';

type TestEnv = { KNOWLEDGE_API_URL?: string; KNOWLEDGE_API_KEY?: string; KNOWLEDGE_API_MODEL?: string };
const KEYED: TestEnv = { KNOWLEDGE_API_URL: 'https://knowledge.example.test/v1', KNOWLEDGE_API_KEY: 'sk-x' };
const KEYLESS: TestEnv = {};

describe('knowledge-search config', () => {
  it('requires both URL and key', () => {
    assert.equal(isKnowledgeConfigured(KEYLESS), false);
    assert.equal(isKnowledgeConfigured({ KNOWLEDGE_API_URL: 'https://x' }), false);
    assert.equal(isKnowledgeConfigured({ KNOWLEDGE_API_KEY: 'k' }), false);
    assert.equal(isKnowledgeConfigured(KEYED), true);
  });
});

describe('knowledge-search parsing', () => {
  it('accepts a direct ingredients array and drops unknown/unrequested names', () => {
    const body = {
      ingredients: [
        { name: 'Xanthane mystère', summary: 'A gelling agent.' },
        { name: 'Not Asked', summary: 'Should be dropped.' },
        { name: '', summary: 'Empty name.' },
      ],
    };
    assert.deepEqual(parseKnowledgeBody(body, ['Xanthane mystère']), [
      { name: 'Xanthane mystère', summary: 'A gelling agent.' },
    ]);
  });

  it('unwraps OpenAI-style choices[0].message.content JSON', () => {
    const body = {
      choices: [
        {
          message: {
            content: JSON.stringify({ ingredients: [{ name: 'Ferments lactiques', summary: 'Live cultures.' }] }),
          },
        },
      ],
    };
    assert.deepEqual(parseKnowledgeBody(body, ['Ferments lactiques']), [
      { name: 'Ferments lactiques', summary: 'Live cultures.' },
    ]);
  });

  it('rejects overlong fields whole and rejects hostile payloads', () => {
    assert.deepEqual(
      parseKnowledgeBody({ ingredients: [{ name: 'A', summary: 'x'.repeat(401) }] }, ['A']),
      [],
    );
    assert.deepEqual(
      parseKnowledgeBody({ ingredients: new Array(41).fill({ name: 'A', summary: 'Fact.' }) }, ['A']),
      [],
    );
    assert.deepEqual(parseKnowledgeBody('nope', ['A']), []);
    assert.deepEqual(parseKnowledgeBody({ ingredients: 'oops' }, ['A']), []);
    assert.deepEqual(parseKnowledgeBody({ choices: [{ message: { content: '{not json' } }] }, ['A']), []);
    assert.deepEqual(
      parseKnowledgeBody({ choices: [{ message: { content: ' '.repeat(32_001) } }] }, ['A']),
      [],
    );
  });
});

describe('knowledge-search fetch', () => {
  type KnowledgeFetch = Parameters<typeof fetchKnowledgeSummaries>[3];
  type SpyFetch = (url: string, init?: { headers?: Record<string, string>; body?: string }) => Promise<{
    ok: boolean;
    json: () => Promise<unknown>;
  }>;

  it('never calls the network without a key', async () => {
    let calls = 0;
    const boom: Parameters<typeof fetchKnowledgeSummaries>[3] = async () => {
      calls++;
      throw new Error('must not be reached');
    };
    assert.deepEqual(await fetchKnowledgeSummaries(['A'], KEYLESS, 'fr', boom), []);
    assert.equal(calls, 0);
  });

  it('rejects an oversized provider request before network work', async () => {
    let calls = 0;
    const spy: KnowledgeFetch = async () => {
      calls += 1;
      return { ok: true, json: async () => ({}) };
    };
    assert.deepEqual(
      await fetchKnowledgeSummaries(['A'.repeat(501)], KEYED, 'fr', spy),
      [],
    );
    assert.equal(calls, 0);
  });

  it('posts at most 40 names and adopts only requested answers', async () => {
    const names = Array.from({ length: 70 }, (_, i) => `Ingrédient ${i}`);
    const calls: Array<{ url: string; init?: { headers?: Record<string, string>; body?: string } }> = [];
    const spy: SpyFetch = async (url, init) => {
      calls.push({ url, init });
      const body = JSON.parse(init?.body ?? '{}') as { messages: { content: string }[] };
      assert.match(body.messages[0].content, /neutral/i);
      const asked = (body.messages[1].content.match(/\d+\. ([^\n]+)/g) ?? []).map((l) =>
        l.replace(/^\d+\. /, ''),
      );
      return {
        ok: true,
        json: async () => ({ ingredients: asked.slice(0, 2).map((n) => ({ name: n, summary: 'Neutral fact.' })) }),
      };
    };
    const out = await fetchKnowledgeSummaries(names, KEYED, 'fr', spy as unknown as KnowledgeFetch);
    assert.equal(calls.length, 1);
    const sent = JSON.parse(calls[0].init?.body ?? '{}') as { messages: { content: string }[] };
    const lines = sent.messages[1].content.split('\n');
    assert.equal(lines.length, 41); // header + 40 numbered names
    assert.equal(out.length, 2);
    assert.ok(out.every((a) => a.summary === 'Neutral fact.'));
  });

  it('fails open on HTTP errors, network errors and junk bodies', async () => {
    const httpErr: SpyFetch = async () => ({ ok: false, json: async () => ({}) });
    assert.deepEqual(await fetchKnowledgeSummaries(['A'], KEYED, 'fr', httpErr as unknown as KnowledgeFetch), []);
    const netErr: SpyFetch = async () => {
      throw new Error('down');
    };
    assert.deepEqual(await fetchKnowledgeSummaries(['A'], KEYED, 'fr', netErr as unknown as KnowledgeFetch), []);
    const junk: SpyFetch = async () => ({ ok: true, json: async () => 'oops' });
    assert.deepEqual(await fetchKnowledgeSummaries(['A'], KEYED, 'fr', junk as unknown as KnowledgeFetch), []);
  });
});
