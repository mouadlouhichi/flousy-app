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

export function DataPanel() {
  const { deleteAllData } = useAuth();
  const { messages: m, isRTL, t } = useLanguage();
  const p = m.profile.data;
  const { currency } = useCurrency();
  const { month, goals, currentMonthKey, openCsvModal } = useDashboard();
  // The CSV contains balances, fixed bills, expenses and savings: in a
  // household each section is filtered by the member's RBAC area, so a
  // download can never reveal a figure that is hidden on screen.
  const { exportSections } = useHousehold();
  const canExport = canExportAnything(exportSections);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleExportCsv = () => {
    if (!canExport) return;
    downloadCsv(
      `flousy-budget-${currentMonthKey}.csv`,
      exportMonthToCsv(month, goals, currentMonthKey, currency, exportSections),
    );
    trackEvent('export_csv');
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
