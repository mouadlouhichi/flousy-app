'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';
import { TOOL_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { subscribeMyHouseholdInvoices, withdrawHouseholdInvoice } from '@/lib/db';
import type { HouseholdInvoice } from '@/lib/household';

/**
 * A restricted member's own submission queue.
 *
 * Contributors could submit receipts but never see what happened to them: the
 * rules have always allowed reading your own invoices (`submitterId ==
 * request.auth.uid`), but the only subscriber was the reviewer panel, which is
 * gated on edit rights. This closes that loop — status, and withdrawal while
 * the submission is still pending — without exposing anyone else's receipts.
 */
export function MyInvoiceSubmissions() {
  const { user } = useAuth();
  const { household, areaLevel, workspace } = useHousehold();
  const { messages: m, intlLocale } = useLanguage();
  const copy = m.household.invoice;
  const [invoices, setInvoices] = useState<HouseholdInvoice[]>([]);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const householdId = household?.id;
  const uid = user?.uid;
  // Same audience as the submission form: restricted members only. Reviewers
  // already see every submission, including their own, in the review panel.
  const isSubmitter = workspace === 'household'
    && areaLevel(TOOL_AREA.invoices) === 'editOwn';

  useEffect(() => {
    if (!isSubmitter || !householdId || !uid) {
      setInvoices([]);
      return;
    }
    return subscribeMyHouseholdInvoices(householdId, uid, setInvoices);
  }, [isSubmitter, householdId, uid]);

  if (!isSubmitter || !householdId || invoices.length === 0) return null;

  const statusLabel = (status: HouseholdInvoice['status']) => {
    if (status === 'approved') return copy.statusApproved;
    if (status === 'rejected') return copy.statusRejected;
    return copy.statusSubmitted;
  };
  const statusClass = (status: HouseholdInvoice['status']) => {
    if (status === 'approved') return 'bg-tertiary-container text-on-tertiary-container';
    if (status === 'rejected') return 'bg-error-container text-on-error-container';
    return 'bg-secondary-container text-on-secondary-container';
  };

  const withdraw = async (invoiceId: string) => {
    setBusyId(invoiceId);
    setNotice('');
    try {
      await withdrawHouseholdInvoice(householdId, invoiceId);
    } catch {
      setNotice(copy.withdrawFailed);
    } finally {
      setBusyId(null);
    }
  };

  const sorted = [...invoices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
      <h2 className="font-bold text-on-surface">{copy.mineTitle}</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((invoice) => (
          <li
            key={invoice.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-on-surface">{invoice.name}</p>
              <p className="text-xs text-on-surface-variant">
                {invoice.date} · {invoice.category}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-bold text-on-surface" dir="ltr">
                {new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2 }).format(invoice.amount)}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(invoice.status)}`}>
                {statusLabel(invoice.status)}
              </span>
              {invoice.status === 'submitted' && (
                <button
                  type="button"
                  onClick={() => withdraw(invoice.id)}
                  disabled={busyId === invoice.id}
                  aria-label={copy.withdraw}
                  className="flex items-center gap-1 rounded-full border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface-variant disabled:opacity-50"
                >
                  <AppIcon name="undo" className="text-[14px]" />
                  {copy.withdraw}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {notice && (
        <p role="status" className="text-sm text-error">
          {notice}
        </p>
      )}
    </section>
  );
}
