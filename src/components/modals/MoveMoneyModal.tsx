import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { getPlaceBalance, MoneyPlace, MonthBudget } from '../../lib/store';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { moveMoneySchema } from '../../lib/validation';
import { AmountSymbol } from '../ui/amount-symbol';
import { MoneyFigure } from '../ui/money-figure';
import { SwipeToConfirm } from '../ui/swipe-to-confirm';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';
import { cn } from '@/lib/utils';

interface MoveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (from: MoneyPlace, to: MoneyPlace, amount: number) => void;
  month: MonthBudget;
}

/**
 * Move money between places, laid out like the reference converter screen:
 * a lime "You move" card stacked on a forest "Goes to" card, a white Swap
 * pill riding the seam between them, a rate-style summary and a forest
 * swipe-style confirm button.
 */
export function MoveMoneyModal({ isOpen, onClose, onMove, month }: MoveMoneyModalProps) {
  const { symbol, format, formatParts } = useCurrency();
  const { messages: m, t, isRTL } = useLanguage();
  const mm = m.modals.moveMoney;
  const { places, icon, label, defaultPlace } = useMoneyPlaces(month);
  const altPlace = places.find((p) => p.id !== defaultPlace)?.id || defaultPlace;
  const [from, setFrom] = useState<MoneyPlace>(defaultPlace);
  const [to, setTo] = useState<MoneyPlace>(altPlace);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFrom(defaultPlace);
      setTo(altPlace);
      setAmount('');
      setErrors({});
    }
  }, [isOpen, defaultPlace, altPlace]);

  const parsedAmount = parseFloat(amount) || 0;
  const currentFromBalance = getPlaceBalance(month, from);
  const currentToBalance = getPlaceBalance(month, to);

  const actualMove = Math.min(currentFromBalance, parsedAmount);
  const estimatedFromAfter = Math.max(0, currentFromBalance - actualMove);
  const estimatedToAfter = currentToBalance + actualMove;
  const overdrawn = parsedAmount > currentFromBalance;

  const otherPlace = (current: string) => places.find((p) => p.id !== current)?.id || current;

  const swapPlaces = () => {
    setFrom(to);
    setTo(from);
    setErrors({});
  };

  /** Runs the schema + balance checks; surfaces errors and reports validity. */
  const validate = (): boolean => {
    const validationResult = moveMoneySchema.safeParse({
      from,
      to,
      amount: parsedAmount,
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      const issues = validationResult.error.issues || (validationResult.error as any).errors || [];
      issues.forEach((err: any) => {
        const field = String(err.path[0] || '');
        if (field === 'amount') fieldErrors.amount = m.errors.validationAmountInvalid;
        else if (field === 'from' || field === 'to') fieldErrors[field] = mm.samePlaces;
      });
      setErrors(fieldErrors);
      return false;
    }

    if (overdrawn) {
      setErrors({ amount: t(mm.insufficientFunds, { place: label(from), amount: format(currentFromBalance) }) });
      return false;
    }
    return true;
  };

  /**
   * Swipe completion: the control has already played its success animation
   * when this runs. Returning `false` makes the knob spring back and the
   * track shake so an invalid amount is felt, not just read.
   */
  const handleConfirm = (): boolean => {
    if (!validate()) return false;
    onMove(from, to, parsedAmount);
    onClose();
    return true;
  };

  // Enter inside the amount field still submits (keyboard users shouldn't
  // have to reach the swipe); it goes through the same validation.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onMove(from, to, parsedAmount);
    onClose();
  };

  const canSwipe = parsedAmount > 0 && !overdrawn && from !== to;

  /** "1,000" — the chip row already sits under a currency-labelled figure. */
  const compact = (value: number) => formatParts(value).amount.replace(/[.,]00$/, '');

  const handleQuickAdd = (add: number) => {
    const nextVal = (parsedAmount + add).toString();
    setAmount(nextVal);
    setErrors((prev) => ({ ...prev, amount: '' }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mm.title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="relative flex flex-col">
          {/* ── You move (lime) ── */}
          <div className="surface-lime relative overflow-hidden rounded-[1.5rem] px-4 pb-8 pt-4 text-forest-deep sm:px-5">
            <div aria-hidden className="dot-matrix pointer-events-none absolute inset-y-0 end-0 w-1/3 opacity-50 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />
            <div className="relative flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-forest-deep/70">{mm.youMove}</span>
              <PlacePills
                name={mm.from}
                value={from}
                places={places.map((p) => ({ id: p.id, label: label(p.id), icon: icon(p.id) }))}
                onChange={(next) => {
                  setFrom(next as MoneyPlace);
                  if (next === to) setTo(otherPlace(next));
                  setErrors({});
                }}
                tone="lime"
              />
            </div>
            <label className="relative mt-3 flex items-center text-forest-deep">
              <span className="sr-only">{mm.transferAmount}</span>
              <AmountSymbol symbol={symbol} className="text-forest/70" />
              <input
                type="number"
                step="any"
                autoFocus
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                placeholder="0.00"
                aria-invalid={Boolean(errors.amount) || undefined}
                className="keep-font-40 tabular w-full min-w-0 border-none bg-transparent p-0 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em] text-forest-deep outline-none placeholder:text-forest-deep/40 focus:ring-0"
              />
            </label>
            <p className={cn('relative mt-1 text-[12px] font-medium', overdrawn ? 'text-error' : 'text-forest-deep/70')}>
              {t(mm.currentBalance, { amount: format(currentFromBalance) })}
            </p>
          </div>

          {/* ── Swap pill on the seam ── */}
          <button
            type="button"
            onClick={swapPlaces}
            className="absolute left-1/2 top-1/2 z-10 flex h-10 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-semibold text-on-surface shadow-floating transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <AppIcon name="swap" strokeWidth={2.2} className="text-[16px] text-forest dark:text-lime" />
            {mm.swap}
          </button>

          {/* ── Goes to (forest) ── */}
          <div className="surface-forest relative -mt-4 overflow-hidden rounded-[1.5rem] px-4 pb-4 pt-8 text-white shadow-forest sm:px-5">
            <div aria-hidden className="dot-matrix-forest pointer-events-none absolute inset-y-0 end-0 w-1/3 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)] rtl:[mask-image:linear-gradient(to_right,black,transparent)]" />
            <div className="relative flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">{mm.theyGet}</span>
              <PlacePills
                name={mm.to}
                value={to}
                places={places.map((p) => ({ id: p.id, label: label(p.id), icon: icon(p.id) }))}
                onChange={(next) => {
                  setTo(next as MoneyPlace);
                  if (next === from) setFrom(otherPlace(next));
                  setErrors({});
                }}
                tone="forest"
              />
            </div>
            <MoneyFigure value={actualMove} size="hero" weight="semibold" tone="accent" className="relative mt-3 text-white" />
            <p className="relative mt-1 text-[12px] font-medium text-white/60">
              {t(mm.currentBalance, { amount: format(currentToBalance) })}
            </p>
          </div>
        </div>

        {(errors.amount || errors.to || errors.from) && (
          <p role="alert" className="-mt-2 text-center text-[12px] font-medium text-error">
            {errors.amount || errors.to || errors.from}
          </p>
        )}

        {/* Quick-add chips */}
        <div className="-mt-1 flex flex-wrap items-center justify-center gap-1.5">
          {[100, 200, 500, 1000].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleQuickAdd(chip)}
              className="rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-[12px] font-semibold tabular text-on-surface-variant transition-colors hover:border-lime-deep hover:bg-lime hover:text-forest-deep"
            >
              +{compact(chip)}
            </button>
          ))}
        </div>

        {/* ── Summary rows ── */}
        <dl className="flex flex-col gap-2.5 px-1 text-[13px]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">{mm.afterTransfer}</span>
          {[
            { id: from, before: currentFromBalance, after: estimatedFromAfter, gain: false },
            { id: to, before: currentToBalance, after: estimatedToAfter, gain: true },
          ].map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3">
              <dt className="flex min-w-0 items-center gap-2 font-medium text-on-surface">
                <AppIcon name={icon(row.id)} strokeWidth={2} className="shrink-0 text-[16px] text-on-surface-variant" />
                <span className="truncate">{label(row.id)}</span>
              </dt>
              <dd className="flex shrink-0 items-center gap-1.5 tabular font-semibold text-on-surface">
                <span className="text-[12px] font-medium text-on-surface-variant">{format(row.before)}</span>
                <AppIcon name="arrow_forward" strokeWidth={2.2} className="text-[12px] text-on-surface-variant rtl:-scale-x-100" />
                <span className={cn(row.gain && actualMove > 0 && 'text-forest dark:text-lime')}>{format(row.after)}</span>
              </dd>
            </div>
          ))}
          <div className="my-0.5 border-t border-dashed border-outline-variant" />
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[14px] font-semibold text-on-surface">{m.common.total}</dt>
            <dd>
              <MoneyFigure value={actualMove} size="md" weight="semibold" className="text-on-surface" />
            </dd>
          </div>
        </dl>

        {/* ── Swipe to confirm ── */}
        <div className="flex flex-col gap-2">
          <SwipeToConfirm
            label={mm.confirmTransfer}
            successLabel={mm.moved}
            onConfirm={handleConfirm}
            disabled={!canSwipe}
            rtl={isRTL}
          />
          <p className="text-center text-[11px] font-medium text-on-surface-variant">
            {canSwipe ? mm.swipeToConfirm : mm.swipeHint}
          </p>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Compact radio pills for picking a money place on a coloured card. The
 * active pill is opaque (white on lime, lime on forest); the others are
 * translucent outlines so the card colour stays dominant.
 */
function PlacePills({
  name,
  value,
  places,
  onChange,
  tone,
}: {
  name: string;
  value: string;
  places: { id: string; label: string; icon: string }[];
  onChange: (id: string) => void;
  tone: 'lime' | 'forest';
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex max-w-[70%] flex-wrap justify-end gap-1.5">
      {places.map((place) => {
        const active = place.id === value;
        return (
          <button
            key={place.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(place.id)}
            title={place.label}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2',
              tone === 'lime'
                ? active
                  ? 'border-transparent bg-forest text-lime shadow-sm focus-visible:ring-forest'
                  : 'border-forest/20 bg-white/40 text-forest-deep/80 hover:bg-white/70 focus-visible:ring-forest'
                : active
                  ? 'border-transparent bg-lime text-forest-deep shadow-sm focus-visible:ring-lime'
                  : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/15 focus-visible:ring-lime',
            )}
          >
            <AppIcon name={place.icon} strokeWidth={2.2} className="text-[14px]" />
            <span className={cn(!active && 'sr-only sm:not-sr-only')}>{place.label}</span>
          </button>
        );
      })}
    </div>
  );
}
