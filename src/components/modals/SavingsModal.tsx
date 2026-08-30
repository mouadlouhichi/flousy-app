import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { SegmentedControl, MONEY_PLACE_OPTIONS } from '../ui/segmented-control';
import { CustomInput } from '../ui/CustomInput';
import { SavingGoal, MoneyPlace } from '../../lib/store';
import { savingGoalSchema, fundGoalSchema, withdrawGoalSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';
import { insufficientFundsMessage, MONEY_PLACE_LABELS } from '../../lib/money-places';

interface SavingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'fund' | 'withdraw' | 'edit';
  goal?: SavingGoal | null;
  /**
   * `deductFromPlace` tells the caller where the goal's opening/edited balance
   * should come from: a money place (bank / home / wallet) moves real cash, or
   * `null` when the money is already parked outside the tracked balances.
   */
  onSaveGoal?: (goal: SavingGoal, deductFromPlace?: MoneyPlace | null) => void;
  onFund?: (goalId: string, amount: number, sourcePlace: MoneyPlace) => void;
  onWithdraw?: (goalId: string, amount: number, targetPlace: MoneyPlace) => void;
  onDelete?: (goalId: string) => void;
  /** Balance of the currently selected place (fund/withdraw flows). */
  availableBalance?: number;
  /** Live balances per money place, used to cap an opening goal balance. */
  placeBalances?: Record<MoneyPlace, number>;
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
  placeBalances,
}: SavingsModalProps) {
  const { symbol, format } = useCurrency();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  // Opening balance: how much is ALREADY saved for this goal.
  const [current, setCurrent] = useState('');
  // Whether that opening balance should be taken out of a tracked money place
  // (it usually isn't — the cash already sits in a jar / separate account).
  const [deductFromPlace, setDeductFromPlace] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (goal && (mode === 'edit' || mode === 'fund' || mode === 'withdraw')) {
      setName(goal.name);
      setTarget(String(goal.target));
      setPlace(goal.source || 'bank');
      setCurrent(goal.current ? String(goal.current) : '');
    } else {
      setName('');
      setTarget('');
      setPlace('bank');
      setCurrent('');
    }
    setDeductFromPlace(false);
    setAmount('');
    setErrors({});
  }, [goal, mode, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'create' || mode === 'edit') {
      const parsedTarget = parseFloat(target);
      const parsedCurrent = current.trim() === '' ? 0 : parseFloat(current);
      const valRes = savingGoalSchema.safeParse({
        name,
        target: parsedTarget,
        source: place,
        current: Number.isFinite(parsedCurrent) ? parsedCurrent : NaN,
      });

      if (!valRes.success) {
        const errs: Record<string, string> = {};
        const issues = valRes.error.issues || (valRes.error as any).errors || [];
        issues.forEach((err: any) => {
          if (err.path[0]) errs[String(err.path[0])] = err.message;
        });
        setErrors(errs);
        return;
      }

      if (parsedCurrent > parsedTarget) {
        setErrors({ current: 'Already saved cannot be more than the target amount' });
        return;
      }

      if (deductFromPlace) {
        // Only the *increase* has to be covered by the place's balance.
        const alreadyAllocated = goal ? goal.current : 0;
        const delta = parsedCurrent - alreadyAllocated;
        if (delta > selectedPlaceBalance) {
          setErrors({
            current: `Only ${format(selectedPlaceBalance)} available in ${place}. Uncheck the transfer option to just record the balance.`,
          });
          return;
        }
      }

      const newGoal: SavingGoal = {
        id: goal ? goal.id : Math.random().toString(36).substring(2, 9),
        name: name.trim(),
        target: parsedTarget,
        current: Math.max(0, parsedCurrent),
        source: place,
        active: true,
      };

      if (onSaveGoal) onSaveGoal(newGoal, deductFromPlace ? place : null);
      onClose();
    } else if (mode === 'fund' && goal) {
      const parsedAmount = parseFloat(amount);
      const valRes = fundGoalSchema.safeParse({ amount: parsedAmount, sourcePlace: place });

      if (!valRes.success) {
        setErrors({ amount: 'Please enter a valid positive amount' });
        return;
      }

      // Funding moves real cash: it can never take more than the place holds.
      if (placeBalances) {
        const fundsError = insufficientFundsMessage(parsedAmount, selectedPlaceBalance, place, format);
        if (fundsError) {
          setErrors({ amount: fundsError });
          return;
        }
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

  // Live preview values for the create/edit form
  const parsedCurrentPreview = Math.max(0, parseFloat(current) || 0);
  const parsedTargetPreview = Math.max(0, parseFloat(target) || 0);
  const selectedPlaceBalance = placeBalances ? placeBalances[place] ?? 0 : availableBalance;

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

            {/* Already Saved (opening balance) */}
            <div className="flex flex-col gap-2.5 rounded-2xl border border-outline-variant bg-surface-container p-4">
              <CustomInput
                label={`Already Saved (${symbol})`}
                type="number"
                step="any"
                min="0"
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setErrors((prev) => ({ ...prev, current: '' }));
                }}
                placeholder="0.00"
                error={errors.current}
              />
              <p className="text-[11px] font-medium text-on-surface-variant leading-snug">
                Starting an existing goal? Enter what you have put aside for it so far —
                progress starts from there instead of zero.
              </p>

              {parsedCurrentPreview > 0 && (
                <>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deductFromPlace}
                      onChange={(e) => {
                        setDeductFromPlace(e.target.checked);
                        setErrors((prev) => ({ ...prev, current: '' }));
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)] cursor-pointer"
                    />
                    <span className="text-[12px] font-semibold text-on-surface leading-snug">
                      Move this amount out of my tracked{' '}
                      <span className="capitalize">{place}</span> balance
                      <span className="block text-[11px] font-medium text-on-surface-variant mt-0.5">
                        Leave unchecked if this money is already kept separately and is not part
                        of your bank / home / wallet totals. Available: {format(selectedPlaceBalance)}.
                      </span>
                    </span>
                  </label>

                  {/* Live progress preview */}
                  {parsedTargetPreview > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[11px] font-bold text-on-surface-variant">
                        <span>{format(parsedCurrentPreview)}</span>
                        <span>
                          {Math.min(
                            100,
                            Math.round((parsedCurrentPreview / parsedTargetPreview) * 100),
                          )}
                          % of {format(parsedTargetPreview)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-variant">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((parsedCurrentPreview / parsedTargetPreview) * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Source Place — segmented with sliding background */}
            <SegmentedControl
              label="Primary Source Place"
              value={place}
              onChange={(v) => setPlace(v as MoneyPlace)}
              options={MONEY_PLACE_OPTIONS}
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

            {/* Account Selection — segmented with sliding background */}
            <SegmentedControl
              label={mode === 'fund' ? 'Deduct From Account' : 'Deposit Into Account'}
              value={place}
              onChange={(v) => setPlace(v as MoneyPlace)}
              options={MONEY_PLACE_OPTIONS}
            />

            {/* Funding pulls real cash out of the selected place — show the cap. */}
            {mode === 'fund' && placeBalances && (
              <p className="text-[11px] font-medium text-on-surface-variant -mt-3">
                Available in {MONEY_PLACE_LABELS[place]}: {format(selectedPlaceBalance)}
              </p>
            )}

            {/* Goal info card */}
            {goal && (
              <div className="p-3.5 bg-surface-container rounded-xl border border-outline-variant">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="savings" className=" text-primary text-[20px]" />
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
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <AppIcon name={mode === 'create' ? 'add' : mode === 'edit' ? 'check' : mode === 'fund' ? 'add_circle' : 'remove_circle'} className=" text-[18px]" />
            <span>
              {mode === 'create' ? 'Create Goal' : mode === 'edit' ? 'Save Changes' : mode === 'fund' ? 'Add Funds' : 'Withdraw Funds'}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
