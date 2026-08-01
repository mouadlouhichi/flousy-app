'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AppIcon } from './app-icon';
import { CustomInput } from './CustomInput';

const PRESET_DAYS = [1, 15, 30];

/** "1st", "15th", "30th" … matching the app's existing stored format. */
function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** Reads a leading day number (1–31) out of free-form values like "15th". */
function parseDay(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})\b/);
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
export function DueDayPicker({ label = 'Due Day of Month', value, onChange }: DueDayPickerProps) {
  const lastEmittedRef = useRef<string | null>(null);
  const parsedDay = parseDay(value);
  const isCustomValue = (v: string) => {
    const day = parseDay(v);
    return v.trim() !== '' && (day === null || !PRESET_DAYS.includes(day));
  };
  const [customMode, setCustomMode] = useState(() => isCustomValue(value));

  // Sync mode when the value changes from outside (e.g. opening the modal
  // for a different bill) — but not for values this picker emitted itself.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = null;
    setCustomMode(isCustomValue(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        {label}
      </label>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2 py-0.5">
        {PRESET_DAYS.map((day) => {
          const isActive = !customMode && parsedDay === day;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setCustomMode(false);
                if (customMode || parsedDay !== day) emit(ordinal(day));
              }}
              className={badgeClass(isActive)}
            >
              {ordinal(day)}
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
          <span>Custom</span>
        </button>
      </div>
      {customMode && (
        <CustomInput
          type="text"
          value={value}
          onChange={(e) => emit(e.target.value)}
          placeholder="e.g. 20th of month, last Friday"
          aria-label={`${label} (custom)`}
        />
      )}
    </div>
  );
}
