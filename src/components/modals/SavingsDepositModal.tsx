import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SegmentedControl } from '../ui/segmented-control';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { CustomInput } from '../ui/CustomInput';
import { CustomSelect } from '../ui/CustomSelect';
import { MoneyPlace, SavingGoal, SavingsActivityEntry } from '../../lib/store';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';

interface SavingsDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The logged deposit / withdrawal being edited. */
  entry?: SavingsActivityEntry | null;
  goals: SavingGoal[];
  /** Live balances per money place, used to cap a deposit correction. */
  placeBalances?: Record<MoneyPlace, number>;
  /**
   * False when the member may correct a savings entry but not see household
   * balances: skips the deposit check whose message quotes the balance.
   */
  canSeeBalances?: boolean;
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
  canSeeBalances = true,
  onSave,
  onDelete,
}: SavingsDepositModalProps) {
  const { symbol, format } = useCurrency();
  const { messages: m, t } = useLanguage();
  const s = m.modals.savings;
  const { options: moneyPlaceOptions, label: placeLabel, defaultPlace } = useMoneyPlaces();
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      setPlace(entry.place || goals.find((g) => g.id === entry.goalId)?.source || defaultPlace);
      setDate(toDateInput(entry.date));
    }
    setErrors({});
    // Read when the modal opens to seed the form; depending on it would wipe a
    // half-typed entry whenever the place list is re-derived.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setErrors({ amount: s.validPositiveAmount });
      return;
    }
    if (!goalId) {
      setErrors({ goal: s.selectGoalError });
      return;
    }
    if (type === 'withdraw' && parsedAmount > availableInGoal) {
      setErrors({
        amount: t(s.withdrawTooMuch, { amount: format(availableInGoal) }),
      });
      return;
    }
    if (
      type === 'deposit' &&
      placeBalances &&
      canSeeBalances &&
      parsedAmount > availableInPlace
    ) {
      setErrors({
        amount: t(s.availableIn, {
          amount: format(availableInPlace),
          place: placeLabel(place),
        }),
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
      title={type === 'deposit' ? s.editDeposit : s.editWithdrawal}
    >
      <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Type */}
        <SegmentedControl
          ariaLabel={s.movementType}
          value={type}
          onChange={(v) => setType(v === 'withdraw' ? 'withdraw' : 'deposit')}
          options={[
            { value: 'deposit', label: s.deposit, icon: 'add_circle' },
            { value: 'withdraw', label: s.withdrawal, icon: 'remove_circle' },
          ]}
        />

        {/* Amount */}
        <div className="flex flex-col items-center justify-center py-2">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            {type === 'deposit' ? s.fundAmount : s.withdrawAmount}
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
            label={s.savingsGoal}
            value={goalId}
            onChange={(v) => {
              setGoalId(v);
              setErrors((prev) => ({ ...prev, goal: '' }));
            }}
            placeholder={s.selectGoal}
            options={goals.map((g) => ({ value: g.id, label: g.name }))}
          />
        ) : (
          <CustomInput
            label={s.savingsGoal}
            type="text"
            value={entry?.goalName || ''}
            onChange={() => undefined}
            error={s.missingGoal}
          />
        )}
        {errors.goal && (
          <p role="alert" className="text-[12px] font-medium text-error -mt-3">
            {errors.goal}
          </p>
        )}

        {/* Money place */}
        <SegmentedControl
          label={type === 'deposit' ? s.takenFrom : s.returnedTo}
          value={place}
          onChange={(v) => setPlace(v as MoneyPlace)}
          options={moneyPlaceOptions}
        />

        {/* Date */}
        <CustomInput
          label={m.common.date}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {selectedGoal && (
          <p className="text-[11px] font-medium text-on-surface-variant leading-snug">
            {t(s.goalReapply, {
              name: selectedGoal.name,
              saved: format(selectedGoal.current),
              available: format(availableInGoal),
            })}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {entry && onDelete && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-3 rounded-xl border border-error text-error hover:bg-error-container/20 font-bold text-[14px] transition-colors"
            >
              {m.common.delete}
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <AppIcon name="check" className="text-[18px]" />
            <span>{m.common.save}</span>
          </button>
        </div>
      </form>
      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (entry) onDelete?.(entry.id);
          setConfirmDelete(false);
          onClose();
        }}
        title={s.deleteActivityTitle}
        message={s.deleteActivityMessage}
        confirmLabel={m.common.delete}
        isDestructive
      />
      </>
    </Modal>
  );
}
