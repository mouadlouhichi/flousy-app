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
  resolveMonthStrategy,
  totalCashOnHand,
  StrategyId,
  SavingsActivityEntry,
} from '../../lib/store';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { useCurrency } from '../../lib/currency-context';
import { StrategySelectorModal } from '../modals/StrategySelectorModal';
import { useHousehold } from '@/lib/household-context';

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
  const { places } = useMoneyPlaces(month);
  const { workspace, canViewArea, canEditArea } = useHousehold();
  const canSeeBalances = workspace === 'personal' || canViewArea('balances');
  const canEditBalances = workspace === 'personal' || canEditArea('balances');
  const redacted = '••••';
  const budgetInputRef = useRef<HTMLInputElement>(null);
  // Set when Enter/Escape finishes editing so the programmatic blur doesn't re-trigger save
  const editFinishedRef = useRef(false);
  const [draftBudget, setDraftBudget] = useState(String(month.totalBudget || 0));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);

  const { needs, wants, savings } = calculateEnvelopeAmounts(
    month.totalBudget,
    month.strategyId,
    month.customRatios,
  );
  const spent = calculateEnvelopeSpent(month);
  const strategy = resolveMonthStrategy(month);

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

  const recentExpenses = (month.variableExpenses || []).slice(0, 5);

  // The savings plan counts only the deposits logged on THIS month — goals
  // outlive the budget period, so their lifetime balance (including "already
  // saved" bookkeeping) must not leak into the current month's progress.
  const depositedSavings = calculateMonthlyDepositedSavings(month);

  // Recent Activity merges logged expenses with savings deposits/withdrawals,
  // newest first.
  const recentSavings: SavingsActivityEntry[] = (month.savingsActivity || []).slice(0, 5);
  const recentItems: Array<
    | { kind: 'expense'; id: string; name: string; subtitle: string; amount: number; icon: string; date: Date }
    | { kind: 'savings'; id: string; name: string; subtitle: string; amount: number; isDeposit: boolean; date: Date }
  > = [
    ...recentExpenses.map((exp) => ({
      kind: 'expense' as const,
      id: exp.id,
      name: exp.name,
      subtitle: `${exp.date} • ${exp.type}`,
      amount: exp.amount,
      icon: month.categoryIcons?.[exp.type] || 'shopping_bag',
      date: new Date(exp.date),
    })),
    ...recentSavings.map((evt) => ({
      kind: 'savings' as const,
      id: evt.id,
      name: evt.goalName,
      subtitle: `${evt.type === 'deposit' ? 'Deposit' : 'Withdrawal'} • Savings`,
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
      {/* Money place cards */}
      <div className="flex flex-col gap-3">
        {places.map((place, index) => {
          const tone = placeCardTones[index % placeCardTones.length];
          const balance = getPlaceBalance(month, place.id);
          const parts = formatParts(balance);
          return (
            <div
              key={place.id}
              className={`p-4 sm:p-5 bg-surface-container rounded-3xl border border-outline-variant shadow-2xs flex items-center justify-between ${tone.wrap} transition-all`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl ${tone.icon} flex items-center justify-center shadow-2xs shrink-0`}>
                  <AppIcon name={place.icon} className="text-[20px]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-base text-on-surface truncate">{place.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-on-surface font-mono">
                      {canSeeBalances ? parts.amount : redacted}
                    </span>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {canSeeBalances ? parts.currency : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={canEditBalances ? onOpenMoveMoneyModal : undefined}
                  className={`text-xs font-bold ${tone.action} hover:underline cursor-pointer flex items-center gap-1`}
                >
                  <span>Move</span>
                  <AppIcon name="swap_horiz" className="text-[14px]" />
                </button>
              </div>
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
                Budget Plan
              </h3>
              {onUpdateStrategy ? (
                <button
                  type="button"
                  onClick={() => setIsStrategyModalOpen(true)}
                  className="flex items-center gap-1.5 bg-surface-variant/60 hover:bg-surface-variant rounded-full px-3 py-1.5 transition-all cursor-pointer group"
                  aria-label="Change budget strategy"
                >
                  <AppIcon name="package" className="text-[12px] text-primary " />
                  <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface">
                    {strategy.name}
                  </span>
                  <AppIcon name="chevron_right" className="text-[12px] text-on-surface-variant rotate-90" />
                </button>
              ) : (
                <span className="text-[10px] font-bold tracking-wider uppercase text-on-surface-variant">
                  {strategy.name}
                </span>
              )}
            </div>

            {/* Needs Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-bold text-on-surface">Needs ({Math.round(strategy.needsRatio * 100)}%)</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{needsSpentPct}% Used</span>
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
                  <span className="font-bold text-on-surface">Wants ({Math.round(strategy.wantsRatio * 100)}%)</span>
                </div>
                <span className="text-[11px] font-semibold text-on-surface-variant">{wantsSpentPct}% Used</span>
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
              onClick={() => onSelectTab('savings')}
              className="flex flex-col gap-1.5 hover:opacity-80 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span className="font-bold text-on-surface">Savings ({Math.round(strategy.savingsRatio * 100)}%)</span>
                </div>
                <span className="text-[11px] font-semibold text-primary">
                  {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="w-full h-2.5 bg-primary/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-600 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((depositedSavings / (savings || 1)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-medium font-mono text-on-surface-variant">
                <span title="Deposited into goals this month">{format(depositedSavings)}</span>
                <span>{format(savings)}</span>
              </div>
            </div>
          </div>

          {/* Monthly Income Summary Banner */}
          <div className="grid grid-cols-1 gap-4 bg-surface-container p-5 sm:grid-cols-2 sm:items-end sm:gap-8 sm:p-6 rounded-3xl border border-outline-variant shadow-2xs">
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                Total Monthly Budget
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                {isEditingBudget ? (
                  <div className="flex min-w-0 items-baseline gap-1 rounded-2xl bg-surface px-2 py-0.5 ring-2 ring-primary/40">
                    <input
                      ref={budgetInputRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label="Total monthly budget"
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
                ) : (
                  <button
                    type="button"
                    onClick={canEditBalances ? () => setIsEditingBudget(true) : undefined}
                    title="Click to edit your monthly budget"
                    className="-ml-2 flex min-w-0 items-baseline gap-1 rounded-2xl px-2 py-0.5 text-left transition-colors hover:bg-surface-variant/60"
                  >
                    <span className="text-xl font-bold font-mono text-on-surface">
                      {canSeeBalances ? budgetParts.amount : redacted}
                    </span>
                    {canSeeBalances && (
                      <span className="text-xs font-semibold text-on-surface-variant">
                        {budgetParts.currency}
                      </span>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={canEditBalances ? () => setIsEditingBudget(true) : undefined}
                  aria-label="Edit total monthly budget"
                  className="flex shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary"
                >
                  <AppIcon name="edit" className="text-[14px]" />
                </button>
              </div>
            </div>
            <div className="min-w-0 border-t border-outline-variant/50 pt-4 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                Total Cash on Hand
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex min-w-0 items-baseline gap-1">
                  <span className="text-[28px] font-extrabold leading-none tracking-tight text-primary tabular-nums sm:text-[32px]">
                    {canSeeBalances ? cashParts.amount : redacted}
                  </span>
                  {canSeeBalances && (
                    <span className="shrink-0 text-[13px] font-bold text-on-surface-variant">
                      {cashParts.currency}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onEditMoneyPlaces}
                  aria-label="Adjust cash balances"
                  title="Adjust cash balances"
                  className="flex shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface p-1.5 text-on-surface-variant transition-colors hover:bg-surface-variant/50 hover:text-primary"
                >
                  <AppIcon name="tune" className="text-[14px]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Recent Activity) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-on-surface">
                Recent Activity
              </h3>
              <button
                onClick={() => onSelectTab('variable')}
                className="text-xs font-bold text-primary hover:underline"
              >
                View All
              </button>
            </div>

            {recentItems.length === 0 ? (
              <div className="p-8 bg-surface-container rounded-3xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-3  shadow-2xs">
                <AppIcon name="receipt_long" className="text-outline text-[40px]" />
                <p className="text-xs text-on-surface-variant">No expenses or savings deposits yet this month.</p>
                <button
                  onClick={onOpenExpenseModal}
                  className="px-4 py-2 bg-primary text-on-primary text-xs font-bold rounded-full shadow-2xs hover:bg-primary/90 transition-all"
                >
                  Add First Expense
                </button>
              </div>
            ) : (
              <div className="bg-surface-container rounded-3xl border border-outline-variant p-2 shadow-2xs flex flex-col divide-y divide-outline-variant/60">
                {recentItems.map((item) =>
                  item.kind === 'expense' ? (
                    <div
                      key={`exp-${item.id}`}
                      onClick={() => onOpenEditExpense(recentExpenses.find((exp) => exp.id === item.id))}
                      className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-variant/30 transition-colors"
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
                      <div className="text-right shrink-0">
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
                      role={onOpenEditSavings ? 'button' : undefined}
                      onClick={() => {
                        const entry = recentSavings.find((evt) => evt.id === item.id);
                        if (onOpenEditSavings && entry) onOpenEditSavings(entry);
                        else onSelectTab('savings');
                      }}
                      className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface-variant/30 transition-colors"
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
                      <div className="text-right shrink-0">
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
teStrategy(strategyId, ratios)}
        />
      )}
    </>
  );
}
