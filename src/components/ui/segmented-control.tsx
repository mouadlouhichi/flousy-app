'use client';

import React, { useId } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from './app-icon';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
  sublabel?: string;
}

/** Money places offered across the app (bank / wallet / home cash). */
export const MONEY_PLACE_OPTIONS: SegmentedOption[] = [
  { value: 'bank', label: 'Bank', icon: 'account_balance' },
  { value: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  { value: 'home', label: 'Home Cash', icon: 'home' },
];

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
        className="flex w-full items-stretch gap-1 rounded-full border border-outline-variant/70 bg-surface-container-lowest p-1"
      >
        {options.map(({ value: optionValue, label: optionLabel, icon, sublabel }) => {
          const isActive = value === optionValue;
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(optionValue)}
              className={`relative flex-1 rounded-full px-2 py-2.5 transition-colors duration-200 ${
                isActive ? '' : 'hover:bg-surface-variant/40 active:scale-[0.97]'
              }`}
            >
              {/* Sliding active background — glides horizontally from the
                  current segment to the tapped one. */}
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                {icon && (
                  <AppIcon
                    name={icon}
                    className={`shrink-0 text-[17px] transition-colors duration-200 ${
                      isActive ? 'text-on-primary' : 'text-outline'
                    }`}
                  />
                )}
                <span className="flex min-w-0 flex-col items-center leading-tight">
                  <span
                    className={`text-[12px] font-semibold transition-colors duration-200 ${
                      isActive ? 'text-on-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {optionLabel}
                  </span>
                  {sublabel && (
                    <span
                      className={`max-w-full truncate text-[10px] font-medium transition-colors duration-200 ${
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
