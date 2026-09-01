import { AppIcon } from '@/components/ui/app-icon';
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { CustomInput } from '../ui/CustomInput';
import { CustomTextarea } from '../ui/CustomTextarea';
import { SegmentedControl } from '../ui/segmented-control';
import { DebtItem, DebtType, DebtStatus } from '../../lib/store';
import { AmountSymbol } from '../ui/amount-symbol';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';

interface DebtModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (debt: DebtItem) => void;
  onDelete?: (debtId: string) => void;
  initialDebt?: DebtItem | null;
}

export function DebtModal({ isOpen, onClose, onSave, onDelete, initialDebt }: DebtModalProps) {
  const { symbol } = useCurrency();
  const { messages: m } = useLanguage();
  const d = m.modals.debt;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<DebtType>('debt');
  const [status, setStatus] = useState<DebtStatus>('open');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialDebt) {
      setName(initialDebt.name);
      setAmount(String(initialDebt.amount));
      setType(initialDebt.type);
      setStatus(initialDebt.status);
      setDate(initialDebt.date || new Date().toISOString().split('T')[0]);
      setNote(initialDebt.note || '');
    } else {
      setName('');
      setAmount('');
      setType('debt');
      setStatus('open');
      setDate(new Date().toISOString().split('T')[0]);
      setNote('');
    }
    setErrors({});
  }, [initialDebt, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);

    if (!name.trim()) {
      setErrors({ name: m.errors.validationNameRequired });
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrors({ amount: m.errors.validationAmountInvalid });
      return;
    }

    const debt: DebtItem = {
      id: initialDebt ? initialDebt.id : Math.random().toString(36).substring(2, 9),
      name: name.trim(),
      amount: parsedAmount,
      type,
      status,
      date,
      note: note.trim() || undefined,
    };

    onSave(debt);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialDebt ? d.editTitle : d.addTitle}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* ── Amount ── */}
        <div className="flex flex-col items-center justify-center py-2">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase mb-1">
            {d.amount}
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
            <p role="alert" className="text-[12px] font-medium text-error mt-1">{errors.amount}</p>
          )}
        </div>

        {/* ── Type — segmented with sliding active background ── */}
        <SegmentedControl
          ariaLabel={d.addTitle}
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

        {/* ── Status ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
            {d.status}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus('open')}
              className={`py-3 rounded-xl border text-[14px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                status === 'open'
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              <AppIcon name="lock_open" className=" text-[16px]" />
              {m.common.open}
            </button>
            <button
              type="button"
              onClick={() => setStatus('settled')}
              className={`py-3 rounded-xl border text-[14px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                status === 'settled'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              <AppIcon name="check_circle" className=" text-[16px]" />
              {m.common.settled}
            </button>
          </div>
        </div>

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
            <span>{initialDebt ? d.saveChanges : d.addTitle}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
