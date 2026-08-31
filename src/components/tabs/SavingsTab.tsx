import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import React from 'react';
import {
  SavingGoal,
  MonthBudget,
  SavingsActivityEntry,
  calculateMonthlyDepositedSavings,
} from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizePlaceName } from '@/lib/localized-labels';

interface SavingsTabProps {
  goals: SavingGoal[];
  onOpenCreateGoal: () => void;
  onOpenFundModal: (goal: SavingGoal) => void;
  onOpenWithdrawModal: (goal: SavingGoal) => void;
  onOpenEditGoal: (goal: SavingGoal) => void;
  /** Current month — its `savingsActivity` log is the deposit history. */
  month?: MonthBudget;
  /** Open the editor for a logged deposit / withdrawal. */
  onEditDeposit?: (entry: SavingsActivityEntry) => void;
  canEdit?: boolean;
}

const formatEntryDate = (value: string, intlLocale: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' });
};

export function SavingsTab({
  goals,
  onOpenCreateGoal,
  onOpenFundModal,
  onOpenWithdrawModal,
  onOpenEditGoal,
  month,
  onEditDeposit,
  canEdit = true,
}: SavingsTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();

  const totalSavings = goals.reduce((acc, g) => acc + g.current, 0);
  const deposits = (month?.savingsActivity || []).slice();
  const monthlyNet = month ? calculateMonthlyDepositedSavings(month) : 0;

  return (
    <div className="flex flex-col gap-lg pb-24">
      {/* Header Banner */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex justify-between items-center">
        <div>
          <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
            {m.tabs.savings.totalAccumulated}
          </span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface font-extrabold mt-0.5">
            <FormattedAmount value={totalSavings} />
          </h2>
        </div>
        <button
          onClick={onOpenCreateGoal}
          className="px-4 py-3 bg-primary text-on-primary rounded-xl font-label-md text-label-md font-bold flex items-center gap-xs shadow-sm hover:shadow-md transition-all"
        >
          <AppIcon name="add" className=" text-[20px]" />
          <span>{m.tabs.savings.newGoal}</span>
        </button>
      </div>

      {/* Goals Grid */}
      {goals.length === 0 ? (
        <div className="p-xl bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-sm">
          <AppIcon name="savings" className=" text-outline text-[44px]" />
          <p className="font-body-md text-body-md text-on-surface-variant">{m.tabs.savings.noActiveGoals}</p>
          <button
            onClick={onOpenCreateGoal}
            className="mt-xs px-4 py-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl font-bold"
          >
            {m.tabs.savings.createEmergencyFund}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          {goals.map((goal) => {
            const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;

            return (
              <div
                key={goal.id}
                className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex flex-col justify-between gap-md hover:border-primary transition-all shadow-2xs"
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-sm">
                    <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
                      <AppIcon name="savings" className=" text-[26px]" />
                    </div>
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-extrabold">
                        {goal.name}
                      </h3>
                      <span className="font-label-sm text-label-sm text-on-surface-variant capitalize">
                        {t(m.tabs.savings.source, { place: localizePlaceName(goal.source || 'bank', goal.source || 'bank', m) })}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenEditGoal(goal)}
                    className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
                    aria-label={m.tabs.savings.editGoal}
                  >
                    <AppIcon name="more_vert" className=" text-[20px]" />
                  </button>
                </div>

                {/* Balance & Progress */}
                <div className="flex flex-col gap-xs">
                  <div className="flex justify-between items-baseline font-mono">
                    <FormattedAmount
                      value={goal.current}
                      className="text-headline-md text-on-surface font-extrabold"
                    />
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {t(m.tabs.savings.target, { amount: format(goal.target) })}
                    </span>
                  </div>

                  <div className="w-full h-3 bg-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-end font-label-sm text-label-sm font-bold text-secondary">
                    {t(m.tabs.savings.percentReached, { percent: new Intl.NumberFormat(intlLocale).format(pct) })}
                  </div>
                </div>

                {/* Quick Fund & Withdraw Actions */}
                <div className="grid grid-cols-2 gap-sm pt-xs">
                  <button
                    onClick={() => onOpenFundModal(goal)}
                    className="py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-xs transition-colors"
                  >
                    <AppIcon name="add_circle" className=" text-[18px]" />
                    <span>{m.dashboard.deposit}</span>
                  </button>

                  <button
                    onClick={() => onOpenWithdrawModal(goal)}
                    className="py-2.5 bg-surface-container hover:bg-surface-variant text-on-surface-variant rounded-xl font-label-md text-label-md font-bold flex items-center justify-center gap-xs transition-colors"
                  >
                    <AppIcon name="remove_circle" className=" text-[18px]" />
                    <span>{m.dashboard.withdraw}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* This month's deposits — every entry is editable / deletable so the
          savings plan always matches the money that actually moved. */}
      <div className="p-lg bg-surface-container rounded-3xl border border-outline-variant flex flex-col gap-md shadow-2xs">
        <div className="flex items-center justify-between gap-sm">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
              {m.tabs.savings.thisMonthsDeposits}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {t(m.tabs.savings.movementsLogged, { count: deposits.length })}
              {month ? ` · ${t(m.tabs.savings.saved, { amount: format(monthlyNet) })}` : ''}
            </span>
          </div>
        </div>

        {deposits.length === 0 ? (
          <div className="p-lg bg-surface-container/40 rounded-2xl border border-dashed border-outline-variant flex flex-col items-center justify-center text-center gap-xs">
            <AppIcon name="savings" className=" text-outline text-[32px]" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              {m.tabs.savings.noDeposits}
            </p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {m.tabs.savings.useDeposit}
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant/60">
            {deposits.map((entry) => {
              const isDeposit = entry.type === 'deposit';
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-sm py-sm"
                >
                  <div className="flex items-center gap-sm min-w-0">
                    <div
                      className={`p-2.5 rounded-2xl shrink-0 ${
                        isDeposit ? 'bg-secondary/10 text-secondary' : 'bg-surface-variant text-on-surface-variant'
                      }`}
                    >
                      <AppIcon name={isDeposit ? 'add_circle' : 'remove_circle'} className=" text-[20px]" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-md text-label-md font-bold text-on-surface truncate">
                        {entry.goalName}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
                        {isDeposit ? m.dashboard.deposit : m.dashboard.withdrawal} · {formatEntryDate(entry.date, intlLocale)}
                        {entry.place ? ` · ${localizePlaceName(entry.place, entry.place, m)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-xs shrink-0">
                    <FormattedAmount
                      value={entry.amount}
                      prefix={isDeposit ? '+' : '-'}
                      className={`font-mono font-bold ${
                        isDeposit ? 'text-secondary' : 'text-on-surface-variant'
                      }`}
                    />
                    {canEdit && onEditDeposit && (
                      <button
                        type="button"
                        onClick={() => onEditDeposit(entry)}
                        aria-label={isDeposit ? m.tabs.savings.editDeposit : m.tabs.savings.editWithdrawal}
                        className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-full transition-colors"
                      >
                        <AppIcon name="edit" className=" text-[18px]" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
