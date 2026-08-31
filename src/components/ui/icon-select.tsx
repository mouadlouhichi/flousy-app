'use client';

import { AppIcon } from './app-icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from './select';

interface IconSelectOption {
  value: string;
  label: string;
}

interface IconSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: IconSelectOption[];
  icon?: string;
  ariaLabel?: string;
  isActive?: boolean;
}

export function IconSelect({
  value,
  onChange,
  options,
  icon = 'sort',
  ariaLabel,
  isActive = false,
}: IconSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        size="default"
        className={`!h-12 !w-12 shrink-0 justify-center gap-0 rounded-xl border px-0 py-0 shadow-none [&_svg]:hidden ${
          isActive
            ? 'border-primary bg-primary text-on-primary'
            : 'border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
        }`}
      >
        <AppIcon name={icon} className="text-[22px]" />
      </SelectTrigger>
      <SelectContent className="bg-surface border-outline-variant rounded-xl shadow-lg">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="p-3 font-body-md text-body-md text-on-surface"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
