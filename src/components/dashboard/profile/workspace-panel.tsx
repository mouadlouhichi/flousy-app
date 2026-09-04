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
import { MyInvoiceSubmissions } from '../my-invoice-submissions';
import { HouseholdInvoiceReview } from '../household-invoice-review';
import { useLanguage } from '@/lib/i18n-context';
import { localizeHouseholdRole } from '@/lib/localized-labels';
import { isProUser } from '@/lib/pro-features';
import { trackEvent } from '@/lib/analytics';
import { resolveProEntitlement } from '@/lib/pro-features';
import { useToast } from '@/hooks/use-toast';
import { syncWorkspaceTransactions, WorkspaceSyncError } from '@/lib/db';
import { diagnoseHouseholdWriteDenial } from '@/lib/household-entitlement';
import { classifyWorkspaceSyncStop, planWorkspaceSyncAlignment, type WorkspaceSyncAlignment } from '@/lib/workspace-sync';
import { FinanceConflictError } from '@/lib/finance-sync';

export function WorkspacePanel() {
  const router = useRouter();
  const { profile, user, updateProfileData } = useAuth();
  const { openProModal, retrySync } = useDashboard();
  const {
    household,
    workspace,
    selectWorkspace,
    memberRole,
    isOwner,
    updateConfiguration,
    create,
    removeHouseholdWorkspace,
    workspaceSchemaGaps,
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
    } catch (error) {
      // Log the real cause. A bare `catch {}` here turned every refusal into
      // the same generic notice, which is how an over-budget rules denial went
      // undiagnosed: the user saw "something went wrong" and the console was
      // empty. The message shown stays generic; the console gets the truth.
      console.error('Household creation failed:', error);
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
  // Gate on the owner's PROFILE entitlement: Firestore rules decide household
  // writes by reading users/{ownerId} (activeProEntitlement), not the
  // household's creation-time projection, so the profile is the only source
  // that cannot disagree with the server. The context's `entitlementActive`
  // is deliberately true across the personal workspace and the projection is
  // an immutable copy from household-creation day - both used to show the
  // card for lapses the server then rejected.
  const entitlement = resolveProEntitlement(profile);
  const isHouseholdOwner = Boolean(user && household?.id && isOwner);
  const canSyncWorkspaces = isHouseholdOwner && entitlement.isPro;
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [pendingAlign, setPendingAlign] = useState<WorkspaceSyncAlignment | null>(null);

  // A household refusal is never this account's trial: `householdEntitled()`
  // in firestore.rules asks the *sponsor's* profile, so name the state that was
  // actually found - and offer the repair when one exists.
  const sponsorDenial = user && household
    ? diagnoseHouseholdWriteDenial({ household, profile, uid: user.uid, isOwner })
    : null;
  const syncPermissionMessage = (error: unknown): string => {
    const code = (error as { code?: string })?.code;
    if (code !== 'permission-denied') return d.syncFailed;
    if (!entitlement.isPro) return `${m.pro.trialExpiredTitle} ${m.pro.trialExpiredBody}`;
    // Only reachable when the household is genuinely sponsored by another
    // account: `diagnoseHouseholdWriteDenial` returns this solely for
    // `sponsor !== uid`. The sync loop repairs it automatically.
    if (sponsorDenial === 'sponsor-rebindable') return m.sync.restoreAccessHint;
    if (sponsorDenial === 'sponsor-unreadable') return m.sync.sponsorUnreadable;
    if (sponsorDenial === 'sponsor-lapsed') return m.sync.sponsorLapsed;
    if (sponsorDenial === 'profile-invalid') return m.sync.profileInvalid;
    return m.sync.rulesBehind;
  };

  /**
   * The card's answer to a stopped sync used to be a count: "Sync stopped after
   * 0 month(s). Running it again is safe." - a number instead of a cause for a
   * workspace that refused the very first write, and a suggestion to repeat what
   * just failed. What stopped it is known, so it is said; and where the one thing
   * left to try is the repair this card offers, the message points at it.
   */
  const syncStopMessage = (error: WorkspaceSyncError): string => {
    const stop = classifyWorkspaceSyncStop(error);
    const detail = stop.cause === 'refused'
      ? syncPermissionMessage(error.reason)
      : stop.cause === 'changed-target'
        // The target month moved underneath the sync: a review, not a retry.
        ? m.sync.conflictDetail
        : (error.reason instanceof Error && error.reason.message.trim()) || d.syncFailed;
    const where = stop.months > 0
      ? t(d.syncPartial, { months: stop.months })
      : stop.failedMonth
        ? t(d.syncPartialNothingAt, { period: stop.failedMonth })
        : d.syncPartialNothing;
    return `${detail} ${where}`;
  };

  /**
   * Fields the workspace document never stored and no client may invent. Shown on
   * the card that owns workspace settings, because that is where the user would
   * otherwise keep pressing save on a write the stored shape cannot satisfy.
   */
  const schemaGapNotice = isOwner && workspaceSchemaGaps.length > 0
    ? t(p.schemaGaps, { fields: workspaceSchemaGaps.join(', ') })
    : '';

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
      // Frozen periods are reported as what they are: the sync is not stuck, it
      // deliberately left those out, and reopening one is the only way in.
      const skippedPeriods = [...(toHousehold.skippedClosed ?? []), ...(toPersonal.skippedClosed ?? [])].length;
      const result = months === 0
        ? skippedPeriods > 0 ? t(d.syncSkippedClosed, { periods: skippedPeriods }) : d.syncNothingNew
        : `${t(d.syncComplete, totals)}${skippedPeriods > 0 ? ` ${t(d.syncSkippedSome, { periods: skippedPeriods })}` : ''}`;
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
        const description = syncStopMessage(error);
        setSyncNotice(description);
        toast({ variant: 'destructive', title: p.syncTitle, description });
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
      {schemaGapNotice && (
        <p role="status" className="rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-xs">
          {schemaGapNotice}
        </p>
      )}
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

      {isHouseholdOwner && (
        <section className="rounded-2xl border border-outline-variant bg-surface-container p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant">{p.syncTitle}</p>
          <p className="text-xs leading-5 text-on-surface-variant">{t(p.syncDescription, { household: household?.name || p.householdDashboard })}</p>
          <button
            type="button"
            disabled={!canSyncWorkspaces || syncBusy || busy}
            onClick={handleSyncClick}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <AppIcon name="sync" className="text-[18px]" />
            {syncBusy ? d.syncRunning : p.syncAction}
          </button>
          {!canSyncWorkspaces && (
            <p className="mt-2 text-xs font-bold text-on-surface-variant">
              {m.pro.trialExpiredTitle} {p.syncRequiresPro}
            </p>
          )}
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
      <MyInvoiceSubmissions />
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
