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
    await setDoc(doc(db, 'users', uid), profile, { merge: true });
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
    await setDoc(doc(db, 'users', uid, 'months', monthKey), month, { merge: true });
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
    await setDoc(doc(db, 'users', uid, 'data', 'savings'), { goals }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
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
  } catch (err) {
    console.error('Error deleting account data:', err);
  }
}
