import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import { isProPlan } from './pro-features';
import { CourseSession, MonthBudget, Product, SavingGoal, UserProfile, normalizeMonth } from './store';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error Details:', errInfo);
  throw new Error('A database error occurred. Please try again.');
}

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as unknown as T;
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned;
}

// User Profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'users', uid)),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile read timed out')), 5000);
      }),
    ]);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

export async function setUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    await setDoc(doc(db, 'users', uid), cleanUndefined(profile), { merge: true });
  } catch (err) {
    console.error('Error writing user profile:', err);
  }
}

// Monthly Budget Subscription & Save
export function subscribeMonthBudget(
  uid: string,
  monthKey: string,
  onData: (month: MonthBudget | null) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData(null);
    return () => {};
  }

  const docRef = doc(db, 'users', uid, 'months', monthKey);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const normalized = normalizeMonth(snap.data() as MonthBudget, monthKey);
        onData(normalized);
      } else {
        onData(null);
      }
    },
    (err) => {
      console.error('Error listening to month budget:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveMonthBudget(uid: string, monthKey: string, month: MonthBudget): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `users/${uid}/months/${monthKey}`;
  try {
    await setDoc(doc(db, 'users', uid, 'months', monthKey), cleanUndefined(month), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Savings Goals Subscription & Save
export function subscribeSavingsGoals(
  uid: string,
  onData: (goals: SavingGoal[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  const docRef = doc(db, 'users', uid, 'data', 'savings');

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onData(data.goals || []);
      } else {
        onData([]);
      }
    },
    (err) => {
      console.error('Error listening to savings goals:', err);
      if (onError) onError(err);
    }
  );
}

export async function saveSavingsGoals(uid: string, goals: SavingGoal[]): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `users/${uid}/data/savings`;
  try {
    await setDoc(doc(db, 'users', uid, 'data', 'savings'), cleanUndefined({ goals }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Fetch a single month budget once (non-subscription).
 */
export async function getSavingsGoals(uid: string): Promise<SavingGoal[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'data', 'savings'));
    return snap.exists() ? (snap.data().goals || []) : [];
  } catch {
    return [];
  }
}

/** Copy every personal month and savings goals into a household workspace. */
export async function importPersonalBudgetIntoHousehold(uid: string, householdId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const monthsSnap = await getDocs(collection(db, 'users', uid, 'months'));
  const writes: Promise<unknown>[] = [];
  for (const item of monthsSnap.docs) {
    if (!/^\d{4}-\d{2}$/.test(item.id)) continue;
    const month = normalizeMonth(item.data() as MonthBudget, item.id);
    writes.push(saveHouseholdMonthBudget(householdId, item.id, month));
  }
  writes.push(
    getSavingsGoals(uid).then((goals) => {
      if (goals.length > 0) return saveHouseholdSavingsGoals(householdId, goals);
    }),
  );
  await Promise.all(writes);
}

export async function getMonthBudget(uid: string, monthKey: string): Promise<MonthBudget | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'months', monthKey));
    if (snap.exists()) {
      return normalizeMonth(snap.data() as MonthBudget, monthKey);
    }
    return null;
  } catch (err) {
    console.error('Error fetching month budget:', err);
    return null;
  }
}

/**
 * List all available month keys for a user, sorted newest first.
 */
export async function listMonths(uid: string): Promise<string[]> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'months'));
    const keys = snap.docs
      .map((d) => d.id)
      .filter((id) => /^\d{4}-\d{2}$/.test(id))
      .sort()
      .reverse();
    return keys;
  } catch (err) {
    console.error('Error listing months:', err);
    return [];
  }
}

/**
 * Fetch multiple month budgets at once for trends/comparison.
 * Falls back to localStorage for months not in Firestore.
 */
export async function fetchMonthsForTrends(
  uid: string | undefined,
  currentKey: string,
  count: number = 6,
): Promise<{ monthKey: string; month: MonthBudget }[]> {
  const results: { monthKey: string; month: MonthBudget }[] = [];

  // Generate last N month keys including current
  const [curY, curM] = currentKey.split('-').map(Number);
  const monthKeys: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(curY, curM - 1 - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // One parallel batch instead of N sequential round-trips: the trends screen
  // used to await every month document one after another (6 RTTs on the
  // critical path) and each failure fell back to the local cache in turn.
  const fetched = await Promise.all(
    monthKeys.map(async (mk) => {
      const remote = uid ? await getMonthBudget(uid, mk) : null;
      if (remote) return { monthKey: mk, month: remote };
      try {
        const local = localStorage.getItem(`flousy_month_${mk}`);
        if (local) return { monthKey: mk, month: normalizeMonth(JSON.parse(local), mk) };
      } catch { /* ignore */ }
      return null;
    }),
  );

  results.push(...(fetched.filter(Boolean) as { monthKey: string; month: MonthBudget }[]));

  return results;
}

// --- Course session: product catalog & sessions ------------------------------

/** Subscribe to the user's product catalog (barcode-keyed products). */
export function subscribeProductCatalog(uid: string, onData: (products: Product[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, 'users', uid, 'products'), limit(2000));

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as Product));
    },
    (err) => {
      console.error('Error listening to product catalog:', err);
    },
  );
}

export async function saveProduct(uid: string, product: Product): Promise<void> {
  if (!isFirebaseConfigured || !db || !product.barcode) return;
  const barcode = product.barcode;
  const path = `users/${uid}/products/${barcode}`;
  try {
    await setDoc(doc(db, 'users', uid, 'products', barcode), cleanUndefined(product), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteProduct(uid: string, barcode: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `users/${uid}/products/${barcode}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'products', barcode));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/** Subscribe to the single active course session (null when none). */
export function subscribeActiveCourseSession(
  uid: string,
  onData: (session: CourseSession | null) => void,
): () => void {
  if (!isFirebaseConfigured || !db) {
    onData(null);
    return () => {};
  }

  const q = query(collection(db, 'users', uid, 'sessions'), where('status', '==', 'active'), limit(1));

  return onSnapshot(
    q,
    (snap) => {
      onData(snap.empty ? null : (snap.docs[0].data() as CourseSession));
    },
    (err) => {
      console.error('Error listening to active course session:', err);
    },
  );
}

/** Subscribe to completed course sessions (history), newest first. */
export function subscribeCourseSessions(uid: string, onData: (sessions: CourseSession[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, 'users', uid, 'sessions'), where('status', '==', 'completed'), limit(100));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as CourseSession);
      list.sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
      onData(list);
    },
    (err) => {
      console.error('Error listening to course sessions:', err);
    },
  );
}

export async function saveCourseSession(uid: string, session: CourseSession): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const sessionId = session.id;
  const path = `users/${uid}/sessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'sessions', sessionId), cleanUndefined(session), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteCourseSession(uid: string, sessionId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `users/${uid}/sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'sessions', sessionId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

/** Wipe the course catalog + sessions (used by account deletion). */
async function deleteUserCourseData(uid: string): Promise<void> {
  await deleteCollection('users', uid, 'products');
  await deleteCollection('users', uid, 'sessions');
}

/** Per-collection outcome of an erasure so the UI can be truthful about it. */
/**
 * Claim the single free Pro beta unlock for this account.
 *
 * There is no payment provider wired up, and Firestore rules refuse a
 * self-assigned `plan: 'pro'` for exactly that reason: an account that can grant
 * itself Pro is an account that never pays. The rules allow one exception — the
 * free -> pro transition stamped with `proTrialClaimedAt`, non-repeatable
 * because a profile that already carries the field cannot claim it again. This is
 * the only client-side write that matches that shape; the billing fields
 * `upgradeUserPlan` used to send are rejected by design.
 */
export async function claimProTrial(uid: string): Promise<boolean> {
  if (!db) return false;
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  const plan = snapshot.exists() ? (snapshot.data() as { plan?: string }).plan : undefined;
  if (isProPlan(plan)) return true;
  if (snapshot.exists() && plan !== 'free') return false;
  await setDoc(ref, {
    plan: 'pro',
    proTrialClaimedAt: new Date().toISOString(),
  } as never, { merge: true });
  return true;
}

export interface DeletionReport {
  removed: string[];
  failed: string[];
}

function deletionTracker(): {
  report: DeletionReport;
  run: (label: string, task: () => Promise<void>) => Promise<void>;
} {
  const report: DeletionReport = { removed: [], failed: [] };
  const run = async (label: string, task: () => Promise<void>) => {
    try {
      await task();
      report.removed.push(label);
    } catch (err) {
      // Logged, but never swallowed: a leftover document that belongs to a
      // deleted account can no longer be erased by anyone, so the caller has
      // to be able to tell the user something survived.
      console.error(`Deletion step failed (${label}):`, err);
      report.failed.push(label);
    }
  };
  return { report, run };
}

/** Delete every document in a collection (used for erasure and budget wipes). */
async function deleteCollection(path: string, ...segments: string[]): Promise<void> {
  if (!db) return;
  const snap = await getDocs(collection(db, path, ...segments));
  for (const item of snap.docs) await deleteDoc(item.ref);
}

/**
 * Delete everything the account owns, and report what could not be deleted.
 *
 * Order matters: shared workspaces are torn down while this account can still
 * authorise it (and before the user document the rules read for `plan`), so a
 * household is never orphaned behind a deleted owner. Firestore deletes are
 * idempotent, so a retry after a partial failure finishes the job.
 */
export async function deleteUserAccountData(
  uid: string,
  options: { householdIds?: string[]; email?: string | null } = {},
): Promise<DeletionReport> {
  const { report, run } = deletionTracker();
  if (!isFirebaseConfigured || !db) return report;

  for (const householdId of options.householdIds ?? []) {
    await run('household', () => deleteHouseholdWorkspace(householdId));
    await run('household invitations', async () => {
      if (!db) return;
      const invites = await getDocs(
        query(collection(db, 'householdInvites'), where('createdBy', '==', uid)),
      );
      for (const item of invites.docs) await deleteDoc(item.ref);
    });
  }

  await run('budget months', () => deleteCollection('users', uid, 'months'));
  await run('savings goals', async () => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid, 'data', 'savings'));
  });
  await run('products and sessions', () => deleteUserCourseData(uid));
  // The profile is last: it is what makes the workspace reachable at all.
  await run('profile', async () => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid));
  });

  return report;
}

/**
 * Delete all of a user's personal budget data (every month document plus the
 * savings goals) while keeping the account and profile settings intact.
 *
 * Used by the "Delete All Data" action in the profile screen, so a user can
 * wipe their budget after downloading it without losing their account,
 * currency, theme or plan.
 */
export async function deleteUserBudgetData(uid: string): Promise<DeletionReport> {
  const { report, run } = deletionTracker();
  if (!isFirebaseConfigured || !db) return report;

  await run('savings goals', async () => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid, 'data', 'savings'));
  });
  await run('budget months', () => deleteCollection('users', uid, 'months'));
  await run('products and sessions', () => deleteUserCourseData(uid));

  return report;
}

// Shared Household workspace -------------------------------------------------
// Household documents are deliberately separate from private user documents.
// This lets rules grant access by membership without exposing a user's profile.
import type { Household, HouseholdInvite, HouseholdMember } from './household';

export type HouseholdAccess = 'ok' | 'denied' | 'unavailable';

/**
 * Subscribe to a household document.
 *
 * `onAccess` distinguishes the two failure modes that look identical from the
 * outside: `permission-denied` means membership is genuinely gone (the owner
 * removed this account, or the household was deleted) while a network error
 * only means "not right now". Callers must only tear the workspace down for
 * the first one — otherwise a slow connection logs people out of their shared
 * budget.
 */
export function subscribeHousehold(
  householdId: string | undefined,
  onData: (household: Household | null) => void,
  onAccess: (access: HouseholdAccess) => void = () => {},
) {
  if (!householdId || !isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(
    doc(db, 'households', householdId),
    (snap) => { onAccess('ok'); onData(snap.exists() ? { id: snap.id, ...snap.data() } as Household : null); },
    (err) => {
      const code = (err as { code?: string })?.code;
      console.error('Error listening to household:', err);
      onAccess(code === 'permission-denied' || code === 'not-found' ? 'denied' : 'unavailable');
    },
  );
}

export function subscribeHouseholdMembers(householdId: string | undefined, onData: (members: HouseholdMember[]) => void) {
  if (!householdId || !isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(
    collection(db, 'households', householdId, 'members'),
    (snap) => onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as HouseholdMember))),
    (err) => {
      console.error('Error listening to household members:', err);
      onData([]);
    },
  );
}

export async function createHousehold(ownerId: string, household: Household, owner: HouseholdMember) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const id = crypto.randomUUID();
  await setDoc(doc(db, 'households', id), cleanUndefined({ ...household, onboardingComplete: false }));
  await setDoc(doc(db, 'households', id, 'members', owner.id), cleanUndefined(owner));
  return id;
}

/** Owner teardown: drop members/months/savings/invoices then the household doc. */
export async function deleteHouseholdWorkspace(householdId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const wipe = async (col: string) => {
    if (!db) return;
    const snap = await getDocs(collection(db, 'households', householdId, col));
    for (const item of snap.docs) await deleteDoc(item.ref);
  };
  try {
    // Delete nested data while the owner membership still exists, then members,
    // then the household doc. Firestore delete rules cannot inspect incoming().
    await wipe('months');
    await wipe('invoices');
    try {
      await deleteDoc(doc(db, 'households', householdId, 'data', 'savings'));
    } catch {
      /* savings doc may not exist */
    }
    await wipe('members');
    await deleteDoc(doc(db, 'households', householdId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `households/${householdId}`);
  }
}

export async function saveHouseholdMember(householdId: string, member: HouseholdMember) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'members', member.id), cleanUndefined(member), { merge: true });
}

export async function saveHousehold(householdId: string, patch: Partial<Household>) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId), cleanUndefined({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
}

export async function createHouseholdInvite(invite: HouseholdInvite) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  await setDoc(doc(db, 'householdInvites', invite.id), cleanUndefined(invite));
}

export async function getHouseholdInvite(inviteId: string): Promise<HouseholdInvite | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(db, 'householdInvites', inviteId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as HouseholdInvite) : null;
}

export async function acceptHouseholdInvite(invite: HouseholdInvite, userId: string, displayName: string) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  // Create the recipient's UID-indexed membership directly from the
  // email-bound invite. Firestore rules only accept this write when it points
  // at a pending invitation addressed to the caller's own account, so the
  // inviteId has to travel with the document (see firestore.rules).
  const member: HouseholdMember = {
    id: userId,
    displayName: displayName || invite.email.split('@')[0] || 'Member',
    email: invite.email,
    userId,
    role: invite.role,
    // A `custom` role means nothing without the matrix it refers to — copying
    // it used to drop the permissions and leave the member with no access.
    ...(invite.permissions ? { permissions: invite.permissions } : {}),
    status: 'active',
    avatarColor: '#00685f',
    inviteId: invite.id,
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'households', invite.householdId, 'members', userId), cleanUndefined(member), { merge: true });

  // Bookkeeping that must never block someone from joining: the invitation is
  // marked accepted and the owner's email-bound pending row is retired. Either
  // can legitimately fail (revoked invitation, owner deleted it), so failures
  // are swallowed here — the active membership above is the source of truth.
  await Promise.all([
    setDoc(
      doc(db, 'householdInvites', invite.id),
      { status: 'accepted', acceptedAt: new Date().toISOString() },
      { merge: true },
    ).catch(() => {}),
    invite.memberId && invite.memberId !== userId
      ? setDoc(
          doc(db, 'households', invite.householdId, 'members', invite.memberId),
          cleanUndefined({ status: 'inactive', userId, retiredAt: new Date().toISOString() }),
          { merge: true },
        ).catch(() => {})
      : Promise.resolve(),
  ]);
}

export function subscribeHouseholdMonthBudget(householdId: string, monthKey: string, onData: (month: MonthBudget | null) => void) {
  if (!isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(
    doc(db, 'households', householdId, 'months', monthKey),
    (snap) => onData(snap.exists() ? normalizeMonth(snap.data() as MonthBudget, monthKey) : null),
    (err) => {
      console.error('Error listening to household month:', err);
      onData(null);
    },
  );
}
export async function saveHouseholdMonthBudget(householdId: string, monthKey: string, month: MonthBudget) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'months', monthKey), cleanUndefined(month), { merge: true });
}
export async function getHouseholdMonthBudget(householdId: string, monthKey: string) {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(db, 'households', householdId, 'months', monthKey));
  return snap.exists() ? normalizeMonth(snap.data() as MonthBudget, monthKey) : null;
}
export function subscribeHouseholdSavingsGoals(householdId: string, onData: (goals: SavingGoal[]) => void) {
  if (!isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(doc(db, 'households', householdId, 'data', 'savings'), (snap) => onData(snap.exists() ? (snap.data().goals || []) : []), (err) => {
    console.error('Error listening to household savings:', err);
    onData([]);
  });
}
export async function saveHouseholdSavingsGoals(householdId: string, goals: SavingGoal[]) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'data', 'savings'), cleanUndefined({ goals }), { merge: true });
}
export async function fetchHouseholdMonthsForTrends(householdId: string, currentKey: string, count = 6): Promise<{ monthKey: string; month: MonthBudget }[]> {
  const results: { monthKey: string; month: MonthBudget }[] = [];
  const [year, calendarMonth] = currentKey.split('-').map(Number);
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(year, calendarMonth - 1 - offset, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  // Parallel batch — see fetchMonthsForTrends.
  const months = await Promise.all(keys.map((key) => getHouseholdMonthBudget(householdId, key)));
  months.forEach((month, index) => {
    if (month) results.push({ monthKey: keys[index], month });
  });
  return results;
}

// Contributor invoices are separate from the private monthly budget document.
// This lets rules grant submission access without exposing balances or debts.
import type { HouseholdInvoice } from './household';
export function subscribeHouseholdInvoices(householdId: string, onData: (invoices: HouseholdInvoice[]) => void) {
  if (!isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(collection(db, 'households', householdId, 'invoices'), (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() } as HouseholdInvoice))));
}
export async function saveHouseholdInvoice(householdId: string, invoice: HouseholdInvoice) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'invoices', invoice.id), cleanUndefined(invoice));
}

export function subscribePendingHouseholdInvites(email: string | null | undefined, onData: (invites: HouseholdInvite[]) => void) {
  if (!email || !isFirebaseConfigured || !db) { onData([]); return () => {}; }
  const invites = query(collection(db, 'householdInvites'), where('email', '==', email.toLowerCase()), where('status', '==', 'pending'));
  return onSnapshot(
    invites,
    (snap) => onData(snap.docs.map(item => ({ id: item.id, ...item.data() } as HouseholdInvite))),
    (err) => {
      console.error('Error listening to household invites:', err);
      onData([]);
    },
  );
}
