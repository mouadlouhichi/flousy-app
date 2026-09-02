import type { FixedExpense, MoneyPlace, VariableExpense } from './store';

export interface CsvFingerprintInput {
  kind: 'variable' | 'fixed';
  date: string;
  name: string;
  amount: number;
  category: string;
  place: MoneyPlace;
  note?: string;
  person?: string;
}

function normalize(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/\s+/g, ' ');
}

/** Small deterministic, non-cryptographic hash suitable for stable document IDs. */
function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

/**
 * Bank exports rarely provide stable transaction IDs. This canonical fingerprint
 * detects repeat imports across files/locales while remaining independent of row
 * ordering and upload time.
 */
export function csvImportFingerprint(input: CsvFingerprintInput): string {
  const cents = Math.round(Math.abs(input.amount) * 100);
  const canonical = [
    'csv-v1',
    input.kind,
    input.date,
    normalize(input.name),
    String(cents),
    normalize(input.category),
    normalize(input.place),
    normalize(input.note),
    normalize(input.person),
  ].join('|');
  return fnv1a(canonical);
}

export function variableExpenseFingerprint(expense: VariableExpense): string {
  return expense.importFingerprint || csvImportFingerprint({
    kind: 'variable',
    date: expense.date,
    name: expense.name,
    amount: expense.amount,
    category: expense.type,
    place: expense.place,
    note: expense.note,
    person: expense.person,
  });
}

export function fixedExpenseFingerprint(expense: FixedExpense): string {
  return expense.importFingerprint || csvImportFingerprint({
    kind: 'fixed',
    date: expense.date || '',
    name: expense.name,
    amount: expense.amount,
    category: expense.type,
    place: expense.place,
    person: expense.person,
  });
}

export function csvImportId(kind: 'variable' | 'fixed', fingerprint: string): string {
  return `csv-${kind === 'variable' ? 'var' : 'fix'}-${fingerprint}`;
}
