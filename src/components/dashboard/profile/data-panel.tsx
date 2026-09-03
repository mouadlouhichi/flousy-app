'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { exportMonthToCsv, downloadCsv } from '@/lib/export';
import { trackEvent } from '@/lib/analytics';
import { useLanguage } from '@/lib/i18n-context';
import { AccountDeletionIncompleteError } from '@/lib/auth-context';
import { useHousehold } from '@/lib/household-context';
import { canExportAnything } from '@/lib/household-rbac';
import { useDashboard } from '../dashboard-provider';
import { exportFinanceBackup, FinanceRestoreIncompleteError, restoreFinanceBackup } from '@/lib/db';
import {
  downloadJson,
  InvalidFinanceBackupError,
  planFinanceBackupRestore,
  readFinanceBackup,
  serializeFinanceBackup,
  type BackupNotice,
  type BackupPlan,
  type FinanceBackup,
} from '@/lib/finance-backup';
import { useToast } from '@/hooks/use-toast';

export function DataPanel() {
  const { deleteAllData, user, profile } = useAuth();
  const { workspace, household, isOwner, canEditArea, exportSections } = useHousehold();
  const { messages: m, isRTL, t } = useLanguage();
  const p = m.profile.data;
  const { toast } = useToast();
  const { currency } = useCurrency();
  const { month, goals, currentMonthKey, openCsvModal } = useDashboard();
  // The CSV contains balances, fixed bills, expenses and savings: in a
  // household each section is filtered by the member's RBAC area, so a
  // download can never reveal a figure that is hidden on screen.
  const canExport = canExportAnything(exportSections);
  const canImport = canEditArea('expenses') || canEditArea('fixedBills');
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNotice, setBackupNotice] = useState('');
  const [pendingRestore, setPendingRestore] = useState<{ backup: FinanceBackup; lines: string[] } | null>(null);

  const handleExportCsv = () => {
    if (!canExport) return;
    downloadCsv(
      `flousy-budget-${currentMonthKey}.csv`,
      exportMonthToCsv(month, goals, currentMonthKey, currency, exportSections),
    );
    trackEvent('export_csv');
  };

  const financeTarget = user
    ? (workspace === 'household' && household?.id
        ? { workspace: 'household' as const, householdId: household.id }
        : { workspace: 'personal' as const, uid: user.uid })
    : null;
  const financeConfiguration = workspace === 'household' && household
    ? {
        currency: household.currency,
        monthStartDate: household.monthStartDate,
        defaultCategoryBudgets: household.defaultCategoryBudgets,
        enableRollover: household.enableRollover,
        moneyPlaces: household.moneyPlaces,
        activeCategories: household.activeCategories,
        categoryColors: household.categoryColors,
        categoryIcons: household.categoryIcons,
      }
    : profile;
  const canRestore = workspace === 'personal' || isOwner;

  const handleBackupExport = async () => {
    if (!user || !financeTarget) return;
    setBackupBusy(true);
    setBackupNotice('');
    try {
      const backup = await exportFinanceBackup(user.uid, financeTarget, financeConfiguration);
      downloadJson(`smartjib-backup-${workspace}-${new Date().toISOString().slice(0, 10)}.json`, serializeFinanceBackup(backup));
      setBackupNotice(p.backupExported);
      toast({ title: p.exportBackup, description: p.backupExported });
      trackEvent('export_json_backup', { workspace });
    } catch (error) {
      console.error('Backup export failed:', error);
      setBackupNotice(p.backupFailed);
      toast({ variant: 'destructive', title: p.exportBackup, description: p.backupFailed });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupNotice('');
    try {
      const { backup, notices } = readFinanceBackup(await file.text());
      const plan = planFinanceBackupRestore(backup, {
        workspace,
        isOwner,
        currency,
        monthStartDate: financeConfiguration?.monthStartDate,
        name: workspace === 'household' ? household?.name : undefined,
      });
      if (!plan.canRestore) {
        // A shared workspace belongs to everyone in it, so only its owner may put
        // somebody else's numbers into it - and any other reason the plan found has
        // to be named too, or the user is left with a refusal and no cause.
        const reasons = plan.notices.flatMap((notice) => {
          const template = p.backupPlanNotices?.[notice.code];
          return template ? [t(template, notice.params)] : [];
        });
        const description = reasons.length > 0 ? reasons.join(' ') : p.restoreFailed;
        setBackupNotice(description);
        toast({ variant: 'destructive', title: p.restoreBackup, description });
        return;
      }
      setPendingRestore({
        backup,
        lines: [
          t(p.restoreCounts, {
            months: plan.counts.months,
            goals: plan.counts.goals,
            products: plan.counts.products,
            sessions: plan.counts.sessions,
            exportedAt: backup.exportedAt.slice(0, 10),
          }),
          ...notices.flatMap((notice) => {
            const template = p.backupReportNotices?.[notice.code];
            return template
              ? [t(template, { count: notice.count, fields: (notice.fields ?? []).join(', ') })]
              : [];
          }),
          ...plan.notices.flatMap((notice) => {
            const template = p.backupPlanNotices?.[notice.code];
            return template && notice.code !== 'householdOwnerOnly'
              ? [t(template, notice.params)]
              : [];
          }),
        ],
      });
    } catch (error) {
      console.error('Backup validation failed:', error);
      // Any failure carries its own explanation from here: a named refusal in the
      // user's language, the reader's own words for a field it could not parse, and
      // only as a last resort the bare "not a valid backup" notice.
      const raw = error instanceof Error ? error.message.trim() : '';
      const refusal = error instanceof InvalidFinanceBackupError ? error.refusal : undefined;
      const template = refusal ? p.backupInvalidReasons?.[refusal] : undefined;
      const reason = template
        ? (refusal === 'unreadable' && raw ? `${t(template, {})}: ${raw}` : t(template, {}))
        : raw;
      const description = reason ? t(p.backupInvalidDetail, { reason }) : p.backupInvalid;
      setBackupNotice(description);
      toast({ variant: 'destructive', title: p.restoreBackup, description });
    }
  };

  const confirmRestore = async () => {
    if (!user || !financeTarget || !pendingRestore || !canRestore) return;
    setBackupBusy(true);
    setBackupNotice('');
    try {
      const result = await restoreFinanceBackup(user.uid, financeTarget, pendingRestore.backup, financeConfiguration);
      setBackupNotice(t(p.restoreComplete, { months: result.restoredMonths, goals: result.restoredGoals }));
      toast({ title: p.restoreBackup, description: t(p.restoreComplete, { months: result.restoredMonths, goals: result.restoredGoals }) });
      setPendingRestore(null);
      trackEvent('restore_json_backup', { workspace });
    } catch (error) {
      console.error('Backup restore failed:', error);
      const restoreError = error instanceof FinanceRestoreIncompleteError ? p.restorePartial : p.restoreFailed;
      setBackupNotice(restoreError);
      toast({ variant: 'destructive', title: p.restoreBackup, description: restoreError });
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      {canExport && <button
        type="button"
        onClick={handleExportCsv}
        className="group flex w-full items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:bg-surface-container-high"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant transition-colors group-hover:bg-primary/10">
            <AppIcon name="download" className="text-[20px] text-primary" />
          </span>
          <span className="text-sm font-medium text-on-surface">{p.exportThisMonth}</span>
        </span>
        <AppIcon
          name="chevron_right"
          className={`text-[20px] text-on-surface-variant transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
        />
      </button>}
      {canImport && (
        <button
          type="button"
          onClick={openCsvModal}
          className="group flex w-full items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:bg-surface-container-high"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant transition-colors group-hover:bg-primary/10">
              <AppIcon name="upload_file" className="text-[20px] text-primary" />
            </span>
            <span className="text-sm font-medium text-on-surface">{p.importCsv}</span>
          </span>
          <AppIcon
            name="chevron_right"
            className={`text-[20px] text-on-surface-variant transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
          />
        </button>
      )}
      {canExport && (
        <button
          type="button"
          disabled={!user || backupBusy}
          onClick={() => { void handleBackupExport(); }}
          className="group flex w-full items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:bg-surface-container-high disabled:opacity-50"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><AppIcon name="archive" className="text-[20px] text-primary" /></span>
            <span className="text-start"><span className="block text-sm font-medium text-on-surface">{p.exportBackup}</span><span className="block text-xs text-on-surface-variant">{p.exportBackupDescription}</span></span>
          </span>
          <AppIcon name="download" className="text-[20px] text-on-surface-variant" />
        </button>
      )}
      {canRestore && (
        <label className={`group flex w-full cursor-pointer items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 transition-colors hover:bg-surface-container-high ${backupBusy || !user ? 'pointer-events-none opacity-50' : ''}`}>
          <input type="file" accept="application/json,.json" onChange={(event) => { void handleBackupFile(event); }} className="sr-only" disabled={backupBusy || !user} />
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><AppIcon name="settings_backup_restore" className="text-[20px] text-primary" /></span>
            <span className="text-start"><span className="block text-sm font-medium text-on-surface">{p.restoreBackup}</span><span className="block text-xs text-on-surface-variant">{p.restoreBackupDescription}</span></span>
          </span>
          <AppIcon name="upload_file" className="text-[20px] text-on-surface-variant" />
        </label>
      )}
      {backupNotice && <p role="status" className="px-1 text-xs font-bold text-on-surface-variant">{backupNotice}</p>}

      <button
        type="button"
        onClick={() => setShowDeleteDataConfirm(true)}
        className="group flex w-full items-center justify-between rounded-2xl border border-error/30 bg-error/5 p-4 transition-colors hover:bg-error/10"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-error/10 transition-colors group-hover:bg-error/20">
            <AppIcon name="delete_forever" className="text-[20px] text-error" />
          </span>
          <span className="text-sm font-medium text-error">{p.deleteAllData}</span>
        </span>
        <AppIcon
          name="chevron_right"
          className={`text-[20px] text-error/70 transition-transform ${isRTL ? 'rotate-180 group-hover:-translate-x-0.5' : 'group-hover:translate-x-0.5'}`}
        />
      </button>

      {deleteError && (
        <p role="alert" className="px-1 text-xs font-bold text-error">
          {deleteError}
        </p>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingRestore)}
        onClose={() => setPendingRestore(null)}
        onConfirm={() => { void confirmRestore(); }}
        title={p.restoreBackup}
        message={pendingRestore
          ? [
              t(p.restoreConfirm, {
                months: Object.keys(pendingRestore.backup.months).length,
                goals: pendingRestore.backup.goals.length,
                workspace: household?.name || p.personalWorkspace,
              }),
              ...pendingRestore.lines,
            ].join('\n')
          : ''}
        confirmLabel={p.restoreBackup}
        isDestructive
      />

      <ConfirmDialog
        isOpen={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        onConfirm={async () => {
          // A Firestore write batch can fail part-way (offline, a rule
          // rejection). The local cache is already cleared at that point, so the
          // cloud copies are the only remaining record — reporting success would
          // send the user away from a screen whose data still exists remotely and
          // would come straight back on the next device.
          try {
            await deleteAllData();
            setDeleteError('');
          } catch (error) {
            const message = error instanceof AccountDeletionIncompleteError
              ? t(m.auth.deletePartialFailure, { items: error.report.failed.join(', ') })
              : m.auth.networkError;
            setDeleteError(message);
            toast({ variant: 'destructive', title: p.deleteAllData, description: message });
          }
        }}
        title={p.deleteAllData}
        message={p.deleteAllDataMessage}
        confirmLabel={p.deleteAllData}
        isDestructive
      />
    </section>
  );
}
