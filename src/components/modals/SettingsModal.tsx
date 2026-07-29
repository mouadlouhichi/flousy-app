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
        <div className="space-y-6">
          {/* ── User Profile Section ── */}
          <div className="bg-surface-container-low rounded-lg p-md border border-outline-variant/30 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center font-headline-md text-headline-md font-semibold">
                {userInitial}
              </div>
              <div>
                <p className="font-body-md text-body-md font-medium text-on-surface truncate max-w-[200px]">
                  {user?.email || 'mouadlouhichi@gmail.com'}
                </p>
                <div className="inline-flex items-center px-2 py-1 mt-1 rounded-full bg-surface-tint/10 text-primary font-label-sm text-label-sm">
                  {profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Primary Action: Upgrade ── */}
          {onOpenProModal && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-lg font-body-lg text-body-lg font-medium transition-colors shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
            >
              <AppIcon name="workspace_premium" className="text-sm text-on-primary" />
              <span>{profile?.plan === 'pro' ? 'Pro Membership' : 'Go to Premium'}</span>
            </button>
          )}

          {/* ── Configuration Sections ── */}
          <div className="space-y-6 pt-sm">
            {/* Preferred Currency */}
            <div className="flex flex-col space-y-2">
              <label className="font-body-md text-body-md font-medium text-on-surface-variant">
                Preferred Currency
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 appearance-none font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
                <AppIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]" />
              </div>
            </div>

            {/* Language */}
            <div className="flex flex-col space-y-2">
              <label className="font-body-md text-body-md font-medium text-on-surface-variant">
                Language
              </label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 appearance-none font-body-md text-body-md text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
                <AppIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]" />
              </div>
            </div>

            {/* Appearance Mode */}
            <div className="flex flex-col space-y-2">
              <label className="font-body-md text-body-md font-medium text-on-surface-variant">
                Appearance
              </label>
              <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-md font-body-md text-body-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'light'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="light_mode" className="text-sm" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-md font-body-md text-body-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'dark'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="dark_mode" className="text-sm" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-md font-body-md text-body-md font-medium transition-all cursor-pointer ${
                    currentTheme === 'system'
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="desktop_windows" className="text-sm" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* ── Data Management ── */}
          <div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface border border-outline-variant/30 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <AppIcon name="download" className="text-on-surface-variant text-[20px]" />
                <span className="font-body-md text-body-md font-medium">Export Budget Data (CSV)</span>
              </div>
              <AppIcon name="chevron_right" className="text-on-surface-variant text-[20px]" />
            </button>
          </div>

          {/* ── Destructive Actions ── */}
          <div className="pt-lg space-y-md">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-3 rounded-lg border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container font-body-md text-body-md font-medium transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-3 text-error hover:bg-error-container/20 rounded-lg font-body-md text-body-md font-medium transition-colors cursor-pointer"
                >
                  Delete Account & Erase Data
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="w-full text-center py-3 rounded-lg bg-primary text-on-primary font-body-md text-body-md font-medium hover:bg-primary-container transition-colors block"
              >
                Sign In or Register Account
              </a>
            )}
          </div>

          {/* ── Legal Links ── */}
          <div className="flex justify-center gap-4 pt-1 text-[12px] font-medium text-on-surface-variant">
            <a href="/privacy" className="hover:text-on-surface transition-colors">
              Privacy Policy
            </a>
            <span className="text-outline-variant">·</span>
            <a href="/terms" className="hover:text-on-surface transition-colors">
              Terms of Service
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
