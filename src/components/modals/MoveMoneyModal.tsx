import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SegmentedControl } from '../ui/segmented-control';
import { MoneyPlace, MonthBudget } from '../../lib/store';
import { moveMoneySchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

interface MoveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (from: MoneyPlace, to: MoneyPlace, amount: number) => void;
  month: MonthBudget;
}

const MONEY_PLACE_ICONS: Record<MoneyPlace, string> = {
  bank: 'account_balance',
  home: 'home',
  wallet: 'account_balance_wallet',
};

export function MoveMoneyModal({ isOpen, onClose, onMove, month }: MoveMoneyModalProps) {
  const { symbol, format, formatParts } = useCurrency();
  const [from, setFrom] = useState<MoneyPlace>('bank');
  const [to, setTo] = useState<MoneyPlace>('wallet');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setFrom('bank');
      setTo('wallet');
      setAmount('');
      setErrors({});
    }
  }, [isOpen]);

  const parsedAmount = parseFloat(amount) || 0;
  const currentFromBalance = month[`${from}Part`] || 0;
  const currentToBalance = month[`${to}Part`] || 0;

  const actualMove = Math.min(currentFromBalance, parsedAmount);
  const estimatedFromAfter = Math.max(0, currentFromBalance - actualMove);
  const estimatedToAfter = currentToBalance + actualMove;

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
        if (err.path[0]) fieldErrors[String(err.path[0])] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (parsedAmount > currentFromBalance) {
      setErrors({ amount: `Insufficient funds in ${from}. Maximum available: ${format(currentFromBalance)}` });
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

  // Balances are shown as bare numbers inside the segments — the currency code
  // pushed the pill text past the card on phone widths (the full formatted
  // amount is kept in the `title` tooltip and in the preview below).
  const compact = (value: number) => formatParts(value).amount;

  const placeOptions = [
    { value: 'bank', label: 'Bank', icon: 'account_balance', sublabel: compact(month.bankPart) },
    { value: 'wallet', label: 'Wallet', icon: 'account_balance_wallet', sublabel: compact(month.walletPart) },
    { value: 'home', label: 'Home Cash', icon: 'home', sublabel: compact(month.homePart) },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move Money">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── From / To selectors — segmented with sliding background ── */}
        <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant flex flex-col gap-3">
          <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Transfer Between Accounts
          </span>
          <SegmentedControl
            label="From"
            value={from}
            onChange={(newFrom) => {
              setFrom(newFrom as MoneyPlace);
              if (newFrom === to) {
                setTo(newFrom === 'bank' ? 'wallet' : 'bank');
              }
              setErrors({});
            }}
            options={placeOptions}
          />
          <SegmentedControl
            label="To"
            value={to}
            onChange={(newTo) => {
              setTo(newTo as MoneyPlace);
              if (newTo === from) {
                setFrom(newTo === 'bank' ? 'wallet' : 'bank');
              }
              setErrors({});
            }}
            options={placeOptions}
          />
          {errors.to && (
            <p role="alert" className="text-[12px] font-medium text-error">{errors.to}</p>
          )}
        </div>

        {/* ── Amount ── */}
        <div className="flex flex-col items-center justify-center py-1">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            Transfer Amount
          </label>
          <div className="flex items-center text-primary font-bold">
            <span className="text-[28px] font-extrabold mr-1">{symbol}</span>
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

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-3 justify-center">
            {[100, 200, 500, 1000].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleQuickAdd(chip)}
                className="px-3 py-1.5 bg-surface border border-outline-variant text-[12px] font-bold text-on-surface-variant hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all"
              >
                +{symbol}{(chip).toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* ── Balance Preview ── */}
        <div className="p-3.5 bg-primary-container/10 border border-primary/20 rounded-2xl">
          <span className="text-[11px] font-extrabold tracking-wider text-primary uppercase">
            Preview After Transfer
          </span>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <AppIcon name={MONEY_PLACE_ICONS[from]} className=" text-[16px] text-on-surface-variant" />
                <span className="text-[13px] text-on-surface-variant capitalize font-medium">{from}:</span>
              </div>
              <span className="font-mono text-[13px] text-on-surface font-semibold">
                {format(currentFromBalance)} <span className="text-on-surface-variant">→</span>{' '}
                <span className="text-tertiary">{format(estimatedFromAfter)}</span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <AppIcon name={MONEY_PLACE_ICONS[to]} className=" text-[16px] text-on-surface-variant" />
                <span className="text-[13px] text-on-surface-variant capitalize font-medium">{to}:</span>
              </div>
              <span className="font-mono text-[13px] text-on-surface font-semibold">
                {format(currentToBalance)} <span className="text-on-surface-variant">→</span>{' '}
                <span className="text-primary font-bold">{format(estimatedToAfter)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
        >
          <AppIcon name="swap_horiz" className=" text-[18px]" />
          <span>Confirm Transfer</span>
        </button>
      </form>
    </Modal>
  );
}
