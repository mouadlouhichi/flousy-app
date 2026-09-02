import { AppIcon } from '@/components/ui/app-icon';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { InstallButton } from '../pwa/install-button';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { useCurrency } from '../../lib/currency-context';
import { useAuth } from '../../lib/auth-context';
import { isDemoMode } from '../../lib/demo-mode';
import { useLanguage } from '../../lib/i18n-context';
import { exportMonthToCsv, downloadCsv } from '../../lib/export';
import { MonthBudget, SavingGoal } from '../../lib/store';
import { CustomSelect } from '../ui/CustomSelect';
import { SegmentedControl } from '../ui/segmented-control';
import { MonthlyStartDateControl } from '../dashboard/monthly-start-date-control';
import { trackEvent } from '../../lib/analytics';
import { useHousehold } from '../../lib/household-context';
import { resolveProfileAvatarSource } from '../../lib/profile-avatar';
import { ProfileAvatar } from '../dashboard/profile-avatar';
import { canShowProUpgrade } from '../../lib/household';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  goals: SavingGoal[];
  monthKey: string;
  onOpenProModal?: () => void;
}

export function SettingsModal({ isOpen, onClose, month, goals, monthKey, onOpenProModal }: SettingsModalProps) {
  const router = useRouter();
  const { currency, configuredCurrency, setCurrency } = useCurrency();
  const { user, profile, signOut, deleteAccount, deleteAllData, updateProfileData } = useAuth();
  const { workspace, household, isOwner, updateConfiguration } = useHousehold();
  // Demo (no-Firebase) sessions have no `user` but still need a sign-out path.
  const demoMode = !user && isDemoMode();
  const { language, setLanguage, messages: m, localeNames, t } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const [pendingStartDay, setPendingStartDay] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');

  const currentTheme = profile?.theme || 'system';
  const currencyOptions = Object.values(SUPPORTED_CURRENCIES).map((item) => ({
    value: item.code,
    label: item.code,
  }));
  const languageOptions = [
    { value: 'en', label: localeNames.en },
    { value: 'fr', label: localeNames.fr },
    { value: 'ar', label: localeNames.ar },
  ];

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateProfileData({ theme });
    trackEvent('change_theme', { theme });
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  const handleSaveName = async () => {
    if (displayName.trim()) {
      await updateProfileData({ displayName: displayName.trim() });
      trackEvent('update_display_name');
    }
    setIsEditingName(false);
  };

  const handleExportCsv = () => {
    const csvContent = exportMonthToCsv(month, goals, monthKey, currency);
    downloadCsv(`flousy-budget-${monthKey}.csv`, csvContent);
    trackEvent('export_csv');
  };

  const userInitial = (profile?.displayName || user?.email || m.auth.anonymousUser)?.[0]?.toUpperCase() || 'M';
  const avatarSrc = resolveProfileAvatarSource(profile?.avatarUrl, user?.photoURL);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={m.settings.title} className="max-w-md">
        <div className="space-y-5">
          {/* ── User Profile Card ── */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20">
            <div className="flex items-start gap-4">
              <ProfileAvatar
                src={avatarSrc}
                initial={userInitial}
                alt=""
                shape="rounded"
                className="h-14 w-14 shadow-sm"
                fallbackClassName="bg-primary text-on-primary font-headline-md text-headline-md font-bold"
              />
              <div className="flex-1 min-w-0">
                {isEditingName ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      aria-label={m.profile.displayName}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                        if (e.key === 'Escape') {
                          setIsEditingName(false);
                          setDisplayName(profile?.displayName || '');
                        }
                      }}
                      placeholder={m.profile.enterYourName}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-label-lg text-label-lg font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveName}
                        className="flex-1 py-1.5 bg-primary text-on-primary rounded-lg font-label-sm text-label-sm font-bold hover:bg-primary/90 transition-all"
                      >{m.common.save}</button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingName(false);
                          setDisplayName(profile?.displayName || '');
                        }}
                        className="flex-1 py-1.5 bg-surface-variant text-on-surface-variant rounded-lg font-label-sm text-label-sm font-bold hover:bg-surface-variant/80 transition-all"
                      >{m.common.cancel}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                        {profile?.displayName || m.profile.setYourName}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingName(true);
                          setDisplayName(profile?.displayName || '');
                        }}
                        className="p-1 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                        title={m.profile.editName}
                        aria-label={m.profile.editName}
                      >
                        <AppIcon name="edit" className="text-[14px]" />
                      </button>
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant truncate mt-0.5">
                      {user?.email || m.auth.anonymousUser}
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-2 rounded-full bg-primary/10 text-primary">
                      <AppIcon name={profile?.plan === 'pro' ? 'workspace_premium' : 'person'} className="text-[14px]" />
                      <span className="font-label-sm text-label-sm font-bold">
                        {t(m.auth.planLabel, { plan: profile?.plan === 'pro' ? m.profile.links.pro : m.profile.free })}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Upgrade CTA ── */}
          {onOpenProModal && canShowProUpgrade(profile?.plan === 'pro', workspace) && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full bg-primary hover:bg-primary/90 text-on-primary py-3.5 rounded-xl font-label-lg text-label-lg font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <AppIcon name="workspace_premium" className="text-[20px]" />
              <span>{m.profile.upgradeToPro}</span>
            </button>
          )}

          {/* ── Preferences Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">{m.profile.subpages.preferencesTitle}</h3>
            <div className="bg-surface-container rounded-xl border border-outline-variant/50 divide-y divide-outline-variant/30">
              {/* Currency */}
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
                    <AppIcon name="payments" className="text-[20px] text-primary" />
                  </div>
                  <span className="font-label-lg text-label-lg font-medium text-on-surface">{m.settings.preferredCurrency}</span>
                </div>
                <CustomSelect
                  ariaLabel={m.settings.preferredCurrency}
                  value={configuredCurrency}
                  disabled={workspace === 'household' && !isOwner}
                  onChange={(value) => {
                    if (value !== configuredCurrency) setPendingCurrency(value);
                  }}
                  options={currencyOptions}
                  className="w-32 shrink-0"
                  triggerClassName="!h-10 !rounded-lg !border-0 !bg-surface-variant !px-3"
                />
              </div>
              {currency !== configuredCurrency && (
                <p className="px-4 py-2 text-xs text-on-surface-variant">
                  {t(m.settings.historicalCurrencyActive, { currency })}
                </p>
              )}

              {/* Language */}
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
                    <AppIcon name="language" className="text-[20px] text-primary" />
                  </div>
                  <span className="font-label-lg text-label-lg font-medium text-on-surface">{m.settings.language}</span>
                </div>
                <CustomSelect
                  ariaLabel={m.settings.language}
                  value={language}
                  onChange={(value) => setLanguage(value as 'en' | 'fr' | 'ar')}
                  options={languageOptions}
                  className="w-32 shrink-0"
                  triggerClassName="!h-10 !rounded-lg !border-0 !bg-surface-variant !px-3"
                />
              </div>
            </div>
          </div>

          {/* ── Appearance Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">{m.settings.appearanceMode}</h3>
            <div className="bg-surface-container rounded-xl border border-outline-variant/50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
                  <AppIcon name="palette" className="text-[20px] text-primary" />
                </div>
                <span className="font-label-lg text-label-lg font-medium text-on-surface">{m.profile.theme}</span>
              </div>
              {/* Sliding segmented control — active pill glides between themes. */}
              <SegmentedControl
                ariaLabel={m.profile.theme}
                value={currentTheme}
                onChange={(v) => handleThemeChange(v as 'light' | 'dark' | 'system')}
                options={[
                  { value: 'light', label: m.settings.light, icon: 'light_mode' },
                  { value: 'dark', label: m.settings.dark, icon: 'dark_mode' },
                  { value: 'system', label: m.settings.system, icon: 'desktop_windows' },
                ]}
              />
            </div>
          </div>

          {/* ── Budget Month (monthly start date) ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">{m.navigation.customBudgetMonth}</h3>
            <div className="bg-surface-container rounded-xl border border-outline-variant/50 p-4">
              <MonthlyStartDateControl
                compact
                value={workspace === 'household' ? household?.monthStartDate : profile?.monthStartDate}
                disabled={workspace === 'household' && !isOwner}
                onChange={(day) => setPendingStartDay(day || 1)}
              />
            </div>
          </div>

          {/* ── Data Management Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">{m.settings.dataManagement}</h3>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors border border-outline-variant/50 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <AppIcon name="download" className="text-[20px] text-primary" />
                </div>
                <span className="font-label-lg text-label-lg font-medium text-on-surface">{m.settings.exportBudgetData}</span>
              </div>
              <AppIcon name="chevron_right" className="text-[20px] text-on-surface-variant group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteDataConfirm(true)}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-error/5 hover:bg-error/10 transition-colors border border-error/30 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center group-hover:bg-error/20 transition-colors">
                  <AppIcon name="delete_forever" className="text-[20px] text-error" />
                </div>
                <span className="font-label-lg text-label-lg font-medium text-error">{m.profile.data.deleteAllData}</span>
              </div>
              <AppIcon name="chevron_right" className="text-[20px] text-error/70 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* ── Install App (moved here from the dashboard header) ── */}
          <div className="flex justify-center pt-1">
            <InstallButton />
          </div>

          {/* ── Account Actions ── */}
          <div className="space-y-2 pt-2">
            {user || demoMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-3 rounded-xl border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-lg text-label-lg font-medium transition-all cursor-pointer"
                >{m.auth.signOut}</button>
                {user && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 text-error hover:bg-error/5 rounded-xl font-label-lg text-label-lg font-medium transition-all cursor-pointer"
                  >{m.auth.deleteAccount}</button>
                )}
              </>
            ) : (
              <a
                href="/login"
                className="w-full text-center py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold hover:bg-primary/90 transition-all shadow-sm block"
              >{m.auth.signIn}</a>
            )}
          </div>

          {/* ── Legal Links ── */}
          <div className="flex justify-center gap-4 pt-3 text-[12px] font-medium text-on-surface-variant">
            <a href="/privacy" className="hover:text-primary transition-colors">{m.settings.privacyPolicy}</a>
            <span className="text-outline-variant">·</span>
            <a href="/terms" className="hover:text-primary transition-colors">{m.settings.termsOfService}</a>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingCurrency)}
        onClose={() => setPendingCurrency(null)}
        onConfirm={() => {
          if (pendingCurrency) void setCurrency(pendingCurrency);
          setPendingCurrency(null);
        }}
        title={m.settings.currencyChangeTitle}
        message={pendingCurrency ? t(m.settings.currencyChangeFutureOnly, {
          current: configuredCurrency,
          next: pendingCurrency,
        }) : ''}
        confirmLabel={m.settings.useForFuturePeriods}
      />

      <ConfirmDialog
        isOpen={pendingStartDay !== null}
        onClose={() => setPendingStartDay(null)}
        onConfirm={() => {
          if (pendingStartDay !== null) {
            if (workspace === 'household') void updateConfiguration({ monthStartDate: pendingStartDay });
            else void updateProfileData({ monthStartDate: pendingStartDay });
          }
          setPendingStartDay(null);
        }}
        title={m.settings.periodChangeTitle}
        message={pendingStartDay !== null ? t(m.settings.periodChangeFutureOnly, { day: pendingStartDay }) : ''}
        confirmLabel={m.settings.useForFuturePeriods}
      />

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
          onClose();
          router.replace('/login');
        }}
        title={m.auth.signOutConfirmTitle}
        message={m.auth.signOutConfirmMessage}
        confirmLabel={m.auth.signOut}
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteAccount();
          onClose();
        }}
        title={m.auth.deleteConfirmTitle}
        message={m.auth.deleteConfirmMessage}
        confirmLabel={m.auth.deleteAccount}
        isDestructive
      />

      <ConfirmDialog
        isOpen={showDeleteDataConfirm}
        onClose={() => setShowDeleteDataConfirm(false)}
        onConfirm={async () => {
          await deleteAllData();
          onClose();
        }}
        title={m.profile.data.deleteAllData}
        message={m.profile.data.deleteAllDataMessage}
        confirmLabel={m.profile.data.deleteAllData}
        isDestructive
      />
    </>
  );
}
