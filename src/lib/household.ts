import type { MonthBudget } from './store';

export type HouseholdRole = 'owner' | 'editor' | 'viewer' | 'profile';
export type HouseholdMemberStatus = 'active' | 'invited' | 'inactive';

export interface Household {
  id?: string;
  name: string;
  ownerId: string;
  planOwnerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  id: string;
  displayName: string;
  email?: string;
  userId?: string;
  role: HouseholdRole;
  status: HouseholdMemberStatus;
  avatarColor: string;
  invitedAt?: string;
  joinedAt?: string;
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  memberId: string;
  email: string;
  role: Extract<HouseholdRole, 'editor' | 'viewer'>;
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
