import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText } from '../src/lib/receipt-ocr';
import { buildReportModel, renderReportHtml } from '../src/lib/report';
import { searchTransactions, suggestCategory } from '../src/lib/insights';
import { createNewMonth } from '../src/lib/store';

const emptyMonth = (key: string) => createNewMonth(8000, '50-30-20', ['Groceries', 'Transport', 'Food'], [], key);

describe('receipt OCR parsing', () => {
  it('extracts the total, date and merchant from a French receipt', () => {
    const parsed = parseReceiptText([
      'MARJANE CALIFORNIE',
      'Casablanca',
      '12/03/2026 18:42',
      'LAIT 1L        2 x 7.50   15.00',
      'PAIN                       2.00',
      'SOUS TOTAL                17.00',
      'TOTAL TTC                 17.00 DH',
      'ESPECES                   20.00',
      'RENDU                      3.00',
    ].join('\n'));
    assert.equal(parsed.total, 17);
    assert.equal(parsed.date, '2026-03-12');
    assert.match(parsed.merchant || '', /MARJANE/i);
  });

  it('falls back to the largest plausible amount when no total keyword exists', () => {
    const parsed = parseReceiptText('Cafe 12,00\nEau 6,00\n18,00');
    assert.equal(parsed.total, 18);
  });
});

describe('merchant category suggestion', () => {
  it('suggests the category most often used for a similar name', () => {
    const history = [
      { name: 'Marjane', type: 'Groceries' },
      { name: 'marjane californie', type: 'Groceries' },
      { name: 'Marjane', type: 'Shopping' },
    ];
    assert.equal(suggestCategory('MARJANE', history), 'Groceries');
    assert.equal(suggestCategory('Unknown place', history), null);
  });
});

describe('global search', () => {
  it('finds expenses across months by name, tag and category', () => {
    const a = emptyMonth('2026-01');
    a.variableExpenses = [{ id: '1', name: 'Taxi aéroport', amount: 150, place: 'Wallet', type: 'Transport', date: '2026-01-04', tags: ['voyage'] }];
    const b = emptyMonth('2026-02');
    b.variableExpenses = [{ id: '2', name: 'Carrefour', amount: 300, place: 'Bank', type: 'Groceries', date: '2026-02-10' }];
    const corpus = [{ monthKey: '2026-01', month: a }, { monthKey: '2026-02', month: b }];
    assert.equal(searchTransactions(corpus, 'voyage').length, 1);
    assert.equal(searchTransactions(corpus, 'taxi')[0]?.monthKey, '2026-01');
    assert.equal(searchTransactions(corpus, 'groceries').length, 1);
    assert.equal(searchTransactions(corpus, '').length, 0);
  });
});

describe('monthly report', () => {
  it('builds a model and renders escaped HTML', () => {
    const month = emptyMonth('2026-03');
    month.variableExpenses = [{ id: '1', name: '<b>Café</b>', amount: 20, place: 'Wallet', type: 'Food', date: '2026-03-02' }];
    const model = buildReportModel(month, [], {
      periodLabel: 'March 2026',
      strategyName: '50/30/20',
      envelopeNames: { needs: 'Needs', wants: 'Wants', savings: 'Savings' },
      categoryName: (n) => n,
      statusName: (s) => s,
    });
    assert.equal(model.spent, 20);
    const html = renderReportHtml(model, {
      title: 'Report', period: 'Period', income: 'Income', spent: 'Spent', saved: 'Saved', leftover: 'Left',
      envelopes: 'Envelopes', categories: 'Categories', bills: 'Bills', goals: 'Goals', netWorth: 'Net worth',
      assets: 'Assets', liabilities: 'Liabilities', budget: 'Budget', status: 'Status', category: 'Category',
      amount: 'Amount', name: 'Name', generatedBy: 'Generated {date}', needs: 'Needs', wants: 'Wants', savings: 'Savings',
    }, (v) => `${v} MAD`, { dir: 'ltr', lang: 'en', generatedAt: '2026-03-31' });
    assert.ok(html.includes('dir="ltr"'));
    assert.ok(!html.includes('<b>Café</b>') || html.includes('&lt;b&gt;'));
    assert.ok(html.includes('Generated 2026-03-31'));
  });
});

describe('custom reports', () => {
  const a = emptyMonth('2026-01');
  a.variableExpenses = [
    { id: '1', name: 'Taxi', amount: 100, place: 'Wallet', type: 'Transport', date: '2026-01-04', tags: ['voyage'], payerMemberId: 'm1' },
    { id: '2', name: 'Hotel', amount: 900, place: 'Bank', type: 'Travel', date: '2026-01-05', tags: ['voyage', 'work'], payerMemberId: 'm2' },
    { id: '3', name: 'Marjane', amount: 300, place: 'Bank', type: 'Groceries', date: '2026-01-10', payerMemberId: 'm1' },
  ];
  a.fixedExpenses = [{ id: 'f1', name: 'Rent', amount: 3000, type: 'Rent', dueDay: 1, status: 'paid', paidAmount: 3000 } as never];

  it('groups by place, tag and member with correct totals', async () => {
    const { buildCustomReport, reportDimensionValues } = await import('../src/lib/insights');
    const byPlace = buildCustomReport([a], { dimension: 'place' });
    assert.equal(byPlace.total, 1300); // fixed bills carry no place
    assert.equal(byPlace.rows[0]?.key, 'Bank');
    assert.equal(byPlace.rows[0]?.amount, 1200);

    const byTag = buildCustomReport([a], { dimension: 'tag', scope: 'variable' });
    assert.equal(byTag.rows.find((r) => r.key === 'voyage')?.amount, 1000);
    assert.equal(byTag.rows.find((r) => r.key === '—')?.amount, 300);

    const byMember = buildCustomReport([a], { dimension: 'member' });
    assert.equal(byMember.rows.find((r) => r.key === 'm1')?.amount, 400);
    assert.equal(byMember.total, 4300);
    // A bill nobody attributed defaults to the recorder: rent lands in the
    // single canonical 'self' bucket (the expense modal's default payer).
    assert.equal(byMember.rows.find((r) => r.key === 'self')?.amount, 3000);

    const filtered = buildCustomReport([a], { dimension: 'member', filters: { tag: 'voyage' } });
    assert.equal(filtered.total, 1000);
    assert.deepEqual(reportDimensionValues([a], 'tag'), ['voyage', 'work']);
  });

  it('folds every self spelling and uid stamp into one member row', async () => {
    const { buildCustomReport, reportDimensionValues } = await import('../src/lib/insights');
    // One person, five historical spellings: the localized labels the modal
    // stored ('Me', 'Moi'), the legacy 'Self', the literal 'self' payer, and
    // their own roster id — plus an import that stamped the account uid.
    const m = emptyMonth('2026-02');
    m.variableExpenses = [
      { id: '1', name: 'A', amount: 10, place: 'Bank', type: 'Groceries', date: '2026-02-01', person: 'Me' },
      { id: '2', name: 'B', amount: 20, place: 'Bank', type: 'Groceries', date: '2026-02-02', person: 'Moi' },
      { id: '3', name: 'C', amount: 30, place: 'Bank', type: 'Groceries', date: '2026-02-03', person: 'Self' },
      { id: '4', name: 'D', amount: 40, place: 'Bank', type: 'Groceries', date: '2026-02-04', payerMemberId: 'self' },
      { id: '5', name: 'E', amount: 50, place: 'Bank', type: 'Groceries', date: '2026-02-05', payerMemberId: 'own-1' },
      { id: '6', name: 'F', amount: 60, place: 'Bank', type: 'Groceries', date: '2026-02-06', payerMemberId: 'uid-abc' },
      { id: '7', name: 'G', amount: 70, place: 'Bank', type: 'Groceries', date: '2026-02-07', payerMemberId: 'household' },
    ] as never;
    const payers = { selfMemberId: 'own-1', memberIdByUserId: { 'uid-abc': 'own-1' } };
    const report = buildCustomReport([m], { dimension: 'member', payers });
    assert.equal(report.rows.length, 2); // one 'self' row + the pooled row
    assert.equal(report.rows.find((r) => r.key === 'self')?.amount, 210);
    assert.equal(report.rows.find((r) => r.key === 'household')?.amount, 70);
    // The filter picker lists the same canonical keys, not the raw spellings.
    assert.deepEqual(reportDimensionValues([m], 'member', payers), ['household', 'self']);
  });

  it('exposes previous-window amounts for deltas', async () => {
    const { buildCustomReport } = await import('../src/lib/insights');
    const prev = emptyMonth('2025-12');
    prev.variableExpenses = [{ id: 'p', name: 'Taxi', amount: 50, place: 'Wallet', type: 'Transport', date: '2025-12-04' }];
    const report = buildCustomReport([a], { dimension: 'place', previousMonths: [prev] });
    assert.equal(report.previous.get('Wallet'), 50);
  });
});

describe('shared goal contributions', () => {
  it('attributes deposits to the acting member and nets withdrawals', async () => {
    const { fundGoal, withdrawGoal } = await import('../src/lib/store');
    type SavingGoal = import('../src/lib/store').SavingGoal;
    const { goalContributions } = await import('../src/components/tabs/SavingsTab');
    let month = emptyMonth('2026-03');
    month.bankPart = 5000;
    let goals: SavingGoal[] = [{ id: 'g', name: 'Trip', target: 3000, current: 0, source: 'bank', active: true }];
    ({ month, goals } = fundGoal(month, goals, 'g', 1000, 'bank', { memberId: 'm1', name: 'Sara' }));
    ({ month, goals } = fundGoal(month, goals, 'g', 500, 'bank', { memberId: 'm2', name: 'Youssef' }));
    ({ month, goals } = withdrawGoal(month, goals, 'g', 200, 'bank', { memberId: 'm1', name: 'Sara' }));
    const split = goalContributions([month], 'g');
    assert.deepEqual(split.map((c) => [c.name, c.amount]), [['Sara', 800], ['Youssef', 500]]);
  });
});
