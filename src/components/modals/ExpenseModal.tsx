import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomSelect } from '../ui/CustomSelect';
import { CustomInput } from '../ui/CustomInput';
import { CustomTextarea } from '../ui/CustomTextarea';
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialExpense ? 'Edit Expense' : 'Add Expense'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Amount Input ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            Amount
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
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.amount}</p>
          )}
        </div>

        {/* ── Description / Merchant ── */}
        <CustomInput
          label="Description / Merchant"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder={`e.g. Supermarket, Coffee, ${type}`}
          error={errors.name}
        />

        {/* ── Category ── */}
        <CustomSelect
          label="Category"
          value={type}
          onChange={setType}
          options={categories.map((cat) => ({ value: cat, label: cat }))}
        />

        {/* ── Money Place ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            Paid From
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['bank', 'wallet', 'home'] as MoneyPlace[]).map((p) => (
              <label key={p} className="cursor-pointer">
                <input
                  type="radio"
                  name="place"
                  value={p}
                  checked={place === p}
                  onChange={() => setPlace(p)}
                  className="sr-only peer"
                />
                <div className="flex flex-col items-center gap-2 p-3 rounded-xl border border-outline-variant peer-checked:border-primary peer-checked:bg-primary/10 hover:bg-surface-variant/30 transition-all">
                  <span className="material-symbols-outlined text-[20px] text-outline peer-checked:text-primary">
                    {p === 'bank' ? 'account_balance' : p === 'wallet' ? 'account_balance_wallet' : 'home'}
                  </span>
                  <span className="font-label-md text-label-md text-on-surface peer-checked:text-primary font-semibold capitalize">
                    {p}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* ── Household Member ── */}
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
          {receiptUrl ? (
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
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          ) : (
            <label className="p-3 bg-surface border border-dashed border-outline-variant rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-surface-variant/30 transition-colors">
              <span className="material-symbols-outlined text-primary text-[20px]">add_a_photo</span>
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">Upload Receipt Photo</span>
              <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
            </label>
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
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-primary/90 transition-all active:scale-[0.98] shadow-sm hover:shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">
              {initialExpense ? 'check' : 'add'}
            </span>
            <span>{initialExpense ? 'Save Changes' : 'Add Expense'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
