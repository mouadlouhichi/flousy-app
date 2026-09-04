import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FinanceConflictError,
  clearFinanceOutbox,
  listFinanceMutations,
  mergeGoalsMutation,
  mergeMonthMutation,
  putFinanceMutation,
  removeFinanceMutation,
  resolvePeriodMutation,
  type FinanceMutation,
  planFlushAttempts,
} from '../src/lib/finance-sync';
import { normalizeMonth, type MonthBudget, type SavingGoal } from '../src/lib/store';

const month = (patch: Partial<MonthBudget> = {}): MonthBudget => normalizeMonth({
  totalBudget: 100,
  bankPart: 100,
  homePart: 0,
  walletPart: 0,
  placeBalances: { bank: 100 },
  variableExpenses: [],
  ...patch,
}, '2026-09');

const expense = (id: string, amount: number) => ({
  id,
  name: id,
  amount,
  type: 'Groceries',
  date: '2026-09-02',
  place: 'bank',
});

test('three-way month merge composes independent entity additions and cash deltas', () => {
  const base = month();
  const local = month({
    bankPart: 90,
    placeBalances: { bank: 90 },
    variableExpenses: [expense('local', 10)],
  });
  const remote = month({
    bankPart: 80,
    placeBalances: { bank: 80 },
    variableExpenses: [expense('remote', 20)],
  });

  const merged = mergeMonthMutation(base, local, remote);
  assert.equal(merged.bankPart, 70);
  assert.equal(merged.placeBalances?.bank, 70);
  assert.deepEqual(merged.variableExpenses.map((item) => item.id), ['local', 'remote']);
});

test('three-way month merge rejects edits to the same entity instead of overwriting', () => {
  const original = expense('same', 10);
  const base = month({ variableExpenses: [original] });
  const local = month({ variableExpenses: [{ ...original, amount: 15 }] });
  const remote = month({ variableExpenses: [{ ...original, amount: 20 }] });

  assert.throws(
    () => mergeMonthMutation(base, local, remote),
    (error: unknown) => {
      assert.ok(error instanceof FinanceConflictError);
      assert.deepEqual(error.conflicts, [{ path: 'variableExpenses.same', reason: 'changed-remotely' }]);
      return true;
    },
  );
});

test('three-way month merge rejects a composed overdraft', () => {
  const base = month();
  const local = month({ bankPart: 20 });
  const remote = month({ bankPart: 70 });
  assert.throws(
    () => mergeMonthMutation(base, local, remote),
    (error: unknown) => error instanceof FinanceConflictError
      && error.conflicts.some((conflict) => conflict.path === 'bankPart' && conflict.reason === 'insufficient-funds'),
  );
});

test('closed periods reject ordinary edits and make close/reopen idempotent', () => {
  assert.throws(
    () => resolvePeriodMutation({ periodStatus: 'closed' }, 'finance'),
    (error: unknown) => error instanceof FinanceConflictError
      && error.conflicts[0]?.reason === 'period-closed',
  );
  assert.equal(resolvePeriodMutation({ periodStatus: 'closed' }, 'close-period'), 'already-satisfied');
  assert.equal(resolvePeriodMutation({ periodStatus: 'closed' }, 'reopen-period'), 'proceed');
  assert.equal(resolvePeriodMutation({ periodStatus: 'open' }, 'reopen-period'), 'already-satisfied');
  assert.equal(resolvePeriodMutation({ periodStatus: 'open' }, 'close-period'), 'proceed');
});

test('goal merge composes independent edits and conflicts on the same goal', () => {
  const first: SavingGoal = { id: 'first', name: 'First', target: 100, current: 0, source: 'bank', active: true };
  const second: SavingGoal = { id: 'second', name: 'Second', target: 100, current: 0, source: 'bank', active: true };
  const composed = mergeGoalsMutation(
    [first, second],
    [{ ...first, current: 10 }, second],
    [first, { ...second, current: 20 }],
  );
  assert.deepEqual(composed, [{ ...first, current: 10 }, { ...second, current: 20 }]);
  assert.throws(
    () => mergeGoalsMutation([first], [{ ...first, current: 10 }], [{ ...first, current: 20 }]),
    FinanceConflictError,
  );
});

function mutation(id: string, createdAt: string, patch: Partial<FinanceMutation> = {}): FinanceMutation {
  const base = month();
  return {
    version: 1,
    id,
    actorId: 'alice',
    workspace: 'personal',
    workspaceId: 'alice',
    monthKey: '2026-09',
    baseMonth: base,
    nextMonth: base,
    createdAt,
    attempts: 0,
    ...patch,
  };
}

test('durable outbox fallback clones, filters, orders, replaces, and removes mutations', async () => {
  await clearFinanceOutbox();
  const later = mutation('later', '2026-09-02T12:00:00.000Z');
  const earlier = mutation('earlier', '2026-09-02T10:00:00.000Z', {
    workspace: 'household', workspaceId: 'home', monthKey: '2026-08',
  });
  await putFinanceMutation(later);
  await putFinanceMutation(earlier);
  later.attempts = 99;

  const all = await listFinanceMutations({ actorId: 'alice' });
  assert.deepEqual(all.map((item) => item.id), ['earlier', 'later']);
  assert.equal(all[1].attempts, 0, 'queued values must not alias mutable UI objects');
  assert.deepEqual(
    (await listFinanceMutations({ workspace: 'household', workspaceId: 'home', monthKey: '2026-08' })).map((item) => item.id),
    ['earlier'],
  );

  await putFinanceMutation({ ...all[1], attempts: 1, lastError: 'offline' });
  assert.equal((await listFinanceMutations({ workspace: 'personal' }))[0].attempts, 1);
  await removeFinanceMutation('later');
  assert.deepEqual((await listFinanceMutations()).map((item) => item.id), ['earlier']);
  await clearFinanceOutbox();
});

const queuedItem = (id: string, monthKey: string, lastError?: string) =>
    ({ id, monthKey, ...(lastError ? { lastError } : {}) });

test('skips pre-conflicted mutations and their month chain, keeps other months flushable', () => {
    const plan = planFlushAttempts([
      queuedItem('m1', '2026-07', 'conflict'),   // stuck head
      queuedItem('m2', '2026-07'),               // same month: must wait with it
      queuedItem('m3', '2026-08'),               // independent month: must flush
      queuedItem('m4', '2026-09'),               // independent month: must flush
    ]);
    assert.deepEqual(plan.attempt.map((item) => item.id), ['m3', 'm4']);
    assert.deepEqual(plan.reviewMonths, ['2026-07']);
  });

test('attempts everything when no mutation is conflicted', () => {
    const plan = planFlushAttempts([queuedItem('m1', '2026-07'), queuedItem('m2', '2026-08')]);
    assert.deepEqual(plan.attempt.map((item) => item.id), ['m1', 'm2']);
    assert.deepEqual(plan.reviewMonths, []);
  });

test('handles a conflict that appears mid-queue', () => {
    const plan = planFlushAttempts([
      queuedItem('m1', '2026-07'),
      queuedItem('m2', '2026-07', 'conflict'),
      queuedItem('m3', '2026-07'),  // follows the conflicted chain
      queuedItem('m4', '2026-08'),  // independent
    ]);
    assert.deepEqual(plan.attempt.map((item) => item.id), ['m1', 'm4']);
    assert.deepEqual(plan.reviewMonths, ['2026-07']);
  });

test('returns empty for an empty queue', () => {
    assert.deepEqual(planFlushAttempts([]), { attempt: [], reviewMonths: [] });
  });

/* ------------------------------------------------------------------------- *
 * Deleting a record the user added in this session.
 *
 * Firestore hands a document back with its fields in its own order, and the
 * merge only lets a deletion through when the cloud copy still matches the
 * base it was taken from. Compared as text, `name` before `amount` and
 * `amount` before `name` are two different objects with the same content, so
 * every delete - and every edit - of a freshly added row was reported as a
 * clash with another device, and the month's queue stuck behind it.
 * ------------------------------------------------------------------------- */
test('a deletion is not a conflict because the cloud spelled the record differently', () => {
  const added = { id: 'e1', name: 'Lunch', amount: 12, type: 'Groceries', date: '2026-09-02', place: 'bank' };
  const base = month({ bankPart: 88, placeBalances: { bank: 88 }, variableExpenses: [added] });
  const afterDelete = month({ bankPart: 100, placeBalances: { bank: 100 }, variableExpenses: [] });
  // What the document actually holds: same fields, Firestore's order, and the
  // default this app fills in on read.
  const remote = month({
    bankPart: 88,
    placeBalances: { bank: 88 },
    variableExpenses: [{ place: 'bank', date: '2026-09-02', amount: 12, name: 'Lunch', type: 'Groceries', id: 'e1', tags: [] }],
  });

  const merged = mergeMonthMutation(base, afterDelete, remote);
  assert.deepEqual(merged.variableExpenses, [], 'the deleted record stays deleted');
  assert.equal(merged.bankPart, 100, 'the money it was spent from comes back');
});

test('an explicit key the cloud dropped still counts as the same record', () => {
  const base = month({ variableExpenses: [{ id: 'e1', name: 'Lunch', amount: 12, type: 'Groceries', date: '2026-09-02', place: 'bank', note: undefined }] });
  const local = month({ variableExpenses: [] });
  const remote = month({ variableExpenses: [{ place: 'bank', date: '2026-09-02', amount: 12, name: 'Lunch', type: 'Groceries', id: 'e1' }] });
  assert.deepEqual(mergeMonthMutation(base, local, remote).variableExpenses, []);
});

test('a record the cloud really did change still needs review', () => {
  const base = month({ variableExpenses: [{ id: 'e1', name: 'Lunch', amount: 12, place: 'bank', type: 'Groceries', date: '2026-09-02' }] });
  const local = month({ variableExpenses: [] });
  const remote = month({ variableExpenses: [{ place: 'bank', date: '2026-09-02', name: 'Lunch', id: 'e1', amount: 99, type: 'Groceries' }] });
  assert.throws(
    () => mergeMonthMutation(base, local, remote),
    (error: unknown) => error instanceof FinanceConflictError
      && error.conflicts.some((item) => item.path === 'variableExpenses.e1'),
    'a deletion of something somebody else edited is their change to keep',
  );
});

test('savings goals are compared the same way as month records', () => {
  const baseGoal = { id: 'g1', name: 'Emergency', target: 1000, current: 200, source: 'bank' };
  const remoteGoal = { current: 200, target: 1000, name: 'Emergency', id: 'g1', source: 'bank' };
  assert.deepEqual(
    mergeGoalsMutation([baseGoal] as SavingGoal[], [] as SavingGoal[], [remoteGoal] as SavingGoal[]),
    [],
  );
  assert.throws(
    () => mergeGoalsMutation(
      [baseGoal] as SavingGoal[],
      [] as SavingGoal[],
      [{ ...remoteGoal, current: 300 }] as SavingGoal[],
    ),
    FinanceConflictError,
  );
});
