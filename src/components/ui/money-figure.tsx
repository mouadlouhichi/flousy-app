'use client';

import { useCurrency } from '@/lib/currency-context';
import { cn } from '@/lib/utils';

type FigureSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

// Currency glyph sizes are deliberately small — in the reference the "$" is
// a tiny superscript beside a very large number. Letter codes (MAD, CHF…)
// get one step smaller again so three letters never out-shout the figure.
const SIZE_CLASS: Record<FigureSize, { amount: string; symbol: string; code: string }> = {
  xs: { amount: 'text-[13px]', symbol: 'text-[9px]', code: 'text-[8px]' },
  sm: { amount: 'text-[14px] tracking-[-0.02em]', symbol: 'text-[10px]', code: 'text-[9px]' },
  md: { amount: 'text-[20px]', symbol: 'text-[12px]', code: 'text-[10px]' },
  lg: { amount: 'text-[26px]', symbol: 'text-[14px]', code: 'text-[11px]' },
  xl: { amount: 'text-[32px] sm:text-[36px]', symbol: 'text-[16px]', code: 'text-[12px]' },
  hero: { amount: 'text-[38px] sm:text-[46px]', symbol: 'text-[20px]', code: 'text-[13px]' },
};

/**
 * The "$4,309,573.02" figure from the reference design: a large tabular
 * number with the currency rendered as a small raised glyph in the accent
 * colour, sitting at the top-left of the digits.
 *
 * Renders as a single inline element so it can be dropped anywhere a plain
 * amount used to live.
 */
export function MoneyFigure({
  value,
  size = 'lg',
  prefix = '',
  className,
  currencyClassName,
  redacted = false,
  tone = 'default',
  weight = 'medium',
}: {
  value: number;
  size?: FigureSize;
  /** Sign or marker to render before the figure (e.g. "-", "+"). */
  prefix?: string;
  className?: string;
  currencyClassName?: string;
  /** Show dots instead of the number (RBAC-restricted balances). */
  redacted?: boolean;
  /** `accent` tints the currency lime (for forest surfaces). */
  tone?: 'default' | 'accent' | 'inherit';
  weight?: 'regular' | 'medium' | 'semibold';
}) {
  const { formatParts } = useCurrency();
  const { amount, currency } = formatParts(value);
  const sizes = SIZE_CLASS[size];
  const isLetterCode = currency.trim().length > 1;

  const currencyTone =
    tone === 'accent'
      ? 'text-lime'
      : tone === 'inherit'
        ? 'opacity-60'
        : 'text-secondary';

  const weightClass =
    weight === 'regular' ? 'font-normal' : weight === 'semibold' ? 'font-semibold' : 'font-medium';

  return (
    <span className={cn('inline-flex items-start leading-none text-figure', weightClass, className)}>
      {prefix && <span className={cn('tabular', sizes.amount)}>{prefix}</span>}
      {currency && (
        <span
          className={cn(
            'me-[0.12em] mt-[0.18em] font-semibold tracking-[0.02em] leading-none',
            isLetterCode ? sizes.code : sizes.symbol,
            currencyTone,
            currencyClassName,
          )}
        >
          {currency}
        </span>
      )}
      <span className={cn('tabular', sizes.amount)}>{redacted ? '••••' : amount}</span>
    </span>
  );
}
