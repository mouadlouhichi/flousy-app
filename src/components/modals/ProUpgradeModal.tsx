'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import {
  type BillingCycle,
  PRO_PRICING,
  createCheckoutSession,
  processPayment,
  upgradeUserPlan,
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
  const digits = num.replace(/\s/g, '');
  return `•••• •••• •••• ${digits.slice(-4) || '4242'}`;
}

/** Format cents to a currency string */
function fmtPrice(cents: number): string {
  return `$${cents.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  const { user, profile, updateProfileData } = useAuth();
  const isPro = profile?.plan === 'pro' || (typeof window !== 'undefined' && localStorage.getItem('flousy_pro_plan') === 'true');

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
      setReceiptEmail(user?.email || 'user@example.com');
    }
  }, [isOpen, isPro, user?.email]);

  // -----------------------------------------------------------------------
  // Fill Demo Test Card
  // -----------------------------------------------------------------------
  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('123');
    setCardName(user?.displayName || 'Jane Doe');
    if (!receiptEmail) setReceiptEmail(user?.email || 'jane.doe@example.com');
    setCardErrors({});
  };

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
    await new Promise((r) => setTimeout(r, 1000));

    // 3) Process payment
    setProgressText('Processing payment…');
    const { receipt } = await processPayment(session);

    setTransactionId(receipt.transactionId);
    setNextBilling(receipt.nextBillingDate);

    // 4) Upgrade the user's plan
    setProgressText('Activating Pro features…');

    const setDemoPlan = (plan: 'pro') => {
      localStorage.setItem('flousy_pro_plan', 'true');
      localStorage.setItem('flousy_pro_billing', billingCycle);
      localStorage.setItem('flousy_pro_next_billing', receipt.nextBillingDate);
    };

    await upgradeUserPlan(user?.uid, billingCycle, updateProfileData, setDemoPlan);

    // 5) Show receipt
    await new Promise((r) => setTimeout(r, 500));
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
    <Modal isOpen={isOpen} onClose={onClose} title={isPro ? 'Flousy Pro' : 'Upgrade to Flousy Pro'} className="max-w-2xl">
      <div className="flex flex-col gap-xl">
        {/* ─────────────────────── HERO CARD ─────────────────────── */}
        <div className="rounded-[24px] border border-surface-container-highest bg-surface-container shadow-sm overflow-hidden">
          <div className="relative overflow-hidden bg-surface-container p-8 sm:p-10 text-center">
            <div className="absolute inset-x-[-40px] top-0 h-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm">
                <AppIcon name={step === 'receipt' ? 'verified' : 'workspace_premium'} className="text-[32px]" />
              </div>
              <div className="space-y-3 max-w-3xl">
                <h3 className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl text-on-surface">
                  {isPro ? 'You are a Pro Member!' : 'Unlock Full Budgeting Power'}
                </h3>
                <p className="mx-auto max-w-xl text-base leading-7 text-on-surface-variant">
                  {isPro
                    ? 'Thank you for supporting Flousy. All premium features are active.'
                    : 'Multi-month trends, CSV imports, receipt attachments, and household budgeting.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────── ALREADY PRO ─────────────────────── */}
        {isPro && (
          <div className="grid gap-lg">
            <div className="rounded-[24px] border border-surface-container-highest bg-surface-container p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <AppIcon name="check_circle" className="text-[26px]" />
                </div>
                <div>
                  <p className="font-headline-md text-body-lg font-semibold text-on-surface">Pro plan is active</p>
                  <p className="font-body-md text-on-surface-variant mt-1">
                    {typeof window !== 'undefined' && localStorage.getItem('flousy_pro_next_billing')
                      ? `Next billing: ${localStorage.getItem('flousy_pro_next_billing')}`
                      : 'All premium features unlocked.'}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-3.5 text-on-primary font-semibold text-body-lg shadow-sm hover:bg-primary-container transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
        )}

        {/* ─────────────────────── STEP: PLAN SELECTION ─────────────────────── */}
        {!isPro && step === 'plan' && (
          <div className="grid gap-xl">
            <div className="rounded-[24px] border border-surface-container-highest bg-surface p-6 shadow-sm">
              <div className="flex flex-col items-center gap-6">
                <div className="bg-surface-container-high rounded-full p-1.5 shadow-sm w-full max-w-sm">
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-container p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`rounded-full py-3 text-label-md font-semibold transition-colors ${
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
                      className={`rounded-full py-3 text-label-md font-semibold transition-colors ${
                        billingCycle === 'annual'
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-xs">
                    <span className="font-headline-lg text-headline-lg text-on-surface">{fmtPrice(price)}</span>
                    <span className="font-body-lg text-body-lg text-on-surface-variant">/{billingCycle === 'annual' ? 'year' : 'month'}</span>
                  </div>
                  <p className="font-body-md text-on-surface-variant mt-sm max-w-lg mx-auto">
                    {billingCycle === 'annual' ? (
                      <>
                        That's <span className="text-primary font-semibold">${monthlyEquivalent}/month</span> —{' '}
                        <span className="text-tertiary font-semibold">save $19.89</span>
                      </>
                    ) : (
                      <>Billed monthly. Switch to annual anytime to save 33%.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
              {[
                { icon: 'trending_up', title: 'Multi-Month Trends', desc: 'Compare spending across months and forecast savings.' },
                { icon: 'upload_file', title: 'CSV Data Import', desc: 'Import transactions from bank statements or CSV files.' },
                { icon: 'receipt', title: 'Receipt Attachments', desc: 'Attach receipt photos to any expense or bill.' },
                { icon: 'family_restroom', title: 'Household Budgeting', desc: 'Assign expenses to household members (Self, Partner, Family).' },
                { icon: 'bar_chart', title: 'Advanced Reports', desc: 'Category-level breakdowns and per-person spending insights.' },
                { icon: 'cloud_sync', title: 'Priority Sync', desc: 'Faster Firestore sync and priority support.' },
              ].map((feature) => (
                <div key={feature.icon} className="rounded-[24px] border border-surface-container-highest bg-surface-container-lowest p-5 flex gap-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <AppIcon name={feature.icon} className="text-[22px]" />
                  </div>
                  <div>
                    <h4 className="font-headline-md text-body-lg font-semibold text-on-surface mb-1">{feature.title}</h4>
                    <p className="font-body-md text-on-surface-variant text-sm leading-6">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-surface-container-highest bg-surface p-6 shadow-sm">
              <button
                type="button"
                onClick={handleStartCheckout}
                className="w-full rounded-xl bg-primary py-4 text-on-primary font-semibold text-body-lg shadow-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue to Checkout</span>
                <AppIcon name="arrow_forward" className="text-[20px]" />
              </button>
              <div className="mt-4 text-center font-label-md text-on-surface-variant flex flex-col gap-1">
                <p>Secure checkout • Cancel anytime</p>
                <p>Instant activation. Cancel or downgrade anytime in Settings.</p>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────── STEP: CARD FORM ─────────────────────── */}
        {!isPro && step === 'card' && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmitCard(); }}
            className="flex flex-col gap-4"
          >
            {/* Header summary bar */}
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between text-[14px]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-on-surface">
                  {billingCycle === 'annual' ? 'Annual Pro Plan' : 'Monthly Pro Plan'}
                </span>
                <span className="text-[12px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                  {billingCycle === 'annual' ? '33% OFF' : 'Flexible'}
                </span>
              </div>
              <span className="font-extrabold text-primary font-mono text-[16px]">{fmtPrice(price)}</span>
            </div>

            {/* Test Card Quick Fill Button */}
            <button
              type="button"
              onClick={handleFillTestCard}
              className="py-2 px-3 bg-secondary-container/50 border border-secondary-container hover:bg-secondary-container text-on-secondary-container rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AppIcon name="sparkles" className="text-[16px]" />
              <span>Fill Demo Test Card</span>
            </button>

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
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                  autoFocus
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <svg className="w-8 h-5" viewBox="0 0 40 24" fill="none">
                    <rect width="40" height="24" rx="3" fill="#00685f"/>
                    <ellipse cx="20" cy="12" rx="5" ry="4.5" fill="white" opacity="0.85"/>
                  </svg>
                </span>
              </div>
              {cardErrors.cardNumber && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardNumber}</p>
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
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardExpiry && (
                  <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardExpiry}</p>
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
                  className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardCvc && (
                  <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardCvc}</p>
                )}
              </div>
            </div>

            {/* Name on Card */}
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">Name on Card</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-[15px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.cardName && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardName}</p>
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
                className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-[15px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.receiptEmail && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.receiptEmail}</p>
              )}
            </div>

            {/* Secure badge */}
            <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm mt-1">
              <AppIcon name="lock" className="text-[16px] text-primary shrink-0" />
              <span>Encrypted test payment · No real funds charged</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('plan')}
                className="px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl font-bold text-[14px] hover:bg-surface-variant transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-sm hover:bg-primary/90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <AppIcon name="lock" className="text-[18px]" />
                <span>Pay {fmtPrice(price)}</span>
              </button>
            </div>
          </form>
        )}

        {/* ─────────────────────── STEP: PROCESSING ─────────────────────── */}
        {!isPro && step === 'processing' && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 border-[4px] border-surface-variant rounded-full" />
              <div
                className="absolute inset-0 border-[4px] border-transparent border-t-primary rounded-full animate-spin"
                style={{ animationDuration: '1s' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <AppIcon name="lock" className="text-[28px] text-primary" />
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
            <div className="w-full max-w-xs flex flex-col gap-2.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
              {[
                'Creating secure checkout session',
                'Validating card with issuing bank',
                'Processing payment',
                'Activating Pro features',
              ].map((label, i) => {
                const states = ['Creating secure checkout session…', 'Validating card with issuing bank…', 'Processing payment…', 'Activating Pro features…'];
                const idx = states.indexOf(progressText);
                const done = i < idx || idx === -1;
                const active = i === idx;
                return (
                  <div key={label} className="flex items-center gap-2.5 text-[13px]">
                    {done ? (
                      <AppIcon name="check_circle" className="text-[18px] text-primary" />
                    ) : active ? (
                      <span className="w-[18px] h-[18px] border-2 border-primary border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.8s' }} />
                    ) : (
                      <AppIcon name="radio_button_unchecked" className="text-[18px] text-outline-variant" />
                    )}
                    <span className={done || active ? 'text-on-surface font-medium' : 'text-outline-variant'}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────── STEP: RECEIPT ─────────────────────── */}
        {!isPro && step === 'receipt' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                <AppIcon name="check_circle" className="text-[36px] text-primary" />
              </div>
              <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">
                Payment Successful!
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Flousy Pro is now active on your account.
              </p>
            </div>

            {/* Receipt Card */}
            <div className="border border-outline-variant rounded-xl bg-surface-container-low overflow-hidden">
              <div className="p-3.5 bg-primary/5 border-b border-outline-variant flex justify-between items-center">
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-extrabold">Receipt</span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono text-[11px] mt-0.5">
                    {transactionId || 'pi_mock_12345'}
                  </p>
                </div>
                <AppIcon name="receipt_long" className="text-primary text-[22px]" />
              </div>

              <div className="p-4 flex flex-col gap-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Plan</span>
                  <span className="font-bold text-on-surface capitalize">{billingCycle} Pro</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Amount</span>
                  <span className="font-extrabold text-on-surface font-mono">{fmtPrice(price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Payment method</span>
                  <span className="font-bold text-on-surface">{maskCard(cardNumber || '4242')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Receipt email</span>
                  <span className="font-bold text-on-surface">{receiptEmail || 'user@example.com'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Next billing</span>
                  <span className="font-bold text-on-surface">{nextBilling || '1 Year from today'}</span>
                </div>

                <div className="border-t border-outline-variant pt-2.5 mt-1 flex justify-between items-center">
                  <span className="font-bold text-on-surface">Total paid</span>
                  <span className="font-extrabold text-primary font-mono text-[18px]">{fmtPrice(price)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[16px] shadow-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <AppIcon name="celebration" className="text-[20px]" />
              <span>Start Using Pro</span>
            </button>
          </div>
        )}

        {/* ─────────────────────── STEP: ERROR ─────────────────────── */}
        {!isPro && step === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
              <AppIcon name="error_outline" className="text-[36px] text-error" />
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">Payment Failed</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                Your payment could not be completed. Please check your card details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('card')}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold shadow-sm hover:bg-primary/90 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ─────────────────────── FOOTER (Policy Note for Card Step) ─────────────────────── */}
        {!isPro && step === 'card' && (
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant/80 border-t border-outline-variant/50 pt-3 text-[12px]">
            Instant activation. Cancel or downgrade anytime in Settings.
          </p>
        )}
      </div>
    </Modal>
  );
}
