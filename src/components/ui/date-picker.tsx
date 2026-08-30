'use client';

import { useId, useMemo, useState } from 'react';
import { AppIcon } from './app-icon';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  locale?: string;
  disabled?: boolean;
}

function dateFromInputValue(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);

  // Avoid JavaScript's silent rollover (for example, 2026-02-31).
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

function dateToInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(value: string, locale?: string): string {
  const date = dateFromInputValue(value);
  if (!date) return 'Choose a date';
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * A responsive calendar field built from the app's existing Radix Popover and
 * react-day-picker components. The popup takes the trigger's exact width, so
 * it can never force a narrow modal wider than its content area.
 */
export function DatePicker({
  label = 'Date',
  value,
  onChange,
  error,
  locale,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const errorId = useId();
  const selectedDate = useMemo(() => dateFromInputValue(value), [value]);
  const selectedLabel = useMemo(() => displayDate(value, locale), [value, locale]);

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-sm">
      {label && (
        <label className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined}
            className={`flex h-12 w-full min-w-0 max-w-full items-center gap-3 rounded-xl border bg-surface-container-lowest px-4 text-left font-body-md text-base text-on-surface transition-all duration-200 md:text-body-md ${
              error
                ? 'border-error focus:border-error focus:ring-error/20'
                : 'border-outline-variant hover:border-outline hover:bg-surface-container-low focus:border-primary focus:ring-primary/20'
            } focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <AppIcon name="calendar_clock" className="shrink-0 text-[20px] text-primary" />
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            <AppIcon
              name="expand_more"
              className={`shrink-0 text-[18px] text-on-surface-variant transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="!z-[70] !w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border-outline-variant p-0"
        >
          <Calendar
            key={value}
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (!date) return;
              onChange(dateToInputValue(date));
              setOpen(false);
            }}
            className="!w-full bg-surface !p-2 [--cell-size:--spacing(7)] sm:[--cell-size:--spacing(8)]"
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p id={errorId} role="alert" className="text-[12px] font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export { dateFromInputValue, dateToInputValue };
