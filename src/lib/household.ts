import type { MonthBudget, UserProfile } from './store';
import type { HouseholdPermissions } from './household-rbac';

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
  status: 'pending' | 'accepted' | 'revoked';
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

export interface HouseholdInvoice {
  id: string;
  name: string;
  amount: number;
  category: string;
  date: string;
  payerMemberId: string;
  submitterId: string;
  receiptUrl?: string;
  note?: string;
  status: 'submitted' | 'approved' | 'rejected';
  createdAt: string;
}

/** Which profile field holds the start date for a workspace. */
/**
 * Trims a household name and enforces the Firestore rule contract
 * (`firestore.rules`: `name.size() > 0 && name.size() <= 100`). Returns the
 * cleaned name, or `null` when it would be rejected, so the UI and the context
 * share one definition of "valid".
 */
/** Roles an owner may assign to an existing member (never owner/profile). */
export type AssignableMemberRole = 'editor' | 'viewer' | 'contributor' | 'custom';

/** True when a stored member role can be offered in the edit-member form. */
export function isAssignableMemberRole(role: string): role is AssignableMemberRole {
  return role === 'editor' || role === 'viewer' || role === 'contributor' || role === 'custom';
}

export function normalizeHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) return null;
  return trimmed;
}

export function monthStartDateField(
  workspace: 'personal' | 'household' | undefined,
): 'monthStartDate' | 'householdMonthStartDate' {
  return workspace === 'household' ? 'householdMonthStartDate' : 'monthStartDate';
}

/**
 * The monthly start date that applies to the active workspace.
 *
 * Personal and household budgets are usually paid on different days, so each
 * workspace keeps its own value. A household that has not been given one yet
 * falls back to the personal setting, so switching workspace never leaves the
 * budget period undefined.
 */
export function monthStartDateFor(
  profile: Pick<UserProfile, 'monthStartDate' | 'householdMonthStartDate'> | null | undefined,
  workspace: 'personal' | 'household' | undefined,
): number | undefined {
  if (!profile) return undefined;
  return workspace === 'household'
    ? (profile.householdMonthStartDate ?? profile.monthStartDate)
    : profile.monthStartDate;
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

/**
 * Within a household workspace, Pro features (such as Trends, Category Budgets, CSV import/export)
 * are unlocked for active household members.
 */
export function isProFeatureUnlocked(
  isProUser: boolean,
  workspace: 'personal' | 'household' | undefined,
): boolean {
  return isProUser || workspace === 'household';
}

