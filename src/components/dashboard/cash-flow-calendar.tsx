'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { FormattedAmount } from '@/components/ui/formatted-amount';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName } from '@/lib/localized-labels';
import { buildCashFlowForecast, type CashFlowDay } from '@/lib/insights';
import { fixedCategoryVisual, type MonthBudget } from '@/lib/store';

interface CashFlowCalendarProps {
  month: MonthBudget;
  /** Pro gate for the projected-balance layer; the calendar itself is free. */
  forecastUnlocked: boolean;
  onUpgrade: () => void;
  /** Hide income markers for members without the income area grant. */
  showIncome?: boolean;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/**
 * Month-grid calendar of every planned movement in the period (bills on their
 * due day, salaries on their pay day) with the projected cash balance per day.
 * Answers "what is due this week?" and "how much will I have left on the 25th?".
 */
export function CashFlowCalendar({ month, forecastUnlocked, onUpgrade, showIncome = true }: CashFlowCalendarProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale, language } = useLanguage();
  const c = m.cashFlow;

  const forecast = useMemo(() => buildCashFlowForecast(month), [month]);
  const days = useMemo(
    () => (showIncome ? forecast.days : forecast.days.map((d) => ({ ...d, events: d.events.filter((e) => e.kind === 'bill') }))),
    [forecast, showIncome],
  );

  const todayIso = days.find((d) => d.isToday)?.date ?? days[0]?.date ?? '';
  const [selected, setSelected] = useState<string>(todayIso);
  const selectedDay = days.find((d) => d.date === selected) ?? days.find((d) => d.isToday) ?? days[0];

  // Week starts Monday for FR/AR locales, Sunday for EN (matches Intl defaults in MA/FR).
  const weekStartsOnMonday = language !== 'en';
  const weekdayLabels = useMemo(() => {
    const base = new Date(Date.UTC(2024, 0, weekStartsOnMonday ? 1 : 7)); // Mon 1 Jan 2024 / Sun 7 Jan 2024
    return Array.from({ length: 7 }, (_, i) =>
      new Date(base.getTime() + i * 86_400_000).toLocaleDateString(intlLocale, { weekday: 'narrow', timeZone: 'UTC' }),
    );
  }, [intlLocale, weekStartsOnMonday]);

  const leadingBlanks = useMemo(() => {
    if (days.length === 0) return 0;
    const first = parseIso(days[0]!.date).getDay(); // 0 = Sunday
    return weekStartsOnMonday ? (first + 6) % 7 : first;
  }, [days, weekStartsOnMonday]);

  const longDate = (iso: string) =>
    parseIso(iso).toLocaleDateString(intlLocale, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = (iso: string) => parseIso(iso).toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' });

  const monthOfDay = (iso: string) => parseIso(iso).toLocaleDateString(intlLocale, { month: 'short' });
  const showsTwoMonths = days.length > 0 && days[0]!.date.slice(0, 7) !== days[days.length - 1]!.date.slice(0, 7);

  const balanceTone = (balance: number) =>
    balance < 0 ? 'text-error' : balance < forecast.startingCash * 0.15 ? 'text-amber-600 dark:text-amber-400' : 'text-primary';

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-bold text-on-surface">
          <AppIcon name="calendar_month" className="text-[20px] text-primary" />
          {c.title}
        </h3>
        <span className="text-xs text-on-surface-variant">
          {days.length > 0 && `${shortDate(days[0]!.date)} – ${shortDate(days[days.length - 1]!.date)}`}
        </span>
      </div>

      {/* Forecast strip */}
      {forecastUnlocked ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={c.cashToday} value={<FormattedAmount value={forecast.startingCash} />} />
          <Stat label={c.endOfPeriod} value={<FormattedAmount value={forecast.endBalance} />} tone={balanceTone(forecast.endBalance)} />
          <Stat
            label={t(c.lowestOn, { date: shortDate(forecast.lowest.date) })}
            value={<FormattedAmount value={forecast.lowest.balance} />}
            tone={balanceTone(forecast.lowest.balance)}
          />
          <Stat
            label={forecast.nextBill ? t(c.nextBillIn, { count: forecast.nextBill.daysUntil }) : c.noMoreBills}
            value={
              forecast.nextBill ? (
                <>
                  {forecast.nextBill.name} · <FormattedAmount value={forecast.nextBill.pending} />
                </>
              ) : (
                <FormattedAmount value={0} />
              )
            }
            small
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-3 text-start transition-colors hover:border-primary"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="lock" className="text-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-on-surface">{c.lockedTitle}</span>
            <span className="block text-xs text-on-surface-variant">{c.lockedBody}</span>
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Pro</span>
        </button>
      )}

      {/* Grid */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center" role="grid" aria-label={c.title}>
        {weekdayLabels.map((label, i) => (
          <div key={i} className="py-1 text-[11px] font-bold uppercase text-on-surface-variant" role="columnheader">
            {label}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            selected={day.date === selectedDay?.date}
            onSelect={() => setSelected(day.date)}
            showBalance={forecastUnlocked}
            monthTag={showsTwoMonths && day.date.endsWith('-01') ? monthOfDay(day.date) : null}
            balanceTone={balanceTone}
            ariaLabel={`${longDate(day.date)}${forecastUnlocked ? `, ${format(day.balance)}` : ''}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-on-surface-variant">
        <Legend dot="bg-error" label={c.legendBill} />
        {showIncome && <Legend dot="bg-primary" label={c.legendIncome} />}
        <Legend dot="bg-outline" label={c.legendSettled} />
      </div>

      {/* Selected day */}
      {selectedDay && (
        <div className="mt-4 rounded-2xl border border-outline-variant bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-on-surface">{longDate(selectedDay.date)}</p>
            {forecastUnlocked && !selectedDay.isPast && (
              <p className="text-end">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{c.projectedBalance}</span>
                <FormattedAmount
                  value={selectedDay.balance}
                  className={`font-mono text-sm font-bold ${balanceTone(selectedDay.balance)}`}
                />
              </p>
            )}
          </div>
          {selectedDay.events.length === 0 ? (
            <p className="mt-2 text-sm text-on-surface-variant">{c.nothingPlanned}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {selectedDay.events.map((event) => {
                const visual = event.kind === 'bill' ? fixedCategoryVisual(event.category || '') : { icon: 'payments' };
                return (
                  <li key={`${event.kind}-${event.id}`} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                          event.settled ? 'bg-surface-variant text-on-surface-variant' : event.kind === 'bill' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        <AppIcon name={visual.icon} className="text-[16px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-on-surface">{event.name}</span>
                        <span className="block text-xs text-on-surface-variant">
                          {event.kind === 'bill' ? localizeCategoryName(event.category || '', m) : c.income}
                          {' · '}
                          {event.settled ? (event.kind === 'bill' ? c.paid : c.received) : event.kind === 'bill' ? c.due : c.expected}
                        </span>
                      </span>
                    </span>
                    <FormattedAmount
                      value={event.settled ? event.amount : event.pending}
                      prefix={event.kind === 'bill' ? '−' : '+'}
                      className={`shrink-0 font-mono text-sm font-bold ${
                        event.settled ? 'text-on-surface-variant line-through' : event.kind === 'bill' ? 'text-error' : 'text-primary'
                      }`}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone = 'text-on-surface', small = false }: { label: string; value: ReactNode; tone?: string; small?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className={`mt-0.5 truncate font-mono font-bold ${small ? 'text-xs' : 'text-sm'} ${tone}`}>{value}</p>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function DayCell({
  day,
  selected,
  onSelect,
  showBalance,
  monthTag,
  balanceTone,
  ariaLabel,
}: {
  day: CashFlowDay;
  selected: boolean;
  onSelect: () => void;
  showBalance: boolean;
  monthTag: string | null;
  balanceTone: (balance: number) => string;
  ariaLabel: string;
}) {
  const dayNumber = Number(day.date.slice(8, 10));
  const hasPendingBill = day.events.some((e) => e.kind === 'bill' && !e.settled);
  const hasPendingIncome = day.events.some((e) => e.kind === 'income' && !e.settled);
  const hasSettled = day.events.some((e) => e.settled);
  return (
    <button
      type="button"
      role="gridcell"
      aria-selected={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={`relative flex min-h-[52px] flex-col items-center justify-start rounded-xl border px-0.5 py-1 transition-colors ${
        selected
          ? 'border-primary bg-primary/10'
          : day.isToday
            ? 'border-primary/40 bg-surface'
            : 'border-transparent bg-surface hover:border-outline-variant'
      } ${day.isPast ? 'opacity-60' : ''}`}
    >
      {monthTag && <span className="absolute -top-1 start-1 text-[8px] font-bold uppercase text-on-surface-variant">{monthTag}</span>}
      <span className={`text-xs font-bold ${day.isToday ? 'text-primary' : 'text-on-surface'}`}>{dayNumber}</span>
      <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
        {hasPendingBill && <span className="size-1.5 rounded-full bg-error" />}
        {hasPendingIncome && <span className="size-1.5 rounded-full bg-primary" />}
        {hasSettled && <span className="size-1.5 rounded-full bg-outline" />}
      </span>
      {showBalance && !day.isPast && (
        <span className={`mt-auto w-full truncate font-mono text-[9px] leading-tight ${balanceTone(day.balance)}`}>
          {compactMoney(day.balance)}
        </span>
      )}
    </button>
  );
}

function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)}k`;
  if (abs >= 1_000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${Math.round(abs)}`;
}
