import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { CustomTextarea } from '../ui/CustomTextarea';
import { ChoiceChips } from '../ui/choice-chips';
import { SegmentedControl, MONEY_PLACE_OPTIONS, MONEY_PLACE_LABELS } from '../ui/segmented-control';
import { MemberBadges } from '../ui/member-badges';
import { VariableExpense, MoneyPlace, availableForCharge } from '../../lib/store';
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
  /** Live balance per money place, so an expense cannot overdraft its source. */
  placeBalances?: Record<MoneyPlace, number>;
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
  placeBalances,
}: ExpenseModalProps) {
  const { symbol, currency, format } = useCurrency();
  const { profile } = useAuth();
  const isPro = isProUser(profile);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState(categories[0] || 'Groceries');
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [person, setPerson] = useState('Me');
  const [payerMemberId, setPayerMemberId] = useState('self');
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
      setPerson(initialExpense.person || 'Me');
      setPayerMemberId(initialExpense.payerMemberId || initialExpense.person || 'self');
      setReceiptUrl(initialExpense.receiptUrl);
    } else {
      setName('');
      setAmount('');
      setType(categories[0] || 'Groceries');
      setPlace('bank');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
      setPerson('Me');
      setPayerMemberId('self');
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

  // Cash the selected source actually has for this charge: editing an expense
  // that stays in the same place refunds its old amount first.
  const availableInPlace = availableForCharge(placeBalances, place, initialExpense);

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

    // The source place must actually hold the money being spent. Half-a-cent
    // tolerance absorbs float noise from prior refund/debit arithmetic.
    if (parsedAmount - availableInPlace > 0.005) {
      setErrors({
        amount: `Only ${format(availableInPlace)} available in ${
          MONEY_PLACE_LABELS[place] ?? place
        }. Lower the amount or move money into this place first.`,
      });
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
      payerMemberId,
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
            className={`flex items-center gap-2 w-full h-12 pl-4 pr-2 bg-surface-container-lowest border rounded-xl transition-all duration-200 hover:border-outline hover:bg-surface-container-low focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${
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
        <ChoiceChips
          label="Category"
          value={type}
          onChange={setType}
          options={categories.map((cat) => ({
            value: cat,
            label: cat,
            icon: categoryIcons[cat] || 'category',
            color: categoryColors[cat],
          }))}
        />

        {/* ── Paid From — segmented group with sliding active background ── */}
        <SegmentedControl
          label="Paid From"
          value={place}
          onChange={(v) => {
            setPlace(v as MoneyPlace);
            setErrors((prev) => ({ ...prev, amount: '' }));
          }}
          options={MONEY_PLACE_OPTIONS}
        />
        <p className="-mt-3 text-[11px] font-semibold text-on-surface-variant">
          Available in {MONEY_PLACE_LABELS[place] ?? place}:{' '}
          <span className="font-mono font-bold text-on-surface">{format(availableInPlace)}</span>
        </p>

        {/* ── Household Member — badges ── */}
        {isPro ? (
          <MemberBadges value={payerMemberId} onChange={(id, label) => { setPayerMemberId(id); setPerson(label); }} />
        ) : (
          <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container">
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
            <div className="p-3 rounded-xl border border-dashed border-outline-variant bg-surface-container text-center">
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
