/**
 * Mock Stripe Payment Processing
 *
 * Simulates Stripe Checkout for development/demo purposes.
 * In production, replace this with a real Stripe integration:
 *   - Create a Checkout Session via the backend API
 *   - Redirect to Stripe hosted checkout page
 *   - Listen for the webhook (Firebase Extension or custom endpoint)
 *   - The webhook updates the user's plan via Admin SDK (bypassing rules)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BillingCycle = 'monthly' | 'annual';

export interface PlanPricing {
  monthly: number;
  annual: number;
  annualSavingsPercent: number;
}

export interface CheckoutSession {
  id: string;
  status: 'open' | 'complete' | 'expired' | 'failed';
  planTier: 'pro';
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  createdAt: string;
  completedAt?: string;
  receiptUrl?: string;
  paymentIntent?: string;
}

export interface PaymentReceipt {
  id: string;
  planTier: 'pro';
  billingCycle: BillingCycle;
  amount: number;
  currency: string;
  status: 'succeeded' | 'failed';
  paymentMethod: string;
  receiptUrl: string;
  paidAt: string;
  nextBillingDate: string;
  transactionId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Master billing switch — the single flag every billing surface must consult.
 *
 * `false` (launch state): no price is quoted as purchasable, no card field is
 * rendered to a real account, no request is made to any payment processor.
 * Pro is available only through the one-time 90-day launch trial
 * (`claimProTrial` in db.ts, enforced by firestore.rules).
 *
 * Flipping to `true` is NOT enough to bill: it only re-enables the billing
 * UI seam. A real provider (Moroccan CMI or Stripe) must then supply:
 *   1. provider-hosted checkout (never a card form inside SmartJib),
 *   2. an idempotent, signature-verified webhook that writes
 *      `plan: 'pro'` + `planSource: 'billing'` via the Admin SDK,
 *   3. provider-owned prices replacing `PRO_PRICING` below.
 */
export const BILLING_LIVE = false as boolean;

export const PRO_PRICING: PlanPricing = {
  monthly: 4.99,
  annual: 39.99,
  annualSavingsPercent: 33,
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const rand = crypto.randomUUID().replace(/-/g, '').substring(0, 12);
  return `${prefix}_${rand}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Formats cents to display price (Stripe stores amounts in cents).
 */
export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Calculates the next billing date based on cycle.
 */
export function getNextBillingDate(cycle: BillingCycle): string {
  const now = new Date();
  if (cycle === 'monthly') {
    now.setMonth(now.getMonth() + 1);
  } else {
    now.setFullYear(now.getFullYear() + 1);
  }
  return now.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Mock Stripe API
// ---------------------------------------------------------------------------

/** Simulated Stripe Checkout Session creation */
export async function createCheckoutSession(
  billingCycle: BillingCycle,
  uid?: string,
): Promise<CheckoutSession> {
  await delay(800);

  const amount = billingCycle === 'annual'
    ? PRO_PRICING.annual
    : PRO_PRICING.monthly;

  return {
    id: generateId('cs'),
    status: 'open',
    planTier: 'pro',
    billingCycle,
    amount,
    currency: 'USD',
    createdAt: new Date().toISOString(),
    paymentIntent: generateId('pi'),
  };
}

/** Simulated payment processing — mimics Stripe's 3D Secure / bank processing delay */
export async function processPayment(
  session: CheckoutSession,
): Promise<{ receipt: PaymentReceipt; session: CheckoutSession }> {
  // Simulate 3D Secure / bank processing (2–3 seconds)
  await delay(2500);

  const completedSession: CheckoutSession = {
    ...session,
    status: 'complete',
    completedAt: new Date().toISOString(),
    receiptUrl: `https://dashboard.stripe.com/test/payments/${session.paymentIntent}`,
  };

  const receipt: PaymentReceipt = {
    id: generateId('rcpt'),
    planTier: 'pro',
    billingCycle: session.billingCycle,
    amount: session.amount,
    currency: 'USD',
    status: 'succeeded',
    paymentMethod: 'Visa ending in 4242',
    receiptUrl: completedSession.receiptUrl!,
    paidAt: completedSession.completedAt!,
    nextBillingDate: getNextBillingDate(session.billingCycle),
    transactionId: session.paymentIntent!,
  };

  return { receipt, session: completedSession };
}

/** Simulated payment failure for testing error states */
export async function failPayment(
  session: CheckoutSession,
): Promise<CheckoutSession> {
  await delay(1500);

  return {
    ...session,
    status: 'failed',
    completedAt: new Date().toISOString(),
  };
}

/**
 * Upgrade the user's plan.
 *
 * The `plan` on the Firebase user profile (`users/{uid}.plan`) is the single
 * source of truth: for a signed-in user this always writes to Firestore, so
 * Pro access follows the account across devices. The localStorage callback is
 * only used in demo mode, where no Firebase session (and therefore no Firebase
 * profile) exists.
 */
export async function upgradeUserPlan(
  uid: string | undefined,
  billingCycle: BillingCycle,
  updateProfile: (data: {
    plan: 'pro';
    planBillingCycle: BillingCycle;
    planNextBillingDate: string;
  }) => Promise<void>,
  setDemoPlan?: (data: { billingCycle: BillingCycle; nextBillingDate: string }) => void,
): Promise<void> {
  const nextBillingDate = getNextBillingDate(billingCycle);

  // Demo mode (no Firebase session): keep the local demo state so the mock
  // checkout still works without a Firebase profile.
  if (!uid) {
    setDemoPlan?.({ billingCycle, nextBillingDate });
    return;
  }

  // Signed-in: persist the upgrade on the Firebase profile. Failures surface
  // to the caller (the upgrade modal shows its error step) instead of being
  // silently swapped for a local-only flag.
  await updateProfile({
    plan: 'pro',
    planBillingCycle: billingCycle,
    planNextBillingDate: nextBillingDate,
  });
}
