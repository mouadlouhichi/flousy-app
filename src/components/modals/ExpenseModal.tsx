import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomSelect } from '../ui/CustomSelect';
import { VariableExpense, MoneyPlace } from '../../lib/store';
import { expenseSchema } from '../../lib/validation';
import { useCurrency } from '../../lib/currency-context';

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
  const { symbol } = useCurrency();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(categories[0] || 'Groceries');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [person, setPerson] = useState('Self');
  const [receiptUrl, setReceiptUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      name: name || type, // Default to category name if title left blank
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialExpense ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-lg">
        {/* Amount Input */}
        <div className="flex flex-col items-center justify-center py-sm">
          <label className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-sm">
            AMOUNT
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
              className="bg-transparent border-none text-[48px] leading-[1.1] text-center w-full max-w-[220px] text-on-surface focus:ring-0 p-0 placeholder:text-outline-variant font-extrabold outline-none"
            />
          </div>
          {errors.amount && (
            <p role="alert" className="font-label-sm text-label-sm text-error mt-1">
              {errors.amount}
            </p>
          )}
        </div>

        {/* Expense Title / Name */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            DESCRIPTION / MERCHANT
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((prev) => ({ ...prev, name: '' }));
            }}
            placeholder={`e.g. Supermarket, Coffee, ${type}`}
            className="w-full p-md bg-surface border border-outline-variant rounded-xl font-body-lg text-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
          />
          {errors.name && (
            <p role="alert" className="font-label-sm text-label-sm text-error">
              {errors.name}
            </p>
          )}
        </div>

        {/* Category Selection */}
        <CustomSelect
          label="Category"
          value={type}
          onChange={setType}
          options={categories.map((cat) => ({ value: cat, label: cat }))}
        />

        {/* Money Place / Account Radio */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            PAID FROM (MONEY PLACE)
          </label>
          <div className="grid grid-cols-3 gap-sm">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="place"
                value="bank"
                checked={place === 'bank'}
                onChange={() => setPlace('bank')}
                className="sr-only peer"
              />
              <div className="flex flex-col items-center gap-2 p-md rounded-xl border border-outline-variant peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-surface-variant/30 transition-all">
                <span className="material-symbols-outlined text-outline peer-checked:text-primary">
                  account_balance
                </span>
                <span className="font-label-md text-label-md text-on-surface peer-checked:text-primary font-semibold">
                  Bank
                </span>
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name="place"
                value="wallet"
                checked={place === 'wallet'}
                onChange={() => setPlace('wallet')}
                className="sr-only peer"
              />
              <div className="flex flex-col items-center gap-2 p-md rounded-xl border border-outline-variant peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-surface-variant/30 transition-all">
                <span className="material-symbols-outlined text-outline peer-checked:text-primary">
                  account_balance_wallet
                </span>
                <span className="font-label-md text-label-md text-on-surface peer-checked:text-primary font-semibold">
                  Wallet
                </span>
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name="place"
                value="home"
                checked={place === 'home'}
                onChange={() => setPlace('home')}
                className="sr-only peer"
              />
              <div className="flex flex-col items-center gap-2 p-md rounded-xl border border-outline-variant peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-surface-variant/30 transition-all">
                <span className="material-symbols-outlined text-outline peer-checked:text-primary">
                  home
                </span>
                <span className="font-label-md text-label-md text-on-surface peer-checked:text-primary font-semibold">
                  Home
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Person (Household Member) */}
        <CustomSelect
          label="Household Member"
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

        {/* Date */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            DATE
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-md bg-surface border border-outline-variant rounded-xl font-body-lg text-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all outline-none"
          />
        </div>

        {/* Note */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            NOTE (OPTIONAL)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What was this for?"
            rows={2}
            className="w-full p-md bg-surface border border-outline-variant rounded-xl font-body-lg text-body-lg text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none outline-none"
          />
        </div>

        {/* Receipt Attachment */}
        <div className="flex flex-col gap-xs">
          <label className="font-label-sm text-label-sm text-on-surface-variant uppercase">
            RECEIPT / ATTACHMENT (OPTIONAL)
          </label>
          {receiptUrl ? (
            <div className="relative group p-2 bg-surface-container rounded-xl border border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-xs">
                <img src={receiptUrl} alt="Receipt preview" className="w-12 h-12 object-cover rounded-lg" />
                <span className="font-body-sm text-body-sm text-on-surface font-bold">Receipt Attached</span>
              </div>
              <button
                type="button"
                onClick={() => setReceiptUrl(undefined)}
                className="p-1.5 text-error hover:bg-error-container/20 rounded-lg"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <label className="p-md bg-surface border border-dashed border-outline-variant rounded-xl flex items-center justify-center gap-xs cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span className="material-symbols-outlined text-primary text-[20px]">add_a_photo</span>
              <span className="font-label-md text-label-md text-on-surface-variant">Upload Receipt Photo</span>
              <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Submit & Delete Actions */}
        <div className="flex gap-sm sm:gap-md pt-sm sm:pt-md border-t border-surface-variant">
          {initialExpense && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialExpense);
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
            {initialExpense ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
