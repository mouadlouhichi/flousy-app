'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AppIcon } from './app-icon';
import type { Messages } from '@/lib/i18n-core';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
  sublabel?: string;
  /** Native tooltip — defaults to label · sublabel. */
  title?: string;
}

/** Money-place labels supplied by the active locale; values remain persistent IDs. */
export function getMoneyPlaceOptions(messages: Messages): SegmentedOption[] {
  return [
    { value: 'bank', label: messages.places.bank, icon: 'account_balance' },
    { value: 'wallet', label: messages.places.wallet, icon: 'account_balance_wallet' },
    { value: 'home', label: messages.places.home, icon: 'home' },
  ];
}

interface SegmentedControlProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SegmentedOption[];
  ariaLabel?: string;
}

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Single-select segmented flex group whose active pill glides in layout
 * space (offsetLeft/Top), the same motion language as the dashboard
 * bottom nav — a straight slide instead of a layoutId remount hop.
 */
export function SegmentedControl({
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedControlProps) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const [pillRect, setPillRect] = useState<PillRect | null>(null);
  const isStacked =
    options.length >= 3 || options.some((option) => Boolean(option.sublabel));

  useEffect(() => {
    const measure = () => {
      const activeBtn = groupRef.current?.querySelector<HTMLElement>(
        `[data-segment="${value}"]`,
      );
      if (activeBtn) {
        setPillRect({
          x: activeBtn.offsetLeft,
          y: activeBtn.offsetTop,
          width: activeBtn.offsetWidth,
          height: activeBtn.offsetHeight,
        });
      } else {
        setPillRect(null);
      }
    };

    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    const observer = typeof ResizeObserver !== 'undefined' && groupRef.current
      ? new ResizeObserver(measure)
      : null;
    if (groupRef.current && observer) observer.observe(groupRef.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [value, options.length, isStacked]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
          {label}
        </label>
      )}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel || label}
        className={`relative flex w-full min-w-0 items-stretch gap-1 border border-outline-variant/70 bg-surface-container-lowest p-1 ${
          isStacked ? 'rounded-[1.25rem]' : 'rounded-full'
        }`}
      >
        {pillRect && (
          <motion.span
            aria-hidden
            initial={false}
            animate={{
              x: pillRect.x,
              y: pillRect.y,
              width: pillRect.width,
              height: pillRect.height,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
            className={`pointer-events-none absolute left-0 top-0 bg-primary shadow-sm ${
              isStacked ? 'rounded-2xl' : 'rounded-full'
            }`}
          />
        )}
        {options.map(({ value: optionValue, label: optionLabel, icon, sublabel, title }) => {
          const isActive = value === optionValue;
          const tooltip = title || (sublabel ? `${optionLabel} · ${sublabel}` : optionLabel);
          return (
            <button
              key={optionValue}
              type="button"
              role="radio"
              aria-checked={isActive}
              data-segment={optionValue}
              title={tooltip}
              onClick={() => onChange(optionValue)}
              className={`relative z-10 min-w-0 flex-1 overflow-hidden px-1.5 py-2.5 transition-colors duration-200 ${
                isStacked ? 'rounded-2xl' : 'rounded-full'
              } ${isActive ? '' : 'hover:bg-surface-variant/40 active:scale-[0.97]'}`}
            >
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
