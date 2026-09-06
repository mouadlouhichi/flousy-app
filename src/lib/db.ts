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
  writeBatch,
  runTransaction,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore';
import { db, auth, isFirebaseConfigured } from './firebase';
import {
  FinanceConflictError,
  mergeGoalsMutation,
  mergeMonthMutation,
  resolvePeriodMutation,
  type FinanceMutation,
} from './finance-sync';
import {
  addVariableExpense,
  CourseSession,
  DEFAULT_MONEY_PLACES,
  MonthBudget,
  Product,
  SavingGoal,
  UserProfile,
  normalizeMonth,
  type MonthConfiguration,
} from './store';
import { FINANCE_BACKUP_FORMAT, FINANCE_BACKUP_VERSION, type FinanceBackup } from './finance-backup';
import {
  emptyWorkspaceSyncCounts,
  isClosedTargetConflict,
  mergeSourceTransactionsIntoMonth,
  type WorkspaceSyncCounts,
} from './workspace-sync';
import { PRO_TRIAL_DURATION_MS, resolveProEntitlement } from './pro-features';

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
  // Preserve the Firestore error code on the rethrown error. Callers gate on
  // `permission-denied` to tell "the rules refused this" from "the network
  // failed", and flattening every failure into one opaque Error is what left a
  // refused workspace teardown indistinguishable from a transient blip - and
  // reported to the user as the wrong cause entirely.
  const wrapped = new Error('A database error occurred. Please try again.') as Error & {
    code?: string;
    cause?: unknown;
  };
  const code = (error as { code?: string })?.code;
  if (code) wrapped.code = code;
  wrapped.cause = error;
  throw wrapped;
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
export type UserProfileReadResult =
  | { status: 'found'; profile: UserProfile }
  | { status: 'missing' }
  | { status: 'unavailable'; error: Error };

/** Never collapse a failed read into "missing" — doing so can overwrite a valid profile. */
export async function getUserProfile(uid: string): Promise<UserProfileReadResult> {
  if (!isFirebaseConfigured || !db) {
    return { status: 'unavailable', error: new Error('Firebase is not configured.') };
  }
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'users', uid)),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile read timed out')), 5000);
      }),
    ]);
    return snap.exists()
      ? { status: 'found', profile: snap.data() as UserProfile }
      : { status: 'missing' };
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    console.error('Error fetching user profile:', normalized);
    return { status: 'unavailable', error: normalized };
  }
}

/**
 * Apply a profile patch. `householdIdChange` performs the `householdIds`
 * update atomically (arrayUnion/arrayRemove) instead of writing a whole
 * array computed from possibly stale local state — two sessions joining or
 * leaving households concurrently would otherwise clobber each other's
 * membership list. The sentinel overrides any `householdIds` value inside
 * `profile`; callers keep the computed array in `profile` only so their
 * local mirror stays in sync.
 */
export async function setUserProfile(
  uid: string,
  profile: Partial<UserProfile>,
  householdIdChange?: { add?: string; remove?: string },
): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  try {
    const patch: Record<string, unknown> = { ...cleanUndefined(profile) };
    if (householdIdChange?.add) {
      patch.householdIds = arrayUnion(householdIdChange.add);
    } else if (householdIdChange?.remove) {
      patch.householdIds = arrayRemove(householdIdChange.remove);
    }
    await setDoc(doc(db, 'users', uid), patch, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

// Monthly Budget Subscription & Save
export function subscribeMonthBudget(
  uid: string,
  monthKey: string,
  onData: (month: MonthBudget | null) => void,
  configuration?: MonthConfiguration | null,
  onError?: (err: Error) => void,
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
        const normalized = normalizeMonth(snap.data() as MonthBudget, monthKey, configuration);
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

/** Create an onboarding/bootstrap month without ever replacing existing finance data. */
export async function saveMonthBudget(uid: string, monthKey: string, month: MonthBudget): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false;
  const mutationId = `bootstrap-${crypto.randomUUID()}`;
  const firestore = db;
  const monthRef = doc(firestore, 'users', uid, 'months', monthKey);
  const ledgerRef = doc(firestore, 'users', uid, 'ledger', mutationId);
  try {
    return await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(monthRef);
      if (snapshot.exists()) return false;
      const baseRevision = 0;
      const next = {
        ...normalizeMonth(month, monthKey),
        revision: 1,
        lastMutationId: mutationId,
        updatedByUserId: uid,
        updatedAt: new Date().toISOString(),
      };
      transaction.set(monthRef, cleanUndefined(next));
      transaction.set(ledgerRef, {
        mutationId,
        actorId: uid,
        workspace: 'personal',
        workspaceId: uid,
        monthKey,
        kind: 'bootstrap',
        baseRevision,
        nextRevision: baseRevision + 1,
        createdAt: next.updatedAt,
      });
      return true;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/months/${monthKey}`);
  }
}

export type FinanceTarget =
  | { workspace: 'personal'; uid: string }
  | { workspace: 'household'; householdId: string };

export interface FinanceCommitResult {
  month: MonthBudget;
  goals?: SavingGoal[];
}

export async function getFinanceState(
  workspace: 'personal' | 'household',
  workspaceId: string,
  monthKey: string,
  configuration?: MonthConfiguration | null,
): Promise<{ month: MonthBudget; goals: SavingGoal[] }> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const monthRef = workspace === 'household'
    ? doc(db, 'households', workspaceId, 'months', monthKey)
    : doc(db, 'users', workspaceId, 'months', monthKey);
  const goalsRef = workspace === 'household'
    ? doc(db, 'households', workspaceId, 'data', 'savings')
    : doc(db, 'users', workspaceId, 'data', 'savings');
  const [monthSnapshot, goalsSnapshot] = await Promise.all([getDoc(monthRef), getDoc(goalsRef)]);
  return {
    month: monthSnapshot.exists()
      ? normalizeMonth(monthSnapshot.data() as MonthBudget, monthKey, configuration)
      : normalizeMonth({ totalBudget: 0 }, monthKey, configuration),
    goals: goalsSnapshot.exists() ? (goalsSnapshot.data().goals || []) : [],
  };
}

/**
 * Apply an outbox mutation with a Firestore transaction. Firestore may rerun
 * the callback against a newer revision; the three-way merge composes
 * independent changes and throws an explicit conflict for the same entity.
 */
export async function commitFinanceMutation(
  mutation: FinanceMutation,
  configuration?: MonthConfiguration | null,
): Promise<FinanceCommitResult> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const monthRef = mutation.workspace === 'household'
    ? doc(db, 'households', mutation.workspaceId, 'months', mutation.monthKey)
    : doc(db, 'users', mutation.workspaceId, 'months', mutation.monthKey);
  const goalsRef = mutation.workspace === 'household'
    ? doc(db, 'households', mutation.workspaceId, 'data', 'savings')
    : doc(db, 'users', mutation.workspaceId, 'data', 'savings');
  const ledgerRef = mutation.workspace === 'household'
    ? doc(db, 'households', mutation.workspaceId, 'ledger', mutation.id)
    : doc(db, 'users', mutation.workspaceId, 'ledger', mutation.id);

  return runTransaction(db, async (transaction) => {
    const [ledgerSnapshot, monthSnapshot, goalsSnapshot] = await Promise.all([
      transaction.get(ledgerRef),
      transaction.get(monthRef),
      mutation.nextGoals ? transaction.get(goalsRef) : Promise.resolve(null),
    ]);

    if (ledgerSnapshot.exists()) {
      const record = ledgerSnapshot.data();
      const expectedWorkspaceId = mutation.workspaceId;
      if (
        record.mutationId !== mutation.id
        || record.actorId !== mutation.actorId
        || record.workspace !== mutation.workspace
        || record.workspaceId !== expectedWorkspaceId
        || record.monthKey !== mutation.monthKey
      ) {
        throw new FinanceConflictError([{ path: `ledger.${mutation.id}`, reason: 'changed-remotely' }]);
      }
      return {
        month: monthSnapshot.exists()
          ? normalizeMonth(monthSnapshot.data() as MonthBudget, mutation.monthKey, configuration)
          : mutation.nextMonth,
        ...(goalsSnapshot ? { goals: goalsSnapshot.exists() ? (goalsSnapshot.data().goals || []) : [] } : {}),
      };
    }

    const remoteMonth = monthSnapshot.exists()
      ? normalizeMonth(monthSnapshot.data() as MonthBudget, mutation.monthKey, configuration)
      : normalizeMonth(mutation.baseMonth, mutation.monthKey, configuration);
    const intent = mutation.intent || 'finance';
    // Repeated close/reopen operations are idempotent. A stale ordinary edit
    // never merges into a month another device has already frozen.
    if (resolvePeriodMutation(remoteMonth, intent) === 'already-satisfied') {
      return { month: remoteMonth };
    }
    const mergedMonth = mergeMonthMutation(mutation.baseMonth, mutation.nextMonth, remoteMonth);
    const baseRevision = monthSnapshot.exists()
      ? Math.max(0, Number(monthSnapshot.data().revision) || 0)
      : 0;
    const nextMonth: MonthBudget = {
      ...mergedMonth,
      schemaVersion: 2,
      revision: baseRevision + 1,
      lastMutationId: mutation.id,
      updatedByUserId: mutation.actorId,
      updatedAt: new Date().toISOString(),
    };

    let nextGoals: SavingGoal[] | undefined;
    if (mutation.nextGoals) {
      const remoteGoals = goalsSnapshot?.exists() ? (goalsSnapshot.data().goals || []) as SavingGoal[] : [];
      nextGoals = mergeGoalsMutation(mutation.baseGoals || [], mutation.nextGoals, remoteGoals);
      const goalsRevision = goalsSnapshot?.exists()
        ? Math.max(0, Number(goalsSnapshot.data().revision) || 0)
        : 0;
      transaction.set(goalsRef, cleanUndefined({
        goals: nextGoals,
        revision: goalsRevision + 1,
        lastMutationId: mutation.id,
        updatedAt: nextMonth.updatedAt,
        updatedByUserId: mutation.actorId,
      }));
    }

    const balanceDelta = {
      bank: Math.round((nextMonth.bankPart - remoteMonth.bankPart) * 100) / 100,
      home: Math.round((nextMonth.homePart - remoteMonth.homePart) * 100) / 100,
      wallet: Math.round((nextMonth.walletPart - remoteMonth.walletPart) * 100) / 100,
    };
    transaction.set(monthRef, cleanUndefined(nextMonth));
    transaction.set(ledgerRef, cleanUndefined({
      mutationId: mutation.id,
      actorId: mutation.actorId,
      workspace: mutation.workspace,
      workspaceId: mutation.workspaceId,
      monthKey: mutation.monthKey,
      kind: intent === 'close-period'
        ? 'month-close'
        : intent === 'reopen-period'
          ? 'month-reopen'
          : mutation.nextGoals ? 'month-and-savings' : 'month',
      baseRevision,
      nextRevision: baseRevision + 1,
      balanceDelta,
      createdAt: mutation.createdAt,
      committedAt: nextMonth.updatedAt,
    }));
    return { month: nextMonth, ...(nextGoals ? { goals: nextGoals } : {}) };
  });
}

function backupId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `backup-${Date.now()}`;
}

/** Export every financial period and related workspace record, not only the visible month. */
export async function exportFinanceBackup(
  uid: string,
  target: FinanceTarget,
  configuration?: MonthConfiguration | null,
): Promise<FinanceBackup> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const monthCollection = target.workspace === 'household'
    ? collection(db, 'households', target.householdId, 'months')
    : collection(db, 'users', target.uid, 'months');
  const savingsRef = target.workspace === 'household'
    ? doc(db, 'households', target.householdId, 'data', 'savings')
    : doc(db, 'users', target.uid, 'data', 'savings');
  const configurationRef = target.workspace === 'household'
    ? doc(db, 'households', target.householdId)
    : doc(db, 'users', target.uid);
  const [monthSnapshots, savingsSnapshot, configurationSnapshot] = await Promise.all([
    getDocs(monthCollection),
    getDoc(savingsRef),
    getDoc(configurationRef),
  ]);
  const months: Record<string, MonthBudget> = {};
  for (const snapshot of monthSnapshots.docs) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.id)) {
      months[snapshot.id] = normalizeMonth(snapshot.data() as MonthBudget, snapshot.id, configuration);
    }
  }
  let products: Product[] | undefined;
  let sessions: CourseSession[] | undefined;
  if (target.workspace === 'personal') {
    const [productSnapshots, sessionSnapshots] = await Promise.all([
      getDocs(collection(db, 'users', uid, 'products')),
      getDocs(collection(db, 'users', uid, 'sessions')),
    ]);
    products = productSnapshots.docs.map((snapshot) => snapshot.data() as Product);
    sessions = sessionSnapshots.docs.map((snapshot) => snapshot.data() as CourseSession);
  }
  const rawConfiguration: Record<string, unknown> = configurationSnapshot.exists()
    ? configurationSnapshot.data()
    : { ...(configuration || {}) };
  return {
    format: FINANCE_BACKUP_FORMAT,
    version: FINANCE_BACKUP_VERSION,
    id: backupId(),
    exportedAt: new Date().toISOString(),
    workspace: {
      type: target.workspace,
      id: target.workspace === 'household' ? target.householdId : target.uid,
      ...(typeof rawConfiguration.name === 'string' ? { name: rawConfiguration.name } : {}),
    },
    configuration: cleanUndefined(rawConfiguration) as Partial<UserProfile>,
    months,
    goals: savingsSnapshot.exists() ? (savingsSnapshot.data().goals || []) as SavingGoal[] : [],
    ...(products ? { products } : {}),
    ...(sessions ? { sessions } : {}),
  };
}

/**
 * A restore that applied some periods and then stopped. Re-running the same file
 * is safe (each period's mutation id is derived from the backup, so an applied
 * period is a no-op the second time), and that is the only thing the count of
 * applied periods can honestly promise. `reason` is the error that stopped it:
 * for a workspace refusing the write, "select the file again" is an instruction to
 * repeat the failure, and the dialog says so only because the cause survived.
 */
export class FinanceRestoreIncompleteError extends Error {
  constructor(
    public readonly completed: string[],
    public readonly failed: string,
    public readonly reason?: unknown,
  ) {
    super(`Restore stopped after ${completed.length} periods; retrying the same backup is safe.`);
    this.name = 'FinanceRestoreIncompleteError';
  }
}

/**
 * Restore uses the same revisioned transaction path as interactive edits. Each
 * period has a stable mutation ID, making a partially completed restore safely
 * resumable without duplicating cash movements or entities.
 */
export async function restoreFinanceBackup(
  uid: string,
  target: FinanceTarget,
  backup: FinanceBackup,
  currentConfiguration?: Partial<UserProfile> | null,
): Promise<{ restoredMonths: number; restoredGoals: number }> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const firestore = db;
  // The destination is the user's choice, not something this function re-litigates:
  // the periods in a file are self-describing (each carries its own currency and
  // start day), so a budget exported from a shared workspace restores into a
  // personal one and the other way round, and a currency or period-start that
  // differs from the destination is a thing to say out loud in the confirmation
  // dialog - see planFinanceBackupRestore() - not a reason to refuse someone's own
  // data. What must not travel is the *configuration*: a household's shared places
  // and category defaults belong to the people who see them, and one member's
  // personal settings file has no business rewriting a household's.
  const retargeted = backup.workspace.type !== 'unknown' && backup.workspace.type !== target.workspace;

  const workspaceId = target.workspace === 'household' ? target.householdId : target.uid;
  const monthEntries = Object.entries(backup.months).sort(([left], [right]) => left.localeCompare(right));
  if (monthEntries.length === 0 && backup.goals.length > 0) {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const state = await getFinanceState(target.workspace, workspaceId, key, currentConfiguration);
    monthEntries.push([key, state.month]);
  }

  const completed: string[] = [];
  for (let index = 0; index < monthEntries.length; index += 1) {
    const [monthKey, importedMonth] = monthEntries[index];
    try {
      const state = await getFinanceState(target.workspace, workspaceId, monthKey, currentConfiguration);
      const mutationId = `restore-${backup.id}-${monthKey}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 180);
      await commitFinanceMutation({
        version: 1,
        id: mutationId,
        workspace: target.workspace,
        workspaceId,
        actorId: uid,
        monthKey,
        baseMonth: state.month,
        nextMonth: normalizeMonth(importedMonth, monthKey, currentConfiguration),
        ...(index === 0 ? { baseGoals: state.goals, nextGoals: backup.goals } : {}),
        createdAt: backup.exportedAt,
        attempts: 0,
      }, currentConfiguration);
      completed.push(monthKey);
    } catch (error) {
      console.error('Backup restore stopped:', error);
      throw new FinanceRestoreIncompleteError(completed, monthKey, error);
    }
  }

  if (target.workspace === 'personal') {
    const records: Array<{ ref: ReturnType<typeof doc>; data: unknown }> = [
      ...(backup.products || []).filter((product) => product?.barcode).map((product) => ({
        ref: doc(firestore, 'users', uid, 'products', product.barcode),
        data: product,
      })),
      ...(backup.sessions || []).filter((session) => session?.id).map((session) => ({
        ref: doc(firestore, 'users', uid, 'sessions', session.id),
        data: session,
      })),
    ];
    for (let offset = 0; offset < records.length; offset += 400) {
      const batch = writeBatch(firestore);
      records.slice(offset, offset + 400).forEach((record) => batch.set(record.ref, cleanUndefined(record.data)));
      await batch.commit();
    }
    const config = backup.configuration as Partial<UserProfile>;
    if (retargeted) return { restoredMonths: completed.length, restoredGoals: backup.goals.length };
    await setDoc(doc(firestore, 'users', uid), cleanUndefined({
      theme: config.theme,
      language: config.language,
      defaultCategoryBudgets: config.defaultCategoryBudgets,
      enableRollover: config.enableRollover,
      fixedCategories: config.fixedCategories,
      monthStartDate: config.monthStartDate,
      moneyPlaces: config.moneyPlaces,
    }), { merge: true });
  } else {
    const config = backup.configuration as Record<string, unknown>;
    if (retargeted) return { restoredMonths: completed.length, restoredGoals: backup.goals.length };
    await setDoc(doc(firestore, 'households', target.householdId), cleanUndefined({
      defaultCategoryBudgets: config.defaultCategoryBudgets,
      enableRollover: config.enableRollover,
      activeCategories: config.activeCategories,
      fixedCategories: config.fixedCategories,
      moneyPlaces: config.moneyPlaces,
    }), { merge: true });
  }

  return { restoredMonths: completed.length, restoredGoals: backup.goals.length };
}

export type WorkspaceSyncErrorCode = 'currency-mismatch' | 'period-mismatch' | 'incomplete';

/**
 * A workspace sync that stopped partway. It is always safe to run again - records
 * keep their ids - so the count of months already copied and the month that
 * failed are the two facts that tell a user whether "run again" is the answer or
 * merely the same refusal waiting for them. `reason` is whatever the write
 * actually raised: `WorkspaceSyncError` is not the place to decide what a
 * permission refusal means, but it is the place to stop losing it.
 */
export class WorkspaceSyncError extends Error {
  constructor(
    public readonly code: WorkspaceSyncErrorCode,
    message: string,
    public readonly counts?: WorkspaceSyncCounts,
    public readonly failedMonth?: string,
    public readonly reason?: unknown,
  ) {
    super(message);
    this.name = 'WorkspaceSyncError';
  }
}

/**
 * On-demand transaction sync between the two workspaces of one account
 * (personal → household or household → personal).
 *
 * Each source period is merged into the matching target period through the
 * same revisioned transaction path as interactive edits: records keep their
 * ids (so re-running the sync never duplicates), records the target already
 * has are skipped, and balances/transfers/adjustments/goals are never
 * touched. Currency and budget-period start day must match, exactly like a
 * backup restore, because a period key covers different date ranges
 * otherwise.
 */
export async function syncWorkspaceTransactions(
  uid: string,
  source: FinanceTarget,
  target: FinanceTarget,
  sourceConfiguration?: MonthConfiguration | null,
  targetConfiguration?: MonthConfiguration | null,
): Promise<WorkspaceSyncCounts> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  if (source.workspace === target.workspace) {
    throw new Error('Workspace sync copies between a personal and a household workspace.');
  }
  const sourceCurrency = sourceConfiguration?.currency;
  const targetCurrency = targetConfiguration?.currency;
  if (sourceCurrency && targetCurrency && sourceCurrency !== targetCurrency) {
    throw new WorkspaceSyncError('currency-mismatch', 'Both workspaces must use the same currency to sync.');
  }
  const sourceStartDay = Number(sourceConfiguration?.monthStartDate || 1);
  const targetStartDay = Number(targetConfiguration?.monthStartDate || 1);
  if (sourceStartDay !== targetStartDay) {
    throw new WorkspaceSyncError('period-mismatch', 'Both workspaces must share the same budget-period start day to sync.');
  }

  const monthCollection = source.workspace === 'household'
    ? collection(db, 'households', source.householdId, 'months')
    : collection(db, 'users', source.uid, 'months');
  const snapshots = await getDocs(monthCollection);

  const counts = emptyWorkspaceSyncCounts();
  const skippedClosed: string[] = [];
  const runId = Date.now().toString(36);
  const monthEntries = snapshots.docs
    .map((snapshot) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.id)
      ? [snapshot.id, normalizeMonth(snapshot.data() as MonthBudget, snapshot.id, sourceConfiguration)] as const
      : null))
    .filter((entry): entry is readonly [string, MonthBudget] => entry !== null)
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [monthKey, sourceMonth] of monthEntries) {
    const state = await getFinanceState(target.workspace, target.workspace === 'household' ? target.householdId : target.uid, monthKey, targetConfiguration);
    const merged = mergeSourceTransactionsIntoMonth(state.month, sourceMonth);
    if (!merged) continue;
    const mutationId = `wssync-${source.workspace}-${monthKey}-${runId}`
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 160);
    try {
      await commitFinanceMutation({
        version: 1,
        id: mutationId,
        workspace: target.workspace,
        workspaceId: target.workspace === 'household' ? target.householdId : target.uid,
        actorId: uid,
        monthKey,
        baseMonth: state.month,
        nextMonth: merged.month,
        createdAt: new Date().toISOString(),
        attempts: 0,
      }, targetConfiguration);
    } catch (error) {
      if (isClosedTargetConflict(error)) {
        // A frozen period cannot take records, and used to abort the entire
        // two-way sync at month 0 - "Sync stopped after 0 month(s). Running it
        // again is safe", for a sync that would stop at the same month forever.
        // The other periods still go through, and the count is the honest report.
        skippedClosed.push(monthKey);
        continue;
      }
      console.error('[workspace-sync] stopped', {
        monthKey,
        mutationId,
        targetWorkspace: target.workspace,
        code: (error as { code?: string })?.code ?? null,
        context: target.workspace === 'household'
          ? await describeHouseholdWriteContext(target.householdId)
          : { workspace: 'personal', uid: target.uid },
      }, error);
      // A workspace that refuses the write and a connection that died both stop
      // "after N months", and only one of them is helped by running it again: keep
      // the raised error, so the card can name the cause instead of the count.
      throw new WorkspaceSyncError(
        'incomplete',
        `Workspace sync stopped at ${monthKey}; re-running it is safe.`,
        counts,
        monthKey,
        error,
      );
    }
    counts.months += 1;
    counts.incomes += merged.counts.incomes;
    counts.variableExpenses += merged.counts.variableExpenses;
    counts.fixedExpenses += merged.counts.fixedExpenses;
    counts.debts += merged.counts.debts;
  }

  if (skippedClosed.length > 0) counts.skippedClosed = skippedClosed;
  return counts;
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
    const firestore = db;
    const ref = doc(firestore, 'users', uid, 'data', 'savings');
    const mutationId = `savings-bootstrap-${crypto.randomUUID()}`;
    const ledgerRef = doc(firestore, 'users', uid, 'ledger', mutationId);
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(ref);
      const revision = snapshot.exists() ? Math.max(0, Number(snapshot.data().revision) || 0) : 0;
      const now = new Date().toISOString();
      transaction.set(ref, cleanUndefined({
        goals,
        revision: revision + 1,
        lastMutationId: mutationId,
        updatedAt: now,
        updatedByUserId: uid,
      }));
      transaction.set(ledgerRef, {
        mutationId,
        actorId: uid,
        workspace: 'personal',
        workspaceId: uid,
        monthKey: 'savings',
        kind: snapshot.exists() ? 'savings' : 'savings-bootstrap',
        baseRevision: revision,
        nextRevision: revision + 1,
        createdAt: now,
      });
    });
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

/**
 * Why a shared-workspace write was refused, from what the browser may read.
 *
 * Firestore returns a bare `permission-denied` with no indication of which
 * clause declined, so the only way to make these reports actionable is to dump
 * the inputs the rules actually consult: the caller, the household's stored
 * sponsor, and whether that sponsor's plan reads as active on this client. If
 * the client thinks it is Pro and the server disagrees, the mismatch is in
 * these fields.
 */
export async function describeHouseholdWriteContext(householdId: string): Promise<Record<string, unknown>> {
  const uid = auth?.currentUser?.uid ?? null;
  const context: Record<string, unknown> = {
    householdId,
    uid,
    emailVerified: auth?.currentUser?.emailVerified ?? null,
  };
  if (!isFirebaseConfigured || !db) return { ...context, firebase: 'not-configured' };
  try {
    const root = await getDoc(doc(db, 'households', householdId));
    context.householdExists = root.exists();
    if (root.exists()) {
      const data = root.data() as Record<string, unknown>;
      context.ownerId = data.ownerId ?? null;
      context.callerIsOwner = data.ownerId === uid;
      // The sponsor chain the rules use: entitlementOwnerId || planOwnerId || ownerId.
      const sponsor = (data.entitlementOwnerId || data.planOwnerId || data.ownerId || '') as string;
      context.sponsorId = sponsor || null;
      context.sponsorIsCaller = Boolean(sponsor) && sponsor === uid;
      context.householdProjection = {
        entitlementOwnerId: data.entitlementOwnerId ?? null,
        entitlementSource: data.entitlementSource ?? null,
        entitlementStatus: data.entitlementStatus ?? null,
        entitlementEndsAtMs: data.entitlementEndsAtMs ?? null,
      };
    }
    if (uid) {
      const member = await getDoc(doc(db, 'households', householdId, 'members', uid));
      context.membership = member.exists()
        ? { role: member.data()?.role ?? null, status: member.data()?.status ?? null }
        : 'missing';
      // `activeProEntitlement()` reads the SPONSOR's profile, which is only
      // readable when the sponsor is the caller. Say so rather than guess.
      const sponsorId = context.sponsorId as string | null;
      if (sponsorId && sponsorId === uid) {
        const profile = await getDoc(doc(db, 'users', uid));
        const p = (profile.data() ?? {}) as Record<string, unknown>;
        context.sponsorProfile = {
          plan: p.plan ?? null,
          entitlementSource: p.entitlementSource ?? null,
          entitlementStatus: p.entitlementStatus ?? null,
          entitlementEndsAtMs: p.entitlementEndsAtMs ?? null,
          endsInFuture: typeof p.entitlementEndsAtMs === 'number'
            ? p.entitlementEndsAtMs > Date.now()
            : null,
        };
      } else {
        context.sponsorProfile = 'unreadable (sponsor is another account)';
      }
    }
  } catch (err) {
    context.diagnosticError = err instanceof Error ? err.message : String(err);
  }
  return context;
}

export async function getMonthBudget(
  uid: string,
  monthKey: string,
  configuration?: MonthConfiguration | null,
): Promise<MonthBudget | null> {
  if (!isFirebaseConfigured || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'months', monthKey));
    if (snap.exists()) {
      return normalizeMonth(snap.data() as MonthBudget, monthKey, configuration);
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
  configuration?: MonthConfiguration | null,
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
      const remote = uid ? await getMonthBudget(uid, mk, configuration) : null;
      if (remote) return { monthKey: mk, month: remote };
      try {
        const local = localStorage.getItem(`flousy_month_${mk}`);
        if (local) return { monthKey: mk, month: normalizeMonth(JSON.parse(local), mk, configuration) };
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

/**
 * Atomically post a completed shopping session into an explicit workspace and
 * budget period. Stable source/expense IDs make retries safe even if the client
 * loses the acknowledgement after Firestore commits.
 */
export async function postCourseSession(input: {
  uid: string;
  sessionId: string;
  target: FinanceTarget;
  monthKey: string;
  category: string;
  place: string;
  configuration?: MonthConfiguration | null;
}): Promise<{ month: MonthBudget; expenseId: string }> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const { uid, sessionId, target, monthKey, category, place, configuration } = input;
  const sessionRef = doc(db, 'users', uid, 'sessions', sessionId);
  const monthRef = target.workspace === 'household'
    ? doc(db, 'households', target.householdId, 'months', monthKey)
    : doc(db, 'users', target.uid, 'months', monthKey);
  const expenseId = `course-${sessionId}`;
  const mutationId = `course-post-${sessionId}`;
  const ledgerRef = target.workspace === 'household'
    ? doc(db, 'households', target.householdId, 'ledger', mutationId)
    : doc(db, 'users', target.uid, 'ledger', mutationId);

  return runTransaction(db, async (transaction) => {
    const [sessionSnapshot, monthSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(monthRef),
      transaction.get(ledgerRef),
    ]);
    if (!sessionSnapshot.exists()) throw new Error('Shopping session no longer exists.');
    const session = sessionSnapshot.data() as CourseSession;
    const remote = monthSnapshot.exists()
      ? normalizeMonth(monthSnapshot.data() as MonthBudget, monthKey, configuration)
      : normalizeMonth({ totalBudget: 0 }, monthKey, configuration);

    if (session.loggedExpenseId) {
      const destinationId = target.workspace === 'household' ? target.householdId : target.uid;
      if (session.loggedExpenseId !== expenseId
        || session.loggedMonthKey !== monthKey
        || session.loggedWorkspace !== target.workspace
        || session.loggedWorkspaceId !== destinationId) {
        throw new Error('This shopping session was already posted to another destination.');
      }
      return { month: remote, expenseId };
    }
    if (remote.periodStatus === 'closed') {
      throw new FinanceConflictError([{ path: 'periodStatus', reason: 'period-closed' }]);
    }
    if (session.status !== 'completed') throw new Error('Finish the shopping session before posting it.');
    if (ledgerSnapshot.exists()) {
      throw new Error('This shopping-session posting ID is already reserved by another transaction.');
    }
    if (!Number.isFinite(session.total) || session.total <= 0) throw new Error('The shopping session total must be positive.');
    if (configuration?.currency && session.currency !== configuration.currency) {
      throw new Error('The session currency does not match the destination workspace.');
    }

    const withExpense = addVariableExpense(remote, {
      id: expenseId,
      name: `Course · ${session.date}`,
      amount: session.total,
      type: category,
      date: session.date,
      place,
      note: `${session.items.length} items`,
      person: 'Self',
      createdByUserId: uid,
      updatedByUserId: uid,
      sourceType: 'course',
      sourceId: sessionId,
    });
    const baseRevision = monthSnapshot.exists() ? Math.max(0, Number(monthSnapshot.data().revision) || 0) : 0;
    const now = new Date().toISOString();
    const next: MonthBudget = {
      ...withExpense,
      schemaVersion: 2,
      revision: baseRevision + 1,
      lastMutationId: mutationId,
      updatedByUserId: uid,
      updatedAt: now,
    };
    transaction.set(ledgerRef, {
      mutationId,
      actorId: uid,
      workspace: target.workspace,
      workspaceId: target.workspace === 'household' ? target.householdId : target.uid,
      monthKey,
      kind: 'course-post',
      sourceId: sessionId,
      baseRevision,
      nextRevision: baseRevision + 1,
      createdAt: now,
    });
    transaction.set(monthRef, cleanUndefined(next));
    transaction.set(sessionRef, {
      loggedExpenseId: expenseId,
      loggedMonthKey: monthKey,
      loggedWorkspace: target.workspace,
      loggedWorkspaceId: target.workspace === 'household' ? target.householdId : target.uid,
      loggedMutationId: mutationId,
      loggedAt: now,
    }, { merge: true });
    return { month: next, expenseId };
  });
}

/** Wipe the course catalog + sessions (used by account deletion). */
async function deleteUserCourseData(uid: string): Promise<void> {
  await deleteCollection('users', uid, 'products');
  await deleteCollection('users', uid, 'sessions');
}

/** Result of the one-time, rules-enforced launch trial claim. */
export type ProTrialClaimResult = 'claimed' | 'active' | 'already_used' | 'unavailable';

/**
 * Start one 90-day Pro launch trial without collecting payment details.
 *
 * Firestore Rules validate the start against server request time, require the
 * end to be exactly 90 days later, and make all entitlement fields immutable to
 * browser clients after this free -> pro transition. A future Stripe or CMI
 * webhook will update the same provider-neutral projection through Admin SDK.
 */
export async function claimProTrial(uid: string): Promise<ProTrialClaimResult> {
  if (!db) return 'unavailable';
  const ref = doc(db, 'users', uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return 'unavailable';

  const profile = snapshot.data() as UserProfile;
  const entitlement = resolveProEntitlement(profile);
  if (entitlement.isPro) return 'active';
  if (entitlement.hasUsedTrial || profile.entitlementSource || profile.plan !== 'free') {
    return 'already_used';
  }

  const startedAtMs = Date.now();
  await setDoc(ref, {
    plan: 'pro',
    entitlementSource: 'launch_trial',
    entitlementStatus: 'trialing',
    entitlementStartedAtMs: startedAtMs,
    entitlementEndsAtMs: startedAtMs + PRO_TRIAL_DURATION_MS,
  } satisfies Partial<UserProfile>, { merge: true });
  return 'claimed';
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

  await run('household invitations', async () => {
    if (!db) return;
    const created = await getDocs(
      query(collection(db, 'householdInvites'), where('createdBy', '==', uid)),
    );
    for (const item of created.docs) await deleteDoc(item.ref);
    if (options.email) {
      const received = await getDocs(
        query(
          collection(db, 'householdInvites'),
          where('email', '==', options.email.toLowerCase()),
          where('status', '==', 'pending'),
        ),
      );
      for (const item of received.docs) {
        if (!created.docs.some((createdItem) => createdItem.id === item.id)) {
          await setDoc(item.ref, { status: 'revoked', revokedAt: new Date().toISOString() }, { merge: true });
        }
      }
    }
  });

  for (const householdId of new Set(options.householdIds ?? [])) {
    await run(`household ${householdId}`, async () => {
      if (!db) return;
      const householdRef = doc(db, 'households', householdId);
      // A stale householdId can point at a workspace this account can no
      // longer read (membership revoked, or the household already deleted).
      // `permission-denied` here means there is nothing left to clean up on
      // our side — treating it as fatal would block profile erasure forever
      // because of a household the account cannot even see.
      let snapshot;
      try {
        snapshot = await getDoc(householdRef);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'permission-denied' || code === 'not-found') return;
        throw err;
      }
      if (!snapshot.exists()) return;
      const value = snapshot.data() as Partial<Household>;
      if (value.ownerId === uid || value.planOwnerId === uid) {
        await deleteHouseholdWorkspace(householdId);
      } else {
        // Leaving someone else's household must never destroy the owner's data.
        await setDoc(
          doc(db, 'households', householdId, 'members', uid),
          { status: 'inactive', retiredAt: new Date().toISOString() },
          { merge: true },
        );
      }
    });
  }



  await run('budget months', () => deleteCollection('users', uid, 'months'));
  await run('savings goals', async () => {
    if (!db) return;
    await deleteDoc(doc(db, 'users', uid, 'data', 'savings'));
  });
  await run('products and sessions', () => deleteUserCourseData(uid));
  await run('finance ledger', () => deleteCollection('users', uid, 'ledger'));
  // The profile is both the retry manifest (household IDs) and the document the
  // UI needs to resume an interrupted erasure. Never remove it after an earlier
  // step failed; otherwise the account survives but no longer knows which
  // shared workspace still needs cleanup.
  if (report.failed.length > 0) return report;
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
  await run('finance ledger', () => deleteCollection('users', uid, 'ledger'));

  return report;
}

// Shared Household workspace -------------------------------------------------
// Household documents are deliberately separate from private user documents.
// This lets rules grant access by membership without exposing a user's profile.
import type { Household, HouseholdInvite, HouseholdMember } from './household';
import { planDocumentMigration, type DocumentMigration } from './schema-migrations';
import { normalizeHousehold } from './household';


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
/**
 * `onData` also receives what the stored document is missing. The caller decides
 * whether it may act on that - only the household's owner can write these fields,
 * and a member must not try - so the plan travels with the data instead of being
 * applied here.
 */
/** Minimal projection used by the workspace switcher for every linked workspace. */
export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: 'household' | 'business';
  ownerId: string;
}

/**
 * Listen to the name/kind of every household the profile links to. Denied or
 * missing documents are dropped silently (a stale `householdIds` entry must
 * not break the switcher); the active workspace keeps its own full listener.
 */
export function subscribeWorkspaceSummaries(
  householdIds: string[],
  onData: (summaries: WorkspaceSummary[]) => void,
) {
  if (!isFirebaseConfigured || !db || householdIds.length === 0) { onData([]); return () => {}; }
  const current = new Map<string, WorkspaceSummary>();
  const emit = () => onData(householdIds.flatMap((id) => (current.has(id) ? [current.get(id)!] : [])));
  const unsubscribes = householdIds.map((id) => onSnapshot(
    doc(db!, 'households', id),
    (snap) => {
      if (!snap.exists()) { current.delete(id); emit(); return; }
      const data = snap.data() as Partial<Household>;
      current.set(id, {
        id,
        name: data.name || 'Household',
        kind: data.kind === 'business' ? 'business' : 'household',
        ownerId: data.ownerId || '',
      });
      emit();
    },
    () => { current.delete(id); emit(); },
  ));
  return () => unsubscribes.forEach((fn) => fn());
}

export function subscribeHousehold(
  householdId: string | undefined,
  onData: (household: Household | null, migration: DocumentMigration | null) => void,
  onAccess: (access: HouseholdAccess) => void = () => {},
) {
  if (!householdId || !isFirebaseConfigured || !db) { onData(null, null); return () => {}; }
  return onSnapshot(
    doc(db, 'households', householdId),
    (snap) => {
      onAccess('ok');
      if (!snap.exists()) { onData(null, null); return; }
      const stored = snap.data() as Partial<Household>;
      // The migration plan is read off the *stored* document, never the normalized
      // one: normalizing first would report every household older than a field as
      // complete, which is exactly the state that gets its writes refused.
      onData(
        normalizeHousehold(snap.id, stored),
        planDocumentMigration('households', stored as Record<string, unknown>),
      );
    },
    (err) => {
      const code = (err as { code?: string })?.code;
      console.error('Error listening to household:', err);
      onAccess(code === 'permission-denied' || code === 'not-found' ? 'denied' : 'unavailable');
    },
  );
}

/**
 * Roster subscription.
 *
 * Listing members is a finance-reader privilege, so a contributor (or a custom
 * member without `members` view) is denied here. That denial must be reported
 * rather than flattened into an empty roster: callers derive the *current
 * user's own role* from this list, and an empty list is indistinguishable from
 * "you have no membership", which downgrades a legitimate member to no
 * permissions at all. `onDenied` lets the caller fall back to the own-row
 * `get`, which the rules always allow.
 */
export function subscribeHouseholdMembers(
  householdId: string | undefined,
  onData: (members: HouseholdMember[]) => void,
  onDenied?: () => void,
) {
  if (!householdId || !isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(
    collection(db, 'households', householdId, 'members'),
    (snap) => onData(snap.docs.map((item) => ({ id: item.id, ...item.data() } as HouseholdMember))),
    (err) => {
      const code = (err as { code?: string })?.code;
      if (code === 'permission-denied') {
        onDenied?.();
        return;
      }
      console.error('Error listening to household members:', err);
      onData([]);
    },
  );
}

export async function createHousehold(ownerId: string, household: Household, owner: HouseholdMember) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const id = crypto.randomUUID();
  const batch = writeBatch(db);
  batch.set(doc(db, 'households', id), cleanUndefined({ ...household, onboardingComplete: false }));
  batch.set(doc(db, 'households', id, 'members', owner.id), cleanUndefined(owner));
  await batch.commit();
  return id;
}

/** Owner teardown: drop members/months/savings/invoices then the household doc. */
export async function deleteHouseholdWorkspace(householdId: string): Promise<void> {
  if (!isFirebaseConfigured || !db) return;
  const actorUid = auth?.currentUser?.uid ?? '';
  const wipe = async (col: string) => {
    if (!db) return;
    const snap = await getDocs(collection(db, 'households', householdId, col));
    for (const item of snap.docs) {
      try {
        await deleteDoc(item.ref);
      } catch (err) {
        // Name the document that was refused. A teardown is dozens of
        // single-document requests and the thrown error says only
        // "permission-denied"; without the path there is no way to tell which
        // rule declined, which is what made this failure undiagnosable.
        console.error(`[household-delete] refused: households/${householdId}/${col}/${item.id}`, err);
        throw err;
      }
    }
  };
  try {
    // Top-level invites reference this household; rules only let the owner
    // delete them while the household root still exists, so they go first —
    // otherwise the teardown would strand pending invites that keep pointing
    // at a deleted workspace.
    //
    // Queried by `createdBy`, NOT by `householdId`. A Firestore query is
    // authorized against `allow list` without reading any document, so the
    // query's own constraints must imply the rule: `allow list` on
    // householdInvites permits `createdBy == request.auth.uid` (or a match on
    // the caller's own email) and has no `householdId` branch at all. Listing
    // by householdId is therefore refused outright — and because this was the
    // FIRST step of the teardown, the whole delete failed before touching a
    // single document, no matter what the rest of the ordering did.
    const inviteSnap = await getDocs(
      query(collection(db, 'householdInvites'), where('createdBy', '==', actorUid)),
    );
    for (const invite of inviteSnap.docs) {
      if (invite.data()?.householdId === householdId) await deleteDoc(invite.ref);
    }
    // Delete nested data while the owner membership still exists, then members,
    // then the household doc. Firestore delete rules cannot inspect incoming().
    //
    // ORDER IS LOAD-BEARING. A ledger row is an audit record that stays
    // immutable while the financial document it describes exists: the rule
    // only permits deleting it once `months/{monthKey}` (or `data/savings`,
    // for a savings row) is already gone. Each delete is its own request, so
    // `existsAfter` reflects what is actually in the database at that moment.
    // Wiping `ledger` before `data/savings` therefore made every savings-kind
    // ledger row permanently undeletable, the teardown threw on the first one,
    // and the workspace could never be removed.
    await wipe('months');
    await wipe('invoices');
    // Deleting a missing document is already a successful no-op in Firestore;
    // any rejection here is a real teardown failure and must keep the owner
    // membership/workspace reachable for a retry.
    await deleteDoc(doc(db, 'households', householdId, 'data', 'savings'));
    // Both financial documents are gone now, so every ledger row is deletable.
    await wipe('ledger');
    await wipe('members');
    await deleteDoc(doc(db, 'households', householdId));
  } catch (err) {
    console.error('[household-delete] teardown failed', {
      householdId,
      code: (err as { code?: string })?.code ?? null,
      context: await describeHouseholdWriteContext(householdId),
    }, err);
    handleFirestoreError(err, OperationType.DELETE, `households/${householdId}`);
  }
}

export async function saveHouseholdMember(householdId: string, member: HouseholdMember) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'members', member.id), cleanUndefined(member), { merge: true });
}

/**
 * The stored membership row of one account, as the database holds it.
 *
 * `get` on `members/{own uid}` is readable even when every other rule in the
 * workspace denies that caller: the published rules allow `memberId ==
 * request.auth.uid` unconditionally. So this is the one fact a locked-out owner
 * can always establish about why they are locked out, and it is established
 * rather than inferred from the roster subscription - which a member with no
 * row cannot list either.
 */
export async function getHouseholdMember(
  householdId: string,
  memberId: string,
): Promise<Record<string, unknown> | null> {
  if (!isFirebaseConfigured || !db) return null;
  const snapshot = await getDoc(doc(db, 'households', householdId, 'members', memberId));
  return snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
}

/**
 * Write the household owner's own membership row, replacing whatever stub is in
 * the way.
 *
 * The published rules refuse an *update* that would promote a row to `owner`
 * (`resource.data.role != 'owner'` guards that branch), so a row written by the
 * onboarding flow as a `profile` placeholder cannot be edited into an owner row
 * from a client. Delete-then-set in one batch is accepted - the delete is allowed
 * for any row that is not already an owner's, and the create branch for a
 * household owner writing their own row needs no entitlement at all - and it is
 * atomic, so a refusal leaves the previous row standing.
 */
export async function writeHouseholdOwnerMembership(
  householdId: string,
  member: HouseholdMember,
  options: { replace?: boolean } = {},
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const ref = doc(db, 'households', householdId, 'members', member.id);
  if (!options.replace) {
    await setDoc(ref, cleanUndefined(member));
    return;
  }
  const batch = writeBatch(db);
  batch.delete(ref);
  batch.set(ref, cleanUndefined(member));
  await batch.commit();
}

export async function saveHousehold(householdId: string, patch: Partial<Household>) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId), cleanUndefined({ ...patch, updatedAt: new Date().toISOString() }), { merge: true });
}

/**
 * Bind a household's plan sponsor - and the readable projection members'
 * clients gate on - to the calling account. `null` becomes `deleteField()`:
 * a projection entry the sponsor's profile no longer carries is as wrong as a
 * missing one, and `householdSponsorBindingValid()` in firestore.rules only
 * accepts the document when every remaining value mirrors this account.
 *
 * This is the in-app recovery for the two states that used to strand a shared
 * budget with a bare 403: a legacy household that never stored
 * `entitlementOwnerId`, and one left behind a sponsor whose plan lapsed.
 */
export async function bindHouseholdSponsor(
  householdId: string,
  patch: {
    entitlementOwnerId: string;
    entitlementSource: string | null;
    entitlementStatus: string | null;
    entitlementEndsAtMs: number | null;
  },
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [key, value] of Object.entries(patch)) {
    data[key] = value === undefined ? deleteField() : value;
  }
  await setDoc(doc(db, 'households', householdId), data, { merge: true });
}

export async function createHouseholdInvite(invite: HouseholdInvite, pendingMember?: HouseholdMember) {
  if (!isFirebaseConfigured || !db) throw new Error('Household collaboration needs Firebase.');
  const batch = writeBatch(db);
  if (pendingMember) {
    batch.set(
      doc(db, 'households', invite.householdId, 'members', pendingMember.id),
      cleanUndefined(pendingMember),
    );
  }
  batch.set(doc(db, 'householdInvites', invite.id), cleanUndefined(invite));
  await batch.commit();
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
  const now = new Date().toISOString();
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'households', invite.householdId, 'members', userId),
    cleanUndefined(member),
    { merge: true },
  );
  batch.set(
    doc(db, 'householdInvites', invite.id),
    {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUserId: userId,
      acceptedEmail: invite.email,
    },
    { merge: true },
  );
  if (invite.memberId && invite.memberId !== userId) {
    batch.set(
      doc(db, 'households', invite.householdId, 'members', invite.memberId),
      cleanUndefined({ status: 'inactive', userId, retiredAt: now }),
      { merge: true },
    );
  }
  // Membership, immutable invite binding and pending-row retirement either all
  // commit or none do. This avoids active members backed by a still-pending code.
  await batch.commit();
}

export function subscribeHouseholdMonthBudget(
  householdId: string,
  monthKey: string,
  onData: (month: MonthBudget | null) => void,
  configuration?: MonthConfiguration | null,
) {
  if (!isFirebaseConfigured || !db) { onData(null); return () => {}; }
  return onSnapshot(
    doc(db, 'households', householdId, 'months', monthKey),
    (snap) => onData(snap.exists() ? normalizeMonth(snap.data() as MonthBudget, monthKey, configuration) : null),
    (err) => {
      console.error('Error listening to household month:', err);
      onData(null);
    },
  );
}
/** Create a household bootstrap/import month; retries never overwrite shared data. */
export async function saveHouseholdMonthBudget(
  householdId: string,
  monthKey: string,
  month: MonthBudget,
): Promise<boolean> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return false;
  const firestore = db;
  const actorId = auth.currentUser.uid;
  const monthRef = doc(firestore, 'households', householdId, 'months', monthKey);
  const mutationId = `bootstrap-${crypto.randomUUID()}`;
  const ledgerRef = doc(firestore, 'households', householdId, 'ledger', mutationId);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(monthRef);
    if (snapshot.exists()) return false;
    const revision = 0;
    const next = {
      ...normalizeMonth(month, monthKey),
      revision: 1,
      lastMutationId: mutationId,
      updatedByUserId: actorId,
      updatedAt: new Date().toISOString(),
    };
    transaction.set(monthRef, cleanUndefined(next));
    transaction.set(ledgerRef, {
      mutationId,
      actorId,
      workspace: 'household',
      workspaceId: householdId,
      monthKey,
      kind: 'bootstrap',
      baseRevision: revision,
      nextRevision: revision + 1,
      createdAt: next.updatedAt,
    });
    return true;
  }).catch(async (err) => {
    // The import writes one of these per personal month. Without the month key
    // and the entitlement inputs, a failure here is a bare permission-denied
    // that says nothing about which document or which clause refused it.
    console.error('[household-month-write] refused', {
      path: `households/${householdId}/months/${monthKey}`,
      mutationId,
      code: (err as { code?: string })?.code ?? null,
      context: await describeHouseholdWriteContext(householdId),
    }, err);
    throw err;
  });
}
export async function getHouseholdMonthBudget(
  householdId: string,
  monthKey: string,
  configuration?: MonthConfiguration | null,
) {
  if (!isFirebaseConfigured || !db) return null;
  const snap = await getDoc(doc(db, 'households', householdId, 'months', monthKey));
  return snap.exists() ? normalizeMonth(snap.data() as MonthBudget, monthKey, configuration) : null;
}
export function subscribeHouseholdSavingsGoals(householdId: string, onData: (goals: SavingGoal[]) => void) {
  if (!isFirebaseConfigured || !db) { onData([]); return () => {}; }
  return onSnapshot(doc(db, 'households', householdId, 'data', 'savings'), (snap) => onData(snap.exists() ? (snap.data().goals || []) : []), (err) => {
    console.error('Error listening to household savings:', err);
    onData([]);
  });
}
async function saveHouseholdSavingsGoals(householdId: string, goals: SavingGoal[]): Promise<boolean> {
  if (!isFirebaseConfigured || !db || !auth?.currentUser) return false;
  const firestore = db;
  const actorId = auth.currentUser.uid;
  const mutationId = `savings-bootstrap-${crypto.randomUUID()}`;
  const ref = doc(firestore, 'households', householdId, 'data', 'savings');
  const ledgerRef = doc(firestore, 'households', householdId, 'ledger', mutationId);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) return false;
    const revision = 0;
    const now = new Date().toISOString();
    transaction.set(ref, cleanUndefined({
      goals,
      revision: revision + 1,
      lastMutationId: mutationId,
      updatedAt: now,
      updatedByUserId: actorId,
    }));
    transaction.set(ledgerRef, {
      mutationId,
      actorId,
      workspace: 'household',
      workspaceId: householdId,
      monthKey: 'savings',
      kind: 'savings-bootstrap',
      baseRevision: revision,
      nextRevision: revision + 1,
      createdAt: now,
    });
    return true;
  });
}
export async function fetchHouseholdMonthsForTrends(
  householdId: string,
  currentKey: string,
  count = 6,
  configuration?: MonthConfiguration | null,
): Promise<{ monthKey: string; month: MonthBudget }[]> {
  const results: { monthKey: string; month: MonthBudget }[] = [];
  const [year, calendarMonth] = currentKey.split('-').map(Number);
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset++) {
    const date = new Date(year, calendarMonth - 1 - offset, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  // Parallel batch — see fetchMonthsForTrends.
  const months = await Promise.all(keys.map((key) => getHouseholdMonthBudget(householdId, key, configuration)));
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
/**
 * A single submitter's own invoices.
 *
 * The rules already permit this (`submitterId == request.auth.uid` on both
 * `get` and `list`) but nothing used it, so a contributor submitted receipts
 * into a void: no pending/approved/rejected state and no way to withdraw a
 * mistake. The `where` clause is required, not an optimisation - it is what
 * makes the query provably safe under the rule.
 */
export function subscribeMyHouseholdInvoices(
  householdId: string,
  submitterId: string,
  onData: (invoices: HouseholdInvoice[]) => void,
) {
  if (!isFirebaseConfigured || !db || !submitterId) { onData([]); return () => {}; }
  return onSnapshot(
    query(
      collection(db, 'households', householdId, 'invoices'),
      where('submitterId', '==', submitterId),
      limit(200),
    ),
    (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HouseholdInvoice))),
    (err) => {
      console.error('Error listening to own household invoices:', err);
      onData([]);
    },
  );
}

/** Withdraw an own submission. Rules allow it only while `status == 'submitted'`. */
export async function withdrawHouseholdInvoice(householdId: string, invoiceId: string) {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  await deleteDoc(doc(db, 'households', householdId, 'invoices', invoiceId));
}

export async function saveHouseholdInvoice(householdId: string, invoice: HouseholdInvoice) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'households', householdId, 'invoices', invoice.id), cleanUndefined(invoice));
}

export async function reviewHouseholdInvoice(
  householdId: string,
  invoiceId: string,
  decision: 'rejected',
  reviewerId: string,
): Promise<void> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  await setDoc(doc(db, 'households', householdId, 'invoices', invoiceId), {
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedByUserId: reviewerId,
  }, { merge: true });
}

/** Approve and post the matching expense atomically, with deterministic IDs. */
export async function approveHouseholdInvoice(
  householdId: string,
  invoiceId: string,
  monthKey: string,
  reviewerId: string,
  configuration?: MonthConfiguration | null,
): Promise<MonthBudget> {
  if (!isFirebaseConfigured || !db) throw new Error('Firebase is not configured.');
  const invoiceRef = doc(db, 'households', householdId, 'invoices', invoiceId);
  const monthRef = doc(db, 'households', householdId, 'months', monthKey);
  const mutationId = `invoice-approval-${invoiceId}`;
  const ledgerRef = doc(db, 'households', householdId, 'ledger', mutationId);

  return runTransaction(db, async (transaction) => {
    const [invoiceSnapshot, monthSnapshot, ledgerSnapshot] = await Promise.all([
      transaction.get(invoiceRef),
      transaction.get(monthRef),
      transaction.get(ledgerRef),
    ]);
    if (!invoiceSnapshot.exists()) throw new Error('Invoice no longer exists.');
    const invoice = { id: invoiceSnapshot.id, ...invoiceSnapshot.data() } as HouseholdInvoice;
    if (invoice.status === 'approved' && invoice.postedExpenseId === `invoice-${invoiceId}`) {
      return monthSnapshot.exists()
        ? normalizeMonth(monthSnapshot.data() as MonthBudget, monthKey, configuration)
        : normalizeMonth({ totalBudget: 0 }, monthKey, configuration);
    }
    if (invoice.status !== 'submitted') throw new Error('Invoice has already been reviewed.');
    if (ledgerSnapshot.exists()) {
      throw new Error('This invoice approval ID is already reserved by another transaction.');
    }

    const remote = monthSnapshot.exists()
      ? normalizeMonth(monthSnapshot.data() as MonthBudget, monthKey, configuration)
      : normalizeMonth({ totalBudget: 0 }, monthKey, configuration);
    if (remote.periodStatus === 'closed') {
      throw new FinanceConflictError([{ path: 'periodStatus', reason: 'period-closed' }]);
    }
    const expenseId = `invoice-${invoiceId}`;
    const withExpense = addVariableExpense(remote, {
      id: expenseId,
      name: invoice.name,
      amount: invoice.amount,
      type: invoice.category,
      date: invoice.date,
      place: invoice.place || 'bank',
      note: invoice.note,
      person: invoice.payerMemberId,
      payerMemberId: invoice.payerMemberId,
      createdByUserId: invoice.submitterId,
      updatedByUserId: reviewerId,
      receiptUrl: invoice.receiptUrl,
      sourceType: 'invoice',
      sourceId: invoiceId,
    });
    const baseRevision = monthSnapshot.exists() ? Math.max(0, Number(monthSnapshot.data().revision) || 0) : 0;
    const now = new Date().toISOString();
    const next: MonthBudget = {
      ...withExpense,
      schemaVersion: 2,
      revision: baseRevision + 1,
      lastMutationId: mutationId,
      updatedByUserId: reviewerId,
      updatedAt: now,
    };
    transaction.set(ledgerRef, {
      mutationId,
      actorId: reviewerId,
      workspace: 'household',
      workspaceId: householdId,
      monthKey,
      kind: 'invoice-approval',
      sourceId: invoiceId,
      baseRevision,
      nextRevision: baseRevision + 1,
      createdAt: now,
    });
    transaction.set(monthRef, cleanUndefined(next));
    transaction.set(invoiceRef, {
      status: 'approved',
      reviewedAt: now,
      reviewedByUserId: reviewerId,
      postedExpenseId: expenseId,
      postedMonthKey: monthKey,
    }, { merge: true });
    return next;
  });
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
