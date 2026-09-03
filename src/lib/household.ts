import { fixedPaidAmount, type FixedCategoryItem, type MoneyPlace, type MoneyPlaceConfig, type MonthBudget, type UserProfile } from './store';
import type { HouseholdPermissions } from './household-rbac';
import { resolveProEntitlement } from './pro-features';

export type HouseholdRole = 'owner' | 'editor' | 'contributor' | 'viewer' | 'custom' | 'profile';
export type HouseholdMemberStatus = 'active' | 'invited' | 'inactive';

export interface Household {
  id?: string;
  name: string;
  ownerId: string;
  planOwnerId: string;
  createdAt: string;
  updatedAt: string;
  /** False until the household owner finishes household onboarding. */
  onboardingComplete?: boolean;
  /** Authoritative workspace configuration. Personal profile preferences never leak in. */
  currency: string;
  monthStartDate?: number;
  moneyPlaces: MoneyPlaceConfig[];
  activeCategories: string[];
  categoryColors?: Record<string, string>;
  categoryIcons?: Record<string, string>;
  fixedCategories?: FixedCategoryItem[];
  defaultCategoryBudgets?: Record<string, number>;
  enableRollover?: boolean;
  entitlementOwnerId: string;
  /** Readable projection of the owner's entitlement for member-side feature gates. */
  entitlementSource?: 'launch_trial' | 'stripe' | 'cmi' | 'admin';
  entitlementStatus?: 'trialing' | 'active' | 'grace_period' | 'past_due' | 'canceled' | 'expired';
  entitlementEndsAtMs?: number;
  schemaVersion?: number;
}

export interface HouseholdMember {
  id: string;
  displayName: string;
  email?: string;
  userId?: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  avatarColor: string;
  permissions?: HouseholdPermissions;
  /**
   * Invitation this membership was claimed from. Rules require it on a
   * self-created membership row (it is what proves the claim was invited) and
   * it lets acceptance retire the owner's pending row.
   */
  inviteId?: string;
  invitedAt?: string;
  joinedAt?: string;
  /** Set when the recipient retires the email-bound pending row. */
  retiredAt?: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  memberId: string;
  email: string;
  role: Extract<HouseholdRole, 'editor' | 'contributor' | 'viewer' | 'custom'>;
  permissions?: HouseholdPermissions;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  /** Numeric expiry is enforceable in Firestore Rules (legacy string-only invites cannot be claimed). */
  expiresAtMs: number;
  status: 'pending' | 'accepted' | 'revoked';
  acceptedByUserId?: string;
  acceptedEmail?: string;
  acceptedAt?: string;
}

export interface HouseholdPayer {
  id: string;
  label: string;
  color?: string;
}

export function householdStorageKey(householdId: string | undefined, monthKey: string) {
  return householdId ? `flousy_household_${householdId}_month_${monthKey}` : `flousy_month_${monthKey}`;
}

export function actorForMonth<T extends MonthBudget>(month: T, userId?: string): T {
  // Audit fields are intentionally optional so old personal documents remain valid.
  return { ...month, updatedAt: new Date().toISOString(), ...(userId ? { updatedByUserId: userId } : {}) };
}

/** One active collaborator's paid total and settle-up balance for a period. */
export interface MemberContribution {
  member: HouseholdMember;
  paid: number;
  /** paid - equalShare, cent-rounded. Positive = paid more than the share. */
  balance: number;
}

/**
 * Settle-up summary behind "This month's contributions".
 *
 * Attribution precedence per payment (variable amount / fixed paid amount):
 * 1. `payerMemberId` names an active collaborator (status 'active', role not
 *    'profile') -> that member.
 * 2. `payerMemberId == 'household'` -> pooled funds; shown for completeness,
 *    excluded from the equal-share split.
 * 3. `payerMemberId` is the default `'self'` (or absent) -> resolved through
 *    the audit stamp `createdByUserId` to the member row carrying that uid.
 *    This is what makes the panel work for the default expense flow, where
 *    nobody taps a named payer badge: 'self' means "the member who recorded
 *    it paid from their own pocket".
 * 4. Anything else (unresolvable 'self', inactive or profile-role payers,
 *    legacy ids) -> unattributed; visible, excluded from the split.
 *
 * The equal share divides only the attributed total between active
 * collaborators, so pooled/unattributed money can never distort balances.
 */
export interface HouseholdContributions {
  rows: MemberContribution[];
  equalShare: number;
  /** Paid from pooled household funds ('household' payer). */
  pooledTotal: number;
  /** Paid but attributed to nobody eligible for the split. */
  unattributedTotal: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeHouseholdContributions(
  month: Pick<MonthBudget, 'variableExpenses' | 'fixedExpenses'> | undefined | null,
  members: HouseholdMember[],
): HouseholdContributions {
  const collaborators = members.filter((member) => member.status === 'active' && member.role !== 'profile');
  const byMemberId = new Map(collaborators.map((member) => [member.id, member]));
  const byUserId = new Map(
    collaborators.filter((member) => member.userId).map((member) => [member.userId as string, member]),
  );
  const paidByMemberId = new Map<string, number>(collaborators.map((member) => [member.id, 0]));
  let pooledTotal = 0;
  let unattributedTotal = 0;

  const attribute = (payerMemberId: string | undefined, createdByUserId: string | undefined, amount: number) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
    const named = payerMemberId ? byMemberId.get(payerMemberId) : undefined;
    if (named) {
      paidByMemberId.set(named.id, (paidByMemberId.get(named.id) || 0) + amount);
      return;
    }
    if (payerMemberId === 'household') {
      pooledTotal += amount;
      return;
    }
    if ((!payerMemberId || payerMemberId === 'self') && createdByUserId) {
      const author = byUserId.get(createdByUserId);
      if (author) {
        paidByMemberId.set(author.id, (paidByMemberId.get(author.id) || 0) + amount);
        return;
      }
    }
    unattributedTotal += amount;
  };

  for (const expense of month?.variableExpenses || []) {
    attribute(expense?.payerMemberId, expense?.createdByUserId, expense?.amount);
  }
  for (const bill of month?.fixedExpenses || []) {
    attribute(bill?.payerMemberId, bill?.createdByUserId, fixedPaidAmount(bill));
  }

  const attributedTotal = collaborators.reduce((sum, member) => sum + (paidByMemberId.get(member.id) || 0), 0);
  const equalShare = collaborators.length ? attributedTotal / collaborators.length : 0;
  const rows = collaborators.map((member) => {
    const paid = paidByMemberId.get(member.id) || 0;
    return { member, paid: roundMoney(paid), balance: roundMoney(paid - equalShare) };
  });

  return {
    rows,
    equalShare: roundMoney(equalShare),
    pooledTotal: roundMoney(pooledTotal),
    unattributedTotal: roundMoney(unattributedTotal),
  };
}

export interface HouseholdInvoice {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  payerMemberId: string;
  submitterId: string;
  place: MoneyPlace;
  receiptUrl?: string;
  note?: string;
  status: 'submitted' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  postedExpenseId?: string;
  postedMonthKey?: string;
}

/** Roles an owner may assign to an existing member (never owner/profile). */
export type AssignableMemberRole = 'editor' | 'viewer' | 'contributor' | 'custom';

/** True when a stored member role maps to enforceable Firestore access. */
export function isAssignableMemberRole(role: string): role is AssignableMemberRole {
  return role === 'editor' || role === 'viewer' || role === 'contributor' || role === 'custom';
}

/** Normalize a household name against the Firestore rule contract. */
export function normalizeHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) return null;
  return trimmed;
}

/**
 * Resolve the authoritative period start. Household configuration is stored on
 * the household document; a member's personal profile must never override it.
 */
export function monthStartDateFor(
  profile: Pick<UserProfile, 'monthStartDate'> | null | undefined,
  workspace: 'personal' | 'household' | undefined,
  household?: Pick<Household, 'monthStartDate'> | null,
): number | undefined {
  return workspace === 'household' ? household?.monthStartDate : profile?.monthStartDate;
}

/**
 * Pro upgrades apply only to a user's private personal account.
 * When inside a shared household workspace, Upgrade to Pro CTAs and modals must be hidden.
 */
export function canShowProUpgrade(
  isProUser: boolean,
  workspace: 'personal' | 'household' | undefined,
): boolean {
  return !isProUser && (workspace === undefined || workspace === 'personal');
}

/** Resolve the provider-neutral entitlement projection stored on a household. */
export function isHouseholdEntitlementActive(
  household: Pick<Household, 'entitlementSource' | 'entitlementStatus' | 'entitlementEndsAtMs'> | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!household) return false;
  // Households created before expiry-aware launch trials have no projection.
  // Preserve their data and access; all new households carry the immutable one.
  if (!household.entitlementSource && !household.entitlementEndsAtMs) return true;
  return resolveProEntitlement({
    plan: 'pro',
    entitlementSource: household.entitlementSource,
    entitlementStatus: household.entitlementStatus,
    entitlementEndsAtMs: household.entitlementEndsAtMs,
  }, nowMs).isPro;
}

/**
 * Household Pro features follow the owner's projected entitlement. Data stays
 * readable after expiry, while mutation controls fall back to the free tier.
 */
export function isProFeatureUnlocked(
  isProUser: boolean,
  workspace: 'personal' | 'household' | undefined,
  household?: Pick<Household, 'entitlementSource' | 'entitlementStatus' | 'entitlementEndsAtMs'> | null,
  nowMs = Date.now(),
): boolean {
  return isProUser || (workspace === 'household' && isHouseholdEntitlementActive(household, nowMs));
}

