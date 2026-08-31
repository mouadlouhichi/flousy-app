'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { MonthDayPicker } from '@/components/ui/month-day-picker';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';

interface MonthlyStartDateControlProps {
  value: number | undefined;
  onChange: (day: number | undefined) => void;
  /** Compact variant for modals (no outer heading). */
  compact?: boolean;
}

/**
 * Config control for the default "monthly start date" (the day of the month a
 * salary/budget month begins). Used in the profile screen and the settings
 * modal. Calendar-based picker; mirrors the per-source start date set on
 * income sources.
 */
export function MonthlyStartDateControl({
  value,
  onChange,
  compact = false,
}: MonthlyStartDateControlProps) {
  const { messages: m, t, language, intlLocale } = useLanguage();
  const localizedDay = (day: number) => formatLocalizedDayOfMonth(day, language, intlLocale);
  const inner = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-variant">
          <AppIcon name="calendar_clock" className="text-[20px] text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-medium text-on-surface">{m.onboarding.monthlyStartDate}</p>
          <MonthDayPicker
            value={value}
            onChange={onChange}
            label={null}
            hint={
              value
                ? t(m.onboarding.monthlyStartHint, { day: localizedDay(value) })
                : m.onboarding.monthlyStartDescription
            }
          />
        </div>
      </div>

    </div>
  );

  if (compact) return inner;

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container p-4">
      {inner}
    </div>
  );
}
