import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { CustomTextarea } from '../ui/CustomTextarea';
import { VariableExpense, MoneyPlace } from '../../lib/store';
import { expenseSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';
import { isProUser } from '../../lib/pro-features';
import { useAuth } from '../../lib/auth-context';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: VariableExpense) => void;
  onDelete?: (expense: VariableExpense) => void;
  initialExpense?: VariableExpense | null;
  categories: string[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, string>;
}

const PAID_FROM_OPTIONS: Array<{ value: MoneyPlace; label: string; icon: string }> = [
  { value: 'bank', label: 'Bank', icon: 'account_balance' },
  { value: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
  { value: 'home', label: 'Home', icon: 'home' },
];

const HOUSEHOLD_MEMBERS: Array<{ value: string; label: string }> = [
  { value: 'Self', label: 'Self' },
  { value: 'Partner', label: 'Partner' },
  { value: 'Family', label: 'Family' },
  { value: 'Queen', label: 'Queen' },
  { value: 'King', label: 'King' },
];

export function ExpenseModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialExpense,
  categories,
  categoryColors = {},
  categoryIcons = {},
}: ExpenseModalProps) {
  const { symbol, currency } = useCurrency();
  const { profile } = useAuth();
  const isPro = isProUser(profile);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(categories[0] || 'Groceries');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [person, setPerson] = useState('Self');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categoryRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialExpense) {
      setName(initialExpense.name);
      setAmount(String(initialExpense.amount));
      setType(initialExpense.type);
      setPlace(initialExpense.place || 'bank');
      setDate(initialExpense.date || new Date().toISOString().split('T')[0]);
      setNote(initialExpense.note || '');
      setPerson(initialExpense.person || 'Self');
      setReceiptUrl(initialExpense.receiptUrl);
    } else {
      setName('');
      setAmount('');
      setType(categories[0] || 'Groceries');
      setPlace('bank');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setPerson('Self');
      setReceiptUrl(undefined);
    }
    setErrors({});
  }, [initialExpense, isOpen, categories]);

  // Keep the selected category chip visible inside the scrollable row.
  useEffect(() => {
    if (!isOpen || !categoryRowRef.current) return;
    const activeChip = categoryRowRef.current.querySelector<HTMLElement>('[data-active="true"]');
    activeChip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [isOpen, type]);

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setReceiptUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    const validationResult = expenseSchema.safeParse({
      name: name || type,
      amount: parsedAmount,
      type,
      date,
      place,
      note,
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

    const newExpense: VariableExpense = {
      id: initialExpense ? initialExpense.id : Math.random().toString(36).substring(2, 9),
      name: name.trim() || type,
      amount: parsedAmount,
      type,
      date,
      place,
      note: note.trim() || undefined,
      person,
      receiptUrl,
    };

    onSave(newExpense);
    onClose();
  };

  const activeCategoryColor = categoryColors[type] || 'var(--primary)';
  const activeCategoryIcon = categoryIcons[type] || 'category';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialExpense ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Description / Merchant (with live category icon) ── */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="expense-name"
            className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
          >
            Description / Merchant
          </label>
          <div
            className={`flex items-center gap-2 w-full h-12 pl-4 pr-2 bg-surface border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
              errors.name ? 'border-error focus-within:border-error focus-within:ring-error/20' : 'border-outline-variant'
            }`}
          >
            <input
              id="expense-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setErrors((prev) => ({ ...prev, name: '' }));
              }}
              placeholder={`e.g. Supermarket, Coffee, ${type}`}
              className="flex-1 min-w-0 bg-transparent border-none p-0 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:ring-0 focus:outline-none"
            />
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-200"
              style={{ backgroundColor: `color-mix(in srgb, ${activeCategoryColor} 12%, transparent)` }}
              aria-hidden="true"
            >
              <AppIcon name={activeCategoryIcon} className="text-[20px]" style={{ color: activeCategoryColor }} />
            </span>
          </div>
          {errors.name && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.name}</p>
          )}
        </div>

        {/* ── Amount Input ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Amount
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

        {/* ── Category — pill chips (color-coded per design system) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Category
          </label>
          <div
            ref={categoryRowRef}
            role="group"
            aria-label="Category"
            className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5"
          >
            {categories.map((cat) => {
              const isActive = type === cat;
              const color = categoryColors[cat] || 'var(--primary)';
              return (
                <button
                  key={cat}
                  type="button"
                  data-active={isActive}
                  aria-pressed={isActive}
                  onClick={() => setType(cat)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.96] ${
                    isActive
                      ? 'border-transparent'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'
                  }`}
                  style={
                    isActive
                      ? {
                          backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                          borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
                          color,
                        }
                      : undefined
                  }
                >
                  <AppIcon
                    name={categoryIcons[cat] || 'category'}
                    className="text-[16px]"
                    style={isActive ? { color } : undefined}
                  />
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Paid From — segmented group with sliding active background ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Paid From
          </label>
          <div
            role="radiogroup"
            aria-label="Paid From"
            className="flex w-full items-center gap-1 rounded-full border border-outline-variant/70 bg-surface-container-high/60 p-1"
          >
            {PAID_FROM_OPTIONS.map(({ value, label, icon }) => {
              const isActive = place === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setPlace(value)}
                  className={`relative flex-1 rounded-full px-2 py-2.5 transition-colors duration-200 ${
                    isActive ? '' : 'hover:bg-surface-variant/40 active:scale-[0.97]'
                  }`}
                >
                  {/* Sliding active background — glides horizontally from the
                      current segment to the tapped one. */}
                  {isActive && (
                    <motion.span
                      layoutId="expense-paid-from-active-bg"
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    <AppIcon
                      name={icon}
                      className={`text-[17px] transition-colors duration-200 ${
                        isActive ? 'text-on-primary' : 'text-outline'
                      }`}
                    />
                    <span
                      className={`text-[12px] font-semibold transition-colors duration-200 ${
                        isActive ? 'text-on-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Household Member — badges ── */}
        {isPro ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Household Member
            </label>
            <div role="group" aria-label="Household Member" className="flex flex-wrap gap-2 py-0.5">
              {HOUSEHOLD_MEMBERS.map(({ value, label }) => {
                const isActive = person === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPerson(value)}
                    className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[12px] font-semibold transition-all duration-200 active:scale-[0.96] ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'border border-outline-variant text-on-surface hover:bg-surface-variant/40'
                    }`}
                  >
                    {isActive ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-on-primary/20">
                        <AppIcon name="check" className="text-[13px]" />
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-extrabold text-on-surface-variant">
                        {label.charAt(0)}
                      </span>
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container/50">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Household member tracking is available in Pro.</p>
          </div>
        )}

        {/* ── Date ── */}
        <CustomInput
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* ── Note ── */}
        <CustomTextarea
          label="Note (Optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What was this for?"
          rows={2}
        />

        {/* ── Receipt Attachment ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Receipt / Attachment
          </label>
          {isPro ? (
            receiptUrl ? (
              <div className="p-2 bg-surface-container rounded-xl border border-outline-variant flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={receiptUrl} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg" />
                  <span className="font-body-sm text-body-sm text-on-surface font-bold">Receipt Attached</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptUrl(undefined)}
                  className="p-1.5 text-error hover:bg-error-container/20 rounded-lg"
                  aria-label="Remove receipt"
                >
                  <AppIcon name="close" className=" text-[18px]" />
                </button>
              </div>
            ) : (
              <label className="p-3 bg-surface border border-dashed border-outline-variant rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-variant/30 transition-colors">
                <AppIcon name="add_a_photo" className=" text-primary text-[20px]" />
                <span className="font-label-md text-label-md text-on-surface-variant font-medium">Upload Receipt Photo</span>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
              </label>
            )
          ) : (
            <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container/50 text-center">
              <p className="font-body-sm text-body-sm text-on-surface-variant">Receipt attachments are available in Pro.</p>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {initialExpense && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialExpense);
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
            <AppIcon name={initialExpense ? 'check' : 'add'} className=" text-[18px]" />
            <span>{initialExpense ? 'Save Changes' : 'Add Expense'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
