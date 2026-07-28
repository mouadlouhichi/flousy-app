import React from 'react';
import { MonthBudget, SavingGoal, calculateEnvelopeAmounts, calculateEnvelopeSpent, STRATEGIES } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface OverviewTabProps {
  month: MonthBudget;
  goals: SavingGoal[];
  onOpenExpenseModal: () => void;
  onOpenMoveMoneyModal: () => void;
  onOpenEditExpense: (expense: any) => void;
  onSelectTab: (tab: 'overview' | 'variable' | 'fixed' | 'savings') => void;
}

export function OverviewTab({
  month,
  goals,
  onOpenExpenseModal,
  onOpenMoveMoneyModal,
  onOpenEditExpense,
  onSelectTab,
}: OverviewTabProps) {
  const { format, formatParts } = useCurrency();

  const { needs, wants, savings } = calculateEnvelopeAmounts(month.totalBudget, month.strategyId);
  const spent = calculateEnvelopeSpent(month);
  const strategy = STRATEGIES[month.strategyId] || STRATEGIES['50-30-20'];

  const totalCash = (month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0);

  const needsSpentPct = needs > 0 ? Math.min(100, Math.round((spent.needs / needs) * 100)) : 0;
  const wantsSpentPct = wants > 0 ? Math.min(100, Math.round((spent.wants / wants) * 100)) : 0;

  const recentExpenses = (month.variableExpenses || []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Top 3 Money Places Cards */}
      <div className="flex flex-col gap-3">
        {/* Bank */}
        <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-outline-variant/80 shadow-xs flex items-center justify-between hover:border-primary/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">account_balance</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-extrabold text-on-surface">Bank</span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono">
                  {formatParts(month.bankPart || 0).amount}
                </span>
                <span className="text-[13px] font-bold text-on-surface-variant">
                  {formatParts(month.bankPart || 0).currency}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="text-primary font-label-md font-bold cursor-pointer flex items-center gap-1 text-[13px]"
          >
            <span>Move Money</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* Home Cash */}
        <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-outline-variant/80 shadow-xs flex items-center justify-between hover:border-tertiary/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">home</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-extrabold text-on-surface">Home Cash</span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono">
                  {formatParts(month.homePart || 0).amount}
                </span>
                <span className="text-[13px] font-bold text-on-surface-variant">
                  {formatParts(month.homePart || 0).currency}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="text-tertiary font-label-md font-bold cursor-pointer flex items-center gap-1 text-[13px]"
          >
            <span>Add Funds</span>
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>

        {/* Wallet */}
        <div className="p-4 sm:p-5 bg-surface rounded-2xl border border-outline-variant/80 shadow-xs flex items-center justify-between hover:border-secondary/40 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-extrabold text-on-surface">Wallet</span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono">
                  {formatParts(month.walletPart || 0).amount}
                </span>
                <span className="text-[13px] font-bold text-on-surface-variant">
                  {formatParts(month.walletPart || 0).currency}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="text-secondary font-label-md font-bold cursor-pointer flex items-center gap-1 text-[13px]"
          >
            <span>Withdraw</span>
            <span className="material-symbols-outlined text-[16px]">south</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Budget Plan + Strategy) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Budget Plan Card */}
          <div className="p-5 sm:p-6 bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-5 shadow-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold">
                Budget Plan
              </h3>
              <span className="font-label-sm text-label-sm font-mono text-on-surface-variant font-bold uppercase">
                {strategy.name}
              </span>
            </div>

            {/* Needs Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-label-lg font-bold text-on-surface">Needs ({Math.round(strategy.needsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">{needsSpentPct}% Used</span>
              </div>
              <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${needsSpentPct >= 100 ? 'bg-error' : 'bg-primary'}`}
                  style={{ width: `${needsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span className="font-mono font-bold">{format(spent.needs)}</span>
                <span className="font-mono font-bold">{format(needs)}</span>
              </div>
            </div>

            {/* Wants Bar */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-label-lg font-bold text-on-surface">Wants ({Math.round(strategy.wantsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">{wantsSpentPct}% Used</span>
              </div>
              <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${wantsSpentPct >= 100 ? 'bg-error' : 'bg-amber-500'}`}
                  style={{ width: `${wantsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span className="font-mono font-bold">{format(spent.wants)}</span>
                <span className="font-mono font-bold">{format(wants)}</span>
              </div>
            </div>

            {/* Savings Bar */}
            <div
              onClick={() => onSelectTab('savings')}
              className="flex flex-col gap-1.5 hover:opacity-80 transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span className="font-label-lg font-bold text-on-surface">Savings ({Math.round(strategy.savingsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-primary">
                  {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-600 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.round((goals.reduce((acc, g) => acc + g.current, 0) / (savings || 1)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span className="font-mono font-bold">{format(goals.reduce((acc, g) => acc + g.current, 0))}</span>
                <span className="font-mono font-bold">{format(savings)}</span>
              </div>
            </div>
          </div>

          {/* Monthly Income Summary Banner */}
          <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center shadow-xs">
            <div>
              <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider font-extrabold">
                TOTAL MONTHLY BUDGET
              </span>
              <h3 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">
                {format(month.totalBudget)}
              </h3>
            </div>
            <div className="text-right">
              <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider block">
                TOTAL CASH ON HAND
              </span>
              <span className="font-headline-sm text-headline-sm text-primary font-extrabold font-mono">
                {format(totalCash)}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column (Recent Activity) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-4 shadow-xs h-full">
            <div className="flex justify-between items-center">
              <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold">
                Recent Activity
              </h3>
              <button
                onClick={() => onSelectTab('variable')}
                className="font-label-md text-label-md text-primary font-bold hover:underline"
              >
                View All History
              </button>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="p-8 bg-surface/50 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-3 my-auto">
                <span className="material-symbols-outlined text-outline text-[40px]">receipt_long</span>
                <p className="font-body-md text-body-md text-on-surface-variant">No expenses logged yet this month.</p>
                <button
                  onClick={onOpenExpenseModal}
                  className="px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl font-bold shadow-xs hover:bg-primary/90 transition-all"
                >
                  Add First Expense
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    onClick={() => onOpenEditExpense(exp)}
                    className="p-3 bg-surface rounded-2xl border border-outline-variant/60 flex justify-between items-center hover:border-primary transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">
                          {month.categoryIcons?.[exp.type] || 'shopping_bag'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[15px] text-on-surface">
                          {exp.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                          <span>{exp.date}</span>
                          <span>•</span>
                          <span className="capitalize">{exp.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-0.5">
                      <span className="font-mono font-extrabold text-[15px] text-on-surface">
                        -{formatParts(exp.amount).amount}
                      </span>
                      <span className="text-[11px] font-bold text-on-surface-variant">
                        {formatParts(exp.amount).currency}
                      </span>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => onSelectTab('variable')}
                  className="w-full py-2.5 mt-2 text-center text-on-surface-variant hover:text-on-surface bg-surface hover:bg-surface-variant/50 rounded-2xl border border-outline-variant/40 font-label-md text-xs font-bold transition-all"
                >
                  Show more transactions
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
