'use client';

import React from 'react';
import { isLetterCurrencySymbol } from '@/lib/currency';
import { normalizeDigitsToAscii } from '@/lib/parse-amount';
import { useCurrency } from '@/lib/currency-context';
import { cn } from '@/lib/utils';

interface BigAmountInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value: string;
  /** Sanitized decimal text ("1234.56" / "1234,56") — parsing stays with the form. */
  onChange: (value: string) => void;
}

/**
 * The hero amount field of the money modals.
 *
 * Always a decimal NUMBER input: `type="text" inputMode="decimal"` so phones
 * pop the number pad with a decimal separator on every locale, instead of
 * `type="number"` which shows a text keyboard (no decimal key) on several
 * browsers/locales and allows `e`/exponent garbage. Input is sanitized to
 * digits + one separator; Arabic-Indic digits are normalised.
 *
 * Letter currency codes (MAD, AED, CHF…) render AFTER the amount in a small
 * muted type — "3 000,00 MAD" — never shouting in front of the number.
 * Single-character symbols (€, $, £) keep the classic large prefix.
 */
export function BigAmountInput({ value, onChange, className, ...rest }: BigAmountInputProps) {
  const { symbol } = useCurrency();
  const letterCode = isLetterCurrencySymbol(symbol);

  return (
    <div className={cn('flex items-center text-primary font-bold', className)}>
      {!letterCode && (
        <span className="mr-1 text-[28px] font-extrabold">{symbol}</span>
      )}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        value={value}
        onChange={(event) => {
          const normalized = normalizeDigitsToAscii(event.target.value);
          onChange(normalized.replace(/[^0-9.,]/g, ''));
        }}
        className="bg-transparent border-none text-[40px] leading-[1.1] text-center w-full max-w-[200px] text-on-surface focus:ring-0 p-0 placeholder:text-outline-variant font-extrabold outline-none"
        {...rest}
      />
      {letterCode && (
        <span className="ms-1.5 self-center text-[13px] font-extrabold tracking-normal text-on-surface-variant">
          {symbol}
        </span>
      )}
    </div>
  );
}
