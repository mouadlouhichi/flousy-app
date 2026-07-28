import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomSelect } from '../ui/CustomSelect';
import { FixedExpense, MoneyPlace } from '../../lib/store';
import { fixedBillSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

interface FixedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: FixedExpense) => void;
  onDelete?: (bill: FixedExpense) => void;
  initialBill?: FixedExpense | null;
  categories: string[];
}

export function FixedModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialBill,
  categories,
}: FixedModalProps) {
  const { symbol } = useCurrency();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Rent');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState('1st');
  const [person, setPerson] = useState('Self');
  const [recurring, setRecurring] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialBill) {
      setName(initialBill.name);
      setAmount(String(initialBill.amount));
      setType(initialBill.type || 'Rent');
      setPlace(initialBill.place || 'bank');
      setDate(initialBill.date || '1st');
      setPerson(initialBill.person || 'Self');
      setRecurring(initialBill.recurring ?? true);
    } else {
      setName('');
      setAmount('');
      setType('Rent');
      setPlace('bank');
      setDate('1st');
      setPerson('Self');
      setRecurring(true);
    }
    setErrors({});
  }, [initialBill, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    const validationResult = fixedBillSchema.safeParse({
      name,
      amount: parsedAmount,
      type,
      date,
      place,
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

    const newBill: FixedExpense = {
      id: initialBill ? initialBill.id : Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      amount: parsedAmount,
      type,
      date,
      place,
      person,
      recurring,
    };

    onSave(newBill);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialBill ? 'Edit Fixed Bill' : 'Add Fixed Charge'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        {/* Amount */}
        <div className="flex flex-col items-center justify-center py-sm">
          <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
            MONTHLY CHARGE
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
            <p role="alert" className="font-label-sm text-label-sm text-error mt-1">
              {errors.amount}
            </p>
          )}
        </div>

        {/* Bill Name */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            BILL / SUBSCRIPTION NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder="e.g. Apartment Rent, Electricity, Netflix"
            className="w-full p-md bg-surface border border-outline-variant rounded-xl font-body-lg text-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
          />
          {errors.name && (
            <p role="alert" className="font-label-sm text-label-sm text-error">
              {errors.name}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            CATEGORY
          </label>
          <CustomSelect
            value={type}
            onChange={setType}
            options={['Rent', 'Utilities', 'Housing', 'Subscriptions', 'Insurance', 'Internet', 'Gym', 'Other'].map((c) => ({
              value: c,
              label: c,
            }))}
          />
        </div>

        {/* Due Day / Date */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            DUE DAY OF MONTH
          </label>
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="e.g. 1st of month, 15th"
            className="w-full p-md bg-surface border border-outline-variant rounded-xl font-body-lg text-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
          />
        </div>

        {/* Household Member */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            HOUSEHOLD MEMBER
          </label>
          <CustomSelect
            value={person}
            onChange={setPerson}
            options={[
              { value: 'Self', label: 'Self' },
              { value: 'Partner', label: 'Partner / Spouse' },
              { value: 'Family', label: 'Family / Shared' },
              { value: 'Queen', label: 'Queen' },
              { value: 'King', label: 'King' },
            ]}
          />
        </div>

        {/* Account / Place */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            PAID FROM
          </label>
          <div className="grid grid-cols-3 gap-sm">
            {(['bank', 'wallet', 'home'] as MoneyPlace[]).map((p) => (
              <label key={p} className="cursor-pointer">
                <input
                  type="radio"
                  name="fixed-place"
                  value={p}
                  checked={place === p}
                  onChange={() => setPlace(p)}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center gap-2 p-md rounded-xl border border-outline-variant peer-checked:border-primary peer-checked:bg-primary/10 transition-all capitalize font-label-md text-label-md text-on-surface font-semibold">
                  {p}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Recurring Toggle */}
        <div className="flex items-center justify-between p-md bg-surface border border-outline-variant rounded-xl">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">event_repeat</span>
            <div>
              <span className="font-label-md text-label-md font-bold text-on-surface block">
                Repeat Every Month
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Auto-carries bill to future months
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="w-5 h-5 accent-primary cursor-pointer"
          />
        </div>

        {/* Submit / Delete */}
        <div className="flex gap-sm sm:gap-md pt-sm sm:pt-md border-t border-surface-variant">
          {initialBill && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialBill);
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
            {initialBill ? 'Save Changes' : 'Add Fixed Charge'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
