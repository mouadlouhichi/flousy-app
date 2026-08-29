'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { PRO_FEATURES } from '@/lib/pro-features';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { canShowProUpgrade, isProFeatureUnlocked } from '@/lib/household';

export function ProPanel() {
  const { isPro, openProModal, openCsvModal, openIncomeModal } = useDashboard();
  const { workspace, selectWorkspace } = useHousehold();
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const proUnlocked = isProFeatureUnlocked(isPro, workspace);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">
          {proUnlocked ? 'Your Pro Features' : 'Unlock with Pro'}
        </h2>
        {proUnlocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <AppIcon name="check_circle" className="text-[13px]" />
            All active
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PRO_FEATURES.map((feature) => (
          <div
            key={feature.id}
            className={`flex items-start gap-3 rounded-2xl border p-4 transition-all ${
              proUnlocked
                ? 'border-primary/25 bg-surface-container'
                : 'border-outline-variant bg-surface-container/60'
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                proUnlocked ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              <AppIcon name={feature.icon} className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-on-surface">{feature.title}</h3>
                {!proUnlocked && (
                  <AppIcon name="lock" className="text-[13px] text-on-surface-variant" />
                )}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {proUnlocked ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openIncomeModal}
            className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:bg-surface-container-high"
          >
            <span className="flex items-center gap-3">
              <AppIcon name="payments" className="text-[20px] text-primary" />
              <span className="text-sm font-bold text-on-surface">Manage Income Sources</span>
            </span>
            <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
          </button>
          <button
            type="button"
            onClick={openCsvModal}
            className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:bg-surface-container-high"
          >
            <span className="flex items-center gap-3">
              <AppIcon name="upload_file" className="text-[20px] text-primary" />
              <span className="text-sm font-bold text-on-surface">Import / Export CSV</span>
            </span>
            <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
          </button>
          <Link
            href="/dashboard/profile/workspace"
            prefetch={false}
            className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:bg-surface-container-high"
          >
            <span className="flex items-center gap-3">
              <AppIcon name="family_restroom" className="text-[20px] text-primary" />
              <span className="text-sm font-bold text-on-surface">Manage Household</span>
            </span>
            <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
          </Link>
          <Link
            href="/dashboard/trends"
            prefetch={false}
            className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:bg-surface-container-high"
          >
            <span className="flex items-center gap-3">
              <AppIcon name="trending_up" className="text-[20px] text-primary" />
              <span className="text-sm font-bold text-on-surface">Analytics & Insights</span>
            </span>
            <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
          </Link>
        </div>
      ) : showUpgrade ? (
        <button
          type="button"
          onClick={openProModal}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
        >
          <AppIcon name="workspace_premium" className="text-[20px]" />
          <span>Upgrade to Pro</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-outline-variant bg-surface-container/60 p-4 text-center text-xs text-on-surface-variant">
          Pro upgrades apply to your private workspace. Switch to <button type="button" onClick={() => selectWorkspace('personal')} className="font-bold text-primary underline">My SmartJib</button> to manage or upgrade your personal plan.
        </div>
      )}
    </section>
  );
}
