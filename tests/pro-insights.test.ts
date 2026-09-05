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
