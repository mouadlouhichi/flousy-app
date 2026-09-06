'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { getMoneyPlaceOptions, SegmentedControl } from '@/components/ui/segmented-control';
import { formatCurrency } from '@/lib/currency';
import { useLanguage } from '@/lib/i18n-context';
import { resolveCourseCategory } from '@/lib/course-session';
import { localizeCategoryName } from '@/lib/localized-labels';
import type { CourseSession, MoneyPlace } from '@/lib/store';

interface CoursesBudgetLoggerProps {
  /** The finished session whose total can be logged. */
  session: CourseSession;
  /** Active categories of the month being viewed. */
  categories: string[];
  /** Display label of the month the expense will land in. */
  monthLabel: string;
  /** Where the course was paid from (money place the expense debits). */
  place: MoneyPlace;
  /** Persists a new paid-from selection and refreshes the receipt. */
  onPlaceChange: (place: MoneyPlace) => void;
  /** Logs the session total as a variable expense under the category + place. */
  onLog: (category: string, place: MoneyPlace) => void | Promise<void>;
  posting?: boolean;
  error?: string | null;
  canPost?: boolean;
}

/**
 * Bill action: log the course total into the budget as one variable expense.
 * The "paid from" money place and the category are chosen here, next to the
 * "Add as expense" CTA. The category picker defaults to a grocery-like
 * category when one exists and falls back to the first active category (or
 * the built-in default). Once logged, the session carries `loggedExpenseId`
 * and this card turns into a confirmation — the total can never be logged
 * twice.
 */
export function CoursesBudgetLogger({
  session,
  categories,
  monthLabel,
  place,
  onPlaceChange,
  onLog,
  posting = false,
  error = null,
  canPost = true,
}: CoursesBudgetLoggerProps) {
  const { t, messages, intlLocale } = useLanguage();
  const c = messages.courses;
  const [category, setCategory] = useState(() => resolveCourseCategory(categories));

  const logged = Boolean(session.loggedExpenseId);
  const options = categories.length > 0 ? categories : [category];
  const categoryOptions = options.map((name) => ({
    value: name,
    label: localizeCategoryName(name, messages),
  }));

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
                  amount: formatCurrency(session.total, session.currency, intlLocale),
                  month: monthLabel,
                })}
          </p>
        </div>

        {logged && (
          <span className="ms-auto flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-2 font-label-md text-label-md text-primary tabular-nums">
            <AppIcon name="check_circle" className="size-4" />
            {formatCurrency(session.total, session.currency, intlLocale)}
          </span>
        )}
      </div>

      {!logged && (
        <div className="mt-4 flex flex-col gap-3">
          <SegmentedControl
            label={c.paidFrom}
            value={place}
            onChange={(value) => onPlaceChange(value as MoneyPlace)}
            options={getMoneyPlaceOptions(messages)}
          />
          {!canPost && (
            <p role="status" className="text-sm font-medium text-on-surface-variant">{c.logPermissionDenied}</p>
          )}
          {error && <p role="alert" className="text-sm font-bold text-error">{error}</p>}
          <div className="flex flex-wrap items-end gap-2.5">
            <CustomSelect
              value={category}
              onChange={setCategory}
              options={categoryOptions}
              label={c.logCategory}
              className="min-w-[9rem]"
              triggerClassName="!h-9 !rounded-md !px-3 !text-sm"
            />
            <button
              type="button"
              disabled={posting || !canPost}
              onClick={() => { void onLog(category, place); }}
              className="flex h-9 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <AppIcon name={posting ? 'sync' : 'add'} className="size-4" />
              {posting ? c.logPosting : c.logCta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
