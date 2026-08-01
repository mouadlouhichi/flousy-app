import firestore from '@react-native-firebase/firestore';
import {
  type UserProfile,
  type MonthBudget,
  type SavingGoal,
  normalizeMonth,
} from '@flousy/core';

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docSnap = await firestore().collection('users').doc(uid).get();
  if (!docSnap.exists) return null;
  return docSnap.data() as UserProfile;
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await firestore().collection('users').doc(uid).set(data, { merge: true });
}

export async function getMonthBudget(uid: string, monthId: string): Promise<MonthBudget | null> {
  const docSnap = await firestore()
    .collection('users')
    .doc(uid)
    .collection('months')
    .doc(monthId)
    .get();
  if (!docSnap.exists) return null;
  return normalizeMonth(docSnap.data() as MonthBudget, monthId);
}

export async function saveMonthBudget(
  uid: string,
  monthId: string,
  data: MonthBudget
): Promise<void> {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('months')
    .doc(monthId)
    .set(data);
}

export function subscribeToMonth(
  uid: string,
  monthId: string,
  onUpdate: (month: MonthBudget | null) => void,
  onError?: (error: Error) => void
): () => void {
  const unsubscribe = firestore()
    .collection('users')
    .doc(uid)
    .collection('months')
    .doc(monthId)
    .onSnapshot(
      (snapshot) => {
        if (!snapshot.exists) {
          onUpdate(null);
        } else {
          onUpdate(normalizeMonth(snapshot.data() as MonthBudget, monthId));
        }
      },
      (error) => {
        if (onError) onError(error);
      }
    );
  return unsubscribe;
}

export async function getSavingsGoals(uid: string): Promise<SavingGoal[]> {
  const docSnap = await firestore()
    .collection('users')
    .doc(uid)
    .collection('data')
    .doc('savings')
    .get();
  if (!docSnap.exists) return [];
  const data = docSnap.data() as { goals?: SavingGoal[] };
  return data?.goals || [];
}

export async function saveSavingsGoals(uid: string, goals: SavingGoal[]): Promise<void> {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('data')
    .doc('savings')
    .set({ goals });
}
