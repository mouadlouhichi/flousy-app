'use client';

import { AppIcon } from '@/components/ui/app-icon';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../lib/auth-context';
import { isProUser, resolveProEntitlement } from '../../lib/pro-features';
import {
  type BillingCycle,
  PRO_PRICING,
  createCheckoutSession,
  processPayment,
  upgradeUserPlan,
} from '../../lib/payments';
import { trackEvent } from '../../lib/analytics';
import { useLanguage } from '@/lib/i18n-context';
import { formatLocalizedPercent } from '@/lib/i18n';
import { formatShortDate } from '@/lib/utils';
import { claimProTrial } from '../../lib/db';
import { isDemoMode } from '../../lib/demo-mode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutStep = 'plan' | 'card' | 'processing' | 'receipt' | 'error';
type ProcessingStep = 'creatingCheckout' | 'validatingCard' | 'processingPayment' | 'activatingFeatures' | '';

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

function formatPrice(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProUpgradeModal({ isOpen, onClose }: ProUpgradeModalProps) {
  const { user, profile, updateProfileData, retryProfileSync } = useAuth();
  const [betaClaimPending, setBetaClaimPending] = useState<boolean>(false);
  const [betaClaimError, setBetaClaimError] = useState<string>('');
  const { messages: m, t, intlLocale } = useLanguage();
  const p = m.modals.pro;
  // Pro state always comes from the `plan` field on the Firebase profile,
  // resolved through the expiry-aware entitlement (a lapsed 90-day trial is
  // Free even though `plan` still reads 'pro').
  const entitlement = resolveProEntitlement(profile);
  const isPro = isProUser(profile);

  // -- Checkout state --
  const [step, setStep] = useState<CheckoutStep>('plan');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});

  // -- Processing state --
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('');
  const [sessionId, setSessionId] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [nextBilling, setNextBilling] = useState('');
  const [receiptEmail, setReceiptEmail] = useState(user?.email || '');

  // -----------------------------------------------------------------------
  // Reset state when modal opens
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      trackEvent('view_pro_modal', { isPro });
      setStep(isPro ? 'receipt' : 'plan');
      setBillingCycle('annual');
      setCardNumber('');
      setCardExpiry('');
      setCardCvc('');
      setCardName('');
      setCardErrors({});
      setProcessingStep('');
      setSessionId('');
      setTransactionId('');
      setNextBilling('');
      setReceiptEmail(user?.email || '');
    }
  }, [isOpen, isPro, user?.email]);

  // -----------------------------------------------------------------------
  // Fill Demo Test Card
  // -----------------------------------------------------------------------
  const handleFillTestCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvc('123');
    setCardName(user?.displayName || p.cardholderPlaceholder);
    if (!receiptEmail) setReceiptEmail(user?.email || 'demo@example.com');
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
    trackEvent('begin_checkout', { billingCycle });
    setCardErrors({});
    setStep('card');
  }, [billingCycle]);

  const handleSubmitCard = useCallback(async () => {
    const errors: Record<string, string> = {};

    const cleanCard = cardNumber.replace(/\s/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 16) {
      errors.cardNumber = p.validCardNumber;
    }
    if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
      errors.cardExpiry = p.validExpiry;
    }
    if (cardCvc.length < 3) {
      errors.cardCvc = p.validCvc;
    }
    if (!cardName.trim()) {
      errors.cardName = p.validCardholder;
    }
    if (!receiptEmail.trim()) {
      errors.receiptEmail = p.validReceiptEmail;
    }

    if (Object.keys(errors).length > 0) {
      setCardErrors(errors);
      return;
    }

    // 1) Create checkout session
    setStep('processing');
    setProcessingStep('creatingCheckout');

    const session = await createCheckoutSession(billingCycle, user?.uid);
    setSessionId(session.id);

    // 2) Simulate card validation (3DS / bank auth)
    setProcessingStep('validatingCard');
    await new Promise((r) => setTimeout(r, 1000));

    // 3) Process payment
    setProcessingStep('processingPayment');
    const { receipt } = await processPayment(session);

    setTransactionId(receipt.transactionId);
    setNextBilling(receipt.nextBillingDate);

    // 4) Upgrade the user's plan — always persisted on the Firebase profile
    // (`users/{uid}.plan`) for signed-in users. Demo mode (no Firebase
    // session) keeps its local demo state via the callback below.
    setProcessingStep('activatingFeatures');

    const setDemoPlan = ({ billingCycle: cycle, nextBillingDate }: { billingCycle: BillingCycle; nextBillingDate: string }) => {
      localStorage.setItem('flousy_pro_plan', 'true');
      localStorage.setItem('flousy_pro_billing', cycle);
      localStorage.setItem('flousy_pro_next_billing', nextBillingDate);
    };

    try {
      await upgradeUserPlan(user?.uid, billingCycle, updateProfileData, setDemoPlan);
    } catch (err) {
      console.error('Plan upgrade failed:', err);
      setStep('error');
      return;
    }

    // 5) Show receipt.
    //
    // This used to send a `purchase` event carrying the simulated amount and a
    // fake transaction id. A conversion event that no money backs is worse than
    // no event: it is the number stakeholders and pricing decisions get read off.
    // Demo-mode activity is still visible in the demo UI, just not in analytics.
    await new Promise((r) => setTimeout(r, 500));
    setStep('receipt');
  }, [cardNumber, cardExpiry, cardCvc, cardName, receiptEmail, billingCycle, user?.uid, updateProfileData, p]);

  // -----------------------------------------------------------------------
  // Price helpers
  // -----------------------------------------------------------------------
  const price = billingCycle === 'annual' ? PRO_PRICING.annual : PRO_PRICING.monthly;
  const monthlyEquivalent = billingCycle === 'annual'
    ? PRO_PRICING.annual / 12
    : PRO_PRICING.monthly;
  const processingSteps: { id: Exclude<ProcessingStep, ''>; label: string }[] = [
    { id: 'creatingCheckout', label: p.creatingCheckout },
    { id: 'validatingCard', label: p.validatingCard },
    { id: 'processingPayment', label: p.processingPayment },
    { id: 'activatingFeatures', label: p.activatingFeatures },
  ];
  const activeProcessingIndex = processingSteps.findIndex(({ id }) => id === processingStep);
  const activeProcessingLabel = activeProcessingIndex >= 0 ? processingSteps[activeProcessingIndex].label : '';
  const billingCycleLabel = billingCycle === 'annual' ? p.annualPlan : p.monthlyPlan;
  const formattedPrice = formatPrice(price, intlLocale);
  const formattedMonthlyEquivalent = formatPrice(monthlyEquivalent, intlLocale);
  const formattedAnnualSavings = formatPrice((PRO_PRICING.monthly * 12) - PRO_PRICING.annual, intlLocale);
  const formattedNextBilling = nextBilling || profile?.planNextBillingDate
    ? formatShortDate(nextBilling || profile?.planNextBillingDate || '', intlLocale)
    : m.common.notAvailable;
  const proFeatures = [
    { icon: 'scan_barcode', title: p.courseScanning, desc: p.courseScanningDesc },
    { icon: 'trending_up', title: p.multiMonthTrends, desc: p.multiMonthDesc },
    { icon: 'upload_file', title: p.csvImport, desc: p.csvImportDesc },
    { icon: 'receipt', title: p.receiptAttachments, desc: p.receiptAttachmentsDesc },
    { icon: 'family_restroom', title: p.householdBudgeting, desc: p.householdBudgetingDesc },
    { icon: 'bar_chart', title: p.advancedReports, desc: p.advancedReportsDesc },
    { icon: 'cloud_sync', title: p.prioritySync, desc: p.prioritySyncDesc },
  ];

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  /*
   * Everything below this point is a simulated Stripe checkout: a card form, a
   * test card (4242 4242 4242 4242), a fake 2.5s "processing payment" delay and
   * a receipt linking to dashboard.stripe.com. No payment provider is configured
   * in this deployment, so presenting that to a real signed-in account is not a
   * mock — it collects card details and then charges nothing, while promising a
   * subscription that will never bill. Real accounts therefore get the honest
   * path: Pro is included free for 90 days via the one-time launch trial, one
   * non-repeatable claim per
   * account (the only `plan` transition firestore.rules permits), and no card
   * field anywhere in the DOM. The simulated checkout stays for demo mode, where
   * there is no account to charge and the copy already says "demo".
   */
  const realAccount = Boolean(user) && !isDemoMode();
  if (realAccount) {
    const claim = async () => {
      setBetaClaimPending(true);
      setBetaClaimError('');
      try {
        const claimed = await claimProTrial(user!.uid);
        if (!claimed) {
          setBetaClaimError(m.pro.trialExpiredBody);
          return;
        }
        await retryProfileSync();
        trackEvent('pro_trial_claimed');
      } catch {
        setBetaClaimError(m.auth.networkError);
      } finally {
        setBetaClaimPending(false);
      }
    };
    const expired = entitlement.isTrialExpired;
    const headline = isPro ? p.youArePro : expired ? m.pro.trialExpiredTitle : m.pro.trialTitle;
    const body = isPro ? p.proActiveDescription : expired ? m.pro.trialExpiredBody : m.pro.trialBody;
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={isPro ? p.memberTitle : p.title} className="max-w-xl">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-2xl border border-surface-container-highest bg-surface-container p-4">
            <AppIcon
              name={isPro ? 'verified' : 'workspace_premium'}
              className="mt-0.5 text-[24px] text-primary"
            />
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-extrabold text-on-surface">
                {headline}
              </h3>
              <p className="text-sm leading-6 text-on-surface-variant">
                {body}
              </p>
              <p className="text-xs font-medium text-on-surface-variant">{m.pro.cardFieldsRemoved}</p>
            </div>
          </div>

          {!isPro && !expired && (
            <button
              type="button"
              onClick={claim}
              disabled={betaClaimPending}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-on-primary transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {betaClaimPending ? m.common.loading : m.pro.trialAction}
            </button>
          )}
          {isPro && entitlement.isTrialActive && (
            <p className="text-xs font-semibold text-primary">
              {t(m.pro.trialActiveNote, { days: entitlement.trialDaysRemaining })}
            </p>
          )}
          {isPro && !entitlement.isTrialActive && (
            <p className="text-xs font-semibold text-primary">{m.pro.trialClaimed}</p>
          )}
          {betaClaimError && (
            <p role="alert" className="text-xs font-bold text-error">
              {betaClaimError}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isPro ? p.memberTitle : p.title} className="max-w-2xl">
      <div className="flex flex-col gap-xl">
        {/* ─────────────────────── HERO CARD ─────────────────────── */}
        <div className="rounded-[24px] border border-surface-container-highest bg-surface-container shadow-sm overflow-hidden">
          <div className="relative overflow-hidden bg-surface-container p-6 sm:p-10 text-center">
            <div className="absolute inset-x-[-40px] top-0 h-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4">
              <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-sm">
                <AppIcon name={step === 'receipt' ? 'verified' : 'workspace_premium'} className="text-[28px] sm:text-[32px]" />
              </div>
              <div className="space-y-2 sm:space-y-3 max-w-3xl">
                <h3 className="font-headline-lg text-headline-lg font-extrabold tracking-tight text-on-surface">
                  {isPro ? p.youArePro : p.unlockPower}
                </h3>
                <p className="mx-auto max-w-xl text-sm sm:text-base leading-6 sm:leading-7 text-on-surface-variant">
                  {isPro ? p.proActiveDescription : p.upgradeDescription}
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
                  <p className="font-headline-md text-body-lg font-semibold text-on-surface">{p.planActive}</p>
                  <p className="font-body-md text-on-surface-variant mt-1">
                    {profile?.planNextBillingDate
                      ? t(p.nextBilling, { date: formatShortDate(profile.planNextBillingDate, intlLocale) })
                      : p.allPremiumUnlocked}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-primary py-3.5 text-on-primary font-semibold text-body-lg shadow-sm hover:bg-primary-container transition-colors"
            >
              {p.backToDashboard}
            </button>
          </div>
        )}

        {/* ─────────────────────── STEP: PLAN SELECTION ─────────────────────── */}
        {!isPro && step === 'plan' && (
          <div className="grid gap-xl">
              <div className="flex flex-col items-center gap-6">
                <div className="bg-surface-container-high rounded-full p-1.5 shadow-sm w-full ">
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-surface-container p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`rounded-full py-3 text-label-md font-semibold transition-colors ${
                        billingCycle === 'monthly'
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >{p.monthlyPlan}</button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`rounded-full py-3 text-label-md font-semibold transition-colors ${
                        billingCycle === 'annual'
                          ? 'bg-primary text-on-primary shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >{p.annualPlan}</button>
                  </div>
                </div>

                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-xs">
                    <span className="font-headline-lg text-headline-lg text-on-surface">{formattedPrice}</span>
                    <span className="font-body-lg text-body-lg text-on-surface-variant">{t(p.perPeriod, { period: billingCycle === 'annual' ? m.common.year : m.common.month })}</span>
                  </div>
                  <p className="font-body-md text-on-surface-variant mt-sm max-w-lg mx-auto">
                    {billingCycle === 'annual'
                      ? t(p.annualValue, { price: formattedMonthlyEquivalent, savings: formattedAnnualSavings })
                      : t(p.monthlyValue, { percent: formatLocalizedPercent(PRO_PRICING.annualSavingsPercent, intlLocale) })}
                  </p>
                </div>
              </div>

            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              {proFeatures.map((feature) => (
                <div key={feature.icon} className="rounded-[24px] border border-surface-container-highest bg-surface-container-lowest p-5 flex gap-2 md:gap-3 shadow-sm">
                  <div className="flex p-3 h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                <span>{p.continueCheckout}</span>
                <AppIcon name="arrow_forward" className="text-[20px] rtl:rotate-180" />
              </button>
              <div className="mt-4 text-center font-label-md text-on-surface-variant flex flex-col gap-1">
                <p>{p.secureCheckout} • {p.cancelAnytime}</p>
                <p>{p.instantActivation}</p>
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
                  {billingCycleLabel}
                </span>
                <span className="text-[12px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                  {billingCycle === 'annual' ? t(p.annualDiscount, { percent: formatLocalizedPercent(PRO_PRICING.annualSavingsPercent, intlLocale) }) : p.flexible}
                </span>
              </div>
              <span className="font-extrabold text-primary font-mono text-[16px]">{formattedPrice}</span>
            </div>

            {/* Test Card Quick Fill Button */}
            <button
              type="button"
              onClick={handleFillTestCard}
              className="py-2 px-3 bg-secondary-container/50 border border-secondary-container hover:bg-secondary-container text-on-secondary-container rounded-lg text-[13px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <AppIcon name="sparkles" className="text-[16px]" />
              <span>{p.fillDemoTestCard}</span>
            </button>

            {/* Card Number */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pro-card-number" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{p.cardNumber}</label>
              <div className="relative">
                <input
                  id="pro-card-number"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder={p.cardNumberPlaceholder}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                  autoFocus
                />
                <span className="absolute end-3.5 top-1/2 -translate-y-1/2">
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
                <label htmlFor="pro-card-expiry" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{p.expiry}</label>
                <input
                  id="pro-card-expiry"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder={p.expiryPlaceholder}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardExpiry && (
                  <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardExpiry}</p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="pro-card-cvc" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{p.cvc}</label>
                <input
                  id="pro-card-cvc"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(formatCvc(e.target.value))}
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[15px] font-mono text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
                />
                {cardErrors.cardCvc && (
                  <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardCvc}</p>
                )}
              </div>
            </div>

            {/* Name on Card */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pro-cardholder-name" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{p.cardholderName}</label>
              <input
                id="pro-cardholder-name"
                type="text"
                placeholder={p.cardholderPlaceholder}
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[15px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.cardName && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.cardName}</p>
              )}
            </div>

            {/* Receipt Email */}
            <div className="flex flex-col gap-1">
              <label htmlFor="pro-receipt-email" className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-bold">{p.receiptEmail}</label>
              <input
                id="pro-receipt-email"
                type="email"
                dir="ltr"
                placeholder={p.emailPlaceholder}
                value={receiptEmail}
                onChange={(e) => setReceiptEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-[15px] text-on-surface placeholder:text-outline-variant focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
              {cardErrors.receiptEmail && (
                <p role="alert" className="font-label-sm text-label-sm text-error mt-0.5">{cardErrors.receiptEmail}</p>
              )}
            </div>

            {/* Secure badge */}
            <div className="flex items-center gap-2 text-on-surface-variant font-label-sm text-label-sm mt-1">
              <AppIcon name="lock" className="text-[16px] text-primary shrink-0" />
              <span>{p.encryptedTestPayment}</span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('plan')}
                className="px-4 py-3 border border-outline-variant text-on-surface-variant rounded-xl font-bold text-[14px] hover:bg-surface-variant transition-all cursor-pointer"
              >{m.common.back}</button>
              <button
                type="submit"
                className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-sm hover:bg-accent-foreground active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <AppIcon name="lock" className="text-[18px]" />
                <span>{t(p.pay, { price: formattedPrice })}</span>
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
                {p.processingTitle}
              </p>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1 animate-pulse">
                {activeProcessingLabel}
              </p>
            </div>

            {/* Progress steps */}
            <div className="w-full max-w-xs flex flex-col gap-2.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
              {processingSteps.map(({ id, label }, i) => {
                const done = i < activeProcessingIndex;
                const active = id === processingStep;
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
                {p.paymentSuccessful}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {p.proNowActive}
              </p>
            </div>

            {/* Receipt Card */}
            <div className="border border-outline-variant rounded-xl bg-surface-container-low overflow-hidden">
              <div className="p-3.5 bg-primary/5 border-b border-outline-variant flex justify-between items-center">
                <div>
                  <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-extrabold">{p.receipt}</span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant font-mono text-[11px] mt-0.5">
                    {transactionId || 'pi_mock_12345'}
                  </p>
                </div>
                <AppIcon name="receipt_long" className="text-primary text-[22px]" />
              </div>

              <div className="p-4 flex flex-col gap-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{p.plan}</span>
                  <span className="font-bold text-on-surface">{billingCycleLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{m.common.amount}</span>
                  <span className="font-extrabold text-on-surface font-mono">{formattedPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{p.paymentMethod}</span>
                  <span className="font-bold text-on-surface">{maskCard(cardNumber || '4242')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{p.receiptEmail}</span>
                  <span className="font-bold text-on-surface">{receiptEmail || m.common.notAvailable}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">{p.nextBillingLabel}</span>
                  <span className="font-bold text-on-surface">{formattedNextBilling}</span>
                </div>

                <div className="border-t border-outline-variant pt-2.5 mt-1 flex justify-between items-center">
                  <span className="font-bold text-on-surface">{p.totalPaid}</span>
                  <span className="font-extrabold text-primary font-mono text-[18px]">{formattedPrice}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-[16px] shadow-sm hover:bg-accent-foreground transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <AppIcon name="celebration" className="text-[20px]" />
              <span>{p.startUsingPro}</span>
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
              <h3 className="font-headline-sm text-headline-sm font-extrabold text-on-surface">{p.paymentFailed}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                {p.paymentFailedDescription}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('card')}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold shadow-sm hover:bg-accent-foreground transition-all"
            >{m.common.tryAgain}</button>
          </div>
        )}

        {/* ─────────────────────── FOOTER (Policy Note for Card Step) ─────────────────────── */}
        {!isPro && step === 'card' && (
          <p className="text-center font-body-sm text-body-sm text-on-surface-variant/80 border-t border-outline-variant/50 pt-3 text-[12px]">
            {p.instantActivation}
          </p>
        )}
      </div>
    </Modal>
  );
}
