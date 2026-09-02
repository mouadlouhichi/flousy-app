'use client';

import React, { useMemo, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CustomSelect } from '@/components/ui/CustomSelect';
import type { DebtItem, DebtPayment, MonthBudget, MoneyPlace } from '@/lib/store';
import { debtOutstanding } from '@/lib/store';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { localizeDebtStatus } from '@/lib/localized-labels';
import { formatShortDate } from '@/lib/utils';
import { useMoneyPlaces } from '@/lib/use-money-places';

interface DebtsTabProps {
  month: MonthBudget;
  canEdit: boolean;
  onOpenDebtModal: () => void;
  onEditDebt: (debt: DebtItem) => void;
  onRecordPayment: (debtId: string, payment: DebtPayment) => void;
  onDeletePayment: (debtId: string, paymentId: string) => void;
}

type TabKey = 'debts' | 'credits';

function defaultPaymentDate(month: MonthBudget): string {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (month.periodStartDate && today < month.periodStartDate) return month.periodStartDate;
  if (month.periodEndDate && today > month.periodEndDate) return month.periodEndDate;
  return today;
}

export function DebtsTab({
  month,
  canEdit,
  onOpenDebtModal,
  onEditDebt,
  onRecordPayment,
  onDeletePayment,
}: DebtsTabProps) {
  const { format, formatParts } = useCurrency();
  const { messages: m, t, intlLocale } = useLanguage();
  const { places, label: placeLabel } = useMoneyPlaces();
  const [activeTab, setActiveTab] = useState<TabKey>('debts');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => defaultPaymentDate(month));
  const [place, setPlace] = useState<MoneyPlace>('bank');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ debtId: string; paymentId: string } | null>(null);

  const filtered = useMemo(
    () => (month.debts || []).filter((debt) => debt.type === (activeTab === 'debts' ? 'debt' : 'credit')),
    [activeTab, month.debts],
  );
  const openCount = filtered.filter((debt) => debt.status === 'open').length;
  const settledCount = filtered.filter((debt) => debt.status === 'settled').length;
  const totalAmount = filtered.reduce((sum, debt) => sum + debtOutstanding(debt), 0);
  const totalParts = formatParts(totalAmount);

  const label = activeTab === 'debts' ? m.tabs.debts.totalYouOwe : m.tabs.debts.totalOwedToYou;
  const emptyTitle = activeTab === 'debts' ? m.tabs.debts.noDebtsTitle : m.tabs.debts.noCreditsTitle;
  const emptyDesc = activeTab === 'debts' ? m.tabs.debts.noDebtsDesc : m.tabs.debts.noCreditsDesc;

  const openPayment = (debt: DebtItem) => {
    setExpandedId((current) => current === debt.id ? null : debt.id);
    setAmount('');
    setDate(defaultPaymentDate(month));
    setPlace('bank');
    setNote('');
    setError(null);
  };

  const submitPayment = (debt: DebtItem) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > debtOutstanding(debt)) {
      setError(m.tabs.debts.invalidPayment);
      return;
    }
    try {
      onRecordPayment(debt.id, {
        id: crypto.randomUUID(),
        amount: value,
        date,
        place,
        note: note.trim() || undefined,
      });
      setAmount('');
      setNote('');
      setError(null);
    } catch {
      setError(m.tabs.debts.paymentFailed);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex rounded-2xl bg-surface-variant/40 p-1">
        <button type="button" onClick={() => setActiveTab('debts')} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${activeTab === 'debts' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
          {m.tabs.debts.debtsIOwe}
        </button>
        <button type="button" onClick={() => setActiveTab('credits')} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${activeTab === 'credits' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
          {m.tabs.debts.creditsOwedToMe}
        </button>
      </div>

      <div className="flex flex-col gap-4 rounded-3xl border border-outline-variant/80 bg-surface-container p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-on-surface-variant">{label}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[44px] font-extrabold leading-none text-on-surface">{totalParts.amount}</span>
            <span className="text-[20px] font-extrabold leading-none text-on-surface-variant/60">{totalParts.currency}</span>
          </div>
          <span className="mt-1.5 block text-[13px] text-on-surface-variant">
            {t(m.tabs.debts.openSettled, { open: new Intl.NumberFormat(intlLocale).format(openCount), settled: new Intl.NumberFormat(intlLocale).format(settledCount) })}
          </span>
        </div>
        {canEdit && (
          <button type="button" onClick={onOpenDebtModal} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-sm sm:w-auto sm:self-start">
            <AppIcon name="add" className="text-[18px]" />{m.common.add}
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((debt) => {
            const outstanding = debtOutstanding(debt);
            const paid = Math.max(0, debt.amount - outstanding);
            const expanded = expandedId === debt.id;
            return (
              <article key={debt.id} className="rounded-2xl border border-outline-variant/80 bg-surface-container p-4 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={() => openPayment(debt)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-3 text-start">
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${debt.status === 'settled' ? 'bg-surface-container text-on-surface-variant/60' : 'bg-primary/10 text-primary'}`}>
                      <AppIcon name={debt.status === 'settled' ? 'check_circle' : 'account_balance'} className="text-[20px]" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-bold text-on-surface">{debt.name}</span>
                      <span className="text-[12px] text-on-surface-variant">{formatShortDate(debt.date, intlLocale)} · {t(m.tabs.debts.paidOfTotal, { paid: format(paid), total: format(debt.amount) })}</span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`font-mono text-[16px] font-extrabold ${debt.status === 'settled' ? 'text-on-surface-variant/60 line-through' : 'text-on-surface'}`}>{format(outstanding)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${debt.status === 'settled' ? 'bg-surface-container text-on-surface-variant' : 'bg-amber-50 text-amber-700'}`}>{localizeDebtStatus(debt.status, m)}</span>
                    </div>
                    {canEdit && <button type="button" onClick={() => onEditDebt(debt)} aria-label={m.common.edit} className="rounded-full p-2 text-on-surface-variant hover:bg-surface-variant"><AppIcon name="edit" className="text-[18px]" /></button>}
                  </div>
                </div>

                {expanded && (
                  <div className="mt-4 border-t border-outline-variant pt-4">
                    <h3 className="text-sm font-bold text-on-surface">{m.tabs.debts.paymentHistory}</h3>
                    {(debt.payments || []).length === 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">{m.tabs.debts.noPayments}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {(debt.payments || []).map((payment) => (
                          <li key={payment.id} className="flex items-center justify-between rounded-xl bg-surface p-2.5 text-sm">
                            <span><strong>{format(payment.amount)}</strong><span className="ms-2 text-xs text-on-surface-variant">{formatShortDate(payment.date, intlLocale)} · {placeLabel(payment.place)}</span></span>
                            {canEdit && <button type="button" onClick={() => setDeleteTarget({ debtId: debt.id, paymentId: payment.id })} aria-label={m.common.delete} className="rounded-full p-1.5 text-error hover:bg-error/10"><AppIcon name="delete" className="text-[17px]" /></button>}
                          </li>
                        ))}
                      </ul>
                    )}

                    {canEdit && debt.status === 'open' && (
                      <div className="mt-4 grid gap-2 rounded-xl bg-surface p-3 sm:grid-cols-2">
                        <label className="text-xs font-bold text-on-surface-variant">{m.tabs.debts.paymentAmount}
                          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" dir="ltr" className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container p-2.5 text-on-surface" />
                        </label>
                        <label className="text-xs font-bold text-on-surface-variant">{m.common.date}
                          <input type="date" value={date} min={month.periodStartDate} max={month.periodEndDate} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container p-2.5 text-on-surface" />
                        </label>
                        <CustomSelect label={m.tabs.debts.paidFrom} value={place} onChange={(value) => setPlace(value as MoneyPlace)} options={places.map((item) => ({ value: item.id, label: placeLabel(item.id) }))} />
                        <label className="text-xs font-bold text-on-surface-variant">{m.common.note}
                          <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container p-2.5 text-on-surface" />
                        </label>
                        {error && <p role="alert" className="text-xs font-bold text-error sm:col-span-2">{error}</p>}
                        <button type="button" onClick={() => submitPayment(debt)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary sm:col-span-2">
                          {debt.type === 'debt' ? m.tabs.debts.recordPayment : m.tabs.debts.recordReceipt}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-primary/10"><AppIcon name="account_balance" className="text-[40px] text-primary" /></div>
          <h3 className="text-[22px] font-extrabold text-on-surface">{emptyTitle}</h3>
          <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-on-surface-variant">{emptyDesc}</p>
          {canEdit && <button type="button" onClick={onOpenDebtModal} className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary shadow-sm"><AppIcon name="add" className="text-[18px]" />{activeTab === 'debts' ? m.modals.debt.addTitle : m.modals.debt.addCredit}</button>}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) onDeletePayment(deleteTarget.debtId, deleteTarget.paymentId);
          setDeleteTarget(null);
        }}
        title={m.tabs.debts.deletePaymentTitle}
        message={m.tabs.debts.deletePaymentMessage}
        confirmLabel={m.common.delete}
        isDestructive
      />
    </div>
  );
}
