'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { MoneyFigure } from '@/components/ui/money-figure';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { calculateSafeToSpend } from '@/lib/insights';
import type { MonthBudget } from '@/lib/store';

interface SafeToSpendCardProps {
  month: MonthBudget;
  unlocked: boolean;
  onUpgrade: () => void;
}

/**
 * "You can spend X per day until payday." Pro renders the real numbers; free
 * shows the same card blurred behind a lock so the value is obvious before
 * the upgrade is asked for.
 */
export function SafeToSpendCard({ month, unlocked, onUpgrade }: SafeToSpendCardProps) {
  const { format } = useCurrency();
  const { messages: m, t } = useLanguage();
  const i = m.insights;
  const s = calculateSafeToSpend(month);

  const tone = s.status === 'over'
    ? { chip: 'bg-error/10 text-error', icon: 'trending_down', label: i.statusOver, bar: 'bg-error' }
    : s.status === 'tight'
      ? { chip: 'bg-warning/10 text-warning', icon: 'warning', label: i.statusTight, bar: 'bg-warning' }
      : { chip: 'bg-lime text-forest-deep', icon: 'check_circle', label: i.statusOk, bar: 'bg-secondary' };

  return (
    <section className="relative flex shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-[15px] font-semibold text-on-surface">
          <span className="flex size-9 items-center justify-center rounded-full bg-surface-container-high text-forest dark:text-lime">
            <AppIcon name="speed" className="text-[18px]" />
          </span>
          {i.safeToSpendTitle}
        </h3>
        {unlocked ? (
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.chip}`}>
            <AppIcon name={tone.icon} className="text-[14px]" />
            {tone.label}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-forest-deep">
            <AppIcon name="workspace_premium" className="text-[14px]" />
            Pro
          </span>
        )}
      </div>

      <div className={`flex flex-col ${unlocked ? '' : 'select-none blur-[6px] pointer-events-none'}`} aria-hidden={!unlocked}>
        {/* Hero figure: the one number the card exists for. */}
        <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-1">
          <MoneyFigure value={s.perDay} size="xl" className="text-on-surface" />
          <span className="pb-1 text-[13px] font-medium text-on-surface-variant">
            {t(i.perDay, { amount: '' }).trim()}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
          <span className="inline-flex items-center gap-1 font-semibold">
            <AppIcon name="schedule" className="text-[14px]" />
            {t(i.daysLeft, { count: s.daysLeft })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t(i.burnRate, { amount: format(s.burnRate) })}</span>
        </p>

        {/* Breakdown: label + value on one line each, so nothing is ever cut. */}
        <dl className="mt-4 divide-y divide-outline-variant/70 rounded-[1.25rem] bg-surface-container-low">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs font-medium text-on-surface-variant">{i.remaining}</dt>
            <dd className="tabular text-sm font-semibold text-on-surface">{format(s.remainingBudget)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs font-medium text-on-surface-variant">{i.upcomingBills}</dt>
            <dd className="tabular text-sm font-semibold text-on-surface">{s.upcomingFixed > 0 ? '−' : ''}{format(s.upcomingFixed)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs font-semibold text-on-surface">{i.projectedEnd}</dt>
            <dd className={`tabular text-sm font-semibold ${s.projectedLeftover < 0 ? 'text-error' : 'text-forest dark:text-lime'}`}>
              {s.projectedLeftover < 0 ? '−' : ''}{format(Math.abs(s.projectedLeftover))}
            </dd>
          </div>
        </dl>
      </div>

      {!unlocked && (
        <div className="absolute inset-x-0 bottom-0 top-16 flex flex-col items-center justify-center gap-2.5 overflow-hidden px-5 py-4 text-center backdrop-blur-[2px] bg-surface-container-lowest/55">
          <span className="flex size-11 items-center justify-center rounded-full bg-forest text-lime shadow-forest">
            <AppIcon name="lock" className="text-[18px]" />
          </span>
          <p className="text-sm font-semibold text-on-surface">{i.lockedTitle}</p>
          <p className="max-w-sm text-xs text-on-surface-variant">{i.lockedBody}</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-1 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-on-primary shadow-[0_8px_20px_-8px_rgba(15,59,54,0.45)] transition-colors hover:bg-primary-hover"
          >
            {i.unlock}
          </button>
        </div>
      )}
    </section>
  );
}
