import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SegmentedControl } from '../ui/segmented-control';
import { getPlaceBalance, MoneyPlace, MonthBudget } from '../../lib/store';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { moveMoneySchema } from '../../lib/validation';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';

interface MoveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (from: MoneyPlace, to: MoneyPlace, amount: number) => void;
  month: MonthBudget;
}

export function MoveMoneyModal({ isOpen, onClose, onMove, month }: MoveMoneyModalProps) {
  const { symbol, format, formatParts } = useCurrency();
  const { messages: m, t } = useLanguage();
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

  const otherPlace = (current: string) => places.find((p) => p.id !== current)?.id || current;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
      return;
    }

    if (parsedAmount > currentFromBalance) {
      setErrors({ amount: t(mm.insufficientFunds, { place: label(from), amount: format(currentFromBalance) }) });
      return;
    }

    onMove(from, to, parsedAmount);
    onClose();
  };

  const handleQuickAdd = (add: number) => {
    const nextVal = (parsedAmount + add).toString();
    setAmount(nextVal);
    setErrors((prev) => ({ ...prev, amount: '' }));
  };

  const compactAmount = (value: number) => formatParts(value).amount;

  const placeOptions = places.map((p) => ({
    value: p.id,
    label: label(p.id),
    icon: p.icon,
    sublabel: compactAmount(getPlaceBalance(month, p.id)),
    title: `${label(p.id)} · ${format(getPlaceBalance(month, p.id))}`,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mm.title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container p-4">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {mm.betweenAccounts}
          </span>
          <SegmentedControl
            label={mm.from}
            value={from}
            onChange={(newFrom) => {
              setFrom(newFrom as MoneyPlace);
              if (newFrom === to) setTo(otherPlace(newFrom));
              setErrors({});
            }}
            options={placeOptions}
          />
          <SegmentedControl
            label={mm.to}
            value={to}
            onChange={(newTo) => {
              setTo(newTo as MoneyPlace);
              if (newTo === from) setFrom(otherPlace(newTo));
              setErrors({});
            }}
            options={placeOptions}
          />
          {errors.to && (
            <p role="alert" className="text-[12px] font-medium text-error">{errors.to}</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-1">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            {mm.transferAmount}
          </label>
          <div className="flex items-center text-primary font-bold">
            <AmountSymbol symbol={symbol} />
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
              className="bg-transparent border-none text-[40px] leading-[1.1] text-center w-full max-w-[200px] text-on-surface focus:ring-0 p-0 placeholder:text-outline-variant font-extrabold outline-none"
            />
          </div>
          {errors.amount && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1 text-center">{errors.amount}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap mt-3 justify-center">
            {[100, 200, 500, 1000].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleQuickAdd(chip)}
                className="px-3 py-1.5 bg-surface border border-outline-variant text-[12px] font-bold text-on-surface-variant hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all"
              >
                +{format(chip)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3.5 bg-primary-container/10 border border-primary/20 rounded-2xl">
          <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
            {mm.previewAfter}
          </span>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <AppIcon name={icon(from)} className="shrink-0 text-[16px] text-on-surface-variant" />
                <span className="truncate text-[13px] font-medium text-on-surface-variant">{label(from)}:</span>
              </div>
              <span className="min-w-0 truncate text-end font-mono text-[13px] font-semibold text-on-surface">
                {format(currentFromBalance)} <span className="text-on-surface-variant">→</span>{' '}
                <span className="text-tertiary">{format(estimatedFromAfter)}</span>
              </span>
            </div>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <AppIcon name={icon(to)} className="shrink-0 text-[16px] text-on-surface-variant" />
                <span className="truncate text-[13px] font-medium text-on-surface-variant">{label(to)}:</span>
              </div>
              <span className="min-w-0 truncate text-end font-mono text-[13px] font-semibold text-on-surface">
                {format(currentToBalance)} <span className="text-on-surface-variant">→</span>{' '}
                <span className="text-primary font-bold">{format(estimatedToAfter)}</span>
              </span>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <AppIcon name="swap_horiz" className=" text-[18px]" />
          <span>{mm.confirmTransfer}</span>
        </button>
      </form>
    </Modal>
  );
}
