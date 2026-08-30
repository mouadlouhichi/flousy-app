'use client';
import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';
import { saveHouseholdInvoice } from '@/lib/db';

/** Restricted submission form: it never loads or writes the private month budget. */
export function ContributorInvoiceForm() {
  const { user } = useAuth();
  const { household, payers, isContributor } = useHousehold();
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('Other'); const [payerMemberId, setPayer] = useState('household'); const [notice, setNotice] = useState(''); const [saving, setSaving] = useState(false);
  if (!isContributor || !household || !user) return null;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); const value = Number(amount); if (!name.trim() || !Number.isFinite(value) || value <= 0) { setNotice('Enter an invoice name and a valid amount.'); return; } setSaving(true); try { await saveHouseholdInvoice(household.id!, { id: crypto.randomUUID(), name: name.trim(), amount: value, category, date: new Date().toISOString().slice(0, 10), payerMemberId, submitterId: user.uid, status: 'submitted', createdAt: new Date().toISOString() }); setName(''); setAmount(''); setNotice('Invoice submitted for household review.'); } catch { setNotice('Unable to submit the invoice. Please try again.'); } finally { setSaving(false); } };
  return <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div><h2 className="font-bold text-on-surface">Submit an invoice</h2><p className="mt-1 text-xs text-on-surface-variant">Your submission is shared for review. Household balances, debts, savings and analytics remain private.</p></div><form onSubmit={submit} className="grid gap-2 sm:grid-cols-2"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Merchant or invoice name" className="rounded-xl border border-outline-variant bg-surface p-3"/><input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="rounded-xl border border-outline-variant bg-surface p-3"/><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Category" className="rounded-xl border border-outline-variant bg-surface p-3"/><select value={payerMemberId} onChange={e=>setPayer(e.target.value)} className="rounded-xl border border-outline-variant bg-surface p-3">{payers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><button disabled={saving} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary disabled:opacity-50"><AppIcon name="receipt_long" className="text-[18px]" />{saving ? 'Submitting…' : 'Submit invoice'}</button></form>{notice && <p role="status" className="text-sm text-on-surface-variant">{notice}</p>}</section>;
}
