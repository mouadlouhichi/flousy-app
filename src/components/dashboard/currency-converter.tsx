'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';

const OPTIONS = Object.values(SUPPORTED_CURRENCIES).map((c) => ({ value: c.code, label: c.code }));

/** Small MAD ⇄ EUR/USD helper for diaspora budgets. Free for everyone. */
export function CurrencyConverter() {
  const { currency } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const [from, setFrom] = useState(currency || 'MAD');
  const [to, setTo] = useState(currency === 'EUR' ? 'MAD' : 'EUR');
  const [amount, setAmount] = useState('1000');
  const [rates, setRates] = useState<{ base: string; date: string | null; rates: Record<string, number> } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch(`/api/fx?base=${encodeURIComponent(from)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('fx'))))
      .then((data) => { if (!cancelled) setRates(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [from]);

  const rate = rates?.base === from ? rates.rates[to] : undefined;
  const value = Number(amount.replace(',', '.')) || 0;
  const converted = useMemo(() => (rate ? value * rate : null), [rate, value]);
  const fmt = (v: number, code: string) => {
    try {
      return new Intl.NumberFormat(intlLocale, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(v);
    } catch {
      return `${v.toFixed(2)} ${code}`;
    }
  };

  return (
    <section className="rounded-3xl border border-outline-variant bg-surface-container p-5">
      <h3 className="flex items-center gap-2 font-bold text-on-surface">
        <AppIcon name="currency_exchange" className="text-[20px] text-primary" />
        {m.fx.title}
      </h3>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <CustomSelect label={m.fx.from} value={from} onChange={setFrom} options={OPTIONS} />
        <button
          type="button"
          aria-label="swap"
          onClick={() => { setFrom(to); setTo(from); }}
          className="mb-1 flex size-9 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:text-on-surface"
        >
          <AppIcon name="swap_horiz" className="text-[18px]" />
        </button>
        <CustomSelect label={m.fx.to} value={to} onChange={setTo} options={OPTIONS} />
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        {m.fx.amount}
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-2xl border border-outline-variant bg-surface px-4 py-2.5 font-mono text-base font-bold normal-case tracking-normal text-on-surface outline-none focus:border-primary"
        />
      </label>
      <div className="mt-3 rounded-2xl bg-surface-container-high p-3 text-center">
        {converted !== null ? (
          <>
            <p className="font-mono text-2xl font-extrabold text-on-surface">{fmt(converted, to)}</p>
            <p className="text-[11px] text-on-surface-variant">
              {t(m.fx.rateNote, { rate: rate ? rate.toFixed(4) : '—', date: rates?.date || '' })}
            </p>
          </>
        ) : (
          <p className="text-sm text-on-surface-variant">{error ? m.fx.unavailable : m.common.loading}</p>
        )}
      </div>
    </section>
  );
}
