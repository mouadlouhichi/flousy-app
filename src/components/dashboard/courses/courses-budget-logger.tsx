'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { formatCurrency } from '@/lib/currency';
import { useLanguage } from '@/lib/i18n-context';
import { resolveCourseCategory } from '@/lib/course-session';
import type { CourseSession } from '@/lib/store';

interface CoursesBudgetLoggerProps {
  /** The finished session whose total can be logged. */
  session: CourseSession;
  /** Active categories of the month being viewed. */
  categories: string[];
  /** Display label of the month the expense will land in. */
  monthLabel: string;
  /** Logs the session total as a variable expense under the category. */
  onLog: (category: string) => void;
}

/**
 * Bill action: log the course total into the budget as one variable expense.
 * The category picker defaults to a grocery-like category when one exists and
 * falls back to the first active category (or the built-in default). Once
 * logged, the session carries `loggedExpenseId` and this card turns into a
 * confirmation — the total can never be logged twice.
 */
export function CoursesBudgetLogger({
  session,
  categories,
  monthLabel,
  onLog,
}: CoursesBudgetLoggerProps) {
  const { t, messages } = useLanguage();
  const c = messages.courses;
  const [category, setCategory] = useState(() => resolveCourseCategory(categories));

  const logged = Boolean(session.loggedExpenseId);
  const options = categories.length > 0 ? categories : [category];

  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-low p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <AppIcon name="payments" className="size-5 text-primary" />
        </span>
        <div className="min-w-0">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">{c.logTitle}</h3>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
            {logged
              ? c.logDone
              : t(c.logHint, {
                  amount: formatCurrency(session.total, session.currency),
                  month: monthLabel,
                })}
          </p>
        </div>

        {logged ? (
          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-2 font-label-md text-label-md text-primary tabular-nums">
            <AppIcon name="check_circle" className="size-4" />
            {formatCurrency(session.total, session.currency)}
          </span>
        ) : (
          <div className="ms-auto flex flex-wrap items-end gap-2.5">
            <label className="block">
              <span className="mb-1 block font-label-sm text-label-sm text-on-surface-variant">
                {c.logCategory}
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label={c.logCategory}
                className="h-9 w-full min-w-[9rem] cursor-pointer rounded-md border border-input bg-surface px-3 text-sm font-medium text-on-surface shadow-xs outline-none transition-[box-shadow,border-color] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {options.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onLog(category)}
              className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90"
            >
              <AppIcon name="add" className="size-4" />
              {c.logCta}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
