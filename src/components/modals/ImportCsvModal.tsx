'use client';

import { AppIcon } from '@/components/ui/app-icon';
import { CustomSelect } from '@/components/ui/CustomSelect';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { VariableExpense, FixedExpense, MoneyPlace, MonthBudget, getPlaceBalance } from '../../lib/store';
import { useCurrency } from '../../lib/currency-context';
import { useLanguage } from '../../lib/i18n-context';
import type { Language } from '../../lib/i18n-core';
import { useMoneyPlaces } from '../../lib/use-money-places';
import { localizeCategoryName } from '../../lib/localized-labels';
import { formatShortDate } from '../../lib/utils';
import { csvImportFingerprint, csvImportId, fixedExpenseFingerprint, variableExpenseFingerprint } from '../../lib/csv-import';
import { MONTHLY_FIXED_EXPENSE_LIMIT, MONTHLY_VARIABLE_EXPENSE_LIMIT } from '../../lib/validation';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  month: MonthBudget;
  onImportVariable: (expenses: VariableExpense[]) => void;
  onImportFixed: (bills: FixedExpense[]) => void;
}

interface ParsedRow {
  date: string;
  name: string;
  amount: number;
  category: string;
  place: MoneyPlace;
  person?: string;
  note?: string;
  fingerprint: string;
}

type CsvHeaderKind = 'name' | 'amount' | 'date' | 'category' | 'place' | 'note' | 'person';
type CsvColumnMapping = CsvHeaderKind | 'ignore';
interface CsvColumn {
  label: string;
  mapping: CsvColumnMapping;
}

/**
 * CSV exports use the language configured by the bank or spreadsheet. These
 * aliases let an Arabic or French user import an export without first having
 * to rename every heading in English.
 */
const CSV_HEADER_ALIASES: Record<CsvHeaderKind, readonly string[]> = {
  name: ['name', 'description', 'item', 'nom', 'designation', 'libelle', 'اسم', 'الاسم', 'وصف', 'الوصف', 'عنصر'],
  amount: ['amount', 'price', 'value', 'val', 'montant', 'prix', 'valeur', 'مبلغ', 'المبلغ', 'سعر', 'القيمة', 'قيمة'],
  date: ['date', 'time', 'temps', 'تاريخ', 'التاريخ', 'وقت'],
  category: ['category', 'type', 'categorie', 'الفئة', 'فئة', 'تصنيف', 'النوع', 'نوع'],
  place: ['place', 'source', 'account', 'emplacement', 'compte', 'lieu', 'مكان', 'المكان', 'حساب', 'المصدر'],
  note: ['note', 'memo', 'comment', 'remarque', 'ملاحظة', 'ملاحظات', 'تعليق'],
  person: ['person', 'member', 'personne', 'membre', 'شخص', 'الشخص', 'عضو', 'العضو'],
};

function normalizeCsvText(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '');
}

function getCsvHeaderKind(header: string): CsvHeaderKind | undefined {
  const normalized = normalizeCsvText(header);
  if (!normalized) return undefined;

  return (Object.keys(CSV_HEADER_ALIASES) as CsvHeaderKind[]).find((kind) =>
    CSV_HEADER_ALIASES[kind].some(
      (alias) => normalized === alias || normalized.includes(alias),
    ),
  );
}

function detectCsvDelimiter(headerLine: string): ',' | ';' | '\t' {
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
 */
function splitCsvRecords(text: string, delimiter: string): string[] {
  const records: string[] = [];
  let record = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        record += '"';
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

function parseCsvLine(line: string, delimiter: string): string[] {
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

function toAsciiDigits(value: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹';
  return value
    .replace(/[٠-٩]/g, (digit) => String(arabicIndic.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(easternArabicIndic.indexOf(digit)));
}

/** Parse English, French, and Arabic-formatted money values without using the UI locale as a constraint. */
function parseLocalizedAmount(value: string, language: Language): number | null {
  const usesArabicDecimalSeparator = value.includes('٫');
  let normalized = toAsciiDigits(value)
    .replace(/[\s\u00A0\u202F]/g, '')
    .replace(/٬/g, ',')
    .replace(/٫/g, '.')
    .replace(/[^\d,.+\-]/g, '');

  if (!normalized || !/\d/.test(normalized)) return null;

  const sign = normalized.startsWith('-') ? '-' : '';
  normalized = sign + normalized.replace(/[+-]/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalIsComma = lastComma > lastDot;
    const decimalSeparator = decimalIsComma ? ',' : '.';
    const groupingSeparator = decimalIsComma ? /\./g : /,/g;
    normalized = normalized.replace(groupingSeparator, '').replace(decimalSeparator, '.');
  } else if (lastComma !== -1) {
    const parts = normalized.split(',');
    const decimal = parts[parts.length - 1];
    normalized = decimal.length <= 2
      ? `${parts.slice(0, -1).join('')}.${decimal}`
      : parts.join('');
  } else if (lastDot !== -1) {
    const parts = normalized.split('.');
    const decimal = parts[parts.length - 1];
    if (parts.length > 2) {
      normalized = decimal.length <= 2
        ? `${parts.slice(0, -1).join('')}.${decimal}`
        : parts.join('');
    } else if (language !== 'en' && !usesArabicDecimalSeparator && decimal.length === 3) {
      // In French/Arabic exports a single dot is commonly a thousands separator.
      normalized = parts.join('');
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function validIsoDate(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseLocalizedDate(value: string, language: Language): string | undefined {
  const datePart = toAsciiDigits(value).trim().replace(/[\u200E\u200F]/g, '').split(/[T ]/, 1)[0];
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(datePart);
  if (match) return validIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(datePart);
  if (!match) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  return language === 'en'
    ? validIsoDate(year, first, second)
    : validIsoDate(year, second, first);
}

function todayLocalIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function resolveCsvPlace(
  rawPlace: string,
  places: readonly { id: string; name: string }[],
  placeLabel: (id: string) => string,
): MoneyPlace {
  const normalized = normalizeCsvText(rawPlace);
  if (!normalized) return 'bank';

  const configuredPlace = places.find((place) =>
    [place.id, place.name, placeLabel(place.id)].some(
      (candidate) => normalizeCsvText(candidate) === normalized,
    ),
  );
  if (configuredPlace) return configuredPlace.id;

  const contains = (...aliases: string[]) => aliases.some(
    (alias) => normalized.includes(normalizeCsvText(alias)),
  );
  if (contains('home', 'cash', 'maison', 'domicile', 'especes', 'espèces', 'منزل', 'المنزل', 'بيت', 'البيت', 'نقد', 'النقد')) {
    return 'home';
  }
  if (contains('wallet', 'portefeuille', 'محفظة', 'المحفظة')) return 'wallet';
  return 'bank';
}

export function ImportCsvModal({
  isOpen,
  onClose,
  month,
  onImportVariable,
  onImportFixed,
}: ImportCsvModalProps) {
  const { format } = useCurrency();
  const { messages: m, t, intlLocale, language } = useLanguage();
  const copy = m.modals.importCsv;
  const { label: placeLabel, places } = useMoneyPlaces();
  const [targetType, setTargetType] = useState<'variable' | 'fixed'>('variable');
  const [fileText, setFileText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [truncated, setTruncated] = useState<boolean>(false);
  const [invalidCount, setInvalidCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [columns, setColumns] = useState<CsvColumn[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const content = loadEvent.target?.result;
      if (typeof content === 'string') {
        parseCsv(content);
      } else {
        setFileText('');
        setParsedRows([]);
        setError(copy.parseFailed);
      }
    };
    reader.onerror = () => {
      setFileText('');
      setParsedRows([]);
      setError(copy.parseFailed);
    };
    reader.readAsText(file);
  };

  const parseCsv = (
    csv: string,
    overrideColumns?: CsvColumn[],
    target: 'variable' | 'fixed' = targetType,
  ) => {
    setError(null);
    setParsedRows([]);
    setTruncated(false);
    setInvalidCount(0);
    setDuplicateCount(0);
    setFileText(csv);

    try {
      const firstPhysicalLine = csv.split(/\r?\n/)[0] ?? '';
      const lines = splitCsvRecords(csv, detectCsvDelimiter(firstPhysicalLine));

      if (lines.length < 2) {
        setError(copy.invalidRows);
        return;
      }

      const delimiter = detectCsvDelimiter(lines[0]);
      const headerLabels = parseCsvLine(lines[0], delimiter);
      const mappedColumns = overrideColumns && overrideColumns.length === headerLabels.length
        ? overrideColumns
        : headerLabels.map((label): CsvColumn => ({ label, mapping: getCsvHeaderKind(label) ?? 'ignore' }));
      setColumns(mappedColumns);

      if (!mappedColumns.some((column) => column.mapping === 'amount')) {
        setError(copy.mapAmountRequired);
        return;
      }

      const existingFingerprints = new Set(
        target === 'variable'
          ? (month.variableExpenses || []).map(variableExpenseFingerprint)
          : (month.fixedExpenses || []).map(fixedExpenseFingerprint),
      );
      const stagedFingerprints = new Set<string>();
      const remainingByPlace = new Map(
        places.map((moneyPlace) => [moneyPlace.id, getPlaceBalance(month, moneyPlace.id)]),
      );
      const rows: ParsedRow[] = [];
      let rejected = 0;
      let duplicates = 0;
      const maxRows = target === 'variable'
        ? Math.max(0, MONTHLY_VARIABLE_EXPENSE_LIMIT - (month.variableExpenses || []).length)
        : Math.max(0, MONTHLY_FIXED_EXPENSE_LIMIT - (month.fixedExpenses || []).length);

      for (let index = 1; index < lines.length; index += 1) {
        const values = parseCsvLine(lines[index], delimiter);
        if (values.length < 2) {
          rejected += 1;
          continue;
        }

        let name = '';
        let amount: number | null = null;
        let date = month.periodStartDate || todayLocalIso();
        let category = month.activeCategories?.[0] || 'Groceries';
        let place: MoneyPlace = 'bank';
        let note = '';
        let person = 'Self';
        let invalidDate = false;

        values.forEach((value, columnIndex) => {
          switch (mappedColumns[columnIndex]?.mapping) {
            case 'name':
              name = value.trim();
              break;
            case 'amount':
              amount = parseLocalizedAmount(value, language);
              break;
            case 'date': {
              const parsedDate = parseLocalizedDate(value, language);
              if (value.trim() && !parsedDate) invalidDate = true;
              if (parsedDate) date = parsedDate;
              break;
            }
            case 'category':
              if (value.trim()) category = value.trim();
              break;
            case 'place':
              place = resolveCsvPlace(value, places, placeLabel);
              break;
            case 'note':
              note = value.trim();
              break;
            case 'person':
              person = value.trim() || 'Self';
              break;
            default:
              break;
          }
        });

        const outsidePeriod = Boolean(
          (month.periodStartDate && date < month.periodStartDate)
          || (month.periodEndDate && date > month.periodEndDate),
        );
        if (!name) name = copy.importedExpense;
        if (invalidDate || outsidePeriod || amount === null || !Number.isFinite(amount) || amount <= 0) {
          rejected += 1;
          continue;
        }

        const fingerprint = csvImportFingerprint({
          kind: target,
          date,
          name,
          amount,
          category,
          place,
          note,
          person,
        });
        if (existingFingerprints.has(fingerprint) || stagedFingerprints.has(fingerprint)) {
          duplicates += 1;
          continue;
        }
        const remaining = remainingByPlace.get(place) ?? getPlaceBalance(month, place);
        if (amount > remaining) {
          rejected += 1;
          continue;
        }
        if (rows.length >= maxRows) {
          setTruncated(true);
          break;
        }
        stagedFingerprints.add(fingerprint);
        remainingByPlace.set(place, Math.round((remaining - amount) * 100) / 100);
        rows.push({ name, amount, date, category, place, note, person, fingerprint });
      }

      setInvalidCount(rejected);
      setDuplicateCount(duplicates);
      if (rows.length === 0) {
        setError(duplicates > 0 && rejected === 0 ? copy.allDuplicates : copy.noValidRows);
      } else {
        setParsedRows(rows);
      }
    } catch (reason) {
      console.error('CSV parsing failed:', reason);
      setError(copy.parseFailed);
    }
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    if (targetType === 'variable') {
      const expenses: VariableExpense[] = parsedRows.map((row) => ({
        id: csvImportId('variable', row.fingerprint),
        name: row.name,
        amount: row.amount,
        type: row.category,
        date: row.date,
        place: row.place,
        note: row.note,
        person: row.person,
        sourceType: 'csv',
        sourceId: row.fingerprint,
        importFingerprint: row.fingerprint,
      }));
      onImportVariable(expenses);
    } else {
      const bills: FixedExpense[] = parsedRows.map((row) => ({
        id: csvImportId('fixed', row.fingerprint),
        name: row.name,
        amount: row.amount,
        type: row.category,
        date: row.date,
        place: row.place,
        person: row.person,
        recurring: false,
        status: 'paid',
        paidAmount: row.amount,
        paidAt: row.date,
        sourceType: 'csv',
        sourceId: row.fingerprint,
        importFingerprint: row.fingerprint,
      }));
      onImportFixed(bills);
    }

    setParsedRows([]);
    setFileText('');
    setColumns([]);
    setInvalidCount(0);
    setDuplicateCount(0);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={copy.title}>
      <div className="flex flex-col gap-5">
        <div className="flex bg-surface-container-high rounded-xl p-1" role="group">
          <button
            type="button"
            onClick={() => {
              setTargetType('variable');
              if (fileText) parseCsv(fileText, columns, 'variable');
            }}
            aria-pressed={targetType === 'variable'}
            className={`flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all ${
              targetType === 'variable'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {copy.variableExpenses}
          </button>
          <button
            type="button"
            onClick={() => {
              setTargetType('fixed');
              if (fileText) parseCsv(fileText, columns, 'fixed');
            }}
            aria-pressed={targetType === 'fixed'}
            className={`flex-1 py-2.5 rounded-lg text-[14px] font-bold transition-all ${
              targetType === 'fixed'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {copy.fixedBills}
          </button>
        </div>

        <div className="p-6 bg-surface-container border-2 border-dashed border-outline-variant rounded-2xl text-center hover:bg-surface-container transition-colors cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            id="csv-file-input"
            className="hidden"
          />
          <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center gap-2">
            <AppIcon name="upload_file" className="text-[44px] text-primary" />
            <span className="font-label-lg text-label-lg font-bold text-on-surface">
              {copy.uploadLabel}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {copy.supportedColumns}
            </span>
          </label>
        </div>

        {fileText && columns.length > 0 && (
          <section className="rounded-2xl border border-outline-variant bg-surface-container p-3">
            <h3 className="mb-2 text-sm font-bold text-on-surface">{copy.mappingTitle}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {columns.map((column, index) => (
                <CustomSelect
                  key={`${column.label}-${index}`}
                  label={column.label || `${copy.column} ${index + 1}`}
                  value={column.mapping}
                  onChange={(mapping) => {
                    const next = columns.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, mapping: mapping as CsvColumnMapping } : item
                    ));
                    setColumns(next);
                    parseCsv(fileText, next);
                  }}
                  options={[
                    { value: 'ignore', label: copy.mapIgnore },
                    { value: 'name', label: copy.mapName },
                    { value: 'amount', label: copy.mapAmount },
                    { value: 'date', label: copy.mapDate },
                    { value: 'category', label: copy.mapCategory },
                    { value: 'place', label: copy.mapPlace },
                    { value: 'note', label: copy.mapNote },
                    { value: 'person', label: copy.mapPerson },
                  ]}
                />
              ))}
            </div>
          </section>
        )}

        {error && (
          <div role="alert" className="p-3 bg-error-container text-on-error-container rounded-xl text-[13px] font-medium flex items-start gap-2">
            <AppIcon name="error" className="text-[18px] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {(invalidCount > 0 || duplicateCount > 0) && (
          <p role="status" className="rounded-xl bg-secondary-container p-3 text-[13px] font-medium text-on-secondary-container">
            {t(copy.skippedRows, {
              invalid: new Intl.NumberFormat(intlLocale).format(invalidCount),
              duplicates: new Intl.NumberFormat(intlLocale).format(duplicateCount),
            })}
          </p>
        )}

        {truncated && (
          <p role="alert" className="p-3 rounded-xl bg-tertiary-container text-on-tertiary-container text-[13px] font-medium">
            {t(m.import.truncated, {
              limit: new Intl.NumberFormat(intlLocale).format(MONTHLY_VARIABLE_EXPENSE_LIMIT),
            })}
          </p>
        )}

        {parsedRows.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-extrabold tracking-wider text-on-surface-variant uppercase">
                {t(copy.preview, { count: new Intl.NumberFormat(intlLocale).format(parsedRows.length) })}
              </span>
              <span className="text-[13px] font-bold text-primary">
                {t(copy.total, { amount: format(parsedRows.reduce((total, row) => total + row.amount, 0)) })}
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pe-1">
              {parsedRows.map((row, index) => (
                <div
                  key={`${row.name}-${row.date}-${index}`}
                  className="p-2.5 bg-surface-container rounded-xl flex items-center justify-between"
                >
                  <div className="flex flex-col min-w-0 pe-2">
                    <span className="font-bold text-[13px] text-on-surface truncate">{row.name}</span>
                    <span className="text-[11px] text-on-surface-variant">
                      {formatShortDate(row.date, intlLocale)} · {localizeCategoryName(row.category, m)} ({placeLabel(row.place)})
                    </span>
                  </div>
                  <span className="font-bold text-[13px] text-error whitespace-nowrap">{format(row.amount)}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-[15px] shadow-md hover:bg-accent-foreground transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <AppIcon name="add_task" className="text-[20px]" />
              <span>{t(copy.importButton, { count: new Intl.NumberFormat(intlLocale).format(parsedRows.length) })}</span>
            </button>
          </div>
        )}

        {!fileText && !error && parsedRows.length === 0 && (
          <div className="p-4 bg-surface-container rounded-xl border border-dashed border-outline-variant text-center">
            <p className="text-[13px] text-on-surface-variant">{copy.selectFile}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
