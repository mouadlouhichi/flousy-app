'use client';
import { useEffect, useState } from 'react';
import { useHousehold } from '@/lib/household-context';
import { saveHouseholdInvoice, subscribeHouseholdInvoices } from '@/lib/db';
import type { HouseholdInvoice } from '@/lib/household';

/** Owner/editor review queue. Approving is deliberately separate from adding a private budget transaction. */
export function HouseholdInvoiceReview() {
  const { household, canEdit, members } = useHousehold();
  const [invoices, setInvoices] = useState<HouseholdInvoice[]>([]);
  useEffect(() => canEdit && household?.id ? subscribeHouseholdInvoices(household.id, setInvoices) : undefined, [canEdit, household?.id]);
  if (!canEdit || !household?.id) return null;
  const pending = invoices.filter(invoice => invoice.status === 'submitted');
  return <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container p-4"><div><h2 className="font-bold text-on-surface">Invoice review</h2><p className="mt-1 text-xs text-on-surface-variant">Review contributor submissions before recording them in the private household budget.</p></div>{pending.length === 0 ? <p className="text-sm text-on-surface-variant">No pending invoice submissions.</p> : <div className="space-y-2">{pending.map(invoice => <div key={invoice.id} className="flex items-center gap-3 rounded-xl bg-surface p-3"><div className="min-w-0 flex-1"><p className="font-semibold text-on-surface">{invoice.name}</p><p className="text-xs text-on-surface-variant">{members.find(m => m.userId === invoice.submitterId)?.displayName || 'Member'} · {invoice.category} · {invoice.amount.toFixed(2)}</p></div><button onClick={() => saveHouseholdInvoice(household.id!, { ...invoice, status: 'approved' })} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary">Approve</button><button onClick={() => saveHouseholdInvoice(household.id!, { ...invoice, status: 'rejected' })} className="rounded-lg border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface">Reject</button></div>)}</div>}</section>;
}
