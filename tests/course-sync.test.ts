import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeInciText } from '../src/lib/ingredient-safety/analyze';
import { summarizeQuality } from '../src/lib/course-session';
import {
  applyAssessmentToSession,
  clearCourseMutations,
  listCourseMutations,
  putCourseMutation,
  type CourseMutation,
} from '../src/lib/course-sync';
import type { AssessmentOrigin, CourseSession } from '../src/lib/store';

const assessment = analyzeInciText('Aqua, Quaternium-15', {
  form: 'leave-on',
  assessedAt: '2026-09-08T12:00:00.000Z',
});
const quality = summarizeQuality(assessment);

const origin: AssessmentOrigin = {
  sessionId: 'session-a',
  lineItemId: 'line-a',
  requestId: 'request-a',
  gtin14: '04006381333931',
  requestedAt: '2026-09-08T11:59:00.000Z',
};

function session(extra: Partial<CourseSession> = {}): CourseSession {
  return {
    id: 'session-a',
    status: 'active',
    startedAt: '2026-09-08T11:00:00.000Z',
    date: '2026-09-08',
    currency: 'MAD',
    place: 'wallet',
    items: [{
      key: 'line-a',
      barcode: '4006381333931',
      gtin14: '04006381333931',
      name: 'Product A',
      qty: 1,
      unitPrice: 12,
      lineTotal: 12,
      assessmentRequestId: 'request-a',
      assessmentOrigin: origin,
    }],
    total: 12,
    revision: 7,
    lastMutationId: 'unrelated-edit',
    ...extra,
  };
}

function application(overrides: Partial<Parameters<typeof applyAssessmentToSession>[1]> = {}) {
  return {
    mutationId: 'assessment-mutation-a',
    sessionId: 'session-a',
    origin,
    quality,
    assessment,
    ...overrides,
  };
}

describe('origin-bound assessment rebasing', () => {
  it('rebases across unrelated revisions and preserves a remotely completed session', () => {
    const remote = session({
      status: 'completed',
      endedAt: '2026-09-08T12:01:00.000Z',
      revision: 11,
      lastMutationId: 'post-session',
    });
    const next = applyAssessmentToSession(
      remote,
      application(),
      '2026-09-08T12:02:00.000Z',
    );
    assert.ok(next);
    assert.equal(next.status, 'completed');
    assert.equal(next.endedAt, remote.endedAt);
    assert.equal(next.revision, 12);
    assert.equal(next.lastMutationId, 'assessment-mutation-a');
    assert.equal(next.items[0]?.assessment?.assessedAt, assessment.assessedAt);
    assert.deepEqual(next.items[0]?.quality?.tiers, quality.tiers);
    assert.equal(next.items[0]?.assessmentRequestId, undefined, 'the one-shot marker is consumed');
  });

  it('rejects stale session, line, request, and exact optional GTIN identities', () => {
    assert.equal(applyAssessmentToSession(null, application(), 'now'), null);
    assert.equal(applyAssessmentToSession(session({ id: 'session-b' }), application(), 'now'), null);
    assert.equal(applyAssessmentToSession(session(), application({
      origin: { ...origin, lineItemId: 'missing-line' },
    }), 'now'), null);
    assert.equal(applyAssessmentToSession(session(), application({
      origin: { ...origin, requestId: 'older-request' },
    }), 'now'), null);
    assert.equal(applyAssessmentToSession(session(), application({
      origin: { ...origin, gtin14: '00012345678905' },
    }), 'now'), null);
    assert.equal(applyAssessmentToSession(session(), application({
      origin: { ...origin, gtin14: undefined },
    }), 'now'), null, 'omitting identity cannot bypass a scanned line identity');
  });

  it('allows manual rows only when both the line and origin omit GTIN identity', () => {
    const manualOrigin = { ...origin, gtin14: undefined };
    const manual = session({
      items: [{
        key: 'line-a',
        name: 'Manual cosmetic',
        qty: 1,
        unitPrice: 5,
        lineTotal: 5,
        assessmentRequestId: 'request-a',
      }],
    });
    const next = applyAssessmentToSession(manual, application({ origin: manualOrigin }), 'now');
    assert.ok(next);
    assert.equal(next.items[0]?.assessmentOrigin?.gtin14, undefined);
  });

  it('makes an acknowledged mutation idempotent without requiring the consumed request marker', () => {
    const once = applyAssessmentToSession(session(), application(), 'first');
    assert.ok(once);
    const replay = applyAssessmentToSession(once, application(), 'second');
    assert.equal(replay, once);
    assert.equal(replay.revision, 8);
    assert.equal(replay.updatedAt, 'first');
  });
});

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const originalLocalStorage = globalThis.localStorage;
const originalWindow = globalThis.window;

afterEach(() => {
  if (originalLocalStorage === undefined) delete (globalThis as { localStorage?: Storage }).localStorage;
  else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage });
  if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
  else Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
});

function installStorage() {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  return storage;
}

function saveMutation(uid: string, id: string): CourseMutation {
  const source = session({ revision: 3 });
  return {
    schemaVersion: 1,
    id,
    uid,
    kind: 'save',
    sessionId: source.id,
    expectedRevision: 3,
    session: source,
    createdAt: '2026-09-08T12:00:00.000Z',
    attempts: 0,
  };
}

describe('account-scoped durable course outbox', () => {
  it('isolates accounts and deduplicates retry insertion by mutation id', () => {
    installStorage();
    assert.equal(putCourseMutation(saveMutation('alice', 'one')), true);
    assert.equal(putCourseMutation(saveMutation('alice', 'one')), true);
    assert.equal(putCourseMutation(saveMutation('bob', 'two')), true);
    assert.deepEqual(listCourseMutations('alice').map((item) => item.id), ['one']);
    assert.deepEqual(listCourseMutations('bob').map((item) => item.id), ['two']);
    assert.equal(clearCourseMutations('alice'), true);
    assert.deepEqual(listCourseMutations('alice'), []);
    assert.deepEqual(listCourseMutations('bob').map((item) => item.id), ['two']);
  });

  it('retains only the bounded tail of queued mutations', () => {
    installStorage();
    for (let i = 0; i < 205; i += 1) {
      assert.equal(putCourseMutation(saveMutation('alice', `mutation-${i}`)), true);
    }
    const queued = listCourseMutations('alice');
    assert.equal(queued.length, 200);
    assert.equal(queued[0]?.id, 'mutation-5');
    assert.equal(queued.at(-1)?.id, 'mutation-204');
  });
});
