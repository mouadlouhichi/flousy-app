'use client';

import React, { useId } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from './app-icon';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
  sublabel?: string;
  /** Native tooltip — defaults to label · sublabel. */
  title?: string;
}

/** Money places offered across the app (bank / wallet / home cash). */
export const MONEY_PLACE_OPTIONS: SegmentedOption[] = [
  { value: 'bank', label: 'Bank', icon: 'account_balance' },
  { value: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  { value: 'home', label: 'Home Cash', icon: 'home' },
];

/** Display label per money place, kept in sync with MONEY_PLACE_OPTIONS. */
export const MONEY_PLACE_LABELS: Record<string, string> = Object.fromEntries(
  MONEY_PLACE_OPTIONS.map((o) => [o.value, o.label]),
);

interface SegmentedControlProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel?: string;
}

/**
 * Single-select segmented flex group whose active pill background slides
 * horizontally from the current segment to the tapped one (shared
 * `layoutId` spring, same motion language as the dashboard bottom nav).
 *
 * Each segment is `min-w-0 overflow-hidden` so long labels (e.g. "Home Cash")
 * and currency sublabels never spill out of their box. Three-or-more options,
 * or any option with a sublabel, stack icon / label / amount vertically so
 * the text can truncate inside the segment instead of overflowing it.
 */
export function SegmentedControl({
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedControlProps) {
  // Unique per instance so controls never steal each other's sliding pill.
  const layoutId = useId();
  const isStacked =
    options.length >= 3 || options.some((option) => Boolean(option.sublabel));

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
          {label}
        </label>
      )}
      <div
        role="radiogroup"
        aria-label={ariaLabel || label}
        className={`flex w-full min-w-0 items-stretch gap-1 border border-outline-variant/70 bg-surface-container-lowest p-1 ${
          isStacked ? 'rounded-[1.25rem]' : 'rounded-full'
        }`}
      >
        {options.map(({ value: optionValue, label: optionLabel, icon, sublabel, title }) => {
          const isActive = value === optionValue;
          const tooltip = title || (sublabel ? `${optionLabel} · ${sublabel}` : optionLabel);
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={tooltip}
              onClick={() => onChange(optionValue)}
              className={`relative min-w-0 flex-1 overflow-hidden px-1.5 py-2.5 transition-colors duration-200 ${
                isStacked ? 'rounded-2xl' : 'rounded-full'
              } ${isActive ? '' : 'hover:bg-surface-variant/40 active:scale-[0.97]'}`}
            >
              {/* Sliding active background — glides horizontally from the
                  current segment to the tapped one. */}
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className={`absolute inset-0 bg-primary shadow-sm ${
                    isStacked ? 'rounded-2xl' : 'rounded-full'
                  }`}
                  transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
                />
              )}
              <span
                className={`relative z-10 flex min-w-0 w-full items-center justify-center ${
                  isStacked ? 'flex-col gap-0.5' : 'flex-row gap-1.5'
                }`}
              >
                {icon && (
                  <AppIcon
                    name={icon}
                    className={`shrink-0 transition-colors duration-200 ${
                      isStacked ? 'text-[16px]' : 'text-[17px]'
                    } ${isActive ? 'text-on-primary' : 'text-outline'}`}
                  />
                )}
                <span className="flex min-w-0 max-w-full flex-col items-center leading-tight">
                  <span
                    className={`max-w-full truncate text-center font-semibold transition-colors duration-200 ${
                      isStacked ? 'text-[11px]' : 'text-[12px]'
                    } ${isActive ? 'text-on-primary' : 'text-on-surface-variant'}`}
                  >
                    {optionLabel}
                  </span>
                  {sublabel && (
                    <span
                      className={`max-w-full truncate text-center text-[10px] font-medium tabular-nums transition-colors duration-200 ${
                        isActive ? 'text-on-primary/80' : 'text-outline'
                      }`}
                    >
                      {sublabel}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
