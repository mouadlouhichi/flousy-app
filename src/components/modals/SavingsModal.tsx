import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomInput } from '../ui/CustomInput';
import { SavingGoal, MoneyPlace } from '../../lib/store';
import { savingGoalSchema, fundGoalSchema, withdrawGoalSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'fund' | 'withdraw' | 'edit';
  goal?: SavingGoal | null;
  onSaveGoal?: (goal: SavingGoal) => void;
  onFund?: (goalId: string, amount: number, sourcePlace: MoneyPlace) => void;
  onWithdraw?: (goalId: string, amount: number, targetPlace: MoneyPlace) => void;
  onDelete?: (goalId: string) => void;
  availableBalance?: number;
}

export function SavingsModal({
  isOpen,
  onClose,
  mode,
  goal,
  onSaveGoal,
  onFund,
  onWithdraw,
  onDelete,
  availableBalance = 0,
}: SavingsModalProps) {
  const { symbol, format } = useCurrency();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (goal && (mode === 'edit' || mode === 'fund' || mode === 'withdraw')) {
      setName(goal.name);
      setTarget(String(goal.target));
      setPlace(goal.source || 'bank');
    } else {
      setName('');
      setTarget('');
      setPlace('bank');
    }
    setAmount('');
    setErrors({});
  }, [goal, mode, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create' || mode === 'edit') {
      const parsedTarget = parseFloat(target);
      const valRes = savingGoalSchema.safeParse({ name, target: parsedTarget, source: place });

      if (!valRes.success) {
        const errs: Record<string, string> = {};
        const issues = valRes.error.issues || (valRes.error as any).errors || [];
        issues.forEach((err: any) => {
          if (err.path[0]) errs[String(err.path[0])] = err.message;
        });
        setErrors(errs);
        return;
      }

      const newGoal: SavingGoal = {
        id: goal ? goal.id : Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        target: parsedTarget,
        current: goal ? goal.current : 0,
        source: place,
        active: true,
      };

      if (onSaveGoal) onSaveGoal(newGoal);
      onClose();
    } else if (mode === 'fund' && goal) {
      const parsedAmount = parseFloat(amount);
      const valRes = fundGoalSchema.safeParse({ amount: parsedAmount, sourcePlace: place });

      if (!valRes.success) {
        setErrors({ amount: 'Please enter a valid positive amount' });
        return;
      }

      if (onFund) onFund(goal.id, parsedAmount, place);
      onClose();
    } else if (mode === 'withdraw' && goal) {
      const parsedAmount = parseFloat(amount);
      const valRes = withdrawGoalSchema.safeParse({ amount: parsedAmount, targetPlace: place });

      if (!valRes.success) {
        setErrors({ amount: 'Please enter a valid positive amount' });
        return;
      }

      if (parsedAmount > goal.current) {
        setErrors({ amount: `Cannot withdraw more than goal balance (${format(goal.current)})` });
        return;
      }

      if (onWithdraw) onWithdraw(goal.id, parsedAmount, place);
      onClose();
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'New Savings Goal';
      case 'edit':
        return 'Edit Goal';
      case 'fund':
        return `Fund "${goal?.name}"`;
      case 'withdraw':
        return `Withdraw from "${goal?.name}"`;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        {mode === 'create' || mode === 'edit' ? (
          <>
            <CustomInput
              label="Goal Name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder="e.g. Emergency Fund, New Laptop, Vacation"
              error={errors.name}
            />

            <CustomInput
              label={`Target Amount (${symbol})`}
              type="number"
              step="any"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setErrors((prev) => ({ ...prev, target: '' }));
              }}
              placeholder="0.00"
              error={errors.target}
            />

            <CustomSelect
              label="Primary Source Place"
              value={place}
              onChange={(v) => setPlace(v as MoneyPlace)}
              options={[
                { value: 'bank', label: 'Bank' },
                { value: 'home', label: 'Home Cash' },
                { value: 'wallet', label: 'Wallet' },
              ]}
            />
          </>
        ) : (
          <>
            {/* Fund or Withdraw Amount Input */}
            <div className="flex flex-col items-center justify-center py-sm">
              <label className="font-label-md text-label-md font-mono text-on-surface-variant uppercase tracking-wider mb-sm">
                {mode === 'fund' ? 'DEPOSIT AMOUNT' : 'WITHDRAWAL AMOUNT'}
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
            </div>

            <CustomSelect
              label={mode === 'fund' ? 'Deduct From Account' : 'Deposit Into Account'}
              value={place}
              onChange={(v) => setPlace(v as MoneyPlace)}
              options={[
                { value: 'bank', label: 'Bank' },
                { value: 'home', label: 'Home Cash' },
                { value: 'wallet', label: 'Wallet' },
              ]}
            />
          </>
        )}

        {/* Action Buttons */}
        <div className="flex gap-sm sm:gap-md pt-sm sm:pt-md border-t border-surface-variant">
          {mode === 'edit' && goal && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(goal.id);
                onClose();
              }}
              className="px-3 sm:px-4 py-2.5 sm:py-4 rounded-xl border border-error text-error hover:bg-error-container/20 font-headline-sm sm:font-headline-md transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-headline-sm sm:font-headline-md text-headline-sm sm:text-headline-md py-2.5 sm:py-4 rounded-xl hover:bg-primary-container transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            {mode === 'create'
              ? 'Create Goal'
              : mode === 'edit'
              ? 'Save Changes'
              : mode === 'fund'
              ? 'Add Funds'
              : 'Withdraw Funds'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
