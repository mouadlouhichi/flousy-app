'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { useLanguage } from '@/lib/i18n-context';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Accessible name when the visible label sits outside the component. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  ariaLabel,
  disabled = false,
  className = '',
  triggerClassName = '',
  contentClassName = '',
}: CustomSelectProps) {
  const { messages: m } = useLanguage();

  return (
    <div className={`flex flex-col gap-sm ${className}`}>
      {label && (
        <label className="font-label-sm text-label-sm font-mono text-on-surface-variant uppercase tracking-wider">
          {label}
        </label>
      )}
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          aria-label={ariaLabel || label}
          className={`w-full h-12 px-4 bg-surface-container-lowest border border-outline-variant rounded-xl font-body-md text-body-md text-on-surface hover:border-outline hover:bg-surface-container-low focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 ${triggerClassName}`}
        >
          <SelectValue placeholder={placeholder || m.common.select} />
        </SelectTrigger>
        <SelectContent className={`bg-surface border border-outline-variant rounded-xl shadow-lg ${contentClassName}`}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="p-4 font-body-md text-body-md text-on-surface hover:bg-surface-variant/50 focus:bg-primary/10 focus:text-primary cursor-pointer"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
