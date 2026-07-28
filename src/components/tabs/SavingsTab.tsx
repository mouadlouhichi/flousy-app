import React from 'react';
import { SavingGoal, MoneyPlace } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';

interface SavingsTabProps {
  goals: SavingGoal[];
  onOpenCreateGoal: () => void;
  onOpenFundModal: (goal: SavingGoal) => void;
  onOpenWithdrawModal: (goal: SavingGoal) => void;
  onOpenEditGoal: (goal: SavingGoal) => void;
}

export function SavingsTab({
  goals,
  onOpenCreateGoal,
  onOpenFundModal,
  onOpenWithdrawModal,
  onOpenEditGoal,
}: SavingsTabProps) {
  const { format } = useCurrency();

  const totalSavings = goals.reduce((acc, g) => acc + g.current, 0);

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header Banner */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
            TOTAL ACCUMULATED SAVINGS
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            {format(totalSavings)}
          </h2>
        </div>
        <button
          onClick={onOpenCreateGoal}
          className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>New Goal</span>
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <span className="material-symbols-outlined text-outline text-[44px]">savings</span>
          <p className="font-body-md text-body-md text-on-surface-variant">No active savings goals defined.</p>
          <button
            onClick={onOpenCreateGoal}
            className="mt-xs px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl font-bold"
          >
            Create Emergency Fund or Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {goals.map((goal) => {
            const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;

            return (
              <div
                key={goal.id}
                className="p-lg bg-surface rounded-3xl border border-outline-variant flex flex-col justify-between gap-md hover:border-primary transition-all"
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-sm">
                    <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                      <span className="material-symbols-outlined text-[26px]">savings</span>
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-extrabold">
                        {goal.name}
                      </h3>
                      <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                        Source: {goal.source || 'bank'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenEditGoal(goal)}
                    className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
                    aria-label="Edit goal"
                  >
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                </div>

                {/* Balance & Progress */}
                <div className="flex flex-col gap-xs">
                  <div className="flex justify-between items-baseline font-mono">
                    <span className="text-headline-md text-on-surface font-extrabold">
                      {format(goal.current)}
                    </span>
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      Target: {format(goal.target)}
                    </span>
                  </div>

                  <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-end font-label-sm text-label-sm font-bold text-secondary">
                    {pct}% Reached
                  </div>
                </div>

                {/* Quick Fund & Withdraw Actions */}
                <div className="grid grid-cols-2 gap-sm pt-xs border-t border-surface-variant">
                  <button
                    onClick={() => onOpenFundModal(goal)}
                    className="py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Deposit</span>
                  </button>

                  <button
                    onClick={() => onOpenWithdrawModal(goal)}
                    className="py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface-variant rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-xs transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">remove_circle</span>
                    <span>Withdraw</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
