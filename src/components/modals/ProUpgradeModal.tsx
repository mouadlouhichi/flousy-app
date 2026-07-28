'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';
import {
  type BillingCycle,
  PRO_PRICING,
  createCheckoutSession,
  processPayment,
  upgradeUserPlan,
  getNextBillingDate,
} from '../../lib/payments';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutStep = 'plan' | 'card' | 'processing' | 'receipt' | 'error';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Masked card number display */
function maskCard(num: string): string {
  return `•••• •••• •••• ${num.slice(-4)}`;
}

/** Format cents to a currency string */
function fmtPrice(cents: number): string {
  return `$${(cents).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  const { user, profile, updateProfileData } = useAuth();
  const { format } = useCurrency();
  const { t } = useLanguage();

  const isDemo = typeof window !== 'undefined' && localStorage.getItem('flousy_demo_mode') === 'true';
  const isPro = profile?.plan === 'pro';

  // -- Checkout state --
  const [step, setStep] = useState<CheckoutStep>('plan');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // -- Processing state --
  const [progressText, setProgressText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [nextBilling, setNextBilling] = useState('');
  const [receiptEmail, setReceiptEmail] = useState(user?.email || '');

  // -----------------------------------------------------------------------
  // Reset state when modal opens
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setStep(isPro ? 'receipt' : 'plan');
      setBillingCycle('annual');
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
      setCardName('');
      setCardErrors({});
      setProgressText('');
      setSessionId('');
      setTransactionId('');
      setNextBilling('');
      setReceiptEmail(user?.email || '');
    }
  }, [isOpen, isPro, user?.email]);

  // -----------------------------------------------------------------------
  // Card input formatting
  // -----------------------------------------------------------------------
  const formatCardNumber = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  const formatCvc = (val: string) => val.replace(/\D/g, '').slice(0, 4);

  // -----------------------------------------------------------------------
  // Simulated Stripe Checkout flow
  // -----------------------------------------------------------------------
  const handleStartCheckout = useCallback(() => {
    setCardErrors({});
    setStep('card');
  }, []);

  const handleSubmitCard = useCallback(async () => {
    const errors: Record<string, string> = {};

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 16) {
      errors.cardNumber = 'Enter a valid card number';
    }
    if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
      errors.cardExpiry = 'Enter a valid expiry (MM/YY)';
    }
    if (cardCvc.length < 3) {
      errors.cardCvc = 'Enter a valid CVC';
    }
    if (!cardName.trim()) {
      errors.cardName = 'Enter the name on card';
    }
    if (!receiptEmail.trim()) {
      errors.receiptEmail = 'Enter a receipt email';
    }

    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }

    // 1) Create checkout session
    setStep('processing');
    setProgressText('Creating secure checkout session…');

    const session = await createCheckoutSession(billingCycle, user?.uid);
    setSessionId(session.id);

    // 2) Simulate card validation (3DS / bank auth)
    setProgressText('Validating card with issuing bank…');
    await new Promise((r) => setTimeout(r, 1200));

    // 3) Process payment
    setProgressText('Processing payment…');
    const { receipt } = await processPayment(session);

    setTransactionId(receipt.transactionId);
    setNextBilling(receipt.nextBillingDate);

    // 4) Upgrade the user's plan
    setProgressText('Activating Pro features…');

    const setDemoPlan = (plan: 'pro') => {
      localStorage.setItem('flousy_pro_plan', 'true');
      // Also store the billing cycle for receipt display
      localStorage.setItem('flousy_pro_billing', billingCycle);
      localStorage.setItem('flousy_pro_next_billing', receipt.nextBillingDate);
    };

    await upgradeUserPlan(user?.uid, billingCycle, updateProfileData, setDemoPlan);

    // 5) Show receipt
    await new Promise((r) => setTimeout(r, 600));
    setStep('receipt');
  }, [cardNumber, cardExpiry, cardCvc, cardName, receiptEmail, billingCycle, user?.uid, updateProfileData]);

  // -----------------------------------------------------------------------
  // Price helpers
  // -----------------------------------------------------------------------
  const price = billingCycle === 'annual' ? PRO_PRICING.annual : PRO_PRICING.monthly;
  const monthlyEquivalent = billingCycle === 'annual'
    ? (PRO_PRICING.annual / 12).toFixed(2)
    : PRO_PRICING.monthly.toFixed(2);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isPro ? 'Flousy Pro' : 'Upgrade to Flousy Pro'}>
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* ─────────────────────── HERO BANNER ─────────────────────── */}
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-tertiary text-on-primary shadow-lg flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-surface/10 rounded-full blur-2xl pointer-events-none" />
          <span className="material-symbols-outlined text-[40px] sm:text-[48px] mb-2 font-light">
            {step === 'receipt' ? 'verified' : 'workspace_premium'}
          </span>
          <h3 className="font-headline-sm sm:font-headline-md text-headline-sm sm:text-headline-md font-extrabold tracking-tight">
            {isPro ? 'You are a Pro Member!' : 'Unlock Full Budgeting Power'}
          </h3>
          <p className="font-body-sm sm:font-body-md text-body-sm sm:text-body-md text-on-primary/90 max-w-md mt-1 leading-relaxed">
            {isPro
              ? 'Thank you for supporting Flousy. All premium features are active.'
              : 'Multi-month trends, CSV imports, receipt attachments, and household budgeting.'}
          </p>
        </div>

        {/* ─────────────────────── ALREADY PRO ─────────────────────── */}
        {isPro && (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-surface-container rounded-xl border border-outline-variant flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[28px]">check_circle</span>
              <div>
                <p className="font-body-md text-body-md font-bold text-on-surface">Pro plan is active</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {localStorage.getItem('flousy_pro_next_billing')
                    ? `Next billing: ${localStorage.getItem('flousy_pro_next_billing')}`
                    : 'All premium features unlocked.'}
                </p>
              </div>
            </div>
            {profile?.plan !== 'pro' && (
              <p className="font-body-sm text-body-sm text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-200">
                ⚡ Your plan is set locally (demo mode). Sign in with Firebase and complete a real Stripe
                Checkout to persist Pro across devices.
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* ─────────────────────── STEP: PLAN SELECTION ─────────────────────── */}
        {!isPro && step === 'plan' && (
          <>
            {/* Billing Toggle */}
            <div className="flex justify-center p-1 bg-surface-container rounded-xl border border-outline-variant max-w-xs mx-auto w-full">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`flex-1 py-2 px-3 rounded-lg font-label-md text-label-md font-bold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`flex-1 py-2 px-3 rounded-lg font-label-md text-label-md font-bold transition-all relative ${
                  billingCycle === 'annual'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Annual
                <span className="absolute -top-2 -right-1 bg-tertiary text-on-tertiary text-[10px] px-1.5 py-0.5 rounded-full font-extrabold leading-tight">
                  SAVE {PRO_PRICING.annualSavingsPercent}%
                </span>
              </button>
            </div>

            {/* Price Display */}
            <div className="text-center py-3">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-[44px] font-extrabold text-on-surface font-mono tracking-tight">
                  {fmtPrice(price)}
                </span>
                <span className="text-[18px] font-bold text-on-surface-variant">
                  /{billingCycle === 'annual' ? 'year' : 'month'}
                </span>
              </div>
              {billingCycle === 'annual' && (
                <p className="text-[14px] text-on-surface-variant mt-1 font-medium">
                  That's <strong className="text-primary">${monthlyEquivalent}/month</strong> —{' '}
                  <span className="text-tertiary font-bold">save ${(PRO_PRICING.monthly * 12 - PRO_PRICING.annual).toFixed(2)}</span>
                </p>
              )}
            </div>

            {/* Feature List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { icon: 'analytics', title: 'Multi-Month Trends', desc: 'Compare spending across months and forecast savings.' },
                { icon: 'upload_file', title: 'CSV Data Import', desc: 'Import transactions from bank statements or CSV files.' },
                { icon: 'receipt', title: 'Receipt Attachments', desc: 'Attach receipt photos to any expense or bill.' },
                { icon: 'group', title: 'Household Budgeting', desc: 'Assign expenses to household members (Self, Partner, Family).' },
                { icon: 'bar_chart', title: 'Advanced Reports', desc: 'Category‑level breakdowns and per‑person spending insights.' },
                { icon: 'cloud_sync', title: 'Priority Sync', desc: 'Faster Firestore sync and priority support.' },
              ].map((f) => (
                <div key={f.icon} className="p-3 rounded-xl bg-surface-container-low border border-outline-variant flex gap-2.5 items-start">
                  <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <h4 className="font-label-lg text-label-lg font-bold text-on-surface text-[14px]">{f.title}</h4>
                    <p className="font-body-sm text-body-sm text-on-surface-variant text-[13px] leading-snug">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={handleStartCheckout}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[16px] shadow-md hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span>Continue to Checkout</span>
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </button>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
              Secure checkout · Cancel anytime
            </p>
          </>
        )}

        {/* ─────────────────────── STEP: CARD FORM ─────────────────────── */}
        {!isPro && step === 'card' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmitCard(); }}
            className="flex flex-col gap-4"
          >
            {/* Stripe‑like summary bar */}
            <div className="p-3 bg-primary-container/20 border border-primary/20 rounded-xl flex items-center justify-between text-[14px]">
              <span className="font-bold text-on-surface">
                {billingCycle === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
              </span>
              <span className="font-extrabold text-primary font-mono">{fmtPrice(price)}</span>
            </div>

            {/* Card Number */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Card Number</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full px-4 py-3.5 bg-surface border border-outline-variant rounded-xl text-[16px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                  autoFocus
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <svg className="w-8 h-5" viewBox="0 0 40 24" fill="none">
                    <rect width="40" height="24" rx="3" fill="#1A1F71"/>
                    <ellipse cx="20" cy="12" rx="5" ry="4.5" fill="white" opacity="0.85"/>
                  </svg>
                </span>
              </div>
              {cardErrors.cardNumber && (
                <p role="alert" className="font-label-sm text-label-sm text-error">{cardErrors.cardNumber}</p>
              )}
            </div>

            {/* Expiry + CVC */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Expiry</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  className="w-full px-4 py-3.5 bg-surface border border-outline-variant rounded-xl text-[16px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardExpiry && (
                  <p role="alert" className="font-label-sm text-label-sm text-error">{cardErrors.cardExpiry}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">CVC</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(formatCvc(e.target.value))}
                  className="w-full px-4 py-3.5 bg-surface border border-outline-variant rounded-xl text-[16px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardCvc && (
                  <p role="alert" className="font-label-sm text-label-sm text-error">{cardErrors.cardCvc}</p>
                )}
              </div>
            </div>

            {/* Name on Card */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Name on Card</label>
              <input
                type="text"
                placeholder="John Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-4 py-3.5 bg-surface border border-outline-variant rounded-xl text-[16px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.cardName && (
                <p role="alert" className="font-label-sm text-label-sm text-error">{cardErrors.cardName}</p>
              )}
            </div>

            {/* Receipt Email */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Receipt Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={receiptEmail}
                onChange={(e) => setReceiptEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-surface border border-outline-variant rounded-xl text-[16px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.receiptEmail && (
                <p role="alert" className="font-label-sm text-label-sm text-error">{cardErrors.receiptEmail}</p>
              )}
            </div>

            {/* Secure badge */}
            <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm">
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span>Your payment info is secure. This is a mock — no real charge will be made.</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('plan')}
                className="px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl font-bold text-[14px] hover:bg-surface-variant transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-md hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">lock</span>
                <span>Pay {fmtPrice(price)}</span>
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────── STEP: PROCESSING ─────────────────────── */}
        {!isPro && step === 'processing' && (
          <div className="flex flex-col items-center gap-5 py-6">
            {/* Animated spinner */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-[4px] border-surface-variant rounded-full" />
              <div
                className="absolute inset-0 border-[4px] border-transparent border-t-primary rounded-full animate-spin"
                style={{ animationDuration: '1.2s' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-primary">lock</span>
              </div>
            </div>

            <div className="text-center">
              <p className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
                Processing Payment
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 animate-pulse">
                {progressText}
              </p>
            </div>

            {/* Progress steps */}
            <div className="w-full max-w-xs flex flex-col gap-2">
              {[
                'Creating secure checkout session',
                'Validating card with issuing bank',
                'Processing payment',
                'Activating Pro features',
              ].map((label, i) => {
                const states = ['Creating secure checkout session', 'Validating card with issuing bank', 'Processing payment', 'Activating Pro features'];
                const idx = states.indexOf(progressText);
                const done = i <= idx;
                const active = i === idx;
                return (
                  <div key={label} className="flex items-center gap-2.5 text-[13px]">
                    {done ? (
                      <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                    ) : active ? (
                      <span className="w-[18px] h-[18px] border-2 border-primary border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    ) : (
                      <span className="material-symbols-outlined text-[18px] text-outline-variant">radio_button_unchecked</span>
                    )}
                    <span className={done ? 'text-on-surface font-medium' : 'text-outline-variant'}>{label}</span>
                  </div>
                );
              })}
            </div>

            {sessionId && (
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Session: <span className="font-mono text-[11px]">{sessionId}</span>
              </p>
            )}
          </div>
        )}

        {/* ─────────────────────── STEP: RECEIPT ─────────────────────── */}
        {!isPro && step === 'receipt' && (
          <div className="flex flex-col gap-4">
            {/* Success animation */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[40px] text-primary">check_circle</span>
              </div>
              <div className="text-center">
                <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
                  Payment Successful!
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Flousy Pro is now active.
                </p>
              </div>
            </div>

            {/* Receipt Card */}
            <div className="border border-outline-variant rounded-2xl bg-surface-container-low overflow-hidden">
              {/* Receipt header */}
              <div className="p-4 bg-primary/5 border-b border-outline-variant flex justify-between items-center">
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-extrabold">Receipt</span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono text-[11px] mt-0.5">
                    {transactionId}
                  </p>
                </div>
                <span className="material-symbols-outlined text-primary">receipt_long</span>
              </div>

              {/* Receipt body */}
              <div className="p-4 flex flex-col gap-3">
                <div className="flex justify-between text-[14px]">
                  <span className="text-on-surface-variant">Plan</span>
                  <span className="font-bold text-on-surface capitalize">{billingCycle} Pro</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-on-surface-variant">Amount</span>
                  <span className="font-extrabold text-on-surface font-mono">{fmtPrice(price)}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-on-surface-variant">Payment method</span>
                  <span className="font-bold text-on-surface">{maskCard(cardNumber || '4242424242424242')}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-on-surface-variant">Receipt email</span>
                  <span className="font-bold text-on-surface">{receiptEmail || user?.email || '—'}</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-on-surface-variant">Next billing</span>
                  <span className="font-bold text-on-surface">{nextBilling}</span>
                </div>

                <div className="border-t border-outline-variant pt-3 mt-1 flex justify-between">
                  <span className="font-bold text-on-surface">Total paid</span>
                  <span className="font-extrabold text-primary font-mono text-[18px]">{fmtPrice(price)}</span>
                </div>
              </div>
            </div>

            {/* Demo mode note */}
            {isDemo && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-700 flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5">info</span>
                <span>
                  <strong>Demo Mode:</strong> This is a mock payment. In production, a real Stripe Checkout
                  webhook would upgrade your account via the Admin SDK.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[16px] shadow-md hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">celebration</span>
              <span>Start Using Pro</span>
            </button>
          </div>
        )}

        {/* ─────────────────────── ERROR STATE ─────────────────────── */}
        {!isPro && step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-error-container/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[40px] text-error">error_outline</span>
            </div>
            <div className="text-center">
              <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">Payment Failed</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Your card was declined. Please try a different payment method.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('card')}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold shadow-md hover:bg-primary/90 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ─────────────────────── FOOTER (non-Pro states) ─────────────────────── */}
        {!isPro && step !== 'receipt' && step !== 'processing' && (
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant border-t border-outline-variant/50 pt-3">
            {isDemo
              ? 'Mock mode — no real payment will be processed.'
              : 'Instant activation. Cancel or downgrade anytime in Settings.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
