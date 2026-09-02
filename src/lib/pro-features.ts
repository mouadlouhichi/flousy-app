export type ProUserLike = {
  plan?: string | null;
  proTrialEndsAtMs?: number | null;
  planSource?: string | null;
} | null;

/** Launch-trial length: exactly 90 days, the value Firestore rules enforce. */
export const PRO_TRIAL_DURATION_MS = 7_776_000_000;

/**
 * Single definition of "this account is Pro".
 *
 * Tolerant of casing/whitespace (`'Pro'`, `'PRO'`, `' pro '` written by an old
 * client or a manual console edit all count) so a Firestore value that reads as
 * Pro can never render as Free through a strict `=== 'pro'` mismatch. Every
 * Pro decision — badge, feature gates, cache sanitiser, trial claim — must go
 * through here rather than comparing the raw string.
 */
export function isProPlan(plan: unknown): boolean {
  return typeof plan === 'string' && plan.trim().toLowerCase() === 'pro';
}

export interface ProEntitlement {
  /** Effective entitlement — the ONLY value feature gates may consult. */
  isPro: boolean;
  /** True while a launch trial is the source of the entitlement. */
  isTrialActive: boolean;
  /** True when a trial existed and has ended (plan may still read 'pro'). */
  isTrialExpired: boolean;
  /** Whole days left in an active trial (ceil), 0 otherwise. */
  trialDaysRemaining: number;
  /** Trial end instant (epoch ms) when one exists. */
  trialEndsAtMs?: number;
}

/**
 * Expiry-aware entitlement resolution.
 *
 * `plan: 'pro'` alone is not enough: the 90-day launch trial leaves `plan`
 * untouched at expiry (clients cannot be trusted to downgrade themselves and
 * rules forbid editing the trial stamps), so the END TIMESTAMP is what decides.
 * An entitlement with `planSource: 'billing'` (written by the future CMI/Stripe
 * webhook through the Admin SDK) has no trial window and never expires here.
 */
export function resolveProEntitlement(profile: ProUserLike, nowMs: number = Date.now()): ProEntitlement {
  const none: ProEntitlement = { isPro: false, isTrialActive: false, isTrialExpired: false, trialDaysRemaining: 0 };
  if (!profile || !isProPlan(profile.plan)) return none;
  const endsAt = profile.proTrialEndsAtMs;
  if (typeof endsAt !== 'number' || !Number.isFinite(endsAt)) {
    // Pro with no trial window: either a billing-sourced entitlement or a
    // legacy beta claim made before the window existed. Both stay Pro.
    return { isPro: true, isTrialActive: false, isTrialExpired: false, trialDaysRemaining: 0 };
  }
  if (nowMs < endsAt) {
    return {
      isPro: true,
      isTrialActive: true,
      isTrialExpired: false,
      trialDaysRemaining: Math.max(1, Math.ceil((endsAt - nowMs) / 86_400_000)),
      trialEndsAtMs: endsAt,
    };
  }
  return { isPro: false, isTrialActive: false, isTrialExpired: true, trialDaysRemaining: 0, trialEndsAtMs: endsAt };
}

export type ProFeatureId =
  | 'courseScan'
  | 'trends'
  | 'incomeSources'
  | 'csv'
  | 'categoryBudgets'
  | 'rollover'
  | 'household';

export interface ProFeature {
  id: ProFeatureId;
  /** Icon identifier understood by `AppIcon`. */
  icon: string;
}

/**
 * Everything the Pro plan unlocks. Display copy lives in the locale catalog,
 * while these stable IDs and icons stay independent of the interface language.
 */
export const PRO_FEATURES: ProFeature[] = [
  { id: 'courseScan', icon: 'scan_barcode' },
  { id: 'trends', icon: 'trending_up' },
  { id: 'incomeSources', icon: 'payments' },
  { id: 'csv', icon: 'upload_file' },
  { id: 'categoryBudgets', icon: 'category' },
  { id: 'rollover', icon: 'sync' },
  { id: 'household', icon: 'family_restroom' },
];

/**
 * Pro access is always resolved from the `plan` field stored on the Firebase
 * user profile (`users/{uid}.plan`) — never from a local flag. The localStorage
 * demo flag only applies in pure demo mode, where no Firebase profile exists.
 */
export function isProUser(
  profile: ProUserLike,
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
): boolean {
  if (!profile) {
    // A Firebase user whose profile has not resolved yet is NOT a demo user, so
    // it must not be granted anything from local storage — that window (sign-in
    // → profile load) is exactly when a stale `flousy_pro_plan` flag from an
    // earlier demo session used to unlock Pro for a paying-tier feature set.
    // Only an explicitly active demo session may consult the flag.
    let demo = false;
    try {
      demo = storage?.getItem('flousy_demo_mode') === 'true';
    } catch {
      demo = false;
    }
    return demo && storage?.getItem('flousy_pro_plan') === 'true';
  }
  return resolveProEntitlement(profile).isPro;
}
