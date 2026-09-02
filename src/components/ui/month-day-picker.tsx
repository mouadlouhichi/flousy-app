'use client';

import { AppIcon } from './app-icon';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';
import { useLanguage } from '@/lib/i18n-context';

function getWeekdayLabels(intlLocale: string): string[] {
  // Monday-first grid to match the picker layout. `narrow` keeps every label
  // compact while using the active locale's script (including Arabic).
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: 'narrow' }).format(
      new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
    ),
  );
}

interface MonthDayPickerProps {
  value: number | undefined;
  onChange: (day: number | undefined) => void;
  /** Shown in the picker header; pass null to hide the header row entirely. */
  label?: string | null;
  hint?: string;
  /** Show the selected-day chip with a clear button (default true). */
  allowClear?: boolean;
  disabled?: boolean;
}

/**
 * Calendar-style picker for a recurring day of the month (1–31) — e.g. the day
 * a salary arrives each month. Renders a real calendar grid (Monday-first)
 * with every day 1–31 visible, so days like the 31st are always reachable
 * regardless of the current month. Selecting a day emits that day-of-month.
 */
export function MonthDayPicker({
  value,
  onChange,
  label,
  hint,
  allowClear = true,
  disabled = false,
}: MonthDayPickerProps) {
  const { messages: m, language, intlLocale } = useLanguage();
  const visibleLabel = label || m.monthDayPicker.monthlyStartDate;
  const weekdayLabels = getWeekdayLabels(intlLocale);
  const localizedDay = (day: number) => formatLocalizedDayOfMonth(day, language, intlLocale);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-2.5">
      {label !== null && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            <AppIcon name="calendar_clock" className="text-[13px] text-primary" />
            {visibleLabel}
          </span>
          {value !== undefined && allowClear && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {localizedDay(value)}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(undefined)}
                aria-label={m.monthDayPicker.clearMonthlyStartDate}
                className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
              >
                <AppIcon name="close" className="text-[10px]" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* The grid is capped on purpose: the cells are `aspect-square`, so an
          unconstrained grid grew with its container and turned into a
          ~500px-tall calendar on desktop. 320px keeps every day cell at a
          comfortable tap/click size (~38px) at any viewport width. */}
      <div className="w-full max-w-[320px] rounded-xl border border-outline-variant bg-surface-container p-2.5">
        <div className="grid grid-cols-7 gap-1">
          {weekdayLabels.map((w, i) => (
            <span
              key={`${w}-${i}`}
              className="py-1 text-center text-[10px] font-extrabold uppercase tracking-wide text-on-surface-variant"
            >
              {w}
            </span>
          ))}
          {days.map((d) => {
            const selected = value === d;
            return (
              <button
                key={d}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                aria-label={localizedDay(d)}
                onClick={() => onChange(d)}
                className={`flex aspect-square items-center justify-center rounded-lg text-[13px] font-bold transition-all active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface hover:bg-primary/10 hover:text-primary'
                }`}
              >
                {new Intl.NumberFormat(intlLocale).format(d)}
              </button>
            );
          })}
        </div>
      </div>

      {hint && <p className="text-[11px] font-medium text-on-surface-variant">{hint}</p>}
    </div>
  );
}
