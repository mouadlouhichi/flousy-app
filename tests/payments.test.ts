import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  entitlementProjectionForBillingEvent,
  isAllowedHostedCheckoutUrl,
  type VerifiedBillingEvent,
} from '../src/lib/payments';

const event = (status: VerifiedBillingEvent['status']): VerifiedBillingEvent => ({
  provider: 'stripe',
  eventId: 'evt_123',
  customerId: 'cus_123',
  uid: 'user-1',
  status,
  periodStartedAtMs: 1_780_000_000_000,
  periodEndsAtMs: 1_782_592_000_000,
  receivedAtMs: 1_780_000_000_100,
});

describe('future hosted billing boundary', () => {
  it('maps only signature-verified normalized events to entitlement fields', () => {
    assert.deepEqual(entitlementProjectionForBillingEvent(event('active')), {
      plan: 'pro',
      entitlementSource: 'stripe',
      entitlementStatus: 'active',
      entitlementStartedAtMs: 1_780_000_000_000,
      entitlementEndsAtMs: 1_782_592_000_000,
    });
    assert.equal(entitlementProjectionForBillingEvent(event('past_due')).plan, 'free');
    assert.equal(entitlementProjectionForBillingEvent(event('expired')).plan, 'free');
  });

  it('accepts only HTTPS Stripe Checkout and explicitly configured CMI hosts', () => {
    assert.equal(isAllowedHostedCheckoutUrl('stripe', 'https://checkout.stripe.com/c/pay/cs_123'), true);
    assert.equal(isAllowedHostedCheckoutUrl('stripe', 'https://checkout.stripe.com.evil.test/x'), false);
    assert.equal(isAllowedHostedCheckoutUrl('stripe', 'http://checkout.stripe.com/x'), false);
    assert.equal(isAllowedHostedCheckoutUrl('cmi', 'https://merchant.cmi.example/pay'), false);
    assert.equal(
      isAllowedHostedCheckoutUrl('cmi', 'https://merchant.cmi.example/pay', ['merchant.cmi.example']),
      true,
    );
    assert.equal(
      isAllowedHostedCheckoutUrl('cmi', 'https://user:pass@merchant.cmi.example/pay', ['merchant.cmi.example']),
      false,
    );
  });
});
