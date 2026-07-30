'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CustomInput } from './CustomInput';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** "1st", "2nd", "3rd", "4th" … matching the app's existing stored format. */
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
 * Day-of-month selector rendered as a solid white card holding a compact
 * 1–31 day grid (calendar-style). A "Custom text" toggle falls back to the
 * legacy free-form input so previously saved strings keep editing normally.
 * Emits ordinal strings ("1st" … "31st") — the format already used in data.
 */
export function DueDayPicker({ label = 'Due Day of Month', value, onChange }: DueDayPickerProps) {
  const lastEmittedRef = useRef<string | null>(null);
  const [customMode, setCustomMode] = useState(
    () => value.trim() !== '' && parseDay(value) === null
  );

  // Sync mode when the value changes from outside (e.g. opening the modal
  // for a different bill) — but not for values this picker emitted itself.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = null;
    setCustomMode(value.trim() !== '' && parseDay(value) === null);
  }, [value]);

  const parsedDay = parseDay(value);
  const activeDay = customMode ? null : parsedDay;

  const emit = (next: string) => {
    lastEmittedRef.current = next;
    onChange(next);
  };

  const selectDay = (day: number) => {
    const wasCustom = customMode;
    setCustomMode(false);
    if (wasCustom || day !== parsedDay) emit(ordinal(day));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setCustomMode((prev) => !prev)}
          className="text-[11px] font-bold text-primary hover:underline transition-colors"
        >
          {customMode ? 'Pick a day' : 'Custom text'}
        </button>
      </div>

      {/* Solid card — no transparency, matches the white form inputs. */}
      <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5">
        {customMode ? (
          <CustomInput
            type="text"
            value={value}
            onChange={(e) => emit(e.target.value)}
            placeholder="e.g. 1st of month, 15th"
            aria-label={`${label} (custom)`}
            className="bg-surface-container-high"
          />
        ) : (
          <div role="group" aria-label={label} className="grid grid-cols-7 gap-1">
            {DAYS.map((day) => {
              const isActive = activeDay === day;
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => selectDay(day)}
                  className={`flex h-8 items-center justify-center rounded-lg text-[12px] font-semibold transition-all duration-150 active:scale-[0.92] ${
                    isActive
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-variant/50 hover:text-on-surface'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
