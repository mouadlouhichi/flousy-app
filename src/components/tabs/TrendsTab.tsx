'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState } from 'react';
import Link from 'next/link';
import { MonthBudget, UserProfile, calculateEnvelopeAmounts, calculateEnvelopeSpent, calculateSavingsRate, calculateTotalIncome, fixedPaidAmount, resolveMonthStrategy, totalCashOnHand } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { useHousehold } from '../../lib/household-context';
import { AMOUNT_AREA } from '@/lib/household-rbac';
import { canShowProUpgrade, isProFeatureUnlocked } from '../../lib/household';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizeIncomeSourceName, localizePersonName, localizeStrategy, payerKey } from '@/lib/localized-labels';
import { cn } from '@/lib/utils';
import { CustomReportCard } from '../dashboard/custom-report-card';
import { BalanceOverviewRing, type RingView } from '../dashboard/balance-overview-ring';
import { normalizeSeries } from '../charts/sparkline-path';
import { calculateSafeToSpend } from '@/lib/insights';
import { MoneyFigure } from '@/components/ui/money-figure';
import dynamic from 'next/dynamic';

/**
 * Recharts (~500 KB) is the heaviest dashboard dependency, and the trends
 * route is prefetched from the overview nav — a static import would make
 * every overview visit download and parse it (Lighthouse `unused-javascript`
 * on /dashboard). Loaded on demand instead; the chart is an aria-hidden
 * visual double of the table below, so the skeleton is a11y-neutral.
 */
const MonthTrendChart = dynamic(
  () => import('../charts/month-trend-chart').then((m) => m.MonthTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full animate-pulse rounded-2xl bg-surface-variant/30" aria-hidden="true" />
    ),
  },
);

interface TrendsTabProps {
  month: MonthBudget;
  trendsMonths: { monthKey: string; month: MonthBudget }[];
  trendsLoading: boolean;
  profile: UserProfile | null;
  onOpenProModal: () => void;
  /** Selected history window; switching triggers a provider refetch. */
  trendsMonthCount?: 6 | 12;
  onSetTrendsMonthCount?: (count: 6 | 12) => void;
}

// Forest & Lime series palette: token-driven first (so dark mode follows),
// then a few tonal fallbacks for long category lists.
const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-4)',
  'var(--tertiary)', 'var(--chart-3)', 'var(--secondary)', 'var(--sage)',
  '#5c8f6a', '#b9925a', '#7fb069', '#2f6b5f',
  '#d4b483', '#93b58a', '#1a4f48', '#a9d383',
];

/** Section header shared by every analytics card (icon puck + title). */
function SectionHeader({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
          <AppIcon name={icon} strokeWidth={2.2} className="text-[15px]" />
        </span>
        <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-on-surface">{title}</h3>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

const CARD = 'rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient sm:p-6';

export function TrendsTab({ month, trendsMonths, trendsLoading, profile, onOpenProModal, trendsMonthCount = 6, onSetTrendsMonthCount }: TrendsTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale, isRTL } = useLanguage();
  const { workspace, household, members, canViewArea } = useHousehold();
  // Analytics is a roll-up of the other areas: each card is filtered by the
  // area that owns its numbers, so an analytics grant on its own does not
  // expose balances or income sources to a member who lacks those.
  const canSeeBalances = canViewArea(AMOUNT_AREA.totalCashOnHand);
  const canSeeIncome = canViewArea(AMOUNT_AREA.incomeSource);
  const canSeeExpenses = canViewArea(AMOUNT_AREA.variableExpense);
  const canSeeFixedBills = canViewArea(AMOUNT_AREA.fixedBill);
  const canSeeSavings = canViewArea(AMOUNT_AREA.savingsGoal);
  /** Placeholder shown in place of a figure the member may not see. */
  const redacted = '••••';

  const isPro = isProUser(profile);
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const proUnlocked = isProFeatureUnlocked(isPro, workspace, household);
  const hasMultiMonth = trendsMonths.length > 0;

  // ── Current month calculations ──
  const spent = calculateEnvelopeSpent(month);
  const strategy = resolveMonthStrategy(month);
  const strategyCopy = localizeStrategy(strategy.id, m, intlLocale);
  // Same total the Overview shows — custom money places included.
  const totalCash = totalCashOnHand(month);

  // ── Income sources analytics ──
  const incomeSources = month.incomeSources || [];
  const totalIncome = calculateTotalIncome(month);

  // ── Category breakdown ──
  const categoryBreakdown: Record<string, number> = {};
  (month.variableExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + exp.amount;
  });
  (month.fixedExpenses || []).forEach((exp) => {
    categoryBreakdown[exp.type] = (categoryBreakdown[exp.type] || 0) + fixedPaidAmount(exp);
  });
  const sortedCategories = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]);

  // ── Person breakdown ──
  // Grouped by the canonical payer key, not the raw `person` snapshot: the
  // expense modal stores the *localized* payer label ("Me" / "Moi" / "أنا"),
  // older rows say "Self", and imports may carry the member id — all of which
  // are one person. Member ids resolve to the roster's display names.
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
  const personBreakdown: Record<string, { label: string; variable: number; fixed: number }> = {};
  const addToPerson = (person: string | undefined, payerMemberId: string | undefined, kind: 'variable' | 'fixed', amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const key = payerKey(person, payerMemberId);
    if (!personBreakdown[key]) {
      const label =
        key === 'self'
          ? m.modals.expense.self
          : key === 'household'
            ? m.household.funds
            : memberNames.get(key) || localizePersonName(person || key, m);
      personBreakdown[key] = { label, variable: 0, fixed: 0 };
    }
    personBreakdown[key][kind] += amount;
  };
  (month.variableExpenses || []).forEach((exp) => addToPerson(exp.person, exp.payerMemberId, 'variable', exp.amount));
  (month.fixedExpenses || []).forEach((exp) => addToPerson(exp.person, exp.payerMemberId, 'fixed', fixedPaidAmount(exp)));
  const personRows = Object.entries(personBreakdown).sort((a, b) => b[1].variable + b[1].fixed - (a[1].variable + a[1].fixed));

  // ── Multi-month trend calculations ──
  const monthOverMonth = trendsMonths.map(({ monthKey, month: m }) => {
    const s = calculateEnvelopeSpent(m);
    const env = calculateEnvelopeAmounts(m.totalBudget, m.strategyId, m.customRatios);
    // Achieved net savings: received income minus needs/wants spending. Null
    // when nothing was received (the rate would be meaningless).
    const achieved = calculateSavingsRate(m);
    return {
      netSaved: achieved?.net ?? 0,
      netSavedRate: achieved?.rate ?? null,
      monthKey,
      label: (() => {
        const [y, num] = monthKey.split('-').map(Number);
        return new Date(y, num - 1, 1).toLocaleDateString(intlLocale, { month: 'short', year: '2-digit' });
      })(),
      totalBudget: m.totalBudget,
      totalSpent: s.totalSpent,
      needsSpent: s.needs,
      wantsSpent: s.wants,
      needsCap: env.needs,
      wantsCap: env.wants,
      savings: env.savings,
      // Spendable = needs + wants envelope (savings is committed), matching
      // the overview ring and the Safe-to-Spend insight.
      remaining: Math.max(0, env.needs + env.wants - s.totalSpent),
      totalCash: totalCashOnHand(m),
      income: calculateTotalIncome(m),
    };
  }).reverse();

  const prevMonth = monthOverMonth.length > 1 ? monthOverMonth[monthOverMonth.length - 2] : null;
  const currentMonthData = monthOverMonth.length > 0 ? monthOverMonth[monthOverMonth.length - 1] : null;
  const spendChange = prevMonth && currentMonthData
    ? prevMonth.totalSpent > 0
      ? ((currentMonthData.totalSpent - prevMonth.totalSpent) / prevMonth.totalSpent) * 100
      : 0
    : 0;

  const compactAxis = (value: number) =>
    new Intl.NumberFormat(intlLocale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);

  // ── Balance overview ring ──
  // Each action around the disc swaps the figure and the sparkline series;
  // the series are the per-month values above (oldest → newest) and the chip
  // is the change against the previous month.
  const hasHistory = monthOverMonth.length > 1;
  const series = (pick: (row: (typeof monthOverMonth)[number]) => number) =>
    hasHistory ? normalizeSeries(monthOverMonth.map(pick)) : null;
  const deltaChip = (current: number, previous: number | undefined, goodWhenUp = true) => {
    if (previous === undefined || previous <= 0) return null;
    const pct = ((current - previous) / previous) * 100;
    const label = `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${formatLocalizedPercent(Math.abs(pct), intlLocale, Math.abs(pct) < 10 ? 1 : 0)}`;
    return { label, positive: goodWhenUp ? pct >= 0 : pct <= 0, note: t(m.tabs.trends.percentVsLastMonth, { percent: label }) };
  };
  const netSavedNow = calculateSavingsRate(month)?.net ?? 0;
  const safeToSpend = calculateSafeToSpend(month);
  const ringViews: RingView[] = ([
    canSeeExpenses && {
      id: 'spent',
      icon: 'candlestick_chart',
      label: m.tabs.trends.spentThisMonth,
      amount: spent.totalSpent,
      spark: series((row) => row.totalSpent),
      delta: deltaChip(spent.totalSpent, prevMonth?.totalSpent, false),
    },
    canSeeExpenses && {
      id: 'remaining',
      icon: 'pie_chart',
      label: m.tabs.trends.budgetRemaining,
      amount: safeToSpend.remainingBudget,
      note: `${m.tabs.trends.ofLabel} ${format(safeToSpend.budget)}`,
      spark: series((row) => row.remaining),
      delta: deltaChip(safeToSpend.remainingBudget, prevMonth?.remaining),
    },
    {
      id: 'cash',
      icon: 'show_chart',
      label: m.tabs.trends.totalCash,
      amount: totalCash,
      note: canSeeBalances ? undefined : m.household.areaRedacted,
      spark: canSeeBalances ? series((row) => row.totalCash) : null,
      delta: canSeeBalances ? deltaChip(totalCash, prevMonth?.totalCash) : null,
      redacted: !canSeeBalances,
    },
    canSeeSavings && {
      id: 'savings',
      icon: 'percent',
      label: m.tabs.trends.netSaved,
      amount: netSavedNow,
      note: t(m.tabs.trends.strategySavings, {
        strategy: strategyCopy.name,
        percent: formatLocalizedPercent(Math.round(strategy.savingsRatio * 100), intlLocale),
      }),
      spark: series((row) => row.netSaved),
      delta: deltaChip(netSavedNow, prevMonth?.netSaved),
    },
    canSeeIncome && {
      id: 'income',
      icon: 'wallet',
      label: m.dashboard.incomeThisMonth,
      amount: totalIncome,
      spark: series((row) => row.income),
      delta: deltaChip(totalIncome, prevMonth?.income),
    },
  ] as (RingView | false)[]).filter((view): view is RingView => Boolean(view));
  const [ringViewId, setRingViewId] = useState('cash');

  const incomeDelta = deltaChip(totalIncome, prevMonth?.income);
  const monthLabel = (() => {
    const [y, num] = (month.periodKey || '').split('-').map(Number);
    const date = y && num ? new Date(y, num - 1, 1) : new Date();
    return date.toLocaleDateString(intlLocale, { month: 'long' });
  })();
  const topIncomeSources = [...incomeSources]
    .filter((src) => (src.amount || 0) > 0)
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .slice(0, 5);
  const maxIncomeSource = topIncomeSources[0]?.amount || 1;

  return (
    <div className="space-y-6 pb-24">
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard/profile"
          prefetch={true}
          aria-label={m.profile.subpages.backToProfile}
          className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant shadow-ambient transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <AppIcon name="arrow_back" className={`text-[18px] ${isRTL ? 'rotate-180' : ''}`} />
        </Link>
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-on-surface">{m.tabs.trends.title}</h2>
          <p className="mt-0.5 text-[13px] font-medium text-on-surface-variant">{m.tabs.trends.description}</p>
        </div>
      </div>

      {/* ── Balance overview ring + income ──
          The disc replaces the KPI tiles: every former tile is one of the
          actions on the arc, so nothing a member was allowed to see is lost
          (RBAC filters the views the same way it filtered the tiles). */}
      <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
        <section
          className={cn(
            'relative overflow-hidden rounded-[2rem] border border-outline-variant bg-surface-container-lowest px-4 pb-5 pt-5 shadow-ambient sm:px-6',
            canSeeIncome ? 'lg:col-span-5' : 'lg:col-span-6 lg:col-start-4',
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-3/4 [background:radial-gradient(60%_55%_at_50%_0%,color-mix(in_srgb,var(--mint)_85%,transparent),transparent)] dark:[background:radial-gradient(60%_55%_at_50%_0%,color-mix(in_srgb,var(--lime)_12%,transparent),transparent)]"
          />
          <div className="relative flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              <span aria-hidden className="size-1.5 rounded-full bg-lime-deep" />
              {m.tabs.trends.balanceOverview}
            </span>
            <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">{monthLabel}</span>
          </div>
          <BalanceOverviewRing
            views={ringViews}
            activeId={ringViewId}
            onChange={setRingViewId}
            actionsLabel={m.tabs.trends.viewsLabel}
            rtl={isRTL}
            className="relative"
          />
          {!hasHistory && !trendsLoading && (
            <p className="relative mx-auto max-w-[30ch] text-center text-[11px] font-medium leading-snug text-on-surface-variant">
              {m.tabs.trends.noHistoryYet}
            </p>
          )}
        </section>

        {/* Income — its own RBAC area. Without the grant the whole card is
            dropped, because even the source *names* are household data. */}
        {canSeeIncome && (
          <div className={cn(CARD, 'flex flex-col lg:col-span-7')}>
            <div className="surface-forest relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-forest">
              <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-2/5 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-lime text-forest-deep shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]">
                    <AppIcon name="dollar" strokeWidth={2.4} className="text-[16px]" />
                  </span>
                  <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{m.dashboard.incomeThisMonth}</h3>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/80">{monthLabel}</span>
              </div>
              {incomeDelta && (
                <div className="relative mt-4 flex items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold tabular', incomeDelta.positive ? 'bg-lime text-forest-deep' : 'bg-error-container text-error')}>
                    {incomeDelta.label}
                  </span>
                  <span className="text-[11px] font-medium text-white/60">{m.tabs.trends.vsLastMonth}</span>
                </div>
              )}
              <MoneyFigure value={totalIncome} size="xl" weight="semibold" tone="accent" className={cn('relative text-white', incomeDelta ? 'mt-2' : 'mt-4')} />
              <span className="relative mt-1 block text-[12px] font-medium text-white/55">{m.tabs.trends.totalCombinedIncome}</span>
            </div>

            {proUnlocked && incomeSources.length > 0 ? (
              <div className="mt-4 flex flex-1 flex-col gap-4">
                {/* Dot-matrix columns — a visual double of the list below. */}
                {topIncomeSources.length > 0 && (
                  <div aria-hidden className="grid gap-3 px-1" style={{ gridTemplateColumns: `repeat(${topIncomeSources.length}, minmax(0, 1fr))` }}>
                    {topIncomeSources.map((src, idx) => {
                      const rows = 10;
                      const filled = Math.max(1, Math.round(((src.amount || 0) / maxIncomeSource) * rows));
                      return (
                        <div key={src.id} className="flex min-w-0 flex-col items-center gap-2">
                          <div className="grid grid-cols-3 gap-[5px]">
                            {Array.from({ length: rows * 3 }).map((_, i) => {
                              const row = rows - 1 - Math.floor(i / 3);
                              const on = row < filled;
                              return (
                                <span
                                  key={i}
                                  className={cn(
                                    'size-1.5 rounded-full transition-colors',
                                    on ? (idx === 0 ? 'bg-lime-deep' : 'bg-forest dark:bg-lime') : 'bg-sage/50',
                                  )}
                                />
                              );
                            })}
                          </div>
                          <span className="max-w-full truncate text-[11px] font-semibold text-on-surface-variant">{localizeIncomeSourceName(src.name, m)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <ul className="flex flex-col divide-y divide-outline-variant/60">
                  {incomeSources.map((src, idx) => {
                    const pct = totalIncome > 0 ? Math.round(((src.amount || 0) / totalIncome) * 100) : 0;
                    return (
                      <li key={src.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <span className="truncate text-[13px] font-semibold text-on-surface">{localizeIncomeSourceName(src.name, m)}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                            {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                          </span>
                          <span className="tabular text-[13px] font-semibold text-on-surface">{format(src.amount || 0)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
                <p className="text-[13px] font-medium text-on-surface-variant">
                  {proUnlocked ? m.tabs.trends.noIncomeSources : m.tabs.trends.incomeSourcesPro}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Multi-Month Trends (Pro feature) ──
          Budget / spent / remaining per month are `expenses` figures. */}
      {canSeeExpenses && (
      <div className={CARD}>
        <SectionHeader icon="bar_chart" title={m.tabs.trends.monthOverMonth}>
          {onSetTrendsMonthCount && (
            <div className="flex rounded-full bg-surface-container-high p-0.5" role="group" aria-label={m.tabs.trends.rangeLabel}>
              {([6, 12] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onSetTrendsMonthCount(count)}
                  aria-pressed={trendsMonthCount === count}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    trendsMonthCount === count
                      ? 'bg-forest text-lime shadow-sm dark:bg-lime dark:text-forest-deep'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {count === 6 ? m.tabs.trends.last6Months : m.tabs.trends.last12Months}
                </button>
              ))}
            </div>
          )}
          {showUpgrade && (
            <button
              onClick={onOpenProModal}
              className="rounded-full bg-lime px-3 py-1.5 text-[12px] font-semibold text-forest-deep transition-colors hover:bg-lime-bright"
            >
              {m.tabs.trends.proLabel}
            </button>
          )}
        </SectionHeader>

        {trendsLoading ? (
          <div className="flex h-48 animate-pulse items-center justify-center rounded-2xl bg-surface-container-low">
            <span className="text-[13px] font-medium text-on-surface-variant">{m.tabs.trends.loadingTrends}</span>
          </div>
        ) : monthOverMonth.length > 1 && proUnlocked ? (
          /* Bar chart with month-over-month comparison. The bars are a purely
             visual rendering of the table that follows, so they are hidden
             from assistive tech and a screen-reader summary points at the
             table — the accessible "chart". */
          <div className="space-y-4">
            <p className="sr-only">{m.tabs.trends.chartAltText}</p>
            <MonthTrendChart
              data={monthOverMonth}
              format={format}
              compactAxis={compactAxis}
              labels={{ spent: m.tabs.trends.spent, budget: m.tabs.trends.budget, netSaved: m.tabs.trends.netSaved }}
            />

            {/* Trend summary table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-outline-variant text-[10.5px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                    <th className="text-start py-2 pe-3">{m.tabs.trends.month}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.budget}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.spent}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.remaining}</th>
                    <th className="text-end py-2 px-3">{m.tabs.trends.netSaved}</th>
                    <th className="text-end py-2 ps-3">{m.tabs.trends.savingsPercent}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthOverMonth.map((m) => (
                    <tr key={m.monthKey} className="border-b border-outline-variant/40 last:border-0">
                      <td className="py-2.5 pe-3 font-semibold text-on-surface">{m.label}</td>
                      <td className="py-2.5 px-3 text-end tabular text-on-surface">{format(m.totalBudget)}</td>
                      <td className="py-2.5 px-3 text-end tabular text-on-surface">{format(m.totalSpent)}</td>
                      <td className="py-2.5 px-3 text-end tabular font-semibold text-forest dark:text-lime">{format(m.remaining)}</td>
                      <td className="py-2.5 px-3 text-end tabular text-on-surface">
                        {m.netSavedRate !== null
                          ? `${format(m.netSaved)} (${new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(m.netSavedRate)})`
                          : '—'}
                      </td>
                      <td className="py-2.5 ps-3 text-end tabular text-on-surface">
                        {m.totalBudget > 0
                          ? new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(m.savings / m.totalBudget)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
              <AppIcon name="bar_chart" className="text-[22px]" />
            </span>
            <p className="text-[14px] font-medium text-on-surface-variant">{m.tabs.trends.notEnoughData}</p>
            <p className="text-[12px] text-on-surface-variant">{m.tabs.trends.addExpensesForTrends}</p>
          </div>
        )}
      </div>

      )}

      {/* ── Category Trend Breakdown ── */}
      {canSeeExpenses && (
      <div className={CARD}>
        <SectionHeader icon="category" title={m.tabs.trends.categoryBreakdown} />

        {sortedCategories.length > 0 ? (
          <div className="flex flex-col gap-3">
            {sortedCategories.map(([cat, amount], idx) => {
              const pct = spent.totalSpent > 0 ? Math.round((amount / spent.totalSpent) * 100) : 0;
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="text-[13px] font-semibold text-on-surface">{localizeCategoryName(cat, m)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-semibold text-on-surface-variant">
                        {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                      </span>
                      <span className="tabular text-[13px] font-semibold text-on-surface">{format(amount)}</span>
                    </div>
                  </div>
                  <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-mint">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between border-t border-outline-variant pt-3">
              <span className="text-[14px] font-semibold text-on-surface">{m.tabs.trends.totalSpent}</span>
              <MoneyFigure value={spent.totalSpent} size="md" weight="semibold" className="text-on-surface" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
            <p className="text-[13px] font-medium text-on-surface-variant">
              {m.tabs.trends.noExpenses}
            </p>
          </div>
        )}
      </div>
      )}

      {/* ── Custom reports by place / tag / member (Pro) ── */}
      {canSeeExpenses && (
        <CustomReportCard
          months={[
            { monthKey: month.periodKey || 'current', month },
            ...trendsMonths.filter((entry) => entry.month.periodKey !== month.periodKey),
          ]}
          unlocked={proUnlocked}
          onUpgrade={onOpenProModal}
          canSeeFixedBills={canSeeFixedBills}
        />
      )}

      {/* ── Household Spending Breakdown ── */}
      {proUnlocked && canSeeExpenses && canSeeFixedBills && personRows.length > 0 && (
        <div className={CARD}>
          <SectionHeader icon="family_restroom" title={m.tabs.trends.householdSpending} />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {personRows.map(([person, data], idx) => {
              const total = data.variable + data.fixed;
              const totalAll = Object.values(personBreakdown).reduce((a, b) => a + b.variable + b.fixed, 0);
              const pct = totalAll > 0 ? Math.round((total / totalAll) * 100) : 0;
              return (
                <div key={person} className="flex min-w-0 flex-col gap-2 overflow-hidden rounded-2xl bg-surface-container-low p-4">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-on-surface">{data.label}</span>
                    <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-semibold text-forest-deep">
                      {new Intl.NumberFormat(intlLocale, { style: 'percent', maximumFractionDigits: 0 }).format(pct / 100)}
                    </span>
                  </div>
                  <MoneyFigure value={total} size="md" weight="semibold" className="text-on-surface" />
                  <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-mint">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-semibold text-on-surface-variant">
                    <span>{t(m.tabs.trends.variableAmount, { amount: format(data.variable) })}</span>
                    <span>{t(m.tabs.trends.fixedAmount, { amount: format(data.fixed) })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showUpgrade && (
        <button
          type="button"
          onClick={onOpenProModal}
          className="surface-forest relative flex w-full items-center gap-3 overflow-hidden rounded-[1.75rem] p-5 text-start shadow-forest transition-transform hover:-translate-y-0.5 sm:p-6"
        >
          <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-1/3 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-lime text-forest-deep">
            <AppIcon name="workspace_premium" strokeWidth={2.2} className="text-[18px]" />
          </span>
          <span className="relative min-w-0 flex-1 text-[13px] font-medium leading-snug text-white/85">
            {m.tabs.trends.advancedAnalytics}
          </span>
          <AppIcon name="arrow_outward" className="relative shrink-0 text-[18px] text-lime rtl:-scale-x-100" />
        </button>
      )}

      {/* ── Budget Health Summary ── */}
      {canSeeExpenses && (
      <div className={CARD}>
        <SectionHeader icon="health_and_safety" title={m.tabs.trends.budgetHealth} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Needs */}
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-forest dark:bg-lime" />
                <span className="text-[13px] font-semibold text-on-surface">{t(m.tabs.trends.needsLabel, { percent: formatLocalizedPercent(Math.round(strategy.needsRatio * 100), intlLocale) })}</span>
              </div>
              <span className="tabular text-[13px] font-semibold text-on-surface">{format(spent.needs)}</span>
            </div>
            {(() => {
              const env = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
              const pct = env.needs > 0 ? Math.min(100, Math.round((spent.needs / env.needs) * 100)) : 0;
              return (
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-mint">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warning' : 'bg-forest dark:bg-lime'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Wants */}
          <div className="flex flex-col gap-2 rounded-2xl bg-surface-container-low p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-lime-deep" />
                <span className="text-[13px] font-semibold text-on-surface">{t(m.tabs.trends.wantsLabel, { percent: formatLocalizedPercent(Math.round(strategy.wantsRatio * 100), intlLocale) })}</span>
              </div>
              <span className="tabular text-[13px] font-semibold text-on-surface">{format(spent.wants)}</span>
            </div>
            {(() => {
              const env = calculateEnvelopeAmounts(month.totalBudget, month.strategyId, month.customRatios);
              const pct = env.wants > 0 ? Math.min(100, Math.round((spent.wants / env.wants) * 100)) : 0;
              return (
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-mint">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warning' : 'bg-lime-deep'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
