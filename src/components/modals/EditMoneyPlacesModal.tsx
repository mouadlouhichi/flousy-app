import { AppIcon } from '@/components/ui/app-icon';
import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCurrency } from '../../lib/currency-context';

interface EditMoneyPlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: { bank: number; home: number; wallet: number }) => void;
  initialValues: { bank: number; home: number; wallet: number };
}

const MONEY_PLACE_LABELS = {
  bank: 'Bank',
  home: 'Home Cash',
  wallet: 'Wallet',
} as const;

export function EditMoneyPlacesModal({ isOpen, onClose, onSave, initialValues }: EditMoneyPlacesModalProps) {
  const { symbol } = useCurrency();
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
    }
  }, [isOpen, initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      bank: Number(values.bank) || 0,
      home: Number(values.home) || 0,
      wallet: Number(values.wallet) || 0,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Money Balances">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {(['bank', 'home', 'wallet'] as Array<keyof typeof MONEY_PLACE_LABELS>).map((key) => (
          <div key={key} className="rounded-2xl border border-outline-variant bg-surface-container/50 p-3">
            <label className="mb-2 block text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              {MONEY_PLACE_LABELS[key]}
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface px-3 py-2">
              <span className="text-[18px] font-bold text-primary">{symbol}</span>
              <input
                type="number"
                min="0"
                step="100"
                value={values[key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                className="w-full bg-transparent text-[18px] font-semibold text-on-surface outline-none"
              />
            </div>
          </div>
        ))}

        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary"
        >
          <AppIcon name="check" className="text-[18px]" />
          <span>Save Balances</span>
        </button>
      </form>
    </Modal>
  );
}
