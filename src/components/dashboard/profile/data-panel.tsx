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
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { exportFinanceBackup, FinanceRestoreIncompleteError, restoreFinanceBackup } from '@/lib/db';
import { downloadJson, parseFinanceBackup, serializeFinanceBackup, type FinanceBackup } from '@/lib/finance-backup';

export function DataPanel() {
  const { deleteAllData, user, profile } = useAuth();
  const { workspace, household, isOwner } = useHousehold();
  const { messages: m, isRTL, t } = useLanguage();
  const p = m.profile.data;
  const { currency } = useCurrency();
  const { month, goals, currentMonthKey, openCsvModal } = useDashboard();
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNotice, setBackupNotice] = useState('');
  const [pendingRestore, setPendingRestore] = useState<FinanceBackup | null>(null);

  const handleExportCsv = () => {
    downloadCsv(
      `flousy-budget-${currentMonthKey}.csv`,
      exportMonthToCsv(month, goals, currentMonthKey, currency),
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
      trackEvent('export_json_backup', { workspace });
    } catch (error) {
      console.error('Backup export failed:', error);
      setBackupNotice(p.backupFailed);
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
      const backup = parseFinanceBackup(await file.text());
      if (backup.workspace.type !== workspace) throw new Error('Workspace type mismatch.');
      setPendingRestore(backup);
    } catch (error) {
      console.error('Backup validation failed:', error);
      setBackupNotice(p.backupInvalid);
    }
  };

  const confirmRestore = async () => {
    if (!user || !financeTarget || !pendingRestore || !canRestore) return;
    setBackupBusy(true);
    setBackupNotice('');
    try {
      const result = await restoreFinanceBackup(user.uid, financeTarget, pendingRestore, financeConfiguration);
      setBackupNotice(t(p.restoreComplete, { months: result.restoredMonths, goals: result.restoredGoals }));
      setPendingRestore(null);
      trackEvent('restore_json_backup', { workspace, months: result.restoredMonths });
    } catch (error) {
      console.error('Backup restore failed:', error);
      setBackupNotice(error instanceof FinanceRestoreIncompleteError ? p.restorePartial : p.restoreFailed);
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <button
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
      </button>
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
          ? t(p.restoreConfirm, {
              months: Object.keys(pendingRestore.months).length,
              goals: pendingRestore.goals.length,
              workspace: household?.name || p.personalWorkspace,
            })
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
            setDeleteError(
              error instanceof AccountDeletionIncompleteError
                ? t(m.auth.deletePartialFailure, { items: error.report.failed.join(', ') })
                : m.auth.networkError,
            );
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
