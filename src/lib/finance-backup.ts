import type { CourseSession, MonthBudget, Product, SavingGoal, UserProfile } from './store';
import type { Household } from './household';
import { isSmartJibCsvExport } from './csv-import';

export const FINANCE_BACKUP_FORMAT = 'smartjib-finance-backup' as const;
export const FINANCE_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

/**
 * Conservative per-month ceiling, below Firestore's 1 MiB document limit.
 * A month that cannot fit in one document can never be restored truthfully,
 * so it is rejected before the first write instead of failing mid-restore.
 */
export const MAX_MONTH_BACKUP_BYTES = 900 * 1024;

/** Collection cardinality mirrors of the Firestore Rules contract. */
const LIMITS = {
  months: 600,
  goals: 200,
  products: 2000,
  sessions: 200,
  variableExpenses: 2000,
  fixedExpenses: 500,
  debts: 500,
  debtPayments: 500,
  transfers: 500,
  adjustments: 500,
  savingsActivity: 200,
  sessionItems: 500,
  incomeSources: 100,
  mapEntries: 200,
} as const;

/** Firestore Rules' isMoney(): finite, non-negative, at most 1e9. */
const MAX_MONEY = 1_000_000_000;

/** Finance-only profile/household configuration keys a backup may carry. */
const CONFIG_ALLOWED_KEYS = [
  'theme', 'language', 'currency', 'monthStartDate',
  'defaultCategoryBudgets', 'defaultCategoryEnvelopes', 'enableRollover',
  'fixedCategories', 'moneyPlaces', 'activeCategories',
  'categoryColors', 'categoryIcons',
] as const;

/** Every key a restored month document may carry (mirrors MonthBudget). */
const MONTH_ALLOWED_KEYS = [
  'schemaVersion', 'revision', 'lastMutationId', 'periodKey', 'periodStartDay',
  'periodStartDate', 'periodEndDate', 'currency', 'periodStatus', 'closedAt',
  'closedByUserId', 'totalBudget', 'incomeSources', 'bankPart', 'homePart',
  'walletPart', 'placeBalances', 'strategyId', 'customRatios',
  'categoryEnvelopes', 'monthlySavingsTarget', 'variableExpenses',
  'fixedExpenses', 'variableCategoryBases', 'fixedCategoryBases',
  'categoryBudgets', 'rolloverFromPrevious', 'activeCategories',
  'categoryColors', 'categoryIcons', 'debts', 'transfers',
  'balanceAdjustments', 'savingsActivity', 'updatedAt', 'updatedByUserId',
] as const;

const STRATEGIES = ['50-30-20', '70-20-10', '80-20', 'zero-based', 'envelope', 'pay-first', 'custom'] as const;
const LIFECYCLE = ['planned', 'partial', 'paid', 'skipped'] as const;
const ADJUSTMENT_REASONS = ['reconciliation', 'opening-balance', 'income'] as const;
const PRODUCT_SOURCES = ['manual', 'off', 'session'] as const;
const SESSION_STATUS = ['active', 'completed'] as const;
const EXPENSE_SOURCE_TYPES = ['invoice', 'course', 'csv', 'manual'] as const;
const FIXED_SOURCE_TYPES = ['invoice', 'csv', 'manual'] as const;

/**
 * What a file asked us to forgive. A backup is the user's own data, written by
 * whatever build of the app they had at the time and often re-opened in another
 * account, so the parser completes and trims instead of refusing: every
 * concession is reported, because a restore that quietly dropped part of a
 * period is worse than one that said so.
 */
export type BackupNoticeCode =
  | 'unrecognizedFields'
  | 'completedFields'
  | 'generatedIds'
  | 'recalculatedTotals'
  | 'reopenedPeriods'
  | 'newerVersion'
  | 'unmarkedFile';

export interface BackupNotice {
  code: BackupNoticeCode;
  count: number;
  /** Field or period names involved, capped so a dialog stays readable. */
  fields?: string[];
}

class BackupReport {
  private readonly entries = new Map<BackupNoticeCode, { count: number; fields: Set<string> }>();

  note(code: BackupNoticeCode, field?: string): void {
    const entry = this.entries.get(code) ?? { count: 0, fields: new Set<string>() };
    entry.count += 1;
    if (field) entry.fields.add(field);
    this.entries.set(code, entry);
  }

  notices(): BackupNotice[] {
    return [...this.entries.entries()].map(([code, { count, fields }]) => ({
      code,
      count,
      ...(fields.size ? { fields: [...fields].slice(0, 6) } : {}),
    }));
  }
}

/**
 * Bound for the duration of one synchronous `readFinanceBackup` call. The helpers
 * below are shared by every parser and would otherwise each thread a report
 * through their signature; parsing is synchronous, so calls cannot interleave.
 */
let activeReport: BackupReport | null = null;
/** Timestamp a file omits: the moment it was written, not the moment it is read. */
let fileTimestamp = '1970-01-01T00:00:00.000Z';

function note(code: BackupNoticeCode, field?: string): void {
  activeReport?.note(code, field);
}

export interface FinanceBackup {
  format: typeof FINANCE_BACKUP_FORMAT;
  version: typeof FINANCE_BACKUP_VERSION;
  id: string;
  exportedAt: string;
  /** `unknown` for a file that does not say - which still restores. */
  workspace: { type: 'personal' | 'household' | 'unknown'; id: string; name?: string };
  configuration: Partial<UserProfile> | Partial<Household>;
  months: Record<string, MonthBudget>;
  goals: SavingGoal[];
  products?: Product[];
  sessions?: CourseSession[];
}

/** Why the file *as a whole* could not be used, as opposed to one field inside it. */
export type FinanceBackupRefusal = 'emptyFile' | 'notJson' | 'csvReport' | 'unreadable';

export class InvalidFinanceBackupError extends Error {
  /**
   * Set for a file-level refusal so the UI can name it in the user's language
   * instead of quoting this library's English text at them.
   */
  readonly refusal?: FinanceBackupRefusal;

  constructor(message: string, refusal?: FinanceBackupRefusal) {
    super(message);
    this.name = 'InvalidFinanceBackupError';
    this.refusal = refusal;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeBackupId(value: unknown): string {
  const id = typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) : '';
  return id || `backup-${Date.now()}`;
}

function text(value: unknown, field: string, max: number, { min = 1 } = {}): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new InvalidFinanceBackupError(`${field} must be a string of up to ${max} characters.`);
  }
  return value;
}

/** Mirrors Firestore Rules' isMoney(): finite, non-negative, ≤ 1e9, cent-rounded. */
function money(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_MONEY) {
    throw new InvalidFinanceBackupError(`${field} must be a finite amount between 0 and ${MAX_MONEY}.`);
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Signed variant for reconciliation deltas (an adjustment may lower a balance). */
function signedMoney(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_MONEY) {
    throw new InvalidFinanceBackupError(`${field} must be a finite amount between -${MAX_MONEY} and ${MAX_MONEY}.`);
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calendarDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidFinanceBackupError(`${field} must use YYYY-MM-DD.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new InvalidFinanceBackupError(`${field} is not a valid calendar date.`);
  }
  return value;
}

function isoTimestamp(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvalidFinanceBackupError(`${field} must be an ISO timestamp.`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new InvalidFinanceBackupError(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}
/**
 * A value this build does not recognise in a field that only selects a default -
 * a strategy preset, a product source - is completed rather than fatal: the
 * record around it is real data, and refusing a whole period over a label a newer
 * app invented would lock the file out of the account that still needs it.
 */
function enumValueOr<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof value === 'string' && allowed.includes(value as T)) return value as T;
  if (value !== undefined && value !== null) note('unrecognizedFields', field);
  return fallback;
}
/** An enum a record may leave out; an unreadable value is defaulted and reported. */
function optionalEnumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  fallback: T,
): T | undefined {
  return value === undefined || value === null ? undefined : enumValueOr(value, field, allowed, fallback);
}
function moneyOr(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  return money(value, field);
}
/** Position of an entry inside the array it came from, read off its field path. */
function entryIndex(field: string): number {
  const match = /\[(\d+)\]$/.exec(field);
  return match ? Number(match[1]) : 0;
}
/**
 * An id a record has to carry to be addressable. A missing one is generated from
 * the entry's position, so restoring the same file twice reaches the same record
 * instead of duplicating it; a present-but-unusable one stays an error.
 */
function identifier(value: unknown, field: string, kind: string): string {
  if (typeof value === 'string' && value.length > 0 && value.length <= 160) return value;
  if (value !== undefined && value !== null) {
    throw new InvalidFinanceBackupError(`${field} must be a string of up to 160 characters.`);
  }
  note('generatedIds', field);
  return `backup-${kind}-${entryIndex(field)}`;
}

function optional<T>(value: unknown, field: string, parse: (v: unknown, f: string) => T): T | undefined {
  return value === undefined || value === null ? undefined : parse(value, field);
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  return value === undefined || value === null ? undefined : text(value, field, max, { min: 0 });
}

/**
 * Strip keys this build does not know, so a restored document can never carry an
 * extra field into Firestore. Dropping them - rather than rejecting the record -
 * is what lets a file written by a newer app restore into an older account, and
 * the names are reported so the user learns that something was not understood.
 */
function assertKnownKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  for (const key of Object.keys(source)) {
    if (!allowed.includes(key)) {
      note('unrecognizedFields', `${field}.${key}`);
      delete source[key];
    }
  }
}

function moneyMap(value: unknown, field: string): Record<string, number> {
  if (!isObject(value)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  const entries = Object.entries(value);
  if (entries.length > LIMITS.mapEntries) {
    throw new InvalidFinanceBackupError(`${field} exceeds ${LIMITS.mapEntries} entries.`);
  }
  const result: Record<string, number> = {};
  for (const [key, raw] of entries) {
    result[text(key, `${field} name`, 100, { min: 0 })] = money(raw, `${field}[${key}]`);
  }
  return result;
}

function textMap(value: unknown, field: string, maxValueLength: number): Record<string, string> {
  if (!isObject(value)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  const entries = Object.entries(value);
  if (entries.length > LIMITS.mapEntries) {
    throw new InvalidFinanceBackupError(`${field} exceeds ${LIMITS.mapEntries} entries.`);
  }
  const result: Record<string, string> = {};
  for (const [key, raw] of entries) {
    result[text(key, `${field} name`, 100, { min: 0 })] = text(raw, `${field}[${key}]`, maxValueLength, { min: 0 });
  }
  return result;
}

function stringArray(value: unknown, field: string, max: number): string[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new InvalidFinanceBackupError(`${field} must be an array of at most ${max} entries.`);
  }
  return value.map((entry, index) => text(entry, `${field}[${index}]`, 100, { min: 0 }));
}

function envelopeMap(value: unknown, field: string): Record<string, 'needs' | 'wants' | 'savings'> {
  if (!isObject(value)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  const result: Record<string, 'needs' | 'wants' | 'savings'> = {};
  for (const [key, raw] of Object.entries(value).slice(0, LIMITS.mapEntries)) {
    result[text(key, `${field} name`, 100, { min: 0 })] = enumValue(raw, `${field}[${key}]`, ['needs', 'wants', 'savings'] as const);
  }
  return result;
}

/** No two entries of one collection may share an id (replay safety). */
function assertUniqueKeys(items: Array<Record<string, unknown>>, keyField: string, field: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    const id = typeof item[keyField] === 'string' ? (item[keyField] as string) : '';
    if (!id) throw new InvalidFinanceBackupError(`${field} entry is missing ${keyField === 'id' ? 'an' : 'a'} ${keyField}.`);
    if (seen.has(id)) throw new InvalidFinanceBackupError(`${field} contains a duplicate ${keyField}: ${id}.`);
    seen.add(id);
  }
}

function entities<T>(
  value: unknown,
  field: string,
  max: number,
  parse: (raw: unknown, field: string) => T,
  keyField = 'id',
): T[] {
  if (!Array.isArray(value) || value.length > max) {
    throw new InvalidFinanceBackupError(`${field} must be an array of at most ${max} entries.`);
  }
  const parsed = value.map((entry, index) => parse(entry, `${field}[${index}]`));
  assertUniqueKeys(parsed as Array<Record<string, unknown>>, keyField, field);
  return parsed;
}

function dayOfMonth(value: unknown, field: string): number {
  const day = typeof value === 'number' ? Math.round(value) : NaN;
  if (!Number.isFinite(value) || day < 1 || day > 31) {
    throw new InvalidFinanceBackupError(`${field} must be a day of the month (1-31).`);
  }
  return day;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ── Nested month entity validators ───────────────────────────────────── */

/**
 * Lifecycle money semantics shared by income sources and fixed charges:
 * an explicitly stored progress amount may never exceed the expected amount,
 * and planned/skipped records carry no progress at all. When absent, the
 * default mirrors normalizeMonth(): paid records imply their full amount.
 */
function lifecycleProgress(
  rawProgress: unknown,
  amount: number,
  status: string,
  field: string,
): number {
  if (rawProgress === undefined || rawProgress === null) {
    return status === 'paid' ? amount : 0;
  }
  const progress = money(rawProgress, field);
  if (progress > amount) {
    throw new InvalidFinanceBackupError(`${field} cannot exceed the expected amount.`);
  }
  if ((status === 'planned' || status === 'skipped') && progress > 0) {
    throw new InvalidFinanceBackupError(`${field} records progress on a ${status} record.`);
  }
  return progress;
}

function parseIncomeSource(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'name', 'amount', 'status', 'receivedAmount', 'receivedAt', 'recurring',
    'templateId', 'category', 'payDay',
  ], field);
  const amount = money(raw.amount, `${field}.amount`);
  const status = enumValue(raw.status ?? 'paid', `${field}.status`, LIFECYCLE);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    name: text(raw.name, `${field}.name`, 60),
    amount,
    status,
    receivedAmount: lifecycleProgress(raw.receivedAmount, amount, status, `${field}.receivedAmount`),
    ...(optionalString(raw.receivedAt, `${field}.receivedAt`, 40) ? { receivedAt: raw.receivedAt as string } : {}),
    ...(raw.recurring !== undefined ? { recurring: Boolean(raw.recurring) } : {}),
    ...(raw.templateId !== undefined ? { templateId: text(raw.templateId, `${field}.templateId`, 160) } : {}),
    ...(raw.category !== undefined ? { category: text(raw.category, `${field}.category`, 100) } : {}),
    ...(raw.payDay !== undefined ? { payDay: dayOfMonth(raw.payDay, `${field}.payDay`) } : {}),
  };
}

function parseVariableExpense(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'name', 'amount', 'type', 'date', 'place', 'note', 'person',
    'payerMemberId', 'createdByUserId', 'updatedByUserId', 'tags', 'receiptUrl',
    'sourceType', 'sourceId', 'importFingerprint',
  ], field);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    name: text(raw.name, `${field}.name`, 100),
    amount: money(raw.amount, `${field}.amount`),
    type: text(raw.type, `${field}.type`, 100),
    date: calendarDate(raw.date, `${field}.date`),
    place: text(raw.place, `${field}.place`, 80, { min: 0 }),
    ...(optionalString(raw.note, `${field}.note`, 500) ? { note: raw.note as string } : {}),
    ...(optionalString(raw.person, `${field}.person`, 120) ? { person: raw.person as string } : {}),
    ...(optionalString(raw.payerMemberId, `${field}.payerMemberId`, 160) ? { payerMemberId: raw.payerMemberId as string } : {}),
    ...(optionalString(raw.createdByUserId, `${field}.createdByUserId`, 160) ? { createdByUserId: raw.createdByUserId as string } : {}),
    ...(optionalString(raw.updatedByUserId, `${field}.updatedByUserId`, 160) ? { updatedByUserId: raw.updatedByUserId as string } : {}),
    ...(raw.tags !== undefined ? { tags: stringArray(raw.tags, `${field}.tags`, 20) } : {}),
    ...(optionalString(raw.receiptUrl, `${field}.receiptUrl`, 150_000) ? { receiptUrl: raw.receiptUrl as string } : {}),
    ...(raw.sourceType !== undefined ? { sourceType: enumValue(raw.sourceType, `${field}.sourceType`, EXPENSE_SOURCE_TYPES) } : {}),
    ...(optionalString(raw.sourceId, `${field}.sourceId`, 160) ? { sourceId: raw.sourceId as string } : {}),
    ...(optionalString(raw.importFingerprint, `${field}.importFingerprint`, 160) ? { importFingerprint: raw.importFingerprint as string } : {}),
  };
}

function parseFixedExpense(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'name', 'amount', 'type', 'date', 'place', 'base', 'person',
    'payerMemberId', 'createdByUserId', 'updatedByUserId', 'recurring',
    'templateId', 'status', 'paidAmount', 'paidAt', 'receiptUrl',
    'sourceType', 'sourceId', 'importFingerprint',
  ], field);
  const amount = money(raw.amount, `${field}.amount`);
  const status = enumValue(raw.status ?? 'paid', `${field}.status`, LIFECYCLE);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    name: text(raw.name, `${field}.name`, 100),
    amount,
    type: text(raw.type, `${field}.type`, 100),
    ...(optionalString(raw.date, `${field}.date`, 20) ? { date: raw.date as string } : {}),
    place: text(raw.place, `${field}.place`, 80, { min: 0 }),
    ...(raw.base !== undefined ? { base: money(raw.base, `${field}.base`) } : {}),
    ...(optionalString(raw.person, `${field}.person`, 120) ? { person: raw.person as string } : {}),
    ...(optionalString(raw.payerMemberId, `${field}.payerMemberId`, 160) ? { payerMemberId: raw.payerMemberId as string } : {}),
    ...(optionalString(raw.createdByUserId, `${field}.createdByUserId`, 160) ? { createdByUserId: raw.createdByUserId as string } : {}),
    ...(optionalString(raw.updatedByUserId, `${field}.updatedByUserId`, 160) ? { updatedByUserId: raw.updatedByUserId as string } : {}),
    ...(raw.recurring !== undefined ? { recurring: Boolean(raw.recurring) } : {}),
    ...(optionalString(raw.templateId, `${field}.templateId`, 160) ? { templateId: raw.templateId as string } : {}),
    status,
    paidAmount: lifecycleProgress(raw.paidAmount, amount, status, `${field}.paidAmount`),
    ...(optionalString(raw.paidAt, `${field}.paidAt`, 40) ? { paidAt: raw.paidAt as string } : {}),
    ...(optionalString(raw.receiptUrl, `${field}.receiptUrl`, 150_000) ? { receiptUrl: raw.receiptUrl as string } : {}),
    ...(raw.sourceType !== undefined ? { sourceType: enumValue(raw.sourceType, `${field}.sourceType`, FIXED_SOURCE_TYPES) } : {}),
    ...(optionalString(raw.sourceId, `${field}.sourceId`, 160) ? { sourceId: raw.sourceId as string } : {}),
    ...(optionalString(raw.importFingerprint, `${field}.importFingerprint`, 160) ? { importFingerprint: raw.importFingerprint as string } : {}),
  };
}

function parseDebtPayment(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, ['id', 'amount', 'date', 'place', 'note', 'createdByUserId'], field);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    amount: money(raw.amount, `${field}.amount`),
    date: calendarDate(raw.date, `${field}.date`),
    place: text(raw.place, `${field}.place`, 80, { min: 0 }),
    ...(optionalString(raw.note, `${field}.note`, 500) ? { note: raw.note as string } : {}),
    ...(optionalString(raw.createdByUserId, `${field}.createdByUserId`, 160) ? { createdByUserId: raw.createdByUserId as string } : {}),
  };
}

function parseDebt(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'name', 'amount', 'type', 'status', 'date', 'dueDate', 'payments',
    'note', 'carriedFromId',
  ], field);
  const payments = raw.payments === undefined ? [] : entities(raw.payments, `${field}.payments`, LIMITS.debtPayments, parseDebtPayment);
  const amount = money(raw.amount, `${field}.amount`);
  // Payment history may never mint a negative outstanding balance.
  const paid = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  if (paid > amount) {
    throw new InvalidFinanceBackupError(`${field} payments exceed the original amount.`);
  }
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    name: text(raw.name, `${field}.name`, 120),
    amount,
    type: enumValue(raw.type, `${field}.type`, ['debt', 'credit'] as const),
    status: enumValue(raw.status ?? 'open', `${field}.status`, ['open', 'settled'] as const),
    date: calendarDate(raw.date, `${field}.date`),
    ...(raw.dueDate !== undefined ? { dueDate: calendarDate(raw.dueDate, `${field}.dueDate`) } : {}),
    payments,
    ...(optionalString(raw.note, `${field}.note`, 500) ? { note: raw.note as string } : {}),
    ...(optionalString(raw.carriedFromId, `${field}.carriedFromId`, 160) ? { carriedFromId: raw.carriedFromId as string } : {}),
  };
}

function parseTransfer(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, ['id', 'from', 'to', 'amount', 'date', 'createdByUserId'], field);
  const from = text(raw.from, `${field}.from`, 80, { min: 0 });
  const to = text(raw.to, `${field}.to`, 80, { min: 0 });
  if (from === to) throw new InvalidFinanceBackupError(`${field} must move between two different money places.`);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    from,
    to,
    amount: money(raw.amount, `${field}.amount`),
    date: isoTimestamp(raw.date, `${field}.date`),
    ...(optionalString(raw.createdByUserId, `${field}.createdByUserId`, 160) ? { createdByUserId: raw.createdByUserId as string } : {}),
  };
}

function parseAdjustment(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'place', 'previousBalance', 'newBalance', 'delta', 'reason', 'note',
    'date', 'createdByUserId',
  ], field);
  const previousBalance = money(raw.previousBalance, `${field}.previousBalance`);
  const newBalance = money(raw.newBalance, `${field}.newBalance`);
  const delta = signedMoney(raw.delta, `${field}.delta`);
  // A signed delta is only honest when it reconciles with the balance change.
  if (delta !== round2(newBalance - previousBalance)) {
    throw new InvalidFinanceBackupError(`${field}.delta does not reconcile with the balance change.`);
  }
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    place: text(raw.place, `${field}.place`, 80, { min: 0 }),
    previousBalance,
    newBalance,
    delta,
    reason: enumValue(raw.reason ?? 'reconciliation', `${field}.reason`, ADJUSTMENT_REASONS),
    ...(optionalString(raw.note, `${field}.note`, 500) ? { note: raw.note as string } : {}),
    date: isoTimestamp(raw.date, `${field}.date`),
    ...(optionalString(raw.createdByUserId, `${field}.createdByUserId`, 160) ? { createdByUserId: raw.createdByUserId as string } : {}),
  };
}

function parseSavingsActivity(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, ['id', 'goalId', 'goalName', 'type', 'amount', 'date', 'place'], field);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    goalId: text(raw.goalId, `${field}.goalId`, 160, { min: 0 }),
    goalName: text(raw.goalName, `${field}.goalName`, 100),
    type: enumValue(raw.type, `${field}.type`, ['deposit', 'withdraw'] as const),
    amount: money(raw.amount, `${field}.amount`),
    date: isoTimestamp(raw.date, `${field}.date`),
    ...(optionalString(raw.place, `${field}.place`, 80) ? { place: raw.place as string } : {}),
  };
}

function parseMonth(raw: unknown, field: string, monthKey: string): MonthBudget {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, MONTH_ALLOWED_KEYS, field);

  // Conservative document-size ceiling: a month that cannot fit one Firestore
  // document would fail mid-restore and leave a misleading partial state.
  const bytes = JSON.stringify(raw).length;
  if (bytes > MAX_MONTH_BACKUP_BYTES) {
    throw new InvalidFinanceBackupError(`${field} exceeds the ${MAX_MONTH_BACKUP_BYTES}-byte restore ceiling (${bytes} bytes).`);
  }

  const periodStatus = optionalEnumValue(raw.periodStatus, `${field}.periodStatus`, ['open', 'closed'] as const, 'open');
  // A closed period is only writable with the record of who closed it and when -
  // Firestore Rules ask for both. A file that says `closed` without them is
  // restored open, and said so, rather than aborting the restore halfway through.
  if (periodStatus === 'closed'
    && (typeof raw.closedAt !== 'string' || typeof raw.closedByUserId !== 'string' || !raw.closedByUserId)) {
    note('reopenedPeriods', monthKey);
    raw.periodStatus = 'open';
    delete raw.closedAt;
    delete raw.closedByUserId;
  } else if (periodStatus === 'closed') {
    isoTimestamp(raw.closedAt, `${field}.closedAt`);
    text(raw.closedByUserId, `${field}.closedByUserId`, 160);
  }

  if (raw.revision !== undefined
    && (typeof raw.revision !== 'number' || !Number.isInteger(raw.revision) || raw.revision < 0)) {
    throw new InvalidFinanceBackupError(`${field}.revision must be a non-negative integer.`);
  }
  optionalString(raw.lastMutationId, `${field}.lastMutationId`, 160);
  if (raw.currency !== undefined) text(raw.currency, `${field}.currency`, 8, { min: 3 });
  if (raw.periodStartDay !== undefined) dayOfMonth(raw.periodStartDay, `${field}.periodStartDay`);
  optionalString(raw.periodStartDate, `${field}.periodStartDate`, 20);
  optionalString(raw.periodEndDate, `${field}.periodEndDate`, 20);
  optionalString(raw.updatedByUserId, `${field}.updatedByUserId`, 160);

  const customRatios = raw.customRatios === undefined ? undefined : (() => {
    if (!isObject(raw.customRatios)) throw new InvalidFinanceBackupError(`${field}.customRatios must be an object.`);
    const needs = money(raw.customRatios.needs, `${field}.customRatios.needs`);
    const wants = money(raw.customRatios.wants, `${field}.customRatios.wants`);
    const savings = money(raw.customRatios.savings, `${field}.customRatios.savings`);
    if (needs <= 0 || wants <= 0 || savings <= 0 || round2(needs + wants + savings) !== 1) {
      throw new InvalidFinanceBackupError(`${field}.customRatios must be positive fractions summing to 1.`);
    }
    return { needs, wants, savings };
  })();

  return {
    ...(raw as unknown as MonthBudget),
    periodKey: raw.periodKey === undefined ? monthKey : text(raw.periodKey, `${field}.periodKey`, 10, { min: 0 }),
    // Fields a period cannot be without are completed the way an empty period in
    // this app is defined, so an older or hand-trimmed file still restores; each one
    // is reported, because a zero the file never carried is information too.
    ...(() => {
      if (raw.totalBudget === undefined || raw.bankPart === undefined) note('completedFields', field.replace(/\.$/, ''));
      return {};
    })(),
    totalBudget: moneyOr(raw.totalBudget, `${field}.totalBudget`, 0),
    bankPart: moneyOr(raw.bankPart, `${field}.bankPart`, 0),
    homePart: moneyOr(raw.homePart, `${field}.homePart`, 0),
    walletPart: moneyOr(raw.walletPart, `${field}.walletPart`, 0),
    // The removed '80-20' preset held the same ratios as 50/30/20, which is what
    // normalizeMonth() maps it to: the label moves, the numbers do not.
    strategyId: enumValueOr(raw.strategyId === '80-20' ? '50-30-20' : raw.strategyId, `${field}.strategyId`, STRATEGIES, '50-30-20'),
    monthlySavingsTarget: moneyOr(raw.monthlySavingsTarget, `${field}.monthlySavingsTarget`, 0),
    incomeSources: raw.incomeSources === undefined ? [] : entities(raw.incomeSources, `${field}.incomeSources`, LIMITS.incomeSources, parseIncomeSource),
    variableExpenses: raw.variableExpenses === undefined ? [] : entities(raw.variableExpenses, `${field}.variableExpenses`, LIMITS.variableExpenses, parseVariableExpense),
    fixedExpenses: raw.fixedExpenses === undefined ? [] : entities(raw.fixedExpenses, `${field}.fixedExpenses`, LIMITS.fixedExpenses, parseFixedExpense),
    debts: raw.debts === undefined ? [] : entities(raw.debts, `${field}.debts`, LIMITS.debts, parseDebt),
    transfers: raw.transfers === undefined ? [] : entities(raw.transfers, `${field}.transfers`, LIMITS.transfers, parseTransfer),
    balanceAdjustments: raw.balanceAdjustments === undefined ? [] : entities(raw.balanceAdjustments, `${field}.balanceAdjustments`, LIMITS.adjustments, parseAdjustment),
    savingsActivity: raw.savingsActivity === undefined ? [] : entities(raw.savingsActivity, `${field}.savingsActivity`, LIMITS.savingsActivity, parseSavingsActivity),
    variableCategoryBases: moneyMap(raw.variableCategoryBases ?? {}, `${field}.variableCategoryBases`),
    fixedCategoryBases: moneyMap(raw.fixedCategoryBases ?? {}, `${field}.fixedCategoryBases`),
    categoryBudgets: raw.categoryBudgets === undefined ? undefined : moneyMap(raw.categoryBudgets, `${field}.categoryBudgets`),
    rolloverFromPrevious: raw.rolloverFromPrevious === undefined ? undefined : moneyMap(raw.rolloverFromPrevious, `${field}.rolloverFromPrevious`),
    categoryEnvelopes: raw.categoryEnvelopes === undefined ? undefined : envelopeMap(raw.categoryEnvelopes, `${field}.categoryEnvelopes`),
    ...(customRatios ? { customRatios } : {}),
    activeCategories: stringArray(raw.activeCategories ?? [], `${field}.activeCategories`, LIMITS.mapEntries),
    categoryColors: textMap(raw.categoryColors ?? {}, `${field}.categoryColors`, 32),
    categoryIcons: textMap(raw.categoryIcons ?? {}, `${field}.categoryIcons`, 64),
    ...(raw.placeBalances !== undefined ? { placeBalances: moneyMap(raw.placeBalances, `${field}.placeBalances`) } : {}),
    updatedAt: optionalString(raw.updatedAt, `${field}.updatedAt`, 40) ?? new Date().toISOString(),
  };
}

function parseGoal(raw: unknown, field: string): SavingGoal {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, ['id', 'name', 'target', 'current', 'source', 'active', 'category', 'deposited'], field);
  return {
    id: identifier(raw.id, `${field}.id`, 'entry'),
    name: text(raw.name, `${field}.name`, 100),
    target: money(raw.target, `${field}.target`),
    current: money(raw.current, `${field}.current`),
    // A goal's funding place is a label the app carries; an older file may not have
    // one, and inventing a place would move money the user never assigned.
    source: optionalString(raw.source, `${field}.source`, 80) ?? '',
    active: raw.active === undefined ? true : Boolean(raw.active),
    ...(optionalString(raw.category, `${field}.category`, 100) ? { category: raw.category as string } : {}),
    ...(raw.deposited !== undefined ? { deposited: money(raw.deposited, `${field}.deposited`) } : {}),
  };
}

/**
 * A product is keyed by its barcode, so a file that lost one still gets a
 * placeholder key and survives; a barcode that is present but not a barcode is a
 * different product than the file claims, and inventing one would silently move the
 * price history to a shelf it never belonged on.
 */
function productBarcode(value: unknown, field: string): string {
  if (typeof value === 'string' && /^\d{8}$|^\d{13}$/.test(value)) return value;
  if (value !== undefined && value !== null && value !== '') {
    throw new InvalidFinanceBackupError(`${field} must be 8 or 13 digits.`);
  }
  note('generatedIds', field);
  // 13 digits, the EAN-13 length the app also accepts, so a placeholder can never
  // collide with a scanned barcode.
  return `000000${String(entryIndex(field) % 10000000).padStart(7, '0')}`;
}
function parseProduct(raw: unknown, field: string): Product {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'barcode', 'name', 'brand', 'category', 'imageUrl', 'lastPrice',
    'priceUpdatedAt', 'source', 'origin', 'createdAt', 'updatedAt',
  ], field);
  const barcode = productBarcode(raw.barcode, `${field}.barcode`);
  return {
    barcode,
    name: text(raw.name, `${field}.name`, 100),
    ...(optionalString(raw.brand, `${field}.brand`, 100) ? { brand: raw.brand as string } : {}),
    ...(optionalString(raw.category, `${field}.category`, 100) ? { category: raw.category as string } : {}),
    ...(optionalString(raw.imageUrl, `${field}.imageUrl`, 500) ? { imageUrl: raw.imageUrl as string } : {}),
    ...(raw.lastPrice !== undefined ? { lastPrice: money(raw.lastPrice, `${field}.lastPrice`) } : {}),
    ...(optionalString(raw.priceUpdatedAt, `${field}.priceUpdatedAt`, 40) ? { priceUpdatedAt: raw.priceUpdatedAt as string } : {}),
    source: enumValueOr(raw.source, `${field}.source`, PRODUCT_SOURCES, 'manual'),
    ...(optionalString(raw.origin, `${field}.origin`, 8) ? { origin: raw.origin as string } : {}),
    createdAt: isoTimestamp(raw.createdAt ?? fileTimestamp, `${field}.createdAt`),
    updatedAt: isoTimestamp(raw.updatedAt ?? fileTimestamp, `${field}.updatedAt`),
  } as Product;
}

function parseSessionItem(raw: unknown, field: string) {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, ['key', 'barcode', 'name', 'category', 'qty', 'unitPrice', 'lineTotal'], field);
  const rawQty: unknown = raw.qty;
  const qty = typeof rawQty === 'number' ? Math.round(rawQty) : NaN;
  if (typeof rawQty !== 'number' || !Number.isFinite(rawQty) || rawQty < 1 || rawQty > 10_000 || qty !== rawQty) {
    throw new InvalidFinanceBackupError(`${field}.qty must be a positive integer.`);
  }
  const unitPrice = money(raw.unitPrice, `${field}.unitPrice`);
  const lineTotal = money(raw.lineTotal, `${field}.lineTotal`);
  // A line whose total disagrees with qty × unitPrice is rewritten to agree: the
  // session bill is derived from these lines, so an unreconciled entry would
  // either abort the restore or restore a bill the app then contradicts.
  const expected = round2(qty * unitPrice);
  if (lineTotal !== expected) note('recalculatedTotals', field);
  return {
    key: identifier(raw.key, `${field}.key`, 'item'),
    ...(optionalString(raw.barcode, `${field}.barcode`, 13) ? { barcode: raw.barcode as string } : {}),
    name: text(raw.name, `${field}.name`, 100),
    ...(optionalString(raw.category, `${field}.category`, 100) ? { category: raw.category as string } : {}),
    qty,
    unitPrice,
    lineTotal: expected,
  };
}

function parseSession(raw: unknown, field: string): CourseSession {
  if (!isObject(raw)) throw new InvalidFinanceBackupError(`${field} must be an object.`);
  assertKnownKeys(raw, [
    'id', 'status', 'startedAt', 'endedAt', 'date', 'currency', 'place',
    'items', 'total', 'loggedExpenseId', 'loggedMonthKey', 'loggedWorkspace',
    'loggedWorkspaceId', 'loggedMutationId', 'loggedAt',
  ], field);
  // Session lines are keyed by `key`, not `id`.
  const items = raw.items === undefined ? [] : entities(raw.items, `${field}.items`, LIMITS.sessionItems, parseSessionItem, 'key');
  // The session total is the bill it renders, so it is recomputed from the lines
  // rather than trusted - and reported when the file disagreed with itself.
  const expectedTotal = round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const total = moneyOr(raw.total, `${field}.total`, expectedTotal);
  if (items.length > 0 && total !== expectedTotal) {
    note('recalculatedTotals', field);
  }
  return {
    id: identifier(raw.id, `${field}.id`, 'session'),
    status: enumValueOr(raw.status, `${field}.status`, SESSION_STATUS, 'completed'),
    startedAt: isoTimestamp(raw.startedAt ?? fileTimestamp, `${field}.startedAt`),
    ...(optionalString(raw.endedAt, `${field}.endedAt`, 40) ? { endedAt: raw.endedAt as string } : {}),
    date: calendarDate(raw.date, `${field}.date`),
    currency: text(raw.currency, `${field}.currency`, 8, { min: 0 }),
    place: text(raw.place, `${field}.place`, 80, { min: 0 }),
    items,
    total: expectedTotal,
    ...(optionalString(raw.loggedExpenseId, `${field}.loggedExpenseId`, 160) ? { loggedExpenseId: raw.loggedExpenseId as string } : {}),
    ...(optionalString(raw.loggedMonthKey, `${field}.loggedMonthKey`, 10) ? { loggedMonthKey: raw.loggedMonthKey as string } : {}),
    ...(raw.loggedWorkspace !== undefined ? { loggedWorkspace: enumValue(raw.loggedWorkspace, `${field}.loggedWorkspace`, ['personal', 'household'] as const) } : {}),
    ...(optionalString(raw.loggedWorkspaceId, `${field}.loggedWorkspaceId`, 160) ? { loggedWorkspaceId: raw.loggedWorkspaceId as string } : {}),
    ...(optionalString(raw.loggedMutationId, `${field}.loggedMutationId`, 160) ? { loggedMutationId: raw.loggedMutationId as string } : {}),
    ...(optionalString(raw.loggedAt, `${field}.loggedAt`, 40) ? { loggedAt: raw.loggedAt as string } : {}),
  } as CourseSession;
}

/** Finance-only configuration: unknown and identity/entitlement keys are dropped. */
function sanitizeConfiguration(raw: unknown): Partial<UserProfile> | Partial<Household> {
  if (!isObject(raw)) throw new InvalidFinanceBackupError('Backup configuration is invalid.');
  const result: Record<string, unknown> = {};
  for (const key of CONFIG_ALLOWED_KEYS) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (key === 'defaultCategoryBudgets') {
      result[key] = moneyMap(raw[key], `configuration.${key}`);
    } else if (key === 'defaultCategoryEnvelopes') {
      result[key] = envelopeMap(raw[key], `configuration.${key}`);
    } else if (key === 'activeCategories') {
      result[key] = stringArray(raw[key], `configuration.${key}`, LIMITS.mapEntries);
    } else if (key === 'categoryColors') {
      result[key] = textMap(raw[key], `configuration.${key}`, 32);
    } else if (key === 'categoryIcons') {
      result[key] = textMap(raw[key], `configuration.${key}`, 64);
    } else if (key === 'moneyPlaces') {
      const places = raw[key];
      if (!Array.isArray(places) || places.length > 30) {
        throw new InvalidFinanceBackupError('configuration.moneyPlaces must be an array of at most 30 entries.');
      }
      result[key] = places.map((place, index) => {
        if (!isObject(place)) throw new InvalidFinanceBackupError(`configuration.moneyPlaces[${index}] must be an object.`);
        assertKnownKeys(place, ['id', 'name', 'icon'], `configuration.moneyPlaces[${index}]`);
        return {
          id: text(place.id, `configuration.moneyPlaces[${index}].id`, 80),
          name: text(place.name, `configuration.moneyPlaces[${index}].name`, 60),
          ...(optionalString(place.icon, `configuration.moneyPlaces[${index}].icon`, 64) ? { icon: place.icon as string } : {}),
        };
      });
    } else if (key === 'fixedCategories') {
      const cats = raw[key];
      if (!Array.isArray(cats) || cats.length > 50) {
        throw new InvalidFinanceBackupError('configuration.fixedCategories must be an array of at most 50 entries.');
      }
      result[key] = cats.map((cat, index) => {
        if (!isObject(cat)) throw new InvalidFinanceBackupError(`configuration.fixedCategories[${index}] must be an object.`);
        assertKnownKeys(cat, ['name', 'color', 'icon'], `configuration.fixedCategories[${index}]`);
        return {
          name: text(cat.name, `configuration.fixedCategories[${index}].name`, 60),
          color: text(cat.color, `configuration.fixedCategories[${index}].color`, 32),
          ...(optionalString(cat.icon, `configuration.fixedCategories[${index}].icon`, 64) ? { icon: cat.icon as string } : {}),
        };
      });
    } else if (key === 'enableRollover') {
      result[key] = Boolean(raw[key]);
    } else if (key === 'monthStartDate') {
      result[key] = dayOfMonth(raw[key], `configuration.${key}`);
    } else {
      result[key] = text(raw[key], `configuration.${key}`, 20, { min: 2 });
    }
  }
  return result as Partial<UserProfile> | Partial<Household>;
}

/**
 * Structural validation before any restore write is attempted. Every nested month
 * entity, goal, product and session is checked against the contracts Firestore
 * Rules and normalizeMonth() enforce, and arithmetic has to reconcile - but a file
 * is treated as the user's own data across *versions* and *accounts*, not only as
 * this build's exact output: keys this build lacks are dropped and reported,
 * fields a period cannot be without are completed, and a file from another
 * workspace type restores into the one the user is standing in. What stays fatal
 * is what cannot be written at all: unreadable JSON, an over-long period, amounts
 * Firestore Rules would refuse, and collections past their size limits.
 */
export function parseFinanceBackup(text: string): FinanceBackup {
  return readFinanceBackup(text).backup;
}

/** Parse a backup and report what had to be forgiven to read it. */
export function readFinanceBackup(text: string): { backup: FinanceBackup; notices: BackupNotice[] } {
  const report = new BackupReport();
  const previousReport = activeReport;
  const previousTimestamp = fileTimestamp;
  activeReport = report;
  try {
    return { backup: read(text), notices: report.notices() };
  } catch (error) {
    if (error instanceof InvalidFinanceBackupError) throw error;
    // A parser tripping over a value it did not expect (a goals entry that is a
    // string, a month that is a number) used to reach the UI as the generic
    // "unsupported file" notice, because only a named reason was quoted. The
    // reader's own words are the reason, so they are never swallowed.
    throw new InvalidFinanceBackupError(
      `The file could not be read as a backup: ${error instanceof Error && error.message ? error.message : String(error)}`,
      'unreadable',
    );
  } finally {
    activeReport = previousReport;
    fileTimestamp = previousTimestamp;
  }

function read(source: string): FinanceBackup {
  if (new Blob([source]).size > MAX_BACKUP_BYTES) {
    throw new InvalidFinanceBackupError('Backup exceeds the 20 MB safety limit.');
  }
  if (!source.trim()) {
    throw new InvalidFinanceBackupError('The file is empty.', 'emptyFile');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    // The wrong file people reach for is this app's own CSV report: the same data,
    // a different reader. Naming the reader is the difference between someone
    // finding the import screen and someone giving up on a file they exported.
    throw new InvalidFinanceBackupError(isSmartJibCsvExport(source)
      ? 'This is a SmartJib CSV report - import it from the CSV import screen instead.'
      : 'The file is not JSON, so it is not a backup this app can read.',
    isSmartJibCsvExport(source) ? 'csvReport' : 'notJson');
  }
  if (!isObject(raw)) {
    throw new InvalidFinanceBackupError('This is not a SmartJib backup: the file holds no backup object.');
  }
  if (raw.format !== FINANCE_BACKUP_FORMAT) {
    // Unmarked, but shaped like one. A backup written before the format marker, or
    // renamed and re-saved by hand, is still the user's budget.
    if (!isObject(raw.months) && !Array.isArray(raw.goals)) {
      throw new InvalidFinanceBackupError('This is not a SmartJib backup: it holds no budget periods.');
    }
    note('unmarkedFile');
  }
  if (typeof raw.version === 'number' && Number.isInteger(raw.version) && raw.version > FINANCE_BACKUP_VERSION) {
    note('newerVersion', String(raw.version));
  }
  if (raw.months !== undefined && !isObject(raw.months)) {
    throw new InvalidFinanceBackupError('This is not a SmartJib backup: its periods are not a list of months.');
  }
  if (raw.goals !== undefined && !Array.isArray(raw.goals)) {
    throw new InvalidFinanceBackupError('This is not a SmartJib backup: its savings goals are not a list.');
  }
  if (raw.configuration !== undefined && !isObject(raw.configuration)) {
    throw new InvalidFinanceBackupError('This is not a SmartJib backup: its settings are not an object.');
  }
  const exportedAt = typeof raw.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt))
    ? raw.exportedAt
    : new Date().toISOString();
  fileTimestamp = exportedAt;
  const workspaceInput = isObject(raw.workspace) ? raw.workspace : undefined;
  const workspaceType = workspaceInput?.type === 'personal' || workspaceInput?.type === 'household'
    ? workspaceInput.type as 'personal' | 'household'
    : 'unknown';
  const workspaceId = typeof workspaceInput?.id === 'string' ? workspaceInput.id : '';
  const months: Record<string, MonthBudget> = {};
  for (const [monthKey, month] of Object.entries(isObject(raw.months) ? raw.months : {})) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) || !isObject(month)) {
      throw new InvalidFinanceBackupError(`Invalid month entry: ${monthKey}.`);
    }
    months[monthKey] = parseMonth(month, `month ${monthKey}`, monthKey);
  }
  if (Object.keys(months).length > LIMITS.months) {
    throw new InvalidFinanceBackupError('Backup contains more months than SmartJib can safely restore.');
  }
  const goals = entities(raw.goals ?? [], 'goals', LIMITS.goals, parseGoal);
  // Products are keyed by their barcode (the document id), not an `id` field.
  const products = raw.products === undefined
    ? undefined
    : entities(raw.products, 'products', LIMITS.products, parseProduct, 'barcode');
  const sessions = raw.sessions === undefined ? undefined : entities(raw.sessions, 'sessions', LIMITS.sessions, parseSession);
  if (raw.sessions !== undefined && !Array.isArray(raw.sessions)) {
    throw new InvalidFinanceBackupError('Backup sessions must be an array.');
  }

  return {
    format: FINANCE_BACKUP_FORMAT,
    version: FINANCE_BACKUP_VERSION,
    id: safeBackupId(raw.id),
    exportedAt,
    workspace: {
      type: workspaceType,
      id: workspaceId,
      ...(typeof workspaceInput?.name === 'string' ? { name: workspaceInput.name } : {}),
    },
    configuration: sanitizeConfiguration(raw.configuration ?? {}),
    months,
    goals,
    ...(products ? { products } : {}),
    ...(sessions ? { sessions } : {}),
  };
}
}

/** Where a parsed backup is going, so a plan can be shown before anything is written. */
export interface BackupDestination {
  workspace: 'personal' | 'household';
  /** Restoring into a shared workspace changes what everyone in it sees. */
  isOwner: boolean;
  currency?: string;
  monthStartDate?: number;
  name?: string;
}

export type BackupPlanCode =
  | 'retargeted'
  | 'currencyDiffers'
  | 'monthStartDiffers'
  | 'householdOwnerOnly';

export interface BackupPlanNotice {
  code: BackupPlanCode;
  params: Record<string, string | number>;
}

export interface BackupPlan {
  canRestore: boolean;
  notices: BackupPlanNotice[];
  counts: { months: number; goals: number; products: number; sessions: number };
}

/**
 * The decision the restore dialog shows: what is in the file, where it will land,
 * and which differences between the two the user is accepting. Currency and
 * budget-period start are deliberately *not* blockers - the file's amounts stay as
 * they were recorded, and every restored period carries its own start day - but
 * they are said out loud, because a number shown in another currency is a number
 * the user has to agree to read.
 */
export function planFinanceBackupRestore(
  backup: FinanceBackup,
  destination: BackupDestination,
): BackupPlan {
  const notices: BackupPlanNotice[] = [];
  const source = backup.workspace;
  if (source.type !== 'unknown' && source.type !== destination.workspace) {
    notices.push({
      code: 'retargeted',
      params: {
        from: source.name || source.type,
        to: destination.name || destination.workspace,
      },
    });
  }
  const fileCurrency = typeof backup.configuration.currency === 'string' ? backup.configuration.currency : undefined;
  if (fileCurrency && destination.currency && fileCurrency !== destination.currency) {
    notices.push({ code: 'currencyDiffers', params: { from: fileCurrency, to: destination.currency } });
  }
  const fileStart = Number(backup.configuration.monthStartDate || 1);
  const destinationStart = Number(destination.monthStartDate || 1);
  if (fileStart !== destinationStart) {
    notices.push({ code: 'monthStartDiffers', params: { from: fileStart, to: destinationStart } });
  }
  const sharedWorkspace = destination.workspace === 'household';
  if (sharedWorkspace && !destination.isOwner) {
    notices.push({ code: 'householdOwnerOnly', params: {} });
  }
  return {
    canRestore: !sharedWorkspace || destination.isOwner,
    notices,
    counts: {
      months: Object.keys(backup.months).length,
      goals: backup.goals.length,
      products: backup.products?.length ?? 0,
      sessions: backup.sessions?.length ?? 0,
    },
  };
}

export function serializeFinanceBackup(backup: FinanceBackup): string {
  return JSON.stringify(backup, null, 2);
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
