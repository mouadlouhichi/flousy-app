'use client';

import React, { useEffect, useRef } from 'react';
import { AppIcon } from './app-icon';

export interface ChoiceChipOption {
  value: string;
  label: string;
  icon?: string;
  color?: string;
}

interface ChoiceChipsProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceChipOption[];
  ariaLabel?: string;
  /** Wrap chips onto multiple lines instead of a single horizontally scrollable row. */
  wrap?: boolean;
}

/**
 * Single-select pill chips, styled after the design system's Category Chips:
 * color-coded icon, 12% tint background + 35% tint border when active,
 * ghost outline when inactive. Horizontally scrollable by default so long
 * option lists stay compact on mobile.
 */
export function ChoiceChips({
  label,
  value,
  onChange,
  options,
  ariaLabel,
  wrap = false,
}: ChoiceChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip visible inside the scrollable row.
  useEffect(() => {
    if (wrap || !rowRef.current) return;
    const activeChip = rowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    activeChip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [value, wrap]);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
          {label}
        </label>
      )}
      <div
        ref={rowRef}
        role="group"
        aria-label={ariaLabel || label}
        className={
          wrap
            ? 'flex flex-wrap gap-2 py-0.5'
            : 'flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5'
        }
      >
        {options.map(({ value: optionValue, label: optionLabel, icon, color }) => {
          const isActive = value === optionValue;
          const accent = color || 'var(--primary)';
          return (
            <button
              key={optionValue}
              type="button"
              data-active={isActive}
              aria-pressed={isActive}
              onClick={() => onChange(optionValue)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.96] ${
                isActive
                  ? 'border-transparent'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${accent} 35%, transparent)`,
                      color: accent,
                    }
                  : undefined
              }
            >
              {icon && (
                <AppIcon
                  name={icon}
                  className="text-[16px]"
                  style={isActive ? { color: accent } : undefined}
                />
              )}
              <span>{optionLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
