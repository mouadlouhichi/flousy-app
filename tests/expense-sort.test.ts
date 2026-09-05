import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sortVariableExpenses } from '../src/lib/expense-sort';

interface Sample {
  id: string;
  name: string;
  amount: number;
  date?: string;
}

/**
 * `addVariableExpense` prepends, so the array passed in already has the most
 * recently added expense first — that is the recency signal the tie-break uses.
 */
const list: Sample[] = [
  { id: 'new', name: 'Apple Store', amount: 20, date: '2026-09-05' }, // just added today
  { id: 'older-today-z', name: 'Zebra Cafe', amount: 30, date: '2026-09-05' },
  { id: 'older-today-b', name: 'Burger King', amount: 10, date: '2026-09-05' },
  { id: 'older-today-c', name: 'Carrefour', amount: 40, date: '2026-09-05' },
  { id: 'yesterday', name: 'AAA Bazaar', amount: 5, date: '2026-09-04' },
];

describe('sortVariableExpenses', () => {
  it('puts a just-added expense on top of its day under "newest" even when its name sorts first alphabetically', () => {
    const sorted = sortVariableExpenses(list, 'newest');
    assert.deepEqual(
      sorted.map((item) => item.id),
      ['new', 'older-today-z', 'older-today-b', 'older-today-c', 'yesterday'],
    );
  });

  it('orders same-day expenses by recency of addition, not by name', () => {
    // Even when the most recent addition has the alphabetically lowest name it
    // stays first; older same-day entries keep their add order below it.
    const sorted = sortVariableExpenses(list, 'newest');
    assert.strictEqual(sorted[0].id, 'new');
    assert.deepEqual(
      sorted.slice(0, 4).map((item) => item.name),
      ['Apple Store', 'Zebra Cafe', 'Burger King', 'Carrefour'],
    );
  });

  it('mirrors same-day recency for "oldest" (earliest added first)', () => {
    const sorted = sortVariableExpenses(list, 'oldest');
    assert.deepEqual(
      sorted.map((item) => item.id),
      ['yesterday', 'older-today-c', 'older-today-b', 'older-today-z', 'new'],
    );
  });

  it('sorts across days for newest / oldest', () => {
    assert.strictEqual(sortVariableExpenses(list, 'newest')[0].date, '2026-09-05');
    assert.strictEqual(sortVariableExpenses(list, 'oldest')[0].date, '2026-09-04');
  });

  it('honours amount and name modes', () => {
    const high = sortVariableExpenses(list, 'amountHigh').map((item) => item.id);
    assert.deepEqual(high, ['older-today-c', 'older-today-z', 'new', 'older-today-b', 'yesterday']);
    const low = sortVariableExpenses(list, 'amountLow').map((item) => item.id);
    assert.deepEqual(low, ['yesterday', 'older-today-b', 'new', 'older-today-z', 'older-today-c']);
    const byName = sortVariableExpenses(list, 'name').map((item) => item.id);
    assert.deepEqual(byName, ['yesterday', 'new', 'older-today-b', 'older-today-c', 'older-today-z']);
  });

  it('treats a missing date as the oldest possible date', () => {
    const noDate: Sample[] = [
      { id: 'dated', name: 'B', amount: 1, date: '2026-01-01' },
      { id: 'missing', name: 'A', amount: 1 },
    ];
    assert.deepEqual(
      sortVariableExpenses(noDate, 'newest').map((item) => item.id),
      ['dated', 'missing'],
    );
    assert.deepEqual(
      sortVariableExpenses(noDate, 'oldest').map((item) => item.id),
      ['missing', 'dated'],
    );
  });

  it('does not mutate the input array', () => {
    const snapshot = list.map((item) => ({ ...item }));
    sortVariableExpenses(list, 'newest');
    assert.deepEqual(list, snapshot);
  });
});
