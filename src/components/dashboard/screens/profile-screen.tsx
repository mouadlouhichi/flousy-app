'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppIcon } from '@/components/ui/app-icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth-context';
import { useCurrency } from '@/lib/currency-context';
import { useLanguage } from '@/lib/i18n-context';
import { SUPPORTED_CURRENCIES } from '@/lib/currency';
import { exportMonthToCsv, downloadCsv } from '@/lib/export';
import { PRO_FEATURES } from '@/lib/pro-features';
import { trackEvent } from '@/lib/analytics';
import { useDashboard } from '../dashboard-provider';
import { HouseholdModal } from '@/components/modals/HouseholdModal';

/**
 * Account / profile page.
 *
 * Reachable from the user avatar in the header (mobile) and the sidebar
 * footer (desktop). Doubles as the Pro showcase: pro members see everything
 * their plan unlocks, free users get the same list as an upgrade pitch.
 */
export function ProfileScreen() {
  const { user, profile, signOut, deleteAccount, updateProfileData } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage } = useLanguage();
  const { month, goals, currentMonthKey, isPro, openProModal, openCsvModal, openIncomeModal } =
    useDashboard();

  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [householdOpen, setHouseholdOpen] = useState(false);

  const currentTheme = profile?.theme || 'system';
  const userInitial = (profile?.displayName || user?.email)?.[0]?.toUpperCase() || 'M';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateProfileData({ theme });
    trackEvent('change_theme', { theme });
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
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
    downloadCsv(
      `flousy-budget-${currentMonthKey}.csv`,
      exportMonthToCsv(month, goals, currentMonthKey, currency),
    );
    trackEvent('export_csv');
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* ── Identity card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 sm:p-6">
        {/* Soft decorative glow, clipped by the card's overflow-hidden. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-2xl font-extrabold text-on-primary shadow-md ring-4 ring-surface">
              {userInitial}
            </div>
            {isPro && (
              <span
                title="Pro member"
                className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm ring-2 ring-surface"
              >
                <AppIcon name="workspace_premium" className="text-[13px]" />
              </span>
            )}
          </div>

          <div className="w-full min-w-0 flex-1">
            {isEditingName ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setIsEditingName(false);
                      setDisplayName(profile?.displayName || '');
                    }
                  }}
                  placeholder="Enter your name"
                  autoFocus
                  className="w-full rounded-xl border border-outline-variant bg-surface px-3 py-2 text-sm font-bold text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveName}
                    className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setDisplayName(profile?.displayName || '');
                    }}
                    className="flex-1 rounded-xl border border-outline-variant py-2 text-xs font-bold text-on-surface-variant transition-all hover:bg-surface-variant/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Name, plan badge and edit affordance share one row.
                    `min-w-0` on the name lets it truncate instead of forcing
                    the row wider; `shrink-0` on the badge and button keeps
                    them at their natural size so a long name ellipses rather
                    than squashing them. */}
                <div className="flex min-w-0 items-center justify-center gap-2 sm:justify-start">
                  <p className="min-w-0 truncate text-xl font-extrabold leading-tight text-on-surface">
                    {profile?.displayName || 'Set your name'}
                  </p>

                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none ${
                      isPro
                        ? 'bg-amber-400/15 text-amber-700 ring-1 ring-inset ring-amber-400/40 dark:text-amber-300'
                        : 'bg-primary/10 text-primary ring-1 ring-inset ring-primary/20'
                    }`}
                  >
                    <AppIcon
                      name={isPro ? 'workspace_premium' : 'person'}
                      className="text-[13px]"
                    />
                    {isPro ? 'Pro Plan' : 'Free Plan'}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(true);
                      setDisplayName(profile?.displayName || '');
                    }}
                    aria-label="Edit name"
                    title="Edit name"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <AppIcon name="edit" className="text-[14px]" />
                  </button>
                </div>

                <p
                  title={user?.email || undefined}
                  className="mt-0.5 truncate text-sm text-on-surface-variant"
                >
                  {user?.email}
                </p>

                {!isPro && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={openProModal}
                      className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
                    >
                      <AppIcon name="workspace_premium" className="text-[13px]" />
                      Upgrade
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Pro features ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">
            {isPro ? 'Your Pro Features' : 'Unlock with Pro'}
          </h2>
          {isPro && (
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
                isPro
                  ? 'border-primary/25 bg-surface-container'
                  : 'border-outline-variant bg-surface-container/60'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isPro ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'
                }`}
              >
                <AppIcon name={feature.icon} className="text-[20px]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-on-surface">{feature.title}</h3>
                  {!isPro && (
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

        {isPro ? (
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
            <button
              type="button"
              onClick={() => setHouseholdOpen(true)}
              className="flex items-center justify-between rounded-2xl border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:bg-surface-container-high"
            >
              <span className="flex items-center gap-3">
                <AppIcon name="family_restroom" className="text-[20px] text-primary" />
                <span className="text-sm font-bold text-on-surface">Manage Household</span>
              </span>
              <AppIcon name="chevron_right" className="text-[18px] text-on-surface-variant" />
            </button>
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
        ) : (
          <button
            type="button"
            onClick={openProModal}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            <AppIcon name="workspace_premium" className="text-[20px]" />
            <span>Upgrade to Pro</span>
          </button>
        )}
      </section>

      {/* ── Preferences ── */}
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">
          Preferences
        </h2>

        <div className="divide-y divide-outline-variant/30 rounded-2xl border border-outline-variant bg-surface-container">
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
                <AppIcon name="payments" className="text-[20px] text-primary" />
              </span>
              <label htmlFor="profile-currency" className="text-sm font-medium text-on-surface">
                Currency
              </label>
            </span>
            <select
              id="profile-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="min-w-[120px] cursor-pointer rounded-lg border-0 bg-surface-variant px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-3 p-4">
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
                <AppIcon name="language" className="text-[20px] text-primary" />
              </span>
              <label htmlFor="profile-language" className="text-sm font-medium text-on-surface">
                Language
              </label>
            </span>
            <select
              id="profile-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
              className="min-w-[120px] cursor-pointer rounded-lg border-0 bg-surface-variant px-3 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="ar">العربية</option>
            </select>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-variant">
                <AppIcon name="palette" className="text-[20px] text-primary" />
              </span>
              <span className="text-sm font-medium text-on-surface">Theme</span>
            </div>
            <SegmentedControl
              ariaLabel="Theme"
              value={currentTheme}
              onChange={(v) => handleThemeChange(v as 'light' | 'dark' | 'system')}
              options={[
                { value: 'light', label: 'Light', icon: 'light_mode' },
                { value: 'dark', label: 'Dark', icon: 'dark_mode' },
                { value: 'system', label: 'System', icon: 'desktop_windows' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Data ── */}
      <section className="flex flex-col gap-3">
        <h2 className="px-1 text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">
          Data
        </h2>
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
      </section>

      {/* ── Account actions ── */}
      <section className="flex flex-col gap-2 pt-1">
        {user ? (
          <>
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full rounded-2xl border border-outline-variant py-3.5 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface"
            >
              Sign Out
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full rounded-2xl py-3.5 text-sm font-medium text-error transition-all hover:bg-error/5"
            >
              Delete Account
            </button>
          </>
        ) : (
          <a
            href="/login"
            className="block w-full rounded-2xl bg-primary py-3.5 text-center text-sm font-bold text-on-primary shadow-sm transition-all hover:bg-primary/90"
          >
            Sign In
          </a>
        )}

        <div className="flex justify-center gap-4 pt-3 text-xs font-medium text-on-surface-variant">
          <a href="/privacy" className="transition-colors hover:text-primary">
            Privacy
          </a>
          <span className="text-outline-variant">·</span>
          <a href="/terms" className="transition-colors hover:text-primary">
            Terms
          </a>
        </div>
      </section>

      <HouseholdModal isOpen={householdOpen} onClose={() => setHouseholdOpen(false)} onOpenPro={openProModal} month={month} />

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
        }}
        title="Sign Out"
        message="Are you sure you want to sign out of your SmartJib account?"
        confirmLabel="Sign Out"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteAccount();
        }}
        title="Delete Account Permanently"
        message="This action is irreversible. All your budget data, expenses, and savings goals will be permanently deleted."
        confirmLabel="Delete Account"
        isDestructive
      />
    </div>
  );
}
