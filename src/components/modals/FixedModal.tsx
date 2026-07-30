import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { ChoiceChips } from '../ui/choice-chips';
import { SegmentedControl, MONEY_PLACE_OPTIONS } from '../ui/segmented-control';
import { MemberBadges } from '../ui/member-badges';
import { DueDayPicker } from '../ui/day-picker';
import { FixedExpense, MoneyPlace } from '../../lib/store';
import { fixedBillSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { useAuth } from '../../lib/auth-context';

interface FixedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: FixedExpense) => void;
  onDelete?: (bill: FixedExpense) => void;
  initialBill?: FixedExpense | null;
  categories: string[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, string>;
}

const FIXED_TYPES = ['Rent', 'Utilities', 'Housing', 'Subscriptions', 'Insurance', 'Internet', 'Gym', 'Other'];

/** Fallback icons/colors used when the month data has none for a bill type. */
const FIXED_TYPE_ICONS: Record<string, string> = {
  Rent: 'home',
  Utilities: 'bolt',
  Housing: 'house',
  Subscriptions: 'subscriptions',
  Insurance: 'shield',
  Internet: 'wifi',
  Gym: 'fitness_center',
  Other: 'label',
};

const FIXED_TYPE_COLORS: Record<string, string> = {
  Rent: '#8b5cf6',
  Utilities: '#eab308',
  Housing: '#f97316',
  Subscriptions: '#6366f1',
  Insurance: '#10b981',
  Internet: '#06b6d4',
  Gym: '#ec4899',
  Other: '#6d7a77',
};

export function FixedModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialBill,
  categories,
  categoryColors = {},
  categoryIcons = {},
}: FixedModalProps) {
  const { symbol, currency } = useCurrency();
  const { profile } = useAuth();
  const isPro = isProUser(profile);
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Amount ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Monthly Charge
            </label>
            <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-on-surface-variant uppercase">
              {currency}
            </span>
          </div>
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
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.amount}</p>
          )}
        </div>

        {/* ── Bill Name ── */}
        <CustomInput
          label="Bill / Subscription Name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder="e.g. Apartment Rent, Electricity, Netflix"
          error={errors.name}
        />

        {/* ── Category — pill chips ── */}
        <ChoiceChips
          label="Category"
          value={type}
          onChange={setType}
          options={FIXED_TYPES.map((c) => ({
            value: c,
            label: c,
            icon: categoryIcons[c] || FIXED_TYPE_ICONS[c],
            color: categoryColors[c] || FIXED_TYPE_COLORS[c],
          }))}
        />

        {/* ── Due Day — day-picker card (solid bg) ── */}
        <DueDayPicker value={date} onChange={setDate} />

        {/* ── Household Member — badges ── */}
        {isPro ? (
          <MemberBadges value={person} onChange={setPerson} />
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Household member tracking is available in Pro.</p>
          </div>
        )}

        {/* ── Paid From — segmented group with sliding active background ── */}
        <SegmentedControl
          label="Paid From"
          value={place}
          onChange={(v) => setPlace(v as MoneyPlace)}
          options={MONEY_PLACE_OPTIONS}
        />

        {/* ── Recurring Toggle ── */}
        <div className="flex items-center justify-between p-3.5 bg-surface-container rounded-xl border border-outline-variant">
          <div className="flex items-center gap-2.5">
            <AppIcon name="event_repeat" className=" text-primary text-[20px]" />
            <div>
              <span className="font-label-md text-label-md font-bold text-on-surface block">
                Repeat Every Month
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Auto-carries bill to future months
              </span>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
          </label>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {initialBill && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialBill);
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
            <AppIcon name={initialBill ? 'check' : 'add'} className=" text-[18px]" />
            <span>{initialBill ? 'Save Changes' : 'Add Fixed Charge'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
