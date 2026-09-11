'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { projectSavingsGoal } from '@/lib/insights';
import type { SavingGoal } from '@/lib/store';

interface GoalProjectionProps {
  goal: SavingGoal;
  /** Net deposits per month, oldest → newest (current month last). */
  monthlyDeposits: number[];
  unlocked: boolean;
  onUpgrade: () => void;
}

/**
 * "At this pace you reach the goal by …" block inside a goal card.
 *
 * Display only: the target date itself is chosen in the goal editor
 * (SavingsModal), this component just reads `profile.goalTargetDates` and
 * shows the ETA / required monthly pace derived from it.
 */
export function GoalProjection({ goal, monthlyDeposits, unlocked, onUpgrade }: GoalProjectionProps) {
  const { profile } = useAuth();
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.planner;
  const targetDate = profile?.goalTargetDates?.[goal.id];
  const projection = projectSavingsGoal(goal, monthlyDeposits, new Date(), targetDate);

  const monthLabel = (iso: string) => {
    const [y, mo] = iso.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(intlLocale, { month: 'short', year: 'numeric' });
  };
  const dayLabel = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return new Date(y, mo - 1, d || 1).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-2xl bg-surface-container-low px-3 py-2.5 text-start text-xs text-on-surface-variant transition-colors hover:bg-surface-container-high"
      >
        <span className="flex items-center gap-1.5">
          <AppIcon name="lock" className="text-[14px] text-primary" />
          <span className="blur-[3px] select-none">{t(p.goalEta, { date: '••• ••••' })}</span>
        </span>
        <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-forest-deep">Pro</span>
      </button>
    );
  }

  if (projection.done) {
    return (
      <p className="mt-1 flex items-center gap-1.5 rounded-2xl bg-lime/40 px-3 py-2 text-xs font-semibold text-forest dark:bg-lime/10 dark:text-lime">
        <AppIcon name="verified" className="text-[14px]" />
        {p.goalDone}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-2xl bg-surface-container-low px-3 py-2.5 text-xs">
      <p className="flex items-center justify-between gap-2 text-on-surface">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          <AppIcon name="schedule" className="shrink-0 text-[14px] text-primary" />
          <span className="truncate">
            {projection.reachedOn ? t(p.goalEta, { date: monthLabel(projection.reachedOn) }) : p.goalNoPace}
          </span>
        </span>
        {projection.monthlyPace > 0 && (
          <span className="shrink-0 tabular text-on-surface-variant">{t(p.goalPace, { amount: format(projection.monthlyPace) })}</span>
        )}
      </p>
      {targetDate && (
        <p className="flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-1.5 text-on-surface">
          <span className="flex min-w-0 items-center gap-1.5 font-semibold">
            <AppIcon name="flag" className="shrink-0 text-[14px] text-secondary" />
            <span className="truncate">
              {p.goalTargetDate} · {dayLabel(targetDate)}
            </span>
          </span>
          {projection.requiredPerMonth !== null && (
            <span className="shrink-0 tabular text-on-surface-variant">
              {t(p.goalPace, { amount: format(projection.requiredPerMonth) })}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
