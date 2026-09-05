'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName } from '@/lib/localized-labels';
import { fixedCategoryVisual, getBillSchedule, type MonthBudget } from '@/lib/store';

/** Period timeline of every fixed charge: paid, due, overdue. Free for all. */
export function UpcomingPaymentsCalendar({ month }: { month: MonthBudget }) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const r = m.reminders;
  const schedule = getBillSchedule(month);

  const dateLabel = (iso: string) => {
    const [y, mo, d] = iso.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString(intlLocale, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-on-surface">
          <AppIcon name="calendar_month" className="text-[20px] text-primary" />
          {r.calendarTitle}
        </h3>
        <Link href="/dashboard/fixed" className="text-xs font-bold text-primary hover:underline">
          {m.common.viewAll}
        </Link>
      </div>
      {schedule.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">{r.calendarEmpty}</p>
      ) : (
        <ol className="relative mt-4 ms-3 border-s border-outline-variant">
          {schedule.map((bill) => {
            const paid = bill.status === 'paid' || bill.status === 'skipped' || bill.remaining <= 0;
            const overdue = !paid && bill.daysUntil < 0;
            const visual = fixedCategoryVisual(bill.type);
            const dot = paid ? 'bg-primary' : overdue ? 'bg-error' : bill.daysUntil <= 3 ? 'bg-amber-500' : 'bg-outline';
            return (
              <li key={bill.id} className="mb-4 ms-5 last:mb-0">
                <span className={`absolute -start-[5px] mt-1.5 size-2.5 rounded-full ring-4 ring-surface-container ${dot}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                      <AppIcon name={visual.icon} className="text-[16px] text-on-surface-variant" />
                      <span className="truncate">{bill.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {localizeCategoryName(bill.type, m)} · {paid ? r.calendarPaid : overdue ? r.calendarOverdue : t(r.calendarDue, { date: dateLabel(bill.date) })}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono text-sm font-bold ${paid ? 'text-on-surface-variant line-through' : overdue ? 'text-error' : 'text-on-surface'}`}>
                    {format(paid ? bill.amount : bill.remaining)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
