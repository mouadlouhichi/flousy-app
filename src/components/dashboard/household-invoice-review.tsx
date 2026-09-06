'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useHousehold } from '@/lib/household-context';
import { TOOL_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName } from '@/lib/localized-labels';
import { approveHouseholdInvoice, reviewHouseholdInvoice, subscribeHouseholdInvoices } from '@/lib/db';
import { getCurrentMonthKey } from '@/lib/utils';
import type { HouseholdInvoice } from '@/lib/household';

function dateInLocalTime(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Owner/editor review queue. Approval and expense posting are one transaction. */
export function HouseholdInvoiceReview() {
  const { household, canEditArea, members, workspace } = useHousehold();
  const { user } = useAuth();
  const { format } = useCurrency();
  const { messages: m } = useLanguage();
  const copy = m.household.invoice;
  // Reviewing household submissions only makes sense inside the household
  // workspace; the personal workspace never shows this queue even though the
  // household document stays subscribed in the background.
  const canReview = workspace === 'household' && household?.kind !== 'business' && canEditArea(TOOL_AREA.invoices);
  const [invoices, setInvoices] = useState<HouseholdInvoice[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => (canReview && household?.id ? subscribeHouseholdInvoices(household.id, setInvoices) : undefined),
    [canReview, household?.id],
  );

  if (!canReview || !household?.id) return null;
  const householdId = household.id;
  const pending = invoices.filter((invoice) => invoice.status === 'submitted');

  const decide = async (invoice: HouseholdInvoice, decision: 'approved' | 'rejected') => {
    setBusyId(invoice.id);
    setError(null);
    try {
      const actorId = user?.uid;
      if (!actorId) throw new Error('Reviewer identity unavailable.');
      if (decision === 'rejected') {
        await reviewHouseholdInvoice(householdId, invoice.id, 'rejected', actorId);
      } else {
        const targetMonth = getCurrentMonthKey(household.monthStartDate, dateInLocalTime(invoice.date));
        await approveHouseholdInvoice(householdId, invoice.id, targetMonth, actorId, {
          currency: household.currency,
          monthStartDate: household.monthStartDate,
          defaultCategoryBudgets: household.defaultCategoryBudgets,
          enableRollover: household.enableRollover,
        });
      }
    } catch (reason) {
      console.error('Invoice review failed:', reason);
      setError(copy.reviewError);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div>
        <h2 className="font-bold text-on-surface">{copy.reviewTitle}</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{copy.reviewDescription}</p>
      </div>
      {error && <p role="alert" className="text-xs font-bold text-error">{error}</p>}
      {pending.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{copy.nonePending}</p>
      ) : (
        <div className="space-y-2">
          {pending.map((invoice) => {
            const targetMonth = getCurrentMonthKey(household.monthStartDate, dateInLocalTime(invoice.date));
            return (
              <div key={invoice.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-on-surface">{invoice.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {members.find((member) => member.userId === invoice.submitterId)?.displayName || m.household.member}
                    {' · '}
                    {localizeCategoryName(invoice.category, m)}
                    {' · '}
                    <span dir="auto" className="tabular-nums">{format(invoice.amount)}</span>
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-primary">
                    {copy.postsToMonth.replace('{month}', targetMonth)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === invoice.id}
                  onClick={() => { void decide(invoice, 'approved'); }}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50"
                >
                  {copy.approve}
                </button>
                <button
                  type="button"
                  disabled={busyId === invoice.id}
                  onClick={() => { void decide(invoice, 'rejected'); }}
                  className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface disabled:opacity-50"
                >
                  {copy.reject}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
