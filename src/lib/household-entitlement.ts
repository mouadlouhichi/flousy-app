/**
 * Why a household write was refused, and what the app can do about it.
 *
 * `firestore.rules` authorizes every shared-workspace write by re-reading the
 * sponsor's profile (`activeProEntitlement`), never the projection stored on
 * `households/{hid}`. That single fact produces the whole class of "my plan is
 * active but the server says no" reports: the household can point at another
 * account's plan, at a plan that has since lapsed, or at nothing at all when
 * the document predates the field. Each of those needs a different answer from
 * the user, and only the first two can be told apart from inside the browser.
 *
 * This module is pure and browser-free so the rules, the gates and the repair
 * flow are pinned by the same tests. The matching rules helpers are
 * `householdSponsor()`, `profileIsPro()` and `householdSponsorBindingValid()`.
 */
import {
  entitlementToken,
  resolveProEntitlement,
  type EntitlementSource,
  type EntitlementStatus,
  type ProUserLike,
} from './pro-features';

export type HouseholdEntitlementFields = {
  ownerId?: string | null;
  planOwnerId?: string | null;
  entitlementOwnerId?: string | null;
  entitlementSource?: string | null;
  entitlementStatus?: string | null;
  entitlementEndsAtMs?: number | null;
};

const ENTITLEMENT_SOURCES: EntitlementSource[] = ['launch_trial', 'stripe', 'cmi', 'admin'];
const ENTITLEMENT_STATUSES: EntitlementStatus[] = [
  'trialing', 'active', 'grace_period', 'past_due', 'canceled', 'expired',
];

/**
 * The account whose Pro plan pays for this workspace, resolved with the same
 * fallback chain as `normalizeHousehold()` and `householdSponsor()` in
 * firestore.rules: an explicit sponsor, else the billing owner, else the
 * household's own creator on documents written before the split existed.
 */
export function householdSponsorId(
  household: HouseholdEntitlementFields | null | undefined,
): string {
  if (!household) return '';
  return household.entitlementOwnerId
    || household.planOwnerId
    || household.ownerId
    || '';
}

/**
 * `millisOrMissing()` in firestore.rules: a usable expiry or nothing. Deliberately
 * no rounding - the rules compare this value against the profile byte for byte,
 * so a client that tidied it on the way through would make every write of the
 * projection invalid.
 */
function profileExpiryMillis(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

export interface HouseholdSponsorBinding {
  /**
   * Merge-patch for `households/{hid}`. `null` deletes a key: a projection
   * entry the sponsor's profile no longer carries is as wrong as a missing one,
   * and the rules only accept the document when every entry mirrors it.
   */
  patch: {
    entitlementOwnerId: string;
    entitlementSource: EntitlementSource | null;
    entitlementStatus: EntitlementStatus | null;
    entitlementEndsAtMs: number | null;
  };
  /** True when this account holds an entitlement the household can be bound to. */
  bindable: boolean;
  /** Profile fields the rules cannot accept, so a write built from them is doomed. */
  rejectedFields: string[];
}

/**
 * Build the projection the rules will accept for `uid` — the exact set of
 * fields `validHouseholdEntitlementProjection()` (household creation) and
 * `householdSponsorBindingValid()` (repair of an existing household) demand.
 * Values are taken from the profile itself, lower-cased the way both sides
 * compare them, and an absent profile field becomes a deletion rather than a
 * guess: `resolveProEntitlement()` derives `'active'` for an unbounded grant,
 * and the rules accept precisely that spelling while the profile is active.
 */
export function buildHouseholdSponsorBinding(
  profile: ProUserLike,
  uid: string,
  nowMs = Date.now(),
): HouseholdSponsorBinding {
  const raw = profile ?? {};
  const rejectedFields: string[] = [];

  const sourceToken = entitlementToken(raw.entitlementSource);
  const hasSource = sourceToken !== '';
  if (hasSource && !ENTITLEMENT_SOURCES.includes(sourceToken as EntitlementSource)) {
    rejectedFields.push('entitlementSource');
  }
  const statusToken = entitlementToken(raw.entitlementStatus);
  const hasStatus = statusToken !== '';
  if (hasStatus && !ENTITLEMENT_STATUSES.includes(statusToken as EntitlementStatus)) {
    rejectedFields.push('entitlementStatus');
  }

  const isPro = resolveProEntitlement(profile, nowMs).isPro;
  return {
    patch: {
      entitlementOwnerId: uid,
      entitlementSource: hasSource ? (sourceToken as EntitlementSource) : null,
      // An unbounded grant has no status of its own; project the one the
      // client gates on ('active'), which the rules accept while the profile
      // really is active and reject otherwise.
      entitlementStatus: hasStatus ? (statusToken as EntitlementStatus) : (isPro ? 'active' : null),
      entitlementEndsAtMs: profileExpiryMillis(raw.entitlementEndsAtMs),
    },
    bindable: isPro && rejectedFields.length === 0,
    rejectedFields,
  };
}

export type HouseholdSponsorProjectionFields = {
  entitlementOwnerId: string;
  entitlementSource?: EntitlementSource;
  entitlementStatus?: EntitlementStatus;
  entitlementEndsAtMs?: number;
};

/**
 * The same projection without its deletions, for writing a brand new household
 * document (a fresh document has nothing to remove).
 */
export function householdSponsorProjectionFields(
  binding: HouseholdSponsorBinding,
): HouseholdSponsorProjectionFields {
  const { patch } = binding;
  return {
    entitlementOwnerId: patch.entitlementOwnerId,
    ...(patch.entitlementSource ? { entitlementSource: patch.entitlementSource } : {}),
    ...(patch.entitlementStatus ? { entitlementStatus: patch.entitlementStatus } : {}),
    ...(patch.entitlementEndsAtMs ? { entitlementEndsAtMs: patch.entitlementEndsAtMs } : {}),
  };
}

/** True when the stored household document does not yet carry this projection. */
export function householdSponsorBindingIsStale(
  household: HouseholdEntitlementFields | null | undefined,
  binding: HouseholdSponsorBinding,
): boolean {
  if (!household) return false;
  const stored = household.entitlementOwnerId ?? '';
  if (stored !== binding.patch.entitlementOwnerId) return true;
  if (entitlementToken(household.entitlementSource) !== (binding.patch.entitlementSource ?? '')) return true;
  if (entitlementToken(household.entitlementStatus) !== (binding.patch.entitlementStatus ?? '')) return true;
  const storedEnds = profileExpiryMillis(household.entitlementEndsAtMs);
  return storedEnds !== binding.patch.entitlementEndsAtMs;
}

/** Outcome of `rebindHouseholdSponsor`, so callers can be truthful about it. */
export type SponsorRebindOutcome =
  /** The household now pays with this account's plan; queued writes should commit. */
  | 'repaired'
  /** Nothing to change: the refusal came from somewhere else. */
  | 'already-consistent'
  /** Only a household owner can move who pays for the workspace. */
  | 'not-owner'
  /** This account holds no usable entitlement to bind. */
  | 'no-entitlement'
  /**
   * The deployed rules rejected the repair. Their condition predates sponsor
   * rebinding, so this is the one case where redeploying them is the answer.
   */
  | 'rejected-by-rules'
  /** Offline, or Firestore is not configured on this deployment. */
  | 'unavailable';

export type HouseholdWriteDenial =
  /**
   * The household is paid for by another account and that account's plan is
   * not active. `sponsor-rebindable` is the repairable variant of this state.
   */
  | 'sponsor-lapsed'
  /** The signed-in owner can restore access by binding their own entitlement. */
  | 'sponsor-rebindable'
  /** The document stores no sponsor at all (legacy household). */
  | 'sponsor-unset'
  /**
   * The profile stores an entitlement value outside the app's schema (a plan
   * typed into the console as `plan: 'pro', entitlementStatus: 'ok'`), which
   * the rules rightly refuse to copy onto the household. No subscription is
   * missing and no redeploy helps: the profile has to be corrected.
   */
  | 'profile-invalid'
  /** The sponsor is this account, so only the deployed rules can explain it. */
  | 'rules-behind'
  /** The member is not the sponsor and cannot read whose plan is in use. */
  | 'sponsor-unreadable'
  /** Nothing the client can see justifies the refusal. */
  | 'unknown';

export interface HouseholdWriteDenialInput {
  household: HouseholdEntitlementFields | null | undefined;
  /** The signed-in account's profile. Only their own document is readable. */
  profile: ProUserLike;
  uid: string | null | undefined;
  /** Whether this account owns the household, i.e. may move its plan owner. */
  isOwner: boolean;
  /** Clock for the expiry checks; `profileIsPro()` uses the server's. */
  nowMs?: number;
}

/**
 * Explain a household `permission-denied` from what the browser is allowed to
 * read: the household document, the caller's own profile and their membership.
 * Deliberately conservative — every answer here has to be actionable, so a
 * state that cannot be confirmed is reported as `unknown` rather than guessed.
 */
export function diagnoseHouseholdWriteDenial({
  household,
  profile,
  uid,
  isOwner,
  nowMs = Date.now(),
}: HouseholdWriteDenialInput): HouseholdWriteDenial {
  if (!household || !uid) return 'unknown';
  const sponsor = householdSponsorId(household);
  if (!sponsor) return 'sponsor-unset';
  if (sponsor !== uid) {
    // Only the sponsor can be re-bound, and only by the household's owner.
    if (!isOwner) return 'sponsor-unreadable';
    return buildHouseholdSponsorBinding(profile, uid, nowMs).bindable
      ? 'sponsor-rebindable'
      : 'sponsor-lapsed';
  }
  // The sponsor is this account, so the refusal cannot come from the plan
  // itself: it is either a projection the profile cannot satisfy (an
  // out-of-band edit) or a deployed rules file older than this client.
  const binding = buildHouseholdSponsorBinding(profile, uid, nowMs);
  if (binding.rejectedFields.length > 0) return 'profile-invalid';
  if (!binding.bindable) return 'sponsor-lapsed';
  return 'rules-behind';
}

/* ------------------------------------------------------------------------- *
 * Restoring a locked-out owner's own membership row
 * ------------------------------------------------------------------------- */

/** The row a household owner may always write for themselves. */
export interface HouseholdOwnerMembershipRow {
  id: string;
  userId: string;
  displayName: string;
  email?: string;
  role: 'owner';
  status: 'active';
  joinedAt: string;
}

export type HouseholdMembershipRepair =
  /** Nothing this account may write would change the outcome. */
  | { action: 'none'; reason: 'not-owner' | 'already-owner' }
  /**
   * The row exists as this account's owner row but is not active. The published
   * rules refuse an update that would re-activate a row whose role is already
   * `owner` (`resource.data.role != 'owner'` guards that branch) and refuse the
   * delete of one, so no client can fix this: it needs the console, or the
   * rules this app ships with.
   */
  | { action: 'blocked'; reason: 'owner-row-not-active' }
  /** `replace` when a non-owner stub is in the way, plain write otherwise. */
  | { action: 'write'; replace: boolean; member: HouseholdOwnerMembershipRow };

export interface HouseholdMembershipRepairInput {
  household: { ownerId?: string; createdAt?: string } | null | undefined;
  /** The caller's stored `members/{uid}` document, or null when it is absent. */
  member: Record<string, unknown> | null | undefined;
  uid: string | null | undefined;
  displayName?: string | null;
  email?: string | null;
  /** Clock for `joinedAt`; a stored row's own value is preserved when present. */
  nowIso?: string;
}

/**
 * Decide what the client may legitimately do about a refusal that is not about
 * the plan.
 *
 * `householdEditor()` in the published rules is `householdMember(hid) && role in
 * [owner, editor]`: a household whose owner has no row in `members/` is readable
 * by them and writable by nobody, which reads as a lost budget rather than as a
 * permission problem. Only the household's own owner may create that row for
 * themselves, and that create branch asks for no entitlement, so this is the one
 * repair available against a rules deployment that is older than this build.
 */
export function planHouseholdMembershipRepair({
  household,
  member,
  uid,
  displayName,
  email,
  nowIso = new Date().toISOString(),
}: HouseholdMembershipRepairInput): HouseholdMembershipRepair {
  if (!uid || !household || household.ownerId !== uid) return { action: 'none', reason: 'not-owner' };
  const role = typeof member?.role === 'string' ? member.role : '';
  const status = typeof member?.status === 'string' ? member.status : '';
  if (role === 'owner' && status === 'active') return { action: 'none', reason: 'already-owner' };
  if (role === 'owner') return { action: 'blocked', reason: 'owner-row-not-active' };
  const storedJoinedAt = typeof member?.joinedAt === 'string' ? member.joinedAt : '';
  return {
    action: 'write',
    replace: Boolean(member),
    member: {
      id: uid,
      userId: uid,
      displayName: (displayName || '').trim() || (email || '').split('@')[0] || 'Owner',
      ...(email ? { email } : {}),
      role: 'owner',
      status: 'active',
      joinedAt: storedJoinedAt || household.createdAt || nowIso,
    },
  };
}
