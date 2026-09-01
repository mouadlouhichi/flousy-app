'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppIcon } from '@/components/ui/app-icon';
import { useAuth } from '@/lib/auth-context';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ContributorInvoiceForm } from '../contributor-invoice-form';
import { HouseholdInvoiceReview } from '../household-invoice-review';
import { useLanguage } from '@/lib/i18n-context';
import { localizeHouseholdRole } from '@/lib/localized-labels';
import { isProUser } from '@/lib/pro-features';

export function WorkspacePanel() {
  const router = useRouter();
  const { profile } = useAuth();
  const { openProModal } = useDashboard();
  const { household, workspace, selectWorkspace, memberRole, isOwner, create, removeHouseholdWorkspace } = useHousehold();
  const { messages: m, t } = useLanguage();
  const p = m.profile.workspace;
  const isPro = isProUser(profile);
  const [householdName, setHouseholdName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasHousehold = Boolean(profile?.activeHouseholdId || household?.id);

  const switchWorkspace = async (next: 'personal' | 'household') => {
    setNotice('');
    try {
      await selectWorkspace(next);
    } catch {
      setNotice(m.household.genericError);
    }
  };

  const convertToHousehold = async () => {
    if (!isPro) {
      openProModal();
      return;
    }
    setBusy(true);
    setNotice('');
    try {
      await create(householdName.trim() || profile?.displayName || m.profile.household);
      router.replace('/onboarding?scope=household');
    } catch {
      setNotice(m.household.genericError);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveHousehold = async () => {
    setBusy(true);
    setNotice('');
    try {
      await removeHouseholdWorkspace();
    } catch {
      setNotice(m.household.genericError);
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{m.profile.groups.workspace}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => switchWorkspace('personal')}
            className={`rounded-xl border p-3 text-start ${workspace === 'personal' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface text-on-surface'}`}
          >
            <span className="flex items-center gap-2 font-bold"><AppIcon name="person" className="text-[19px]" />{p.mySmartJib}</span>
            <span className="text-xs text-on-surface-variant">{p.personalDashboard}</span>
          </button>
          {hasHousehold && (
            <div className={`relative rounded-xl border p-3 ${workspace === 'household' ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant bg-surface text-on-surface'}`}>
              <button type="button" onClick={() => switchWorkspace('household')} className="w-full pe-10 text-start">
                <span className="flex items-center gap-2 font-bold"><AppIcon name="inventory_2" className="text-[19px]" />{household?.name || p.householdDashboard}</span>
                <span className="text-xs text-on-surface-variant">{t(p.memberAccess, { role: memberRole ? localizeHouseholdRole(memberRole, m) : m.householdRoles.viewer })}</span>
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} aria-label={isOwner ? p.removeHousehold : p.leaveHousehold} className="absolute end-3 top-1/2 -translate-y-1/2 text-error hover:text-error/70 disabled:opacity-50">
                <AppIcon name="delete" className="text-[22px]" />
              </button>
            </div>
          )}
        </div>
      </section>

      {hasHousehold && (
        <Link
          href="/dashboard/profile/household"
          prefetch={true}
          className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-start transition-colors hover:bg-surface-container-high"
        >
          <span className="flex items-center gap-3">
            <AppIcon name="inventory_2" className="text-[20px] text-primary" />
            <span className="text-sm font-bold text-on-surface">{p.manageHousehold}</span>
          </span>
          <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
        </Link>
      )}

      <Link href="/dashboard/profile/household" prefetch={true} className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-start transition-colors hover:bg-surface-container-high">
        <span className="flex items-center gap-3">
          <AppIcon name="inventory_2" className="text-[20px] text-primary" />
          <span className="text-sm font-bold text-on-surface">{hasHousehold ? p.manageHousehold : 'Add workspace'}</span>
        </span>
        <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
      </Link>

      {!hasHousehold && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <p className="font-bold text-on-surface">{p.convertToHousehold}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{p.convertToHouseholdHint}</p>
          <input
            value={householdName}
            onChange={(event) => setHouseholdName(event.target.value)}
            placeholder={m.household.householdNamePlaceholder}
            aria-label={m.household.householdNamePlaceholder}
            className="mt-3 w-full rounded-xl border border-outline-variant bg-surface p-3 text-sm"
          />
          <button
            type="button"
            disabled={busy}
            onClick={convertToHousehold}
            className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-on-primary disabled:opacity-50"
          >
            {p.convertToHousehold}
          </button>
        </section>
      )}

      <ContributorInvoiceForm />
      <HouseholdInvoiceReview />

      {notice && (
        <p role="status" className="rounded-xl bg-surface-container p-3 text-sm text-on-surface">
          {notice}
        </p>
      )}

      <ConfirmDialog
        isOpen={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          void handleRemoveHousehold();
        }}
        title={isOwner ? p.removeHousehold : p.leaveHousehold}
        message={p.removeHouseholdConfirm}
        confirmLabel={isOwner ? p.removeHousehold : p.leaveHousehold}
        isDestructive
      />
    </div>
  );
}
