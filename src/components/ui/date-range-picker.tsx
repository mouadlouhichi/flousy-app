'use client';

import { useMemo, useState } from 'react';
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

function formatDay(value: string, locale: string, empty: string): string {
  const date = dateFromInputValue(value);
  if (!date) return empty;
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}

export function DateRangePicker({ from, to, onChange, ariaLabel }: DateRangePickerProps) {
  const { messages: m, language, intlLocale, isRTL } = useLanguage();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<'from' | 'to'>('from');
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const calendarLocale = language === 'ar' ? ar : language === 'fr' ? fr : enUS;
  const isActive = Boolean(from || to);
  const selected = useMemo(
    () => dateFromInputValue(picking === 'from' ? draftFrom : draftTo),
    [picking, draftFrom, draftTo],
  );

  const openPicker = (next: boolean) => {
    if (next) {
      setDraftFrom(from);
      setDraftTo(to);
      setPicking('from');
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
        className="w-[min(20.5rem,calc(100vw-2rem))] rounded-xl border-outline-variant p-3"
      >
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPicking('from')}
            className={`rounded-xl border px-3 py-2 text-start ${
              picking === 'from' ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface'
            }`}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">
              {m.tabs.variable.dateFrom}
            </span>
            <span className="block truncate text-sm font-bold text-on-surface">
              {formatDay(draftFrom, intlLocale, '—')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPicking('to')}
            className={`rounded-xl border px-3 py-2 text-start ${
              picking === 'to' ? 'border-primary bg-primary/10' : 'border-outline-variant bg-surface'
            }`}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">
              {m.tabs.variable.dateTo}
            </span>
            <span className="block truncate text-sm font-bold text-on-surface">
              {formatDay(draftTo, intlLocale, '—')}
            </span>
          </button>
        </div>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            if (!date) return;
            const value = dateToInputValue(date);
            if (picking === 'from') {
              commit(value, draftTo);
              setPicking('to');
            } else {
              commit(draftFrom, value);
            }
          }}
          locale={calendarLocale}
          dir={isRTL ? 'rtl' : 'ltr'}
          className="!w-full bg-surface !p-1 [--cell-size:--spacing(8)]"
        />
        {(draftFrom || draftTo) && (
          <button
            type="button"
            onClick={() => {
              commit('', '');
              setPicking('from');
            }}
            className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"
          >
            {m.tabs.variable.clearDates}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
