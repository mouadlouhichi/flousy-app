import {
  DEFAULT_MONEY_PLACES,
  fixedPaidAmount,
  type FixedCategoryItem,
  type MoneyPlace,
  type MoneyPlaceConfig,
  type MonthBudget,
  type UserProfile,
} from './store';
import { HOUSEHOLD_DEFAULT_CATEGORIES } from './schema-migrations';
import type { HouseholdPermissions } from './household-rbac';
import { resolveProEntitlement } from './pro-features';

/**
 * Read a stored household document into the shape the app renders.
 *
 * The defaults for fields a legacy document never stored come from
 * `schema-migrations.ts`, the same place the backfill reads them: the reader
 * papers over a household written before `moneyPlaces` existed, which is exactly
 * why the gap stays invisible until a write to that document is refused. Both
 * halves - tolerant read and repair - must agree on the value, or the migration
 * would visibly change somebody's budget.
 */
export function normalizeHousehold(id: string, value: Partial<Household>): Household {
  // fundTarget is validated out of the raw spread: an invalid stored value
  // (negative, NaN from a hand-edit) must vanish rather than ride along.
  const { fundTarget, ...rest } = value;
  return {
    ...rest,
    id,
    name: value.name || 'Household',
    kind: value.kind === 'business' ? 'business' : 'household',
    ownerId: value.ownerId || '',
    planOwnerId: value.planOwnerId || value.ownerId || '',
    entitlementOwnerId: value.entitlementOwnerId || value.planOwnerId || value.ownerId || '',
    currency: value.currency || 'MAD',
    moneyPlaces: value.moneyPlaces?.length
      ? value.moneyPlaces
      : DEFAULT_MONEY_PLACES.map((place) => ({ ...place })),
    activeCategories: value.activeCategories?.length
      ? value.activeCategories
      : [...HOUSEHOLD_DEFAULT_CATEGORIES],
    ...(typeof fundTarget === 'number' && Number.isFinite(fundTarget) && fundTarget >= 0
      ? { fundTarget: Math.round(fundTarget * 100) / 100 }
      : {}),
    createdAt: value.createdAt || new Date(0).toISOString(),
    updatedAt: value.updatedAt || value.createdAt || new Date(0).toISOString(),
    schemaVersion: Math.max(2, value.schemaVersion || 0),
  };
}

export type HouseholdRole = 'owner' | 'editor' | 'contributor' | 'viewer' | 'custom' | 'profile';
export type HouseholdMemberStatus = 'active' | 'invited' | 'inactive';

/**
 * What a shared-workspace document is used for. `household` is the family
 * budget; `business` is a second solo budget (auto-entrepreneur, side
 * activity) that reuses the same documents, rules and RBAC but is not meant
 * to be shared. Absent on older documents = 'household'.
 */
export type WorkspaceKind = 'household' | 'business';

export interface Household {
  id?: string;
  name: string;
  kind?: WorkspaceKind;
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
  /**
   * Monthly amount the household aims to pool in the shared fund (money paid
   * with the 'household' payer). Owner-set; purely a target — the pooled
   * total for the period is computed from the payments themselves.
   */
  fundTarget?: number;
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

/**
 * Payer chips for a shared workspace ("who paid?").
 *
 * "Me" already stands for the signed-in member, so their own roster row is
 * left out — listing it again showed a one-person household as
 * "Me · Mouad · Household funds" with "Me" and "Mouad" being the same payer.
 * Pooled "Household funds" only means something once someone else shares
 * the budget, so that chip appears only alongside another active member.
 */
export function householdPayerOptions(
  members: HouseholdMember[],
  currentUserId: string | undefined,
  labels: { me: string; funds: string },
): HouseholdPayer[] {
  const others = members.filter(
    (member) => member.status === 'active' && !(currentUserId && (member.userId === currentUserId || member.id === currentUserId)),
  );
  return [
    { id: 'self', label: labels.me },
    ...(others.length > 0 ? [{ id: 'household', label: labels.funds }] : []),
    ...others.map((member) => ({ id: member.id, label: member.displayName, color: member.avatarColor })),
  ];
}

export function householdStorageKey(householdId: string | undefined, monthKey: string) {
  return householdId ? `smartjib_household_${householdId}_month_${monthKey}` : `smartjib_month_${monthKey}`;
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
  const { collaborators, byMemberId, byUserId } = contributionMemberMaps(members);
  const paidByMemberId = new Map<string, number>(collaborators.map((member) => [member.id, 0]));
  let pooledTotal = 0;
  let unattributedTotal = 0;

  const attribute = (payerMemberId: string | undefined, createdByUserId: string | undefined, amount: number) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
    const target = attributeContribution(payerMemberId, createdByUserId, byMemberId, byUserId);
    if (target.kind === 'member') {
      paidByMemberId.set(target.memberId, (paidByMemberId.get(target.memberId) || 0) + amount);
    } else if (target.kind === 'pooled') {
      pooledTotal += amount;
    } else {
      unattributedTotal += amount;
    }
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

/** One payment that a contribution row is made of (tappable drill-down). */
export interface HouseholdContributionItem {
  id: string;
  kind: 'variable' | 'fixed';
  name: string;
  /** YYYY-MM-DD as stored on the transaction. */
  date: string;
  amount: number;
  category: string;
}

/**
 * The individual payments behind one member's contribution total, using the
 * exact same attribution rules as `computeHouseholdContributions` (named
 * payer first, then `self`/missing resolved through createdByUserId). Pooled
 * and unattributed payments never land on a member row, so they are excluded
 * here too — the totals of these items always add up to the row's `paid`.
 */
export function computeMemberContributionItems(
  month: Pick<MonthBudget, 'variableExpenses' | 'fixedExpenses'> | undefined | null,
  members: HouseholdMember[],
  memberId: string,
): HouseholdContributionItem[] {
  const { byMemberId, byUserId } = contributionMemberMaps(members);

  const attributedTo = (payerMemberId: string | undefined, createdByUserId: string | undefined): string | null => {
    const target = attributeContribution(payerMemberId, createdByUserId, byMemberId, byUserId);
    return target.kind === 'member' ? target.memberId : null;
  };

  const items: HouseholdContributionItem[] = [];
  for (const expense of month?.variableExpenses || []) {
    if (!expense || typeof expense.amount !== 'number' || !Number.isFinite(expense.amount) || expense.amount <= 0) continue;
    if (attributedTo(expense.payerMemberId, expense.createdByUserId) !== memberId) continue;
    items.push({ id: expense.id, kind: 'variable', name: expense.name, date: expense.date, amount: expense.amount, category: expense.type });
  }
  for (const bill of month?.fixedExpenses || []) {
    const paid = fixedPaidAmount(bill);
    if (!bill || paid <= 0) continue;
    if (attributedTo(bill.payerMemberId, bill.createdByUserId) !== memberId) continue;
    items.push({ id: bill.id, kind: 'fixed', name: bill.name, date: bill.paidAt || bill.date || '', amount: paid, category: bill.type });
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Where one payment lands under the shared attribution rules. */
type ContributionAttribution =
  | { kind: 'member'; memberId: string }
  | { kind: 'pooled' }
  | { kind: 'unattributed' };

/**
 * The single attribution rule used by every contribution view: a named
 * active collaborator wins, then the pooled 'household' payer, then a
 * 'self'/missing payer resolved through the createdByUserId audit stamp —
 * anything else is unattributed.
 */
function attributeContribution(
  payerMemberId: string | undefined,
  createdByUserId: string | undefined,
  byMemberId: Map<string, HouseholdMember>,
  byUserId: Map<string, HouseholdMember>,
): ContributionAttribution {
  const named = payerMemberId ? byMemberId.get(payerMemberId) : undefined;
  if (named) return { kind: 'member', memberId: named.id };
  if (payerMemberId === 'household') return { kind: 'pooled' };
  if ((!payerMemberId || payerMemberId === 'self') && createdByUserId) {
    const author = byUserId.get(createdByUserId);
    if (author) return { kind: 'member', memberId: author.id };
  }
  return { kind: 'unattributed' };
}

function contributionMemberMaps(members: HouseholdMember[]) {
  const collaborators = members.filter((member) => member.status === 'active' && member.role !== 'profile');
  const byMemberId = new Map(collaborators.map((member) => [member.id, member]));
  const byUserId = new Map(
    collaborators.filter((member) => member.userId).map((member) => [member.userId as string, member]),
  );
  return { collaborators, byMemberId, byUserId };
}

/**
 * The individual payments behind the pooled ('household' payer) or the
 * unattributed contribution total — the same transactions the summary rows
 * in the household panel aggregate, so the drill-down always adds up to the
 * row it was opened from.
 */
export function computeGroupContributionItems(
  month: Pick<MonthBudget, 'variableExpenses' | 'fixedExpenses'> | undefined | null,
  members: HouseholdMember[],
  group: 'pooled' | 'unattributed',
): HouseholdContributionItem[] {
  const { byMemberId, byUserId } = contributionMemberMaps(members);
  const items: HouseholdContributionItem[] = [];
  const consider = (
    id: string,
    kind: 'variable' | 'fixed',
    name: string,
    date: string,
    amount: number,
    category: string,
    payerMemberId: string | undefined,
    createdByUserId: string | undefined,
  ) => {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return;
    if (attributeContribution(payerMemberId, createdByUserId, byMemberId, byUserId).kind !== group) return;
    items.push({ id, kind, name, date, amount, category });
  };
  for (const expense of month?.variableExpenses || []) {
    if (!expense) continue;
    consider(expense.id, 'variable', expense.name, expense.date, expense.amount, expense.type, expense.payerMemberId, expense.createdByUserId);
  }
  for (const bill of month?.fixedExpenses || []) {
    if (!bill) continue;
    consider(bill.id, 'fixed', bill.name, bill.paidAt || bill.date || '', fixedPaidAmount(bill), bill.type, bill.payerMemberId, bill.createdByUserId);
  }
  return items.sort((a, b) => (a.date < b.date ? 1 : -1));
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
/**
 * Entitlement truth for the household EDITING gate.
 *
 * Firestore rules decide every household write by reading the OWNER'S
 * PROFILE (activeProEntitlement) - the household's own projection is an
 * immutable creation-day copy that can lag the profile. When the current
 * user IS the owner we therefore evaluate their profile directly, so the
 * client pauses editing at exactly the moment the server starts rejecting
 * writes (no doomed edit attempts that queue and fail with 403). A
 * non-owner member cannot read the owner's profile, so the projection is
 * their best local truth; a stale projection for a member surfaces as a
 * permission error handled at the sync layer.
 */
export function householdEntitlementForEditor(
  household: Pick<Household, 'entitlementSource' | 'entitlementStatus' | 'entitlementEndsAtMs'> | null | undefined,
  editorProfile: Parameters<typeof resolveProEntitlement>[0],
  isOwner: boolean,
  nowMs = Date.now(),
): boolean {
  if (isOwner) return resolveProEntitlement(editorProfile, nowMs).isPro;
  return isHouseholdEntitlementActive(household, nowMs);
}

export function isHouseholdEntitlementActive(
  household: Pick<Household, 'entitlementSource' | 'entitlementStatus' | 'entitlementEndsAtMs'> | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!household) return false;
  // Rules treat an absent expiry as unbounded: only an explicitly negative
  // status (projected by the Admin SDK) withdraws access. Households created
  // before expiry-aware launch trials carry no projection at all and keep
  // their data and access.
  if (household.entitlementEndsAtMs == null) {
    if (!household.entitlementSource) return true;
    return household.entitlementStatus !== 'past_due' && household.entitlementStatus !== 'expired';
  }
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

