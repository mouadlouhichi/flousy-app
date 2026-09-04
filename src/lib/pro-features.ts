export const PRO_TRIAL_DAYS = 90;
export const PRO_TRIAL_DURATION_MS = PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type EntitlementSource = 'launch_trial' | 'stripe' | 'cmi' | 'admin';
export type EntitlementStatus =
  | 'trialing'
  | 'active'
  | 'grace_period'
  | 'past_due'
  | 'canceled'
  | 'expired';

export type ProUserLike = {
  plan?: string | null;
  entitlementSource?: EntitlementSource | string | null;
  entitlementStatus?: EntitlementStatus | string | null;
  entitlementStartedAtMs?: number | null;
  entitlementEndsAtMs?: number | null;
  /** Legacy beta marker retained so an old claim cannot be repeated. */
  proTrialClaimedAt?: string | null;
} | null;

export interface ProEntitlement {
  isPro: boolean;
  source: EntitlementSource | 'legacy' | null;
  status: EntitlementStatus | 'free';
  startedAtMs: number | null;
  endsAtMs: number | null;
  daysRemaining: number;
  hasUsedTrial: boolean;
}

/**
 * Entitlement enums are compared by value, never by spelling: profiles edited
 * in the Firebase console (or migrated by hand) carry `'Pro'`, `'Trialing '`
 * and friends, and `firestore.rules` reads those tokens the same tolerant way
 * (`tokenValue()` there). Diverging in either direction is what makes a
 * workspace look unlocked in the UI and get 403 write after 403 write.
 */
export function entitlementToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * Tolerant of casing/whitespace written by old clients or manual migrations.
 * Feature decisions must still go through `resolveProEntitlement`/`isProUser`,
 * because a launch-trial profile keeps `plan: 'pro'` after its access expires.
 */
export function isProPlan(plan: unknown): boolean {
  return entitlementToken(plan) === 'pro';
}

function finiteMillis(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null;
}

function legacyTrialWindow(profile: NonNullable<ProUserLike>): {
  startedAtMs: number;
  endsAtMs: number;
} | null {
  if (typeof profile.proTrialClaimedAt !== 'string') return null;
  const startedAtMs = Date.parse(profile.proTrialClaimedAt);
  if (!Number.isFinite(startedAtMs)) return null;
  return { startedAtMs, endsAtMs: startedAtMs + PRO_TRIAL_DURATION_MS };
}

/**
 * Resolve the account's effective entitlement without trusting `plan` alone.
 *
 * Launch trials have an explicit, immutable server-rules-validated end time.
 * Stripe/CMI will later project their signed webhook state into the same fields
 * through the Admin SDK. A canceled paid period remains usable until its end;
 * past-due/expired periods do not unlock features.
 */
export function resolveProEntitlement(
  profile: ProUserLike,
  nowMs = Date.now(),
): ProEntitlement {
  const free: ProEntitlement = {
    isPro: false,
    source: null,
    status: 'free',
    startedAtMs: null,
    endsAtMs: null,
    daysRemaining: 0,
    hasUsedTrial: false,
  };
  if (!profile) return free;

  const legacyTrial = legacyTrialWindow(profile);
  const source = entitlementToken(profile.entitlementSource);
  const hasUsedTrial = source === 'launch_trial' || Boolean(legacyTrial);
  if (!isProPlan(profile.plan)) return { ...free, hasUsedTrial };

  const startedAtMs = finiteMillis(profile.entitlementStartedAtMs)
    ?? legacyTrial?.startedAtMs
    ?? null;
  const endsAtMs = finiteMillis(profile.entitlementEndsAtMs)
    ?? legacyTrial?.endsAtMs
    ?? null;
  const daysRemaining = endsAtMs && endsAtMs > nowMs
    ? Math.max(1, Math.ceil((endsAtMs - nowMs) / (24 * 60 * 60 * 1000)))
    : 0;

  if (source === 'launch_trial' || legacyTrial) {
    const active = Boolean(endsAtMs && endsAtMs > nowMs);
    return {
      isPro: active,
      source: source === 'launch_trial' ? 'launch_trial' : 'legacy',
      status: active ? 'trialing' : 'expired',
      startedAtMs,
      endsAtMs,
      daysRemaining,
      hasUsedTrial: true,
    };
  }

  const normalizedStatus = profile.entitlementStatus == null
    ? ''
    : entitlementToken(profile.entitlementStatus);
  const statusAllowsAccess = normalizedStatus === ''
    || normalizedStatus === 'active'
    || normalizedStatus === 'trialing'
    || normalizedStatus === 'grace_period'
    || normalizedStatus === 'canceled';
  const periodAllowsAccess = endsAtMs === null || endsAtMs > nowMs;
  const isPro = statusAllowsAccess && periodAllowsAccess;

  return {
    isPro,
    source: source === 'stripe' || source === 'cmi' || source === 'admin' ? source : 'legacy',
    status: isPro
      ? (normalizedStatus === 'trialing' || normalizedStatus === 'grace_period' || normalizedStatus === 'canceled'
        ? normalizedStatus
        : 'active')
      : 'expired',
    startedAtMs,
    endsAtMs,
    daysRemaining,
    hasUsedTrial,
  };
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
 * Pro access comes from the Firebase profile's effective entitlement. The
 * localStorage path exists only for explicit demo mode and is expiry-aware too.
 */
export function isProUser(
  profile: ProUserLike,
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
  nowMs = Date.now(),
): boolean {
  if (profile) return resolveProEntitlement(profile, nowMs).isPro;

  let demo = false;
  try {
    demo = storage?.getItem('flousy_demo_mode') === 'true';
    if (!demo || storage?.getItem('flousy_pro_plan') !== 'true') return false;
    const endsAt = Number(storage?.getItem('flousy_pro_trial_ends_at'));
    // Preserve old demo sessions that predate expiry-aware trial storage.
    return !Number.isFinite(endsAt) || endsAt <= 0 || endsAt > nowMs;
  } catch {
    return false;
  }
}

/** Start the same one-time 90-day experience in local-only demo mode. */
export function claimDemoProTrial(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  nowMs = Date.now(),
): boolean {
  if (storage.getItem('flousy_pro_trial_started_at')) return false;
  storage.setItem('flousy_pro_plan', 'true');
  storage.setItem('flousy_pro_entitlement_source', 'launch_trial');
  storage.setItem('flousy_pro_trial_started_at', String(nowMs));
  storage.setItem('flousy_pro_trial_ends_at', String(nowMs + PRO_TRIAL_DURATION_MS));
  return true;
}
