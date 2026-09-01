'use client';

import { useMemo, useState } from 'react';
import { AppIcon } from './app-icon';
import { useLanguage } from '@/lib/i18n-context';

/**
 * Searchable, intentionally broad icon set for custom expense categories.
 * Values are persisted Material-style identifiers so existing category icons
 * and the AppIcon compatibility layer continue to work together.
 */
export const CATEGORY_ICON_CHOICES = [
  { value: 'label' },
  { value: 'shopping_bag' },
  { value: 'shopping_cart' },
  { value: 'restaurant' },
  { value: 'local_cafe' },
  { value: 'home' },
  { value: 'house' },
  { value: 'bolt' },
  { value: 'wifi' },
  { value: 'phone' },
  { value: 'subscriptions' },
  { value: 'payments' },
  { value: 'credit_card' },
  { value: 'account_balance' },
  { value: 'savings' },
  { value: 'directions_car' },
  { value: 'fuel' },
  { value: 'directions_bike' },
  { value: 'directions_bus' },
  { value: 'directions_train' },
  { value: 'flight' },
  { value: 'hotel' },
  { value: 'school' },
  { value: 'work' },
  { value: 'child_care' },
  { value: 'medical_services' },
  { value: 'medication' },
  { value: 'fitness_center' },
  { value: 'pets' },
  { value: 'movie' },
  { value: 'music_note' },
  { value: 'sports_esports' },
  { value: 'card_giftcard' },
  { value: 'favorite' },
  { value: 'store' },
  { value: 'inventory_2' },
  { value: 'build' },
  { value: 'shirt' },
  { value: 'content_cut' },
  { value: 'menu_book' },
  { value: 'local_parking' },
  { value: 'local_activity' },
  { value: 'receipt_long' },
  { value: 'event_repeat' },
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
  label,
}: CategoryIconPickerProps) {
  const { messages: m, t, translate } = useLanguage();
  const visibleLabel = label || m.iconPicker.pickIcon;
  const [query, setQuery] = useState('');
  const choiceLabel = (value: string) => translate(`iconPicker.choices.${value}`);
  const visibleChoices = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return CATEGORY_ICON_CHOICES;
    return CATEGORY_ICON_CHOICES.filter((choice) =>
      choiceLabel(choice.value).toLocaleLowerCase().includes(needle) ||
      choice.value.replace(/_/g, ' ').includes(needle),
    );
  // `translate` changes when the locale catalog changes, so Arabic searches
  // are recalculated immediately after a language switch.
    // `choiceLabel` is a per-render closure over `translate`, which is listed;
    // depending on the closure itself would invalidate the memo on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, translate]);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
        {visibleLabel}
      </label>
      <div className="relative">
        <AppIcon
          name="search"
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={m.iconPicker.findIcon}
          aria-label={m.iconPicker.findIcon}
          className="h-9 w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-1.5 ps-9 pe-3 text-[12px] font-medium text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {visibleChoices.length > 0 ? (
        <div
          role="group"
          aria-label={visibleLabel}
          className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto pe-1 sm:grid-cols-8"
        >
          {visibleChoices.map((choice) => {
            const selected = value === choice.value;
            const optionLabel = choiceLabel(choice.value);
            return (
              <button
                key={choice.value}
                type="button"
                aria-label={optionLabel}
                aria-pressed={selected}
                title={optionLabel}
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
          {t(m.iconPicker.noMatches, { query: query.trim() })}
        </p>
      )}
    </div>
  );
}
