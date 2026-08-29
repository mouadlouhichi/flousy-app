import { isLetterCurrencySymbol } from '@/lib/currency';
import { cn } from '@/lib/utils';

/**
 * Prefix for the large amount inputs. Letter codes (MAD, AED, CHF…) stay
 * compact so they don't compete with the 40px number; single-character
 * symbols (€, $, £) keep the original 28px treatment.
 */
export function AmountSymbol({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const compact = isLetterCurrencySymbol(symbol);
  return (
    <span
      className={cn(
        'font-extrabold',
        compact
          ? 'mr-1 self-center text-[13px] tracking-normal text-on-surface-variant'
          : 'mr-1 text-[28px]',
        className,
      )}
    >
      {symbol}
    </span>
  );
}
