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
  const { format, symbol } = useCurrency();

  const { needs, wants, savings } = calculateEnvelopeAmounts(month.totalBudget, month.strategyId);
  const spent = calculateEnvelopeSpent(month);
  const strategy = STRATEGIES[month.strategyId] || STRATEGIES['50-30-20'];

  const totalCash = (month.bankPart || 0) + (month.homePart || 0) + (month.walletPart || 0);

  const needsSpentPct = needs > 0 ? Math.min(100, Math.round((spent.needs / needs) * 100)) : 0;
  const wantsSpentPct = wants > 0 ? Math.min(100, Math.round((spent.wants / wants) * 100)) : 0;

  const recentExpenses = (month.variableExpenses || []).slice(0, 5);

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Top 3 Money Places Cards (IS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bank */}
        <div className="p-5 bg-surface-container/60 rounded-3xl border border-outline-variant/60 flex flex-col justify-between gap-3 shadow-xs hover:border-primary/50 transition-all">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">account_balance</span>
            </div>
            <span className="font-label-sm text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant/80">
              BANK
            </span>
          </div>
          <div>
            <h4 className="font-label-lg text-on-surface-variant font-medium">CIH Bank</h4>
            <div className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono mt-0.5">
              {format(month.bankPart || 0)}
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="self-start text-primary font-label-md font-bold hover:underline flex items-center gap-1 text-xs"
          >
            <span>Move Money</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        {/* Physical / Home Cash */}
        <div className="p-5 bg-surface-container/60 rounded-3xl border border-outline-variant/60 flex flex-col justify-between gap-3 shadow-xs hover:border-tertiary/50 transition-all">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">home</span>
            </div>
            <span className="font-label-sm text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant/80">
              PHYSICAL
            </span>
          </div>
          <div>
            <h4 className="font-label-lg text-on-surface-variant font-medium">Home Cash</h4>
            <div className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono mt-0.5">
              {format(month.homePart || 0)}
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="self-start text-tertiary font-label-md font-bold hover:underline flex items-center gap-1 text-xs"
          >
            <span>Add Funds</span>
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>

        {/* Liquid / Wallet */}
        <div className="p-5 bg-surface-container/60 rounded-3xl border border-outline-variant/60 flex flex-col justify-between gap-3 shadow-xs hover:border-secondary/50 transition-all">
          <div className="flex justify-between items-start">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
            </div>
            <span className="font-label-sm text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant/80">
              LIQUID
            </span>
          </div>
          <div>
            <h4 className="font-label-lg text-on-surface-variant font-medium">Daily Wallet</h4>
            <div className="font-headline-md text-headline-md font-extrabold text-on-surface font-mono mt-0.5">
              {format(month.walletPart || 0)}
            </div>
          </div>
          <button
            onClick={onOpenMoveMoneyModal}
            className="self-start text-secondary font-label-md font-bold hover:underline flex items-center gap-1 text-xs"
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
          <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-5 shadow-xs">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-extrabold">
                  Budget Plan
                </h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Tracking your {strategy.name} monthly strategy
                </span>
              </div>
              <span className="px-3 py-1 bg-primary/10 text-primary font-label-sm text-label-sm rounded-full font-bold uppercase tracking-wider">
                {strategy.name}
              </span>
            </div>

            {/* Needs Bar */}
            <div className="flex flex-col gap-1.5 p-4 bg-surface rounded-2xl border border-outline-variant/40">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="font-label-lg font-bold text-on-surface">Needs ({Math.round(strategy.needsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">{needsSpentPct}% Used</span>
              </div>
              <div className="w-full h-3 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${needsSpentPct >= 100 ? 'bg-error' : 'bg-primary'}`}
                  style={{ width: `${needsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant pt-1">
                <span>Used: {format(spent.needs)}</span>
                <span className="font-mono font-bold">Limit: {format(needs)}</span>
              </div>
            </div>

            {/* Wants Bar */}
            <div className="flex flex-col gap-1.5 p-4 bg-surface rounded-2xl border border-outline-variant/40">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary" />
                  <span className="font-label-lg font-bold text-on-surface">Wants ({Math.round(strategy.wantsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-on-surface-variant">{wantsSpentPct}% Used</span>
              </div>
              <div className="w-full h-3 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${wantsSpentPct >= 100 ? 'bg-error' : 'bg-tertiary'}`}
                  style={{ width: `${wantsSpentPct}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant pt-1">
                <span>Used: {format(spent.wants)}</span>
                <span className="font-mono font-bold">Limit: {format(wants)}</span>
              </div>
            </div>

            {/* Savings Bar */}
            <div
              onClick={() => onSelectTab('savings')}
              className="flex flex-col gap-1.5 p-4 bg-surface rounded-2xl border border-outline-variant/40 hover:border-secondary transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span className="font-label-lg font-bold text-on-surface">Savings ({Math.round(strategy.savingsRatio * 100)}%)</span>
                </div>
                <span className="font-label-sm text-label-sm font-bold text-secondary">
                  {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="w-full h-3 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((goals.reduce((acc, g) => acc + g.current, 0) / (savings || 1)) * 100))}%` }}
                />
              </div>
              <div className="flex justify-between font-label-sm text-label-sm text-on-surface-variant pt-1">
                <span>Saved: {format(goals.reduce((acc, g) => acc + g.current, 0))}</span>
                <span className="font-mono font-bold">Target: {format(savings)}</span>
              </div>
            </div>
          </div>

          {/* Monthly Income Summary Banner */}
          <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center shadow-xs">
            <div>
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-extrabold">
                TOTAL MONTHLY BUDGET
              </span>
              <h3 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-1">
                {format(month.totalBudget)}
              </h3>
            </div>
            <div className="text-right">
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">
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
                    className="p-3.5 bg-surface rounded-2xl border border-outline-variant/60 flex justify-between items-center hover:border-primary transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-surface-container/80 text-primary font-bold flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px]">
                          {month.categoryIcons?.[exp.type] || 'shopping_bag'}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-headline-sm text-sm text-on-surface font-bold">
                          {exp.name}
                        </span>
                        <div className="flex items-center gap-1.5 font-label-sm text-[11px] text-on-surface-variant">
                          <span>{exp.date}</span>
                          <span>•</span>
                          <span className="capitalize">{exp.type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="font-mono font-extrabold text-body-md text-on-surface">
                        -{format(exp.amount)}
                      </span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant/70 uppercase tracking-wider font-bold">
                        {exp.place === 'bank' ? 'CIH BANK' : exp.place === 'wallet' ? 'DAILY WALLET' : 'HOME CASH'}
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
