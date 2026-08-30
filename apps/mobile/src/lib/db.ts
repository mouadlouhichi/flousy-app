import firestore from '@react-native-firebase/firestore';
import {
  type UserProfile,
  type MonthBudget,
  type SavingGoal,
  type Product,
  type CourseSession,
  type Household,
  type HouseholdMember,
  type HouseholdInvite,
  type HouseholdInvoice,
  normalizeMonth,
} from '@flousy/core';

function cleanUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined) as unknown as T;
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== undefined) cleaned[key] = cleanUndefined(val);
  }
  return cleaned as T;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docSnap = await firestore().collection('users').doc(uid).get();
  if (!docSnap.exists) return null;
  return docSnap.data() as UserProfile;
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  await firestore().collection('users').doc(uid).set(cleanUndefined(data), { merge: true });
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
    .set(cleanUndefined(data), { merge: true });
}

export function subscribeToMonth(
  uid: string,
  monthId: string,
  onUpdate: (month: MonthBudget | null) => void,
  onError?: (error: Error) => void
): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('months')
    .doc(monthId)
    .onSnapshot(
      (snapshot) => {
        if (!snapshot.exists) onUpdate(null);
        else onUpdate(normalizeMonth(snapshot.data() as MonthBudget, monthId));
      },
      (error) => {
        if (onError) onError(error);
      }
    );
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
    .set(cleanUndefined({ goals }), { merge: true });
}

export async function fetchMonthsForTrends(
  uid: string,
  currentKey: string,
  count = 6,
): Promise<{ monthKey: string; month: MonthBudget }[]> {
  const results: { monthKey: string; month: MonthBudget }[] = [];
  const [year, calendarMonth] = currentKey.split('-').map(Number);
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(year, calendarMonth - 1 - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const month = await getMonthBudget(uid, key);
    if (month) results.push({ monthKey: key, month });
  }
  return results;
}

export function subscribeProductCatalog(uid: string, onData: (products: Product[]) => void): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('products')
    .limit(2000)
    .onSnapshot((snap) => onData(snap.docs.map((d) => d.data() as Product)));
}

export async function saveProduct(uid: string, product: Product): Promise<void> {
  if (!product.barcode) return;
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('products')
    .doc(product.barcode)
    .set(cleanUndefined(product), { merge: true });
}

export function subscribeActiveCourseSession(
  uid: string,
  onData: (session: CourseSession | null) => void,
): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .where('status', '==', 'active')
    .limit(1)
    .onSnapshot((snap) => onData(snap.empty ? null : (snap.docs[0].data() as CourseSession)));
}

export function subscribeCourseSessions(uid: string, onData: (sessions: CourseSession[]) => void): () => void {
  return firestore()
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .where('status', '==', 'completed')
    .limit(100)
    .onSnapshot((snap) => {
      const list = snap.docs.map((d) => d.data() as CourseSession);
      list.sort((a, b) => (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt));
      onData(list);
    });
}

export async function saveCourseSession(uid: string, session: CourseSession): Promise<void> {
  await firestore()
    .collection('users')
    .doc(uid)
    .collection('sessions')
    .doc(session.id)
    .set(cleanUndefined(session), { merge: true });
}

export async function deleteCourseSession(uid: string, sessionId: string): Promise<void> {
  await firestore().collection('users').doc(uid).collection('sessions').doc(sessionId).delete();
}

export async function deleteUserAccountData(uid: string): Promise<void> {
  await firestore().collection('users').doc(uid).delete();
  await firestore().collection('users').doc(uid).collection('data').doc('savings').delete();
  const months = await firestore().collection('users').doc(uid).collection('months').get();
  for (const d of months.docs) await d.ref.delete();
  const products = await firestore().collection('users').doc(uid).collection('products').get();
  for (const d of products.docs) await d.ref.delete();
  const sessions = await firestore().collection('users').doc(uid).collection('sessions').get();
  for (const d of sessions.docs) await d.ref.delete();
}

export async function deleteUserBudgetData(uid: string): Promise<void> {
  await firestore().collection('users').doc(uid).collection('data').doc('savings').delete();
  const months = await firestore().collection('users').doc(uid).collection('months').get();
  for (const d of months.docs) await d.ref.delete();
  const products = await firestore().collection('users').doc(uid).collection('products').get();
  for (const d of products.docs) await d.ref.delete();
  const sessions = await firestore().collection('users').doc(uid).collection('sessions').get();
  for (const d of sessions.docs) await d.ref.delete();
}

export function subscribeHousehold(householdId: string | undefined, onData: (household: Household | null) => void) {
  if (!householdId) {
    onData(null);
    return () => {};
  }
  return firestore()
    .collection('households')
    .doc(householdId)
    .onSnapshot((snap) => onData(snap.exists ? ({ id: snap.id, ...snap.data() } as Household) : null));
}

export function subscribeHouseholdMembers(
  householdId: string | undefined,
  onData: (members: HouseholdMember[]) => void,
) {
  if (!householdId) {
    onData([]);
    return () => {};
  }
  return firestore()
    .collection('households')
    .doc(householdId)
    .collection('members')
    .onSnapshot((snap) =>
      onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as HouseholdMember))),
    );
}

export async function createHousehold(household: Household, owner: HouseholdMember): Promise<string> {
  const ref = firestore().collection('households').doc();
  await ref.set(cleanUndefined(household));
  await ref.collection('members').doc(owner.id).set(cleanUndefined(owner));
  return ref.id;
}

export async function saveHouseholdMember(householdId: string, member: HouseholdMember) {
  await firestore()
    .collection('households')
    .doc(householdId)
    .collection('members')
    .doc(member.id)
    .set(cleanUndefined(member), { merge: true });
}

export async function saveHousehold(householdId: string, patch: Partial<Household>) {
  await firestore()
    .collection('households')
    .doc(householdId)
    .set(cleanUndefined({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
}

export async function createHouseholdInvite(invite: HouseholdInvite) {
  await firestore().collection('householdInvites').doc(invite.id).set(cleanUndefined(invite));
}

export async function getHouseholdInvite(inviteId: string): Promise<HouseholdInvite | null> {
  const snap = await firestore().collection('householdInvites').doc(inviteId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HouseholdInvite;
}

export async function acceptHouseholdInvite(invite: HouseholdInvite, userId: string, displayName: string) {
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
  await firestore()
    .collection('households')
    .doc(invite.householdId)
    .collection('members')
    .doc(userId)
    .set(cleanUndefined(member), { merge: true });
  await firestore().collection('householdInvites').doc(invite.id).set({ status: 'accepted' }, { merge: true });
}

export function subscribeHouseholdMonthBudget(
  householdId: string,
  monthKey: string,
  onData: (month: MonthBudget | null) => void,
) {
  return firestore()
    .collection('households')
    .doc(householdId)
    .collection('months')
    .doc(monthKey)
    .onSnapshot((snap) =>
      onData(snap.exists ? normalizeMonth(snap.data() as MonthBudget, monthKey) : null),
    );
}

export async function saveHouseholdMonthBudget(householdId: string, monthKey: string, month: MonthBudget) {
  await firestore()
    .collection('households')
    .doc(householdId)
    .collection('months')
    .doc(monthKey)
    .set(cleanUndefined(month), { merge: true });
}

export async function getHouseholdMonthBudget(householdId: string, monthKey: string) {
  const snap = await firestore()
    .collection('households')
    .doc(householdId)
    .collection('months')
    .doc(monthKey)
    .get();
  return snap.exists ? normalizeMonth(snap.data() as MonthBudget, monthKey) : null;
}

export function subscribeHouseholdSavingsGoals(householdId: string, onData: (goals: SavingGoal[]) => void) {
  return firestore()
    .collection('households')
    .doc(householdId)
    .collection('data')
    .doc('savings')
    .onSnapshot((snap) => onData(snap.exists ? ((snap.data()?.goals as SavingGoal[]) || []) : []));
}

export async function saveHouseholdSavingsGoals(householdId: string, goals: SavingGoal[]) {
  await firestore()
    .collection('households')
    .doc(householdId)
    .collection('data')
    .doc('savings')
    .set(cleanUndefined({ goals }), { merge: true });
}

export function subscribeHouseholdInvoices(
  householdId: string,
  onData: (invoices: HouseholdInvoice[]) => void,
) {
  return firestore()
    .collection('households')
    .doc(householdId)
    .collection('invoices')
    .onSnapshot((snap) =>
      onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HouseholdInvoice))),
    );
}

export async function saveHouseholdInvoice(householdId: string, invoice: HouseholdInvoice) {
  await firestore()
    .collection('households')
    .doc(householdId)
    .collection('invoices')
    .doc(invoice.id)
    .set(cleanUndefined(invoice));
}

export function subscribePendingHouseholdInvites(
  email: string | null | undefined,
  onData: (invites: HouseholdInvite[]) => void,
) {
  if (!email) {
    onData([]);
    return () => {};
  }
  return firestore()
    .collection('householdInvites')
    .where('email', '==', email.toLowerCase())
    .where('status', '==', 'pending')
    .onSnapshot((snap) =>
      onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as HouseholdInvite))),
    );
}
