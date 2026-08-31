'use client';

import { useMemo, useState } from 'react';
import { ar, enUS, fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
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

export function DateRangePicker({ from, to, onChange, ariaLabel }: DateRangePickerProps) {
  const { messages: m, language, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const calendarLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const isActive = Boolean(from || to);

  const selected = useMemo<DateRange | undefined>(() => {
    const start = dateFromInputValue(draftFrom);
    const end = dateFromInputValue(draftTo);
    if (!start && !end) return undefined;
    return { from: start ?? end, to: end && start ? end : undefined };
  }, [draftFrom, draftTo]);

  const openPicker = (next: boolean) => {
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
    }
    setOpen(next);
  };

  const commit = (nextFrom: string, nextTo: string) => {
    let start = nextFrom;
    let end = nextTo;
    if (start && end && start > end) {
      [start, end] = [end, start];
    }
    setDraftFrom(start);
    setDraftTo(end);
    onChange(start, end);
  };

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel || m.tabs.variable.dateFrom}
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
        className="w-[min(22rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border-outline-variant p-3"
      >
        {(draftFrom || draftTo) && (
          <button
            type="button"
            onClick={() => commit('', '')}
            className="mb-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"
          >
            {m.tabs.variable.clearDates}
          </button>
        )}
        <Calendar
          mode="range"
          selected={selected}
          defaultMonth={selected?.from}
          numberOfMonths={1}
          onSelect={(range) => {
            const nextFrom = range?.from ? dateToInputValue(range.from) : '';
            const nextTo = range?.to ? dateToInputValue(range.to) : '';
            commit(nextFrom, nextTo);
          }}
          locale={calendarLocale}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="!w-full max-w-full overflow-hidden bg-surface !p-1 [--cell-size:1.85rem]"
        />
      </PopoverContent>
    </Popover>
  );
}
