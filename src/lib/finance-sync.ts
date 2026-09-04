import type { MonthBudget, SavingGoal } from './store';

export type FinanceSyncState = 'saved' | 'pending' | 'failed' | 'conflict' | 'local';
export type FinanceWorkspace = 'personal' | 'household';

/**
 * Plan which queued mutations a flush may attempt.
 *
 * A mutation marked 'conflict' cannot commit until the user reviews it, and
 * later mutations for the SAME month build on its local state, so they must
 * wait with it. Mutations for OTHER months are independent: one stuck
 * conflict used to abort the whole flush at the queue head, silently
 * blocking every new edit in the workspace (queued forever behind an item
 * that can never commit).
 */
export function planFlushAttempts<T extends { monthKey: string; lastError?: string }>(
  mutations: T[],
): { attempt: T[]; reviewMonths: string[] } {
  const conflictedMonths = new Set<string>();
  const attempt: T[] = [];
  for (const mutation of mutations) {
    if (mutation.lastError === 'conflict') {
      conflictedMonths.add(mutation.monthKey);
      continue;
    }
    if (conflictedMonths.has(mutation.monthKey)) continue;
    attempt.push(mutation);
  }
  return { attempt, reviewMonths: [...conflictedMonths] };
}

export interface FinanceMutation {
  version: 1;
  id: string;
  actorId: string;
  workspace: FinanceWorkspace;
  workspaceId: string;
  monthKey: string;
  baseMonth: MonthBudget;
  nextMonth: MonthBudget;
  baseGoals?: SavingGoal[];
  nextGoals?: SavingGoal[];
  /** Explicit period-state operations are distinguished from ordinary edits. */
  intent?: 'finance' | 'close-period' | 'reopen-period';
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface MergeConflict {
  path: string;
  reason: 'changed-remotely' | 'insufficient-funds' | 'period-closed';
}

export class FinanceConflictError extends Error {
  constructor(public readonly conflicts: MergeConflict[]) {
    super(`Finance data changed elsewhere (${conflicts.map((item) => item.path).join(', ')}).`);
    this.name = 'FinanceConflictError';
  }
}

/** Decide whether an outbox operation may run against the latest period state. */
export function resolvePeriodMutation(
  remoteMonth: Pick<MonthBudget, 'periodStatus'>,
  intent: FinanceMutation['intent'] = 'finance',
): 'proceed' | 'already-satisfied' {
  if (remoteMonth.periodStatus === 'closed') {
    if (intent === 'close-period') return 'already-satisfied';
    if (intent !== 'reopen-period') {
      throw new FinanceConflictError([{ path: 'periodStatus', reason: 'period-closed' }]);
    }
  } else if (intent === 'reopen-period') {
    return 'already-satisfied';
  }
  return 'proceed';
}

const ARRAY_FIELDS = new Set([
  'incomeSources',
  'variableExpenses',
  'fixedExpenses',
  'debts',
  'savingsActivity',
  'transfers',
  'balanceAdjustments',
]);
const MONEY_BALANCE_FIELDS = new Set(['bankPart', 'homePart', 'walletPart']);
const MERGE_MAP_FIELDS = new Set([
  'placeBalances',
  'variableCategoryBases',
  'fixedCategoryBases',
  'categoryBudgets',
  'rolloverFromPrevious',
  'categoryColors',
  'categoryIcons',
]);
const IGNORED_FIELDS = new Set(['updatedAt', 'updatedByUserId', 'revision', 'lastMutationId']);

/**
 * Content equality, deliberately not textual equality.
 *
 * Firestore hands back a document's fields in its own order, while a record the
 * user added a moment ago is still in the order this app built it. Compared as
 * `JSON.stringify` text, those two are different strings for identical content -
 * and the merge only accepts a deletion when the cloud's copy still matches the
 * base it started from. So deleting or editing anything that had been added in
 * this session read as a clash with another device: "Changes need review" for a
 * change nobody else made, on a single device, with the queue stuck behind it.
 *
 * Values are therefore compared as what they mean: maps by name and value in any
 * order, arrays elementwise, and an absent key equal to a key holding `undefined`
 * - which is exactly how the document stores it, since the writer drops
 * `undefined` before the write.
 */
const ABSENT = Symbol('absent');

/** A key that is not there and a key holding `undefined` are one thing: no value. */
function valueAt(record: Record<string, unknown>, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) return ABSENT;
  return record[key] === undefined ? ABSENT : record[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => equal(item, right[index]));
  }
  if (isRecord(left) && isRecord(right)) {
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (!equal(valueAt(left, key), valueAt(right, key))) return false;
    }
    return true;
  }
  return false;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mergeIdArray(
  path: string,
  baseValue: unknown,
  localValue: unknown,
  remoteValue: unknown,
  conflicts: MergeConflict[],
): unknown[] {
  const base = Array.isArray(baseValue) ? baseValue : [];
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const isEntityList = [...base, ...local, ...remote].every(
    (item) => item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string',
  );
  if (!isEntityList) {
    if (equal(remote, base) || equal(remote, local)) return local;
    conflicts.push({ path, reason: 'changed-remotely' });
    return remote;
  }

  type Entity = Record<string, unknown> & { id: string };
  const baseMap = new Map((base as Entity[]).map((item) => [item.id, item]));
  const localMap = new Map((local as Entity[]).map((item) => [item.id, item]));
  const remoteMap = new Map((remote as Entity[]).map((item) => [item.id, item]));
  const merged = new Map(remoteMap);

  for (const [id, baseItem] of baseMap) {
    const localItem = localMap.get(id);
    const remoteItem = remoteMap.get(id);
    if (!localItem) {
      if (!remoteItem) continue;
      if (equal(remoteItem, baseItem)) merged.delete(id);
      else conflicts.push({ path: `${path}.${id}`, reason: 'changed-remotely' });
      continue;
    }
    if (equal(localItem, baseItem)) continue;
    if (!remoteItem || equal(remoteItem, baseItem) || equal(remoteItem, localItem)) {
      merged.set(id, localItem);
    } else {
      conflicts.push({ path: `${path}.${id}`, reason: 'changed-remotely' });
    }
  }

  const localAdditions: Entity[] = [];
  for (const localItem of local as Entity[]) {
    if (baseMap.has(localItem.id)) continue;
    const remoteItem = remoteMap.get(localItem.id);
    if (!remoteItem) {
      merged.set(localItem.id, localItem);
      localAdditions.push(localItem);
    } else if (!equal(remoteItem, localItem)) {
      conflicts.push({ path: `${path}.${localItem.id}`, reason: 'changed-remotely' });
    }
  }

  // Preserve the cloud's ordering for existing rows and the local ordering for
  // newly prepended records (expenses/activity use newest-first ordering).
  const additionIds = new Set(localAdditions.map((item) => item.id));
  return [
    ...localAdditions,
    ...(remote as Entity[])
      .filter((item) => merged.has(item.id) && !additionIds.has(item.id))
      .map((item) => merged.get(item.id)!),
    ...[...merged.values()].filter(
      (item) => !additionIds.has(item.id) && !(remote as Entity[]).some((remoteItem) => remoteItem.id === item.id),
    ),
  ];
}

function mergeMap(
  path: string,
  baseValue: unknown,
  localValue: unknown,
  remoteValue: unknown,
  conflicts: MergeConflict[],
): Record<string, unknown> {
  const base = objectValue(baseValue);
  const local = objectValue(localValue);
  const remote = objectValue(remoteValue);
  const merged = { ...remote };
  const keys = new Set([...Object.keys(base), ...Object.keys(local)]);
  for (const key of keys) {
    const baseItem = base[key];
    const localHas = Object.prototype.hasOwnProperty.call(local, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remote, key);
    const localItem = local[key];
    const remoteItem = remote[key];
    if (localHas === Object.prototype.hasOwnProperty.call(base, key) && equal(localItem, baseItem)) continue;

    if (path === 'placeBalances' && typeof baseItem === 'number' && typeof localItem === 'number') {
      const remoteBalance = typeof remoteItem === 'number' ? remoteItem : 0;
      const composed = Math.round((remoteBalance + localItem - baseItem) * 100) / 100;
      if (composed < 0) conflicts.push({ path: `${path}.${key}`, reason: 'insufficient-funds' });
      else merged[key] = composed;
      continue;
    }

    if ((!remoteHas && !Object.prototype.hasOwnProperty.call(base, key)) || equal(remoteItem, baseItem) || equal(remoteItem, localItem)) {
      if (localHas) merged[key] = localItem;
      else delete merged[key];
    } else {
      conflicts.push({ path: `${path}.${key}`, reason: 'changed-remotely' });
    }
  }
  return merged;
}

/**
 * Three-way merge one optimistic mutation onto the newest cloud snapshot.
 * Independent entity edits and cash deltas compose; edits to the same entity
 * stop with an explicit conflict instead of silently overwriting either side.
 */
export function mergeMonthMutation(
  baseMonth: MonthBudget,
  localMonth: MonthBudget,
  remoteMonth: MonthBudget,
): MonthBudget {
  const base = baseMonth as unknown as Record<string, unknown>;
  const local = localMonth as unknown as Record<string, unknown>;
  const remote = remoteMonth as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...remote };
  const conflicts: MergeConflict[] = [];
  const keys = new Set([...Object.keys(base), ...Object.keys(local)]);

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key) || equal(local[key], base[key])) continue;
    if (MONEY_BALANCE_FIELDS.has(key)) {
      const baseBalance = typeof base[key] === 'number' ? base[key] as number : 0;
      const localBalance = typeof local[key] === 'number' ? local[key] as number : 0;
      const remoteBalance = typeof remote[key] === 'number' ? remote[key] as number : 0;
      const composed = Math.round((remoteBalance + localBalance - baseBalance) * 100) / 100;
      if (composed < 0) conflicts.push({ path: key, reason: 'insufficient-funds' });
      else merged[key] = composed;
      continue;
    }
    if (ARRAY_FIELDS.has(key)) {
      merged[key] = mergeIdArray(key, base[key], local[key], remote[key], conflicts);
      continue;
    }
    if (MERGE_MAP_FIELDS.has(key)) {
      merged[key] = mergeMap(key, base[key], local[key], remote[key], conflicts);
      continue;
    }

    if (equal(remote[key], base[key]) || equal(remote[key], local[key])) {
      if (Object.prototype.hasOwnProperty.call(local, key)) merged[key] = local[key];
      else delete merged[key];
    } else {
      conflicts.push({ path: key, reason: 'changed-remotely' });
    }
  }

  if (conflicts.length > 0) throw new FinanceConflictError(conflicts);
  return {
    ...(merged as unknown as MonthBudget),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeGoalsMutation(
  baseGoals: SavingGoal[],
  localGoals: SavingGoal[],
  remoteGoals: SavingGoal[],
): SavingGoal[] {
  const conflicts: MergeConflict[] = [];
  const merged = mergeIdArray('goals', baseGoals, localGoals, remoteGoals, conflicts) as SavingGoal[];
  if (conflicts.length > 0) throw new FinanceConflictError(conflicts);
  return merged;
}

const DB_NAME = 'flousy-finance-outbox';
const STORE_NAME = 'mutations';
const DB_VERSION = 1;
const fallback = new Map<string, FinanceMutation>();

function openOutbox(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the finance outbox.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
): Promise<T> {
  const database = await openOutbox();
  if (!database) {
    return new Promise<T>((resolve, reject) => work({} as IDBObjectStore, resolve, reject));
  }
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    work(store, resolve, reject);
    transaction.onerror = () => reject(transaction.error || new Error('Finance outbox transaction failed.'));
    transaction.oncomplete = () => database.close();
  });
}

export async function putFinanceMutation(mutation: FinanceMutation): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    fallback.set(mutation.id, structuredClone(mutation));
    return;
  }
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(mutation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function removeFinanceMutation(id: string): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    fallback.delete(id);
    return;
  }
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listFinanceMutations(filter?: {
  actorId?: string;
  workspace?: FinanceWorkspace;
  workspaceId?: string;
  monthKey?: string;
}): Promise<FinanceMutation[]> {
  let mutations: FinanceMutation[];
  if (typeof indexedDB === 'undefined') {
    mutations = [...fallback.values()].map((item) => structuredClone(item));
  } else {
    mutations = await withStore<FinanceMutation[]>('readonly', (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as FinanceMutation[]);
      request.onerror = () => reject(request.error);
    });
  }
  return mutations
    .filter((mutation) =>
      (!filter?.actorId || mutation.actorId === filter.actorId)
      && (!filter?.workspace || mutation.workspace === filter.workspace)
      && (!filter?.workspaceId || mutation.workspaceId === filter.workspaceId)
      && (!filter?.monthKey || mutation.monthKey === filter.monthKey))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function clearFinanceOutbox(): Promise<void> {
  fallback.clear();
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export function newFinanceMutationId(): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `mutation-${id}`;
}
