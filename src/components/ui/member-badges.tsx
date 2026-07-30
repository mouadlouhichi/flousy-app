'use client';

import React from 'react';
import { AppIcon } from './app-icon';

export const HOUSEHOLD_MEMBERS: Array<{ value: string; label: string }> = [
  { value: 'Self', label: 'Self' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Family', label: 'Family' },
  { value: 'Queen', label: 'Queen' },
  { value: 'King', label: 'King' },
];

interface MemberBadgesProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Household member single-select rendered as pill badges: an avatar initial
 * circle when inactive, a solid primary badge with a check when selected.
 */
export function MemberBadges({ label = 'Household Member', value, onChange }: MemberBadgesProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
          {label}
        </label>
      )}
      <div role="group" aria-label={label} className="flex flex-wrap gap-2 py-0.5">
        {HOUSEHOLD_MEMBERS.map(({ value: memberValue, label: memberLabel }) => {
          const isActive = value === memberValue;
          return (
            <button
              key={memberValue}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(memberValue)}
              className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[12px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                isActive
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'border border-outline-variant text-on-surface hover:bg-surface-variant/40'
              }`}
            >
              {isActive ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-on-primary/20">
                  <AppIcon name="check" className="text-[13px]" />
                </span>
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-extrabold text-on-surface-variant">
                  {memberLabel.charAt(0)}
                </span>
              )}
              <span>{memberLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
