import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readQueuedProductReports,
  submitProductReport,
} from '../src/lib/product-report';

/** Minimal localStorage stand-in — node tests have no storage global. */
function installMemoryStorage() {
  const map = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
  return map;
}

describe('product wrong-result reports', () => {
  it('queues locally and reports saved-offline without an account', async () => {
    const store = installMemoryStorage();
    const outcome = await submitProductReport({
      barcode: '4006381333931',
      resolvedName: '  Wrong name ',
      note: '  it is actually a shampoo  ',
      domain: 'cosmetic',
      locale: 'en',
    });
    assert.equal(outcome, 'saved-offline');
    const queued = readQueuedProductReports();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].resolvedName, 'Wrong name');
    assert.equal(queued[0].note, 'it is actually a shampoo');
    assert.match(queued[0].createdAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(store.get('smartjib.productReports.v1') ?? '', /"Wrong name"/);
  });

  it('writes to Firestore under the reporting account when signed in', async () => {
    installMemoryStorage();
    const submitted: Array<{ record: unknown; uid: string }> = [];
    const outcome = await submitProductReport(
      { barcode: '3760221371527', resolvedName: 'Wrong name' },
      { uid: 'user-9', submit: async (record, uid) => { submitted.push({ record, uid }); } },
    );
    assert.equal(outcome, 'stored');
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].uid, 'user-9');
    assert.equal((submitted[0].record as { barcode: string }).barcode, '3760221371527');
  });

  it('degrades a Firestore failure to the on-device queue', async () => {
    installMemoryStorage();
    const outcome = await submitProductReport(
      { barcode: '4006381333931', resolvedName: 'Wrong name' },
      { uid: 'user-9', submit: async () => { throw new Error('permission-denied'); } },
    );
    assert.equal(outcome, 'saved-offline');
    assert.equal(readQueuedProductReports().length, 1);
  });

  it('caps the on-device queue at 50 records, dropping the oldest', async () => {
    installMemoryStorage();
    for (let i = 0; i < 55; i++) {
      await submitProductReport({ barcode: `400638133393${i % 10}`, resolvedName: `name-${i}` });
    }
    const queued = readQueuedProductReports();
    assert.equal(queued.length, 50);
    assert.equal(queued[0].resolvedName, 'name-5');
    assert.equal(queued[queued.length - 1].resolvedName, 'name-54');
  });
});
