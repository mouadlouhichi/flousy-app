'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './app-icon';
import { CustomInput } from './CustomInput';
import { formatDayOfMonth } from '@/lib/utils';
import { formatLocalizedDayOfMonth } from '@/lib/localized-labels';
import { useLanguage } from '@/lib/i18n-context';

const PRESET_DAYS = [1, 15, 30];

/**
 * Reads a leading day number (1–31) from values such as "15th" or
 * "20th of month". A word-boundary immediately after a digit does not match
 * ordinal suffixes (both `1` and `s` are word characters), so the explicit
 * optional suffix here is what keeps selected preset badges in sync.
 */
export function parseDueDay(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  return day >= 1 && day <= 31 ? day : null;
}

interface DueDayPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Due-day-of-month selector rendered as option badges (1st / 15th / 30th)
 * plus a Custom badge revealing the free-form input, so previously saved
 * strings keep editing normally. Emits ordinal strings ("1st", "15th",
 * "30th") — the format already used in data.
 */
export function DueDayPicker({ label, value, onChange }: DueDayPickerProps) {
  const { messages: m, t, language, intlLocale } = useLanguage();
  const visibleLabel = label || m.dueDayPicker.dueDayOfMonth;
  const localizedDay = (day: number) => formatLocalizedDayOfMonth(day, language, intlLocale);
  const lastEmittedRef = useRef<string | null>(null);
  const parsedDay = parseDueDay(value);
  const isCustomValue = (v: string) => {
    const day = parseDueDay(v);
    return v.trim() !== '' && (day === null || !PRESET_DAYS.includes(day));
  };
  const [customMode, setCustomMode] = useState(() => isCustomValue(value));

  // Sync mode when the value changes from outside (e.g. opening the modal
  // for a different bill) — but not for values this picker emitted itself.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = null;
    setCustomMode(isCustomValue(value));
  }, [value]);

  const emit = (next: string) => {
    lastEmittedRef.current = next;
    onChange(next);
  };

  const badgeClass = (isActive: boolean) =>
    `flex items-center gap-1.5 rounded-full border px-4 py-2 text-[12px] font-semibold transition-all duration-200 active:scale-[0.96] ${
      isActive
        ? 'border-transparent bg-primary text-on-primary shadow-sm'
        : 'border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
    }`;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
        {visibleLabel}
      </label>
      <div role="group" aria-label={visibleLabel} className="flex flex-wrap gap-2 py-0.5">
        {PRESET_DAYS.map((day) => {
          const isActive = !customMode && parsedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isActive}
              aria-label={localizedDay(day)}
              onClick={() => {
                setCustomMode(false);
                if (customMode || parsedDay !== day) emit(formatDayOfMonth(day));
              }}
              className={badgeClass(isActive)}
            >
              {localizedDay(day)}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={customMode}
          onClick={() => setCustomMode(true)}
          className={badgeClass(customMode)}
        >
          <AppIcon name="edit" className="text-[14px]" />
          <span>{m.dueDayPicker.custom}</span>
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-1.5 self-start rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
      >
        <AppIcon name={customMode ? 'edit' : 'check_circle'} className="text-[13px]" />
        {customMode
          ? isCustomValue(value)
            ? t(m.dueDayPicker.customSchedule, { value: value.trim() })
            : m.dueDayPicker.enterCustom
          : parsedDay
            ? t(m.dueDayPicker.selectedRepeats, { day: localizedDay(parsedDay) })
            : m.dueDayPicker.selectDueDay}
      </p>
      {customMode && (
        <CustomInput
          type="text"
          value={value}
          onChange={(e) => emit(e.target.value)}
          placeholder={m.dueDayPicker.customPlaceholder}
          aria-label={t(m.dueDayPicker.customField, { label: visibleLabel })}
        />
      )}
    </div>
  );
}
