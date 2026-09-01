'use client';

import { useEffect, useState } from 'react';
import { useCurrency } from '@/lib/currency-context';
import { useHousehold } from '@/lib/household-context';
import { TOOL_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { localizeCategoryName } from '@/lib/localized-labels';
import { saveHouseholdInvoice, subscribeHouseholdInvoices } from '@/lib/db';
import type { HouseholdInvoice } from '@/lib/household';

/** Owner/editor review queue. Approval remains separate from private budget recording. */
export function HouseholdInvoiceReview() {
  const { household, members, canEditArea } = useHousehold();
  const { format } = useCurrency();
  const { messages: m } = useLanguage();
  const copy = m.household.invoice;
  const [invoices, setInvoices] = useState<HouseholdInvoice[]>([]);
  // Approving or rejecting a submission is `editAll` on the invoices area, so a
  // custom role granted only `editOwn` submits but never sees this queue.
  const canReview = canEditArea(TOOL_AREA.invoices);

  useEffect(
    () => (canReview && household?.id ? subscribeHouseholdInvoices(household.id, setInvoices) : undefined),
    [canReview, household?.id],
  );

  if (!canReview || !household?.id) return null;

  const pending = invoices.filter((invoice) => invoice.status === 'submitted');

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4">
      <div>
        <h2 className="font-bold text-on-surface">{copy.reviewTitle}</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{copy.reviewDescription}</p>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-on-surface-variant">{copy.nonePending}</p>
      ) : (
        <div className="space-y-2">
          {pending.map((invoice) => (
            <div key={invoice.id} className="flex items-center gap-3 rounded-xl bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-on-surface">{invoice.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {members.find((member) => member.userId === invoice.submitterId)?.displayName || m.household.member}
                  {' · '}
                  {localizeCategoryName(invoice.category, m)}
                  {' · '}
                  <span dir="auto" className="tabular-nums">{format(invoice.amount)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveHouseholdInvoice(household.id!, { ...invoice, status: 'approved' })}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary"
              >
                {copy.approve}
              </button>
              <button
                type="button"
                onClick={() => saveHouseholdInvoice(household.id!, { ...invoice, status: 'rejected' })}
                className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface"
              >
                {copy.reject}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
