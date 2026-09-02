import type { CourseSession, MonthBudget, Product, SavingGoal, UserProfile } from './store';
import type { Household } from './household';

export const FINANCE_BACKUP_FORMAT = 'smartjib-finance-backup' as const;
export const FINANCE_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

export interface FinanceBackup {
  format: typeof FINANCE_BACKUP_FORMAT;
  version: typeof FINANCE_BACKUP_VERSION;
  id: string;
  exportedAt: string;
  workspace: { type: 'personal' | 'household'; id: string; name?: string };
  configuration: Partial<UserProfile> | Partial<Household>;
  months: Record<string, MonthBudget>;
  goals: SavingGoal[];
  products?: Product[];
  sessions?: CourseSession[];
}

export class InvalidFinanceBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFinanceBackupError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeBackupId(value: unknown): string {
  const id = typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) : '';
  return id || `backup-${Date.now()}`;
}

/** Strict structural validation before any restore write is attempted. */
export function parseFinanceBackup(text: string): FinanceBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) {
    throw new InvalidFinanceBackupError('Backup exceeds the 20 MB safety limit.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new InvalidFinanceBackupError('Backup is not valid JSON.');
  }
  if (!isObject(raw)
    || raw.format !== FINANCE_BACKUP_FORMAT
    || raw.version !== FINANCE_BACKUP_VERSION
    || !isObject(raw.workspace)
    || !['personal', 'household'].includes(String(raw.workspace.type))
    || typeof raw.workspace.id !== 'string'
    || !isObject(raw.months)
    || !Array.isArray(raw.goals)
    || !isObject(raw.configuration)) {
    throw new InvalidFinanceBackupError('Unsupported or incomplete SmartJib backup.');
  }
  const months: Record<string, MonthBudget> = {};
  for (const [monthKey, month] of Object.entries(raw.months)) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey) || !isObject(month)) {
      throw new InvalidFinanceBackupError(`Invalid month entry: ${monthKey}.`);
    }
    months[monthKey] = month as unknown as MonthBudget;
  }
  if (Object.keys(months).length > 600 || raw.goals.length > 200) {
    throw new InvalidFinanceBackupError('Backup contains more records than SmartJib can safely restore.');
  }
  if (raw.products !== undefined && !Array.isArray(raw.products)) {
    throw new InvalidFinanceBackupError('Backup product catalog is invalid.');
  }
  if (raw.sessions !== undefined && !Array.isArray(raw.sessions)) {
    throw new InvalidFinanceBackupError('Backup shopping sessions are invalid.');
  }

  return {
    format: FINANCE_BACKUP_FORMAT,
    version: FINANCE_BACKUP_VERSION,
    id: safeBackupId(raw.id),
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    workspace: {
      type: raw.workspace.type as 'personal' | 'household',
      id: raw.workspace.id,
      ...(typeof raw.workspace.name === 'string' ? { name: raw.workspace.name } : {}),
    },
    configuration: raw.configuration as Partial<UserProfile> | Partial<Household>,
    months,
    goals: raw.goals as SavingGoal[],
    ...(raw.products ? { products: raw.products as Product[] } : {}),
    ...(raw.sessions ? { sessions: raw.sessions as CourseSession[] } : {}),
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
