'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/ui/app-icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { exportMonthToCsv, downloadCsv } from '@/lib/export';
import { trackEvent } from '@/lib/analytics';
import { useDashboard } from '../dashboard-provider';

export function DataPanel() {
  const { deleteAllData } = useAuth();
  const { currency } = useCurrency();
  const { month, goals, currentMonthKey, openCsvModal } = useDashboard();
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);

  const handleExportCsv = () => {
    downloadCsv(
      `flousy-budget-${currentMonthKey}.csv`,
      exportMonthToCsv(month, goals, currentMonthKey, currency),
    );
    trackEvent('export_csv');
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
          <span className="text-sm font-medium text-on-surface">Export this month as CSV</span>
        </span>
        <AppIcon
          name="chevron_right"
          className="text-[20px] text-on-surface-variant transition-transform group-hover:translate-x-0.5"
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
          <span className="text-sm font-medium text-on-surface">Import CSV</span>
        </span>
        <AppIcon
          name="chevron_right"
          className="text-[20px] text-on-surface-variant transition-transform group-hover:translate-x-0.5"
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
          <span className="text-sm font-medium text-error">Delete All Data</span>
        </span>
        <AppIcon
          name="chevron_right"
          className="text-[20px] text-error/70 transition-transform group-hover:translate-x-0.5"
        />
      </button>

      <ConfirmDialog
        isOpen={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        onConfirm={async () => {
          await deleteAllData();
        }}
        title="Delete All Data"
        message="This permanently deletes every month of budget data, expenses, and savings goals from your account. Your account and settings will be kept. This action cannot be undone — download your data first if you want a copy."
        confirmLabel="Delete All Data"
        isDestructive
      />
    </section>
  );
}
