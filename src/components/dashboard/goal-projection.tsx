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
  canEdit?: boolean;
}

/** "At this pace you reach the goal by …" line inside a goal card. */
export function GoalProjection({ goal, monthlyDeposits, unlocked, onUpgrade, canEdit = true }: GoalProjectionProps) {
  const { profile, updateProfileData } = useAuth();
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.planner;
  const targetDate = profile?.goalTargetDates?.[goal.id];
  const projection = projectSavingsGoal(goal, monthlyDeposits, new Date(), targetDate);

  const monthLabel = (iso: string) => {
    const [y, mo] = iso.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(intlLocale, { month: 'short', year: 'numeric' });
  };

  if (!unlocked) {
    return (
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl bg-surface-container-high px-3 py-2 text-start text-xs text-on-surface-variant"
      >
        <span className="flex items-center gap-1.5">
          <AppIcon name="lock" className="text-[14px] text-primary" />
          <span className="blur-[3px] select-none">{t(p.goalEta, { date: '••• ••••' })}</span>
        </span>
        <span className="font-bold text-primary">Pro</span>
      </button>
    );
  }

  if (projection.done) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-primary">
        <AppIcon name="verified" className="text-[14px]" />
        {p.goalDone}
      </p>
    );
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-xl bg-surface-container-high px-3 py-2 text-xs">
      <p className="flex items-center justify-between gap-2 text-on-surface">
        <span className="flex items-center gap-1.5 font-semibold">
          <AppIcon name="schedule" className="text-[14px] text-primary" />
          {projection.reachedOn ? t(p.goalEta, { date: monthLabel(projection.reachedOn) }) : p.goalNoPace}
        </span>
        {projection.monthlyPace > 0 && (
          <span className="font-mono text-on-surface-variant">{t(p.goalPace, { amount: format(projection.monthlyPace) })}</span>
        )}
      </p>
      <label className="flex items-center justify-between gap-2 text-on-surface-variant">
        <span>{p.goalTargetDate}</span>
        <input
          type="date"
          value={targetDate || ''}
          disabled={!canEdit}
          onChange={(e) => {
            if (!profile) return;
            const next = { ...(profile.goalTargetDates || {}) };
            if (e.target.value) next[goal.id] = e.target.value;
            else delete next[goal.id];
            void updateProfileData({ goalTargetDates: next }).catch(() => {});
          }}
          className="rounded-lg border border-outline-variant bg-surface px-2 py-1 text-xs text-on-surface outline-none focus:border-primary"
        />
      </label>
      {projection.requiredPerMonth !== null && targetDate && (
        <p className="font-semibold text-on-surface">
          {t(p.goalRequired, { amount: format(projection.requiredPerMonth), date: monthLabel(targetDate.slice(0, 7) + '-01') })}
        </p>
      )}
    </div>
  );
}
