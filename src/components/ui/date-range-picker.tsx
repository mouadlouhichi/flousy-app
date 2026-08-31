'use client';

import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { ar, enUS, fr } from 'date-fns/locale';
import { AppIcon } from './app-icon';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { dateFromInputValue, dateToInputValue } from './date-picker';
import { useLanguage } from '@/lib/i18n-context';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  ariaLabel?: string;
}

function formatRangeLabel(from: string, to: string, locale: string, empty: string): string {
  const start = dateFromInputValue(from);
  const end = dateFromInputValue(to);
  if (!start && !end) return empty;
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  if (start && end) return `${fmt.format(start)} – ${fmt.format(end)}`;
  if (start) return fmt.format(start);
  return end ? fmt.format(end) : empty;
}

export function DateRangePicker({ from, to, onChange, ariaLabel }: DateRangePickerProps) {
  const { messages: m, language, intlLocale, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const calendarLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const selected = useMemo<DateRange | undefined>(() => {
    const start = dateFromInputValue(from);
    const end = dateFromInputValue(to);
    if (!start && !end) return undefined;
    return { from: start, to: end };
  }, [from, to]);
  const isActive = Boolean(from || to);
  const label = formatRangeLabel(from, to, intlLocale, m.tabs.variable.dateFrom);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel || label}
          title={label}
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            isActive
              ? 'border-primary bg-primary text-on-primary'
              : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
          }`}
        >
          <AppIcon name="calendar_month" className="text-[22px]" />
          {isActive && (
            <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-on-primary" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        className="w-[min(20.5rem,calc(100vw-2rem))] overflow-hidden rounded-xl border-outline-variant p-0"
      >
        <Calendar
          mode="range"
          required
          selected={selected}
          defaultMonth={selected?.from || selected?.to}
          onSelect={(range) => {
            if (!range?.from) {
              onChange('', '');
              return;
            }
            const start = dateToInputValue(range.from);
            const end = range.to ? dateToInputValue(range.to) : '';
            onChange(start, end);
            if (range.to) setOpen(false);
          }}
          locale={calendarLocale}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="!w-full bg-surface !p-2 [--cell-size:--spacing(8)]"
        />
        {isActive && (
          <div className="border-t border-outline-variant p-2">
            <button
              type="button"
              onClick={() => {
                onChange('', '');
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"
            >
              {m.tabs.variable.clearDates}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
