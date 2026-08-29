import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SegmentedControl, MONEY_PLACE_OPTIONS } from '../ui/segmented-control';
import { CustomInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { MoneyPlace, SavingGoal, SavingsActivityEntry } from '../../lib/store';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';

interface SavingsDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The logged deposit / withdrawal being edited. */
  entry?: SavingsActivityEntry | null;
  goals: SavingGoal[];
  /** Live balances per money place, used to cap a deposit correction. */
  placeBalances?: Record<MoneyPlace, number>;
  /** Save the edited values (only the changed fields are required). */
  onSave?: (entryId: string, patch: Partial<SavingsActivityEntry>) => void;
  onDelete?: (entryId: string) => void;
}

const toDateInput = (value?: string): string => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return new Date().toISOString().split('T')[0];
  return parsed.toISOString().split('T')[0];
};

/**
 * Editor for a logged savings deposit / withdrawal.
 *
 * Saving the form rewinds the original money movement and replays the edited
 * one, so the goal balance, the money place and the month's savings plan all
 * stay in sync (see `updateSavingsActivityEntry`).
 */
export function SavingsDepositModal({
  isOpen,
  onClose,
  entry,
  goals,
  placeBalances,
  onSave,
  onDelete,
}: SavingsDepositModalProps) {
  const { symbol, format } = useCurrency();
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [goalId, setGoalId] = useState('');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(toDateInput());
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entry) {
      setType(entry.type === 'withdraw' ? 'withdraw' : 'deposit');
      setAmount(String(entry.amount ?? ''));
      // Fall back to the first goal when the entry's goal was deleted, so the
      // picker always starts from a valid value.
      setGoalId(goals.some((g) => g.id === entry.goalId) ? entry.goalId : goals[0]?.id || '');
      setPlace(entry.place || goals.find((g) => g.id === entry.goalId)?.source || 'bank');
      setDate(toDateInput(entry.date));
    }
    setErrors({});
  }, [entry, isOpen, goals]);

  // Balance that will be available in the goal once the original entry is
  // undone — a withdrawal can never take out more than that.
  const selectedGoal = goals.find((g) => g.id === goalId);
  const availableInGoal =
    (selectedGoal?.current ?? 0) + (entry && entry.type === 'withdraw' ? (entry.amount ?? 0) : 0);

  // Same idea for the money place: undoing the original entry puts its cash
  // back, so that is what a corrected deposit can draw from.
  const availableInPlace =
    (placeBalances?.[place] ?? 0) + (entry && entry.place === place
      ? entry.type === 'deposit'
        ? (entry.amount ?? 0)
        : -(entry.amount ?? 0)
      : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrors({ amount: 'Please enter a valid positive amount' });
      return;
    }
    if (!goalId) {
      setErrors({ goal: 'Please pick a savings goal' });
      return;
    }
    if (type === 'withdraw' && parsedAmount > availableInGoal) {
      setErrors({
        amount: `Cannot withdraw more than the goal balance (${format(availableInGoal)})`,
      });
      return;
    }
    if (
      type === 'deposit' &&
      placeBalances &&
      parsedAmount > availableInPlace
    ) {
      setErrors({
        amount: `Only ${format(availableInPlace)} available in ${
          place === 'home' ? 'Home Cash' : place === 'wallet' ? 'Wallet' : 'Bank'
        }.`,
      });
      return;
    }

    onSave?.(entry.id, {
      amount: parsedAmount,
      type,
      goalId,
      place,
      date: new Date(`${date}T12:00:00`).toISOString(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={type === 'deposit' ? 'Edit Deposit' : 'Edit Withdrawal'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Type */}
        <SegmentedControl
          ariaLabel="Movement type"
          value={type}
          onChange={(v) => setType(v === 'withdraw' ? 'withdraw' : 'deposit')}
          options={[
            { value: 'deposit', label: 'Deposit', icon: 'add_circle' },
            { value: 'withdraw', label: 'Withdrawal', icon: 'remove_circle' },
          ]}
        />

        {/* Amount */}
        <div className="flex flex-col items-center justify-center py-2">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            {type === 'deposit' ? 'Deposit Amount' : 'Withdrawal Amount'}
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
            <p role="alert" className="text-[12px] font-medium text-error mt-1 text-center">
              {errors.amount}
            </p>
          )}
        </div>

        {/* Goal */}
        {goals.length > 0 ? (
          <CustomSelect
            label="Savings Goal"
            value={goalId}
            onChange={(v) => {
              setGoalId(v);
              setErrors((prev) => ({ ...prev, goal: '' }));
            }}
            placeholder="Select a goal"
            options={goals.map((g) => ({ value: g.id, label: g.name }))}
          />
        ) : (
          <CustomInput
            label="Savings Goal"
            type="text"
            value={entry?.goalName || ''}
            onChange={() => undefined}
            error="This goal no longer exists — delete the entry to fix your plan."
          />
        )}
        {errors.goal && (
          <p role="alert" className="text-[12px] font-medium text-error -mt-3">
            {errors.goal}
          </p>
        )}

        {/* Money place */}
        <SegmentedControl
          label={type === 'deposit' ? 'Taken From Account' : 'Returned To Account'}
          value={place}
          onChange={(v) => setPlace(v as MoneyPlace)}
          options={MONEY_PLACE_OPTIONS}
        />

        {/* Date */}
        <CustomInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {selectedGoal && (
          <p className="text-[11px] font-medium text-on-surface-variant leading-snug">
            {selectedGoal.name}: {format(selectedGoal.current)} saved ·{' '}
            {format(availableInGoal)} available once this entry is re-applied.
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {entry && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(entry.id);
                onClose();
              }}
              className="px-4 py-3 rounded-xl border border-error text-error hover:bg-error-container/20 font-bold text-[14px] transition-colors"
            >
              Delete
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <AppIcon name="check" className="text-[18px]" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
