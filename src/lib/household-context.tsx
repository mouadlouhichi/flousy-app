'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import { isProUser } from './pro-features';
import { createHousehold, createHouseholdInvite, getHouseholdInvite, subscribePendingHouseholdInvites, acceptHouseholdInvite, saveHouseholdMember, subscribeHousehold, subscribeHouseholdMembers } from './db';
import type { Household, HouseholdInvite, HouseholdMember, HouseholdPayer, HouseholdRole } from './household';
import { canEdit as canEditAreaRule, canView, type HouseholdArea, type HouseholdPermissions } from './household-rbac';

const COLORS = ['#00685f', '#8b5cf6', '#e05d44', '#2563eb', '#d97706', '#db2777'];
type HouseholdContextValue = {
  household: Household | null; members: HouseholdMember[]; loading: boolean; isOwner: boolean; canEdit: boolean; memberRole?: HouseholdRole; isContributor: boolean; workspace: 'personal' | 'household'; selectWorkspace: (workspace: 'personal' | 'household') => Promise<void>; canViewArea: (area: HouseholdArea) => boolean; canEditArea: (area: HouseholdArea, own?: boolean) => boolean;
  payers: HouseholdPayer[]; pendingInvites: HouseholdInvite[]; create: (name: string) => Promise<void>; addProfile: (name: string) => Promise<void>;
  invite: (name: string, email: string, role: 'editor' | 'contributor' | 'viewer') => Promise<string>;
  acceptInvite: (code: string) => Promise<void>; updateMember: (member: HouseholdMember) => Promise<void>;
};
const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfileData } = useAuth();
  const workspace = profile?.activeWorkspace === 'household' && profile.activeHouseholdId ? 'household' : 'personal';
  const householdId = workspace === 'household' ? profile?.activeHouseholdId : undefined;
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(!!householdId); return subscribeHousehold(householdId, (h) => { setHousehold(h); setLoading(false); }); }, [householdId]);
  useEffect(() => subscribeHouseholdMembers(householdId, setMembers), [householdId]);
  useEffect(() => subscribePendingHouseholdInvites(user?.email, setPendingInvites), [user?.email]);
  const myMember = members.find((m) => m.userId === user?.uid);
  const isOwner = myMember?.role === 'owner' || household?.ownerId === user?.uid;
  const canEdit = isOwner || myMember?.role === 'editor';
  const canViewArea = useCallback((area: HouseholdArea) => workspace === 'personal' || canView(myMember?.role, area, myMember?.permissions), [workspace, myMember]);
  const canEditArea = useCallback((area: HouseholdArea, own = false) => workspace === 'personal' || canEditAreaRule(myMember?.role, area, myMember?.permissions, own), [workspace, myMember]);
  const memberRole = myMember?.role;
  const isContributor = memberRole === 'contributor';
  const payers = useMemo<HouseholdPayer[]>(() => {
    if (household) return [{ id: 'household', label: 'Household funds' }, ...members.filter(m => m.status !== 'inactive').map(m => ({ id: m.id, label: m.displayName, color: m.avatarColor }))];
    const legacy = profile?.householdMembers || [];
    return [{ id: 'self', label: 'Me' }, ...legacy.map((label, i) => ({ id: `legacy-${i}`, label, color: COLORS[i % COLORS.length] }))];
  }, [household, members, profile?.householdMembers]);
  const create = useCallback(async (name: string) => {
    if (!user || !profile || !isProUser(profile)) throw new Error('Households are available with Pro.');
    const now = new Date().toISOString(), memberId = user.uid;
    const id = await createHousehold(user.uid, { name: name.trim() || 'My household', ownerId: user.uid, planOwnerId: user.uid, createdAt: now, updatedAt: now }, { id: memberId, displayName: profile.displayName || user.email?.split('@')[0] || 'Me', email: user.email || undefined, userId: user.uid, role: 'owner', status: 'active', avatarColor: COLORS[0], joinedAt: now });
    await updateProfileData({ activeWorkspace: 'household', activeHouseholdId: id, householdIds: [...new Set([...(profile.householdIds || []), id])] });
  }, [user, profile, updateProfileData]);
  const addProfile = useCallback(async (name: string) => {
    if (!householdId) throw new Error('Create a household first.');
    await saveHouseholdMember(householdId, { id: crypto.randomUUID(), displayName: name.trim(), role: 'profile', status: 'active', avatarColor: COLORS[members.length % COLORS.length] });
  }, [householdId, members.length]);
  const invite = useCallback(async (name: string, email: string, role: 'editor' | 'contributor' | 'viewer') => {
    if (!householdId || !user) throw new Error('Create a household first.');
    const memberId = crypto.randomUUID(), id = crypto.randomUUID(), now = new Date().toISOString();
    await saveHouseholdMember(householdId, { id: memberId, displayName: name.trim() || email.split('@')[0], email: email.trim().toLowerCase(), role, status: 'invited', avatarColor: COLORS[members.length % COLORS.length], invitedAt: now });
    await createHouseholdInvite({ id, householdId, memberId, email: email.trim().toLowerCase(), role, createdBy: user.uid, createdAt: now, expiresAt: new Date(Date.now() + 14 * 864e5).toISOString(), status: 'pending' });
    return id;
  }, [householdId, user, members.length]);
  const acceptInvite = useCallback(async (code: string) => {
    if (!user || !profile) throw new Error('Sign in before accepting an invitation.');
    const invite = await getHouseholdInvite(code.trim());
    if (!invite || invite.status !== 'pending' || Date.parse(invite.expiresAt) < Date.now() || invite.email !== user.email?.toLowerCase()) throw new Error('This invitation is invalid, expired, or belongs to a different email.');
    await acceptHouseholdInvite(invite, user.uid, profile.displayName || user.email?.split('@')[0] || 'Member');
    await updateProfileData({ activeWorkspace: 'household', activeHouseholdId: invite.householdId, householdIds: [...new Set([...(profile.householdIds || []), invite.householdId])] });
  }, [user, profile, updateProfileData]);
  const selectWorkspace = useCallback(async (next: 'personal' | 'household') => {
    if (next === 'household' && !profile?.activeHouseholdId) throw new Error('Join or create a household first.');
    await updateProfileData({ activeWorkspace: next });
  }, [profile?.activeHouseholdId, updateProfileData]);
  const updateMember = useCallback(async (member: HouseholdMember) => { if (!householdId) return; await saveHouseholdMember(householdId, member); }, [householdId]);
  return <HouseholdContext.Provider value={{ household, members, loading, isOwner, canEdit, memberRole, isContributor, workspace, selectWorkspace, canViewArea, canEditArea, payers, pendingInvites, create, addProfile, invite, acceptInvite, updateMember }}>{children}</HouseholdContext.Provider>;
}
export function useHousehold() { const value = useContext(HouseholdContext); if (!value) throw new Error('useHousehold must be used inside HouseholdProvider'); return value; }
