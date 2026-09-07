import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { CustomTextarea } from '../ui/CustomTextarea';
import { SegmentedControl } from '../ui/segmented-control';
import { DebtItem, DebtType } from '../../lib/store';
import { BigAmountInput } from '../ui/amount-input';
import { parseAmountInput } from '../../lib/parse-amount';
import { useLanguage } from '../../lib/i18n-context';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: DebtItem) => void;
  onDelete?: (debtId: string) => void;
  initialDebt?: DebtItem | null;
  /** Type preselected when adding a new item ('debt' by default). */
  defaultType?: DebtType;
}

export function DebtModal({ isOpen, onClose, onSave, onDelete, initialDebt, defaultType = 'debt' }: DebtModalProps) {
  const { messages: m } = useLanguage();
  const d = m.modals.debt;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DebtType>(defaultType);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialDebt) {
      setName(initialDebt.name);
      setAmount(String(initialDebt.amount));
      setType(initialDebt.type);
      setDate(initialDebt.date || new Date().toISOString().split('T')[0]);
      setNote(initialDebt.note || '');
    } else {
      setName('');
      setAmount('');
      setType(defaultType);
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
    }
    setErrors({});
  }, [initialDebt, isOpen, defaultType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseAmountInput(amount);

    if (!name.trim()) {
      setErrors({ name: m.errors.validationNameRequired });
      return;
    }
    const paidTotal = (initialDebt?.payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount < paidTotal) {
      setErrors({ amount: m.errors.validationAmountInvalid });
      return;
    }

    const debt: DebtItem = {
      id: initialDebt ? initialDebt.id : crypto.randomUUID(),
      name: name.trim(),
      amount: parsedAmount,
      type,
      status: paidTotal > 0
        ? (parsedAmount <= paidTotal ? 'settled' : 'open')
        : initialDebt?.status || 'open',
      date,
      dueDate: initialDebt?.dueDate,
      payments: initialDebt?.payments || [],
      note: note.trim() || undefined,
    };

    onSave(debt);
    onClose();
  };

  const addLabel = type === 'credit' ? d.addCredit : d.addTitle;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialDebt ? d.editTitle : addLabel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Amount ─ decimal number pad; letter currency code after, smaller */}
        <div className="flex flex-col items-center justify-center py-2">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            {d.amount}
          </label>
          <BigAmountInput
            autoFocus
            value={amount}
            onChange={(next) => {
              setAmount(next);
              setErrors((prev) => ({ ...prev, amount: '' }));
            }}
            placeholder="0.00"
            aria-label={d.amount}
          />
          {errors.amount && (
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.amount}</p>
          )}
        </div>

        {/* ── Type — segmented with sliding active background ── */}
        <SegmentedControl
          ariaLabel={initialDebt ? d.editTitle : addLabel}
          value={type}
          onChange={(v) => setType(v as DebtType)}
          options={[
            { value: 'debt', label: d.iOwe, icon: 'arrow_upward' },
            { value: 'credit', label: d.owedToMe, icon: 'arrow_downward' },
          ]}
        />

        {/* ── Person / Entity ── */}
        <CustomInput
          label={d.personEntity}
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: '' }));
          }}
          placeholder={d.personPlaceholder}
          error={errors.name}
        />

        {initialDebt?.payments?.length ? (
          <p className="rounded-xl bg-surface-container p-3 text-xs text-on-surface-variant">
            {d.statusManagedByPayments}
          </p>
        ) : null}

        {/* ── Date ── */}
        <CustomInput
          label={d.dateLabel}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {/* ── Note ── */}
        <CustomTextarea
          label={d.noteOptional}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={d.notePlaceholder}
          rows={2}
        />

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2 border-t border-surface-variant">
          {initialDebt && onDelete && (
            <button
              type="button"
              onClick={() => {
                onDelete(initialDebt.id);
                onClose();
              }}
              className="px-4 py-3 rounded-xl border border-error text-error hover:bg-error-container/20 font-bold text-[14px] transition-colors"
            >
              {m.common.delete}
            </button>
          )}
          <button
            type="submit"
            className="flex-1 bg-primary text-on-primary font-bold text-[15px] py-3 rounded-xl hover:bg-accent-foreground transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
          >
            <AppIcon name={initialDebt ? 'check' : 'add'} className=" text-[18px]" />
            <span>{initialDebt ? d.saveChanges : addLabel}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
