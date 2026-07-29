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
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName || '');

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

  const userInitial = (profile?.displayName || user?.email)?.[0]?.toUpperCase() || 'M';

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings & Account" className="max-w-md">
        <div className="space-y-6">
          {/* ── User Profile Section ── */}
          <div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/30 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center text-xl font-bold shrink-0">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">
                  {user?.email || profile?.displayName || 'mouadlouhichi@gmail.com'}
                </p>
                <div className="inline-flex items-center px-2 py-1 mt-1 rounded-full bg-surface-tint/10 text-primary text-xs font-semibold">
                  {profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan'}
                </div>
              </div>
            </div>
          </div>

          {/* ── Primary Action: Upgrade ── */}
          {onOpenProModal && profile?.plan !== 'pro' && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full bg-primary hover:bg-primary-container text-on-primary rounded-xl text-base font-bold transition-all shadow-md flex items-center justify-center space-x-3 py-3 cursor-pointer"
            >
              <AppIcon name="workspace_premium" className="text-lg" />
              <span className="tracking-wide">Go to Premium</span>
            </button>
          )}

          {/* ── Configuration Sections ── */}
          <div className="pt-2 space-y-4">
            {/* Preferred Currency */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-on-surface-variant mb-1">
                Preferred Currency
              </label>
              <div className="relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 appearance-none text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                >
                  {Object.values(SUPPORTED_CURRENCIES).map((c) => (
                    <option key={c.code} value={c.code}>
                      {`${c.code} - ${c.name}`}
                    </option>
                  ))}
                </select>
                <AppIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]" />
              </div>
            </div>

            {/* Language */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-on-surface-variant mb-1">
                Language
              </label>
              <div className="relative">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'fr' | 'ar')}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-lg p-3 appearance-none text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors cursor-pointer"
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
                <AppIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]" />
              </div>
            </div>

            {/* Appearance */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-on-surface-variant mb-1">
                Appearance
              </label>
              <div className="flex bg-surface-container-low p-1 rounded-full border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    currentTheme === 'light'
                      ? 'bg-surface shadow-xs text-primary font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="light_mode" className="text-sm" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    currentTheme === 'dark'
                      ? 'bg-surface shadow-xs text-primary font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="dark_mode" className="text-sm" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
                    currentTheme === 'system'
                      ? 'bg-surface shadow-xs text-primary font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <AppIcon name="settings_suggest" className="text-sm" />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          <hr className="border-outline-variant/30" />

          {/* ── Data Management Section ── */}
          <div>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full flex items-center justify-between rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface border border-outline-variant/30 p-2 cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <AppIcon name="download" className="text-on-surface-variant text-[20px]" />
                <span className="text-sm font-medium">Export Budget Data (CSV)</span>
              </div>
              <AppIcon name="chevron_right" className="text-on-surface-variant text-[20px]" />
            </button>
          </div>

          {/* ── Destructive Actions / Sign Out ── */}
          <div className="pt-4 space-y-2">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-3 rounded-xl border border-outline-variant/50 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-2 text-error/70 hover:text-error text-sm font-medium transition-colors text-center cursor-pointer block"
                >
                  Delete Account & Erase Data
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="w-full text-center py-3 rounded-xl border border-outline-variant/50 text-on-surface text-sm font-medium hover:bg-surface-container transition-colors block"
              >
                Sign In
              </a>
            )}
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
