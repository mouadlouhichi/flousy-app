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
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
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

// --- Course session: product catalog & sessions ------------------------------

/** Subscribe to the user's product catalog (barcode-keyed products). */
export function subscribeProductCatalog(uid: string, onData: (products: Product[]) => void): () => void {
  if (!isFirebaseConfigured || !db) {
    onData([]);
    return () => {};
  }

  const path = `users/${uid}/products`;
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
  try {
    const productsRef = collection(db, 'users', uid, 'products');
    const productsSnap = await getDocs(productsRef);
    for (const d of productsSnap.docs) await deleteDoc(d.ref);

    const sessionsRef = collection(db, 'users', uid, 'sessions');
    const sessionsSnap = await getDocs(sessionsRef);
    for (const d of sessionsSnap.docs) await deleteDoc(d.ref);
  } catch (err) {
    console.error('Error deleting course data:', err);
  }
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

    // Delete course catalog + sessions
    await deleteUserCourseData(uid);
  } catch (err) {
    console.error('Error deleting account data:', err);
  }
}

/**
 * Delete all of a user's personal budget data (every month document plus the
 * savings goals) while keeping the account and profile settings intact.
 *
 * Used by the "Delete All Data" action in the profile screen, so a user can
 * wipe their budget after downloading it without losing their account,
 * currency, theme or plan.
 */
export async function deleteUserBudgetData(uid: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;

  try {
    // Delete savings data
    await deleteDoc(doc(db, 'users', uid, 'data', 'savings'));

    // Delete all months
    const monthsRef = collection(db, 'users', uid, 'months');
    const snap = await getDocs(monthsRef);
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }

    // Delete course catalog + sessions (budget records)
    await deleteUserCourseData(uid);
  } catch (err) {
    console.error('Error deleting user budget data:', err);
  }
}

// Shared Household workspace -------------------------------------------------
// Household documents are deliberately separate from private user documents.
// This lets rules grant access by membership without exposing a user's profile.
import type { Household, HouseholdInvite, HouseholdMember } from './household';

export function subscribeHousehold(householdId: string | undefined, onData: (household: Household | null) => void) {
  if (!householdId || !isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(
    doc(db, 'households', householdId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } as Household : null),
    (err) => {
      console.error('Error listening to household:', err);
      onData(null);
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
  const hid = householdId;
  const wipe = async (col: string) => {
    const snap = await getDocs(collection(db, 'households', hid, col));
    for (const item of snap.docs) await deleteDoc(item.ref);
  };
  try {
    // Delete nested data while the owner membership still exists, then members,
    // then the household doc. Firestore delete rules cannot inspect incoming().
    await wipe('months');
    await wipe('invoices');
    try {
      await deleteDoc(doc(db, 'households', hid, 'data', 'savings'));
    } catch {
      /* savings doc may not exist */
    }
    await wipe('members');
    await deleteDoc(doc(db, 'households', hid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `households/${hid}`);
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
  // email-bound invite. This avoids making acceptance depend on a write to
  // the owner's pending-member record.
  const member: HouseholdMember = {
    id: userId,
    displayName: displayName || invite.email.split('@')[0] || 'Member',
    email: invite.email,
    userId,
    role: invite.role,
    status: 'active',
    avatarColor: '#00685f',
    joinedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'households', invite.householdId, 'members', userId), cleanUndefined(member), { merge: true });
  // The active membership is the source of truth. Marking the invitation
  // accepted is non-critical and must never block a recipient from joining.
  setDoc(doc(db, 'householdInvites', invite.id), { status: 'accepted' }, { merge: true }).catch(() => {});
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
