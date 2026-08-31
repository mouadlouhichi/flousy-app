'use client';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './auth-context';
import { isProUser } from './pro-features';
import { createHousehold, createHouseholdInvite, getHouseholdInvite, subscribePendingHouseholdInvites, acceptHouseholdInvite, saveHouseholdMember, subscribeHousehold, subscribeHouseholdMembers, deleteHouseholdWorkspace, saveHousehold } from './db';
import type { Household, HouseholdInvite, HouseholdMember, HouseholdPayer, HouseholdRole } from './household';
import { canEdit as canEditAreaRule, canView, type HouseholdArea, type HouseholdPermissions } from './household-rbac';
import { useLanguage } from './i18n-context';

const COLORS = ['#00685f', '#8b5cf6', '#e05d44', '#2563eb', '#d97706', '#db2777'];
type HouseholdContextValue = {
  household: Household | null; members: HouseholdMember[]; loading: boolean; isOwner: boolean; canEdit: boolean; memberRole?: HouseholdRole; isContributor: boolean; workspace: 'personal' | 'household'; selectWorkspace: (workspace: 'personal' | 'household') => Promise<void>; canViewArea: (area: HouseholdArea) => boolean; canEditArea: (area: HouseholdArea, own?: boolean) => boolean;
  payers: HouseholdPayer[]; pendingInvites: HouseholdInvite[]; create: (name: string) => Promise<void>; addProfile: (name: string) => Promise<void>;
  invite: (name: string, email: string, role: 'editor' | 'viewer' | 'custom', permissions?: HouseholdPermissions) => Promise<string>;
  acceptInvite: (code: string) => Promise<void>; updateMember: (member: HouseholdMember) => Promise<void>;
  markHouseholdOnboarded: () => Promise<void>;
  removeHouseholdWorkspace: () => Promise<void>;
};
const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfileData } = useAuth();
  const { messages: m } = useLanguage();
  const workspace = profile?.activeWorkspace === 'household' && profile.activeHouseholdId ? 'household' : 'personal';
  const trackedHouseholdId = profile?.activeHouseholdId;
  const householdId = workspace === 'household' ? trackedHouseholdId : undefined;
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!trackedHouseholdId) {
      setHousehold(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = window.setTimeout(() => setLoading(false), 5000);
    const unsub = subscribeHousehold(trackedHouseholdId, (h) => {
      setHousehold(h);
      setLoading(false);
      window.clearTimeout(timeout);
    });
    return () => {
      window.clearTimeout(timeout);
      unsub();
    };
  }, [trackedHouseholdId]);
  useEffect(() => subscribeHouseholdMembers(trackedHouseholdId, setMembers), [trackedHouseholdId]);
  useEffect(() => subscribePendingHouseholdInvites(user?.email, setPendingInvites), [user?.email]);
  const myMember = members.find((m) => m.userId === user?.uid);
  const isOwner =
    household?.ownerId === user?.uid ||
    household?.planOwnerId === user?.uid ||
    myMember?.role === 'owner';
  const canEdit = isOwner || myMember?.role === 'editor';
  const canViewArea = useCallback(
    (area: HouseholdArea) =>
      workspace === 'personal' || isOwner || canView(myMember?.role, area, myMember?.permissions),
    [workspace, isOwner, myMember],
  );
  const canEditArea = useCallback(
    (area: HouseholdArea, own = false) =>
      workspace === 'personal' || isOwner || canEditAreaRule(myMember?.role, area, myMember?.permissions, own),
    [workspace, isOwner, myMember],
  );
  const memberRole: HouseholdRole | undefined = isOwner ? 'owner' : myMember?.role;
  const isContributor = !isOwner && memberRole === 'contributor';
  const payers = useMemo<HouseholdPayer[]>(() => {
    if (household) return [{ id: 'self', label: m.household.me }, { id: 'household', label: m.household.funds }, ...members.filter(m => m.status !== 'inactive').map(m => ({ id: m.id, label: m.displayName, color: m.avatarColor }))];
    const legacy = profile?.householdMembers || [];
    return [{ id: 'self', label: m.household.me }, ...legacy.map((label, i) => ({ id: `legacy-${i}`, label, color: COLORS[i % COLORS.length] }))];
  }, [household, members, profile?.householdMembers, m.household.funds, m.household.me]);
  const create = useCallback(async (name: string) => {
    if (!user || !profile || !isProUser(profile)) throw new Error(m.household.genericError);
    const now = new Date().toISOString(), memberId = user.uid;
    const id = await createHousehold(user.uid, { name: name.trim() || m.profile.household, ownerId: user.uid, planOwnerId: user.uid, createdAt: now, updatedAt: now }, { id: memberId, displayName: profile.displayName || user.email?.split('@')[0] || m.household.me, email: user.email || undefined, userId: user.uid, role: 'owner', status: 'active', avatarColor: COLORS[0], joinedAt: now });
    await updateProfileData({ activeWorkspace: 'household', activeHouseholdId: id, householdIds: [...new Set([...(profile.householdIds || []), id])] });
  }, [user, profile, updateProfileData, m.household.genericError, m.household.me, m.profile.household]);
  const addProfile = useCallback(async (name: string) => {
    if (!householdId) throw new Error(m.household.genericError);
    await saveHouseholdMember(householdId, { id: crypto.randomUUID(), displayName: name.trim(), role: 'profile', status: 'active', avatarColor: COLORS[members.length % COLORS.length] });
  }, [householdId, members.length, m.household.genericError]);
  const invite = useCallback(async (name: string, email: string, role: 'editor' | 'viewer' | 'custom', permissions?: HouseholdPermissions) => {
    if (!householdId || !user) throw new Error(m.household.genericError);
    const memberId = crypto.randomUUID(), id = crypto.randomUUID(), now = new Date().toISOString();
    await saveHouseholdMember(householdId, { id: memberId, displayName: name.trim() || email.split('@')[0], email: email.trim().toLowerCase(), role, permissions, status: 'invited', avatarColor: COLORS[members.length % COLORS.length], invitedAt: now });
    await createHouseholdInvite({ id, householdId, memberId, email: email.trim().toLowerCase(), role, permissions, createdBy: user.uid, createdAt: now, expiresAt: new Date(Date.now() + 14 * 864e5).toISOString(), status: 'pending' });
    return id;
  }, [householdId, user, members.length, m.household.genericError]);
  const acceptInvite = useCallback(async (code: string) => {
    if (!user || !profile) throw new Error(m.household.genericError);
    const invite = await getHouseholdInvite(code.trim());
    if (!invite || invite.status !== 'pending' || Date.parse(invite.expiresAt) < Date.now() || invite.email !== user.email?.toLowerCase()) throw new Error(m.household.genericError);
    await acceptHouseholdInvite(invite, user.uid, profile.displayName || user.email?.split('@')[0] || m.household.member);
    setPendingInvites(current => current.filter(item => item.id !== invite.id));
    await updateProfileData({ activeWorkspace: 'household', activeHouseholdId: invite.householdId, householdIds: [...new Set([...(profile.householdIds || []), invite.householdId])] });
  }, [user, profile, updateProfileData, m.household.genericError, m.household.me, m.profile.household]);
  const selectWorkspace = useCallback(async (next: 'personal' | 'household') => {
    const householdTarget = profile?.activeHouseholdId || profile?.householdIds?.[0];
    if (next === 'household' && !householdTarget) throw new Error(m.household.genericError);
    await updateProfileData({
      activeWorkspace: next,
      ...(next === 'household' ? { activeHouseholdId: householdTarget } : {}),
    });
  }, [profile?.activeHouseholdId, profile?.householdIds, updateProfileData, m.household.genericError]);
  const updateMember = useCallback(async (member: HouseholdMember) => { if (!trackedHouseholdId) return; await saveHouseholdMember(trackedHouseholdId, member); }, [trackedHouseholdId]);
  const markHouseholdOnboarded = useCallback(async () => {
    if (!trackedHouseholdId) return;
    await saveHousehold(trackedHouseholdId, { onboardingComplete: true });
    setHousehold((current) => (current ? { ...current, onboardingComplete: true } : current));
  }, [trackedHouseholdId]);
  const removeHouseholdWorkspace = useCallback(async () => {
    const targetId = householdId || profile?.activeHouseholdId;
    if (!user || !profile || !targetId) throw new Error(m.household.genericError);
    if (isOwner || household?.ownerId === user.uid) {
      try {
        await deleteHouseholdWorkspace(targetId);
      } catch {
        /* Still unlink the workspace from this profile so the user is not stuck. */
      }
    } else if (myMember) {
      await saveHouseholdMember(targetId, { ...myMember, status: 'inactive' });
    }
    const remaining = (profile.householdIds || []).filter((id) => id !== targetId);
    await updateProfileData({
      activeWorkspace: 'personal',
      activeHouseholdId: remaining[0] || '',
      householdIds: remaining,
    });
    setHousehold(null);
    setMembers([]);
  }, [user, profile, householdId, household?.ownerId, isOwner, myMember, updateProfileData, m.household.genericError]);
  return <HouseholdContext.Provider value={{ household, members, loading, isOwner, canEdit, memberRole, isContributor, workspace, selectWorkspace, canViewArea, canEditArea, payers, pendingInvites, create, addProfile, invite, acceptInvite, updateMember, markHouseholdOnboarded, removeHouseholdWorkspace }}>{children}</HouseholdContext.Provider>;
}
export function useHousehold() { const value = useContext(HouseholdContext); if (!value) throw new Error('useHousehold must be used inside HouseholdProvider'); return value; }
