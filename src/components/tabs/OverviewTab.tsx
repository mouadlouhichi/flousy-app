import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import React, { useEffect, useRef, useState } from 'react';
import {
  MonthBudget,
  SavingGoal,
  CustomRatios,
  calculateEnvelopeAmounts,
  calculateEnvelopeSpent,
  calculateMonthlyDepositedSavings,
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
}: OverviewTabProps) {
  const { format, formatParts } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const { places } = useMoneyPlaces(month);
  const { canViewArea, canEditArea } = useHousehold();
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
  const placeCardTones = [
    { wrap: 'hover:border-primary/40', icon: 'bg-primary text-on-primary', action: 'text-primary' },
    { wrap: 'hover:border-tertiary/40', icon: 'bg-tertiary text-on-tertiary', action: 'text-tertiary' },
    { wrap: 'hover:border-secondary/40', icon: 'bg-secondary text-on-secondary', action: 'text-secondary' },
  ];
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
      {/* Money place cards — the wide left button opens that source's statement. */}
      <div className="flex flex-col gap-3">
        {places.map((place, index) => {
          const tone = placeCardTones[index % placeCardTones.length];
          const balance = getPlaceBalance(month, place.id);
          const parts = formatParts(balance);
          const placeTitle = localizePlaceName(place.id, place.name, m);
          return (
            <div
              key={place.id}
              className={`p-4 sm:p-5 bg-surface-container rounded-3xl border border-outline-variant shadow-2xs flex items-center justify-between gap-3 ${tone.wrap} transition-all`}
            >
              <button
                type="button"
                disabled={!canSeeBalances}
                onClick={canSeeBalances ? () => setHistoryPlaceId(place.id) : undefined}
                aria-label={canSeeBalances ? t(m.moneyHistory.openHistory, { name: placeTitle }) : undefined}
                className="flex flex-1 min-w-0 items-center gap-3 text-start rounded-xl disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all"
              >
                <span className={`w-10 h-10 rounded-2xl ${tone.icon} flex items-center justify-center shadow-2xs shrink-0`}>
                  <AppIcon name={place.icon} className="text-[20px]" />
                </span>
                <span className="flex flex-1 flex-col min-w-0">
                  <span className="font-bold text-base text-on-surface truncate">{placeTitle}</span>
                  <span className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-on-surface font-mono">
                      {canSeeBalances ? parts.amount : redacted}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {canSeeBalances ? parts.currency : ''}
                    </span>
                  </span>
                </span>
                {canSeeBalances && (
                  <AppIcon
                    name="chevron_right"
                    className="text-[18px] shrink-0 text-on-surface-variant rtl:rotate-180"
                  />
                )}
              </button>
              {canEditBalances && (
                <button
                  onClick={onOpenMoveMoneyModal}
                  className={`shrink-0 text-xs font-bold ${tone.action} hover:underline cursor-pointer flex items-center gap-1`}
                >
                  <span>{m.dashboard.move}</span>
                  <AppIcon name="swap_horiz" className="text-[14px]" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Budget Plan + Strategy) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Budget Plan Card */}
          <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-4 shadow-2xs">
            <div className="flex justify-between items-center gap-3">
              <h3 className="font-bold text-base text-on-surface">
                {m.dashboard.budgetPlan}
              </h3>
              {onUpdateStrategy && canEditBalances ? (
                <button
                  type="button"
                  onClick={() => setIsStrategyModalOpen(true)}
                  className="flex items-center gap-1.5 bg-surface-variant/60 hover:bg-surface-variant rounded-full px-3 py-1.5 transition-all cursor-pointer group"
                  aria-label={m.strategySelector.changeStrategy}
                >
                  <AppIcon name="package" className="text-[12px] text-primary " />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface">
                    {strategyCopy.name}
                  </span>
                  <AppIcon name="chevron_right" className="text-[12px] text-on-surface-variant rotate-90" />
                </button>
              ) : (
                <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant">
                  {strategyCopy.name}
                </span>
              )}
            </div>

            {/* Needs Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-bold text-on-surface">{t(m.dashboard.needsLabel, { percent: formatLocalizedPercent(strategy.needsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{t(m.dashboard.used, { percent: formatLocalizedPercent(needsSpentPct, intlLocale) })}</span>
              </div>
              <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${needsSpentPct >= 100 ? 'bg-error' : 'bg-primary'}`}
                  style={{ width: `${needsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium font-mono text-on-surface-variant">
                <span>{format(spent.needs)}</span>
                <span>{format(needs)}</span>
              </div>
            </div>

            {/* Wants Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-on-surface">{t(m.dashboard.wantsLabel, { percent: formatLocalizedPercent(strategy.wantsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{t(m.dashboard.used, { percent: formatLocalizedPercent(wantsSpentPct, intlLocale) })}</span>
              </div>
              <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${wantsSpentPct >= 100 ? 'bg-error' : 'bg-amber-500'}`}
                  style={{ width: `${wantsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium font-mono text-on-surface-variant">
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
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span className="font-bold text-on-surface">{t(m.dashboard.savingsLabel, { percent: formatLocalizedPercent(strategy.savingsRatio * 100, intlLocale) })}</span>
                </div>
                <span className="text-[11px] font-semibold text-primary">
                  {t(m.dashboard.activeGoals, { count: goals.length })}
                </span>
              </div>
              <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-600 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((depositedSavings / (savings || 1)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium font-mono text-on-surface-variant">
                <span title={m.dashboard.depositedThisMonth}>{format(depositedSavings)}</span>
                <span>{format(savings)}</span>
              </div>
            </div>
          </div>

          {/* Monthly Income Summary Banner */}
          <div className="grid grid-cols-1 gap-4 bg-surface-container p-5 sm:grid-cols-2 sm:items-end sm:gap-8 sm:p-6 rounded-3xl border border-outline-variant shadow-2xs">
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                {m.dashboard.totalMonthlyBudget}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                {isEditingBudget ? (
                  <div className="flex min-w-0 items-baseline gap-1 rounded-2xl bg-surface px-2 py-0.5 ring-2 ring-primary/40">
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
                      className="bg-transparent text-xl font-bold font-mono text-on-surface outline-none"
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
                    className="-ms-2 flex min-w-0 items-baseline gap-1 rounded-2xl px-2 py-0.5 text-start transition-colors hover:bg-surface-variant/60"
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
                    className="flex shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary"
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
                    className="flex shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary"
                  >
                    <AppIcon name="tune" className="text-[14px]" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Recent Activity) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Upcoming bills — fixed charges coming due in the next 7 days of
              this period. fixedBills is its own RBAC area, so members without
              that grant never see what is about to be paid. */}
          {canViewArea('fixedBills') && upcomingBills.length > 0 && (
            <div className="bg-surface-container rounded-3xl border border-outline-variant shadow-2xs p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-base text-on-surface">
                  {m.dashboard.upcomingBills}
                </h3>
                <button
                  onClick={() => onSelectTab('fixed')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {m.common.viewAll}
                </button>
              </div>
              <ul className="flex flex-col gap-2">
                {upcomingBills.map((bill) => (
                  <li
                    key={bill.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-3 py-2.5 border border-outline-variant"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          bill.daysUntil === 0 ? 'bg-error/10 text-error' : 'bg-tertiary/10 text-tertiary'
                        }`}
                      >
                        <AppIcon name="event_upcoming" className="text-[18px]" />
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-on-surface truncate">{bill.name}</span>
                        <span className={`text-[11px] font-semibold ${bill.daysUntil === 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                          {bill.daysUntil === 0
                            ? m.dashboard.dueToday
                            : t(m.dashboard.dueInDays, { days: bill.daysUntil })}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-sm text-on-surface shrink-0">
                      {format(bill.remaining)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-on-surface">
                {m.dashboard.recentActivity}
              </h3>
              <button
                onClick={() => onSelectTab('variable')}
                className="text-xs font-bold text-primary hover:underline"
              >
                {m.common.viewAll}
              </button>
            </div>

            {recentItems.length === 0 ? (
              <div className="p-8 bg-surface-container rounded-3xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-3  shadow-2xs">
                <AppIcon name="receipt_long" className="text-outline text-[40px]" />
                <p className="text-xs text-on-surface-variant">{m.dashboard.noActivityYet}</p>
                {canEditExpenses && (
                  <button
                    onClick={onOpenExpenseModal}
                    className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-full shadow-2xs hover:bg-primary/90 transition-all"
                  >
                    {m.dashboard.addFirstExpense}
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-surface-container rounded-3xl border border-outline-variant p-2 shadow-2xs flex flex-col divide-y divide-outline-variant/60">
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
                      className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                        canEditExpenses ? 'cursor-pointer hover:bg-surface-variant/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <AppIcon name={item.icon} className="text-[20px]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-on-surface truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-on-surface-variant mt-0.5">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <FormattedAmount
                          value={item.amount}
                          prefix="-"
                          className="font-bold text-sm font-mono text-on-surface"
                        />
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
                      className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                        canEditSavings || canSeeSavings ? 'cursor-pointer hover:bg-surface-variant/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.isDeposit ? 'bg-secondary/10 text-secondary' : 'bg-surface-variant text-on-surface-variant'}`}>
                          <AppIcon name="savings" className="text-[20px]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-on-surface truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-on-surface-variant mt-0.5">
                            {item.subtitle}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <span
                          className={`font-bold text-sm font-mono ${item.isDeposit ? 'text-secondary' : 'text-on-surface-variant'}`}
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
