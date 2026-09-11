import { AppIcon } from '@/components/ui/app-icon';
import React, { useEffect, useRef, useState } from 'react';
import {
  MonthBudget,
  SavingGoal,
  CustomRatios,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateMonthlyDepositedSavings,
  calculateTotalIncome,
  fixedPaidAmount,
  getPlaceBalance,
  getUpcomingBills,
  resolveMonthStrategy,
  totalCashOnHand,
  StrategyId,
  SavingsActivityEntry,
} from '../../lib/store';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { useCurrency } from '../../lib/currency-context';
import { StrategySelectorModal } from '../modals/StrategySelectorModal';
import { PlaceHistoryModal } from '../modals/PlaceHistoryModal';
import { useHousehold } from '@/lib/household-context';
import { AMOUNT_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { localizeCategoryName, localizePlaceName, localizeStrategy } from '@/lib/localized-labels';
import { SafeToSpendCard } from '../dashboard/safe-to-spend-card';
import { calculateSafeToSpend } from '@/lib/insights';
import { NetWorthCard } from '../dashboard/net-worth-card';
import { BalanceHeroCard } from '../dashboard/balance-hero-card';
import { BudgetRing } from '../dashboard/budget-ring';
import { StatCard } from '../dashboard/stat-card';
import { MoneyFigure } from '@/components/ui/money-figure';
import { useAuth } from '@/lib/auth-context';

function formatActivityDate(value: string, intlLocale: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  return date.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' });
}

interface OverviewTabProps {
  month: MonthBudget;
  goals: SavingGoal[];
  onOpenExpenseModal: () => void;
  onOpenMoveMoneyModal: () => void;
  onOpenEditExpense: (expense: any) => void;
  onSelectTab: (tab: 'overview' | 'variable' | 'fixed' | 'savings') => void;
  onUpdateTotalBudget: (value: number) => void;
  onEditMoneyPlaces: () => void;
  onUpdateStrategy?: (strategyId: StrategyId, customRatios?: CustomRatios) => void;
  /** Open the editor for a logged savings deposit / withdrawal. */
  onOpenEditSavings?: (entry: SavingsActivityEntry) => void;
  /** Pro gate for the safe-to-spend forecast card. */
  insightsUnlocked?: boolean;
  onUpgrade?: () => void;
  /**
   * Opens the Income Sources sheet from the income card. On phones this is
   * the only income entry point on the dashboard itself (the sidebar tool row
   * is desktop-only), so adding a one-time bonus does not require a trip
   * through Profile.
   */
  onOpenIncome?: () => void;
}

export function OverviewTab({
  month,
  goals,
  onOpenExpenseModal,
  onOpenMoveMoneyModal,
  onOpenEditExpense,
  onSelectTab,
  onUpdateTotalBudget,
  onEditMoneyPlaces,
  onUpdateStrategy,
  onOpenEditSavings,
  insightsUnlocked = false,
  onUpgrade,
  onOpenIncome,
}: OverviewTabProps) {
  const { format, formatParts } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const { places } = useMoneyPlaces(month);
  const { canViewArea, canEditArea } = useHousehold();
  const { user, profile } = useAuth();
  const greetingName = profile?.displayName?.trim() || user?.email?.split('@')[0] || '';
  // Every figure on this screen belongs to exactly one RBAC area (AMOUNT_AREA).
  // Money places, the total monthly budget and TOTAL CASH ON HAND are all
  // `balances`: without that grant a member sees the redacted placeholder and
  // no edit affordance,
  // because an edit button that silently does nothing is a permission leak of
  // its own (it tells them the number exists and is editable by someone).
  const canSeeBalances = canViewArea(AMOUNT_AREA.totalCashOnHand);
  const canEditBalances = canEditArea(AMOUNT_AREA.totalCashOnHand);
  const canSeeExpenses = canViewArea(AMOUNT_AREA.variableExpense);
  const canEditExpenses = canEditArea(AMOUNT_AREA.variableExpense, true);
  const canSeeFixed = canViewArea(AMOUNT_AREA.fixedBill);
  const canSeeIncome = canViewArea(AMOUNT_AREA.incomeSource);
  const canSeeSavings = canViewArea(AMOUNT_AREA.savingsGoal);
  const canEditSavings = canEditArea(AMOUNT_AREA.savingsGoal, true);
  const redacted = '••••';
  const budgetInputRef = useRef<HTMLInputElement>(null);
  // Set when Enter/Escape finishes editing so the programmatic blur doesn't re-trigger save
  const editFinishedRef = useRef(false);
  const [draftBudget, setDraftBudget] = useState(String(month.totalBudget || 0));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [historyPlaceId, setHistoryPlaceId] = useState<string | null>(null);

  const { needs, wants, savings } = calculateEnvelopeAmounts(
    month.totalBudget,
    month.strategyId,
    month.customRatios,
  );
  const spent = calculateEnvelopeSpent(month);
  const strategy = resolveMonthStrategy(month);
  const strategyCopy = localizeStrategy(strategy.id, m, intlLocale);

  const totalCash = totalCashOnHand(month);
  const budgetParts = formatParts(month.totalBudget || 0);
  const cashParts = formatParts(totalCash);

  const needsSpentPct = needs > 0 ? Math.min(100, Math.round((spent.needs / needs) * 100)) : 0;
  const wantsSpentPct = wants > 0 ? Math.min(100, Math.round((spent.wants / wants) * 100)) : 0;

  // Recent Activity is a mix of two areas: each half only appears when the
  // member may view that area, so a member without `expenses` never sees
  // someone else's purchases listed here.
  const recentExpenses = canSeeExpenses ? (month.variableExpenses || []).slice(0, 5) : [];

  // The savings plan counts only the deposits logged on THIS month — goals
  // outlive the budget period, so their lifetime balance (including "already
  // saved" bookkeeping) must not leak into the current month's progress.
  const depositedSavings = calculateMonthlyDepositedSavings(month);

  // Fixed charges due within the next 7 days of this period (planned/partial).
  const upcomingBills = getUpcomingBills(month, 7);

  // Recent Activity merges logged expenses with savings deposits/withdrawals,
  // newest first.
  const recentSavings: SavingsActivityEntry[] = canSeeSavings
    ? (month.savingsActivity || []).slice(0, 5)
    : [];
  const recentItems: Array<
    | { kind: 'expense'; id: string; name: string; subtitle: string; amount: number; icon: string; date: Date }
    | { kind: 'savings'; id: string; name: string; subtitle: string; amount: number; isDeposit: boolean; date: Date }
  > = [
    ...recentExpenses.map((exp) => ({
      kind: 'expense' as const,
      id: exp.id,
      name: exp.name,
      subtitle: `${formatActivityDate(exp.date, intlLocale)} • ${localizeCategoryName(exp.type, m)}`,
      amount: exp.amount,
      icon: month.categoryIcons?.[exp.type] || 'shopping_bag',
      date: new Date(exp.date),
    })),
    ...recentSavings.map((evt) => ({
      kind: 'savings' as const,
      id: evt.id,
      name: evt.goalName,
      subtitle: `${evt.type === 'deposit' ? m.dashboard.deposit : m.dashboard.withdrawal} • ${m.dashboard.savingsActivity}`,
      amount: evt.amount,
      isDeposit: evt.type === 'deposit',
      date: new Date(evt.date),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  // Ring: one arc per envelope, solid where the budget is already used.
  const savingsRatio = savings > 0 ? Math.min(1, depositedSavings / savings) : 0;
  const ringSegments = [
    { id: 'needs', label: m.budgetPlan.needs, value: needs, usedRatio: needsSpentPct / 100, color: 'var(--forest)' },
    { id: 'wants', label: m.budgetPlan.wants, value: wants, usedRatio: wantsSpentPct / 100, color: 'var(--lime-deep)' },
    { id: 'savings', label: m.budgetPlan.savings, value: savings, usedRatio: savingsRatio, color: 'var(--secondary)' },
  ];
  // Sparkline: cumulative spend across the month, normalised 0–1.
  const spark = (() => {
    const days = 8;
    const sorted = [...(month.variableExpenses || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 2) return [0.35, 0.42, 0.4, 0.55, 0.5, 0.68, 0.62, 0.8];
    const buckets = new Array(days).fill(0);
    const first = new Date(sorted[0].date).getTime();
    const last = new Date(sorted[sorted.length - 1].date).getTime();
    const span = Math.max(1, last - first);
    for (const exp of sorted) {
      const i = Math.min(days - 1, Math.floor(((new Date(exp.date).getTime() - first) / span) * (days - 1)));
      buckets[i] += exp.amount;
    }
    let acc = 0;
    const cum = buckets.map((v) => (acc += v));
    const max = cum[cum.length - 1] || 1;
    return cum.map((v) => 0.15 + (v / max) * 0.75);
  })();
  const totalSpent = spent.totalSpent;
  const fixedTotal = (month.fixedExpenses || []).reduce((sum, bill) => sum + (bill.amount || 0), 0);
  const fixedPaid = (month.fixedExpenses || []).reduce((sum, bill) => sum + fixedPaidAmount(bill), 0);
  const totalIncome = calculateTotalIncome(month);
  // "Left to spend" is the analytics figure, not `totalBudget − spent`: the
  // savings envelope is committed money, so only the needs + wants budget
  // counts as spendable — the same math as the Safe-to-Spend insight and the
  // Budget Remaining view on the analytics ring.
  const safeToSpend = calculateSafeToSpend(month);
  const leftToSpend = safeToSpend.remainingBudget;
  const spendingBudget = safeToSpend.budget;
  const spentPctOfBudget = spendingBudget > 0 ? Math.round((totalSpent / spendingBudget) * 100) : 0;

  useEffect(() => {
    setDraftBudget(String(month.totalBudget || 0));
  }, [month.totalBudget]);

  // While editing, keep the caret ready with the full value selected
  useEffect(() => {
    if (isEditingBudget) {
      const el = budgetInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [isEditingBudget]);

  const handleBudgetSave = () => {
    const parsed = Number.parseFloat(draftBudget.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
    const safe = Number.isFinite(parsed) ? Math.max(0, parsed) : (month.totalBudget || 0);

    setDraftBudget(String(safe));
    setIsEditingBudget(false);

    // Skip no-op writes (reversions, unchanged blurs)
    if (safe !== (month.totalBudget || 0)) {
      onUpdateTotalBudget(safe);
    }
  };

  const handleBudgetCancel = () => {
    setDraftBudget(String(month.totalBudget || 0));
    setIsEditingBudget(false);
  };

  return (
    <>
    <div className="flex flex-col gap-6 pb-24">
      {/* Greeting */}
      <header className="flex flex-col gap-0.5 px-1">
        {greetingName && (
          <span className="text-[13px] font-medium text-on-surface-variant">
            {t(m.dashboard.greeting, { name: greetingName })}
          </span>
        )}
        <h2 className="font-display text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-on-surface sm:text-[34px]">
          {m.dashboard.welcomeBack}
        </h2>
        <p className="text-[13px] text-on-surface-variant">{m.dashboard.overviewSubtitle}</p>
      </header>

      {/* Hero row: wallet card + balance ring */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">
          <BalanceHeroCard
            eyebrow={greetingName || m.dashboard.places}
            trailing={strategyCopy.name}
            total={totalCash}
            totalLabel={m.dashboard.totalCashOnHand.toLowerCase().replace(/^./, (c) => c.toUpperCase())}
            redacted={!canSeeBalances}
            places={places.map((place) => ({
              id: place.id,
              name: localizePlaceName(place.id, place.name, m),
              icon: place.icon,
              balance: getPlaceBalance(month, place.id),
              actionNote: t(m.moneyHistory.openHistory, { name: localizePlaceName(place.id, place.name, m) }),
            }))}
            onSelectPlace={canSeeBalances ? (id) => setHistoryPlaceId(id) : undefined}
            primaryAction={
              canEditExpenses
                ? { label: m.dashboard.addExpense, icon: 'add_expense', onClick: onOpenExpenseModal }
                : undefined
            }
            secondaryAction={
              canEditBalances
                ? { label: m.dashboard.moveMoney, icon: 'move_money', onClick: onOpenMoveMoneyModal }
                : undefined
            }
          />
        </div>

        <div className="lg:col-span-5">
          <section className="flex h-full flex-col items-center rounded-[2rem] border border-outline-variant bg-surface-container-lowest px-4 pb-5 pt-6 shadow-ambient">
            <BudgetRing
              amount={leftToSpend}
              amountLabel={m.dashboard.netThisMonth}
              segments={ringSegments}
              spark={spark}
              redacted={!canSeeBalances}
              delta={
                month.totalBudget > 0
                  ? { label: `${formatLocalizedPercent(spentPctOfBudget, intlLocale)}`, positive: spentPctOfBudget < 100 }
                  : null
              }
            />
            {/* Legend */}
            <ul className="mt-2 flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
              {ringSegments.map((seg) => (
                <li key={seg.id} className="flex items-center gap-1.5 text-[12px] font-medium text-on-surface-variant">
                  <span className="size-2 rounded-full" style={{ background: seg.color }} />
                  {seg.label}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {canSeeExpenses && (
          <StatCard
            icon="dollar"
            title={m.dashboard.expensesTitle}
            value={totalSpent}
            caption={m.dashboard.thisMonth}
            delta={month.totalBudget > 0 ? { label: formatLocalizedPercent(spentPctOfBudget, intlLocale), positive: spentPctOfBudget < 100 } : null}
            onClick={() => onSelectTab('variable')}
            actionLabel={m.common.viewAll}
          />
        )}
        {canSeeIncome && (
          <StatCard
            icon="payments"
            title={m.dashboard.incomeThisMonth}
            value={totalIncome}
            caption={m.dashboard.thisMonth}
            variant="forest"
            onClick={onOpenIncome}
            actionLabel={onOpenIncome ? m.navigation.incomeSources : undefined}
          />
        )}
        {canSeeSavings && (
          <StatCard
            icon="savings"
            title={m.budgetPlan.savings}
            value={depositedSavings}
            caption={t(m.dashboard.activeGoals, { count: goals.length })}
            onClick={() => onSelectTab('savings')}
            actionLabel={m.common.viewAll}
          />
        )}
        {canSeeFixed && (
          <StatCard
            icon="event_repeat"
            title={m.navigation.fixedBills}
            value={fixedTotal}
            caption={t(m.tabs.fixed.paidSummary, { paid: format(fixedPaid), total: format(fixedTotal) })}
            variant="lime"
            onClick={() => onSelectTab('fixed')}
            actionLabel={m.common.viewAll}
          />
        )}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Budget Plan + Strategy) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Budget Plan Card */}
          <div className="p-5 sm:p-6 bg-surface-container-lowest rounded-[1.75rem] border border-outline-variant flex flex-col gap-5 shadow-ambient">
            <div className="flex justify-between items-center gap-3">
              <h3 className="font-semibold text-[16px] tracking-[-0.01em] text-on-surface">
                {m.dashboard.budgetPlan}
              </h3>
              {onUpdateStrategy && canEditBalances ? (
                <button
                  type="button"
                  onClick={() => setIsStrategyModalOpen(true)}
                  className="flex items-center gap-1.5 bg-lime/70 hover:bg-lime rounded-full px-3 py-1.5 transition-all cursor-pointer group text-forest-deep dark:bg-lime/15 dark:hover:bg-lime/25 dark:text-lime"
                >
                  <AppIcon name="package" className="text-[12px]" />
                  <span className="text-[10px] font-semibold tracking-wider uppercase">
                    {strategyCopy.name}
                  </span>
                  <AppIcon name="chevron_right" className="text-[12px] rotate-90" />
                  {/* Screen-reader action note: the accessible name comes from
                      the visible contents (WCAG 2.5.3) — an aria-label here
                      would drop the visible strategy name. */}
                  <span className="sr-only"> {m.strategySelector.changeStrategy}</span>
                </button>
              ) : (
                <span className="text-[10px] font-semibold tracking-wider uppercase text-on-surface-variant">
                  {strategyCopy.name}
                </span>
              )}
            </div>

            {/* Needs Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-forest dark:bg-lime" />
                  <span className="font-semibold text-on-surface">{t(m.dashboard.needsLabel, { percent: formatLocalizedPercent(strategy.needsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{t(m.dashboard.used, { percent: formatLocalizedPercent(needsSpentPct, intlLocale) })}</span>
              </div>
              <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${needsSpentPct >= 100 ? 'bg-error' : 'bg-forest dark:bg-lime'}`}
                  style={{ width: `${needsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium tabular text-on-surface-variant">
                <span>{format(spent.needs)}</span>
                <span>{format(needs)}</span>
              </div>
            </div>

            {/* Wants Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-lime-deep" />
                  <span className="font-semibold text-on-surface">{t(m.dashboard.wantsLabel, { percent: formatLocalizedPercent(strategy.wantsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{t(m.dashboard.used, { percent: formatLocalizedPercent(wantsSpentPct, intlLocale) })}</span>
              </div>
              <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${wantsSpentPct >= 100 ? 'bg-error' : 'bg-lime-deep'}`}
                  style={{ width: `${wantsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium tabular text-on-surface-variant">
                <span>{format(spent.wants)}</span>
                <span>{format(wants)}</span>
              </div>
            </div>

            {/* Savings Bar */}
            <div
              role={canSeeSavings ? 'button' : undefined}
              tabIndex={canSeeSavings ? 0 : undefined}
              onClick={canSeeSavings ? () => onSelectTab('savings') : undefined}
              onKeyDown={canSeeSavings ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectTab('savings');
                }
              } : undefined}
              className={`flex flex-col gap-1.5 transition-all ${canSeeSavings ? 'hover:opacity-80 cursor-pointer' : ''}`}
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span className="font-semibold text-on-surface">{t(m.dashboard.savingsLabel, { percent: formatLocalizedPercent(strategy.savingsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-secondary">
                  {t(m.dashboard.activeGoals, { count: goals.length })}
                </span>
              </div>
              <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((depositedSavings / (savings || 1)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium tabular text-on-surface-variant">
                <span title={m.dashboard.depositedThisMonth}>{format(depositedSavings)}</span>
                <span>{format(savings)}</span>
              </div>
            </div>
          </div>

          {/* Monthly Income Summary Banner */}
          <div className="grid grid-cols-1 gap-4 bg-surface-container-lowest p-5 sm:grid-cols-2 sm:items-end sm:gap-8 sm:p-6 rounded-[1.75rem] border border-outline-variant shadow-ambient">
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                {m.dashboard.totalMonthlyBudget}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                {isEditingBudget ? (
                  <div className="flex min-w-0 items-baseline gap-1 rounded-2xl bg-surface-container-high px-2 py-0.5 ring-2 ring-primary/30">
                    <input
                      ref={budgetInputRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label={m.dashboard.totalMonthlyBudget}
                      value={draftBudget}
                      onChange={(e) => setDraftBudget(e.target.value)}
                      onBlur={() => {
                        if (editFinishedRef.current) {
                          editFinishedRef.current = false;
                          return;
                        }
                        handleBudgetSave();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          editFinishedRef.current = true;
                          handleBudgetSave();
                          budgetInputRef.current?.blur();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          editFinishedRef.current = true;
                          handleBudgetCancel();
                          budgetInputRef.current?.blur();
                        }
                      }}
                      style={{ width: `${Math.max(4, Math.min(12, draftBudget.length + 1))}ch` }}
                      className="keep-font-20 bg-transparent text-xl font-semibold text-figure text-on-surface outline-none"
                    />
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {budgetParts.currency}
                    </span>
                  </div>
                ) : canEditBalances ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingBudget(true)}
                    title={m.dashboard.editBudgetTooltip}
                    className="-ms-2 flex min-w-0 items-baseline gap-1 rounded-2xl px-2 py-0.5 text-start transition-colors hover:bg-surface-container-high"
                  >
                    <span className="text-xl font-bold font-mono text-on-surface">
                      {budgetParts.amount}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {budgetParts.currency}
                    </span>
                  </button>
                ) : (
                  <span className="-ms-2 flex min-w-0 items-baseline gap-1 px-2 py-0.5">
                    <span className="text-xl font-bold font-mono text-on-surface">
                      {canSeeBalances ? budgetParts.amount : redacted}
                    </span>
                    {canSeeBalances && (
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {budgetParts.currency}
                      </span>
                    )}
                  </span>
                )}
                {canEditBalances && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBudget(true)}
                    aria-label={m.dashboard.editTotalBudget}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-lime hover:border-lime hover:text-forest-deep"
                  >
                    <AppIcon name="edit" className="text-[14px]" />
                  </button>
                )}
              </div>
            </div>
            <div className="min-w-0 border-t border-outline-variant/50 pt-4 sm:border-t-0 sm:border-s sm:ps-8 sm:pt-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                {m.dashboard.totalCashOnHand}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex min-w-0 items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-on-surface">
                    {canSeeBalances ? cashParts.amount : redacted}
                  </span>
                  {canSeeBalances && (
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {cashParts.currency}
                    </span>
                  )}
                </div>
                {/* Total cash on hand is a `balances` figure: without the
                    grant the amount is redacted AND the balance editor is
                    gone, so there is no way to open it from here. */}
                {canEditBalances && (
                  <button
                    type="button"
                    onClick={onEditMoneyPlaces}
                    aria-label={m.dashboard.adjustCashBalances}
                    title={m.dashboard.adjustCashBalances}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant transition-colors hover:bg-lime hover:border-lime hover:text-forest-deep"
                  >
                    <AppIcon name="tune" className="text-[14px]" />
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Net worth lives in the left column so both columns fill the same
              height on desktop (the right one already carries Safe-to-spend
              and Recent Activity). */}
          {canSeeBalances && canSeeSavings && <NetWorthCard month={month} goals={goals} />}
        </div>

        {/* Right Column (Recent Activity) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {canSeeExpenses && canSeeBalances && (
            <SafeToSpendCard
              month={month}
              unlocked={insightsUnlocked}
              onUpgrade={onUpgrade ?? (() => {})}
            />
          )}
          {/* Upcoming bills — fixed charges coming due in the next 7 days of
              this period. fixedBills is its own RBAC area, so members without
              that grant never see what is about to be paid. */}
          {canViewArea('fixedBills') && upcomingBills.length > 0 && (
            <div className="bg-surface-container-lowest rounded-[1.75rem] border border-outline-variant shadow-ambient p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-[16px] tracking-[-0.01em] text-on-surface">
                  {m.dashboard.upcomingBills}
                </h3>
                <button
                  onClick={() => onSelectTab('fixed')}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {m.common.viewAll}
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {upcomingBills.map((bill) => (
                  <li
                    key={bill.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-high px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          bill.daysUntil === 0 ? 'bg-error-container text-error' : 'bg-lime text-forest-deep'
                        }`}
                      >
                        <AppIcon name="event_upcoming" className="text-[18px]" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-on-surface truncate">{bill.name}</span>
                        <span className={`text-[11px] font-semibold ${bill.daysUntil === 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {bill.daysUntil === 0
                            ? m.dashboard.dueToday
                            : t(m.dashboard.dueInDays, { days: bill.daysUntil })}
                        </span>
                      </div>
                    </div>
                    <span className="tabular font-semibold text-sm text-on-surface shrink-0">
                      {format(bill.remaining)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-[16px] tracking-[-0.01em] text-on-surface">
                {m.dashboard.recentActivity}
              </h3>
              <button
                onClick={() => onSelectTab('variable')}
                className="text-xs font-semibold text-primary hover:underline"
              >
                {m.common.viewAll}
              </button>
            </div>

            {recentItems.length === 0 ? (
              <div className="p-8 bg-surface-container-lowest rounded-[1.75rem] border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-3">
                <AppIcon name="receipt_long" className="text-outline text-[40px]" />
                <p className="text-xs text-on-surface-variant">{m.dashboard.noActivityYet}</p>
                {canEditExpenses && (
                  <button
                    onClick={onOpenExpenseModal}
                    className="px-4 py-2.5 bg-primary text-on-primary text-xs font-semibold rounded-full hover:bg-primary-hover transition-all"
                  >
                    {m.dashboard.addFirstExpense}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-[1.75rem] border border-outline-variant p-2 shadow-ambient flex flex-col divide-y divide-outline-variant/60">
                {recentItems.map((item) =>
                  item.kind === 'expense' ? (
                    <div
                      key={`exp-${item.id}`}
                      role={canEditExpenses ? 'button' : undefined}
                      tabIndex={canEditExpenses ? 0 : undefined}
                      onClick={
                        canEditExpenses
                          ? () => onOpenEditExpense(recentExpenses.find((exp) => exp.id === item.id))
                          : undefined
                      }
                      onKeyDown={
                        canEditExpenses
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenEditExpense(recentExpenses.find((exp) => exp.id === item.id));
                              }
                            }
                          : undefined
                      }
                      className={`p-3 flex items-center justify-between gap-3 transition-colors rounded-2xl ${
                        canEditExpenses ? 'cursor-pointer hover:bg-surface-container-high' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-lime text-forest-deep flex items-center justify-center shrink-0">
                          <AppIcon name={item.icon} strokeWidth={2} className="text-[18px]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-on-surface truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-on-surface-variant mt-0.5">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <MoneyFigure value={item.amount} prefix="-" size="sm" className="text-on-surface" />
                      </div>
                    </div>
                  ) : (
                    <div
                      key={`sav-${item.id}`}
                      role={canEditSavings && onOpenEditSavings ? 'button' : undefined}
                      tabIndex={(canEditSavings && onOpenEditSavings) || canSeeSavings ? 0 : undefined}
                      onClick={() => {
                        const entry = recentSavings.find((evt) => evt.id === item.id);
                        if (canEditSavings && onOpenEditSavings && entry) onOpenEditSavings(entry);
                        else if (canSeeSavings) onSelectTab('savings');
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' && e.key !== ' ') return;
                        e.preventDefault();
                        const entry = recentSavings.find((evt) => evt.id === item.id);
                        if (canEditSavings && onOpenEditSavings && entry) onOpenEditSavings(entry);
                        else if (canSeeSavings) onSelectTab('savings');
                      }}
                      className={`p-3 flex items-center justify-between gap-3 transition-colors rounded-2xl ${
                        canEditSavings || canSeeSavings ? 'cursor-pointer hover:bg-surface-container-high' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.isDeposit ? 'bg-forest text-lime' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          <AppIcon name="savings" strokeWidth={2} className="text-[18px]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-on-surface truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-on-surface-variant mt-0.5">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <span
                          className={`font-semibold text-sm tabular ${item.isDeposit ? 'text-success' : 'text-on-surface-variant'}`}
                        >
                          {item.isDeposit
                            ? `+${formatParts(item.amount).amount} ${formatParts(item.amount).currency}`
                            : `-${formatParts(item.amount).amount} ${formatParts(item.amount).currency}`}
                        </span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    {historyPlaceId && (
      <PlaceHistoryModal
        isOpen
        onClose={() => setHistoryPlaceId(null)}
        month={month}
        placeId={historyPlaceId}
        include={{
          expenses: canSeeExpenses,
          fixedBills: canSeeFixed,
          income: canSeeIncome,
          savings: canSeeSavings,
        }}
      />
    )}
    {isStrategyModalOpen && onUpdateStrategy && (
        <StrategySelectorModal
          isOpen={isStrategyModalOpen}
          onClose={() => setIsStrategyModalOpen(false)}
          currentStrategyId={month.strategyId}
          totalBudget={month.totalBudget}
          customRatios={month.customRatios}
          onSelect={(strategyId, ratios) => onUpdateStrategy(strategyId, ratios)}
        />
      )}
    </>
  );
}
