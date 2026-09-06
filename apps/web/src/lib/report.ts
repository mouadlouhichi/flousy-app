/**
 * Monthly PDF report — rendered as a self-contained, print-styled HTML
 * document and handed to the browser's print dialog ("Save as PDF"). No
 * third-party PDF engine, so the bundle stays small and the output honours
 * RTL and every locale's number formatting for free.
 *
 * `buildReportModel` is pure and unit-tested; `renderReportHtml` only turns
 * the model into escaped markup.
 */
import {
  type MonthBudget,
  type SavingGoal,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateReceivedIncome,
  calculateCategorySpent,
  calculateMonthlyDepositedSavings,
  fixedPaidAmount,
  resolveMonthStrategy,
} from './store';
import { calculateNetWorth, type NetWorthSnapshot } from './insights';

export interface ReportModel {
  periodLabel: string;
  income: number;
  spent: number;
  saved: number;
  leftover: number;
  strategyName: string;
  envelopes: Array<{ name: string; budget: number; spent: number }>;
  categories: Array<{ name: string; spent: number; budget: number | null }>;
  bills: Array<{ name: string; category: string; amount: number; paid: number; status: string }>;
  goals: Array<{ name: string; current: number; target: number }>;
  netWorth: NetWorthSnapshot;
}

export interface ReportLabels {
  title: string;
  period: string;
  income: string;
  spent: string;
  saved: string;
  leftover: string;
  envelopes: string;
  categories: string;
  bills: string;
  goals: string;
  netWorth: string;
  assets: string;
  liabilities: string;
  budget: string;
  status: string;
  category: string;
  amount: string;
  name: string;
  generatedBy: string;
  needs: string;
  wants: string;
  savings: string;
}

export function buildReportModel(
  month: MonthBudget,
  goals: SavingGoal[],
  options: {
    periodLabel: string;
    strategyName: string;
    envelopeNames: { needs: string; wants: string; savings: string };
    categoryName: (name: string) => string;
    statusName: (status: string) => string;
  },
): ReportModel {
  const { needs, wants, savings } = calculateEnvelopeAmounts(month.totalBudget || 0, month.strategyId, month.customRatios);
  const spentBy = calculateEnvelopeSpent(month);
  const income = calculateReceivedIncome(month);
  const saved = calculateMonthlyDepositedSavings(month);
  const spent = spentBy.totalSpent;

  const categories = (month.activeCategories || [])
    .map((name) => ({
      name: options.categoryName(name),
      spent: calculateCategorySpent(month, name),
      budget: month.categoryBudgets?.[name] ?? null,
    }))
    .filter((c) => c.spent > 0 || c.budget)
    .sort((a, b) => b.spent - a.spent);

  const bills = (month.fixedExpenses || []).map((bill) => ({
    name: bill.name,
    category: options.categoryName(bill.type),
    amount: bill.amount,
    paid: fixedPaidAmount(bill),
    status: options.statusName(bill.status || 'paid'),
  }));

  return {
    periodLabel: options.periodLabel,
    income,
    spent,
    saved,
    leftover: Math.round((income - spent - saved) * 100) / 100,
    strategyName: options.strategyName,
    envelopes: [
      { name: options.envelopeNames.needs, budget: needs, spent: spentBy.needs },
      { name: options.envelopeNames.wants, budget: wants, spent: spentBy.wants },
      { name: options.envelopeNames.savings, budget: savings, spent: saved },
    ],
    categories,
    bills,
    goals: goals.filter((g) => g.active).map((g) => ({ name: g.name, current: g.current, target: g.target })),
    netWorth: calculateNetWorth(month, goals),
  };
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderReportHtml(
  model: ReportModel,
  labels: ReportLabels,
  format: (value: number) => string,
  options: { dir: 'ltr' | 'rtl'; lang: string; generatedAt: string; appName?: string },
): string {
  const appName = options.appName || 'SmartJib';
  const row = (cells: string[], cls = '') => `<tr class="${cls}">${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  const num = (v: number) => `<span class="num">${esc(format(v))}</span>`;
  const bar = (spent: number, budget: number) => {
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    return `<div class="bar"><i style="width:${pct}%" class="${pct >= 100 ? 'over' : ''}"></i></div>`;
  };

  const strategy = model.strategyName;

  return `<!doctype html>
<html lang="${esc(options.lang)}" dir="${options.dir}">
<head>
<meta charset="utf-8">
<title>${esc(appName)} · ${esc(labels.title)} · ${esc(model.periodLabel)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", Arial, sans-serif; color: #10201d; margin: 0; padding: 32px; background: #fff; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 28px 0 8px; text-transform: uppercase; letter-spacing: .08em; color: #4a625d; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #00685f; padding-bottom: 12px; }
  .brand { color: #00685f; font-weight: 800; font-size: 16px; }
  .muted { color: #4a625d; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
  .kpi { border: 1px solid #c4cbc8; border-radius: 12px; padding: 10px 12px; }
  .kpi b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #4a625d; }
  .kpi span { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 8px; border-bottom: 1px solid #e3e8e6; text-align: start; vertical-align: middle; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #4a625d; }
  .num { font-variant-numeric: tabular-nums; font-weight: 600; white-space: nowrap; }
  .bar { height: 6px; background: #e3e8e6; border-radius: 99px; overflow: hidden; min-width: 90px; }
  .bar i { display: block; height: 100%; background: #00685f; }
  .bar i.over { background: #ba1a1a; }
  .neg { color: #ba1a1a; }
  footer { margin-top: 32px; font-size: 11px; color: #4a625d; border-top: 1px solid #e3e8e6; padding-top: 10px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<header>
  <div>
    <div class="brand">${esc(appName)}</div>
    <h1>${esc(labels.title)}</h1>
    <div class="muted">${esc(labels.period)}: ${esc(model.periodLabel)} · ${esc(strategy)}</div>
  </div>
</header>

<div class="kpis">
  <div class="kpi"><b>${esc(labels.income)}</b><span>${esc(format(model.income))}</span></div>
  <div class="kpi"><b>${esc(labels.spent)}</b><span>${esc(format(model.spent))}</span></div>
  <div class="kpi"><b>${esc(labels.saved)}</b><span>${esc(format(model.saved))}</span></div>
  <div class="kpi"><b>${esc(labels.leftover)}</b><span class="${model.leftover < 0 ? 'neg' : ''}">${esc(format(model.leftover))}</span></div>
</div>

<h2>${esc(labels.envelopes)}</h2>
<table>
  <thead><tr><th>${esc(labels.name)}</th><th>${esc(labels.spent)}</th><th>${esc(labels.budget)}</th><th></th></tr></thead>
  <tbody>${model.envelopes.map((e) => row([esc(e.name), num(e.spent), num(e.budget), bar(e.spent, e.budget)])).join('')}</tbody>
</table>

${model.categories.length ? `<h2>${esc(labels.categories)}</h2>
<table>
  <thead><tr><th>${esc(labels.category)}</th><th>${esc(labels.spent)}</th><th>${esc(labels.budget)}</th><th></th></tr></thead>
  <tbody>${model.categories.map((c) => row([esc(c.name), num(c.spent), c.budget ? num(c.budget) : '—', c.budget ? bar(c.spent, c.budget) : ''])).join('')}</tbody>
</table>` : ''}

${model.bills.length ? `<h2>${esc(labels.bills)}</h2>
<table>
  <thead><tr><th>${esc(labels.name)}</th><th>${esc(labels.category)}</th><th>${esc(labels.amount)}</th><th>${esc(labels.status)}</th></tr></thead>
  <tbody>${model.bills.map((b) => row([esc(b.name), esc(b.category), num(b.amount), esc(b.status)])).join('')}</tbody>
</table>` : ''}

${model.goals.length ? `<h2>${esc(labels.goals)}</h2>
<table>
  <thead><tr><th>${esc(labels.name)}</th><th>${esc(labels.saved)}</th><th>${esc(labels.budget)}</th><th></th></tr></thead>
  <tbody>${model.goals.map((g) => row([esc(g.name), num(g.current), num(g.target), bar(g.current, g.target)])).join('')}</tbody>
</table>` : ''}

<h2>${esc(labels.netWorth)}</h2>
<table>
  <tbody>
    ${row([esc(labels.assets), num(model.netWorth.assets)])}
    ${row([esc(labels.liabilities), num(model.netWorth.liabilities)])}
    ${row([`<b>${esc(labels.netWorth)}</b>`, `<b class="${model.netWorth.net < 0 ? 'neg' : ''}">${esc(format(model.netWorth.net))}</b>`])}
  </tbody>
</table>

<footer>${esc(labels.generatedBy.replace('{date}', options.generatedAt))}</footer>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},150)})</script>
</body>
</html>`;
}

/** Open the report in a new tab and trigger the print dialog. */
export function openPrintableReport(html: string): boolean {
  if (typeof window === 'undefined') return false;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
