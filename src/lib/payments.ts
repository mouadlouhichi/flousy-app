/**
 * Provider-neutral billing contract for the post-launch integration.
 *
 * Billing is deliberately disabled today. SmartJib never renders card fields;
 * Stripe Checkout or a CMI-hosted payment page must collect payment details.
 * A server adapter verifies provider signatures, deduplicates webhook event IDs,
 * and writes only the entitlement projection with Firebase Admin SDK.
 */

import type { EntitlementSource, EntitlementStatus } from './pro-features';

export const BILLING_LIVE = false;
export type BillingProvider = Extract<EntitlementSource, 'stripe' | 'cmi'>;
export type BillingCycle = 'monthly' | 'annual';

export interface HostedCheckoutRequest {
  uid: string;
  provider: BillingProvider;
  billingCycle: BillingCycle;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface HostedCheckoutSession {
  provider: BillingProvider;
  sessionId: string;
  /** HTTPS provider-hosted URL; never a page that asks for PAN/CVC in this app. */
  checkoutUrl: string;
  expiresAt: string;
}

export interface VerifiedBillingEvent {
  provider: BillingProvider;
  eventId: string;
  customerId: string;
  uid: string;
  status: Extract<EntitlementStatus, 'active' | 'grace_period' | 'past_due' | 'canceled' | 'expired'>;
  periodStartedAtMs: number;
  periodEndsAtMs: number;
  receivedAtMs: number;
}

/** Data a verified webhook may project onto `users/{uid}` via Admin SDK. */
export interface BillingEntitlementProjection {
  plan: 'free' | 'pro';
  entitlementSource: BillingProvider;
  entitlementStatus: VerifiedBillingEvent['status'];
  entitlementStartedAtMs: number;
  entitlementEndsAtMs: number;
}

/**
 * Server-only adapter boundary. Implementations own provider SDKs and secrets;
 * UI code receives only the hosted redirect URL.
 */
export interface BillingAdapter<RawWebhook = unknown> {
  readonly provider: BillingProvider;
  createHostedCheckout(request: HostedCheckoutRequest): Promise<HostedCheckoutSession>;
  verifyWebhook(rawBody: string, signature: string): Promise<RawWebhook>;
  normalizeWebhook(payload: RawWebhook, receivedAtMs: number): VerifiedBillingEvent;
}

/** Convert a signature-verified, idempotent event into the public profile view. */
export function entitlementProjectionForBillingEvent(
  event: VerifiedBillingEvent,
): BillingEntitlementProjection {
  const active = event.status === 'active'
    || event.status === 'grace_period'
    || event.status === 'canceled';
  return {
    plan: active ? 'pro' : 'free',
    entitlementSource: event.provider,
    entitlementStatus: event.status,
    entitlementStartedAtMs: event.periodStartedAtMs,
    entitlementEndsAtMs: event.periodEndsAtMs,
  };
}

/** Reject accidental redirects to arbitrary or insecure origins. */
export function isAllowedHostedCheckoutUrl(
  provider: BillingProvider,
  value: string,
  configuredCmiHosts: readonly string[] = [],
): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    if (provider === 'stripe') return url.hostname === 'checkout.stripe.com';
    // CMI supplies the merchant/test endpoint during onboarding. Do not guess
    // or wildcard a payment domain: deployment config must pin exact hosts.
    return configuredCmiHosts.some((host) => url.hostname === host.toLowerCase());
  } catch {
    return false;
  }
}
