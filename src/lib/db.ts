import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import { MonthBudget, SavingGoal, UserProfile, normalizeMonth } from './store';

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
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function setUserProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), cleanUndefined(profile), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
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

  const path = `users/${uid}/months/${monthKey}`;
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

  const path = `users/${uid}/data/savings`;
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

  for (const mk of monthKeys) {
    let monthData: MonthBudget | null = null;

    // Try Firestore
    if (uid) {
      monthData = await getMonthBudget(uid, mk);
    }

    // Fallback to localStorage
    if (!monthData) {
      try {
        const local = localStorage.getItem(`flousy_month_${mk}`);
        if (local) {
          monthData = normalizeMonth(JSON.parse(local), mk);
        }
      } catch { /* ignore */ }
    }

    if (monthData) {
      results.push({ monthKey: mk, month: monthData });
    }
  }

  return results;
}

// Delete all user account data from Firestore
export async function deleteUserAccountData(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    // Delete root user doc
    await deleteDoc(doc(db, 'users', uid));

    // Delete savings data
    await deleteDoc(doc(db, 'users', uid, 'data', 'savings'));

    // Delete months collection items
    const monthsRef = collection(db, 'users', uid, 'months');
    const snap = await getDocs(monthsRef);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.error('Error deleting account data:', err);
  }
}

// Shared Household workspace -------------------------------------------------
// Household documents are deliberately separate from private user documents.
// This lets rules grant access by membership without exposing a user's profile.
import type { Household, HouseholdInvite, HouseholdMember } from './household';

export function subscribeHousehold(householdId: string | undefined, onData: (household: Household | null) => void) {
  if (!householdId || !isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(doc(db, 'households', householdId), (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } as Household : null));
}

export function subscribeHouseholdMembers(householdId: string | undefined, onData: (members: HouseholdMember[]) => void) {
  if (!householdId || !isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(collection(db, 'households', householdId, 'members'), (snap) =>
    onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as HouseholdMember)))
  );
}

export async function createHousehold(ownerId: string, household: Household, owner: HouseholdMember) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const id = crypto.randomUUID();
  await setDoc(doc(db, 'households', id), cleanUndefined(household));
  await setDoc(doc(db, 'households', id, 'members', owner.id), cleanUndefined(owner));
  return id;
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
  const source = await getDoc(doc(db, 'households', invite.householdId, 'members', invite.memberId));
  const invitedMember = source.data() || {};
  const member: Partial<HouseholdMember> = { ...invitedMember, userId, displayName: displayName || invitedMember.displayName, status: 'active', joinedAt: new Date().toISOString() };
  // Authenticated members are indexed by their uid, allowing rules to authorise shared data reads.
  await setDoc(doc(db, 'households', invite.householdId, 'members', userId), cleanUndefined(member));
  await setDoc(doc(db, 'households', invite.householdId, 'members', invite.memberId), { status: 'inactive', userId }, { merge: true });
  await setDoc(doc(db, 'householdInvites', invite.id), { status: 'accepted' }, { merge: true });
}

export function subscribeHouseholdMonthBudget(householdId: string, monthKey: string, onData: (month: MonthBudget | null) => void) {
  if (!isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(doc(db, 'households', householdId, 'months', monthKey), (snap) => onData(snap.exists() ? normalizeMonth(snap.data() as MonthBudget, monthKey) : null));
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
  return onSnapshot(doc(db, 'households', householdId, 'data', 'savings'), (snap) => onData(snap.exists() ? (snap.data().goals || []) : []));
}
export async function saveHouseholdSavingsGoals(householdId: string, goals: SavingGoal[]) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'data', 'savings'), cleanUndefined({ goals }), { merge: true });
}
export async function fetchHouseholdMonthsForTrends(householdId: string, currentKey: string, count = 6): Promise<{ monthKey: string; month: MonthBudget }[]> {
  const results: { monthKey: string; month: MonthBudget }[] = [];
  const [year, calendarMonth] = currentKey.split('-').map(Number);
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(year, calendarMonth - 1 - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = await getHouseholdMonthBudget(householdId, key);
    if (month) results.push({ monthKey: key, month });
  }
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
