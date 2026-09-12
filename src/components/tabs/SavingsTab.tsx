import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import { MoneyFigure } from '@/components/ui/money-figure';
import React from 'react';
import {
  SavingGoal,
  MonthBudget,
  SavingsActivityEntry,
  calculateMonthlyDepositedSavings,
} from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
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
  /** Pro projection ("at this pace you reach the goal by …"). */
  projectionsUnlocked?: boolean;
  onUpgrade?: () => void;
  /** Months (oldest → newest, current last) used to measure the deposit pace. */
  paceMonths?: MonthBudget[];
  /** Household: show who contributed to each goal (from the activity logs). */
  showContributors?: boolean;
}

/** Net contribution per member across the given months' activity logs. */
export function goalContributions(
  months: MonthBudget[],
  goalId: string,
): Array<{ key: string; name: string; amount: number }> {
  const totals = new Map<string, { name: string; amount: number }>();
  for (const mo of months) {
    for (const entry of mo.savingsActivity || []) {
      if (entry.goalId !== goalId) continue;
      const key = entry.actorMemberId || entry.actorName || '__unknown';
      const bucket = totals.get(key) || { name: entry.actorName || '', amount: 0 };
      bucket.amount += entry.type === 'deposit' ? entry.amount : -entry.amount;
      if (!bucket.name && entry.actorName) bucket.name = entry.actorName;
      totals.set(key, bucket);
    }
  }
  return Array.from(totals.entries())
    .map(([key, v]) => ({ key, ...v }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

const formatEntryDate = (value: string, intlLocale: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' });
};

import { GoalProjection } from '../dashboard/goal-projection';

// Contributor swatches follow the chart palette so they track dark mode.
const CONTRIB_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-5)', 'var(--chart-4)', 'var(--tertiary)', 'var(--chart-3)'];

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

/** Compact progress ring with the percentage in the middle (goal cards). */
function GoalRing({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative size-16 shrink-0" aria-hidden="true">
      <svg viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} className="size-full -rotate-90">
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R} fill="none" stroke="var(--surface-variant)" strokeWidth={RING_STROKE} />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          fill="none"
          stroke={clamped >= 100 ? 'var(--lime-deep)' : 'var(--forest)'}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * RING_C} ${RING_C}`}
          className="transition-[stroke-dasharray] duration-700 ease-out dark:[stroke:var(--lime)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular text-on-surface">
        {label}
      </span>
    </div>
  );
}

function goalNetDeposits(month: MonthBudget, goalId: string): number {
  let net = 0;
  for (const entry of month.savingsActivity || []) {
    if (entry.goalId !== goalId) continue;
    net += entry.type === 'deposit' ? entry.amount : -entry.amount;
  }
  return Math.max(0, net);
}

export function SavingsTab({
  goals,
  onOpenCreateGoal,
  onOpenFundModal,
  onOpenWithdrawModal,
  onOpenEditGoal,
  month,
  onEditDeposit,
  canEdit = true,
  projectionsUnlocked = false,
  onUpgrade,
  paceMonths,
  showContributors = false,
}: SavingsTabProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();

  const totalSavings = goals.reduce((acc, g) => acc + g.current, 0);
  const deposits = (month?.savingsActivity || []).slice();
  const monthlyNet = month ? calculateMonthlyDepositedSavings(month) : 0;

  return (
    <div className="flex flex-col gap-5 pb-24">
      {/* ── Hero: total saved (forest panel, as in the "Income" tile of the design) ── */}
      <section className="surface-forest relative overflow-hidden rounded-[1.75rem] p-5 shadow-forest sm:p-6">
        <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-2/5 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-lime text-forest-deep">
                <AppIcon name="savings" strokeWidth={2.2} className="text-[16px]" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/70">
                {m.tabs.savings.totalAccumulated}
              </span>
            </div>
            <h2 className="mt-3">
              <MoneyFigure value={totalSavings} size="hero" tone="accent" className="text-white" />
            </h2>
            <p className="mt-1.5 text-[13px] font-medium text-white/60">
              {t(m.dashboard.activeGoals, { count: goals.length })}
              {month ? ` · ${t(m.tabs.savings.saved, { amount: format(monthlyNet) })} ${m.dashboard.thisMonth.toLowerCase()}` : ''}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onOpenCreateGoal}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-lime px-5 text-[14px] font-semibold text-forest-deep shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] transition-all hover:bg-lime-bright active:scale-[0.98] sm:self-auto"
            >
              <AppIcon name="add" strokeWidth={2.4} className="text-[18px]" />
              <span>{m.tabs.savings.newGoal}</span>
            </button>
          )}
        </div>
      </section>

      {/* ── Goals ── */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[1.75rem] border border-dashed border-outline-variant bg-surface-container-lowest p-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-mint text-forest dark:text-lime">
            <AppIcon name="savings" className="text-[26px]" />
          </span>
          <p className="text-[14px] font-medium text-on-surface-variant">{m.tabs.savings.noActiveGoals}</p>
          {canEdit && (
            <button
              type="button"
              onClick={onOpenCreateGoal}
              className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-[14px] font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              <AppIcon name="add" className="text-[18px]" />
              {m.tabs.savings.createEmergencyFund}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
            const remaining = Math.max(0, goal.target - goal.current);
            const pctLabel = formatLocalizedPercent(pct, intlLocale);

            return (
              <article
                key={goal.id}
                className="flex flex-col gap-4 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient transition-shadow hover:shadow-floating"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-forest text-lime">
                      <AppIcon name="savings" strokeWidth={2} className="text-[20px]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[16px] font-semibold text-on-surface">{goal.name}</h3>
                      <span className="block truncate text-[12px] font-medium text-on-surface-variant">
                        {t(m.tabs.savings.source, { place: localizePlaceName(goal.source || 'bank', goal.source || 'bank', m) })}
                      </span>
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onOpenEditGoal(goal)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      aria-label={m.tabs.savings.editGoal}
                    >
                      <AppIcon name="more_vert" className="text-[20px]" />
                    </button>
                  )}
                </div>

                {/* Balance + ring */}
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <MoneyFigure value={goal.current} size="lg" weight="semibold" className="text-on-surface" />
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] font-medium text-on-surface-variant">
                      <span>{t(m.tabs.savings.target, { amount: format(goal.target) })}</span>
                      {remaining > 0 && (
                        <span className="rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-forest dark:text-lime">
                          {m.common.remaining} {format(remaining)}
                        </span>
                      )}
                    </p>
                  </div>
                  <GoalRing pct={pct} label={pctLabel} />
                </div>

                {/* Progress bar (lime fill on a mint track) */}
                <div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-mint" aria-hidden="true">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-lime-deep' : 'bg-forest dark:bg-lime'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="sr-only">{t(m.tabs.savings.percentReached, { percent: pctLabel })}</p>
                </div>

                {showContributors && (() => {
                  const contributions = goalContributions(paceMonths || (month ? [month] : []), goal.id);
                  if (contributions.length === 0) return null;
                  const sum = contributions.reduce((a, c) => a + c.amount, 0);
                  return (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{m.tabs.savings.contributors}</span>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-variant" aria-hidden="true">
                        {contributions.map((c, idx) => (
                          <div key={c.key} style={{ width: `${(c.amount / sum) * 100}%`, backgroundColor: CONTRIB_COLORS[idx % CONTRIB_COLORS.length] }} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-on-surface-variant">
                        {contributions.map((c, idx) => (
                          <span key={c.key} className="flex items-center gap-1">
                            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: CONTRIB_COLORS[idx % CONTRIB_COLORS.length] }} />
                            <span className="font-semibold text-on-surface">{c.name || m.tabs.savings.unknownContributor}</span>
                            <span className="tabular">{format(c.amount)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <GoalProjection
                  goal={goal}
                  monthlyDeposits={(paceMonths || (month ? [month] : [])).map((mo) => goalNetDeposits(mo, goal.id))}
                  unlocked={projectionsUnlocked}
                  onUpgrade={onUpgrade ?? (() => {})}
                />

                {/* Deposit / Withdraw pills */}
                {canEdit && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onOpenFundModal(goal)}
                      className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] transition-all hover:bg-primary-hover active:scale-[0.98]"
                    >
                      <AppIcon name="add_circle" strokeWidth={2} className="text-[18px]" />
                      <span>{m.dashboard.deposit}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenWithdrawModal(goal)}
                      className="flex h-11 items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest text-[14px] font-semibold text-on-surface transition-all hover:bg-surface-container-high active:scale-[0.98]"
                    >
                      <AppIcon name="remove_circle" strokeWidth={2} className="text-[18px]" />
                      <span>{m.dashboard.withdraw}</span>
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── This month's deposits — every entry is editable / deletable so the
          savings plan always matches the money that actually moved. ── */}
      <section className="flex flex-col gap-4 rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
              {m.tabs.savings.thisMonthsDeposits}
            </span>
            <span className="text-[13px] font-medium text-on-surface-variant">
              {t(m.tabs.savings.movementsLogged, { count: deposits.length })}
            </span>
          </div>
          {month && (
            <span className="shrink-0 rounded-full bg-lime px-3 py-1 text-[12px] font-semibold text-forest-deep">
              {t(m.tabs.savings.saved, { amount: format(monthlyNet) })}
            </span>
          )}
        </div>

        {deposits.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
            <AppIcon name="savings" className="text-[28px] text-outline" />
            <p className="text-[13px] font-medium text-on-surface-variant">{m.tabs.savings.noDeposits}</p>
            <p className="text-[12px] text-on-surface-variant">{m.tabs.savings.useDeposit}</p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-outline-variant/60">
            {deposits.map((entry) => {
              const isDeposit = entry.type === 'deposit';
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                        isDeposit ? 'bg-lime text-forest-deep' : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      <AppIcon name={isDeposit ? 'arrow_downward' : 'arrow_upward'} strokeWidth={2.2} className="text-[18px]" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-semibold text-on-surface">{entry.goalName}</span>
                      <span className="truncate text-[12px] font-medium text-on-surface-variant">
                        {isDeposit ? m.dashboard.deposit : m.dashboard.withdrawal} · {formatEntryDate(entry.date, intlLocale)}
                        {entry.place ? ` · ${localizePlaceName(entry.place, entry.place, m)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <FormattedAmount
                      value={entry.amount}
                      prefix={isDeposit ? '+' : '−'}
                      className={`tabular text-[13px] font-semibold ${isDeposit ? 'text-forest dark:text-lime' : 'text-on-surface-variant'}`}
                    />
                    {canEdit && onEditDeposit && (
                      <button
                        type="button"
                        onClick={() => onEditDeposit(entry)}
                        aria-label={isDeposit ? m.tabs.savings.editDeposit : m.tabs.savings.editWithdrawal}
                        className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                      >
                        <AppIcon name="edit" className="text-[15px]" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
