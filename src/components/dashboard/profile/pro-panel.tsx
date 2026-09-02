'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { PRO_FEATURES, resolveProEntitlement } from '@/lib/pro-features';
import { formatShortDate } from '@/lib/utils';
import { useDashboard } from '../dashboard-provider';
import { useHousehold } from '@/lib/household-context';
import { canShowProUpgrade, isProFeatureUnlocked } from '@/lib/household';
import { useLanguage } from '@/lib/i18n-context';

export function ProPanel() {
  const { isPro, profile, openProModal } = useDashboard();
  const { workspace, household, selectWorkspace } = useHousehold();
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.profile.pro;
  const entitlement = resolveProEntitlement(profile);
  const showUpgrade = canShowProUpgrade(isPro, workspace);
  const proUnlocked = isProFeatureUnlocked(isPro, workspace, household);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">
          {proUnlocked ? p.yourFeatures : p.unlockWithPro}
        </h2>
        {proUnlocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <AppIcon name="check_circle" className="text-[13px]" />
            {p.allActive}
          </span>
        )}
      </div>

      {workspace === 'personal' && entitlement.status === 'trialing' && entitlement.endsAtMs && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary">
          {t(m.pro.trialEnds, {
            date: formatShortDate(new Date(entitlement.endsAtMs).toISOString().slice(0, 10), intlLocale),
            days: entitlement.daysRemaining,
          })}
        </div>
      )}

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
                <h3 className="text-sm font-bold text-on-surface">{p.features[feature.id].title}</h3>
                {!proUnlocked && (
                  <AppIcon name="lock" className="text-[13px] text-on-surface-variant" />
                )}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-on-surface-variant">
                {p.features[feature.id].description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {proUnlocked ? null : showUpgrade ? (
        <button
          type="button"
          onClick={openProModal}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
        >
          <AppIcon name="workspace_premium" className="text-[20px]" />
          <span>{m.profile.upgradeToPro}</span>
        </button>
      ) : (
        <div className="rounded-2xl border border-outline-variant bg-surface-container/60 p-4 text-center text-xs text-on-surface-variant">
          {p.privateWorkspaceLead}{' '}
          <button
            type="button"
            onClick={() => selectWorkspace('personal')}
            className="font-bold text-primary underline"
          >
            {m.profile.workspace.mySmartJib}
          </button>{' '}
          {p.privateWorkspaceTail}
        </div>
      )}
    </section>
  );
}
