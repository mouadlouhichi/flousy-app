'use client';

import { useMemo, useState } from 'react';
import { AppIcon } from './app-icon';

/**
 * Searchable, intentionally broad icon set for custom expense categories.
 * Values are persisted Material-style identifiers so existing category icons
 * and the AppIcon compatibility layer continue to work together.
 */
export const CATEGORY_ICON_CHOICES = [
  { value: 'label', label: 'Other' },
  { value: 'shopping_bag', label: 'Shopping' },
  { value: 'shopping_cart', label: 'Groceries' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'local_cafe', label: 'Coffee' },
  { value: 'home', label: 'Home' },
  { value: 'house', label: 'Housing' },
  { value: 'bolt', label: 'Utilities' },
  { value: 'wifi', label: 'Internet' },
  { value: 'phone', label: 'Phone' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'payments', label: 'Cash' },
  { value: 'credit_card', label: 'Card' },
  { value: 'account_balance', label: 'Bank' },
  { value: 'savings', label: 'Savings' },
  { value: 'directions_car', label: 'Car' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'directions_bike', label: 'Bike' },
  { value: 'directions_bus', label: 'Bus' },
  { value: 'directions_train', label: 'Train' },
  { value: 'flight', label: 'Travel' },
  { value: 'hotel', label: 'Lodging' },
  { value: 'school', label: 'Education' },
  { value: 'work', label: 'Work' },
  { value: 'child_care', label: 'Child care' },
  { value: 'medical_services', label: 'Health' },
  { value: 'medication', label: 'Pharmacy' },
  { value: 'fitness_center', label: 'Fitness' },
  { value: 'pets', label: 'Pets' },
  { value: 'movie', label: 'Movies' },
  { value: 'music_note', label: 'Music' },
  { value: 'sports_esports', label: 'Gaming' },
  { value: 'card_giftcard', label: 'Gifts' },
  { value: 'favorite', label: 'Personal' },
  { value: 'store', label: 'Store' },
  { value: 'inventory_2', label: 'Goods' },
  { value: 'build', label: 'Repairs' },
  { value: 'shirt', label: 'Clothing' },
  { value: 'content_cut', label: 'Beauty' },
  { value: 'menu_book', label: 'Books' },
  { value: 'local_parking', label: 'Parking' },
  { value: 'local_activity', label: 'Tickets' },
  { value: 'receipt_long', label: 'Bills' },
  { value: 'event_repeat', label: 'Recurring' },
] as const;

interface CategoryIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}

/**
 * Lets people browse the common choices at a glance and filter the full list
 * when they know the kind of category they want to create.
 */
export function CategoryIconPicker({
  value,
  onChange,
  label = 'Pick an icon',
}: CategoryIconPickerProps) {
  const [query, setQuery] = useState('');
  const visibleChoices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return CATEGORY_ICON_CHOICES;
    return CATEGORY_ICON_CHOICES.filter(
      (choice) =>
        choice.label.toLowerCase().includes(needle) ||
        choice.value.replace(/_/g, ' ').includes(needle),
    );
  }, [query]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
        {label}
      </label>
      <div className="relative">
        <AppIcon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find an icon"
          aria-label="Find an icon"
          className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-1.5 pl-9 pr-3 text-[12px] font-medium text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {visibleChoices.length > 0 ? (
        <div
          role="group"
          aria-label={label}
          className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto pr-1 sm:grid-cols-8"
        >
          {visibleChoices.map((choice) => {
            const selected = value === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-label={choice.label}
                aria-pressed={selected}
                title={choice.label}
                onClick={() => onChange(choice.value)}
                className={`flex aspect-square items-center justify-center rounded-lg transition-colors ${
                  selected
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                }`}
              >
                <AppIcon name={choice.value} className="text-[18px]" />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg bg-surface-container px-3 py-2 text-[12px] font-medium text-on-surface-variant">
          No icons match “{query.trim()}”. Try shopping, car, health, or home.
        </p>
      )}
    </div>
  );
}
