'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useAuth } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';
import { TOOL_AREA } from '@/lib/household-rbac';
import { useLanguage } from '@/lib/i18n-context';
import { saveHouseholdInvoice } from '@/lib/db';

/** Restricted submission form: it never loads or writes the private month budget. */
export function ContributorInvoiceForm() {
  const { user } = useAuth();
  const { household, payers, areaLevel, workspace } = useHousehold();
  const { messages: m } = useLanguage();
  const copy = m.household.invoice;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [payerMemberId, setPayer] = useState('household');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  // The submission flow exists for restricted members only (contributor, or a
  // custom role capped at `editOwn` on invoices): they cannot write the shared
  // budget, so they hand receipts to someone who can. The owner and editors
  // already hold `editAll` — for them the form would only create a self-review
  // loop, and outside the household workspace it has no destination at all.
  if (workspace !== 'household'
    || areaLevel(TOOL_AREA.invoices) !== 'editOwn'
    || !household
    || !user) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!name.trim() || !Number.isFinite(value) || value <= 0) {
      setNotice(copy.invalid);
      return;
    }

    setSaving(true);
    try {
      await saveHouseholdInvoice(household.id!, {
        id: crypto.randomUUID(),
        name: name.trim(),
        amount: value,
        category: category.trim() || m.categories.other,
        date: new Date().toISOString().slice(0, 10),
        payerMemberId,
        place: 'bank',
        submitterId: user.uid,
        status: 'submitted',
        createdAt: new Date().toISOString(),
      });
      setName('');
      setAmount('');
      setCategory('');
      setNotice(copy.submitted);
    } catch {
      setNotice(copy.submitFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div>
        <h2 className="font-bold text-on-surface">{copy.title}</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{copy.description}</p>
      </div>
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={copy.namePlaceholder}
          aria-label={copy.namePlaceholder}
          className="rounded-xl border border-outline-variant bg-surface p-3"
        />
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder={copy.amount}
          aria-label={copy.amount}
          dir="ltr"
          className="rounded-xl border border-outline-variant bg-surface p-3 tabular-nums"
        />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder={copy.category}
          aria-label={copy.category}
          className="rounded-xl border border-outline-variant bg-surface p-3"
        />
        <CustomSelect
          value={payerMemberId}
          onChange={setPayer}
          options={payers.map((payer) => ({ value: payer.id, label: payer.label }))}
          ariaLabel={m.modals.expense.householdMember}
          triggerClassName="!h-[46px]"
        />
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-on-primary disabled:opacity-50 sm:col-span-2"
        >
          <AppIcon name="receipt_long" className="text-[18px]" />
          {saving ? copy.submitting : copy.submit}
        </button>
      </form>
      {notice && (
        <p role="status" className="text-sm text-on-surface-variant">
          {notice}
        </p>
      )}
    </section>
  );
}
