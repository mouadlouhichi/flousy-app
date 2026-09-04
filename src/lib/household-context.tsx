'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth-context';
import { isProUser } from './pro-features';
import {
  acceptHouseholdInvite,
  bindHouseholdSponsor,
  createHousehold,
  createHouseholdInvite,
  deleteHouseholdWorkspace,
  getHouseholdInvite,
  saveHousehold,
  getHouseholdMember,
  saveHouseholdMember,
  subscribeHousehold,
  subscribeHouseholdMembers,
  subscribePendingHouseholdInvites,
  writeHouseholdOwnerMembership,
  type HouseholdAccess,
} from './db';
import type { DocumentMigration } from './schema-migrations';
import {
  buildHouseholdSponsorBinding,
  householdSponsorBindingIsStale,
  householdSponsorId,
  householdSponsorProjectionFields,
  planHouseholdMembershipRepair,
  type SponsorRebindOutcome,
} from './household-entitlement';
import {
  householdEntitlementForEditor,
  normalizeHouseholdName,
  type Household,
  type HouseholdInvite,
  type HouseholdMember,
  type HouseholdPayer,
  type HouseholdRole,
} from './household';
import {
  hasFinanceView,
  hasMonthEditGrant,
  permissionsFor,
  resolveAreaAccess,
  sanitizePermissions,
  type AccessLevel,
  type ExportSections,
  type HouseholdArea,
  type HouseholdPermissions,
} from './household-rbac';
import { DEFAULT_MONEY_PLACES } from './store';
import { useLanguage } from './i18n-context';

const COLORS = ['#00685f', '#8b5cf6', '#e05d44', '#2563eb', '#d97706', '#db2777'];
const DEFAULT_CATEGORIES = [
  'Groceries', 'Transport', 'Rent', 'Entertainment', 'Health',
  'Utilities', 'Dining Out', 'Shopping', 'Subscriptions',
];

/** Only roles that map to enforceable document-level Firestore access are invitational. */
export type InviteRole = Extract<HouseholdRole, 'editor' | 'viewer' | 'contributor' | 'custom'>;
export type HouseholdConfigurationPatch = Pick<
  Household,
  | 'currency'
  | 'monthStartDate'
  | 'moneyPlaces'
  | 'activeCategories'
  | 'categoryColors'
  | 'categoryIcons'
  | 'fixedCategories'
  | 'defaultCategoryBudgets'
  | 'enableRollover'
>;

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  isOwner: boolean;
  canEdit: boolean;
  /** False after the household owner's trial/subscription period ends. */
  entitlementActive: boolean;
  memberRole?: HouseholdRole;
  isContributor: boolean;
  workspace: 'personal' | 'household';
  selectWorkspace: (workspace: 'personal' | 'household') => Promise<void>;
  canViewArea: (area: HouseholdArea) => boolean;
  canEditArea: (area: HouseholdArea, own?: boolean) => boolean;
  areaLevel: (area: HouseholdArea) => AccessLevel;
  exportSections: ExportSections;
  /** 'denied' => membership really is gone; 'unavailable' => keep retrying. */
  householdAccess: HouseholdAccess;
  payers: HouseholdPayer[];
  pendingInvites: HouseholdInvite[];
  create: (name: string) => Promise<void>;
  addProfile: (name: string) => Promise<void>;
  renameHousehold: (name: string) => Promise<void>;
  invite: (name: string, email: string, role: InviteRole, permissions?: HouseholdPermissions) => Promise<string>;
  acceptInvite: (code: string) => Promise<void>;
  updateMember: (member: HouseholdMember) => Promise<void>;
  updateConfiguration: (patch: Partial<HouseholdConfigurationPatch>) => Promise<void>;
  markHouseholdOnboarded: () => Promise<void>;
  removeHouseholdWorkspace: () => Promise<void>;
  /**
   * Restore a shared workspace whose writes are refused: bind the plan that
   * pays for it to this account (when this account holds one) and make sure the
   * owner's membership row exists. Safe to call repeatedly.
   */
  rebindHouseholdSponsor: () => Promise<SponsorRebindOutcome>;
  /** Everything a locked-out owner may write back, in one attempt. */
  repairHouseholdAccess: () => Promise<HouseholdAccessRepair>;
  /**
   * Fields this workspace's document never stored and the app cannot derive - so no
   * screen explains them and no retry fixes them. Empty for a household written by a
   * current build; otherwise the maintenance script is the way to close them.
   */
  workspaceSchemaGaps: string[];
};

/**
 * What a self-repair attempt achieved. `membership` is the state of the caller's
 * own `members/{uid}` row, which the published rules require for any shared
 * write; `sponsor` is the plan-owner binding, which only the rules this app ships
 * with can accept. `changed` is what a caller retries its queue on.
 */
export type HouseholdMembershipRepairState =
  | 'written'
  | 'already'
  | 'blocked'
  | 'rejected'
  | 'not-owner'
  | 'unavailable';

export interface HouseholdAccessRepair {
  membership: HouseholdMembershipRepairState;
  sponsor: SponsorRebindOutcome;
  changed: boolean;
}

export type { SponsorRebindOutcome };

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, updateProfileData } = useAuth();
  const { messages: m } = useLanguage();
  const workspace = profile?.activeWorkspace === 'household' && profile.activeHouseholdId
    ? 'household'
    : 'personal';
  const trackedHouseholdId = profile?.activeHouseholdId;
  const householdId = workspace === 'household' ? trackedHouseholdId : undefined;
  const [household, setHousehold] = useState<Household | null>(null);
  /**
   * What the stored household document is missing, from the schema model: `patch`
   * is what the app can write back on the owner's behalf, `unresolved` is what only
   * the maintenance script (or the console) can settle. Kept separate from the
   * household value because the normalized copy always looks complete.
   */
  const [schema, setSchema] = useState<DocumentMigration | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<HouseholdInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [access, setAccess] = useState<HouseholdAccess>('ok');
  const [entitlementTick, setEntitlementTick] = useState(0);

  useEffect(() => {
    const endsAtMs = household?.entitlementEndsAtMs;
    if (!endsAtMs) return;
    const remaining = endsAtMs - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => setEntitlementTick((value) => value + 1),
      Math.min(remaining + 1_000, 2_147_000_000),
    );
    return () => window.clearTimeout(timer);
  }, [household?.entitlementEndsAtMs, entitlementTick]);

  useEffect(() => {
    if (!trackedHouseholdId) {
      setHousehold(null);
      setSchema(null);
      setAccess('ok');
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = subscribeHousehold(
      trackedHouseholdId,
      (nextHousehold, migration) => {
        setHousehold(nextHousehold);
        const gaps = migration && (Object.keys(migration.patch).length > 0 || migration.unresolved.length > 0);
        setSchema(gaps ? migration : null);
        setLoading(false);
      },
      (nextAccess) => {
        setAccess(nextAccess);
        if (nextAccess !== 'ok') setLoading(false);
      },
    );
    return unsubscribe;
  }, [trackedHouseholdId]);

  /**
   * Own membership row, resolved directly when the roster listener is denied.
   *
   * Listing `members` requires finance-read access, so a contributor — and any
   * custom member without `members: view` — never receives the roster. Treating
   * that denial as an empty roster used to erase the user's own role, which
   * collapsed their permissions to `none` and made `isContributor` false, so
   * the provider then subscribed a household month it is not allowed to read.
   * The own-row `get` is always permitted (`memberId == request.auth.uid`), so
   * fall back to it and keep the role intact.
   */
  const [ownMember, setOwnMember] = useState<HouseholdMember | null>(null);

  useEffect(() => {
    if (!trackedHouseholdId) {
      setMembers([]);
      setOwnMember(null);
      return;
    }
    let active = true;
    const unsubscribe = subscribeHouseholdMembers(
      trackedHouseholdId,
      (next) => {
        if (!active) return;
        setMembers(next);
        setOwnMember(null); // roster is authoritative when readable
      },
      () => {
        if (!active) return;
        setMembers([]);
        const uid = user?.uid;
        if (!uid) return;
        getHouseholdMember(trackedHouseholdId, uid)
          .then((row) => {
            if (!active || !row) return;
            setOwnMember({ id: uid, ...(row as object) } as HouseholdMember);
          })
          .catch(() => {
            /* own row unreadable too: genuinely not a member */
          });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [trackedHouseholdId, user?.uid]);

  useEffect(() => {
    // Invitation discovery itself is protected by verified-email rules. Avoid
    // a doomed query and never present an invite before Firebase confirms the address.
    if (!user?.emailVerified) {
      setPendingInvites([]);
      return () => {};
    }
    return subscribePendingHouseholdInvites(user.email, setPendingInvites);
  }, [user?.email, user?.emailVerified]);

  const myMember = members.find((member) => member.userId === user?.uid || member.id === user?.uid)
    ?? ownMember
    ?? undefined;
  // `planOwnerId` is the BILLING sponsor, not an authorization fact: rules
  // compare only `ownerId` (`householdUpdateAuthorized`). Including it here
  // handed a sponsor a full owner UI whose every management write was refused
  // with a generic error. Ownership must be derived exactly as the server does.
  const isOwner = Boolean(
    household?.ownerId === user?.uid
      || myMember?.role === 'owner',
  );
  const memberRole: HouseholdRole | undefined = isOwner ? 'owner' : myMember?.role;
  // Rules read the owner's profile for every household write; when the
  // current user is the owner, evaluate that profile directly so client
  // gates pause editing exactly when the server starts rejecting writes.
  const entitlementActive = workspace === 'personal'
    || householdEntitlementForEditor(household, profile, isOwner);
  // Effective per-area grants for a custom member (sanitized matrix, with the
  // contributor-equivalent fallback for legacy documents that never stored one).
  const customPermissions = useMemo(
    () => (!isOwner && myMember?.role === 'custom' ? permissionsFor('custom', myMember.permissions) : null),
    [isOwner, myMember?.role, myMember?.permissions],
  );
  // The coarse edit flag mirrors month-document rules. Expiry never hides or
  // deletes data, but it makes a household read-only until a future provider
  // renews the owner's entitlement. A custom member counts as a writer only
  // when at least one month area is granted `editAll` — the same predicate
  // `customMonthWriter()` applies in firestore.rules.
  const canEdit = entitlementActive
    && (isOwner
      || memberRole === 'editor'
      || (customPermissions != null && hasMonthEditGrant(customPermissions)));
  // Contributors work through the invoice queue instead of month documents.
  // A custom member without any finance view grant gets the same flow: rules
  // deny them month/ledger reads, so subscribing would only produce errors.
  const isContributor = !isOwner
    && (memberRole === 'contributor'
      || (memberRole === 'custom' && (!customPermissions || !hasFinanceView(customPermissions))));
  const areaAccess = useMemo(() => {
    const base = resolveAreaAccess({
      unrestricted: workspace === 'personal' || isOwner,
      role: memberRole,
      // Sanitized inside `permissionsFor`; only meaningful for `custom`.
      permissions: myMember?.permissions,
    });
    if (workspace !== 'household' || entitlementActive) return base;
    const level = (area: HouseholdArea): AccessLevel => {
      const current = base.level(area);
      return current === 'none' ? 'none' : 'view';
    };
    return {
      level,
      canView: (area: HouseholdArea) => level(area) !== 'none',
      canEdit: () => false,
      // Export remains available so expiry can never hold user data hostage.
      exportSections: base.exportSections,
    };
  }, [workspace, isOwner, memberRole, entitlementActive, myMember?.permissions]);
  const {
    level: areaLevel,
    canView: canViewArea,
    canEdit: canEditArea,
    exportSections,
  } = areaAccess;

  const payers = useMemo<HouseholdPayer[]>(() => {
    if (household) {
      return [
        { id: 'self', label: m.household.me },
        { id: 'household', label: m.household.funds },
        ...members
          .filter((member) => member.status === 'active')
          .map((member) => ({ id: member.id, label: member.displayName, color: member.avatarColor })),
      ];
    }
    const legacy = profile?.householdMembers || [];
    return [
      { id: 'self', label: m.household.me },
      ...legacy.map((label, index) => ({ id: `legacy-${index}`, label, color: COLORS[index % COLORS.length] })),
    ];
  }, [household, members, profile?.householdMembers, m.household.funds, m.household.me]);

  const create = useCallback(async (name: string) => {
    if (!user || !profile || !isProUser(profile)) throw new Error(m.household.genericError);
    // The entitlement fields are written through the same builder the repair
    // path uses, because `validHouseholdEntitlementProjection()` in
    // firestore.rules compares the projection against the profile key by key:
    // any spelling of it that is invented here (or left out) is a creation
    // that the server refuses.
    const binding = buildHouseholdSponsorBinding(profile, user.uid);
    if (!binding.bindable) throw new Error(m.household.genericError);
    const now = new Date().toISOString();
    const id = await createHousehold(
      user.uid,
      {
        name: name.trim() || m.profile.household,
        ownerId: user.uid,
        planOwnerId: user.uid,
        ...householdSponsorProjectionFields(binding),
        currency: profile.currency || 'MAD',
        monthStartDate: profile.monthStartDate,
        moneyPlaces: (profile.moneyPlaces || DEFAULT_MONEY_PLACES).map((place) => ({ ...place })),
        activeCategories: [...DEFAULT_CATEGORIES],
        fixedCategories: profile.fixedCategories || [],
        defaultCategoryBudgets: profile.defaultCategoryBudgets || {},
        enableRollover: profile.enableRollover || false,
        schemaVersion: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: user.uid,
        displayName: profile.displayName || user.email?.split('@')[0] || m.household.me,
        email: user.email || undefined,
        userId: user.uid,
        role: 'owner',
        status: 'active',
        avatarColor: COLORS[0],
        joinedAt: now,
      },
    );
    await updateProfileData(
      {
        activeWorkspace: 'household',
        activeHouseholdId: id,
        // Local mirror only — the server-side write uses arrayUnion so a
        // concurrent session cannot clobber this membership list.
        householdIds: [...new Set([...(profile.householdIds || []), id])],
      },
      { add: id },
    );
  }, [user, profile, updateProfileData, m.household.genericError, m.household.me, m.profile.household]);

  const addProfile = useCallback(async (name: string) => {
    if (!householdId || !isOwner || !entitlementActive) throw new Error(m.household.genericError);
    await saveHouseholdMember(householdId, {
      id: crypto.randomUUID(),
      displayName: name.trim(),
      role: 'profile',
      status: 'active',
      avatarColor: COLORS[members.length % COLORS.length],
    });
  }, [householdId, isOwner, entitlementActive, members.length, m.household.genericError]);

  const invite = useCallback(async (name: string, email: string, role: InviteRole, permissions?: HouseholdPermissions) => {
    if (!householdId || !user || !isOwner || !entitlementActive) throw new Error(m.household.genericError);
    const normalizedEmail = email.trim().toLowerCase();
    const memberId = crypto.randomUUID();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expiresAtMs = Date.now() + 14 * 86_400_000;
    // The matrix travels sanitized so the stored map can never exceed what
    // `validCustomPermissions()` accepts in firestore.rules.
    const grantedPermissions = role === 'custom' ? sanitizePermissions(permissions) : undefined;
    const pendingMember: HouseholdMember = {
      id: memberId,
      displayName: name.trim() || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      role,
      ...(grantedPermissions ? { permissions: grantedPermissions } : {}),
      status: 'invited',
      avatarColor: COLORS[members.length % COLORS.length],
      invitedAt: now,
    };
    await createHouseholdInvite({
      id,
      householdId,
      memberId,
      email: normalizedEmail,
      role,
      ...(grantedPermissions ? { permissions: grantedPermissions } : {}),
      createdBy: user.uid,
      createdAt: now,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs,
      status: 'pending',
    }, pendingMember);
    return id;
  }, [householdId, user, isOwner, entitlementActive, members.length, m.household.genericError]);

  const acceptInvite = useCallback(async (code: string) => {
    if (!user || !profile) throw new Error(m.household.genericError);
    await user.reload();
    if (!user.emailVerified || !user.email) throw new Error(m.household.genericError);
    const invite = await getHouseholdInvite(code.trim());
    const expiry = invite?.expiresAtMs || Date.parse(invite?.expiresAt || '');
    if (
      !invite
      || invite.status !== 'pending'
      || !Number.isFinite(expiry)
      || expiry <= Date.now()
      || invite.email !== user.email.toLowerCase()
    ) {
      throw new Error(m.household.genericError);
    }
    await acceptHouseholdInvite(
      invite,
      user.uid,
      profile.displayName || user.email.split('@')[0] || m.household.member,
    );
    setPendingInvites((current) => current.filter((item) => item.id !== invite.id));
    await updateProfileData(
      {
        activeWorkspace: 'household',
        activeHouseholdId: invite.householdId,
        // Local mirror only — the server-side write uses arrayUnion so a
        // concurrent session cannot clobber this membership list.
        householdIds: [...new Set([...(profile.householdIds || []), invite.householdId])],
      },
      { add: invite.householdId },
    );
  }, [user, profile, updateProfileData, m.household.genericError, m.household.member]);

  const selectWorkspace = useCallback(async (next: 'personal' | 'household') => {
    const target = profile?.activeHouseholdId || profile?.householdIds?.[0];
    if (next === 'household' && !target) throw new Error(m.household.genericError);
    await updateProfileData({
      activeWorkspace: next,
      ...(next === 'household' ? { activeHouseholdId: target } : {}),
    });
  }, [profile?.activeHouseholdId, profile?.householdIds, updateProfileData, m.household.genericError]);

  const updateMember = useCallback(async (member: HouseholdMember) => {
    if (!trackedHouseholdId || !isOwner || !entitlementActive) throw new Error(m.household.genericError);
    if (member.role === 'owner') throw new Error(m.household.genericError);
    // Custom members always persist the full sanitized matrix: the merge write
    // then overwrites every area key, normalizing legacy maps that stored
    // levels the rules no longer accept (e.g. `expenses: 'editOwn'`).
    const next: HouseholdMember = member.role === 'custom'
      ? { ...member, permissions: sanitizePermissions(member.permissions) }
      : member;
    await saveHouseholdMember(trackedHouseholdId, next);
  }, [trackedHouseholdId, isOwner, entitlementActive, m.household.genericError]);

  const updateConfiguration = useCallback(async (patch: Partial<HouseholdConfigurationPatch>) => {
    if (!trackedHouseholdId || !isOwner || !entitlementActive) throw new Error(m.household.genericError);
    await saveHousehold(trackedHouseholdId, patch);
    setHousehold((current) => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current);
  }, [trackedHouseholdId, isOwner, entitlementActive, m.household.genericError]);

  const markHouseholdOnboarded = useCallback(async () => {
    if (!trackedHouseholdId || !isOwner || !entitlementActive) return;
    await saveHousehold(trackedHouseholdId, { onboardingComplete: true });
    setHousehold((current) => current ? { ...current, onboardingComplete: true } : current);
  }, [trackedHouseholdId, isOwner, entitlementActive]);

  const renameHousehold = useCallback(async (name: string) => {
    const normalized = normalizeHouseholdName(name);
    if (!trackedHouseholdId || !isOwner || !entitlementActive || !normalized) {
      throw new Error(m.household.householdNameRequired);
    }
    await saveHousehold(trackedHouseholdId, { name: normalized });
    setHousehold((current) => current
      ? { ...current, name: normalized, updatedAt: new Date().toISOString() }
      : current);
  }, [trackedHouseholdId, isOwner, entitlementActive, m.household.householdNameRequired]);

  /**
   * Point the workspace back at a plan that actually exists.
   *
   * The household root freezes `ownerId`, so its owner is the one account that
   * may say who pays for it - and `householdSponsorBindingValid()` in
   * firestore.rules only accepts the write when the projected values mirror
   * that account's own profile and the profile really is active. Everything the
   * sync layer needs to be honest about a 403 comes back from here.
   */
  const rebindHouseholdSponsor = useCallback(async (): Promise<SponsorRebindOutcome> => {
    if (!trackedHouseholdId || !user || !household) return 'unavailable';
    if (!isOwner) return 'not-owner';
    const binding = buildHouseholdSponsorBinding(profile, user.uid);
    if (binding.rejectedFields.length > 0 || !binding.bindable) return 'no-entitlement';
    if (!householdSponsorBindingIsStale(household, binding)) return 'already-consistent';
    try {
      await bindHouseholdSponsor(trackedHouseholdId, binding.patch);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // permission-denied here means the deployed rules predate this
      // condition: that is the only state where redeploying them is the fix.
      return code === 'permission-denied' ? 'rejected-by-rules' : 'unavailable';
    }
    setHousehold((current) => current
      ? { ...current, ...householdSponsorProjectionFields(binding) }
      : current);
    // A household created before the owner's membership row was batched into
    // `members/` is writable by its owner under the current rules, but the
    // roster - and every role a member can be given - needs the row.
    if (!members.some((member) => member.userId === user.uid || member.id === user.uid)) {
      try {
        await saveHouseholdMember(trackedHouseholdId, {
          id: user.uid,
          userId: user.uid,
          displayName: profile?.displayName || user.email?.split('@')[0] || m.household.me,
          email: user.email || undefined,
          role: 'owner',
          status: 'active',
          avatarColor: COLORS[0],
          joinedAt: household?.createdAt || new Date().toISOString(),
        });
      } catch {
        // Best effort: the write path no longer depends on this row existing.
      }
    }
    return 'repaired';
  }, [trackedHouseholdId, user, profile, household, members, isOwner, m.household.me]);

  /**
   * Restore the two things a shared workspace can be locked behind that a client
   * is allowed to write, and report which one moved.
   *
   * `members/{uid}` is what `householdEditor()` in the published rules insists on,
   * so a household created before that row was batched with it is readable by its
   * owner and writable by nobody - a lost budget, not a permission problem. The
   * plan-owner binding is the other one, and it needs the rules this app ships
   * with, which is why its refusal is reported as `rejected-by-rules`: a
   * deployment gap the app cannot close from a browser.
   */
  const repairHouseholdAccess = useCallback(async (): Promise<HouseholdAccessRepair> => {
    if (!trackedHouseholdId || !user) {
      return { membership: 'unavailable', sponsor: 'unavailable', changed: false };
    }
    let membership: HouseholdMembershipRepairState = 'unavailable';
    try {
      const stored = await getHouseholdMember(trackedHouseholdId, user.uid);
      const plan = planHouseholdMembershipRepair({
        household,
        member: stored,
        uid: user.uid,
        displayName: profile?.displayName,
        email: user.email,
      });
      if (plan.action === 'write') {
        await writeHouseholdOwnerMembership(
          trackedHouseholdId,
          { ...plan.member, avatarColor: COLORS[0] },
          { replace: plan.replace },
        );
        membership = 'written';
      } else if (plan.action === 'blocked') {
        membership = 'blocked';
      } else {
        membership = plan.reason === 'already-owner' ? 'already' : 'not-owner';
      }
    } catch (error) {
      membership = (error as { code?: string })?.code === 'permission-denied' ? 'rejected' : 'unavailable';
    }
    const sponsor = await rebindHouseholdSponsor();
    return { membership, sponsor, changed: membership === 'written' || sponsor === 'repaired' };
  }, [trackedHouseholdId, user, household, profile, rebindHouseholdSponsor]);

  /**
   * Close the stored-document gaps this app can derive on its own.
   *
   * A household written before `currency`, `moneyPlaces` or `activeCategories`
   * existed reads fine - the normalizer supplies them in memory - and is then
   * refused on every update, because the rules compare the stored shape. The gap is
   * invisible until a save fails, which is how "my settings will not save" arrives
   * as a story about permissions. Writing back the fields that follow from the
   * document itself makes it what the app has been assuming all along, and it is a
   * write the household's own owner is allowed to make.
   */
  const schemaBackfillRef = useRef('');
  useEffect(() => {
    if (!schema || !householdId || !isOwner) return;
    const entries = Object.entries(schema.patch);
    if (entries.length === 0) return;
    const fingerprint = `${householdId}:${entries.map(([key]) => key).sort().join(',')}`;
    if (schemaBackfillRef.current === fingerprint) return;
    schemaBackfillRef.current = fingerprint;
    void saveHousehold(householdId, Object.fromEntries(entries) as Partial<Household>).catch((error) => {
      // Deferred, not failed: under rules older than this build the household root
      // may refuse any write at all. The next load tries again, and the workspace
      // card already names what is outstanding.
      console.info('Workspace schema backfill deferred:', error);
    });
  }, [schema, householdId, isOwner]);

  /**
   * Keep the readable projection in step with the sponsor's profile.
   *
   * Members cannot read `users/{sponsorId}` - rules hide profiles from each
   * other on purpose - so the projected status/expiry on the household document
   * is the only thing their gates can consult, while the server re-reads the
   * profile for every write. Refresh it when this account is both the owner and
   * the sponsor: never re-bind a foreign sponsor behind someone's back.
   */
  const projectedSponsorRef = useRef('');
  useEffect(() => {
    if (!trackedHouseholdId || !user || !isOwner || !household) return;
    if (householdSponsorId(household) !== user.uid) return;
    const binding = buildHouseholdSponsorBinding(profile, user.uid);
    const fingerprint = JSON.stringify(binding.patch);
    if (!binding.bindable || !householdSponsorBindingIsStale(household, binding)) return;
    if (projectedSponsorRef.current === fingerprint) return;
    projectedSponsorRef.current = fingerprint;
    void bindHouseholdSponsor(trackedHouseholdId, binding.patch).catch(() => {
      // A refused or offline refresh is not a failed save: the next entitlement
      // change - or the sync layer's repair - tries again.
      projectedSponsorRef.current = '';
    });
  }, [trackedHouseholdId, user, profile, household, isOwner]);

  const removeHouseholdWorkspace = useCallback(async () => {
    const targetId = householdId || profile?.activeHouseholdId;
    if (!user || !profile || !targetId) throw new Error(m.household.genericError);
    if (isOwner || household?.ownerId === user.uid) {
      // Do not unlink after an incomplete deletion. Keeping the workspace
      // reachable is what makes teardown retryable and truthful.
      await deleteHouseholdWorkspace(targetId);
    } else if (myMember) {
      await saveHouseholdMember(targetId, { ...myMember, status: 'inactive' });
    }
    const remaining = (profile.householdIds || []).filter((id) => id !== targetId);
    await updateProfileData(
      {
        activeWorkspace: 'personal',
        activeHouseholdId: remaining[0] || '',
        // Local mirror only — the server-side write uses arrayRemove so a
        // concurrent session cannot resurrect or drop household links.
        householdIds: remaining,
      },
      { remove: targetId },
    );
    setHousehold(null);
    setMembers([]);
  }, [user, profile, householdId, household?.ownerId, isOwner, myMember, updateProfileData, m.household.genericError]);

  const value: HouseholdContextValue = {
    household,
    workspaceSchemaGaps: schema?.unresolved ?? [],
    members,
    loading,
    isOwner,
    canEdit,
    entitlementActive,
    memberRole,
    isContributor,
    workspace,
    selectWorkspace,
    canViewArea,
    canEditArea,
    areaLevel,
    exportSections,
    householdAccess: access,
    payers,
    pendingInvites,
    create,
    addProfile,
    renameHousehold,
    invite,
    acceptInvite,
    updateMember,
    updateConfiguration,
    markHouseholdOnboarded,
    removeHouseholdWorkspace,
    rebindHouseholdSponsor,
    repairHouseholdAccess,
  };

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error('useHousehold must be used inside HouseholdProvider');
  return value;
}

/** Currency/auth providers are also used on login routes where no household provider exists. */
export function useOptionalHousehold() {
  return useContext(HouseholdContext);
}
