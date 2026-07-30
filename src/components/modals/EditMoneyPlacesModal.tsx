import { AppIcon } from '@/components/ui/app-icon';
import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useCurrency } from '../../lib/currency-context';

interface EditMoneyPlacesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: { bank: number; home: number; wallet: number }) => void;
  initialValues: { bank: number; home: number; wallet: number };
  totalBudget?: number;
}

type MoneyPlaceKey = 'bank' | 'home' | 'wallet';

const MONEY_PLACES: Array<{ key: MoneyPlaceKey; label: string; icon: string }> = [
  { key: 'bank', label: 'Bank', icon: 'account_balance' },
  { key: 'home', label: 'Home Cash', icon: 'home' },
  { key: 'wallet', label: 'Wallet', icon: 'account_balance_wallet' },
];

/** Keeps only digits and a single decimal point while typing. */
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  return rest.length > 0 ? `${intPart}.${rest.join('')}` : intPart;
}

function parseAmount(raw: string): number {
  const parsed = Number.parseFloat(raw.trim());
  return Number.isFinite(parsed) ? Math.max(0, parsed) : NaN;
}

export function EditMoneyPlacesModal({ isOpen, onClose, onSave, initialValues, totalBudget }: EditMoneyPlacesModalProps) {
  const { format, symbol } = useCurrency();
  const [drafts, setDrafts] = useState<Record<MoneyPlaceKey, string>>({
    bank: String(initialValues.bank ?? 0),
    home: String(initialValues.home ?? 0),
    wallet: String(initialValues.wallet ?? 0),
  });
  const [errors, setErrors] = useState<Partial<Record<MoneyPlaceKey, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setDrafts({
        bank: String(initialValues.bank ?? 0),
        home: String(initialValues.home ?? 0),
        wallet: String(initialValues.wallet ?? 0),
      });
      setErrors({});
    }
  }, [isOpen, initialValues]);

  const parsedValues = MONEY_PLACES.map(({ key }) => parseAmount(drafts[key] ?? ''));
  const liveTotal = parsedValues.every((v) => Number.isFinite(v))
    ? parsedValues.reduce((acc, v) => acc + v, 0)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: Partial<Record<MoneyPlaceKey, string>> = {};
    const values: Record<MoneyPlaceKey, number> = { bank: 0, home: 0, wallet: 0 };

    MONEY_PLACES.forEach(({ key }) => {
      const parsed = parseAmount(drafts[key] ?? '');
      if (!Number.isFinite(parsed)) {
        nextErrors[key] = 'Enter a valid amount';
      } else {
        values[key] = parsed;
      }
    });

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave(values);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Money Balances">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Correct your current cash in each place. This adjusts your cash on hand — your monthly budget stays unchanged.
        </p>

        {MONEY_PLACES.map(({ key, label, icon }) => (
          <div key={key} className="rounded-2xl border border-outline-variant bg-surface-container p-3">
            <label
              htmlFor={`money-place-${key}`}
              className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase"
            >
              <AppIcon name={icon} className="text-[14px]" />
              {label}
            </label>
            <div
              className={`flex items-center gap-2 rounded-xl border bg-surface-container-lowest px-3 py-2 transition-colors focus-within:border-primary ${
                errors[key] ? 'border-error' : 'border-outline-variant'
              }`}
            >
              <span className="text-[18px] font-bold text-primary">{symbol}</span>
              <input
                id={`money-place-${key}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={drafts[key]}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  setDrafts((prev) => ({ ...prev, [key]: sanitizeAmount(e.target.value) }));
                  if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
                }}
                className="w-full bg-transparent text-[18px] font-semibold text-on-surface outline-none"
              />
            </div>
            {errors[key] && <p className="mt-1 text-[11px] font-medium text-error">{errors[key]}</p>}
          </div>
        ))}

        {/* Live total summary */}
        <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-col">
            <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
              Total cash on hand
            </span>
            {typeof totalBudget === 'number' && totalBudget > 0 && (
              <span className="text-[11px] font-bold text-on-surface-variant">
                Monthly budget: {format(totalBudget)}
              </span>
            )}
          </div>
          <span className="font-mono text-[18px] font-extrabold text-primary">
            {liveTotal !== null ? format(liveTotal) : '—'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-outline-variant py-3 font-bold text-on-surface-variant transition-colors hover:bg-surface-variant/50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary transition-colors hover:bg-accent-foreground"
          >
            <AppIcon name="check" className="text-[18px]" />
            <span>Save Balances</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
