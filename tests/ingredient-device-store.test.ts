import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  readInciOverlay,
  readInciOverlayEntry,
  subscribeInciOverlay,
  writeInciOverlayEntry,
} from '../src/lib/ingredient-device-store';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const memoryStorage = new MemoryStorage();
const eventTarget = new EventTarget();
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

before(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(eventTarget, { localStorage: memoryStorage }),
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: memoryStorage,
  });
});

after(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('account-scoped ingredient overlays', () => {
  it('keeps reviewed OCR/manual records separate by account and validates stored data', () => {
    assert.equal(writeInciOverlayEntry('6111234567895', 'Aqua, Glycerin', 'alice', {
      source: 'ocr', reviewed: true,
    }), true);
    assert.equal(writeInciOverlayEntry('6111234567895', 'Aqua, Parfum', 'bob', {
      source: 'manual', reviewed: true,
    }), true);

    assert.deepEqual(
      { ...readInciOverlayEntry('6111234567895', 'alice'), updatedAt: '<timestamp>' },
      { text: 'Aqua, Glycerin', source: 'ocr', reviewed: true, updatedAt: '<timestamp>' },
    );
    assert.equal(readInciOverlayEntry('6111234567895', 'bob')?.text, 'Aqua, Parfum');

    memoryStorage.setItem('smartjib_inci_overlay:v2:account%3Acorrupt', JSON.stringify({
      valid: { text: '  Aqua  ', source: 'manual', reviewed: true, updatedAt: '2026-09-08T00:00:00.000Z' },
      empty: { text: '', source: 'manual' },
      wrongSource: { text: 'Parfum', source: 'provider' },
      primitive: 'not-an-entry',
    }));
    assert.deepEqual(readInciOverlay('corrupt'), {
      valid: { text: 'Aqua', source: 'manual', reviewed: true, updatedAt: '2026-09-08T00:00:00.000Z' },
    });
  });

  it('notifies only subscribers for the account key changed by another tab', () => {
    let aliceChanges = 0;
    let bobChanges = 0;
    const unsubscribeAlice = subscribeInciOverlay('alice', () => { aliceChanges += 1; });
    const unsubscribeBob = subscribeInciOverlay('bob', () => { bobChanges += 1; });

    const aliceEvent = Object.assign(new Event('storage'), {
      key: 'smartjib_inci_overlay:v2:account%3Aalice',
    });
    eventTarget.dispatchEvent(aliceEvent);
    assert.equal(aliceChanges, 1);
    assert.equal(bobChanges, 0);

    unsubscribeAlice();
    unsubscribeBob();
    eventTarget.dispatchEvent(aliceEvent);
    assert.equal(aliceChanges, 1, 'cleanup removes the storage listener');
  });

  it('caps each account overlay at 300 records and refuses oversized text', () => {
    assert.equal(writeInciOverlayEntry('too-large', 'A'.repeat(12_001), 'bounded'), false);
    for (let index = 0; index < 305; index += 1) {
      assert.equal(writeInciOverlayEntry(`code-${index}`, `Ingredient ${index}`, 'bounded'), true);
    }
    assert.equal(Object.keys(readInciOverlay('bounded')).length, 300);
  });
});
