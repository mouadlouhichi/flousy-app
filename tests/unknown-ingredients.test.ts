import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/inci/analyze/route';
import {
  clearUnknownIngredientAggregatesForTests,
  reportUnknownIngredientAggregates,
  unknownIngredientAggregateSnapshot,
} from '../src/lib/server/unknown-ingredients';
import { resetMemoryRateLimits } from '../src/lib/server/rate-limit';

const ENV_KEYS = [
  'UNKNOWN_INGREDIENT_HASH_KEY',
  'INCI_API_KEY',
  'ARCJET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  clearUnknownIngredientAggregatesForTests();
  resetMemoryRateLimits();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const context = {
  datasetVersion: "ingredient-evidence-v3",
  form: 'leave-on' as const,
  parserValid: true,
};

describe('privacy-minimized unknown ingredient aggregation', () => {
  it('deduplicates and bounds tokens without retaining raw ingredient text', async () => {
    const candidates = [
      'Mystery Flower Extract',
      ' mystery   flower extract ',
      '7',
      'x',
      'A'.repeat(121),
      ...Array.from({ length: 20 }, (_, index) => `Unrecognized botanical ${index}`),
    ];
    const reported = await reportUnknownIngredientAggregates(candidates, context);
    assert.equal(reported, 12);
    const snapshot = unknownIngredientAggregateSnapshot();
    assert.equal(snapshot.length, 12);
    for (const aggregate of snapshot) {
      assert.match(aggregate.hash, /^[a-f0-9]{32}$/);
      assert.equal(aggregate.count, 1);
      assert.equal(aggregate.datasetVersion, context.datasetVersion);
      assert.equal(aggregate.context, 'leave-on:valid');
      assert.equal(JSON.stringify(aggregate).includes('Mystery'), false);
      assert.equal(JSON.stringify(aggregate).includes('botanical'), false);
    }
  });

  it('increments only the matching version/context bucket and bounds version metadata', async () => {
    await reportUnknownIngredientAggregates(['Novel Polymer'], context);
    await reportUnknownIngredientAggregates(['novel polymer'], context);
    await reportUnknownIngredientAggregates(['Novel Polymer'], { ...context, form: 'rinse-off' });
    await reportUnknownIngredientAggregates(['Novel Polymer'], {
      ...context,
      datasetVersion: `  ${'v'.repeat(200)}  `,
    });
    const snapshot = unknownIngredientAggregateSnapshot();
    assert.equal(snapshot.length, 3);
    const leaveOn = snapshot.find((item) => item.context === 'leave-on:valid' && item.datasetVersion === context.datasetVersion);
    assert.equal(leaveOn?.count, 2);
    assert.equal(snapshot.find((item) => item.context === 'rinse-off:valid')?.count, 1);
    assert.equal(Math.max(...snapshot.map((item) => item.datasetVersion.length)), 160);
  });

  it('uses a deployment HMAC key when supplied so environments cannot correlate hashes', async () => {
    process.env.UNKNOWN_INGREDIENT_HASH_KEY = 'environment-one-secret';
    await reportUnknownIngredientAggregates(['Novel Polymer'], context);
    const first = unknownIngredientAggregateSnapshot()[0]?.hash;
    clearUnknownIngredientAggregatesForTests();
    process.env.UNKNOWN_INGREDIENT_HASH_KEY = 'environment-two-secret';
    await reportUnknownIngredientAggregates(['Novel Polymer'], context);
    const second = unknownIngredientAggregateSnapshot()[0]?.hash;
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first, second);
  });

  it('is invoked automatically by analysis and limits aggregate updates to eight per IP per hour', async () => {
    for (let index = 0; index < 10; index += 1) {
      const request = new NextRequest('http://localhost/api/inci/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.99.0.1',
        },
        body: JSON.stringify({
          inciText: 'Zzxqv Synthetic Nebula',
          form: 'leave-on',
          source: 'paste',
          reviewed: true,
        }),
      });
      const response = await POST(request);
      assert.equal(response.status, 200);
      const body = await response.json() as { unknownIngredients: string[] };
      assert.deepEqual(body.unknownIngredients, ['Zzxqv Synthetic Nebula']);
    }
    const snapshot = unknownIngredientAggregateSnapshot();
    assert.equal(snapshot.length, 1);
    assert.equal(snapshot[0].count, 8);
  });
});
