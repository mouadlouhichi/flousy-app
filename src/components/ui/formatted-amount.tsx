'use client';

import { useCurrency } from '@/lib/currency-context';
import { cn } from '@/lib/utils';

/**
 * Renders a money value with the currency code/symbol at a smaller size than
 * the number (so "MAD" doesn't shout as loud as the amount).
 */
export function FormattedAmount({
  value,
  prefix = '',
  className,
  currencyClassName,
}: {
  value: number;
  prefix?: string;
  className?: string;
  currencyClassName?: string;
}) {
  const { formatParts } = useCurrency();
  const { amount, currency } = formatParts(value);
  return (
    <span className={className}>
      {prefix}
      {amount}
      {currency ? (
        <span
          className={cn(
            'ml-0.5 text-[0.7em] font-semibold text-on-surface-variant',
            currencyClassName,
          )}
        >
          {currency}
        </span>
      ) : null}
    </span>
  );
}
