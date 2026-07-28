import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { MoneyPlace, MonthBudget } from '../../lib/store';
import { moveMoneySchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

interface MoveMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMove: (from: MoneyPlace, to: MoneyPlace, amount: number) => void;
  month: MonthBudget;
}

export function MoveMoneyModal({ isOpen, onClose, onMove, month }: MoveMoneyModalProps) {
  const { symbol, format } = useCurrency();
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move Money">
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        {/* Source & Target Place Pickers */}
        <div className="grid grid-cols-2 gap-md p-md bg-surface-container rounded-2xl border border-outline-variant">
          {/* FROM */}
          <div className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              FROM
            </span>
            <select
              value={from}
              onChange={(e) => {
                const newFrom = e.target.value as MoneyPlace;
                setFrom(newFrom);
                if (newFrom === to) {
                  setTo(newFrom === 'bank' ? 'wallet' : 'bank');
                }
                setErrors({});
              }}
              className="w-full p-sm bg-surface border border-outline-variant rounded-xl font-label-lg text-label-lg text-on-surface focus:border-primary transition-all outline-none capitalize"
            >
              <option value="bank">Bank ({format(month.bankPart)})</option>
              <option value="home">Home Cash ({format(month.homePart)})</option>
              <option value="wallet">Wallet ({format(month.walletPart)})</option>
            </select>
          </div>

          {/* TO */}
          <div className="flex flex-col gap-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              TO
            </span>
            <select
              value={to}
              onChange={(e) => {
                const newTo = e.target.value as MoneyPlace;
                setTo(newTo);
                if (newTo === from) {
                  setFrom(newTo === 'bank' ? 'wallet' : 'bank');
                }
                setErrors({});
              }}
              className="w-full p-sm bg-surface border border-outline-variant rounded-xl font-label-lg text-label-lg text-on-surface focus:border-primary transition-all outline-none capitalize"
            >
              <option value="bank">Bank ({format(month.bankPart)})</option>
              <option value="home">Home Cash ({format(month.homePart)})</option>
              <option value="wallet">Wallet ({format(month.walletPart)})</option>
            </select>
          </div>
        </div>

        {errors.to && (
          <p role="alert" className="font-label-sm text-label-sm text-error">
            {errors.to}
          </p>
        )}

        {/* Amount Input */}
        <div className="flex flex-col items-center justify-center py-sm">
          <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
            TRANSFER AMOUNT
          </label>
          <div className="flex items-center text-primary font-bold">
            <span className="text-headline-lg mr-xs">{symbol}</span>
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
              className="bg-transparent border-none text-[48px] leading-[1.1] text-center w-full max-w-[220px] text-on-surface focus:ring-0 p-0 font-extrabold outline-none"
            />
          </div>
          {errors.amount && (
            <p role="alert" className="font-label-sm text-label-sm text-error mt-1 text-center">
              {errors.amount}
            </p>
          )}

          {/* Quick Amount Chips */}
          <div className="flex gap-xs mt-md">
            {[100, 200, 500, 1000].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleQuickAdd(chip)}
                className="px-3 py-1.5 bg-surface-container hover:bg-surface-variant text-on-surface-variant font-label-md text-label-md rounded-lg transition-colors border border-outline-variant"
              >
                +{chip}
              </button>
            ))}
          </div>
        </div>

        {/* Live Balance Impact Preview */}
        <div className="p-md bg-primary-container/10 border border-primary/20 rounded-2xl flex flex-col gap-sm">
          <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">
            PREVIEW BALANCES AFTER TRANSFER
          </span>
          <div className="flex justify-between items-center font-body-md text-body-md">
            <span className="text-on-surface-variant capitalize">{from}:</span>
            <span className="font-mono text-on-surface font-semibold">
              {format(currentFromBalance)} → <span className="text-tertiary">{format(estimatedFromAfter)}</span>
            </span>
          </div>
          <div className="flex justify-between items-center font-body-md text-body-md">
            <span className="text-on-surface-variant capitalize">{to}:</span>
            <span className="font-mono text-on-surface font-semibold">
              {format(currentToBalance)} → <span className="text-primary font-bold">{format(estimatedToAfter)}</span>
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-primary text-on-primary font-headline-sm sm:font-headline-md text-headline-sm sm:text-headline-md py-2.5 sm:py-4 rounded-xl hover:bg-primary-container transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
        >
          Confirm Transfer
        </button>
      </form>
    </Modal>
  );
}
