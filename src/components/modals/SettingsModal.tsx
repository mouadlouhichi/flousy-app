import { AppIcon } from '@/components/ui/app-icon';
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { useCurrency } from '../../lib/currency-context';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n-context';
import { exportMonthToCsv, downloadCsv } from '../../lib/export';
import { MonthBudget, SavingGoal } from '../../lib/store';
import { CustomSelect } from '../ui/CustomSelect';
import { trackEvent } from '../../lib/analytics';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  goals: SavingGoal[];
  monthKey: string;
  onOpenProModal?: () => void;
}

export function SettingsModal({ isOpen, onClose, month, goals, monthKey, onOpenProModal }: SettingsModalProps) {
  const { currency, setCurrency } = useCurrency();
  const { user, profile, signOut, deleteAccount, updateProfileData } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const currentTheme = profile?.theme || 'system';

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

  const handleExportCsv = () => {
    const csvContent = exportMonthToCsv(month, goals, monthKey, currency);
    downloadCsv(`flousy-budget-${monthKey}.csv`, csvContent);
    trackEvent('export_csv');
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || 'M';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings & Account" className="max-w-md">
        <div className="space-y-5">
          {/* ── User Profile Card ── */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center font-headline-md text-headline-md font-bold shadow-sm">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-label-lg text-label-lg font-bold text-on-surface truncate">
                  {user?.email || 'mouadlouhichi@gmail.com'}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mt-1.5 rounded-full bg-primary/10 text-primary">
                  <AppIcon name={profile?.plan === 'pro' ? 'workspace_premium' : 'person'} className="text-[14px]" />
                  <span className="font-label-sm text-label-sm font-bold">
                    {profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Upgrade CTA ── */}
          {onOpenProModal && profile?.plan !== 'pro' && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full bg-primary hover:bg-primary/90 text-on-primary py-3.5 rounded-xl font-label-lg text-label-lg font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <AppIcon name="workspace_premium" className="text-[20px]" />
              <span>Upgrade to Pro</span>
            </button>
          )}

          {/* ── Preferences Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">
              Preferences
            </h3>
            <div className="bg-surface-container rounded-xl border border-outline-variant/50 divide-y divide-outline-variant/30">
              {/* Currency */}
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
                    <AppIcon name="payments" className="text-[20px] text-primary" />
                  </div>
                  <label className="font-label-lg text-label-lg font-medium text-on-surface">
                    Currency
                  </label>
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-surface-variant border-0 rounded-lg px-3 py-2 font-label-md text-label-md font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer min-w-[120px]"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div className="flex items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center shrink-0">
                    <AppIcon name="language" className="text-[20px] text-primary" />
                  </div>
                  <label className="font-label-lg text-label-lg font-medium text-on-surface">
                    Language
                  </label>
                </div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
                  className="bg-surface-variant border-0 rounded-lg px-3 py-2 font-label-md text-label-md font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer min-w-[120px]"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Appearance Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">
              Appearance
            </h3>
            <div className="bg-surface-container rounded-xl border border-outline-variant/50 p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center">
                  <AppIcon name="palette" className="text-[20px] text-primary" />
                </div>
                <label className="font-label-lg text-label-lg font-medium text-on-surface">
                  Theme
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-surface-variant/50 p-1.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-md font-label-md text-label-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'light'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="light_mode" className="text-[20px]" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-md font-label-md text-label-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'dark'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="dark_mode" className="text-[20px]" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-md font-label-md text-label-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'system'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="desktop_windows" className="text-[20px]" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── Data Management Section ── */}
          <div className="space-y-3">
            <h3 className="font-label-md text-label-md font-bold text-on-surface-variant uppercase tracking-wider px-1">
              Data
            </h3>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full flex items-center justify-between p-4 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors border border-outline-variant/50 cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-surface-variant flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <AppIcon name="download" className="text-[20px] text-primary" />
                </div>
                <span className="font-label-lg text-label-lg font-medium text-on-surface">Export CSV</span>
              </div>
              <AppIcon name="chevron_right" className="text-[20px] text-on-surface-variant group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* ── Account Actions ── */}
          <div className="space-y-2 pt-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-3 rounded-xl border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-lg text-label-lg font-medium transition-all cursor-pointer"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 text-error hover:bg-error/5 rounded-xl font-label-lg text-label-lg font-medium transition-all cursor-pointer"
                >
                  Delete Account
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="w-full text-center py-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold hover:bg-primary/90 transition-all shadow-sm block"
              >
                Sign In
              </a>
            )}
          </div>

          {/* ── Legal Links ── */}
          <div className="flex justify-center gap-4 pt-3 text-[12px] font-medium text-on-surface-variant">
            <a href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </a>
            <span className="text-outline-variant">·</span>
            <a href="/terms" className="hover:text-primary transition-colors">
              Terms
            </a>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={async () => {
          await signOut();
          onClose();
        }}
        title="Sign Out"
        message="Are you sure you want to sign out of your Flousy account?"
        confirmLabel="Sign Out"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          await deleteAccount();
          onClose();
        }}
        title="Delete Account Permanently"
        message="This action is irreversible. All your budget data, expenses, and savings goals will be permanently deleted from Firestore."
        confirmLabel="Delete Account"
        isDestructive
      />
    </>
  );
}
