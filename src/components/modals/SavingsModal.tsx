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
      case 'create': return 'New Savings Goal';
      case 'edit': return 'Edit Goal';
      case 'fund': return `Fund "${goal?.name}"`;
      case 'withdraw': return `Withdraw from "${goal?.name}"`;
    }
  };

  const quickAmounts = mode === 'fund' ? [500, 1000, 2000, 5000] : [100, 200, 500, 1000];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === 'create' || mode === 'edit' ? (
          <>
            {/* Goal Name */}
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

            {/* Target Amount */}
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

            {/* Quick target chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-on-surface-variant mr-0.5">Suggestions:</span>
              {[5000, 10000, 25000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => { setTarget(String(amt)); setErrors((p) => ({ ...p, target: '' })); }}
                  className="px-2.5 py-1 bg-surface border border-outline-variant text-[12px] font-bold text-on-surface-variant hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all"
                >
                  {symbol}{(amt).toLocaleString()}
                </button>
              ))}
            </div>

            {/* Source Place */}
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
            {/* Fund / Withdraw Amount */}
            <div className="flex flex-col items-center justify-center py-2">
              <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
                {mode === 'fund' ? 'Deposit Amount' : 'Withdrawal Amount'}
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

              {/* Quick amount chips */}
              {mode !== 'withdraw' && (
                <div className="flex items-center gap-1.5 flex-wrap mt-3 justify-center">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setAmount(String(amt));
                        setErrors((prev) => ({ ...prev, amount: '' }));
                      }}
                      className="px-3 py-1.5 bg-surface border border-outline-variant text-[12px] font-bold text-on-surface-variant hover:bg-primary/10 hover:border-primary/30 hover:text-primary rounded-lg transition-all"
                    >
                      +{symbol}{(amt).toLocaleString()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Account Selection */}
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

            {/* Goal info card */}
            {goal && (
              <div className="p-3.5 bg-surface-container/60 rounded-xl border border-outline-variant">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">savings</span>
                  <div className="flex-1">
                    <span className="font-bold text-[14px] text-on-surface block">{goal.name}</span>
                    <span className="text-[12px] text-on-surface-variant">
                      Current: {format(goal.current)} · Target: {format(goal.target)}
                    </span>
                  </div>
                  {goal.target > 0 && (
                    <span className="text-[13px] font-bold text-primary">
                      {Math.round((goal.current / goal.target) * 100)}%
                    </span>
                  )}
                </div>
                {goal.target > 0 && (
                  <div className="w-full h-1.5 bg-surface-variant rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.round((goal.current / goal.target) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {mode === 'edit' && goal && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(goal.id);
                onClose();
              }}
              className="px-4 py-3 rounded-xl border border-error text-error hover:bg-error-container/20 font-bold text-[14px] transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {mode === 'create' ? 'add' : mode === 'edit' ? 'check' : mode === 'fund' ? 'add_circle' : 'remove_circle'}
            </span>
            <span>
              {mode === 'create' ? 'Create Goal' : mode === 'edit' ? 'Save Changes' : mode === 'fund' ? 'Add Funds' : 'Withdraw Funds'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
