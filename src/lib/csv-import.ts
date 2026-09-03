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

/* ------------------------------------------------------------------ *
 * The grammar: splitting, header recognition and the export contract.
 *
 * This lives next to the fingerprints on purpose. `src/lib/export.ts` writes the
 * report and `ImportCsvModal` reads it back; if the two sides each keep their own
 * copy of the section names, the column labels or the delimiter rules, "Export
 * this month" quietly stops being a file the app can import. They share the
 * definitions below instead, and the round-trip is pinned by tests.
 * ------------------------------------------------------------------ */

export type CsvTarget = 'variable' | 'fixed';
export type CsvHeaderKind = 'name' | 'amount' | 'date' | 'category' | 'place' | 'note' | 'person';
export type CsvColumnMapping = CsvHeaderKind | 'ignore';
export type CsvDelimiter = ',' | ';' | '\t';

export interface CsvColumn {
  label: string;
  mapping: CsvColumnMapping;
}

/**
 * CSV exports use the language configured by the bank or spreadsheet. These
 * aliases let an Arabic or French user import an export without first having
 * to rename every heading in English.
 */
export const CSV_HEADER_ALIASES: Record<CsvHeaderKind, readonly string[]> = {
  name: ['name', 'description', 'item', 'nom', 'designation', 'libelle', 'اسم', 'الاسم', 'وصف', 'الوصف', 'عنصر'],
  amount: ['amount', 'price', 'value', 'val', 'montant', 'prix', 'valeur', 'مبلغ', 'المبلغ', 'سعر', 'القيمة', 'قيمة'],
  date: ['date', 'time', 'temps', 'تاريخ', 'التاريخ', 'وقت'],
  category: ['category', 'type', 'categorie', 'الفئة', 'فئة', 'تصنيف', 'النوع', 'نوع'],
  // `Paid From` is what this app's own export calls the money place; the other
  // spellings are the same column in the French/Arabic translations of a sheet.
  place: ['place', 'source', 'account', 'emplacement', 'compte', 'lieu', 'paid from', 'paye depuis', 'provient de', 'مكان', 'المكان', 'حساب', 'المصدر'],
  note: ['note', 'memo', 'comment', 'remarque', 'ملاحظة', 'ملاحظات', 'تعليق'],
  person: ['person', 'member', 'personne', 'membre', 'شخص', 'الشخص', 'عضو', 'العضو'],
};

/** The three section labels the export writes for data the app can read back. */
export const CSV_EXPORT_SECTIONS: Record<CsvTarget, { banner: string; emptyRow: string; headers: string[] }> = {
  fixed: {
    banner: 'FIXED CHARGES',
    emptyRow: 'No fixed charges recorded',
    headers: ['Name', 'Category', 'Amount', 'Paid From'],
  },
  variable: {
    banner: 'VARIABLE EXPENSES',
    emptyRow: 'No variable expenses recorded',
    headers: ['Date', 'Name', 'Category', 'Amount', 'Paid From', 'Note'],
  },
};

/** Title line of the report; its presence marks a file as one of our own. */
export const CSV_EXPORT_TITLE = 'SmartJib Financial Export';

/** Sections a report carries that no import target owns: skipped, never rejected. */
export const CSV_EXPORT_OTHER_SECTIONS = [
  'MONEY PLACES BALANCES',
  'SAVINGS GOALS',
] as const;

export function normalizeCsvText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '');
}

export function getCsvHeaderKind(header: string): CsvHeaderKind | undefined {
  const normalized = normalizeCsvText(header);
  if (!normalized) return undefined;

  return (Object.keys(CSV_HEADER_ALIASES) as CsvHeaderKind[]).find((kind) =>
    CSV_HEADER_ALIASES[kind].some(
      (alias) => normalized === alias || normalized.includes(alias),
    ),
  );
}

export function mapCsvHeader(labels: readonly string[]): CsvColumn[] {
  return labels.map((label): CsvColumn => ({ label, mapping: getCsvHeaderKind(label) ?? 'ignore' }));
}

export function detectCsvDelimiter(headerLine: string): CsvDelimiter {
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;
  let inQuotes = false;

  for (let index = 0; index < headerLine.length; index += 1) {
    const character = headerLine[index];
    if (character === '"') {
      if (inQuotes && headerLine[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (inQuotes) continue;
    if (character === ',') commas += 1;
    else if (character === ';') semicolons += 1;
    else if (character === '\t') tabs += 1;
  }

  if (semicolons > commas && semicolons >= tabs) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return ',';
}

/**
 * Split the file into records first, then parse each record.
 *
 * The previous code did `text.split(/\r?\n/)` and ran the (otherwise correct)
 * quote-aware column parser over each physical line. A quoted field containing a
 * line break — which Excel and Google Sheets emit for multi-line notes — was cut
 * in half: the first half became a row whose note was truncated, and the second
 * half became a row of its own whose first column was the tail of someone's
 * note, imported as an expense name.
 *
 * Records come out verbatim - an escaped `""` stays escaped - because unescaping
 * is `parseCsvLine`'s job. Doing both here meant a cell containing a quote lost
 * its quotes on the way through, and lost the columns after it on the way back.
 */
export function splitCsvRecords(text: string, delimiter: CsvDelimiter): string[] {
  const records: string[] = [];
  let record = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        record += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      record += character;
      continue;
    }
    if (!inQuotes && (character === '\n' || character === '\r')) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      records.push(record);
      record = '';
      continue;
    }
    record += character;
  }
  records.push(record);
  return records.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

export function parseCsvLine(line: string, delimiter: CsvDelimiter): string[] {
  const values: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === delimiter && !inQuotes) {
      values.push(value.trim());
      value = '';
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

/** True when the file is one of this app's own monthly reports, not a bank export. */
export function isSmartJibCsvExport(text: string): boolean {
  return normalizeCsvText(text).includes(normalizeCsvText(CSV_EXPORT_TITLE));
}

export interface CsvLayout {
  /** Record index the column labels sit on. */
  headerIndex: number;
  delimiter: CsvDelimiter;
  /** Record indexes to read as data rows, in file order. */
  dataIndexes: number[];
  /** True when the rows came from one of this app's own report sections. */
  fromExportSection: boolean;
}

/**
 * A section line is a record of exactly one cell holding a known banner: the
 * quotes are part of the file, so the cells are compared, never the raw line.
 */
function sectionCells(record: string, delimiter: CsvDelimiter): string[] {
  const cells = parseCsvLine(record, delimiter);
  return cells.length === 1 ? cells : [];
}

function isKnownSectionLine(record: string, delimiter: CsvDelimiter): boolean {
  const cells = sectionCells(record, delimiter);
  if (cells.length === 0) return false;
  const normalized = normalizeCsvText(cells[0]);
  return Object.values(CSV_EXPORT_SECTIONS).some(
    (section) => normalizeCsvText(section.banner) === normalized,
  ) || CSV_EXPORT_OTHER_SECTIONS.some(
    (banner) => normalizeCsvText(banner) === normalized,
  );
}

/**
 * Find the header row and the rows that belong to `target`.
 *
 * A bank export is one flat table: the header is the first record. This app's
 * own export is a *report* - a title, a metadata preamble, then one banner and
 * one header per section - so importing it means selecting a section rather
 * than assuming where the header is. Without this, "Export this month" produced
 * a file the app could not read back: the title line became the header, no
 * column mapped to an amount, and every row was refused.
 *
 * Returns `null` when the file is a report that simply has nothing of this kind
 * in it; the caller says so instead of blaming the columns.
 */
export function locateCsvLayout(records: readonly string[], target: CsvTarget): CsvLayout | null {
  if (records.length === 0) return null;
  const section = CSV_EXPORT_SECTIONS[target];
  const scanDelimiter = detectCsvDelimiter(records[0]);
  const bannerIndex = records.findIndex((record) => {
    const cells = sectionCells(record, scanDelimiter);
    return cells.length === 1 && normalizeCsvText(cells[0]) === normalizeCsvText(section.banner);
  });

  if (bannerIndex >= 0) {
    const headerIndex = bannerIndex + 1;
    if (headerIndex >= records.length) return null;
    const delimiter = detectCsvDelimiter(records[headerIndex]);
    const emptyRow = normalizeCsvText(section.emptyRow);
    const dataIndexes: number[] = [];
    for (let index = headerIndex + 1; index < records.length; index += 1) {
      // A section ends where the next one begins; a placeholder row ("No fixed
      // charges recorded") is the export saying "nothing here", not a bad row.
      if (isKnownSectionLine(records[index], delimiter)) break;
      const cells = sectionCells(records[index], delimiter);
      if (cells.length === 1 && normalizeCsvText(cells[0]) === emptyRow) continue;
      if (parseCsvLine(records[index], delimiter).length < 2) continue;
      dataIndexes.push(index);
    }
    return { headerIndex, delimiter, dataIndexes, fromExportSection: true };
  }

  const looksLikeOurReport = records.some(
    (record) => normalizeCsvText(record).includes(normalizeCsvText(CSV_EXPORT_TITLE)),
  );
  if (looksLikeOurReport) return null;

  // A flat table: keep the long-standing rule that the first record is the header.
  const delimiter = detectCsvDelimiter(records[0]);
  const dataIndexes = records.slice(1).map((_, offset) => offset + 1);
  return { headerIndex: 0, delimiter, dataIndexes, fromExportSection: false };
}

/** A row's cells as written, before any locale-aware money or date parsing. */
export interface CsvRawRow {
  name: string;
  amount: string;
  date: string;
  category: string;
  place: string;
  note: string;
  person: string;
  /** Set when a date cell was present but unreadable, so the row is refused. */
  invalidDate: boolean;
}

/**
 * Pull the mapped cells out of one record. A missing column keeps the caller's
 * default, which is what makes a sparse bank export importable at all.
 */
export function readCsvRow(
  values: readonly string[],
  columns: readonly CsvColumn[],
): Pick<CsvRawRow, 'name' | 'amount' | 'date' | 'category' | 'place' | 'note' | 'person'> & { hasDate: boolean } {
  const cells: Record<string, string> = {};
  let hasDate = false;
  values.forEach((value, index) => {
    const mapping = columns[index]?.mapping;
    if (!mapping || mapping === 'ignore') return;
    if (cells[mapping] !== undefined && cells[mapping] !== '') return;
    cells[mapping] = value.trim();
    if (mapping === 'date' && value.trim()) hasDate = true;
  });
  return {
    name: cells.name || '',
    amount: cells.amount || '',
    date: cells.date || '',
    category: cells.category || '',
    place: cells.place || '',
    note: cells.note || '',
    person: cells.person || '',
    hasDate,
  };
}
