import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FINANCE_BACKUP_FORMAT,
  InvalidFinanceBackupError,
  MAX_MONTH_BACKUP_BYTES,
  parseFinanceBackup,
} from '../src/lib/finance-backup';
import type { MonthBudget } from '../src/lib/store';

/** A well-formed month, shaped like exportFinanceBackup's normalized output. */
function validMonth(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    revision: 3,
    lastMutationId: 'mutation-1',
    periodKey: '2026-07',
    periodStartDay: 1,
    periodStartDate: '2026-07-01',
    periodEndDate: '2026-07-31',
    currency: 'MAD',
    periodStatus: 'open',
    totalBudget: 5000,
    incomeSources: [
      {
        id: 'main-income',
        name: 'Primary Income',
        amount: 5000,
        status: 'paid',
        receivedAmount: 5000,
        recurring: true,
      },
    ],
    bankPart: 5000,
    homePart: 0,
    walletPart: 0,
    strategyId: '50-30-20',
    categoryEnvelopes: { Rent: 'needs' },
    monthlySavingsTarget: 1000,
    variableExpenses: [
      { id: 'v1', name: 'Coffee', amount: 12, type: 'Dining Out', date: '2026-07-02', place: 'wallet' },
    ],
    fixedExpenses: [
      {
        id: 'f1', name: 'Rent', amount: 900, type: 'Rent', date: '1st', place: 'bank',
        status: 'paid', paidAmount: 900, templateId: 'f1', recurring: true, person: 'Self',
      },
    ],
    variableCategoryBases: {},
    fixedCategoryBases: {},
    activeCategories: ['Rent'],
    categoryColors: { Rent: '#8b5cf6' },
    categoryIcons: {},
    debts: [
      {
        id: 'd1', name: 'Ali', amount: 200, type: 'debt', status: 'open', date: '2026-07-01',
        payments: [{ id: 'p1', amount: 50, date: '2026-07-02', place: 'bank' }],
      },
    ],
    transfers: [
      { id: 't1', from: 'bank', to: 'wallet', amount: 100, date: '2026-07-03T10:00:00.000Z' },
    ],
    // Signed delta that reconciles: the balance dropped by exactly 50.
    balanceAdjustments: [
      {
        id: 'a1', place: 'home', previousBalance: 300, newBalance: 250, delta: -50,
        reason: 'reconciliation', date: '2026-07-03T10:00:00.000Z',
      },
    ],
    savingsActivity: [
      { id: 's1', goalId: 'g1', goalName: 'Bike', type: 'deposit', amount: 100, date: '2026-07-03T10:00:00.000Z', place: 'bank' },
    ],
    updatedAt: '2026-07-20T10:00:00.000Z',
    updatedByUserId: 'user-1',
  };
}

function validBackup(): Record<string, unknown> {
  return {
    format: FINANCE_BACKUP_FORMAT,
    version: 1,
    id: 'backup-1',
    exportedAt: '2026-08-01T00:00:00.000Z',
    workspace: { type: 'personal', id: 'user-1' },
    configuration: {
      // Finance-only keys survive; identity/entitlement keys must not.
      currency: 'MAD',
      theme: 'dark',
      language: 'en',
      monthStartDate: 1,
      moneyPlaces: [{ id: 'bank', name: 'Bank', icon: 'account_balance' }],
      activeCategories: ['Rent'],
      plan: 'pro',
      displayName: 'Should Be Stripped',
      householdIds: ['household-1'],
      entitlementSource: 'stripe',
    },
    months: { '2026-07': validMonth() },
    goals: [
      { id: 'g1', name: 'Bike', target: 1000, current: 100, source: 'bank', active: true },
    ],
    products: [
      {
        barcode: '6111234567890', name: 'Milk', source: 'manual',
        createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-02T00:00:00.000Z',
      },
    ],
    sessions: [
      {
        id: 'sess-1', status: 'completed', startedAt: '2026-07-02T18:00:00.000Z',
        endedAt: '2026-07-02T18:30:00.000Z', date: '2026-07-02', currency: 'MAD', place: 'wallet',
        items: [
          { key: '6111234567890', barcode: '6111234567890', name: 'Milk', qty: 2, unitPrice: 8.5, lineTotal: 17 },
        ],
        total: 17,
      },
    ],
  };
}

function serialize(backup: Record<string, unknown>): string {
  return JSON.stringify(backup);
}

function expectRejected(json: Record<string, unknown>, fragment: string) {
  assert.throws(
    () => parseFinanceBackup(serialize(json)),
    (err: unknown) => {
      assert.ok(err instanceof InvalidFinanceBackupError);
      assert.match(err.message, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      return true;
    },
    `expected rejection mentioning "${fragment}"`,
  );
}

describe('Finance backup deep validation (M1)', () => {
  it('accepts a well-formed backup and keeps finance-only configuration', () => {
    const parsed = parseFinanceBackup(serialize(validBackup()));
    assert.strictEqual(Object.keys(parsed.months).length, 1);
    const month = parsed.months['2026-07'] as MonthBudget;
    assert.strictEqual(month.totalBudget, 5000);
    assert.strictEqual(month.balanceAdjustments?.[0].delta, -50);
    assert.strictEqual(parsed.goals.length, 1);
    assert.strictEqual(parsed.products?.length, 1);
    assert.strictEqual(parsed.sessions?.length, 1);

    const config = parsed.configuration as Record<string, unknown>;
    assert.strictEqual(config.currency, 'MAD');
    assert.strictEqual(config.theme, 'dark');
    assert.strictEqual(config.monthStartDate, 1);
    assert.deepStrictEqual(config.moneyPlaces, [{ id: 'bank', name: 'Bank', icon: 'account_balance' }]);
    // Identity and entitlement material never rides in through a backup.
    assert.ok(!('plan' in config));
    assert.ok(!('displayName' in config));
    assert.ok(!('householdIds' in config));
    assert.ok(!('entitlementSource' in config));
  });

  it('rejects non-JSON payloads and foreign formats', () => {
    assert.throws(() => parseFinanceBackup('not json'), InvalidFinanceBackupError);
    const wrongFormat = validBackup();
    wrongFormat.format = 'some-other-tool';
    expectRejected(wrongFormat, 'Unsupported or incomplete');
  });

  it('rejects malformed month keys', () => {
    const backup = validBackup();
    backup.months = { '2026-7': validMonth() };
    expectRejected(backup, 'Invalid month entry');
  });

  it('rejects unknown fields inside a month document', () => {
    const backup = validBackup();
    (backup.months as Record<string, unknown>)['2026-07'] = { ...validMonth(), evilKey: true };
    expectRejected(backup, 'unsupported field: evilKey');
  });

  it('rejects duplicate entity ids inside one collection', () => {
    const backup = validBackup();
    const month = validMonth();
    month.variableExpenses = [
      { id: 'v1', name: 'A', amount: 1, type: 'Rent', date: '2026-07-01', place: 'bank' },
      { id: 'v1', name: 'B', amount: 2, type: 'Rent', date: '2026-07-01', place: 'bank' },
    ];
    (backup.months as Record<string, unknown>)['2026-07'] = month;
    expectRejected(backup, 'duplicate id: v1');
  });

  it('rejects duplicate session line keys and product barcodes', () => {
    const line = { key: 'k1', name: 'Milk', qty: 1, unitPrice: 5, lineTotal: 5 };
    const duplicateLines = {
      ...validBackup(),
      sessions: [{
        id: 'sess-1', status: 'completed', startedAt: '2026-07-02T18:00:00.000Z',
        date: '2026-07-02', currency: 'MAD', place: 'wallet', items: [line, { ...line }], total: 10,
      }],
    };
    expectRejected(duplicateLines, 'duplicate key: k1');

    const product = {
      barcode: '6111234567890', name: 'Milk', source: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    };
    expectRejected({ ...validBackup(), products: [product, { ...product }] }, 'duplicate barcode');
  });

  it('enforces lifecycle money semantics on income and fixed charges', () => {
    const overReceived = validBackup();
    overReceived.months = {
      '2026-07': {
        ...validMonth(),
        incomeSources: [{ id: 'i1', name: 'Salary', amount: 100, status: 'paid', receivedAmount: 150 }],
      },
    };
    expectRejected(overReceived, 'cannot exceed the expected amount');

    const plannedWithProgress = validBackup();
    plannedWithProgress.months = {
      '2026-07': {
        ...validMonth(),
        incomeSources: [{ id: 'i1', name: 'Salary', amount: 100, status: 'planned', receivedAmount: 40 }],
      },
    };
    expectRejected(plannedWithProgress, 'records progress on a planned record');

    const overPaid = validBackup();
    overPaid.months = {
      '2026-07': {
        ...validMonth(),
        fixedExpenses: [{ id: 'f1', name: 'Rent', amount: 100, type: 'Rent', place: 'bank', status: 'partial', paidAmount: 101 }],
      },
    };
    expectRejected(overPaid, 'cannot exceed the expected amount');
  });

  it('rejects non-reconciling balance adjustments', () => {
    const backup = validBackup();
    backup.months = {
      '2026-07': {
        ...validMonth(),
        balanceAdjustments: [{
          id: 'a1', place: 'home', previousBalance: 300, newBalance: 250, delta: -70,
          reason: 'reconciliation', date: '2026-07-03T10:00:00.000Z',
        }],
      },
    };
    expectRejected(backup, 'does not reconcile');
  });

  it('rejects debt payment histories that mint cash', () => {
    const backup = validBackup();
    backup.months = {
      '2026-07': {
        ...validMonth(),
        debts: [{
          id: 'd1', name: 'Ali', amount: 100, type: 'debt', status: 'open', date: '2026-07-01',
          payments: [
            { id: 'p1', amount: 80, date: '2026-07-02', place: 'bank' },
            { id: 'p2', amount: 40, date: '2026-07-03', place: 'bank' },
          ],
        }],
      },
    };
    expectRejected(backup, 'payments exceed the original amount');
  });

  it('rejects transfers that move money inside one place', () => {
    const backup = validBackup();
    backup.months = {
      '2026-07': {
        ...validMonth(),
        transfers: [{ id: 't1', from: 'bank', to: 'bank', amount: 10, date: '2026-07-03T10:00:00.000Z' }],
      },
    };
    expectRejected(backup, 'two different money places');
  });

  it('rejects custom ratios that do not sum to 1', () => {
    const backup = validBackup();
    backup.months = {
      '2026-07': {
        ...validMonth(),
        strategyId: 'custom',
        customRatios: { needs: 0.5, wants: 0.3, savings: 0.3 },
      },
    };
    expectRejected(backup, 'summing to 1');
  });

  it('rejects closed periods without an audit trail', () => {
    const backup = validBackup();
    backup.months = { '2026-07': { ...validMonth(), periodStatus: 'closed' } };
    expectRejected(backup, 'closedAt and closedByUserId');
  });

  it('enforces the Firestore money bound (max 1e9)', () => {
    const backup = validBackup();
    backup.months = { '2026-07': { ...validMonth(), totalBudget: 2_000_000_000 } };
    expectRejected(backup, 'between 0 and 1000000000');
  });

  it('rejects session line and bill totals that disagree with their lines', () => {
    const badLine = validBackup();
    badLine.sessions = [{
      id: 'sess-1', status: 'completed', startedAt: '2026-07-02T18:00:00.000Z',
      date: '2026-07-02', currency: 'MAD', place: 'wallet',
      items: [{ key: 'k1', name: 'Milk', qty: 2, unitPrice: 8.5, lineTotal: 18 }],
      total: 18,
    }];
    expectRejected(badLine, 'qty × unitPrice');

    const badTotal = validBackup();
    badTotal.sessions = [{
      id: 'sess-1', status: 'completed', startedAt: '2026-07-02T18:00:00.000Z',
      date: '2026-07-02', currency: 'MAD', place: 'wallet',
      items: [{ key: 'k1', name: 'Milk', qty: 2, unitPrice: 8.5, lineTotal: 17 }],
      total: 20,
    }];
    expectRejected(badTotal, 'sum of line totals');
  });

  it('rejects malformed product barcodes', () => {
    const backup = validBackup();
    backup.products = [{
      barcode: '1234', name: 'Milk', source: 'manual',
      createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    }];
    expectRejected(backup, '8 or 13 digits');
  });

  it('rejects collections above their safety cardinality', () => {
    const tooManyGoals = validBackup();
    tooManyGoals.goals = Array.from({ length: 201 }, (_, i) => ({
      id: `g-${i}`, name: `Goal ${i}`, target: 100, current: 0, source: 'bank', active: true,
    }));
    expectRejected(tooManyGoals, 'at most 200 entries');
  });

  it('rejects months above the conservative document-size ceiling', () => {
    const backup = validBackup();
    const filler = Array.from({ length: 2000 }, (_, i) => ({
      id: `v-${i}`,
      name: `Expense number ${i} with a longer descriptive name`,
      amount: 10,
      type: 'Rent',
      date: '2026-07-02',
      place: 'bank',
      note: 'x'.repeat(400),
    }));
    backup.months = { '2026-07': { ...validMonth(), variableExpenses: filler } };
    const serialized = serialize(backup);
    assert.ok(serialized.length > MAX_MONTH_BACKUP_BYTES);
    assert.throws(() => parseFinanceBackup(serialized), InvalidFinanceBackupError);
  });

  it('accepts a normalized empty month (zero budget, default income semantics)', () => {
    const backup = validBackup();
    backup.months = {
      '2026-07': {
        ...validMonth(),
        totalBudget: 0,
        incomeSources: [{ id: 'main-income', name: 'Primary Income', amount: 0, status: 'paid' }],
        bankPart: 0,
        monthlySavingsTarget: 0,
      },
    };
    const parsed = parseFinanceBackup(serialize(backup));
    assert.strictEqual((parsed.months['2026-07'] as MonthBudget).totalBudget, 0);
    // Absent receivedAmount on a paid source defaults to its full amount (0).
    assert.strictEqual(parsed.months['2026-07'].incomeSources?.[0].receivedAmount, 0);
  });

  it('sanitizes configuration shapes instead of trusting them', () => {
    const backup = validBackup();
    (backup.configuration as Record<string, unknown>).moneyPlaces = [
      { id: 'bank', name: 'Bank', icon: 'account_balance', ownerId: 'evil' },
    ];
    expectRejected(backup, 'unsupported field: ownerId');

    const backup2 = validBackup();
    (backup2.configuration as Record<string, unknown>).defaultCategoryBudgets = { Rent: -5 };
    expectRejected(backup2, 'between 0 and 1000000000');
  });
});
