import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { SUPPORTED_CURRENCIES } from '../../lib/currency';
import { useCurrency } from '../../lib/currency-context';
import { useAuth } from '../../lib/auth-context';
import { exportMonthToCsv, downloadCsv } from '../../lib/export';
import { MonthBudget, SavingGoal } from '../../lib/store';
import { CustomSelect } from '../ui/CustomSelect';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const currentTheme = profile?.theme || 'system';

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    updateProfileData({ theme });
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
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Settings & Account">
        <div className="flex flex-col gap-xl">
          {/* User Email & Account Info */}
          {user && (
            <div className="p-6 bg-surface-container rounded-3xl border border-outline-variant flex items-center justify-between">
              <div className="flex flex-col gap-sm">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                  Signed in as
                </span>
                <span className="font-body-lg text-body-lg text-on-surface font-medium truncate max-w-[220px]">
                  {user.email || 'Anonymous User'}
                </span>
              </div>
              <span className="px-3 py-1.5 bg-primary/10 text-primary font-label-md text-label-md rounded-full font-semibold">
                {profile?.plan || 'Free'} Plan
              </span>
            </div>
          )}

          {/* Go to Premium */}
          {profile?.plan !== 'pro' && onOpenProModal && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-tertiary text-on-primary font-body-md text-body-md font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined text-[20px]">workspace_premium</span>
              <span>Go to Premium</span>
            </button>
          )}

          {profile?.plan === 'pro' && onOpenProModal && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="w-full py-4 rounded-2xl bg-primary/10 text-primary font-body-md text-body-md font-semibold border border-primary/20 hover:bg-primary/15 transition-all flex items-center justify-center gap-sm"
            >
              <span className="material-symbols-outlined text-[20px]">verified</span>
              <span>Pro Membership</span>
            </button>
          )}

          {/* Currency Selection */}
          <CustomSelect
            label="Preferred Currency"
            value={currency}
            onChange={setCurrency}
            options={Object.values(SUPPORTED_CURRENCIES).map((c) => ({
              value: c.code,
              label: `${c.code} — ${c.name} (${c.symbol})`,
            }))}
          />

          {/* Appearance / Theme */}
          <div className="flex flex-col gap-sm">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Appearance Mode
            </label>
            <div className="grid grid-cols-3 gap-sm">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThemeChange(t)}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-sm transition-all capitalize font-label-md text-label-md ${
                    currentTheme === t
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {t === 'light' ? 'light_mode' : t === 'dark' ? 'dark_mode' : 'desktop_windows'}
                  </span>
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Export Data */}
          <div className="flex flex-col gap-sm">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Data Management
            </label>
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full p-4 rounded-xl border border-outline-variant bg-surface hover:bg-surface-variant/50 flex items-center justify-between font-body-md text-body-md text-on-surface transition-colors"
            >
              <div className="flex items-center gap-md">
                <span className="material-symbols-outlined text-primary text-[20px]">download</span>
                <span>Export Budget Data (CSV)</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
                chevron_right
              </span>
            </button>
          </div>

          {/* Account Actions */}
          <div className="flex flex-col gap-sm pt-xl border-t border-surface-variant">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-4 rounded-xl border border-outline-variant text-on-surface hover:bg-surface-variant/50 font-body-md text-body-md font-medium transition-colors"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full py-4 rounded-xl border border-error/30 text-error hover:bg-error-container/50 font-body-md text-body-md font-medium transition-colors"
                >
                  Delete Account & Erase Data
                </button>
              </>
            ) : (
              <a
                href="/login"
                className="w-full text-center py-4 rounded-xl bg-primary text-on-primary font-body-md text-body-md font-semibold hover:bg-primary/90 transition-colors"
              >
                Sign In or Register Account
              </a>
            )}
          </div>

          {/* Legal Links */}
          <div className="flex justify-center gap-md pt-sm text-label-sm font-label-sm text-on-surface-variant">
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

      {/* Sign Out Confirm */}
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

      {/* Delete Account Confirm */}
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
