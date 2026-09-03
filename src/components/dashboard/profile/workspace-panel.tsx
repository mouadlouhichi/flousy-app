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
import { trackEvent } from '@/lib/analytics';
import { isHouseholdEntitlementActive } from '@/lib/household';
import { useToast } from '@/hooks/use-toast';
import { syncWorkspaceTransactions, WorkspaceSyncError } from '@/lib/db';
import { planWorkspaceSyncAlignment, type WorkspaceSyncAlignment } from '@/lib/workspace-sync';

export function WorkspacePanel() {
  const router = useRouter();
  const { profile, user, updateProfileData } = useAuth();
  const { openProModal } = useDashboard();
  const {
    household,
    workspace,
    selectWorkspace,
    memberRole,
    isOwner,
    updateConfiguration,
    create,
    removeHouseholdWorkspace,
  } = useHousehold();
  const { messages: m, t } = useLanguage();
  const p = m.profile.workspace;
  const { toast } = useToast();
  const isPro = isProUser(profile);
  const [householdName, setHouseholdName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasHousehold = Boolean(profile?.activeHouseholdId || household?.id);
  // Household management is Pro-only. A free user in their personal workspace
  // sees no manage-household entry, member roster or invitations at all.
  const canManageHousehold = isPro || workspace === 'household';

  const switchWorkspace = async (next: 'personal' | 'household') => {
    setNotice('');
    try {
      await selectWorkspace(next);
    } catch {
      setNotice(m.household.genericError);
      toast({ variant: 'destructive', title: m.household.genericError });
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
      toast({ variant: 'destructive', title: m.household.genericError });
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
      toast({ variant: 'destructive', title: m.household.genericError });
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  // ── Bidirectional workspace sync (transactions only) ──
  // One tap copies transactions both ways: personal → household, then
  // household → personal. Each side receives only what the other has and it
  // is missing (id-based merge), so re-running is always a no-op. Requires
  // the owner because it writes into the shared budget.
  const d = m.profile.data;
  const alignment = planWorkspaceSyncAlignment(
    profile?.monthStartDate,
    household?.monthStartDate,
    workspace,
  );
  // Gate on the household's REAL entitlement. The context's
  // `entitlementActive` is deliberately true across the personal workspace
  // (personal editing must keep working), but a household write from there
  // is still rejected by Firestore rules when the owner's Pro entitlement
  // has lapsed - which used to surface as a raw permission-denied.
  const householdEntitled = isHouseholdEntitlementActive(household);
  const canSyncWorkspaces = Boolean(user && household?.id && isOwner && householdEntitled);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [pendingAlign, setPendingAlign] = useState<WorkspaceSyncAlignment | null>(null);

  // Firestore rejects household writes with permission-denied when the owner's
  // Pro entitlement has lapsed; say that instead of a raw permission error.
  const syncPermissionMessage = (error: unknown): string => {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') return `${m.pro.trialExpiredTitle} ${m.pro.trialExpiredBody}`;
    return d.syncFailed;
  };

  const runSyncBothWays = async (alignedDay: number, prefix = '') => {
    if (!user || !household?.id) return;
    setSyncBusy(true);
    setSyncNotice('');
    const personalConfig = { ...(profile || {}), monthStartDate: alignedDay };
    const householdConfig = {
      currency: household.currency,
      monthStartDate: alignedDay,
      defaultCategoryBudgets: household.defaultCategoryBudgets,
      enableRollover: household.enableRollover,
      moneyPlaces: household.moneyPlaces,
      activeCategories: household.activeCategories,
      categoryColors: household.categoryColors,
      categoryIcons: household.categoryIcons,
    };
    const personal = { workspace: 'personal' as const, uid: user.uid };
    const shared = { workspace: 'household' as const, householdId: household.id };
    try {
      const toHousehold = await syncWorkspaceTransactions(user.uid, personal, shared, personalConfig, householdConfig);
      const toPersonal = await syncWorkspaceTransactions(user.uid, shared, personal, householdConfig, personalConfig);
      const months = toHousehold.months + toPersonal.months;
      const totals = {
        months,
        incomes: toHousehold.incomes + toPersonal.incomes,
        expenses: toHousehold.variableExpenses + toPersonal.variableExpenses,
        fixed: toHousehold.fixedExpenses + toPersonal.fixedExpenses,
        debts: toHousehold.debts + toPersonal.debts,
      };
      const result = months === 0
        ? d.syncNothingNew
        : t(d.syncComplete, totals);
      setSyncNotice(prefix + result);
      toast({ title: p.syncTitle, description: prefix + result });
      trackEvent('workspace_sync', { direction: 'both' });
    } catch (error) {
      if (error instanceof WorkspaceSyncError && error.code === 'currency-mismatch') {
        setSyncNotice(d.syncErrorCurrency);
        toast({ variant: 'destructive', title: p.syncTitle, description: d.syncErrorCurrency });
      } else if (error instanceof WorkspaceSyncError && error.code === 'period-mismatch') {
        setSyncNotice(d.syncErrorPeriod);
        toast({ variant: 'destructive', title: p.syncTitle, description: d.syncErrorPeriod });
      } else if (error instanceof WorkspaceSyncError) {
        const partial = t(d.syncPartial, { months: error.counts?.months ?? 0 });
        setSyncNotice(partial);
        toast({ variant: 'destructive', title: p.syncTitle, description: partial });
      } else {
        console.error('Workspace sync failed:', error);
        setSyncNotice(d.syncFailed);
        toast({ variant: 'destructive', title: p.syncTitle, description: syncPermissionMessage(error) });
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSyncClick = () => {
    if (alignment.aligned) {
      void runSyncBothWays(alignment.day);
    } else {
      setPendingAlign(alignment);
    }
  };

  const confirmAlignAndSync = async () => {
    const plan = pendingAlign;
    setPendingAlign(null);
    if (!plan?.target) return;
    try {
      // The reference ("source point") workspace keeps its start day; the
      // other workspace is overridden so both map period keys identically.
      if (plan.target === 'household') await updateConfiguration({ monthStartDate: plan.day });
      else await updateProfileData({ monthStartDate: plan.day });
    } catch (error) {
      console.error('Budget-month alignment failed:', error);
      const message = syncPermissionMessage(error);
      setSyncNotice(message);
      toast({ variant: 'destructive', title: p.syncStartTitle, description: message });
      return;
    }
    toast({ title: p.syncStartTitle, description: t(p.syncAlignedNote, { day: plan.day }) });
    await runSyncBothWays(plan.day, `${t(p.syncAlignedNote, { day: plan.day })} `);
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
              <button type="button" disabled={busy} onClick={() => setConfirmRemove(true)} aria-label={isOwner ? p.removeHousehold : p.leaveHousehold} className="absolute end-1 top-1/2 -translate-y-1/2 p-2.5 text-error hover:text-error/70 disabled:opacity-50">
                <AppIcon name="delete" className="text-[22px]" />
              </button>
            </div>
          )}
        </div>
      </section>

      {canManageHousehold && (
        <Link href="/dashboard/profile/household" prefetch={true} className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-start transition-colors hover:bg-surface-container-high">
          <span className="flex items-center gap-3">
            <AppIcon name="inventory_2" className="text-[20px] text-primary" />
            <span className="text-sm font-bold text-on-surface">{hasHousehold ? p.manageHousehold : 'Add workspace'}</span>
          </span>
          <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
        </Link>
      )}

      {canSyncWorkspaces && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{p.syncTitle}</p>
          <p className="text-xs leading-5 text-on-surface-variant">{t(p.syncDescription, { household: household?.name || p.householdDashboard })}</p>
          <button
            type="button"
            disabled={syncBusy || busy}
            onClick={handleSyncClick}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <AppIcon name="sync" className="text-[18px]" />
            {syncBusy ? d.syncRunning : p.syncAction}
          </button>
          {syncNotice && (
            <p role="status" className="mt-2 text-xs font-bold text-on-surface-variant">{syncNotice}</p>
          )}
        </section>
      )}

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

      <ConfirmDialog
        isOpen={Boolean(pendingAlign)}
        onClose={() => setPendingAlign(null)}
        onConfirm={() => { void confirmAlignAndSync(); }}
        title={p.syncStartTitle}
        message={pendingAlign && !pendingAlign.aligned
          ? t(p.syncStartMessage, {
              personal: profile?.monthStartDate || 1,
              householdDay: household?.monthStartDate || 1,
              day: pendingAlign.day,
            })
          : ''}
        confirmLabel={p.syncAction}
      />
    </div>
  );
}
