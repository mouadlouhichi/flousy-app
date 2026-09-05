'use client';

import { AppIcon } from '@/components/ui/app-icon';
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
  const { format, formatParts } = useCurrency();
  const { messages: m, t } = useLanguage();
  const i = m.insights;
  const s = calculateSafeToSpend(month);
  const perDay = formatParts(s.perDay);

  const tone = s.status === 'over'
    ? { ring: 'border-error/40', chip: 'bg-error/10 text-error', icon: 'trending_down', label: i.statusOver }
    : s.status === 'tight'
      ? { ring: 'border-amber-500/40', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icon: 'warning', label: i.statusTight }
      : { ring: 'border-primary/30', chip: 'bg-primary/10 text-primary', icon: 'check_circle', label: i.statusOk };

  return (
    <section className={`relative overflow-hidden rounded-3xl border ${unlocked ? tone.ring : 'border-outline-variant'} bg-surface-container p-5 shadow-2xs`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-base text-on-surface">
          <AppIcon name="speed" className="text-[20px] text-primary" />
          {i.safeToSpendTitle}
        </h3>
        {unlocked ? (
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>
            <AppIcon name={tone.icon} className="text-[14px]" />
            {tone.label}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <AppIcon name="workspace_premium" className="text-[14px]" />
            Pro
          </span>
        )}
      </div>

      <div className={unlocked ? '' : 'min-h-[188px] select-none blur-[6px] pointer-events-none'} aria-hidden={!unlocked}>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-mono text-3xl font-extrabold text-on-surface">{perDay.amount}</span>
          <span className="text-sm font-semibold text-on-surface-variant">{perDay.currency}</span>
          <span className="ms-1 text-sm text-on-surface-variant">{t(i.perDay, { amount: '' }).trim()}</span>
        </div>
        <p className="mt-0.5 text-xs font-semibold text-on-surface-variant">
          {t(i.daysLeft, { count: s.daysLeft })} · {t(i.burnRate, { amount: format(s.burnRate) })}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-container-high p-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{i.remaining}</dt>
            <dd className="mt-0.5 font-mono text-sm font-bold text-on-surface">{format(s.remainingBudget)}</dd>
          </div>
          <div className="rounded-2xl bg-surface-container-high p-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{i.upcomingBills}</dt>
            <dd className="mt-0.5 font-mono text-sm font-bold text-on-surface">{format(s.upcomingFixed)}</dd>
          </div>
          <div className="rounded-2xl bg-surface-container-high p-2.5">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{i.projectedEnd}</dt>
            <dd className={`mt-0.5 font-mono text-sm font-bold ${s.projectedLeftover < 0 ? 'text-error' : 'text-on-surface'}`}>
              {s.projectedLeftover < 0 ? '−' : ''}{format(Math.abs(s.projectedLeftover))}
            </dd>
          </div>
        </dl>
      </div>

      {!unlocked && (
        <div className="absolute inset-x-0 bottom-0 top-14 flex flex-col items-center justify-center gap-2.5 bg-surface/60 px-5 py-4 text-center backdrop-blur-[2px]">
          <span className="flex size-10 items-center justify-center rounded-full border border-outline-variant bg-surface shadow-sm">
            <AppIcon name="lock" className="text-[18px] text-primary" />
          </span>
          <p className="text-sm font-bold text-on-surface">{i.lockedTitle}</p>
          <p className="max-w-sm text-xs text-on-surface-variant">{i.lockedBody}</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-1 rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary transition-opacity hover:opacity-90"
          >
            {i.unlock}
          </button>
        </div>
      )}
    </section>
  );
}
