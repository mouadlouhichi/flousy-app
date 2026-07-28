'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  const { profile, updateProfileData } = useAuth();
  const { format } = useCurrency();
  const { t } = useLanguage();

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isPro = profile?.plan === 'pro';

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Pro upgrade is managed via secure payment webhook / backend integration.
      // Direct client mutation of user.plan is forbidden by Firestore security rules.
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDowngrade = async () => {
    setLoading(true);
    try {
      await updateProfileData({ plan: 'free' });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isPro ? 'Flousy Pro Membership' : 'Upgrade to Flousy Pro'}>
      <div className="flex flex-col gap-4 sm:gap-md">
        {/* Hero Banner */}
        <div className="p-5 sm:p-lg rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-tertiary text-on-primary shadow-lg flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-surface/10 rounded-full blur-2xl pointer-events-none" />
          <span className="material-symbols-outlined text-[40px] sm:text-[48px] mb-2 font-light">workspace_premium</span>
          <h3 className="font-headline-sm sm:font-headline-md text-headline-sm sm:text-headline-md font-extrabold tracking-tight">
            {isPro ? 'You are a Pro Member!' : 'Unlock Full Budgeting Power'}
          </h3>
          <p className="font-body-sm sm:font-body-md text-body-sm sm:text-body-md text-on-primary/90 max-w-md mt-1 leading-relaxed">
            {isPro
              ? 'Thank you for supporting Flousy. All premium features, multi-month analytics, CSV import, and household tools are active.'
              : 'Take total control of your money with multi-month trends, CSV imports, receipt attachments, and household budgeting.'}
          </p>
        </div>

        {!isPro ? (
          <>
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center p-1 bg-surface-container rounded-xl border border-outline-variant max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-label-md text-label-md font-bold transition-all ${
                  billingCycle === 'monthly' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Monthly ($4.99/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`flex-1 py-1.5 px-3 rounded-lg font-label-md text-label-md font-bold transition-all relative ${
                  billingCycle === 'annual' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                Annual ($39.99/yr)
                <span className="absolute -top-2 -right-1 bg-tertiary text-on-tertiary text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                  SAVE 33%
                </span>
              </button>
            </div>

            {/* Feature List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant flex gap-2 items-start">
                <span className="material-symbols-outlined text-primary text-[22px]">analytics</span>
                <div>
                  <h4 className="font-label-lg text-label-lg font-bold text-on-surface">Multi-Month Trends</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Compare spending trends across months and forecast savings.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant flex gap-2 items-start">
                <span className="material-symbols-outlined text-primary text-[22px]">upload_file</span>
                <div>
                  <h4 className="font-label-lg text-label-lg font-bold text-on-surface">CSV Data Import</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Import transactions directly from bank statements or CSV files.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant flex gap-2 items-start">
                <span className="material-symbols-outlined text-primary text-[22px]">receipt</span>
                <div>
                  <h4 className="font-label-lg text-label-lg font-bold text-on-surface">Receipt Attachments</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Attach receipt photos and notes to any variable or fixed bill.</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant flex gap-2 items-start">
                <span className="material-symbols-outlined text-primary text-[22px]">group</span>
                <div>
                  <h4 className="font-label-lg text-label-lg font-bold text-on-surface">Household Budgeting</h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Assign expenses to household members (Self, Partner, Family).</p>
                </div>
              </div>
            </div>

            {/* Simulated Payment Trigger */}
            <div className="pt-2 flex flex-col gap-sm">
              <button
                type="button"
                onClick={handleUpgrade}
                disabled={loading || success}
                className="w-full py-2.5 sm:py-3 px-lg bg-primary text-on-primary rounded-xl font-label-md sm:font-label-lg text-label-md sm:text-label-lg font-bold shadow-md hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-xs"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : success ? (
                  <>
                    <span className="material-symbols-outlined">check_circle</span>
                    <span>Pro Activated!</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">lock</span>
                    <span>Activate Pro ({billingCycle === 'annual' ? '$39.99/year' : '$4.99/month'})</span>
                  </>
                )}
              </button>
              <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
                Instant activation. Cancel or downgrade anytime in Settings.
              </p>
            </div>
          </>
        ) : (
          <div className="p-md bg-surface-container rounded-xl border border-outline-variant text-center space-y-sm">
            <p className="font-body-md text-body-md text-on-surface">
              Your Pro status is active on this account.
            </p>
            <button
              type="button"
              onClick={handleDowngrade}
              disabled={loading}
              className="py-2 px-md border border-outline text-error rounded-xl font-label-md text-label-md font-bold hover:bg-error-container/20 transition-colors"
            >
              Switch back to Free Plan
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
