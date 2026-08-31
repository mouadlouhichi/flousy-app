import type { MonthBudget } from './store';
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

